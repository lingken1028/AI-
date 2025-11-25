
import React, { useState, useEffect } from 'react';
import { AIAnalysis, SignalType } from '../types';
import { formatCurrency } from '../constants';
import { TrendingUp, TrendingDown, Minus, ShieldAlert, Target, Activity, Zap, Globe, Bot, History, Loader2, BrainCircuit, Crosshair, CheckCircle2, ListChecks, CandlestickChart, Users, Cpu, AlertTriangle, ArrowRight, Gauge, BarChart3, Layers, Lock, Unlock, Terminal, Quote, Navigation, GitMerge } from 'lucide-react';

interface AnalysisCardProps {
  analysis: AIAnalysis | null;
  loading: boolean;
  error?: string | null;
  onAnalyze: () => void;
  symbol: string;
}

// Helper: Typewriter Effect Component
const Typewriter = ({ text, speed = 15 }: { text: string; speed?: number }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText(''); // Reset on new text
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayedText((prev) => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return <span className="whitespace-pre-wrap">{displayedText}</span>;
};

// Helper to translate technical terms to Chinese
const translateTerm = (term: string | undefined): string => {
  if (!term) return '计算中...';
  
  const lower = term.toLowerCase();
  
  // Market Structure Translations
  if (lower.includes('bullish')) {
      if (lower.includes('correction')) return '多头回调 (Bullish Correction)';
      return '多头结构 (Bullish)';
  }
  if (lower.includes('bearish')) {
      if (lower.includes('correction')) return '空头反弹 (Bearish Correction)';
      return '空头结构 (Bearish)';
  }
  if (lower.includes('ranging') || lower.includes('consolidation')) return '震荡整理 (Ranging)';
  if (lower.includes('breakout')) return '趋势突破 (Breakout)';
  if (lower.includes('neutral')) return '中性观望 (Neutral)';
  if (lower.includes('oversold')) return '超卖反弹 (Oversold)';
  if (lower.includes('overbought')) return '超买回调 (Overbought)';
  
  return term; // Fallback to original if no match
};

const AnalysisCard: React.FC<AnalysisCardProps> = ({ analysis, loading, error, onAnalyze, symbol }) => {
  const isInitialLoading = loading && !analysis;
  const isRefreshing = loading && !!analysis;

  if (error && !analysis) {
      return (
        <div className="bg-trade-panel rounded-xl border border-red-500/20 p-8 h-full flex flex-col items-center justify-center text-center relative overflow-hidden">
            <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">分析请求失败</h3>
            <p className="text-red-400 text-sm mb-6 max-w-[280px] leading-relaxed">
                {error}
            </p>
            <button 
                onClick={onAnalyze}
                className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white font-bold py-2.5 px-6 rounded-lg transition-all"
            >
                <RefreshCcwIcon /> 重试 (Retry)
            </button>
        </div>
      );
  }

  if (isInitialLoading) {
    return (
      <div className="bg-trade-panel rounded-xl border border-gray-800 p-6 h-full flex flex-col items-center justify-center animate-pulse">
        <div className="relative">
          <div className="flex gap-2">
            <Globe className="w-12 h-12 text-blue-500 animate-pulse" />
            <BrainCircuit className="w-12 h-12 text-purple-500 animate-pulse" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-white mt-6 mb-2">执行机构级分析协议...</h3>
        <p className="text-gray-400 text-center max-w-xs text-xs space-y-2 font-mono">
          <span className="flex items-center gap-2 justify-center text-blue-400"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 全网资讯广搜与精炼 (Wide Mining & Refining)</span>
          <span className="flex items-center gap-2 justify-center text-yellow-400"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span> 市场结构 & 趋势共振 (MTF Resonance)</span>
          <span className="flex items-center gap-2 justify-center text-purple-400"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> 逻辑对抗 (Red Teaming)</span>
          <span className="flex items-center gap-2 justify-center text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> 风险建模 (Risk Modeling)</span>
        </p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-trade-panel rounded-xl border border-gray-800 p-8 h-full flex flex-col items-center justify-center text-center relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-trade-accent to-transparent opacity-50"></div>
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-trade-accent/5 rounded-full blur-3xl group-hover:bg-trade-accent/10 transition-all duration-700"></div>

        <div className="bg-trade-bg p-6 rounded-full mb-6 border border-gray-800 shadow-2xl group-hover:scale-110 transition-transform duration-300 relative flex items-center justify-center gap-3">
            <Bot className="w-8 h-8 text-blue-500" />
            <div className="w-px h-8 bg-gray-700"></div>
            <BrainCircuit className="w-8 h-8 text-purple-500" />
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-6">AI 双核严谨分析</h3>
        
        <div className="w-full max-w-[320px] space-y-3 mb-8">
             {/* Model 1: Gemini */}
             <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 group-hover:border-blue-500/30 transition-colors">
                 <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-blue-500/10">
                        <Bot className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="flex flex-col text-left">
                        <span className="text-xs font-bold text-blue-100">Gemini 3 Pro</span>
                        <span className="text-[9px] text-blue-400/60 font-mono">Core A</span>
                    </div>
                 </div>
                 <div className="text-[9px] font-medium text-blue-300 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20 uppercase tracking-wide">
                    数据聚合中枢 (Data Aggregator)
                 </div>
             </div>

             {/* Connector */}
             <div className="flex justify-center -my-2 relative z-10">
                <div className="bg-gray-800 text-[10px] text-gray-500 px-2 py-0.5 rounded-full border border-gray-700 shadow-sm">
                    +
                </div>
             </div>

             {/* Model 2: DeepSeek */}
             <div className="flex items-center justify-between p-3 rounded-lg bg-purple-500/5 border border-purple-500/10 group-hover:border-purple-500/30 transition-colors">
                 <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-purple-500/10">
                        <BrainCircuit className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="flex flex-col text-left">
                        <span className="text-xs font-bold text-purple-100">DeepSeek R1</span>
                         <span className="text-[9px] text-purple-400/60 font-mono">Core B</span>
                    </div>
                 </div>
                 <div className="text-[9px] font-medium text-purple-300 bg-purple-500/10 px-2 py-1 rounded border border-purple-500/20 uppercase tracking-wide">
                    逻辑对抗核心 (Red Teaming Logic)
                 </div>
             </div>
        </div>

        <p className="text-gray-400 text-sm mb-8 max-w-[280px] leading-relaxed">
            为 <span className="text-white font-bold">{symbol}</span> 启动逻辑对抗验证。<br/>
            包含市场结构分析、风险数学计算与大师博弈。
        </p>
        
        <button 
            onClick={onAnalyze}
            className="group relative inline-flex items-center justify-center gap-3 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-4 px-10 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(120,50,250,0.5)] transform hover:-translate-y-1 active:translate-y-0"
        >
            <Zap className="w-5 h-5 fill-current" />
            <span>启动严谨分析</span>
        </button>
      </div>
    );
  }

  const isBuy = analysis.signal === SignalType.BUY;
  const isSell = analysis.signal === SignalType.SELL;
  
  const signalColor = isBuy ? 'text-trade-up' : isSell ? 'text-trade-down' : 'text-gray-400';
  const SignalIcon = isBuy ? TrendingUp : isSell ? TrendingDown : Minus;
  
  // Dynamic color for market structure
  const structureColor = 
    analysis.marketStructure?.includes('Bullish') ? 'text-green-400 border-green-500/30 bg-green-500/10' :
    analysis.marketStructure?.includes('Bearish') ? 'text-red-400 border-red-500/30 bg-red-500/10' :
    analysis.marketStructure?.includes('Ranging') ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' :
    'text-blue-400 border-blue-500/30 bg-blue-500/10';

  // Calculate prediction range percentage
  let predictionPercentage = 50;
  if (analysis.futurePrediction && analysis.realTimePrice) {
      const { targetLow, targetHigh } = analysis.futurePrediction;
      const range = targetHigh - targetLow;
      if (range > 0) {
          const rawPercent = ((analysis.realTimePrice - targetLow) / range) * 100;
          predictionPercentage = Math.min(Math.max(rawPercent, 0), 100);
      }
  }

  return (
    <div className="bg-trade-panel rounded-xl border border-gray-800 p-5 flex flex-col h-full relative overflow-hidden">
        {isRefreshing && (
          <div className="absolute inset-0 bg-trade-panel/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center transition-opacity duration-300">
             <div className="bg-gray-900/90 p-4 rounded-xl border border-gray-700 shadow-2xl flex flex-col items-center">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-2" />
                <p className="text-xs text-white font-bold">DeepSeek 正在进行逻辑红蓝对抗...</p>
             </div>
          </div>
        )}

        {/* --- HEADER: SIGNAL & STRUCTURE --- */}
        <div className="flex justify-between items-start mb-4 z-10 border-b border-gray-800 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
                 {/* TRANSLATED MARKET STRUCTURE */}
                 <div className={`text-[10px] px-2 py-0.5 rounded font-bold border uppercase flex items-center gap-1.5 ${structureColor}`}>
                    <Layers className="w-3 h-3" /> {translateTerm(analysis.marketStructure)}
                 </div>
                 <div className="text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 truncate max-w-[100px]">
                    {analysis.strategyMatch}
                 </div>
            </div>
            
            <div className={`flex items-center gap-3 text-4xl font-black ${signalColor} tracking-tight`}>
              <SignalIcon className="w-8 h-8" />
              {analysis.signal}
            </div>
            
            <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-gray-500">胜率置信度:</span>
                <div className="h-1.5 w-16 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                        className={`h-full rounded-full ${isBuy ? 'bg-green-500' : isSell ? 'bg-red-500' : 'bg-gray-500'}`} 
                        style={{ width: `${analysis.winRate}%` }}
                    ></div>
                </div>
                <span className="font-bold text-gray-300">{analysis.winRate}%</span>
            </div>
          </div>

          <div className="text-right flex flex-col items-end gap-2">
              <div className="flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-1 text-[10px] text-gray-500">
                      <History className="w-3 h-3" /> 历史模拟胜率
                  </div>
                  <span className="text-lg font-mono font-bold text-blue-400">{analysis.historicalWinRate}%</span>
              </div>
              
              <div className="text-[9px] text-gray-600 bg-gray-800/50 px-1.5 py-0.5 rounded border border-gray-700/50">
                  Risk/Reward: <span className="text-gray-300">{analysis.riskRewardRatio}:1</span>
              </div>
          </div>
        </div>

        {/* --- NEW: TREND RESONANCE BAR --- */}
        {analysis.trendResonance && (
          <div className="mb-4 z-10 flex items-center gap-2 bg-blue-500/5 border border-blue-500/10 px-3 py-2 rounded-lg">
             <GitMerge className="w-3.5 h-3.5 text-blue-400 shrink-0" />
             <div className="flex flex-col w-full">
                <span className="text-[9px] text-blue-400 uppercase font-bold">趋势共振 (MTF Resonance)</span>
                <span className="text-xs text-blue-200 font-medium truncate">{analysis.trendResonance}</span>
             </div>
          </div>
        )}

        {/* --- LOGIC CORE: DEEPSEEK TERMINAL --- */}
        <div className="mb-4 z-10 group relative">
            <div className="flex items-center justify-between mb-1.5 px-1">
                <div className="flex items-center gap-1.5 text-purple-400 text-[10px] font-bold uppercase">
                    <Terminal className="w-3 h-3" /> DeepSeek 逻辑对抗输出 (Red Teaming)
                </div>
                <div className="text-[9px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                    Logic Fusion: {analysis.modelFusionConfidence}%
                </div>
            </div>
            <div className="bg-[#0f111a] p-3 rounded-lg border border-purple-500/20 font-mono text-[10px] text-purple-200/90 leading-relaxed shadow-inner overflow-hidden relative min-h-[60px]">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-purple-500/0 via-purple-500/50 to-purple-500/0"></div>
                {/* Typewriter Effect for "Simulation" feel */}
                <Typewriter text={analysis.deepSeekReasoning} speed={10} />
            </div>
        </div>

        {/* --- EXECUTION: LEVELS & FUTURE --- */}
        <div className="grid grid-cols-2 gap-3 mb-4 z-10">
          
          {/* Market Context / Key Levels */}
          <div className="col-span-2 grid grid-cols-2 gap-3 bg-[#0b1215] p-2.5 rounded-lg border border-gray-800">
             <div className="flex flex-col border-r border-gray-800 pr-2">
                 <span className="text-[9px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">
                    <Unlock className="w-3 h-3 text-red-500/50" /> 阻力位 (Res)
                 </span>
                 <span className="text-sm font-mono text-red-300 font-medium">
                    {formatCurrency(analysis.resistanceLevel || 0)}
                 </span>
             </div>
             <div className="flex flex-col pl-2">
                 <span className="text-[9px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-green-500/50" /> 支撑位 (Sup)
                 </span>
                 <span className="text-sm font-mono text-green-300 font-medium">
                    {formatCurrency(analysis.supportLevel || 0)}
                 </span>
             </div>
          </div>

          {/* New Entry Strategy Card */}
          <div className="col-span-2 bg-blue-500/5 p-2.5 rounded-lg border border-blue-500/10 hover:bg-blue-500/10 transition-colors flex items-center justify-between">
            <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-blue-400 text-[10px] font-bold uppercase mb-1">
                    <Navigation className="w-3 h-3" /> 建议入场 (Entry)
                </div>
                <div className="text-xs font-mono font-medium text-blue-200">
                    {analysis.entryStrategy || "等待信号 (Wait)"}
                </div>
            </div>
            <div className="text-lg font-mono font-bold text-white">
                {formatCurrency(analysis.entryPrice)}
            </div>
          </div>

          <div className="bg-green-500/5 p-2.5 rounded-lg border border-green-500/10 hover:bg-green-500/10 transition-colors">
            <div className="flex items-center gap-1.5 text-green-400 text-[10px] font-bold uppercase mb-1">
              <Target className="w-3 h-3" /> 止盈目标 (TP)
            </div>
            <div className="text-base font-mono font-bold text-white">{formatCurrency(analysis.takeProfit)}</div>
          </div>

          <div className="bg-red-500/5 p-2.5 rounded-lg border border-red-500/10 hover:bg-red-500/10 transition-colors">
            <div className="flex items-center gap-1.5 text-red-400 text-[10px] font-bold uppercase mb-1">
              <ShieldAlert className="w-3 h-3" /> 止损保护 (SL)
            </div>
            <div className="text-base font-mono font-bold text-white">{formatCurrency(analysis.stopLoss)}</div>
          </div>
        </div>

        {/* --- FUTURE OUTLOOK --- */}
        {analysis.futurePrediction && (
          <div className="mb-4 z-10 bg-[#1a202c]/50 border border-gray-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-1.5 text-blue-300 text-[10px] font-bold uppercase">
                    <Activity className="w-3 h-3" /> 预测区间 ({analysis.futurePrediction.predictionPeriod})
                 </div>
                 <span className="text-[9px] text-gray-400 font-mono">
                    Conf: {analysis.futurePrediction.confidence}%
                 </span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-400">{formatCurrency(analysis.futurePrediction.targetLow)}</span>
                  
                  {/* Visual Range Bar */}
                  <div className="flex-1 mx-3 h-1.5 bg-gray-700 rounded-full relative">
                      {/* Range fill (optional, subtle gradient) */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent rounded-full"></div>
                      
                      {/* Current Price Dot */}
                      <div 
                        className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-blue-400 border border-white rounded-full shadow-lg transition-all duration-1000 ease-out"
                        style={{ left: `${predictionPercentage}%` }}
                        title="当前价格位置"
                      ></div>
                  </div>

                  <span className="text-gray-400">{formatCurrency(analysis.futurePrediction.targetHigh)}</span>
              </div>
          </div>
        )}

        {/* --- GURU COUNCIL & REASONING --- */}
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 space-y-3">
             {/* Reasoning Text */}
            <div className="bg-[#0b1215]/50 p-3 rounded-lg border border-gray-800">
                <h3 className="text-gray-500 text-[10px] font-bold uppercase mb-2 flex items-center gap-2">
                    <ListChecks className="w-3 h-3" /> 最终操作建议
                </h3>
                <p className="text-xs text-gray-300 leading-relaxed font-light whitespace-pre-wrap">
                    {analysis.reasoning}
                </p>
            </div>

            {/* Guru List - Grid Layout */}
            <div>
                 <div className="text-[10px] text-gray-600 font-bold uppercase px-1 mb-1.5">大师博弈 (Council)</div>
                 <div className="grid grid-cols-2 gap-2">
                    {analysis.guruInsights && analysis.guruInsights.map((guru, idx) => (
                        <div key={idx} className="bg-[#0b1215]/40 border border-gray-800/30 p-2 rounded flex flex-col gap-1.5 hover:bg-gray-800/40 transition-colors">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-gray-400 truncate">{guru.name}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                                    guru.verdict === '看多' ? 'bg-green-900/30 text-green-500' : 
                                    guru.verdict === '看空' ? 'bg-red-900/30 text-red-500' : 'bg-gray-800 text-gray-500'
                                }`}>
                                    {guru.verdict}
                                </span>
                            </div>
                            <div className="text-[9px] text-gray-500 italic truncate border-l-2 border-gray-700 pl-1.5">
                                "{guru.quote}"
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <button 
          onClick={onAnalyze}
          disabled={loading}
          className="mt-3 w-full py-2.5 bg-[#1e293b] hover:bg-[#334155] border border-gray-700 hover:border-gray-600 disabled:opacity-50 text-gray-200 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shrink-0 group"
        >
          <RefreshCcwIcon className="group-hover:rotate-180 transition-transform duration-500" /> 重启双核分析
        </button>
    </div>
  );
};

const RefreshCcwIcon = ({className}: {className?: string}) => (
  <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74-2.74L3 12" />
    <path d="M3 3v9h9" />
  </svg>
);

export default AnalysisCard;
