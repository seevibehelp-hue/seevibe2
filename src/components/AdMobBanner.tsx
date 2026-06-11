// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useAdMobStore } from '../store/useAdMobStore';
import { adMobService } from '../utils/adMobService';
import { X, Sparkles, ExternalLink } from 'lucide-react';

const AD_CAMPAIGNS = [
  {
    title: "Splice Studio Packs",
    desc: "Unlock 2,000,000+ royalty free Afrobeat loops & Serum presets.",
    cta: "Download Pack",
    color: "from-[#1D4ED8] to-[#1E3A8A]",
    url: "https://splice.com"
  },
  {
    title: "DistroKid Distribution",
    desc: "Get your tracks on Spotify & Apple Music in 24 hours. 20% off!",
    cta: "Distribute Now",
    color: "from-[#F59E0B] to-[#B45309]",
    url: "https://distrokid.com"
  },
  {
    title: "Output Arcade Synthesizer",
    desc: "The cloud synthesis utility engine. Start a free 30-day trial.",
    cta: "Download Engine",
    color: "from-[#D946EF] to-[#701A75]",
    url: "https://output.com/arcade"
  }
];

export const AdMobBanner: React.FC = () => {
  const { bannerVisible, setBannerVisible, recordImpression, recordClick, testMode, config } = useAdMobStore();
  const [campaign, setCampaign] = useState(AD_CAMPAIGNS[0]);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (bannerVisible) {
      // Choose random campaign
      const rand = AD_CAMPAIGNS[Math.floor(Math.random() * AD_CAMPAIGNS.length)];
      setCampaign(rand);
      recordImpression('banner');
      
      // Trigger native mobile SDK banner load
      adMobService.loadProductionBanner();
    }
  }, [bannerVisible]);

  if (!bannerVisible) return null;

  return (
    <div 
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="w-full bg-[#0E0F12] border-t border-white/10 shrink-0 text-white relative font-mono text-[11px] transition-all duration-300 shadow-2xl overflow-hidden"
    >
      {/* Glow highlight */}
      <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />

      {/* Ad Unit Info Bar on Hover */}
      {hovered && (
        <div className="absolute inset-0 bg-black/95 z-30 flex items-center justify-between px-4 transition-all duration-200">
          <div className="flex flex-col text-[9px] text-zinc-400">
            <span className="text-[#00FF9C] font-bold uppercase tracking-wider">AdMob Google Banner Unit Active</span>
            <span>Ad Unit: <span className="text-zinc-500 font-bold font-mono">ca-app-pub-••••••••••••••••/••••••••••••</span></span>
          </div>
          <button 
            type="button"
            onClick={() => setBannerVisible(false)}
            className="flex items-center gap-1.5 px-2 py-1 bg-white/10 hover:bg-red-500/20 hover:text-red-400 rounded transition-colors text-[9px] border border-white/5 font-bold uppercase"
          >
            <X size={10} />
            Dismiss Ad
          </button>
        </div>
      )}

      {/* Primary Banner Ad Area */}
      <div className="max-w-[1200px] mx-auto h-[60px] flex items-center justify-between px-3 md:px-6 relative gap-3">
        {/* AdMob Tag */}
        <div className="absolute top-1 left-2 md:left-4 flex items-center gap-1 text-[8px] text-zinc-500 uppercase font-extrabold tracking-wide">
          <span className="bg-zinc-800 text-zinc-400 px-1 py-0.5 rounded leading-none text-[7px] border border-white/5">Ad</span>
          <span>Google AdMob Integration</span>
        </div>

        {/* Content body */}
        <div className="flex items-center gap-3 pt-2.5 flex-1 min-w-0">
          <div className={`hidden sm:flex h-9 w-9 rounded-lg bg-gradient-to-tr ${campaign.color} shrink-0 items-center justify-center border border-white/10 shadow shadow-black`}>
            <Sparkles size={14} className="text-white animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-white text-[11px] sm:text-xs truncate">{campaign.title}</h4>
            <p className="text-[9px] text-zinc-400 truncate max-w-xl pr-5 sm:block hidden">{campaign.desc}</p>
            <p className="text-[9px] text-zinc-400 truncate max-w-xl pr-5 sm:hidden block">Sponsor: Learn more inside!</p>
          </div>
        </div>

        {/* CTA Button Action */}
        <div className="flex items-center gap-2.5">
          <a
            href={campaign.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => recordClick('banner')}
            className={`px-3 py-1.5 rounded-lg bg-gradient-to-r ${campaign.color} hover:brightness-110 active:scale-95 transition-all font-bold text-[9px] uppercase tracking-wide flex items-center gap-1.5 border border-white/10 whitespace-nowrap`}
          >
            <span>{campaign.cta}</span>
            <ExternalLink size={10} />
          </a>

          {/* Minimal Mobile Close */}
          <button 
            onClick={() => setBannerVisible(false)}
            className="p-1 hover:bg-white/10 rounded-full text-zinc-500 hover:text-white sm:block transition-colors shrink-0"
            title="Dismiss Ad"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};