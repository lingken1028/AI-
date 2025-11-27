
import React, { useState, useEffect } from 'react';
import { AIAnalysis, SignalType } from '../types';
import { formatCurrency } from '../constants';
import { TrendingUp, TrendingDown, Minus, ShieldAlert, Target, Activity, Zap, Globe, Bot, History, Loader2, BrainCircuit, Crosshair, CheckCircle2, ListChecks, CandlestickChart, Users, Cpu, AlertTriangle, ArrowRight, Gauge, BarChart3, Layers, Lock, Unlock, Terminal, Quote, Navigation, GitMerge, Sliders, Radar, Radio, BarChart4, ShieldCheck } from 'lucide-react';

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

// Helper: Radial Progress Component
const RadialProgress = ({ score, size = 42, strokeWidth = 3 }: { score: number; size?: number; strokeWidth?: number }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (score / 100) * circumference;
  
  let colorClass = 'text-red-500';
  let trackClass = 'text-red-500/10';
  
  if (score >= 50) { colorClass = 'text-yellow-500'; trackClass = 'text-yellow-500/10'; }
  if (score >= 75) { colorClass = 'text-green-500'; trackClass = 'text-green-500/10'; }

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full">
        <circle
          className={trackClass}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className={`${colorClass} transition-all duration-1000 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className={`font-mono font-bold leading-none ${colorClass}`} style={{ fontSize: size * 0.3 }}>
            {score}
        </span>
      </div>
    </div>
  );
};

// Helper to translate technical terms to Chinese
const translateTerm = (term: string | undefined): string => {
  if (!term) return '计算中...';
  const lower = term.toLowerCase();
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
  return term; 
};

// Helper to determine verdict color style robustly
const getVerdictStyle = (verdict: string) => {
    const v = verdict.toLowerCase();
    if (v.includes('看多') || v.includes('buy') || v.includes('bull') || v.includes('long')) {
        return 'bg-green-900/30 text-green-500 border border-green-500/20';
    }
    if (v.includes('看空') || v.includes('sell') || v.includes('bear') || v.includes('short')) {
        return 'bg-red-900/30 text-red-500 border border-red-500/20';
    }
    return 'bg-gray-800 text-gray-400 border border-gray-700';
};

const ThreatReport = ({ logic }: { logic: string }) => {
    // Enhanced parser to handle both English and Chinese headers
    // The AI might translate headers despite instructions
    let threatPart = "";
    let mitigationPart = "";

    // Normalize potential headers
    const raw = logic || "";
    
    // Split logic
    // Try English first
    if (raw.includes('🛡️ MITIGATIONS:')) {
        const parts = raw.split('🛡️ MITIGATIONS:');
        threatPart = parts[0]?.replace('⚠️ VULNERABILITIES:', '').trim();
        mitigationPart = parts[1]?.trim();
    } 
    // Try Chinese fallback
    else if (raw.includes('🛡️ 缓解措施:') || raw.includes('🛡️ 应对策略:')) {
        const parts = raw.split(/🛡️ (缓解措施|应对策略):/); // Regex split
        threatPart = parts[0]?.replace(/⚠️ (脆弱性|风险点|隐患):/, '').trim();
        mitigationPart = parts[parts.length - 1]?.trim();
    }
    else {
        // Fallback: Just show raw if structure is lost
        threatPart = raw;
        mitigationPart = "";
    }

    const threats = threatPart.split('\n').filter(t => t.trim().length > 0 && t.trim() !== '-');
    const mitigations = mitigationPart.split('\n').filter(m => m.trim().length > 0 && m.trim() !== '-');

    if (threats.length === 0 && mitigations.length === 0) {
        return <div className="text-[10px] text-gray-500 italic p-2">无详细红队报告 (No Report)</div>;
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <div className="bg-red-500/5 rounded-lg border border-red-500/10 p-2.5">
                <div className="flex items-center gap-2 mb-2 border-b border-red-500/10 pb-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-[10px] font-bold text-red-200 uppercase">风险点 (Vulnerabilities)</span>
                </div>
                <ul className="space-y-1">
                    {threats.map((t, i) => (
                        <li key={i} className="text-[10px] text-red-300/80 flex items-start gap-1.5 leading-relaxed">
                            <span className="mt-1 w-1 h-1 rounded-full bg-red-500 shrink-0"></span>
                            {t.replace(/^- /, '')}
                        </li>
                    ))}
                </ul>
            </div>

            {mitigations.length > 0 && (
                <div className="bg-blue-500/5 rounded-lg border border-blue-500/10 p-2.5">
                    <div className="flex items-center gap-2 mb-2 border-b border-blue-500/10 pb-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[10px] font-bold text-blue-200 uppercase">应对措施 (Mitigations)</span>
                    </div>
                    <ul className="space-y-1">
                        {mitigations.map((m, i) => (
                            <li key={i} className="text-[10px] text-blue-300/80 flex items-start gap-1.5 leading-relaxed">
                                <span className="mt-1 w-1 h-1 rounded-full bg-blue-500 shrink-0"></span>
                                {m.replace(/^- /, '')}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
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
            <ShieldAlert className="w-12 h-12 text-red-500 animate-pulse" />
          </div>
        </div>
        <h3 className="text-xl font-bold text-white mt-6 mb-2">执行机构级分析协议...</h3>
        <p className="text-gray-400 text-center max-w-xs text-xs space-y-2 font-mono">
          <span className="flex items-center gap-2 justify-center text-purple-400"><span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span> 全景态势感知 (Situational Awareness)</span>
          <span className="flex items-center gap-2 justify-center text-blue-400"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 全网资讯广搜与精炼 (Mining)</span>
          <span className="flex items-center gap-2 justify-center text-yellow-400"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500"></span> 市场结构 & 趋势共振 (MTF Resonance)</span>
          <span className="flex items-center gap-2 justify-center text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> Gemini 红队对抗 (Red Teaming)</span>
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
            <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-6">Gemini 双重人格对抗</h3>
        
        <div className="w-full max-w-[320px] space-y-3 mb-8">
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
                    首席分析师 (Analyst)
                 </div>
             </div>

             <div className="flex justify-center -my-2 relative z-10">
                <div className="bg-gray-800 text-[10px] text-gray-500 px-2 py-0.5 rounded-full border border-gray-700 shadow-sm">
                    VS
                </div>
             </div>

             <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10 group-hover:border-red-500/30 transition-colors">
                 <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-md bg-red-500/10">
                        <ShieldAlert className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="flex flex-col text-left">
                        <span className="text-xs font-bold text-red-100">Gemini 3 Pro</span>
                         <span className="text-[9px] text-red-400/60 font-mono">Core B</span>
                    </div>
                 </div>
                 <div className="text-[9px] font-medium text-red-300 bg-red-500/10 px-2 py-1 rounded border border-red-500/20 uppercase tracking-wide">
                    红队风控 (Critic)
                 </div>
             </div>
        </div>

        <p className="text-gray-400 text-sm mb-8 max-w-[280px] leading-relaxed">
            为 <span className="text-white font-bold">{symbol}</span> 启动全景态势感知。<br/>
            分析师构建策略，红队寻找漏洞。
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
  
  const structureColor = 
    analysis.marketStructure?.includes('Bullish') ? 'text-green-400 border-green-500/30 bg-green-500/10' :
    analysis.marketStructure?.includes('Bearish') ? 'text-red-400 border-red-500/30 bg-red-500/10' :
    analysis.marketStructure?.includes('Ranging') ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' :
    'text-blue-400 border-blue-500/30 bg-blue-500/10';

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
                <p className="text-xs text-white font-bold">Gemini Critic 正在进行逻辑红蓝对抗...</p>
             </div>
          </div>
        )}

        {/* --- ZONE 1: DASHBOARD (SIGNAL & WIN RATE) --- */}
        <div className="flex justify-between items-start mb-5 z-10 border-b border-gray-800 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
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
            
            <div className="mt-2 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">严谨胜率:</span>
                    <div className="h-1.5 w-16 bg-gray-800 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full ${isBuy ? 'bg-green-500' : isSell ? 'bg-red-500' : 'bg-gray-500'}`} 
                            style={{ width: `${analysis.winRate}%` }}
                        ></div>
                    </div>
                    <span className="font-bold text-gray-300">{analysis.winRate}%</span>
                </div>
                
                {/* Win Rate Attribution (Linkage) */}
                {analysis.confidenceDrivers && analysis.confidenceDrivers.length > 0 && (
                     <div className="flex flex-col gap-1 pl-1 border-l-2 border-gray-800">
                        {analysis.confidenceDrivers.map((driver, i) => (
                             <span key={i} className={`text-[9px] font-mono flex items-center gap-1 ${driver.includes('+') ? 'text-green-400' : driver.includes('-') ? 'text-red-400' : 'text-gray-500'}`}>
                                {driver.includes('+') ? <TrendingUp className="w-2.5 h-2.5"/> : driver.includes('-') ? <TrendingDown className="w-2.5 h-2.5"/> : <Activity className="w-2.5 h-2.5"/>}
                                {driver}
                             </span>
                        ))}
                     </div>
                )}
            </div>
          </div>

          <div className="text-right flex flex-col items-end gap-2">
              <div className="flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-1 text-[10px] text-gray-500">
                      <History className="w-3 h-3" /> 历史复盘胜率
                  </div>
                  <span className="text-lg font-mono font-bold text-blue-400">{analysis.historicalWinRate}%</span>
              </div>
              <div className="text-[9px] text-gray-600 bg-gray-800/50 px-1.5 py-0.5 rounded border border-gray-700/50">
                  R/R: <span className="text-gray-300">{analysis.riskRewardRatio}:1</span>
              </div>
          </div>
        </div>

        {/* --- ZONE 2: MARKET RADAR (SITUATIONAL AWARENESS) --- */}
        {analysis.marketRegime && (
            <div className="mb-5 grid grid-cols-3 gap-2">
                <RadarItem 
                    label="宏观风向 (Macro)" 
                    value={analysis.marketRegime.macroTrend} 
                    icon={<Globe className="w-3 h-3"/>}
                    color={analysis.marketRegime.macroTrend.includes('Risk-On') ? 'text-green-400' : analysis.marketRegime.macroTrend.includes('Risk-Off') ? 'text-red-400' : 'text-gray-400'}
                />
                <RadarItem 
                    label="板块协同 (Sector)" 
                    value={analysis.marketRegime.sectorPerformance} 
                    icon={<BarChart4 className="w-3 h-3"/>}
                    color={analysis.marketRegime.sectorPerformance.includes('Strong') ? 'text-green-400' : analysis.marketRegime.sectorPerformance.includes('Divergent') ? 'text-yellow-400' : 'text-gray-400'}
                />
                 <RadarItem 
                    label="机构足迹 (Flow)" 
                    value={analysis.marketRegime.institutionalAction} 
                    icon={<Users className="w-3 h-3"/>}
                    color={analysis.marketRegime.institutionalAction.includes('Accumulation') ? 'text-green-400' : analysis.marketRegime.institutionalAction.includes('Distribution') ? 'text-red-400' : 'text-gray-400'}
                />
            </div>
        )}

        {/* --- ZONE 3: INTELLIGENCE (DRIVERS & RESONANCE) --- */}
        <div className="space-y-2 mb-5">
             {analysis.trendResonance && (
                <div className="flex items-center gap-2 bg-blue-500/5 border border-blue-500/10 px-3 py-2 rounded-lg">
                    <GitMerge className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <div className="flex flex-col w-full">
                        <span className="text-[9px] text-blue-400 uppercase font-bold">趋势共振 (MTF Resonance)</span>
                        <span className="text-xs text-blue-200 font-medium truncate">{analysis.trendResonance}</span>
                    </div>
                </div>
            )}
        </div>

        {/* --- ZONE 4: BATTLEFIELD (LOGIC CORE) --- */}
        <div className="mb-5 z-10 group relative">
            <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                     <div className="p-1.5 bg-red-500/10 rounded-lg border border-red-500/20">
                        <Terminal className="w-4 h-4 text-red-400" />
                     </div>
                     <div className="flex flex-col">
                        <span className="text-red-100 text-[10px] font-bold uppercase">Gemini 3 Pro (Critic)</span>
                        <span className="text-[9px] text-red-400/60 font-mono">Red Teaming Report</span>
                     </div>
                </div>
                
                {/* Visual Confidence Meter */}
                <div className="flex items-center gap-3 bg-[#0b1215] px-3 py-1.5 rounded-lg border border-gray-800 shadow-sm">
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] text-gray-400 font-bold uppercase">AI Confidence</span>
                        <span className="text-[8px] text-gray-500">Model Fusion</span>
                    </div>
                    <RadialProgress score={analysis.modelFusionConfidence} />
                </div>
            </div>
            
            <ThreatReport logic={analysis.redTeamingLogic} />
        </div>

        {/* --- ZONE 5: EXECUTION MAP --- */}
        <div className="mb-5">
            <h3 className="text-gray-500 text-[10px] font-bold uppercase mb-2 flex items-center gap-2 px-1">
                <Crosshair className="w-3 h-3" /> 交易执行 (Execution Map)
            </h3>
            
            <div className="grid grid-cols-2 gap-3 mb-3">
                 {/* Entry Strategy */}
                <div className="col-span-2 bg-blue-500/5 p-2.5 rounded-lg border border-blue-500/10 flex items-center justify-between">
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

                <div className="bg-green-500/5 p-2.5 rounded-lg border border-green-500/10">
                    <div className="flex items-center gap-1.5 text-green-400 text-[10px] font-bold uppercase mb-1">
                    <Target className="w-3 h-3" /> 止盈目标 (TP)
                    </div>
                    <div className="text-base font-mono font-bold text-white">{formatCurrency(analysis.takeProfit)}</div>
                </div>

                <div className="bg-red-500/5 p-2.5 rounded-lg border border-red-500/10">
                    <div className="flex items-center gap-1.5 text-red-400 text-[10px] font-bold uppercase mb-1">
                    <ShieldAlert className="w-3 h-3" /> 止损保护 (SL)
                    </div>
                    <div className="text-base font-mono font-bold text-white">{formatCurrency(analysis.stopLoss)}</div>
                </div>
            </div>
            
            {/* Dynamic Risk Management */}
            {analysis.riskManagement && (
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-purple-500/5 p-2 rounded-lg border border-purple-500/10">
                        <div className="text-[9px] text-purple-400 font-bold uppercase mb-0.5">动态止损 (Trailing)</div>
                        <div className="text-[10px] text-purple-200">{analysis.riskManagement.trailingStop}</div>
                    </div>
                    <div className="bg-purple-500/5 p-2 rounded-lg border border-purple-500/10">
                        <div className="text-[9px] text-purple-400 font-bold uppercase mb-0.5">分批策略 (Scaling)</div>
                        <div className="text-[10px] text-purple-200">{analysis.riskManagement.scalingStrategy}</div>
                    </div>
                </div>
            )}

            {/* Key Levels & Future */}
            <div className="grid grid-cols-2 gap-3">
                 <div className="col-span-2 md:col-span-1 grid grid-cols-2 gap-2 bg-[#0b1215] p-2 rounded-lg border border-gray-800">
                     <div className="flex flex-col border-r border-gray-800 pr-2 text-center">
                         <span className="text-[9px] text-gray-500 uppercase font-bold mb-0.5">阻力 (Res)</span>
                         <span className="text-xs font-mono text-red-300">{formatCurrency(analysis.resistanceLevel || 0)}</span>
                     </div>
                     <div className="flex flex-col pl-2 text-center">
                         <span className="text-[9px] text-gray-500 uppercase font-bold mb-0.5">支撑 (Sup)</span>
                         <span className="text-xs font-mono text-green-300">{formatCurrency(analysis.supportLevel || 0)}</span>
                     </div>
                 </div>

                 {/* Future Range */}
                 {analysis.futurePrediction && (
                    <div className="col-span-2 md:col-span-1 bg-[#1a202c]/50 border border-gray-700 rounded-lg p-2 flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] text-blue-300 font-bold uppercase flex gap-1"><Activity className="w-3 h-3"/> 预测区间</span>
                            <span className="text-[9px] text-gray-400 font-mono">{analysis.futurePrediction.confidence}%</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-mono">
                            <span className="text-gray-400">{formatCurrency(analysis.futurePrediction.targetLow)}</span>
                            <div className="flex-1 mx-2 h-1 bg-gray-700 rounded-full relative">
                                <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-blue-400 border border-white rounded-full shadow-lg" style={{ left: `${predictionPercentage}%` }}></div>
                            </div>
                            <span className="text-gray-400">{formatCurrency(analysis.futurePrediction.targetHigh)}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* --- ZONE 6: COUNCIL (GURUS) --- */}
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 space-y-3">
            <div className="bg-[#0b1215]/50 p-3 rounded-lg border border-gray-800">
                <p className="text-xs text-gray-300 leading-relaxed font-light whitespace-pre-wrap">
                    {analysis.reasoning}
                </p>
            </div>

            <div>
                 <div className="text-[10px] text-gray-600 font-bold uppercase px-1 mb-1.5 flex items-center justify-between">
                    <span>大师复盘 (Council)</span>
                    <Users className="w-3 h-3" />
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                    {analysis.guruInsights && analysis.guruInsights.map((guru, idx) => (
                        <div key={idx} className="bg-[#0b1215]/40 border border-gray-800/30 p-2 rounded flex flex-col gap-1.5 hover:bg-gray-800/40 transition-colors">
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-bold text-gray-400 truncate">{guru.name}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${getVerdictStyle(guru.verdict)}`}>
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

const RadarItem = ({ label, value, icon, color }: any) => (
    <div className="bg-gray-800/30 rounded-lg p-2 border border-gray-800 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-bold uppercase">
            {icon} {label}
        </div>
        <div className={`text-[10px] font-bold truncate ${color}`}>{value}</div>
    </div>
);

const RefreshCcwIcon = ({className}: {className?: string}) => (
  <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74-2.74L3 12" />
    <path d="M3 3v9h9" />
  </svg>
);

export default AnalysisCard;
