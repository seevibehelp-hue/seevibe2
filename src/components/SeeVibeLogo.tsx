// @ts-nocheck
import React from 'react';

interface SeeVibeLogoProps {
  variant?: 'full' | 'icon' | 'lockup';
  size?: number;
  className?: string;
}

/**
 * SeeVibeLogo — dark squircle with golden diamond waveform
 * and a glossy black center sphere with golden crescent.
 *
 * Variant 'icon'   → just the mark (square).
 * Variant 'lockup' → mark + "SeeVibe" wordmark.
 * Variant 'full'   → mark + "SeeVibe" + "CREATE. COLLAB. EARN." tagline.
 */
export function SeeVibeLogo({
  variant = 'full',
  size = 48,
  className = '',
}: SeeVibeLogoProps) {
  const width = variant === 'icon' ? size : size * 2.5;
  const height = size;

  // Build the diamond-shaped waveform bars.
  // 23 vertical bars centered on x=60; heights form a diamond.
  const barWidth = 2.8;
  const barCount = 23;
  const startX = 18;
  const spacing = 3.7;
  const maxHeight = 62;
  const centerY = 60;

  const bars: Array<{ x: number; y: number; h: number; op: number }> = [];
  for (let i = 0; i < barCount; i++) {
    const x = startX + i * spacing;
    const dist = Math.abs(x - 60);
    // Smooth diamond falloff so the diamond has slightly rounded edges.
    const h = Math.max(3, maxHeight - dist * 1.7);
    if (h <= 3) continue;
    const y = centerY - h / 2;
    // Subtle opacity falloff toward the edges for depth.
    const op = 1 - Math.max(0, (dist - 28) / 30) * 0.6;
    bars.push({ x, y, h, op: Math.max(0.4, op) });
  }

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <svg
        id="svg-seevibe-emblem"
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <defs>
          {/* Dark squircle base — slight inner glow toward top */}
          <radialGradient id="sv-bg" cx="50%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#26262c" />
            <stop offset="55%" stopColor="#15151a" />
            <stop offset="100%" stopColor="#08080b" />
          </radialGradient>

          {/* Outer highlight stroke (very subtle) */}
          <linearGradient id="sv-edge" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3a3a42" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#1a1a20" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0a0a0d" stopOpacity="0.9" />
          </linearGradient>

          {/* Golden/amber gradient for bars */}
          <linearGradient id="sv-bar" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffe28a" />
            <stop offset="45%" stopColor="#f5b942" />
            <stop offset="100%" stopColor="#b87412" />
          </linearGradient>

          {/* Bright core for inner glow halo */}
          <linearGradient id="sv-bar-glow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fff2c0" />
            <stop offset="100%" stopColor="#ffb84d" />
          </linearGradient>

          {/* Glossy black sphere */}
          <radialGradient id="sv-sphere" cx="38%" cy="32%" r="78%">
            <stop offset="0%" stopColor="#4a4a52" />
            <stop offset="35%" stopColor="#1d1d22" />
            <stop offset="75%" stopColor="#0a0a0d" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>

          {/* Sphere outer rim highlight */}
          <radialGradient id="sv-rim" cx="50%" cy="50%" r="50%">
            <stop offset="80%" stopColor="#000000" stopOpacity="0" />
            <stop offset="95%" stopColor="#3a3a40" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>

          {/* Golden crescent reflection — bright at top of arc, fades to amber */}
          <radialGradient id="sv-crescent" cx="50%" cy="20%" r="65%">
            <stop offset="0%" stopColor="#fff5cc" stopOpacity="1" />
            <stop offset="35%" stopColor="#ffd24a" stopOpacity="0.95" />
            <stop offset="70%" stopColor="#f5a623" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#a85f0a" stopOpacity="0" />
          </radialGradient>

          {/* Specular highlight on sphere */}
          <radialGradient id="sv-spec" cx="38%" cy="26%" r="38%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>

          {/* Soft glow filter for the bars */}
          <filter id="sv-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>

          {/* Stronger glow for inner halo behind bars */}
          <filter id="sv-halo" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>
        </defs>

        {/* 1. Squircle background */}
        <rect
          x="3"
          y="3"
          width="114"
          height="114"
          rx="26"
          ry="26"
          fill="url(#sv-bg)"
        />
        {/* Subtle outer edge highlight */}
        <rect
          x="3"
          y="3"
          width="114"
          height="114"
          rx="26"
          ry="26"
          fill="none"
          stroke="url(#sv-edge)"
          strokeWidth="1"
        />

        {/* 2. Halo behind bars (soft glow) */}
        <g filter="url(#sv-halo)" opacity="0.55">
          {bars.map((b, i) => (
            <rect
              key={`halo-${i}`}
              x={b.x - barWidth / 2}
              y={b.y - 1}
              width={barWidth}
              height={b.h + 2}
              rx={barWidth / 2}
              fill="url(#sv-bar-glow)"
            />
          ))}
        </g>

        {/* 3. Inner glow row (slightly blurred) */}
        <g filter="url(#sv-glow)" opacity="0.85">
          {bars.map((b, i) => (
            <rect
              key={`glow-${i}`}
              x={b.x - barWidth / 2}
              y={b.y}
              width={barWidth}
              height={b.h}
              rx={barWidth / 2}
              fill="url(#sv-bar)"
            />
          ))}
        </g>

        {/* 4. Solid bar row */}
        <g>
          {bars.map((b, i) => (
            <rect
              key={`bar-${i}`}
              x={b.x - barWidth / 2}
              y={b.y}
              width={barWidth}
              height={b.h}
              rx={barWidth / 2}
              fill="url(#sv-bar)"
              opacity={b.op}
            />
          ))}
        </g>

        {/* 5. Center sphere — clipped by sphere outline so crescent sits inside */}
        <g>
          {/* Sphere body */}
          <circle cx="60" cy="60" r="22" fill="url(#sv-sphere)" />
          {/* Rim ring (very faint) */}
          <circle cx="60" cy="60" r="22.5" fill="url(#sv-rim)" />
          {/* Crescent highlight — bright arc/smile shape at the lower half of the sphere */}
          <path
            d="M 40 62
               C 42 78, 56 84, 62 84
               C 70 84, 80 78, 80 60
               C 78 70, 70 76, 60 76
               C 50 76, 44 70, 40 62 Z"
            fill="url(#sv-crescent)"
            opacity="1"
          />
          {/* Soft outer halo around the crescent */}
          <ellipse
            cx="60"
            cy="74"
            rx="22"
            ry="9"
            fill="url(#sv-crescent)"
            opacity="0.45"
          />
          {/* Secondary thinner highlight arc */}
          <path
            d="M 44 66
               C 48 76, 58 80, 64 80"
            stroke="#fff0b0"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
            opacity="0.85"
          />
          {/* Specular highlight on upper-left */}
          <ellipse
            cx="52"
            cy="50"
            rx="9"
            ry="6"
            fill="url(#sv-spec)"
          />
          {/* Tiny pinpoint specular dot */}
          <circle cx="51" cy="48" r="1.6" fill="#ffffff" opacity="0.7" />
        </g>
      </svg>

      {/* Wordmark for lockup/full */}
      {(variant === 'full' || variant === 'lockup') && (
        <div className="flex flex-col justify-center select-none">
          <div className="flex items-baseline font-sans text-white tracking-wide">
            <span className="text-xl font-bold font-sans">See</span>
            <span
              className="text-xl font-extrabold font-sans ml-[1px]"
              style={{
                background:
                  'linear-gradient(135deg, #f5b942 0%, #ff8c1a 50%, #b87412 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Vibe
            </span>
          </div>
          {variant === 'full' && (
            <span className="text-[7.5px] font-mono uppercase tracking-[0.25em] text-zinc-500 mt-0.5 font-bold">
              CREATE. COLLAB. EARN.
            </span>
          )}
        </div>
      )}
    </div>
  );
}