
export enum Timeframe {
  M1 = '1m',
  M3 = '3m',
  M5 = '5m',
  M15 = '15m',
  M30 = '30m',
  H1 = '1h',
  H2 = '2h',
  H4 = '4h',
  D1 = '1d'
}

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  NEUTRAL = 'NEUTRAL'
}

export interface GuruInsight {
  name: string; // e.g., "Jesse Livermore"
  style: string; // e.g., "趋势突破"
  verdict: '看多' | '看空' | '观望';
  quote: string; // Brief reasoning in their style
}

export interface FuturePrediction {
  targetHigh: number;
  targetLow: number;
  confidence: number; // Percentage 0-100
  predictionPeriod: string; // e.g., "Next 24 Hours"
}

export interface AIAnalysis {
  signal: SignalType;
  realTimePrice?: number; // Added: The price anchor used for this analysis
  winRate: number; // Percentage 0-100 (Current Probability)
  historicalWinRate: number; // Percentage 0-100 (Past Accuracy)
  entryPrice: number;
  takeProfit: number;
  stopLoss: number;
  supportLevel: number; // 关键支撑位 (Rigorous Level)
  resistanceLevel: number; // 关键阻力位 (Rigorous Level)
  riskRewardRatio: number;
  reasoning: string;
  volatilityAssessment: string; // e.g., "High", "Moderate", "Low"
  strategyMatch: string; // Name of the specific strategy identified (e.g., "Wyckoff Spring", "Golden Cross")
  marketStructure: 'Bullish Structure' | 'Bearish Structure' | 'Ranging/Consolidation' | 'Breakout' | 'Correction'; // 市场结构状态
  keyFactors: string[]; // List of "AI Ref" - key data points/news references
  kLineTrend: string; // Specific description of the K-line trend for the selected timeframe
  guruInsights: GuruInsight[]; // Array of insights from different simulated masters
  deepSeekReasoning: string; // The "DeepSeek" logic block (Red Teaming Result)
  modelFusionConfidence: number; // How much the two models agree (0-100)
  futurePrediction?: FuturePrediction; // New field for next session forecast
}

export interface StockSymbol {
  symbol: string;
  name: string;
  currentPrice: number;
}

// Backtesting Types
export enum BacktestStrategy {
  MACD_GOLDEN_CROSS = "MACD 金叉/死叉",
  RSI_REVERSAL = "RSI 超买/超卖反转",
  BOLLINGER_BREAKOUT = "布林带突破",
  MA_CROSSOVER = "均线交叉 (MA5/MA20)",
  TURTLE_TRADING = "海龟交易法则 (20日突破)"
}

export enum BacktestPeriod {
  MONTH_1 = "近 1 个月",
  MONTH_3 = "近 3 个月",
  MONTH_6 = "近 6 个月",
  YEAR_1 = "近 1 年"
}

export interface BacktestResult {
  strategyName: string;
  period: string;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  netProfit: string; // e.g. "+15.4%"
  bestTrade: string;
  worstTrade: string;
  equityCurveDescription: string; // Text description of how the equity moved
  insights: string;
}
