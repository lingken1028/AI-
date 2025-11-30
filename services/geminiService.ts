

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
      
      if (cleanQuery === 'BTC') cleanQuery = 'BINANCE:BTCUSDT';
      else if (cleanQuery === 'ETH') cleanQuery = 'BINANCE:ETHUSDT';
      else if (cleanQuery === 'SOL') cleanQuery = 'BINANCE:SOLUSDT';
      else if (cleanQuery === 'XAUUSD') cleanQuery = 'OANDA:XAUUSD';
      else if (/^[0-9]{6}$/.test(cleanQuery)) {
          if (cleanQuery.startsWith('6')) cleanQuery = `SSE:${cleanQuery}`; 
          else cleanQuery = `SZSE:${cleanQuery}`; 
      }
      else if (!cleanQuery.includes(':') && /^[A-Z]+$/.test(cleanQuery)) {
          cleanQuery = `NASDAQ:${cleanQuery}`;
      }
      
      return { symbol: cleanQuery, name: cleanQuery, currentPrice: 0 };
  };

  try {
      const prompt = `
        Role: Gemini 2.5 Flash (Fast Financial Data Assistant).
        Task: Identify the correct stock symbol and company name for the user query: "${query}".
        
        Instructions:
        1. Analyze the query to extract the intended financial asset.
        2. Use Google Search to find the official trading ticker.
        3. Return the symbol in standard TradingView format (EXCHANGE:TICKER).
           Mapping Rules:
           - 6 digits starting '6' -> "SSE:xxxxxx" (Shanghai).
           - 6 digits starting '0'/'3' -> "SZSE:xxxxxx" (Shenzhen).
           - HK stocks -> "HKEX:xxxx".
           - Bitcoin/Crypto -> "BINANCE:BTCUSDT" format.
           - Gold/Forex -> "OANDA:XAUUSD" or "FX:EURUSD".
        4. Return full name (in Chinese if possible) and price.
        
        Output strictly JSON: { "symbol": "EXCHANGE:TICKER", "name": "Name", "currentPrice": number }
      `;

      const result = await ai.models.generateContent({
          model: 'gemini-2.5-flash', 
          contents: prompt,
          config: {
            temperature: 0.1, 
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
      
      if (!data.symbol.includes(':')) {
        let cleanSymbol = data.symbol.replace(/\.SS$/, '').replace(/\.SH$/, '').replace(/\.SZ$/, '');

        if (cleanSymbol.match(/^[0-9]{6}$/)) {
            if (cleanSymbol.startsWith('6')) data.symbol = `SSE:${cleanSymbol}`;
            else data.symbol = `SZSE:${cleanSymbol}`;
        } else if (data.symbol.match(/^[A-Z]{3,5}$/)) {
             data.symbol = `NASDAQ:${data.symbol}`; 
        } else if (data.symbol.includes('XAU')) {
             data.symbol = `FX:${data.symbol}`;
        }
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

// Helper: Determine Fractal Timeframes
const getFractalTimeframes = (tf: Timeframe): { htf: string, ltf: string } => {
    switch(tf) {
        case Timeframe.M1: return { htf: 'M5', ltf: 'Tick Trend' };
        case Timeframe.M3: return { htf: 'M15', ltf: 'M1' };
        case Timeframe.M5: return { htf: 'M15', ltf: 'M1' };
        case Timeframe.M15: return { htf: 'H1', ltf: 'M5' };
        case Timeframe.M30: return { htf: 'H1', ltf: 'M5' };
        case Timeframe.H1: return { htf: 'H4', ltf: 'M15' };
        case Timeframe.H2: return { htf: 'D1', ltf: 'M30' };
        case Timeframe.H4: return { htf: 'D1', ltf: 'H1' };
        case Timeframe.D1: return { htf: 'Weekly', ltf: 'H4' };
        default: return { htf: 'Higher Timeframe', ltf: 'Lower Timeframe' };
    }
}

const getCorrelatedAssetHint = (symbol: string): string => {
    if (symbol.includes('BTC') || symbol.includes('ETH')) return "Check DXY (Dollar Index) and NASDAQ correlation.";
    if (symbol.includes('XAU') || symbol.includes('GOLD')) return "Check Real Yields and DXY.";
    if (symbol.includes('NVDA') || symbol.includes('AMD')) return "Check SOXX (Semiconductor ETF) trend.";
    if (symbol.startsWith('SSE') || symbol.startsWith('SZSE')) return "Check USD/CNY rate and FTSE China A50.";
    return "Check major sector ETF or Index performance.";
}

export const analyzeMarketData = async (symbol: string, timeframe: Timeframe, currentPrice: number, imageBase64?: string, isLockedPrice: boolean = false): Promise<RealTimeAnalysis> => {
    const ai = initAI();
    if (!ai) throw new Error("API Key not configured");

    const horizon = getPredictionHorizon(timeframe);
    const fractal = getFractalTimeframes(timeframe);
    
    // --- 1. MARKET SEGMENTATION LOGIC ---
    const isAShare = symbol.startsWith('SSE') || symbol.startsWith('SZSE') || /^[0-9]{6}$/.test(symbol.split(':')[1] || '');
    const isCrypto = symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('USDT') || symbol.includes('SOL') || symbol.includes('BINANCE');
    const isForex = symbol.startsWith('FX') || symbol.startsWith('OANDA');
    const isUSStock = !isAShare && !isCrypto && !isForex;

    let marketContext = 'GLOBAL_FX';
    if (isAShare) marketContext = 'CN_ASHARE';
    else if (isUSStock) marketContext = 'US_EQUITY';
    else if (isCrypto) marketContext = 'CRYPTO';

    // DYNAMIC TIMEFRAME CONTEXT
    const tfContext = timeframe === Timeframe.D1 ? "日线" : `${timeframe}级别`; 
    
    // --- 2. SEARCH & PROMPT CONSTRUCTION ---
    let marketSpecificProtocol = "";
    const correlationHint = getCorrelatedAssetHint(symbol);

    if (isAShare) {
        marketSpecificProtocol = `
            **MARKET PROTOCOL: CHINA A-SHARES (CN_ASHARE)**
            1. POLICY: Prioritize Five-Year Plans/PBOC liquidity.
            2. FUNDS: "Northbound Money" (北向) and "Main Force" (主力).
            3. RULES: T+1, 10%/20% Limits. No Options/Max Pain analysis for A-Shares usually.
            4. TERMS: Use "Dragon Return" (龙头反包), "Limit Up" (涨停).
            5. CORRELATION: Check FTSE China A50 and USD/CNH.
        `;
    } else if (isCrypto) {
         marketSpecificProtocol = `
            **MARKET PROTOCOL: CRYPTO ASSETS**
            1. DATA: Liquidation Heatmaps, Funding Rates, Open Interest, Stablecoin Inflows.
            2. DERIVATIVES: Check Deribit Options for Max Pain (BTC/ETH).
            3. TERMS: Use "Short Squeeze" (轧空), "Long Squeeze" (多杀多).
            4. CORRELATION: High correlation with NASDAQ/S&P500 and Inverse DXY.
        `;
    } else {
        marketSpecificProtocol = `
            **MARKET PROTOCOL: US EQUITIES/GLOBAL**
            1. DATA: Dark Pools, Options Gamma (GEX), Fed Policy, 10Y Yields.
            2. DERIVATIVES (CRITICAL): Check Option "Max Pain" price and "Gamma Exposure".
            3. TERMS: Use "Gamma Squeeze", "Institutional Accumulation".
            4. CORRELATION: Check Sector ETF (e.g., XLK for Tech, XLF for Finance).
        `;
    }

    const systemPrompt = `
      You are **TradeGuard Pro**, an elite institutional trading AI.
      
      **CORE DIRECTIVE**: THE FUNNEL OF TRUTH.
      Your analysis must follow a strict "Funnel Structure". You must not just list data; you must CONVERGE data into a single point of execution.
      
      **THE FUNNEL ARCHITECTURE**:
      1. **Layer 1: The Context (Wide)** -> Volatility Regime, Macro Correlation, Sentiment.
      2. **Layer 2: The Evidence (Narrowing)** -> Tribunal Debate, Institutional Mechanics, Trinity Consensus.
      3. **Layer 3: The Deduction (Convergence)** -> Scenarios (Bull/Bear/Neutral).
      4. **Layer 4: THE EXECUTION MAP (The Tip)** -> This is the FINAL OUTPUT. All previous layers exist ONLY to serve this map.
         - *Entry* must be justified by Mechanics (Layer 2).
         - *Stop Loss* must be justified by Volatility (Layer 1).
         - *Take Profit* must be justified by Scenarios (Layer 3).
      
      **OUTPUT FORMAT**: RAW JSON ONLY. NO MARKDOWN. NO EXPLANATORY TEXT.
      **LANGUAGE**: SIMPLIFIED CHINESE (简体中文). Translate all terms, including "Strategy Identity".
      
      ${marketSpecificProtocol}
      
      **THINKING MODEL UPGRADE**:
      
      1. **VOLATILITY REGIME (Layer 1)**:
         - IF Choppy: Strategy = Mean Reversion.
         - IF Trending: Strategy = Trend Following.
         - *This dictates the Strategy Identity in the Execution Map.*
      
      2. **ADVERSARIAL TRIBUNAL (Layer 2)**:
         - Use the "Winner" of the debate to bias the Trinity Consensus Score.
      
      3. **TRADING SETUP & EXECUTION MAP (Layer 4 - CRITICAL)**:
         - "strategyIdentity": Must be specific and in Chinese (e.g., "威科夫弹簧反转" or "Gamma挤压突破").
         - "confirmationTriggers": List 3 specific things to watch for (e.g., "Volume spike > 20k", "Close above VWAP").
         - "invalidationPoint": The exact price logic where the thesis fails.
      
      **PRICE HANDLING**:
      ${isLockedPrice 
        ? `>>> USER LOCKED PRICE AT ${currentPrice}. DO NOT UPDATE IT. All levels (TP/SL) must be calculated relative to ${currentPrice}.` 
        : `Use ${currentPrice} as reference. If Google Search shows a newer price, USE THE NEW PRICE and update 'realTimePrice'.`
      }
      
      Output JSON Schema (Maintain strict Chinese strings):
      {
        "signal": "BUY" | "SELL" | "NEUTRAL",
        "marketContext": "${marketContext}",
        "realTimePrice": number,
        "scoreDrivers": {
            "technical": number, "institutional": number, "sentiment": number, "macro": number 
        },
        "marketTribunal": {
            "bullCase": { "arguments": [{ "point": "string", "weight": "High" | "Medium" | "Low" }], "verdict": "string" },
            "bearCase": { "arguments": [{ "point": "string", "weight": "High" | "Medium" | "Low" }], "verdict": "string" },
            "chiefJustice": { "winner": "BULLS" | "BEARS" | "HUNG_JURY", "reasoning": "string", "confidenceAdjustment": number }
        },
        "volatilityAnalysis": {
            "vixValue": number,
            "atrState": "Expanding (扩张)" | "Contracting (收缩)" | "Stable (稳定)",
            "regime": "High Volatility (高波动/趋势)" | "Low Volatility (低波动/震荡)" | "Extreme (极端/崩盘)",
            "adaptiveStrategy": "Trend Following (趋势跟随)" | "Mean Reversion (均值回归/高抛低吸)" | "Breakout (突破)" | "Defensive (防御/观望)",
            "description": "string"
        },
        "optionsData": {
            "maxPainPrice": number,
            "gammaExposure": "Long Gamma (Volatility Suppression)" | "Short Gamma (Volatility Acceleration)" | "Neutral",
            "putCallRatio": number,
            "impliedVolatilityRank": "string",
            "squeezeRisk": "High" | "Moderate" | "Low"
        },
        "sentimentDivergence": {
            "retailMood": "Extreme Greed" | "Greed" | "Neutral" | "Fear" | "Extreme Fear",
            "institutionalAction": "Aggressive Buying" | "Accumulation" | "Neutral" | "Distribution" | "Panic Selling",
            "divergenceStatus": "Bullish Divergence (Retail Fear / Inst Buy)" | "Bearish Divergence (Retail Greed / Inst Sell)" | "Aligned (Trend)",
            "socialVolume": "Exploding" | "High" | "Normal" | "Low"
        },
        "volumeProfile": {
            "hvnLevels": [number],
            "lvnZones": ["string"],
            "verdict": "Overhead Supply (上方套牢盘)" | "Strong Support Base (底部筹码峰)" | "Vacuum Acceleration (真空加速)"
        },
        "wyckoff": {
            "phase": "Accumulation (吸筹)" | "Markup (拉升)" | "Distribution (派发)" | "Markdown (砸盘)",
            "event": "Spring (弹簧/假跌破)" | "Upthrust (上冲回落/假突破)" | "SOS (强势信号)" | "SOW (弱势信号)" | "None",
            "analysis": "string"
        },
        "smc": {
            "liquidityStatus": "Swept Liquidity (掠夺流动性)" | "Building Liquidity (堆积流动性)" | "Neutral",
            "structure": "BOS (结构破坏)" | "CHoCH (角色互换)" | "None",
            "fairValueGapStatus": "string"
        },
        "correlationMatrix": {
            "correlatedAsset": "string", "correlationType": "Positive (正相关)" | "Negative (负相关)", "correlationStrength": "High" | "Moderate" | "Low", "assetTrend": "Bullish" | "Bearish" | "Neutral", "impact": "Tailwind (助推)" | "Headwind (阻力)" | "Neutral"
        },
        "trendResonance": {
            "trendHTF": "Bullish" | "Bearish" | "Neutral", "trendLTF": "Bullish" | "Bearish" | "Neutral", "resonance": "Resonant (顺势)" | "Conflict (逆势/回调)" | "Chaos (震荡)"
        },
        "catalystRadar": { "nextEvent": "string", "eventImpact": "High Volatility" | "Medium" | "Low", "timingWarning": "string" },
        "trinityConsensus": {
            "quantScore": number, "smartMoneyScore": number, "chartPatternScore": number, "consensusVerdict": "STRONG_CONFLUENCE (强共振)" | "MODERATE (一般)" | "DIVERGENCE (背离)"
        },
        "visualAnalysis": "string",
        "dataMining": { "sourcesCount": number, "confidenceLevel": "High" | "Medium" | "Low", "keyDataPoints": ["string"], "contradictions": ["string"] },
        "winRate": number, 
        "historicalWinRate": number, 
        "entryPrice": number, "entryStrategy": "string", "takeProfit": number, "stopLoss": number, "supportLevel": number, "resistanceLevel": number, "riskRewardRatio": number, "reasoning": "string", "volatilityAssessment": "string", "marketStructure": "string",
        "technicalIndicators": { "rsi": number, "macdStatus": "string", "volumeStatus": "string" },
        "institutionalData": { "netInflow": "string", "blockTrades": "string", "mainForceSentiment": "string" },
        "smartMoneyAnalysis": { "retailSentiment": "Fear" | "Greed" | "Neutral", "smartMoneyAction": "string", "orderBlockStatus": "string" },
        "scenarios": {
            "bullish": { "probability": number, "targetPrice": number, "description": "string" },
            "bearish": { "probability": number, "targetPrice": number, "description": "string" },
            "neutral": { "probability": number, "targetPrice": number, "description": "string" }
        },
        "tradingSetup": { "strategyIdentity": "string", "confirmationTriggers": ["string"], "invalidationPoint": "string" },
        "redTeaming": { "risks": ["string"], "mitigations": ["string"], "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", "stressTest": "string" },
        "modelFusionConfidence": number, 
        "futurePrediction": { "targetHigh": number, "targetLow": number, "confidence": number }
      }
    `;

    const userPromptText = `
      Analyze ${symbol} on ${timeframe} (${tfContext}). Reference Price: ${currentPrice}.
      
      **FRACTAL CONTEXT**:
      - Higher Timeframe (Trend): ${fractal.htf}
      - Lower Timeframe (Entry): ${fractal.ltf}
      
      **REQUIRED SEARCH TASKS (DEEP DIVE)**:
      1. **Volatility Regime**: Search for "VIX today", "${symbol} historical volatility", or visually analyze candle ranges.
         *DETERMINE IF CHOPPY OR TRENDING*.
      2. **Options/Gamma**: Search for "${symbol} option max pain this week", "${symbol} gamma exposure GEX", "${symbol} put call ratio".
      3. **Sentiment Divergence**: Search for "${symbol} retail sentiment reddit" AND "${symbol} institutional net flow 13F".
         *Compare them specifically for divergence*.
      
      STRICT INSTRUCTION:
      1. If Volatility is LOW (Choppy), force strategy to "Mean Reversion". DO NOT SUGGEST BREAKOUTS.
      2. If Retail is "Greedy" but Smart Money is "Selling", MARK AS BEARISH DIVERGENCE.
      3. SYNTHESIZE EVERYTHING into the "tradingSetup" (Execution Map).
      4. Return RAW JSON ONLY.
    `;

    const requestContents: any = {
      model: imageBase64 ? 'gemini-3-pro-image-preview' : 'gemini-3-pro-preview', 
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

        // --- THE SANITIZER: Strict Logic & Type Enforcement ---
        
        // 1. Defaults
        const baseScore = data.winRate || 50;
        if (!data.scoreDrivers) data.scoreDrivers = { technical: baseScore, institutional: baseScore, sentiment: baseScore, macro: baseScore };
        
        // 2. Number Parsing
        ['realTimePrice', 'entryPrice', 'takeProfit', 'stopLoss', 'supportLevel', 'resistanceLevel'].forEach(key => {
            data[key] = parsePrice(data[key]);
        });

        // 2.1 Volume Profile Parsing
        if (data.volumeProfile) {
            if (data.volumeProfile.hvnLevels) {
                data.volumeProfile.hvnLevels = data.volumeProfile.hvnLevels.map((v:any) => parsePrice(v));
            } else {
                data.volumeProfile.hvnLevels = [];
            }
        }

        // 2.2 Options Parsing (Safe defaults)
        if (data.optionsData) {
            data.optionsData.maxPainPrice = parsePrice(data.optionsData.maxPainPrice);
            data.optionsData.putCallRatio = parsePrice(data.optionsData.putCallRatio);
        }
        
        // 3. Scenario Logic Correction
        if (data.scenarios) {
            const { bullish, bearish, neutral } = data.scenarios;
            const currentP = data.realTimePrice || currentPrice;
            
            bullish.targetPrice = parsePrice(bullish.targetPrice);
            bearish.targetPrice = parsePrice(bearish.targetPrice);
            neutral.targetPrice = parsePrice(neutral.targetPrice);
            
            // Auto-Fix Inverted Targets
            if (bullish.targetPrice < currentP && bearish.targetPrice > currentP) {
                // Swap them if AI got confused
                const temp = bullish.targetPrice;
                bullish.targetPrice = bearish.targetPrice;
                bearish.targetPrice = temp;
            }
            
            // Hard Constraints
            if (bullish.targetPrice <= currentP) bullish.targetPrice = currentP * 1.025; 
            if (bearish.targetPrice >= currentP) bearish.targetPrice = currentP * 0.975; 
            
            // Probability Normalization
            const bProb = bullish.probability || 0;
            const beProb = bearish.probability || 0;
            const nProb = neutral.probability || 0;
            const total = bProb + beProb + nProb;
            
            if (total !== 100) {
                if (total === 0) {
                     bullish.probability = 33; bearish.probability = 33; neutral.probability = 34;
                } else {
                     bullish.probability = Math.round((bProb / total) * 100);
                     bearish.probability = Math.round((beProb / total) * 100);
                     neutral.probability = 100 - bullish.probability - bearish.probability;
                }
            }
        }

        // 4. Trinity Consensus Logic with Correlation Penalty
        if (data.trinityConsensus) {
            const { quantScore, smartMoneyScore, chartPatternScore } = data.trinityConsensus;
            let calculatedWinRate = Math.round((quantScore * 0.35) + (smartMoneyScore * 0.35) + (chartPatternScore * 0.3));
            
            // Penalties for Divergence
            if (Math.abs(quantScore - smartMoneyScore) > 30) {
                 calculatedWinRate -= 10;
                 data.trinityConsensus.consensusVerdict = 'DIVERGENCE (背离)';
            }
            // Logic Guardrail 1: Correlation Check
            if (data.correlationMatrix && data.correlationMatrix.impact === 'Headwind (阻力)') {
                calculatedWinRate -= 15; // Significant penalty for fighting the macro trend
            }
            
            // Logic Guardrail 2: Fractal Conflict Check (Explicit User Request)
            if (data.trendResonance && data.trendResonance.resonance === 'Conflict (逆势/回调)') {
                // FORCE CAP at 70% for counter-trend trades as requested
                if (calculatedWinRate > 70) calculatedWinRate = 70;
            }

            // Logic Guardrail 3: Wyckoff Distribution Override (NEW)
            if (data.wyckoff && data.wyckoff.phase.includes('Distribution')) {
                 // In Distribution, RSI Oversold is a TRAP. Cap win rate for buys.
                 if (calculatedWinRate > 60) calculatedWinRate = 60;
            }

            // Logic Guardrail 4: Volume Profile Resistance Override (NEW)
            if (data.volumeProfile && data.volumeProfile.verdict.includes('Overhead Supply')) {
                 if (calculatedWinRate > 65) calculatedWinRate = 65;
            }
            
            // Logic Guardrail 5: Tribunal Verdict Check
            if (data.marketTribunal && data.marketTribunal.chiefJustice) {
                const { winner, confidenceAdjustment } = data.marketTribunal.chiefJustice;
                const adj = typeof confidenceAdjustment === 'number' ? confidenceAdjustment : 0;
                
                calculatedWinRate += adj;

                // Strong Check: If Judge says BEARS but rate is high, punish heavily
                if (winner === 'BEARS' && calculatedWinRate > 55) {
                    calculatedWinRate = Math.max(45, calculatedWinRate - 20);
                }
                // If Judge says BULLS but rate is low, boost slightly
                if (winner === 'BULLS' && calculatedWinRate < 45) {
                    calculatedWinRate = Math.min(55, calculatedWinRate + 20);
                }
            }
            
            // Logic Guardrail 6: Sentiment Divergence Penalty (NEW)
            if (data.sentimentDivergence && data.sentimentDivergence.divergenceStatus.includes('Bearish Divergence')) {
                 // Retail Greed + Inst Sell = Trap. Reduce Win Rate severely.
                 calculatedWinRate -= 20;
                 data.signal = SignalType.NEUTRAL; // Downgrade Signal
            }

            // Logic Guardrail 7: Volatility Mismatch Penalty (NEW)
            if (data.volatilityAnalysis) {
                const regime = data.volatilityAnalysis.regime;
                const strategy = data.volatilityAnalysis.adaptiveStrategy;
                // If Low Volatility but strategy suggests Breakout? Penalize.
                if (regime.includes('Low') && strategy.includes('Breakout')) {
                    calculatedWinRate -= 20;
                    data.reasoning += " [RISK: Breakout in Low Volatility = Trap]";
                }
            }
            
            data.winRate = Math.max(0, Math.min(100, calculatedWinRate));
        }

        // 5. Signal Sync
        if (data.winRate >= 60) data.signal = SignalType.BUY;
        else if (data.winRate <= 40) data.signal = SignalType.SELL;
        else data.signal = SignalType.NEUTRAL;

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