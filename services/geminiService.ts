

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
           - 6 digits starting '6' -> "SSE:xxxxxx" (Shanghai).
           - 6 digits starting '0'/'3' -> "SZSE:xxxxxx" (Shenzhen).
           - HK stocks -> "HKEX:xxxx".
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

export const analyzeMarketData = async (symbol: string, timeframe: Timeframe, currentPrice: number, imageBase64?: string, isLockedPrice: boolean = false): Promise<RealTimeAnalysis> => {
    const ai = initAI();
    if (!ai) throw new Error("API Key not configured");

    const horizon = getPredictionHorizon(timeframe);
    
    // --- 1. MARKET SEGMENTATION LOGIC (Identifying Big A vs US) ---
    const isAShare = symbol.startsWith('SSE') || symbol.startsWith('SZSE') || /^[0-9]{6}$/.test(symbol.split(':')[1] || '');
    const isCrypto = symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('USDT') || symbol.includes('SOL') || symbol.includes('BINANCE');
    const isForex = symbol.startsWith('FX') || symbol.startsWith('OANDA');
    const isUSStock = !isAShare && !isCrypto && !isForex;

    let marketContext = 'GLOBAL_FX';
    if (isAShare) marketContext = 'CN_ASHARE';
    else if (isUSStock) marketContext = 'US_EQUITY';
    else if (isCrypto) marketContext = 'CRYPTO';

    // DYNAMIC TIMEFRAME CONTEXT FOR SEARCH
    const tfContext = timeframe === Timeframe.D1 ? "日线" : `${timeframe}级别`; 
    const tfSearch = timeframe === Timeframe.D1 ? "daily chart" : `${timeframe} chart`;

    let searchInstructions = "";
    let marketSpecificProtocol = "";

    // 2. CONFIGURE SEARCH & PROTOCOL BASED ON MARKET TYPE
    if (isAShare) {
        // A-SHARE LOGIC (Policy + Hot Money + T+1)
        marketSpecificProtocol = `
            **MARKET PROTOCOL: CHINA A-SHARES (CN_ASHARE)**
            1.  **POLICY IS KING**: Prioritize government policies (Five-Year Plans, PBOC announcements, State Media tone).
            2.  **FUNDS FLOW**: Focus on "Northbound Money" (北向资金) and "Main Force" (主力资金/游资).
            3.  **RULES**: Strictly adhere to T+1 trading rules. Price Limits (10%/20%) are critical support/resistance.
            4.  **CONCEPTS**: Identify "Concept Hype" (概念炒作) and Sector Rotation (板块轮动).
            5.  **LANGUAGE**: Use terms like "Dragon Return" (龙头反包), "Limit Up" (涨停), "Wash" (洗盘).
        `;
        
        if (!imageBase64) {
             searchInstructions = `
              DEEP MINING MODE (A-SHARE):
              1. "东方财富 ${symbol} 主力资金流向 龙虎榜"
              2. "同花顺 ${symbol} 概念板块 涨停原因"
              3. "雪球 ${symbol} 深度研报 目标价"
              4. "新浪财经 ${symbol} 重大利好利空消息"
            `;
        } else {
             searchInstructions = `"${symbol} 主力资金流向", "${symbol} 最新研报", "${symbol} 概念题材"`;
        }

    } else if (isCrypto) {
        // CRYPTO LOGIC (24/7 + On-Chain)
         marketSpecificProtocol = `
            **MARKET PROTOCOL: CRYPTO ASSETS**
            1.  **ON-CHAIN**: Liquidation Heatmaps, Open Interest (OI), Funding Rates.
            2.  **MACRO**: Correlation with NASDAQ/Gold.
            3.  **TECHNICALS**: High respect for Fibonacci and pure Price Action.
            4.  **SENTIMENT**: Fear & Greed Index, Twitter/X trends.
        `;
         if (!imageBase64) {
            searchInstructions = `
              DEEP MINING MODE (CRYPTO):
              1. "${symbol} liquidation heatmap levels order book depth"
              2. "${symbol} funding rate open interest trend coinglass"
              3. "${symbol} technical analysis rsi divergence macd"
              4. "${symbol} crypto twitter sentiment news"
            `;
        } else {
            searchInstructions = `"${symbol} technical analysis", "${symbol} funding rate open interest"`;
        }

    } else {
        // US/GLOBAL LOGIC (Institutional + Macro)
        marketSpecificProtocol = `
            **MARKET PROTOCOL: US EQUITIES/GLOBAL**
            1.  **INSTITUTIONAL**: Dark Pools, VWAP deviations, Options Gamma Exposure (GEX).
            2.  **MACRO**: Fed Policy (Hawkish/Dovish), Bond Yields, Earnings.
            3.  **RULES**: T+0 trading allowed. Pre-market/After-hours liquidity matters.
            4.  **STRUCTURE**: Respect Key Levels, Supply/Demand Zones, SMC (Smart Money Concepts).
        `;
        if (!imageBase64) {
            searchInstructions = `
              DEEP MINING MODE (US/GLOBAL):
              1. "${symbol} technical analysis pivot points fibonacci levels today"
              2. "${symbol} option chain max pain put call ratio"
              3. "${symbol} institutional ownership change recent filings"
              4. "${symbol} analyst price targets consensus strong buy sell"
            `;
        } else {
            searchInstructions = `"${symbol} technical analysis", "${symbol} institutional flow", "${symbol} options sentiment"`;
        }
    }

    // UPDATED SYSTEM PROMPT: TRINITY CONSENSUS PROTOCOL WITH ZERO VARIANCE
    const systemPrompt = `
      You are **TradeGuard Pro**, an elite institutional trading AI.
      
      **CORE DIRECTIVE**: Zero Variance. Rigorous Deduction. Deterministic Analysis.
      **LANGUAGE**: All analysis content MUST be in **SIMPLIFIED CHINESE (简体中文)**.
      
      ${marketSpecificProtocol}
      
      **PRICE HANDLING RULE (CRITICAL)**:
      ${isLockedPrice 
        ? `>>> USER HAS MANUALLY LOCKED THE PRICE AT ${currentPrice}. <<< 
           You MUST accept ${currentPrice} as the ABSOLUTE TRUTH. 
           DO NOT update this price based on Google Search results. 
           ALL Calculations (Take Profit, Stop Loss, Support, Resistance) MUST be relative to exactly ${currentPrice}.
           In the output JSON, 'realTimePrice' MUST be exactly ${currentPrice}.` 
        : `Use ${currentPrice} as a reference. If Google Search reveals a more recent price, USE THE NEW PRICE for all calculations and update 'realTimePrice' in the JSON.`
      }
      
      **METHODOLOGY: THE TRINITY CONSENSUS PROTOCOL (三位一体共识协议)**
      
      1.  **THE QUANT (量化派)**: 
          - Calculate RSI, MACD, and Fib Levels precisely based on the Price Rule above.
      2.  **THE SMART MONEY (资金派)**: 
          - Analyze Volume, Flow, and Institutional intent.
      3.  **THE CHARTIST (结构派 - VISION/MINING)**: 
          - **IF IMAGE PROVIDED (VISUAL ANCHOR PROTOCOL)**: 
            - You MUST READ THE Y-AXIS LABELS and extract exact price levels.
            - Do not guess "support is nearby". Say "Support is strictly at 152.4 based on the image".
            - **CONSISTENCY RULE**: If Visual Structure (e.g., Bearish Engulfing) CONFLICTS with News Sentiment (e.g., Bullish Earnings), **VISUALS WIN** for short-term scoring. This prevents "Bull Trap" losses.
          - **IF NO IMAGE (DATA TRIANGULATION)**:
            - You MUST compare data from at least 3 search sources to find the common trend.
            - If Source A says Bullish and Source B says Bearish, Verdict is "Neutral/Divergence". Do not guess.

      **EXECUTION CHAIN**:
      
      1.  **PIXEL-LEVEL EXTRACTION**:
          - IF IMAGE: Fill 'visualKeyLevels' with precise numbers read from the chart.
          - IF NO IMAGE: Fill 'dataMining' with numbers from search text.

      2.  **CONSISTENCY CHECK**:
          - If 'visualKeyLevels' shows resistance at 100, but 'tradingSetup' suggests entry at 101, STOP. Correct the setup to respect the visual resistance.
          - Your analysis must be reproducible. With the same image/data, you must output the exact same levels.
      
      Current Context:
      - Asset: ${symbol} (${currentPrice})
      - Timeframe: ${timeframe}
      - Market Context: ${marketContext}
      
      Output JSON Schema (Strictly maintain Chinese strings):
      {
        "signal": "BUY" | "SELL" | "NEUTRAL",
        "marketContext": "${marketContext}",
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
        "visualAnalysis": "string (Detailed visual description. If Image provided. Else null)",
        "visualKeyLevels": {
            "detectedSupport": number,
            "detectedResistance": number,
            "patternName": "string (e.g. Double Top)",
            "candlePattern": "string (e.g. Long Upper Wick)"
        },
        "dataMining": {
            "sourcesCount": number,
            "confidenceLevel": "High" | "Medium" | "Low",
            "keyDataPoints": ["string"],
            "contradictions": ["string"],
            "primaryTrendSource": "string"
        },
        "winRate": number, 
        "historicalWinRate": number, 
        "entryPrice": number,
        "entryStrategy": "string (Short Name)",
        "takeProfit": number,
        "stopLoss": number,
        "supportLevel": number,
        "resistanceLevel": number,
        "riskRewardRatio": number,
        "reasoning": "string",
        "volatilityAssessment": "string",
        "strategyMatch": "string",
        "marketStructure": "string",
        "technicalIndicators": {
            "rsi": number, "macdStatus": "string", "emaAlignment": "string", "bollingerStatus": "string", "kdjStatus": "string", "volumeStatus": "string"
        },
        "institutionalData": {
            "netInflow": "string", "blockTrades": "string", "mainForceSentiment": "string"
        },
        "smartMoneyAnalysis": {
            "retailSentiment": "Fear" | "Greed" | "Neutral",
            "smartMoneyAction": "string",
            "orderBlockStatus": "string"
        },
        "scenarios": {
            "bullish: { "probability": number, "targetPrice": number, "description": "string" },
            "bearish": { "probability": number, "targetPrice": number, "description": "string" },
            "neutral": { "probability": number, "targetPrice": number, "description": "string" }
        },
        "tradingSetup": {
            "strategyIdentity": "string",
            "confirmationTriggers": ["string"],
            "invalidationPoint": "string"
        },
        "redTeaming": {
            "risks": ["string"],
            "mitigations": ["string"],
            "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
            "stressTest": "string"
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
      
      ${imageBase64 ? `**VISION MODE ENGAGED (PRIORITY: HIGH)**: 
      1. SCAN THE CHART IMAGE.
      2. EXTRACT PIXEL-PERFECT LEVELS: Look at the Y-axis numbers. Support/Resistance MUST match the visual grid lines.
      3. 'visualKeyLevels' is MANDATORY. 
      4. IF Vision indicates a specific pattern (e.g. Head & Shoulders), you MUST structure your trade around it, ignoring conflicting news.
      ` : `**DEEP MINING MODE (NO IMAGE)**: 
      1. Use Search to reconstruct the chart in your mind.
      2. TRIANGULATE data points to ensure accuracy.
      3. 'dataMining' is MANDATORY.
      `}
      
      Consistency Check: If you run this analysis 5 times on the same data, the result must be identical. Do not hallucinate.
      
      Reference Price: ${currentPrice} ${isLockedPrice ? '(LOCKED - ABSOLUTE)' : ''}
    `;

    const requestContents: any = {
      model: imageBase64 ? 'gemini-3-pro-image-preview' : 'gemini-3-pro-preview', 
      config: {
          systemInstruction: systemPrompt,
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          temperature: 0.0, // STRICT ZERO for consistency
          topK: 1, // STRICT 1 to remove randomness
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
        if (data.trinityConsensus) {
            const { quantScore, smartMoneyScore, chartPatternScore } = data.trinityConsensus;
            // Weighted Average
            let calculatedWinRate = Math.round((quantScore * 0.35) + (smartMoneyScore * 0.35) + (chartPatternScore * 0.3));
            
            // Divergence Penalty
            if (Math.abs(quantScore - smartMoneyScore) > 30) {
                 calculatedWinRate -= 10;
                 data.trinityConsensus.consensusVerdict = 'DIVERGENCE (背离)';
            }
            
            // Text-Mode specific penalty if confidence is low
            if (!imageBase64 && data.dataMining && data.dataMining.confidenceLevel === 'Low') {
                calculatedWinRate -= 5;
            }

            // Image Consistency Check (If Image detected specific Bearish pattern but score is high, penalty)
            if (imageBase64 && data.visualKeyLevels) {
                const pattern = (data.visualKeyLevels.patternName || "").toLowerCase();
                if ((pattern.includes("top") || pattern.includes("bear")) && calculatedWinRate > 60) {
                    calculatedWinRate = 55; // Force neutralization for contradiction
                    data.reasoning += " [VISION OVERRIDE: Bearish pattern detected visually, adjusted score downward for safety.]";
                }
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

        // Ensure visual key levels are parsed
        if (data.visualKeyLevels) {
            data.visualKeyLevels.detectedSupport = parsePrice(data.visualKeyLevels.detectedSupport);
            data.visualKeyLevels.detectedResistance = parsePrice(data.visualKeyLevels.detectedResistance);
        }
        
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
                temperature: 0.0, // STRICT ZERO
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
