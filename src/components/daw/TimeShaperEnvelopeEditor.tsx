// @ts-nocheck
import React, { useRef, useEffect, useState } from 'react';
import { Sparkles, Trash2, Undo } from 'lucide-react';

interface TimeShaperEnvelopeEditorProps {
  curve: number[];
  onChange: (newCurve: number[]) => void;
  mix: number;
}

export function TimeShaperEnvelopeEditor({ curve, onChange, mix }: TimeShaperEnvelopeEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Fallback defaults for curve if not fully populated
  const safeCurve = Array.isArray(curve) && curve.length === 16 
    ? curve 
    : [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

  const drawGridAndCurve = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background: retro dark slate-grey
    ctx.fillStyle = '#101010';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines: 16 vertical slices, 16 horizontal slices
    ctx.strokeStyle = 'rgba(0, 255, 90, 0.08)';
    ctx.lineWidth = 1;

    // Vertical lines
    for (let c = 0; c <= 16; c++) {
      const x = (width / 16) * c;
      // Highlight beat dividers (every 4 steps)
      if (c % 4 === 0) {
        ctx.strokeStyle = 'rgba(0, 255, 90, 0.18)';
        ctx.lineWidth = 1.5;
      } else {
        ctx.strokeStyle = 'rgba(0, 255, 90, 0.06)';
        ctx.lineWidth = 0.8;
      }
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines (0.0 to 1.0 vertical values)
    for (let r = 0; r <= 8; r++) {
      const y = (height / 8) * r;
      ctx.strokeStyle = r === 4 ? 'rgba(0, 255, 90, 0.15)' : 'rgba(0, 255, 90, 0.05)';
      ctx.lineWidth = r === 4 ? 1.2 : 0.8;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw the continuous envelope curve (glowing neon-green)
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(0, 255, 90, 0.8)';
    ctx.strokeStyle = '#00FF5A';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    safeCurve.forEach((val, index) => {
      // Index is column 0-15
      // X coordinate is centered on the step column
      const colWidth = width / 16;
      const x = colWidth * index + colWidth / 2;
      // Y coordinate: 1.0 is top (Y=0), 0.0 is bottom (Y=height)
      const y = height - (val * height);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Disable shadow blur for points and text
    ctx.shadowBlur = 0;

    // Draw small nodes/circles at each curve value
    safeCurve.forEach((val, index) => {
      const colWidth = width / 16;
      const x = colWidth * index + colWidth / 2;
      const y = height - (val * height);

      // Node core
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();

      // Node border
      ctx.strokeStyle = '#00FF5A';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, 2 * Math.PI);
      ctx.stroke();
    });
  };

  useEffect(() => {
    drawGridAndCurve();
  }, [curve, safeCurve]);

  // Handle drawing events on the canvas
  const handlePointerAction = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    // Calculate column step (0 to 15)
    let col = Math.floor((clientX / rect.width) * 16);
    if (col < 0) col = 0;
    if (col > 15) col = 15;

    // Calculate vertical amplitude ratio (0.0 to 1.0)
    let val = 1.0 - (clientY / rect.height);
    if (val < 0) val = 0;
    if (val > 1.0) val = 1.0;

    // Round value to nearest grid cell division for precision but keep continuous snap
    val = Math.round(val * 100) / 100;

    // Clone and emit changes
    const newCurve = [...safeCurve];
    newCurve[col] = val;
    onChange(newCurve);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    handlePointerAction(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawing) {
      handlePointerAction(e);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDrawing(false);
  };

  // Helper Preset Applications
  const applyPreset = (presetName: string) => {
    let pCurve = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
    switch (presetName) {
      case 'flat':
        pCurve = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
        break;
      case 'halftime':
        // Smooth linear downward ramp representing slowdown
        pCurve = [1, 0.93, 0.86, 0.8, 0.73, 0.66, 0.6, 0.53, 0.46, 0.4, 0.33, 0.26, 0.2, 0.13, 0.05, 0];
        break;
      case 'trance':
        // Classic trance 16th staccato gate-chopping pattern
        pCurve = [1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0];
        break;
      case 'pump':
        // Dynamic pumping sidechain duck curve: dunks hard on beats (0, 4, 8, 12) and ramps up
        pCurve = [0, 0.4, 0.8, 1.0, 0, 0.4, 0.8, 1.0, 0, 0.4, 0.8, 1.0, 0, 0.4, 0.8, 1.0];
        break;
      case 'snareRoll':
        // Rhythmic building gating
        pCurve = [1, 0.5, 1, 0.5, 1, 0.7, 1, 0.7, 1, 0.9, 1, 0.9, 1, 1, 1, 1];
        break;
      case 'vinylstop':
        // Vinyl scratch stop: stays full then drops like a rock at the end
        pCurve = [1, 1, 1, 1, 1, 1, 1, 1, 0.9, 0.8, 0.65, 0.5, 0.35, 0.2, 0.05, 0];
        break;
      default:
        break;
    }
    onChange(pCurve);
  };

  return (
    <div className="bg-black/40 border border-white/5 rounded-lg p-2.5 space-y-3.5">
      <div className="flex justify-between items-center">
        <span className="text-[9px] font-bold text-gray-400 font-mono tracking-wider flex items-center gap-1">
          <Sparkles size={11} className="text-[#00FF5A]" /> ENVELOPE SHAPER GRID (16x16)
        </span>
        <button 
          onClick={() => applyPreset('flat')}
          className="text-[9px] text-[#00FF5A] hover:bg-[#00FF5A]/10 border border-[#00FF5A]/20 px-1.5 py-0.5 rounded font-mono uppercase"
          title="Reset back to bypass"
        >
          Reset Curve
        </button>
      </div>

      <div className="relative flex justify-center">
        <canvas
          ref={canvasRef}
          width={240}
          height={140}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="rounded border border-neutral-800 touch-none cursor-crosshair shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]"
        />
        {/* Playback step tracker layer or indicator can go here */}
      </div>

      <div>
        <span className="text-[8px] text-gray-500 font-bold font-mono block mb-1.5 tracking-widest uppercase">
          Gross Beat Preset Curves
        </span>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: 'halftime', name: 'Slow Down' },
            { id: 'vinylstop', name: 'Tape Stop' },
            { id: 'pump', name: 'Pump LFO' },
            { id: 'trance', name: 'Trance Gate' },
            { id: 'snareRoll', name: 'Roll Gate' },
            { id: 'flat', name: 'Clear Clean' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => applyPreset(item.id)}
              className="px-1.5 py-1 text-[8px] font-mono hover:text-[#00FF5A] hover:bg-neutral-900 border border-white/5 rounded text-gray-400 font-semibold uppercase bg-neutral-950/60 transition-colors"
            >
              {item.name}
            </button>
          ))}
        </div>
      </div>
      <div className="text-[8px] text-gray-500 font-mono leading-normal">
        * Drag to write envelope peaks. In <b className="text-gray-300">CUSTOM</b> mode, this maps directly to real-time gating chops and vinyl-scratch glides.
      </div>
    </div>
  );
}