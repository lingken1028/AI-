
import React, { useEffect, useRef, useState } from 'react';
import { Timeframe } from '../types';
import { RefreshCw, Activity, Layers, Zap } from 'lucide-react';

interface StockChartProps {
  symbol: string;
  timeframe: Timeframe;
  onRefreshPrice?: () => void;
}

const StockChart: React.FC<StockChartProps> = ({ symbol, timeframe, onRefreshPrice }) => {
  const container = useRef<HTMLDivElement>(null);
  const [isDelayedMarket, setIsDelayedMarket] = useState(false);
  
  // Use a ref to track if script is already appended for this symbol/timeframe combo
  const hasInjected = useRef(false);

  // Detect Market Type
  useEffect(() => {
      const checkDelayed = symbol.startsWith('SSE') || symbol.startsWith('SZSE') || symbol.startsWith('HKEX');
      setIsDelayedMarket(checkDelayed);
  }, [symbol]);

  // TradingView Widget Logic with cleanup
  useEffect(() => {
    // Reset injection flag when deps change
    hasInjected.current = false; 
    
    const currentContainer = container.current;
    
    if (!currentContainer) return;

    // Small timeout to allow React to flush render before injecting script
    // This helps avoid the "contentWindow" error race condition
    const timer = setTimeout(() => {
        if (!currentContainer || hasInjected.current) return;

        // Clean any existing children manually just in case
        currentContainer.innerHTML = ''; 

        const script = document.createElement('script');
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
        script.type = "text/javascript";
        script.async = true;

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
          "timezone": "Asia/Shanghai",
          "theme": "dark",
          "style": "1",
          "locale": "zh_CN",
          "enable_publishing": false,
          "allow_symbol_change": false,
          "hide_top_toolbar": false,
          "hide_legend": false,
          "save_image": false,
          "calendar": false,
          "hide_volume": false,
          "support_host": "https://www.tradingview.com"
        });

        currentContainer.appendChild(script);
        hasInjected.current = true;
    }, 50);

    return () => {
        clearTimeout(timer);
        // We do NOT clear innerHTML here to prevent "contentWindow" error.
        // We let React's 'key' prop handle the DOM node destruction.
        hasInjected.current = false;
    };
  }, [symbol, timeframe]);

  return (
    <div className="w-full h-[500px] bg-trade-panel rounded-xl border border-gray-800 overflow-hidden shadow-lg relative group flex flex-col">
      
      {/* TradingView Widget Container */}
      <div 
        className="tradingview-widget-container h-full w-full flex-1" 
        ref={container}
        key={`${symbol}-${timeframe}`} // Crucial: Force full unmount/remount by React
      >
         <div className="tradingview-widget-container__widget h-full w-full"></div>
      </div>
      
      {/* Delayed Market Warning Overlay */}
      {isDelayedMarket && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
             <div className="bg-yellow-900/80 backdrop-blur border border-yellow-600/50 px-4 py-2 rounded-lg text-xs text-yellow-200 text-center shadow-xl pointer-events-auto">
                <p className="font-bold mb-1">⚠️ A股/港股数据延迟 (Delayed)</p>
                <p className="opacity-80 mb-2">AI 分析会强制检索最新实时报价。</p>
                {onRefreshPrice && (
                    <button 
                        onClick={onRefreshPrice}
                        className="bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1 rounded flex items-center gap-1 mx-auto text-[10px] font-bold transition-colors"
                    >
                        <RefreshCw className="w-3 h-3" /> 点击刷新 AI 锚定价格
                    </button>
                )}
             </div>
        </div>
      )}
    </div>
  );
};

export default StockChart;
