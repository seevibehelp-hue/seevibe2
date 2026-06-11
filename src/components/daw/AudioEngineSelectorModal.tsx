// @ts-nocheck
import React from 'react';
import { X, Cpu, Globe, Zap, AlertCircle, CheckCircle } from 'lucide-react';
import { useDawStore } from '../../store/useDawStore';
import * as Tone from 'tone';

interface AudioEngineSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AudioEngineSelectorModal({ isOpen, onClose }: AudioEngineSelectorModalProps) {
  const { globalEffectsMode, setGlobalEffectsMode } = useDawStore();

  if (!isOpen) return null;

  const handleSelectMode = (mode: 'web' | 'native') => {
    setGlobalEffectsMode(mode);
    
    // Play sweet tone feedback to confirm the audio context switch
    try {
      if (Tone.context.state !== 'running') {
        Tone.start();
      }
      const synth = new Tone.Synth().toDestination();
      synth.triggerAttackRelease(mode === 'native' ? "G4" : "C4", "8n");
    } catch (e) {
      console.warn("Could not play engine audio feedback:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="bg-[#1E1E1E] border border-zinc-805 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-800 flex justify-between items-center bg-[#181818]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00FF9C]/10 border border-[#00FF5A]/20 flex items-center justify-center text-[#00FF9C]">
              <Cpu size={16} className="animate-spin duration-3000" />
            </div>
            <div>
              <h2 className="text-white font-extrabold text-sm tracking-wider uppercase">Audio Processing Engine</h2>
              <p className="text-[9px] text-[#00FF9C] font-mono tracking-widest uppercase mt-0.5">Physical DSP Pipeline Switch</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-zinc-400 hover:text-white flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/80 hover:bg-zinc-800 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer font-black uppercase text-[10px] tracking-wider shrink-0"
            title="Cancel"
          >
            <span>Cancel</span>
            <X size={12} className="stroke-[3px]" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          <p className="text-xs text-zinc-400 leading-relaxed">
            Select the active hardware or browser synthesis DSP engine. Changing this mode dynamically refactors all signal channels, active filters, low-latency vocal alignments, and rendering pipelines.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Web Audio Mode */}
            <div 
              onClick={() => handleSelectMode('web')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
                globalEffectsMode === 'web'
                  ? 'bg-blue-950/20 border-blue-500 shadow-[inset_0_0_20px_rgba(59,130,246,0.15)]'
                  : 'bg-[#151515] border-zinc-800/80 hover:border-zinc-700 hover:bg-[#1A1A1A]'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className={`p-2.5 rounded-xl border ${
                    globalEffectsMode === 'web'
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                  }`}>
                    <Globe size={18} />
                  </div>
                  {globalEffectsMode === 'web' && (
                    <span className="text-[9px] bg-blue-500/20 text-blue-400 text-xs px-2.5 py-0.5 font-bold uppercase rounded-full tracking-wider border border-blue-500/10">Active</span>
                  )}
                </div>

                <h3 className="text-sm font-extrabold text-white uppercase tracking-wide">Web Audio Engine</h3>
                <p className="text-[9.5px] text-zinc-500 leading-normal mt-2">
                  Uses standard browser-native <strong className="text-zinc-400">Tone.js (32-bit float)</strong> synthesis. Extremely compatible across all modern internet browsers with quick load times.
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-zinc-900/40 text-[9px] font-mono text-zinc-500 space-y-1 bg-black/10 -mx-5 -mb-5 p-3 px-5 rounded-b-xl">
                <div className="flex justify-between">
                  <span>LATENCY:</span>
                  <span className="text-blue-400 font-bold">~45ms - 75ms</span>
                </div>
                <div className="flex justify-between">
                  <span>PRECISION:</span>
                  <span className="text-zinc-400">32-bit Headroom</span>
                </div>
                <div className="flex justify-between">
                  <span>STABILITY:</span>
                  <span className="text-[#00FF9C]">100% Fail-Safe</span>
                </div>
              </div>
            </div>

            {/* Native Audio Mode */}
            <div 
              onClick={() => handleSelectMode('native')}
              className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group flex flex-col justify-between ${
                globalEffectsMode === 'native'
                  ? 'bg-emerald-950/20 border-[#00FF5A] shadow-[inset_0_0_20px_rgba(0,255,156,0.15)] ring-1 ring-[#00FF5A]/20'
                  : 'bg-[#151515] border-zinc-800/80 hover:border-zinc-700 hover:bg-[#1A1A1A]'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className={`p-2.5 rounded-xl border ${
                    globalEffectsMode === 'native'
                      ? 'bg-[#00FF9C]/10 border-[#00FF9C]/20 text-[#00FF9C]'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                  }`}>
                    <Zap size={18} className={globalEffectsMode === 'native' ? 'animate-pulse' : ''} />
                  </div>
                  {globalEffectsMode === 'native' && (
                    <span className="text-[9px] bg-[#00FF9C]/25 text-[#00FF5A] text-xs px-2.5 py-0.5 font-bold uppercase rounded-full tracking-wider border border-[#00FF9C]/10">Active</span>
                  )}
                </div>

                <h3 className="text-sm font-extrabold text-white uppercase tracking-wide flex items-center gap-1.5">
                  Native DSP Engine
                </h3>
                <p className="text-[9.5px] text-zinc-500 leading-normal mt-2">
                  Interfaces with physical <strong className="text-zinc-400">C++ / WebAssembly</strong> modules offering ultra-low latency. Simulates high-end hardware sound cards and mastering.
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-zinc-900/40 text-[9px] font-mono text-zinc-500 space-y-1 bg-black/10 -mx-5 -mb-5 p-3 px-5 rounded-b-xl">
                <div className="flex justify-between">
                  <span>LATENCY:</span>
                  <span className="text-[#00FF9C] font-black">Sub-3ms UltraLow</span>
                </div>
                <div className="flex justify-between">
                  <span>PRECISION:</span>
                  <span className="text-zinc-400">64-bit Multi-Thread</span>
                </div>
                <div className="flex justify-between">
                  <span>HARDWARE:</span>
                  <span className="text-amber-500">Accelerated DSP</span>
                </div>
              </div>
            </div>

          </div>

          <div className="bg-[#151515] border border-zinc-800 rounded-xl p-3.5 flex gap-2.5">
            <AlertCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[9px] text-zinc-400 leading-normal">
              Note: Changing the global engine updates your local DAW runtime buffer and propagates to all active tracks. Web effects (Tone.js plugins) are seamlessly mapped to native C++ models for immediate physical studio export.
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-zinc-800 bg-[#151515] text-right flex justify-end gap-2 shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-zinc-800 transition-all cursor-pointer"
          >
            Close
          </button>
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-[#00FF9C] hover:bg-[#00cc7d] text-black text-[10px] font-black uppercase tracking-wider rounded-lg shadow-md hover:shadow-[#00FF9C]/10 transition-all cursor-pointer"
          >
            Confirm Configuration
          </button>
        </div>

      </div>
    </div>
  );
}
