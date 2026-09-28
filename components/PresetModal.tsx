import React, { useState } from 'react';
import { Preset } from '../types';
import { Save, Trash2, X, FolderOpen, Disc } from 'lucide-react';

interface PresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  presets: Preset[];
  onLoad: (preset: Preset) => void;
  onSave: (name: string) => void;
  onDelete: (id: string) => void;
}

const PresetModal: React.FC<PresetModalProps> = ({ isOpen, onClose, presets, onLoad, onSave, onDelete }) => {
  const [saveName, setSaveName] = useState('');
  const [activeTab, setActiveTab] = useState<'load' | 'save'>('load');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#121212] border-2 border-[#1c1008] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.05)] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#222222] bg-[#1a1a1a]">
          <h2 className="text-neutral-200 font-bold flex items-center gap-2 tracking-wide text-sm">
            <Disc size={18} className="text-amber-500" />
            PRESET ARCHIVE
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-white transition-colors p-1 rounded hover:bg-neutral-800">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#222222] bg-[#0f0f0f]">
          <button 
            onClick={() => setActiveTab('load')}
            className={`flex-1 py-2.5 text-xs font-bold tracking-wider transition-colors border-b-2 ${activeTab === 'load' ? 'bg-[#1a1a1a] text-amber-500 border-amber-500' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
          >
            LOAD PRESET
          </button>
          <button 
            onClick={() => setActiveTab('save')}
            className={`flex-1 py-2.5 text-xs font-bold tracking-wider transition-colors border-b-2 ${activeTab === 'save' ? 'bg-[#1a1a1a] text-amber-500 border-amber-500' : 'border-transparent text-neutral-400 hover:text-neutral-200'}`}
          >
            SAVE PRESET
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto bg-[#141414]">
          {activeTab === 'load' ? (
            <div className="flex flex-col gap-2">
              {presets.map((preset) => (
                <div key={preset.id} className="flex items-center justify-between group p-2.5 bg-[#1a1a1a] hover:bg-[#242424] rounded-lg transition-colors border border-[#262626] hover:border-amber-500/50">
                  <div className="flex flex-col cursor-pointer flex-1" onClick={() => { onLoad(preset); onClose(); }}>
                    <span className="text-neutral-200 font-semibold text-sm group-hover:text-amber-400 transition-colors">{preset.name}</span>
                    <span className="text-[10px] text-neutral-400 uppercase font-mono tracking-wider">{preset.isUser ? 'User Patch' : 'Factory Calibration'}</span>
                  </div>
                  {preset.isUser && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(preset.id); }}
                      className="p-1.5 text-neutral-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 rounded hover:bg-neutral-800"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {presets.length === 0 && <p className="text-neutral-400 text-center py-4 text-xs font-mono">No presets found.</p>}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-neutral-300 tracking-wider">PATCH DESIGNATION</label>
                <input 
                  type="text" 
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. Acid Line 303"
                  className="bg-[#0a0a0a] border border-[#333333] rounded p-2.5 text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:border-amber-500 text-sm font-mono"
                  autoFocus
                />
              </div>
              <button 
                onClick={() => { if(saveName) { onSave(saveName); setSaveName(''); onClose(); } }}
                disabled={!saveName.trim()}
                className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs tracking-wider py-2.5 rounded shadow-[0_0_12px_rgba(245,158,11,0.3)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                STORE PRESET
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PresetModal;