export type NoteName = string; // e.g., "C4", "D#4"

export interface DawNote {
  id: string;
  note: NoteName;
  startTime: number; // in 16th notes
  duration: number; // in 16th notes
  velocity: number; // 0-1
  isRecording?: boolean; // True if the note is currently being recorded
  isGhost?: boolean; // AI ghost note preview pre-commit visual state
  isSlide?: boolean; // FL Studio style slide/glide pitch-bend note
  isStrummed?: boolean; // Marked as strummed note block
}

export type TrackType = 'midi' | 'audio' | 'group';

export interface VocalNote {
  id: string;
  startTime: number; // in 16th notes
  duration: number; // in 16th notes
  midi: number;
  noteName: string;
  cents: number;
  frequency: number;
  word?: string; // Optional word
  pitchCurve: number[]; // Array of midi values over time
  originalPitchCurve?: number[]; // Non-destructive original curve
  originalMidi: number;
  isSilence?: boolean;
  loudness?: number;
}

export interface DawClip {
  id: string;
  trackId: string;
  startTime: number; // in 16th notes relative to zero
  duration: number; // in 16th notes
  notes: DawNote[];
  isGhost?: boolean; // AI ghost preview pre-placement visual state
  vocalNotes?: VocalNote[]; // For audio clips that have been analyzed
  audioUrl?: string; // object URL for recorded or imported audio
  recordingPeaks?: number[]; // To stream volume amplitude for UI rendering while recording
  // Professional clip features:
  speed?: number; // playback speed
  originalBpm?: number; // Original BPM of the sample
  loopLength?: number; // Length to loop the contents (notes/audio) over, in 16ths.
  gain?: number; // clip gain in dB
  muted?: boolean; // is silent
  fadeIn?: number; // fade in duration
  fadeOut?: number; // fade out duration
  denoised?: boolean; // flag to indicate applying denoise
  audioOffset?: number; // offset into the audio source file in 16th notes
  notesRevision?: number; // incremented on every notes mutation — replaces JSON.stringify diff
}

export type SynthType = 'poly' | 'fm' | 'am' | 'membrane' | 'pluck' | 'flute' | 'epiano' | 'grand' | 'organ' | 'rhodes' | 'synthbass' | 'pad' | 'leadsynth' | 'strings' | 'brass' | 'bells';

export interface TrackFX {
  eq: { enabled: boolean; high: number; mid: number; low: number };
  reverb: { enabled: boolean; decay: number; mix: number };
  delay: { enabled: boolean; time: string; feedback: number; mix: number };
  pitchShift: { enabled: boolean; pitch: number }; // Used as proxy for AutoTune
  compressor: { enabled: boolean; threshold: number; ratio: number };
  chorus: { enabled: boolean; depth: number; frequency: number; delayTime: number; wet: number };
  pitchCorrection: { enabled: boolean; amount: number; speed: number; scale: string };
  distortion?: { enabled: boolean; amount: number; wet: number };
  phaser?: { enabled: boolean; frequency: number; depth: number; wet: number };
  tremolo?: { enabled: boolean; frequency: number; depth: number; wet: number };
  gate?: { enabled: boolean; threshold: number; wet: number };
  highpass?: { enabled: boolean; frequency: number; Q: number };
  lowpass?: { enabled: boolean; frequency: number; Q: number };
  bandpass?: { enabled: boolean; frequency: number; Q: number };
  bitcrusher?: { enabled: boolean; bits: number; wet: number };
  pingPongDelay?: { enabled: boolean; time: string; feedback: number; wet: number };
  stereoWidener?: { enabled: boolean; width: number; wet: number };
  flanger?: { enabled: boolean; feedback: number; delayTime: number; wet: number };
  vocalTunePro?: { enabled: boolean; amount: number; speed: number; humanize: number; scale: string };
  voicePitcher?: { enabled: boolean; shift: number; formant: number; wet: number };
  graphicEQ?: { enabled: boolean; band1: number; band2: number; band3: number; band4: number; band5: number; band6: number; band7: number; band8: number; band9: number; band10: number };
  sidechain?: { enabled: boolean; ratio: number; threshold: number; release: number };
  timeShaper?: { enabled: boolean; mode: 'off' | 'half' | 'gate' | 'reverse' | 'custom'; mix: number; curve?: number[] };
  peakController?: { enabled: boolean; sourceTrackId: string; targetParam: 'none' | 'lowpass' | 'reverb' | 'volume'; depth: number };
}

export interface DawTrack {
  id: string;
  name: string;
  type: TrackType;
  color: string;
  volume: number; // in decibels
  pan: number; // -1 to 1
  muted: boolean; // mute status
  soloed: boolean; // solo status
  synthType: SynthType;
  fx: TrackFX;
  clips: string[]; // clip IDs
  effectsMode?: 'web' | 'native'; // Audio process engine selection
  unlockedNativePremium?: boolean; // Premium hardware autotune licensing unlocked
  midiChannel?: number; // 0 for "All Channels", 1-16 for specific channel
  midiInputId?: string; // "all" or specific MIDI device ID
  audioInputId?: string; // specific audio input device ID or "default"
  armed?: boolean; // track recording armed flag
  collapsed?: boolean;
  groupId?: string; // Pointing to parent group track (for grouping/busses)
  automationEnabled?: boolean;
  automationType?: 'lowpass' | 'reverb' | 'volume';
  automationCurve?: number[]; // 16 values between 0.0 and 1.0 representing a 1-bar loop
  portamento?: number; // Slide glide time in seconds e.g. 0 to 1.5
}

export type AppTab = 'timeline' | 'chat' | 'mixer' | 'pianoroll' | 'drumpads' | 'fx' | 'samples';

export enum MusicStyle {
  AFROBEATS = 'AFROBEATS',
  AMAPIANO = 'AMAPIANO',
  TRAP = 'TRAP',
  POP = 'POP'
}

export interface StyleProfile {
  bpmRange: { min: number; max: number };
  drumPattern: string;
  swing: number;
  chordType: string;
  bassType: string;
  melodyType: string;
  fxStyle: string;
  mixProfile: string;
}


