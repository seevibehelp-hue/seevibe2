// Lightweight peak extraction for waveform rendering.
// Returns an array of normalized [0..1] amplitude buckets.

export function extractPeaks(buffer: AudioBuffer, buckets = 512): number[] {
  if (!buffer) return [];
  const channelCount = buffer.numberOfChannels;
  const total = buffer.length;
  const samplesPerBucket = Math.max(1, Math.floor(total / buckets));
  const peaks = new Array<number>(buckets).fill(0);

  // Combine all channels (mono mix) for visualization
  const channels: Float32Array[] = [];
  for (let c = 0; c < channelCount; c++) channels.push(buffer.getChannelData(c));

  for (let b = 0; b < buckets; b++) {
    const start = b * samplesPerBucket;
    const end = Math.min(total, start + samplesPerBucket);
    let peak = 0;
    for (let i = start; i < end; i++) {
      let mix = 0;
      for (let c = 0; c < channelCount; c++) mix += Math.abs(channels[c][i]);
      mix /= channelCount;
      if (mix > peak) peak = mix;
    }
    peaks[b] = Math.min(1, peak);
  }

  // Normalize so the loudest sample reaches ~1
  const maxPeak = peaks.reduce((m, v) => Math.max(m, v), 0);
  if (maxPeak > 0 && maxPeak < 0.9) {
    const scale = 0.95 / maxPeak;
    for (let i = 0; i < peaks.length; i++) peaks[i] = Math.min(1, peaks[i] * scale);
  }
  return peaks;
}
