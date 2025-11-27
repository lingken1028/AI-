

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
  name: string; 
  style: string; 
  verdict: string; 
  quote: string; 
}

export interface FuturePrediction {
  targetHigh: number;
  targetLow: number;
  confidence: number; 
  predictionPeriod: string; 
}

export interface MarketRegime {
    macroTrend: 'Risk-On (进攻)' | 'Risk-Off (避险)' | 'Neutral (震荡)';
    sectorPerformance: 'Strong (强势)' | 'Weak (弱势)' | 'Divergent (背离)';
    institutionalAction: 'Accumulation (吸筹)' | 'Distribution (派发)' | 'Neutral (观望)';
}

export interface RiskManagement {
    trailingStop: string;
    scalingStrategy: string;
}

export interface AIAnalysis {
  signal: SignalType;
  realTimePrice?: number; 
  winRate: number; 
  historicalWinRate: number; 
  entryPrice: number;
  entryStrategy: string; 
  takeProfit: number;
  stopLoss: number;
  supportLevel: number; 
  resistanceLevel: number; 
  riskRewardRatio: number;
  reasoning: string;
  volatilityAssessment: string; 
  strategyMatch: string; 
  marketStructure: string;
  keyFactors: string[]; 
  kLineTrend: string; 
  trendResonance: string; 
  marketRegime?: MarketRegime; 
  confidenceDrivers: string[]; 
  guruInsights: GuruInsight[]; 
  redTeamingLogic: string; 
  modelFusionConfidence: number; 
  futurePrediction?: FuturePrediction; 
  riskManagement?: RiskManagement;
}

export type RealTimeAnalysis = AIAnalysis;

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
  TURTLE_TRADING = "海龟交易法则 (20日突破)",
  ICT_SMC = "ICT/SMC 聪明钱 (订单块+流动性)",
  STEVE_COHEN = "Steve Cohen 盘口量价爆发",
  AL_BROOKS = "Al Brooks 裸K价格行为 (PA)",
  LINDA_RASCHKE_TURTLE_SOUP = "Linda Raschke 'Turtle Soup' (假突破反杀)",
  MINERVINI_VCP = "Mark Minervini 'VCP' (波动率收缩突破)",
  WYCKOFF_VSA = "Wyckoff VSA (量价得失分析)"
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
  netProfit: string; 
  bestTrade: string;
  worstTrade: string;
  equityCurveDescription: string; 
  insights: string;
}