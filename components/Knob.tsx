import React, { useEffect, useRef } from 'react';

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  size?: number;
  color?: string;
  step?: number;
  formatValue?: (value: number) => string;
  
  // Selection & Keyboard Control
  isSelected?: boolean;
  onSelect?: () => void;
  
  // MIDI Mapping Props
  isMapping?: boolean;
  isMapped?: boolean;
  isListening?: boolean;
  onMapSelect?: () => void;
}

const Knob: React.FC<KnobProps> = ({ 
  label, 
  value, 
  min, 
  max, 
  onChange, 
  size = 64,
  color = "#f59e0b",
  step,
  formatValue,
  isSelected = false,
  onSelect,
  isMapping = false,
  isMapped = false,
  isListening = false,
  onMapSelect
}) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startY: 0, startValue: 0, pointerId: -1 });

  // Convert value to angle (270 degree range: -135 to 135)
  const range = max - min;
  const percentage = range === 0 ? 0 : (value - min) / range;
  const angle = -135 + (percentage * 270);
  const shown = formatValue ? formatValue(value) : String(Math.round(value * 10) / 10);

  const quantize = (next: number) => Math.max(min, Math.min(max, next));

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isMapping || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.();
    (e.currentTarget.parentElement as HTMLElement | null)?.focus();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { active: true, startY: e.clientY, startValue: value, pointerId: e.pointerId };
    document.body.style.cursor = 'ns-resize';
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active || e.pointerId !== drag.pointerId) return;
    const deltaY = drag.startY - e.clientY;
    const deltaValue = (deltaY / 180) * range;
    onChange(quantize(drag.startValue + deltaValue));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active || e.pointerId !== dragRef.current.pointerId) return;
    dragRef.current.active = false;
    document.body.style.cursor = 'default';
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isMapping) return;
    const defaultStep = step || (range <= 1 ? 0.05 : range <= 20 ? 1 : Math.round(range / 40) || 1);
    const mult = e.shiftKey ? 0.2 : 1;
    const delta = defaultStep * mult;

    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopPropagation();
      onChange(Math.min(max, value + delta));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      e.stopPropagation();
      onChange(Math.max(min, value - delta));
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      e.stopPropagation();
      onChange(Math.min(max, value + delta * 5));
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      e.stopPropagation();
      onChange(Math.max(min, value - delta * 5));
    } else if (e.key === 'Home') {
      e.preventDefault();
      e.stopPropagation();
      onChange(min);
    } else if (e.key === 'End') {
      e.preventDefault();
      e.stopPropagation();
      onChange(max);
    }
  };

  useEffect(() => {
    const el = knobRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (isMapping) return;
      e.preventDefault();
      const defaultStep = step || (range <= 1 ? 0.01 : range <= 20 ? 1 : Math.round(range / 80) || 1);
      const direction = e.deltaY < 0 ? 1 : -1;
      const delta = defaultStep * (e.shiftKey ? 0.2 : 1) * direction;
      onChange(quantize(value + delta));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [value, min, max, step, range, onChange, isMapping]);

  return (
    <div 
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={() => onSelect?.()}
      className={`flex flex-col items-center gap-1 select-none relative group outline-none rounded-lg p-0.5 transition-all
        ${isSelected ? 'scale-[1.03]' : ''}
      `}
      role="group"
      aria-label={label}
      title={`${label}: ${shown} (arrastra, rueda o flechas)`}
    >
      
      {/* MIDI Mapping Overlay */}
      {isMapping && (
        <div 
            onClick={(e) => { e.stopPropagation(); onMapSelect?.(); }}
            className={`
                absolute -inset-2 z-50 rounded-lg border-2 flex flex-col items-center justify-center transition-all cursor-pointer backdrop-blur-[1px]
                ${isListening 
                    ? 'border-red-500 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse' 
                    : (isMapped 
                        ? 'border-emerald-500 bg-emerald-500/10' 
                        : 'border-neutral-700 bg-black/70 hover:border-amber-500 hover:bg-neutral-900/90'
                    )
                }
            `}
        >
            {isListening ? (
                 <span className="text-[9px] font-black text-red-500 bg-black/90 px-1.5 py-0.5 rounded border border-red-500/50 shadow-sm whitespace-nowrap">LEARN</span>
            ) : isMapped ? (
                 <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]"></div>
            ) : (
                 <span className="opacity-0 group-hover:opacity-100 text-[9px] font-bold text-amber-500 uppercase tracking-widest scale-90 group-hover:scale-100 transition-all bg-black/90 px-1 rounded border border-amber-500/30">Map</span>
            )}
        </div>
      )}
      
      {/* Passive Mapped Indicator (when not mapping) */}
      {!isMapping && isMapped && (
          <div className="absolute -top-0.5 -right-0.5 z-10 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)] pointer-events-none" />
      )}

      <div 
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={shown}
        className={`relative ${isMapping ? 'pointer-events-none' : 'cursor-ns-resize touch-none'}`}
        style={{ width: size, height: size, touchAction: 'none' }}
      >
        {/* Recessed Chassis Bezel Ring with Selection Halo */}
        <div className={`absolute inset-0 rounded-full bg-[#0a0a0a] shadow-[inset_0_2px_5px_rgba(0,0,0,0.9),0_1px_1px_rgba(255,255,255,0.06)] border transition-all duration-150
          ${isSelected 
            ? 'border-amber-500 ring-2 ring-amber-500/70 shadow-[0_0_12px_rgba(245,158,11,0.5)]' 
            : 'border-[#222222] group-hover:border-[#383838]'
          }
        `} />
        
        {/* Hardware Calibration Ticks */}
        <svg className="absolute inset-0 pointer-events-none opacity-50" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="none" stroke="#737373" strokeWidth="2.5" strokeDasharray="2 7.2" transform="rotate(135 50 50)" strokeDashoffset="0" />
        </svg>

        {/* The Fluted Bakelite & Brushed Metal Knob Body */}
        <div 
          className="absolute top-1.5 left-1.5 right-1.5 bottom-1.5 rounded-full bg-gradient-to-b from-[#2a2a2a] via-[#141414] to-[#0d0d0d] shadow-[0_4px_8px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.25),inset_0_-1px_2px_rgba(0,0,0,0.8)] border border-[#333333]"
          style={{ transform: `rotate(${angle}deg)` }}
        >
          {/* Inner Brushed Aluminum / Bakelite Cap */}
          <div className="absolute inset-1.5 rounded-full bg-gradient-to-tr from-neutral-300 via-neutral-100 to-neutral-400 shadow-[inset_0_1px_2px_rgba(255,255,255,0.8),0_2px_4px_rgba(0,0,0,0.6)] flex items-center justify-center">
            {/* Center concentric metal lathe ring */}
            <div className="w-[70%] h-[70%] rounded-full bg-gradient-to-b from-neutral-200 via-neutral-300 to-neutral-400 border border-neutral-400/60 shadow-inner"></div>
          </div>

          {/* Indicator Line with Section Accent Color */}
          <div className="absolute top-[6%] left-1/2 -translate-x-1/2 w-[2.5px] h-[40%] rounded-full bg-neutral-900 shadow-[0_0_2px_rgba(0,0,0,0.8)] z-10">
            <div className="w-full h-[75%] rounded-full shadow-[0_0_6px_currentColor]" style={{ backgroundColor: color }}></div>
          </div>
        </div>
      </div>
      <span className={`text-[10px] font-bold tracking-wider uppercase leading-none mt-0.5 transition-colors ${isSelected ? 'text-amber-400 font-black' : 'text-neutral-300'}`}>
        {label}
      </span>
      <span className={`text-[9px] font-mono leading-none transition-colors ${isSelected ? 'text-amber-500/95 font-bold' : 'text-neutral-400'}`}>
        {shown}
      </span>
    </div>
  );
};

export default Knob;