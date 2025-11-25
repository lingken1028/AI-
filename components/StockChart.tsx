import React, { useEffect, useRef } from 'react';
import { Timeframe } from '../types';

interface StockChartProps {
  symbol: string;
  timeframe: Timeframe;
  analysis?: any; // kept for interface compatibility, though lines are now in the card
}

const StockChart: React.FC<StockChartProps> = ({ symbol, timeframe }) => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;

    // Clean up previous script
    container.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;

    // Map our Timeframe enum to TradingView interval strings
    let interval = "D";
    switch (timeframe) {
      case Timeframe.M1: interval = "1"; break;
      case Timeframe.M3: interval = "3"; break;
      case Timeframe.M5: interval = "5"; break;
      case Timeframe.M15: interval = "15"; break;
      case Timeframe.M30: interval = "30"; break;
      case Timeframe.H1: interval = "60"; break;
      case Timeframe.H2: interval = "120"; break;
      case Timeframe.H4: interval = "240"; break;
      case Timeframe.D1: interval = "D"; break;
      default: interval = "D";
    }

    script.innerHTML = JSON.stringify({
      "autosize": true,
      "symbol": symbol, 
      "interval": interval,
      "timezone": "Etc/UTC",
      "theme": "dark",
      "style": "1", // 1 = Candles
      "locale": "en",
      "enable_publishing": false,
      "allow_symbol_change": false, // Handled by our app state
      "hide_top_toolbar": false,
      "hide_legend": false,
      "save_image": false,
      "calendar": false,
      "hide_volume": false,
      "support_host": "https://www.tradingview.com"
    });

    container.current.appendChild(script);
  }, [symbol, timeframe]);

  return (
    <div className="w-full h-[500px] bg-trade-panel rounded-xl border border-gray-800 overflow-hidden shadow-lg relative group">
      <div className="tradingview-widget-container h-full w-full" ref={container}>
        <div className="tradingview-widget-container__widget h-full w-full"></div>
      </div>
      
      {/* Overlay Badge */}
      <div className="absolute top-4 right-16 z-20 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
        <div className="bg-[#0b1215]/80 backdrop-blur border border-gray-700 px-3 py-1 rounded text-[10px] text-gray-400">
           Real-Time Market Data
        </div>
      </div>
    </div>
  );
};

export default StockChart;