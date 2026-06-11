// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useAdMobStore } from '../store/useAdMobStore';
import { adMobService } from '../utils/adMobService';
import { useNavigate } from 'react-router-dom';
import { X, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';

export const AdMobInterstitial: React.FC = () => {
  const { interstitialActive, setInterstitialActive, recordImpression, recordClick, testMode, config } = useAdMobStore();
  const [canSkip, setCanSkip] = useState(false);
  const navigate = useNavigate();
  const [timerNum, setTimerNum] = useState(4);

  useEffect(() => {
    if (interstitialActive) {
      recordImpression('interstitial');
      setCanSkip(false);
      setTimerNum(4);

      // Trigger native SDK Interstitial load
      adMobService.showProductionInterstitial();

      const interval = setInterval(() => {
        setTimerNum((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setCanSkip(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [interstitialActive]);

  if (!interstitialActive) return null;

  const handleCtaClick = () => {
    recordClick('interstitial');
    window.open("https://native-instruments.com", "_blank");
  };

  return (
    <div className="fixed inset-0 z-[100000] bg-black/98 flex flex-col items-center justify-center font-mono text-white p-6 md:p-12">
      {/* Absolute Header Info */}
      <div className="absolute top-4 left-6 right-6 flex items-center justify-between text-[8px] text-zinc-500 uppercase">
        <span>Ad Unit: ca-app-pub-••••••••••••••••/••••••••••••</span>
        <div className="flex gap-2 items-center">
          <span className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded leading-none text-[7px] border border-white/5">Interstitial Ad</span>
          <span>Google AdMob Integration</span>
        </div>
      </div>

      <div className="w-full max-w-lg flex flex-col items-center justify-center space-y-8 select-none">
        
        {/* Skip action and Go Ad-Free in header bar */}
        <div className="w-full flex justify-between items-center gap-4">
          <button
            onClick={() => {
              navigate('/wallet');
              setInterstitialActive(false);
              setTimeout(() => {
                const el = document.getElementById('ads-free');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }, 150);
            }}
            className="flex items-center gap-1.5 px-4.5 py-2 bg-gradient-to-r from-amber-500/10 via-yellow-400/20 to-amber-500/10 hover:from-amber-500 hover:to-yellow-400 hover:text-black hover:scale-105 rounded-full font-extrabold uppercase transition-all border border-amber-500/30 text-yellow-400 tracking-wider text-[9px] animate-pulse cursor-pointer shadow-[0_0_15px_rgba(245,158,11,0.1)]"
          >
            <Sparkles size={11} className="text-current" />
            <span>👑 Go Ad-Free</span>
          </button>

          {canSkip ? (
            <button 
              onClick={() => setInterstitialActive(false)}
              className="flex items-center gap-1.5 px-4.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold uppercase transition-all duration-150 border border-white/5 tracking-wider text-[10px]"
            >
              Skip Ad
              <X size={12} />
            </button>
          ) : (
            <div className="px-4.5 py-2 bg-[#141519] border border-white/5 text-zinc-500 rounded-full font-bold uppercase tracking-wider text-[10px]">
              Skip in {timerNum}s
            </div>
          )}
        </div>

        {/* Sponsor Display */}
        <div className="w-full max-w-sm rounded-[32px] bg-gradient-to-b from-[#1C1D24] to-[#0E0F12] border border-white/10 p-6 md:p-8 space-y-6 text-center shadow-[0_30px_100px_rgba(0,0,0,0.8)] relative overflow-hidden">
          
          {/* Accent glow */}
          <div className="absolute -top-16 inset-x-0 h-32 bg-[#A855F7]/10 blur-3xl rounded-full" />

          {/* Icon Badge */}
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 mx-auto flex items-center justify-center border border-purple-500/30 shadow-lg relative shrink-0">
            <Sparkles size={32} className="text-white animate-pulse" />
          </div>

          <div className="space-y-2 relative z-10">
            <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Partnership Spotlight
            </span>
            <h2 className="text-xl md:text-2xl font-extrabold text-white leading-tight uppercase font-sans tracking-tight">
              Kontakt 8 Producer Suite
            </h2>
            <p className="text-[11px] text-zinc-400 leading-relaxed font-mono max-w-xs mx-auto pt-1">
              Dive into 150+ acoustic instruments, modular analog drum models, and legendary tape distortion modules.
            </p>
          </div>

          {/* Call to action button */}
          <button 
            type="button"
            onClick={handleCtaClick}
            className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white border border-purple-500/20 shadow-lg shadow-purple-500/20 font-bold text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-95 uppercase tracking-wider"
          >
            <span>Learn More & Install</span>
            <ExternalLink size={12} />
          </button>

          {/* Secure badge */}
          <div className="flex items-center justify-center gap-1.5 text-[8px] text-zinc-500 justify-center">
            <ShieldCheck size={11} className="text-[#00FF9C]" />
            <span>Verified safe Google AdMob installation link</span>
          </div>
        </div>
      </div>
    </div>
  );
};