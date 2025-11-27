
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

export const analyzeMarketData = async (symbol: string, timeframe: Timeframe, currentPrice: number): Promise<RealTimeAnalysis> => {
    const ai = initAI();
    if (!ai) throw new Error("API Key not configured");

    const horizon = getPredictionHorizon(timeframe);
    
    // Asset Classification
    const isAShare = symbol.startsWith('SSE') || symbol.startsWith('SZSE');
    const isCrypto = symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('USDT') || symbol.includes('SOL') || symbol.includes('BINANCE');
    const isForex = symbol.includes('XAU') || symbol.includes('EUR') || symbol.includes('USDJPY') || symbol.startsWith('FX:') || symbol.startsWith('OANDA:');
    
    // Prepare Tactical Playbook for the AI
    const strategyPlaybook = STRATEGIES.map(s => `[${s.name.toUpperCase()}]: ${s.description}\nRules: ${s.promptContent}`).join('\n\n');

    // ------------------------------------------------------------------
    // COUNCIL OF MASTERS: DEFINING THE DEBATE PROTOCOL
    // ------------------------------------------------------------------
    
    let personaPrompt = "";
    let searchInstructions = "";

    if (isAShare) {
        // A-Share: Focus on Hot Money (Youzi), Main Force (Zhulij), and Policy
        personaPrompt = `
          COUNCIL MEMBERS FOR A-SHARE (${symbol}):
          1. [游资大佬 (Hot Money Hunter)]: Obsessed with "Dragon Tiger List" (龙虎榜), limit-up streaks (连板), and market sentiment. Looking for explosive momentum.
          2. [主力追踪 (Smart Money Tracker)]: Analyzes "Northbound Capital" (北向资金) and Main Force Net Inflow/Outflow. Ignores noise, follows big money.
          3. [基本面老手 (Value Investor)]: Checks PE/PB, earnings reports, and sector logic. Skeptical of hype.
          4. [空头警报 (Risk Control)]: Looks for top divergence, high-level cashing out, or regulatory warnings.
        `;
        searchInstructions = `
          MANDATORY SEARCH QUERIES (EXECUTE THESE EXACTLY):
          1. "东方财富 ${symbol} 资金流向 主力净流入 今日"
          2. "同花顺 ${symbol} 龙虎榜数据"
          3. "雪球 ${symbol} 讨论区 热门观点"
          4. "新浪财经 ${symbol} 所属板块 政策利好"
        `;
    } else if (isCrypto) {
        // Crypto: Focus on On-Chain, Funding Rates, Liquidation
        personaPrompt = `
          COUNCIL MEMBERS FOR CRYPTO (${symbol}):
          1. [链上侦探 (On-Chain Analyst)]: Checks Active Addresses, Exchange Netflow, and Whale wallet movements.
          2. [合约猎手 (Derivatives Trader)]: Analyzes Funding Rates, Open Interest (OI), and Liquidation Maps. Looking for short squeezes.
          3. [技术信仰者 (Pure Chartist)]: Uses SMC (Smart Money Concepts), FVG, and Order Blocks.
          4. [宏观叙事 (Macro Narrative)]: Watches BTC dominance, ETF flows, and correlation with Nasdaq/DXY.
        `;
        searchInstructions = `
          MANDATORY SEARCH QUERIES:
          1. "${symbol} funding rate coinglass open interest"
          2. "${symbol} liquidation heatmap today"
          3. "${symbol} token unlock schedule or whale alert"
          4. "Crypto twitter sentiment ${symbol}"
        `;
    } else {
        // US Stocks: Wall St, Options, Earnings
        personaPrompt = `
          COUNCIL MEMBERS FOR US STOCK (${symbol}):
          1. [华尔街内幕 (Institutional Insider)]: Checks 13F filings, Dark Pool prints, and Insider Buying/Selling.
          2. [期权巨鲸 (Gamma Scalper)]: Analyzes "Unusual Whales", Put/Call Ratio, and Gamma Exposure.
          3. [量化技术派 (Algo Quant)]: Looks for VWAP reclamation, Key Gamma Levels, and Volatility contraction.
          4. [宏观对冲 (Global Macro)]: Watches Yields, Fed Speak, and Sector Rotation.
        `;
        searchInstructions = `
          MANDATORY SEARCH QUERIES:
          1. "${symbol} unusual options activity today"
          2. "${symbol} analyst price target upgrades seekingalpha"
          3. "${symbol} institutional ownership change recent"
          4. "${symbol} technical analysis tradingview ideas"
        `;
    }

    const systemPrompt = `
      You are TradeGuard Pro, executing the "Council of Masters" protocol.
      You are NOT a passive reporter. You are the chairperson of a high-stakes trading debate.
      
      OBJECTIVE:
      Synthesize a trading decision by orchestrating a debate between the 4 COUNCIL MEMBERS defined below.
      
      ${personaPrompt}

      TACTICAL PLAYBOOK (AVAILABLE STRATEGIES):
      ${strategyPlaybook}
      
      RULES:
      1. NO SIMULATION. Use REAL-TIME data from Google Search. If data is conflicting, acknowledge the conflict.
      2. BE DECISIVE. The "Signal" must reflect the winner of the debate.
      3. LANGUAGE: All output fields MUST be in Simplified Chinese (简体中文), except for standard technical terms (SMC, RSI, MACD).
      4. "strategyMatch": MUST be chosen from the TACTICAL PLAYBOOK above. If none fit perfectly, choose the closest or "Generic Trend Follow".
      5. "guruInsights": Map the 4 Council Members to this array. Each 'quote' must be a sharp, specific insight derived from search results (e.g., "主力今日净流出5亿", "Funding rate negative, squeeze imminent").
      
      Current Market Context:
      - Asset: ${symbol}
      - Price Anchor: ${currentPrice} (Use this for technical level calculation)
      - Timeframe: ${timeframe}
      
      Output JSON Schema:
      {
        "signal": "BUY" | "SELL" | "NEUTRAL",
        "realTimePrice": number,
        "winRate": number, // 0-100, based on consensus strength
        "historicalWinRate": number, // Estimated from similar setups
        "entryPrice": number,
        "entryStrategy": "string (e.g., 回踩 152.50 确认支撑)",
        "takeProfit": number,
        "stopLoss": number,
        "supportLevel": number,
        "resistanceLevel": number,
        "riskRewardRatio": number,
        "reasoning": "string (Summary of the Council's final decision)",
        "volatilityAssessment": "string (e.g., ATR High, Expect Turbulence)",
        "strategyMatch": "string (NAME of the strategy from Playbook)",
        "marketStructure": "string (e.g., Bullish MSS Confirmed)",
        "marketRegime": {
            "macroTrend": "string (Risk-On/Off)",
            "sectorPerformance": "string (Strong/Weak)",
            "institutionalAction": "string (Accumulation/Distribution)"
        },
        "redTeamingLogic": "string (STRICT FORMAT: '⚠️ RISKS:\\n- [Risk 1]\\n- [Risk 2]\\n🛡️ MITIGATIONS:\\n- [Mitigation 1]...')",
        "modelFusionConfidence": number, 
        "guruInsights": [
             { "name": "Council Member 1 Name", "style": "Role Description", "verdict": "看多/看空", "quote": "Specific data-driven insight" },
             { "name": "Council Member 2 Name", "style": "Role Description", "verdict": "看多/看空", "quote": "Specific data-driven insight" },
             { "name": "Council Member 3 Name", "style": "Role Description", "verdict": "看多/看空", "quote": "Specific data-driven insight" },
             { "name": "Council Member 4 Name", "style": "Role Description", "verdict": "看多/看空", "quote": "Specific data-driven insight" }
        ],
        "futurePrediction": {
             "targetHigh": number,
             "targetLow": number,
             "confidence": number,
             "predictionPeriod": "${horizon}"
        }
      }
    `;

    const userPrompt = `
      Execute Council of Masters Protocol for ${symbol}.
      
      ${searchInstructions}
      
      STEP 1: SEARCH. Gather data for each Council Member.
      STEP 2: DEBATE. Weigh Bullish vs Bearish evidence.
      STEP 3: MATCH STRATEGY. Compare current price action against the TACTICAL PLAYBOOK.
      STEP 4: DECIDE. Generate JSON output.
      
      Reference Price: ${currentPrice}
      
      RETURN JSON ONLY. NO MARKDOWN.
    `;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-pro-preview', 
            contents: userPrompt,
            config: {
                systemInstruction: systemPrompt,
                tools: [{ googleSearch: {} }],
                responseMimeType: "application/json"
            }
        });

        if (!result.text) throw new Error("No analysis generated");

        const data = cleanAndParseJSON(result.text);

        // Safety fallbacks
        data.winRate = data.winRate || 50;
        data.modelFusionConfidence = data.modelFusionConfidence || 70;
        
        // Robust number parsing
        data.realTimePrice = parsePrice(data.realTimePrice);
        data.entryPrice = parsePrice(data.entryPrice);
        data.takeProfit = parsePrice(data.takeProfit);
        data.stopLoss = parsePrice(data.stopLoss);
        data.supportLevel = parsePrice(data.supportLevel);
        data.resistanceLevel = parsePrice(data.resistanceLevel);
        
        if (data.futurePrediction) {
            data.futurePrediction.targetHigh = parsePrice(data.futurePrediction.targetHigh);
            data.futurePrediction.targetLow = parsePrice(data.futurePrediction.targetLow);
        }

        // Validate Signal
        if (!['BUY', 'SELL', 'NEUTRAL'].includes(data.signal)) {
            data.signal = SignalType.NEUTRAL;
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
