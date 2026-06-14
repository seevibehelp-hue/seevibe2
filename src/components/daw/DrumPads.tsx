// @ts-nocheck
import React, { useMemo, useRef, useState } from 'react';
import * as Tone from 'tone';
import { Play, Square, RotateCcw } from 'lucide-react';
import { useDawStore } from '../../store/useDawStore';
import { audioEngine, toggleGlobalRecording } from '../../audio/engine';
import { playLowLatencyDrumHit } from '../../audio/lowLatencySynth';

const KIT_NAMES = ['Trap Kit', 'Hip Hop Kit', 'Pop Kit', 'Electronic Kit'] as const;

const PAD_COLORS = [
  'bg-blue-500', 'bg-orange-500', 'bg-red-500', 'bg-yellow-500',
  'bg-green-500', 'bg-emerald-500', 'bg-pink-500', 'bg-fuchsia-500',
  'bg-cyan-500', 'bg-sky-500', 'bg-purple-500', 'bg-violet-500',
  'bg-indigo-500', 'bg-rose-500', 'bg-teal-500', 'bg-amber-500',
];

const KIT_PAD_SETS = {
  'Trap Kit': [
    { id: '1', note: 'C4', label: 'Kick' },
    { id: '2', note: 'C6', label: '808' },
    { id: '3', note: 'D4', label: 'Snare' },
    { id: '4', note: 'E4', label: 'Clap' },
    { id: '5', note: 'F4', label: 'Hi-Hat' },
    { id: '6', note: 'G4', label: 'Open HH' },
    { id: '7', note: 'D5', label: 'Perc 1' },
    { id: '8', note: 'E5', label: 'Perc 2' },
    { id: '9', note: 'D5', label: 'Rim' },
    { id: '10', note: 'B4', label: 'Tom' },
    { id: '11', note: 'A4', label: 'Crash' },
    { id: '12', note: 'F5', label: 'FX 1' },
    { id: '13', note: 'A5', label: 'Vox 1' },
    { id: '14', note: 'B5', label: 'Vox 2' },
    { id: '15', note: 'G5', label: 'FX 2' },
    { id: '16', note: 'F5', label: 'FX 3' },
  ],
  'Hip Hop Kit': [
    { id: '1', note: 'C4', label: 'Kick' },
    { id: '2', note: 'C6', label: 'Boom' },
    { id: '3', note: 'D4', label: 'Snare' },
    { id: '4', note: 'E4', label: 'Clap' },
    { id: '5', note: 'F4', label: 'Hi-Hat' },
    { id: '6', note: 'G4', label: 'Open HH' },
    { id: '7', note: 'E5', label: 'Shaker' },
    { id: '8', note: 'F5', label: 'Tamb' },
    { id: '9', note: 'D5', label: 'Rim' },
    { id: '10', note: 'B4', label: 'Tom Lo' },
    { id: '11', note: 'C5', label: 'Tom Hi' },
    { id: '12', note: 'A4', label: 'Crash' },
    { id: '13', note: 'G5', label: 'Scratch' },
    { id: '14', note: 'A5', label: 'Vocal' },
    { id: '15', note: 'F5', label: 'FX' },
    { id: '16', note: 'D5', label: 'Bell' },
  ],
  'Pop Kit': [
    { id: '1', note: 'C4', label: 'Kick' },
    { id: '2', note: 'D5', label: 'Side' },
    { id: '3', note: 'D4', label: 'Snare' },
    { id: '4', note: 'E4', label: 'Clap' },
    { id: '5', note: 'F4', label: 'Hi-Hat' },
    { id: '6', note: 'G4', label: 'Open HH' },
    { id: '7', note: 'E5', label: 'Snap' },
    { id: '8', note: 'F5', label: 'Perc' },
    { id: '9', note: 'G5', label: 'Ride' },
    { id: '10', note: 'B4', label: 'Tom' },
    { id: '11', note: 'A4', label: 'Crash' },
    { id: '12', note: 'F5', label: 'FX' },
    { id: '13', note: 'D5', label: 'Cowbell' },
    { id: '14', note: 'E5', label: 'Shaker' },
    { id: '15', note: 'F5', label: 'Tamb' },
    { id: '16', note: 'D5', label: 'Clave' },
  ],
  'Electronic Kit': [
    { id: '1', note: 'C4', label: 'Kick' },
    { id: '2', note: 'C6', label: 'Sub' },
    { id: '3', note: 'D4', label: 'Snare' },
    { id: '4', note: 'E4', label: 'Clap' },
    { id: '5', note: 'F4', label: 'Hi-Hat' },
    { id: '6', note: 'G4', label: 'Open HH' },
    { id: '7', note: 'F5', label: 'Zap' },
    { id: '8', note: 'G5', label: 'Blip' },
    { id: '9', note: 'E5', label: 'Noise' },
    { id: '10', note: 'C5', label: 'Sweep' },
    { id: '11', note: 'A4', label: 'Crash' },
    { id: '12', note: 'F5', label: 'FX 1' },
    { id: '13', note: 'G5', label: 'FX 2' },
    { id: '14', note: 'A5', label: 'FX 3' },
    { id: '15', note: 'B5', label: 'Stab' },
    { id: '16', note: 'C5', label: 'Rise' },
  ],
};

export const PADS = KIT_PAD_SETS['Trap Kit'].map((pad, index) => ({ ...pad, color: PAD_COLORS[index] }));

export function DrumPads() {
  const tracks = useDawStore(s => s.tracks);
  const selectedTrackId = useDawStore(s => s.selectedTrackId);
  const isRecordingGlobally = useDawStore(s => s.isRecording);
  const addTrack = useDawStore(s => s.addTrack);
  const updateTrack = useDawStore(s => s.updateTrack);

  const [selectedKit, setSelectedKit] = useState<typeof KIT_NAMES[number]>('Trap Kit');
  const [activePads, setActivePads] = useState<Set<string>>(new Set());
  const [recordingPattern, setRecordingPattern] = useState(false);
  const [playingPattern, setPlayingPattern] = useState(false);
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [pattern, setPattern] = useState<{ id: string; note: string; time: number }[]>([]);
  const recordStartRef = useRef(0);
  const timeoutIdsRef = useRef<number[]>([]);

  const targetTrack = tracks.find(t => t.id === selectedTrackId && t.type === 'midi')
    || tracks.find(t => t.synthType === 'membrane')
    || tracks.find(t => t.type === 'midi');

  const pads = useMemo(
    () => KIT_PAD_SETS[selectedKit].map((pad, index) => ({ ...pad, color: PAD_COLORS[index] })),
    [selectedKit],
  );

  const ensureDrumTrack = () => {
    if (!targetTrack) {
      addTrack('midi', 'membrane');
      return null;
    }
    if (targetTrack.synthType !== 'membrane') {
      updateTrack(targetTrack.id, { synthType: 'membrane' });
    }
    return targetTrack;
  };

  const clearPadVisual = (padId: string) => {
    window.setTimeout(() => {
      setActivePads(prev => {
        const next = new Set(prev);
        next.delete(padId);
        return next;
      });
    }, 150);
  };

  const triggerPad = async (pad: (typeof pads)[number]) => {
    const track = ensureDrumTrack();
    if (!track) return;
    try {
      await Tone.start();
      const rawCtx = Tone.getContext().rawContext as AudioContext;
      if (rawCtx?.state !== 'running') await rawCtx.resume().catch(() => {});
      if (!audioEngine.isInitialized) await audioEngine.init().catch(() => {});
    } catch {}

    setActivePads(prev => new Set(prev).add(pad.id));
    clearPadVisual(pad.id);
    playLowLatencyDrumHit(pad.note, 0.75);

    if (isRecordingGlobally) {
      audioEngine.recordMidiNoteStart(track.id, pad.note, 0.75);
      window.setTimeout(() => audioEngine.recordMidiNoteEnd(track.id, pad.note), 120);
    }

    if (recordingPattern) {
      setPattern(prev => [...prev, { id: `${pad.id}-${Date.now()}`, note: pad.note, time: Date.now() - recordStartRef.current }]);
    }
  };

  const stopPatternPlayback = () => {
    timeoutIdsRef.current.forEach(clearTimeout);
    timeoutIdsRef.current = [];
    setPlayingPattern(false);
  };

  const playPattern = () => {
    if (!pattern.length) return;
    stopPatternPlayback();
    setPlayingPattern(true);
    const duration = pattern[pattern.length - 1]?.time ?? 0;
    timeoutIdsRef.current = pattern.map(step => window.setTimeout(() => {
      const pad = pads.find(item => item.note === step.note) || { ...pads[0], ...step };
      triggerPad(pad);
    }, step.time));

    timeoutIdsRef.current.push(window.setTimeout(() => {
      if (loopEnabled) {
        playPattern();
      } else {
        setPlayingPattern(false);
      }
    }, duration + 140));
  };

  const togglePatternRecording = () => {
    if (recordingPattern) {
      setRecordingPattern(false);
      return;
    }
    setPattern([]);
    recordStartRef.current = Date.now();
    setRecordingPattern(true);
  };

  return (
    <div className="h-full w-full bg-[#070708] overflow-y-auto px-4 pb-24 text-gray-200">
      <div className="mx-auto mt-4 flex w-full max-w-5xl flex-col gap-4">
        <div className="flex flex-col gap-3 border-b border-white/5 pb-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.22em] text-white">Drum Pad</h2>
            <p className="mt-1 text-[10px] font-mono uppercase text-[#00FF9C]">
              Reference-style live pads replacing the old Studio drum session
            </p>
          </div>
          <button
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[10px] font-bold uppercase transition-all ${isRecordingGlobally ? 'bg-red-500 text-white' : 'border border-neutral-800 bg-[#18181B] text-gray-300 hover:bg-neutral-800'}`}
            onClick={() => toggleGlobalRecording()}
          >
            <span className={`h-2 w-2 rounded-full ${isRecordingGlobally ? 'bg-white' : 'bg-red-500'}`} />
            {isRecordingGlobally ? 'Recording to Timeline' : 'Record to Timeline'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {KIT_NAMES.map(kit => (
            <button
              key={kit}
              onClick={() => setSelectedKit(kit)}
              className={`rounded-full px-3 py-1.5 text-[10px] font-semibold transition-colors ${selectedKit === kit ? 'bg-[#00FF9C] text-black' : 'bg-[#151518] text-gray-300 hover:text-white'}`}
            >
              {kit}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={togglePatternRecording}
            className={`flex items-center gap-1 rounded-lg px-3 py-2 text-[10px] font-bold uppercase ${recordingPattern ? 'bg-red-500 text-white' : 'border border-red-500/30 bg-red-500/15 text-red-300'}`}
          >
            {recordingPattern ? <Square size={10} /> : <span className="h-2 w-2 rounded-full bg-current" />}
            {recordingPattern ? 'Stop Pattern' : 'Record Pattern'}
          </button>
          <button
            onClick={playingPattern ? stopPatternPlayback : playPattern}
            disabled={!pattern.length}
            className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-[#151518] px-3 py-2 text-[10px] font-bold uppercase text-gray-300 disabled:opacity-40"
          >
            <Play size={10} />
            {playingPattern ? 'Stop' : 'Play'}
          </button>
          <button
            onClick={() => { stopPatternPlayback(); setPattern([]); }}
            className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-[#151518] px-3 py-2 text-[10px] font-bold uppercase text-gray-300"
          >
            <RotateCcw size={10} />
            Clear
          </button>
          <label className="ml-auto flex items-center gap-2 text-[10px] uppercase text-gray-400">
            <input type="checkbox" checked={loopEnabled} onChange={() => setLoopEnabled(v => !v)} className="accent-[#00FF9C]" />
            Loop
          </label>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:gap-3" style={{ touchAction: 'manipulation' }}>
          {pads.map((pad, index) => {
            const isActive = activePads.has(pad.id);
            return (
              <button
                key={`${selectedKit}-${pad.id}`}
                onPointerDown={() => triggerPad(pad)}
                className={`relative flex aspect-square min-h-[78px] flex-col items-center justify-center overflow-hidden rounded-xl border p-2 transition-all duration-75 ${isActive ? 'scale-[0.97] border-[#00FF9C]' : 'border-white/10'} ${pad.color} bg-opacity-10`}
              >
                <div className={`absolute inset-0 ${pad.color} ${isActive ? 'opacity-40' : 'opacity-15'}`} />
                <span className="relative z-10 text-center text-[11px] font-bold text-white">{pad.label}</span>
                <span className="relative z-10 mt-1 text-[8px] font-mono uppercase text-white/45">{index + 1}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
