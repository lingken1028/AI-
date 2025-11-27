
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, GenerateContentResponse } from "@google/genai";
import { AIAnalysis, SignalType, Timeframe, StockSymbol, BacktestStrategy, BacktestPeriod, BacktestResult, GuruInsight, RealTimeAnalysis, MarketRegime } from "../types";
import { STRATEGIES } from "../constants";

const initAI = () => {
  if (!process.env.API_KEY) {
    console.error("API_KEY is missing from environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Helper: Timeout Wrapper
const withTimeout = <T>(promise: Promise<T>, ms: number, fallbackValue: T | null = null): Promise<T | null> => {
    return Promise.race([
        promise,
        new Promise<T | null>((_, reject) => 
            setTimeout(() => fallbackValue !== null ? _(fallbackValue) : reject(new Error("Timeout")), ms)
        )
    ]);
};

// Helper: robust JSON parsing
const cleanAndParseJSON = (text: string): any => {
    let cleanedText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
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

// Helper: Fallback Guru Generation based on Signal & Market
const generateFallbackGurus = (signal: SignalType, structure: string, timeframe: Timeframe, symbol: string = ""): GuruInsight[] => {
    const isBuy = signal === SignalType.BUY;
    const isSell = signal === SignalType.SELL;
    const isChinaMarket = symbol.startsWith('SSE') || symbol.startsWith('SZSE');
    const isCrypto = symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('USDT') || symbol.includes('SOL');
    const isShortTerm = [Timeframe.M1, Timeframe.M3, Timeframe.M5, Timeframe.M15, Timeframe.M30].includes(timeframe);

    if (isCrypto) {
        if (isBuy) {
            return [
                { name: "链上鲸鱼 (On-Chain)", style: "大户流向", verdict: "看多", quote: "交易所存量创近年来新低，巨鲸钱包持续吸筹，供应冲击即将到来。" },
                { name: "周期论者 (Cycle)", style: "减半周期", verdict: "看多", quote: "RSI 指标重置，目前处于牛市中继的黄金坑，适合定投。" },
                { name: "合约帝 (Derivatives)", style: "资金费率", verdict: "看多", quote: "Funding Rate 转负，空头过度拥挤，即将发生逼空 (Short Squeeze)。" },
                { name: "Satoshi G.", style: "信仰", verdict: "看多", quote: "Tick Tock, Next Block. 基本面哈希率持续新高。" }
            ];
        } else if (isSell) {
            return [
                { name: "链上鲸鱼 (On-Chain)", style: "大户流向", verdict: "看空", quote: "长期持有者 (LTH) 开始向交易所大额转账，派发迹象明显。" },
                { name: "技术图表 (Chart)", style: "形态学", verdict: "看空", quote: "日线级别顶背离，上方 2B 假突破，下方流动性待测试。" },
                { name: "合约帝 (Derivatives)", style: "多空比", verdict: "看空", quote: "多空比极高，费率爆表，典型的多头陷阱，谨防插针画门。" },
                { name: "宏观分析", style: "流动性", verdict: "看空", quote: "美元指数反弹，风险资产承压，流动性收紧。" }
            ];
        } else {
            return [
                { name: "PlanB", style: "S2F模型", verdict: "观望", quote: "价格处于模型波段中轨，方向不明，等待突破确认。" },
                { name: "合约帝", style: "数据", verdict: "观望", quote: "多空持仓平衡，未平仓合约 (OI) 波动不大，等待大波动。" },
                { name: "链上数据", style: "观察", verdict: "观望", quote: "活跃地址数持平，缺乏新入场资金，市场处于存量博弈。" },
                { name: "技术派", style: "震荡", verdict: "观望", quote: "三角形收敛末端，变盘在即，不做方向性预测。" }
            ];
        }
    }

    if (isChinaMarket) {
        if (isBuy) {
            return [
                { name: "顶级游资 (Hot Money)", style: "打板/情绪", verdict: "看多", quote: "情绪一致性转强，主力资金明显扫货，龙虎榜机构席位大买。" },
                { name: "北向资金 (Smart Money)", style: "外资流向", verdict: "看多", quote: "深股通/沪股通大幅净流入，核心资产估值修复，均线多头排列。" },
                { name: "国家队 (National Team)", style: "维稳/护盘", verdict: "看多", quote: "关键点位有大单托底，ETF 持续放量，政策底确立。" },
                { name: "公募一哥 (Fund)", style: "赛道逻辑", verdict: "看多", quote: "业绩超预期，所属板块进入高景气周期，PEG合理。" }
            ];
        } else if (isSell) {
            return [
                { name: "顶级游资 (Hot Money)", style: "打板/情绪", verdict: "看空", quote: "炸板率飙升，高位筹码松动，核按钮风险极大，建议离场。" },
                { name: "北向资金 (Smart Money)", style: "外资流向", verdict: "看空", quote: "连续三个交易日净流出，外资正在高位兑现，规避风险。" },
                { name: "技术派 (Technical)", style: "K线形态", verdict: "看空", quote: "跌破20日生命线，上方套牢盘压力沉重，M头形态确认。" },
                { name: "量化私募 (Quant)", style: "高频策略", verdict: "看空", quote: "多头排列破坏，甚至出现流动性枯竭信号，触发止损风控。" }
            ];
        } else {
             return [
                { name: "顶级游资", style: "情绪", verdict: "观望", quote: "市场缩量，缺乏主线题材，这就是垃圾时间，空仓保平安。" },
                { name: "公募一哥", style: "基本面", verdict: "观望", quote: "业绩真空期，等待更多宏观数据落地，目前性价比不高。" },
                { name: "北向资金", style: "外资", verdict: "观望", quote: "资金流入流出持平，缺乏方向性指引，静待变盘。" },
                { name: "散户大本营", style: "情绪", verdict: "观望", quote: "股吧情绪低迷，没有赚钱效应，不建议出手。" }
            ];
        }
    }

    if (isShortTerm) {
         if (isBuy) {
            return [
                { name: "ICT (SMC)", style: "Smart Money", verdict: "看多", quote: "回踩 FVG (失衡区) 叠加 Bullish Order Block，流动性掠夺完成。" },
                { name: "Linda Raschke", style: "Turtle Soup", verdict: "看多", quote: "价格假跌破前低 (L20) 后迅速拉回，典型的 '海龟汤' 底部反转信号。" },
                { name: "Mark Minervini", style: "VCP Breakout", verdict: "看多", quote: "波动率极致收缩，右侧放量突破 Pivot Point，主升浪启动。" },
                { name: "Al Brooks", style: "Price Action", verdict: "看多", quote: "H1 强势趋势中的 M5 二次突破 (H2)，K线实体饱满。" }
            ];
        } else if (isSell) {
            return [
                { name: "ICT (SMC)", style: "Smart Money", verdict: "看空", quote: "价格进入 Bearish Breaker，上方 Buy-side Liquidity 已被扫除。" },
                { name: "Linda Raschke", style: "Turtle Soup", verdict: "看空", quote: "假突破前高 (H20) 失败，形成 'Turtle Soup Plus' 顶部结构，做空。" },
                { name: "Steve Cohen", style: "Tape Reading", verdict: "看空", quote: "大单抛售出现，上方压单密集，Bid 端撤单明显。" },
                { name: "Jim Simons", style: "Quant", verdict: "看空", quote: "动量因子衰竭，统计套利模型提示反转做空。" }
            ];
        } else {
             return [
                { name: "Mark Minervini", style: "VCP", verdict: "观望", quote: "波动率还在收缩中，尚未出现 Pocket Pivot 突破，耐心等待。" },
                { name: "Al Brooks", style: "Price Action", verdict: "观望", quote: "K线重叠严重，典型的铁丝网震荡形态 (Barb Wire)。" },
                { name: "Steve Cohen", style: "Tape Reading", verdict: "观望", quote: "盘口缺乏方向感，大单缺席，散户博弈为主。" },
                { name: "Wyckoff", style: "VSA", verdict: "观望", quote: "无量空跌，主力没有参与，当前价格没有诚意。" }
            ];
        }
    } else {
        if (isBuy) {
            return [
                { name: "Jesse Livermore", style: "趋势追踪", verdict: "看多", quote: "价格突破关键点，最小阻力线向上，成交量配合放大。" },
                { name: "George Soros", style: "反身性理论", verdict: "看多", quote: "市场偏见正在自我强化，顺势而为，直到泡沫破裂前夕。" },
                { name: "Warren Buffett", style: "价值投资", verdict: "观望", quote: "需确认安全边际，目前不做过多评价，除非价格极具吸引力。" },
                { name: "ICT (SMC)", style: "聪明钱结构", verdict: "看多", quote: "回踩 HTF 订单块，大周期结构看涨，结构未被破坏。" }
            ];
        } else if (isSell) {
            return [
                { name: "Jesse Livermore", style: "趋势追踪", verdict: "看空", quote: "头部形态确立，趋势发生逆转，此时做多是愚蠢的。" },
                { name: "George Soros", style: "反身性理论", verdict: "看空", quote: "基本面恶化引发抛售，反身性正反馈启动，加速下跌。" },
                { name: "Jim Simons", style: "量化概率", verdict: "看空", quote: "高频动量指标显示下行概率 > 75%，建议做空。" },
                { name: "Steve Cohen", style: "盘口量价", verdict: "看空", quote: "买盘枯竭，巨量抛单涌现，机构正在出货。" }
            ];
        } else {
            return [
                { name: "Jesse Livermore", style: "趋势追踪", verdict: "观望", quote: "市场处于震荡区间，等待突破方向，不要在窄幅震荡中消耗本金。" },
                { name: "Al Brooks", style: "价格行为", verdict: "观望", quote: "K线重叠严重，缺乏明确趋势条，胜率接近 50/50。" },
                { name: "Jim Simons", style: "量化概率", verdict: "观望", quote: "信号噪音比过高，不建议入场，等待高胜率信号。" },
                { name: "Warren Buffett", style: "价值投资", verdict: "观望", quote: "耐心是投资中最重要的品质，等待好球区。" }
            ];
        }
    }
};

// ... [lookupStockSymbol Logic Updated for 503 & Empty Errors] ...
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
      // US Tickers (simple alphabetic)
      else if (!cleanQuery.includes(':') && /^[A-Z]+$/.test(cleanQuery)) {
          cleanQuery = `NASDAQ:${cleanQuery}`;
      }
      // Default to what user typed if it looks like TICKER or EXCHANGE:TICKER
      
      return { symbol: cleanQuery, name: cleanQuery, currentPrice: 0 };
  };

  try {
      const prompt = `
        Role: Gemini 2.5 Flash (Fast Financial Data Assistant).
        Task: Identify the correct stock symbol and company name for the user query: "${query}".
        
        Instructions:
        1. Analyze the query to extract the intended financial asset. Ignore numbers that look like prices, timeframes, or noise.
        2. Use Google Search to find the official trading ticker.
        3. Return the symbol in standard TradingView format (EXCHANGE:TICKER).
           Mapping Rules:
           - 6 digits starting '6' -> "SSE:xxxxxx".
           - 6 digits starting '0'/'3' -> "SZSE:xxxxxx".
           - Chinese name -> Check A-Share first.
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
          // If AI says not found, maybe fallback knows
          throw new Error("AI could not identify symbol");
      }
      
      // Post-process AI result
      if (!data.symbol.includes(':')) {
        if (data.symbol.match(/^[0-9]{6}$/)) {
            if (data.symbol.startsWith('6')) data.symbol = `SSE:${data.symbol}`;
            else data.symbol = `SZSE:${data.symbol}`;
        } else if (data.symbol.match(/^[A-Z]{3,5}$/)) {
             data.symbol = `NASDAQ:${data.symbol}`; 
        } else if (data.symbol.includes('XAU')) {
             data.symbol = `FX:${data.symbol}`;
        }
      }

      return { 
          symbol: data.symbol, 
          name: data.name || 'Unknown', 
          currentPrice: data.currentPrice || 0 
      };

  } catch (error: any) {
      console.error("Symbol Lookup Failed (Switching to Fallback):", error);
      // Catch ALL errors (Quota, 503, Empty, Network) and return valid fallback
      return runHeuristicFallback(query);
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

const getHigherTimeframe = (tf: Timeframe): string => {
    switch (tf) {
        case Timeframe.M1:
        case Timeframe.M3:
        case Timeframe.M5: return "1 Hour Chart"; 
        case Timeframe.M15:
        case Timeframe.M30: return "4 Hour Chart";
        case Timeframe.H1:
        case Timeframe.H2:
        case Timeframe.H4: return "Daily Chart";
        case Timeframe.D1: return "Weekly Chart";
        default: return "Daily Chart";
    }
};

const validateAndFillData = (data: any, timeframe: Timeframe, realTimePrice: number, symbol: string): RealTimeAnalysis => {
    const finalPrice = (data.realTimePrice && data.realTimePrice > 0) ? data.realTimePrice : realTimePrice;

    let finalGurus = data.guruInsights;
    if (!finalGurus || !Array.isArray(finalGurus) || finalGurus.length === 0) {
        const signal = data.signal || SignalType.NEUTRAL;
        const structure = data.marketStructure || "Ranging";
        finalGurus = generateFallbackGurus(signal, structure, timeframe, symbol);
    }

    let finalDrivers = data.confidenceDrivers;
    if (!finalDrivers || !Array.isArray(finalDrivers) || finalDrivers.length === 0) {
        finalDrivers = ["Analysis Incomplete"];
    }

    let logicBlock = "⚠️ VULNERABILITIES:\n- Data connection unstable\n\n🛡️ MITIGATIONS:\n- Wait for next cycle";
    if (data.redTeamingLogic) {
        if (typeof data.redTeamingLogic === 'string') {
            logicBlock = data.redTeamingLogic;
        } else if (typeof data.redTeamingLogic === 'object') {
            logicBlock = JSON.stringify(data.redTeamingLogic);
        }
    } else if (data.deepSeekReasoning) {
        logicBlock = String(data.deepSeekReasoning);
    }

    const defaultRegime: MarketRegime = {
        macroTrend: 'Neutral (震荡)',
        sectorPerformance: 'Weak (弱势)',
        institutionalAction: 'Neutral (观望)'
    };

    const defaultData: RealTimeAnalysis = {
        signal: SignalType.NEUTRAL,
        winRate: 50,
        historicalWinRate: 50,
        entryPrice: finalPrice,
        entryStrategy: "观望 (Wait)",
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
        trendResonance: "分析不足 (Insufficient Data)",
        marketRegime: defaultRegime,
        confidenceDrivers: ["Anchor Price Only"],
        guruInsights: [], 
        redTeamingLogic: logicBlock,
        modelFusionConfidence: 50,
        futurePrediction: {
            targetHigh: finalPrice * 1.01,
            targetLow: finalPrice * 0.99,
            confidence: 50,
            predictionPeriod: getPredictionHorizon(timeframe)
        },
        realTimePrice: finalPrice
    };

    return { 
        ...defaultData, 
        ...data, 
        realTimePrice: finalPrice,
        guruInsights: finalGurus,
        confidenceDrivers: finalDrivers,
        redTeamingLogic: logicBlock,
        marketRegime: data.marketRegime || defaultRegime
    }; 
};

// NEW HELPER: Fetch Real-Time Price using Gemini Flash
const fetchRealTimePrice = async (symbol: string): Promise<number | null> => {
    const ai = initAI();
    if (!ai) return null;
    
    // Simple fast prompt using Flash (Grok persona internally)
    const prompt = `Find the CURRENT REAL-TIME live price for ${symbol}. Return ONLY the number. If found on Sina/EastMoney (A-Shares), prioritize that.`;
    
    // Wrap the AI call in a timeout (4 seconds max) to prevent blocking main analysis
    try {
         const callPromise = ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: { tools: [{ googleSearch: {} }] }
       });

       const result = await withTimeout(callPromise, 4000) as GenerateContentResponse; // 4s timeout

       if(result && result.text) {
           const price = parseFloat(result.text.replace(/[^0-9.]/g, ''));
           return isNaN(price) ? null : price;
       }
       return null;
    } catch (e) {
        console.warn("Flash Price Check failed or timed out:", e);
        return null;
    }
}

// *** CORE FUNCTION: analyzeMarketData ***
export const analyzeMarketData = async (
    symbol: string, 
    timeframe: Timeframe, 
    referencePrice: number
    // activeStrategyIds?: string[] // REMOVED: Auto-enable all
): Promise<RealTimeAnalysis> => {
  
  const ai = initAI();
  if (!ai) throw new Error("API Key not configured");

  let anchorPrice = referencePrice;
  try {
      const freshPrice = await fetchRealTimePrice(symbol);
      if (freshPrice && freshPrice > 0) anchorPrice = freshPrice;
  } catch (e) {
      console.warn("Price check failed", e);
  }

  const horizon = getPredictionHorizon(timeframe);
  const isChinaMarket = symbol.startsWith('SSE') || symbol.startsWith('SZSE');
  const isCrypto = symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('USDT') || symbol.includes('SOL') || symbol.includes('BINANCE');
  
  // *** AUTO-INJECT ALL STRATEGIES ***
  const tacticalHandbookContent = STRATEGIES.map(s => s.promptContent).join('\n');

  const TACTICAL_HANDBOOK = `
      *** ELITE TACTICAL HANDBOOK (Enabled Strategies) ***
      Apply ALL relevant models strictly in Phase 2:
      ${tacticalHandbookContent}
  `;

  // *** MARKET PROTOCOLS ***
  const CN_PROTOCOL = `
      *** PROTOCOL: DRAGON HEART (A-SHARES) ***
      FOCUS: "Hot Money" (游资), "Northbound" (北向), "National Team" (国家队).
      RULES: T+1, Price Limits (10%/20%), Sector Rotation.
      SOURCES: "site:finance.sina.com.cn", "site:eastmoney.com".
  `;

  const US_PROTOCOL = `
      *** PROTOCOL: EAGLE EYE (US STOCKS) ***
      FOCUS: "Institutional Flow", "Options Gamma", "Fed/Macro".
      RULES: T+0, Pre-market Volume, Earnings Surprise.
      SOURCES: "site:cnbc.com", "site:bloomberg.com", "site:seekingalpha.com", "site:finance.sina.com.cn" (for CN sentiment).
  `;

  const CRYPTO_PROTOCOL = `
      *** PROTOCOL: CRYPTO WHALE (DIGITAL ASSETS) ***
      FOCUS: "On-Chain Data", "Funding Rates", "Open Interest (OI)", "BTC Correlation".
      RULES: 24/7 Trading, High Volatility, Liquidity Cascades.
      SOURCES: "site:coindesk.com", "site:theblock.co", "site:binance.com".
      STRATEGIES: Prioritize ICT (Liquidity Sweeps) and Harmonic Patterns.
  `;
  
  let marketProtocol = US_PROTOCOL;
  if (isChinaMarket) marketProtocol = CN_PROTOCOL;
  if (isCrypto) marketProtocol = CRYPTO_PROTOCOL;

  const systemInstruction = `
    You are Gemini 3 Pro, executing the "Gemini Adversarial Intelligence Protocol".
    MODE: HIGH-COMPUTE ANALYTICAL ENGINE.
    PERSONAS:
    1. CORE A (Analyst): Optimistic, applies TACTICAL HANDBOOK.
    2. CORE B (Critic): Pessimistic, "Red Team" auditor. Looks for traps.
    NO HALLUCINATION RULE: Base findings on reference price ${anchorPrice}.
    OUTPUT: STRICT JSON. Language: CHINESE.
  `;

  const prompt = `
    TARGET: ${symbol} | TIMEFRAME: ${timeframe} | PRICE ANCHOR: ${anchorPrice}
    ${marketProtocol}
    
    PHASE 0: SITUATIONAL AWARENESS
    - Macro: Risk-On/Off? DXY/BTC correlation?
    - Sector/Chain: Is the ecosystem strong?

    PHASE 1: INTELLIGENCE MINING
    - Search using PROTOCOL sources. Extract Real-time Sentiment/News.

    PHASE 2: STRUCTURE & ALGORITHMS
    - Identify Structure (HH/HL).
    - SCAN FOR ACTIVE STRATEGIES in TACTICAL HANDBOOK.
    - CRITICAL: Check 'Invalidation' conditions for each model.
    - If matched, output e.g., "ICT Model 1: Sweep (Valid unless < ${anchorPrice * 0.99})".

    PHASE 3: RED TEAMING
    - ACT AS CORE B. Attack the findings.
    - FORMAT: ⚠️ VULNERABILITIES / 🛡️ MITIGATIONS.

    PHASE 4: SCORING (Weighted Model)
    - FORMULA: Base (50%) + Drivers - Penalties.
    - PENALTIES:
      - Strategy Invalidation Risk: -15%.
      - Macro Headwind: -10%.
    - OUTPUT: 'winRate' & 'confidenceDrivers'.

    PHASE 5: COUNCIL OF MASTERS
    - Select 4 masters relevant to ${isCrypto ? "CRYPTO" : isChinaMarket ? "A-SHARES" : "US STOCKS"}.
    - E.g. for Crypto: On-Chain Analyst, Cycle Theory, Derivatives.
    - Quotes must be SPECIFIC.

    PHASE 6: EXECUTION
    - Signal: BUY/SELL/NEUTRAL.
    - Entry Strategy: Specific price/condition.
    - TP/SL: Based on ATR.
    - Risk Management: Trailing Stop / Scaling.

    RETURN JSON (Match RealTimeAnalysis Interface):
    {
      "signal": "BUY" | "SELL" | "NEUTRAL",
      "realTimePrice": number, 
      "winRate": number,
      "historicalWinRate": number, 
      "entryPrice": number, 
      "entryStrategy": "String",
      "takeProfit": number,
      "stopLoss": number,
      "supportLevel": number,
      "resistanceLevel": number,
      "riskRewardRatio": number,
      "reasoning": "String",
      "volatilityAssessment": "String",
      "strategyMatch": "String",
      "marketStructure": "String",
      "keyFactors": ["String"],
      "kLineTrend": "String",
      "trendResonance": "String", 
      "marketRegime": { "macroTrend": "String", "sectorPerformance": "String", "institutionalAction": "String" },
      "confidenceDrivers": ["String"],
      "guruInsights": [ { "name": "String", "style": "String", "verdict": "String", "quote": "String" } ],
      "redTeamingLogic": "String",
      "modelFusionConfidence": number,
      "futurePrediction": { "targetHigh": number, "targetLow": number, "confidence": number, "predictionPeriod": "String" },
      "riskManagement": { "trailingStop": "String", "scalingStrategy": "String" }
    }
  `;

  // ... (Execution logic same as before, ensuring Gemini 3 Pro is used) ...
  const runAnalysis = async (model: string, useSearch: boolean) => {
      const config = {
        systemInstruction,
        tools: useSearch ? [{ googleSearch: {} }] : [],
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
      };
      return await ai.models.generateContent({
          model,
          contents: prompt,
          config
      });
  };

  try {
    const response = await runAnalysis('gemini-3-pro-preview', true);
    if (!response.text) throw new Error("Empty response from Gemini Pro");
    const json = cleanAndParseJSON(response.text);
    return validateAndFillData(json, timeframe, anchorPrice, symbol);
  } catch (error: any) {
    console.warn("Gemini 3 Pro Analysis Failed. Using Flash Fallback.", error);
    const useSearch = !error.message?.includes('429');
    try {
        const fallbackResponse = await runAnalysis('gemini-2.5-flash', useSearch);
        const json = cleanAndParseJSON(fallbackResponse.text || "{}");
        return validateAndFillData(json, timeframe, anchorPrice, symbol);
    } catch (finalError) {
        console.error("All Analysis Attempts Failed", finalError);
        throw finalError;
    }
  }
};

// ... [performBacktest remains unchanged] ...
export const performBacktest = async (symbol: string, strategy: BacktestStrategy, period: BacktestPeriod): Promise<BacktestResult> => {
  const ai = initAI();
  if (!ai) throw new Error("API Key not configured");
  
  // (Backtest logic essentially same as before, just ensuring imports match)
  const prompt = `
    ROLE: Gemini 2.5 Flash (Quantitative Researcher).
    TASK: Perform a backtest/audit for ${symbol} using strategy: "${strategy}" over "${period}".
    STRATEGY LOGIC: ${strategy}
    OUTPUT FORMAT (JSON ONLY): { "strategyName": "", "period": "", "totalTrades": 0, "winRate": 0, "profitFactor": 0, "netProfit": "", "bestTrade": "", "worstTrade": "", "equityCurveDescription": "", "insights": "" }
  `;

  try {
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash', 
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] }
      });
      return cleanAndParseJSON(result.text || "{}");
  } catch (error) {
      console.error("Backtest Failed:", error);
      return {
          strategyName: strategy, period, totalTrades: 0, winRate: 0, profitFactor: 0, netProfit: "N/A", bestTrade: "N/A", worstTrade: "N/A", equityCurveDescription: "Failed", insights: "Backtest service unavailable."
      };
  }
};
