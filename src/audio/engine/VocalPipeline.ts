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
    let yinBuffer = new Float32Array(halfBufferSize);

    // Step 1: calculate difference function
    for (let t = 0; t < halfBufferSize; t++) {
      yinBuffer[t] = 0;
    }
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
    this.pitchShiftingRatio = 1.0;
    this.targetRatio = 1.0;

    // Granular synthesis state
    this.grainSize = 512;
    this.overlap = 0.5;
    this.buffer = new Float32Array(this.sampleRate * 2); // 2 seconds
    this.writePos = 0;
    this.readPos = 0;
    
    this.port.onmessage = (e) => {
      if (e.data.type === 'setPitchParam') {
         this.targetRatio = Math.pow(2, e.data.cents / 1200);
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0] || !output || !output[0]) return true;

    const channelIn = input[0];
    const channelOut = output[0];

    // Smooth ratio transition
    this.pitchShiftingRatio += (this.targetRatio - this.pitchShiftingRatio) * 0.05;

    for (let i = 0; i < channelIn.length; i++) {
       // Write to circular buffer
       this.buffer[this.writePos] = channelIn[i];
       
       // Calculate read position with pitch shift factor
       let readIdx = Math.floor(this.readPos);
       let frac = this.readPos - readIdx;
       
       // Linear interpolation
       let val1 = this.buffer[readIdx % this.buffer.length];
       let val2 = this.buffer[(readIdx + 1) % this.buffer.length];
       let outVal = val1 + frac * (val2 - val1);
       
       channelOut[i] = outVal;

       this.writePos = (this.writePos + 1) % this.buffer.length;
       this.readPos = (this.readPos + this.pitchShiftingRatio);

       // Keep readPos constrained closely to writePos to minimize latency
       let diff = this.writePos - this.readPos;
       if (diff < 0) diff += this.buffer.length;
       
       if (diff > this.sampleRate * 0.1 || diff < this.sampleRate * 0.02) {
          this.readPos = this.writePos - (this.sampleRate * 0.05);
          if (this.readPos < 0) this.readPos += this.buffer.length;
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
  public retuneSpeed = 50; // 0 (slow) to 100 (fast)
  public scale: string[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']; 
  private allowedMidiNotes: number[] = [];

  constructor() {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.nativeContext = new AudioCtx({ sampleRate: 48000 });
    this.outputDest = this.nativeContext.createMediaStreamDestination();
    this.outputStream = this.outputDest.stream;
    
    this.generateAllowedNotes();
  }

  public setScale(key: string, scaleType: string) {
     this.scale = [key]; 
     this.generateAllowedNotes();
  }

  private generateAllowedNotes() {
    this.allowedMidiNotes = [];
    for (let i = 20; i < 100; i++) {
       this.allowedMidiNotes.push(i);
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
}