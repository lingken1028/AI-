import React, { useState, useEffect } from 'react';
import { AIAnalysis, SignalType } from '../types';
import { formatCurrency } from '../constants';
import { TrendingUp, TrendingDown, Minus, ShieldAlert, Target, Activity, Zap, Globe, Bot, History, Loader2, BrainCircuit, Crosshair, CheckCircle2, ListChecks, CandlestickChart, Users, Cpu, AlertTriangle, ArrowRight, Gauge, BarChart3, Layers, Lock, Unlock, Terminal, Quote, Navigation, GitMerge, Sliders, Radar, Radio, BarChart4, ShieldCheck, Check, Search, Siren, HelpCircle } from 'lucide-react';

interface AnalysisCardProps {
  analysis: AIAnalysis | null;
  loading: boolean;
  error?: string | null;
  onAnalyze: () => void;
  symbol: string;
}

// Helper: Typewriter Effect
const Typewriter = ({ text, speed = 10 }: { text: string; speed?: number }) => {
  const [displayedText, setDisplayedText] = useState('');
  useEffect(() => {
    setDisplayedText(''); 
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
  return <span className="whitespace-pre-wrap leading-relaxed">{displayedText}</span>;
};

// Helper: Radial Progress
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
        <circle className={trackClass} strokeWidth={strokeWidth} stroke="currentColor" fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
        <circle className={`${colorClass} transition-all duration-1000 ease-out`} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" stroke="currentColor" fill="transparent" r={radius} cx={size / 2} cy={size / 2} />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className={`font-mono font-bold leading-none ${colorClass}`} style={{ fontSize: size * 0.3 }}>{score}</span>
      </div>
    </div>
  );
};

// Helper: Term Translation
const translateTerm = (term: string | undefined): string => {
  if (!term) return '计算中...';
  const lower = term.toLowerCase();
  if (lower.includes('bullish')) { if (lower.includes('correction')) return '多头回调 (Correction)'; return '多头结构 (Bullish)'; }
  if (lower.includes('bearish')) { if (lower.includes('correction')) return '空头反弹 (Correction)'; return '空头结构 (Bearish)'; }
  if (lower.includes('ranging') || lower.includes('consolidation')) return '震荡整理 (Ranging)';
  if (lower.includes('breakout')) return '趋势突破 (Breakout)';
  if (lower.includes('neutral')) return '中性观望 (Neutral)';
  if (lower.includes('oversold')) return '超卖反弹 (Oversold)';
  if (lower.includes('overbought')) return '超买回调 (Overbought)';
  return term; 
};

const getVerdictStyle = (verdict: string) => {
    const v = verdict.toLowerCase();
    if (v.includes('看多') || v.includes('buy') || v.includes('bull') || v.includes('long')) return 'bg-green-900/20 text-green-400 border border-green-500/30';
    if (v.includes('看空') || v.includes('sell') || v.includes('bear') || v.includes('short')) return 'bg-red-900/20 text-red-400 border border-red-500/30';
    return 'bg-gray-800 text-gray-400 border border-gray-700';
};

// Enhanced Threat Report Parser with Terminal Aesthetic
const CriticTerminal = ({ logic }: { logic: string }) => {
    let threatPart = "", mitigationPart = "";
    const raw = logic || "";
    
    // Robust parsing based on emojis or keywords
    if (raw.includes('🛡️ MITIGATIONS:') || raw.includes('🛡️ 缓解措施:')) { 
        const splitKey = raw.includes('🛡️ MITIGATIONS:') ? '🛡️ MITIGATIONS:' : '🛡️ 缓解措施:';
        const parts = raw.split(splitKey);
        threatPart = parts[0]?.replace(/⚠️ (RISKS|脆弱性|风险点):?/i, '').trim(); 
        mitigationPart = parts[1]?.trim(); 
    } else { 
        threatPart = raw; 
        mitigationPart = ""; 
    }
    
    // Clean up bullets and empty lines
    const cleanList = (text: string) => text.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && l !== '-')
        .map(l => l.replace(/^[-*•]\s*/, ''));

    const threats = cleanList(threatPart);
    const mitigations = cleanList(mitigationPart);
    
    if (threats.length === 0 && mitigations.length === 0) return <div className="text-xs text-gray-500 font-mono italic p-4 text-center">暂无明显风险检出</div>;
    
    return (
        <div className="bg-[#0c0c0c] rounded-lg border border-gray-800 p-4 font-mono text-xs relative overflow-hidden group">
            {/* Terminal Scan Line */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-white/5 animate-[scan_3s_linear_infinite] z-10 pointer-events-none"></div>
            
            <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                <span className="text-gray-500 font-bold uppercase flex items-center gap-2">
                   <Terminal className="w-3 h-3 text-purple-400" />
                   CRITIC_PROTOCOL.LOG
                </span>
                <div className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500/50"></span>
                    <span className="w-2 h-2 rounded-full bg-yellow-500/50"></span>
                    <span className="w-2 h-2 rounded-full bg-green-500/50"></span>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Risks Section */}
                <div className="space-y-3">
                    <div className="text-red-400 font-bold flex items-center gap-2 animate-pulse">
                        <Siren className="w-3 h-3" />
                        <span>DETECTED_RISKS (潜在风险)</span>
                    </div>
                    <ul className="space-y-2">
                        {threats.map((t, i) => (
                            <li key={i} className="flex gap-3 text-red-200/80 leading-relaxed group-hover:text-red-200 transition-colors">
                                <span className="text-red-500 font-bold shrink-0 opacity-50">[{i+1}]</span>
                                <span>{t}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Divider if needed */}
                {mitigations.length > 0 && <div className="border-t border-dashed border-gray-800/50"></div>}

                {/* Mitigations Section */}
                {mitigations.length > 0 && (
                    <div className="space-y-3">
                         <div className="text-blue-400 font-bold flex items-center gap-2">
                            <ShieldCheck className="w-3 h-3" />
                            <span>MITIGATION_PROTOCOLS (应对措施)</span>
                        </div>
                        <ul className="space-y-2">
                            {mitigations.map((m, i) => (
                                <li key={i} className="flex gap-3 text-blue-200/80 leading-relaxed group-hover:text-blue-200 transition-colors">
                                    <span className="text-blue-500 font-bold shrink-0 opacity-50">>></span>
                                    <span>{m}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
            
             <div className="mt-4 pt-2 border-t border-gray-800 text-[9px] text-gray-600 flex justify-between">
                <span>SESSION_ID: {Math.random().toString(36).substr(2, 8).toUpperCase()}</span>
                <span className="animate-pulse">_CURSOR_ACTIVE</span>
            </div>
        </div>
    );
};

// ** VISUAL PIPELINE LOADING STATE **
const AnalysisLoadingState = () => {
    const [step, setStep] = useState(0);
    const steps = [
        { id: 0, text: "正在初始化量子网络链接...", sub: "Initializing Quantum Uplink", icon: Globe, color: "text-blue-400", bg: "bg-blue-500" },
        { id: 1, text: "Gemini 3 Pro: 识别市场结构...", sub: "Scanning Market Structure (MSS)", icon: Bot, color: "text-yellow-400", bg: "bg-yellow-500" },
        { id: 2, text: "红队协议: 模拟极限压力测试...", sub: "Running Red Team Scenarios", icon: ShieldAlert, color: "text-red-400", bg: "bg-red-500" },
        { id: 3, text: "计算 ATR 波动率风控模型...", sub: "Calculating Volatility Vectors", icon: Activity, color: "text-green-400", bg: "bg-green-500" },
        { id: 4, text: "正在生成最终决策报告...", sub: "Finalizing Tactical Report", icon: BrainCircuit, color: "text-purple-400", bg: "bg-purple-500" }
    ];

    useEffect(() => {
        // Extended timings for Pro (Total ~15s)
        const timings = [3000, 3500, 3500, 2000, 6000];
        let currentStep = 0;
        const nextStep = () => {
            if (currentStep < steps.length - 1) {
                currentStep++;
                setStep(currentStep);
                setTimeout(nextStep, timings[currentStep]);
            }
        };
        const initTimer = setTimeout(nextStep, timings[0]);
        return () => clearTimeout(initTimer);
    }, []);

    return (
      <div className="bg-[#0b1215] rounded-xl border border-gray-800 p-6 h-full flex flex-col relative overflow-hidden shadow-2xl">
        {/* Background Grid & Effects */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0)_1px,transparent_1px)] bg-[size:40px_40px] opacity-20"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1215] via-transparent to-transparent"></div>
        
        {/* Central HUD */}
        <div className="flex-1 flex flex-col items-center justify-center relative z-10">
            <div className="relative mb-12">
                <div className="absolute -inset-8 bg-blue-500/10 rounded-full blur-2xl animate-pulse"></div>
                <div className="w-24 h-24 rounded-full border-2 border-gray-800 flex items-center justify-center relative bg-[#0b1215]">
                    <div className="absolute inset-0 border-t-2 border-blue-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-2 border-r-2 border-purple-500 rounded-full animate-spin [animation-direction:reverse] duration-1000"></div>
                    <Loader2 className={`w-8 h-8 ${steps[step].color} animate-pulse`} />
                </div>
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-48 text-center">
                    <div className="h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full ${steps[step].bg} transition-all duration-300 ease-out`} style={{ width: `${((step + 1) / steps.length) * 100}%` }}></div>
                    </div>
                </div>
            </div>

            <h3 className="text-2xl font-black text-white tracking-tight flex items-col gap-2 mb-2">
                SYSTEM <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">ANALYZING</span>
            </h3>
            
            <div className="flex flex-col items-center gap-1 h-16">
                 <span className={`text-sm font-bold transition-all duration-300 ${steps[step].color} tracking-wide`}>
                    {steps[step].text}
                </span>
                <span className="text-[10px] text-gray-600 font-mono uppercase tracking-widest">
                    {steps[step].sub}
                </span>
            </div>
        </div>

        {/* Terminal Log */}
        <div className="h-32 border-t border-gray-800 pt-4 relative">
             <div className="absolute top-0 left-0 bg-blue-500 h-[1px] w-full shadow-[0_0_10px_#3b82f6]"></div>
             <div className="font-mono text-[10px] space-y-1.5 opacity-70">
                {steps.map((s, idx) => (
                    <div key={idx} className={`flex items-center gap-2 transition-all duration-500 ${idx === step ? 'text-white opacity-100 translate-x-2' : idx < step ? 'text-green-500/50' : 'text-gray-700'}`}>
                        <span className="w-3">{idx < step ? 'OK' : idx === step ? '>' : '.'}</span>
                        <span>{s.sub}</span>
                        {idx === step && <span className="animate-pulse">_</span>}
                    </div>
                ))}
             </div>
        </div>
      </div>
    );
};

const AnalysisCard: React.FC<AnalysisCardProps> = ({ analysis, loading, error, onAnalyze, symbol }) => {
  const isInitialLoading = loading && !analysis;
  const isRefreshing = loading && !!analysis;

  if (error && !analysis) {
      return (
        <div className="bg-[#151c24] rounded-xl border border-red-500/20 p-8 h-full flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="p-4 bg-red-500/10 rounded-full mb-4 animate-bounce">
                <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">分析请求失败</h3>
            <p className="text-red-400 text-sm mb-6 max-w-[280px] leading-relaxed opacity-80">
                {error}
            </p>
            <button onClick={onAnalyze} className="inline-flex items-center gap-2 bg-white hover:bg-gray-200 text-black font-bold py-2.5 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
                <RefreshCcwIcon /> 重试 (Retry)
            </button>
        </div>
      );
  }

  if (isInitialLoading) return <AnalysisLoadingState />;

  if (!analysis) {
    return (
      <div className="bg-[#151c24] rounded-xl border border-gray-800 p-8 h-full flex flex-col items-center justify-center text-center relative overflow-hidden group shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent opacity-50"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>

        <div className="flex items-center justify-center gap-6 mb-8 relative z-10">
             <div className="relative group/core">
                 <div className="absolute -inset-4 bg-blue-500/20 rounded-full blur-xl opacity-0 group-hover/core:opacity-100 transition-opacity"></div>
                 <div className="bg-[#0b1215] p-5 rounded-2xl border border-blue-500/30 shadow-lg relative">
                    <Bot className="w-8 h-8 text-blue-400" />
                 </div>
                 <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-bold text-blue-400 uppercase tracking-wider opacity-0 group-hover/core:opacity-100 transition-all translate-y-2 group-hover/core:translate-y-0">Analyst</div>
             </div>
             <div className="text-gray-700 font-black text-xl">VS</div>
             <div className="relative group/core">
                 <div className="absolute -inset-4 bg-red-500/20 rounded-full blur-xl opacity-0 group-hover/core:opacity-100 transition-opacity"></div>
                 <div className="bg-[#0b1215] p-5 rounded-2xl border border-red-500/30 shadow-lg relative">
                    <ShieldAlert className="w-8 h-8 text-red-400" />
                 </div>
                 <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] font-bold text-red-400 uppercase tracking-wider opacity-0 group-hover/core:opacity-100 transition-all translate-y-2 group-hover/core:translate-y-0">Critic</div>
             </div>
        </div>
        
        <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Gemini 3 Pro <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Advanced</span></h3>
        <p className="text-gray-500 text-xs mb-8 max-w-[260px] leading-relaxed">
            启动机构级全景态势感知。双重人格实时对抗，为您寻找最严谨的交易机会。
        </p>
        
        <button onClick={onAnalyze} className="group relative inline-flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-black font-bold py-3.5 px-8 rounded-xl transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transform hover:-translate-y-1 active:translate-y-0 z-10">
            <Zap className="w-4 h-4 fill-black" />
            <span>启动深度分析</span>
        </button>
      </div>
    );
  }

  const isBuy = analysis.signal === SignalType.BUY;
  const isSell = analysis.signal === SignalType.SELL;
  const signalColor = isBuy ? 'text-[#00bfa5]' : isSell ? 'text-[#ff5252]' : 'text-gray-400';
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
    <div className="bg-[#151c24] rounded-xl border border-gray-800 p-6 flex flex-col h-full relative overflow-hidden shadow-2xl">
        {isRefreshing && (
          <div className="absolute inset-0 bg-[#151c24]/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center transition-opacity duration-300">
             <div className="bg-[#0b1215]/90 p-6 rounded-2xl border border-gray-700 shadow-2xl flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                <p className="text-xs text-white font-bold uppercase tracking-widest">正在重新推演 (Re-Evaluating)...</p>
             </div>
          </div>
        )}

        <div className="flex justify-between items-start mb-6 pb-6 border-b border-gray-800/50">
          <div>
            <div className="flex items-center gap-2 mb-3">
                 <div className={`text-[10px] px-2.5 py-1 rounded-md font-bold border uppercase flex items-center gap-1.5 ${structureColor} shadow-sm`}>
                    <Layers className="w-3 h-3" /> {translateTerm(analysis.marketStructure)}
                 </div>
                 <div className="text-[9px] px-2 py-1 rounded-md bg-[#0b1215] text-gray-400 border border-gray-700/50 truncate max-w-[120px] font-mono">
                    {analysis.strategyMatch}
                 </div>
            </div>
            <div className={`flex items-center gap-3 text-5xl font-black ${signalColor} tracking-tighter filter drop-shadow-lg`}>
              <SignalIcon className="w-10 h-10" />
              {analysis.signal === 'BUY' ? '做多' : analysis.signal === 'SELL' ? '做空' : '观望'}
            </div>
            <div className="mt-4 flex flex-col gap-2">
                <div className="flex items-center gap-3 text-xs group relative cursor-help">
                    <div className="text-gray-500 font-bold uppercase text-[10px] tracking-wide border-b border-dotted border-gray-600 flex items-center gap-1">
                        AI 胜率预测 <HelpCircle className="w-3 h-3 text-gray-600 hover:text-white" />
                    </div>
                    {/* Tooltip */}
                    <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-52 p-2 bg-gray-900 border border-gray-700 text-[10px] text-gray-300 rounded shadow-xl z-20 leading-relaxed">
                        <strong className="text-white block mb-1">综合评判 (Consensus)</strong>
                        实时融合：资金流向、红队压力测试、技术形态及全网情绪的胜算估值。
                    </div>
                    <div className="h-2 w-24 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                        <div className={`h-full rounded-full transition-all duration-1000 ${isBuy ? 'bg-green-500' : isSell ? 'bg-red-500' : 'bg-gray-500'}`} style={{ width: `${analysis.winRate}%` }}></div>
                    </div>
                    <span className="font-mono font-bold text-white">{analysis.winRate}%</span>
                </div>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-3">
              <div className="bg-[#0b1215] p-3 rounded-xl border border-gray-800 flex flex-col items-end gap-1 group relative cursor-help">
                  <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                    <History className="w-3 h-3" /> 历史回测胜率
                    <HelpCircle className="w-3 h-3 text-gray-700 group-hover:text-gray-400" />
                  </div>
                  <span className="text-2xl font-mono font-medium text-blue-400">{analysis.historicalWinRate}%</span>
                   {/* Tooltip */}
                   <div className="absolute right-0 top-full mt-2 hidden group-hover:block w-52 p-2 bg-gray-900 border border-gray-700 text-[10px] text-gray-300 rounded shadow-xl z-20 text-left leading-relaxed">
                        <strong className="text-white block mb-1">模式匹配 (Pattern Match)</strong>
                        检索过去 5 年类似 K 线形态（如双底、突破），计算其在随后走势中的上涨概率。
                    </div>
              </div>
              <div className="flex items-center gap-2 bg-[#0b1215] px-3 py-1.5 rounded-lg border border-gray-800/50"><span className="text-[9px] text-gray-500 font-bold uppercase">盈亏比 (R/R)</span><span className="text-xs font-mono font-bold text-white">{analysis.riskRewardRatio}:1</span></div>
          </div>
        </div>

        {analysis.marketRegime && (
            <div className="mb-6 grid grid-cols-3 gap-3">
                <RadarItem label="宏观 (Macro)" value={analysis.marketRegime.macroTrend} icon={<Globe className="w-3 h-3"/>} color={analysis.marketRegime.macroTrend.includes('Risk-On') ? 'text-green-400' : analysis.marketRegime.macroTrend.includes('Risk-Off') ? 'text-red-400' : 'text-gray-400'} />
                <RadarItem label="板块 (Sector)" value={analysis.marketRegime.sectorPerformance} icon={<BarChart4 className="w-3 h-3"/>} color={analysis.marketRegime.sectorPerformance.includes('Strong') ? 'text-green-400' : analysis.marketRegime.sectorPerformance.includes('Divergent') ? 'text-yellow-400' : 'text-gray-400'} />
                 <RadarItem label="资金 (Flow)" value={analysis.marketRegime.institutionalAction} icon={<Users className="w-3 h-3"/>} color={analysis.marketRegime.institutionalAction.includes('Accumulation') ? 'text-green-400' : analysis.marketRegime.institutionalAction.includes('Distribution') ? 'text-red-400' : 'text-gray-400'} />
            </div>
        )}

        <div className="mb-6">
            <h3 className="text-gray-500 text-[10px] font-bold uppercase mb-3 flex items-center gap-2 px-1 tracking-widest"><Crosshair className="w-3 h-3" /> 交易执行蓝图 (Execution Map)</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="col-span-2 bg-blue-500/5 p-3 rounded-xl border border-blue-500/20 flex items-center justify-between group hover:bg-blue-500/10 transition-colors">
                    <div className="flex flex-col gap-1"><div className="flex items-center gap-1.5 text-blue-400 text-[10px] font-bold uppercase"><Navigation className="w-3 h-3" /> 建议入场 (Entry)</div><div className="text-xs font-mono font-medium text-blue-200 opacity-80 group-hover:opacity-100">{analysis.entryStrategy || "等待信号 (Wait)"}</div></div>
                    <div className="text-xl font-mono font-bold text-white tracking-tight">{formatCurrency(analysis.entryPrice)}</div>
                </div>
                <div className="bg-[#0b1215] p-3 rounded-xl border border-gray-800 flex flex-col gap-1"><div className="flex items-center gap-1.5 text-green-400 text-[10px] font-bold uppercase"><Target className="w-3 h-3" /> 止盈目标 (TP)</div><div className="text-lg font-mono font-medium text-white">{formatCurrency(analysis.takeProfit)}</div></div>
                <div className="bg-[#0b1215] p-3 rounded-xl border border-gray-800 flex flex-col gap-1"><div className="flex items-center gap-1.5 text-red-400 text-[10px] font-bold uppercase"><ShieldAlert className="w-3 h-3" /> 止损风控 (SL)</div><div className="text-lg font-mono font-medium text-white">{formatCurrency(analysis.stopLoss)}</div></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                 <div className="bg-[#0b1215] p-3 rounded-xl border border-gray-800"><div className="flex justify-between items-center mb-2 border-b border-gray-800 pb-1"><span className="text-[9px] text-gray-500 uppercase font-bold">关键位 (Key Levels)</span></div><div className="flex justify-between text-xs font-mono"><span className="text-red-300">{formatCurrency(analysis.resistanceLevel || 0)}</span><span className="text-gray-600">/</span><span className="text-green-300">{formatCurrency(analysis.supportLevel || 0)}</span></div></div>
                 {analysis.futurePrediction && (
                    <div className="bg-[#0b1215] p-3 rounded-xl border border-gray-800 flex flex-col justify-center"><div className="flex items-center justify-between mb-2"><span className="text-[9px] text-blue-300 font-bold uppercase flex gap-1"><Activity className="w-3 h-3"/> 预测区间</span><span className="text-[9px] text-gray-500 font-mono">{analysis.futurePrediction.confidence}%</span></div><div className="relative h-1.5 bg-gray-800 rounded-full w-full overflow-hidden"><div className="absolute top-0 bottom-0 bg-blue-500/20 w-full"></div><div className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_white]" style={{ left: `${predictionPercentage}%` }}></div></div><div className="flex justify-between text-[8px] font-mono text-gray-500 mt-1"><span>{formatCurrency(analysis.futurePrediction.targetLow)}</span><span>{formatCurrency(analysis.futurePrediction.targetHigh)}</span></div></div>
                )}
            </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 space-y-4 pb-2">
            
            {/* Logic & Reasoning */}
            <div className="bg-[#0b1215]/50 p-4 rounded-xl border border-gray-800/50 hover:border-gray-700 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                    <BrainCircuit className="w-3 h-3 text-purple-400" />
                    <span className="text-[10px] text-purple-200 font-bold uppercase tracking-wider">底层逻辑解析 (Reasoning)</span>
                </div>
                <div className="text-xs text-gray-300/90 font-light">
                     <Typewriter text={analysis.reasoning} speed={5} />
                </div>
            </div>

            {/* Red Teaming Terminal */}
            <div>
                 <div className="flex items-center justify-between mb-2 px-1">
                     <div className="flex items-center gap-2 text-[10px] text-red-400 font-bold uppercase tracking-widest">
                        <ShieldAlert className="w-3 h-3" /> 红队对抗演练 (Critic Protocol)
                     </div>
                     <RadialProgress score={analysis.modelFusionConfidence} size={28} strokeWidth={3} />
                 </div>
                 <CriticTerminal logic={analysis.redTeamingLogic} />
            </div>

            {/* Gurus */}
            <div>
                 <div className="text-[10px] text-gray-600 font-bold uppercase px-1 mb-2 flex items-center gap-2 tracking-widest"><Users className="w-3 h-3" /> 大师观点 (COUNCIL)</div>
                 <div className="grid grid-cols-2 gap-2">{analysis.guruInsights && analysis.guruInsights.map((guru, idx) => (<div key={idx} className="bg-[#0b1215] border border-gray-800 p-3 rounded-xl flex flex-col gap-2 hover:bg-[#111820] transition-colors group"><div className="flex items-center justify-between"><span className="text-[9px] font-bold text-gray-400 truncate group-hover:text-white transition-colors">{guru.name}</span><span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${getVerdictStyle(guru.verdict)}`}>{guru.verdict}</span></div><div className="text-[9px] text-gray-500 italic truncate border-l-2 border-gray-800 pl-2 group-hover:border-gray-600 transition-colors">"{guru.quote}"</div></div>))}</div>
            </div>
        </div>
        <button onClick={onAnalyze} disabled={loading} className="mt-4 w-full py-3 bg-white hover:bg-gray-200 border border-transparent disabled:opacity-50 text-black text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]"><RefreshCcwIcon className="w-4 h-4" /> 重启深度分析</button>
    </div>
  );
};

const RadarItem = ({ label, value, icon, color }: any) => (
    <div className="bg-[#0b1215] rounded-xl p-3 border border-gray-800 flex flex-col gap-1.5 hover:border-gray-700 transition-colors"><div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-bold uppercase">{icon} {label}</div><div className={`text-[10px] font-bold truncate ${color}`}>{value}</div></div>
);

const RefreshCcwIcon = ({className}: {className?: string}) => (<svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74-2.74L3 12" /><path d="M3 3v9h9" /></svg>);
export default AnalysisCard;