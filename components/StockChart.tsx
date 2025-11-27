
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
  const [useRealTimeSource, setUseRealTimeSource] = useState(false); // Toggle for Sina Chart
  const [sinaUrl, setSinaUrl] = useState('');
  const [timestamp, setTimestamp] = useState(Date.now()); // Force refresh image

  // Detect Market Type
  useEffect(() => {
      const checkDelayed = symbol.startsWith('SSE') || symbol.startsWith('SZSE') || symbol.startsWith('HKEX');
      setIsDelayedMarket(checkDelayed);
      // Default to RealTime Source for A-Shares if user selects short timeframe
      if (checkDelayed && (timeframe === Timeframe.M1 || timeframe === Timeframe.M5 || timeframe === Timeframe.M15)) {
          setUseRealTimeSource(true);
      } else {
          setUseRealTimeSource(false);
      }
  }, [symbol, timeframe]);

  // Construct Sina Finance Image URL (The "No Delay" Hack)
  useEffect(() => {
      if (!isDelayedMarket) return;

      // Convert TradingView symbol (SSE:600519) to Sina symbol (sh600519)
      let sinaSymbol = '';
      const cleanCode = symbol.split(':')[1];
      
      if (symbol.startsWith('SSE')) sinaSymbol = `sh${cleanCode}`;
      else if (symbol.startsWith('SZSE')) sinaSymbol = `sz${cleanCode}`;
      else if (symbol.startsWith('HKEX')) sinaSymbol = `hk${cleanCode}`;
      else return;

      // Map timeframe to Sina chart types
      let type = 'min'; 
      switch (timeframe) {
          case Timeframe.M1:
          case Timeframe.M3:
          case Timeframe.M5: 
          case Timeframe.M15:
          case Timeframe.M30:
            type = 'min'; 
            break;
          case Timeframe.H1:
          case Timeframe.H2:
          case Timeframe.H4:
          case Timeframe.D1:
            type = 'daily';
            break;
      }

      setSinaUrl(`http://image.sinajs.cn/newchart/${type}/n/${sinaSymbol}.gif`);

  }, [symbol, timeframe, isDelayedMarket]);

  // Force refresh image every 30s
  useEffect(() => {
      if (!useRealTimeSource) return;
      const interval = setInterval(() => {
          setTimestamp(Date.now());
      }, 30000); 
      return () => clearInterval(interval);
  }, [useRealTimeSource]);


  // TradingView Widget Logic with Debounce
  useEffect(() => {
    if (useRealTimeSource) return; 

    // Capture the current ref to use in cleanup
    const currentContainer = container.current;
    let timer: ReturnType<typeof setTimeout>;

    const loadWidget = () => {
        if (!currentContainer) return;

        currentContainer.innerHTML = ''; // Clear existing

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
    };

    // Delay widget loading slightly to prevent race conditions during rapid switching
    // This fixes the "Cannot listen to the event from the provided iframe" error
    timer = setTimeout(loadWidget, 100);

    return () => {
        clearTimeout(timer);
        if (currentContainer) {
            currentContainer.innerHTML = '';
        }
    };
  }, [symbol, timeframe, useRealTimeSource]);

  return (
    <div className="w-full h-[500px] bg-trade-panel rounded-xl border border-gray-800 overflow-hidden shadow-lg relative group flex flex-col">
      
      {/* Switcher Tab for A-Shares */}
      {isDelayedMarket && (
          <div className="absolute top-3 left-3 z-30 flex bg-black/50 backdrop-blur rounded-lg border border-gray-700 p-1">
              <button 
                onClick={() => setUseRealTimeSource(false)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-[10px] font-bold transition-all ${!useRealTimeSource ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                  <Layers className="w-3 h-3" /> 交互图 (延迟)
              </button>
              <button 
                onClick={() => setUseRealTimeSource(true)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded text-[10px] font-bold transition-all ${useRealTimeSource ? 'bg-trade-accent text-white shadow' : 'text-gray-400 hover:text-white'}`}
              >
                  <Zap className="w-3 h-3" /> 极速实盘 (Sina)
              </button>
          </div>
      )}

      {/* Mode A: Sina Real-Time Image */}
      {useRealTimeSource && isDelayedMarket ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#101014] relative">
               {sinaUrl ? (
                   <>
                    <img 
                        src={`${sinaUrl}?t=${timestamp}`} 
                        alt="Real Time Chart" 
                        className="max-w-full max-h-full object-contain p-4 mix-blend-screen opacity-90"
                    />
                    <div className="absolute bottom-4 right-4 text-[10px] text-gray-500 font-mono bg-black/60 px-2 py-1 rounded">
                        数据源: 新浪财经 (无延迟) | {new Date(timestamp).toLocaleTimeString()} 自动刷新
                    </div>
                   </>
               ) : (
                   <div className="text-gray-500 text-xs">无法加载实时图表</div>
               )}
          </div>
      ) : (
          /* Mode B: TradingView Widget */
          <div 
            className="tradingview-widget-container h-full w-full flex-1" 
            ref={container}
            key={`${symbol}-${timeframe}`} // Force re-mount on change
          >
             <div className="tradingview-widget-container__widget h-full w-full"></div>
          </div>
      )}
      
      {/* Delayed Market Warning Overlay (Only show in TV mode) */}
      {isDelayedMarket && !useRealTimeSource && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
             <div className="bg-yellow-900/80 backdrop-blur border border-yellow-600/50 px-4 py-2 rounded-lg text-xs text-yellow-200 text-center shadow-xl pointer-events-auto">
                <p className="font-bold mb-1">⚠️ 当前查看的是延迟数据</p>
                <p className="opacity-80 mb-2">建议切换左上角“极速实盘”查看最新走势。</p>
                {onRefreshPrice && (
                    <button 
                        onClick={onRefreshPrice}
                        className="bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1 rounded flex items-center gap-1 mx-auto text-[10px] font-bold transition-colors"
                    >
                        <RefreshCw className="w-3 h-3" /> 刷新最新价
                    </button>
                )}
             </div>
        </div>
      )}
    </div>
  );
};

export default StockChart;
