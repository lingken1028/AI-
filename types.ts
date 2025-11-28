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

export interface StockSymbol {
  symbol: string;
  name: string;
  currentPrice: number;
}

export interface StrategyItem {
  id: string;
  name: string;
  description: string;
  winRate: string;
  promptContent: string;
}

export interface ScoreDrivers {
  technical: number;
  institutional: number;
  sentiment: number;
  macro: number;
}

export interface TrinityConsensus {
  quantScore: number;
  smartMoneyScore: number;
  chartPatternScore: number;
  consensusVerdict: string;
}

export interface SmartMoneyAnalysis {
  retailSentiment: string;
  smartMoneyAction: string;
  orderBlockStatus: string;
}

export interface TrendResonance {
  trendHTF: string;
  trendLTF: string;
  resonance: string;
}

export interface TechnicalIndicators {
  rsi: number;
  macdStatus: string;
  emaAlignment: string;
  bollingerStatus: string;
  kdjStatus: string;
  volumeStatus: string;
}

export interface InstitutionalData {
  netInflow: string;
  blockTrades: string;
  mainForceSentiment: string;
}

export interface Scenario {
  probability: number;
  targetPrice: number;
  description: string;
}

export interface Scenarios {
  bullish: Scenario;
  bearish: Scenario;
  neutral: Scenario;
}

export interface TradingSetup {
  strategyIdentity: string;
  confirmationTriggers: string[];
  invalidationPoint: string;
}

export interface RedTeaming {
  risks: string[];
  mitigations: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  stressTest: string;
}

export interface FuturePrediction {
  targetHigh: number;
  targetLow: number;
  confidence: number;
  predictionPeriod: string;
}

export interface GuruInsight {
    guruName: string;
    quote: string;
    bias: string;
}

export interface RealTimeAnalysis {
  signal: SignalType;
  realTimePrice: number;
  scoreDrivers: ScoreDrivers;
  trinityConsensus: TrinityConsensus;
  smartMoneyAnalysis: SmartMoneyAnalysis;
  trendResonance: TrendResonance;
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
  technicalIndicators: TechnicalIndicators;
  institutionalData: InstitutionalData;
  scenarios: Scenarios;
  tradingSetup: TradingSetup;
  redTeaming: RedTeaming;
  modelFusionConfidence: number;
  guruInsights: GuruInsight[];
  futurePrediction: FuturePrediction;
}

export type AIAnalysis = RealTimeAnalysis;

export enum BacktestStrategy {
  ICT_SILVER_BULLET = 'ICT Silver Bullet',
  VWAP_REVERSION = 'VWAP Mean Reversion',
  WYCKOFF_SPRING = 'Wyckoff Spring',
  GAMMA_SQUEEZE = 'Gamma Squeeze',
  DRAGON_RETURN = 'Dragon Return'
}

export enum BacktestPeriod {
  MONTH_1 = 'Past 1 Month',
  MONTH_3 = 'Past 3 Months',
  MONTH_6 = 'Past 6 Months',
  YEAR_1 = 'Past 1 Year'
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

export interface MarketRegime {
    type: string;
    description: string;
}
