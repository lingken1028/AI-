import React, { useState, useEffect } from 'react';
import { AIAnalysis, SignalType, RedTeaming, TradingSetup, TrinityConsensus, SmartMoneyAnalysis } from '../types';
import { formatCurrency } from '../constants';
import { TrendingUp, TrendingDown, Minus, ShieldAlert, Target, Activity, Zap, Globe, Bot, History, Loader2, BrainCircuit, Crosshair, CheckCircle2, ListChecks, CandlestickChart, Users, Cpu, AlertTriangle, ArrowRight, Gauge, BarChart3, Layers, Lock, Unlock, Terminal, Quote, Navigation, GitMerge, Sliders, Radar, Radio, BarChart4, ShieldCheck, Check, Search, Siren, HelpCircle, ArrowUpRight, ArrowDownRight, Briefcase, BarChart2, GitCommit, ChevronRight, PenTool, AlertOctagon, Scale, Wallet, LineChart, Eye, ScanLine } from 'lucide-react';

interface AnalysisCardProps {
  analysis: AIAnalysis | null;
  loading: boolean;
  error?: string | null;
  onAnalyze: () => void;
  symbol: string;
}

// FIX: Deterministic Typewriter to prevent character duplication stutter
const Typewriter = ({ text, speed = 10 }: { text: string; speed?: number }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    if (!text) {
        setDisplayedText('');
        return;
    }
    
    let i = 0;
    // Reset immediately
    setDisplayedText('');
    
    const timer = setInterval(() => {
      // Use slice (deterministic) instead of appending (state-dependent)
      // This prevents "double typing" issues in React Strict Mode
      setDisplayedText(text.slice(0, i));
      i++;
      if (i > text.length) {
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
  if (lower.includes('bullish') || lower.includes('多头')) return '多头结构 (Bullish)';
  if (lower.includes('bearish') || lower.includes('空头')) return '空头结构 (Bearish)';
  if (lower.includes('ranging') || lower.includes('consolidation') || lower.includes('震荡')) return '震荡整理 (Ranging)';
  return term; 
};

// Driver Item Component
const ScoreDriverItem = ({ label, weight, score, color, icon }: { label: string, weight: number, score: number, color: string, icon: React.ReactNode }) => {
    const contribution = (score * (weight / 100)).toFixed(1);

    return (
        <div className="flex flex-col gap-1.5 bg-[#1a232e] p-2.5 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors shadow-sm">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-500">
                <span className="flex items-center gap-1.5">{icon} {label}</span>
                <span className="opacity-50 text-[9px] font-mono">{weight}%</span>
            </div>
            
            <div className="flex items-end justify-between mt-1">
                 <span className={`text-xl font-bold font-mono leading-none ${color}`}>{score}</span>
                 <span className="text-[9px] text-gray-600 font-mono mb-0.5">+{contribution}%</span>
            </div>
            
            {/* Progress Bar */}
            <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden mt-1">
                <div 
                    className={`h-full rounded-full ${color.replace('text-', 'bg-')} transition-all duration-1000 ease-out`} 
                    style={{ width: `${score}%` }}
                ></div>
            </div>
        </div>
    );
};

// NEW: Trinity Consensus UI
const TrinityConsensusCard = ({ consensus, smartMoney, hasVisual }: { consensus: TrinityConsensus, smartMoney?: SmartMoneyAnalysis, hasVisual?: boolean }) => {
    const getVerdictColor = (v: string) => v.includes('STRONG') ? 'text-green-400 bg-green-500/10 border-green-500/30' : v.includes('DIVERGENCE') ? 'text-red-400 bg-red-500/10 border-red-500/30' : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
    
    return (
        <div className="bg-[#0b1215] rounded-xl p-4 border border-gray-800 relative overflow-hidden group hover:border-blue-500/20 transition-colors">
             <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity"><Scale className="w-20 h-20 text-blue-500"/></div>
             
             <div className="flex justify-between items-start mb-4 border-b border-gray-800/50 pb-2">
                 <h3 className="text-gray-500 text-[10px] font-bold uppercase flex items-center gap-2 tracking-widest">
                    <Scale className="w-3 h-3 text-blue-400" /> 三位一体共识 (Trinity Consensus)
                 </h3>
                 <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${getVerdictColor(consensus.consensusVerdict)}`}>
                    {consensus.consensusVerdict}
                 </span>
             </div>

             <div className="grid grid-cols-3 gap-3 mb-4">
                 <div className="bg-[#151c24] p-2 rounded-lg text-center border border-gray-800">
                     <div className="text-[9px] text-gray-500 font-bold uppercase mb-1">量化派 (Quant)</div>
                     <div className="text-lg font-mono font-bold text-blue-400">{consensus.quantScore}</div>
                 </div>
                 <div className="bg-[#151c24] p-2 rounded-lg text-center border border-gray-800">
                     <div className="text-[9px] text-gray-500 font-bold uppercase mb-1">资金派 (Money)</div>
                     <div className="text-lg font-mono font-bold text-yellow-400">{consensus.smartMoneyScore}</div>
                 </div>
                 <div className="bg-[#151c24] p-2 rounded-lg text-center border border-gray-800 relative overflow-hidden">
                     {/* Visual Indicator */}
                     {hasVisual && <div className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-indigo-500/20" title="Vision Model Active"><Eye className="w-2.5 h-2.5 text-indigo-400 animate-pulse"/></div>}
                     <div className="text-[9px] text-gray-500 font-bold uppercase mb-1 flex items-center justify-center gap-1">技术派 (Chart)</div>
                     <div className="text-lg font-mono font-bold text-purple-400">{consensus.chartPatternScore}</div>
                 </div>
             </div>

             {/* Smart Money Insight */}
             {smartMoney && (
                <div className="bg-[#151c24]/50 rounded-lg p-2 border border-gray-800/50 flex justify-between items-center text-[10px]">
                    <div className="flex items-center gap-2">
                         <div className={`w-2 h-2 rounded-full ${smartMoney.smartMoneyAction.includes('Accumulating') || smartMoney.smartMoneyAction.includes('Marking Up') ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                         <span className="text-gray-400">主力动作: <span className="text-white font-bold">{smartMoney.smartMoneyAction}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500">散户情绪:</span>
                        <span className={`${smartMoney.retailSentiment === 'Greed' ? 'text-green-400' : smartMoney.retailSentiment === 'Fear' ? 'text-red-400' : 'text-gray-400'} font-bold`}>{smartMoney.retailSentiment}</span>
                    </div>
                </div>
             )}
        </div>
    );
};

// NEW: Trading Blueprint Component
const LogicBlueprint = ({ setup }: { setup: TradingSetup }) => {
    return (
        <div className="bg-[#151c24] border border-blue-500/20 rounded-xl overflow-hidden relative group">
            {/* Blueprint Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(59,130,246,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(59,130,246,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
            
            <div className="p-4 relative z-10">
                <h3 className="text-[10px] text-blue-400 font-bold uppercase mb-4 flex items-center gap-2 tracking-widest border-b border-blue-500/20 pb-2">
                    <PenTool className="w-3 h-3" /> 交易逻辑蓝图 (Architect Blueprint)
                </h3>

                <div className="grid grid-cols-1 gap-4">
                     {/* Identity */}
                     <div className="flex items-center gap-3">
                        <div className="text-[9px] text-gray-500 uppercase font-bold shrink-0">核心策略形态</div>
                        <div className="font-mono text-sm text-white font-bold bg-blue-500/10 border border-blue-500/30 px-3 py-1 rounded-md flex-1 truncate">
                            {setup.strategyIdentity || "Structure Analysis"}
                        </div>
                     </div>

                     {/* Triggers */}
                     <div>
                        <div className="text-[9px] text-gray-500 uppercase font-bold mb-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500"/> 进场信号 (Triggers)</div>
                        <ul className="space-y-2">
                            {setup.confirmationTriggers.map((trigger, idx) => (
                                <li key={idx} className="flex gap-2 text-[11px] text-gray-300 bg-[#0b1215] p-1.5 rounded border border-gray-800/50">
                                    <span className="text-blue-500 font-mono font-bold">[{idx+1}]</span>
                                    <span>{trigger}</span>
                                </li>
                            ))}
                        </ul>
                     </div>

                     {/* Invalidation */}
                     <div>
                        <div className="text-[9px] text-gray-500 uppercase font-bold mb-2 flex items-center gap-1"><AlertOctagon className="w-3 h-3 text-red-500"/> 止损/失效条件 (Invalidation)</div>
                        <div className="text-[11px] text-red-300 bg-red-900/10 border border-red-500/30 p-2 rounded-lg leading-relaxed flex items-start gap-2">
                            <span className="text-red-500 font-bold">!</span>
                            {setup.invalidationPoint}
                        </div>
                     </div>
                </div>
            </div>
        </div>
    );
};


// Enhanced Threat Report Parser with Terminal Aesthetic (Structured Data)
const CriticTerminal = ({ redTeam }: { redTeam: RedTeaming }) => {
    
    // Severity Logic
    const severityColor = 
        redTeam.severity === 'CRITICAL' ? 'text-red-500 animate-pulse' :
        redTeam.severity === 'HIGH' ? 'text-red-400' :
        redTeam.severity === 'MEDIUM' ? 'text-yellow-400' :
        'text-blue-400';
    
    const severityBg = 
        redTeam.severity === 'CRITICAL' ? 'bg-red-500/20 border-red-500' :
        redTeam.severity === 'HIGH' ? 'bg-red-500/10 border-red-500/50' :
        redTeam.severity === 'MEDIUM' ? 'bg-yellow-500/10 border-yellow-500/50' :
        'bg-blue-500/10 border-blue-500/50';

    return (
        <div className="bg-[#0c0c0c] rounded-xl border border-gray-800 p-4 font-mono text-xs relative overflow-hidden group shadow-inner">
            {/* Terminal Scan Line */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-white/5 animate-[scan_3s_linear_infinite] z-10 pointer-events-none"></div>
            
            <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-2">
                <span className="text-gray-500 font-bold uppercase flex items-center gap-2 tracking-widest">
                   <ShieldAlert className="w-3 h-3 text-purple-400" />
                   CRITIC_PROTOCOL.LOG
                </span>
                <div className={`px-2 py-0.5 rounded text-[9px] font-bold border ${severityBg} ${severityColor}`}>
                    DEFCON_{redTeam.severity}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {/* Stress Test */}
                <div className="bg-[#1a1a1a] p-3 rounded border border-gray-800">
                    <span className="text-purple-400 font-bold text-[9px] block mb-1">>> STRESS_TEST (压力测试)</span>
                    <span className="text-gray-300 leading-relaxed">{redTeam.stressTest}</span>
                </div>

                {/* Risks Section */}
                <div className="space-y-2">
                    <div className="text-red-400 font-bold flex items-center gap-2 text-[10px] uppercase">
                        <Siren className="w-3 h-3" />
                        <span>DETECTED_RISKS (潜在风险)</span>
                    </div>
                    <ul className="space-y-1.5">
                        {redTeam.risks.map((t, i) => (
                            <li key={i} className="flex gap-3 text-red-200/80 leading-relaxed hover:text-red-200 transition-colors bg-red-900/5 p-1 rounded">
                                <span className="text-red-500 font-bold shrink-0 opacity-50">[{i+1}]</span>
                                <span>{t}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Mitigations Section */}
                <div className="space-y-2">
                     <div className="text-blue-400 font-bold flex items-center gap-2 text-[10px] uppercase">
                        <ShieldCheck className="w-3 h-3" />
                        <span>MITIGATION_PROTOCOLS (应对策略)</span>
                    </div>
                    <ul className="space-y-1.5">
                        {redTeam.mitigations.map((m, i) => (
                            <li key={i} className="flex gap-3 text-blue-200/80 leading-relaxed hover:text-blue-200 transition-colors bg-blue-900/5 p-1 rounded">
                                <span className="text-blue-500 font-bold shrink-0 opacity-50">>></span>
                                <span>{m}</span>
                            </li>
                        ))}
                    </ul>
                </div>
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
        { id: 2, text: "正在推演牛熊剧本与概率...", sub: "Scenario Deduction Calculation", icon: GitCommit, color: "text-purple-400", bg: "bg-purple-500" },
        { id: 3, text: "构建交易逻辑蓝图 (Architect)...", sub: "Constructing Trade Blueprint", icon: PenTool, color: "text-cyan-400", bg: "bg-cyan-500" },
        { id: 4, text: "红队风控正在进行压力测试...", sub: "Running Red Team Stress Test", icon: ShieldAlert, color: "text-red-400", bg: "bg-red-500" }
    ];

    useEffect(() => {
        // Extended timings for Pro (Total ~15s)
        const timings = [3000, 3500, 3000, 2500, 3000];
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
  
  // Header Tooltip States
  const [showWinRateTip, setShowWinRateTip] = useState(false);
  const [showHistoryTip, setShowHistoryTip] = useState(false);

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
        
        <h3 className="text-2xl font-black text-white mb-2 tracking-tight">Gemini 3 Pro <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Trinity</span></h3>
        <p className="text-gray-500 text-xs mb-8 max-w-[260px] leading-relaxed">
            启动机构级全景态势感知。三位一体共识校验 (Trinity Consensus)，寻找最严谨的交易机会。
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
    <div className="bg-[#151c24] rounded-xl border border-gray-800 p-6 flex flex-col h-full relative shadow-2xl">
        {isRefreshing && (
          <div className="absolute inset-0 bg-[#151c24]/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center transition-opacity duration-300 rounded-xl">
             <div className="bg-[#0b1215]/90 p-6 rounded-2xl border border-gray-700 shadow-2xl flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                <p className="text-xs text-white font-bold uppercase tracking-widest">正在重新推演 (Re-Evaluating)...</p>
             </div>
          </div>
        )}

        {/* 1. HEADER & VERDICT */}
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
            
            {/* 2. DRIVERS */}
            <div className="mt-4 flex flex-col gap-2">
                <div 
                    className="flex items-center gap-3 text-xs group relative cursor-pointer"
                    onClick={() => setShowWinRateTip(!showWinRateTip)}
                    onMouseEnter={() => setShowWinRateTip(true)}
                    onMouseLeave={() => setShowWinRateTip(false)}
                >
                    <div className="text-gray-500 font-bold uppercase text-[10px] tracking-wide border-b border-dotted border-gray-600 flex items-center gap-1">
                        胜率推演 (Calculated Win Rate) <HelpCircle className="w-3 h-3 text-gray-600 group-hover:text-blue-400"/>
                    </div>
                    <div className="h-2 w-24 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                        <div className={`h-full rounded-full transition-all duration-1000 ${isBuy ? 'bg-green-500' : isSell ? 'bg-red-500' : 'bg-gray-500'}`} style={{ width: `${analysis.winRate}%` }}></div>
                    </div>
                    <span className="font-mono font-bold text-white text-lg">{analysis.winRate}%</span>
                    
                    {/* Header Tooltip */}
                     {showWinRateTip && (
                        <div className="absolute top-full left-0 mt-2 w-56 bg-gray-900 border border-gray-700 p-3 rounded-lg z-50 text-[10px] text-gray-300 shadow-xl pointer-events-none">
                            <strong className="text-white block mb-1">胜率计算逻辑</strong>
                            <p className="leading-relaxed opacity-80">综合技术指标、主力资金、市场情绪及宏观环境四维因子加权计算得出。</p>
                        </div>
                    )}
                </div>
                
                {/* Score Drivers Grid */}
                {analysis.scoreDrivers && (
                    <div className="mt-3">
                        <h4 className="text-[9px] text-gray-600 font-bold uppercase mb-2 flex items-center gap-1"><Sliders className="w-3 h-3"/> 胜率归因因子 (Score Drivers)</h4>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 w-full">
                             <ScoreDriverItem label="技术 (Tech)" weight={40} score={analysis.scoreDrivers.technical} color="text-blue-400" icon={<Activity className="w-3 h-3"/>} />
                             <ScoreDriverItem label="资金 (Flow)" weight={30} score={analysis.scoreDrivers.institutional} color="text-yellow-400" icon={<Wallet className="w-3 h-3"/>} />
                             <ScoreDriverItem label="情绪 (Sent)" weight={20} score={analysis.scoreDrivers.sentiment} color="text-green-400" icon={<Users className="w-3 h-3"/>} />
                             <ScoreDriverItem label="宏观 (Macr)" weight={10} score={analysis.scoreDrivers.macro} color="text-purple-400" icon={<Globe className="w-3 h-3"/>} />
                        </div>
                    </div>
                )}
            </div>
          </div>
          
          <div className="text-right flex flex-col items-end gap-3">
              <div 
                  className="bg-[#0b1215] p-3 rounded-xl border border-gray-800 flex flex-col items-end gap-1 group relative cursor-pointer hover:border-blue-500/30 transition-colors"
                  onClick={() => setShowHistoryTip(!showHistoryTip)}
                  onMouseEnter={() => setShowHistoryTip(true)}
                  onMouseLeave={() => setShowHistoryTip(false)}
              >
                  <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                    <History className="w-3 h-3" /> 历史模式回测
                    <HelpCircle className="w-3 h-3 text-gray-700 group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"/>
                  </div>
                  <span className="text-2xl font-mono font-medium text-blue-400">{analysis.historicalWinRate}%</span>
                  
                   {/* History Tooltip */}
                   {showHistoryTip && (
                        <div className="absolute top-full right-0 mt-2 w-56 bg-gray-900 border border-gray-700 p-3 rounded-lg z-50 text-[10px] text-gray-300 shadow-xl pointer-events-none text-left">
                            <strong className="text-white block mb-1">模式回测说明</strong>
                            <p className="leading-relaxed opacity-80">系统检索了过去 5 年中与当前 K 线形态相似度超过 85% 的历史行情，统计其后续上涨概率。</p>
                        </div>
                    )}
              </div>
              <div className="flex items-center gap-2 bg-[#0b1215] px-3 py-1.5 rounded-lg border border-gray-800/50"><span className="text-[9px] text-gray-500 font-bold uppercase">盈亏比 (R/R)</span><span className="text-xs font-mono font-bold text-white">{analysis.riskRewardRatio}:1</span></div>
          </div>
        </div>

        {/* Scrollable Content - With visual "Logic Chain" line */}
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 relative pl-2">
            
            {/* Logic Chain Visual Guide (Vertical Line) */}
            <div className="absolute left-1.5 top-4 bottom-4 w-0.5 bg-gradient-to-b from-blue-500/0 via-blue-500/20 to-blue-500/0 hidden lg:block"></div>
            
            <div className="space-y-6 pb-2 lg:pl-8">
                {/* 3. SCENARIO DEDUCTION SECTION */}
                {analysis.scenarios && (
                <div className="bg-[#0b1215] rounded-xl p-5 border border-gray-800 relative overflow-hidden group hover:border-purple-500/20 transition-colors">
                    <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity"><GitCommit className="w-20 h-20 text-purple-500"/></div>
                    <h3 className="text-gray-500 text-[10px] font-bold uppercase mb-4 flex items-center gap-2 tracking-widest border-b border-gray-800/50 pb-2">
                        <GitMerge className="w-3 h-3 text-purple-400" /> 情景推演计算 (Calculated Deductions)
                    </h3>

                    <div className="grid grid-cols-1 gap-4">
                        {/* Bullish */}
                        <div className="group/item">
                        <div className="flex justify-between text-xs items-center mb-1">
                            <span className="font-bold text-green-400 flex items-center gap-2 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                                <ArrowUpRight className="w-3.5 h-3.5"/> 牛市剧本 (Bullish)
                            </span>
                            <span className="font-mono text-white text-sm font-bold">{analysis.scenarios.bullish.probability}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden mb-2">
                            <div className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full" style={{ width: `${analysis.scenarios.bullish.probability}%` }}></div>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-gray-500 bg-[#151c24] p-2 rounded-lg border border-gray-800/50">
                            <span className="text-gray-400 leading-relaxed max-w-[70%]">{analysis.scenarios.bullish.description}</span>
                            <div className="text-right">
                                <div className="text-[9px] uppercase font-bold text-gray-600">Target</div>
                                <div className="font-mono text-green-300 font-bold">{formatCurrency(analysis.scenarios.bullish.targetPrice)}</div>
                            </div>
                        </div>
                        </div>

                        {/* Neutral */}
                        <div className="group/item">
                        <div className="flex justify-between text-xs items-center mb-1">
                            <span className="font-bold text-yellow-400 flex items-center gap-2 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                                <Minus className="w-3.5 h-3.5"/> 震荡剧本 (Neutral)
                            </span>
                            <span className="font-mono text-white text-sm font-bold">{analysis.scenarios.neutral.probability}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden mb-2">
                            <div className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 rounded-full" style={{ width: `${analysis.scenarios.neutral.probability}%` }}></div>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-gray-500 bg-[#151c24] p-2 rounded-lg border border-gray-800/50">
                            <span className="text-gray-400 leading-relaxed max-w-[70%]">{analysis.scenarios.neutral.description}</span>
                            <div className="text-right">
                                <div className="text-[9px] uppercase font-bold text-gray-600">Range</div>
                                <div className="font-mono text-yellow-300 font-bold">{formatCurrency(analysis.scenarios.neutral.targetPrice)}</div>
                            </div>
                        </div>
                        </div>

                        {/* Bearish */}
                        <div className="group/item">
                        <div className="flex justify-between text-xs items-center mb-1">
                            <span className="font-bold text-red-400 flex items-center gap-2 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                                <ArrowDownRight className="w-3.5 h-3.5"/> 熊市剧本 (Bearish)
                            </span>
                            <span className="font-mono text-white text-sm font-bold">{analysis.scenarios.bearish.probability}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden mb-2">
                            <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full" style={{ width: `${analysis.scenarios.bearish.probability}%` }}></div>
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-gray-500 bg-[#151c24] p-2 rounded-lg border border-gray-800/50">
                            <span className="text-gray-400 leading-relaxed max-w-[70%]">{analysis.scenarios.bearish.description}</span>
                            <div className="text-right">
                                <div className="text-[9px] uppercase font-bold text-gray-600">Target</div>
                                <div className="font-mono text-red-300 font-bold">{formatCurrency(analysis.scenarios.bearish.targetPrice)}</div>
                            </div>
                        </div>
                        </div>
                    </div>
                </div>
                )}
                
                {/* 4. EVIDENCE LAYER (Consensus + Technicals) */}
                <div className="space-y-4">
                    
                    {/* TRINITY CONSENSUS CARD */}
                    {analysis.trinityConsensus && (
                        <div className="relative">
                            {/* Visual connector dot */}
                            <div className="absolute -left-[37px] top-6 w-3 h-3 rounded-full bg-blue-500 border-2 border-[#151c24] z-10 hidden lg:block shadow-[0_0_10px_#3b82f6]"></div>
                            <TrinityConsensusCard 
                                consensus={analysis.trinityConsensus} 
                                smartMoney={analysis.smartMoneyAnalysis} 
                                hasVisual={!!analysis.visualAnalysis}
                            />
                        </div>
                    )}
                    
                    {/* NEW: VISUAL ANALYSIS CARD (Integrate right below consensus if present) */}
                    {analysis.visualAnalysis && (
                        <div className="bg-indigo-900/10 rounded-xl p-4 border border-indigo-500/30 relative overflow-hidden group ml-1">
                             <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500/50"></div>
                             <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity"><Eye className="w-16 h-16 text-indigo-500"/></div>
                             <div className="flex items-center gap-2 mb-2">
                                <span className="bg-indigo-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">PRIMARY SOURCE</span>
                                <h3 className="text-indigo-400 text-[10px] font-bold uppercase flex items-center gap-2 tracking-widest">
                                    <ScanLine className="w-3 h-3" /> AI 视觉洞察 (Vision Insights)
                                </h3>
                             </div>
                            <div className="text-xs text-indigo-200/90 leading-relaxed font-light">
                                <Typewriter text={analysis.visualAnalysis} speed={5} />
                            </div>
                        </div>
                    )}
                
                    {/* Technical Cockpit */}
                    {analysis.technicalIndicators && (
                        <div className="bg-[#0b1215] rounded-xl p-4 border border-gray-800 relative overflow-hidden group hover:border-blue-500/20 transition-colors">
                            <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity"><Cpu className="w-16 h-16 text-blue-500"/></div>
                            <h3 className="text-gray-500 text-[10px] font-bold uppercase mb-4 flex items-center gap-2 tracking-widest border-b border-gray-800/50 pb-2">
                                <Activity className="w-3 h-3 text-blue-400" /> 技术仪表盘 (Technical Evidence)
                            </h3>
                            
                            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                                {/* RSI */}
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between text-[9px] text-gray-500 font-bold uppercase"><span>RSI</span> <span className={analysis.technicalIndicators.rsi > 70 ? 'text-red-400' : analysis.technicalIndicators.rsi < 30 ? 'text-green-400' : 'text-blue-400'}>{analysis.technicalIndicators.rsi}</span></div>
                                    <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden flex relative"><div className="absolute left-0 w-[30%] h-full bg-green-500/20"></div><div className="absolute right-0 w-[30%] h-full bg-red-500/20"></div><div className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_8px_white] transition-all duration-1000 z-10" style={{ left: `${analysis.technicalIndicators.rsi}%` }}></div></div>
                                </div>
                                {/* KDJ */}
                                <div className="flex flex-col gap-1.5"><div className="text-[9px] text-gray-500 font-bold uppercase">KDJ</div><div className="flex items-center gap-2">{analysis.technicalIndicators.kdjStatus ? (<span className={`text-[10px] font-bold px-2 py-0.5 rounded border w-fit flex items-center gap-1 ${analysis.technicalIndicators.kdjStatus.includes('Golden') || analysis.technicalIndicators.kdjStatus.includes('金叉') ? 'text-green-400 border-green-500/30 bg-green-900/20' : analysis.technicalIndicators.kdjStatus.includes('Death') || analysis.technicalIndicators.kdjStatus.includes('死叉') ? 'text-red-400 border-red-500/30 bg-red-900/20' : 'text-gray-400 border-gray-700 bg-gray-800'}`}>{analysis.technicalIndicators.kdjStatus}</span>) : <span className="text-[10px] text-gray-600">--</span>}</div></div>
                                {/* MACD */}
                                <div className="flex flex-col gap-1.5 border-t border-gray-800/50 pt-2"><div className="text-[9px] text-gray-500 font-bold uppercase">MACD</div><div className={`text-[10px] font-bold px-2 py-0.5 rounded border w-fit flex items-center gap-1 ${analysis.technicalIndicators.macdStatus.includes('Golden') || analysis.technicalIndicators.macdStatus.includes('金叉') ? 'text-green-400 border-green-500/30 bg-green-900/20' : analysis.technicalIndicators.macdStatus.includes('Death') || analysis.technicalIndicators.macdStatus.includes('死叉') ? 'text-red-400 border-red-500/30 bg-red-900/20' : 'text-gray-400 border-gray-700 bg-gray-800'}`}>{analysis.technicalIndicators.macdStatus}</div></div>
                                {/* Volume */}
                                <div className="flex flex-col gap-1.5 border-t border-gray-800/50 pt-2"><div className="text-[9px] text-gray-500 font-bold uppercase">量能 (Vol)</div><span className="text-[10px] text-white font-mono flex items-center gap-2"><BarChart2 className="w-3 h-3 text-blue-400" />{analysis.technicalIndicators.volumeStatus || "Normal"}</span></div>
                            </div>
                            {/* Institutional */}
                            {analysis.institutionalData && (
                                <div className="mt-4 pt-3 border-t border-gray-800/50 grid grid-cols-2 gap-3 bg-[#151c24]/50 -mx-4 -mb-4 px-4 py-3">
                                    <div className="flex flex-col"><span className="text-[9px] text-gray-500 uppercase font-bold flex gap-1 items-center"><Briefcase className="w-3 h-3"/> 主力净流入</span><span className={`text-xs font-mono font-bold ${analysis.institutionalData.netInflow.includes('-') ? 'text-red-400' : 'text-green-400'}`}>{analysis.institutionalData.netInflow}</span></div>
                                    <div className="flex flex-col items-end"><span className="text-[9px] text-gray-500 uppercase font-bold">大单活跃度</span><span className="text-xs font-mono text-white">{analysis.institutionalData.blockTrades}</span></div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Reasoning Text (Analysis Note) */}
                    <div className="bg-[#0b1215]/50 p-4 rounded-xl border border-gray-800/50 hover:border-gray-700 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                            <BrainCircuit className="w-3 h-3 text-purple-400" />
                            <span className="text-[10px] text-purple-200 font-bold uppercase tracking-wider">底层逻辑解析 (Analysis Logic)</span>
                        </div>
                        <div className="text-xs text-gray-300/90 font-light leading-relaxed">
                            <Typewriter text={analysis.reasoning} speed={3} />
                        </div>
                    </div>
                </div>

                {/* 5. STRATEGY BLUEPRINT & EXECUTION (ACTION LAYER) */}
                {analysis.tradingSetup && (
                    <div className="space-y-4 relative">
                        {/* Visual connector dot */}
                        <div className="absolute -left-[37px] top-6 w-3 h-3 rounded-full bg-cyan-500 border-2 border-[#151c24] z-10 hidden lg:block shadow-[0_0_10px_cyan]"></div>
                        
                        {/* The Blueprint */}
                        <LogicBlueprint setup={analysis.tradingSetup} />
                        
                        {/* Execution Map */}
                        <div className="bg-[#0b1215] rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-colors">
                            <h3 className="text-gray-500 text-[10px] font-bold uppercase mb-3 flex items-center gap-2 px-1 tracking-widest"><Crosshair className="w-3 h-3" /> 交易执行蓝图 (Execution Map)</h3>
                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="col-span-2 bg-blue-500/5 p-3 rounded-xl border border-blue-500/20 flex items-center justify-between group hover:bg-blue-500/10 transition-colors">
                                    <div className="flex flex-col gap-1"><div className="flex items-center gap-1.5 text-blue-400 text-[10px] font-bold uppercase"><Navigation className="w-3 h-3" /> 建议入场 (Entry)</div><div className="text-xs font-mono font-medium text-blue-200 opacity-80 group-hover:opacity-100">{analysis.entryStrategy || "等待信号 (Wait)"}</div></div>
                                    <div className="text-xl font-mono font-bold text-white tracking-tight">{formatCurrency(analysis.entryPrice)}</div>
                                </div>
                                <div className="bg-[#151c24] p-3 rounded-xl border border-gray-800 flex flex-col gap-1"><div className="flex items-center gap-1.5 text-green-400 text-[10px] font-bold uppercase"><Target className="w-3 h-3" /> 止盈目标 (TP)</div><div className="text-lg font-mono font-medium text-white">{formatCurrency(analysis.takeProfit)}</div></div>
                                <div className="bg-[#151c24] p-3 rounded-xl border border-gray-800 flex flex-col gap-1"><div className="flex items-center gap-1.5 text-red-400 text-[10px] font-bold uppercase"><ShieldAlert className="w-3 h-3" /> 止损风控 (SL)</div><div className="text-lg font-mono font-medium text-white">{formatCurrency(analysis.stopLoss)}</div></div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-[#151c24] p-3 rounded-xl border border-gray-800"><div className="flex justify-between items-center mb-2 border-b border-gray-800 pb-1"><span className="text-[9px] text-gray-500 uppercase font-bold">关键位 (Key Levels)</span></div><div className="flex justify-between text-xs font-mono"><span className="text-red-300">{formatCurrency(analysis.resistanceLevel || 0)}</span><span className="text-gray-600">/</span><span className="text-green-300">{formatCurrency(analysis.supportLevel || 0)}</span></div></div>
                                {analysis.futurePrediction && (
                                    <div className="bg-[#151c24] p-3 rounded-xl border border-gray-800 flex flex-col justify-center"><div className="flex items-center justify-between mb-2"><span className="text-[9px] text-blue-300 font-bold uppercase flex gap-1"><Activity className="w-3 h-3"/> 预测区间</span><span className="text-[9px] text-gray-500 font-mono">{analysis.futurePrediction.confidence}%</span></div><div className="relative h-1.5 bg-gray-800 rounded-full w-full overflow-hidden"><div className="absolute top-0 bottom-0 bg-blue-500/20 w-full"></div><div className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_white]" style={{ left: `${predictionPercentage}%` }}></div></div><div className="flex justify-between text-[8px] font-mono text-gray-500 mt-1"><span>{formatCurrency(analysis.futurePrediction.targetLow)}</span><span>{formatCurrency(analysis.futurePrediction.targetHigh)}</span></div></div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 6. RED TEAM CRITIC */}
                {analysis.redTeaming && (
                    <div className="relative">
                        {/* Visual connector dot */}
                        <div className="absolute -left-[37px] top-6 w-3 h-3 rounded-full bg-red-500 border-2 border-[#151c24] z-10 hidden lg:block shadow-[0_0_10px_red]"></div>
                        
                        <div className="flex items-center justify-between mb-2 px-1">
                            <div className="flex items-center gap-2 text-[10px] text-red-400 font-bold uppercase tracking-widest">
                                <ShieldAlert className="w-3 h-3" /> 红队对抗演练 (Critic Protocol)
                            </div>
                            <RadialProgress score={analysis.modelFusionConfidence} size={28} strokeWidth={3} />
                        </div>
                        <CriticTerminal redTeam={analysis.redTeaming} />
                    </div>
                )}
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