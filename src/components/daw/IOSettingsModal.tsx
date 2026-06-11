// @ts-nocheck
import React, { useEffect } from 'react';
import { X, Cpu, Music, Mic, Settings, Wifi, RefreshCw } from 'lucide-react';
import { useDawStore } from '../../store/useDawStore';
import { audioEngine } from '../../audio/engine';

interface IOSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function IOSettingsModal({ isOpen, onClose }: IOSettingsModalProps) {
  const { 
    midiDevices, 
    audioInputs,
    audioOutputs,
    selectedAudioInputId,
    selectedAudioOutputId,
    setSelectedAudioInputId,
    setSelectedAudioOutputId,
    globalEffectsMode,
    setGlobalEffectsMode
  } = useDawStore();

  const handleRefresh = async () => {
    // Audio engine already refreshes MIDI on state change, but we can manually trigger enumerate
    await audioEngine.enumerateAudioDevices();
  };

  useEffect(() => {
    if (isOpen) {
      handleRefresh();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#111] border border-[#333] rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 border-b border-[#333] flex justify-between items-center bg-[#1A1A1A]">
          <div className="flex items-center gap-2">
            <Settings className="text-[#00FF9C]" size={18} />
            <h2 className="text-white font-bold text-sm tracking-widest uppercase">External Devices / I/O</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* MIDI Section */}
          <section>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2 text-gray-300">
                <Wifi size={14} className="text-[#00FF9C]" />
                <h3 className="text-[10px] font-bold uppercase tracking-widest">MIDI Controllers & USB Devices</h3>
              </div>
              <button 
                onClick={handleRefresh}
                className="text-[9px] text-[#00FF9C] flex items-center gap-1 hover:underline"
              >
                <RefreshCw size={10} />
                Refresh
              </button>
            </div>
            
            <div className="space-y-2">
              {midiDevices.length === 0 ? (
                <div className="p-3 bg-[#1A1A1A] border border-[#222] rounded-lg text-center">
                  <p className="text-gray-500 text-[10px]">No MIDI devices detected. Connect a USB keyboard or pad controller.</p>
                </div>
              ) : (
                midiDevices.map(device => (
                  <div key={device.id} className="flex items-center justify-between p-3 bg-[#1A1A1A] border border-[#222] rounded-lg group hover:border-[#444] transition-colors">
                    <div className="flex items-center gap-3">
                      <Music size={14} className="text-gray-400" />
                      <div>
                        <p className="text-white text-[11px] font-bold">{device.name}</p>
                        <p className="text-[9px] text-gray-500 uppercase tracking-tighter">Status: Connected / USB</p>
                      </div>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-[#00FF9C] shadow-[0_0_8px_#00FF9C]" />
                  </div>
                ))
              )}
            </div>
            <p className="mt-2 text-[9px] text-gray-500 italic">
              * Routing to specific tracks can be managed in the track headers.
            </p>
          </section>

          {/* Audio Section */}
          <section>
            <div className="flex items-center gap-2 text-gray-300 mb-3">
              <Cpu size={14} className="text-blue-400" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest">Audio Interface / Sound Card</h3>
            </div>
            
            <div className="space-y-2">
              <div className="flex flex-col gap-2">
                <label className="text-[9px] text-gray-500 uppercase font-bold ml-1">Input Source (Mic/Inst)</label>
                <select 
                  value={selectedAudioInputId || ''}
                  onChange={(e) => setSelectedAudioInputId(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg p-2 text-white text-[11px] outline-none focus:border-[#00FF9C]"
                >
                  <option value="">Default System Input</option>
                  {audioInputs.map(input => (
                    <option key={input.id} value={input.id}>{input.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2 mt-4">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-[9px] text-gray-500 uppercase font-bold">Output Source (Speakers/Headphones)</label>
                  {audioOutputs.length === 0 && (
                    <span className="text-[8px] text-[#00FF9C] uppercase">*Requires Permissions</span>
                  )}
                </div>
                <select 
                  value={selectedAudioOutputId || ''}
                  onChange={(e) => setSelectedAudioOutputId(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#333] rounded-lg p-2 text-white text-[11px] outline-none focus:border-[#00FF9C]"
                >
                  <option value="">Default System Output</option>
                  {audioOutputs.map(output => (
                    <option key={output.id} value={output.id}>{output.name}</option>
                  ))}
                </select>
              </div>

              <div className="mt-4 p-3 bg-[#1A1A1A] border border-[#222] rounded-lg flex items-center gap-3">
                <Mic size={14} className="text-red-400" />
                <div className="flex-1">
                  <p className="text-white text-[11px] font-bold">Monitor Input</p>
                  <p className="text-[9px] text-gray-500">Enable monitoring in the track or mixer panel.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Audio DSP Processing Engine */}
          <section className="border-t border-[#222] pt-4">
            <div className="flex items-center gap-2 text-gray-300 mb-3">
              <Cpu size={14} className="text-emerald-400" />
              <h3 className="text-[10px] font-bold uppercase tracking-widest">Audio DSP Processing Engine</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-2 bg-[#1A1A1A] p-1 rounded-xl border border-[#222]">
              <button 
                type="button"
                onClick={() => setGlobalEffectsMode('web')}
                className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-150 ${
                  globalEffectsMode === 'web' 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Web Engine (Tone.js)
              </button>
              <button 
                type="button"
                onClick={() => setGlobalEffectsMode('native')}
                className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 ${
                  globalEffectsMode === 'native' 
                    ? 'bg-[#00FF9C] text-black shadow-md shadow-[#00FF9C]/10' 
                    : 'text-zinc-400 hover:text-[#00FF9C] hover:bg-[#00FF9C]/5'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping shrink-0" />
                Native Engine (DSP)
              </button>
            </div>
            <p className="mt-2 text-[8px] text-zinc-500 leading-normal">
              * Propagates to all active tracks. Use Native mode for ultra-low latency physical audio synthesis and direct hardware-level performance.
            </p>
          </section>

          {/* Device Sync Info */}
          <section className="p-4 bg-[#00FF9C]/5 border border-[#00FF9C]/20 rounded-xl">
             <h4 className="text-[10px] font-bold text-[#00FF9C] uppercase tracking-wide mb-1">Universal Sync</h4>
             <p className="text-[10px] text-gray-400 leading-relaxed">
               All connected devices are automatically synced to the project BPM ({useDawStore.getState().bpm}).
               Keyboards, Drumpads and Soundcards work exactly as the built-in instruments.
             </p>
          </section>
        </div>

        <div className="p-4 bg-[#1A1A1A] border-t border-[#333] flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-[#00FF9C] text-black font-bold text-[10px] uppercase rounded-full hover:shadow-[0_0_15px_rgba(0,255,156,0.4)] transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
