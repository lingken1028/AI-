
import { Timeframe, StockSymbol, StrategyItem } from './types';

export const DEFAULT_WATCHLIST: StockSymbol[] = [
  { symbol: 'NYSE:BA', name: 'Boeing Co', currentPrice: 154.20 },
  { symbol: 'NASDAQ:NVDA', name: 'NVIDIA Corp', currentPrice: 880.50 },
  { symbol: 'NASDAQ:TSLA', name: 'Tesla Inc', currentPrice: 175.30 },
  { symbol: 'NASDAQ:AAPL', name: 'Apple Inc', currentPrice: 170.10 },
  { symbol: 'NASDAQ:AMD', name: 'Advanced Micro Devices', currentPrice: 180.00 },
  { symbol: 'NASDAQ:MSFT', name: 'Microsoft Corp', currentPrice: 420.00 },
  { symbol: 'NASDAQ:AMZN', name: 'Amazon.com Inc', currentPrice: 185.00 },
  { symbol: 'NASDAQ:GOOGL', name: 'Alphabet Inc', currentPrice: 175.00 },
  { symbol: 'NASDAQ:META', name: 'Meta Platforms', currentPrice: 500.00 },
  { symbol: 'NASDAQ:COIN', name: 'Coinbase Global', currentPrice: 250.00 },
];

export const STRATEGIES: StrategyItem[] = [
  {
    id: 'ict_smc',
    name: 'ICT / SMC (聪明钱概念)',
    description: '追踪机构订单流：流动性猎杀 (Sweep)、订单块 (OB) 和 失衡区 (FVG)。',
    winRate: '80%+',
    promptContent: `
      [SMC / SMART MONEY MODELS - TREND & ENTRY]
      MODEL 1: CLASSIC SWEEP (猎杀+反转)
      - Logic: Liquidity Sweep (High/Low) -> Market Structure Shift (MSS) -> Return to Order Block (OB) / FVG.
      - Invalidation: Price closes beyond the Sweep wick.
      MODEL 2: INDUCEMENT TRAP (诱多诱空)
      - Logic: Wait for 'Inducement' (Internal Liquidity) to be swept before entering at Extreme OB.
      - Invalidation: Candle body close below the OB.
      MODEL 3: OTE (最佳入场点)
      - Logic: Fib retracement 0.62-0.79 overlapping with a Key Level.
    `
  },
  {
    id: 'turtle_soup',
    name: 'Linda Raschke: Turtle Soup (海龟汤)',
    description: '反直觉逆势策略。专门猎杀突破失败的交易者（假突破）。',
    winRate: '75%',
    promptContent: `
      [LINDA RASCHKE MODEL - MEAN REVERSION]
      MODEL: TURTLE SOUP (False Breakout)
      - Setup: Price makes a new 20-period High (or Low).
      - Trigger: Price fails to hold the breakout and reverses back into the previous range within 1-2 candles.
      - Invalidation: Price closes strongly outside the range with volume.
      - Psychology: Traps breakout traders (Liquidity Engineers).
    `
  },
  {
    id: 'minervini_vcp',
    name: 'Mark Minervini: VCP (波动率收缩)',
    description: '动量爆发策略。寻找价格波动幅度逐渐收窄（收敛）的形态，捕捉主升浪。',
    winRate: '70%+',
    promptContent: `
      [MARK MINERVINI MODEL - MOMENTUM BREAKOUT]
      MODEL: MICRO-VCP (Volatility Contraction Pattern)
      - Setup: Price consolidates in a series of smaller and smaller contractions (e.g., 10% -> 5% -> 2%).
      - Volume: MUST dry up significantly during the tightest contraction.
      - Trigger: Explosive breakout with huge volume spike.
      - Invalidation: Breakout fails and closes back inside the base (Squat).
    `
  },
  {
    id: 'wyckoff_vsa',
    name: 'Wyckoff VSA (量价分析)',
    description: '通过分析成交量与K线幅度的关系（努力 vs 结果）来验证趋势。',
    winRate: '65-70%',
    promptContent: `
      [WYCKOFF VSA MODEL - VALIDATION]
      MODEL: EFFORT vs RESULT
      - Bullish Sign: "Stopping Volume" (Huge volume, small bearish body) or "No Supply" (Pullback with tiny volume).
      - Bearish Sign: "Upthrust" (False breakout with high volume) or "Buying Climax".
      - Logic: Identify where the "Composite Man" is accumulating or distributing.
    `
  },
  {
    id: 'harmonic_patterns',
    name: 'Harmonic Patterns (谐波形态)',
    description: '基于斐波那契数列的数学几何形态 (Gartley, Bat, Butterfly)。',
    winRate: '70%',
    promptContent: `
      [HARMONIC ALGORITHMS - GEOMETRIC REVERSAL]
      MODEL: GARTLEY / BAT / BUTTERFLY
      - Setup: Identify specific XABCD geometric structures using Fibonacci ratios.
      - Bullish Gartley: Completion at 78.6% Retracement of XA.
      - Bearish Bat: Completion at 88.6% Retracement of XA.
      - Trigger: Price Reversal Zone (PRZ) reaction.
      - Invalidation: Price breaks beyond point X.
    `
  }
];

export const TIMEFRAMES = [
  Timeframe.M1,
  Timeframe.M3,
  Timeframe.M5,
  Timeframe.M15,
  Timeframe.M30,
  Timeframe.H1,
  Timeframe.H2,
  Timeframe.H4,
  Timeframe.D1
];

// Formatting helper
export const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(val);
};

export const formatTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
