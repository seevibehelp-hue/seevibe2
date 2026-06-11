// @ts-nocheck
import React from 'react';
import { useAdMobStore } from '../store/useAdMobStore';
import { Sparkles, DollarSign, Activity, Settings, Eye, Play, Shield, RefreshCw } from 'lucide-react';

export const AdMobDashboard: React.FC = () => {
  const { 
    config, 
    testMode, 
    toggleTestMode, 
    metrics, 
    resetMetrics, 
    bannerVisible, 
    setBannerVisible, 
    setInterstitialActive, 
    setRewardedActive,
    vibeTokens
  } = useAdMobStore();

  return (
    <div className="bg-[#090A0C] border border-white/5 rounded-2xl p-4 md:p-5 space-y-5 font-mono text-white select-none">
      
      {/* Dashboard Brand Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="text-[#00FF9C]" size={16} />
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#00FF5A]">
            AdMob Monetization
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded uppercase font-bold text-xs">
            PRODUCTION READY
          </span>
        </div>
      </div>

      {/* Overview stats: Estimated earnings */}
      <div className="grid grid-cols-2 gap-3.5">
        
        {/* Earnings Card */}
        <div className="p-3 bg-[#111216] border border-white/5 rounded-xl space-y-1 relative overflow-hidden">
          <div className="absolute top-2 right-2 flex items-center justify-center p-1 bg-emerald-500/10 text-emerald-400 rounded-lg">
            <DollarSign size={13} />
          </div>
          <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-wide">
            Est. Earnings (USD)
          </p>
          <div className="flex items-baseline gap-1 pt-1">
            <span className="text-xl font-extrabold text-[#00FF5A]">
              ${metrics.estimatedEarnings.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Tokens reward Card */}
        <div className="p-3 bg-[#111216] border border-white/5 rounded-xl space-y-1 relative overflow-hidden">
          <div className="absolute top-2 right-2 flex items-center justify-center p-1 bg-yellow-500/10 text-yellow-500 rounded-lg">
            <Sparkles size={13} />
          </div>
          <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-wide">
            Vibe Tokens Balance
          </p>
          <div className="flex items-baseline gap-1 pt-1">
            <span className="text-xl font-extrabold text-yellow-400">
              {vibeTokens}
            </span>
            <span className="text-[8px] text-zinc-500">TKNS</span>
          </div>
        </div>

      </div>

      {/* AdMob Publisher configuration registry info */}
      <div className="bg-[#050608] rounded-xl p-3 border border-white/5 space-y-2">
        <div className="text-[9px] font-bold text-[#00FF9C] uppercase tracking-wider flex justify-between">
          <span>AdMob Registration Metadata</span>
          <span className="text-zinc-600 font-normal">SDK v23.1</span>
        </div>

        <div className="space-y-1.5 text-[9px] font-mono text-zinc-400">
          <div className="flex justify-between border-b border-white/5 pb-1">
            <span>App Name:</span>
            <span className="text-white font-bold">{config.appName}</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-1">
            <span>App ID:</span>
            <span className="text-zinc-300 font-semibold select-all text-right max-w-[210px] truncate">{config.appId}</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-1">
            <span>Banner ID:</span>
            <span className="text-zinc-400 select-all truncate max-w-[210px]">{config.bannerId}</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-1">
            <span>Rewarded ID:</span>
            <span className="text-zinc-400 select-all truncate max-w-[210px]">{config.rewardId}</span>
          </div>
          <div className="flex justify-between border-b border-white/5 pb-1">
            <span>Native ID:</span>
            <span className="text-zinc-400 select-all truncate max-w-[210px]">{config.nativeId}</span>
          </div>
          <div className="flex justify-between">
            <span>Interstitial ID:</span>
            <span className="text-zinc-400 select-all truncate max-w-[210px]">{config.interstitialId}</span>
          </div>
        </div>
      </div>

      {/* Impression dashboard diagnostics telemetry metrics */}
      <div className="bg-[#111216] p-3 rounded-xl border border-white/5 space-y-2.5">
        <div className="flex justify-between items-center text-[9px] text-zinc-400 uppercase tracking-wide">
          <span>Telemetry Reports (Live Network)</span>
          <button 
            onClick={resetMetrics}
            className="text-zinc-500 hover:text-zinc-300 flex items-center gap-1 uppercase text-[8px]"
          >
            <RefreshCw size={10} />
            Reset
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center text-[9px]">
          <div className="p-1.5 bg-[#141519]/70 rounded border border-white/5">
            <div className="text-zinc-500 text-[8px]">IMPR.</div>
            <div className="text-white font-extrabold">{metrics.impressions}</div>
          </div>
          <div className="p-1.5 bg-[#141519]/70 rounded border border-white/5">
            <div className="text-zinc-500 text-[8px]">CLICKS</div>
            <div className="text-white font-extrabold">{metrics.clicks}</div>
          </div>
          <div className="p-1.5 bg-[#141519]/70 rounded border border-white/5">
            <div className="text-zinc-500 text-[8px]">CTR</div>
            <div className="text-[#00FF5A] font-extrabold">{metrics.ctr}%</div>
          </div>
          <div className="p-1.5 bg-[#141519]/70 rounded border border-white/5">
            <div className="text-zinc-500 text-[8px]">eCPM</div>
            <div className="text-[#00FF5A] font-extrabold">${metrics.ecpm.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Direct Interactive Trigger Buttons */}
      <div className="space-y-2.5">
        <div className="text-[9px] text-zinc-400 uppercase tracking-wide">
          Interactive Mock Ad Unit Previews
        </div>

        <div className="grid grid-cols-2 gap-2">
          
          {/* 1. Show banner toggle */}
          <button
            onClick={() => setBannerVisible(!bannerVisible)}
            className={`py-2 px-3 border rounded-xl font-mono text-[9px] font-bold uppercase transition-all flex items-center justify-between ${
              bannerVisible 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                : 'bg-zinc-900 text-zinc-500 border-white/5'
            }`}
          >
            <span>Banner Ad</span>
            <span className="text-[8px]">{bannerVisible ? 'ON' : 'OFF'}</span>
          </button>

          {/* 2. Show native trigger */}
          <div className="bg-zinc-900 border border-white/5 py-2 px-3 rounded-xl font-mono text-[9px] font-bold uppercase flex items-center justify-between text-zinc-400">
            <span>Native Ad</span>
            <span className="text-[8px] text-emerald-400">Inline Ready</span>
          </div>

          {/* 3. Interstitial trigger */}
          <button
            onClick={() => setInterstitialActive(true)}
            className="py-2.5 px-3 bg-indigo-600/30 hover:bg-indigo-600/40 text-indigo-350 border border-indigo-500/25 rounded-xl font-mono text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-95"
          >
            <Eye size={12} />
            <span>Load Interstitial</span>
          </button>

          {/* 4. Rewarded trigger */}
          <button
            onClick={() => setRewardedActive(true)}
            className="py-2.5 px-3 bg-yellow-500/25 hover:bg-yellow-500/35 text-yellow-300 border border-yellow-500/20 rounded-xl font-mono text-[9px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-95 animate-pulse"
          >
            <Play size={10} fill="currentColor" />
            <span>Watch Reward Ad (+20)</span>
          </button>

        </div>
      </div>

    </div>
  );
};