// @ts-nocheck
import { create } from 'zustand';
import { temporal } from 'zundo';
import { DawTrack, DawClip, SynthType, TrackType, AppTab, MusicStyle, TrackFX } from '../types/daw';
import { timelineEvents } from '../utils/timelineEvents';

type PlaybackState = 'stopped' | 'playing' | 'paused';

interface DawState {
  bpm: number;
  timelineZoom: number; // 1 = 100%, multiplies pixel-per-16th on rulers/rolls
  playbackState: PlaybackState;
  tracks: DawTrack[];
  clips: Record<string, DawClip>;
  selectedTrackId: string | null;
  selectedClipId: string | null;
  transportPosition: number; // in 16th notes
  currentTab: AppTab;
  isRecording: boolean;
  recordingStart16ths: number | null;
  recordingCountdown: number | null;
  isTrackListOpen: boolean;
  currentProjectId: string | null;
  currentProjectName: string | null;
  projectKey: string;
  projectScale: string;
  
  midiDevices: { id: string; name: string }[];
  audioInputs: { id: string; name: string }[];
  audioOutputs: { id: string; name: string }[];
  selectedAudioInputId: string | null;
  selectedAudioOutputId: string | null;
  
  metronomeEnabled: boolean;
  autoQuantize: boolean;
  autotuneEnabled: boolean;
  quantizeStrength: number;
  silenceThreshold: number;
  setSilenceThreshold: (val: number) => void;
  inputMonitoring: boolean;
  setInputMonitoring: (enabled: boolean) => void;
  
  chatMessages: { role: 'user' | 'assistant'; content: string }[];
  
  // Actions
  setMidiDevices: (devices: { id: string; name: string }[]) => void;
  setAudioInputs: (inputs: { id: string; name: string }[]) => void;
  setAudioOutputs: (outputs: { id: string; name: string }[]) => void;
  setSelectedAudioInputId: (id: string | null) => void;
  setSelectedAudioOutputId: (id: string | null) => void;
  setBpm: (bpm: number) => void;
  setTimelineZoom: (z: number) => void;
  setProjectKey: (key: string) => void;
  setProjectScale: (scale: string) => void;
  setMetronomeEnabled: (enabled: boolean) => void;
  setAutoQuantize: (enabled: boolean) => void;
  setAutotuneEnabled: (enabled: boolean) => void;
  setPlaybackState: (state: PlaybackState) => void;
  setTransportPosition: (pos: number) => void;
  setCurrentTab: (tab: AppTab) => void;
  setIsRecording: (recording: boolean, start16ths?: number) => void;
  setRecordingCountdown: (count: number | null) => void;
  setIsTrackListOpen: (open: boolean) => void;
  setCurrentProject: (id: string | null, name: string | null) => void;
  
  addTrack: (type?: TrackType, synthType?: SynthType) => void;
  updateTrack: (id: string, updates: Partial<DawTrack>) => void;
  deleteTrack: (id: string) => void;
  selectTrack: (id: string | null) => void;
  
  addClip: (trackId: string, startTime: number, audioUrl?: string, recordingPeaks?: number[], duration?: number, originalBpm?: number, audioOffset?: number) => string;
  updateClip: (id: string, updates: Partial<DawClip>) => void;
  deleteClip: (id: string) => void;
  selectClip: (id: string | null) => void;
  
  // Professional clip features
  markedClipIds: string[];
  toggleMarkClip: (id: string) => void;
  clearMarkedClips: () => void;
  markAllClips: () => void;
  duplicateClip: (id: string) => void;
  splitClip: (id: string, splitPosition: number) => void;
  clipboardClips: DawClip[] | null;
  copyClips: (ids: string[]) => void;
  pasteClips: (trackId: string, startTime: number) => void;
  
  addNote: (clipId: string, note: string, startTime: number, duration: number, isGhost?: boolean) => void;
  updateNote: (clipId: string, noteId: string, updates: Partial<any>) => void;
  deleteNote: (clipId: string, noteId: string) => void;
  quantizeClipNotes: (clipId: string, gridSize: number) => void;
  humanizeClipNotes: (clipId: string, timingAmount?: number, velocityAmount?: number) => void;
  addChatMessage: (message: { role: 'user' | 'assistant'; content: string }) => void;
  clearChat: () => void;
  masterVolume: number;
  setMasterVolume: (volume: number) => void;
  purchasedPlugins: string[];
  purchasePlugin: (pluginId: string) => void;
  isAiProducing: boolean;
  isComputePaused: boolean;
  setIsComputePaused: (paused: boolean) => void;
  aiStepMessage: string;
  aiStepProgress: number;
  aiActivePulseTrackId: string | null;
  setIsAiProducing: (producing: boolean, message?: string, progress?: number, activePulseTrackId?: string | null) => void;
  isExporting: boolean;
  exportProgress: number;
  exportPhase: string;
  exportFormat: string;
  exportTitle: string;
  exportType: string;
  isExportCancelled: boolean;
  exportSecondsRemaining: number;
  setIsExporting: (exporting: boolean, progress?: number, phase?: string, secondsRemaining?: number) => void;
  setExportProgressConfig: (title: string, format: string, type: string) => void;
  cancelExport: () => void;
  isExportModalOpen: boolean;
  setIsExportModalOpen: (open: boolean) => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  aiPreviewAutoCommit: boolean;
  setAiPreviewAutoCommit: (val: boolean) => void;
  activeStyle: MusicStyle;
  setActiveStyle: (style: MusicStyle) => void;
  sliderA: number;
  sliderB: number;
  setSliderA: (val: number) => void;
  setSliderB: (val: number) => void;
  songStructure: any;
  setSongStructure: (structure: any) => void;
  autoDetectDrops: boolean;
  setAutoDetectDrops: (enabled: boolean) => void;
  audioEditMode: Record<string, 'vocal' | 'piano'>;
  setAudioEditMode: (clipId: string, mode: 'vocal' | 'piano') => void;
  swingAmount: number;
  setSwingAmount: (val: number) => void;
  globalEffectsMode: 'web' | 'native';
  setGlobalEffectsMode: (mode: 'web' | 'native') => void;
  deviceControlPermission: 'denied' | 'prompt' | 'granted';
  setDeviceControlPermission: (perm: 'denied' | 'prompt' | 'granted') => void;
  deviceControlEnabled: boolean;
  setDeviceControlEnabled: (enabled: boolean) => void;
  isFloatingBallActive: boolean;
  setIsFloatingBallActive: (active: boolean) => void;
  speakingModeEnabled: boolean;
  setSpeakingModeEnabled: (enabled: boolean) => void;
  selectedLanguage: string;
  setSelectedLanguage: (lang: string) => void;
  accessibilityPermissionGranted: boolean;
  setAccessibilityPermissionGranted: (val: boolean) => void;
  inputSimulationGranted: boolean;
  setInputSimulationGranted: (val: boolean) => void;
  screenOCRGranted: boolean;
  setScreenOCRGranted: (val: boolean) => void;
  backgroundDaemonGranted: boolean;
  setBackgroundDaemonGranted: (val: boolean) => void;
  shellBindingGranted: boolean;
  setShellBindingGranted: (val: boolean) => void;
}

const DEFAULT_TRACK_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

export const getFxDefaults = (): TrackFX => ({
  eq: { enabled: false, high: 0, mid: 0, low: 0 },
  reverb: { enabled: false, decay: 1.5, mix: 0.3 },
  delay: { enabled: false, time: '8n', feedback: 0.3, mix: 0.2 },
  pitchShift: { enabled: false, pitch: 0 },
  compressor: { enabled: false, threshold: -24, ratio: 12 },
  chorus: { enabled: false, depth: 0.5, frequency: 1.5, delayTime: 2.5, wet: 0.5 },
  pitchCorrection: { enabled: false, amount: 100, speed: 100, scale: "Minor" },
  distortion: { enabled: false, amount: 0.4, wet: 0 },
  phaser: { enabled: false, frequency: 1.5, depth: 0.5, wet: 0 },
  tremolo: { enabled: false, frequency: 5, depth: 0.5, wet: 0 },
  gate: { enabled: false, threshold: -40, wet: 0 },
  highpass: { enabled: false, frequency: 200, Q: 1 },
  lowpass: { enabled: false, frequency: 2000, Q: 1 },
  bandpass: { enabled: false, frequency: 1000, Q: 1 },
  bitcrusher: { enabled: false, bits: 8, wet: 0 },
  pingPongDelay: { enabled: false, time: '4n', feedback: 0.3, wet: 0 },
  stereoWidener: { enabled: false, width: 0.5, wet: 0 },
  flanger: { enabled: false, feedback: 0.5, delayTime: 0.005, wet: 0 },
  vocalTunePro: { enabled: false, amount: 80, speed: 80, humanize: 20, scale: "Chromatic" },
  voicePitcher: { enabled: false, shift: 0, formant: 5, wet: 0 },
  graphicEQ: { enabled: false, band1: 0, band2: 0, band3: 0, band4: 0, band5: 0, band6: 0, band7: 0, band8: 0, band9: 0, band10: 0 },
  sidechain: { enabled: false, ratio: 4, threshold: -20, release: 0.1 },
  timeShaper: { enabled: false, mode: 'off', mix: 1.0, curve: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
  peakController: { enabled: false, sourceTrackId: '', targetParam: 'none', depth: 0.5 },
});

const initialTrack: DawTrack = {
  id: 'track_1',
  name: 'Lead Synth',
  type: 'midi',
  color: DEFAULT_TRACK_COLORS[0],
  volume: -10,
  pan: 0,
  muted: false,
  soloed: false,
  synthType: 'poly',
  fx: getFxDefaults(),
  clips: ['clip_1'],
  midiChannel: 1,
  midiInputId: 'all',
  audioInputId: 'default',
  armed: false,
  portamento: 0
};

const initialClip: DawClip = {
  id: 'clip_1',
  trackId: 'track_1',
  startTime: 0,
  duration: 32,
  notes: [
    { id: 'n1', note: 'C4', startTime: 0, duration: 4, velocity: 0.8 },
    { id: 'n2', note: 'D4', startTime: 4, duration: 4, velocity: 0.8 },
    { id: 'n3', note: 'E4', startTime: 8, duration: 4, velocity: 0.8 },
    { id: 'n4', note: 'F4', startTime: 12, duration: 4, velocity: 0.8 },
    { id: 'n5', note: 'G4', startTime: 16, duration: 8, velocity: 0.8 },
  ]
};

export const useDawStore = create<DawState>()(temporal((set, get) => ({
  bpm: 120,
  timelineZoom: 1,
  playbackState: 'stopped',
  tracks: [initialTrack],
  clips: { 'clip_1': initialClip },
  selectedTrackId: 'track_1',
  selectedClipId: null,
  transportPosition: 0,
  currentTab: 'timeline',
  isRecording: false,
  recordingStart16ths: null,
  recordingCountdown: null,
  isTrackListOpen: false,
  currentProjectId: null,
  currentProjectName: null,
  projectKey: 'C',
  projectScale: 'Chromatic',
  midiDevices: [],
  audioInputs: [],
  audioOutputs: [],
  selectedAudioInputId: null,
  selectedAudioOutputId: null,
  metronomeEnabled: false,
  autoQuantize: true,
  autotuneEnabled: false,
  quantizeStrength: 100,
  silenceThreshold: 0.008,
  setSilenceThreshold: (val) => set({ silenceThreshold: val }),
  inputMonitoring: false,
  setInputMonitoring: (enabled) => set({ inputMonitoring: enabled }),
  markedClipIds: [],
  clipboardClips: null,
  chatMessages: [{ role: 'assistant', content: 'Hey! I\'m your AI production assistant. How can I help you with your project today?' }],
  masterVolume: 0,
  setMasterVolume: (volume) => set({ masterVolume: volume }),
  purchasedPlugins: [],
  purchasePlugin: (pluginId) => set((state) => {
    if (state.purchasedPlugins.includes(pluginId)) return {};
    return { purchasedPlugins: [...state.purchasedPlugins, pluginId] };
  }),
  isAiProducing: false,
  isComputePaused: false,
  setIsComputePaused: (paused) => set({ isComputePaused: paused }),
  aiStepMessage: '',
  aiStepProgress: 0,
  aiActivePulseTrackId: null,
  setIsAiProducing: (producing, message = '', progress = 0, activePulseTrackId = null) => set({
    isAiProducing: producing,
    aiStepMessage: message,
    aiStepProgress: progress,
    aiActivePulseTrackId: activePulseTrackId
  }),
  isExporting: false,
  exportProgress: 0,
  exportPhase: '',
  exportFormat: 'wav',
  exportTitle: 'mixdown',
  exportType: 'master',
  isExportCancelled: false,
  exportSecondsRemaining: 0,
  setIsExporting: (exporting, progress = 0, phase = '', secondsRemaining = 0) => set({
    isExporting: exporting,
    exportProgress: progress,
    exportPhase: phase,
    exportSecondsRemaining: secondsRemaining
  }),
  setExportProgressConfig: (title, format, type) => set({
    exportTitle: title,
    exportFormat: format,
    exportType: type,
    isExportCancelled: false
  }),
  cancelExport: () => set({
    isExportCancelled: true,
    isExporting: false,
    exportProgress: 0,
    exportPhase: '',
    exportSecondsRemaining: 0
  }),
  isExportModalOpen: false,
  setIsExportModalOpen: (open) => set({ isExportModalOpen: open }),
  isChatOpen: true,
  setIsChatOpen: (open) => set({ isChatOpen: open }),
  aiPreviewAutoCommit: true,
  setAiPreviewAutoCommit: (val) => set({ aiPreviewAutoCommit: val }),
  activeStyle: MusicStyle.AFROBEATS,
  setActiveStyle: (style) => set({ activeStyle: style }),
  sliderA: 0.5,
  sliderB: 0.0,
  setSliderA: (sliderA) => set({ sliderA }),
  setSliderB: (sliderB) => set({ sliderB }),
  songStructure: {
    sections: [
      { id: 'sec_intro', name: 'Intro Vibe', type: 'INTRO', startBar: 0, lengthBars: 4 },
      { id: 'sec_verse', name: 'Vocal Verse', type: 'VERSE', startBar: 4, lengthBars: 8 },
      { id: 'sec_prechorus', name: 'Tension Rise Build', type: 'PRE_CHORUS', startBar: 12, lengthBars: 4 },
      { id: 'sec_chorus', name: 'Chorus DROP!', type: 'CHORUS', startBar: 16, lengthBars: 8 },
      { id: 'sec_bridge', name: 'Breakdown Bridge', type: 'BRIDGE', startBar: 24, lengthBars: 8 },
      { id: 'sec_outro', name: 'Heavy Outro Out', type: 'OUTRO', startBar: 32, lengthBars: 4 },
    ]
  },
  setSongStructure: (structure) => set({ songStructure: structure }),
  autoDetectDrops: true,
  setAutoDetectDrops: (enabled) => set({ autoDetectDrops: enabled }),
  audioEditMode: {},
  setAudioEditMode: (clipId, mode) => set((state) => ({
    audioEditMode: {
      ...state.audioEditMode,
      [clipId]: mode,
    },
  })),
  swingAmount: 0,
  setSwingAmount: (val) => set({ swingAmount: val }),
  globalEffectsMode: 'web',
  setGlobalEffectsMode: (mode) => set((state) => {
    const updatedTracks = state.tracks.map((t) => ({ ...t, effectsMode: mode }));
    return { globalEffectsMode: mode, tracks: updatedTracks };
  }),
  deviceControlPermission: 'prompt',
  setDeviceControlPermission: (perm) => set({ deviceControlPermission: perm }),
  deviceControlEnabled: false,
  setDeviceControlEnabled: (enabled) => set({ deviceControlEnabled: enabled }),
  isFloatingBallActive: false,
  setIsFloatingBallActive: (active) => set({ isFloatingBallActive: active }),
  speakingModeEnabled: false,
  setSpeakingModeEnabled: (enabled) => set({ speakingModeEnabled: enabled }),
  selectedLanguage: 'en-US',
  setSelectedLanguage: (lang) => set({ selectedLanguage: lang }),
  accessibilityPermissionGranted: true,
  setAccessibilityPermissionGranted: (val) => set({ accessibilityPermissionGranted: val }),
  inputSimulationGranted: true,
  setInputSimulationGranted: (val) => set({ inputSimulationGranted: val }),
  screenOCRGranted: true,
  setScreenOCRGranted: (val) => set({ screenOCRGranted: val }),
  backgroundDaemonGranted: false,
  setBackgroundDaemonGranted: (val) => set({ backgroundDaemonGranted: val }),
  shellBindingGranted: false,
  setShellBindingGranted: (val) => set({ shellBindingGranted: val }),

  setBpm: (bpm) => set({ bpm: typeof bpm === 'string' ? parseFloat(bpm) || 120 : bpm }),
  setTimelineZoom: (z) => set({ timelineZoom: Math.max(0.25, Math.min(4, z)) }),
  setProjectKey: (key) => set({ projectKey: key }),
  setProjectScale: (scale) => set({ projectScale: scale }),
  setMetronomeEnabled: (enabled) => set({ metronomeEnabled: enabled }),
  setAutoQuantize: (enabled) => set({ autoQuantize: enabled }),
  setAutotuneEnabled: (enabled) => set({ autotuneEnabled: enabled }),
  setPlaybackState: (state) => set({ playbackState: state }),
  setTransportPosition: (pos) => {
    set({ transportPosition: pos });
    try {
      const state = get();
      import('../utils/vibeEngine').then(({ getFinalVibe, runAutoDropBuilderTick }) => {
        const vibe = getFinalVibe(state.sliderA, state.sliderB);
        runAutoDropBuilderTick(pos, vibe, state.songStructure);
      });
    } catch (_) {}
  },
  setCurrentTab: (tab) => set({ currentTab: tab }),
  setIsRecording: (recording, start16ths = null) => set({ isRecording: recording, recordingStart16ths: start16ths }),
  setRecordingCountdown: (count) => set({ recordingCountdown: count }),
  setIsTrackListOpen: (open) => set({ isTrackListOpen: open }),
  setCurrentProject: (id, name) => set({ currentProjectId: id, currentProjectName: name }),

  setMidiDevices: (devices) => set({ midiDevices: devices }),
  setAudioInputs: (inputs) => set({ audioInputs: inputs }),
  setAudioOutputs: (outputs) => set({ audioOutputs: outputs }),
  setSelectedAudioInputId: (id) => set({ selectedAudioInputId: id }),
  setSelectedAudioOutputId: (id) => set({ selectedAudioOutputId: id }),

  addTrack: (type = 'midi', synthType = 'poly') => set((state) => {
    const id = `track_${Date.now()}`;
    const name = type === 'group' 
      ? `Group Bus ${state.tracks.filter(p => p.type === 'group').length + 1}`
      : `Track ${state.tracks.length + 1}`;
    const newTrack: DawTrack = {
      id,
      name,
      type,
      color: DEFAULT_TRACK_COLORS[state.tracks.length % DEFAULT_TRACK_COLORS.length],
      volume: type === 'group' ? 0 : (type === 'audio' ? 3 : -10),
      pan: 0,
      muted: false,
      soloed: false,
      synthType,
      fx: getFxDefaults(),
      clips: [],
      effectsMode: state.globalEffectsMode || 'web',
      midiChannel: 1,
      midiInputId: 'all',
      audioInputId: 'default',
      armed: false,
      portamento: 0
    };
    return { tracks: [...state.tracks, newTrack], selectedTrackId: id };
  }),

  updateTrack: (id, updates) => set((state) => ({
    tracks: state.tracks.map((t) => t.id === id ? { ...t, ...updates } : t)
  })),

  deleteTrack: (id) => set((state) => {
    const track = state.tracks.find(t => t.id === id);
    let newClips = { ...state.clips };
    if (track) {
      track.clips.forEach(clipId => {
        delete newClips[clipId];
      });
    }
    // Clear groupId for tracks routed to this group track
    const updatedTracks = state.tracks
      .filter(t => t.id !== id)
      .map(t => t.groupId === id ? { ...t, groupId: undefined } : t);
    return {
      tracks: updatedTracks,
      clips: newClips,
      selectedTrackId: state.selectedTrackId === id ? null : state.selectedTrackId,
      selectedClipId: state.clips[state.selectedClipId || '']?.trackId === id ? null : state.selectedClipId
    };
  }),

  selectTrack: (id) => set({ selectedTrackId: id }),

  addClip: (trackId, startTime, audioUrl, recordingPeaks, duration, originalBpm, audioOffset) => {
    const id = `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    set((state) => {
      const newClip: DawClip = {
        id,
        trackId,
        startTime,
        duration: duration || 32, // 2 bars roughly, will recalculate later for audio
        loopLength: duration || 32,
        notes: [],
        audioUrl,
        recordingPeaks,
        originalBpm,
        audioOffset,
      };
      
      const tracks = state.tracks.map(t => 
        t.id === trackId ? { ...t, clips: [...t.clips, id] } : t
      );
      
      return {
        clips: { ...state.clips, [id]: newClip },
        tracks,
        selectedClipId: id
      };
    });
    timelineEvents.emit({ type: 'AddClip', trackId, clipId: id, startTime, duration: duration || 32 });
    return id;
  },

  updateClip: (id, updates) => set((state) => {
    const oldClip = state.clips[id];
    if (!oldClip) return state;

    let newTracks = state.tracks;
    if (updates.trackId && updates.trackId !== oldClip.trackId) {
      newTracks = state.tracks.map(t => {
        if (t.id === oldClip.trackId) {
          return { ...t, clips: (t.clips || []).filter(cId => cId !== id) };
        }
        if (t.id === updates.trackId) {
          return { ...t, clips: [...(t.clips || []), id] };
        }
        return t;
      });
    }

    if (updates.startTime !== undefined) {
      timelineEvents.emit({ type: 'MoveClip', clipId: id, newStartTime: updates.startTime });
    }

    return {
      tracks: newTracks,
      clips: { ...state.clips, [id]: { ...oldClip, ...updates } }
    };
  }),

  deleteClip: (id) => set((state) => {
    const clip = state.clips[id];
    if (!clip) return state;
    
    timelineEvents.emit({ type: 'DeleteClip', clipId: id });

    const newClips = { ...state.clips };
    delete newClips[id];
    
    return {
      clips: newClips,
      tracks: state.tracks.map(t => t.id === clip.trackId ? { ...t, clips: (t.clips || []).filter(c => c !== id) } : t),
      selectedClipId: state.selectedClipId === id ? null : state.selectedClipId
    };
  }),

  selectClip: (id) => set({ selectedClipId: id }),

  toggleMarkClip: (id) => set((state) => {
    const isMarked = state.markedClipIds.includes(id);
    return {
      markedClipIds: isMarked 
        ? state.markedClipIds.filter(cid => cid !== id)
        : [...state.markedClipIds, id]
    };
  }),
  
  clearMarkedClips: () => set({ markedClipIds: [] }),
  markAllClips: () => set((state) => ({ markedClipIds: Object.keys(state.clips) })),
  
  duplicateClip: (id) => set((state) => {
    const clip = state.clips[id];
    if (!clip) return state;
    
    const newId = `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newClip = {
      ...clip,
      id: newId,
      startTime: clip.startTime + clip.duration
    };
    
    return {
      clips: { ...state.clips, [newId]: newClip },
      tracks: state.tracks.map(t => t.id === clip.trackId ? { ...t, clips: [...(t.clips || []), newId] } : t)
    };
  }),

  copyClips: (ids) => set((state) => {
    const copied = ids.map(id => {
      const clip = state.clips[id];
      if (!clip) return null;
      return JSON.parse(JSON.stringify(clip)) as DawClip;
    }).filter((c): c is DawClip => c !== null);
    
    return { clipboardClips: copied.length > 0 ? copied : null };
  }),

  pasteClips: (trackId, startTime) => set((state) => {
    const copied = state.clipboardClips;
    if (!copied || copied.length === 0) return state;
    
    const minStart = Math.min(...copied.map(c => c.startTime));
    
    const newClips = { ...state.clips };
    const newTrackClipsMap: Record<string, string[]> = {};
    
    copied.forEach(clip => {
      const newId = `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const relativeOffset = clip.startTime - minStart;
      const newClip: DawClip = {
        ...clip,
        id: newId,
        trackId,
        startTime: startTime + relativeOffset,
      };
      newClips[newId] = newClip;
      if (!newTrackClipsMap[trackId]) {
        newTrackClipsMap[trackId] = [];
      }
      newTrackClipsMap[trackId].push(newId);
    });
    
    const newTracks = state.tracks.map(t => {
      if (newTrackClipsMap[t.id]) {
        return {
          ...t,
          clips: [...(t.clips || []), ...newTrackClipsMap[t.id]]
        };
      }
      return t;
    });
    
    const lastPastedId = Object.keys(newClips).find(id => !state.clips[id]) || null;
    
    return {
      clips: newClips,
      tracks: newTracks,
      selectedClipId: lastPastedId
    };
  }),
  
  splitClip: (id, splitPosition) => set((state) => {
    const clip = state.clips[id];
    // Split must happen within the clip timeline relatively to start
    if (!clip || splitPosition <= clip.startTime || splitPosition >= clip.startTime + clip.duration) return state;
    
    const newId = `clip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const duration1 = splitPosition - clip.startTime;
    const duration2 = clip.duration - duration1;
    
    // Left notes: keep only those starting before split. Truncate if spanning across split.
    const leftNotes = (clip.notes || [])
      .filter(n => n.startTime < duration1)
      .map(n => ({
        ...n,
        duration: Math.min(n.duration, duration1 - n.startTime)
      }));

    // Right notes: keep those starting after or on split. Or spanning but we already truncated left side.
    // If a note spanned across, the right side should arguably get the remaining part.
    // Let's do that: if it starts before duration1 but ends after duration1, it gets a right side.
    const spanningRightNotes = (clip.notes || [])
      .filter(n => n.startTime < duration1 && n.startTime + n.duration > duration1)
      .map(n => ({
        ...n,
        startTime: 0,
        duration: (n.startTime + n.duration) - duration1
      }));

    const pureRightNotes = (clip.notes || [])
      .filter(n => n.startTime >= duration1)
      .map(n => ({
        ...n,
        startTime: n.startTime - duration1
      }));

    const rightNotes = [...spanningRightNotes, ...pureRightNotes];

    // Vocal Notes split (for audio vocal spoken words timing editing)
    const leftVocalNotes = (clip.vocalNotes || [])
      .filter(n => n.startTime < duration1)
      .map(n => ({
        ...n,
        duration: Math.min(n.duration, duration1 - n.startTime)
      }));

    const spanningRightVocal = (clip.vocalNotes || [])
      .filter(n => n.startTime < duration1 && n.startTime + n.duration > duration1)
      .map(n => ({
        ...n,
        startTime: 0,
        duration: (n.startTime + n.duration) - duration1
      }));

    const pureRightVocal = (clip.vocalNotes || [])
      .filter(n => n.startTime >= duration1)
      .map(n => ({
        ...n,
        startTime: n.startTime - duration1
      }));

    const rightVocalNotes = [...spanningRightVocal, ...pureRightVocal];

    // Split peaks proportionally so the waveform represents the visual sliced sections perfectly
    const peakLeftCount = Math.floor((duration1 / clip.duration) * (clip.recordingPeaks?.length || 0));
    const leftPeaks = clip.recordingPeaks ? clip.recordingPeaks.slice(0, peakLeftCount) : undefined;
    const rightPeaks = clip.recordingPeaks ? clip.recordingPeaks.slice(peakLeftCount) : undefined;
    
    const clip1 = { 
      ...clip, 
      duration: duration1, 
      notes: leftNotes, 
      vocalNotes: leftVocalNotes.length > 0 ? leftVocalNotes : undefined,
      recordingPeaks: leftPeaks
    };
    const clip2 = { 
      ...clip, 
      id: newId, 
      startTime: splitPosition, 
      duration: duration2, 
      notes: rightNotes,
      vocalNotes: rightVocalNotes.length > 0 ? rightVocalNotes : undefined,
      recordingPeaks: rightPeaks,
      audioOffset: (clip.audioOffset || 0) + duration1 
    };
    
    return {
      clips: { ...state.clips, [id]: clip1, [newId]: clip2 },
      tracks: state.tracks.map(t => t.id === clip.trackId ? { ...t, clips: [...(t.clips || []), newId] } : t)
    };
  }),

  addNote: (clipId, note, startTime, duration, isGhost) => set((state) => {
    const clip = state.clips[clipId];
    if (!clip) return state;
    
    const newNote = {
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      note,
      startTime,
      duration,
      velocity: 0.8,
      isGhost: !!isGhost
    };
    
    // Expand clip duration and loopLength if note ends after current clip scope
    const noteEnd = startTime + duration;
    const newDuration = Math.max(clip.duration, noteEnd);
    const newLoopLength = Math.max(clip.loopLength || clip.duration, noteEnd);
    
    return {
      clips: {
        ...state.clips,
        [clipId]: { 
          ...clip, 
          duration: newDuration, 
          loopLength: newLoopLength,
          notes: [...(clip.notes || []), newNote] 
        }
      }
    };
  }),

  updateNote: (clipId, noteId, updates) => set((state) => {
    const clip = state.clips[clipId];
    if (!clip) return state;
    
    let maxEnd = 0;
    const newNotes = (clip.notes || []).map(n => {
      if (n.id === noteId) {
        const updated = { ...n, ...updates };
        const end = updated.startTime + updated.duration;
        if (end > maxEnd) maxEnd = end;
        return updated;
      }
      return n;
    });

    return {
      clips: {
        ...state.clips,
        [clipId]: {
          ...clip,
          duration: Math.max(clip.duration, maxEnd),
          loopLength: Math.max(clip.loopLength || clip.duration, maxEnd),
          notes: newNotes
        }
      }
    };
  }),

  deleteNote: (clipId, noteId) => set((state) => {
    const clip = state.clips[clipId];
    if (!clip) return state;
    return {
      clips: {
        ...state.clips,
        [clipId]: { ...clip, notes: (clip.notes || []).filter(n => n.id !== noteId) }
      }
    };
  }),

  quantizeClipNotes: (clipId, gridSize) => set((state) => {
    const clip = state.clips[clipId];
    if (!clip || !gridSize) return state;
    
    const quantizedNotes = (clip.notes || []).map(note => ({
      ...note,
      startTime: Math.round(note.startTime / gridSize) * gridSize
    }));

    return {
      clips: {
        ...state.clips,
        [clipId]: { ...clip, notes: quantizedNotes }
      }
    };
  }),

  humanizeClipNotes: (clipId, timingAmount = 0.5, velocityAmount = 0.1) => set((state) => {
    const clip = state.clips[clipId];
    if (!clip) return state;

    const humanizedNotes = (clip.notes || []).map(note => {
      // Add small random variations to timing (-timingAmount to +timingAmount in 16ths)
      const timingVar = (Math.random() * 2 - 1) * timingAmount;
      let newStartTime = note.startTime + timingVar;
      if (newStartTime < 0) newStartTime = 0;

      // Add small random variations to velocity (-velocityAmount to +velocityAmount)
      const currentVel = note.velocity !== undefined ? note.velocity : 0.8;
      const velocityVar = (Math.random() * 2 - 1) * velocityAmount;
      let newVelocity = currentVel + velocityVar;
      if (newVelocity > 1) newVelocity = 1;
      if (newVelocity < 0.1) newVelocity = 0.1;

      return {
        ...note,
        startTime: newStartTime,
        velocity: newVelocity
      };
    });

    return {
      clips: {
        ...state.clips,
        [clipId]: { ...clip, notes: humanizedNotes }
      }
    };
  }),

  addChatMessage: (message) => set((state) => ({
    chatMessages: [...state.chatMessages, message]
  })),

  clearChat: () => set({ chatMessages: [] })
}), { partialize: (state) => ({ tracks: state.tracks, clips: state.clips, bpm: state.bpm, masterVolume: state.masterVolume, projectKey: state.projectKey, projectScale: state.projectScale, silenceThreshold: state.silenceThreshold, purchasedPlugins: state.purchasedPlugins, globalEffectsMode: state.globalEffectsMode, deviceControlPermission: state.deviceControlPermission, deviceControlEnabled: state.deviceControlEnabled, isFloatingBallActive: state.isFloatingBallActive, speakingModeEnabled: state.speakingModeEnabled, selectedLanguage: state.selectedLanguage, accessibilityPermissionGranted: state.accessibilityPermissionGranted, inputSimulationGranted: state.inputSimulationGranted, screenOCRGranted: state.screenOCRGranted, backgroundDaemonGranted: state.backgroundDaemonGranted, shellBindingGranted: state.shellBindingGranted }) }));
