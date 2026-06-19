// @ts-nocheck
// Custom inline worklet representations to ensure cross-environment iframe compatibility
const pitchProcessorCode = `
class PitchProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.bufferSize = 2048;
    this.buffer = new Float32Array(2048);
    this.bufferIndex = 0;
    this.sampleRate = options.processorOptions?.sampleRate || 48000;
    this.threshold = 0.1;
    // Pre-allocate the YIN difference buffer (halfBufferSize = bufferSize/2).
    // Reusing this across calls avoids GC pressure on the audio thread.
    this._yinBuffer = new Float32Array(1024);
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channelData = input[0];
    
    // Copy to internal buffer
    for (let i = 0; i < channelData.length; i++) {
       this.buffer[this.bufferIndex++] = channelData[i];
       if (this.bufferIndex >= this.bufferSize) {
          const pitch = this.yinPitchTracking(this.buffer);
          this.port.postMessage({ type: 'pitch', pitch });
          this.bufferIndex = 0;
       }
    }

    // Pass through audio unchanged for monitoring if needed
    if (outputs[0] && outputs[0][0]) {
      for (let i = 0; i < channelData.length; i++) {
        outputs[0][0][i] = channelData[i];
      }
    }

    return true;
  }

  yinPitchTracking(buffer) {
    let halfBufferSize = buffer.length / 2;
    // Reuse the pre-allocated buffer from constructor; clear it for this frame.
    let yinBuffer = this._yinBuffer;
    yinBuffer.fill(0, 0, halfBufferSize);

    // Step 1: calculate difference function
    for (let t = 1; t < halfBufferSize; t++) {
      for (let i = 0; i < halfBufferSize; i++) {
        let delta = buffer[i] - buffer[i + t];
        yinBuffer[t] += delta * delta;
      }
    }

    // Step 2: calculate cumulative mean normalized difference function
    yinBuffer[0] = 1;
    let runningSum = 0;
    for (let t = 1; t < halfBufferSize; t++) {
      runningSum += yinBuffer[t];
      yinBuffer[t] = yinBuffer[t] * t / runningSum;
    }

    // Step 3: Absolute threshold
    let tau = -1;
    for (let t = 2; t < halfBufferSize; t++) {
      if (yinBuffer[t] < this.threshold) {
        while (t + 1 < halfBufferSize && yinBuffer[t + 1] < yinBuffer[t]) {
          t++;
        }
        tau = t;
        break;
      }
    }

    // if no pitch found
    if (tau === -1) {
      let minVal = Infinity;
      for (let t = 2; t < halfBufferSize; t++) {
        if (yinBuffer[t] < minVal) {
          minVal = yinBuffer[t];
          tau = t;
        }
      }
      if (minVal > this.threshold * 2) return null;
    }

    // Step 4: Parabolic interpolation
    let betterTau = tau;
    if (tau > 0 && tau < halfBufferSize - 1) {
      let s0 = yinBuffer[tau - 1];
      let s1 = yinBuffer[tau];
      let s2 = yinBuffer[tau + 1];
      let adjustment = 0.5 * (s2 - s0) / (2.0 * s1 - s2 - s0);
      if (Math.abs(adjustment) < 1) {
         betterTau = tau + adjustment;
      }
    }

    return this.sampleRate / betterTau;
  }
}

registerProcessor('pitch-processor', PitchProcessor);
`;

const autotuneProcessorCode = `
class AutotuneProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sampleRate = options.processorOptions?.sampleRate || 48000;
    this.ratio = 1.0;
    this.targetRatio = 1.0;

    // 80ms circular input buffer — large enough for stable grain reads
    this.bufLen = Math.ceil(this.sampleRate * 0.08);
    this.buf = new Float32Array(this.bufLen);
    this.writePos = 0;

    // Two overlapping grain readers for artifact-free crossfading
    this.grainSize = 512;
    this.halfGrain = 256;
    this.phase = 0;
    this.readA = 0;
    this.readB = 0;
    this.needsInit = true;

      // Smoothing alpha: maps retuneSpeed (0-100) to an RC-style coefficient.
      // retuneSpeed=100 -> alpha=1.0 (instant snap), retuneSpeed=0 -> alpha=0.001 (very slow glide).
      this.smoothAlpha = 0.02;

      this.port.onmessage = (e) => {
        if (e.data.type === 'setPitchParam') {
          this.targetRatio = Math.pow(2, e.data.cents / 1200);
        } else if (e.data.type === 'setRetuneAlpha') {
          this.smoothAlpha = e.data.alpha;
        } else if (e.data.type === 'setAllowedNotes') {
          // Scale-locking is handled in the main thread (handlePitchCorrection).
          // Message received and acknowledged — no worklet-side action needed.
        }
      };
  }

  process(inputs, outputs) {
    const inp = inputs[0];
    const out = outputs[0];
    if (!inp || !inp[0] || !out || !out[0]) return true;

    const src = inp[0];
    const dst = out[0];
    const bufLen = this.bufLen;

    // Gentle ratio smoothing — avoids sudden pitch jumps. Alpha driven by retuneSpeed.
    this.ratio += (this.targetRatio - this.ratio) * this.smoothAlpha;
    const ratio = this.ratio;
    const fixedDelay = Math.round(this.sampleRate * 0.04); // 40ms fixed latency

    for (let i = 0; i < src.length; i++) {
      // Write input to circular buffer
      this.buf[this.writePos] = src[i];
      this.writePos = (this.writePos + 1) % bufLen;

      if (Math.abs(ratio - 1.0) < 0.001) {
        // Clean pass-through: fixed 40ms delay, zero pitch processing
        const r = (this.writePos - fixedDelay + bufLen) % bufLen;
        dst[i] = this.buf[r];
        // Keep grain readers aligned so switching into pitch mode is seamless
        this.readA = r;
        this.readB = (r + this.halfGrain) % bufLen;
        this.phase = 0;
        this.needsInit = true;
        continue;
      }

      // Initialise grain readers on first pitch-active sample
      if (this.needsInit) {
        this.readA = (this.writePos - fixedDelay + bufLen) % bufLen;
        this.readB = (this.readA + this.halfGrain) % bufLen;
        this.phase = 0;
        this.needsInit = false;
      }

      // Hanning-windowed crossfade between grain A (fading out) and grain B (fading in)
      const t = this.phase / this.grainSize;
      const winA = 0.5 * (1.0 - Math.cos(6.28318 * (1.0 - t)));
      const winB = 0.5 * (1.0 - Math.cos(6.28318 * t));

      // Linear-interpolated reads from each grain
      const ra = Math.floor(this.readA) % bufLen;
      const fa = this.readA - Math.floor(this.readA);
      const vA = this.buf[ra] + fa * (this.buf[(ra + 1) % bufLen] - this.buf[ra]);

      const rb = Math.floor(this.readB) % bufLen;
      const fb = this.readB - Math.floor(this.readB);
      const vB = this.buf[rb] + fb * (this.buf[(rb + 1) % bufLen] - this.buf[rb]);

      dst[i] = vA * winA + vB * winB;

      // Advance grain readers at pitch ratio
      this.readA = (this.readA + ratio) % bufLen;
      this.readB = (this.readB + ratio) % bufLen;

      // Advance grain phase; when one grain ends, swap readers
      this.phase++;
      if (this.phase >= this.grainSize) {
        this.phase = 0;
        this.readA = this.readB;
        this.readB = (this.readB + this.halfGrain) % bufLen;
      }

      // Soft drift correction — nudge gradually instead of hard reset (eliminates cricket clicks)
      const delay = (this.writePos - Math.floor(this.readA) + bufLen) % bufLen;
      if (delay > fixedDelay * 2.5 || delay < fixedDelay * 0.4) {
        const correction = (delay - fixedDelay) * 0.001;
        this.readA = ((this.readA - correction) % bufLen + bufLen) % bufLen;
        this.readB = (this.readA + this.halfGrain) % bufLen;
      }
    }

    return true;
  }
}

registerProcessor('autotune-processor', AutotuneProcessor);
`;

const pitchBlob = new Blob([pitchProcessorCode], { type: 'application/javascript' });
const autotuneBlob = new Blob([autotuneProcessorCode], { type: 'application/javascript' });

const pitchWorkletUrl = URL.createObjectURL(pitchBlob);
const autotuneWorkletUrl = URL.createObjectURL(autotuneBlob);

import * as Tone from 'tone';
import { KEYS_LIST, SCALES } from '../../lib/scales';

export class VocalPipeline {
  private nativeContext: AudioContext;
  private inputNode: MediaStreamAudioSourceNode | null = null;
  private pitchNode: AudioWorkletNode | null = null;
  private autotuneNode: AudioWorkletNode | null = null;
  private outputDest: MediaStreamAudioDestinationNode;
  
  public outputStream: MediaStream;
  
  private _onPitchDetect: ((pitch: number | null) => void) | null = null;
  private isInitialized = false;

  // Autotune Settings
  public autotuneEnabled = true;
  private _retuneSpeed = 50; // 0 (slow) to 100 (fast)

  public get retuneSpeed() { return this._retuneSpeed; }
  public set retuneSpeed(value: number) {
    this._retuneSpeed = value;
    // Map speed (0-100) to RC smoothing alpha:
    // speed=100 -> alpha=1.0 (instant), speed=0 -> alpha=0.001 (very slow glide, ~2s)
    const alpha = value === 100 ? 1.0 : Math.max(0.001, (value / 100) * 0.3);
    if (this.autotuneNode) {
      this.autotuneNode.port.postMessage({ type: 'setRetuneAlpha', alpha });
    }
  }
  public key: string = 'C';
  public scaleType: string = 'Chromatic';
  private allowedMidiNotes: number[] = [];

  constructor() {
    // Use the same AudioContext as Tone.js to avoid cross-context resampling glitches.
    // Tone's rawContext is available as soon as the module loads.
    const toneRaw = (Tone.getContext().rawContext as AudioContext);
    // If Tone's context exists and is usable, share it; otherwise create a minimal fallback.
    if (toneRaw && toneRaw.createMediaStreamDestination) {
      this.nativeContext = toneRaw;
    } else {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.nativeContext = new AudioCtx();
    }
    this.outputDest = this.nativeContext.createMediaStreamDestination();
    this.outputStream = this.outputDest.stream;
    
    this.generateAllowedNotes();
  }

  public setScale(key: string, scaleType: string) {
     this.key = key;
     this.scaleType = scaleType;
     this.generateAllowedNotes();
  }

  private generateAllowedNotes() {
    this.allowedMidiNotes = [];
    const rootIndex = KEYS_LIST.indexOf(this.key ?? 'C');
    const intervals = SCALES[(this.scaleType ?? 'Chromatic') as keyof typeof SCALES] ?? SCALES['Chromatic'];
    // Build the set of pitch-class semitones that belong to this scale
    const pitchClasses = new Set(intervals.map(i => (rootIndex + i) % 12));
    // Expand across the MIDI range used by the autotune worklet (20–100)
    for (let midi = 20; midi < 100; midi++) {
      if (pitchClasses.has(midi % 12)) {
        this.allowedMidiNotes.push(midi);
      }
    }
    // Push current allowed list to the worklet if already initialised
    if (this.autotuneNode) {
      this.autotuneNode.port.postMessage({ type: 'setAllowedNotes', notes: this.allowedMidiNotes });
    }
  }

  async init() {
    if (this.isInitialized) return;
    try {
      if (this.nativeContext.state === 'suspended') {
         await this.nativeContext.resume();
      }
      await this.nativeContext.audioWorklet.addModule(pitchWorkletUrl);
      await this.nativeContext.audioWorklet.addModule(autotuneWorkletUrl);
      this.isInitialized = true;
    } catch (e) {
      console.error("Failed to load native audio worklets", e);
    }
  }

  public setOnPitchDetect(callback: (pitch: number | null) => void) {
    this._onPitchDetect = callback;
  }

  public connectInput(stream: MediaStream) {
    if (!this.isInitialized) return;
    
    if (this.inputNode) this.inputNode.disconnect();
    if (this.pitchNode) this.pitchNode.disconnect();
    if (this.autotuneNode) this.autotuneNode.disconnect();
    
    try {
      this.inputNode = this.nativeContext.createMediaStreamSource(stream);
    } catch (e: any) {
      console.error("error creating native media stream source", e);
    }
    
    try {
      this.pitchNode = new window.AudioWorkletNode(this.nativeContext, 'pitch-processor', {
        processorOptions: { sampleRate: this.nativeContext.sampleRate }
      });
    } catch (e: any) {
      console.error("error creating native pitch node", e);
    }

    try {
      this.autotuneNode = new window.AudioWorkletNode(this.nativeContext, 'autotune-processor', {
        processorOptions: { sampleRate: this.nativeContext.sampleRate }
      });
    } catch (e: any) {
      console.error("error creating native autotune node", e);
    }

    if (!this.pitchNode || !this.autotuneNode || !this.inputNode) {
       // fallback directly to output
       if (this.inputNode) {
          this.inputNode.connect(this.outputDest);
       }
       return;
    }

    this.pitchNode.port.onmessage = (e) => {
      if (e.data.type === 'pitch') {
         const freq = e.data.pitch;
         if (this._onPitchDetect) this._onPitchDetect(freq);

         if (this.autotuneEnabled && freq && this.autotuneNode) {
            this.handlePitchCorrection(freq);
         } else if (!this.autotuneEnabled && this.autotuneNode) {
            this.autotuneNode.port.postMessage({ type: 'setPitchParam', cents: 0 });
         }
      }
    };

    // Chain: Input -> Pitch -> Autotune -> Native Output 
    this.inputNode.connect(this.pitchNode);
    this.pitchNode.connect(this.autotuneNode);
    this.autotuneNode.connect(this.outputDest);
  }

  private handlePitchCorrection(currentFreq: number) {
     const midiNote = 69 + 12 * Math.log2(currentFreq / 440);
     
     let nearestMidi = Math.round(midiNote);
     let minDiff = Infinity;
     for (const note of this.allowedMidiNotes) {
         let d = Math.abs(note - midiNote);
         if (d < minDiff) { minDiff = d; nearestMidi = note; }
     }
     
     const diffCents = (nearestMidi - midiNote) * 100;
     const applyCents = diffCents * (this.retuneSpeed / 100);

     if (this.autotuneNode) {
        this.autotuneNode.port.postMessage({ type: 'setPitchParam', cents: applyCents });
     }
  }

  public getOutputStream() {
    return this.outputStream;
  }

  public dispose() {
    try { this.pitchNode?.disconnect(); this.pitchNode = null; } catch (_) {}
    try { this.autotuneNode?.disconnect(); this.autotuneNode = null; } catch (_) {}
    try { this.inputNode?.disconnect(); this.inputNode = null; } catch (_) {}
    // Revoke the object-URLs created for the worklet Blobs so the browser
    // can free the underlying memory. Without this they leak for the lifetime
    // of the page (the spec requires explicit revocation).
    try { URL.revokeObjectURL(pitchWorkletUrl); } catch (_) {}
    try { URL.revokeObjectURL(autotuneWorkletUrl); } catch (_) {}
  }
}