// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import { useDawStore } from "../../store/useDawStore";
import { Trash2, CheckSquare, Square as SquareIcon } from "lucide-react";
import { audioEngine } from "../../audio/engine";
import { startLowLatencySynth, stopLowLatencySynth, playLowLatencyDrumHit } from "../../audio/lowLatencySynth";
import * as Tone from "tone";
import { PADS } from "./DrumPads";
import { getNotesInScale, SCALES, KEYS_LIST } from "../../lib/scales";

const NOTES = ["B", "A#", "A", "G#", "G", "F#", "F", "E", "D#", "D", "C#", "C"];
const STANDARD_PIANO_KEYS = [7, 6, 5, 4, 3, 2, 1, 0].flatMap((octave) =>
  NOTES.map((note) => `${note}${octave}`),
);
const GRID_SIZE = 24; // width per 16th note

export function PianoRoll() {
  const clips = useDawStore((s) => s.clips);
  const selectedClipId = useDawStore((s) => s.selectedClipId);
  const tracks = useDawStore((s) => s.tracks);
  const updateClip = useDawStore((s) => s.updateClip);
  const addNote = useDawStore((s) => s.addNote);
  const updateNote = useDawStore((s) => s.updateNote);
  const deleteNote = useDawStore((s) => s.deleteNote);
  const quantizeClipNotes = useDawStore((s) => s.quantizeClipNotes);
  const projectKey = useDawStore((s) => s.projectKey);
  const projectScale = useDawStore((s) => s.projectScale);
  const [currentDrawDuration, setCurrentDrawDuration] = useState(4); // 4 = quarter note
  const [snapDivision, setSnapDivision] = useState(1); // 1 = 16th note, 0.5 = 32nd note, 4 = quarter, etc.
  const [scaleOnly, setScaleOnly] = useState(false);
  const zoom = useDawStore((s) => s.timelineZoom);
  const setZoom = useDawStore((s) => s.setTimelineZoom);


  const containerRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);

  const currentGridSize = GRID_SIZE * zoom;

  const [draggingNote, setDraggingNote] = useState<{
    id: string;
    initialStartTime: number;
    initialRowIdx: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [resizingNote, setResizingNote] = useState<{
    id: string;
    initialDuration: number;
    startX: number;
  } | null>(null);

  const [noteDragDelta, setNoteDragDelta] = useState<{
    dx16ths: number;
    dyRows: number;
  }>({ dx16ths: 0, dyRows: 0 });
  const [noteResizeDelta, setNoteResizeDelta] = useState<{ dx16ths: number }>({
    dx16ths: 0,
  });
  
  const [markedNoteIds, setMarkedNoteIds] = useState<string[]>([]);

  const dragInfoRef = useRef({ isDrag: false, startX: 0, startY: 0 });

  const getSnapped16ths = (relativeX: number) => {
    const raw16ths = relativeX / currentGridSize;
    if (snapDivision === 0) return raw16ths; // No snap
    return Math.round(raw16ths / snapDivision) * snapDivision;
  };

  const selectedTrackId = useDawStore((s) => s.selectedTrackId);
  let targetClipId = selectedClipId;
  const targetTrack =
    tracks.find((t) => t.id === selectedTrackId) ||
    tracks.find((t) => t.type === "midi");

  if (targetClipId && clips[targetClipId]?.trackId !== targetTrack?.id) {
    targetClipId = null;
  }

  if (!targetClipId && targetTrack) {
    const transportPos = useDawStore.getState().transportPosition;
    const clipAtPlayhead = Object.values(clips).find(
      (c) =>
        c.trackId === targetTrack.id &&
        transportPos >= c.startTime &&
        transportPos < c.startTime + c.duration,
    );
    if (clipAtPlayhead) {
      targetClipId = clipAtPlayhead.id;
    } else {
      const firstClip = Object.values(clips)
        .filter((c) => c.trackId === targetTrack.id)
        .sort((a, b) => a.startTime - b.startTime)[0];
      if (firstClip) {
        targetClipId = firstClip.id;
      }
    }
  }

  useEffect(() => {
    if (targetTrack && !targetClipId && targetTrack.type === "midi") {
      const newClipId = useDawStore
        .getState()
        .addClip(targetTrack.id, 0, undefined, undefined, 32);
      useDawStore.getState().selectClip(newClipId);
    } else if (targetClipId && selectedClipId !== targetClipId) {
      useDawStore.getState().selectClip(targetClipId);
    }
  }, [targetTrack?.id, targetClipId, selectedClipId]);

  const clip = targetClipId ? clips[targetClipId] : null;
  const track = clip ? tracks.find((t) => t.id === clip.trackId) : null;

  const [initialGhostNotes, setInitialGhostNotes] = useState<any[] | null>(null);
  const [activeGhostOption, setActiveGhostOption] = useState<'A' | 'B' | 'C'>('A');

  const ghostNotesInClip = React.useMemo(() => {
    return (clip?.notes || []).filter((n) => n.isGhost);
  }, [clip?.notes]);

  useEffect(() => {
    if (ghostNotesInClip.length > 0 && !initialGhostNotes) {
      setInitialGhostNotes(ghostNotesInClip);
      setActiveGhostOption('A');
    } else if (ghostNotesInClip.length === 0 && initialGhostNotes) {
      setInitialGhostNotes(null);
    }
  }, [ghostNotesInClip, initialGhostNotes]);

  const hasGhostNotes = ghostNotesInClip.length > 0;

  const playGhostAudioPreview = async (notesToPlay: any[]) => {
    if (!clip || !track) return;
    if (Tone.context.state !== "running") await Tone.start();
    if (!audioEngine.isInitialized) await audioEngine.init();

    // Soft velocity lower volume preview feel
    const previewVelocity = 0.45;

    // Sort notes by startTime
    const sorted = [...notesToPlay].sort((a, b) => a.startTime - b.startTime);

    // Timing math based on current BPM
    const bpm = useDawStore.getState().bpm;
    const one16thMs = (60000 / bpm) / 4;

    sorted.forEach((note) => {
      const delayMs = note.startTime * one16thMs;
      const durSeconds = (note.duration * one16thMs) / 1000;

      setTimeout(() => {
        try {
          audioEngine.triggerNoteWithVelocity(track.id, note.note, durSeconds, previewVelocity);
        } catch (err) {
          console.warn("Ghost preview audio play issue:", err);
        }
      }, delayMs);
    });
  };

  const getGhostOptionNotes = (baseGhostNotes: any[], option: 'A' | 'B' | 'C'): any[] => {
    if (option === 'A') return baseGhostNotes;
    
    return baseGhostNotes.map((note, index) => {
      if (option === 'B') {
        const noteNamesInOctave = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const noteMatch = note.note.match(/^([A-G]#?)(\d+)$/);
        let newNote = note.note;
        if (noteMatch) {
          const [_, name, octave] = noteMatch;
          let noteInt = noteNamesInOctave.indexOf(name);
          let octInt = parseInt(octave);
          const shift = index % 2 === 0 ? 5 : 7;
          noteInt += shift;
          if (noteInt >= 12) {
            noteInt -= 12;
            octInt += 1;
          }
          newNote = `${noteNamesInOctave[noteInt]}${Math.min(7, octInt)}`;
        }
        return {
          ...note,
          id: `ghost_opt_b_${index}_${note.id}`,
          note: newNote,
          startTime: Math.max(0, note.startTime + (index % 2 === 0 ? 1 : -1)),
          isGhost: true,
        };
      } else {
        const noteNamesInOctave = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const noteMatch = note.note.match(/^([A-G]#?)(\d+)$/);
        let newNote = note.note;
        if (noteMatch) {
          const [_, name, octave] = noteMatch;
          let octInt = parseInt(octave);
          if (octInt > 2) octInt -= 1;
          newNote = `${name}${octInt}`;
        }
        return {
          ...note,
          id: `ghost_opt_c_${index}_${note.id}`,
          note: newNote,
          duration: note.duration + 2,
          isGhost: true,
        };
      }
    });
  };

  const handleGhostOptionChange = async (opt: 'A' | 'B' | 'C') => {
    if (!clip || !initialGhostNotes) return;
    setActiveGhostOption(opt);

    const newGhostNotes = getGhostOptionNotes(initialGhostNotes, opt);
    const nonGhostNotes = (clip.notes || []).filter((n) => !n.isGhost);
    const updatedNotes = [...nonGhostNotes, ...newGhostNotes];

    updateClip(clip.id, { notes: updatedNotes });
    playGhostAudioPreview(newGhostNotes);
  };

  const handleCommitGhosts = () => {
    if (!clip) return;
    const committedNotes = (clip.notes || []).map((n) => n.isGhost ? { ...n, isGhost: false } : n);
    updateClip(clip.id, { notes: committedNotes, isGhost: false });
    setInitialGhostNotes(null);
  };

  const handleDiscardGhosts = () => {
    if (!clip) return;
    const cleanNotes = (clip.notes || []).filter((n) => !n.isGhost);
    if (cleanNotes.length === 0 && clip.isGhost) {
      useDawStore.getState().deleteClip(clip.id);
    } else {
      updateClip(clip.id, { notes: cleanNotes, isGhost: false });
    }
    setInitialGhostNotes(null);
  };

  const handleRegenerateGhosts = () => {
    if (!clip || !initialGhostNotes) return;
    const intervals = [-5, -4, -3, -2, 2, 3, 4, 5, 7, 12];
    const shift = intervals[Math.floor(Math.random() * intervals.length)];
    const noteNamesInOctave = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

    const regenerated = initialGhostNotes.map((note) => {
      const noteMatch = note.note.match(/^([A-G]#?)(\d+)$/);
      let newNoteName = note.note;
      if (noteMatch) {
        const [_, name, octave] = noteMatch;
        let noteInt = noteNamesInOctave.indexOf(name);
        let octInt = parseInt(octave);
        noteInt += shift;
        while (noteInt >= 12) {
          noteInt -= 12;
          octInt += 1;
        }
        while (noteInt < 0) {
          noteInt += 12;
          octInt -= 1;
        }
        newNoteName = `${noteNamesInOctave[noteInt]}${Math.max(1, octInt)}`;
      }
      return {
        ...note,
        note: newNoteName,
        startTime: Math.max(0, note.startTime + (Math.random() > 0.6 ? (Math.random() > 0.5 ? 1 : -1) : 0)),
      };
    });

    setInitialGhostNotes(regenerated);
    setActiveGhostOption('A');

    const nonGhostNotes = (clip.notes || []).filter((n) => !n.isGhost);
    updateClip(clip.id, { notes: [...nonGhostNotes, ...regenerated] });
    playGhostAudioPreview(regenerated);
  };

  const notesInScale = React.useMemo(
    () => getNotesInScale(projectKey, projectScale),
    [projectKey, projectScale],
  );

  // Determine which keys to use based on track type
  const isDrumKit = track?.synthType === "membrane";

  const baseKeys = React.useMemo(() => {
    if (!scaleOnly || projectScale === "Chromatic") return STANDARD_PIANO_KEYS;
    return STANDARD_PIANO_KEYS.filter((k) => {
      const n = k.replace(/\d+$/, "");
      return notesInScale.includes(n);
    });
  }, [scaleOnly, projectScale, notesInScale]);

  const DISPLAY_KEYS = isDrumKit
    ? [...PADS].reverse().map((p) => p.note)
    : baseKeys;

  // Compute ghost notes (notes from all other clips across all tracks that overlap the current clip's time window)
  const ghostNotes = React.useMemo(() => {
    if (!clip || !track) return [];
    const ghosts: {
      id: string;
      note: string;
      relativeStart: number;
      duration: number;
      color: string;
    }[] = [];

    Object.values(clips).forEach((otherClip) => {
      if (otherClip.id === clip.id) return;
      const otherTrack = tracks.find((t) => t.id === otherClip.trackId);
      if (!otherTrack || otherTrack.type !== "midi") return;

      (otherClip.notes || []).forEach((n) => {
        const globalNoteStart = otherClip.startTime + n.startTime;
        const globalNoteEnd = globalNoteStart + n.duration;
        const clipGlobalEnd = clip.startTime + clip.duration;

        // Does it overlap or fall inside?
        if (globalNoteEnd > clip.startTime && globalNoteStart < clipGlobalEnd) {
          ghosts.push({
            id: `ghost_${otherClip.id}_${n.id}`,
            note: n.note,
            relativeStart: globalNoteStart - clip.startTime,
            duration: n.duration,
            color: otherTrack.color,
          });
        }
      });
    });
    return ghosts;
  }, [clips, clip, tracks]);

  useEffect(() => {
    let animationFrameId: number;
    const updatePlayhead = () => {
      if (!clip) return;
      let x = 0;
      const state = useDawStore.getState();
      let pos16ths = state.transportPosition;
      if (Tone.Transport.state === "started") {
        const secondsPer16th = 15 / state.bpm;
        pos16ths = Tone.Transport.seconds / secondsPer16th;
      }
      const ticks = pos16ths * 48;
      const startTicks = clip.startTime * 48;
      const relativeTicks = ticks - startTicks;

      const speed = clip.speed || 1;
      x = (relativeTicks / 48) * currentGridSize * speed;

      if (playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${x}px)`;
      }

      animationFrameId = requestAnimationFrame(updatePlayhead);
    };
    updatePlayhead();
    return () => cancelAnimationFrame(animationFrameId);
  }, [clip?.startTime]);

  const handlePointerMove = (e: PointerEvent) => {
    if (!clip || !containerRef.current) return;

    if (
      Math.abs(e.clientX - dragInfoRef.current.startX) > 5 ||
      Math.abs(e.clientY - dragInfoRef.current.startY) > 5
    ) {
      dragInfoRef.current.isDrag = true;
    }

    if (resizingNote) {
      const dx = e.clientX - resizingNote.startX;
      const dx16ths = getSnapped16ths(dx);
      setNoteResizeDelta({ dx16ths });
      return;
    }

    if (draggingNote) {
      const dx = e.clientX - draggingNote.startX;
      const dy = e.clientY - draggingNote.startY;
      const dx16ths = getSnapped16ths(dx);
      const dyRows = Math.round(dy / 24); // 24px is row height

      setNoteDragDelta({ dx16ths, dyRows });
    }
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (clip) {
      if (draggingNote) {
        const dx = e.clientX - draggingNote.startX;
        const dy = e.clientY - draggingNote.startY;
        const dx16ths = getSnapped16ths(dx);
        const dyRows = Math.round(dy / 24);
        
        const isDraggingGroup = markedNoteIds.includes(draggingNote.id);
        const targetIds = isDraggingGroup ? markedNoteIds : [draggingNote.id];
        
        if (dx16ths !== 0 || dyRows !== 0) {
           const newNotes = (clip.notes || []).map(n => {
              if (targetIds.includes(n.id)) {
                 const currentNoteRowIdx = DISPLAY_KEYS.indexOf(n.note);
                 const newStartTime = Math.max(0, n.startTime + dx16ths);
                 const newRowIdx = Math.max(0, Math.min(DISPLAY_KEYS.length - 1, currentNoteRowIdx + dyRows));
                 return { ...n, startTime: newStartTime, note: DISPLAY_KEYS[newRowIdx] };
              }
              return n;
           });
           updateClip(clip.id, { notes: newNotes });
        }
      }
      if (resizingNote) {
        const dx = e.clientX - resizingNote.startX;
        const dx16ths = getSnapped16ths(dx);
        const newDuration = Math.max(
          0.25,
          resizingNote.initialDuration + dx16ths,
        );
        updateNote(clip.id, resizingNote.id, { duration: newDuration });
      }
    }

    setDraggingNote(null);
    setResizingNote(null);
    setNoteDragDelta({ dx16ths: 0, dyRows: 0 });
    setNoteResizeDelta({ dx16ths: 0 });
  };

  useEffect(() => {
    if (draggingNote || resizingNote) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
    }
  }, [draggingNote, resizingNote, clip]);

  useEffect(() => {
    if (containerRef.current && clip) {
      const c4Index = DISPLAY_KEYS.indexOf("C4");
      if (c4Index !== -1) {
        // 24 is the height of each row (h-6)
        // Adjust by half the container height so C4 is somewhat centered
        const targetY =
          c4Index * 24 + 16 - containerRef.current.clientHeight / 2;
        containerRef.current.scrollTop = Math.max(0, targetY);
      }
    }
  }, [clip?.id]); // scroll on clip change

  if (!clip || !track) {
    return (
      <div className="h-full bg-[#111] flex flex-col items-center justify-center text-gray-500 select-none">
        <p className="text-sm">Select a clip to open the Piano Roll.</p>
        <p className="text-[10px] text-gray-600 mt-2">
          Click on the arrangement grid above to create a clip.
        </p>
      </div>
    );
  }

  const handleGridClick = async (e: React.MouseEvent, note: string) => {
    if ((e.target as HTMLElement).closest(".midi-note")) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const start16ths = getSnapped16ths(x);

    // We'll allow taking out a note if it overlaps precisely
    const overlappingNote = (clip.notes || []).find(
      (n) =>
        n.note === note &&
        start16ths >= n.startTime &&
        start16ths < n.startTime + n.duration,
    );
    if (overlappingNote) {
      deleteNote(clip.id, overlappingNote.id);
      return;
    }

    if (Tone.context.state !== "running") await Tone.start();
    if (!audioEngine.isInitialized) await audioEngine.init();
    audioEngine.triggerNote(track.id, note);
    addNote(clip.id, note, start16ths, currentDrawDuration);
  };

  return (
    <div className="flex-1 min-h-0 bg-[#0A0A0A] flex flex-col">
      <div className="min-h-[38px] py-1 h-auto bg-[#141414] border-b border-[#2A2A2A] flex items-center px-2 justify-between gap-2.5 text-[10px] min-w-0 shrink-0">
        <span className="text-gray-300 font-bold tracking-widest uppercase shrink-0 flex items-center gap-2">
          Piano Roll{" "}
          <span className="text-gray-500 font-normal">({track.name})</span>
          {track?.type === 'audio' && clip && (
            <div className="flex bg-neutral-900 rounded p-0.5 border border-neutral-800 ml-2">
              <button
                onClick={() => useDawStore.getState().setAudioEditMode(clip.id, 'vocal')}
                className="px-2 py-0.5 text-[8px] font-bold uppercase rounded text-neutral-400 hover:text-white transition-colors"
              >
                Vocal Roll
              </button>
              <button
                className="px-2 py-0.5 text-[8px] font-bold uppercase rounded bg-[#00FF9C] text-black"
                disabled
              >
                Piano Roll
              </button>
            </div>
          )}
        </span>

        <div className="flex-1 overflow-x-auto min-w-0 flex items-center [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden justify-start sm:justify-end touch-pan-x">
          <div className="flex items-center space-x-2 w-max">
            <div className="flex items-center space-x-1.5 mr-2 border-r border-[#333] pr-2 shrink-0">
              <button
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider transition-colors ${scaleOnly ? "bg-[#00FF9C] text-black shadow-[0_0_8px_#00FF9C]" : "bg-[#222] text-gray-500 hover:bg-[#333]"}`}
                onClick={() => setScaleOnly(!scaleOnly)}
                disabled={isDrumKit}
              >
                {scaleOnly ? (
                  <CheckSquare size={10} />
                ) : (
                  <SquareIcon size={10} />
                )}
                Scale Only
              </button>
              <button
                className="bg-[#222] text-[#00FF9C] hover:bg-[#333] px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                onClick={() =>
                  useDawStore.getState().humanizeClipNotes(clip.id, 0.15, 0.15)
                }
              >
                Humanize
              </button>
              <button
                className="bg-[#222] text-[#00FF9C] hover:bg-[#333] px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                onClick={() => {
                  const newNotes = (clip.notes || []).map((n) => {
                    const newVel = Math.random() * 0.5 + 0.3; // between 0.3 and 0.8
                    return { ...n, velocity: newVel };
                  });
                  updateClip(clip.id, { notes: newNotes });
                }}
              >
                Rand Vel
              </button>
              <button
                className="bg-[#222] text-[#00FF9C] hover:bg-[#333] px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                title={`Quantize to ${snapDivision || "16th"} grid`}
                onClick={() => {
                  const gridSize = snapDivision || 1; // Default to 16th if snap is None
                  quantizeClipNotes(clip.id, gridSize);
                }}
              >
                Quantize
              </button>
              <span className="text-gray-500 font-mono shrink-0">ZOOM:</span>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-20 shrink-0"
              />
            </div>
            <div className="flex items-center space-x-2 mr-2 sm:mr-4 border-r border-[#333] pr-2 sm:pr-4 shrink-0">
              <span className="text-gray-500 font-mono shrink-0">SNAP:</span>
              <select
                className="bg-[#000] text-gray-300 rounded border border-[#333] px-2 py-0.5 outline-none font-mono shrink-0"
                value={snapDivision}
                onChange={(e) => setSnapDivision(Number(e.target.value))}
              >
                <option value={0}>None</option>
                <option value={16}>1 Bar</option>
                <option value={8}>1/2 Note</option>
                <option value={6}>1/4 Dotted</option>
                <option value={4}>1/4 Note</option>
                <option value={8 / 3}>1/4 Triplet</option>
                <option value={3}>1/8 Dotted</option>
                <option value={2}>1/8 Note</option>
                <option value={4 / 3}>1/8 Triplet</option>
                <option value={1.5}>1/16 Dotted</option>
                <option value={1}>1/16 Note</option>
                <option value={2 / 3}>1/16 Triplet</option>
                <option value={0.5}>1/32 Note</option>
              </select>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-gray-500 font-mono shrink-0">DRAW:</span>
              <select
                className="bg-[#000] text-gray-300 rounded border border-[#333] px-2 py-0.5 outline-none font-mono shrink-0"
                value={currentDrawDuration}
                onChange={(e) => setCurrentDrawDuration(Number(e.target.value))}
              >
                <option value={16}>1 Bar</option>
                <option value={8}>1/2 Note</option>
                <option value={6}>1/4 Dotted</option>
                <option value={4}>1/4 Note</option>
                <option value={8 / 3}>1/4 Triplet</option>
                <option value={3}>1/8 Dotted</option>
                <option value={2}>1/8 Note</option>
                <option value={4 / 3}>1/8 Triplet</option>
                <option value={1.5}>1/16 Dotted</option>
                <option value={1}>1/16 Note</option>
                <option value={2 / 3}>1/16 Triplet</option>
                <option value={0.5}>1/32 Note</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {hasGhostNotes && (
        <div id="ghost-midi-banner" className="bg-[#A855F7]/15 border-b border-[#A855F7]/30 px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 animate-fade-in shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-base animate-pulse">👻</span>
            <div>
              <div className="text-[11px] font-extrabold text-[#D8B4FE] uppercase tracking-widest font-mono flex items-center gap-1.5">
                <span>AI MIDI Ghost Preview</span>
                <span className="bg-purple-500/10 text-purple-300 text-[9px] px-1.5 py-0.5 rounded border border-purple-500/20">OPERATOR PRO</span>
              </div>
              <div className="text-[9px] text-gray-400 font-medium">
                Drag, resize or shift pitch of faint purple notes. Select options below to compare patterns.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {/* Options Selection */}
            <div className="flex items-center bg-black/50 rounded-lg p-0.5 border border-white/5">
              {(['A', 'B', 'C'] as const).map((opt) => {
                const isSelected = activeGhostOption === opt;
                const labels = { A: 'A (Main)', B: 'B (Hook)', C: 'C (Groove)' };
                return (
                  <button
                    key={opt}
                    onClick={() => handleGhostOptionChange(opt)}
                    className={`px-3 py-1 rounded-md text-[10px] font-extrabold transition-all uppercase ${
                      isSelected 
                        ? 'bg-[#A855F7] text-white shadow-md shadow-[#A855F7]/20 border border-[#C084FC]/30' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {labels[opt]}
                  </button>
                );
              })}
            </div>

            <div className="h-4 w-px bg-white/10" />

            <button
              onClick={handleCommitGhosts}
              className="bg-emerald-500 hover:bg-[#00FF5A] text-black font-extrabold px-3 py-1 rounded shadow-md cursor-pointer transition-all uppercase text-[10px] flex items-center gap-0.5"
            >
              ✓ Keep
            </button>
            <button
              onClick={handleRegenerateGhosts}
              className="bg-[#1C1A22] hover:bg-[#2A2633] text-[#D8B4FE] hover:text-[#E9D5FF] font-black px-2.5 py-1 rounded border border-[#A855F7]/30 text-[10px]"
              title="Regenerate randomized pitch variation"
            >
              🔀 Tweak Note Pitch
            </button>
            <button
              onClick={handleDiscardGhosts}
              className="bg-red-500/80 hover:bg-red-500 text-white font-bold px-2.5 py-1 rounded text-[10px] uppercase"
            >
              ✕ Discard
            </button>
          </div>
        </div>
      )}

      <div
        className="flex flex-1 overflow-auto bg-[#0A0A0A] relative"
        ref={containerRef}
      >
        {/* Piano Keys */}
        <div
          className="w-16 sticky left-0 z-20 flex flex-col bg-[#111] shadow-xl border-r border-[#2A2A2A] pb-24"
          style={{ touchAction: "none" }}
        >
          <div className="h-4 bg-[#111] border-b border-[#333] sticky top-0 z-40 w-full min-h-[16px] shrink-0"></div>
          {DISPLAY_KEYS.map((key) => {
            const isBlack = key.includes("#");
            const noteName = key.replace(/\d+$/, "");
            const isInScale = notesInScale.includes(noteName);
            let label = key;
            if (track.synthType === "membrane") {
              const padInfo = PADS.find((p) => p.note === key);
              label = padInfo ? padInfo.label : "";
            }

            return (
              <div
                key={key}
                onPointerDown={(e) => {
                  if (
                    e.target instanceof HTMLElement &&
                    e.pointerId !== undefined
                  ) {
                    try {
                      e.target.setPointerCapture(e.pointerId);
                    } catch (err) {}
                  }

                  const play = () => {
                    if (isDrumKit) {
                      playLowLatencyDrumHit(key, 0.8);
                    } else {
                      startLowLatencySynth(key, track.synthType || 'poly', 0.8);
                    }
                  };

                  if (Tone.context.state !== "running" || !audioEngine.isInitialized) {
                    (async () => {
                      if (Tone.context.state !== "running") await Tone.start();
                      if (!audioEngine.isInitialized) await audioEngine.init();
                      play();
                    })();
                  } else {
                    play();
                  }
                }}
                onPointerUp={(e) => {
                  if (
                    e.target instanceof HTMLElement &&
                    e.pointerId !== undefined
                  ) {
                    try {
                      if (e.target.hasPointerCapture(e.pointerId))
                        e.target.releasePointerCapture(e.pointerId);
                    } catch (err) {}
                  }
                  if (!isDrumKit) {
                    stopLowLatencySynth(key, track.synthType || 'poly');
                  }
                }}
                onPointerCancel={(e) => {
                  if (
                    e.target instanceof HTMLElement &&
                    e.pointerId !== undefined
                  ) {
                    try {
                      if (e.target.hasPointerCapture(e.pointerId))
                        e.target.releasePointerCapture(e.pointerId);
                    } catch (err) {}
                  }
                  if (!isDrumKit) {
                    stopLowLatencySynth(key, track.synthType || 'poly');
                  }
                }}
                className={`h-6 border-b border-[#1A1A1A] flex items-center justify-end px-1 cursor-pointer select-none text-[9px] font-mono transition-colors ${
                  label
                    ? isBlack
                      ? "bg-[#0A0A0A] text-[#aaa]"
                      : "bg-[#181818] text-[#00FF9C] hover:bg-[#222]"
                    : isBlack
                      ? "bg-[#0A0A0A] text-transparent"
                      : "bg-[#181818] text-transparent hover:bg-[#222]"
                } ${!isDrumKit && !isInScale ? "opacity-30 mix-blend-luminosity" : ""}`}
              >
                {label && <span className="font-bold truncate">{label}</span>}
              </div>
            );
          })}
        </div>

        {/* Note Grid */}
        <div
          className="relative shrink-0"
          style={{
            width: Math.max(
              (clip?.duration || 32) + 64,
              256
            ) * currentGridSize,
            minWidth: "100%",
          }}
        >
          {/* Ruler in Piano Roll */}
          <div
            className="h-4 bg-[#111] border-b border-[#333] sticky top-0 z-40 cursor-pointer flex items-center"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const dx = e.clientX - rect.left;
              const relativePos16ths = dx / currentGridSize;
              const speed = clip?.speed || 1;
              const pos16ths =
                (clip?.startTime || 0) + relativePos16ths / speed;
              useDawStore.getState().setTransportPosition(pos16ths);
              Tone.Transport.position = `0:0:${pos16ths}`;
            }}
          >
            {(() => {
              const bpm = useDawStore.getState().bpm;
              const pxPerSecond = (bpm / 60) * 4 * currentGridSize;
              const totalPx = Math.max((clip?.duration || 32) + 64, 256) * currentGridSize;
              const totalSec = Math.ceil(totalPx / Math.max(1, pxPerSecond));
              return Array.from({ length: totalSec + 1 }).map((_, i) => {
                const isMinute = i > 0 && i % 60 === 0;
                const isMajor = i % 5 === 0;
                return (
                  <div
                    key={i}
                    className={`absolute h-full border-l text-[7px] pl-0.5 pointer-events-none select-none ${isMinute ? 'border-[#00FFBC]/50 text-[#00FFBC]' : isMajor ? 'border-[#444] text-gray-400' : 'border-[#222] text-gray-600'}`}
                    style={{ left: i * pxPerSecond }}
                  >
                    {isMajor || isMinute ? (isMinute ? `${i / 60}m` : `${i}`) : ''}
                  </div>
                );
              });
            })()}
          </div>

          {/* Background Vertical Grid Lines */}
          <div
            className="absolute top-4 bottom-0 pointer-events-none z-0"
            style={{
              width: "100%",
              backgroundImage: `linear-gradient(to right, #1A1A1A 1px, transparent 1px), linear-gradient(to right, #333333 1px, transparent 1px), linear-gradient(to right, #444444 1px, transparent 1px)`,
              backgroundSize: `${snapDivision > 0 ? snapDivision * currentGridSize : currentGridSize}px 100%, ${currentGridSize * 4}px 100%, ${currentGridSize * 16}px 100%`,
              opacity: 0.8,
            }}
          />

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-px bg-[#00FF9C] z-30 pointer-events-none shadow-[0_0_10px_#00FF9C]"
            ref={playheadRef}
          />

          {DISPLAY_KEYS.map((key, i) => {
            const noteName = key.replace(/\d+$/, "");
            const isInScale = notesInScale.includes(noteName);
            return (
              <div
                key={key}
                className={`h-6 w-full border-b relative z-10 ${key.includes("#") ? "border-[#1A1A1A]/30 bg-[#111]/30" : "border-[#1A1A1A]/50 bg-transparent"} ${!isDrumKit && !isInScale ? "bg-black/40" : ""}`}
                onClick={(e) => handleGridClick(e, key)}
              />
            );
          })}

          {/* Ghost Notes */}
          {ghostNotes.map((gn, i) => {
            const rowIdx = DISPLAY_KEYS.indexOf(gn.note);
            if (rowIdx === -1) return null;
            return (
              <div
                key={gn.id || `gn_${i}`}
                className="absolute z-10 h-4 rounded-sm border border-white/5 pointer-events-none"
                style={{
                  top: rowIdx * 24 + 20, // 16px ruler + 4px centering
                  left: gn.relativeStart * currentGridSize,
                  width: gn.duration * currentGridSize,
                  backgroundColor: gn.color,
                  opacity: 0.15,
                }}
              />
            );
          })}

          {/* Floating Toolbar */}
          <div className="sticky top-16 right-4 w-full flex justify-end z-40 pointer-events-none px-4 mt-2 mb-2">
             <div className="flex gap-2 pointer-events-auto bg-[#1A1A1A] p-1 rounded-md border border-[#333] opacity-80 hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => setMarkedNoteIds(clip?.notes?.map(n => n.id) || [])}
                  className="text-[10px] uppercase font-bold text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-[#333]"
                  title="Mark All Notes"
                >
                  Mark All
                </button>
                {markedNoteIds.length > 0 && (
                  <>
                    <button 
                      onClick={() => {
                        if (!clip) return;
                        const pNotes = clip.notes || [];
                        const updated = pNotes.map(n => {
                          if (markedNoteIds.includes(n.id)) {
                            return { ...n, isSlide: !n.isSlide };
                          }
                          return n;
                        });
                        updateClip(clip.id, { notes: updated });
                      }}
                      className="text-[10px] uppercase font-bold text-[#00FF5A] hover:text-white px-2 py-1 rounded hover:bg-[#333]"
                      title="Toggle FL Studio Slide Note Glide Pitch-bend"
                    >
                      Toggle Slide (↗)
                    </button>
                    <button 
                      onClick={() => {
                        if (!clip) return;
                        const pNotes = clip.notes || [];
                        const getMidiVal = (nName: string) => {
                          const match = nName.match(/^([A-G]#?)(-?\d+)$/);
                          if (!match) return 60;
                          const name = match[1];
                          const octave = parseInt(match[2]);
                          const map: Record<string, number> = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
                          return octave * 12 + (map[name] ?? 0);
                        };
                        const markedNotes = pNotes.filter(n => markedNoteIds.includes(n.id))
                                                  .sort((a, b) => getMidiVal(a.note) - getMidiVal(b.note));
                        if (markedNotes.length <= 1) return;
                        const strumOffset = 0.35; // 16th steps offset
                        const baseStartTime = Math.min(...markedNotes.map(n => n.startTime));
                        const updated = pNotes.map(n => {
                          if (markedNoteIds.includes(n.id)) {
                            const idx = markedNotes.findIndex(mn => mn.id === n.id);
                            return { ...n, startTime: baseStartTime + idx * strumOffset };
                          }
                          return n;
                        });
                        updateClip(clip.id, { notes: updated });
                      }}
                      className="text-[10px] uppercase font-bold text-amber-400 hover:text-white px-2 py-1 rounded hover:bg-[#333]"
                      title="Shed Note Start Times into Guitar Strum Cascade"
                    >
                      ✏️ Strum Chords
                    </button>
                    <button 
                      onClick={() => setMarkedNoteIds([])}
                      className="text-[10px] uppercase font-bold text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-[#333]"
                      title="Clear Marked Notes"
                    >
                      Clear Marks ({markedNoteIds.length})
                    </button>
                  </>
                )}
             </div>
          </div>

          {/* Looped and Base Notes */}
          {(() => {
            const baseNotes = clip.notes || [];
            let maxNoteEnd = 0;
            baseNotes.forEach(n => {
                if (n.startTime + n.duration > maxNoteEnd) maxNoteEnd = n.startTime + n.duration;
            });
            const calculatedPatternLength = Math.max(1, Math.ceil(maxNoteEnd / 4) * 4);
            const loopLength = clip.loopLength || calculatedPatternLength;
            const totalDuration = clip.duration;
            const clipOffset = clip.audioOffset || 0;

            const uiElements: React.ReactNode[] = [];

            baseNotes.forEach((note, i) => {
              let rowIdx = DISPLAY_KEYS.indexOf(note.note);
              if (rowIdx === -1) return;

              const isMarked = markedNoteIds.includes(note.id);
              const isDraggingGroup = draggingNote && markedNoteIds.includes(draggingNote.id) && isMarked;
              let isDraggedOrResized = draggingNote?.id === note.id || resizingNote?.id === note.id || isDraggingGroup;

              for (let offset = 0; offset < totalDuration + clipOffset; offset += loopLength) {
                const isGhostLoop = offset > 0;
                
                let rawStart = note.startTime + offset - clipOffset;
                
                const end = rawStart + note.duration;
                if (rawStart >= totalDuration) break;
                if (end <= 0) continue;

                let clippedStart = Math.max(0, rawStart);
                let trimLeft = clippedStart - rawStart;
                
                let remaining = totalDuration - clippedStart;
                let clippedDuration = Math.min(note.duration - trimLeft, remaining);

                if (clippedDuration <= 0) continue;

                let displayStartTime = clippedStart;
                let displayDuration = clippedDuration;
                let displayRowIdx = rowIdx;

                if (isDraggedOrResized && !isGhostLoop) {
                  if ((draggingNote?.id === note.id || isDraggingGroup) && draggingNote) {
                    displayStartTime = Math.max(0, note.startTime + noteDragDelta.dx16ths) - clipOffset;
                    displayRowIdx = Math.max(0, Math.min(DISPLAY_KEYS.length - 1, rowIdx + noteDragDelta.dyRows));
                  }
                  if (resizingNote?.id === note.id && note.id) {
                    displayDuration = Math.max(1, resizingNote.initialDuration + noteResizeDelta.dx16ths);
                  }
                } else if (isDraggedOrResized && isGhostLoop) {
                  if ((draggingNote?.id === note.id || isDraggingGroup) && draggingNote) {
                     let draggedBaseStart = Math.max(0, note.startTime + noteDragDelta.dx16ths);
                     let draggedClippedBaseStart = Math.max(0, draggedBaseStart + offset - clipOffset);
                     displayStartTime = draggedClippedBaseStart;
                     displayRowIdx = Math.max(0, Math.min(DISPLAY_KEYS.length - 1, rowIdx + noteDragDelta.dyRows));
                  }
                  if (resizingNote?.id === note.id) {
                     let resDur = Math.max(1, resizingNote.initialDuration + noteResizeDelta.dx16ths);
                     let rStart = (note.startTime) + offset - clipOffset;
                     let clStart = Math.max(0, rStart);
                     let resTrimLeft = clStart - rStart;
                     let resRemaining = totalDuration - clStart;
                     displayDuration = Math.min(resDur - resTrimLeft, resRemaining);
                  }
                }

                if (displayStartTime >= totalDuration || displayDuration <= 0) continue;

                const isGhostNote = !!note.isGhost;
                const opacityBase = isGhostNote ? 0.45 : (0.2 + (note.velocity ?? 0.8) * 0.8);

                uiElements.push(
                  <div
                    key={`${note.id || `preset-note-${i}`}_${offset}`}
                    id={`midi-note-${note.id}`}
                    className={`midi-note absolute z-20 h-4 rounded-sm shadow-md cursor-pointer flex items-center group border select-none ${
                      isGhostNote 
                        ? 'border-dashed border-purple-400/80 animate-pulse shadow-[0_0_10px_rgba(168,85,247,0.7)]' 
                        : isGhostLoop 
                          ? 'border-white/10' 
                          : 'border-white/20'
                    } ${isMarked && !isGhostLoop && !isGhostNote ? 'ring-2 ring-white ring-offset-1 ring-offset-[#0A0A0A]' : ''}`}
                    style={{
                      top: displayRowIdx * 24 + 20, 
                      left: displayStartTime * currentGridSize,
                      width: displayDuration * currentGridSize,
                      background: isGhostNote 
                        ? 'rgba(168, 85, 247, 0.45)' 
                        : isMarked && !isGhostLoop 
                          ? "#fcd34d" 
                          : note.isSlide 
                            ? `repeating-linear-gradient(45deg, ${track.color}, ${track.color} 5px, rgba(255, 255, 255, 0.15) 5px, rgba(255, 255, 255, 0.15) 10px)`
                            : track.color,
                      opacity: isGhostLoop ? opacityBase * 0.4 : opacityBase,
                      touchAction: "none",
                    }}
                    onContextMenu={(e) => {
                      if (isGhostLoop) return;
                      e.preventDefault();
                      e.stopPropagation();
                      setMarkedNoteIds(prev => prev.includes(note.id) ? prev.filter(id => id !== note.id) : [...prev, note.id]);
                    }}
                    onPointerDown={async (e) => {
                      e.stopPropagation();
                      if (Tone.context.state !== "running") await Tone.start();
                      if (!audioEngine.isInitialized) await audioEngine.init();
                      audioEngine.triggerNote(track.id, note.note);
                      
                      if (!isGhostLoop) {
                        dragInfoRef.current = {
                          isDrag: false,
                          startX: e.clientX,
                          startY: e.clientY,
                        };
                        setDraggingNote({
                          id: note.id,
                          initialStartTime: note.startTime,
                          initialRowIdx: rowIdx,
                          startX: e.clientX,
                          startY: e.clientY,
                        });
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isGhostLoop && !dragInfoRef.current.isDrag) {
                        deleteNote(clip.id, note.id);
                      }
                    }}
                  >
                    <div className="w-full text-center text-[8px] font-bold text-white/50 pointer-events-none overflow-hidden flex items-center justify-center gap-0.5">
                      {note.isSlide && <span className="text-[#00FF5A] font-extrabold text-[9px]">↗</span>}
                      <span>{note.note}</span>
                    </div>

                    {!isGhostLoop && (
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-white/30 z-10"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setResizingNote({
                            id: note.id,
                            initialDuration: note.duration,
                            startX: e.clientX,
                          });
                        }}
                      />
                    )}
                  </div>
                );
              }
            });
            return uiElements;
          })()}
          {/* Velocity Lane */}
          <div className="sticky bottom-0 left-0 right-0 h-24 bg-[#0A0A0A] border-t border-[#2A2A2A] z-40 flex items-end">
            {(clip.notes || []).map((note, i) => {
              // Render velocity stalk
              return (
                <div
                  key={`vel_${note.id || i}`}
                  className="absolute bottom-0 w-2 shrink-0 cursor-ns-resize"
                  style={{
                    left: note.startTime * currentGridSize,
                    height: `${(note.velocity ?? 0.8) * 100}%`,
                    backgroundColor: track.color,
                    opacity: 0.6,
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const el = e.currentTarget;
                    const handleMove = (ev: PointerEvent) => {
                      const rect = el.parentElement!.getBoundingClientRect();
                      const relY = ev.clientY - rect.top;
                      const newVel = Math.max(
                        0.1,
                        Math.min(1.0, 1 - relY / rect.height),
                      );
                      updateNote(clip.id, note.id, { velocity: newVel });
                    };
                    const handleUp = () => {
                      window.removeEventListener("pointermove", handleMove);
                      window.removeEventListener("pointerup", handleUp);
                    };
                    window.addEventListener("pointermove", handleMove);
                    window.addEventListener("pointerup", handleUp);
                  }}
                >
                  <div className="w-full h-1 bg-white absolute top-0" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
