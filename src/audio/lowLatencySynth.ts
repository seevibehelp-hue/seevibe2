// @ts-nocheck
import * as Tone from 'tone';
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
      auditionBus.gain.value = 0.85;
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

// Procedural Drum Generation
const createNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
  const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
};

let cachedNoiseBuffer: AudioBuffer | null = null;
const getNoiseBuffer = (ctx: AudioContext): AudioBuffer => {
  if (!cachedNoiseBuffer) {
    cachedNoiseBuffer = createNoiseBuffer(ctx);
  }
  return cachedNoiseBuffer;
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

    const noiseBuf = (duration: number, decay: number) => {
      const size = Math.ceil(rawCtx.sampleRate * duration);
      const b = rawCtx.createBuffer(1, size, rawCtx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < size; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / size, decay);
      }
      return b;
    };

    const isKick = noteName === 'C4' || noteName === 'C6';
    const isSnare = noteName === 'D4' || noteName === 'D6';
    const isClap = noteName === 'E4';
    const isClosedHat = noteName === 'F4';
    const isOpenHat = noteName === 'G4';
    const isCrash = noteName === 'A4';
    const isCowbell = noteName === 'D5';

    if (isKick) {
      // Layered kick: body sweep, high triangle click, low sinus sub
      const body = rawCtx.createOscillator();
      const bg = rawCtx.createGain();
      body.type = 'sine';
      body.frequency.setValueAtTime(160, now);
      body.frequency.exponentialRampToValueAtTime(35, now + 0.08);
      bg.gain.setValueAtTime(0.34 * velocity, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      body.connect(bg);
      bg.connect(dest);
      body.start(now);
      body.stop(now + 0.45);

      const click = rawCtx.createOscillator();
      const cg = rawCtx.createGain();
      click.type = 'triangle';
      click.frequency.setValueAtTime(4500, now);
      click.frequency.exponentialRampToValueAtTime(200, now + 0.015);
      cg.gain.setValueAtTime(0.12 * velocity, now);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      click.connect(cg);
      cg.connect(dest);
      click.start(now);
      click.stop(now + 0.03);

      const sub = rawCtx.createOscillator();
      const sg = rawCtx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(50, now);
      sg.gain.setValueAtTime(0.2 * velocity, now);
      sg.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      sub.connect(sg);
      sg.connect(dest);
      sub.start(now);
      sub.stop(now + 0.35);
    } else if (isSnare) {
      // Layered snare: body tone + highpass noise wire
      const body = rawCtx.createOscillator();
      const bg = rawCtx.createGain();
      body.type = 'triangle';
      body.frequency.setValueAtTime(250, now);
      body.frequency.exponentialRampToValueAtTime(120, now + 0.05);
      bg.gain.setValueAtTime(0.22 * velocity, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      body.connect(bg);
      bg.connect(dest);
      body.start(now);
      body.stop(now + 0.12);

      const noise = rawCtx.createBufferSource();
      noise.buffer = noiseBuf(0.2, 2.5);
      const ng = rawCtx.createGain();
      ng.gain.setValueAtTime(0.16 * velocity, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      const hp = rawCtx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(2500, now);
      const lp = rawCtx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(8000, now);
      noise.connect(hp);
      hp.connect(lp);
      lp.connect(ng);
      ng.connect(dest);
      noise.start(now);
      noise.stop(now + 0.2);
    } else if (isClap) {
      // 4 ultra-fast staggered noise splats
      for (let layer = 0; layer < 4; layer++) {
        const delay = layer * 0.008;
        const noise = rawCtx.createBufferSource();
        noise.buffer = noiseBuf(0.15, 3.5);
        const gain = rawCtx.createGain();
        gain.gain.setValueAtTime(0.11 * velocity, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);
        const bp = rawCtx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1500, now);
        bp.Q.setValueAtTime(1.5, now);
        noise.connect(bp);
        bp.connect(gain);
        gain.connect(dest);
        noise.start(now + delay);
        noise.stop(now + delay + 0.15);
      }
    } else if (isClosedHat) {
      // High frequency noise burst
      const noise = rawCtx.createBufferSource();
      noise.buffer = noiseBuf(0.04, 10);
      const gain = rawCtx.createGain();
      gain.gain.setValueAtTime(0.08 * velocity, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
      const hp = rawCtx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(8000, now);
      noise.connect(hp);
      hp.connect(gain);
      gain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.06);
    } else if (isOpenHat) {
      const noise = rawCtx.createBufferSource();
      noise.buffer = noiseBuf(0.3, 1.5);
      const gain = rawCtx.createGain();
      gain.gain.setValueAtTime(0.08 * velocity, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      const hp = rawCtx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(7000, now);
      noise.connect(hp);
      hp.connect(gain);
      gain.connect(dest);
      noise.start(now);
      noise.stop(now + 0.35);
    } else if (isCrash) {
      const noise = rawCtx.createBufferSource();
      noise.buffer = noiseBuf(1.5, 1.2);
      const gain = rawCtx.createGain();
      gain.gain.setValueAtTime(0.08 * velocity, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
      const hp = rawCtx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(5000, now);
      noise.connect(hp);
      hp.connect(gain);
      gain.connect(dest);
      noise.start(now);
      noise.stop(now + 1.5);
    } else if (isCowbell) {
      const osc1 = rawCtx.createOscillator();
      const osc2 = rawCtx.createOscillator();
      const gainNode = rawCtx.createGain();
      
      osc1.type = 'square';
      osc1.frequency.setValueAtTime(540, now);
      
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(800, now);
      
      const filter = rawCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, now);
      filter.Q.setValueAtTime(2.2, now);
      
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.09 * velocity, now + 0.002);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(dest);
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.25);
      osc2.stop(now + 0.25);
    } else {
      // Default: Clean kick synthesizer
      const body = rawCtx.createOscillator();
      const bg = rawCtx.createGain();
      body.type = 'sine';
      body.frequency.setValueAtTime(140, now);
      body.frequency.exponentialRampToValueAtTime(45, now + 0.08);
      bg.gain.setValueAtTime(0.22 * velocity, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      body.connect(bg);
      bg.connect(dest);
      body.start(now);
      body.stop(now + 0.32);
    }
  } catch (err) {
    console.warn('Low-latency drum error:', err);
  }
};