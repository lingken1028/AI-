
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
    
    // Prepare Tactical Playbook for the AI (Translated to ensure Chinese context)
    const strategyPlaybook = STRATEGIES.map(s => `[${s.name}]: ${s.description}\n规则要点: ${s.promptContent}`).join('\n\n');

    // ------------------------------------------------------------------
    // COUNCIL OF MASTERS: DEFINING THE DEBATE PROTOCOL (LOCALIZED CHINESE)
    // ------------------------------------------------------------------
    
    let personaPrompt = "";
    let searchInstructions = "";

    const tfContext = timeframe === Timeframe.D1 ? "日线" : `${timeframe}级别`; 
    const tfSearch = timeframe === Timeframe.D1 ? "daily chart" : `${timeframe} chart`;

    if (isAShare) {
        personaPrompt = `
          针对 A股 (${symbol}) 的【大师议事会】成员:
          1. [游资大佬]: 关注“龙虎榜”、连板高度、市场合力。
          2. [风控官 (红队)]: 寻找监管利空、高位滞涨信号。
          3. [策略架构师]: 定义具体的买入条件和止损规则。
        `;
        searchInstructions = `
          MANDATORY SEARCH QUERIES (BLIND/HYBRID MODE):
          1. "东方财富 ${symbol} 资金流向 ${tfContext} 主力净流入"
          2. "同花顺 ${symbol} KDJ数值 MACD金叉死叉 ${tfContext}"
          3. "新浪财经 ${symbol} ${tfContext} 技术面分析"
        `;
    } else if (isCrypto) {
        personaPrompt = `
          针对 加密货币 (${symbol}) 的【大师议事会】成员:
          1. [合约猎手]: 分析资金费率(Funding Rate)、持仓量(OI)。
          2. [红队黑客]: 寻找链上清算聚集点、负面宏观消息。
          3. [策略架构师]: 定义精确的入场触发器（如突破FVG）。
        `;
        searchInstructions = `
          MANDATORY SEARCH QUERIES (BLIND/HYBRID MODE):
          1. "${symbol} funding rate open interest ${tfSearch} current"
          2. "${symbol} RSI KDJ indicator values ${tfSearch} today"
          3. "${symbol} liquidation levels heatmap"
        `;
    } else {
        personaPrompt = `
          针对 美股 (${symbol}) 的【大师议事会】成员:
          1. [华尔街内幕]: 检查 13F、暗池交易。
          2. [红队审计]: 寻找财报雷区、宏观加息风险。
          3. [策略架构师]: 定义趋势跟踪或反转的确认信号。
        `;
        searchInstructions = `
          MANDATORY SEARCH QUERIES (BLIND/HYBRID MODE):
          1. "${symbol} unusual options activity today RSI value ${tfSearch}"
          2. "${symbol} MACD histogram status KDJ ${tfSearch}"
          3. "${symbol} institutional net inflow current data"
        `;
    }

    const systemPrompt = `
      You are TradeGuard Pro, executing the "Council of Masters" protocol.
      
      OBJECTIVE: Synthesize a professional trading decision with STRICT LOGIC and ADVERSARIAL TESTING.
      
      DATA SOURCE PROTOCOL:
      - IMAGE PROVIDED: ${!!imageBase64}
      - **TIMEFRAME ALIGNMENT**: The user is looking at the **${timeframe}** chart.
      - **HYBRID MODE**: Even if an image is provided, YOU MUST EXECUTE GOOGLE SEARCHES to find the exact numeric values of indicators.
      
      ${personaPrompt}

      RULES:
      1. **SCENARIO DEDUCTION**: Mathematically deduce 3 scenarios (Bull/Bear/Neutral).
      2. **RED TEAMING (CRITIC)**: You must act as a hostile critic. Find flaws. 
         - **Stress Test**: What if Bitcoin drops 5%? What if earnings miss?
         - **Severity**: Assign a risk level.
      3. **TRADING BLUEPRINT (ARCHITECT)**: Do not just give a signal. Define the RULES.
         - **Triggers**: Specific conditions (e.g. "Close > EMA20").
         - **Invalidation**: Precise stop condition (e.g. "Close < Support").
      4. LANGUAGE: **Simplified Chinese (简体中文)**.
      
      Current Market Context:
      - Asset: ${symbol}
      - Price Anchor: ${currentPrice}
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
        "entryStrategy": "string (Short Name)",
        "takeProfit": number,
        "stopLoss": number,
        "supportLevel": number,
        "resistanceLevel": number,
        "riskRewardRatio": number,
        "reasoning": "string (Executive Summary)",
        "volatilityAssessment": "string",
        "strategyMatch": "string",
        "marketStructure": "string",
        "technicalIndicators": {
            "rsi": number, "macdStatus": "string", "emaAlignment": "string", "bollingerStatus": "string", "kdjStatus": "string", "volumeStatus": "string"
        },
        "institutionalData": {
            "netInflow": "string", "blockTrades": "string", "mainForceSentiment": "string"
        },
        "scenarios": {
            "bullish": { "probability": number, "targetPrice": number, "description": "string" },
            "bearish": { "probability": number, "targetPrice": number, "description": "string" },
            "neutral": { "probability": number, "targetPrice": number, "description": "string" }
        },
        "redTeaming": {
            "risks": ["string", "string"],
            "mitigations": ["string"],
            "stressTest": "string (e.g., '如果大盘暴跌 3%...')",
            "severity": "CRITICAL" | "HIGH" | "MODERATE" | "LOW"
        },
        "tradingSetup": {
            "setupName": "string (e.g., 'Wyckoff Spring')",
            "confirmationTriggers": ["string (e.g., 'Volume > 2x')", "string"],
            "invalidationCriteria": "string (Strict rule to cancel trade)"
        },
        "modelFusionConfidence": number, 
        "guruInsights": [
             { "name": "Name", "style": "Role", "verdict": "看多/看空", "quote": "Insight" }
        ],
        "futurePrediction": {
             "targetHigh": number, "targetLow": number, "confidence": number, "predictionPeriod": "${horizon}"
        }
      }
    `;

    const userPromptText = `
      Execute Council of Masters Protocol for ${symbol} on ${timeframe}.
      ${searchInstructions}
      
      Task:
      ${imageBase64 ? `0. HYBRID ANALYSIS: The attached image is the **${timeframe}** Chart. Cross-reference visible patterns with search data.` : '0. BLIND ANALYSIS: Rely on search data.'}
      1. **CALCULATE** Score Drivers (Tech/Inst/Sent/Macro).
      2. **DEDUCE** Scenarios.
      3. **RED TEAM** the thesis (Find risks).
      4. **DEFINE** the Trading Blueprint (Triggers/Invalidation).
      
      Reference Price: ${currentPrice}
      RETURN JSON ONLY.
    `;

    const requestContents: any = {
      model: imageBase64 ? 'gemini-3-pro-image-preview' : 'gemini-3-pro-preview', 
      config: {
          systemInstruction: systemPrompt,
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json" 
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

        // Fallbacks
        data.modelFusionConfidence = data.modelFusionConfidence || 70;
        
        if (!data.scoreDrivers) {
            const baseScore = data.winRate || 50;
            data.scoreDrivers = { technical: baseScore, institutional: baseScore, sentiment: baseScore, macro: baseScore };
        }
        
        if (data.scoreDrivers) {
            const { technical, institutional, sentiment, macro } = data.scoreDrivers;
            const weighted = (technical * 0.4) + (institutional * 0.3) + (sentiment * 0.2) + (macro * 0.1);
            data.winRate = Math.round(weighted);
        }

        // Parse Numbers
        const numFields = ['realTimePrice', 'entryPrice', 'takeProfit', 'stopLoss', 'supportLevel', 'resistanceLevel'];
        numFields.forEach(f => data[f] = parsePrice(data[f]));
        
        if (data.futurePrediction) {
            data.futurePrediction.targetHigh = parsePrice(data.futurePrediction.targetHigh);
            data.futurePrediction.targetLow = parsePrice(data.futurePrediction.targetLow);
        }
        
        if (data.scenarios) {
            data.scenarios.bullish.targetPrice = parsePrice(data.scenarios.bullish.targetPrice);
            data.scenarios.bearish.targetPrice = parsePrice(data.scenarios.bearish.targetPrice);
            data.scenarios.neutral.targetPrice = parsePrice(data.scenarios.neutral.targetPrice);
        }

        // Structural Fallbacks
        if (!data.redTeaming) {
            data.redTeaming = {
                risks: ["General Market Volatility"],
                mitigations: ["Use Stop Loss"],
                stressTest: "Market Crash Scenario",
                severity: "MODERATE"
            };
        }
        if (!data.tradingSetup) {
             data.tradingSetup = {
                setupName: "Standard Trend Follow",
                confirmationTriggers: ["Price > EMA"],
                invalidationCriteria: "Price < Support"
             };
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
