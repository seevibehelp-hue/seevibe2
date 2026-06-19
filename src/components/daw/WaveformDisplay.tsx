// @ts-nocheck
/**
 * WaveformDisplay.tsx
 *
 * Three exports used across the DAW timeline:
 *
 *   WaveformCanvas       — static canvas waveform for finished clips.
 *   LiveWaveformCanvas   — grows in real-time while recording (no React
 *                          state updates during rAF — DOM-direct only).
 *   extractPeaksFromUrl  — decode an audio URL and return a normalised
 *                          peak array for imported samples.
 */
import React, { useRef, useEffect } from 'react';
import * as Tone from 'tone';
import { useDawStore } from '../../store/useDawStore';
import { audioEngine } from '../../audio/engine';

// ---------------------------------------------------------------------------
// WaveformCanvas
// Renders a symmetric, centred waveform bar chart onto a <canvas>.
// peaks  — normalised 0-1 amplitude array (recordingPeaks from DawClip)
// color  — hex / rgba string used for the bars (defaults to white)
// ---------------------------------------------------------------------------
interface WaveformCanvasProps {
  peaks: number[];
  color?: string;
}

export function WaveformCanvas({ peaks, color = '#ffffff' }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!peaks || peaks.length === 0) return;

    function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const parent = canvas.parentElement;
      const W = parent ? parent.offsetWidth : canvas.offsetWidth;
      const H = parent ? parent.offsetHeight : canvas.offsetHeight;
      if (W < 1 || H < 1) return;

      canvas.width = W;
      canvas.height = H;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, W, H);

      const centerY = H / 2;

      // Thin centre baseline — shows the clip boundary even in total silence
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(0, centerY - 0.5, W, 1);

      // Bars — symmetric from centre, height proportional to amplitude
      // Downsample so we never draw more bars than pixels allow
      const numBars = Math.min(peaks.length, Math.max(4, Math.floor(W / 1.5)));
      const step = peaks.length / numBars;
      const barW = W / numBars;

      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      for (let i = 0; i < numBars; i++) {
        const p = peaks[Math.floor(i * step)];
        // Minimum 1.5 px so every bar is visible even at near-zero
        const barH = Math.max(1.5, p * (H - 6));
        ctx.fillRect(
          i * barW + 0.25,
          centerY - barH / 2,
          Math.max(1, barW - 0.5),
          barH,
        );
      }
    }

    // Redraw on mount and whenever the container resizes (zoom changes)
    draw();
    const ro = new ResizeObserver(draw);
    const target = canvasRef.current?.parentElement ?? canvasRef.current;
    if (target) ro.observe(target);
    return () => ro.disconnect();
  }, [peaks]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}

// ---------------------------------------------------------------------------
// extractPeaksFromUrl
// Fetches an audio URL, decodes it via Web Audio, and returns a normalised
// peak array of `numBins` values (one RMS-peak per block).
// Returns [] on any error so callers can fall back gracefully.
// ---------------------------------------------------------------------------
export async function extractPeaksFromUrl(
  audioUrl: string,
  numBins = 300,
): Promise<number[]> {
  try {
    const res = await fetch(audioUrl);
    const arrayBuf = await res.arrayBuffer();
    // Offline context used only for decoding — 1 channel, 1 sample, any rate
    const ac = new OfflineAudioContext(1, 1, 44100);
    const decoded = await ac.decodeAudioData(arrayBuf);
    const raw = decoded.getChannelData(0);
    const blockSize = Math.max(1, Math.floor(raw.length / numBins));
    const peaks: number[] = [];
    for (let i = 0; i < numBins; i++) {
      let max = 0;
      const base = i * blockSize;
      for (let j = 0; j < blockSize; j++) {
        const v = Math.abs(raw[base + j] ?? 0);
        if (v > max) max = v;
      }
      peaks.push(max);
    }
    return peaks;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// LiveWaveformCanvas
// Animates via requestAnimationFrame and writes directly to the DOM so there
// are zero React re-renders during recording.  The clip container grows as
// the transport advances; the canvas waveform fills it in real time.
// ---------------------------------------------------------------------------
interface LiveWaveformCanvasProps {
  trackId: string;
  gridSize: number;
}

export function LiveWaveformCanvas({ trackId, gridSize }: LiveWaveformCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();

  useEffect(() => {
    function frame() {
      const state = useDawStore.getState();
      const el = containerRef.current;
      const canvas = canvasRef.current;

      const recording =
        state.isRecording &&
        state.selectedTrackId === trackId &&
        state.recordingStart16ths !== null;

      if (!recording) {
        if (el) el.style.display = 'none';
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      // --- clip geometry ---
      const ticks =
        Tone.Transport.state === 'started'
          ? Tone.Transport.ticks
          : state.transportPosition * 48;
      const current16ths = ticks / 48;
      const duration16ths = Math.max(0.25, current16ths - state.recordingStart16ths);
      const leftPx = state.recordingStart16ths * gridSize;
      const widthPx = Math.max(gridSize, duration16ths * gridSize);

      if (el) {
        el.style.display = 'block';
        el.style.left = `${leftPx}px`;
        el.style.width = `${widthPx}px`;
      }

      // --- waveform canvas ---
      if (canvas) {
        const peaks = audioEngine.getLivePeaksForTrack(trackId);
        const W = Math.ceil(widthPx);
        const H = canvas.offsetHeight || 56;

        // Only reset canvas dimensions when they meaningfully grow to avoid flicker
        if (canvas.width < W || canvas.width > W + 300 || canvas.height !== H) {
          canvas.width = W + 200; // slight buffer avoids frequent resets
          canvas.height = H;
        }

        const ctx2d = canvas.getContext('2d');
        if (!ctx2d) {
          rafRef.current = requestAnimationFrame(frame);
          return;
        }

        ctx2d.clearRect(0, 0, canvas.width, H);

        const centerY = H / 2;

        // Centre line — always visible so the clip boundary is clear
        ctx2d.fillStyle = 'rgba(239,68,68,0.30)';
        ctx2d.fillRect(0, centerY - 0.5, W, 1);

        if (peaks.length > 0) {
          const numBars = Math.min(peaks.length, Math.max(4, Math.floor(W / 1.5)));
          const step = peaks.length / numBars;
          const barW = W / numBars;

          ctx2d.fillStyle = 'rgba(239,68,68,0.88)';
          for (let i = 0; i < numBars; i++) {
            const p = peaks[Math.floor(i * step)];
            const barH = Math.max(1.5, p * (H - 6));
            ctx2d.fillRect(
              i * barW + 0.25,
              centerY - barH / 2,
              Math.max(1, barW - 0.5),
              barH,
            );
          }
        }
      }

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [trackId, gridSize]);

  return (
    <div
      ref={containerRef}
      className="absolute top-2 bottom-2 z-20 pointer-events-none overflow-hidden rounded border border-red-500/40 bg-red-500/5"
      style={{ display: 'none' }}
    >
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
