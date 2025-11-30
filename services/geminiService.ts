
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
        let clean = input.replace(/,/g, '').replace(/[^\d.-]/g, '');
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
    // 1. Aggressive Clean: Remove Markdown code blocks first
    let cleanedText = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    // 2. Locate the JSON object (Find first { and last })
    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
        cleanedText = cleanedText.substring(firstBrace, lastBrace + 1);
    } else {
        // Fallback: try to find just the array if object not found
        const firstBracket = cleanedText.indexOf('[');
        const lastBracket = cleanedText.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1) {
            cleanedText = cleanedText.substring(firstBracket, lastBracket + 1);
        } else {
            // If strictly no JSON found, throw specific error to trigger retry if needed
             throw new Error("No JSON structure found in response");
        }
    }

    try {
        return JSON.parse(cleanedText);
    } catch (e) {
        console.warn("Initial JSON Parse Failed. Attempting repairs...", e);
        
        // Repair Strategy 1: Remove trailing commas (Common LLM Error)
        try {
            const noTrailingCommas = cleanedText.replace(/,(\s*[}\]])/g, '$1');
            return JSON.parse(noTrailingCommas);
        } catch (e2) {
             // Repair Strategy 2: Fix unescaped newlines in values
            try {
                const fixedNewlines = cleanedText.replace(/(: ")([\s\S]*?)(?=")/g, (match, prefix, content) => {
                    return prefix + content.replace(/\n/g, "\\n");
                });
                return JSON.parse(fixedNewlines);
            } catch (e3) {
                 // Repair Strategy 3: Aggressive sanitization (Last Resort)
                 try {
                    const sanitized = cleanedText.replace(/[\n\r\t]/g, " ");
                    return JSON.parse(sanitized);
                } catch (e4) {
                     console.error("Critical JSON Parse Error. Raw Text:", text);
                     throw new Error("Invalid JSON structure returned by AI");
                }
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
            // NOTE: responseMimeType is NOT allowed with googleSearch
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
    
    // --- 1. MARKET SEGMENTATION LOGIC ---
    const isAShare = symbol.startsWith('SSE') || symbol.startsWith('SZSE') || /^[0-9]{6}$/.test(symbol.split(':')[1] || '');
    const isCrypto = symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('USDT') || symbol.includes('SOL') || symbol.includes('BINANCE');
    const isForex = symbol.startsWith('FX') || symbol.startsWith('OANDA');
    const isUSStock = !isAShare && !isCrypto && !isForex;

    let marketContext = 'GLOBAL_FX';
    if (isAShare) marketContext = 'CN_ASHARE';
    else if (isUSStock) marketContext = 'US_EQUITY';
    else if (isCrypto) marketContext = 'CRYPTO';

    // DYNAMIC TIMEFRAME CONTEXT
    const tfContext = timeframe === Timeframe.D1 ? "日线" : `${timeframe}级别`; 
    
    // --- 2. SEARCH & PROMPT CONSTRUCTION ---
    let marketSpecificProtocol = "";

    if (isAShare) {
        marketSpecificProtocol = `
            **MARKET PROTOCOL: CHINA A-SHARES (CN_ASHARE)**
            1. POLICY: Prioritize Five-Year Plans/PBOC.
            2. FUNDS: "Northbound Money" (北向) and "Main Force" (主力).
            3. RULES: T+1, 10%/20% Limits.
            4. TERMS: Use "Dragon Return" (龙头反包), "Limit Up" (涨停).
        `;
    } else if (isCrypto) {
         marketSpecificProtocol = `
            **MARKET PROTOCOL: CRYPTO ASSETS**
            1. DATA: Liquidation Heatmaps, Funding Rates, Open Interest.
            2. TERMS: Use "Short Squeeze" (轧空), "Long Squeeze" (多杀多).
        `;
    } else {
        marketSpecificProtocol = `
            **MARKET PROTOCOL: US EQUITIES/GLOBAL**
            1. DATA: Dark Pools, Options Gamma, Fed Policy.
            2. TERMS: Use "Gamma Squeeze", "Institutional Accumulation".
        `;
    }

    const systemPrompt = `
      You are **TradeGuard Pro**, an elite institutional trading AI.
      
      **CORE DIRECTIVE**: Zero Variance. Rigorous Deduction. Deterministic Analysis.
      **OUTPUT FORMAT**: RAW JSON ONLY. NO MARKDOWN. NO EXPLANATORY TEXT.
      
      **LANGUAGE PROTOCOL (CRITICAL)**:
      1. ALL OUTPUT TEXT MUST BE IN **SIMPLIFIED CHINESE (简体中文)**.
      2. TRANSLATE ALL English financial terms from Search Results into Chinese.
         - Example: "Bullish Engulfing" -> "看涨吞没"
         - Example: "Entry Strategy" -> "回踩支撑做多" (NOT "Pullback Buy")
      
      ${marketSpecificProtocol}
      
      **PRICE HANDLING RULE (CRITICAL)**:
      ${isLockedPrice 
        ? `>>> USER LOCKED PRICE AT ${currentPrice}. DO NOT UPDATE IT. All levels (TP/SL) must be calculated relative to ${currentPrice}.` 
        : `Use ${currentPrice} as reference. If Google Search shows a newer price, USE THE NEW PRICE and update 'realTimePrice'.`
      }
      
      **LOGIC CONSTRAINTS (STRICT)**:
      1. **SCENARIO DEDUCTION**:
         - "Bullish Target" MUST be > "realTimePrice".
         - "Bearish Target" MUST be < "realTimePrice".
         - Probabilities (Bull + Bear + Neutral) MUST sum to exactly 100.
      2. **TRINITY CONSENSUS**:
         - If Visuals say Bearish but News says Bullish -> Verdict is "DIVERGENCE (背离)".
      
      Output JSON Schema (Maintain strict Chinese strings):
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
        "visualAnalysis": "string (Chinese)",
        "visualKeyLevels": {
            "detectedSupport": number,
            "detectedResistance": number,
            "patternName": "string (Chinese)"
        },
        "dataMining": {
            "sourcesCount": number,
            "confidenceLevel": "High" | "Medium" | "Low",
            "keyDataPoints": ["string (Chinese)"],
            "contradictions": ["string (Chinese)"]
        },
        "winRate": number, 
        "historicalWinRate": number, 
        "entryPrice": number,
        "entryStrategy": "string (Short Chinese Phrase e.g. 突破回踩)",
        "takeProfit": number,
        "stopLoss": number,
        "supportLevel": number,
        "resistanceLevel": number,
        "riskRewardRatio": number,
        "reasoning": "string (Chinese)",
        "volatilityAssessment": "string (Chinese)",
        "marketStructure": "string (Chinese e.g. 多头排列)",
        "technicalIndicators": {
            "rsi": number, "macdStatus": "string (Chinese)", "volumeStatus": "string (Chinese)"
        },
        "institutionalData": {
            "netInflow": "string", "blockTrades": "string", "mainForceSentiment": "string (Chinese)"
        },
        "smartMoneyAnalysis": {
            "retailSentiment": "Fear" | "Greed" | "Neutral",
            "smartMoneyAction": "string (Chinese)",
            "orderBlockStatus": "string (Chinese)"
        },
        "scenarios": {
            "bullish": { "probability": number, "targetPrice": number, "description": "string (Chinese)" },
            "bearish": { "probability": number, "targetPrice": number, "description": "string (Chinese)" },
            "neutral": { "probability": number, "targetPrice": number, "description": "string (Chinese)" }
        },
        "tradingSetup": {
            "strategyIdentity": "string (Chinese)",
            "confirmationTriggers": ["string (Chinese)"],
            "invalidationPoint": "string (Chinese)"
        },
        "redTeaming": {
            "risks": ["string (Chinese)"],
            "mitigations": ["string (Chinese)"],
            "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
            "stressTest": "string (Chinese)"
        },
        "modelFusionConfidence": number, 
        "futurePrediction": {
             "targetHigh": number, "targetLow": number, "confidence": number
        }
      }
    `;

    const userPromptText = `
      Analyze ${symbol} on ${timeframe}. Reference Price: ${currentPrice}.
      ${imageBase64 ? "Use the provided CHART IMAGE for key levels." : "Use Google Search to reconstruct the chart."}
      
      CRITICAL:
      1. Return RAW JSON ONLY. No markdown ticks.
      2. Ensure "entryStrategy" is in CHINESE.
      3. Verify "Bullish Target" > Price and "Bearish Target" < Price.
    `;

    const requestContents: any = {
      model: imageBase64 ? 'gemini-3-pro-image-preview' : 'gemini-3-pro-preview', 
      config: {
          systemInstruction: systemPrompt,
          tools: [{ googleSearch: {} }],
          // NOTE: responseMimeType is NOT allowed with googleSearch
          temperature: 0.1, 
          topK: 1
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

        // --- THE SANITIZER: Strict Logic & Type Enforcement ---
        
        // 1. Defaults
        const baseScore = data.winRate || 50;
        if (!data.scoreDrivers) data.scoreDrivers = { technical: baseScore, institutional: baseScore, sentiment: baseScore, macro: baseScore };
        
        // 2. Number Parsing
        ['realTimePrice', 'entryPrice', 'takeProfit', 'stopLoss', 'supportLevel', 'resistanceLevel'].forEach(key => {
            data[key] = parsePrice(data[key]);
        });
        
        // 3. Scenario Logic Correction
        if (data.scenarios) {
            const { bullish, bearish, neutral } = data.scenarios;
            const currentP = data.realTimePrice || currentPrice;
            
            bullish.targetPrice = parsePrice(bullish.targetPrice);
            bearish.targetPrice = parsePrice(bearish.targetPrice);
            neutral.targetPrice = parsePrice(neutral.targetPrice);
            
            // Auto-Fix Inverted Targets
            if (bullish.targetPrice < currentP && bearish.targetPrice > currentP) {
                // Swap them if AI got confused
                const temp = bullish.targetPrice;
                bullish.targetPrice = bearish.targetPrice;
                bearish.targetPrice = temp;
            }
            
            // Hard Constraints
            if (bullish.targetPrice <= currentP) bullish.targetPrice = currentP * 1.025; // Force +2.5%
            if (bearish.targetPrice >= currentP) bearish.targetPrice = currentP * 0.975; // Force -2.5%
            
            // Probability Normalization
            const bProb = bullish.probability || 0;
            const beProb = bearish.probability || 0;
            const nProb = neutral.probability || 0;
            const total = bProb + beProb + nProb;
            
            if (total !== 100) {
                if (total === 0) {
                     bullish.probability = 33; bearish.probability = 33; neutral.probability = 34;
                } else {
                     // Normalize preserving ratios
                     bullish.probability = Math.round((bProb / total) * 100);
                     bearish.probability = Math.round((beProb / total) * 100);
                     neutral.probability = 100 - bullish.probability - bearish.probability;
                }
            }
        }

        // 4. Trinity Consensus Logic
        if (data.trinityConsensus) {
            const { quantScore, smartMoneyScore, chartPatternScore } = data.trinityConsensus;
            let calculatedWinRate = Math.round((quantScore * 0.35) + (smartMoneyScore * 0.35) + (chartPatternScore * 0.3));
            
            // Penalties
            if (Math.abs(quantScore - smartMoneyScore) > 30) {
                 calculatedWinRate -= 10;
                 data.trinityConsensus.consensusVerdict = 'DIVERGENCE (背离)';
            }
            if (imageBase64 && data.visualKeyLevels) {
                const pattern = (data.visualKeyLevels.patternName || "").toLowerCase();
                if ((pattern.includes("top") || pattern.includes("bear")) && calculatedWinRate > 60) {
                    calculatedWinRate = 55; // Vision Override
                }
            }
            data.winRate = Math.max(0, Math.min(100, calculatedWinRate));
        }

        // 5. Signal Sync
        if (data.winRate >= 60) data.signal = SignalType.BUY;
        else if (data.winRate <= 40) data.signal = SignalType.SELL;
        else data.signal = SignalType.NEUTRAL;

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
        
        Instructions:
        1. Search for historical price action.
        2. Simulate trades based on strict strategy rules.
        3. OUTPUT LANGUAGE: SIMPLIFIED CHINESE (简体中文).
        
        Return JSON ONLY:
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
                temperature: 0.0, 
                tools: [{ googleSearch: {} }]
            }
        });

        if (!result.text) throw new Error("Backtest failed");
        return cleanAndParseJSON(result.text) as BacktestResult;
    } catch (e) {
        console.error("Backtest Error:", e);
        throw new Error("Backtest simulation failed.");
    }
};
