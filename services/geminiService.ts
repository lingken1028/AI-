
import { GoogleGenAI } from "@google/genai";
import { AIAnalysis, SignalType, Timeframe, StockSymbol, BacktestStrategy, BacktestPeriod, BacktestResult } from "../types";

const initAI = () => {
  if (!process.env.API_KEY) {
    console.error("API_KEY is missing from environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Interface for the extended response including the real price found
export interface RealTimeAnalysis extends AIAnalysis {
  realTimePrice: number;
}

const cleanAndParseJSON = (text: string): any => {
    // 1. Remove markdown code blocks
    let cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // 2. Find the first '{' and last '}' to isolate JSON
    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
        cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
    }

    // 3. Attempt to sanitize common issues
    try {
        return JSON.parse(cleanedText);
    } catch (e) {
        console.warn("Initial JSON Parse Failed. Attempting repair...", e);
        
        // Repair Strategy 1: Escape unescaped newlines inside strings
        try {
            const fixedNewlines = cleanedText.replace(/(?<=: ")([\s\S]*?)(?=")/g, (match) => {
                return match.replace(/\n/g, "\\n");
            });
            return JSON.parse(fixedNewlines);
        } catch (e2) {
             // Repair Strategy 2: Brute force strip control characters (Last Resort)
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

/**
 * Helper to delay execution (for retries)
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Uses Gemini Flash (Fast) to search for the correct stock symbol and name.
 */
export const lookupStockSymbol = async (query: string): Promise<StockSymbol> => {
  const ai = initAI();
  if (!ai) throw new Error("API Key not configured");

  // Use Gemini 2.5 Flash for speed in lookup tasks
  const prompt = `
    Task: Identify the correct stock symbol and company name for the user query: "${query}".
    
    Instructions:
    1. Analyze the query to extract the intended financial asset. Ignore numbers that look like prices, timeframes, or noise (e.g. in "XAUUSD 5min 4132", the asset is "XAUUSD").
    2. Use Google Search to find the official trading ticker.
    3. Return the symbol in standard TradingView format (EXCHANGE:TICKER).
       Examples: "NASDAQ:AAPL", "NYSE:BA", "HKEX:0700", "OANDA:XAUUSD", "FOREXCOM:EURUSD".
    4. Return the full official company/asset name.
    5. Return the approximate current price if found (number only), otherwise 0.
    
    IMPORTANT: 
    - If the user types "XAUUSD" or "Gold", return a valid forex/commodity ticker like "OANDA:XAUUSD".
    - If no matching stock is found, explicitly set "symbol" to null.
    
    Output strictly JSON in this format:
    {
      "symbol": "EXCHANGE:TICKER" | null,
      "name": "Company Name",
      "currentPrice": number
    }
  `;

  const runLookup = async (useTools: boolean) => {
      return await ai.models.generateContent({
          model: 'gemini-2.5-flash', 
          contents: prompt,
          config: {
            tools: useTools ? [{ googleSearch: {} }] : [],
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
            ],
          }
        });
  }

  try {
    const response = await runLookup(true);

    if (!response.text) {
        throw new Error("Empty response from AI lookup");
    }
    
    const data = cleanAndParseJSON(response.text);
    
    // Strict Validation
    if (!data.symbol || data.symbol === "null" || data.symbol === "NOT_FOUND") {
        throw new Error(`Could not find stock for query: ${query}`);
    }
    
    // Ensure symbol has a colon (EXCHANGE:TICKER) to be valid for TradingView
    if (!data.symbol.includes(':')) {
        if (data.symbol.match(/^[A-Z]{3,5}$/)) {
             data.symbol = `NASDAQ:${data.symbol}`; 
        } else if (data.symbol.includes('XAU') || data.symbol.includes('EUR')) {
             data.symbol = `FX:${data.symbol}`;
        }
    }

    return {
      symbol: data.symbol,
      name: data.name || 'Unknown',
      currentPrice: data.currentPrice || 0
    };

  } catch (error: any) {
    console.error("Symbol Lookup Error:", error);
    
    // Emergency Fallback: If quota exceeded, try to just use the query as symbol if it looks like one
    if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        console.warn("Quota exceeded during lookup. Using heuristic fallback.");
        let cleanQuery = query.trim().toUpperCase();
        
        // Advanced Heuristics for Crypto
        if (cleanQuery === 'BTC' || cleanQuery === 'BITCOIN') cleanQuery = 'BINANCE:BTCUSDT';
        else if (cleanQuery === 'ETH' || cleanQuery === 'ETHEREUM') cleanQuery = 'BINANCE:ETHUSDT';
        else if (cleanQuery === 'SOL') cleanQuery = 'BINANCE:SOLUSDT';
        else if (cleanQuery === 'XAUUSD' || cleanQuery === 'GOLD') cleanQuery = 'OANDA:XAUUSD';
        else if (/^[0-9]{4,6}$/.test(cleanQuery)) {
            // Likely Hong Kong or China Stock
            cleanQuery = `HKEX:${cleanQuery}`; 
        } 
        else if (!cleanQuery.includes(':')) {
             // Default to NASDAQ for simple tickers
             cleanQuery = `NASDAQ:${cleanQuery}`;
        }

        return {
            symbol: cleanQuery,
            name: cleanQuery,
            currentPrice: 0 // Price unknown
        };
    }
    throw error;
  }
};

const getPredictionHorizon = (tf: Timeframe): string => {
  switch (tf) {
    case Timeframe.M1:
    case Timeframe.M3:
    case Timeframe.M5: return "Scalping (Next 30-60 mins)";
    case Timeframe.M15:
    case Timeframe.M30: return "Intraday (Next 2-4 Hours)";
    case Timeframe.H1:
    case Timeframe.H2:
    case Timeframe.H4: return "Swing (Next 24 Hours)";
    case Timeframe.D1: return "Position (Next 3-5 Days)";
    default: return "Intraday";
  }
};

const validateAndFillData = (data: any, timeframe: Timeframe, realTimePrice: number): RealTimeAnalysis => {
    // Basic defaults if AI fails to return some fields
    const defaultData: RealTimeAnalysis = {
        signal: SignalType.NEUTRAL,
        winRate: 50,
        historicalWinRate: 50,
        entryPrice: realTimePrice,
        takeProfit: realTimePrice * 1.01,
        stopLoss: realTimePrice * 0.99,
        supportLevel: realTimePrice * 0.98,
        resistanceLevel: realTimePrice * 1.02,
        riskRewardRatio: 1.5,
        reasoning: "Data analysis incomplete. Displaying price anchor defaults.",
        volatilityAssessment: "Moderate",
        strategyMatch: "Price Action",
        marketStructure: "Ranging/Consolidation",
        keyFactors: ["Price Anchor"],
        kLineTrend: "Neutral consolidation detected.",
        guruInsights: [],
        deepSeekReasoning: "DeepSeek 逻辑推演:\n> 等待数据输入...\n> 逻辑验证挂起...",
        modelFusionConfidence: 50,
        futurePrediction: {
            targetHigh: realTimePrice * 1.01,
            targetLow: realTimePrice * 0.99,
            confidence: 50,
            predictionPeriod: getPredictionHorizon(timeframe)
        },
        realTimePrice: realTimePrice
    };

    return { ...defaultData, ...data, realTimePrice }; // Override defaults with whatever valid data came back
};

export const analyzeMarketData = async (symbol: string, timeframe: Timeframe): Promise<RealTimeAnalysis> => {
  const ai = initAI();
  if (!ai) throw new Error("API Key not configured");

  const horizon = getPredictionHorizon(timeframe);

  // INSTITUTIONAL ANALYSIS PROTOCOL PROMPT
  const systemInstruction = `
    You are Gemini 3 Pro, a world-class Quantitative Analyst running an "Institutional Analysis Protocol".
    Your goal is to provide a rigorous, mathematically sound trading plan for ${symbol} on the ${timeframe} timeframe.
    
    You are working in a Dual-Core architecture:
    1. CORE A (You): Gemini 3 Pro - Data Aggregator, Market Structure Analyst, Guru Persona Simulator.
    2. CORE B (Simulated): DeepSeek R1 - Red Teaming Logic Unit (Devil's Advocate), Logic Stress Tester.

    OUTPUT FORMAT: STRICT JSON only. Do not output markdown code blocks.
    LANGUAGE: All reasoning, insights, and logic outputs must be in CHINESE (中文).
  `;

  const prompt = `
    EXECUTE INSTITUTIONAL PROTOCOL FOR: ${symbol} (${timeframe})
    PREDICTION HORIZON: ${horizon}

    PHASE 1: DATA CLEANING & CONTEXT (Use Google Search)
    - Search for the REAL-TIME PRICE of ${symbol}. This is the "Price Anchor". All levels must be relative to this.
    - Search for specific chart patterns on ${timeframe} (e.g., "15m chart ${symbol} analysis").
    - Search for Breaking News/Catalysts affecting the asset today.

    PHASE 2: MARKET STRUCTURE MAPPING
    - Identify the structure: Bullish (Higher Highs/Lows), Bearish (Lower Highs/Lows), or Ranging.
    - Identify Key Institutional Levels: Support (Demand Zone) and Resistance (Supply Zone).
    - Identify the specific Strategy Pattern (e.g., "Wyckoff Spring", "EMA20 Bounce").

    PHASE 3: DEEPSEEK RED TEAMING (LOGIC STRESS TEST)
    - SIMULATE DeepSeek R1: Act as a harsh critic. Try to debunk the Bullish/Bearish thesis.
    - Look for traps: Bull Traps, Bear Traps, Fakeouts.
    - Output this debate in the "deepSeekReasoning" field (Terminal style text in CHINESE).
    - Start the text with "DeepSeek R1 逻辑推演:"

    PHASE 4: RISK MODELING (ATR Based)
    - Calculate Entry, Take Profit, and Stop Loss using volatility (ATR logic).
    - Ensure Risk/Reward is > 1.5.
    - Stop Loss must be placed at invalidation points (below support/above resistance).

    PHASE 5: COUNCIL OF MASTERS
    - Simulate: Jesse Livermore (Trend), George Soros (Reflexivity), Warren Buffett (Value), Jim Simons (Quant).
    - Get their verdict (看多/看空/观望) and a short quote.

    RETURN JSON STRUCTURE (Mandatory Fields):
    {
      "signal": "BUY" | "SELL" | "NEUTRAL",
      "realTimePrice": number, (The price you found)
      "winRate": number, (0-100, be conservative)
      "historicalWinRate": number, (Estimated win rate of this specific pattern historically)
      "entryPrice": number,
      "takeProfit": number,
      "stopLoss": number,
      "supportLevel": number, (Key Support)
      "resistanceLevel": number, (Key Resistance)
      "riskRewardRatio": number,
      "reasoning": "Synthesized conclusion in Chinese...",
      "volatilityAssessment": "High" | "Moderate" | "Low",
      "strategyMatch": "Strategy Name (e.g. Golden Cross)",
      "marketStructure": "Bullish Structure" | "Bearish Structure" | "Ranging" | "Breakout",
      "keyFactors": ["Factor 1", "Factor 2", ...],
      "kLineTrend": "Description of K-line behavior in Chinese",
      "guruInsights": [
         { "name": "Jesse Livermore", "style": "Trend Follower", "verdict": "看多", "quote": "..." },
         ... other gurus
      ],
      "deepSeekReasoning": "DeepSeek R1 逻辑推演:\n> 正在分析市场结构...\n> 检测到潜在弱点...\n> 最终结论: ...",
      "modelFusionConfidence": number, (0-100),
      "futurePrediction": {
         "targetHigh": number,
         "targetLow": number,
         "confidence": number,
         "predictionPeriod": "${horizon}"
      }
    }
  `;

  // Fallback Logic for Quota Exceeded or Errors
  const runAnalysis = async (model: string, useSearch: boolean) => {
      const config = {
        systemInstruction,
        safetySettings: [
             { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
             { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
             { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
             { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
        tools: useSearch ? [{ googleSearch: {} }] : []
      };

      return await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: config
      });
  };

  try {
    // Attempt 1: Gemini 3 Pro with Search
    const response = await runAnalysis('gemini-3-pro-preview', true);
    const data = cleanAndParseJSON(response.text || "{}");
    return validateAndFillData(data, timeframe, data.realTimePrice || 0);

  } catch (error: any) {
    console.warn("Primary Analysis Failed. Retrying with Fallback...", error.message);
    
    // Check for Quota Limit
    const isQuota = error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED');

    try {
        // Attempt 2: Gemini 2.5 Flash (If Pro failed or Quota)
        // If quota exceeded on Pro, Flash might still work or share quota? 
        // If Grounding Quota exceeded, we must DISABLE search.
        const disableSearch = isQuota; 
        const modelToUse = 'gemini-2.5-flash';
        
        // If search disabled, we rely on prompt instructions to handle missing price or data gracefully
        // The prompt will try to execute logic based on general knowledge if possible, or fail gracefully
        
        const response = await runAnalysis(modelToUse, !disableSearch);
        const data = cleanAndParseJSON(response.text || "{}");
        return validateAndFillData(data, timeframe, data.realTimePrice || 0);

    } catch (fallbackError: any) {
        console.error("All Analysis attempts failed.", fallbackError);
        throw new Error(isQuota ? "分析服务暂时不可用 (Quota Exceeded). 请稍后再试。" : "AI 分析失败，请重试。");
    }
  }
};

/**
 * Performs a historical backtest strategy simulation using Gemini 3 Pro.
 */
export const performBacktest = async (
  symbol: string, 
  strategy: BacktestStrategy, 
  period: BacktestPeriod
): Promise<BacktestResult> => {
  const ai = initAI();
  if (!ai) throw new Error("API Key not configured");

  const prompt = `
    Role: Senior Quantitative Researcher.
    Task: Perform a historical backtest simulation for ${symbol}.
    Strategy: ${strategy}
    Period: ${period}
    
    Instructions:
    1. Search for historical price data and chart behavior of ${symbol} over the last ${period}.
    2. Identify key moments where the strategy "${strategy}" would have triggered.
    3. Calculate the hypothetical Win Rate and Profit Factor based on these triggers.
    4. Provide a description of the "Equity Curve" (e.g., "Steady growth with minor drawdowns").
    5. Identify the Best and Worst hypothetical trades.
    6. Output all text fields in CHINESE (中文).
    
    Output JSON format:
    {
      "strategyName": "${strategy}",
      "period": "${period}",
      "totalTrades": number,
      "winRate": number, (percentage)
      "profitFactor": number, (e.g. 1.5)
      "netProfit": "string", (e.g. "+12.5%")
      "bestTrade": "string description in Chinese",
      "worstTrade": "string description in Chinese",
      "equityCurveDescription": "string in Chinese",
      "insights": "Deep analysis of why it worked or failed in Chinese"
    }
  `;

  try {
     const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }],
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            ]
        }
     });

     return cleanAndParseJSON(response.text || "{}");
  } catch (error: any) {
      console.error("Backtest Failed", error);
      
      // Fallback for Backtest
       try {
         const aiFlash = initAI();
         if(!aiFlash) throw new Error("No API");
         const response = await aiFlash.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }]
            }
         });
         return cleanAndParseJSON(response.text || "{}");
      } catch (e) {
          throw new Error("Backtest simulation failed.");
      }
  }
};
