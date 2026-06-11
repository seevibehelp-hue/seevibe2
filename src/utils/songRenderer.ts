// @ts-nocheck
import * as Tone from "tone";

export interface SongArrangement {
  title: string;
  genre: string;
  bpm: number;
  key: string;
  scale: "major" | "minor";
  durationSec: number;
  sections: { name: string; bars: number }[];
  chordProgression: string[]; // per bar
  drums: {
    kick: number[];
    snare: number[];
    hihat: number[];
    openHat: number[];
  };
  bassPattern: { step: number; note: string; dur: number }[];
  melody: { bar: number; step: number; note: string; dur: number; vel: number }[];
  pads: { bar: number; note: string; dur: number }[];
  fxNotes?: string;
}

const NOTE_TO_SEMI: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

function chordToNotes(chord: string, octave = 3): string[] {
  // parse e.g. "Am", "F", "Cmaj7", "G7", "Dm7"
  const m = chord.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return [`${chord}${octave}`];
  const root = m[1];
  const quality = m[2].toLowerCase();
  const rootSemi = NOTE_TO_SEMI[root] ?? 0;
  const isMinor = quality.startsWith("m") && !quality.startsWith("maj");
  const third = isMinor ? 3 : 4;
  const fifth = quality.includes("dim") ? 6 : quality.includes("aug") ? 8 : 7;
  const seventh = quality.includes("maj7") ? 11 : quality.includes("7") ? 10 : null;
  const semis = [0, third, fifth];
  if (seventh !== null) semis.push(seventh);
  return semis.map((s) => semitoneToName(rootSemi + s, octave));
}

function semitoneToName(semi: number, baseOctave: number): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const oct = baseOctave + Math.floor(semi / 12);
  const n = ((semi % 12) + 12) % 12;
  return `${names[n]}${oct}`;
}

// Encode AudioBuffer to 16-bit PCM WAV blob
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numCh * 2 + 44;
  const arr = new ArrayBuffer(length);
  const view = new DataView(arr);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, length - 8, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numCh * 2, true);
  view.setUint16(32, numCh * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, length - 44, true);

  const channels: Float32Array[] = [];
  for (let i = 0; i < numCh; i++) channels.push(buffer.getChannelData(i));

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      let s = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([arr], { type: "audio/wav" });
}

async function fetchVocalBuffer(url: string, ctx: BaseAudioContext): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    return await ctx.decodeAudioData(arr.slice(0));
  } catch (e) {
    console.warn("Vocal fetch failed:", e);
    return null;
  }
}

export async function renderArrangementToWav(
  arr: SongArrangement,
  vocalsUrl?: string | null,
  onProgress?: (msg: string, pct: number) => void,
): Promise<Blob> {
  onProgress?.("Preparing engine", 0.05);
  const bpm = Math.max(60, Math.min(180, arr.bpm || 120));
  const secPerBeat = 60 / bpm;
  const secPerBar = secPerBeat * 4;
  const totalBars = (arr.sections || []).reduce((s, x) => s + (x.bars || 0), 0) || 32;
  const duration = Math.min(arr.durationSec || totalBars * secPerBar, 240) + 1.0;

  // Pre-decode vocals using a temporary OfflineAudioContext for decoding only
  let vocalsBuffer: AudioBuffer | null = null;
  if (vocalsUrl) {
    onProgress?.("Loading vocals", 0.1);
    const tmpCtx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(2, 44100, 44100);
    vocalsBuffer = await fetchVocalBuffer(vocalsUrl, tmpCtx);
  }

  onProgress?.("Rendering audio", 0.2);
  const rendered = await Tone.Offline(({ transport }) => {
    transport.bpm.value = bpm;

    // Master bus
    const masterComp = new Tone.Compressor(-18, 3).toDestination();
    const masterReverb = new Tone.Reverb({ decay: 2.2, wet: 0.18 }).connect(masterComp);

    // ---- Drums ----
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.05, octaves: 6,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0.0, release: 1.2 },
    }).connect(masterComp);
    kick.volume.value = -4;

    const snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0 },
    }).connect(masterComp);
    snare.volume.value = -10;

    const hat = new Tone.MetalSynth({
      frequency: 250, envelope: { attack: 0.001, decay: 0.08, release: 0.05 },
      harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
    }).connect(masterComp);
    hat.volume.value = -22;

    const openHat = new Tone.MetalSynth({
      frequency: 300, envelope: { attack: 0.001, decay: 0.3, release: 0.2 },
      harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
    }).connect(masterComp);
    openHat.volume.value = -24;

    // ---- Bass ----
    const bass = new Tone.MonoSynth({
      oscillator: { type: "sawtooth" },
      filter: { Q: 2, type: "lowpass", rolloff: -24 },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.4 },
      filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.5, baseFrequency: 120, octaves: 3 },
    }).connect(masterComp);
    bass.volume.value = -8;

    // ---- Pads ----
    const padFilter = new Tone.Filter(2200, "lowpass").connect(masterReverb);
    const pad = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fatsawtooth", count: 3, spread: 25 },
      envelope: { attack: 0.6, decay: 0.4, sustain: 0.7, release: 1.4 },
    }).connect(padFilter);
    pad.volume.value = -18;

    // ---- Lead melody ----
    const leadDelay = new Tone.FeedbackDelay("8n.", 0.25).connect(masterReverb);
    leadDelay.wet.value = 0.18;
    const lead = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.6 },
    }).connect(leadDelay);
    lead.volume.value = -10;

    // Schedule drums (16-step per bar across totalBars)
    for (let bar = 0; bar < totalBars; bar++) {
      for (let step = 0; step < 16; step++) {
        const t = bar * secPerBar + step * (secPerBeat / 4);
        if (arr.drums?.kick?.[step]) kick.triggerAttackRelease("C1", "8n", t);
        if (arr.drums?.snare?.[step]) snare.triggerAttackRelease("16n", t);
        if (arr.drums?.hihat?.[step]) hat.triggerAttackRelease("32n", t, 0.6);
        if (arr.drums?.openHat?.[step]) openHat.triggerAttackRelease("16n", t, 0.5);
      }
    }

    // Bass pattern loop per bar — root of current chord substitutes if note absent
    for (let bar = 0; bar < totalBars; bar++) {
      const chord = arr.chordProgression?.[bar] || arr.chordProgression?.[bar % (arr.chordProgression?.length || 1)] || "C";
      const rootSemi = NOTE_TO_SEMI[chord.match(/^([A-G][#b]?)/)?.[1] || "C"] ?? 0;
      const rootNote = semitoneToName(rootSemi, 2);
      for (const n of arr.bassPattern || []) {
        const t = bar * secPerBar + n.step * (secPerBeat / 4);
        const noteName = n.note || rootNote;
        try {
          bass.triggerAttackRelease(noteName, `${Math.max(0.1, n.dur || 0.5)}n`.replace(/(\d+(\.\d+)?)n/, (_, d) => `${Math.max(1, Math.round(4 / parseFloat(d)))}n`), t);
        } catch {
          bass.triggerAttackRelease(rootNote, "8n", t);
        }
      }
    }

    // Pads — sustain each bar's chord for the bar
    for (let bar = 0; bar < totalBars; bar++) {
      const chord = arr.chordProgression?.[bar] || "C";
      const notes = chordToNotes(chord, 3);
      const t = bar * secPerBar;
      try {
        pad.triggerAttackRelease(notes, secPerBar * 0.95, t, 0.5);
      } catch {}
    }

    // Custom pad events (extra color)
    for (const p of arr.pads || []) {
      const t = p.bar * secPerBar;
      try {
        pad.triggerAttackRelease(p.note, Math.max(0.5, p.dur * secPerBeat), t, 0.4);
      } catch {}
    }

    // Melody
    for (const n of arr.melody || []) {
      const t = n.bar * secPerBar + n.step * (secPerBeat / 4);
      try {
        lead.triggerAttackRelease(n.note, Math.max(0.1, n.dur * secPerBeat), t, Math.min(1, Math.max(0.2, n.vel || 0.7)));
      } catch {}
    }

    // Vocals overlay (if supplied)
    if (vocalsBuffer) {
      const vocalGain = new Tone.Gain(1.0).connect(masterComp);
      const vocalComp = new Tone.Compressor(-18, 4).connect(vocalGain);
      const vocalReverb = new Tone.Reverb({ decay: 1.5, wet: 0.12 }).connect(vocalComp);
      const player = new Tone.ToneAudioBuffer(vocalsBuffer);
      const src = new Tone.Player(player).connect(vocalReverb);
      src.volume.value = -2;
      // Drop vocals after a 1-bar intro space
      src.start(secPerBar);
    }
  }, duration, 2, 44100);

  onProgress?.("Encoding WAV", 0.85);
  const wav = audioBufferToWav(rendered as unknown as AudioBuffer);
  onProgress?.("Done", 1);
  return wav;
}
