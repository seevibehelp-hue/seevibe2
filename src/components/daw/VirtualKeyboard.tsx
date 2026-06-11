// @ts-nocheck
import React, { useRef, useEffect, useState } from 'react';
import { useDawStore } from '../../store/useDawStore';
import { audioEngine, toggleGlobalRecording } from '../../audio/engine';
import * as Tone from 'tone';
import { PADS } from './DrumPads';
import { getNotesInScale, SCALES } from '../../lib/scales';
import { startLowLatencySynth, stopLowLatencySynth, stopAllLowLatencyVoices, playLowLatencyDrumHit } from '../../audio/lowLatencySynth';

const KEYS = [
  { note: 'C', black: false },
  { note: 'C#', black: true },
  { note: 'D', black: false },
  { note: 'D#', black: true },
  { note: 'E', black: false },
  { note: 'F', black: false },
  { note: 'F#', black: true },
  { note: 'G', black: false },
  { note: 'G#', black: true },
  { note: 'A', black: false },
  { note: 'A#', black: true },
  { note: 'B', black: false },
];

export function VirtualKeyboard() {
  const tracks = useDawStore(s => s.tracks);
  const selectedTrackId = useDawStore(s => s.selectedTrackId);
  const isRecordingGlobally = useDawStore(s => s.isRecording);
  const setIsRecording = useDawStore(s => s.setIsRecording);
  const addClip = useDawStore(s => s.addClip);
  const updateClip = useDawStore(s => s.updateClip);
  const clips = useDawStore(s => s.clips);
  const projectKey = useDawStore(s => s.projectKey);
  const projectScale = useDawStore(s => s.projectScale);
  
  const [baseOctave, setBaseOctave] = useState(4);
  const [velocity, setVelocity] = useState(100); // 1-127
  const [sustain, setSustain] = useState(false);
  const [isMinimized, setIsMinimized] = useState(() => localStorage.getItem('see-vibe-keyboard-minimized') === 'true');
  const [visualActiveNotes, setVisualActiveNotes] = useState<Set<string>>(new Set());
  const sustainedNotes = useRef<Set<string>>(new Set());
  const pressedNotes = useRef<Set<string>>(new Set()); // Tracks notes currently physically held down
  const scrollRef = useRef<HTMLDivElement>(null);

  const targetTrack = tracks.find(t => t.id === selectedTrackId && t.type === 'midi') 
    || tracks.find(t => t.type === 'midi');
  const isDrumKit = targetTrack?.synthType === 'membrane';

  // Track active notes { noteName: { clipId, noteId, start16ths } }
  const activeRecordings = useRef<Record<string, { clipId: string, noteId: string, start16ths: number }>>({});
  const physicalKeyToNote = useRef<Record<string, string>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.repeat) return; // Prevent continuous re-triggering

      const key = e.key.toLowerCase();
      const KEY_MAP: Record<string, string> = {
        'a': 'C', 'w': 'C#', 's': 'D', 'e': 'D#', 'd': 'E', 'f': 'F', 't': 'F#', 'g': 'G', 'y': 'G#', 'h': 'A', 'u': 'A#', 'j': 'B', 'k': 'C_NEXT'
      };

      let noteName = KEY_MAP[key];
      if (noteName) {
        let fullNote = noteName === 'C_NEXT' ? `C${baseOctave + 1}` : `${noteName}${baseOctave}`;
        physicalKeyToNote.current[key] = fullNote;
        handlePointerDown(undefined as any, fullNote, velocity / 127);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const fullNote = physicalKeyToNote.current[key];
      if (fullNote) {
        handlePointerUp(undefined as any, fullNote);
        delete physicalKeyToNote.current[key];
      }
    };

    const handleMidiOn = (e: any) => {
      const { note, velocity: midiVelocity } = e.detail;
      handlePointerDown(undefined as any, note, midiVelocity);
    };

    const handleMidiOff = (e: any) => {
      const { note } = e.detail;
      handlePointerUp(undefined as any, note);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('midi-note-on', handleMidiOn);
    window.addEventListener('midi-note-off', handleMidiOff);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('midi-note-on', handleMidiOn);
      window.removeEventListener('midi-note-off', handleMidiOff);
      handleReleaseAll(); // Release everything on unmount
    };
  }, [targetTrack, isRecordingGlobally, baseOctave, velocity]);

  useEffect(() => {
    handleReleaseAll();
  }, [baseOctave, selectedTrackId]);

  const handlePointerDown = async (e: React.PointerEvent | any, noteInfo: string, currentVelocity: number = velocity / 127) => {
    if (e?.target instanceof HTMLElement && e.pointerId !== undefined) {
       try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch(err){}
    }
    if (!targetTrack) return;
    
    // Safety: if note is already "pressed", release it first (shouldn't happen often but helps logic)
    if (pressedNotes.current.has(noteInfo)) {
      audioEngine.triggerNoteRelease(targetTrack.id, noteInfo);
    }
    pressedNotes.current.add(noteInfo);
    setVisualActiveNotes(prev => new Set(prev).add(noteInfo));

    const play = () => {
       if (isDrumKit) {
         playLowLatencyDrumHit(noteInfo, currentVelocity);
       } else {
         startLowLatencySynth(noteInfo, targetTrack.synthType || 'poly', currentVelocity);
       }
       
       if (isRecordingGlobally) {
         audioEngine.recordMidiNoteStart(targetTrack.id, noteInfo, currentVelocity);
       }
    };

    const startAndPlay = async () => {
      try {
        await Tone.start();
        const rawCtx = Tone.getContext().rawContext as AudioContext;
        if (rawCtx && rawCtx.state !== 'running') {
          await rawCtx.resume().catch(() => {});
        }
      } catch (e) {
        console.warn("Error starting Tone.js/AudioContext on interaction:", e);
      }

      if (!audioEngine.isInitialized) {
        try {
          await audioEngine.init();
        } catch (e) {
          console.warn("Error initializing AudioEngine:", e);
        }
      }
      play();
    };

    startAndPlay();
  };

  const handlePointerUp = (e: React.PointerEvent | any, noteInfo: string) => {
    if (e?.target instanceof HTMLElement && e.pointerId !== undefined) {
      try {
        if ((e.target as HTMLElement).hasPointerCapture(e.pointerId)) {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        }
      } catch (err) {}
    }
    
    pressedNotes.current.delete(noteInfo);
    
    if (!sustain) {
        setVisualActiveNotes(prev => {
            const next = new Set(prev);
            next.delete(noteInfo);
            return next;
        });
    }

    if (sustain) {
        sustainedNotes.current.add(noteInfo);
        return; // handle sound release later
    }

    if (!targetTrack) return;
    if (isDrumKit) {
        // Drums are self-decaying, no manual release stop required
    } else {
        stopLowLatencySynth(noteInfo, targetTrack.synthType || 'poly');
    }
    finishRecordingNote(noteInfo);
  };

  const finishRecordingNote = (noteInfo: string) => {
    if (targetTrack) {
        audioEngine.recordMidiNoteEnd(targetTrack.id, noteInfo);
    }
  };

  const handleReleaseAll = () => {
      sustainedNotes.current.forEach(note => {
          if (targetTrack) {
              stopLowLatencySynth(note, targetTrack.synthType || 'poly');
          }
          finishRecordingNote(note);
      });
      sustainedNotes.current.clear();
      
      pressedNotes.current.forEach(note => {
          if (targetTrack) {
              stopLowLatencySynth(note, targetTrack.synthType || 'poly');
          }
          finishRecordingNote(note);
      });
      pressedNotes.current.clear();
      setVisualActiveNotes(new Set());
      stopAllLowLatencyVoices();
  };

  useEffect(() => {
      if (!sustain) {
          handleReleaseAll();
      }
  }, [sustain]);

  const keyboardKeys = React.useMemo(() => {
    const keys = [];
    for (let octave = 0; octave <= 8; octave++) {
      keys.push(...KEYS.map(k => ({ ...k, fullNote: `${k.note}${octave}` })));
    }
    return keys;
  }, []);

  const notesInScale = React.useMemo(() => getNotesInScale(projectKey, projectScale), [projectKey, projectScale]);

  const getLabel = (fullNote: string) => {
    if (targetTrack?.synthType === 'membrane') {
      const padInfo = PADS.find(p => p.note === fullNote);
      return padInfo ? padInfo.label.split(' ')[0].toUpperCase() : '';
    }
    return fullNote;
  };

  useEffect(() => {
    if (scrollRef.current) {
      // 7 white keys per octave, 44px each = 308px per octave
      scrollRef.current.scrollLeft = baseOctave * 308 - (scrollRef.current.clientWidth / 2) + 154; // Center the octave
    }
  }, [baseOctave]);

  const updateTrackType = (type: string) => {
    if (targetTrack) {
        useDawStore.getState().updateTrack(targetTrack.id, { synthType: type as any });
    }
  };

  return (
    <div className="bg-[#111] border-t border-[#2A2A2A] flex flex-col shrink-0 select-none relative" style={{ touchAction: 'none' }}>
      
      {/* Controls Header */}
      <div className="flex items-center justify-between p-2 bg-[#1a1a1a] shadow-md border-b border-[#2A2A2A] overflow-x-auto gap-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {targetTrack && (
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 font-mono">INSTRUMENT:</span>
                    <select 
                        className="bg-black text-[#00FF9C] text-xs px-2 py-1 rounded outline-none border border-[#444] cursor-pointer"
                        value={targetTrack.synthType || 'poly'}
                        onChange={e => updateTrackType(e.target.value)}
                    >
                        <option value="poly">FM Piano</option>
                        <option value="pluck">Electric Guitar</option>
                        <option value="membrane">Drum Machine</option>
                        <option value="am">Bass (AM)</option>
                        <option value="fm">Lead (FM)</option>
                        <option value="flute">Flute</option>
                        <option value="epiano">Electric Piano</option>
                        <option value="grand">Grand Piano</option>
                        <option value="organ">Organ</option>
                        <option value="rhodes">Rhodes</option>
                        <option value="synthbass">Synth Bass</option>
                        <option value="pad">Pad</option>
                        <option value="leadsynth">Lead Synth</option>
                        <option value="strings">Strings</option>
                        <option value="brass">Brass</option>
                        <option value="bells">Bells</option>
                    </select>
                </div>
            )}
            
            <button 
                className={`text-xs px-3 py-1 font-bold rounded flex shrink-0 items-center gap-1 transition-all
                    ${isRecordingGlobally ? 'bg-red-500 text-white animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-[#333] text-gray-300 hover:bg-[#444]'}`}
                onClick={() => toggleGlobalRecording()}
            >
                <div className={`w-2 h-2 rounded-full ${isRecordingGlobally ? 'bg-white' : 'bg-red-500'}`} />
                Record to Timeline
            </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 text-xs font-mono shrink-0">
            <div className="flex items-center gap-2 shrink-0">
                <span className="text-gray-400">OCTAVE:</span>
                <button className="px-2 bg-[#333] rounded hover:bg-[#444] text-white" onClick={() => setBaseOctave(Math.max(1, baseOctave - 1))}>-</button>
                <span className="text-gray-200 min-w-[20px] text-center">{baseOctave}</span>
                <button className="px-2 bg-[#333] rounded hover:bg-[#444] text-white" onClick={() => setBaseOctave(Math.min(7, baseOctave + 1))}>+</button>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
                <span className="text-gray-400">VELOCITY:</span>
                <input 
                    type="range" min="1" max="127" value={velocity} 
                    onChange={e => setVelocity(Number(e.target.value))}
                    className="w-20 accent-[#00FF9C]"
                />
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <button 
                    className={`px-3 py-1 rounded transition-colors ${sustain ? 'bg-[#00FF9C] text-black font-bold shadow-[0_0_8px_#00FF9C]' : 'bg-[#333] text-gray-300'}`}
                    onClick={() => setSustain(!sustain)}
                >
                    Sustain
                </button>
                <button 
                    className="px-3 py-1 bg-[#333] hover:bg-[#444] text-gray-300 rounded"
                    onClick={handleReleaseAll}
                >
                    Release All
                </button>
                <button 
                    className={`px-2.5 py-1 rounded border text-[10px] font-black uppercase tracking-wider shrink-0 transition-all flex items-center justify-center gap-1 min-w-[110px] cursor-pointer
                        ${isMinimized 
                          ? 'bg-[#00FF5A]/15 border-[#00FF5A]/35 text-[#00FF5A] shadow-[0_0_8px_rgba(0,255,90,0.15)]' 
                          : 'bg-[#FA9534]/15 border-[#FA9534]/35 text-[#FA9534] hover:bg-[#FA9534]/25'}`}
                    onClick={() => {
                      const nextVal = !isMinimized;
                      setIsMinimized(nextVal);
                      localStorage.setItem('see-vibe-keyboard-minimized', String(nextVal));
                    }}
                    title={isMinimized ? "Show keys/pads input panel" : "Minimize keys/pads to maximize piano roll view space"}
                >
                    <span>{isMinimized ? (isDrumKit ? "Show Pads ⤢" : "Show Keys ⤢") : (isDrumKit ? "Minimize Pads ⤡" : "Minimize Keys ⤡")}</span>
                </button>
            </div>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 overflow-x-auto py-6 relative" ref={scrollRef}>
          {isDrumKit ? (
            <div className="flex justify-center w-full h-full pb-4">
               <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 h-full max-w-4xl" style={{ touchAction: 'none' }}>
                  {PADS.map(pad => (
                    <button
                      key={pad.id}
                      onPointerDown={(e) => handlePointerDown(e as any, pad.note)}
                      onPointerUp={(e) => handlePointerUp(e as any, pad.note)}
                      onPointerCancel={(e) => handlePointerUp(e as any, pad.note)}
                      onPointerLeave={(e) => {
                        if (pressedNotes.current.has(pad.note)) handlePointerUp(e as any, pad.note);
                      }}
                      className={`
                        rounded-xl flex flex-col items-center justify-center p-1 relative overflow-hidden transition-all duration-75
                        ${visualActiveNotes.has(pad.note) ? 'scale-95 brightness-150' : 'scale-100 hover:brightness-110'}
                        ${pad.color} bg-opacity-20 border border-white/10 w-14 h-14
                      `}
                      style={{
                        boxShadow: visualActiveNotes.has(pad.note) ? `0 0 15px ${pad.color.replace('bg-', '')}` : 'none'
                      }}
                    >
                      <div className={`absolute inset-0 ${pad.color} opacity-20 pointer-events-none`} />
                      <span className="relative z-10 text-white font-bold text-[9px] text-center leading-tight pointer-events-none">{pad.label}</span>
                    </button>
                  ))}
               </div>
            </div>
          ) : (
            <div className="flex relative items-start h-[100px] w-max px-8">
              {keyboardKeys.map((k, i) => {
                const label = getLabel(k.fullNote);
                const isInScale = projectScale === 'Chromatic' || notesInScale.includes(k.note);

                if (k.black) {
                  return (
                    <div 
                      key={k.fullNote}
                      onPointerDown={(e) => handlePointerDown(e, k.fullNote)}
                      onPointerUp={(e) => handlePointerUp(e, k.fullNote)}
                      onPointerCancel={(e) => handlePointerUp(e, k.fullNote)}
                      onPointerLeave={(e) => {
                        if (pressedNotes.current.has(k.fullNote)) {
                          handlePointerUp(e, k.fullNote);
                        }
                      }}
                      className={`w-[20px] h-[64px] absolute rounded-b -mx-2 border-b-4 border-[#222] select-none active:brightness-150 cursor-pointer flex flex-col justify-end pb-2 transform-gpu transition-all duration-100 ${!isInScale ? 'opacity-30' : 'opacity-100'} ${visualActiveNotes.has(k.fullNote) ? 'bg-[#00FF9C] brightness-125' : 'bg-black'}`}
                      style={{ 
                        left: `${(keyboardKeys.filter((_, idx) => idx < i && !keyboardKeys[idx].black).length) * 32 - 10 + 32}px`,
                        zIndex: 10
                      }}
                    >
                      <div className="w-full text-center text-[8px] text-gray-500 font-mono pointer-events-none break-all leading-tight">
                        {k.note === 'C' ? k.fullNote : k.note}
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div 
                      key={k.fullNote}
                      onPointerDown={(e) => handlePointerDown(e, k.fullNote)}
                      onPointerUp={(e) => handlePointerUp(e, k.fullNote)}
                      onPointerCancel={(e) => handlePointerUp(e, k.fullNote)}
                      onPointerLeave={(e) => {
                        if (pressedNotes.current.has(k.fullNote)) {
                          handlePointerUp(e, k.fullNote);
                        }
                      }}
                      className={`w-[32px] h-[100px] rounded-b border-x border-[#ccc] border-b-[6px] border-b-gray-400 mx-[0px] active:from-gray-300 active:to-gray-400 cursor-pointer relative shadow-[inset_0_0_4px_rgba(0,0,0,0.1)] flex flex-col justify-end pb-3 transition-all duration-100 ${!isInScale ? 'opacity-40 grayscale-[0.5]' : 'opacity-100'} ${visualActiveNotes.has(k.fullNote) ? 'bg-gradient-to-b from-[#00FF9C] to-[#00CC7D] border-b-[#00AA66]' : 'bg-gradient-to-b from-white to-gray-200'}`}
                    >
                      <div className="w-full text-center text-[10px] text-gray-600 font-bold pointer-events-none break-all leading-tight">
                        {k.note === 'C' ? k.fullNote : k.note}
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
