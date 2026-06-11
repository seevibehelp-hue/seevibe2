// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { useAdMobStore } from '../store/useAdMobStore';
import { adMobService } from '../utils/adMobService';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { X, Award, Play, AlertCircle, Sparkles, Volume2 } from 'lucide-react';
import * as Tone from 'tone';

export const AdMobRewarded: React.FC = () => {
  const { rewardedActive, setRewardedActive, isPromptAd, recordImpression, recordClick, addVibeTokens, testMode, config } = useAdMobStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(8);
  const [claimable, setClaimable] = useState(false);
  const [adStarted, setAdStarted] = useState(false);
  
  // Custom Hourly Cooldown Threshold Check
  const [isLocked, setIsLocked] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const [score, setScore] = useState(0);
  const [synth, setSynth] = useState<any>(null);

  useEffect(() => {
    if (rewardedActive) {
      // Prioritize constraint checking
      const check = adMobService.canWatchRewardedAd(isPromptAd);
      if (!check.allowed) {
        setIsLocked(true);
        setCooldownSec(check.remainingSeconds);
        return;
      }

      setIsLocked(false);
      recordImpression('rewarded');
      setCountdown(8);
      setClaimable(false);
      setAdStarted(true);
      setScore(0);

      // Trigger native SDK Rewarded load
      adMobService.showProductionRewarded();

      // Create local synth for the playful ad
      try {
        const s = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: "sawtooth" },
          envelope: { release: 0.2 }
        }).toDestination();
        s.volume.value = -12;
        setSynth(s);
      } catch (_) {}
    }

    return () => {
      if (synth && !synth.disposed) {
        try {
          synth.dispose();
        } catch (_) {}
      }
      useAdMobStore.setState({ isPromptAd: false });
    };
  }, [rewardedActive]);

  // Handle ticking the global cooldown timer inside the popup
  useEffect(() => {
    if (!rewardedActive || !isLocked || cooldownSec <= 0) return;

    const interval = setInterval(() => {
      setCooldownSec((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsLocked(false); // Live unlocked
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [rewardedActive, isLocked, cooldownSec]);

  useEffect(() => {
    if (!rewardedActive || !adStarted || isLocked) return;

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setClaimable(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [rewardedActive, adStarted, isLocked]);

  if (!rewardedActive) return null;

  if (isLocked) {
    const formatTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      if (h > 0) {
        return `${h}h ${m}m ${s}s`;
      }
      return `${m}m ${s}s`;
    };

    return (
      <div className="fixed inset-0 z-[100000] bg-black/95 backdrop-blur-md flex items-center justify-center font-mono text-white p-4">
        <div className="w-full max-w-sm rounded-3xl bg-[#0F1013] border border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)] flex flex-col overflow-hidden relative">
          
          {/* Header Banner info */}
          <div className="bg-black/50 px-4 py-2 border-b border-white/5 flex items-center justify-between text-[8px] text-zinc-500">
            <span>Security Threshold Policy v1.1</span>
            <span className="text-red-400 font-bold uppercase tracking-wider">Access Restrained</span>
          </div>

          <div className="p-6 flex flex-col items-center text-center space-y-5">
            {/* Limit Banner Icon Box */}
            <div className="h-16 w-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-shield-alert"><path d="M20 13c0 5-3.5 7.5-7.66 9.7a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .76-.97l8-2a1 1 0 0 1 .48 0l8 2A1 1 0 0 1 20 6z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
            </div>

            {/* Error Message Header */}
            <div className="space-y-1.5">
              <h2 className="text-sm font-extrabold text-white uppercase tracking-wider">
                Hourly Limit Exceeded
              </h2>
              <p className="text-[10px] text-zinc-400 max-w-[280px] mx-auto leading-normal font-sans">
                You can only view and earn 3 times per hour. This standard security cool-down preserves ecosystem balance and transaction integrity.
              </p>
            </div>

            {/* Metric Lock Badge */}
            <div className="w-full bg-[#131418] p-4 rounded-xl border border-white/5 space-y-3">
              <div className="flex justify-between items-center text-[10px] text-zinc-400">
                <span>Claims this Hour:</span>
                <span className="text-red-400 font-extrabold">3 / 3 Max Reached</span>
              </div>
              
              {/* Progress bar representing 100% full limit */}
              <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-red-500 to-pink-500 h-full w-full rounded-full" />
              </div>

              {/* Countdown counter */}
              <div className="flex justify-between items-center text-[11px] pt-1 border-t border-white/5">
                <span className="text-zinc-500">Cooldown Active:</span>
                <span className="text-yellow-400 font-bold font-mono tracking-widest bg-yellow-400/10 border border-yellow-400/20 px-2 py-0.5 rounded text-xs select-none">
                  {formatTime(cooldownSec)}
                </span>
              </div>
            </div>

            {/* Go Ad-Free / Premium Bypass Button */}
            <button
              onClick={() => {
                navigate('/wallet');
                setRewardedActive(false);
                setTimeout(() => {
                  const el = document.getElementById('ads-free');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }, 150);
              }}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 text-black rounded-[16px] font-mono text-xs font-extrabold uppercase tracking-widest shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2 active:scale-95 transition-all text-center"
            >
              <Sparkles size={12} className="text-black" />
              <span>👑 Play Ads Free</span>
            </button>

            {/* Close button */}
            <button
              onClick={() => setRewardedActive(false)}
              className="w-full py-3 bg-[#1A1B20] hover:bg-zinc-800 border border-white/5 hover:border-white/10 text-zinc-350 hover:text-white rounded-[16px] font-mono text-xs font-bold uppercase tracking-wider transition-all"
            >
              Close Window
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handlePlayGameNote = (note: string) => {
    if (!adStarted) setAdStarted(true);
    setScore(s => s + 1);
    recordClick('rewarded');
    if (synth && !synth.disposed) {
      try {
        synth.triggerAttackRelease(note, "16n");
      } catch (_) {}
    }
  };

  const handleClaim = async () => {
    addVibeTokens(20);
    
    if (user?.id) {
      await adMobService.awardProductionTkReward(user.id);
    }

    const callback = useAdMobStore.getState().rewardCallback;
    if (callback) {
      try {
        callback();
      } catch (err) {
        console.error("Error executing reward callback:", err);
      }
      useAdMobStore.setState({ rewardCallback: null });
    }

    setRewardedActive(false);
    if (synth && !synth.disposed) {
      try {
        synth.dispose();
      } catch (_) {}
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] bg-black/95 backdrop-blur-md flex items-center justify-center font-mono text-white p-4">
      <div className="w-full max-w-sm rounded-3xl bg-[#0F1013] border border-white/10 shadow-[0_0_50px_rgba(0,255,156,0.15)] flex flex-col overflow-hidden relative">
        
        {/* Banner Tag info */}
        <div className="bg-black/50 px-4 py-2 border-b border-white/5 flex items-center justify-between text-[8px] text-zinc-500">
          <span>Ad Unit: ca-app-pub-••••••••••••••••/••••••••••••</span>
          <span className="text-yellow-400 font-bold uppercase tracking-wider">Rewarded Ad Integration</span>
        </div>

        {/* Header indicator */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="text-yellow-400" size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#00FF5A]">Get +20 VIBE TOKENS</span>
          </div>
          
          <div className="flex items-center gap-2">
            {!claimable ? (
              <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-1 rounded-lg font-bold">
                Watch Reward Ad: {countdown}s
              </span>
            ) : (
              <button 
                onClick={handleClaim}
                className="text-[10px] bg-emerald-500 text-black font-extrabold px-3 py-1 rounded-lg uppercase tracking-wider animate-bounce flex items-center gap-1.5"
              >
                <Sparkles size={11} />
                Claim +20 Tokens
              </button>
            )}

            {/* Close button - only active if claimable or if they want to forfeit */}
            <button 
              onClick={() => {
                if (confirm("Are you sure you want to exit and forfeit the +20 Vibe Tokens?")) {
                  setRewardedActive(false);
                }
              }}
              className="p-1.5 hover:bg-white/15 rounded-lg text-zinc-400 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Playable Ad Sandbox Container */}
        <div className="px-5 pb-5 pt-2 flex flex-col items-center text-center space-y-4">
          <div className="h-28 w-28 rounded-2xl bg-gradient-to-br from-[#10B981] to-[#3B82F6] flex items-center justify-center shrink-0 shadow-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-black/20 group-hover:scale-105 transition-transform duration-300" />
            <Volume2 size={42} className="text-black/80 animate-pulse relative z-10" />
            <span className="absolute bottom-1 right-2 text-[8px] font-bold text-black border border-black/10 px-1 bg-white/40 uppercase rounded">Playable</span>
          </div>

          <div className="space-y-1">
            <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-200">SeeVibe Arcade ad: Synth Master</h3>
            <p className="text-[9px] text-zinc-500 leading-normal max-w-[260px] mx-auto">
              Test out our modular lead keyboard synthesizer in this mini-game! Earn points by clicking keys below.
            </p>
          </div>

          {/* Mini Playable Piano Grid */}
          <div className="w-full bg-zinc-950/70 p-3 rounded-2xl border border-white/5 space-y-2.5">
            <div className="flex justify-between items-center text-[9px]">
              <span className="text-zinc-500 uppercase tracking-widest">Interactive Game Keys</span>
              <span className="text-emerald-400 font-bold font-mono">Ad Score: {score}</span>
            </div>

            <div className="grid grid-cols-6 gap-1 pt-1">
              {['C4', 'D4', 'E4', 'G4', 'A4', 'C5'].map((note) => (
                <button
                  key={note}
                  onClick={() => handlePlayGameNote(note)}
                  className="py-6 rounded-lg bg-zinc-900 border border-white/5 hover:bg-emerald-500/20 active:bg-emerald-500 active:text-black font-mono font-bold text-[9px] tracking-tighter text-zinc-400 text-center transition-all"
                >
                  {note}
                </button>
              ))}
            </div>

            <div className="text-[9px] text-[#00FF5A] animate-pulse flex items-center justify-center gap-1.5 py-0.5">
              <Play size={8} fill="currentColor" />
              <span>Tap any game key to play the synthesizer and earn score points!</span>
            </div>
          </div>

          {/* Disclaimer info */}
          <div className="flex gap-1.5 items-center bg-[#17181C] px-3.5 py-2.5 rounded-xl border border-white/5 text-[9px] text-zinc-400 text-left leading-normal w-full">
            <AlertCircle size={13} className="text-[#00FF9C] shrink-0" />
            <p>Earned tokens unlock exclusive heavy heuristic beat generators, mastering tools, or unique sound files!</p>
          </div>

          {/* Go Ad-Free action to redirect block with custom scrolling focus */}
          <button
            onClick={() => {
              navigate('/wallet');
              setRewardedActive(false);
              setTimeout(() => {
                const el = document.getElementById('ads-free');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }, 150);
            }}
            className="w-full py-3 bg-gradient-to-r from-amber-500/20 via-yellow-400/25 to-amber-500/20 hover:from-amber-500 hover:to-yellow-400 hover:text-black border border-amber-500/40 text-yellow-400 rounded-xl font-mono text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 active:scale-95 transition-all text-center"
          >
            <Sparkles size={11} className="animate-spin text-current" />
            <span>👑 Skip Ads: Go Ads-Free</span>
          </button>
        </div>
      </div>
    </div>
  );
};