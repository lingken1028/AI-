
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

// OPTIMIZED STRATEGY PLAYBOOK
export const STRATEGIES: StrategyItem[] = [
  {
    id: 'ict_silver_bullet',
    name: 'ICT Silver Bullet (聪明钱)',
    description: '基于特定的纽约/伦敦交易时间窗口，寻找流动性猎杀后的 FVG (Fair Value Gap) 回补。',
    winRate: '85%',
    promptContent: `
      STRATEGY: ICT SILVER BULLET
      - Core Logic: Wait for a Liquidity Sweep (High/Low) followed by a Displacement (MSS).
      - Entry: Retracement into the FVG (Fair Value Gap).
      - Context: Best used during 10AM-11AM EST (NY Session).
      - Confirmation: DXY correlation divergence.
    `
  },
  {
    id: 'vwap_reversion',
    name: 'VWAP Institutional (均值回归)',
    description: '机构算法策略。当价格过度偏离 VWAP 标准差通道时进行反向交易，或在 VWAP 测试时顺势。',
    winRate: '78%',
    promptContent: `
      STRATEGY: VWAP MEAN REVERSION
      - Core Logic: Price moves too far from average (2.5 SD Bands) tend to snap back.
      - Bullish: Price reclaims VWAP from below with volume.
      - Bearish: Price fails at VWAP or extends to +3SD.
      - Key: Monitor Institutional Volume Profile.
    `
  },
  {
    id: 'wyckoff_structure',
    name: 'Wyckoff Spring (威科夫)',
    description: '识别吸筹区间的"弹簧效应" (Spring) 或派发区间的"上冲回落" (Upthrust)。',
    winRate: '75%',
    promptContent: `
      STRATEGY: WYCKOFF EVENTS
      - Setup: Lateral trading range.
      - Spring (Bullish): Price dips below Support, traps bears, and aggressively reclaims the range.
      - Upthrust (Bearish): Price pokes above Resistance, traps bulls, and falls back in.
      - Volume: High volume on the trap, low volume on the test.
    `
  },
  {
    id: 'gamma_squeeze',
    name: 'Gamma Squeeze (期权博弈)',
    description: '针对美股/Crypto。做市商为了对冲看涨期权风险被迫买入正股，导致价格螺旋上升。',
    winRate: 'High Risk/Reward',
    promptContent: `
      STRATEGY: GAMMA SQUEEZE
      - Core Logic: High Call Open Interest (OI) at strikes above current price.
      - Trigger: Price approaches "Gamma Flip" level.
      - Indicator: Rising IV (Implied Volatility) + Aggressive Call Buying.
      - Behavior: Parabolic moves with little pullback.
    `
  },
  {
    id: 'dragon_return',
    name: 'Dragon Return (龙头反包)',
    description: 'A股/游资专用。强势龙头股在首次分歧下跌（首阴）次日，资金强力修复反包。',
    winRate: '65% (High Alpha)',
    promptContent: `
      STRATEGY: DRAGON RETURN (A-Share/Crypto Meme)
      - Setup: Market Leader (Leading Sector) drops sharply (First Red Day).
      - Trigger: Next day opens low but sustains bid, rapidly crossing yesterday's close.
      - Logic: "Hot Money" (Youzi) returns to support the trend leader.
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
