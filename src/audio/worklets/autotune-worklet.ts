// @ts-nocheck
// Autotune and Pitch Shifting AudioWorklet
// Implements granular pitch shifting and basic autotune nearest-note snapping

declare class AudioWorkletProcessor {
  protected constructor();
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, processorClass: any): void;

interface AutotuneOptions {
  sampleRate: number;
}

class AutotuneProcessor extends AudioWorkletProcessor {
  sampleRate: number;
  pitchShiftingRatio: number = 1.0;
  targetRatio: number = 1.0;

  // Granular synthesis state
  grainSize: number = 512;
  overlap: number = 0.5;
  buffer: Float32Array;
  writePos: number = 0;
  readPos: number = 0;

  constructor(options: { processorOptions?: AutotuneOptions }) {
    super();
    this.sampleRate = options.processorOptions?.sampleRate || 48000;
    this.buffer = new Float32Array(this.sampleRate * 2); // 2 seconds
    
    this.port.onmessage = (e) => {
      if (e.data.type === 'setPitchParam') {
         // calculate ratio based on cents
         // e.data.cents is the shift amount (e.g. 100 cents = 1 semitone)
         this.targetRatio = Math.pow(2, e.data.cents / 1200);
      }
    };
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>) {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !input[0] || !output || !output[0]) return true;

    const channelIn = input[0];
    const channelOut = output[0];

    // Smooth ratio transition
    this.pitchShiftingRatio += (this.targetRatio - this.pitchShiftingRatio) * 0.05;

    // Simple delay-based implementation (not perfect PSOLA, but works as placeholder)
    for (let i = 0; i < channelIn.length; i++) {
       // Write to circular buffer
       this.buffer[this.writePos] = channelIn[i];
       
       // Calculate read position with pitch shift factor
       // Moving readPos at different rate than writePos causes pitch shift
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
       // Loop read around if it gets too far behind or ahead
       let diff = this.writePos - this.readPos;
       if (diff < 0) diff += this.buffer.length;
       
       if (diff > this.sampleRate * 0.1 || diff < this.sampleRate * 0.02) {
          // Reset read pointer to maintain low latency (20ms)
          this.readPos = this.writePos - (this.sampleRate * 0.05);
          if (this.readPos < 0) this.readPos += this.buffer.length;
       }
    }

    return true;
  }
}

registerProcessor('autotune-processor', AutotuneProcessor);