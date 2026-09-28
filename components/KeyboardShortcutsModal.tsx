import React from 'react';
import { X, Keyboard, Sliders, Play, Music, Settings, Activity, Volume2 } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      {/* Outer Chassis */}
      <div className="w-full max-w-2xl bg-[#121212] border-2 border-[#1c1008] rounded-xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-3 sm:p-4 bg-gradient-to-r from-[#1c1008] via-[#141414] to-[#1c1008] border-b border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#0a0a0a] border border-[#2a2a2a] flex items-center justify-center text-amber-500 shadow-inner">
              <Keyboard size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-neutral-100 tracking-wider uppercase font-mono">
                  CONTROL POR TECLADO PC & MIDI
                </h3>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b] animate-pulse" />
              </div>
              <p className="text-[10px] text-neutral-400 font-mono">
                Atajos de hardware analógico para botones y selector de perillas con flechas
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-[#222222] rounded-lg transition-colors border border-transparent hover:border-[#333333]"
            title="Cerrar (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-4 font-mono text-[11px] scrollbar-thin scrollbar-thumb-neutral-700">
          
          {/* Section 1: Knob Selector & Flechas del Teclado */}
          <div className="bg-[#0a0a0a] rounded-lg border border-[#262626] p-3 shadow-inner">
            <div className="flex items-center gap-2 mb-2.5 text-amber-500 font-bold tracking-wider text-[11px] uppercase border-b border-[#1f1f1f] pb-1.5">
              <Sliders size={13} />
              <span>SELECTOR DE PERILLAS & FLECHAS DEL TECLADO</span>
              <span className="ml-auto text-[9px] text-neutral-500 lowercase">[knob selector tab]</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-neutral-300">
              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Cambiar perilla activa:</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">TAB</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">⇧ TAB</kbd>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Subir parámetro activo:</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">↑</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">→</kbd>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Bajar parámetro activo:</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">↓</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">←</kbd>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Ajuste fino (Micro-step):</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">Shift + Flecha</kbd>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Saltos rápidos (±5x):</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">PgUp</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">PgDn</kbd>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Valor Mínimo / Máximo:</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">Home</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">End</kbd>
                </div>
              </div>
            </div>
            
            <p className="mt-2 text-[9.5px] text-neutral-400 italic">
              💡 También puedes hacer clic directamente en cualquier perilla del panel para seleccionarla con el anillo ámbar iluminado y controlarla inmediatamente con las flechas.
            </p>
          </div>

          {/* Section 2: Transport & Synthesis Buttons */}
          <div className="bg-[#0a0a0a] rounded-lg border border-[#262626] p-3 shadow-inner">
            <div className="flex items-center gap-2 mb-2.5 text-amber-500 font-bold tracking-wider text-[11px] uppercase border-b border-[#1f1f1f] pb-1.5">
              <Play size={13} />
              <span>BOTONES DE TRANSPORTE Y SÍNTESIS</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-neutral-300">
              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Play / Stop:</span>
                <kbd className="px-2 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">ESPACIO</kbd>
              </div>

              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Tap Tempo Dinámico:</span>
                <kbd className="px-2 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">T</kbd>
              </div>

              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Forma de Onda (Saw / Square):</span>
                <kbd className="px-2 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">W</kbd>
              </div>

              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Modo Chain (Encadenar):</span>
                <kbd className="px-2 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">C</kbd>
              </div>
            </div>
          </div>

          {/* Section 3: Patterns & Utilities */}
          <div className="bg-[#0a0a0a] rounded-lg border border-[#262626] p-3 shadow-inner">
            <div className="flex items-center gap-2 mb-2.5 text-amber-500 font-bold tracking-wider text-[11px] uppercase border-b border-[#1f1f1f] pb-1.5">
              <Music size={13} />
              <span>BANCO DE PATRONES & UTILIDADES</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-neutral-300">
              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Seleccionar Patrón (A - H):</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <kbd key={n} className="px-1 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[9px]">{n}</kbd>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Aleatorizar Patrón (RND):</span>
                <kbd className="px-2 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">R</kbd>
              </div>

              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Limpiar Patrón (CLR):</span>
                <kbd className="px-2 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">X</kbd>
              </div>

              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Modo Mapeo MIDI (Learn):</span>
                <kbd className="px-2 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">M</kbd>
              </div>

              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Biblioteca de Presets:</span>
                <kbd className="px-2 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">L</kbd>
              </div>

              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Exportar Master a WAV:</span>
                <kbd className="px-2 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">E</kbd>
              </div>
            </div>
          </div>

          {/* Section 4: Sequencer Step Editing */}
          <div className="bg-[#0a0a0a] rounded-lg border border-[#262626] p-3 shadow-inner">
            <div className="flex items-center gap-2 mb-2.5 text-amber-500 font-bold tracking-wider text-[11px] uppercase border-b border-[#1f1f1f] pb-1.5">
              <Activity size={13} />
              <span>EDICIÓN DE PASOS DEL SECUENCIADOR (16 PASOS)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-neutral-300">
              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Navegar pasos:</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">[</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">]</kbd>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Activar/Desactivar paso:</span>
                <kbd className="px-2 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">Enter</kbd>
              </div>

              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Alternar Acento (Accent):</span>
                <kbd className="px-2 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">A</kbd>
              </div>

              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Alternar Slide (Portamento):</span>
                <kbd className="px-2 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">S</kbd>
              </div>

              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Subir/Bajar Octava:</span>
                <div className="flex gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">+</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">-</kbd>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#141414] p-2 rounded border border-[#222222]">
                <span className="text-neutral-400">Cerrar editor / Deseleccionar:</span>
                <kbd className="px-2 py-0.5 rounded bg-[#202020] text-amber-400 border border-[#333333] font-bold text-[10px] shadow-sm">Esc</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#0a0a0a] border-t border-[#262626] flex items-center justify-between text-neutral-400 font-mono text-[10px]">
          <span>Pulsa <kbd className="px-1 py-0.5 rounded bg-[#1e1e1e] text-amber-400 border border-[#333333] font-bold">?</kbd> en cualquier momento para abrir esta guía</span>
          <button 
            onClick={onClose}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded transition-colors shadow-sm"
          >
            ENTENDIDO
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsModal;
