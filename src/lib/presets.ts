// @ts-nocheck
import { TrackType, SynthType } from '../types/daw';

export interface PresetClip {
  startTime: number; // in 16ths
  duration: number; // in 16ths
  audioUrl?: string;
  notes?: { note: string; startTime: number; duration: string; velocity: number }[];
}

export interface PresetTrackDef {
  name: string;
  type: TrackType;
  synthType?: SynthType;
  volume?: number;
  clips: PresetClip[];
}

export interface GenrePreset {
  id: string;
  name: string;
  genre: string;
  bpm: number;
  previewUrl?: string;
  tracks: PresetTrackDef[];
}

// Helper to generate some standard drum patterns
const generateFourOnTheFloor = (bars: number = 4) => {
  const notes = [];
  for (let i = 0; i < bars * 16; i += 4) {
    notes.push({ note: "C2", startTime: i, duration: "8n", velocity: 0.9 }); // Kick
    if (i % 8 !== 0) {
      notes.push({ note: "E2", startTime: i, duration: "8n", velocity: 0.8 }); // Snare on 2 and 4
    }
  }
  for (let i = 0; i < bars * 16; i += 2) {
    notes.push({ note: "F#2", startTime: i, duration: "16n", velocity: 0.6 }); // Hi-hat
  }
  return notes;
};

const generateAfrobeatDrums = (bars: number = 4) => {
  const notes = [];
  for (let b = 0; b < bars; b++) {
    const offset = b * 16;
    // Kick
    notes.push({ note: "C2", startTime: offset + 0, duration: "8n", velocity: 0.9 });
    notes.push({ note: "C2", startTime: offset + 5, duration: "8n", velocity: 0.8 });
    notes.push({ note: "C2", startTime: offset + 8, duration: "8n", velocity: 0.9 });
    notes.push({ note: "C2", startTime: offset + 13, duration: "8n", velocity: 0.8 });
    // Snare / Rim
    notes.push({ note: "D2", startTime: offset + 4, duration: "8n", velocity: 0.9 });
    notes.push({ note: "D2", startTime: offset + 12, duration: "8n", velocity: 0.9 });
    // Shaker / Hats
    for(let i=0; i<16; i+=2) {
      notes.push({ note: "F#2", startTime: offset + i, duration: "16n", velocity: i % 4 === 0 ? 0.7 : 0.4 });
    }
  }
  return notes;
};

const generateAmapianoDrums = (bars: number = 4) => {
    const notes = [];
    for (let b = 0; b < bars; b++) {
      const offset = b * 16;
      // Kick - Shaker heavy pattern, log drum
      notes.push({ note: "C2", startTime: offset + 0, duration: "8n", velocity: 0.9 });
      notes.push({ note: "C2", startTime: offset + 4, duration: "8n", velocity: 0.9 });
      notes.push({ note: "C2", startTime: offset + 8, duration: "8n", velocity: 0.9 });
      notes.push({ note: "C2", startTime: offset + 12, duration: "8n", velocity: 0.9 });
      // Percussion
      notes.push({ note: "D#2", startTime: offset + 2, duration: "16n", velocity: 0.8 });
      notes.push({ note: "D#2", startTime: offset + 7, duration: "16n", velocity: 0.8 });
      notes.push({ note: "D#2", startTime: offset + 10, duration: "16n", velocity: 0.8 });
      notes.push({ note: "D#2", startTime: offset + 15, duration: "16n", velocity: 0.8 });
    }
    return notes;
};

const generateChords = (chordProgression: string[][], bars: number = 4) => {
  const notes: any[] = [];
  const chordsLen = chordProgression.length;
  for (let b = 0; b < bars; b++) {
    const offset = b * 16;
    const chord = chordProgression[b % chordsLen];
    chord.forEach(n => {
      notes.push({ note: n, startTime: offset, duration: "1m", velocity: 0.6 });
    });
  }
  return notes;
};

export const PRESETS: GenrePreset[] = [
  {
    id: "afrobeat_1",
    name: "Afrobeat Groover",
    genre: "Afrobeat",
    bpm: 105,
    previewUrl: "https://tonejs.github.io/audio/drum-samples/breakbeat.mp3",
    tracks: [
      {
        name: "Drums",
        type: "midi",
        synthType: "membrane",
        volume: -2,
        clips: [
          { startTime: 0, duration: 64, notes: generateAfrobeatDrums(4) }
        ]
      },
      {
        name: "Keys",
        type: "midi",
        synthType: "poly",
        volume: -6,
        clips: [
          { startTime: 0, duration: 64, notes: generateChords([["D#3", "G3", "A#3"], ["C3", "D#3", "G3"], ["G#2", "C3", "D#3"], ["A#2", "D3", "F3"]], 4) }
        ]
      },
      {
        name: "Pluck Bass",
        type: "midi",
        synthType: "pluck",
        volume: -4,
        clips: [
          { 
            startTime: 0, 
            duration: 64, 
            notes: [
              {note:"D#2", startTime:0, duration:"8n", velocity:0.8}, {note:"D#2", startTime:3, duration:"8n", velocity:0.8},
              {note:"C2", startTime:16, duration:"8n", velocity:0.8}, {note:"C2", startTime:19, duration:"8n", velocity:0.8},
              {note:"G#1", startTime:32, duration:"8n", velocity:0.8}, {note:"G#1", startTime:35, duration:"8n", velocity:0.8},
              {note:"A#1", startTime:48, duration:"8n", velocity:0.8}, {note:"A#1", startTime:51, duration:"8n", velocity:0.8},
            ]
          }
        ]
      }
    ]
  },
  {
    id: "amapiano_1",
    name: "Amapiano Vibes",
    genre: "Amapiano",
    bpm: 112,
    previewUrl: "https://tonejs.github.io/audio/drum-samples/breakbeat.mp3",
    tracks: [
      {
        name: "Drums & Shakers",
        type: "midi",
        synthType: "membrane",
        volume: -1,
        clips: [
          { startTime: 0, duration: 64, notes: generateAmapianoDrums(4) }
        ]
      },
      {
        name: "Log Drum (Bass)",
        type: "midi",
        synthType: "fm",
        volume: 2,
        clips: [
          { startTime: 0, duration: 64, notes: [
            {note: "C2", startTime: 12, duration: "8n", velocity: 0.9},
            {note: "C2", startTime: 14, duration: "8n", velocity: 0.9},
            {note: "G1", startTime: 28, duration: "8n", velocity: 0.9},
            {note: "G1", startTime: 30, duration: "8n", velocity: 0.9},
            {note: "A#1", startTime: 44, duration: "8n", velocity: 0.9},
            {note: "A#1", startTime: 46, duration: "8n", velocity: 0.9},
            {note: "F1", startTime: 60, duration: "8n", velocity: 0.9},
            {note: "F1", startTime: 62, duration: "8n", velocity: 0.9},
          ] }
        ]
      },
      {
        name: "Pad Chords",
        type: "midi",
        synthType: "poly",
        volume: -8,
        clips: [
          { startTime: 0, duration: 64, notes: generateChords([["C3", "E3", "G3"], ["G2", "B2", "D3"], ["A2", "C3", "E3"], ["F2", "A2", "C3"]], 4) }
        ]
      }
    ]
  },
  {
    id: "trap_1",
    name: "Dark Trap",
    genre: "Trap",
    bpm: 140,
    previewUrl: "https://tonejs.github.io/audio/drum-samples/breakbeat.mp3",
    tracks: [
      {
        name: "Trap Drums",
        type: "midi",
        synthType: "membrane",
        volume: -2,
        clips: [
          { startTime: 0, duration: 64, notes: [
            {note:"C2", startTime:0, duration:"8n", velocity:1}, {note:"E2", startTime:8, duration:"8n", velocity:1},
            {note:"C2", startTime:18, duration:"8n", velocity:1}, {note:"E2", startTime:24, duration:"8n", velocity:1},
            {note:"C2", startTime:32, duration:"8n", velocity:1}, {note:"E2", startTime:40, duration:"8n", velocity:1},
            {note:"C2", startTime:50, duration:"8n", velocity:1}, {note:"E2", startTime:56, duration:"8n", velocity:1},
            // Fast hats
            ...Array.from({length:32}).map((_, i) => ({note:"F#2", startTime:i*2, duration:"16n", velocity:0.6}))
          ] }
        ]
      },
      {
        name: "808 Bass",
        type: "midi",
        synthType: "fm",
        volume: 0,
        clips: [
          { startTime: 0, duration: 64, notes: [
            {note:"C1", startTime:0, duration:"2n", velocity:1},
            {note:"D#1", startTime:18, duration:"4n", velocity:1},
            {note:"G1", startTime:32, duration:"2n", velocity:1},
            {note:"F1", startTime:50, duration:"4n", velocity:1},
          ] }
        ]
      },
      {
        name: "Pluck Melody",
        type: "midi",
        synthType: "pluck",
        volume: -6,
        clips: [
           { startTime:0, duration:64, notes:[
             {note:"C4", startTime:0, duration:"8n", velocity:0.8}, {note:"G4", startTime:3, duration:"8n", velocity:0.6},
             {note:"D#4", startTime:6, duration:"8n", velocity:0.8}, {note:"C4", startTime:9, duration:"8n", velocity:0.6},
             {note:"G3", startTime:12, duration:"8n", velocity:0.7},

             {note:"C4", startTime:32, duration:"8n", velocity:0.8}, {note:"G4", startTime:35, duration:"8n", velocity:0.6},
             {note:"F4", startTime:38, duration:"8n", velocity:0.8}, {note:"D#4", startTime:41, duration:"8n", velocity:0.6},
             {note:"C4", startTime:44, duration:"8n", velocity:0.7},
           ]}
        ]
      }
    ]
  },
  {
    id: "rnb_1",
    name: "Smooth R&B",
    genre: "R&B",
    bpm: 85,
    previewUrl: "https://tonejs.github.io/audio/casio/C2.mp3",
    tracks: [
      {
        name: "R&B Kit",
        type: "midi",
        synthType: "membrane",
        volume: -4,
        clips: [
          { startTime: 0, duration: 64, notes: [
             {note:"C2", startTime:0, duration:"8n", velocity:0.8}, {note:"D2", startTime:8, duration:"8n", velocity:0.9},
             {note:"C2", startTime:20, duration:"8n", velocity:0.8}, {note:"D2", startTime:24, duration:"8n", velocity:0.9},
             {note:"C2", startTime:32, duration:"8n", velocity:0.8}, {note:"D2", startTime:40, duration:"8n", velocity:0.9},
             {note:"C2", startTime:52, duration:"8n", velocity:0.8}, {note:"D2", startTime:56, duration:"8n", velocity:0.9},
             ...Array.from({length:16}).map((_, i) => ({note:"F#2", startTime:i*4, duration:"8n", velocity:0.5}))
          ] }
        ]
      },
      {
        name: "EP Chords",
        type: "midi",
        synthType: "poly",
        volume: -2,
        clips: [
          { startTime: 0, duration: 64, notes: generateChords([["F3", "A3", "C4", "E4"], ["E3", "G3", "B3", "D4"], ["D3", "F3", "A3", "C4"], ["G2", "B2", "D3", "F3"]], 4) }
        ]
      },
      {
        name: "Bass",
        type: "midi",
        synthType: "fm",
        volume: 0,
        clips: [
          { startTime: 0, duration: 64, notes: [
             {note:"F1", startTime:0, duration:"2n", velocity:0.8},
             {note:"E1", startTime:16, duration:"2n", velocity:0.8},
             {note:"D1", startTime:32, duration:"2n", velocity:0.8},
             {note:"G0", startTime:48, duration:"2n", velocity:0.8},
          ] }
        ]
      }
    ]
  },
  {
    id: "uk_pop_1",
    name: "UK Pop Drive",
    genre: "UK Pop",
    bpm: 124,
    previewUrl: "https://tonejs.github.io/audio/casio/A1.mp3",
    tracks: [
       {
        name: "House Drums",
        type: "midi",
        synthType: "membrane",
        volume: -2,
        clips: [
          { startTime: 0, duration: 64, notes: generateFourOnTheFloor(4) }
        ]
      },
      {
        name: "Pluck Bass",
        type: "midi",
        synthType: "pluck",
        volume: 0,
        clips: [
          { startTime: 0, duration: 64, notes: [
             {note:"A1", startTime:2, duration:"8n", velocity:0.9}, {note:"A1", startTime:6, duration:"8n", velocity:0.9},
             {note:"A1", startTime:10, duration:"8n", velocity:0.9}, {note:"A1", startTime:14, duration:"8n", velocity:0.9},
             {note:"F1", startTime:18, duration:"8n", velocity:0.9}, {note:"F1", startTime:22, duration:"8n", velocity:0.9},
             {note:"F1", startTime:26, duration:"8n", velocity:0.9}, {note:"F1", startTime:30, duration:"8n", velocity:0.9},
             {note:"C2", startTime:34, duration:"8n", velocity:0.9}, {note:"C2", startTime:38, duration:"8n", velocity:0.9},
             {note:"C2", startTime:42, duration:"8n", velocity:0.9}, {note:"C2", startTime:46, duration:"8n", velocity:0.9},
             {note:"G1", startTime:50, duration:"8n", velocity:0.9}, {note:"G1", startTime:54, duration:"8n", velocity:0.9},
             {note:"G1", startTime:58, duration:"8n", velocity:0.9}, {note:"G1", startTime:62, duration:"8n", velocity:0.9},
          ] }
        ]
      },
      {
        name: "Synth Chords",
        type: "midi",
        synthType: "poly",
        volume: -6,
        clips: [
          { startTime: 0, duration: 64, notes: generateChords([["A3", "C4", "E4"], ["F3", "A3", "C4"], ["C4", "E4", "G4"], ["G3", "B3", "D4"]], 4) }
        ]
      }
    ]
  }
];