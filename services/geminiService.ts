
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
       
       Mapping Rules for CHINA/HK STOCKS (Important):
       - If input is 6 digits starting with '6' (e.g., 600519) -> Use "SSE:6xxxxx" (Shanghai).
       - If input is 6 digits starting with '0' or '3' (e.g., 000001, 300059) -> Use "SZSE:xxxxxx" (Shenzhen).
       - If input is 4-5 digits (e.g., 700, 00700) -> Use "HKEX:00700" (Hong Kong).
       
       Other Examples: "NASDAQ:AAPL", "NYSE:BA", "OANDA:XAUUSD".

    4. Return the full official company/asset name.
    5. Return the approximate current price if found (number only), otherwise 0.
    
    IMPORTANT: 
    - If the user types "XAUUSD" or "Gold", return a valid forex/commodity ticker like "OANDA:XAUUSD" or "TVC:GOLD".
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
        if (data.symbol.match(/^[0-9]{6}$/)) {
            // Fix for raw China codes returned without exchange
            if (data.symbol.startsWith('6')) data.symbol = `SSE:${data.symbol}`;
            else data.symbol = `SZSE:${data.symbol}`;
        } else if (data.symbol.match(/^[A-Z]{3,5}$/)) {
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
        
        // China A-Shares Heuristics (Fix for 1D limit issue - Need correct exchange)
        else if (/^[0-9]{6}$/.test(cleanQuery)) {
            if (cleanQuery.startsWith('6')) {
                cleanQuery = `SSE:${cleanQuery}`; // Shanghai
            } else {
                cleanQuery = `SZSE:${cleanQuery}`; // Shenzhen (starts with 0 or 3)
            }
        }
        else if (/^[0-9]{4,5}$/.test(cleanQuery)) {
            // Hong Kong
            cleanQuery = `HKEX:${cleanQuery.padStart(5, '0')}`; 
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

// Helper to determine the "Higher Timeframe" for resonance check
const getHigherTimeframe = (tf: Timeframe): string => {
    switch (tf) {
        case Timeframe.M1:
        case Timeframe.M3:
        case Timeframe.M5: return "1 Hour Chart"; // Scalping checks H1
        case Timeframe.M15:
        case Timeframe.M30: return "4 Hour Chart"; // Intraday checks H4
        case Timeframe.H1:
        case Timeframe.H2:
        case Timeframe.H4: return "Daily Chart"; // Swing checks Daily
        case Timeframe.D1: return "Weekly Chart"; // Position checks Weekly
        default: return "Daily Chart";
    }
};

const validateAndFillData = (data: any, timeframe: Timeframe, realTimePrice: number): RealTimeAnalysis => {
    // If AI returned 0 or null for price, fallback to reference
    const finalPrice = (data.realTimePrice && data.realTimePrice > 0) ? data.realTimePrice : realTimePrice;

    // Basic defaults if AI fails to return some fields
    const defaultData: RealTimeAnalysis = {
        signal: SignalType.NEUTRAL,
        winRate: 50,
        historicalWinRate: 50,
        entryPrice: finalPrice,
        entryStrategy: "观望 (Wait)", // Default strategy
        takeProfit: finalPrice * 1.01,
        stopLoss: finalPrice * 0.99,
        supportLevel: finalPrice * 0.98,
        resistanceLevel: finalPrice * 1.02,
        riskRewardRatio: 1.5,
        reasoning: "Data analysis incomplete. Displaying price anchor defaults.",
        volatilityAssessment: "Moderate",
        strategyMatch: "Price Action",
        marketStructure: "Ranging/Consolidation",
        keyFactors: ["Price Anchor"],
        kLineTrend: "Neutral consolidation detected.",
        trendResonance: "分析不足 (Insufficient Data)", // NEW Default
        guruInsights: [],
        deepSeekReasoning: "DeepSeek 逻辑推演:\n> 等待数据输入...\n> 逻辑验证挂起...",
        modelFusionConfidence: 50,
        futurePrediction: {
            targetHigh: finalPrice * 1.01,
            targetLow: finalPrice * 0.99,
            confidence: 50,
            predictionPeriod: getPredictionHorizon(timeframe)
        },
        realTimePrice: finalPrice
    };

    return { ...defaultData, ...data, realTimePrice: finalPrice }; 
};

export const analyzeMarketData = async (symbol: string, timeframe: Timeframe, referencePrice: number): Promise<RealTimeAnalysis> => {
  const ai = initAI();
  if (!ai) throw new Error("API Key not configured");

  const horizon = getPredictionHorizon(timeframe);
  const higherTF = getHigherTimeframe(timeframe);

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
    
    *** CRITICAL: PRICE ANCHOR PROTOCOL ***
    1. Search for the LIVE REAL-TIME PRICE of ${symbol}.
    2. If Google Search fails or returns old data, use this REFERENCE PRICE: ${referencePrice}.
    3. ALL CALCULATIONS (Entry, TP, SL, Support, Resistance) MUST be mathematically relative to the final "Price Anchor" you decide on.
    4. DO NOT hallucinate prices. If ${symbol} is trading at 100, do not predict 2000.

    PHASE 1: GLOBAL INTELLIGENCE MINING (Wide Mining & Refining)
    - Search for the REAL-TIME PRICE of ${symbol}.
    - Search for Chart Patterns on BOTH:
      1. Current Timeframe: ${timeframe} (Execution)
      2. Higher Timeframe: ${higherTF} (Trend Bias)
    - Mining: Scan Macro, Sector, and Asset-specific news.
    - Distillation: Filter out noise. Keep only TOP 3 DIRECT CATALYSTS.

    PHASE 2: MARKET STRUCTURE MAPPING & MTF RESONANCE (Critical)
    - Identify Structure on ${timeframe}: HH/HL (Bull) or LH/LL (Bear).
    - Identify Structure on ${higherTF}: Is the major trend alignment with the minor trend?
    - **MTF RESONANCE RULE**: 
      - IF ${higherTF} is Bullish AND ${timeframe} is Bullish -> STRONG BUY SIGNAL.
      - IF ${higherTF} is Bearish AND ${timeframe} is Bullish -> WEAK/COUNTER-TREND (Reduce Win Rate).
      - Output the status in "trendResonance" field (e.g., "H4 Bull + 15m Bull = Full Resonance").

    PHASE 3: DEEPSEEK RED TEAMING (LOGIC STRESS TEST & REPAIR)
    - SIMULATE DeepSeek R1: Act as a harsh critic.
    - LOOP:
      1. Gemini proposes a plan (e.g. Buy @ X).
      2. DeepSeek attacks it (e.g. "Too close to resistance").
      3. Gemini *MODIFIES* the plan based on the attack (e.g. "Lower TP to Y").
    - Output the final refined logic in "deepSeekReasoning".

    PHASE 4: RISK MODELING & EXECUTION
    - Phase 4.1 ENTRY STRATEGY: 
      - Determine: "现价进场 (Market)", "回调做多 (Limit Buy)", "反弹做空 (Limit Sell)", or "突破进场 (Stop Entry)".
      - Note: If resonance is weak, strictly suggest "Wait for Pullback".
    - Phase 4.2 RISK CALCULATION (ATR Based):
      - Calculate Entry, Take Profit, and Stop Loss using volatility.
      - Ensure Risk/Reward is > 1.5.

    PHASE 5: COUNCIL OF MASTERS (Dynamic)
    - For ${timeframe} (Short-term), use: ICT (Smart Money), Steve Cohen (Tape Reading), Al Brooks (Price Action), Jim Simons (Quant).
    - For ${timeframe} (Long-term > H4), use: Livermore, Soros, Buffett.

    RETURN JSON STRUCTURE (Mandatory Fields):
    {
      "signal": "BUY" | "SELL" | "NEUTRAL",
      "realTimePrice": number, 
      "winRate": number, (0-100, Penalize if MTF Resonance is weak)
      "historicalWinRate": number, 
      "entryPrice": number, 
      "entryStrategy": "String description (e.g. '回调至 Support 做多')",
      "takeProfit": number,
      "stopLoss": number,
      "supportLevel": number,
      "resistanceLevel": number,
      "riskRewardRatio": number,
      "reasoning": "Synthesized conclusion in Chinese...",
      "volatilityAssessment": "High" | "Moderate" | "Low",
      "strategyMatch": "Strategy Name (e.g. ICT Order Block)",
      "marketStructure": "Bullish Structure" | "Bearish Structure" | "Ranging",
      "keyFactors": ["Factor 1", "Factor 2", ...],
      "kLineTrend": "Description of K-line behavior in Chinese",
      "trendResonance": "String description of Multi-Timeframe status", 
      "guruInsights": [ ... ],
      "deepSeekReasoning": "DeepSeek R1 逻辑推演:\n> 趋势共振检查: ...\n> 逻辑漏洞修正: ...\n> 最终结论: ...",
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
    return validateAndFillData(data, timeframe, data.realTimePrice || referencePrice);

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
        return validateAndFillData(data, timeframe, data.realTimePrice || referencePrice);

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
  
  // Backtest Prompt remains focused on strategy simulation
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
