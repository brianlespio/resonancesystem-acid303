import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Play, Square, RefreshCw, Zap, Volume2, Trash2, X, FolderOpen, Download, Cable, Activity, Layers, Copy, Link as LinkIcon, Settings2, Keyboard } from 'lucide-react';
import { AudioEngine } from './services/audioEngine';
import { PresetLibrary } from './services/presetLibrary';
import { exportToWav } from './services/audioExporter';
import { midiService } from './services/midiService';
import Knob from './components/Knob';
import Oscilloscope from './components/Oscilloscope';
import VuMeter from './components/VuMeter';
import PresetModal from './components/PresetModal';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import { SequenceStep, SynthParams, Waveform, DEFAULT_SEQUENCE, DEFAULT_PARAMS, NOTES, Preset } from './types';

export interface KnobDef {
  key: keyof SynthParams;
  label: string;
  min: number;
  max: number;
  step: number;
  section: string;
}

export const KNOB_DEFS: KnobDef[] = [
  { key: 'volume', label: 'Volume', min: 0, max: 1, step: 0.01, section: 'MSTR' },
  { key: 'tuning', label: 'Tune', min: -50, max: 50, step: 1, section: 'VCO' },
  { key: 'cutoff', label: 'Cutoff', min: 20, max: 1000, step: 15, section: 'VCF' },
  { key: 'resonance', label: 'Resonance', min: 0, max: 30, step: 0.5, section: 'VCF' },
  { key: 'envMod', label: 'Env Mod', min: 0, max: 5000, step: 50, section: 'VCF' },
  { key: 'decay', label: 'Decay', min: 0.1, max: 2.0, step: 0.05, section: 'ENV' },
  { key: 'accent', label: 'Accent', min: 0, max: 1, step: 0.05, section: 'ACC' },
  { key: 'tempo', label: 'Tempo', min: 60, max: 200, step: 1, section: 'MSTR' },
  { key: 'transpose', label: 'Transp', min: -12, max: 12, step: 1, section: 'VCO' },
  { key: 'distortion', label: 'Distort', min: 0, max: 10, step: 0.2, section: 'DRV' },
  { key: 'patternLength', label: 'Length', min: 1, max: 16, step: 1, section: 'MOD' },
  { key: 'slideTime', label: 'Slide Tm', min: 0.05, max: 0.4, step: 0.01, section: 'MOD' },
  { key: 'swing', label: 'Swing', min: 0, max: 100, step: 1, section: 'MOD' },
  { key: 'delayTime', label: 'Time', min: 0.05, max: 1.0, step: 0.02, section: 'DLY' },
  { key: 'delayFeedback', label: 'Fdbk', min: 0, max: 0.95, step: 0.02, section: 'DLY' },
  { key: 'delayMix', label: 'Mix', min: 0, max: 1, step: 0.02, section: 'DLY' },
];

const App: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [params, setParams] = useState<SynthParams>(DEFAULT_PARAMS);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  
  // Pattern Bank State
  const [patternBank, setPatternBank] = useState<SequenceStep[][]>(
    Array(8).fill(null).map((_, i) => i === 0 ? [...DEFAULT_SEQUENCE] : DEFAULT_SEQUENCE.map(s => ({...s, active: false})))
  );
  const [activePatternIdx, setActivePatternIdx] = useState(0); // The pattern currently playing
  const [viewPatternIdx, setViewPatternIdx] = useState(0);     // The pattern currently being edited
  const [nextPatternIdx, setNextPatternIdx] = useState<number | null>(null); // Queued for next bar

  // Chain Mode State
  const [chainMode, setChainMode] = useState(false);
  const [chainSelection, setChainSelection] = useState<number[]>([0]); // Default chain is just Pattern A

  // Derived state for current sequence being edited
  const sequence = useMemo(() => patternBank[viewPatternIdx], [patternBank, viewPatternIdx]);
  
  const [selectedStepId, setSelectedStepId] = useState<number | null>(null);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // MIDI State
  const [isMidiMapping, setIsMidiMapping] = useState(false);
  const [listeningParam, setListeningParam] = useState<string | null>(null);

  // Audio Engine Instance
  const engine = useRef<AudioEngine | null>(null);
  const paramsRef = useRef(params);
  const isPlayingRef = useRef(isPlaying);
  // Refs for chain logic to be accessible inside callbacks
  const chainModeRef = useRef(chainMode);
  const chainSelectionRef = useRef(chainSelection);
  const patternBankRef = useRef(patternBank);
  const activePatternIdxRef = useRef(activePatternIdx);
  const patternFlipTimerRef = useRef<number | null>(null);
  const midiHandlerRef = useRef<(id: string, value: number) => void>(() => {});

  useEffect(() => {
      paramsRef.current = params;
      isPlayingRef.current = isPlaying;
      chainModeRef.current = chainMode;
      chainSelectionRef.current = chainSelection;
      patternBankRef.current = patternBank;
      activePatternIdxRef.current = activePatternIdx;
  }, [params, isPlaying, chainMode, chainSelection, patternBank, activePatternIdx]);

  // Initialize Engine, Presets and MIDI
  useEffect(() => {
    engine.current = new AudioEngine(params);
    engine.current.setSequence(patternBank[0]);
    engine.current.setStepCallback((step) => {
        setCurrentStep(step);
        // Queue next pattern logic near end of bar (step 14 = 2nd to last 16th note)
        if (step === 14) {
            handleAutoQueue();
        }
    });
    
    // Fallback: update UI when engine internally swaps pattern (at step 0)
    engine.current.setPatternCompleteCallback(() => {
        // This runs when step 0 starts with a NEW sequence
        // We need to sync our UI state 'activePatternIdx' to match
        // Note: This needs careful sync with handleAutoQueue
    });
    
    setPresets(PresetLibrary.getPresets());
    midiService.init();
    midiService.setInputHandler((id, value) => midiHandlerRef.current(id, value));

    return () => {
      if (patternFlipTimerRef.current !== null) window.clearTimeout(patternFlipTimerRef.current);
      engine.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAutoQueue = () => {
      if (!engine.current) return;

      if (chainModeRef.current) {
          const currentChainIndex = chainSelectionRef.current.indexOf(activePatternIdxRef.current);
          let nextChainIndex = 0;

          if (currentChainIndex !== -1 && currentChainIndex < chainSelectionRef.current.length - 1) {
              nextChainIndex = currentChainIndex + 1;
          } else {
              nextChainIndex = 0;
          }

          const nextPatternId = chainSelectionRef.current[nextChainIndex];
          const nextSeq = patternBankRef.current[nextPatternId];

          engine.current.queueSequence(nextSeq);
          setNextPatternIdx(nextPatternId);

          const tempo = paramsRef.current.tempo;
          const stepTime = (60 / tempo) * 0.25;
          if (patternFlipTimerRef.current !== null) window.clearTimeout(patternFlipTimerRef.current);
          patternFlipTimerRef.current = window.setTimeout(() => {
              setActivePatternIdx(nextPatternId);
              setViewPatternIdx(nextPatternId);
              setNextPatternIdx(null);
              patternFlipTimerRef.current = null;
          }, stepTime * 2 * 1000);
      } else {
          // MANUAL QUEUE LOGIC
          // If user clicked a button (setting setNextPatternIdx), queue it now
          // We can't access React state 'nextPatternIdx' reliably here if it wasn't in a Ref, 
          // but we actually set queue immediately on click. 
          // This block checks if we need to do anything else.
      }
  };

  const handleMidiInput = (id: string, value: number) => {
    if (id === 'play_toggle' && value > 0.5) { 
       togglePlay();
       return;
    }
    if (id === 'tap_tempo' && value > 0.5) {
       handleTapTempo();
       return;
    }
    // ... (rest of midi handling same as before)
    if (id === 'waveform') {
        const wf = value > 0.5 ? Waveform.SQUARE : Waveform.SAWTOOTH;
        updateParam('waveform', wf);
        return;
    }
    let min = 0, max = 100;
    switch(id) {
        case 'volume': min = 0; max = 1; break;
        case 'cutoff': min = 20; max = 1000; break;
        case 'resonance': min = 0; max = 30; break;
        case 'envMod': min = 0; max = 5000; break;
        case 'decay': min = 0.1; max = 2.0; break;
        case 'accent': min = 0; max = 1; break;
        case 'distortion': min = 0; max = 10; break;
        case 'tempo': min = 60; max = 200; break;
        case 'tuning': min = -50; max = 50; break;
        case 'swing': min = 0; max = 100; break;
        case 'transpose': min = -12; max = 12; break;
        case 'delayTime': min = 0.05; max = 1.0; break;
        case 'delayFeedback': min = 0; max = 0.95; break;
        case 'delayMix': min = 0; max = 1; break;
        case 'patternLength': min = 1; max = 16; break;
        case 'slideTime': min = 0.05; max = 0.4; break;
    }
    const actualValue = min + (value * (max - min));
    updateParam(id as keyof SynthParams, actualValue as SynthParams[keyof SynthParams]);
  };
  midiHandlerRef.current = handleMidiInput;

  // Sync Params
  useEffect(() => { engine.current?.setParams(params); }, [params]);

  // Sync Current Edited Sequence (Instant update if editing currently playing pattern)
  useEffect(() => {
      if (viewPatternIdx === activePatternIdx) {
          engine.current?.setSequence(patternBank[viewPatternIdx]);
      }
  }, [patternBank, viewPatternIdx, activePatternIdx]);

  const togglePlay = async () => {
    if (!engine.current) return;
    if (isPlaying) {
      engine.current.stop();
      setIsPlaying(false);
      setCurrentStep(-1);
    } else {
      await engine.current.start();
      setAnalyserNode(engine.current.getAnalyser());
      setIsPlaying(true);
    }
  };

  const updateParam = <K extends keyof SynthParams>(key: K, value: SynthParams[K]) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  // Tap Tempo State & Dynamic Calculation Logic
  const [isTapActive, setIsTapActive] = useState(false);
  const tapTimesRef = useRef<number[]>([]);
  const tapTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Knob Selection for Keyboard & Tab Control
  const [selectedKnobKey, setSelectedKnobKey] = useState<keyof SynthParams>('cutoff');
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  const activeKnobDef = useMemo(() => {
    return KNOB_DEFS.find(k => k.key === selectedKnobKey) || KNOB_DEFS[1];
  }, [selectedKnobKey]);

  const selectNextKnob = useCallback(() => {
    const currentIndex = KNOB_DEFS.findIndex(k => k.key === selectedKnobKey);
    const nextIndex = (currentIndex + 1) % KNOB_DEFS.length;
    setSelectedKnobKey(KNOB_DEFS[nextIndex].key);
  }, [selectedKnobKey]);

  const selectPrevKnob = useCallback(() => {
    const currentIndex = KNOB_DEFS.findIndex(k => k.key === selectedKnobKey);
    const prevIndex = (currentIndex - 1 + KNOB_DEFS.length) % KNOB_DEFS.length;
    setSelectedKnobKey(KNOB_DEFS[prevIndex].key);
  }, [selectedKnobKey]);

  const adjustCurrentKnob = useCallback((direction: number, isFine: boolean = false) => {
    const def = KNOB_DEFS.find(k => k.key === selectedKnobKey);
    if (!def) return;
    const currentVal = paramsRef.current[selectedKnobKey] as number;
    const delta = def.step * (isFine ? 0.2 : 1) * direction;
    const newVal = Math.max(def.min, Math.min(def.max, currentVal + delta));
    const precision = def.step < 0.1 ? 100 : def.step < 1 ? 10 : 1;
    const rounded = Math.round(newVal * precision) / precision;
    updateParam(selectedKnobKey, rounded as SynthParams[keyof SynthParams]);
  }, [selectedKnobKey]);

  const handleTapTempo = useCallback(() => {
    const now = performance.now();
    const history = tapTimesRef.current;

    // Visual button illumination flash
    setIsTapActive(true);
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => setIsTapActive(false), 140);

    // If last tap was more than 2.5 seconds ago, reset history
    if (history.length > 0 && (now - history[history.length - 1] > 2500)) {
      tapTimesRef.current = [now];
      return;
    }

    history.push(now);

    // Keep up to 5 most recent taps for a responsive moving average
    if (history.length > 5) {
      history.shift();
    }

    // Need at least 2 taps to calculate the average interval
    if (history.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < history.length; i++) {
        intervals.push(history[i] - history[i - 1]);
      }
      const avgInterval = intervals.reduce((acc, val) => acc + val, 0) / intervals.length;
      if (avgInterval > 0) {
        const calculatedBpm = Math.round(60000 / avgInterval);
        // Clamp to allowed synth tempo range [60, 200] BPM
        const clampedBpm = Math.max(60, Math.min(200, calculatedBpm));
        updateParam('tempo', clampedBpm);
      }
    }
  }, []);

  // Step Editing Wrapper
  const updateSequenceStep = (newStepFn: (prev: SequenceStep[]) => SequenceStep[]) => {
      setPatternBank(prevBank => {
          const newBank = [...prevBank];
          newBank[viewPatternIdx] = newStepFn(newBank[viewPatternIdx]);
          return newBank;
      });
  };

  const toggleStepActive = (id: number) => {
    updateSequenceStep(prev => prev.map(s => s.id === id ? { ...s, active: !s.active } : s));
  };

  const updateStep = <K extends keyof SequenceStep>(id: number, key: K, value: SequenceStep[K]) => {
    updateSequenceStep(prev => prev.map(s => {
      if (s.id === id) {
        const updated = { ...s, [key]: value };
        if (key === 'note' || key === 'octaveShift' || key === 'accent') {
          engine.current?.previewNote(updated.note, updated.octaveShift, updated.accent);
        }
        return updated;
      }
      return s;
    }));
  };

  const clearPattern = () => {
    updateSequenceStep(prev => prev.map(s => ({ ...s, active: false, accent: false, slide: false })));
  };

  const randomizePattern = () => {
    updateSequenceStep(prev => prev.map(s => ({
      ...s,
      active: Math.random() > 0.4,
      note: NOTES[Math.floor(Math.random() * 12)],
      accent: Math.random() > 0.7,
      slide: Math.random() > 0.7,
      octaveShift: Math.random() > 0.8 ? 1 : (Math.random() > 0.8 ? -1 : 0)
    })));
  };

  const copyPattern = () => {
      localStorage.setItem('acid303_clipboard', JSON.stringify(patternBank[viewPatternIdx]));
  };

  const pastePattern = () => {
      const stored = localStorage.getItem('acid303_clipboard');
      if (stored) {
          const loadedSeq = JSON.parse(stored);
          setPatternBank(prev => {
              const newBank = [...prev];
              newBank[viewPatternIdx] = loadedSeq;
              return newBank;
          });
      }
  };

  const handlePatternSelect = (idx: number) => {
      if (chainMode) {
          setChainSelection(prev => {
              if (prev.includes(idx)) {
                  if (prev.length === 1) return prev;
                  return prev.filter(i => i !== idx).sort((a,b) => a-b);
              } else {
                  return [...prev, idx].sort((a,b) => a-b);
              }
          });
          setViewPatternIdx(idx);
      } else {
          setViewPatternIdx(idx);
          if (isPlaying) {
              setNextPatternIdx(idx);
              engine.current?.queueSequence(patternBank[idx]);
              const tempo = params.tempo;
              const stepTime = (60 / tempo) * 0.25;
              const stepsLeft = 16 - currentStep;
              if (patternFlipTimerRef.current !== null) window.clearTimeout(patternFlipTimerRef.current);
              patternFlipTimerRef.current = window.setTimeout(() => {
                  setActivePatternIdx(idx);
                  setNextPatternIdx(null);
                  patternFlipTimerRef.current = null;
              }, stepsLeft * stepTime * 1000);
          } else {
              setActivePatternIdx(idx);
              engine.current?.setSequence(patternBank[idx]);
          }
      }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
        const blob = await exportToWav(patternBank[viewPatternIdx], params, 4); 
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `acid-export-${Date.now()}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (e) {
        console.error(e);
        alert("Export failed.");
    } finally {
        setIsExporting(false);
    }
  };
  
  // MIDI Mapping Handlers
  const toggleMidiMode = async () => {
      const newState = !isMidiMapping;
      if (newState && !midiService.isReady()) {
          await midiService.requestAccess();
      }
      setIsMidiMapping(newState);
      if (!newState) {
          midiService.stopLearning();
          setListeningParam(null);
      }
  };

  const handleMapSelect = (paramId: string) => {
      if (!isMidiMapping) return;
      setListeningParam(paramId);
      midiService.clearMapping(paramId);
      midiService.startLearning((mapping) => {
          midiService.saveMapping(paramId, mapping);
          setListeningParam(null);
          midiService.stopLearning();
      });
  };

  const isMapped = (id: string) => !!midiService.getMapping(id);
  const analyser = analyserNode || engine.current?.getAnalyser() || null;

  // Global PC Keyboard Integration (Shortcuts & Knob Arrow Navigation)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore keystrokes when typing in inputs/textareas/selects
      const target = e.target as HTMLElement | null;
      const isInput = target && (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.tagName === 'SELECT' || 
        target.isContentEditable
      );
      if (isInput) return;

      // 1. Knob cycling with Tab / Shift+Tab
      if (e.key === 'Tab') {
        e.preventDefault();
        if (e.shiftKey) {
          selectPrevKnob();
        } else {
          selectNextKnob();
        }
        return;
      }

      // 2. Adjust Selected Knob with Arrow keys
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
        e.preventDefault();
        adjustCurrentKnob(1, e.shiftKey);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
        e.preventDefault();
        adjustCurrentKnob(-1, e.shiftKey);
        return;
      }
      if (e.key === 'PageUp') {
        e.preventDefault();
        adjustCurrentKnob(5, false);
        return;
      }
      if (e.key === 'PageDown') {
        e.preventDefault();
        adjustCurrentKnob(-5, false);
        return;
      }
      if (e.key === 'Home') {
        e.preventDefault();
        const def = KNOB_DEFS.find(k => k.key === selectedKnobKey);
        if (def) updateParam(selectedKnobKey, def.min as SynthParams[keyof SynthParams]);
        return;
      }
      if (e.key === 'End') {
        e.preventDefault();
        const def = KNOB_DEFS.find(k => k.key === selectedKnobKey);
        if (def) updateParam(selectedKnobKey, def.max as SynthParams[keyof SynthParams]);
        return;
      }

      // 3. PC Keyboard Button Controls
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
        return;
      }

      const keyLower = e.key.toLowerCase();

      // Step editing keyboard controls (when a step is selected)
      if (selectedStepId !== null) {
        if (keyLower === 'a') {
          e.preventDefault();
          updateStep(selectedStepId, 'accent', !sequence[selectedStepId].accent);
          return;
        }
        if (keyLower === 's') {
          e.preventDefault();
          updateStep(selectedStepId, 'slide', !sequence[selectedStepId].slide);
          return;
        }
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          const currentOct = sequence[selectedStepId].octaveShift || 0;
          if (currentOct < 1) {
            updateStep(selectedStepId, 'octaveShift', currentOct + 1);
          }
          return;
        }
        if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          const currentOct = sequence[selectedStepId].octaveShift || 0;
          if (currentOct > -1) {
            updateStep(selectedStepId, 'octaveShift', currentOct - 1);
          }
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          toggleStepActive(selectedStepId);
          return;
        }
      }

      // Step selection navigation with bracket keys
      if (e.key === '[' || e.key === '{') {
        e.preventDefault();
        setSelectedStepId(prev => (prev === null ? 0 : (prev - 1 + 16) % 16));
        return;
      }
      if (e.key === ']' || e.key === '}') {
        e.preventDefault();
        setSelectedStepId(prev => (prev === null ? 0 : (prev + 1) % 16));
        return;
      }

      if (keyLower === 't') {
        e.preventDefault();
        handleTapTempo();
        return;
      }
      if (keyLower === 'w') {
        e.preventDefault();
        const nextWf = paramsRef.current.waveform === Waveform.SAWTOOTH ? Waveform.SQUARE : Waveform.SAWTOOTH;
        updateParam('waveform', nextWf);
        return;
      }
      if (keyLower === 'c') {
        e.preventDefault();
        setChainMode(prev => !prev);
        return;
      }
      if (keyLower >= '1' && keyLower <= '8') {
        e.preventDefault();
        handlePatternSelect(parseInt(keyLower, 10) - 1);
        return;
      }
      if (keyLower === 'r') {
        e.preventDefault();
        randomizePattern();
        return;
      }
      if (keyLower === 'x') {
        e.preventDefault();
        clearPattern();
        return;
      }
      if (keyLower === 'm') {
        e.preventDefault();
        toggleMidiMode();
        return;
      }
      if (keyLower === 'l') {
        e.preventDefault();
        setIsPresetModalOpen(true);
        return;
      }
      if (keyLower === 'e') {
        e.preventDefault();
        handleExport();
        return;
      }
      if (e.key === 'Escape') {
        setIsPresetModalOpen(false);
        setShowKeyboardHelp(false);
        setSelectedStepId(null);
        if (isMidiMapping) toggleMidiMode();
        return;
      }
      if (e.key === '?') {
        setShowKeyboardHelp(prev => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectNextKnob, selectPrevKnob, adjustCurrentKnob, togglePlay, handleTapTempo, handlePatternSelect, randomizePattern, clearPattern, toggleMidiMode, isMidiMapping, selectedKnobKey, selectedStepId, sequence]);

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-2 sm:p-4 font-inter select-none">
      {/* Outer Studio Wooden Cabinet (Nogal Oscuro / Palosanto #1c1008 a #0d0603) */}
      <div className="max-w-6xl w-full rounded-2xl p-[6px] sm:p-[10px] bg-gradient-to-r from-[#1c1008] via-[#0d0603] to-[#1c1008] shadow-[0_30px_70px_rgba(0,0,0,0.95),inset_0_1px_2px_rgba(255,200,150,0.12),inset_0_-2px_4px_rgba(0,0,0,0.8)] border border-[#2b170c]/60">
        
        {/* Main Metal Chassis (#0a0a0a / #121212 / #141414) */}
        <div className={`w-full bg-[#121212] rounded-xl shadow-2xl overflow-hidden border relative transition-colors duration-300 ${isMidiMapping ? 'border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.2)]' : 'border-[#242424]'}`}>
          <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:12px_12px]"></div>

          {/* Status Bar for MIDI Mapping */}
          {isMidiMapping && (
            <div className="absolute top-0 left-0 right-0 z-[60] bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-amber-500/60 text-neutral-200 text-[10px] font-bold py-1.5 px-3 flex items-center justify-between shadow-2xl animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
                <span className="tracking-widest text-amber-500">MIDI MAPPING ACTIVE</span>
              </div>
              <div className="text-neutral-300 font-mono">
                {listeningParam 
                  ? <span className="text-red-400 animate-pulse">WAITING FOR MIDI SIGNAL: {listeningParam.toUpperCase()}</span>
                  : midiService.getStatus() === 'permission_denied'
                    ? <span className="text-amber-400/90">MIDI ACCESS DENIED IN BROWSER — PC KEYBOARD CONTROLS ARE ACTIVE</span>
                    : <span className="opacity-70">CLICK A CONTROL TO MAP</span>}
              </div>
              <button onClick={toggleMidiMode} className="p-1 hover:bg-[#222222] rounded text-neutral-400 hover:text-white"><X size={12} /></button>
            </div>
          )}

          {/* Top Control Section - Front Control Panel (#1a1a1a with micropoint texture) */}
          <div className="relative z-10 bg-gradient-to-b from-[#222222] via-[#1a1a1a] to-[#141414] border-b border-[#0a0a0a] p-3 shadow-inner">
            {/* Header / Brand */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 select-none">
                {/* Logo badge with warm amber backlighting */}
                <div className="w-8 h-8 bg-[#121212] rounded flex items-center justify-center border border-[#2a2a2a] shadow-[inset_0_1px_3px_rgba(0,0,0,0.8),0_1px_1px_rgba(255,255,255,0.05)]">
                  <Zap className="text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]" size={18} fill="currentColor" />
                </div>
                <div className="flex flex-col justify-center">
                  <span className="text-[8px] font-bold text-neutral-400 tracking-[0.25em] uppercase leading-none mb-0.5">RESONANCE SYSTEMS</span>
                  <span className="text-lg font-black italic text-neutral-100 tracking-tighter leading-none">
                    ACID <span className="text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]">303</span>
                  </span>
                </div>
              </div>

              {/* Transport / Wave Selector Module */}
              <div className="flex items-center gap-3 bg-[#0a0a0a]/80 p-1.5 rounded-lg border border-[#262626] shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)] relative group/play">
                {isMidiMapping && (
                  <div 
                    onClick={() => handleMapSelect('play_toggle')} 
                    className={`absolute -inset-1 z-50 rounded-lg border-2 flex items-center justify-center cursor-pointer backdrop-blur-[1px]
                      ${listeningParam === 'play_toggle' ? 'border-red-500 bg-red-500/10 animate-pulse' : (isMapped('play_toggle') ? 'border-emerald-500 bg-emerald-500/10' : 'border-neutral-700 bg-black/70 hover:border-amber-500')}
                    `}
                  >
                    {listeningParam === 'play_toggle' && <span className="text-[8px] font-black text-red-500 bg-black px-1 rounded">LEARN</span>}
                  </div>
                )}
                {/* Vintage Play/Stop Switch */}
                <button 
                  onClick={isMidiMapping ? () => handleMapSelect('play_toggle') : togglePlay}
                  className={`w-8 h-8 rounded flex items-center justify-center transition-all border-b-2 active:border-b-0 active:translate-y-[2px] shadow-md
                    ${isPlaying 
                      ? 'bg-amber-500 border-amber-700 text-black shadow-[0_0_14px_rgba(245,158,11,0.8)] font-black' 
                      : 'bg-gradient-to-b from-[#2a2a2a] to-[#1a1a1a] border-[#0a0a0a] text-neutral-300 hover:text-white hover:from-[#333333]'
                  }`}
                  title={isPlaying ? "Detener Secuenciador [Espacio]" : "Iniciar Secuenciador [Espacio]"}
                >
                  {isPlaying ? <Square fill="currentColor" size={13} /> : <Play fill="currentColor" size={13} className="ml-0.5" />}
                </button>
                
                <div className="h-5 w-px bg-[#262626] mx-0.5"></div>

                {/* Classic Tap Tempo Button */}
                <div className="flex flex-col gap-0.5 px-0.5 relative group/tap">
                  {isMidiMapping && (
                    <div 
                      onClick={() => handleMapSelect('tap_tempo')} 
                      className={`absolute -inset-1 z-50 rounded border-2 flex items-center justify-center cursor-pointer backdrop-blur-[1px]
                        ${listeningParam === 'tap_tempo' ? 'border-red-500 bg-red-500/10 animate-pulse' : (isMapped('tap_tempo') ? 'border-emerald-500 bg-emerald-500/10' : 'border-neutral-700 bg-black/70 hover:border-amber-500')}
                      `}
                    >
                      {listeningParam === 'tap_tempo' && <span className="text-[8px] font-black text-red-500 bg-black px-1 rounded">LEARN</span>}
                    </div>
                  )}
                  <span className="text-[7px] font-bold text-neutral-400 uppercase text-center leading-none tracking-wider">Tap [T]</span>
                  <button
                    onClick={isMidiMapping ? () => handleMapSelect('tap_tempo') : handleTapTempo}
                    className={`h-[22px] px-2 rounded flex items-center justify-center gap-1 transition-all border-b-2 active:border-b-0 active:translate-y-[1px] font-mono text-[9px] font-black tracking-wider shadow-sm select-none
                      ${isTapActive 
                        ? 'bg-amber-500 border-amber-700 text-black shadow-[0_0_12px_rgba(245,158,11,0.9)] scale-[0.97]' 
                        : 'bg-gradient-to-b from-[#2a2a2a] via-[#1e1e1e] to-[#141414] border-[#0a0a0a] text-amber-500/90 hover:text-amber-400 hover:from-[#333333] border border-[#2a2a2a]'
                      }`}
                    title="Tap Tempo [Tecla T] (pulsa repetidamente al ritmo para ajustar el tempo dinámicamente)"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full transition-all duration-75 ${isTapActive ? 'bg-black' : 'bg-amber-500 shadow-[0_0_5px_#f59e0b]'}`} />
                    TAP
                  </button>
                </div>
                
                <div className="h-5 w-px bg-[#262626] mx-0.5"></div>

                {/* Waveform Selector with Amber Illuminated Display */}
                <div className="flex flex-col gap-0.5 px-1 relative group/wave">
                  {isMidiMapping && (
                    <div 
                      onClick={() => handleMapSelect('waveform')} 
                      className={`absolute -inset-1 z-50 rounded border-2 flex items-center justify-center cursor-pointer backdrop-blur-[1px]
                        ${listeningParam === 'waveform' ? 'border-red-500 bg-red-500/10 animate-pulse' : (isMapped('waveform') ? 'border-emerald-500 bg-emerald-500/10' : 'border-neutral-700 bg-black/70 hover:border-amber-500')}
                      `}
                    >
                      {listeningParam === 'waveform' && <span className="text-[8px] font-black text-red-500 bg-black px-1 rounded">LEARN</span>}
                    </div>
                  )}
                  <span className="text-[7px] font-bold text-neutral-400 uppercase text-center leading-none tracking-wider">Wave</span>
                  <div className="flex bg-[#0a0a0a] rounded border border-[#2a2a2a] overflow-hidden p-0.5 gap-0.5">
                    <button 
                      onClick={() => updateParam('waveform', Waveform.SAWTOOTH)} 
                      className={`px-2 py-0.5 rounded-sm transition-all ${params.waveform === Waveform.SAWTOOTH ? 'bg-amber-500 text-black shadow-[0_0_8px_rgba(245,158,11,0.6)] font-bold' : 'text-neutral-400 hover:text-neutral-200'}`}
                      title="Sawtooth Wave"
                    >
                      <Zap size={10} fill="currentColor" />
                    </button>
                    <button 
                      onClick={() => updateParam('waveform', Waveform.SQUARE)} 
                      className={`px-2 py-0.5 rounded-sm transition-all ${params.waveform === Waveform.SQUARE ? 'bg-amber-500 text-black shadow-[0_0_8px_rgba(245,158,11,0.6)] font-bold' : 'text-neutral-400 hover:text-neutral-200'}`}
                      title="Square Wave"
                    >
                      <Square size={10} fill="currentColor" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Output Visualization: CRT Oscilloscope & Classic Vertical VU Meter */}
              <div className="hidden sm:flex items-center gap-1.5">
                <div className="w-28 sm:w-32 h-8 bg-[#0a0a0a] rounded border border-[#2c2217] overflow-hidden shadow-[inset_0_2px_6px_rgba(0,0,0,0.9),0_0_6px_rgba(245,158,11,0.1)]">
                  <Oscilloscope analyser={analyser} />
                </div>
                <div className="h-8 bg-[#0a0a0a] px-1 rounded border border-[#2c2217] overflow-hidden shadow-[inset_0_2px_6px_rgba(0,0,0,0.9),0_0_6px_rgba(245,158,11,0.1)] flex items-center justify-center">
                  <VuMeter analyser={analyser} />
                </div>
              </div>
            </div>

            {/* Knob Selector Tab (Keyboard Navigation & Arrow Control) */}
            <div className="mx-1 mb-2 px-2.5 py-1.5 rounded-lg bg-[#0c0c0c] border border-[#262626] shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)] flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-bold text-neutral-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b] animate-pulse" />
                    KNOB SELECTOR
                  </span>
                  
                  {/* Active Knob Pill */}
                  <div className="flex items-center gap-1.5 bg-[#171717] border border-[#333333] px-2 py-0.5 rounded shadow-inner">
                    <span className="text-[8px] font-mono text-neutral-400 uppercase">{activeKnobDef.section}</span>
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider">{activeKnobDef.label}</span>
                    <span className="text-[10px] font-mono text-neutral-200 font-bold bg-[#0a0a0a] px-1 rounded border border-[#2a2a2a]">
                      {activeKnobDef.key === 'volume'
                        ? Math.round(params.volume * 100)
                        : Math.round((params[activeKnobDef.key] as number) * 10) / 10}
                    </span>
                  </div>
                </div>

                {/* Navigation Controls: Tab & Arrow Keys */}
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center bg-[#171717] rounded border border-[#2a2a2a] p-0.5">
                    <button 
                      onClick={selectPrevKnob}
                      className="px-1.5 py-0.5 text-[8px] font-mono font-bold text-neutral-300 hover:text-white hover:bg-[#262626] rounded transition-colors flex items-center gap-0.5"
                      title="Previous Knob (Shift + Tab)"
                    >
                      ◀ TAB
                    </button>
                    <button 
                      onClick={selectNextKnob}
                      className="px-1.5 py-0.5 text-[8px] font-mono font-bold text-neutral-300 hover:text-white hover:bg-[#262626] rounded transition-colors flex items-center gap-0.5 border-l border-[#2a2a2a]"
                      title="Next Knob (Tab)"
                    >
                      TAB ▶
                    </button>
                  </div>

                  <div className="flex items-center bg-[#171717] rounded border border-[#2a2a2a] p-0.5">
                    <button 
                      onClick={() => adjustCurrentKnob(-1)}
                      className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-neutral-300 hover:text-black hover:bg-amber-500 rounded transition-colors"
                      title="Bajar parámetro (Flecha Abajo o Izquierda [↓ / ←])"
                    >
                      ▼
                    </button>
                    <button 
                      onClick={() => adjustCurrentKnob(1)}
                      className="w-5 h-5 flex items-center justify-center text-[10px] font-bold text-neutral-300 hover:text-black hover:bg-amber-500 rounded transition-colors border-l border-[#2a2a2a]"
                      title="Subir parámetro (Flecha Arriba o Derecha [↑ / →])"
                    >
                      ▲
                    </button>
                  </div>

                  <span className="text-[7.5px] font-mono text-amber-500/90 hidden sm:inline bg-[#141414] px-1 py-0.5 rounded border border-[#222222]">
                    Flechas [↑/↓]
                  </span>

                  <button 
                    onClick={() => setShowKeyboardHelp(prev => !prev)}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono border transition-all flex items-center gap-1 ${showKeyboardHelp ? 'bg-amber-500 border-amber-500 text-black shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-[#1a1a1a] border-[#333333] text-neutral-400 hover:text-neutral-200'}`}
                    title="Guía completa de controles por teclado PC (?)"
                  >
                    <Keyboard size={10} /> KEYS
                  </button>
                </div>
              </div>

              {/* Knob Selector Tab Strip (Click or Tab through every knob) */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-thin scrollbar-thumb-neutral-800">
                {KNOB_DEFS.filter(def => def.key !== 'volume').map(def => {
                  const isCur = selectedKnobKey === def.key;
                  return (
                    <button
                      key={def.key}
                      onClick={() => setSelectedKnobKey(def.key)}
                      className={`px-1.5 py-0.5 rounded text-[8px] font-mono uppercase whitespace-nowrap transition-all border flex items-center gap-1
                        ${isCur 
                          ? 'bg-amber-500 text-black border-amber-400 font-extrabold shadow-[0_0_8px_rgba(245,158,11,0.5)] scale-[1.02]' 
                          : 'bg-[#141414] text-neutral-400 hover:text-neutral-200 border-[#222222] hover:bg-[#1c1c1c]'
                        }`}
                      title={`Seleccionar perilla ${def.label} (${def.section}) para ajustar con flechas del teclado`}
                    >
                      <span>{def.label}</span>
                      <span className={`text-[7px] ${isCur ? 'text-black/80 font-bold' : 'text-neutral-400'}`}>
                        {Math.round((params[def.key] as number) * 10) / 10}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Knobs - Studio Hardware Grid with specific functional color accents */}
            <div className="flex flex-wrap justify-center sm:justify-between items-end gap-x-1 gap-y-2 px-1 pb-1">
              <Knob label="Tune" value={params.tuning} min={-50} max={50} step={1} onChange={v => updateParam('tuning', v)} size={48} color="#f59e0b"
                    isSelected={selectedKnobKey === 'tuning'} onSelect={() => setSelectedKnobKey('tuning')}
                    isMapping={isMidiMapping} isListening={listeningParam === 'tuning'} isMapped={isMapped('tuning')} onMapSelect={() => handleMapSelect('tuning')} />
              <Knob label="Cutoff" value={params.cutoff} min={20} max={1000} step={15} onChange={v => updateParam('cutoff', v)} size={48} color="#f59e0b"
                    isSelected={selectedKnobKey === 'cutoff'} onSelect={() => setSelectedKnobKey('cutoff')}
                    isMapping={isMidiMapping} isListening={listeningParam === 'cutoff'} isMapped={isMapped('cutoff')} onMapSelect={() => handleMapSelect('cutoff')} />
              <Knob label="Resonance" value={params.resonance} min={0} max={30} step={0.5} onChange={v => updateParam('resonance', v)} size={48} color="#f59e0b"
                    isSelected={selectedKnobKey === 'resonance'} onSelect={() => setSelectedKnobKey('resonance')}
                    isMapping={isMidiMapping} isListening={listeningParam === 'resonance'} isMapped={isMapped('resonance')} onMapSelect={() => handleMapSelect('resonance')} />
              <Knob label="Env Mod" value={params.envMod} min={0} max={5000} step={50} onChange={v => updateParam('envMod', v)} size={48} color="#f59e0b"
                    isSelected={selectedKnobKey === 'envMod'} onSelect={() => setSelectedKnobKey('envMod')}
                    isMapping={isMidiMapping} isListening={listeningParam === 'envMod'} isMapped={isMapped('envMod')} onMapSelect={() => handleMapSelect('envMod')} />
              <Knob label="Decay" value={params.decay} min={0.1} max={2.0} step={0.05} onChange={v => updateParam('decay', v)} size={48} color="#f59e0b"
                    isSelected={selectedKnobKey === 'decay'} onSelect={() => setSelectedKnobKey('decay')}
                    isMapping={isMidiMapping} isListening={listeningParam === 'decay'} isMapped={isMapped('decay')} onMapSelect={() => handleMapSelect('decay')} />
              <Knob label="Accent" value={params.accent} min={0} max={1} step={0.05} onChange={v => updateParam('accent', v)} size={48} color="#f59e0b"
                    isSelected={selectedKnobKey === 'accent'} onSelect={() => setSelectedKnobKey('accent')}
                    isMapping={isMidiMapping} isListening={listeningParam === 'accent'} isMapped={isMapped('accent')} onMapSelect={() => handleMapSelect('accent')} />
              
              {/* Divider */}
              <div className="hidden sm:block w-px h-9 bg-[#2b2b2b] mx-1 self-center shadow-[1px_0_0_rgba(255,255,255,0.05)]"></div>
              
              {/* Índigo / Azul eléctrico (#6366f1) para Tempo */}
              <Knob label="Tempo" value={params.tempo} min={60} max={200} step={1} onChange={v => updateParam('tempo', v)} size={48} color="#6366f1"
                    isSelected={selectedKnobKey === 'tempo'} onSelect={() => setSelectedKnobKey('tempo')}
                    isMapping={isMidiMapping} isListening={listeningParam === 'tempo'} isMapped={isMapped('tempo')} onMapSelect={() => handleMapSelect('tempo')} />
              
              {/* Púrpura / Lavanda (#c084fc) para Transpose */}
              <Knob label="Transp" value={params.transpose} min={-12} max={12} step={1} onChange={v => updateParam('transpose', v)} size={48} color="#c084fc"
                    isSelected={selectedKnobKey === 'transpose'} onSelect={() => setSelectedKnobKey('transpose')}
                    isMapping={isMidiMapping} isListening={listeningParam === 'transpose'} isMapped={isMapped('transpose')} onMapSelect={() => handleMapSelect('transpose')} />

              {/* Dorado Cálido / Latón (#eab308) para DISTORT/DRIVE */}
              <Knob label="Distort" value={params.distortion} min={0} max={10} step={0.2} onChange={v => updateParam('distortion', v)} size={48} color="#eab308"
                    isSelected={selectedKnobKey === 'distortion'} onSelect={() => setSelectedKnobKey('distortion')}
                    isMapping={isMidiMapping} isListening={listeningParam === 'distortion'} isMapped={isMapped('distortion')} onMapSelect={() => handleMapSelect('distortion')} />
            </div>

            {/* MODS & FX Section */}
            <div className="mt-2 pt-2 border-t border-[#262626] flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-400 uppercase tracking-widest bg-[#0a0a0a] px-2 py-0.5 rounded border border-[#2a2a2a] shadow-inner">
                  <Settings2 size={10} className="text-indigo-400" />
                  <span>MODS</span>
                </div>
                <Knob label="Length" value={params.patternLength || 16} min={1} max={16} step={1} onChange={v => updateParam('patternLength', v)} size={36} color="#818cf8"
                      isSelected={selectedKnobKey === 'patternLength'} onSelect={() => setSelectedKnobKey('patternLength')}
                      isMapping={isMidiMapping} isListening={listeningParam === 'patternLength'} isMapped={isMapped('patternLength')} onMapSelect={() => handleMapSelect('patternLength')} />
                <Knob label="Slide Tm" value={params.slideTime || 0.1} min={0.05} max={0.4} step={0.01} onChange={v => updateParam('slideTime', v)} size={36} color="#818cf8"
                      isSelected={selectedKnobKey === 'slideTime'} onSelect={() => setSelectedKnobKey('slideTime')}
                      isMapping={isMidiMapping} isListening={listeningParam === 'slideTime'} isMapped={isMapped('slideTime')} onMapSelect={() => handleMapSelect('slideTime')} />
                <Knob label="Swing" value={params.swing} min={0} max={100} step={1} onChange={v => updateParam('swing', v)} size={36} color="#818cf8"
                      isSelected={selectedKnobKey === 'swing'} onSelect={() => setSelectedKnobKey('swing')}
                      isMapping={isMidiMapping} isListening={listeningParam === 'swing'} isMapped={isMapped('swing')} onMapSelect={() => handleMapSelect('swing')} />
              </div>

              <Knob
                label="Volume"
                value={params.volume}
                min={0}
                max={1}
                step={0.01}
                size={46}
                color="#f59e0b"
                formatValue={(v) => String(Math.round(v * 100))}
                onChange={(v) => updateParam('volume', Math.round(v * 100) / 100)}
                isSelected={selectedKnobKey === 'volume'}
                onSelect={() => setSelectedKnobKey('volume')}
                isMapping={isMidiMapping}
                isListening={listeningParam === 'volume'}
                isMapped={isMapped('volume')}
                onMapSelect={() => handleMapSelect('volume')}
              />

              {/* Delay Section with Cold Cyan (#22d3ee) */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-cyan-400 uppercase tracking-widest bg-[#0a0a0a] px-2 py-0.5 rounded border border-[#2a2a2a] shadow-inner">
                  <Activity size={10} className="text-cyan-400" />
                  <span>DELAY</span>
                </div>
                <Knob label="Time" value={params.delayTime} min={0.05} max={1.0} step={0.02} onChange={v => updateParam('delayTime', v)} size={36} color="#22d3ee"
                      isSelected={selectedKnobKey === 'delayTime'} onSelect={() => setSelectedKnobKey('delayTime')}
                      isMapping={isMidiMapping} isListening={listeningParam === 'delayTime'} isMapped={isMapped('delayTime')} onMapSelect={() => handleMapSelect('delayTime')} />
                <Knob label="Fdbk" value={params.delayFeedback} min={0} max={0.95} step={0.02} onChange={v => updateParam('delayFeedback', v)} size={36} color="#22d3ee"
                      isSelected={selectedKnobKey === 'delayFeedback'} onSelect={() => setSelectedKnobKey('delayFeedback')}
                      isMapping={isMidiMapping} isListening={listeningParam === 'delayFeedback'} isMapped={isMapped('delayFeedback')} onMapSelect={() => handleMapSelect('delayFeedback')} />
                <Knob label="Mix" value={params.delayMix} min={0} max={1} step={0.02} onChange={v => updateParam('delayMix', v)} size={36} color="#22d3ee"
                      isSelected={selectedKnobKey === 'delayMix'} onSelect={() => setSelectedKnobKey('delayMix')}
                      isMapping={isMidiMapping} isListening={listeningParam === 'delayMix'} isMapped={isMapped('delayMix')} onMapSelect={() => handleMapSelect('delayMix')} />
              </div>
            </div>
          </div>

          {/* Pattern & Chain Control - Compact */}
          <div className="bg-[#141414] border-b border-[#0a0a0a] py-1.5 px-3 flex items-center gap-3 overflow-x-auto">
            <div className="flex items-center gap-2 pr-3 border-r border-[#262626]">
              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">MODE</span>
              <button 
                onClick={() => setChainMode(!chainMode)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold border transition-all ${chainMode ? 'bg-amber-500 border-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-[#1f1f1f] border-[#2e2e2e] text-neutral-400 hover:bg-[#2a2a2a] hover:text-neutral-200'}`}
                title="Modo Encadenamiento / Chain Mode [C]"
              >
                <LinkIcon size={10} /> CHAIN <span className="text-[7.5px] opacity-75 font-mono">[C]</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider">PATTERNS</span>
              <div className="flex gap-1">
                {patternBank.map((_, idx) => {
                  const label = String.fromCharCode(65 + idx); // A, B, C...
                  const isActive = activePatternIdx === idx;
                  const isSelected = viewPatternIdx === idx;
                  const isQueued = nextPatternIdx === idx;
                  const isInChain = chainSelection.includes(idx);
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => handlePatternSelect(idx)}
                      title={`Patrón ${label} [Tecla ${idx + 1}]`}
                      className={`
                        w-6 h-6 rounded text-[9px] font-bold relative transition-all duration-150 border
                        ${isActive ? 'bg-amber-500 border-amber-400 text-black shadow-[0_0_10px_rgba(245,158,11,0.6)] z-10 scale-105' : 'bg-[#1a1a1a] border-[#2a2a2a] text-neutral-400 hover:bg-[#262626] hover:text-neutral-200'}
                        ${isSelected && !isActive ? 'ring-1 ring-amber-500/70 border-amber-500/50 text-amber-300' : ''}
                        ${chainMode && isInChain && !isActive ? 'border-amber-500 text-amber-400' : ''}
                      `}
                    >
                      {isQueued && (
                        <span className="absolute inset-0 bg-amber-500/30 animate-pulse rounded" />
                      )}
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            
            <div className="flex-1"></div>
            
            {/* Pattern Utility */}
            <div className="flex gap-1">
              <button onClick={copyPattern} className="p-1 text-neutral-400 hover:text-amber-400 hover:bg-[#222222] rounded transition-colors" title="Copy Pattern"><Copy size={12} /></button>
              <button onClick={pastePattern} className="p-1 text-neutral-400 hover:text-amber-400 hover:bg-[#222222] rounded transition-colors" title="Paste Pattern"><Layers size={12} /></button>
            </div>
          </div>

          <div className="relative z-10 bg-[#171717] border-b border-[#0a0a0a] py-1.5 px-3 flex items-center justify-end gap-2 shadow-inner">
            <div className="flex gap-1.5">
              <button onClick={toggleMidiMode} title="Modo Aprendizaje MIDI [M]" className={`text-[9px] font-bold rounded px-1.5 py-0.5 flex items-center gap-1 transition-colors border ${isMidiMapping ? 'bg-amber-500 border-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-pulse' : 'text-neutral-300 hover:text-white bg-[#222222] hover:bg-[#2c2c2c] border-[#333333]'}`}><Cable size={10} /> MIDI <span className="text-[7.5px] opacity-75 font-mono">[M]</span></button>
              <button onClick={() => setIsPresetModalOpen(true)} title="Biblioteca de Presets [L]" className="text-[9px] font-bold text-neutral-300 hover:text-white bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] rounded px-1.5 py-0.5 flex items-center gap-1 transition-colors"><FolderOpen size={10} /> LIBRARY <span className="text-[7.5px] opacity-75 font-mono">[L]</span></button>
              <button onClick={handleExport} disabled={isExporting} title="Exportar Audio a WAV [E]" className="text-[9px] font-bold text-neutral-300 hover:text-white bg-[#222222] hover:bg-[#2c2c2c] border border-[#333333] rounded px-1.5 py-0.5 flex items-center gap-1 transition-colors disabled:opacity-50">{isExporting ? <RefreshCw className="animate-spin" size={10} /> : <Download size={10} />} EXPORT <span className="text-[7.5px] opacity-75 font-mono">[E]</span></button>
              <div className="w-px h-5 bg-[#2b2b2b] mx-0.5"></div>
              <button onClick={randomizePattern} title="Aleatorizar Patrón [R]" className="text-[9px] font-bold text-neutral-400 hover:text-amber-400 bg-[#1c1c1c] hover:bg-[#262626] border border-[#2a2a2a] rounded px-1.5 py-0.5 flex items-center gap-1 transition-colors"><RefreshCw size={10} /> RND <span className="text-[7.5px] opacity-75 font-mono">[R]</span></button>
              <button onClick={clearPattern} title="Limpiar Patrón [X]" className="text-[9px] font-bold text-neutral-400 hover:text-red-400 bg-[#1c1c1c] hover:bg-red-950/30 border border-[#2a2a2a] rounded px-1.5 py-0.5 flex items-center gap-1 transition-colors"><Trash2 size={10} /> CLR <span className="text-[7.5px] opacity-75 font-mono">[X]</span></button>
            </div>
          </div>

          {/* Sequencer Strip - Compact */}
          <div className="relative z-10 bg-[#0a0a0a] p-2.5 border-t border-[#1a1a1a]">
            {/* Pattern Indicator */}
            <div className="mb-1.5 flex justify-between items-end">
              <span className="text-[9px] font-bold text-neutral-400 tracking-wider">
                EDITING PATTERN: <span className="text-amber-500 text-base ml-1 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]">{String.fromCharCode(65 + viewPatternIdx)}</span>
              </span>
            </div>
            
            <div className="flex justify-between gap-1 mb-2 overflow-x-auto pb-1 scrollbar-hide">
              {sequence.map((step, idx) => (
                <div key={step.id} className={`flex flex-col items-center gap-1 min-w-[30px] transition-opacity duration-300 ${idx >= (params.patternLength || 16) ? 'opacity-20 blur-[1px]' : 'opacity-100'}`}>
                  {/* Vintage Analog Amber Running LED */}
                  <div className={`w-1.5 h-1.5 rounded-full transition-all duration-75 ${currentStep === step.id ? 'bg-amber-500 shadow-[0_0_10px_2px_#f59e0b] scale-125' : 'bg-[#1e1e1e] border border-[#2a2a2a]'}`} />
                  
                  {/* Authentic Analog Synth Step Switch */}
                  <button
                    onClick={() => toggleStepActive(step.id)}
                    className={`
                      w-7 h-10 rounded-sm border-b-2 text-[9px] font-mono font-bold flex flex-col items-center justify-center transition-all duration-100 group shadow-sm
                      ${step.active 
                        ? 'bg-[#f5f5f4] border-[#d6d3d1] text-[#0a0a0a] translate-y-0 shadow-[0_0_10px_rgba(245,245,244,0.3)]' 
                        : 'bg-[#181818] border-[#0a0a0a] text-neutral-400 hover:bg-[#222222] translate-y-[1px]'
                      }
                      ${selectedStepId === step.id ? 'ring-1 ring-amber-500 ring-offset-1 ring-offset-[#0a0a0a]' : ''}
                    `}
                  >
                    <span className="mb-0.5">{step.id + 1}</span>
                    {/* Step Active Accent Dot - Amber LED */}
                    <div className={`w-2.5 h-0.5 rounded-full ${step.active ? 'bg-amber-600 shadow-[0_0_4px_#d97706]' : 'bg-[#2a2a2a] group-hover:bg-[#383838]'}`} />
                  </button>
                  <button 
                    onClick={() => setSelectedStepId(selectedStepId === step.id ? null : step.id)} 
                    className={`w-full h-1 rounded-full mt-0.5 transition-colors ${selectedStepId === step.id ? 'bg-amber-500 shadow-[0_0_6px_#f59e0b]' : 'bg-[#1a1a1a] hover:bg-[#333333]'}`} 
                    title={`Edit Step ${step.id + 1}`}
                  />
                </div>
              ))}
            </div>

            {/* Step Editor Drawer */}
            <div className={`transition-all duration-200 ease-out overflow-hidden bg-[#141414] rounded border border-[#262626] shadow-2xl ${selectedStepId !== null ? 'max-h-20 opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}`}>
              {selectedStepId !== null && (
                <div className="p-1.5 px-3 flex items-center justify-between gap-3 h-full">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-amber-500 font-bold text-[9px] leading-tight tracking-wider">STEP</span>
                      <span className="text-neutral-200 font-black text-lg leading-none">{selectedStepId + 1}</span>
                    </div>
                    <div className="h-5 w-px bg-[#262626]"></div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] text-neutral-400 font-bold uppercase tracking-wider">Note</span>
                      <select value={sequence[selectedStepId].note} onChange={(e) => updateStep(selectedStepId, 'note', e.target.value)} className="bg-[#0a0a0a] text-neutral-200 text-[10px] font-mono font-bold rounded border border-[#333333] px-1 py-0.5 outline-none focus:border-amber-500">
                        {NOTES.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[8px] text-neutral-400 font-bold uppercase tracking-wider">Octave</span>
                      <div className="flex bg-[#0a0a0a] rounded border border-[#333333] p-0.5">
                        {[-1, 0, 1].map(oct => (
                          <button key={oct} onClick={() => updateStep(selectedStepId, 'octaveShift', oct)} className={`w-5 py-0.5 text-[9px] font-bold rounded-sm transition-colors ${sequence[selectedStepId].octaveShift === oct ? 'bg-amber-500 text-black shadow-sm font-extrabold' : 'text-neutral-400 hover:text-neutral-200'}`}>{oct > 0 ? '+' + oct : oct}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateStep(selectedStepId, 'accent', !sequence[selectedStepId].accent)} className={`px-2 py-1 rounded border text-[9px] font-bold flex items-center gap-1 transition-all ${sequence[selectedStepId].accent ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-[#0a0a0a] border-[#262626] text-neutral-400 hover:border-[#383838]'}`}><Volume2 size={10} /> ACCENT</button>
                    <button onClick={() => updateStep(selectedStepId, 'slide', !sequence[selectedStepId].slide)} className={`px-2 py-1 rounded border text-[9px] font-bold flex items-center gap-1 transition-all ${sequence[selectedStepId].slide ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-[#0a0a0a] border-[#262626] text-neutral-400 hover:border-[#383838]'}`}><span className="italic font-serif text-xs leading-none">~</span> SLIDE</button>
                  </div>
                  <button onClick={() => setSelectedStepId(null)} className="w-5 h-5 flex items-center justify-center text-neutral-400 hover:text-neutral-200 hover:bg-[#222222] rounded transition-colors"><X size={12} /></button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <PresetModal 
        isOpen={isPresetModalOpen}
        onClose={() => setIsPresetModalOpen(false)}
        presets={presets}
        onLoad={(preset) => {
            setParams(preset.params);
            if (preset.patterns) {
                setPatternBank(preset.patterns);
                // Reset to pattern A
                setActivePatternIdx(0);
                setViewPatternIdx(0);
                setChainSelection([0]);
                engine.current?.setSequence(preset.patterns[0]);
            } else {
                // Backward compatibility for old presets (create temporary bank)
                const blank = DEFAULT_SEQUENCE.map(s => ({...s, active: false}));
                const newBank = Array(8).fill(null).map((_, i) => i === 0 ? preset.sequence : blank);
                setPatternBank(newBank);
                setActivePatternIdx(0);
                setViewPatternIdx(0);
                engine.current?.setSequence(preset.sequence);
            }
        }}
        onSave={(name) => {
            const newPreset = PresetLibrary.savePreset(name, params, patternBank[0], patternBank);
            setPresets(prev => [...prev, newPreset]);
        }}
        onDelete={(id) => {
            PresetLibrary.deletePreset(id);
            setPresets(prev => prev.filter(p => p.id !== id));
        }}
      />

      <KeyboardShortcutsModal 
        isOpen={showKeyboardHelp}
        onClose={() => setShowKeyboardHelp(false)}
      />
    </div>
  );
};

export default App;