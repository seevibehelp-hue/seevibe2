// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, RotateCcw, Lock, Unlock, Zap, Flame, Sparkles } from 'lucide-react';

interface SeeVibeProtectionGateProps {
  onVerify: (isVerified: boolean) => void;
  actionLabel?: string;
  className?: string;
}

export function SeeVibeProtectionGate({ 
  onVerify, 
  actionLabel = "Proceed", 
  className = "" 
}: SeeVibeProtectionGateProps) {
  const [faderValue, setFaderValue] = useState<number>(100); // 100Hz to 800Hz
  const [targetFrequency] = useState<number>(432); // Target is 432Hz (standard frequency)
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [attempts, setAttempts] = useState<number>(0);
  const [lockoutTime, setLockoutTime] = useState<number>(0); // countdown in seconds
  const [sineWaves, setSineWaves] = useState<number[]>([]);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sweet spot tolerance threshold: increased to 25Hz to make it extremely easy to align manually
  const toleranceThreshold = 25;

  // Generate sine wave points & handle verification states
  useEffect(() => {
    const points: number[] = [];
    const waveCount = 12;
    const harmonicDiff = Math.abs(faderValue - targetFrequency);
    
    // Better frequency factor for aesthetic display
    const frequencyFactor = faderValue / 200;
    const amplitude = Math.max(5, 25 - (harmonicDiff / 20));

    for (let i = 0; i < waveCount; i++) {
      const angle = (i / waveCount) * Math.PI * 2 * frequencyFactor;
      let height = Math.sin(angle) * amplitude;
      // Ambient noise only when far from alignment sweet-spot
      if (harmonicDiff > toleranceThreshold) {
        height += (Math.random() - 0.5) * (harmonicDiff / 20);
      }
      points.push(Math.round(height));
    }
    setSineWaves(points);

    // Verify if within easy target threshold
    if (harmonicDiff <= toleranceThreshold) {
      if (!isVerified) {
        setIsVerified(true);
        onVerify(true);
      }
    } else {
      if (isVerified && !isAnimating) {
        setIsVerified(false);
        onVerify(false);
      }
    }
  }, [faderValue, targetFrequency, isVerified, onVerify, isAnimating]);

  // Rate Limiting lockout logic
  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setInterval(() => {
        setLockoutTime((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTime]);

  // Cleanup animate intervals on unmount
  useEffect(() => {
    return () => {
      if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
    };
  }, []);

  // Flying fader automatic alignment function
  const triggerAutoHarmonize = () => {
    if (lockoutTime > 0 || isVerified || isAnimating) return;
    
    setIsAnimating(true);
    const startValue = faderValue;
    const steps = 15;
    let currentStep = 0;

    if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);

    animationIntervalRef.current = setInterval(() => {
      currentStep++;
      const ratio = currentStep / steps;
      // Smooth ease-out polynomial formula for beautiful natural deceleration
      const easeRatio = 1 - Math.pow(1 - ratio, 3); 
      const nextVal = Math.round(startValue + (targetFrequency - startValue) * easeRatio);
      
      setFaderValue(nextVal);

      if (currentStep >= steps) {
        if (animationIntervalRef.current) clearInterval(animationIntervalRef.current);
        setFaderValue(targetFrequency);
        setIsVerified(true);
        setIsAnimating(false);
        onVerify(true);
      }
    }, 25);
  };

  const handleInteractionCount = () => {
    setAttempts(p => {
      const next = p + 1;
      if (next >= 15 && !isVerified) {
        setLockoutTime(20); 
        setFaderValue(100);
        return 0;
      }
      return next;
    });
  };

  const harmonicDiff = Math.abs(faderValue - targetFrequency);
  const withinTolerance = harmonicDiff <= toleranceThreshold;

  return (
    <div className={`p-4 bg-[#0A0B0D] border border-zinc-800/80 rounded-2xl relative overflow-hidden shadow-inner ${className}`} id="see-vibe-protection-container">
      {/* Laser visual element */}
      <div className={`absolute top-0 left-0 w-full h-[1px] transition-all duration-500 bg-gradient-to-r from-transparent ${isVerified ? 'via-emerald-500/50' : 'via-fuchsia-500/40'} to-transparent animate-pulse`} />

      {lockoutTime > 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center space-y-2.5 animate-in fade-in" id="anti-spam-lockout">
          <div className="p-3 bg-red-500/10 rounded-full text-red-500 border border-red-500/20">
            <Flame size={24} className="animate-bounce" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-red-400 font-mono uppercase tracking-wider">Spam Shield Activated</h4>
            <p className="text-[10px] text-zinc-500 max-w-xs mt-1">
              Too many actions detected. Please wait briefly to ensure secure validation.
            </p>
          </div>
          <span className="text-xl font-mono font-bold text-red-500">{lockoutTime}s</span>
        </div>
      ) : (
        <div className="space-y-3.5">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isVerified ? 'bg-emerald-400' : 'bg-fuchsia-400'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isVerified ? 'bg-emerald-500' : 'bg-fuchsia-500'}`} />
              </span>
              <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 tracking-wider">
                Anti-Bot Human Verification
              </span>
            </div>
            
            <button
              type="button"
              onClick={triggerAutoHarmonize}
              disabled={isVerified || isAnimating}
              className={`flex items-center gap-1 font-mono text-[9px] border py-0.5 px-2 rounded cursor-pointer transition-all ${
                isVerified 
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400' 
                  : 'bg-fuchsia-500/10 hover:bg-fuchsia-500/18 border-fuchsia-500/25 text-fuchsia-300 hover:scale-[1.03] active:scale-95'
              }`}
            >
              <Sparkles size={8} className={isAnimating ? "animate-spin" : ""} />
              <span>{isVerified ? 'Verified' : 'Auto Align'}</span>
            </button>
          </div>

          {/* Dynamic Audio Wave visualizer representing verified state */}
          <div 
            onClick={triggerAutoHarmonize} 
            className="bg-[#050608] border border-zinc-900 rounded-xl h-14 flex items-center justify-center gap-1.5 px-4 relative overflow-hidden group cursor-pointer hover:border-zinc-800/80 transition-colors"
          >
            {/* Ambient grid overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,18,18,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(18,18,18,0.1)_1px,transparent_1px)] bg-[size:10px_10px]" />
            
            {/* Target zone highlighted on the graph */}
            <div className={`absolute inset-y-0 left-1/2 -ml-6 w-12 bg-emerald-500/5 border-x border-emerald-500/20 transition-all ${withinTolerance ? 'bg-emerald-500/15 border-emerald-400/40' : ''}`} />

            {sineWaves.map((h, index) => {
              const absHeight = Math.max(2, Math.abs(h));
              return (
                <div 
                  key={index} 
                  className={`w-1 rounded-full transition-all duration-75 ${
                    isVerified 
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' 
                      : withinTolerance
                        ? 'bg-emerald-400'
                        : 'bg-fuchsia-500/80 group-hover:bg-fuchsia-400'
                  }`}
                  style={{ height: `${absHeight + 6}px` }}
                />
              );
            })}
          </div>

          {/* Verification Fader Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
              <span className="flex items-center gap-1">
                {isVerified ? (
                  <Unlock size={11} className="text-emerald-400 animate-bounce" />
                ) : (
                  <Lock size={11} className="text-fuchsia-400" />
                )}
                <span>Vibe frequency:</span> 
                <strong className={`font-bold ${withinTolerance ? 'text-emerald-400' : 'text-zinc-200'}`}>
                  {withinTolerance ? "432" : Math.round(faderValue)} Hz
                </strong>
              </span>
              <span className={`text-[9px] uppercase font-semibold ${withinTolerance ? 'text-emerald-400' : 'text-fuchsia-400'}`}>
                {isVerified 
                  ? "Vibe aligned! Click proceed." 
                  : withinTolerance 
                    ? "Perfect harmony zone!" 
                    : "Unmatched spectrum"
                }
              </span>
            </div>

            {/* Slider track displaying beautiful green target zone */}
            <div className="relative flex items-center px-1">
              <div className="absolute left-[40%] right-[44%] h-2 bg-emerald-500/15 border-x border-emerald-500/30 rounded-sm pointer-events-none" />
              <input 
                id="anti-bot-fader-control"
                type="range"
                min="100"
                max="800"
                value={faderValue}
                disabled={isAnimating}
                onChange={(e) => {
                  setFaderValue(parseInt(e.target.value));
                  handleInteractionCount();
                }}
                className="w-full h-2 bg-[#141519] border border-[#27282e] rounded-lg appearance-none cursor-pointer focus:outline-none accent-fuchsia-500 dynamic-fader-range z-10"
              />
            </div>
            
            <p className="text-[9px] text-zinc-500 font-mono text-center flex items-center justify-center gap-1.5 leading-none">
              <span>Drag slider near central green region or click</span> 
              <button 
                type="button" 
                onClick={triggerAutoHarmonize}
                disabled={isVerified}
                className="text-fuchsia-400 hover:text-fuchsia-300 font-bold underline uppercase tracking-wider bg-transparent p-0 border-none cursor-pointer inline-block"
              >
                Auto Align
              </button>
            </p>
          </div>

        </div>
      )}
    </div>
  );
}