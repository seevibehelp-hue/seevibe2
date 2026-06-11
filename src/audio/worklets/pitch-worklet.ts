// @ts-nocheck
// Custom implementation of YIN pitch tracking for AudioWorklet
// Runs on the audio thread for real-time performance without blocking the main UI

declare class AudioWorkletProcessor {
  protected constructor();
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, processorClass: any): void;

class PitchProcessor extends AudioWorkletProcessor {
  bufferSize = 2048;
  buffer = new Float32Array(2048);
  bufferIndex = 0;
  sampleRate = 48000;
  threshold = 0.1;

  constructor(options) {
    super();
    this.sampleRate = options.processorOptions?.sampleRate || 48000;
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
          this.bufferIndex = 0; // Shift or reset? Reset for simplicity, though overlap is better
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