// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import * as Tone from 'tone';
import { 
  Sparkles, 
  Trash2, 
  Play, 
  Square, 
  Sliders, 
  Volume2, 
  Activity, 
  Grid, 
  Layers, 
  SlidersHorizontal,
  ChevronRight,
  TrendingUp,
  RotateCcw,
  Plus,
  Compass,
  Check
} from 'lucide-react';
import { useDawStore } from '../../store/useDawStore';
import { audioEngine, toggleGlobalRecording } from '../../audio/engine';
import { playLowLatencyDrumHit } from '../../audio/lowLatencySynth';

export const PADS = [
  { id: '1', note: 'C4', label: 'Kick', color: 'bg-blue-500' },
  { id: '2', note: 'D4', label: 'Snare', color: 'bg-red-500' },
  { id: '3', note: 'E4', label: 'Clap', color: 'bg-yellow-500' },
  { id: '4', note: 'F4', label: 'HiHat C', color: 'bg-green-500' },
  { id: '5', note: 'G4', label: 'HiHat O', color: 'bg-green-400' },
  { id: '6', note: 'A4', label: 'Crash', color: 'bg-purple-500' },
  { id: '7', note: 'B4', label: 'Tom 1', color: 'bg-orange-500' },
  { id: '8', note: 'C5', label: 'Tom 2', color: 'bg-orange-400' },
  { id: '9', note: 'D5', label: 'Perc 1', color: 'bg-pink-500' },
  { id: '10', note: 'E5', label: 'Perc 2', color: 'bg-pink-400' },
  { id: '11', note: 'F5', label: 'FX 1', color: 'bg-teal-500' },
  { id: '12', note: 'G5', label: 'FX 2', color: 'bg-teal-400' },
  { id: '13', note: 'A5', label: 'Vocal 1', color: 'bg-indigo-500' },
  { id: '14', note: 'B5', label: 'Vocal 2', color: 'bg-indigo-400' },
  { id: '15', note: 'C6', label: 'Kick 2', color: 'bg-blue-600' },
  { id: '16', note: 'D6', label: 'Snare 2', color: 'bg-red-600' },
];

const SEQUENCER_CHANNELS = [
  { note: 'C4', label: 'Kick', color: 'text-blue-400', activeBg: 'bg-blue-500/80', dotColor: 'bg-blue-400', shadow: 'shadow-blue-500/50' },
  { note: 'D4', label: 'Snare', color: 'text-red-400', activeBg: 'bg-red-500/80', dotColor: 'bg-red-400', shadow: 'shadow-red-500/50' },
  { note: 'E4', label: 'Clap', color: 'text-yellow-400', activeBg: 'bg-yellow-500/80', dotColor: 'bg-yellow-400', shadow: 'shadow-yellow-500/50' },
  { note: 'F4', label: 'HiHat Close', color: 'text-green-400', activeBg: 'bg-green-500/80', dotColor: 'bg-green-400', shadow: 'shadow-green-500/50' },
  { note: 'G4', label: 'HiHat Open', color: 'text-emerald-400', activeBg: 'bg-emerald-500/80', dotColor: 'bg-emerald-400', shadow: 'shadow-emerald-500/50' },
  { note: 'D5', label: 'Log Drum 1', color: 'text-pink-400', activeBg: 'bg-pink-500/80', dotColor: 'bg-pink-400', shadow: 'shadow-pink-500/50' },
  { note: 'E5', label: 'Log Drum 2', color: 'text-pink-300', activeBg: 'bg-pink-400/80', dotColor: 'bg-pink-300', shadow: 'shadow-pink-400/50' },
  { note: 'A5', label: 'Vocal Hit', color: 'text-indigo-400', activeBg: 'bg-indigo-500/80', dotColor: 'bg-indigo-400', shadow: 'shadow-indigo-500/50' },
];

export function DrumPads() {
  const tracks = useDawStore(s => s.tracks);
  const selectedTrackId = useDawStore(s => s.selectedTrackId);
  const isRecordingGlobally = useDawStore(s => s.isRecording);
  const addTrack = useDawStore(s => s.addTrack);
  const updateTrack = useDawStore(s => s.updateTrack);
  const addClip = useDawStore(s => s.addClip);
  const updateClip = useDawStore(s => s.updateClip);
  const clips = useDawStore(s => s.clips);
  
  const swingAmount = useDawStore(s => s.swingAmount);
  const setSwingAmount = useDawStore(s => s.setSwingAmount);
  const transportPosition = useDawStore(s => s.transportPosition);
  const playbackState = useDawStore(s => s.playbackState);

  const [activePads, setActivePads] = useState<Set<string>>(new Set());
  const [subTab, setSubTab] = useState<'sequencer' | 'automation' | 'pads'>('sequencer');

  // Find or target a drum / membrane track
  const targetTrack = tracks.find(t => t.id === selectedTrackId && t.synthType === 'membrane')
    || tracks.find(t => t.synthType === 'membrane')
    || tracks.find(t => t.id === selectedTrackId && t.type === 'midi') 
    || tracks.find(t => t.type === 'midi');

  // Retrieve current active sequencing clip inside the target track (or first loop clip starting at 0)
  const targetClip = targetTrack && targetTrack.clips && targetTrack.clips.length > 0 
    ? clips[targetTrack.clips[0]] 
    : null;

  const notesInClip = targetClip?.notes || [];

  // Automation logic
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Playhead step calculator (0 to 15)
  const currentStep = playbackState === 'playing' ? Math.floor(transportPosition) % 16 : -1;

  // Touch triggers for live pads
  const triggerPad = (e: React.PointerEvent, pad: typeof PADS[0]) => {
    if (e?.target instanceof HTMLElement && e.pointerId !== undefined) {
       try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch(err){}
    }
    if (!targetTrack) return;
    
    if (targetTrack.synthType !== 'membrane') {
       useDawStore.getState().updateTrack(targetTrack.id, { synthType: 'membrane' });
    }

    const play = () => {
       playLowLatencyDrumHit(pad.note, 0.7);
       
       setActivePads(prev => new Set(prev).add(pad.id));
       
       if (isRecordingGlobally) {
         audioEngine.recordMidiNoteStart(targetTrack.id, pad.note, 0.7);
       }
    };

    const startAndPlay = async () => {
       try {
         await Tone.start();
         const rawCtx = Tone.getContext().rawContext as AudioContext;
         if (rawCtx && rawCtx.state !== 'running') {
           await rawCtx.resume().catch(() => {});
         }
       } catch (ev) {}

       if (!audioEngine.isInitialized) {
         try {
           await audioEngine.init();
         } catch (ev) {}
       }
       play();
    };

    startAndPlay();
  };

  const releasePad = (e: React.PointerEvent, pad: typeof PADS[0]) => {
    if (e?.target instanceof HTMLElement && e.pointerId !== undefined) {
      try {
        if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        }
      } catch (err) {}
    }
    setActivePads(prev => {
      const next = new Set(prev);
      next.delete(pad.id);
      return next;
    });
    if (targetTrack) {
       if (isRecordingGlobally) {
          audioEngine.recordMidiNoteEnd(targetTrack.id, pad.note);
       }
    }
  };

  // Helper to toggle step note inside selected loop clip
  const toggleStep = (note: string, stepIndex: number) => {
    if (!targetTrack) return;
    
    let clipId = targetClip?.id;
    if (!targetClip) {
      // Create empty 16-step midi clip
      clipId = addClip(targetTrack.id, 0, undefined, undefined, 16);
    }

    const activeClip = useDawStore.getState().clips[clipId!];
    if (!activeClip) return;

    const existingNote = (activeClip.notes || []).find(
      n => n.note === note && Math.round(n.startTime) === stepIndex
    );

    if (existingNote) {
      useDawStore.getState().deleteNote(clipId!, existingNote.id);
    } else {
      useDawStore.getState().addNote(clipId!, note, stepIndex, 1);
      // Audition on click
      playLowLatencyDrumHit(note, 0.65);
    }
  };

  const isStepActive = (note: string, stepIndex: number) => {
    return notesInClip.some(n => n.note === note && Math.round(n.startTime) === stepIndex);
  };

  const clearPattern = () => {
    if (!targetClip) return;
    useDawStore.getState().updateClip(targetClip.id, { notes: [] });
  };

  // Preset Pattern Loader
  const loadPresetPattern = (presetType: 'afrobeat' | 'amapiano' | 'trap') => {
    if (!targetTrack) return;
    
    let clipId = targetClip?.id;
    if (!targetClip) {
      clipId = addClip(targetTrack.id, 0, undefined, undefined, 16);
    }
    
    // Clear existing notes first
    useDawStore.getState().updateClip(clipId!, { notes: [] });

    const notesToInsert: { note: string; startTime: number; duration: number }[] = [];

    if (presetType === 'afrobeat') {
      // Syncopated Afrobeat pattern
      notesToInsert.push(
        { note: 'C4', startTime: 0, duration: 1 },
        { note: 'C4', startTime: 6, duration: 1 },
        { note: 'C4', startTime: 10, duration: 1 },
        { note: 'C4', startTime: 14, duration: 1 }
      );
      notesToInsert.push(
        { note: 'D4', startTime: 4, duration: 1 },
        { note: 'E4', startTime: 12, duration: 1 }
      );
      // Hihat shuffle
      [0, 2, 4, 6, 8, 10, 12, 14].forEach(tick => {
        notesToInsert.push({ note: 'F4', startTime: tick, duration: 1 });
      });
      notesToInsert.push(
        { note: 'D5', startTime: 3, duration: 1 },
        { note: 'E5', startTime: 11, duration: 1 },
        { note: 'A5', startTime: 9, duration: 1 }
      );
    } else if (presetType === 'amapiano') {
      // Amapiano 4-on-the-floor, rolling hi-hats, and syncopated log roll
      notesToInsert.push(
        { note: 'C4', startTime: 0, duration: 1 },
        { note: 'C4', startTime: 4, duration: 1 },
        { note: 'C4', startTime: 8, duration: 1 },
        { note: 'C4', startTime: 12, duration: 1 }
      );
      for (let s = 0; s < 16; s++) {
        notesToInsert.push({ note: s % 4 === 3 ? 'G4' : 'F4', startTime: s, duration: 1 });
      }
      notesToInsert.push(
        { note: 'D5', startTime: 2, duration: 1 },
        { note: 'D5', startTime: 3, duration: 1 },
        { note: 'E5', startTime: 6, duration: 2 },
        { note: 'D5', startTime: 10, duration: 1 },
        { note: 'E5', startTime: 11, duration: 1 },
        { note: 'A5', startTime: 14, duration: 2 }
      );
    } else if (presetType === 'trap') {
      // Trap heavy kick-snare bounce and rolls
      notesToInsert.push(
        { note: 'C4', startTime: 0, duration: 1 },
        { note: 'C4', startTime: 11, duration: 1 }
      );
      notesToInsert.push(
        { note: 'E4', startTime: 4, duration: 1 },
        { note: 'E4', startTime: 12, duration: 1 }
      );
      // Hi-hat rolls
      [0, 2, 4, 5, 6, 8, 10, 12, 13, 14, 15].forEach(tick => {
        notesToInsert.push({ note: 'F4', startTime: tick, duration: 1 });
      });
      notesToInsert.push(
        { note: 'D5', startTime: 7, duration: 1 },
        { note: 'E5', startTime: 15, duration: 1 }
      );
    }

    notesToInsert.forEach(n => {
      useDawStore.getState().addNote(clipId!, n.note, n.startTime, n.duration);
    });
  };

  // Automation drawing callbacks
  const setCurvePoint = (step: number, val: number) => {
    if (!targetTrack) return;
    const currentCurve = [...(targetTrack.automationCurve || Array(16).fill(0.8))];
    currentCurve[step] = Math.min(1, Math.max(0, val));
    updateTrack(targetTrack.id, {
      automationCurve: currentCurve,
      automationEnabled: true
    });
  };

  const setAutomationType = (type: 'lowpass' | 'reverb' | 'volume') => {
    if (!targetTrack) return;
    
    // Enable lowpass/reverb globally if disabled so user hears results instantly
    const trackFx = { ...targetTrack.fx };
    if (type === 'lowpass' && !trackFx.lowpass?.enabled) {
      trackFx.lowpass = { enabled: true, frequency: 2000, Q: 1 };
    } else if (type === 'reverb' && !trackFx.reverb?.enabled) {
      trackFx.reverb = { enabled: true, decay: 1.5, mix: 0.3 };
    }

    updateTrack(targetTrack.id, {
      automationType: type,
      automationCurve: targetTrack.automationCurve || Array(16).fill(0.8),
      automationEnabled: true,
      fx: trackFx
    });
  };

  const handleSvgInteraction = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    if (!svgRef.current || !targetTrack) return;
    const rect = svgRef.current.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;

    const percentX = Math.min(1, Math.max(0, relativeX / rect.width));
    const percentY = Math.min(1, Math.max(0, relativeY / rect.height));

    const targetStep = Math.min(15, Math.max(0, Math.floor(percentX * 16)));
    const targetValue = 1 - percentY;

    setCurvePoint(targetStep, targetValue);
  };

  // Preset curves
  const loadShapePreset = (shape: 'sine' | 'ramp' | 'gate' | 'saw') => {
    if (!targetTrack) return;
    const curve = Array(16).fill(0.5);
    for (let i = 0; i < 16; i++) {
      if (shape === 'sine') {
        curve[i] = 0.5 + 0.4 * Math.sin((i / 16) * Math.PI * 2);
      } else if (shape === 'ramp') {
        curve[i] = i / 15;
      } else if (shape === 'gate') {
        curve[i] = i % 2 === 0 ? 0.95 : 0.05;
      } else if (shape === 'saw') {
        curve[i] = (i % 4) / 3;
      }
    }
    updateTrack(targetTrack.id, {
      automationCurve: curve,
      automationEnabled: true
    });
  };

  const clearAutomation = () => {
    if (!targetTrack) return;
    updateTrack(targetTrack.id, {
      automationCurve: Array(16).fill(0.8),
      automationEnabled: false
    });
  };

  // Safe initialize default audio tracks if none exist
  const createDefaultTrack = () => {
    addTrack('midi', 'membrane');
  };

  return (
    <div className="h-full w-full bg-[#070708] flex flex-col items-center overflow-y-auto overflow-x-hidden px-4 pb-24 text-gray-200 select-none scrollbar-thin">
      
      {/* Title Routing Info */}
      <div className="w-full max-w-5xl mt-4 mb-4 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/5 pb-4 gap-4">
        <div>
          <h2 className="text-white text-base font-black tracking-widest uppercase flex items-center gap-2">
            <Grid className="text-[#00FF9C] h-4 w-4 animate-pulse" />
            Human Studio Builder
          </h2>
          {targetTrack ? (
            <p className="text-[#00FF9C] text-[10px] uppercase font-mono mt-0.5">
              ROUTING ACTIVE MIDI DATA TO: <span className="font-bold underline">{targetTrack.name}</span> ({targetTrack.synthType || 'synthesizer'})
            </p>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-red-500 font-mono text-[10px]">NO MIDI SOUNDBOARD FOUND. PLEASE TRIGGER ENGINE</span>
              <button 
                onClick={createDefaultTrack}
                className="px-2 py-0.5 bg-red-500 text-white rounded text-[9px] font-bold uppercase tracking-wider hover:bg-red-400"
              >
                Create Drum Channel Target
              </button>
            </div>
          )}
        </div>

        {/* Global Recorder Button */}
        <div className="flex gap-2">
          <button 
            className={`text-[10px] px-3.5 py-1.5 font-bold uppercase rounded-lg flex items-center gap-1.5 transition-all
              ${isRecordingGlobally ? 'bg-red-500 text-white animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-[#18181B] text-gray-300 border border-neutral-800 hover:bg-neutral-800'}`}
            onClick={() => toggleGlobalRecording()}
          >
            <div className={`w-2 h-2 rounded-full ${isRecordingGlobally ? 'bg-white' : 'bg-red-500'}`} />
            Record Live Multi-Channel to Timeline
          </button>
        </div>
      </div>

      {/* Mode Sub-Tab Toggles */}
      <div className="w-full max-w-5xl grid grid-cols-3 bg-[#111114] p-1.5 rounded-xl border border-neutral-800/60 mb-6 shrink-0 font-bold tracking-widest text-[10px] text-center">
        <button
          onClick={() => setSubTab('sequencer')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${subTab === 'sequencer' ? 'bg-[#00FF9C] text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
        >
          <Grid size={14} />
          Step Sequencer
        </button>
        <button
          onClick={() => setSubTab('automation')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${subTab === 'automation' ? 'bg-[#00FF9C] text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
        >
          <Activity size={14} />
          Automation Clip Draw
        </button>
        <button
          onClick={() => setSubTab('pads')}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${subTab === 'pads' ? 'bg-[#00FF9C] text-black shadow-md' : 'text-gray-400 hover:text-white'}`}
        >
          <Layers size={14} />
          Live MPC Pads
        </button>
      </div>

      {/* --- SUBTAB 1: 16-STEP GRID DRUM SEQUENCER --- */}
      {subTab === 'sequencer' && (
        <div className="w-full max-w-5xl bg-[#0F0F12] border border-neutral-800/80 rounded-2xl p-3 shadow-2xl flex flex-col">
          
          {/* Sequencer Toolbar */}
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 mb-6 border-b border-neutral-800/60 pb-4">
            
            {/* Swing Quantize Micro-Timing */}
            <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center gap-4">
              <div className="flex items-center gap-2 text-xs uppercase font-bold text-gray-300">
                <SlidersHorizontal size={14} className="text-[#00FF9C]" />
                Micro-Timing Swing:
                <span className="text-[#00FF9C] font-mono">{swingAmount}%</span>
              </div>
              <input 
                type="range"
                min="0"
                max="100"
                value={swingAmount}
                onChange={(e) => setSwingAmount(Number(e.target.value))}
                className="flex-1 max-w-[280px] accent-[#00FF9C] bg-neutral-800 h-1.5 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[9px] text-gray-500 font-mono uppercase hidden md:inline">
                ({swingAmount === 0 ? 'Clinical Quantized Grid' : 'Laid-Back Human Pocket Groove'})
              </span>
            </div>

            {/* Quick Presets & Clear */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[10px] uppercase font-mono text-gray-400">Loads Beats:</span>
              <button 
                onClick={() => loadPresetPattern('afrobeat')}
                className="px-3 py-1.5 bg-[#18181B] hover:bg-neutral-800 border border-neutral-800 text-xs font-bold rounded-lg uppercase tracking-wider text-gray-300 flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
              >
                AfroBounce 🥁
              </button>
              <button 
                onClick={() => loadPresetPattern('amapiano')}
                className="px-3 py-1.5 bg-[#18181B] hover:bg-neutral-800 border border-neutral-800 text-xs font-bold rounded-lg uppercase tracking-wider text-gray-300 flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
              >
                Amapiano Log 🎹
              </button>
              <button 
                onClick={() => loadPresetPattern('trap')}
                className="px-3 py-1.5 bg-[#18181B] hover:bg-neutral-800 border border-neutral-800 text-xs font-bold rounded-lg uppercase tracking-wider text-gray-300 flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
              >
                Trap 808 ⚡
              </button>
              <button 
                onClick={clearPattern}
                className="px-2.5 py-1.5 bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-500/10 text-xs font-bold rounded-lg uppercase tracking-wider flex items-center gap-1 hover:scale-105 active:scale-95 transition-all"
                title="Clear Sequence Pattern"
              >
                <Trash2 size={13} />
                Clear
              </button>
            </div>
          </div>

          {/* Core Step-Sequencer 16-Step Matrix */}
          <div className="overflow-x-auto overflow-y-hidden pb-4 select-none">
            <div className="min-w-[800px] flex flex-col gap-2">
              
              {/* Playhead numbers / step ticks */}
              <div className="flex items-center text-[10px] font-mono font-bold text-gray-500 tracking-wider">
                <div className="w-28 shrink-0 text-left uppercase text-[9px]">Drum Channel</div>
                <div className="flex-1 grid grid-cols-16 gap-1">
                  {Array(16).fill(0).map((_, i) => (
                    <div 
                      key={i} 
                      className={`text-center py-1 rounded transition-colors flex flex-col items-center justify-center relative
                        ${currentStep === i ? 'text-[#00FF9C]' : ''}`}
                    >
                      <span>{i + 1}</span>
                      <div className={`w-1 h-1 rounded-full mt-1 transition-all duration-75
                        ${currentStep === i ? 'bg-[#00FF9C] scale-150 shadow-[0_0_8px_#00FF9C]' : 'bg-neutral-800'}`} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Rows for channels */}
              {SEQUENCER_CHANNELS.map((chan) => (
                <div key={chan.note} className="flex items-center h-10 group/row">
                  {/* Channel label */}
                  <button 
                    onClick={() => playLowLatencyDrumHit(chan.note, 0.75)}
                    className={`w-28 shrink-0 font-extrabold text-xs text-left select-none uppercase hover:brightness-110 flex items-center gap-1 ${chan.color}`}
                  >
                    <Plus size={10} className="opacity-40 group-hover/row:opacity-100 transition-opacity" />
                    {chan.label}
                  </button>
                  
                  {/* 16 cells */}
                  <div className="flex-1 grid grid-cols-16 gap-1 select-none">
                    {Array(16).fill(0).map((_, stepIdx) => {
                      const active = isStepActive(chan.note, stepIdx);
                      // Shade every block of 4 beats
                      const isEvenBeat = Math.floor(stepIdx / 4) % 2 === 0;
                      return (
                        <button
                          key={stepIdx}
                          onClick={() => toggleStep(chan.note, stepIdx)}
                          className={`h-9 rounded-md border text-center transition-all duration-75 relative select-none cursor-pointer
                            ${active 
                              ? `${chan.activeBg} border-transparent scale-95 shadow-lg ${chan.shadow}` 
                              : `border-neutral-800 hover:border-neutral-700 hover:bg-neutral-850 ${isEvenBeat ? 'bg-[#151518]' : 'bg-[#1D1D22]'}`
                            }
                            ${currentStep === stepIdx ? 'ring-1 ring-[#00FF9C] ring-offset-1 ring-offset-black' : ''}`}
                        >
                          {/* Inner touch glow or dot */}
                          {active && (
                            <div className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${chan.dotColor}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-neutral-800/50 flex flex-col sm:flex-row justify-between items-center text-[10px] font-mono text-gray-500 gap-4">
            <div className="flex items-center gap-1.5 uppercase">
              <span className="w-2.5 h-2.5 rounded-full bg-[#151518] border border-neutral-800" />
              <span>Step-block 1 & 3 Shade</span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#1D1D22] border border-neutral-800 ml-3" />
              <span>Step-block 2 & 4 Shade</span>
            </div>
            <p className="text-[#00FF9C]/60 text-right uppercase">
              🖱️ Clicking toggles pattern notes. Presets populate beats instantly!
            </p>
          </div>
        </div>
      )}

      {/* --- SUBTAB 2: AUTOMATION ENVELOPE DRAWING --- */}
      {subTab === 'automation' && (
        <div className="w-full max-w-5xl bg-[#0F0F12] border border-neutral-800/80 rounded-2xl p-3 shadow-2xl flex flex-col">
          
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 mb-6 border-b border-neutral-800/60 pb-4">
            <div>
              <h3 className="text-white text-sm font-extrabold uppercase tracking-widest flex items-center gap-1.5">
                <Activity className="text-[#00FF9C]" size={15} />
                Real-Time Automation Envelope
              </h3>
              <p className="text-gray-500 text-[10px] uppercase font-mono mt-0.5">
                Modulate parameters dynamically over the 16 sixteenth-note steps loop cycle
              </p>
            </div>

            {/* Target Selectors */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => setAutomationType('lowpass')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                  targetTrack?.automationType === 'lowpass' && targetTrack?.automationEnabled
                    ? 'bg-[#00FF9C]/10 border-[#00FF9C] text-[#00FF9C] font-black'
                    : 'bg-neutral-950 border-neutral-800 text-gray-400 hover:text-white'
                }`}
              >
                Lowpass Frequency 🎚️
              </button>
              <button
                onClick={() => setAutomationType('reverb')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                  targetTrack?.automationType === 'reverb' && targetTrack?.automationEnabled
                    ? 'bg-[#00FF9C]/10 border-[#00FF9C] text-[#00FF9C] font-black'
                    : 'bg-neutral-950 border-neutral-800 text-gray-400 hover:text-white'
                }`}
              >
                Reverb Wet % 🌊
              </button>
              <button
                onClick={() => setAutomationType('volume')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                  targetTrack?.automationType === 'volume' && targetTrack?.automationEnabled
                    ? 'bg-[#00FF9C]/10 border-[#00FF9C] text-[#00FF9C] font-black'
                    : 'bg-neutral-950 border-neutral-800 text-gray-400 hover:text-white'
                }`}
              >
                Channel Volume 🔊
              </button>
            </div>
          </div>

          {!targetTrack ? (
            <div className="text-center py-12 text-gray-500 uppercase font-mono text-xs">
              Midi Routing target required to test automations.
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              
              {/* Preset curves toolbar */}
              <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-4 bg-neutral-950 p-3 rounded-xl border border-neutral-800/80">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-mono text-gray-400">Automation Curve:</span>
                  <div className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase font-mono
                    ${targetTrack.automationEnabled ? 'bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/20' : 'bg-neutral-900 text-gray-500 border border-neutral-800'}`}>
                    {targetTrack.automationEnabled ? `RUNNING ENVELOPE: ${targetTrack.automationType || 'lp'}` : 'SWITCHED OFF/INACTIVE'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-[10px] uppercase font-mono text-gray-500 mr-1">Load Shapes:</span>
                  <button 
                    onClick={() => loadShapePreset('sine')}
                    className="px-2.5 py-1 text-[10px] bg-neutral-900 text-gray-300 hover:text-white rounded border border-neutral-800 hover:border-neutral-700 font-bold uppercase tracking-wide"
                  >
                    Sine LFO 〰️
                  </button>
                  <button 
                    onClick={() => loadShapePreset('ramp')}
                    className="px-2.5 py-1 text-[10px] bg-neutral-900 text-gray-300 hover:text-white rounded border border-neutral-800 hover:border-neutral-700 font-bold uppercase tracking-wide"
                  >
                    Linear Rise 📈
                  </button>
                  <button 
                    onClick={() => loadShapePreset('gate')}
                    className="px-2.5 py-1 text-[10px] bg-neutral-900 text-gray-300 hover:text-white rounded border border-neutral-800 hover:border-neutral-700 font-bold uppercase tracking-wide"
                  >
                    Gate Tremolo ⚡
                  </button>
                  <button 
                    onClick={() => loadShapePreset('saw')}
                    className="px-2.5 py-1 text-[10px] bg-neutral-900 text-gray-300 hover:text-white rounded border border-neutral-800 hover:border-neutral-700 font-bold uppercase tracking-wide"
                  >
                    Saw sweeps 📐
                  </button>
                  
                  <button 
                    onClick={clearAutomation}
                    className="px-2 py-1 bg-red-950/20 hover:bg-red-900/40 text-red-400 rounded border border-red-500/10 font-bold uppercase tracking-wide ml-2"
                  >
                    Clear Canvas
                  </button>
                </div>
              </div>

              {/* Master Drawing SVG Pad */}
              <div className="relative w-full aspect-[2.8/1] min-h-[180px] bg-[#0A0A0C] border border-neutral-800/80 rounded-2xl overflow-hidden shadow-inner select-none cursor-crosshair group/pad">
                
                {/* SVG Canvas drawer */}
                <svg
                  ref={svgRef}
                  onMouseDown={(e) => { setIsDrawing(true); handleSvgInteraction(e); }}
                  onMouseMove={(e) => { if (isDrawing) handleSvgInteraction(e); }}
                  onMouseUp={() => setIsDrawing(false)}
                  onMouseLeave={() => setIsDrawing(false)}
                  onTouchStart={(e) => { setIsDrawing(true); handleSvgInteraction(e); }}
                  onTouchMove={(e) => { if (isDrawing) handleSvgInteraction(e); }}
                  onTouchEnd={() => setIsDrawing(false)}
                  className="absolute inset-0 h-full w-full select-none"
                  style={{ touchAction: 'none' }}
                >
                  {/* Draw 16 Grid Columns */}
                  {Array(16).fill(0).map((_, s) => {
                    const xPosition = `${(s / 16) * 100}%`;
                    return (
                      <line
                        key={s}
                        x1={xPosition}
                        y1="0"
                        x2={xPosition}
                        y2="100%"
                        stroke="#1D1D22"
                        strokeWidth="1"
                        strokeDasharray="4,4"
                      />
                    );
                  })}

                  {/* Highlight current playhead column */}
                  {currentStep >= 0 && (
                    <rect
                      x={`${(currentStep / 16) * 100}%`}
                      y="0"
                      width={`${(1 / 16) * 100}%`}
                      height="100%"
                      fill="#00FF9C"
                      opacity="0.04"
                      className="transition-all duration-75"
                    />
                  )}

                  {/* Render 16 glowing bars indicating parameter values */}
                  {(() => {
                    const curve = targetTrack.automationCurve || Array(16).fill(0.8);
                    return curve.map((val, stepIdx) => {
                      const columnWidthPercent = 100 / 16;
                      const xPercent = (stepIdx * columnWidthPercent) + (columnWidthPercent / 4);
                      const heightPercent = val * 100;
                      const yPercent = 100 - heightPercent;
                      return (
                        <g key={stepIdx}>
                          {/* Background Glow Column */}
                          <rect
                            x={`${xPercent}%`}
                            y={`${yPercent}%`}
                            width={`${columnWidthPercent / 2}%`}
                            height={`${heightPercent}%`}
                            fill="url(#columnGlowGradient)"
                            opacity="0.15"
                            rx="2"
                          />
                          {/* Active Parameter Point Handle */}
                          <circle
                            cx={`${(stepIdx * columnWidthPercent) + (columnWidthPercent / 2)}%`}
                            cy={`${yPercent}%`}
                            r={currentStep === stepIdx ? "6" : "4"}
                            fill={currentStep === stepIdx ? "#FFFFFF" : "#00FF9C"}
                            stroke="#111"
                            strokeWidth="1.5"
                            className="transition-all"
                            style={{ filter: "drop-shadow(0px 0px 4px #00FF9C)" }}
                          />
                        </g>
                      );
                    });
                  })()}

                  {/* Draw interpolation connecting curves line representation */}
                  {(() => {
                    const curve = targetTrack.automationCurve || Array(16).fill(0.8);
                    const pointWidth = 100 / 16;
                    let pathD = "";
                    curve.forEach((val, i) => {
                      const cx = (i * pointWidth) + (pointWidth / 2);
                      const cy = (1 - val) * 100;
                      if (i === 0) {
                        pathD = `M ${cx}% ${cy}%`;
                      } else {
                        pathD += ` L ${cx}% ${cy}%`;
                      }
                    });
                    return (
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#00FF9C"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.85"
                        style={{ filter: "drop-shadow(0px 0px 8px rgba(0,255,156,0.5))" }}
                      />
                    );
                  })()}

                  {/* Color Gradients Declaration */}
                  <defs>
                    <linearGradient id="columnGlowGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00FF9C" />
                      <stop offset="100%" stopColor="#005a36" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Left side axis legends */}
                <div className="absolute top-2 left-3 text-[8px] uppercase font-mono font-bold tracking-widest text-zinc-500 flex flex-col justify-between h-[calc(100%-16px)] pointer-events-none select-none">
                  <span>MAX VALUE (1.0)</span>
                  <span>CENTER (0.5)</span>
                  <span>MIN VALUE (0.0)</span>
                </div>
              </div>

              {/* Automation Explainer Readout helper based on active selection */}
              <div className="bg-[#111114] p-4 rounded-xl border border-neutral-800/80 flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-[#00FF9C]/10 border border-[#00FF9C]/20 flex items-center justify-center text-[#00FF9C] shrink-0">
                  <Compass size={18} />
                </div>
                <div className="text-xs">
                  <span className="text-white font-extrabold uppercase tracking-wide inline-block mb-0.5">
                    {targetTrack.automationType === 'lowpass' && 'LOW-PASS RESONANT FILTER SWEETS'}
                    {targetTrack.automationType === 'reverb' && 'REVERB WET-MIX EXPONENT INTERACTION'}
                    {targetTrack.automationType === 'volume' && 'SOCIABLE FADER VOLUME SWELLS'}
                  </span>
                  <p className="text-gray-400 font-medium leading-relaxed">
                    {targetTrack.automationType === 'lowpass' && 'Sweeps the filter from a muddy sub-bass hum (150Hz) to open bright frequencies (16kHz). Ideal for building sudden Amapiano drops or transitions.'}
                    {targetTrack.automationType === 'reverb' && 'Bounces the dry project sound into a wide spatial echo chamber. Draw spikes at the ending sixteenth beats to create delayed atmospheric tails.'}
                    {targetTrack.automationType === 'volume' && 'Controls the audio hardware volume directly. Can be drawn to instantly mute certain on-beats or smoothly swells loops up over the bar.'}
                  </p>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* --- SUBTAB 3: MPC FINGER PADS PLAYGROUND --- */}
      {subTab === 'pads' && (
        <div className="w-full max-w-md bg-[#0F0F12] border border-neutral-800/80 rounded-2xl p-3 shadow-2xl flex flex-col items-center">
          <div className="text-center mb-5 shrink-0">
            <h3 className="text-white text-xs font-extrabold uppercase tracking-widest">
              Playable Finger MPC Pads
            </h3>
            <p className="text-gray-500 font-mono text-[9px] uppercase mt-0.5">
              Audition individual transients and record live sequences over repeating runs
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2 w-full aspect-square" style={{ touchAction: 'manipulation' }}>
            {PADS.map(pad => (
              <button
                key={pad.id}
                onPointerDown={(e) => triggerPad(e as any, pad)}
                onPointerUp={(e) => releasePad(e as any, pad)}
                onPointerCancel={(e) => releasePad(e as any, pad)}
                onPointerLeave={(e) => {
                  if (activePads.has(pad.id)) releasePad(e as any, pad);
                }}
                className={`
                  rounded-2xl flex flex-col items-center justify-center p-2 relative overflow-hidden transition-all duration-75 select-none cursor-pointer
                  ${activePads.has(pad.id) ? 'scale-95 brightness-150 ring-2 ring-[#00FF9C]' : 'scale-100 hover:brightness-110'}
                  ${pad.color} bg-opacity-15 border border-white/5
                `}
                style={{
                  boxShadow: activePads.has(pad.id) ? `0 0 25px ${pad.color.replace('bg-', '')}` : 'none'
                }}
              >
                <div className={`absolute inset-0 ${pad.color} opacity-20`} />
                <span className="relative z-10 text-white font-extrabold text-[11px] select-none">{pad.label}</span>
                <span className="relative z-10 text-white/40 font-mono text-[8px] mt-0.5 block select-none">{pad.note}</span>
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
