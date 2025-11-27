
import React from 'react';
import { X, Check, BrainCircuit, Target, Percent } from 'lucide-react';
import { StrategyItem } from '../types';
import { STRATEGIES } from '../constants';

interface StrategyConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeStrategyIds: string[];
  onToggleStrategy: (id: string) => void;
}

const StrategyConfigModal: React.FC<StrategyConfigModalProps> = ({ 
  isOpen, 
  onClose, 
  activeStrategyIds, 
  onToggleStrategy 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#151c24] border border-gray-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-gray-800 flex items-center justify-between shrink-0 bg-gradient-to-r from-purple-900/20 to-transparent">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BrainCircuit className="text-purple-500 w-5 h-5" />
              AI 战法配置 (Strategy Engine)
            </h2>
            <p className="text-xs text-gray-400 mt-1">选择 Gemini 3 Pro 在分析时应优先匹配的高胜率模型。</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-800 rounded-full hover:bg-gray-700 text-gray-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 gap-4">
            {STRATEGIES.map((strategy) => {
              const isActive = activeStrategyIds.includes(strategy.id);
              return (
                <div 
                  key={strategy.id}
                  onClick={() => onToggleStrategy(strategy.id)}
                  className={`
                    relative p-4 rounded-xl border-2 transition-all cursor-pointer group
                    ${isActive 
                      ? 'bg-purple-500/10 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.1)]' 
                      : 'bg-[#0b1215] border-gray-800 hover:border-gray-700'
                    }
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`font-bold text-sm ${isActive ? 'text-white' : 'text-gray-400'}`}>
                          {strategy.name}
                        </span>
                        <span className="text-[10px] bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded border border-gray-700 flex items-center gap-1">
                           <Target className="w-3 h-3" /> Win: {strategy.winRate}
                        </span>
                      </div>
                      <p className={`text-xs leading-relaxed ${isActive ? 'text-purple-200/80' : 'text-gray-500'}`}>
                        {strategy.description}
                      </p>
                    </div>
                    
                    <div className={`
                      w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                      ${isActive ? 'bg-purple-500 border-purple-500' : 'border-gray-600 group-hover:border-gray-500'}
                    `}>
                      {isActive && <Check className="w-4 h-4 text-white" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-[#0b1215] flex justify-between items-center">
            <span className="text-xs text-gray-500">
                已启用 {activeStrategyIds.length} / {STRATEGIES.length} 个模型
            </span>
            <button 
                onClick={onClose}
                className="bg-white text-black hover:bg-gray-200 px-6 py-2 rounded-lg text-sm font-bold transition-colors"
            >
                保存配置 (Save)
            </button>
        </div>

      </div>
    </div>
  );
};

export default StrategyConfigModal;
