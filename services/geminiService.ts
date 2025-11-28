
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
    
    // Prepare Tactical Playbook for the AI (Translated to ensure Chinese context)
    const strategyPlaybook = STRATEGIES.map(s => `[${s.name}]: ${s.description}\n规则要点: ${s.promptContent}`).join('\n\n');

    // ------------------------------------------------------------------
    // COUNCIL OF MASTERS: DEFINING THE DEBATE PROTOCOL (LOCALIZED CHINESE)
    // ------------------------------------------------------------------
    
    let personaPrompt = "";
    let searchInstructions = "";

    if (isAShare) {
        // A-Share: Focus on Hot Money (Youzi), Main Force (Zhulij), and Policy
        personaPrompt = `
          针对 A股 (${symbol}) 的【大师议事会】成员:
          1. [游资大佬]: 关注“龙虎榜”、连板高度、市场合力和妖股反包。语言风格：激进、短线、情绪化。
          2. [主力追踪]: 紧盯“北向资金”、主力净流入、机构大单。语言风格：客观、数据导向、看重筹码。
          3. [基本面老手]: 关注市盈率(PE)、财报业绩、行业政策风口。语言风格：稳健、长线、价值投资。
          4. [风控官]: 寻找顶背离、高位滞涨、监管利空信号。语言风格：悲观、谨慎、风险厌恶。
        `;
        searchInstructions = `
          MANDATORY SEARCH QUERIES (EXECUTE THESE EXACTLY):
          1. "东方财富 ${symbol} 资金流向 主力净流入 KDJ指标"
          2. "同花顺 ${symbol} 龙虎榜数据 均线排列 成交量分析"
          3. "雪球 ${symbol} 讨论区 热门观点 MACD金叉 量能"
          4. "新浪财经 ${symbol} 所属板块 政策利好 KDJ"
        `;
    } else if (isCrypto) {
        // Crypto: Focus on On-Chain, Funding Rates, Liquidation
        personaPrompt = `
          针对 加密货币 (${symbol}) 的【大师议事会】成员:
          1. [链上侦探]: 检查活跃地址数、交易所净流入、鲸鱼钱包动向。语言风格：技术流、数据敏感。
          2. [合约猎手]: 分析资金费率(Funding Rate)、持仓量(OI)、爆仓清算图。寻找轧空机会。
          3. [图表信徒]: 使用 SMC (聪明钱概念)、FVG、RSI 背离、KDJ 金叉。语言风格：纯技术分析。
          4. [宏观叙事]: 关注比特币市占率、ETF 资金流向、美联储政策。语言风格：宏观大局。
        `;
        searchInstructions = `
          MANDATORY SEARCH QUERIES:
          1. "${symbol} funding rate coinglass open interest rsi kdj"
          2. "${symbol} liquidation heatmap today technical analysis volume"
          3. "${symbol} token unlock schedule or whale alert net inflow"
          4. "Crypto twitter sentiment ${symbol} market structure kdj"
        `;
    } else {
        // US Stocks: Wall St, Options, Earnings
        personaPrompt = `
          针对 美股 (${symbol}) 的【大师议事会】成员:
          1. [华尔街内幕]: 检查 13F 披露、暗池交易(Dark Pool)、内部人买卖。
          2. [期权巨鲸]: 分析“异动期权”(Unusual Whales)、Put/Call 比例、Gamma 曝露。
          3. [量化技术派]: 关注 RSI 水平、VWAP 回归、KDJ 状态、MACD 动能。
          4. [宏观对冲]: 关注美债收益率、美联储讲话、板块轮动。
        `;
        searchInstructions = `
          MANDATORY SEARCH QUERIES:
          1. "${symbol} unusual options activity today RSI KDJ value"
          2. "${symbol} analyst price target upgrades technical indicators volume"
          3. "${symbol} institutional ownership change recent net inflow"
          4. "${symbol} technical analysis tradingview ideas MACD KDJ"
        `;
    }

    const systemPrompt = `
      You are TradeGuard Pro, executing the "Council of Masters" protocol.
      
      OBJECTIVE:
      Synthesize a trading decision by orchestrating a debate between the 4 COUNCIL MEMBERS defined below.
      
      ${personaPrompt}

      TACTICAL PLAYBOOK (AVAILABLE STRATEGIES):
      ${strategyPlaybook}
      
      RULES:
      1. NO SIMULATION. Use REAL-TIME data from Google Search. If data is conflicting, acknowledge the conflict.
      2. BE DECISIVE. The "Signal" must reflect the winner of the debate.
      3. LANGUAGE: **ALL output fields MUST be in Simplified Chinese (简体中文).** This is critical.
      4. LOGIC: You MUST explicitly calculate the "Score Drivers" to explain the win rate.
      5. TECHNICALS: You MUST find or estimate KDJ (Stochastics) and Volume status.
      
      Current Market Context:
      - Asset: ${symbol}
      - Price Anchor: ${currentPrice} (Use this for technical level calculation)
      - Timeframe: ${timeframe}
      
      Output JSON Schema:
      {
        "signal": "BUY" | "SELL" | "NEUTRAL",
        "realTimePrice": number,
        "scoreDrivers": {
            "technical": number, // 0-100 Score. Based on Indicators (RSI, KDJ, MACD).
            "institutional": number, // 0-100 Score. Based on Net Flow, Options, Whales.
            "sentiment": number, // 0-100 Score. Based on News, Social Media.
            "macro": number // 0-100 Score. Based on Sector, Policy, Broad Market.
        },
        "winRate": number, // CALCULATED AS: (Technical*0.4 + Institutional*0.3 + Sentiment*0.2 + Macro*0.1). Round to integer.
        "historicalWinRate": number, 
        "entryPrice": number,
        "entryStrategy": "string (Short Chinese name of the setup)",
        "takeProfit": number,
        "stopLoss": number,
        "supportLevel": number,
        "resistanceLevel": number,
        "riskRewardRatio": number,
        "reasoning": "string (Summary of the Council's final decision in Chinese. Explain WHY the score is what it is.)",
        "volatilityAssessment": "string (e.g., 高波动/低波动)",
        "strategyMatch": "string",
        "marketStructure": "string (e.g., 多头趋势/空头趋势/震荡)",
        "marketRegime": {
            "macroTrend": "string",
            "sectorPerformance": "string",
            "institutionalAction": "string"
        },
        "technicalIndicators": {
            "rsi": number, 
            "macdStatus": "string (金叉/死叉/背离/中性)",
            "emaAlignment": "string (多头排列/空头排列/纠缠)",
            "bollingerStatus": "string (收口/开口/触顶/触底)",
            "kdjStatus": "string (e.g. 金叉/死叉/超买/超卖)",
            "volumeStatus": "string (e.g. 底部放量/缩量回调/天量见顶)"
        },
        "institutionalData": {
            "netInflow": "string (e.g., '+2.5亿' or '-500万')",
            "blockTrades": "string (高活跃/中等/低迷)",
            "mainForceSentiment": "string (积极抢筹/被动出货/观望)"
        },
        "redTeamingLogic": "string (STRICT FORMAT: '⚠️ 风险揭示:\\n... 🛡️ 应对策略:\\n...')",
        "modelFusionConfidence": number, 
        "guruInsights": [
             { "name": "Council Member 1 Name", "style": "Role", "verdict": "看多/看空", "quote": "Insight in Chinese" },
             { "name": "Council Member 2 Name", "style": "Role", "verdict": "看多/看空", "quote": "Insight in Chinese" },
             { "name": "Council Member 3 Name", "style": "Role", "verdict": "看多/看空", "quote": "Insight in Chinese" },
             { "name": "Council Member 4 Name", "style": "Role", "verdict": "看多/看空", "quote": "Insight in Chinese" }
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
      
      Task:
      1. Search for PRICE ACTION and TECHNICALS (RSI, KDJ, MACD, Volume).
      2. Search for INSTITUTIONAL FLOW (Net Inflow, Block Trades, Options).
      3. EVALUATE & SCORE: Calculate 0-100 scores for Technical, Institutional, Sentiment, and Macro.
      4. DEBATE: Weigh Bullish vs Bearish evidence in CHINESE.
      5. GENERATE JSON Response with specific 'scoreDrivers'.
      
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
        data.modelFusionConfidence = data.modelFusionConfidence || 70;
        
        // If scoreDrivers are missing, synthesize them (Fallback for structure safety)
        if (!data.scoreDrivers) {
            const baseScore = data.winRate || 50;
            data.scoreDrivers = {
                technical: baseScore,
                institutional: baseScore,
                sentiment: baseScore,
                macro: baseScore
            };
        }
        
        // Recalculate WinRate if drivers exist to ensure consistency
        if (data.scoreDrivers) {
            const { technical, institutional, sentiment, macro } = data.scoreDrivers;
            const weighted = (technical * 0.4) + (institutional * 0.3) + (sentiment * 0.2) + (macro * 0.1);
            data.winRate = Math.round(weighted);
        } else {
            data.winRate = data.winRate || 50;
        }

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
