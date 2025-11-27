
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

export interface StrategyItem {
  id: string;
  name: string;
  description: string;
  winRate: string;
  promptContent: string;
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

// Backtesting Types - OPTIMIZED STRATEGIES
export enum BacktestStrategy {
  ICT_SILVER_BULLET = "ICT Silver Bullet (聪明钱时间窗)",
  VWAP_MEAN_REVERSION = "VWAP Institutional Reversion (机构均值回归)",
  WYCKOFF_SPRING = "Wyckoff Spring/Upthrust (威科夫操盘法)",
  GAMMA_SQUEEZE = "Gamma Squeeze (期权伽马挤压)",
  DRAGON_RETURN = "Dragon Return (龙头首阴/反包)",
  SUPPLY_DEMAND_FLIP = "S/D Zone Flip (供需互换)",
  TURTLE_SOUP_PLUS = "Turtle Soup Plus (增强版海龟汤)",
  VOLATILITY_CONTRACTION = "VCP (波动率收缩突破)"
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
