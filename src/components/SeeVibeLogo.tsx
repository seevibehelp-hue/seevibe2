// @ts-nocheck
import React from 'react';

interface SeeVibeLogoProps {
  variant?: 'full' | 'icon' | 'lockup';
  size?: number;
  className?: string;
}

export function SeeVibeLogo({ variant = 'full', size = 48, className = '' }: SeeVibeLogoProps) {
  // Dimensions and alignment
  const width = variant === 'icon' ? size : size * 2.5;
  const height = size;

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
          {/* Fuchsia/Purple Gradient for Equalizer, Logo glow & Tag */}
          <linearGradient id="gradient-neon" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d946ef" /> {/* Fuchsia 500 */}
            <stop offset="50%" stopColor="#ec4899" /> {/* Pink 500 */}
            <stop offset="100%" stopColor="#8b5cf6" /> {/* Violet 500 */}
          </linearGradient>

          {/* Charcoal Metallic/Carbon Gradient for 'S' and 'V' base */}
          <linearGradient id="gradient-metallic" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2e3039" />
            <stop offset="40%" stopColor="#18191e" />
            <stop offset="100%" stopColor="#0a0a0d" />
          </linearGradient>

          {/* Subtle neon glowing shadow filter */}
          <filter id="neon-glow-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Equalizer sound wave bars on the left (glowing fuchsia elements) */}
        <g id="equalizer-bars" fill="url(#gradient-neon)">
          {/* Bar 1: Very left, short */}
          <rect x="6" y="52" width="3" height="16" rx="1.5" opacity="0.6" />
          {/* Bar 2 */}
          <rect x="12" y="44" width="3.2" height="32" rx="1.6" opacity="0.8" />
          {/* Bar 3: Tallest left */}
          <rect x="18" y="32" width="3.2" height="56" rx="1.6" />
          {/* Bar 4 */}
          <rect x="24" y="40" width="3.2" height="40" rx="1.6" opacity="0.9" />
          {/* Bar 5 */}
          <rect x="30" y="48" width="3" height="24" rx="1.5" opacity="0.75" />
          {/* Bar 6 */}
          <rect x="36" y="54" width="3" height="12" rx="1.5" opacity="0.5" />
        </g>

        {/* 2. Embedded S + V stylized emblem */}
        <g id="emblem-letters" filter="url(#neon-glow-filter)">
          {/* Stylized 'S' Path - Carbon/Charcoal background with glowing border highlight */}
          {/* Underlying glowing shadow for S */}
          <path
            d="M74 38 C74 31, 64 29, 60 29 C48 29, 44 36, 44 43 C44 58, 76 54, 76 69 C76 77, 68 83, 56 83 C46 83, 40 76, 40 72"
            stroke="url(#gradient-neon)"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.3"
          />

          {/* Actual solid S shape */}
          <path
            d="M75 36 C75 28, 64 27, 58 27 C46 27, 42 34, 42 42 C42 56, 74 53, 74 68 C74 76, 65 81, 54 81 C44 81, 38 75, 38 70"
            stroke="url(#gradient-metallic)"
            strokeWidth="11"
            strokeLinecap="round"
            fill="none"
          />
          {/* S internal core highlight */}
          <path
            d="M75 36 C75 28, 64 27, 58 27 C46 27, 42 34, 42 42 C42 56, 74 53, 74 68 C74 76, 65 81, 54 81"
            stroke="#454954"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.7"
          />

          {/* Intersecting 'V' Path on the right */}
          {/* V glowing backplate */}
          <path
            d="M68 53 L81 83 L101 37"
            stroke="url(#gradient-neon)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.4"
          />
          {/* Actual thick V body */}
          <path
            d="M68 53 L81 81 L99 37"
            stroke="url(#gradient-metallic)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* V neon edge glow highlighting the right flank */}
          <path
            d="M81 81 L99 37"
            stroke="url(#gradient-neon)"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* 3. Three Console Faders / EQ Sliders on the upper right */}
        <g id="fader-controls">
          {/* Channel 1 */}
          <line x1="86" y1="20" x2="86" y2="44" stroke="#1d1e22" strokeWidth="2" strokeLinecap="round" />
          <line x1="86" y1="20" x2="86" y2="30" stroke="url(#gradient-neon)" strokeWidth="2" strokeLinecap="round" />
          <rect x="83.5" y="28" width="5" height="7" rx="1" fill="#0C0D0F" stroke="#2a2c35" strokeWidth="1" />

          {/* Channel 2 */}
          <line x1="94" y1="12" x2="94" y2="36" stroke="#1d1e22" strokeWidth="2" strokeLinecap="round" />
          <line x1="94" y1="12" x2="94" y2="20" stroke="url(#gradient-neon)" strokeWidth="2" strokeLinecap="round" />
          <rect x="91.5" y="18" width="5" height="7" rx="1" fill="#0C0D0F" stroke="#2a2c35" strokeWidth="1" />

          {/* Channel 3 */}
          <line x1="102" y1="18" x2="102" y2="42" stroke="#1d1e22" strokeWidth="2" strokeLinecap="round" />
          <line x1="102" y1="18" x2="102" y2="26" stroke="url(#gradient-neon)" strokeWidth="2" strokeLinecap="round" />
          <rect x="99.5" y="24" width="5" height="7" rx="1" fill="#0C0D0F" stroke="#2a2c35" strokeWidth="1" />
        </g>
      </svg>

      {/* Write Wordmark / Text for Lockup and Full modes */}
      {(variant === 'full' || variant === 'lockup') && (
        <div className="flex flex-col justify-center select-none">
          <div className="flex items-baseline font-sans text-white tracking-wide">
            <span className="text-xl font-bold font-sans">See</span>
            <span className="text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-500 to-pink-500 font-sans ml-[1px]">Vibe</span>
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