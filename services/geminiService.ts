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
    
    // Asset Classification
    const isAShare = symbol.startsWith('SSE') || symbol.startsWith('SZSE');
    const isCrypto = symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('USDT') || symbol.includes('SOL') || symbol.includes('BINANCE');
    
    // DYNAMIC TIMEFRAME CONTEXT FOR SEARCH
    const tfContext = timeframe === Timeframe.D1 ? "日线" : `${timeframe}级别`; 
    const tfSearch = timeframe === Timeframe.D1 ? "daily chart" : `${timeframe} chart`;

    let searchInstructions = "";
    if (isAShare) {
        searchInstructions = `
          MANDATORY SEARCH (BLIND/HYBRID):
          1. "东方财富 ${symbol} 资金流向 ${tfContext} 主力净流入 实时"
          2. "同花顺 ${symbol} KDJ数值 MACD金叉死叉 ${tfContext} 最新值"
          3. "雪球 ${symbol} 讨论区 热门观点 成交量分析"
        `;
    } else if (isCrypto) {
        searchInstructions = `
          MANDATORY SEARCH (BLIND/HYBRID):
          1. "${symbol} funding rate open interest ${tfSearch} current"
          2. "${symbol} RSI KDJ indicator values ${tfSearch} exact number"
          3. "${symbol} liquidation levels heatmap"
        `;
    } else {
        searchInstructions = `
          MANDATORY SEARCH (BLIND/HYBRID):
          1. "${symbol} unusual options activity today RSI value ${tfSearch}"
          2. "${symbol} institutional net inflow current data"
          3. "${symbol} support resistance levels ${tfSearch} analysis"
        `;
    }

    // UNIFIED SYSTEM PROMPT: THE CHAIN OF DEDUCTION
    const systemPrompt = `
      You are **TradeGuard Pro**, an elite institutional trading AI designed for **determinism and precision**.
      
      **CONSISTENCY PROTOCOL**:
      - Do not hallucinate. If data is unclear, assume NEUTRAL.
      - Apply the **SCORING RUBRIC** strictly. Do not deviate.
      
      **SCORING RUBRIC (评分锚定标准)**:
      1. **Technical (技术面)**:
         - Score > 80 IF: Price > EMA20 AND (MACD Golden Cross OR Volume Breakout).
         - Score < 40 IF: Price < EMA20 AND (MACD Death Cross OR RSI < 40).
         - Otherwise: 40-60 (Neutral).
      2. **Institutional (资金面)**:
         - Score > 70 IF: Net Inflow > 0 AND Block Trades = High.
         - Score < 30 IF: Net Inflow < 0.
      
      **THE LOGIC CHAIN (执行链条)**:
      1.  **DATA INTAKE**: 
          - IF Image: Identify visual structure (MSS, FVG, Patterns) on the ${timeframe} chart.
          - IF Search: Extract exact numeric values (RSI, Vol, Net Inflow).
      
      2.  **DRIVER CALCULATION (归因计算)**:
          - Apply the Rubric above to calculate 4 sub-scores (0-100).
          - **Win Rate** = (Tech*0.4 + Inst*0.3 + Sent*0.2 + Macro*0.1).
          - *CRITICAL CONSTRAINT*: If Institutional Score is < 40, Maximum Win Rate is capped at 60% regardless of Technicals (Fake Pump Protection).
      
      3.  **SCENARIO DEDUCTION (情景推演)**:
          - Based *strictly* on the calculated Win Rate:
          - If Win Rate > 60%: Bullish Scenario is dominant (Prob > 50%).
          - If Win Rate < 40%: Bearish Scenario is dominant.
          - If Win Rate 40-60%: Neutral Scenario is dominant.
          - Generate precise targets for all 3 scenarios.
      
      4.  **ARCHITECT BLUEPRINT (交易蓝图)**:
          - Create a specific Trade Setup for the **Dominant Scenario** found in Step 3.
          - Identity: Name the setup (e.g., "Bull Flag Breakout").
          - Triggers: List 3 exact conditions for entry.
          - Invalidation: exact price level where this specific setup fails.
      
      5.  **RED TEAM ATTACK (红队风控)**:
          - Attack the **Architect Blueprint** from Step 4.
          - "Stress Test": What happens to this setup if a sudden shock occurs?
          - Risks: What specific weakness exists in the Blueprint?
      
      **LANGUAGE RULE (CRITICAL)**: 
      - The fields 'tradingSetup', 'redTeaming', 'scenarios.description', 'reasoning', and 'marketStructure' MUST be in **SIMPLIFIED CHINESE (简体中文)**.
      - Keep English only for technical terms like "RSI", "MACD", "FVG".
      
      Current Context:
      - Asset: ${symbol} (${currentPrice})
      - Timeframe: ${timeframe}
      
      Output JSON Schema:
      {
        "signal": "BUY" | "SELL" | "NEUTRAL",
        "realTimePrice": number,
        "scoreDrivers": {
            "technical": number, "institutional": number, "sentiment": number, "macro": number 
        },
        "winRate": number, 
        "historicalWinRate": number, 
        "entryPrice": number,
        "entryStrategy": "string (Short Name in Chinese)",
        "takeProfit": number,
        "stopLoss": number,
        "supportLevel": number,
        "resistanceLevel": number,
        "riskRewardRatio": number,
        "reasoning": "string (Summary of the Logic Chain in Chinese)",
        "volatilityAssessment": "string (Chinese)",
        "strategyMatch": "string (e.g. '趋势跟随')",
        "marketStructure": "string (e.g. '多头排列 (Bullish)')",
        "technicalIndicators": {
            "rsi": number, "macdStatus": "string (Chinese)", "emaAlignment": "string", "bollingerStatus": "string", "kdjStatus": "string", "volumeStatus": "string"
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
            "strategyIdentity": "string (e.g. '威科夫弹簧效应')",
            "confirmationTriggers": ["Condition 1 (Chinese)", "Condition 2", "Condition 3"],
            "invalidationPoint": "string (Specific Condition in Chinese)"
        },
        "redTeaming": {
            "risks": ["Risk 1 (Chinese)", "Risk 2"],
            "mitigations": ["Action 1 (Chinese)"],
            "severity": "LOW" | "MEDIUM" | "HIGH" | 'CRITICAL',
            "stressTest": "string (Scenario description in Chinese)"
        },
        "modelFusionConfidence": number, 
        "guruInsights": [
             { "name": "Name", "style": "Role", "verdict": "看多/看空", "quote": "Chinese Quote" }
        ],
        "futurePrediction": {
             "targetHigh": number, "targetLow": number, "confidence": number, "predictionPeriod": "${horizon}"
        }
      }
    `;

    const userPromptText = `
      Execute Logic Chain for ${symbol} on ${timeframe}.
      ${searchInstructions}
      
      ${imageBase64 ? `IMAGE MODE: Analyze the attached ${timeframe} chart visually. Cross-reference visual patterns with search data.` : 'BLIND MODE: Rely on Search Data.'}
      
      REQUIREMENTS:
      1. Ensure Scenarios (Bull/Bear/Neutral) probability sums to 100%.
      2. Ensure Trading Setup matches the highest probability scenario.
      3. Ensure Red Team specifically critiques that Setup.
      4. RETURN JSON ONLY.
      
      Reference Price: ${currentPrice}
    `;

    const requestContents: any = {
      model: imageBase64 ? 'gemini-3-pro-image-preview' : 'gemini-3-pro-preview', 
      config: {
          systemInstruction: systemPrompt,
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          // OPTIMIZATION FOR CONSISTENCY:
          // Low temperature forces the model to pick the most likely tokens, reducing variance.
          temperature: 0.1, 
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
        
        // --- CONSISTENCY ENFORCEMENT & DIVERGENCE PENALTY ---
        // We recalculate the win rate strictly here to prevent LLM math errors or hallucinations.
        const { technical, institutional, sentiment, macro } = data.scoreDrivers;
        
        let calculatedWinRate = Math.round((technical * 0.4) + (institutional * 0.3) + (sentiment * 0.2) + (macro * 0.1));
        
        // Divergence Penalty: If Technical is high but Institutional is low, penalize the win rate.
        // This simulates "Fake Pump" detection logic.
        if (technical > 70 && institutional < 40) {
            console.log("Applying Divergence Penalty (Fake Pump Detected)");
            calculatedWinRate -= 15; // Penalize
        }
        
        data.winRate = Math.max(0, Math.min(100, calculatedWinRate)); // Clamp 0-100

        // Ensure Signal Matches Win Rate
        if (data.winRate >= 60) data.signal = SignalType.BUY;
        else if (data.winRate <= 40) data.signal = SignalType.SELL;
        else data.signal = SignalType.NEUTRAL;
        // ----------------------------------------------------

        // Ensure Structure consistency (Fallback for old cache or hallucinations)
        if (!data.tradingSetup) {
             data.tradingSetup = {
                 strategyIdentity: "标准趋势结构",
                 confirmationTriggers: ["价格突破均线", "成交量配合", "MACD金叉"],
                 invalidationPoint: "收盘跌破支撑位"
             };
        }

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
          "equityCurveDescription": "string",
          "insights": "string"
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