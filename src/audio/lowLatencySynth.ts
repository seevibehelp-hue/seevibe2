// @ts-nocheck
import * as Tone from 'tone';

const DRUM_NOTE_TO_TYPE: Record<string, string> = {
  C4: 'kick',
  'C#4': 'kick',
  D4: 'snare',
  'D#4': 'snare',
  E4: 'clap',
  F4: 'hi-hat',
  'F#4': 'hi-hat',
  G4: 'open hh',
  'G#4': 'open hh',
  A4: 'crash',
  'A#4': 'crash',
  B4: 'tom',
  C5: 'tom hi',
  D5: 'rim',
  E5: 'perc',
  F5: 'perc',
  G5: 'vox',
  A5: 'vox',
  B5: 'fx',
  C6: 'kick',
  D6: 'snare',
};

const referenceMasterGain = 0.85;

// Audition path intentionally bypasses the Tone master chain (see getDestinationNode)

const activeVoices = new Map<string, { osc1: OscillatorNode; osc2?: OscillatorNode; env: GainNode }>();

// Audition path (drum pads + keyboard pre-recording hits) bypasses the shared
// Tone master compressor/limiter so transient drum layers cannot slam the
// master chain and color subsequent timeline playback. We route through a
// single shared audition gain straight to the device output, matching the
// clean playback path used by the reference mobile-music-pro engine.
let auditionBus: GainNode | null = null;
let auditionBusCtx: AudioContext | null = null;

const getDestinationNode = (rawCtx: AudioContext): AudioNode => {
  try {
    if (!auditionBus || auditionBusCtx !== rawCtx) {
      auditionBus = rawCtx.createGain();
      auditionBus.gain.value = referenceMasterGain;
      auditionBus.connect(rawCtx.destination);
      auditionBusCtx = rawCtx;
    }
    return auditionBus;
  } catch (e) {
    return rawCtx.destination;
  }
};

export const noteToFrequency = (noteName: string): number => {
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const match = noteName.match(/^([A-G]#?)(\d+)$/i);
  if (!match) return 440;
  const note = match[1].toUpperCase();
  const octave = parseInt(match[2], 10);
  const noteIndex = notes.indexOf(note);
  const midi = 12 * (octave + 1) + noteIndex;
  return 440 * Math.pow(2, (midi - 69) / 12);
};

export const startLowLatencySynth = (noteName: string, synthType: string = 'poly', velocity: number = 0.8) => {
  try {
    const rawCtx = Tone.getContext().rawContext as AudioContext;
    if (!rawCtx) return;
    if (rawCtx.state === 'suspended') {
      rawCtx.resume().catch(() => {});
    }
    
    const voiceId = `${noteName}_${synthType}`;
    if (activeVoices.has(voiceId)) return; // Prevent double trigger
    
    const now = rawCtx.currentTime;
    const frequency = noteToFrequency(noteName);
    
    let oscType: OscillatorType = 'triangle';
    if (['leadsynth', 'synthbass', 'brass', 'fm', 'saw', 'pluck', 'arp', 'leads'].includes(synthType.toLowerCase())) {
      oscType = 'sawtooth';
    } else if (['organ', 'pad', 'flute', 'strings', 'bells', 'sine'].includes(synthType.toLowerCase())) {
      oscType = 'sine';
    } else if (['grand', 'epiano', 'piano', 'triangle'].includes(synthType.toLowerCase())) {
      oscType = 'triangle';
    } else if (['square'].includes(synthType.toLowerCase())) {
      oscType = 'square';
    }
    
    // Professional dual-oscillator chorused synthesis from mobile-music-pro
    const osc1 = rawCtx.createOscillator();
    osc1.type = oscType;
    osc1.frequency.setValueAtTime(frequency, now);
    
    const osc2 = rawCtx.createOscillator();
    osc2.type = oscType;
    osc2.frequency.setValueAtTime(frequency * 1.003, now); // Chorused detuning
    
    const oscGain1 = rawCtx.createGain();
    oscGain1.gain.setValueAtTime(0.6, now);
    
    const oscGain2 = rawCtx.createGain();
    oscGain2.gain.setValueAtTime(0.4, now);
    
    // Dynamic resonant lowpass filter sweep
    const filter = rawCtx.createBiquadFilter();
    filter.type = 'lowpass';
    if (oscType === 'triangle') {
      filter.frequency.setValueAtTime(5000, now);
      filter.frequency.exponentialRampToValueAtTime(1500, now + 0.18);
      filter.Q.setValueAtTime(0.7, now);
    } else if (oscType === 'sawtooth') {
      filter.frequency.setValueAtTime(3200, now);
      filter.frequency.exponentialRampToValueAtTime(800, now + 0.15);
      filter.Q.setValueAtTime(1.8, now);
    } else if (oscType === 'square') {
      filter.frequency.setValueAtTime(4000, now);
      filter.Q.setValueAtTime(1.5, now);
    } else {
      filter.frequency.setValueAtTime(2500, now);
      filter.Q.setValueAtTime(0.5, now);
    }
    
    const env = rawCtx.createGain();
    const attack = oscType === 'sine' ? 0.06 : 0.01;
    const volume = 0.12 * velocity;
    
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(volume, now + attack);
    
    osc1.connect(oscGain1);
    osc2.connect(oscGain2);
    
    oscGain1.connect(filter);
    oscGain2.connect(filter);
    
    filter.connect(env);
    env.connect(getDestinationNode(rawCtx));
    
    osc1.start(now);
    osc2.start(now);
    
    activeVoices.set(voiceId, { osc1, osc2, env });
  } catch (err) {
    console.warn('Low-latency synth error:', err);
  }
};

export const stopLowLatencySynth = (noteName: string, synthType: string = 'poly') => {
  try {
    const rawCtx = Tone.getContext().rawContext as AudioContext;
    if (!rawCtx) return;
    
    const voiceId = `${noteName}_${synthType}`;
    const v = activeVoices.get(voiceId);
    if (!v) return;
    
    const now = rawCtx.currentTime;
    const release = 0.18;
    
    v.env.gain.cancelScheduledValues(now);
    v.env.gain.setValueAtTime(v.env.gain.value, now);
    v.env.gain.linearRampToValueAtTime(0, now + release);
    
    v.osc1.stop(now + release + 0.02);
    if (v.osc2) {
      v.osc2.stop(now + release + 0.02);
    }
    activeVoices.delete(voiceId);
  } catch (err) {
    console.warn('Low-latency synth stop error:', err);
  }
};

export const stopAllLowLatencyVoices = () => {
  try {
    const rawCtx = Tone.getContext().rawContext as AudioContext;
    if (!rawCtx) return;
    const now = rawCtx.currentTime;
    
    activeVoices.forEach((v) => {
      try {
        v.env.gain.cancelScheduledValues(now);
        v.env.gain.setValueAtTime(v.env.gain.value, now);
        v.env.gain.linearRampToValueAtTime(0, now + 0.05);
        v.osc1.stop(now + 0.07);
        if (v.osc2) {
          v.osc2.stop(now + 0.07);
        }
      } catch (e) {}
    });
    activeVoices.clear();
  } catch (e) {}
};

export const mapDrumNoteToType = (noteName: string): string => {
  return DRUM_NOTE_TO_TYPE[noteName] || DRUM_NOTE_TO_TYPE[noteName.toUpperCase()] || 'perc';
};

export const renderReferenceDrumAt = (
  ctx: BaseAudioContext,
  dest: AudioNode,
  drumTypeRaw: string,
  now: number,
  vel = 1,
) => {
  const drumType = (drumTypeRaw || '').toLowerCase();
  const destination = ((dest as any)?.input || dest) as AudioNode;
  const noiseBuf = (duration: number, decay: number) => {
    const size = Math.ceil(ctx.sampleRate * duration);
    const b = ctx.createBuffer(1, size, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < size; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / size, decay);
    }
    return b;
  };

  if (drumType === 'kick' || drumType === 'boom') {
    const body = ctx.createOscillator(); const bg = ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(160, now);
    body.frequency.exponentialRampToValueAtTime(35, now + 0.08);
    bg.gain.setValueAtTime(0.34 * vel, now);
    bg.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    body.connect(bg); bg.connect(destination); body.start(now); body.stop(now + 0.45);

    const click = ctx.createOscillator(); const cg = ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(4500, now);
    click.frequency.exponentialRampToValueAtTime(200, now + 0.015);
    cg.gain.setValueAtTime(0.12 * vel, now);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
    click.connect(cg); cg.connect(destination); click.start(now); click.stop(now + 0.03);

    const sub = ctx.createOscillator(); const sg = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(50, now);
    sg.gain.setValueAtTime(0.2 * vel, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    sub.connect(sg); sg.connect(destination); sub.start(now); sub.stop(now + 0.35);
  } else if (drumType === '808' || drumType === 'sub' || drumType === '808 sub') {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    const dist = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i / 128) - 1;
      curve[i] = (Math.PI + 2) * x / (Math.PI + 2 * Math.abs(x));
    }
    dist.curve = curve;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
    gain.gain.setValueAtTime(0.5 * vel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc.connect(dist); dist.connect(gain); gain.connect(destination);
    osc.start(now); osc.stop(now + 1.2);
  } else if (drumType === 'snare') {
    const body = ctx.createOscillator(); const bg = ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(250, now);
    body.frequency.exponentialRampToValueAtTime(120, now + 0.05);
    bg.gain.setValueAtTime(0.22 * vel, now);
    bg.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    body.connect(bg); bg.connect(destination); body.start(now); body.stop(now + 0.12);

    const noise = ctx.createBufferSource(); noise.buffer = noiseBuf(0.2, 2.5);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.16 * vel, now);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 8000;
    noise.connect(hp); hp.connect(lp); lp.connect(ng); ng.connect(destination); noise.start(now); noise.stop(now + 0.2);
  } else if (drumType === 'clap') {
    for (let layer = 0; layer < 4; layer++) {
      const delay = layer * 0.008;
      const noise = ctx.createBufferSource(); noise.buffer = noiseBuf(0.15, 3.5);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.11 * vel, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 1500; bp.Q.value = 1.5;
      noise.connect(bp); bp.connect(gain); gain.connect(destination); noise.start(now + delay); noise.stop(now + delay + 0.15);
    }
  } else if (drumType === 'hi-hat' || drumType === 'closed hh' || drumType === 'hat') {
    const noise = ctx.createBufferSource(); noise.buffer = noiseBuf(0.04, 10);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08 * vel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 8000;
    noise.connect(hp); hp.connect(gain); gain.connect(destination); noise.start(now); noise.stop(now + 0.06);
  } else if (drumType === 'open hh' || drumType === 'open hat') {
    const noise = ctx.createBufferSource(); noise.buffer = noiseBuf(0.3, 1.5);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08 * vel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
    noise.connect(hp); hp.connect(gain); gain.connect(destination); noise.start(now); noise.stop(now + 0.35);
  } else if (drumType === 'crash') {
    const noise = ctx.createBufferSource(); noise.buffer = noiseBuf(1.5, 1.2);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08 * vel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
    noise.connect(hp); hp.connect(gain); gain.connect(destination); noise.start(now); noise.stop(now + 1.5);
  } else if (drumType === 'rim' || drumType === 'rimshot' || drumType === 'cowbell') {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc1.type = 'square';
    osc1.frequency.setValueAtTime(540, now);
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(800, now);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.Q.setValueAtTime(2.2, now);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.09 * vel, now + 0.002);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(filter); osc2.connect(filter); filter.connect(gainNode); gainNode.connect(dest);
    osc1.start(now); osc2.start(now); osc1.stop(now + 0.25); osc2.stop(now + 0.25);
  } else if (drumType.includes('tom')) {
    const freq = drumType.includes('hi') ? 220 : drumType.includes('lo') ? 90 : 150;
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.8, now);
    osc.frequency.exponentialRampToValueAtTime(freq, now + 0.06);
    gain.gain.setValueAtTime(0.22 * vel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain); gain.connect(dest); osc.start(now); osc.stop(now + 0.35);
  } else {
    const noise = ctx.createBufferSource(); noise.buffer = noiseBuf(0.1, 5);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12 * vel, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4000;
    noise.connect(hp); hp.connect(gain); gain.connect(dest); noise.start(now); noise.stop(now + 0.1);
  }
};

// Procedural sound designers matching mobile-music-pro exactly
export const playLowLatencyDrumHit = (noteName: string, velocity: number = 0.8) => {
  try {
    const rawCtx = Tone.getContext().rawContext as AudioContext;
    if (!rawCtx) return;
    if (rawCtx.state === 'suspended') {
      rawCtx.resume().catch(() => {});
    }
    const now = rawCtx.currentTime;
    const dest = getDestinationNode(rawCtx);
    renderReferenceDrumAt(rawCtx, dest, mapDrumNoteToType(noteName), now, velocity);
  } catch (err) {
    console.warn('Low-latency drum error:', err);
  }
};