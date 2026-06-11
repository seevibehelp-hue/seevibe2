// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useAdMobStore } from '../store/useAdMobStore';
import { Sparkles, Eye, Star, ArrowUpRight } from 'lucide-react';

interface AdMobNativeProps {
  layout?: 'feed' | 'sidebar';
}

const NATIVE_SPONSORS = [
  {
    brand: "Focusrite Audio",
    tagline: "Sponsor: Scarlet Solo Gen 4",
    desc: "Experience 120dB studio dynamic range, ultra high precision preamp, and complete auto-gain clipping protection.",
    cta: "Claim 15% Discount",
    rating: "4.9/5",
    color: "from-red-600 to-black",
    url: "https://focusrite.com"
  },
  {
    brand: "Moog Music Synth",
    tagline: "Sponsor: Spectravox Semi-Modular",
    desc: "A spectral analog synthesizer & vocoder providing hypnotic vocal soundscapes and customized filter sweep grids.",
    cta: "View Analog Synth",
    rating: "5.0/5",
    color: "from-zinc-900 to-[#10B981]",
    url: "https://moogmusic.com"
  }
];

export const AdMobNative: React.FC<AdMobNativeProps> = ({ layout = 'feed' }) => {
  const { recordImpression, recordClick, testMode, config } = useAdMobStore();
  const [sponsor, setSponsor] = useState(NATIVE_SPONSORS[0]);

  useEffect(() => {
    recordImpression('native');
    const rand = NATIVE_SPONSORS[Math.floor(Math.random() * NATIVE_SPONSORS.length)];
    setSponsor(rand);
  }, []);

  const handleClick = () => {
    recordClick('native');
    window.open(sponsor.url, "_blank");
  };

  if (layout === 'sidebar') {
    return (
      <div 
        onClick={handleClick}
        className="cursor-pointer group bg-[#111215] border border-white/5 hover:border-[#00FF9C]/30 rounded-xl p-3 space-y-2.5 transition-all text-left block relative overflow-hidden font-mono"
      >
        <div className="flex items-center justify-between">
          <span className="text-[8px] bg-[#00FF9C]/10 text-[#00FF5A] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
            Sponsored Native
          </span>
          <span className="text-[7px] text-zinc-500 font-bold uppercase tracking-widest">
            AdUnit ID: ••••••••••••
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold text-white uppercase group-hover:text-[#00FF9C] transition-colors truncate">
              {sponsor.brand}
            </h4>
            <ArrowUpRight size={12} className="text-zinc-500 group-hover:text-[#00FF9C] transition-colors" />
          </div>
          <p className="text-[9px] text-zinc-400 leading-relaxed font-mono line-clamp-2">
            {sponsor.desc}
          </p>
        </div>
      </div>
    );
  }

  // Large Feed Layout
  return (
    <div 
      onClick={handleClick}
      className="cursor-pointer group bg-[#0D0E11] border border-white/10 hover:border-[#00FF9C]/30 rounded-2xl p-4 space-y-3.5 transition-all text-left block relative overflow-hidden font-mono"
    >
      <div className="absolute top-0 right-0 h-20 w-20 bg-emerald-500/5 blur-xl rounded-full" />
      
      {/* Header tags */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="bg-[#00FF9C]/10 text-[#00FF5A] border border-[#00FF5a]/20 text-[8px] font-extrabold px-2 py-0.5 rounded-lg uppercase tracking-wider">
            Sponsor Recommendation
          </span>
          <span className="text-[8px] text-zinc-500 font-medium">Verified AdMob Feed Native</span>
        </div>

        <div className="flex items-center gap-1 text-[8px] text-zinc-500">
          <Star size={10} className="fill-yellow-500 text-yellow-500" />
          <span className="font-bold text-zinc-400">{sponsor.rating}</span>
        </div>
      </div>

      {/* Main layout detail */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 bg-gradient-to-br from-[#121316] to-[#252830] rounded-xl flex items-center justify-center border border-white/5 shrink-0 group-hover:scale-105 transition-transform duration-300">
          <Sparkles className="text-emerald-400 animate-pulse" size={16} />
        </div>

        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white group-hover:text-[#00FF9C] transition-colors truncate">
              {sponsor.brand}
            </h3>
            <span className="text-[8px] text-zinc-500 select-none font-mono">
              ID: ••••••••••••
            </span>
          </div>
          <p className="text-[10px] text-zinc-400 leading-normal line-clamp-3 font-sans">
            {sponsor.desc}
          </p>
        </div>
      </div>

      {/* Action footer */}
      <div className="flex justify-between items-center pt-1">
        <span className="text-[8px] text-zinc-500">AdUnit: <span className="font-mono text-zinc-450">ca-app-pub-••••••••••••••••/••••••••••••</span></span>
        <button className="px-3.5 py-1.5 bg-[#16171B] border border-white/10 rounded-lg group-hover:bg-[#00FF9C] group-hover:text-black font-mono font-bold text-[9px] uppercase tracking-wider transition-all flex items-center gap-1">
          <span>{sponsor.cta}</span>
          <ArrowUpRight size={10} />
        </button>
      </div>
    </div>
  );
};