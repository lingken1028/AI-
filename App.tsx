
import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Clock, RefreshCcw, Menu, Search, TrendingUp, X, Trash2, Plus, Loader2, BarChart2 } from 'lucide-react';
import StockChart from './components/StockChart';
import AnalysisCard from './components/AnalysisCard';
import BacktestModal from './components/BacktestModal';
import { Timeframe, AIAnalysis, StockSymbol } from './types';
import { TIMEFRAMES, formatCurrency, DEFAULT_WATCHLIST } from './constants';
import { analyzeMarketData, RealTimeAnalysis, lookupStockSymbol } from './services/geminiService';

const App: React.FC = () => {
  // Changed initial state to false (Hidden by default)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  
  // Convert static list to state
  const [watchlist, setWatchlist] = useState<StockSymbol[]>(DEFAULT_WATCHLIST);
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_WATCHLIST[0]);
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>(Timeframe.M15);
  
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null); // New Error State
  const [currentPrice, setCurrentPrice] = useState<number>(selectedSymbol.currentPrice);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  
  const [isBacktestOpen, setIsBacktestOpen] = useState(false);

  // Function to fetch data and analysis
  const fetchMarketAnalysis = useCallback(async () => {
    setIsLoading(true);
    setError(null); // Reset error
    // Note: We DO NOT clear analysis here (setAnalysis(null)) so the user can see 
    // the previous result ("history") while the new one loads.
    
    try {
      // Call AI to get Real-Time Analysis via Google Search
      const result: RealTimeAnalysis = await analyzeMarketData(selectedSymbol.symbol, selectedTimeframe);
      
      // Update State with Analysis
      setAnalysis(result);
      // If AI finds a price, use it for the header display, otherwise fallback to cache
      if(result.realTimePrice) {
          setCurrentPrice(result.realTimePrice);
      }
      setLastUpdated(new Date());

    } catch (e: any) {
      console.error("Analysis Failed", e);
      setError(e.message || "分析过程中发生未知错误");
    } finally {
      setIsLoading(false);
    }
  }, [selectedSymbol.symbol, selectedTimeframe]);

  // Effect: When Symbol or Timeframe changes, reset Analysis completely
  // because the old analysis is irrelevant to the new context.
  useEffect(() => {
    setAnalysis(null);
    setError(null);
    setIsLoading(false);
    // Note: We don't need to load chart data manually anymore, TradingView handles it.
  }, [selectedSymbol, selectedTimeframe]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
        const foundStock = await lookupStockSymbol(searchQuery);
        
        // Strict check before adding
        if (!foundStock || !foundStock.symbol || foundStock.symbol.trim() === '' || foundStock.symbol === 'NULL') {
             throw new Error("Invalid stock data received");
        }

        // Add to watchlist if not exists
        if (!watchlist.some(s => s.symbol === foundStock.symbol)) {
            setWatchlist(prev => [foundStock, ...prev]);
        }
        
        // Select it immediately
        setSelectedSymbol(foundStock);
        if (foundStock.currentPrice > 0) setCurrentPrice(foundStock.currentPrice);
        setSearchQuery('');
        setSidebarOpen(false); 
        
    } catch (error) {
        console.error("Search failed:", error);
        alert(`未找到 "${searchQuery}" 的相关股票。\n请尝试使用准确的代码 (如 AAPL) 或全称。`);
    } finally {
        setIsSearching(false);
    }
  };

  const removeStock = (e: React.MouseEvent, symbolToRemove: string) => {
    e.stopPropagation(); // Prevent triggering the selection click
    
    const newList = watchlist.filter(s => s.symbol !== symbolToRemove);
    setWatchlist(newList);

    // If we deleted the currently selected symbol, switch to the first available
    if (selectedSymbol.symbol === symbolToRemove) {
        if (newList.length > 0) {
            setSelectedSymbol(newList[0]);
        } else {
            // Keep current view but user has an empty list, which is fine
        }
    }
  };

  return (
    <div className="flex h-screen bg-trade-bg text-trade-text font-sans overflow-hidden">
      
      {/* Backtest Modal */}
      <BacktestModal 
        isOpen={isBacktestOpen} 
        onClose={() => setIsBacktestOpen(false)} 
        symbol={selectedSymbol.symbol} 
      />

      {/* Collapsible Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-[#0b1215] border-r border-gray-800 transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:fixed lg:translate-x-0 lg:w-64 flex flex-col shadow-2xl
          ${!sidebarOpen && 'lg:hidden'} 
        `}
        style={{ display: sidebarOpen ? 'flex' : 'none' }} // Explicitly hide to prevent layout shifts if needed, though transform handles visual
      >
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-white">
            <Activity className="text-trade-accent" />
            <span>TradeGuard Pro</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 flex-1 flex flex-col min-h-0">
          <form onSubmit={handleSearch} className="relative mb-6 flex-shrink-0">
            <input 
              type="text" 
              placeholder="搜索 (如 Apple, 0700)" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isSearching}
              className="w-full bg-trade-panel border border-gray-700 rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-trade-accent text-white placeholder-gray-500 disabled:opacity-50"
            />
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
            <button 
                type="submit" 
                disabled={isSearching}
                className="absolute right-2 top-2 p-0.5 bg-gray-700 rounded hover:bg-trade-accent transition-colors disabled:opacity-50"
            >
                {isSearching ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Plus className="w-4 h-4 text-white" />}
            </button>
          </form>

          <div className="flex items-center justify-between mb-3 px-1 flex-shrink-0">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">自选股列表</h3>
            <span className="text-[10px] text-gray-600">{watchlist.length} 个标的</span>
          </div>

          <div className="space-y-1 overflow-y-auto custom-scrollbar flex-1 pr-1">
            {watchlist.map((stock) => (
              <div
                key={stock.symbol}
                onClick={() => {
                  setSelectedSymbol(stock);
                  setSidebarOpen(false); // Auto close on selection for cleaner view
                }}
                className={`
                  group w-full flex items-center justify-between p-3 rounded-lg text-left transition-all cursor-pointer border border-transparent
                  ${selectedSymbol.symbol === stock.symbol 
                    ? 'bg-trade-accent/10 border-trade-accent/50 text-white' 
                    : 'hover:bg-trade-panel text-gray-300 border-transparent'}
                `}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`p-1.5 rounded-full ${selectedSymbol.symbol === stock.symbol ? 'bg-trade-accent' : 'bg-gray-800'}`}>
                        <TrendingUp className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{stock.symbol.split(':')[1] || stock.symbol}</div>
                        <div className="text-[10px] opacity-60 truncate max-w-[90px]">{stock.name}</div>
                    </div>
                </div>
                
                <button 
                    onClick={(e) => removeStock(e, stock.symbol)}
                    className={`
                        p-1.5 rounded-md transition-opacity duration-200
                        ${selectedSymbol.symbol === stock.symbol ? 'opacity-100 hover:bg-red-500/20 text-red-300' : 'opacity-0 group-hover:opacity-100 hover:bg-gray-700 text-gray-400'}
                    `}
                    title="从列表中删除"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            
            {watchlist.length === 0 && (
                <div className="text-center py-8 text-gray-500 text-xs">
                    暂无自选股。<br/>请使用搜索添加股票。
                </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative w-full transition-all duration-300">
        
        {/* Top Header */}
        <header className="h-16 border-b border-gray-800 bg-[#0b1215]/95 backdrop-blur flex items-center justify-between px-4 lg:px-6 shrink-0 z-40">
          <div className="flex items-center gap-4">
             <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors">
                <Menu className="w-6 h-6" />
              </button>
            <div>
              <h1 className="text-xl font-black text-white flex items-center gap-2">
                {selectedSymbol.symbol}
                <span className="text-sm font-normal text-gray-500 hidden sm:inline-block">{selectedSymbol.name}</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="hidden sm:block text-right">
                <div className="text-[10px] text-gray-400 uppercase">分析参考价格</div>
                <div className="text-lg font-mono font-medium text-white">
                  {currentPrice ? formatCurrency(currentPrice) : '---'}
                </div>
             </div>
          </div>
        </header>

        {/* Scrollable Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 scroll-smooth">
          <div className="max-w-7xl mx-auto">
            
            {/* Control Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              
              {/* Timeframes */}
              <div className="flex flex-wrap gap-1 bg-trade-panel p-1 rounded-lg border border-gray-800 w-fit">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setSelectedTimeframe(tf)}
                    className={`
                      px-3 py-1.5 rounded text-xs font-bold transition-all
                      ${selectedTimeframe === tf 
                        ? 'bg-trade-accent text-white shadow-lg' 
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                      }
                    `}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                 {/* Backtest Trigger */}
                 <button 
                    onClick={() => setIsBacktestOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 text-xs font-bold rounded-lg border border-purple-500/30 transition-all hover:scale-105"
                 >
                    <BarChart2 className="w-4 h-4" />
                    <span>策略历史回测</span>
                 </button>

                 <div className="flex items-center gap-3 text-xs text-gray-400 bg-trade-panel px-3 py-2 rounded-lg border border-gray-800 hidden md:flex">
                    <Clock className="w-3 h-3" />
                    <span>更新: {lastUpdated.toLocaleTimeString()}</span>
                 </div>
              </div>
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column: Real-Time Chart */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                <StockChart symbol={selectedSymbol.symbol} timeframe={selectedTimeframe} />
                
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   {/* Explicit Support/Resistance Cards */}
                   <StatCard label="关键阻力 (Res)" value={analysis ? formatCurrency(analysis.resistanceLevel || 0) : '---'} color="text-red-400" />
                   <StatCard label="关键支撑 (Sup)" value={analysis ? formatCurrency(analysis.supportLevel || 0) : '---'} color="text-green-400" />
                   <StatCard label="历史胜率" value={analysis ? `${analysis.historicalWinRate}%` : '---'} color="text-blue-400" />
                   <StatCard label="严谨胜率" value={analysis ? `${analysis.winRate}%` : '---'} color="text-yellow-400" />
                </div>
              </div>

              {/* Right Column: AI Analysis */}
              <div className="lg:col-span-1 min-h-[500px]">
                <AnalysisCard 
                  analysis={analysis} 
                  loading={isLoading} 
                  error={error} // Pass Error State
                  onAnalyze={fetchMarketAnalysis} 
                  symbol={selectedSymbol.symbol}
                />
              </div>

            </div>

             <div className="mt-8 text-center border-t border-gray-800 pt-6">
              <p className="text-xs text-gray-500">
                图表数据由 TradingView 提供。分析报告由 Gemini 3 Pro (数据) + DeepSeek R1 (逻辑) 双核架构生成。
                <br />
                DeepSeek R1 逻辑为模拟推演 (Red Teaming)，仅供参考，交易前请务必自行验证。
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

// Helper Component for Stats
const StatCard = ({ label, value, color }: { label: string, value: string, color: string }) => (
  <div className="bg-trade-panel p-4 rounded-xl border border-gray-800 hover:bg-[#1a232e] transition-colors">
    <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">{label}</div>
    <div className={`text-lg font-mono font-medium ${color}`}>{value}</div>
  </div>
);

export default App;
