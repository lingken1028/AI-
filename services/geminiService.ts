import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AIAnalysis, SignalType, Timeframe, StockSymbol, BacktestStrategy, BacktestPeriod, BacktestResult, GuruInsight, RealTimeAnalysis, MarketRegime } from "../types";

const initAI = () => {
  if (!process.env.API_KEY) {
    console.error("API_KEY is missing from environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Helper: Robust number parsing
const parsePrice = (input: any): number => {
    if (typeof input === 'number') return input;
    if (typeof input === 'string') {
        let clean = input.replace(/,/g, '').replace(/[^\d.-]/g, '');
        const match = clean.match(/[-+]?[0-9]*\.?[0-9]+/);
        if (match) {
            const val = parseFloat(match[0]);
            return isNaN(val) ? 0 : val;
        }
    }
    return 0;
};

// Helper: robust JSON parsing
const cleanAndParseJSON = (text: string): any => {
    // 1. Aggressive Clean: Remove Markdown code blocks first
    let cleanedText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    // 2. Locate the JSON object (Find first { and last })
    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
        cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
    } else {
        // Fallback: try to find just the array if object not found
        const firstBracket = cleanedText.indexOf('[');
        const lastBracket = cleanedText.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1) {
            cleanedText = cleanedText.substring(firstBracket, lastBracket + 1);
        } else {
             throw new Error("No JSON structure found in response");
        }
    }

    try {
        return JSON.parse(cleanedText);
    } catch (e) {
        console.warn("Initial JSON Parse Failed. Attempting repairs...", e);
        try {
            const noTrailingCommas = cleanedText.replace(/,(\s*[}\]])/g, '$1');
            return JSON.parse(noTrailingCommas);
        } catch (e2) {
            try {
                const fixedNewlines = cleanedText.replace(/(: ")([\s\S]*?)(?=")/g, (match, prefix, content) => {
                    return prefix + content.replace(/\n/g, "\\n");
                });
                return JSON.parse(fixedNewlines);
            } catch (e3) {
                 try {
                    const sanitized = cleanedText.replace(/[\n\r\t]/g, " ");
                    return JSON.parse(sanitized);
                } catch (e4) {
                     console.error("Critical JSON Parse Error. Raw Text:", text);
                     throw new Error("Invalid JSON structure returned by AI");
                }
            }
        }
    }
};

export const lookupStockSymbol = async (query: string): Promise<StockSymbol> => {
  const ai = initAI();
  if (!ai) throw new Error("API Key not configured");

  const runHeuristicFallback = (fallbackQuery: string): StockSymbol => {
      console.warn("Using heuristic fallback for:", fallbackQuery);
      let cleanQuery = fallbackQuery.trim().toUpperCase();
      
      // Strict regex for A-Shares (6 digits)
      if (/^\d{6}$/.test(cleanQuery)) {
          if (cleanQuery.startsWith('6')) cleanQuery = `SSE:${cleanQuery}`; // Shanghai
          else if (cleanQuery.startsWith('0') || cleanQuery.startsWith('3')) cleanQuery = `SZSE:${cleanQuery}`; // Shenzhen
      }
      else if (cleanQuery === 'BTC') cleanQuery = 'BINANCE:BTCUSDT';
      else if (cleanQuery === 'ETH') cleanQuery = 'BINANCE:ETHUSDT';
      else if (cleanQuery === 'SOL') cleanQuery = 'BINANCE:SOLUSDT';
      else if (cleanQuery === 'XAUUSD' || cleanQuery === 'GOLD') cleanQuery = 'OANDA:XAUUSD';
      else if (cleanQuery === 'XAGUSD' || cleanQuery === 'SILVER') cleanQuery = 'OANDA:XAGUSD';
      else if (cleanQuery === 'USOIL') cleanQuery = 'TVC:USOIL';
      else if (cleanQuery === 'UKOIL') cleanQuery = 'TVC:UKOIL';
      else if (!cleanQuery.includes(':') && /^[A-Z]{1,5}$/.test(cleanQuery)) {
          cleanQuery = `NASDAQ:${cleanQuery}`; // Default to NASDAQ for simple tickers
      }
      
      return { symbol: cleanQuery, name: cleanQuery, currentPrice: 0 };
  };

  try {
      const prompt = `
        Role: Gemini 3 Pro (Financial Data Specialist).
        Task: Identify the correct trading symbol and name for: "${query}".
        
        **CRITICAL RULES FOR MARKET DETECTION**:
        1. **China A-Shares (大A)**:
           - Input is usually 6 digits (e.g., 600519, 300750) or Chinese name.
           - Output format: "SSE:xxxxxx" (Shanghai) or "SZSE:xxxxxx" (Shenzhen).
           - BE EXACT.
        2. **US Stocks (美股)**:
           - Input is 1-5 letters (e.g., AAPL, NVDA).
           - Output format: "NASDAQ:TICKER" or "NYSE:TICKER".
        3. **Crypto**: "BINANCE:BTCUSDT".
        4. **Commodities/Forex**:
           - Gold: "OANDA:XAUUSD"
           - Silver: "OANDA:XAGUSD"
           - Oil: "TVC:USOIL"
           - General Forex: "OANDA:EURUSD", etc.
           - DO NOT use generic "FOREX:" prefix. Use "OANDA:" or "FX:".
        
        **OUTPUT REQUIREMENT**:
        - Name: **MUST BE IN CHINESE** if the company is Chinese or has a well-known Chinese name (e.g., "英伟达 (NVIDIA)", "贵州茅台", "腾讯控股").
        - Current Price: Real-time price if possible via search tool.

        Output strictly JSON: { "symbol": "EXCHANGE:TICKER", "name": "Name (Chinese Preferred)", "currentPrice": number }
      `;

      const result = await ai.models.generateContent({
          model: 'gemini-2.5-flash', 
          contents: prompt,
          config: {
            temperature: 0.0, 
            tools: [{ googleSearch: {} }],
            safetySettings: [
              { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ],
          }
      });

      if (!result.text) throw new Error("Empty response");
      
      const data = cleanAndParseJSON(result.text);
      
      if (!data.symbol || data.symbol === "null" || data.symbol === "NOT_FOUND") {
          throw new Error("AI could not identify symbol");
      }

      // Post-processing cleanup
      if (!data.symbol.includes(':')) {
        let cleanSymbol = data.symbol.replace(/\.SS$/, '').replace(/\.SH$/, '').replace(/\.SZ$/, '');

        if (cleanSymbol.match(/^[0-9]{6}$/)) {
            if (cleanSymbol.startsWith('6')) data.symbol = `SSE:${cleanSymbol}`;
            else data.symbol = `SZSE:${cleanSymbol}`;
        } else if (data.symbol.match(/^[A-Z]{1,5}$/)) {
             data.symbol = `NASDAQ:${data.symbol}`; 
        }
      }

      // Fix generic FOREX to OANDA for better Chart compatibility
      if (data.symbol.startsWith('FOREX:')) {
          data.symbol = data.symbol.replace('FOREX:', 'OANDA:');
      }

      return { 
          symbol: data.symbol, 
          name: data.name || 'Unknown', 
          currentPrice: parsePrice(data.currentPrice)
      };

  } catch (error: any) {
      console.error("Symbol Lookup Failed (Switching to Fallback):", error);
      return runHeuristicFallback(query);
  }
};

const getPredictionHorizon = (tf: Timeframe): string => {
  switch (tf) {
    case Timeframe.M1:
    case Timeframe.M3:
    case Timeframe.M5: return "超短线 (Scalping)";
    case Timeframe.M15:
    case Timeframe.M30: return "日内交易 (Intraday)";
    case Timeframe.H1:
    case Timeframe.H2:
    case Timeframe.H4: return "波段交易 (Swing)";
    case Timeframe.D1: return "中长线 (Position)";
    default: return "Intraday";
  }
};

const getTimeframeInstructions = (tf: Timeframe): string => {
    switch (tf) {
        case Timeframe.M1:
        case Timeframe.M3:
            return `
                **TIMEFRAME STRATEGY: MICRO-SCALPING (超短线/高频)**
                - **Focus**: Pure Order Flow, Tape Reading, Level 2 Liquidity Sweeps.
                - **Noise**: Extremely high. IGNORE standard RSI overbought/sold. Focus on DIVERGENCE.
                - **Setup**: "Stop Hunt" (sweeping highs/lows) is the primary entry signal.
                - **Validation**: Must see immediate reaction. If price stalls, GET OUT.
            `;
        case Timeframe.M5:
             return `
                **TIMEFRAME STRATEGY: SCALP ENTRY (短线狙击)**
                - **Focus**: 5-Minute Fair Value Gaps (FVG) and Order Blocks.
                - **Role**: The bridge between noise (1m) and structure (15m). Best for entry triggers.
                - **Pattern**: Look for "Turtle Soup" (failed breakout) patterns here.
            `;
        case Timeframe.M15:
        case Timeframe.M30:
            return `
                **TIMEFRAME STRATEGY: INTRADAY STRUCTURE (日内结构)**
                - **Focus**: Opening Range (ORB), Session High/Low, VWAP Reversion.
                - **Confluence**: Must align with H1/H4 directional bias.
                - **Key Levels**: Previous Day High (PDH), Previous Day Low (PDL).
                - **Trap Detection**: Look for "False Breakouts" at key hourly levels.
            `;
        case Timeframe.H1:
        case Timeframe.H2:
            return `
                **TIMEFRAME STRATEGY: SWING SETUP (日内波段)**
                - **Focus**: Market Structure Shift (MSS) with candle CLOSE.
                - **Role**: Defines the "Session Trend". Do not trade against the H1/H2 trend during intraday.
                - **Liquidity**: Target the liquidity pools resting above/below old 1H highs/lows.
            `;
        case Timeframe.H4:
            return `
                **TIMEFRAME STRATEGY: MAJOR STRUCTURE (结构性趋势)**
                - **Focus**: The "King" of Swing Trading. Dominant Trend Setter.
                - **Quality**: Signals here override all lower timeframes.
                - **Supply/Demand**: Trade from "Fresh" H4 zones only. High probability.
                - **Macro**: Correlation with DXY/BTC/Sector Index is mandatory.
            `;
        case Timeframe.D1:
            return `
                **TIMEFRAME STRATEGY: POSITION/MACRO (趋势/宏观)**
                - **Focus**: Fundamental Valuation + Technical Trend.
                - **Cycle**: Wyckoff Accumulation/Distribution phases.
            `;
        default:
            return `**TIMEFRAME STRATEGY: GENERAL TREND**`;
    }
};

export const analyzeMarketData = async (symbol: string, timeframe: Timeframe, currentPrice: number, imageBase64?: string, isLockedPrice: boolean = false): Promise<RealTimeAnalysis> => {
    const ai = initAI();
    if (!ai) throw new Error("API Key not configured");

    const horizon = getPredictionHorizon(timeframe);
    const timeframeInst = getTimeframeInstructions(timeframe);
    
    // --- 1. MARKET SEGMENTATION LOGIC ---
    // Strict A-Share detection: SSE/SZSE prefix OR 6-digit code
    const isAShare = symbol.startsWith('SSE') || symbol.startsWith('SZSE') || /^[0-9]{6}$/.test(symbol.split(':')[1] || '');
    const isCrypto = symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('USDT') || symbol.includes('SOL') || symbol.includes('BINANCE');
    const isForex = symbol.startsWith('FX') || symbol.startsWith('OANDA') || symbol.startsWith('TVC');
    const isUSStock = !isAShare && !isCrypto && !isForex;

    let marketContext = 'GLOBAL_FX';
    if (isAShare) marketContext = 'CN_ASHARE';
    else if (isUSStock) marketContext = 'US_EQUITY';
    else if (isCrypto) marketContext = 'CRYPTO';

    // DYNAMIC TIMEFRAME CONTEXT
    const tfContext = timeframe === Timeframe.D1 ? "日线" : `${timeframe}级别`; 
    
    // --- 2. PROTOCOL INJECTION (Game Rules) ---
    let marketSpecificProtocol = "";
    
    if (isAShare) {
        marketSpecificProtocol = `
            **MODE: CHINA A-SHARES (大A模式 - CN_ASHARE)**
            
            **EXECUTION RULES (执行铁律)**:
            1. **ENTRY (入场)**: 
               - IF Price > +9.5% (Near Limit Up): Entry Strategy MUST be "排板 (Limit Order at Cap)" or "WAIT".
               - IF Trend is weak: Entry MUST use "低吸 (Buy the Dip)" at key support, NO chasing breakouts (T+1 Risk).
            2. **STOP LOSS (止损)**:
               - **CRITICAL**: SL CANNOT be set below the -10% Limit Down price (Liquidity Lock Risk).
               - SL must be tight to avoid getting locked overnight.
            3. **DATA DRIVERS (核心驱动)**:
               - **Northbound Funds (北向资金)**: The primary "Smart Money" indicator.
               - **Main Force (主力资金)**: Domestic institutional large orders.
               - **Concept Hype (题材)**: Focus on "Fengkou" (Wind Tunnel/Hot Concepts) and Policy (5-Year Plan).
            4. **ANALYSIS PRIORITY**:
               - Check if price is near Limit Up (涨停). If yes, analyze "Seal Strength" (封单强度).
               - Focus on "Dragon Return" (龙头首阴/反包) patterns.
        `;
    } else if (isCrypto) {
         marketSpecificProtocol = `
            **MODE: CRYPTO ASSETS (加密货币)**
            1. **MECHANICS**: 24/7 Trading, High Leverage, Liquidation Cascades.
            2. **DATA**: Liquidation Heatmaps, Funding Rates, Stablecoin Inflows.
            3. **DERIVATIVES**: Check Deribit Options (Max Pain) and Open Interest (OI).
            4. **CORRELATION**: High correlation with NASDAQ and Inverse DXY.
        `;
    } else {
        marketSpecificProtocol = `
            **MODE: US EQUITIES (美股模式 - US_EQUITY)**
            
            **EXECUTION RULES (执行铁律)**:
            1. **ENTRY (入场)**:
               - Check "Pre-Market" & "After-Hours" volume.
               - Beware of "Opening Range Fakeout" (9:30-10:00 AM ET).
            2. **STOP LOSS (止损)**:
               - Must consider "Gamma Squeeze" volatility. Widen SL if IV (Implied Volatility) is high.
            3. **KEY LEVELS**:
               - **MANDATORY**: Check "Max Pain" price. Price often gravitates there on Fridays.
               - **Gamma Exposure**: Identify the "Zero Gamma" level (Volatility Trigger).
            4. **DATA DRIVERS**:
               - **Options Gamma**: CRITICAL. Check "Max Pain" and "Gamma Exposure" (GEX).
               - **Institutional Flow**: Dark Pool prints, 13F filings, Buybacks.
        `;
    }

    const systemPrompt = `
      You are **TradeGuard Pro (Zenith Core)**, an elite multi-strategy hedge fund AI analyst.
      
      **YOUR MISSION**: Perform a deep-dive, multi-dimensional analysis of ${symbol} on the **${timeframe}** timeframe.
      
      ${timeframeInst}
      
      **CORE ARCHITECTURE: THE EXECUTION FUNNEL (v4.0)**
      You must follow a strict "Funnel Logic". You cannot generate the "Execution Map" until all other modules pass their checks.
      
      **STEP 1: FRACTAL REALITY CHECK (The Trend)**
      - **Rule**: If you are analyzing M5, you MUST verify the H1 trend. If M5 is Bullish but H1 is Bearish, this is a "Counter-Trend Scalp" (High Risk).
      - **Action**: Define the "Trend Resonance" (HTF vs LTF).
      
      **STEP 2: TRINITY CONSENSUS (Direction Filter)**
      - **Technicals**: RSI, MACD, KDJ, Bollinger Bands.
      - **Flow**: Volume Profile, Institutional Inflow/Outflow.
      - **Sentiment**: Social buzz, Fear/Greed index.
      - **CONSTRAINT**: If Technicals say BUY but Institutional Flow says SELL, the Signal MUST be "NEUTRAL". Do not force a trade.
      
      **STEP 3: RED TEAMING (Risk Filter - The "Critic")**
      - Act as a Permabear/Permabull Critic. Ask: "Where does this trade fail?" (The Invalidation Point).
      - **CONSTRAINT**: Your **Stop Loss** MUST be placed slightly beyond this Invalidation Point (Market Structure Low/High).
      
      **STEP 4: SCENARIO MAPPING (Target Filter)**
      - **TP1 (Conservative)**: Must align with the "Neutral Scenario" resistance or nearest Liquidity Pool.
      - **TP2 (Standard)**: Must align with the "Bullish Scenario" structural high or Fibonacci 1.618.
      
      **STEP 5: FINAL EXECUTION MAP (The Output)**
      - Only populate "entryPrice", "stopLoss", and "takeProfit" based on the logic above.
      - **Entry Strategy**: Must specify "Breakout", "Retest", "Limit Order", or "Market (Aggressive)".
      - **IMPORTANT**: If SIGNAL is 'SELL', TakeProfit MUST be < Entry. If SIGNAL is 'BUY', TakeProfit MUST be > Entry.
      
      **PHASE 1: HARD DATA MINING (The "Truth" Layer)**
      You MUST use Google Search to find ACTUAL values.
      - **A-Shares**: Search "北向资金 ${symbol}", "主力资金流向 ${symbol}", "涨停分析 ${symbol}".
      - **US Stocks**: Search "Gamma Exposure ${symbol}", "Max Pain ${symbol}", "Dark Pool ${symbol}".
      - **General**: RSI, Market Cap, PE Ratio, Recent News.
      
      **PHASE 2: STRATEGY SYNTHESIS**
      - IF A-Share AND Price near +10%: Logic is "Da Ban" (打板). Verify Seal Strength.
      - IF US Stock AND Price > Max Pain: Logic is "Gamma Pinning" or "Mean Reversion".
      
      **OUTPUT FORMAT**: RAW JSON ONLY. NO MARKDOWN.
      **LANGUAGE REQUIREMENT**: 
      1. **DESCRIPTIONS/REASONING**: MUST BE **SIMPLIFIED CHINESE (简体中文)**.
      2. **ENUMS/LOGIC KEYS**: Keep logic identifiers (e.g. 'BUY', 'SELL', 'High') in ENGLISH for system parsing, OR use "English (Chinese)" format.
      3. **SPECIFIC FIELDS**:
         - \`smartMoneyAnalysis.retailSentiment\`: MUST be strictly "Greed", "Fear", or "Neutral".
         - \`wyckoff.phase\`: Return full string like "Accumulation (吸筹)".
      
      ${marketSpecificProtocol}
      
      Output JSON Schema (Strict):
      {
        "signal": "BUY" | "SELL" | "NEUTRAL",
        "marketContext": "${marketContext}",
        "realTimePrice": number,
        "scoreDrivers": { "technical": number, "institutional": number, "sentiment": number, "macro": number },
        "hardData": {
            "realTimeRsi": number,
            "rsiStatus": "string (中文)",
            "peRatio": number,
            "pbRatio": number,
            "marketCap": "string",
            "fiftyTwoWeekRange": "string",
            "volume24h": "string",
            "dataSource": "string"
        },
        "socialAnalysis": {
            "retailScore": number,
            "institutionalScore": number,
            "socialVolume": "string",
            "trendingKeywords": ["string"],
            "sentimentVerdict": "string (中文)",
            "sources": ["string"]
        },
        "marketTribunal": {
            "bullCase": { "arguments": [{ "point": "string (中文)", "weight": "string" }], "verdict": "string (中文)" },
            "bearCase": { "arguments": [{ "point": "string (中文)", "weight": "string" }], "verdict": "string (中文)" },
            "chiefJustice": { "winner": "BULLS" | "BEARS" | "HUNG_JURY", "reasoning": "string (中文)", "confidenceAdjustment": number }
        },
        "volatilityAnalysis": { "vixValue": number, "atrState": "string (中文)", "regime": "string (中文)", "adaptiveStrategy": "string (中文)", "description": "string (中文)" },
        "optionsData": { "maxPainPrice": number, "gammaExposure": "string", "putCallRatio": number, "impliedVolatilityRank": "string", "squeezeRisk": "string" },
        "sentimentDivergence": { "retailMood": "string (e.g. Greed)", "institutionalAction": "string (e.g. Accumulation)", "divergenceStatus": "string (中文)", "socialVolume": "string" },
        "volumeProfile": { "hvnLevels": [number], "lvnZones": ["string"], "verdict": "string (中文)" },
        "wyckoff": { "phase": "string (e.g. Accumulation (吸筹))", "event": "string", "analysis": "string (中文)" },
        "smc": { "liquidityStatus": "string (中文)", "structure": "string", "fairValueGapStatus": "string (中文)" },
        "correlationMatrix": { "correlatedAsset": "string", "correlationType": "string", "correlationStrength": "string", "assetTrend": "string", "impact": "string (中文)" },
        "trendResonance": { "trendHTF": "string", "trendLTF": "string", "resonance": "string (中文)" },
        "catalystRadar": { "nextEvent": "string (中文)", "eventImpact": "string", "timingWarning": "string (中文)" },
        "trinityConsensus": { "quantScore": number, "smartMoneyScore": number, "chartPatternScore": number, "consensusVerdict": "string (中文)" },
        "visualAnalysis": "string (中文)",
        "dataMining": { "sourcesCount": number, "confidenceLevel": "string", "keyDataPoints": ["string (中文)"], "contradictions": ["string (中文)"] },
        "winRate": number, 
        "historicalWinRate": number, 
        "entryPrice": number, "entryStrategy": "string (中文)", "takeProfit": number, "stopLoss": number, "supportLevel": number, "resistanceLevel": number, "riskRewardRatio": number, "reasoning": "string (中文)", "volatilityAssessment": "string (中文)", "marketStructure": "string (中文)",
        "technicalIndicators": { "rsi": number, "macdStatus": "string (中文)", "volumeStatus": "string (中文)" },
        "institutionalData": { "netInflow": "string", "blockTrades": "string", "mainForceSentiment": "string (中文)" },
        "smartMoneyAnalysis": { "retailSentiment": "Fear | Greed | Neutral", "smartMoneyAction": "string (中文)", "orderBlockStatus": "string (中文)" },
        "scenarios": {
            "bullish": { "probability": number, "targetPrice": number, "description": "string (中文)" },
            "bearish": { "probability": number, "targetPrice": number, "description": "string (中文)" },
            "neutral": { "probability": number, "targetPrice": number, "description": "string (中文)" }
        },
        "tradingSetup": { "strategyIdentity": "string (中文)", "confirmationTriggers": ["string (中文)"], "invalidationPoint": "string (中文)" },
        "redTeaming": { "risks": ["string (中文)"], "mitigations": ["string (中文)"], "severity": "string", "stressTest": "string (中文)" },
        "modelFusionConfidence": number, 
        "futurePrediction": { "targetHigh": number, "targetLow": number, "confidence": number }
      }
    `;

    const userPromptText = `
      Analyze ${symbol} on ${timeframe} (${tfContext}). Reference Price: ${currentPrice}.
      
      **MANDATORY CHECKS**:
      1. **Market Type**: Confirm if this is A-Share (T+1) or US (T+0).
      2. **Limit Status** (A-Share Only): Is it near Limit Up/Down?
      3. **Northbound/Dark Pool**: Report the correct institutional flow based on market type.
      
      Synthesize all data into the JSON schema, ensuring EXECUTION MAP follows the FUNNEL LOGIC.
    `;

    // Use gemini-3-pro-preview for both text and multimodal analysis as it supports reasoning + vision + tools.
    // gemini-3-pro-image-preview is typically for Generation, though sometimes used for Vision, 3-pro-preview is safer for complex analysis.
    const requestContents: any = {
      model: 'gemini-3-pro-preview', 
      config: {
          systemInstruction: systemPrompt,
          tools: [{ googleSearch: {} }],
          temperature: 0.1, 
          topK: 1
      }
    };

    const parts: any[] = [{ text: userPromptText }];
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/png",
          data: imageBase64
        }
      });
    }

    requestContents.contents = { parts: parts };

    try {
        const result = await ai.models.generateContent(requestContents);

        if (!result.text) throw new Error("No analysis generated");

        const data = cleanAndParseJSON(result.text);

        // --- SANITIZER & LOGIC GATES ---
        
        // 1. Defaults
        const baseScore = data.winRate || 50;
        if (!data.scoreDrivers) data.scoreDrivers = { technical: baseScore, institutional: baseScore, sentiment: baseScore, macro: baseScore };
        
        // 2. Number Parsing
        ['realTimePrice', 'entryPrice', 'takeProfit', 'stopLoss', 'supportLevel', 'resistanceLevel'].forEach(key => {
            data[key] = parsePrice(data[key]);
        });
        
        // 3. Scenario Logic Correction
        if (data.scenarios) {
            const { bullish, bearish, neutral } = data.scenarios;
            const currentP = data.realTimePrice || currentPrice;
            
            bullish.targetPrice = parsePrice(bullish.targetPrice);
            bearish.targetPrice = parsePrice(bearish.targetPrice);
            neutral.targetPrice = parsePrice(neutral.targetPrice);
            
            if (bullish.targetPrice <= currentP) bullish.targetPrice = currentP * 1.025; 
            if (bearish.targetPrice >= currentP) bearish.targetPrice = currentP * 0.975; 
            
            // Normalize Probabilities
            const total = (bullish.probability || 0) + (bearish.probability || 0) + (neutral.probability || 0);
            if (total > 0 && total !== 100) {
                 bullish.probability = Math.round((bullish.probability / total) * 100);
                 bearish.probability = Math.round((bearish.probability / total) * 100);
                 neutral.probability = 100 - bullish.probability - bearish.probability;
            }
        }

        // 4. Trinity Consensus Logic
        if (data.trinityConsensus) {
            const { quantScore, smartMoneyScore, chartPatternScore } = data.trinityConsensus;
            let calculatedWinRate = Math.round((quantScore * 0.35) + (smartMoneyScore * 0.35) + (chartPatternScore * 0.3));
            
            // Penalties
            if (Math.abs(quantScore - smartMoneyScore) > 30) {
                 calculatedWinRate -= 10;
                 data.trinityConsensus.consensusVerdict = 'DIVERGENCE (背离)';
            }
            if (data.correlationMatrix?.impact === 'Headwind (阻力)') calculatedWinRate -= 15;
            if (data.trendResonance?.resonance === 'Conflict (逆势/回调)') if (calculatedWinRate > 70) calculatedWinRate = 70;

            // Strict Tribunal Check
            if (data.marketTribunal?.chiefJustice) {
                const { winner, confidenceAdjustment } = data.marketTribunal.chiefJustice;
                const adj = typeof confidenceAdjustment === 'number' ? confidenceAdjustment : 0;
                calculatedWinRate += adj;
                if (winner === 'BEARS' && calculatedWinRate > 55) calculatedWinRate = Math.max(45, calculatedWinRate - 20);
                if (winner === 'BULLS' && calculatedWinRate < 45) calculatedWinRate = Math.min(55, calculatedWinRate + 20);
            }

            data.winRate = Math.max(0, Math.min(100, calculatedWinRate));
        }

        // 5. Signal Sync
        if (data.winRate >= 60) data.signal = SignalType.BUY;
        else if (data.winRate <= 40) data.signal = SignalType.SELL;
        else data.signal = SignalType.NEUTRAL;


        // 6. LOGIC INTEGRITY CHECK (Fixing the user's issue about conflicting signals)
        // Ensure Entry/TP/SL aligns with the Signal Direction
        const currentP = data.realTimePrice || currentPrice;
        
        // If Entry is 0 or invalid, fix it
        if (!data.entryPrice || data.entryPrice === 0) data.entryPrice = currentP;

        if (data.signal === SignalType.BUY) {
            // BUY Logic: TP > Entry > SL
            if (data.takeProfit <= data.entryPrice) {
                 data.takeProfit = Number((data.entryPrice * 1.06).toFixed(2)); // Force 6% upside
            }
            if (data.stopLoss >= data.entryPrice) {
                 data.stopLoss = Number((data.entryPrice * 0.96).toFixed(2)); // Force 4% downside
            }
        } else if (data.signal === SignalType.SELL) {
            // SELL Logic: SL > Entry > TP
            if (data.takeProfit >= data.entryPrice) {
                 data.takeProfit = Number((data.entryPrice * 0.94).toFixed(2)); // Force 6% downside
            }
            if (data.stopLoss <= data.entryPrice) {
                 data.stopLoss = Number((data.entryPrice * 1.04).toFixed(2)); // Force 4% upside
            }
        }

        // === EXECUTION MAP GUARDRAILS (执行逻辑熔断) ===

        // 1. Risk/Reward Sanity Check
        const entry = data.entryPrice;
        const potentialProfit = Math.abs(data.takeProfit - entry);
        const potentialLoss = Math.abs(entry - data.stopLoss);

        if (potentialLoss > 0 && potentialProfit < potentialLoss * 0.9) {
            console.warn("AI Logic Risk: RR Ratio < 1. Forcing Neutral.");
            data.signal = SignalType.NEUTRAL;
            if (data.winRate > 50) data.winRate = 50;
            data.reasoning += "\n[系统风控拦截] 预期盈亏比小于 1:1 (Risk/Reward < 1)，系统强制转为观望。";
        }

        // 2. A-Share Limit Protection
        if (isAShare) {
            const limitUp = currentPrice * 1.1;
            const limitDown = currentPrice * 0.9;
            
            // If entry is higher than limit up, cap it
            if (data.entryPrice > limitUp) data.entryPrice = Number(limitUp.toFixed(2));
            
            // Stop loss below limit down is dangerous
            if (data.stopLoss < limitDown) {
                data.stopLoss = Number((limitDown * 1.01).toFixed(2));
                data.reasoning += "\n[A股风控] 止损已调整至跌停板上方以确保流动性 (Liquidity Protection)。";
            }
        }

        // 3. Final Divergence Check
        if (data.trinityConsensus?.consensusVerdict === 'DIVERGENCE (背离)') {
            if (data.winRate > 60) data.winRate = 55; // Cap win rate
            if (data.signal === SignalType.BUY) data.signal = SignalType.NEUTRAL; // Kill strong buy signals on divergence
        }

        return data as RealTimeAnalysis;

    } catch (e) {
        console.error("Analysis Error:", e);
        throw new Error("Failed to generate market analysis. Please try again.");
    }
};

export const performBacktest = async (symbol: string, strategy: BacktestStrategy, period: BacktestPeriod): Promise<BacktestResult> => {
     const ai = initAI();
    if (!ai) throw new Error("API Key not configured");

    const prompt = `
        Perform a simulated historical backtest for ${symbol} using the PROFESSIONAL STRATEGY: "${strategy}".
        Time Period: ${period}.
        
        Instructions:
        1. Search for historical price action.
        2. Simulate trades based on strict strategy rules.
        3. OUTPUT LANGUAGE: SIMPLIFIED CHINESE (简体中文).
        
        Return JSON ONLY:
        {
          "strategyName": "${strategy}",
          "period": "${period}",
          "totalTrades": number,
          "winRate": number, 
          "profitFactor": number,
          "netProfit": "string",
          "bestTrade": "string",
          "worstTrade": "string",
          "equityCurveDescription": "string (Chinese)",
          "insights": "string (Chinese)"
        }
    `;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-pro-preview', 
            contents: prompt,
            config: {
                temperature: 0.0, 
                tools: [{ googleSearch: {} }]
            }
        });

        if (!result.text) throw new Error("Backtest failed");
        return cleanAndParseJSON(result.text) as BacktestResult;
    } catch (e) {
        console.error("Backtest Error:", e);
        throw new Error("Backtest simulation failed.");
    }
};
