// @ts-nocheck
import React, { useRef, useState, useEffect } from 'react';
import { useDawStore } from '../../store/useDawStore';
import { TrackType } from '../../types/daw';
import * as Tone from 'tone';
import { Scissors, Trash2, Copy, VolumeX, FastForward, Rewind, Volume2, CheckSquare, Settings2, DivideSquare } from 'lucide-react';
import { audioEngine } from '../../audio/engine';
import { motion, AnimatePresence } from 'framer-motion';
import { timelineEvents } from '../../utils/timelineEvents';

const GRID_SIZE = 16; // width in px for one 16th note
const DEFAULT_TRACK_HEIGHT = 72; 
const COLLAPSED_TRACK_HEIGHT = 28;

function LiveRecordingClip({ trackId, color }: { trackId: string, color: string }) {
  const [width, setWidth] = useState(0);
  const [left, setLeft] = useState(0);
  const [peaks, setPeaks] = useState<number[]>([]);
  
  const [segments, setSegments] = useState<any[]>([]);

  useEffect(() => {
    let animationFrameId: number;
    let localPeaks: number[] = [];
    
    const updateRecording = () => {
      const state = useDawStore.getState();
      if (!state.isRecording || state.selectedTrackId !== trackId || state.recordingStart16ths === null) {
         setWidth(prev => prev !== 0 ? 0 : 0);
         setSegments([]);
         return;
      }
      
      const currentTicks = Tone.Transport.state === 'started' ? Tone.Transport.ticks : (state.transportPosition * 48);
      const current16ths = currentTicks / 48;
      const duration16ths = Math.max(0, current16ths - state.recordingStart16ths);
      
      const newLeft = state.recordingStart16ths * GRID_SIZE;
      const newWidth = Math.max(GRID_SIZE, duration16ths * GRID_SIZE);
      
      setLeft(prevLeft => Math.abs(prevLeft - newLeft) > 1 ? newLeft : prevLeft);
      setWidth(prevWidth => Math.abs(prevWidth - newWidth) > 1 ? newWidth : prevWidth);
      
      setSegments([...audioEngine.liveRecordingSegments]);
      
      // Every few frames, sample the peak
      if (Math.random() > 0.8) {
         localPeaks.push(audioEngine.currentRecordingPeakLevel || 0);
         // Keep max 200 peaks to prevent huge memory
         if (localPeaks.length > 200) localPeaks.shift(); 
         setPeaks([...localPeaks]);
      }

      animationFrameId = requestAnimationFrame(updateRecording);
    };
    updateRecording();
    return () => cancelAnimationFrame(animationFrameId);
  }, [trackId]);

  if (width === 0) return null;

  return (
    <>
      <div
        className="absolute top-2 bottom-2 rounded border border-red-500/30 z-20 pointer-events-none overflow-hidden duration-75"
        style={{
          left,
          width,
          backgroundColor: `${color}10`,
          borderColor: `rgba(255,0,0,0.3)`,
        }}
      >
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-red-500" />
      </div>

      {segments.map((seg, i) => (
        <div
          key={i}
          className="absolute top-2 bottom-2 rounded border border-red-500 bg-red-500/30 z-30 pointer-events-none overflow-hidden duration-75 flex items-center justify-between gap-[1px]"
          style={{
            left: left + seg.start16thsOffset * GRID_SIZE,
            width: Math.max(2, seg.duration16ths * GRID_SIZE),
          }}
        >
          {seg.peaks.filter((_: any, idx: number) => idx % Math.max(1, Math.floor(seg.peaks.length / 100)) === 0).slice(0, 100).map((p: number, idx: number) => (
            <div
              key={idx}
              className="flex-grow bg-red-400 rounded-full min-h-[4px]"
              style={{ minWidth: '1px', height: `${Math.max(10, p * 100)}%` }}
            />
          ))}
        </div>
      ))}
      
      {/* Active unsegmentized peaks indicator at the end */}
      {peaks.length > 0 && (
         <div
            className="absolute top-2 bottom-2 rounded border-r border-y border-red-500 bg-red-500/20 z-30 pointer-events-none overflow-hidden duration-75 flex items-center justify-between gap-[1px]"
            style={{
              left: left + (segments.length > 0 ? (segments[segments.length - 1].start16thsOffset + segments[segments.length - 1].duration16ths) * GRID_SIZE : 0),
              width: Math.max(2, width - (segments.length > 0 ? (segments[segments.length - 1].start16thsOffset + segments[segments.length - 1].duration16ths) * GRID_SIZE : 0)),
            }}
          >
            {peaks.filter((_: any, idx: number) => idx % Math.max(1, Math.floor(peaks.length / 100)) === 0).slice(-100).map((p: number, idx: number) => (
              <div
                key={idx}
                className="flex-grow bg-red-500 rounded-full flex-shrink-0 min-h-[4px]"
                style={{ minWidth: '1px', height: `${Math.max(10, p * 100)}%` }}
              />
            ))}
          </div>
      )}
    </>
  );
}

export function Arrangement() {
  const rawTracks = useDawStore(s => s.tracks);
  const tracks = React.useMemo(() => {
    const sorted: typeof rawTracks = [];
    const rootTracks = rawTracks.filter(t => !t.groupId);
    rootTracks.forEach(root => {
      sorted.push(root);
      if (root.type === 'group') {
        const children = rawTracks.filter(t => t.groupId === root.id);
        sorted.push(...children);
      }
    });
    // Append orphans if needed
    rawTracks.forEach(track => {
      if (!sorted.find(s => s.id === track.id)) {
        sorted.push(track);
      }
    });
    return sorted;
  }, [rawTracks]);
  const clips = useDawStore(s => s.clips);
  const addClip = useDawStore(s => s.addClip);
  const selectClip = useDawStore(s => s.selectClip);
  const selectedClipId = useDawStore(s => s.selectedClipId);
  const markedClipIds = useDawStore(s => s.markedClipIds);
  const toggleMarkClip = useDawStore(s => s.toggleMarkClip);
  const deleteClip = useDawStore(s => s.deleteClip);
  const duplicateClip = useDawStore(s => s.duplicateClip);
  const splitClip = useDawStore(s => s.splitClip);
  const updateClip = useDawStore(s => s.updateClip);
  const quantizeClipNotes = useDawStore(s => s.quantizeClipNotes);
  const copyClips = useDawStore(s => s.copyClips);
  const pasteClips = useDawStore(s => s.pasteClips);
  const clipboardClips = useDawStore(s => s.clipboardClips);
  const selectedTrackId = useDawStore(s => s.selectedTrackId);
  const bpm = useDawStore(s => s.bpm);
  const pixelsPerSecond = (bpm / 60) * 4 * GRID_SIZE;
  // We don't subscribe to transportPosition since Playhead is requestAnimationFrame updated
  // transportPosition = useDawStore(s => s.transportPosition); 

  const isAiProducing = useDawStore(s => s.isAiProducing);
  const aiStepMessage = useDawStore(s => s.aiStepMessage);
  const aiStepProgress = useDawStore(s => s.aiStepProgress);
  const aiActivePulseTrackId = useDawStore(s => s.aiActivePulseTrackId);

  const arrangementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = timelineEvents.subscribe((event) => {
      if (event.type === 'AddClip') {
        if (arrangementRef.current) {
          const clipX = event.startTime * GRID_SIZE;
          const container = arrangementRef.current;
          container.scrollTo({
            left: Math.max(0, clipX - 160),
            behavior: 'smooth'
          });
        }
      } else if (event.type === 'MoveClip') {
        if (arrangementRef.current) {
          const clipX = event.newStartTime * GRID_SIZE;
          const container = arrangementRef.current;
          container.scrollTo({
            left: Math.max(0, clipX - 160),
            behavior: 'smooth'
          });
        }
      }
    });
    return unsubscribe;
  }, []);
  const playheadRef = useRef<HTMLDivElement>(null);

  const [draggingClips, setDraggingClips] = useState<{ id: string, initialStartTime: number, initialTrackIdx: number }[] | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);

  const [resizingClip, setResizingClip] = useState<{ id: string, startX: number, initialDuration: number, edge: 'left' | 'right', initialStartTime: number, initialAudioOffset: number } | null>(null);

  const [clipDragDelta, setClipDragDelta] = useState<{ dx16ths: number, dyPx: number }>({ dx16ths: 0, dyPx: 0 });
  const [clipResizeDelta, setClipResizeDelta] = useState<{ dx16ths: number }>({ dx16ths: 0 });
  const [pasteTarget, setPasteTarget] = useState<{ trackId: string, startTime: number } | null>(null);
  
  const markAllClips = useDawStore(s => s.markAllClips);
  const clearMarkedClips = useDawStore(s => s.clearMarkedClips);

  const getTrackHeight = (track: any) => track.collapsed ? COLLAPSED_TRACK_HEIGHT : DEFAULT_TRACK_HEIGHT;
  
  const getTrackY = (index: number) => {
    let y = 0;
    for (let i = 0; i < index; i++) {
        y += getTrackHeight(tracks[i]);
    }
    return y;
  };

  const getTrackIndexAtY = (y: number) => {
    if (y < 0) return 0;
    let currentY = 0;
    for (let i = 0; i < tracks.length; i++) {
        const h = getTrackHeight(tracks[i]);
        if (y >= currentY && y < currentY + h) return i;
        currentY += h;
    }
    return tracks.length - 1;
  };

  const getCompatibleTrackIdx = (targetIdx: number, requiredType: TrackType) => {
    let bestIdx = -1;
    let minDistance = Infinity;
    for (let i = 0; i < tracks.length; i++) {
      if (tracks[i].type === requiredType) {
        const distance = Math.abs(i - targetIdx);
        if (distance < minDistance) {
          minDistance = distance;
          bestIdx = i;
        }
      }
    }
    return bestIdx !== -1 ? bestIdx : targetIdx;
  };

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, clipIds: string[] } | null>(null);
  const [contextMenuDrag, setContextMenuDrag] = useState<{ startX: number, startY: number, startMouseX: number, startMouseY: number, isDragging: boolean } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!contextMenuDrag) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!contextMenuDrag.isDragging) {
        setContextMenuDrag(prev => prev ? { ...prev, isDragging: true } : null);
      }
      setContextMenu(prev => {
        if (!prev) return null;
        const dx = e.clientX - contextMenuDrag.startMouseX;
        const dy = e.clientY - contextMenuDrag.startMouseY;
        return {
          ...prev,
          x: contextMenuDrag.startX + dx,
          y: contextMenuDrag.startY + dy
        };
      });
    };

    const handlePointerUp = () => {
      setContextMenuDrag(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [contextMenuDrag]);

  useEffect(() => {
    let animationFrameId: number;
    const updatePlayhead = () => {
      const state = useDawStore.getState();
      let position = state.transportPosition;
      if (Tone.Transport.state === 'started') {
        const secondsPer16th = 15 / state.bpm;
        position = Tone.Transport.seconds / secondsPer16th;
      }
      
      if (playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${position * GRID_SIZE}px)`;
      }
      
      if ((state.isRecording || state.playbackState === 'playing') && arrangementRef.current) {
         const playheadX = position * GRID_SIZE;
         const scrollLeft = arrangementRef.current.scrollLeft;
         const width = arrangementRef.current.clientWidth;
         
         if (playheadX > scrollLeft + width * 0.8) {
            arrangementRef.current.scrollLeft = playheadX - width * 0.2;
         }
      }
      
      animationFrameId = requestAnimationFrame(updatePlayhead);
    };
    updatePlayhead();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const handlePointerMove = (e: PointerEvent) => {
    // Clear long press if we move significantly
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (resizingClip) {
      const dx = e.clientX - resizingClip.startX;
      let dx16ths = Math.round(dx / GRID_SIZE);
      setClipResizeDelta({ dx16ths });
      return;
    }

    if (!draggingClips || !arrangementRef.current) return;
    
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    let dx16ths = Math.round(dx / GRID_SIZE);

    setClipDragDelta({ dx16ths, dyPx: dy });
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (draggingClips) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        const dx16ths = Math.round(dx / GRID_SIZE);

        if (dx16ths !== 0 || dy !== 0) {
            draggingClips.forEach(c => {
                const newStartTime = Math.max(0, c.initialStartTime + dx16ths);
                
                const initialY = getTrackY(c.initialTrackIdx);
                const newY = initialY + dy;
                const rawTrackIdx = Math.max(0, Math.min(tracks.length - 1, getTrackIndexAtY(newY)));
                const requiredType = tracks[c.initialTrackIdx]?.type || 'midi';
                const newTrackIdx = getCompatibleTrackIdx(rawTrackIdx, requiredType);

                updateClip(c.id, { 
                    startTime: newStartTime, 
                    trackId: tracks[newTrackIdx].id 
                });
            });
        }
    }

    if (resizingClip) {
        const dx = e.clientX - resizingClip.startX;
        const dx16ths = Math.round(dx / GRID_SIZE);
        if (dx16ths !== 0) {
            const clip = clips[resizingClip.id];
            const speed = clip?.speed || 1;
            const actualAdd = dx16ths * speed;

            if (resizingClip.edge === 'right') {
                const newDuration = Math.max(1, resizingClip.initialDuration + actualAdd);
                updateClip(resizingClip.id, { duration: newDuration });
            } else if (resizingClip.edge === 'left') {
                const possibleDx = Math.max(-resizingClip.initialStartTime, dx16ths);
                const actualDxDisplay = Math.min(possibleDx, (resizingClip.initialDuration / speed) - 1);
                const actualDx = actualDxDisplay * speed;
                
                const newStartTime = Math.max(0, resizingClip.initialStartTime + actualDxDisplay);
                const newDuration = Math.max(1, resizingClip.initialDuration - actualDx);
                const newAudioOffset = Math.max(0, resizingClip.initialAudioOffset + actualDx);
                
                updateClip(resizingClip.id, { 
                    startTime: newStartTime, 
                    duration: newDuration,
                    audioOffset: newAudioOffset
                });
            }
        }
    }

    setDraggingClips(null);
    setResizingClip(null);
    setClipDragDelta({ dx16ths: 0, dyPx: 0 });
    setClipResizeDelta({ dx16ths: 0 });
  };

  useEffect(() => {
    if (draggingClips || resizingClip) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      return () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };
    }
  }, [draggingClips, resizingClip]);


  const handleGridClick = (e: React.MouseEvent, trackId: string) => {
    if ((e.target as HTMLElement).closest('.clip')) return;
    setContextMenu(null);
    useDawStore.getState().selectTrack(trackId);

    if (clipboardClips && clipboardClips.length > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const dx = e.clientX - rect.left;
      const pos16ths = Math.max(0, dx / GRID_SIZE);
      const snapped16ths = Math.round(pos16ths);
      setPasteTarget({
        trackId,
        startTime: snapped16ths
      });
    } else {
      setPasteTarget(null);
    }
  };

  const onClipPointerDown = (e: React.PointerEvent, clipId: string, trackIdx: number) => {
    e.stopPropagation();
    e.preventDefault(); // prevent text selection
    setContextMenu(null);
    setPasteTarget(null);

    const isMarked = markedClipIds.includes(clipId);
    const isSelected = selectedClipId === clipId;

    if (!isSelected && !isMarked) {
      selectClip(clipId);
      
      // Start long press timer
      longPressTimer.current = setTimeout(() => {
        setContextMenu({ 
          x: Math.min(e.clientX, window.innerWidth - 200), 
          y: Math.min(e.clientY, window.innerHeight - 350), 
          clipIds: [clipId] 
        });
      }, 500);
      return; // "clip dragging should only work when user tap on clip first"
    }

    // Prepare for drag
    const targetIds = isMarked ? markedClipIds : [clipId];
    
    // Start long press timer even for selected clips to open menu
    longPressTimer.current = setTimeout(() => {
      setContextMenu({ 
        x: Math.min(e.clientX, window.innerWidth - 200), 
        y: Math.min(e.clientY, window.innerHeight - 350), 
        clipIds: targetIds 
      });
      setDraggingClips(null); // Stop dragging if menu opens
    }, 500);

    setDragStartX(e.clientX);
    setDragStartY(e.clientY);
    setDraggingClips(
      targetIds.map(id => {
        const c = clips[id];
        const tIdx = tracks.findIndex(t => t.id === c.trackId);
        return {
          id: c.id,
          initialStartTime: c.startTime,
          initialTrackIdx: tIdx > -1 ? tIdx : trackIdx
        };
      })
    );
  };

  const onHandlePointerDown = (e: React.PointerEvent, clip: any, edge: 'left' | 'right') => {
    e.stopPropagation();
    e.preventDefault();
    setContextMenu(null);
    setResizingClip({
      id: clip.id,
      startX: e.clientX,
      initialDuration: clip.duration,
      initialStartTime: clip.startTime,
      initialAudioOffset: clip.audioOffset || 0,
      edge
    });
  };

  const handleAction = (action: string) => {
    if (!contextMenu) return;
    const { clipIds } = contextMenu;
    
    if (action === 'copy') {
      copyClips(clipIds);
      setContextMenu(null);
      return;
    }
    
    clipIds.forEach(id => {
      const c = clips[id];
      if (!c) return;

      switch(action) {
        case 'delete':
          deleteClip(id);
          break;
        case 'cut':
          copyClips([id]);
          deleteClip(id);
          break;
        case 'duplicate':
          duplicateClip(id);
          break;
        case 'split':
          let currentPos = useDawStore.getState().transportPosition;
          if (Tone.Transport.state === 'started') {
            currentPos = Tone.Transport.ticks / 48;
          }
          splitClip(id, currentPos);
          break;
        case 'mute':
          updateClip(id, { muted: !c.muted });
          break;
        case 'speedUp':
          updateClip(id, { speed: (c.speed || 1) * 1.5 });
          break;
        case 'speedDown':
          updateClip(id, { speed: (c.speed || 1) * 0.75 });
          break;
        case 'gainUp':
          updateClip(id, { gain: (c.gain || 0) + 1 });
          break;
        case 'gainDown':
          updateClip(id, { gain: (c.gain || 0) - 1 });
          break;
        case 'fadeIn':
          updateClip(id, { fadeIn: (c.fadeIn || 0) + 0.5 }); // Add 0.5s fade in
          break;
        case 'fadeOut':
          updateClip(id, { fadeOut: (c.fadeOut || 0) + 0.5 }); // Add 0.5s fade out
          break;
        case 'mark':
          toggleMarkClip(id);
          break;
        case 'denoise':
          updateClip(id, { denoised: !c.denoised });
          break;
        case 'quantize':
          if (c.notes && c.notes.length > 0) {
            quantizeClipNotes(id, 1); // Default to 16th note
          }
          break;
      }
    });

    setContextMenu(null);
  };

  const handleRulerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPasteTarget(null);
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - rect.left;
    let pos16ths = dx / GRID_SIZE;
    
    // Optional grid snap could go here
    pos16ths = Math.max(0, pos16ths);
    
    useDawStore.getState().setTransportPosition(pos16ths);
    Tone.Transport.position = `0:0:${pos16ths}`;
  };

  let max16ths = 1024; // Default 64 bars
  Object.values(clips).forEach(c => {
      const parentTrack = tracks.find(t => t.id === c.trackId);
      if (parentTrack) {
        const isEmptyMidi = parentTrack.type === 'midi' && (!c.notes || c.notes.length === 0);
        const isEmptyAudio = parentTrack.type === 'audio' && (!c.audioUrl && (!c.recordingPeaks || c.recordingPeaks.length === 0));
        if (isEmptyMidi || isEmptyAudio) return;
      }
      const end = c.startTime + c.duration;
      if (end > max16ths) max16ths = end + 64; // pad 4 bars extra
  });
  const widthPx = `${max16ths * GRID_SIZE}px`;
  const numRulerBars = Math.ceil(max16ths / 4);

  return (
    <div 
      className="flex-1 bg-[#0A0A0A] overflow-auto relative flex flex-col"
      ref={arrangementRef}
    >
      <AnimatePresence>
        {isAiProducing && (
          <motion.div 
            initial={{ opacity: 0, y: -25, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -25, scale: 0.95 }}
            className="fixed top-12 left-1/2 -translate-x-1/2 bg-zinc-950/95 border border-[#4dffb4]/30 text-[#00FF9C] px-5 py-3 rounded-full shadow-[0_15px_40px_rgba(0,0,0,0.8),0_0_20px_rgba(0,255,156,0.15)] flex items-center gap-4 z-50 text-xs font-semibold tracking-wider font-mono min-w-[360px]"
          >
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FF9C] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00FF9C]"></span>
            </span>
            <div className="flex-grow min-w-0">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[#00FF9C] text-[10px] font-extrabold uppercase tracking-widest">LIVE BUILD ACTIVE</span>
                <span className="text-zinc-400 font-bold text-[9px]">{Math.round(aiStepProgress)}%</span>
              </div>
              <div className="text-zinc-200 font-bold truncate capitalize text-[11px] mb-1.5 leading-none">{aiStepMessage || "Composing music..."}</div>
              <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden border border-zinc-850">
                <div 
                  className="h-full bg-gradient-to-r from-[#00FF9C] to-emerald-400 transition-all duration-300 rounded-full" 
                  style={{ width: `${Math.max(4, Math.min(100, aiStepProgress))}%` }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="relative min-w-max shrink-0 flex-1" style={{ width: widthPx }}>
        {/* Backdrop for ruler */}
        <div 
          className="h-6 sticky top-0 bg-[#111] border-b border-[#222] z-30 cursor-pointer flex justify-between"
          onClick={handleRulerClick}
        >
          <div className="relative flex-1">
            {Array.from({ length: numRulerBars }).map((_, i) => (
              <div 
                key={i} 
                className="absolute h-full border-l border-[#333] text-[9px] text-gray-500 pl-1 pt-1 pointer-events-none select-none"
                style={{ left: i * 4 * GRID_SIZE }}
              >
                {i}
              </div>
            ))}
          </div>
        </div>
        
        {/* Toolbar floating top-right (sticky) */}
        <div className="sticky top-8 right-4 w-full flex justify-end z-20 pointer-events-none px-4">
            <div className="flex gap-2 pointer-events-auto bg-[#1A1A1A] p-1 rounded-md border border-[#333] opacity-80 hover:opacity-100 transition-opacity">
               <button 
                 onClick={() => markAllClips()}
                 className="text-[10px] uppercase font-bold text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-[#333]"
                 title="Mark All Clips"
               >
                 Mark All
               </button>
               {markedClipIds.length > 0 && (
                 <button 
                   onClick={() => clearMarkedClips()}
                   className="text-[10px] uppercase font-bold text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-[#333]"
                   title="Clear Marked Clips"
                 >
                   Clear Marks ({markedClipIds.length})
                 </button>
               )}
               {clipboardClips && clipboardClips.length > 0 && (
                 <button 
                   onClick={() => {
                     let currentPos = useDawStore.getState().transportPosition;
                     if (Tone.Transport.state === 'started') {
                       currentPos = Tone.Transport.ticks / 48;
                     }
                     const trackId = selectedTrackId || (tracks[0]?.id);
                     if (trackId) {
                       pasteClips(trackId, currentPos);
                     }
                   }}
                   className="text-[10px] uppercase font-bold text-green-400 hover:text-green-300 px-2 py-1 rounded hover:bg-[#333] flex items-center gap-1"
                   title="Paste Copied Clip(s) at Playhead"
                 >
                   Paste ({clipboardClips.length})
                 </button>
               )}
            </div>
        </div>

         {isAiProducing && (
          <div className="absolute inset-x-0 top-6 bottom-0 bg-black/10 z-30 pointer-events-auto cursor-not-allowed select-none border border-[#00FF9C]/10 rounded" title="Timeline locked while AI is producing">
            <div className="sticky left-6 top-8 bg-zinc-950/90 border border-[#00FF9C]/20 px-4 py-2 rounded shadow-lg shadow-black/80 flex items-center gap-2 max-w-max">
               <span className="w-2.5 h-2.5 rounded-full bg-[#00FF9C] animate-pulse shrink-0" />
               <span className="text-[10px] text-zinc-300 uppercase font-mono font-extrabold tracking-wider select-none">🔒 Manual Timeline Locked during AI building</span>
            </div>
          </div>
        )}

        {/* Background Grid Lines */}
        <div 
          className="absolute top-6 bottom-0 pointer-events-none" 
          style={{ 
            width: widthPx,
            backgroundImage: 'linear-gradient(to right, #1A1A1A 1px, transparent 1px), linear-gradient(to right, #2A2A2A 1px, transparent 1px)',
            backgroundSize: `${GRID_SIZE}px 100%, ${GRID_SIZE * 4}px 100%`,
            opacity: 0.5
          }} 
        />

        {/* Playhead */}
        <div 
          className="absolute top-0 bottom-0 w-px bg-[#00FF9C] z-20 pointer-events-none shadow-[0_0_10px_#00FF9C]"
          ref={playheadRef}
        >
          <div className="w-3 h-3 border border-[#00FF9C] bg-[#141414] rounded-full -translate-x-[5px] translate-y-1.5" />
        </div>

        {tracks.map((track, trackIdx) => {
          const isPulseEdited = aiActivePulseTrackId === track.id;
          return (
            <div 
              key={track.id}
              className={`border-b border-[#1A1A1A] relative transition-all duration-300 ${track.type === 'group' ? 'bg-[#0b0b0d]/70' : ''} ${
                isPulseEdited ? 'bg-[#00FF9C]/5 shadow-[inset_0_0_20px_rgba(0,255,156,0.15)] ring-1 ring-[#00FF9C]/20 animate-pulse' : ''
              }`}
              style={{ height: getTrackHeight(track) }}
              onClick={(e) => { if (track.type === 'group' || isAiProducing) return; handleGridClick(e, track.id); }}
            >
            {track.type === 'group' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-30">
                <span className="text-[10px] font-bold text-zinc-400 tracking-widest font-mono">
                  GROUP TRACK BUS • VOL & FX ROUTING ONLY
                </span>
              </div>
            )}
            {track.type !== 'group' && (track.clips || []).map(clipId => {
              const clip = clips[clipId];
              if (!clip) return null;
              
              const isEmptyMidi = track.type === 'midi' && (!clip.notes || clip.notes.length === 0);
              const isEmptyAudio = track.type === 'audio' && (!clip.audioUrl && (!clip.recordingPeaks || clip.recordingPeaks.length === 0));
              if ((isEmptyMidi || isEmptyAudio) && !clip.isGhost && !isAiProducing) return null;
              
              const isSelected = selectedClipId === clip.id;
              const isMarked = markedClipIds.includes(clip.id);
              const isActive = isSelected || isMarked;

              let displayStartTime = clip.startTime;
              let displayDuration = Math.max(clip.duration / (clip.speed || 1), 1);
              let displayTrackIdx = trackIdx;

              if (draggingClips?.find(c => c.id === clip.id)) {
                  const data = draggingClips.find(c => c.id === clip.id)!;
                  displayStartTime = Math.max(0, data.initialStartTime + clipDragDelta.dx16ths);
                  
                  const initialY = getTrackY(data.initialTrackIdx);
                  const currentY = initialY + clipDragDelta.dyPx;
                  const rawTrackIdx = Math.max(0, Math.min(tracks.length - 1, getTrackIndexAtY(currentY)));
                  const requiredType = tracks[data.initialTrackIdx]?.type || 'midi';
                  displayTrackIdx = getCompatibleTrackIdx(rawTrackIdx, requiredType);
              }

              if (resizingClip?.id === clip.id) {
                  if (resizingClip.edge === 'right') {
                      displayDuration = Math.max(1, resizingClip.initialDuration + clipResizeDelta.dx16ths);
                  } else {
                      const possibleDx = Math.max(-resizingClip.initialStartTime, clipResizeDelta.dx16ths);
                      const actualDx = Math.min(possibleDx, resizingClip.initialDuration - 1);
                      displayStartTime = Math.max(0, resizingClip.initialStartTime + actualDx);
                      displayDuration = Math.max(1, resizingClip.initialDuration - actualDx);
                  }
              }

              // Do not render if the clip visually moved to another track while dragging
              if (displayTrackIdx !== trackIdx) return null;

              return (
                <motion.div
                  key={clip.id}
                  layoutId={`clip-layout-${clip.id}`}
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: clip.muted ? 0.5 : 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                  className={`clip absolute top-2 bottom-2 rounded cursor-pointer border ${
                    clip.isGhost 
                      ? 'border-dashed border-emerald-400 opacity-60 animate-pulse shadow-[0_0_12px_rgba(0,255,156,0.6)] z-20'
                      : isActive ? 'border-[#00FF9C] z-10 shadow-[0_0_8px_#00FF9C]' : 'hover:brightness-110'
                  } ${clip.muted ? 'opacity-50 grayscale' : ''}`}
                  style={{
                    left: displayStartTime * GRID_SIZE,
                    width: displayDuration * GRID_SIZE,
                    backgroundColor: clip.isGhost ? 'rgba(16, 185, 129, 0.1)' : isActive ? `${track.color}40` : `${track.color}20`,
                    borderColor: clip.isGhost ? '#00FF9C' : isActive ? `${track.color}90` : `${track.color}40`,
                    touchAction: 'none'
                  }}
                  onPointerDown={(e) => { 
                    if (clip.isGhost) {
                      e.stopPropagation();
                      return;
                    }
                    if (isAiProducing) return; 
                    onClipPointerDown(e, clip.id, trackIdx); 
                  }}
                  onDoubleClick={(e) => { 
                    if (clip.isGhost) {
                      e.stopPropagation();
                      return;
                    }
                    if (isAiProducing) return; 
                    e.stopPropagation(); 
                    useDawStore.getState().selectTrack(clip.trackId);
                    useDawStore.getState().selectClip(clip.id); 
                    useDawStore.getState().setCurrentTab('pianoroll'); 
                  }}
                >
                  <div 
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{ backgroundColor: track.color }}
                  />

                  {/* Ghost Pre-placement Actions Overlay */}
                  {clip.isGhost && (
                    <div 
                      onPointerDown={(e) => e.stopPropagation()}
                      className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center gap-1.5 p-1 z-30 pointer-events-auto"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          useDawStore.getState().updateClip(clip.id, { isGhost: false });
                          timelineEvents.emit({ type: 'CommitGhostClip', ghostId: clip.id, realClipId: clip.id });
                        }}
                        className="bg-emerald-500 hover:bg-[#00FF5A] text-black text-[9px] font-extrabold px-2 py-0.5 rounded shadow-md cursor-pointer transition-all uppercase flex items-center gap-0.5"
                        title="Accept AI block"
                      >
                        ✓ Keep
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          useDawStore.getState().deleteClip(clip.id);
                          timelineEvents.emit({ type: 'RemoveGhostClip', ghostId: clip.id });
                        }}
                        className="bg-red-500/90 hover:bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow-md cursor-pointer transition-all uppercase"
                        title="Discard"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Left Resize Handle */}
                  {isActive && !clip.isGhost && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-3 bg-white/10 hover:bg-white/30 cursor-ew-resize z-20"
                      onPointerDown={(e) => onHandlePointerDown(e, clip, 'left')}
                    />
                  )}
                  {/* Right Resize Handle */}
                  {isActive && !clip.isGhost && (
                    <div 
                      className="absolute right-0 top-0 bottom-0 w-3 bg-white/10 hover:bg-white/30 cursor-ew-resize z-20"
                      onPointerDown={(e) => onHandlePointerDown(e, clip, 'right')}
                    />
                  )}

                  <div className="relative z-10 p-1 text-[9px] font-bold text-white/90 overflow-hidden text-ellipsis whitespace-nowrap flex gap-1 items-center uppercase pointer-events-none">
                    {clip.isGhost ? (
                      <span className="text-emerald-300 flex items-center gap-1 animate-pulse font-extrabold tracking-wide">
                        <span>👻</span> AI PREVIEW
                      </span>
                    ) : (
                      <>
                        {isMarked && <CheckSquare size={10} className="text-[#00FF9C]" />}
                        {clip.muted && <VolumeX size={10} className="text-red-400" />}
                        {clip.speed && clip.speed !== 1 && <span className="text-blue-300">{clip.speed}x</span>}
                        {clip.denoised && <span className="text-purple-300">DN</span>}
                        {clip.gain && clip.gain !== 0 ? <span className="text-green-300">{clip.gain > 0 ? '+' : ''}{clip.gain}dB</span> : null}
                        {track.type === 'audio' ? 'AUDIO' : (clip.notes && clip.notes.length > 0) ? 'MIDI' : 'EMPTY'}
                      </>
                    )}
                  </div>
                  
                  {/* Fades visual line */}
                  {(clip.fadeIn || clip.fadeOut) ? (
                     <div className="absolute top-0 bottom-0 left-0 right-0 pointer-events-none overflow-hidden z-0">
                       {clip.fadeIn ? <div className="absolute bottom-0 left-0 h-full w-4 bg-gradient-to-tr from-transparent to-white/20" style={{ width: `${clip.fadeIn * pixelsPerSecond}px`}} /> : null}
                       {clip.fadeOut ? <div className="absolute bottom-0 right-0 h-full w-4 bg-gradient-to-tl from-transparent to-white/20" style={{ width: `${clip.fadeOut * pixelsPerSecond}px`}} /> : null}
                     </div>
                  ) : null}

                  {/* Loop Boundaries */}
                  {(() => {
                    const loopLength = clip.loopLength || clip.duration;
                    if (loopLength >= displayDuration) return null;
                    const loops = Math.floor(displayDuration / loopLength);
                    return Array.from({ length: loops }).map((_, i) => (
                      <div
                        key={`loop_div_${i}`}
                        className="absolute top-0 bottom-0 pointer-events-none border-l border-white/20 border-dashed z-0"
                        style={{ left: `${((i + 1) * loopLength / displayDuration) * 100}%` }}
                      />
                    ));
                  })()}

                  {track.type === 'midi' ? (
                    <div className="relative z-10 mt-1 h-full flex flex-col gap-0.5 opacity-60 px-1 overflow-hidden pointer-events-none">
                      {(() => {
                        const loopLength = clip.loopLength || clip.duration;
                        const notesToRender: any[] = [];
                        (clip.notes || []).forEach(note => {
                          for (let offset = 0; offset < displayDuration; offset += loopLength) {
                            const actualStart = note.startTime + offset;
                            if (actualStart >= displayDuration) break;
                            notesToRender.push({ ...note, startTime: actualStart });
                          }
                        });
                        return notesToRender.map((note, i) => (
                          <div 
                            key={`visual-note-${i}`} 
                            className="bg-white rounded-sm h-[2px] opacity-70 absolute"
                            style={{
                              left: `${(note.startTime / displayDuration) * 100}%`,
                              width: `${(note.duration / displayDuration) * 100}%`,
                              top: `${(((note.note || '').charCodeAt(0) || 65) % 10) * 10}%`
                            }}
                          />
                        ));
                      })()}
                    </div>
                  ) : (
                    <div className="relative z-10 mt-1 h-full w-full pointer-events-none">
                      <div className="relative h-full flex items-center justify-start opacity-70">
                        {clip.recordingPeaks && clip.recordingPeaks.length > 0 ? (
                          <div className="absolute inset-0 flex items-end justify-between gap-[1px] overflow-hidden">
                            {clip.recordingPeaks.map((p, i) => {
                              const current16thRelative = (i / (clip.recordingPeaks?.length || 1)) * clip.duration;
                              const matchedNote = clip.vocalNotes?.find(
                                n => current16thRelative >= n.startTime && current16thRelative <= n.startTime + n.duration
                              );
                              const isSilence = matchedNote?.isSilence;
                              const isSpoken = matchedNote && !isSilence;

                              let peakBg = "bg-white/10";
                              if (isSpoken) {
                                // Dynamic green gradient depending on volume
                                const loudness = matchedNote?.loudness || 0.04;
                                peakBg = loudness > 0.08 ? "bg-emerald-400" : "bg-[#00FF9C]";
                              } else if (isSilence) {
                                peakBg = "bg-zinc-800/40 border-b border-zinc-700/20";
                              }

                              return (
                                <div 
                                  key={i} 
                                  className={`rounded flex-grow ${peakBg}`} 
                                  style={{ 
                                    minWidth: '1px', 
                                    height: `${Math.max(5, p * 100)}%`
                                  }} 
                                />
                              );
                            })}
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-between gap-[1px] overflow-hidden">
                            {Array.from({ length: Math.min(100, Math.floor(clip.duration * 2.5)) }).map((_, i) => (
                              <div key={i} className="bg-white opacity-20 rounded flex-grow" style={{ minWidth: '1px', height: `${20 + Math.random() * 80}%` }} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
            <LiveRecordingClip trackId={track.id} color={track.color} />
            {pasteTarget && pasteTarget.trackId === track.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  pasteClips(track.id, pasteTarget.startTime);
                  setPasteTarget(null);
                }}
                className="absolute z-40 bg-[#00FF9C] hover:bg-[#00E58B] active:scale-95 text-black font-extrabold px-3 py-1.5 rounded-full shadow-lg shadow-black/80 text-[11px] flex items-center gap-1.5 transition-all outline-none border border-black/20"
                style={{
                  left: pasteTarget.startTime * GRID_SIZE,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <Copy size={11} className="rotate-180" /> Paste
              </button>
            )}
          </div>
        )})}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-[#111] border border-[#333] shadow-xl rounded-lg p-1 min-w-[160px] text-sm text-gray-200 overflow-y-auto"
          style={{ 
            top: contextMenu.y,
            left: contextMenu.x,
            maxHeight: 'min(60vh, 400px)'
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <div 
            className="px-3 py-1 mb-1 text-xs font-bold text-gray-500 uppercase border-b border-[#222] cursor-move select-none"
            onPointerDown={(e) => {
               (e.target as HTMLElement).setPointerCapture(e.pointerId);
               setContextMenuDrag({
                  startX: contextMenu.x,
                  startY: contextMenu.y,
                  startMouseX: e.clientX,
                  startMouseY: e.clientY,
                  isDragging: false
               });
            }}
            onPointerUp={(e) => {
               (e.target as HTMLElement).releasePointerCapture(e.pointerId);
               setContextMenuDrag(null);
            }}
          >
            Clip Actions ({contextMenu.clipIds.length})
          </div>
          
          <button onClick={() => handleAction('mark')} className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[#222] rounded transition-colors">
            <CheckSquare size={14} /> Mark Clip
          </button>
          {(() => {
            const firstClip = clips[contextMenu.clipIds[0]];
            const isAudioClip = firstClip && tracks.find(t => t.id === firstClip.trackId)?.type === 'audio';
            if (!isAudioClip) return null;
            return (
              <button onClick={() => handleAction('split')} className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[#222] rounded transition-colors">
                <DivideSquare size={14} /> Split at Playhead
              </button>
            );
          })()}
          <button onClick={() => { handleAction('cut'); setContextMenu(null); }} className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[#222] rounded transition-colors text-orange-400">
            <Scissors size={14} /> Cut Clip
          </button>
          <button onClick={() => handleAction('copy')} className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[#222] rounded transition-colors text-blue-400">
            <Copy size={14} /> Copy Clip
          </button>
          <button onClick={() => handleAction('duplicate')} className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[#222] rounded transition-colors">
            <Copy size={14} /> Duplicate Clip
          </button>
          {clipboardClips && clipboardClips.length > 0 && (
            <button 
              onClick={() => {
                let currentPos = useDawStore.getState().transportPosition;
                if (Tone.Transport.state === 'started') {
                  currentPos = Tone.Transport.ticks / 48;
                }
                const trackId = selectedTrackId || (tracks[0]?.id);
                if (trackId) {
                  pasteClips(trackId, currentPos);
                }
                setContextMenu(null);
              }} 
              className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[#222] rounded transition-colors text-green-400"
            >
              <Copy size={14} className="rotate-180" /> Paste Clip at Playhead
            </button>
          )}
          
          <div className="h-px bg-[#222] my-1" />

          <button onClick={() => handleAction('mute')} className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[#222] rounded transition-colors">
            <VolumeX size={14} /> {clips[contextMenu.clipIds[0]]?.muted ? 'Unmute (Silent)' : 'Mute (Silent)'}
          </button>
          <div className="flex w-full">
            <button onClick={() => handleAction('gainUp')} className="flex-1 text-left px-3 py-2 hover:bg-[#222] rounded transition-colors text-center text-xs border-r border-[#222]">
              +1dB Gain
            </button>
            <button onClick={() => handleAction('gainDown')} className="flex-1 text-left px-3 py-2 hover:bg-[#222] rounded transition-colors text-center text-xs">
              -1dB Gain
            </button>
          </div>
          <button onClick={() => handleAction('denoise')} className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[#222] rounded transition-colors">
            <Settings2 size={14} /> {clips[contextMenu.clipIds[0]]?.denoised ? 'Remove Denoise' : 'Denoise'}
          </button>
          
          {clips[contextMenu.clipIds[0]]?.notes && clips[contextMenu.clipIds[0]]?.notes.length > 0 && (
            <button onClick={() => handleAction('quantize')} className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[#222] rounded transition-colors">
              <DivideSquare size={14} /> Quantize (1/16)
            </button>
          )}

          <div className="h-px bg-[#222] my-1" />
          
          {/* Quick Clip Editor Sliders */}
          <div className="px-3 py-2">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] uppercase font-bold text-gray-500">Fade In</label>
              <span className="text-[10px] text-gray-400">{(clips[contextMenu.clipIds[0]]?.fadeIn || 0).toFixed(2)}s</span>
            </div>
            <input 
              type="range" 
              min="0" max="5" step="0.1" 
              value={clips[contextMenu.clipIds[0]]?.fadeIn || 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                contextMenu.clipIds.forEach(id => updateClip(id, { fadeIn: val }));
              }}
              className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="px-3 py-2">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] uppercase font-bold text-gray-500">Fade Out</label>
              <span className="text-[10px] text-gray-400">{(clips[contextMenu.clipIds[0]]?.fadeOut || 0).toFixed(2)}s</span>
            </div>
            <input 
              type="range" 
              min="0" max="5" step="0.1" 
              value={clips[contextMenu.clipIds[0]]?.fadeOut || 0}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                contextMenu.clipIds.forEach(id => updateClip(id, { fadeOut: val }));
              }}
              className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="px-3 py-2 border-b border-[#222]">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] uppercase font-bold text-gray-500">Speed</label>
              <span className="text-[10px] text-gray-400">{(clips[contextMenu.clipIds[0]]?.speed || 1).toFixed(2)}x</span>
            </div>
            <input 
              type="range" 
              min="0.25" max="4" step="0.05" 
              value={clips[contextMenu.clipIds[0]]?.speed || 1}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                contextMenu.clipIds.forEach(id => updateClip(id, { speed: val }));
              }}
              className="w-full h-1 bg-[#333] rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div className="h-px bg-[#222] my-1" />
          
          <button onClick={() => handleAction('delete')} className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-red-500/20 text-red-400 rounded transition-colors">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}
    </div>
  );
}
