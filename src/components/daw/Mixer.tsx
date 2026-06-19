// @ts-nocheck
import React, { useState, useMemo } from 'react';
import { useDawStore } from '../../store/useDawStore';
import { Volume2, Sparkles, CheckCircle, Activity, ShieldCheck, ChevronRight, Sliders, ArrowRight } from 'lucide-react';

export function Mixer() {
  const { tracks, updateTrack, selectedTrackId, selectTrack, masterVolume, setMasterVolume } = useDawStore();
  
  // Mastering Simulation Statuses
  const [isMastering, setIsMastering] = useState(false);
  const [masteringStep, setMasteringStep] = useState(0);
  const [showDoneScreen, setShowDoneScreen] = useState(false);

  const masteringSteps = [
    { label: "AI SPECTRUM DETECTOR", desc: "Analyzing 5 active multi-stems for frequency masking..." },
    { label: "GAIN STAGING & HEADROOM BALANCE", desc: "Leveling track gains to clean summing ceiling (-6dB)..." },
    { label: "ANALOG GLUE COMPRESSION", desc: "Smoothing channel transients for cohesive warmth..." },
    { label: "MID-SIDE STEREO WIDENING", desc: "Spreading synths & plucks for spatial stereo imaging..." },
    { label: "LOUDNESS MAXIMIZER", desc: "Optimizing master fader to 0 dBFS — limiter handles final ceiling..." },
    { label: "SAFETY LIMITING PINNING", desc: "Locking output ceiling at -0.5 dBFS. Playback ready!" }
  ];

  const sortedTracks = useMemo(() => {
    const sorted: typeof tracks = [];
    const rootTracks = tracks.filter(t => !t.groupId);
    rootTracks.forEach(root => {
      sorted.push(root);
      if (root.type === 'group') {
        const children = tracks.filter(t => t.groupId === root.id);
        sorted.push(...children);
      }
    });
    // Append orphans if needed
    tracks.forEach(track => {
      if (!sorted.find(s => s.id === track.id)) {
        sorted.push(track);
      }
    });
    return sorted;
  }, [tracks]);

  // Run real-time and structural DSP mastering pipeline
  const handleAutoMaster = () => {
    setIsMastering(true);
    setMasteringStep(0);
    setShowDoneScreen(false);

    const interval = setInterval(() => {
      setMasteringStep(prev => {
        const next = prev + 1;
        if (next >= masteringSteps.length) {
          clearInterval(interval);
          setShowDoneScreen(true);
          
          // Phase 4 & 5: Master fader sits at 0 dBFS — the master chain
          // (headroom → compressor → limiter) handles loudness; pushing it to
          // 1.5 was a unit mismatch that treated a dBFS value as a raw linear
          // gain and clipped the output.
          setMasterVolume(0);
          return prev;
        }

        // Apply physical changes according to phase
        if (next === 1) {
          // Gain staging balancing
          tracks.forEach(track => {
            let updatedVol = track.volume;
            const tName = track.name.toLowerCase();
            if (tName.includes('vocal')) {
              updatedVol = -4.5;
            } else if (tName.includes('drum') || tName.includes('groove') || tName.includes('kick')) {
              updatedVol = -5.5;
            } else if (tName.includes('bass') || tName.includes('sub') || tName.includes('808')) {
              updatedVol = -6.5;
            } else if (tName.includes('pad') || tName.includes('atmos') || tName.includes('rhodes') || tName.includes('chord')) {
              updatedVol = -13.0;
            } else if (tName.includes('melody') || tName.includes('pluck') || tName.includes('synth')) {
              updatedVol = -11.0;
            } else if (tName.includes('fx') || tName.includes('sweeps')) {
              updatedVol = -16.5;
            }
            updateTrack(track.id, { volume: updatedVol });
          });
        } 
        else if (next === 2) {
          // Dynamic compression & EQ coloring
          tracks.forEach(track => {
            const baseFx = { ...track.fx };
            const tName = track.name.toLowerCase();
            
            if (tName.includes('vocal')) {
              baseFx.eq = { enabled: true, low: -1.5, mid: 1.0, high: 2.5 };
              baseFx.compressor = { enabled: true, threshold: -18, ratio: 3.5 };
              baseFx.reverb = { enabled: true, decay: 2.0, mix: 0.18 };
            } else if (tName.includes('bass') || tName.includes('sub') || tName.includes('808')) {
              baseFx.eq = { enabled: true, low: 4.5, mid: -0.5, high: -2.0 };
              baseFx.compressor = { enabled: true, threshold: -15, ratio: 5.0 };
              baseFx.distortion = { enabled: true, amount: 0.25, wet: 0.4 };
            } else if (tName.includes('drum') || tName.includes('groove') || tName.includes('kick')) {
              baseFx.eq = { enabled: true, low: 1.5, mid: -0.8, high: 1.0 };
              baseFx.compressor = { enabled: true, threshold: -16, ratio: 4.0 };
            } else if (tName.includes('melody') || tName.includes('pluck') || tName.includes('synth')) {
              baseFx.eq = { enabled: true, low: -2.0, mid: 1.2, high: 1.8 };
              baseFx.delay = { enabled: true, time: '8n', feedback: 0.25, mix: 0.15 };
            }
            updateTrack(track.id, { fx: baseFx });
          });
        } 
        else if (next === 3) {
          // Stereo spreads
          tracks.forEach(track => {
            const baseFx = { ...track.fx };
            const tName = track.name.toLowerCase();
            if (tName.includes('pad') || tName.includes('rhodes') || tName.includes('chord') || tName.includes('synth')) {
              baseFx.stereoWidener = { enabled: true, width: 0.8, wet: 0.65 };
            }
            updateTrack(track.id, { fx: baseFx });
          });
        }

        return next;
      });
    }, 600);
  };

  return (
    <div className="h-full bg-background overflow-auto relative">
      <div className="flex flex-row p-4 gap-2 min-h-[400px] sm:min-h-full h-full min-w-max">
        {sortedTracks.map(track => (
          <div 
            key={track.id}
            id={`mixer-track-${track.id}`}
            className={`
              w-24 sm:w-32 shrink-0 bg-[#1A1A1A] border rounded-lg flex flex-col pt-4 pb-2 px-2 items-center transition-all duration-200
              ${selectedTrackId === track.id ? 'border-[#00FFCD] shadow-[0_0_10px_rgba(0,255,205,0.15)] bg-[#1c1c1e]' : track.type === 'group' ? 'border-green-850 bg-[#0d120e]' : 'border-[#2A2A2A]'}
            `}
            onClick={() => selectTrack(track.id)}
          >
            <div className="text-[10px] font-bold text-gray-400 uppercase text-center w-full truncate mb-1">
              {track.name}
            </div>
            <div className={`text-[8px] font-mono px-1.5 py-0.5 rounded uppercase mb-4 ${
              track.type === 'audio' 
                ? 'bg-red-900/30 text-red-500' 
                : track.type === 'group'
                ? 'bg-green-950/40 text-green-400 border border-green-800/50'
                : 'bg-blue-900/30 text-blue-500'
            }`}>
              {track.type}
            </div>

            <div className="flex gap-1 mb-4 w-full justify-center">
              <button 
                id={`btn-mute-${track.id}`}
                className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center ${track.muted ? 'bg-red-900 text-red-100' : 'bg-[#333] text-gray-300 hover:bg-[#444]'}`}
                onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { muted: !track.muted }) }}
              >
                M
              </button>
              <button 
                id={`btn-solo-${track.id}`}
                className={`w-6 h-6 rounded text-[10px] font-bold flex items-center justify-center ${track.soloed ? 'bg-yellow-600 text-black' : 'bg-[#333] text-gray-300 hover:bg-[#444]'}`}
                onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { soloed: !track.soloed }) }}
              >
                S
              </button>
            </div>

            {/* Pan Knob simulation */}
            <div className="mb-4 flex flex-col items-center">
              <span className="text-[8px] text-gray-500 font-mono mb-1">PAN</span>
              <input 
                type="range" min="-1" max="1" step="0.1" 
                value={track.pan} 
                onChange={(e) => updateTrack(track.id, { pan: Number(e.target.value) })}
                className="w-16 h-1 bg-[#333] rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Fader */}
            <div className="flex-1 w-full flex justify-center py-2 relative">
              <input 
                type="range" 
                min="-60" max="6" 
                value={track.volume}
                onChange={(e) => updateTrack(track.id, { volume: Number(e.target.value) })}
                className="h-full w-2 appearance-none cursor-pointer rounded-full bg-[#000] border border-[#222]"
                style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
              />
            </div>

            <div className="mt-2 text-[10px] font-mono text-[#00FF5E] h-4">
              {track.volume.toFixed(1)} dB
            </div>

            {track.type !== 'group' && (
              <div className="mt-1.5 text-[8px] font-mono text-zinc-500 text-center uppercase tracking-tight truncate w-full">
                {track.groupId ? `↳ Bus: ${tracks.find(t => t.id === track.groupId)?.name}` : '↳ Master'}
              </div>
            )}
          </div>
        ))}

        {/* Master Fader */}
        <div className="w-24 sm:w-32 shrink-0 bg-[#1A1A1A] border rounded-lg flex flex-col pt-4 pb-2 px-2 items-center border-[#333]">
          <div className="text-[10px] font-bold text-gray-300 uppercase text-center w-full mb-4 mt-5">
            MASTER
          </div>
          <div className="flex-1 w-full flex justify-center py-2 relative">
            <input 
              type="range" 
              min="-60" max="6" step="0.1"
              value={masterVolume}
              onChange={(e) => setMasterVolume(Number(e.target.value))}
              className="h-full w-2 appearance-none cursor-pointer rounded-full bg-[#000] border border-[#222]"
              style={{ writingMode: 'vertical-lr', direction: 'rtl' }}
            />
          </div>
          <div className="mt-2 text-[10px] font-mono text-[#00FF5E] h-4">
            {masterVolume.toFixed(1)} dB
          </div>
          
          <button 
            id="btn-auto-mastering"
            onClick={handleAutoMaster}
            className="mt-2 px-2 py-1 bg-gradient-to-r from-emerald-600 to-green-500 hover:brightness-110 active:scale-95 transition-all rounded text-[9px] font-black uppercase text-white shadow-lg w-full mb-1 flex items-center justify-center gap-1"
          >
            <Sparkles size={10} />
            Auto Master
          </button>
          
          <button 
            id="btn-export-mix"
            onClick={() => {
              useDawStore.getState().setIsExportModalOpen(true);
            }}
            className="px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-[9px] font-bold uppercase text-white shadow-lg w-full"
          >
            Export Mix
          </button>
        </div>
      </div>

      {/* AI Mastering HUD Overlay */}
      {isMastering && (
        <div id="mastering-status-hud" className="absolute inset-0 bg-[#030303]/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-white text-center">
          {!showDoneScreen ? (
            <div className="max-w-md w-full bg-[#111111] p-8 border border-emerald-500/30 rounded-2xl shadow-2xl flex flex-col items-center">
              <div className="relative mb-6">
                <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin flex items-center justify-center">
                  <Activity className="text-emerald-400 animate-pulse" size={24} />
                </div>
                <div className="absolute -inset-1 border border-emerald-400/10 rounded-full animate-ping pointer-events-none" />
              </div>

              <h3 className="text-sm font-black text-emerald-400 uppercase tracking-widest mb-1 select-none flex items-center gap-1.5 justify-center">
                <Sparkles size={14} className="animate-spin" />
                SeeVibe AI Master Console
              </h3>
              <p className="text-xs text-zinc-400 mb-6 font-mono">Running FL-Engine loudness optimizers...</p>

              {/* Progress Steps */}
              <div className="w-full text-left space-y-3 mb-6 bg-black/40 p-4 rounded-xl border border-zinc-800 font-mono">
                {masteringSteps.map((step, idx) => {
                  const isCurrent = idx === masteringStep;
                  const isDone = idx < masteringStep;
                  return (
                    <div key={idx} className="flex items-start text-[10px] transition-all duration-300">
                      <span className={`mr-2.5 font-bold ${isCurrent ? 'text-emerald-400' : isDone ? 'text-zinc-600' : 'text-zinc-800'}`}>
                        {isDone ? "[✓]" : isCurrent ? "[▶]" : "[ ]"}
                      </span>
                      <div className="flex-1">
                        <p className={`font-black ${isCurrent ? 'text-emerald-400' : isDone ? 'text-zinc-500' : 'text-zinc-750'}`}>
                          {step.label}
                        </p>
                        {isCurrent && (
                          <p className="text-[9px] text-zinc-400 mt-0.5 leading-relaxed">{step.desc}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Loader Fill-bar */}
              <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                  style={{ width: `${((masteringStep + 1) / masteringSteps.length) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div id="mastering-complete-card" className="max-w-md w-full bg-[#111111] p-8 border border-[#00FF9C]/40 rounded-2xl shadow-2xl flex flex-col items-center">
              <div className="w-14 h-14 bg-emerald-950 border border-emerald-400/40 rounded-full flex items-center justify-center text-emerald-400 mb-5 shadow-[0_0_15px_rgba(52,211,153,0.15)] animate-bounce">
                <ShieldCheck size={28} />
              </div>

              <h3 className="text-base font-black text-white uppercase tracking-widest mb-1 select-none flex items-center gap-1">
                MASTER SECURED
              </h3>
              <p className="text-xs text-[#00FFCD] mb-6 font-mono">Dynamic Headroom Balanced & Saturated</p>

              <div className="w-full text-left bg-black/40 p-4 border border-[#222] rounded-xl text-[10px] font-mono text-zinc-300 space-y-2.5 mb-6 leading-relaxed">
                <div className="flex justify-between border-b border-zinc-850/55 pb-1.5 text-zinc-500">
                  <span>Parameter</span>
                  <span>Master Out Value</span>
                </div>
                <div className="flex justify-between">
                  <span>Summing Faders Headroom</span>
                  <span className="text-emerald-400 font-bold">-6.0 dB</span>
                </div>
                <div className="flex justify-between">
                  <span>Glue Compression Makeup</span>
                  <span className="text-emerald-400 font-semibold">+12.5 dB</span>
                </div>
                <div className="flex justify-between">
                  <span>Dynamic Range Filter Sweep</span>
                  <span className="text-[#00FF5E]">Active High-air Shelving</span>
                </div>
                <div className="flex justify-between">
                  <span>Brickwall Safety Threshold</span>
                  <span className="text-zinc-400 font-bold">-0.5 dBFS</span>
                </div>
              </div>

              <div className="flex gap-2 w-full">
                <button
                  id="btn-dismiss-mastering"
                  onClick={() => setIsMastering(false)}
                  className="flex-1 py-2 px-3 bg-gradient-to-r from-emerald-500 to-green-600 hover:brightness-110 active:scale-95 transition-all text-xs font-bold uppercase text-white rounded-lg shadow-lg flex items-center justify-center gap-1"
                >
                  Return to Console
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
