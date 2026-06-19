// @ts-nocheck
import * as Tone from "tone";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DrumPattern {
  kick: number[];
  snare: number[];
  hihat: number[];
  openHat: number[];
  perc?: number[];
}

export interface BassNote { step: number; note: string; dur: number }
export interface MelodyNote { bar: number; step: number; note: string; dur: number; vel: number }
export interface PadNote { bar: number; note: string; dur: number; vel?: number }

export interface SynthProfile {
  kick: "808" | "acoustic" | "electronic" | "afro";
  bass: "808" | "sawtooth" | "sine" | "pluck" | "electric";
  lead: "synth" | "piano" | "guitar" | "brass" | "flute" | "strings";
  pad:  "lush" | "analog" | "choir" | "ambient" | "stab";
  hats: "trap" | "acoustic" | "percussion";
}

export interface SongSection {
  name: string;
  bars: number;
  energy?: number;
  vocalSpace?: boolean;
  layerFlags?: {
    drums?: boolean;
    bass?: boolean;
    pads?: boolean;
    melody?: boolean;
    extraPerc?: boolean;
  };
  signalEvent?: "none" | "riser" | "crash" | "fill" | "snare_roll" | "cymbal_swell" | "fx_sweep" | "drop_silence";
  mixAutomation?: {
    bassBoost?: number;
    reverbWet?: number;
    compressionRatio?: number;
    stereoWidth?: number;
  };
}

export interface SongArrangement {
  title: string;
  genre: string;
  bpm: number;
  key: string;
  scale: "major" | "minor";
  durationSec: number;
  sections: SongSection[];
  chordProgression: string[];
  drums: DrumPattern;
  bassPattern: BassNote[];
  melody: MelodyNote[];
  pads?: PadNote[];
  fxNotes?: string;
  // Extended (FullSongArrangement) fields — present when AI returns new schema
  synthProfile?: SynthProfile;
  drumVariations?: { chorus?: DrumPattern; bridge?: DrumPattern };
  bassVariations?: { chorus?: BassNote[]; bridge?: BassNote[] };
  hooks?: MelodyNote[];
}

// ─── Note helpers ─────────────────────────────────────────────────────────────

const NOTE_TO_SEMI: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4,
  F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};
const SEMI_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

function semitoneToName(semi: number, baseOctave: number): string {
  const oct = baseOctave + Math.floor(semi / 12);
  return `${SEMI_NAMES[((semi % 12) + 12) % 12]}${oct}`;
}

function chordToNotes(chord: string, octave = 3): string[] {
  const m = chord.match(/^([A-G][#b]?)(.*)$/);
  if (!m) return [`${chord}${octave}`];
  const root = m[1]; const quality = m[2].toLowerCase();
  const rootSemi = NOTE_TO_SEMI[root] ?? 0;
  const isMinor = quality.startsWith("m") && !quality.startsWith("maj");
  const third = isMinor ? 3 : 4;
  const fifth = quality.includes("dim") ? 6 : quality.includes("aug") ? 8 : 7;
  const seventh = quality.includes("maj7") ? 11 : quality.includes("7") ? 10 : null;
  const semis = [0, third, fifth];
  if (seventh !== null) semis.push(seventh);
  return semis.map(s => semitoneToName(rootSemi + s, octave));
}

function chordRoot(chord: string, octave = 2): string {
  const root = chord.match(/^([A-G][#b]?)/)?.[1] || "C";
  return semitoneToName(NOTE_TO_SEMI[root] ?? 0, octave);
}

function durToToneStr(beats: number): string {
  // Convert float beat-duration → nearest Tone.js note string ("8n", "4n", "2n", "1n")
  if (beats <= 0.25) return "16n";
  if (beats <= 0.5) return "8n";
  if (beats <= 1.0) return "4n";
  if (beats <= 2.0) return "2n";
  return "1n";
}

// ─── WAV encoder ─────────────────────────────────────────────────────────────

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numCh * 2 + 44;
  const arr = new ArrayBuffer(length);
  const view = new DataView(arr);
  const ws = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  ws(0,"RIFF"); view.setUint32(4,length-8,true); ws(8,"WAVE"); ws(12,"fmt ");
  view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,numCh,true);
  view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*numCh*2,true);
  view.setUint16(32,numCh*2,true); view.setUint16(34,16,true); ws(36,"data");
  view.setUint32(40,length-44,true);
  const channels: Float32Array[] = [];
  for (let i = 0; i < numCh; i++) channels.push(buffer.getChannelData(i));
  let off = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true); off += 2;
    }
  }
  return new Blob([arr], { type: "audio/wav" });
}

async function fetchVocalBuffer(url: string, ctx: BaseAudioContext): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    return await ctx.decodeAudioData(arr.slice(0));
  } catch (e) { console.warn("Vocal fetch failed:", e); return null; }
}

// ─── Section bar map ─────────────────────────────────────────────────────────

interface BarInfo {
  sectionIndex: number;
  sectionName: string;
  energy: number;
  layerFlags: NonNullable<SongSection["layerFlags"]>;
  signalEvent: string;
  isFirstBarOfSection: boolean;
  isLastBarOfSection: boolean;
  barInSection: number;
  mixAuto: NonNullable<SongSection["mixAutomation"]>;
}

function buildBarMap(sections: SongSection[], totalBars: number): BarInfo[] {
  const map: BarInfo[] = [];
  let bar = 0;
  sections.forEach((sec, si) => {
    const n = sec.name?.toLowerCase() || "";
    const energy = sec.energy ?? (
      n.includes("chorus") ? 0.9 : n.includes("bridge") ? 0.45 :
      n.includes("intro") ? 0.35 : n.includes("outro") ? 0.4 :
      n.includes("pre") ? 0.7 : 0.6
    );
    const defaultFlags = {
      drums: true, bass: true,
      pads: n.includes("intro") || n.includes("chorus") || n.includes("pre") || n.includes("bridge"),
      melody: !n.includes("intro"),
      extraPerc: n.includes("chorus") || n.includes("pre"),
    };
    const layerFlags = { ...defaultFlags, ...(sec.layerFlags || {}) };
    const mixAuto = { bassBoost: 0, reverbWet: 0.2, compressionRatio: 4, stereoWidth: 0.5, ...(sec.mixAutomation || {}) };
    const signalEvent = sec.signalEvent || "none";
    const secBars = Math.max(1, sec.bars || 0);
    for (let b = 0; b < secBars && bar < totalBars; b++, bar++) {
      map.push({
        sectionIndex: si, sectionName: n, energy,
        layerFlags, signalEvent,
        isFirstBarOfSection: b === 0,
        isLastBarOfSection: b === secBars - 1,
        barInSection: b, mixAuto,
      });
    }
  });
  // Fill remaining bars with last section info if any
  while (map.length < totalBars) {
    const last = map[map.length - 1] || { sectionIndex: 0, sectionName: "outro", energy: 0.4, layerFlags: { drums: true, bass: true, pads: false, melody: false, extraPerc: false }, signalEvent: "none", isFirstBarOfSection: false, isLastBarOfSection: true, barInSection: 0, mixAuto: { bassBoost: 0, reverbWet: 0.2, compressionRatio: 4, stereoWidth: 0.5 } };
    map.push({ ...last, isFirstBarOfSection: false, isLastBarOfSection: false });
  }
  return map;
}

// ─── Genre-aware synth factory ────────────────────────────────────────────────

function guessProfile(genre: string): SynthProfile {
  const g = (genre || "").toLowerCase();
  if (g.includes("afro") || g.includes("amapiano") || g.includes("naija")) {
    return { kick: "afro", bass: "sine", lead: "piano", pad: "stab", hats: "percussion" };
  }
  if (g.includes("trap") || g.includes("drill") || g.includes("hip")) {
    return { kick: "808", bass: "808", lead: "synth", pad: "analog", hats: "trap" };
  }
  if (g.includes("r&b") || g.includes("rnb") || g.includes("soul")) {
    return { kick: "acoustic", bass: "electric", lead: "piano", pad: "lush", hats: "acoustic" };
  }
  if (g.includes("house") || g.includes("techno") || g.includes("edm")) {
    return { kick: "electronic", bass: "sawtooth", lead: "synth", pad: "analog", hats: "trap" };
  }
  if (g.includes("reggae") || g.includes("dancehall")) {
    return { kick: "acoustic", bass: "sine", lead: "guitar", pad: "lush", hats: "acoustic" };
  }
  // Default: pop
  return { kick: "electronic", bass: "sawtooth", lead: "synth", pad: "lush", hats: "acoustic" };
}

function makeKick(profile: SynthProfile, dest: Tone.ToneAudioNode) {
  const is808 = profile.kick === "808";
  const isAfro = profile.kick === "afro";
  const synth = new Tone.MembraneSynth({
    pitchDecay: is808 ? 0.12 : isAfro ? 0.06 : 0.05,
    octaves: is808 ? 8 : isAfro ? 5 : 6,
    envelope: { attack: 0.001, decay: is808 ? 0.55 : 0.35, sustain: 0, release: is808 ? 1.4 : 0.8 },
  }).connect(dest);
  synth.volume.value = is808 ? -2 : isAfro ? -5 : -4;
  return { synth, note: is808 ? "A0" : isAfro ? "C1" : "C1" };
}

function makeSnare(profile: SynthProfile, dest: Tone.ToneAudioNode) {
  const synth = new Tone.NoiseSynth({
    noise: { type: profile.kick === "afro" ? "pink" : "white" },
    envelope: { attack: 0.001, decay: profile.kick === "808" ? 0.15 : 0.2, sustain: 0, release: 0.08 },
  }).connect(dest);
  synth.volume.value = profile.kick === "808" ? -8 : -10;
  return synth;
}

function makeHat(profile: SynthProfile, dest: Tone.ToneAudioNode, open = false) {
  const isTrap = profile.hats === "trap";
  const synth = new Tone.MetalSynth({
    frequency: open ? 280 : 260,
    envelope: { attack: 0.001, decay: open ? (isTrap ? 0.5 : 0.3) : (isTrap ? 0.05 : 0.08), release: open ? 0.3 : 0.05 },
    harmonicity: isTrap ? 3.1 : 5.1,
    modulationIndex: isTrap ? 16 : 32,
    resonance: 4200,
    octaves: 1.5,
  }).connect(dest);
  synth.volume.value = open ? -22 : -20;
  return synth;
}

function makePerc(dest: Tone.ToneAudioNode) {
  // Wood/conga-style percussion
  const synth = new Tone.MembraneSynth({
    pitchDecay: 0.03, octaves: 3,
    envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 },
  }).connect(dest);
  synth.volume.value = -16;
  return synth;
}

function makeBass(profile: SynthProfile, dest: Tone.ToneAudioNode) {
  const is808 = profile.bass === "808";
  const isSine = profile.bass === "sine";
  const synth = new Tone.MonoSynth({
    oscillator: { type: is808 || isSine ? "sine" : profile.bass === "pluck" ? "triangle" : "sawtooth" },
    filter: { Q: is808 ? 1 : 2, type: "lowpass", rolloff: -24 },
    envelope: { attack: is808 ? 0.001 : 0.005, decay: is808 ? 0.3 : 0.2, sustain: is808 ? 0.8 : 0.6, release: is808 ? 0.5 : 0.4 },
    filterEnvelope: { attack: 0.01, decay: 0.2, sustain: is808 ? 0.5 : 0.3, release: 0.5, baseFrequency: is808 ? 60 : 120, octaves: is808 ? 2 : 3 },
  }).connect(dest);
  synth.volume.value = is808 ? -5 : -8;
  return synth;
}

function makeLead(profile: SynthProfile, dest: Tone.ToneAudioNode) {
  const opts: any = {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.6 },
  };
  if (profile.lead === "piano") {
    opts.oscillator = { type: "fatsine", count: 2, spread: 10 };
    opts.envelope = { attack: 0.001, decay: 0.4, sustain: 0.1, release: 1.0 };
  } else if (profile.lead === "brass") {
    opts.oscillator = { type: "sawtooth" };
    opts.envelope = { attack: 0.04, decay: 0.2, sustain: 0.5, release: 0.3 };
  } else if (profile.lead === "flute") {
    opts.oscillator = { type: "sine" };
    opts.envelope = { attack: 0.06, decay: 0.1, sustain: 0.5, release: 0.4 };
  } else if (profile.lead === "strings") {
    opts.oscillator = { type: "fatsawtooth", count: 3, spread: 30 };
    opts.envelope = { attack: 0.2, decay: 0.2, sustain: 0.6, release: 1.2 };
  }
  const synth = new Tone.PolySynth(Tone.Synth, opts).connect(dest);
  synth.volume.value = -10;
  return synth;
}

function makePad(profile: SynthProfile, dest: Tone.ToneAudioNode) {
  const opts: any = {
    oscillator: { type: "fatsawtooth", count: 3, spread: 25 },
    envelope: { attack: 0.6, decay: 0.4, sustain: 0.7, release: 1.4 },
  };
  if (profile.pad === "stab") {
    opts.oscillator = { type: "sawtooth" };
    opts.envelope = { attack: 0.001, decay: 0.15, sustain: 0.0, release: 0.2 };
  } else if (profile.pad === "ambient") {
    opts.oscillator = { type: "sine" };
    opts.envelope = { attack: 1.2, decay: 0.5, sustain: 0.8, release: 2.0 };
  } else if (profile.pad === "choir") {
    opts.oscillator = { type: "fatsine", count: 4, spread: 20 };
    opts.envelope = { attack: 0.8, decay: 0.3, sustain: 0.6, release: 1.5 };
  }
  const synth = new Tone.PolySynth(Tone.Synth, opts).connect(dest);
  synth.volume.value = profile.pad === "stab" ? -14 : -18;
  return synth;
}

// ─── Section signal events ────────────────────────────────────────────────────

function scheduleSignalEvent(
  type: string,
  atTime: number,      // absolute Tone.Transport seconds
  secPerBar: number,
  secPerBeat: number,
  dest: Tone.ToneAudioNode,
) {
  if (!type || type === "none") return;

  if (type === "crash" || type === "cymbal_swell") {
    const crash = new Tone.MetalSynth({
      frequency: type === "cymbal_swell" ? 180 : 220,
      envelope: { attack: type === "cymbal_swell" ? 0.4 : 0.001, decay: 2.5, release: 1.5 },
      harmonicity: 3.1, modulationIndex: 24, resonance: 3800, octaves: 1.8,
    }).connect(dest);
    crash.volume.value = type === "cymbal_swell" ? -18 : -14;
    crash.triggerAttackRelease("8n", atTime, 0.9);
    // auto-dispose after use
    Tone.Transport.schedule(() => { try { crash.dispose(); } catch {} }, atTime + 4);
    return;
  }

  if (type === "riser" || type === "fx_sweep") {
    // White noise riser: 2 bars leading up to atTime
    const start = Math.max(0, atTime - secPerBar * 2);
    const riseDur = atTime - start;
    const noise = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: riseDur * 0.8, decay: 0.0, sustain: 1.0, release: 0.05 },
    });
    const riserFilter = new Tone.Filter({ frequency: 200, type: "highpass" }).connect(dest);
    const riserGain = new Tone.Gain(0).connect(riserFilter);
    noise.connect(riserGain);
    noise.volume.value = -22;
    noise.triggerAttack(start);
    riserGain.gain.linearRampTo(0.7, riseDur, start);
    riserGain.gain.linearRampTo(0, 0.05, atTime);
    noise.triggerRelease(atTime - 0.05);
    // Sweep filter up
    riserFilter.frequency.rampTo(8000, riseDur, start);
    Tone.Transport.schedule(() => { try { noise.dispose(); riserFilter.dispose(); riserGain.dispose(); } catch {} }, atTime + 1);
    return;
  }

  if (type === "fill") {
    // Snare fill: 4 snare hits in the beat BEFORE the section
    const fillSnare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
    }).connect(dest);
    fillSnare.volume.value = -9;
    const step = secPerBeat / 4;
    const fillStart = atTime - secPerBeat;
    for (let i = 0; i < 4; i++) {
      const vel = 0.5 + i * 0.12;
      fillSnare.triggerAttackRelease("32n", fillStart + i * step, Math.min(1, vel));
    }
    Tone.Transport.schedule(() => { try { fillSnare.dispose(); } catch {} }, atTime + 1);
    return;
  }

  if (type === "snare_roll") {
    // Accelerating snare roll over last bar
    const rollSnare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.04 },
    }).connect(dest);
    rollSnare.volume.value = -10;
    const rollStart = atTime - secPerBar;
    const hits = 16;
    for (let i = 0; i < hits; i++) {
      const t = rollStart + (i / hits) * secPerBar;
      const vel = 0.3 + (i / hits) * 0.65;
      rollSnare.triggerAttackRelease("32n", t, vel);
    }
    Tone.Transport.schedule(() => { try { rollSnare.dispose(); } catch {} }, atTime + 1);
    return;
  }

  if (type === "drop_silence") {
    // A brief volume dip just before the drop — handled by gain automation
    // (nothing to schedule here; the energy system handles the moment)
    return;
  }
}

// ─── Main render function ─────────────────────────────────────────────────────

export async function renderArrangementToWav(
  arr: SongArrangement,
  vocalsUrl?: string | null,
  onProgress?: (msg: string, pct: number) => void,
): Promise<Blob> {
  onProgress?.("Preparing engine", 0.04);

  const bpm = Math.max(60, Math.min(200, arr.bpm || 120));
  const secPerBeat = 60 / bpm;
  const secPerBar = secPerBeat * 4;
  const totalBars = (arr.sections || []).reduce((s, x) => s + Math.max(1, x.bars || 0), 0) || 32;
  const duration = Math.min(Math.max(arr.durationSec || totalBars * secPerBar, 30), 240) + 2.0;

  // Pre-decode vocals
  let vocalsBuffer: AudioBuffer | null = null;
  if (vocalsUrl) {
    onProgress?.("Loading vocals", 0.08);
    const sr = Tone.getContext().sampleRate || 44100;
    const tmpCtx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(2, sr, sr);
    vocalsBuffer = await fetchVocalBuffer(vocalsUrl, tmpCtx);
  }

  // Build bar map
  const barMap = buildBarMap(arr.sections || [], totalBars);

  // Determine synth profile
  const profile: SynthProfile = arr.synthProfile || guessProfile(arr.genre || "");

  onProgress?.("Rendering audio", 0.18);

  const rendered = await Tone.Offline(({ transport }) => {
    transport.bpm.value = bpm;

    // ── Master chain ──────────────────────────────────────────────────────
    const masterLimiter = new Tone.Limiter(-1).toDestination();
    const masterComp = new Tone.Compressor(-14, 4).connect(masterLimiter);
    const masterGain = new Tone.Gain(0.85).connect(masterComp);

    // Reverb send bus
    const reverb = new Tone.Reverb({ decay: 2.4, wet: 1.0 });
    const reverbSend = new Tone.Gain(0.22).connect(reverb);
    reverb.connect(masterGain);

    // Stereo widener (chorus at low depth)
    const widener = new Tone.Chorus({ frequency: 0.5, delayTime: 3.5, depth: 0.15, wet: 0.4 }).connect(masterGain);
    widener.start();

    // Delay send for lead
    const leadDelay = new Tone.FeedbackDelay({ delayTime: "8n.", feedback: 0.22, wet: 0.18 }).connect(masterGain);

    // ── Drum bus ──────────────────────────────────────────────────────────
    const drumBus = new Tone.Gain(1.0).connect(masterGain);
    const drumComp = new Tone.Compressor(-20, 6).connect(drumBus);
    const drumGain = new Tone.Gain(1.0).connect(drumComp);

    // ── Instruments ───────────────────────────────────────────────────────
    const { synth: kick, note: kickNote } = makeKick(profile, drumGain);
    const snare = makeSnare(profile, drumGain);
    const hat = makeHat(profile, drumGain, false);
    const openHat = makeHat(profile, drumGain, true);
    const perc = makePerc(drumGain);

    const bassBus = new Tone.Gain(1.0).connect(masterGain);
    const bassInst = makeBass(profile, bassBus);

    const padBus = new Tone.Gain(1.0).connect(reverbSend);
    const padInst = makePad(profile, padBus);

    const leadBus = new Tone.Gain(1.0).connect(leadDelay);
    const leadInst = makeLead(profile, leadBus);

    // Hook synth (call-and-response in chorus) — slightly brighter
    const hookBus = new Tone.Gain(0.7).connect(masterGain);
    const hookOpts: any = { oscillator: { type: "fatsine", count: 2, spread: 15 }, envelope: { attack: 0.02, decay: 0.15, sustain: 0.4, release: 0.5 } };
    const hookInst = new Tone.PolySynth(Tone.Synth, hookOpts).connect(hookBus);
    hookInst.volume.value = -12;

    // ── Per-section volume automation ─────────────────────────────────────
    // Pre-compute intro end time (so drums/layers fade in properly)
    let introBars = 0;
    for (const sec of (arr.sections || [])) {
      if (sec.name?.toLowerCase().includes("intro")) { introBars += sec.bars || 0; } else { break; }
    }

    // Ramp master gain slightly higher at chorus sections
    let curBar = 0;
    for (const sec of (arr.sections || [])) {
      const t = curBar * secPerBar;
      const n = sec.name?.toLowerCase() || "";
      const energy = sec.energy ?? (n.includes("chorus") ? 0.9 : n.includes("bridge") ? 0.45 : n.includes("intro") ? 0.35 : n.includes("outro") ? 0.4 : n.includes("pre") ? 0.7 : 0.6);
      const targetGain = 0.65 + energy * 0.35;
      masterGain.gain.linearRampTo(targetGain, 0.3, t);
      // Bass boost for chorus
      const bassBoost = sec.mixAutomation?.bassBoost ?? (n.includes("chorus") ? 2 : 0);
      bassBus.gain.linearRampTo(Math.pow(10, bassBoost / 20), 0.3, t);
      // Outro fade
      if (n.includes("outro")) {
        const fadeStart = t + (sec.bars || 4) * secPerBar * 0.4;
        masterGain.gain.linearRampTo(0.0, (sec.bars || 4) * secPerBar * 0.6, fadeStart);
      }
      curBar += sec.bars || 0;
    }

    // ── Signal events at section boundaries ───────────────────────────────
    let signalBar = 0;
    for (let si = 0; si < (arr.sections || []).length; si++) {
      const sec = arr.sections[si];
      const sectionStartTime = signalBar * secPerBar;
      if (si > 0 && sec.signalEvent && sec.signalEvent !== "none") {
        scheduleSignalEvent(sec.signalEvent, sectionStartTime, secPerBar, secPerBeat, masterGain);
      }
      signalBar += sec.bars || 0;
    }

    // ── Per-bar drum scheduling ───────────────────────────────────────────
    for (let bar = 0; bar < totalBars; bar++) {
      const info = barMap[bar];
      if (!info.layerFlags.drums) continue;

      // Select drum pattern variant
      const sn = info.sectionName;
      let dp: DrumPattern = arr.drums;
      if ((sn.includes("chorus")) && arr.drumVariations?.chorus) dp = arr.drumVariations.chorus;
      else if (sn.includes("bridge") && arr.drumVariations?.bridge) dp = arr.drumVariations.bridge;

      // Energy-based step probability: sparse in low-energy sections
      const probMult = Math.min(1, info.energy / 0.9 + 0.1);

      for (let step = 0; step < 16; step++) {
        const t = bar * secPerBar + step * (secPerBeat / 4);
        // Kick
        if (dp.kick?.[step] && Math.random() < probMult + 0.3) {
          kick.triggerAttackRelease(kickNote, "8n", t, 0.7 + info.energy * 0.25);
        }
        // Snare
        if (dp.snare?.[step]) {
          snare.triggerAttackRelease("16n", t, 0.7 + info.energy * 0.2);
        }
        // Hats — for trap, add triplet ghost hats during chorus
        if (dp.hihat?.[step]) {
          hat.triggerAttackRelease("32n", t, 0.5 + info.energy * 0.2);
        }
        if (dp.openHat?.[step]) {
          openHat.triggerAttackRelease("16n", t, 0.45 + info.energy * 0.15);
        }
        // Extra perc
        if (info.layerFlags.extraPerc && dp.perc?.[step]) {
          perc.triggerAttackRelease("E2", "16n", t, 0.5);
        }
      }

      // Trap triplet hats during chorus
      if (profile.hats === "trap" && sn.includes("chorus") && info.layerFlags.extraPerc) {
        for (let th = 0; th < 12; th++) {
          const t = bar * secPerBar + th * (secPerBar / 12);
          if (Math.random() < 0.5) hat.triggerAttackRelease("64n", t, 0.3);
        }
      }
    }

    // ── Per-bar bass scheduling ───────────────────────────────────────────
    for (let bar = 0; bar < totalBars; bar++) {
      const info = barMap[bar];
      if (!info.layerFlags.bass) continue;

      const chord = arr.chordProgression?.[bar] || arr.chordProgression?.[0] || "C";
      const fallbackNote = chordRoot(chord, 2);

      const sn = info.sectionName;
      let bp: BassNote[] = arr.bassPattern || [];
      if (sn.includes("chorus") && arr.bassVariations?.chorus) bp = arr.bassVariations.chorus;
      else if (sn.includes("bridge") && arr.bassVariations?.bridge) bp = arr.bassVariations.bridge;

      for (const n of bp) {
        const t = bar * secPerBar + n.step * (secPerBeat / 4);
        const noteName = n.note || fallbackNote;
        try {
          bassInst.triggerAttackRelease(noteName, durToToneStr(n.dur || 0.5), t, 0.7 + info.energy * 0.2);
        } catch {
          try { bassInst.triggerAttackRelease(fallbackNote, "8n", t, 0.7); } catch {}
        }
      }
    }

    // ── Per-bar pad scheduling ────────────────────────────────────────────
    for (let bar = 0; bar < totalBars; bar++) {
      const info = barMap[bar];
      if (!info.layerFlags.pads) continue;

      const chord = arr.chordProgression?.[bar] || "C";
      const isStab = profile.pad === "stab";
      const notes = chordToNotes(chord, 3);
      const t = bar * secPerBar;

      // For stabs, play at beginning and middle of bar; for lush pads, hold the bar
      if (isStab) {
        try { padInst.triggerAttackRelease(notes, "8n", t, 0.6 * info.energy); } catch {}
        try { padInst.triggerAttackRelease(notes, "8n", t + secPerBeat * 2, 0.45 * info.energy); } catch {}
      } else {
        const padDur = Math.max(secPerBar * 0.92, 0.5);
        try { padInst.triggerAttackRelease(notes, padDur, t, 0.4 + info.energy * 0.25); } catch {}
      }
    }

    // Extra pad events (color tones from AI)
    for (const p of arr.pads || []) {
      if (p.bar >= totalBars) continue;
      const info = barMap[p.bar];
      if (!info?.layerFlags?.pads) continue;
      const t = p.bar * secPerBar;
      try { padInst.triggerAttackRelease(p.note, Math.max(0.5, (p.dur || 1) * secPerBeat), t, (p.vel || 0.4) * info.energy); } catch {}
    }

    // ── Melody scheduling ────────────────────────────────────────────────
    for (const n of arr.melody || []) {
      if (n.bar >= totalBars) continue;
      const info = barMap[n.bar];
      if (!info?.layerFlags?.melody) continue;
      // If vocals present and section has vocalSpace, reduce melody velocity
      const vocalReduction = vocalsBuffer && (info.layerFlags.melody) ? 0.55 : 1.0;
      const t = n.bar * secPerBar + n.step * (secPerBeat / 4);
      try {
        leadInst.triggerAttackRelease(n.note, Math.max(0.05, (n.dur || 0.5) * secPerBeat * 0.9), t, Math.min(1, Math.max(0.15, (n.vel || 0.7) * vocalReduction)));
      } catch {}
    }

    // ── Hook scheduling (chorus call-and-response) ────────────────────────
    for (const n of arr.hooks || []) {
      if (n.bar >= totalBars) continue;
      const info = barMap[n.bar];
      if (!info.sectionName.includes("chorus")) continue;
      const t = n.bar * secPerBar + n.step * (secPerBeat / 4);
      try {
        hookInst.triggerAttackRelease(n.note, Math.max(0.05, (n.dur || 0.5) * secPerBeat * 0.9), t, Math.min(1, n.vel || 0.6));
      } catch {}
    }

    // ── Vocals overlay ────────────────────────────────────────────────────
    if (vocalsBuffer) {
      const vocalComp = new Tone.Compressor(-18, 4).connect(masterGain);
      const vocalReverb = new Tone.Reverb({ decay: 1.5, wet: 0.14 }).connect(vocalComp);
      const vocalGain = new Tone.Gain(1.0).connect(vocalReverb);
      const player = new Tone.Player(new Tone.ToneAudioBuffer(vocalsBuffer)).connect(vocalGain);
      player.volume.value = -1;
      // Start vocals after intro
      const introEnd = introBars * secPerBar;
      player.start(introEnd);
    }

  }, duration, 2, Tone.getContext().sampleRate || 44100);

  onProgress?.("Encoding WAV", 0.88);
  const wav = audioBufferToWav(rendered as unknown as AudioBuffer);
  onProgress?.("Done", 1);
  return wav;
}
