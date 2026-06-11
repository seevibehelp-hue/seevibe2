// @ts-nocheck
import pitchfinder from 'pitchfinder';
import { DawClip } from '../types/daw';

const pitchFinderWorkerCode = `
importScripts('https://unpkg.com/pitchfinder@2.1.2/lib/pitchfinder.min.js');

self.onmessage = function(e) {
  // Not using worker yet, just a placeholder if we need it
}
`;

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
  originalMidi: number;
  isSilence?: boolean;
  loudness?: number;
}

export async function analyzeAudioPitch(audioBuffer: AudioBuffer, bpm: number, silenceThreshold: number = 0.008): Promise<VocalNote[]> {
  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0); // Mono analysis

  // Pitchfinder setup
  // Use YIN algorithm
  const detectPitch = pitchfinder.YIN({ sampleRate });

  const notes: VocalNote[] = [];
  
  // Frame size for analysis. e.g. 1024 samples = ~23ms at 44100
  const frameSize = 1024;
  const hopSize = 512;
  
  let currentNote: VocalNote | null = null;
  const minFrequency = 50; 
  const maxFrequency = 1000;
  
  // To avoid noise, we must only detect pitch when amplitude is above a threshold
  const getRms = (data: Float32Array) => {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
       sum += data[i] * data[i];
    }
    return Math.sqrt(sum / data.length);
  };

  const rmsthresh = silenceThreshold; // dynamic threshold
  let lastKnownMidi = 60; // default C4

  for (let i = 0; i < channelData.length - frameSize; i += hopSize) {
    if (i % (hopSize * 20) === 0) {
       await new Promise(r => setTimeout(r, 0));
    }
    const frame = channelData.slice(i, i + frameSize);
    const rms = getRms(frame);
    let pitch = null;
    
    if (rms > rmsthresh) {
      pitch = detectPitch(frame);
    }
    
    const timeInSeconds = i / sampleRate;
    const timeIn16ths = (timeInSeconds / (60 / bpm)) * 4;

    const isPitchedFrame = pitch && pitch >= minFrequency && pitch <= maxFrequency;
    
    let frameMidi = lastKnownMidi;
    let frameExactMidi = lastKnownMidi;
    
    if (isPitchedFrame && pitch) {
      frameExactMidi = 69 + 12 * Math.log2(pitch / 440);
      frameMidi = Math.round(frameExactMidi);
      lastKnownMidi = frameMidi;
    }

    // Group adjacent frames into notes. Split note if pitch jumps significantly or duration becomes > 4 beats (16 16ths).
    const needsNewNote = !currentNote || 
                         Math.abs(frameExactMidi - currentNote.midi) > 1.5 ||
                         (timeIn16ths - currentNote.startTime) > 16;

    if (needsNewNote) {
       // Close current note
       if (currentNote) {
         currentNote.duration = Math.max(0.25, timeIn16ths - currentNote.startTime);
         notes.push(currentNote);
       }
       // Start new pitched/unpitched note
       currentNote = {
         id: `vocal_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,
         startTime: timeIn16ths,
         duration: 0,
         midi: frameMidi,
         originalMidi: frameMidi,
         noteName: midiToNoteName(frameMidi),
         cents: (frameExactMidi - frameMidi) * 100,
         frequency: isPitchedFrame && pitch ? pitch : 0,
         pitchCurve: [frameExactMidi],
         loudness: rms,
         isSilence: false
       };
    } else if (currentNote) {
       // Extend pitched/unpitched note
       currentNote.duration = timeIn16ths - currentNote.startTime;
       currentNote.pitchCurve.push(frameExactMidi);
       currentNote.loudness = Math.max(currentNote.loudness || 0, rms);
    }
  }

  if (currentNote) {
     currentNote.duration = Math.max(0.25, (channelData.length / sampleRate / (60 / bpm) * 4) - currentNote.startTime);
     notes.push(currentNote);
  }

  return notes.map((note) => {
    const originalPitchCurve = [...note.pitchCurve];
    return {
      ...note,
      originalPitchCurve,
      word: "" // No text displayed on words spoken
    };
  });
}

const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiToNoteName(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const name = noteNames[midi % 12];
  return `${name}${octave}`;
}