import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AIAnalysis, SignalType, Timeframe, StockSymbol, BacktestStrategy, BacktestPeriod, BacktestResult, GuruInsight, RealTimeAnalysis, MarketRegime } from "../types";
import { STRATEGIES } from "../constants";

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
        let clean = input.replace(/,/g, '');
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
    let cleanedText = text.replace(/```[a-zA-Z0-9]*\n?/g, '').replace(/```/g, '').trim();
    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1) {
        cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
    }

    try {
        return JSON.parse(cleanedText);
    } catch (e) {
        console.warn("Initial JSON Parse Failed. Attempting repair...", e);
        try {
            const fixedNewlines = cleanedText.replace(/(: ")([\s\S]*?)(?=")/g, (match, prefix, content) => {
                return prefix + content.replace(/\n/g, "\\n");
            });
            return JSON.parse(fixedNewlines);
        } catch (e2) {
             try {
                const sanitized = cleanedText.replace(/[\n\r\t]/g, " ");
                return JSON.parse(sanitized);
            } catch (e3) {
                 console.error("Critical JSON Parse Error. Raw Text:", text);
                 throw new Error("Invalid JSON structure returned by AI");
            }
        }
    }
};

export const lookupStockSymbol = async (query: string): Promise<StockSymbol> => {
  const ai = initAI();
  if (!ai) throw new Error("API Key not configured");

  // Define regex fallback function internally to reuse
  const runHeuristicFallback = (fallbackQuery: string): StockSymbol => {
      console.warn("Using heuristic fallback for:", fallbackQuery);
      let cleanQuery = fallbackQuery.trim().toUpperCase();
      
      // Known Crypto mappings
      if (cleanQuery === 'BTC') cleanQuery = 'BINANCE:BTCUSDT';
      else if (cleanQuery === 'ETH') cleanQuery = 'BINANCE:ETHUSDT';
      else if (cleanQuery === 'SOL') cleanQuery = 'BINANCE:SOLUSDT';
      else if (cleanQuery === 'XAUUSD') cleanQuery = 'OANDA:XAUUSD';
      // A-Share Numeric codes
      else if (/^[0-9]{6}$/.test(cleanQuery)) {
          if (cleanQuery.startsWith('6')) cleanQuery = `SSE:${cleanQuery}`; 
          else cleanQuery = `SZSE:${cleanQuery}`; 
      }
      // US Tickers
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
           - 6 digits starting '6' -> "SSE:xxxxxx".
           - 6 digits starting '0'/'3' -> "SZSE:xxxxxx".
           - Yahoo ".SS" -> "SSE:xxxxxx", ".SZ" -> "SZSE:xxxxxx".
           - Bitcoin/Crypto -> "BINANCE:BTCUSDT" format.
           - Gold/Forex -> "OANDA:XAUUSD" or "FX:EURUSD".
        4. Return full name and price.
        
        Output strictly JSON: { "symbol": "EXCHANGE:TICKER", "name": "Name", "currentPrice": number }
      `;

      const result = await ai.models.generateContent({
          model: 'gemini-2.5-flash', 
          contents: prompt,
          config: {
            temperature: 0.1, // LOW TEMP FOR CONSISTENCY
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
      
      // Post-process AI result
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

export const analyzeMarketData = async (symbol: string, timeframe: Timeframe, currentPrice: number, imageBase64?: string): Promise<RealTimeAnalysis> => {
    const ai = initAI();
    if (!ai) throw new Error("API Key not configured");

    const horizon = getPredictionHorizon(timeframe);
    
    const isAShare = symbol.startsWith('SSE') || symbol.startsWith('SZSE');
    const isCrypto = symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('USDT') || symbol.includes('SOL') || symbol.includes('BINANCE');
    
    // DYNAMIC TIMEFRAME CONTEXT FOR SEARCH
    const tfContext = timeframe === Timeframe.D1 ? "日线" : `${timeframe}级别`; 
    const tfSearch = timeframe === Timeframe.D1 ? "daily chart" : `${timeframe} chart`;

    let searchInstructions = "";
    if (isAShare) {
        searchInstructions = `
          MANDATORY DATA EXTRACTION (HYBRID):
          1. "东方财富 ${symbol} 资金流向 ${tfContext} 主力净流入"
          2. "同花顺 ${symbol} KDJ数值 MACD金叉死叉 ${tfContext} 最新值"
          3. "雪球 ${symbol} 讨论区 市场情绪 机构观点"
        `;
    } else if (isCrypto) {
        searchInstructions = `
          MANDATORY DATA EXTRACTION (HYBRID):
          1. "${symbol} funding rate open interest ${tfSearch} current"
          2. "${symbol} RSI KDJ indicator values ${tfSearch} exact number"
          3. "${symbol} liquidation levels heatmap"
        `;
    } else {
        searchInstructions = `
          MANDATORY DATA EXTRACTION (HYBRID):
          1. "${symbol} unusual options activity today RSI value ${tfSearch}"
          2. "${symbol} institutional net inflow current data"
          3. "${symbol} technical support resistance levels ${tfSearch}"
        `;
    }

    // UPDATED SYSTEM PROMPT: TRINITY CONSENSUS PROTOCOL
    const systemPrompt = `
      You are **TradeGuard Pro**, an elite institutional trading AI with Multi-Modal Vision capabilities.
      
      **MISSION**: Zero Variance. Rigorous Deduction. No Hallucinations.
      **LANGUAGE**: All analysis content MUST be in **SIMPLIFIED CHINESE (简体中文)** for readability.
      
      **METHODOLOGY: THE TRINITY CONSENSUS PROTOCOL (三位一体共识协议)**
      You must simulate three distinct analysts. Their scores MUST be consistent with their specific data sources.
      
      1.  **THE QUANT (量化派)**: 
          - Focus: RSI, Pivot Points, Fibonacci Levels, Bollinger Bands.
          - Output: A math-based score (0-100).
      
      2.  **THE SMART MONEY (资金派)**:
          - Focus: Volume Spread Analysis (VSA), Net Inflow, Order Blocks.
          - Output: A flow-based score (0-100).
      
      3.  **THE CHARTIST (结构派) - VISION DRIVEN**:
          - Focus: Market Structure (MSS), Price Action, K-Line Patterns.
          - **CRITICAL RULE**: If 'visualAnalysis' is present, the Chart Pattern Score MUST be derived directly from it. 
            - If Visual = "Bearish Engulfing", Score MUST be < 40.
            - If Visual = "Bullish Breakout", Score MUST be > 60.
          - Output: A structure-based score (0-100).
      
      **STEP-BY-STEP EXECUTION CHAIN (LOGIC SUTURE)**:
      
      1.  **VISUAL & DATA INGESTION**:
          - IF IMAGE PROVIDED: First, generate 'visualAnalysis'. What you see here becomes the "Ground Truth" for the Chartist persona.
          - IF NO IMAGE: Use Technical Indicators (RSI/MACD) as Ground Truth for structure.

      2.  **TRINITY VOTE & CONSISTENCY CHECK**:
          - Calculate separate scores for Quant, Smart Money, and Chartist.
          - **INTEGRITY CHECK**: If Visual Analysis is Bearish (e.g., "Shooting Star"), the Chartist Score MUST reflect this. You cannot say "Shooting Star" and give a score of 80.
      
      3.  **DRIVER CALCULATION**:
          - Combine the 3 scores into the final 'scoreDrivers' and 'winRate'.
      
      4.  **ARCHITECT BLUEPRINT (COHERENCE)**:
          - The 'tradingSetup' must be the **DIRECT LOGICAL CONSEQUENCE** of the Consensus. 
          - **MANDATORY**: If you saw a specific pattern in the image (e.g. "Double Bottom"), the 'tradingSetup.strategyIdentity' MUST be "Double Bottom (双底突破)".
          - 'reasoning' must strictly explain *why* the Visual/Quant/Flow analysis led to this setup.
      
      Current Context:
      - Asset: ${symbol} (${currentPrice})
      - Timeframe: ${timeframe}
      
      Output JSON Schema (Strictly maintain Chinese strings):
      {
        "signal": "BUY" | "SELL" | "NEUTRAL",
        "realTimePrice": number,
        "scoreDrivers": {
            "technical": number, "institutional": number, "sentiment": number, "macro": number 
        },
        "trinityConsensus": {
            "quantScore": number,
            "smartMoneyScore": number,
            "chartPatternScore": number,
            "consensusVerdict": "STRONG_CONFLUENCE (强共振)" | "MODERATE (一般)" | "DIVERGENCE (背离)"
        },
        "smartMoneyAnalysis": {
            "retailSentiment": "Fear" | "Greed" | "Neutral",
            "smartMoneyAction": "Accumulating (吸筹)" | "Distributing (派发)" | "Marking Up (拉升)" | "Inactive",
            "orderBlockStatus": "Active Supply Zone" | "Active Demand Zone" | "None"
        },
        "trendResonance": {
            "trendHTF": "Bullish" | "Bearish",
            "trendLTF": "Bullish" | "Bearish",
            "resonance": "Resonant (顺势)" | "Conflict (逆势/回调)" | "Chaos (震荡)"
        },
        "visualAnalysis": "string (If Image provided: Describe specific visual findings like 'Red Bearish Engulfing Candle', 'Price touching blue EMA20 line'. THIS IS THE GROUND TRUTH. If No Image: null)",
        "winRate": number, 
        "historicalWinRate": number, 
        "entryPrice": number,
        "entryStrategy": "string (Short Name in Chinese, e.g. '0.618回撤接多')",
        "takeProfit": number,
        "stopLoss": number,
        "supportLevel": number,
        "resistanceLevel": number,
        "riskRewardRatio": number,
        "reasoning": "string (MUST be in Simplified Chinese. Synthesize Visual, Quant, and Flow into a cohesive logic stream)",
        "volatilityAssessment": "string (Chinese)",
        "strategyMatch": "string (e.g. 'ICT + 威科夫')",
        "marketStructure": "string (e.g. '多头排列 (Bullish)')",
        "technicalIndicators": {
            "rsi": number, "macdStatus": "string", "emaAlignment": "string", "bollingerStatus": "string", "kdjStatus": "string", "volumeStatus": "string"
        },
        "institutionalData": {
            "netInflow": "string", "blockTrades": "string", "mainForceSentiment": "string"
        },
        "scenarios": {
            "bullish": { "probability": number, "targetPrice": number, "description": "string (Chinese)" },
            "bearish": { "probability": number, "targetPrice": number, "description": "string (Chinese)" },
            "neutral": { "probability": number, "targetPrice": number, "description": "string (Chinese)" }
        },
        "tradingSetup": {
            "strategyIdentity": "string (Chinese, e.g. '头肩底右肩突破')",
            "confirmationTriggers": ["string (Chinese)"],
            "invalidationPoint": "string (Chinese, explain the condition)"
        },
        "redTeaming": {
            "risks": ["string (Chinese)"],
            "mitigations": ["string (Chinese)"],
            "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
            "stressTest": "string (Chinese)"
        },
        "modelFusionConfidence": number, 
        "guruInsights": [],
        "futurePrediction": {
             "targetHigh": number, "targetLow": number, "confidence": number, "predictionPeriod": "${horizon}"
        }
      }
    `;

    const userPromptText = `
      Execute Trinity Consensus Protocol for ${symbol} on ${timeframe}.
      ${searchInstructions}
      
      ${imageBase64 ? `**VISION MODE ENGAGED (HIGHEST PRIORITY)**: 
      1. **SCAN THE CHART IMAGE**: Look closely at the *latest* candles. Are there long wicks (rejection)? Is there a divergence? What color are the candles?
      2. **PATTERN RECOGNITION**: Identify specific geometries (Triangles, Wedges, Channels) visible in the pixels.
      3. **MANDATORY INTEGRATION**: 
         - The 'visualAnalysis' field MUST be the **SOURCE OF TRUTH** for the 'trinityConsensus.chartPatternScore'.
         - IF 'visualAnalysis' identifies a BEARISH pattern, 'chartPatternScore' MUST be LOW (<45).
         - IF 'visualAnalysis' identifies a BULLISH pattern, 'chartPatternScore' MUST be HIGH (>55).
         - The 'tradingSetup' MUST target the specific pattern identified in the image.
      ` : 'TEXT MODE: Rely on Search Data for Math/Volume.'}
      
      MANDATORY CHECKLIST: 
      1. Calculate Fibonacci Retracement levels to determine Target Prices.
      2. Check for Divergence between Price and RSI/Volume.
      3. ENSURE COHERENCE: The 'tradingSetup' must be a direct logical consequence of the 'trinityConsensus' verdict.
      4. LANGUAGE: All text fields must be Simplified Chinese.
      
      Reference Price: ${currentPrice}
    `;

    const requestContents: any = {
      model: imageBase64 ? 'gemini-3-pro-image-preview' : 'gemini-3-pro-preview', 
      config: {
          systemInstruction: systemPrompt,
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          // ZERO TEMP FOR MAX CONSISTENCY
          temperature: 0.0, 
          topK: 1, 
          topP: 0.95
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

        // Safety Data Validation & Repair
        const baseScore = data.winRate || 50;
        if (!data.scoreDrivers) {
            data.scoreDrivers = { technical: baseScore, institutional: baseScore, sentiment: baseScore, macro: baseScore };
        }
        
        // --- RIGOROUS CONSISTENCY ENFORCEMENT ---
        // Recalculate Win Rate based on Trinity Consensus if available
        if (data.trinityConsensus) {
            const { quantScore, smartMoneyScore, chartPatternScore } = data.trinityConsensus;
            // Weighted Average
            let calculatedWinRate = Math.round((quantScore * 0.35) + (smartMoneyScore * 0.35) + (chartPatternScore * 0.3));
            
            // Divergence Penalty
            if (Math.abs(quantScore - smartMoneyScore) > 30) {
                 console.log("Significant Divergence Detected - Penalizing Win Rate");
                 calculatedWinRate -= 10;
                 data.trinityConsensus.consensusVerdict = 'DIVERGENCE (背离)';
            }
            
            data.winRate = Math.max(0, Math.min(100, calculatedWinRate));
        }

        // Ensure Signal Matches Win Rate
        if (data.winRate >= 60) data.signal = SignalType.BUY;
        else if (data.winRate <= 40) data.signal = SignalType.SELL;
        else data.signal = SignalType.NEUTRAL;
        // ----------------------------------------------------

        // Parsing numbers
        ['realTimePrice', 'entryPrice', 'takeProfit', 'stopLoss', 'supportLevel', 'resistanceLevel'].forEach(key => {
            data[key] = parsePrice(data[key]);
        });
        
        if (data.futurePrediction) {
            data.futurePrediction.targetHigh = parsePrice(data.futurePrediction.targetHigh);
            data.futurePrediction.targetLow = parsePrice(data.futurePrediction.targetLow);
        }
        
        if (data.scenarios) {
            data.scenarios.bullish.targetPrice = parsePrice(data.scenarios.bullish.targetPrice);
            data.scenarios.bearish.targetPrice = parsePrice(data.scenarios.bearish.targetPrice);
            data.scenarios.neutral.targetPrice = parsePrice(data.scenarios.neutral.targetPrice);
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
        
        Task:
        1. Search for historical price action and volatility for ${symbol} over this period.
        2. CHECK STRATEGY RULES: Look for specific setups defined by ${strategy}.
        3. Simulate trades based on these strict rules.
        4. ALL Text description MUST be in Chinese (Simplified).
        
        Return JSON:
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
                temperature: 0.1, // LOW TEMP FOR CONSISTENCY
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json"
            }
        });

        if (!result.text) throw new Error("Backtest failed");
        return cleanAndParseJSON(result.text) as BacktestResult;
    } catch (e) {
        console.error("Backtest Error:", e);
        throw new Error("Backtest simulation failed.");
    }
};