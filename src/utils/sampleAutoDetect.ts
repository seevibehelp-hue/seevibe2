// Auto-detects BPM and musical key from an AudioBuffer using simple DSP heuristics.
// - BPM: onset autocorrelation on a flux signal across plausible tempos (60-180).
// - Key: 12-bin chroma + Krumhansl-Schmuckler key profile correlation.
// Returns best-effort estimates; admin can override before saving.

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl-Schmuckler key profiles (normalized later via correlation)
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function correlate(a: number[], b: number[]): number {
  const n = a.length;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const va = a[i] - ma, vb = b[i] - mb;
    num += va * vb; da += va * va; db += vb * vb;
  }
  const denom = Math.sqrt(da * db);
  return denom > 0 ? num / denom : 0;
}

function detectKey(buffer: AudioBuffer): { key: string; scale: 'major' | 'minor'; label: string } {
  const sr = buffer.sampleRate;
  const data = buffer.getChannelData(0);
  const fftSize = 4096;
  const hop = 2048;
  const chroma = new Array(12).fill(0);

  // Simple Goertzel-based pitch class energy across the file
  // Use 5 octaves of fundamentals C2..B6 -> midi 36..95
  const freqs: number[] = [];
  const pcs: number[] = [];
  for (let m = 36; m <= 95; m++) {
    freqs.push(440 * Math.pow(2, (m - 69) / 12));
    pcs.push(m % 12);
  }

  const coeffs = freqs.map(f => 2 * Math.cos((2 * Math.PI * f) / sr));

  for (let pos = 0; pos + fftSize < data.length; pos += hop) {
    for (let k = 0; k < freqs.length; k++) {
      let s0 = 0, s1 = 0, s2 = 0;
      const c = coeffs[k];
      for (let i = 0; i < fftSize; i++) {
        s0 = data[pos + i] + c * s1 - s2;
        s2 = s1; s1 = s0;
      }
      const power = s1 * s1 + s2 * s2 - c * s1 * s2;
      if (power > 0) chroma[pcs[k]] += Math.sqrt(power);
    }
  }

  let bestKey = 0, bestScale: 'major' | 'minor' = 'major', bestCorr = -Infinity;
  for (let shift = 0; shift < 12; shift++) {
    const rotated = chroma.slice(shift).concat(chroma.slice(0, shift));
    const cMaj = correlate(rotated, MAJOR);
    const cMin = correlate(rotated, MINOR);
    if (cMaj > bestCorr) { bestCorr = cMaj; bestKey = shift; bestScale = 'major'; }
    if (cMin > bestCorr) { bestCorr = cMin; bestKey = shift; bestScale = 'minor'; }
  }

  const key = NOTE_NAMES[bestKey];
  return { key, scale: bestScale, label: bestScale === 'minor' ? `${key}m` : key };
}

function detectBpm(buffer: AudioBuffer): number {
  const sr = buffer.sampleRate;
  const data = buffer.getChannelData(0);
  const windowSize = 1024;
  const hop = 512;
  const fluxes: number[] = [];
  let prev = 0;
  for (let pos = 0; pos + windowSize < data.length; pos += hop) {
    let energy = 0;
    for (let i = 0; i < windowSize; i++) {
      const v = data[pos + i];
      energy += v * v;
    }
    energy = Math.sqrt(energy / windowSize);
    const flux = Math.max(0, energy - prev);
    fluxes.push(flux);
    prev = energy;
  }
  const fps = sr / hop;
  // Autocorrelate flux over plausible tempo lags
  let bestLag = 0, bestScore = -Infinity;
  const minBpm = 60, maxBpm = 180;
  const minLag = Math.floor(fps * 60 / maxBpm);
  const maxLag = Math.floor(fps * 60 / minBpm);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i + lag < fluxes.length; i++) s += fluxes[i] * fluxes[i + lag];
    if (s > bestScore) { bestScore = s; bestLag = lag; }
  }
  if (bestLag === 0) return 120;
  return Math.round((fps * 60) / bestLag);
}

export async function detectSampleMetadata(file: File): Promise<{
  bpm: number;
  key: string;
  scale: 'major' | 'minor';
  keyLabel: string;
  durationSec: number;
  bars: number;
  suggestedTitle: string;
}> {
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
  const ctx = new Ctx();
  const arrayBuf = await file.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arrayBuf.slice(0));
  const bpm = detectBpm(buffer);
  const keyInfo = detectKey(buffer);
  const durationSec = buffer.duration;
  // 1 bar = 4 beats; bars = (durationSec * bpm / 60) / 4
  const bars = Math.max(1, Math.round((durationSec * bpm) / 60 / 4));
  const title = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());
  try { await ctx.close(); } catch {}
  return {
    bpm,
    key: keyInfo.key,
    scale: keyInfo.scale,
    keyLabel: keyInfo.label,
    durationSec,
    bars,
    suggestedTitle: title || 'Untitled Sample',
  };
}
