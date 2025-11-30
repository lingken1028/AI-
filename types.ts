

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

export interface TechnicalIndicators {
    rsi: number; // Relative Strength Index (0-100)
    macdStatus: 'Golden Cross (金叉)' | 'Death Cross (死叉)' | 'Divergence (背离)' | 'Neutral (中性)';
    emaAlignment: 'Bullish Stack (多头排列)' | 'Bearish Stack (空头排列)' | 'Tangled (纠缠)';
    bollingerStatus: 'Squeeze (收口)' | 'Expansion (开口)' | 'Upper Band (触顶)' | 'Lower Band (触底)';
    kdjStatus?: string; 
    volumeStatus?: string; 
}

export interface InstitutionalData {
    netInflow: string; 
    blockTrades: 'High Activity' | 'Moderate' | 'Low';
    mainForceSentiment: 'Aggressive Buy' | 'Passive Sell' | 'Wait & See';
}

// NEW: Explicit drivers for the Win Rate score
export interface ScoreDrivers {
  technical: number;     // Weight: 40%
  institutional: number; // Weight: 30%
  sentiment: number;     // Weight: 20%
  macro: number;         // Weight: 10%
}

export interface StrategyItem {
  id: string;
  name: string;
  description: string;
  winRate: string;
  promptContent: string;
}

export interface MarketScenario {
    probability: number; // Percentage 0-100
    targetPrice: number;
    description: string;
}

export interface RedTeaming {
    risks: string[];
    mitigations: string[];
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    stressTest: string; 
}

export interface TradingSetup {
    strategyIdentity: string; 
    confirmationTriggers: string[]; 
    invalidationPoint: string; 
}

// NEW: Trinity Consensus for Rigor
export interface TrinityConsensus {
    quantScore: number; // Pure math (0-100)
    smartMoneyScore: number; // Volume/Flow (0-100)
    chartPatternScore: number; // Structure (0-100)
    consensusVerdict: 'STRONG_CONFLUENCE (强共振)' | 'MODERATE (一般)' | 'DIVERGENCE (背离)';
}

// NEW: Smart Money specific analysis (VSA/Order Flow)
export interface SmartMoneyAnalysis {
    retailSentiment: 'Fear' | 'Greed' | 'Neutral';
    smartMoneyAction: 'Accumulating (吸筹)' | 'Distributing (派发)' | 'Marking Up (拉升)' | 'Inactive';
    orderBlockStatus: 'Active Supply Zone' | 'Active Demand Zone' | 'None';
}

// NEW: Trend Resonance
export interface TrendResonance {
    trendHTF: 'Bullish' | 'Bearish' | 'Neutral'; // Higher Timeframe
    trendLTF: 'Bullish' | 'Bearish' | 'Neutral'; // Lower Timeframe
    resonance: 'Resonant (顺势)' | 'Conflict (逆势/回调)' | 'Chaos (震荡)';
}

export interface AIAnalysis {
  signal: SignalType;
  realTimePrice?: number; 
  winRate: number; 
  scoreDrivers?: ScoreDrivers; 
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
  
  // New Enhanced Fields
  visualAnalysis?: string; // NEW: Specific visual findings from Image Model
  trendResonance?: TrendResonance;
  
  marketRegime?: MarketRegime; 
  technicalIndicators?: TechnicalIndicators;
  institutionalData?: InstitutionalData;
  smartMoneyAnalysis?: SmartMoneyAnalysis; // New

  scenarios?: {
    bullish: MarketScenario;
    bearish: MarketScenario;
    neutral: MarketScenario;
  };
  
  // Consensus Matrix
  trinityConsensus?: TrinityConsensus; // New

  tradingSetup?: TradingSetup;
  redTeaming?: RedTeaming;
  
  confidenceDrivers: string[]; 
  guruInsights: GuruInsight[]; 
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