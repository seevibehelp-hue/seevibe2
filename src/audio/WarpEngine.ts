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

/**
 * Simple Waveform Similarity Overlap-Add (WSOLA) implementation
 * Stretches or squeezes an AudioBuffer by a factor of 'ratio' without altering the pitch.
 * Ratio > 1.0 Speeds up the audio (makes it shorter)
 * Ratio < 1.0 Slows down the audio (makes it longer)
 */
export function stretchAudioBuffer(
  audioContext: AudioContext,
  originalBuffer: AudioBuffer,
  ratio: number
): AudioBuffer {
  if (ratio === 1 || ratio <= 0 || isNaN(ratio)) {
    return originalBuffer; // No stretching needed or invalid
  }

  const numChannels = originalBuffer.numberOfChannels;
  const sampleRate = originalBuffer.sampleRate;
  const inputLen = originalBuffer.length;
  const outputLen = Math.round(inputLen / ratio);

  // Re-create a fresh buffer with correct length
  const stretchedBuffer = audioContext.createBuffer(numChannels, outputLen, sampleRate);

  // Parameters for WSOLA
  const windowSize = 2048; // Standard 46ms window
  const hs = 512;          // Synthesis Hop Size
  const ha = Math.round(hs * ratio); // Analysis Hop Size
  const searchRange = 256; // Dynamic range around target index to search for phase alignment

  // Pre-generate Hanning window to prevent transient pops on edge overlays
  const windowVec = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    windowVec[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (windowSize - 1)));
  }

  // Work variables
  const candidate = new Float32Array(windowSize);
  const targetTemplate = new Float32Array(searchRange);

  for (let c = 0; c < numChannels; c++) {
    const inputData = originalBuffer.getChannelData(c);
    const outputData = stretchedBuffer.getChannelData(c);
    const scaleBuffer = new Float32Array(outputLen); // Holds normalization coefficients for overlap sum

    let outIdx = 0;
    let inIdx = 0;

    // First frame overlap-add (Bootstrap phase)
    if (outIdx + windowSize <= outputLen && inIdx + windowSize <= inputLen) {
      for (let i = 0; i < windowSize; i++) {
        outputData[outIdx + i] += inputData[inIdx + i] * windowVec[i];
        scaleBuffer[outIdx + i] += windowVec[i];
      }
    }

    outIdx += hs;
    inIdx += ha;

    // Main WSOLA overlap loop with cross-correlation phase correlation locks
    while (outIdx + windowSize < outputLen && inIdx + windowSize < inputLen) {
      // Find the ideal shift 's' in [-searchRange, searchRange] using phase correlation template matching
      // We correlate the tail of the previous synthesized segment with alternative input frames starting near target.
      const prevSynthOffset = outIdx - hs;
      
      // Copy target template (previous synthesis overlapping segments for similarity matching)
      for (let i = 0; i < searchRange; i++) {
        const idx = prevSynthOffset + hs + i;
        targetTemplate[i] = idx < outputLen ? outputData[idx] : 0;
      }

      let bestShift = 0;
      let maxCorrelation = -Infinity;

      // Scan search range for highest waveform correlation
      for (let s = -searchRange; s <= searchRange; s++) {
        const candidateStart = inIdx + s;
        if (candidateStart < 0 || candidateStart + windowSize >= inputLen) continue;

        let correlationSum = 0;
        let candidateEnergy = 0;
        let templateEnergy = 0;

        for (let i = 0; i < searchRange; i++) {
          const candVal = inputData[candidateStart + i];
          const tempVal = targetTemplate[i];

          correlationSum += candVal * tempVal;
          candidateEnergy += candVal * candVal;
          templateEnergy += tempVal * tempVal;
        }

        // Normalized correlation score calculation
        const rValue = templateEnergy > 0 && candidateEnergy > 0 
          ? correlationSum / Math.sqrt(candidateEnergy * templateEnergy)
          : correlationSum;

        if (rValue > maxCorrelation) {
          maxCorrelation = rValue;
          bestShift = s;
        }
      }

      // Extract alignment-locked frame
      const alignedInIdx = inIdx + bestShift;

      // Overlap-add the Hanning windowed aligned frame into output
      for (let i = 0; i < windowSize; i++) {
        if (outIdx + i < outputLen && alignedInIdx + i < inputLen) {
          outputData[outIdx + i] += inputData[alignedInIdx + i] * windowVec[i];
          scaleBuffer[outIdx + i] += windowVec[i];
        }
      }

      outIdx += hs;
      inIdx += ha;
    }

    // Post-normalization pass to smooth level variances due to variable hops
    for (let i = 0; i < outputLen; i++) {
      if (scaleBuffer[i] > 1e-4) {
        outputData[i] /= scaleBuffer[i];
      }
    }
  }

  return stretchedBuffer;
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