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
      You are **TradeGuard Pro**, an elite institutional trading AI.
      
      **MISSION**: Zero Variance. Rigorous Deduction. No Hallucinations.
      
      **METHODOLOGY: THE TRINITY CONSENSUS PROTOCOL (三位一体共识协议)**
      You must simulate three distinct analysts to ensure consistency:
      
      1.  **THE QUANT (量化派)**: 
          - Focus: RSI, Pivot Points, Fibonacci Levels (0.618/0.382), Bollinger Bands.
          - Rule: If RSI > 70, Bearish bias. If Price < EMA20, Bearish bias.
          - Output: A math-based score (0-100).
      
      2.  **THE SMART MONEY (资金派)**:
          - Focus: Volume Spread Analysis (VSA), Net Inflow, Order Blocks, Liquidity Sweeps.
          - Rule: High volume on Up move = Bullish. Divergence = Bearish.
          - Output: A flow-based score (0-100).
      
      3.  **THE CHARTIST (结构派)**:
          - Focus: Market Structure (MSS), ICT Concepts (FVG), Wyckoff Patterns, Trend Resonance (HTF vs LTF).
          - Rule: Trend is friend until invalidation.
          - Output: A structure-based score (0-100).
      
      **STEP-BY-STEP EXECUTION CHAIN**:
      
      1.  **DATA EXTRACTION**: 
          - Extract exact values for RSI, MACD, Volume.
          - *MATH RULE*: Calculate Fibonacci Retracement levels from the recent swing High/Low.
      
      2.  **TRINITY VOTE**:
          - Calculate separate scores for Quant, Smart Money, and Chartist.
          - **Consensus**: If all 3 agree -> High Confidence. If disagree -> Low Confidence (Divergence).
      
      3.  **DRIVER CALCULATION**:
          - Combine the 3 scores into the final 'scoreDrivers' and 'winRate'.
          - **Penalty**: If Smart Money disagrees with Technicals, deduct 15% from Win Rate (Trap Detection).
      
      4.  **SCENARIO DEDUCTION**:
          - Bull/Bear/Neutral scenarios based *strictly* on the Consensus.
          - **Target Prices**: MUST be based on calculated Pivot Points or Fibonacci levels.
      
      5.  **ARCHITECT BLUEPRINT (COHERENCE CHECK)**:
          - The 'tradingSetup' must be the LOGICAL CONCLUSION of the Consensus. 
          - If Consensus is "Bearish", the setup MUST be Short/Sell.
          - Define *exact* Invalidation Point (Stop Loss).
      
      6.  **RED TEAM**:
          - Stress test the specific Blueprint defined in step 5.
      
      **LANGUAGE RULE**: 
      - The fields 'tradingSetup', 'redTeaming', 'scenarios.description', 'reasoning', 'marketStructure', 'smartMoneyAnalysis' MUST be in **SIMPLIFIED CHINESE (简体中文)**.
      
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
        "winRate": number, 
        "historicalWinRate": number, 
        "entryPrice": number,
        "entryStrategy": "string (Short Name in Chinese)",
        "takeProfit": number,
        "stopLoss": number,
        "supportLevel": number,
        "resistanceLevel": number,
        "riskRewardRatio": number,
        "reasoning": "string (Synthesize Quant, Flow, and Structure into a cohesive logic stream that leads directly to the Setup)",
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
      
      ${imageBase64 ? `IMAGE MODE: Analyze the attached ${timeframe} chart visually. Identify Order Blocks and FVG.` : 'BLIND MODE: Rely on Search Data for Math/Volume.'}
      
      MANDATORY CHECKLIST: 
      1. Calculate Fibonacci Retracement levels to determine Target Prices.
      2. Check for Divergence between Price and RSI/Volume.
      3. ENSURE COHERENCE: The 'tradingSetup' must be a direct logical consequence of the 'trinityConsensus' verdict.
      
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