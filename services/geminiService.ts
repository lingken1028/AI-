
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AIAnalysis, SignalType, Timeframe, StockSymbol, BacktestStrategy, BacktestPeriod, BacktestResult, GuruInsight, RealTimeAnalysis, MarketRegime } from "../types";

const initAI = () => {
  if (!process.env.API_KEY) {
    console.error("API_KEY is missing from environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    const isShortTerm = [Timeframe.M1, Timeframe.M3, Timeframe.M5, Timeframe.M15, Timeframe.M30].includes(timeframe);

    if (isChinaMarket) {
        if (isBuy) {
            return [
                { name: "顶级游资 (Hot Money)", style: "打板/情绪", verdict: "看多", quote: "情绪一致性转强，主力资金明显扫货，龙虎榜机构席位大买。" },
                { name: "北向资金 (Smart Money)", style: "外资流向", verdict: "看多", quote: "深股通/沪股通大幅净流入，核心资产估值修复，均线多头排列。" },
                { name: "公募一哥 (Institution)", style: "赛道逻辑", verdict: "看多", quote: "业绩超预期，所属板块进入高景气周期，PEG合理。" },
                { name: "量化私募 (Quant)", style: "高频策略", verdict: "看多", quote: "盘口单量因子异常活跃，动量模型评分 > 90，主力吸筹完成。" }
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
                { name: "顶级游资 (Hot Money)", style: "打板/情绪", verdict: "观望", quote: "市场缩量，缺乏主线题材，这就是垃圾时间，空仓保平安。" },
                { name: "公募一哥 (Institution)", style: "基本面", verdict: "观望", quote: "业绩真空期，等待更多宏观数据落地，目前性价比不高。" },
                { name: "北向资金", style: "外资", verdict: "观望", quote: "资金流入流出持平，缺乏方向性指引，静待变盘。" },
                { name: "散户大本营", style: "情绪", verdict: "观望", quote: "股吧情绪低迷，没有赚钱效应，不建议出手。" }
            ];
        }
    }

    if (isShortTerm) {
         if (isBuy) {
            return [
                { name: "ICT (SMC)", style: "Smart Money", verdict: "看多", quote: "回踩 FVG (失衡区) 叠加 Bullish Order Block，流动性掠夺完成。" },
                { name: "Steve Cohen", style: "Tape Reading", verdict: "看多", quote: "买盘挂单厚重，主动性买入激增，成交量异动确认。" },
                { name: "Al Brooks", style: "Price Action", verdict: "看多", quote: "H1 强势趋势中的 M5 二次突破 (H2)，K线实体饱满。" },
                { name: "Jim Simons", style: "Quant", verdict: "看多", quote: "高频均值回归模型信号触发，胜率 > 68%。" }
            ];
        } else if (isSell) {
            return [
                { name: "ICT (SMC)", style: "Smart Money", verdict: "看空", quote: "价格进入 Bearish Breaker，上方 Buy-side Liquidity 已被扫除。" },
                { name: "Steve Cohen", style: "Tape Reading", verdict: "看空", quote: "大单抛售出现，上方压单密集，Bid 端撤单明显。" },
                { name: "Al Brooks", style: "Price Action", verdict: "看空", quote: "连续三根阴线跌破前期低点 (L2)，楔形反转确认。" },
                { name: "Jim Simons", style: "Quant", verdict: "看空", quote: "动量因子衰竭，统计套利模型提示反转做空。" }
            ];
        } else {
             return [
                { name: "ICT (SMC)", style: "Smart Money", verdict: "观望", quote: "处于均衡区间 (Equilibrium)，等待向一边扫流动性。" },
                { name: "Al Brooks", style: "Price Action", verdict: "观望", quote: "K线重叠严重，典型的铁丝网震荡形态 (Barb Wire)。" },
                { name: "Steve Cohen", style: "Tape Reading", verdict: "观望", quote: "盘口缺乏方向感，大单缺席，散户博弈为主。" },
                { name: "Jim Simons", style: "Quant", verdict: "观望", quote: "信号噪音比过高，不建议入场。" }
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

// ... (lookupStockSymbol uses Gemini 2.5 Flash for speed)
export const lookupStockSymbol = async (query: string): Promise<StockSymbol> => {
  const ai = initAI();
  if (!ai) throw new Error("API Key not configured");

  // Use Gemini 2.5 Flash for fast lookup
  const prompt = `
    Role: Gemini 2.5 Flash (Fast Financial Data Assistant).
    Task: Identify the correct stock symbol and company name for the user query: "${query}".
    
    Instructions:
    1. Analyze the query to extract the intended financial asset. Ignore numbers that look like prices, timeframes, or noise.
    2. Use Google Search to find the official trading ticker.
    3. Return the symbol in standard TradingView format (EXCHANGE:TICKER).
       
       Mapping Rules for CHINA/HK STOCKS (Critical):
       - If query is 6 digits starting with '6' (e.g. 600519, 601288) -> Use "SSE:6xxxxx".
       - If query is 6 digits starting with '0' or '3' -> Use "SZSE:xxxxxx".
       - If query is Chinese name (e.g. "农业银行", "Agri Bank of China") -> Check if user implies A-Share (601288) or H-Share (01288). Default to A-Share (SSE/SZSE) if ambiguous as it's the primary market.
       
       **REAL-TIME DATA SOURCE**: 
       - For China stocks, specifically search "Sina Finance" (新浪财经) or "East Money" (东方财富) or "Investing.com CN" to find the LATEST LIVE PRICE. Do not rely on delayed generic results.

    4. Return the full official company/asset name.
    5. Return the approximate current price if found (number only).
    
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
              { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
              { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
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
    
    if (!data.symbol || data.symbol === "null" || data.symbol === "NOT_FOUND") {
        throw new Error(`Could not find stock for query: ${query}`);
    }
    
    if (!data.symbol.includes(':')) {
        if (data.symbol.match(/^[0-9]{6}$/)) {
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
    if (error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        console.warn("Quota exceeded. Using heuristic fallback.");
        let cleanQuery = query.trim().toUpperCase();
        if (cleanQuery === 'BTC') cleanQuery = 'BINANCE:BTCUSDT';
        else if (cleanQuery === 'ETH') cleanQuery = 'BINANCE:ETHUSDT';
        else if (cleanQuery === 'SOL') cleanQuery = 'BINANCE:SOLUSDT';
        else if (cleanQuery === 'XAUUSD') cleanQuery = 'OANDA:XAUUSD';
        else if (/^[0-9]{6}$/.test(cleanQuery)) {
            if (cleanQuery.startsWith('6')) cleanQuery = `SSE:${cleanQuery}`; 
            else cleanQuery = `SZSE:${cleanQuery}`; 
        }
        else if (!cleanQuery.includes(':')) cleanQuery = `NASDAQ:${cleanQuery}`;

        return { symbol: cleanQuery, name: cleanQuery, currentPrice: 0 };
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

    const logicBlock = data.redTeamingLogic || data.deepSeekReasoning || "Gemini 3 Pro (Critic) Logic:\n> 等待数据输入...\n> 逻辑验证挂起...";

    // Handle Market Regime Default
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

// ... (analyzeMarketData uses Gemini 3 Pro)
export const analyzeMarketData = async (symbol: string, timeframe: Timeframe, referencePrice: number): Promise<RealTimeAnalysis> => {
  const ai = initAI();
  if (!ai) throw new Error("API Key not configured");

  const horizon = getPredictionHorizon(timeframe);
  const higherTF = getHigherTimeframe(timeframe);

  const isChinaMarket = symbol.startsWith('SSE') || symbol.startsWith('SZSE');
  
  // *** PROTOCOL DEFINITION ***
  // These constants define the specific rules for different markets
  const CN_PROTOCOL = `
      *** PROTOCOL: DRAGON HEART (A-SHARES) ***
      FOCUS: "Hot Money" (游资), "Northbound" (北向), "Sector Rotation" (板块).
      
      RULES:
      1. T+1 RESTRICTION: Buying today means locking capital until tomorrow. Focus on "Safety" and "Closing Strong".
      2. LIMITS: Check for 10% (Main) or 20% (ChiNext) limit up/down proximity.
      3. SEARCH SOURCES (MANDATORY): "site:finance.sina.com.cn", "site:eastmoney.com".
         - Look for: "Dragon Tiger List" (龙虎榜), "Concept Hype" (概念炒作).
      4. STRATEGIES: "Limit Up Acceleration" (打板), "Low-Suck" (低吸), "First Green Candle" (首阴).
  `;

  const US_PROTOCOL = `
      *** PROTOCOL: EAGLE EYE (US STOCKS) ***
      FOCUS: "Institutional Flow", "Options Gamma", "Fed/Macro".
      
      RULES:
      1. T+0 / PRE-MARKET: Intraday volatility is key. Check Pre-market volume.
      2. SEARCH SOURCES (MANDATORY): "site:cnbc.com", "site:bloomberg.com", "site:seekingalpha.com", "site:finance.sina.com.cn" (for CN sentiment).
         - Look for: "Analyst Upgrades", "Options Flow" (Call/Put Ratio), "Earnings Surprise".
      3. STRATEGIES: "VWAP Bounce", "Opening Range Breakout (ORB)", "Supply/Demand Zones".
  `;
  
  const marketProtocol = isChinaMarket ? CN_PROTOCOL : US_PROTOCOL;

  const systemInstruction = `
    You are Gemini 3 Pro, running the "Gemini Adversarial Intelligence Protocol" (Dual-Persona).
    
    PERSONAS:
    1. CORE A (Analyst): Optimistic, looking for setups based on Algorithms & War Methods.
    2. CORE B (Critic): Pessimistic, "Red Team" auditor. Looks for traps and macro headwinds.
    
    NO HALLUCINATION RULE:
    - Base ALL technical findings on the reference price (${referencePrice}) and search results.
    - If data is not found, state "Unknown". Do NOT invent prices or patterns.

    OUTPUT: STRICT JSON. Language: CHINESE (中文).
  `;

  const prompt = `
    TARGET: ${symbol} | TIMEFRAME: ${timeframe} | PRICE ANCHOR: ${referencePrice}
    ${marketProtocol}
    
    PHASE 0: SITUATIONAL AWARENESS (The Weather)
    - Macro: DXY, VIX, Bond Yields. Is it Risk-On or Risk-Off?
    - Sector: Is the sector (e.g. AI, EV) outperforming the index?
    - Flow: Accumulation or Distribution?

    PHASE 1: INTELLIGENCE MINING (The Facts)
    - Search specifically using the sources defined in the PROTOCOL above.
    - Extract: Real-time News, Sentiment, and Institutional Moves.

    PHASE 2: STRUCTURE & ALGORITHMS (The Chart)
    - Identify Market Structure (HH/HL, BOS).
    - Check Algorithms: RSI Divergence? MACD Cross? Bollinger Squeeze?
    - Check War Methods: Does it match a specific strategy (e.g. "Golden Pit", "Bull Flag")?

    PHASE 3: RED TEAMING (The Audit)
    - ACT AS CORE B. Attack the findings. 
    - Is the "Breakout" actually a "Liquidity Sweep"? 
    - Is the volume confirming the move?

    PHASE 4: SCORING (The Weighted Probability Model)
    - FORMULA: Base (50%) + Drivers - Penalties.
    - DRIVERS (Add to score):
      - Trend Resonance (Aligned with HTF?): +10% to +15%.
      - Master Consensus (Do Gurus agree?): +5% to +15%.
      - Market Structure (Clear pattern?): +5% to +15%.
      - Sector Strength: +5% to +10%.
    - PENALTIES (Subtract from score):
      - Red Team Veto (Critical flaw?): -10% to -30%.
      - Macro Headwind (Risk-off?): -5% to -15%.
    - HARD CAP: Win Rate cannot exceed 95%.
    - OUTPUT: Final 'winRate' and 'confidenceDrivers' array (e.g. ["Trend Resonance +15%", "Macro Drag -5%"]).
    
    PHASE 5: COUNCIL OF MASTERS
    - Populate with relevant masters defined in the PROTOCOL (e.g. Hot Money for CN, Quants for US).
    - CRITICAL: Quotes must be SPECIFIC and ACTIONABLE. 
      - Bad: "Market looks good."
      - Good: "Buying volume on the 15m pullback to 12.50 confirms strength. Watching for 13.00 breakout."
    
    PHASE 6: EXECUTION (The Plan)
    - Signal: BUY / SELL / NEUTRAL.
    - TIMING (Entry Strategy):
      - DO NOT just say "Buy". Say WHEN.
      - Example: "Wait for pullback to ${referencePrice * 0.995} (EMA20)" or "Buy Stop above ${referencePrice * 1.005}".
    - TP/SL: Calculate based on ATR/Volatility.
    
    RETURN JSON (Match RealTimeAnalysis Interface):
    {
      "signal": "BUY" | "SELL" | "NEUTRAL",
      "realTimePrice": number, 
      "winRate": number,
      "historicalWinRate": number, 
      "entryPrice": number, 
      "entryStrategy": "String (Specific Trigger Condition)",
      "takeProfit": number,
      "stopLoss": number,
      "supportLevel": number,
      "resistanceLevel": number,
      "riskRewardRatio": number,
      "reasoning": "Detailed logic...",
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
      "futurePrediction": { "targetHigh": number, "targetLow": number, "confidence": number, "predictionPeriod": "String" }
    }
  `;

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
    // Attempt 1: Gemini 3 Pro (Full Capability) - EXCLUSIVE TO ANALYSIS
    const response = await runAnalysis('gemini-3-pro-preview', true);
    if (!response.text) throw new Error("Empty response from Gemini Pro");
    const json = cleanAndParseJSON(response.text);
    return validateAndFillData(json, timeframe, referencePrice, symbol);
  } catch (error: any) {
    console.warn("Analysis Primary Attempt Failed. Trying fallback...", error);
    const isQuotaError = error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED');
    const useSearch = !isQuotaError;

    try {
        const fallbackResponse = await runAnalysis('gemini-2.5-flash', useSearch);
        if (!fallbackResponse.text) throw new Error("Empty response from Fallback");
        const json = cleanAndParseJSON(fallbackResponse.text);
        return validateAndFillData(json, timeframe, referencePrice, symbol);
    } catch (finalError) {
        console.error("All Analysis Attempts Failed", finalError);
        throw finalError;
    }
  }
};

// ... (performBacktest uses Gemini 2.5 Flash - Updated to be rigorous)
export const performBacktest = async (symbol: string, strategy: BacktestStrategy, period: BacktestPeriod): Promise<BacktestResult> => {
  const ai = initAI();
  if (!ai) throw new Error("API Key not configured");

  const isChinaMarket = symbol.startsWith('SSE') || symbol.startsWith('SZSE');
  
  let auditProtocol = "SIMULATION PROTOCOL: Simulate trades based on historical price data.";
  if (isChinaMarket) {
      auditProtocol = `
      *** STRICT HISTORICAL AUDIT PROTOCOL (A-SHARES) ***
      1. DO NOT SIMULATE fictitious trades. 
      2. SEARCH for ACTUAL HISTORICAL DATA (Open/Close prices) and Real Market Events during the period.
      3. Verify if the strategy signals ACTUALLY occurred in history.
      4. T+1 RULE: Account for inability to sell on the same day.
      `;
  }

  const prompt = `
    ROLE: Gemini 2.5 Flash (Quantitative Researcher).
    TASK: Perform a backtest/audit for ${symbol} using the strategy: "${strategy}" over the period: "${period}".
    ${auditProtocol}
    STRATEGY LOGIC: ${strategy}
    INSTRUCTIONS:
    1. Search for historical OHLC data and news for ${symbol} covering ${period}.
    2. Identify specific dates where the strategy would have triggered.
    3. Calculate the hypothetical (or actual) PnL based on these triggers.
    OUTPUT FORMAT (JSON ONLY):
    {
      "strategyName": "${strategy}",
      "period": "${period}",
      "totalTrades": number,
      "winRate": number, 
      "profitFactor": number,
      "netProfit": "string",
      "bestTrade": "Description",
      "worstTrade": "Description",
      "equityCurveDescription": "Brief text",
      "insights": "Insights"
    }
  `;

  try {
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

        if (!result.text) throw new Error("Backtest produced empty response");
        return cleanAndParseJSON(result.text);
  } catch (error: any) {
      console.error("Backtest Failed:", error);
       const result = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
           config: { tools: [{ googleSearch: {} }] }
       });
       if (!result.text) throw new Error("Backtest Fallback failed");
       return cleanAndParseJSON(result.text);
  }
};
