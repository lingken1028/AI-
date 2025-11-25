import { CandleData, Timeframe } from '../types';

export const generateMockData = (startPrice: number, periods: number, timeframe: Timeframe): CandleData[] => {
  let currentPrice = startPrice;
  const data: CandleData[] = [];
  const now = new Date();

  // Determine interval in minutes
  let intervalMinutes = 1;
  switch (timeframe) {
    case Timeframe.M1: intervalMinutes = 1; break;
    case Timeframe.M3: intervalMinutes = 3; break;
    case Timeframe.M5: intervalMinutes = 5; break;
    case Timeframe.M15: intervalMinutes = 15; break;
    case Timeframe.M30: intervalMinutes = 30; break;
    case Timeframe.H1: intervalMinutes = 60; break;
    case Timeframe.H2: intervalMinutes = 120; break;
    case Timeframe.H4: intervalMinutes = 240; break;
  }

  // Generate historical data
  for (let i = periods; i > 0; i--) {
    const time = new Date(now.getTime() - i * intervalMinutes * 60000);
    
    // Volatility factor based on timeframe
    const volatility = startPrice * (0.002 * Math.sqrt(intervalMinutes)); 
    
    const change = (Math.random() - 0.5) * volatility;
    const open = currentPrice;
    const close = open + change;
    
    // Create wick High/Low logic
    const high = Math.max(open, close) + Math.random() * (volatility * 0.5);
    const low = Math.min(open, close) - Math.random() * (volatility * 0.5);
    
    const volume = Math.floor(Math.random() * 100000) + 5000;

    data.push({
      time: time.toISOString(),
      open,
      high,
      low,
      close,
      volume
    });

    currentPrice = close;
  }

  return data;
};