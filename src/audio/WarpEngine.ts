// @ts-nocheck
import * as Tone from 'tone';

/**
 * AI Vocal-Sync WarpEngine (Waveshaping Overlap-Add WSOLA & Transient Detection DSP)
 * Provides high-performance client-side elastic audio time-stretching without pitch shifts,
 * transient analysis, and vocal pitch/key estimation metadata matching.
 */

export interface TransientPoint {
  index: number;
  time: number;
  confidence: number;
}

// ---------------------------------------------------------------------------
// WSOLA Web Worker source — inlined as a Blob so no extra build artefact is
// needed.  The worker receives transferable Float32Arrays (zero-copy) and
// returns the stretched channel data the same way.
// ---------------------------------------------------------------------------
const wsolaWorkerSource = `
self.onmessage = function(e) {
  const { channels, inputLen, outputLen, sampleRate, ratio, windowSize, hs, ha, searchRange } = e.data;

  const windowVec = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    windowVec[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
  }

  const outputChannels = [];
  const targetTemplate = new Float32Array(searchRange);

  for (let c = 0; c < channels.length; c++) {
    const inputData = channels[c];
    const outputData = new Float32Array(outputLen);
    const scaleBuffer = new Float32Array(outputLen);

    let outIdx = 0;
    let inIdx = 0;

    if (outIdx + windowSize <= outputLen && inIdx + windowSize <= inputLen) {
      for (let i = 0; i < windowSize; i++) {
        outputData[outIdx + i] += inputData[inIdx + i] * windowVec[i];
        scaleBuffer[outIdx + i] += windowVec[i];
      }
    }
    outIdx += hs;
    inIdx += ha;

    while (outIdx + windowSize < outputLen && inIdx + windowSize < inputLen) {
      const prevSynthOffset = outIdx - hs;
      for (let i = 0; i < searchRange; i++) {
        const idx = prevSynthOffset + hs + i;
        targetTemplate[i] = idx < outputLen ? outputData[idx] : 0;
      }

      let bestShift = 0;
      let maxCorrelation = -Infinity;
      for (let s = -searchRange; s <= searchRange; s++) {
        const candidateStart = inIdx + s;
        if (candidateStart < 0 || candidateStart + windowSize >= inputLen) continue;
        let correlationSum = 0, candidateEnergy = 0, templateEnergy = 0;
        for (let i = 0; i < searchRange; i++) {
          const cv = inputData[candidateStart + i];
          const tv = targetTemplate[i];
          correlationSum += cv * tv;
          candidateEnergy += cv * cv;
          templateEnergy += tv * tv;
        }
        const rValue = templateEnergy > 0 && candidateEnergy > 0
          ? correlationSum / Math.sqrt(candidateEnergy * templateEnergy)
          : correlationSum;
        if (rValue > maxCorrelation) { maxCorrelation = rValue; bestShift = s; }
      }

      const alignedInIdx = inIdx + bestShift;
      for (let i = 0; i < windowSize; i++) {
        if (outIdx + i < outputLen && alignedInIdx + i < inputLen) {
          outputData[outIdx + i] += inputData[alignedInIdx + i] * windowVec[i];
          scaleBuffer[outIdx + i] += windowVec[i];
        }
      }
      outIdx += hs;
      inIdx += ha;
    }

    for (let i = 0; i < outputLen; i++) {
      if (scaleBuffer[i] > 1e-4) outputData[i] /= scaleBuffer[i];
    }
    outputChannels.push(outputData);
  }

  // Transfer all output arrays back (zero-copy)
  self.postMessage({ outputChannels }, outputChannels.map(a => a.buffer));
};
`;

let _wsolaWorkerUrl: string | null = null;
function getWsolaWorkerUrl(): string {
  if (!_wsolaWorkerUrl) {
    _wsolaWorkerUrl = URL.createObjectURL(
      new Blob([wsolaWorkerSource], { type: 'application/javascript' })
    );
  }
  return _wsolaWorkerUrl;
}

/**
 * Async WSOLA time-stretch — runs the algorithm in a Web Worker so the main
 * thread is never blocked.  Previously this ran synchronously and stalled the
 * UI for hundreds of milliseconds on long clips.
 *
 * Ratio > 1.0 speeds up (shorter output), ratio < 1.0 slows down (longer).
 */
export async function stretchAudioBuffer(
  audioContext: AudioContext,
  originalBuffer: AudioBuffer,
  ratio: number
): Promise<AudioBuffer> {
  if (ratio === 1 || ratio <= 0 || isNaN(ratio)) {
    return originalBuffer;
  }

  const numChannels = originalBuffer.numberOfChannels;
  const sampleRate = originalBuffer.sampleRate;
  const inputLen = originalBuffer.length;
  const outputLen = Math.round(inputLen / ratio);

  const windowSize = 2048;
  const hs = 512;
  const ha = Math.round(hs * ratio);
  const searchRange = 256;

  // Copy channel data into plain Float32Arrays for transferable postMessage
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(originalBuffer.getChannelData(c).slice());
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(getWsolaWorkerUrl());
    worker.onmessage = (e) => {
      worker.terminate();
      try {
        const stretchedBuffer = audioContext.createBuffer(numChannels, outputLen, sampleRate);
        e.data.outputChannels.forEach((ch: Float32Array, i: number) => {
          stretchedBuffer.getChannelData(i).set(ch);
        });
        resolve(stretchedBuffer);
      } catch (err) {
        reject(err);
      }
    };
    worker.onerror = (err) => { worker.terminate(); reject(err); };
    worker.postMessage(
      { channels, inputLen, outputLen, sampleRate, ratio, windowSize, hs, ha, searchRange },
      channels.map(c => c.buffer)
    );
  });
}

/**
 * Sub-band Transient Energy Meter (Downbeat Transient Detector)
 * Analyzes audio amplitude levels over custom window intervals to detect rhythmic downbeats and peaks
 */
export function detectTransients(
  originalBuffer: AudioBuffer,
  thresholdMultiplier = 1.35
): TransientPoint[] {
  const channelData = originalBuffer.getChannelData(0); // Analyze mono
  const sampleRate = originalBuffer.sampleRate;
  const length = channelData.length;

  const frameSize = 512; // ~11ms
  const hopSize = 256;   // 50% overlap

  const energyArray: number[] = [];
  const timeArray: number[] = [];

  // Compute energy for each frame
  for (let i = 0; i < length - frameSize; i += hopSize) {
    let sum = 0;
    for (let j = 0; j < frameSize; j++) {
      sum += channelData[i + j] * channelData[i + j];
    }
    energyArray.push(Math.sqrt(sum / frameSize));
    timeArray.push(i / sampleRate);
  }

  // Find local peaks in frame energies compared to moving average
  const transientPoints: TransientPoint[] = [];
  const localBands = 14;

  for (let i = localBands; i < energyArray.length - localBands; i++) {
    const current = energyArray[i];

    // Compute surrounding local mean energy
    let sumLocal = 0;
    for (let b = -localBands; b <= localBands; b++) {
      sumLocal += energyArray[i + b];
    }
    const localMean = sumLocal / (localBands * 2 + 1);

    // If energy sudden rise is higher than threshold and represents local maximum, mark transient
    if (current > localMean * thresholdMultiplier && current > 0.05) {
      // Confirm local maximum in immediate frame neighbors
      let isMax = true;
      for (let n = -2; n <= 2; n++) {
        if (energyArray[i + n] > current) {
          isMax = false;
          break;
        }
      }

      if (isMax) {
        transientPoints.push({
          index: i * hopSize,
          time: timeArray[i],
          confidence: current / (localMean + 1e-5)
        });
      }
    }
  }

  return transientPoints;
}

/**
 * Calculates estimated native vocal BPM based on average tempo transients
 */
export function estimateVocalBpm(
  originalBuffer: AudioBuffer,
  defaultBpm = 115
): number {
  const transients = detectTransients(originalBuffer, 1.25);
  if (transients.length < 3) return defaultBpm;

  // Calculate intervals
  const intervals: number[] = [];
  for (let i = 1; i < transients.length; i++) {
    intervals.push(transients[i].time - transients[i - 1].time);
  }

  // Bundle closest intervals to estimate candidate BPMs
  const candidates = intervals.map(inv => 60 / inv).filter(bpm => bpm >= 70 && bpm <= 160);
  if (candidates.length === 0) return defaultBpm;

  // Simple histogram search
  let bestBpm = defaultBpm;
  let maxVotes = 0;

  for (const match of candidates) {
    let votes = 0;
    for (const b of candidates) {
      if (Math.abs(b - match) <= 4.0 || Math.abs(b * 2 - match) <= 4.0 || Math.abs(b / 2 - match) <= 4.0) {
        votes++;
      }
    }
    if (votes > maxVotes) {
      maxVotes = votes;
      bestBpm = match;
    }
  }

  // Normalize octave boundary
  while (bestBpm < 85) bestBpm *= 2;
  while (bestBpm > 155) bestBpm /= 2;

  return Math.round(bestBpm);
}