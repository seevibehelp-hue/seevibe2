// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useDawStore } from '../../store/useDawStore';
import { useAdMobStore } from '../../store/useAdMobStore';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { adMobService } from '../../utils/adMobService';
import { Sparkles, ShieldCheck, Lock, Gift, Star, Zap, Code, HelpCircle, RefreshCw, Layers, Sliders, Play, Award, Volume2, AlertTriangle, X } from 'lucide-react';

interface UpgradePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UpgradesHubModal({ isOpen, onClose }: UpgradePanelProps) {
  const { user } = useAuth();
  const { purchasedPlugins, purchasePlugin } = useDawStore();
  const { setRewardedActive } = useAdMobStore();
  
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<string | null>(null);

  const fetchWallet = async () => {
    setLoading(true);
    try {
      if (user?.id) {
        const { data, error } = await supabase.from('wallets').select('*').eq('user_id', user.id).single();
        if (data && !error) {
          setWallet(data);
        } else {
          // If public context fails or user has no row, load/save defaults
          const fallback = {
            balance_usd: 10.00,
            balance_naira: 16000,
            tk_balance: 50.00,
            is_ads_free: false
          };
          setWallet(fallback);
        }
      } else {
        // Guest localStorage fallback
        const localUsd = localStorage.getItem('local_wallet_usd') || '10.00';
        const localNaira = localStorage.getItem('local_wallet_naira') || '16000';
        const localTk = localStorage.getItem('local_wallet_tk') || '50.00';
        setWallet({
          balance_usd: parseFloat(localUsd),
          balance_naira: parseInt(localNaira),
          tk_balance: parseFloat(localTk),
          is_ads_free: false
        });
      }
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWallet();
    }
  }, [isOpen, user]);

  if (!isOpen) return null;

  // Verify Phase ownership
  const isPhase1Owned = purchasedPlugins.includes('phase_1_unlocked') || (purchasedPlugins.includes('voicePitcher') && purchasedPlugins.includes('pitchCorrection'));
  const isPhase2Owned = purchasedPlugins.includes('phase_2_unlocked') || (purchasedPlugins.includes('tbReverb') && purchasedPlugins.includes('tbFerox'));
  const isPhase3Owned = purchasedPlugins.includes('phase_3_unlocked') || (purchasedPlugins.includes('tbBarricadeV4') && purchasedPlugins.includes('vocalTunePro'));

  const phases = [
    {
      id: 'phase_1',
      tag: 'phase_1_unlocked',
      title: 'Phase I: Precision Audio & AI Basics',
      costNaira: 1000,
      costTk: 10,
      isOwned: isPhase1Owned,
      color: 'from-blue-500/10 to-indigo-500/5 border-blue-500/30 text-blue-400',
      badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      tagline: 'Establish perfect vocal pitching, harmonic alignments, and faster AI prompt queues.',
      studioHighlights: [
        'Voice Pitcher Premium ("voicePitcher") - Pro pitch tracking and shifting with high Formant preservation.',
        'Vocal Tune Premium ("pitchCorrection") - Absolute chromatic auto-corrections & scale matching.'
      ],
      aiHighlights: [
        'Smarter Vocal Key & BPM Alignment - Instantly snaps active midi clips into perfect scale intervals.',
        'High-Priority Chat Threads - Drastically reduces processing time on complex automatic generator tasks.'
      ],
      pluginIds: ['voicePitcher', 'pitchCorrection']
    },
    {
      id: 'phase_2',
      tag: 'phase_2_unlocked',
      title: 'Phase II: Spatial Dimension & Synth Master',
      costNaira: 2500,
      costTk: 25,
      isOwned: isPhase2Owned,
      color: 'from-amber-600/10 to-yellow-600/5 border-amber-500/30 text-amber-400',
      badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      tagline: 'Open stereophonic depth, infinite atmospheric space, and authentic Amapiano log drum builders.',
      studioHighlights: [
        'Ultra-Lush Space Reverb ("tbReverb") - Gorgeous decay algorithms with high-fidelity dampening controls.',
        'Warm ToneBoosters EQ V4 ("tbEQv4") - Precision dynamic surgical filter bands.',
        'Stereo Analog Tape Bus ("tbFerox") - Introduces genuine vintage tape saturation warmth.'
      ],
      aiHighlights: [
        'AI Live Drum & Percussion Builder - Automatic syncopations and log drum pitch rolls.',
        'Atmos Stereophonic Width - Command AI assistant to configure precise channel spatial faders.'
      ],
      pluginIds: ['tbReverb', 'tbEQv4', 'tbFerox']
    },
    {
      id: 'phase_3',
      tag: 'phase_3_unlocked',
      title: 'Phase III: Elite AI Executive Co-Producer',
      costNaira: 5000,
      costTk: 50,
      isOwned: isPhase3Owned,
      color: 'from-emerald-500/10 to-teal-500/5 border-emerald-500/30 text-emerald-400',
      badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      tagline: 'Unlock full hands-free production, master limiters, and unlimited song duration rendering.',
      studioHighlights: [
        'Barricade Mastering Limiter ("tbBarricadeV4") - Zero-lookahead look for maximum commercial loudness.',
        'Vocal Tune PRO ("vocalTunePro") - Fully adjustable auto-tune speed, vibrato depth, and correction paths.',
        'Vintage ReelBus Tape V4 ("tbReelBusV4") - Emulates legendary physical reel-to-reel magnetic tape recorders.'
      ],
      aiHighlights: [
        'Executive AI Coproducer Engine - Complete automatic hands-free layout arranging (Intro, Chorus, Outros).',
        'Unlimited Duration Rendering - Unlocks export and production pipelines for files up to 10 minutes length.',
        'Dynamic Build-up & Pre-Drop Automation - Intelligently insert intro-hook high-cut wipes & double-drop fusions.'
      ],
      pluginIds: ['tbBarricadeV4', 'vocalTunePro', 'tbReelBusV4']
    }
  ];

  const handlePurchase = async (phase: typeof phases[0], method: 'naira' | 'tk') => {
    if (phase.isOwned) return;
    const cost = method === 'naira' ? phase.costNaira : phase.costTk;
    const balance = method === 'naira' ? wallet?.balance_naira : wallet?.tk_balance;

    if (balance < cost) {
      if (method === 'tk') {
        alert(`Insufficient Vibe Tokens. You need ${cost} TK, but your balance is ${Number(balance).toFixed(1)} TK.\n\nTip: You can earn +20 Vibe Tokens instantly by clicking the "Earn Tokens" button and watching an ad! It is unlimited!`);
      } else {
        alert(`Insufficient Naira balance. You need ₦${cost.toLocaleString()}, but your balance is ₦${Number(balance).toLocaleString()}.\n\nPlease fund your balance on the Wallet page or use Vibe Tokens instead!`);
      }
      return;
    }

    setPurchasingId(phase.id);
    try {
      if (user?.id) {
        // Authenticated: atomic server-side deduction via SECURITY DEFINER RPC.
        // The wallets table no longer accepts client-side balance UPDATEs.
        if (method === 'naira') {
          const { data: res, error } = await supabase.rpc('spend_wallet_naira', {
            p_amount: cost,
            p_reason: 'sub_charge',
            p_description: `Studio Upgrade Unlock: ${phase.title} (NAIRA)`,
            p_meta: { phase_id: phase.id },
          });
          if (error) throw error;
          if (!(res as any)?.success) {
            alert(`Payment failed: ${(res as any)?.reason || 'unknown'}`);
            setPurchasingId(null);
            return;
          }
        } else {
          // TK spend: not yet server-atomized. Keep client update but note
          // the DB no longer allows it — TK purchases will surface an error
          // until a spend_wallet_tk RPC is added.
          const { error: updErr } = await supabase.from('wallets')
            .update({ tk_balance: Number(wallet.tk_balance) - cost })
            .eq('user_id', user.id);
          if (updErr) {
            alert('TK spend blocked by server policy. Please try Naira instead.');
            setPurchasingId(null);
            return;
          }
          await supabase.from('wallet_transactions').insert({
            user_id: user.id, amount_naira: 0, amount_usd: 0,
            type: 'sub_charge',
            description: `Studio Upgrade Unlock: ${phase.title} (TK)`,
          });
        }
        // Guest LocalStorage fallback
        if (method === 'naira') {
          const nextNaira = Number(wallet.balance_naira) - cost;
          localStorage.setItem('local_wallet_naira', nextNaira.toString());
        } else {
          const nextTk = Number(wallet.tk_balance) - cost;
          localStorage.setItem('local_wallet_tk', nextTk.toString());
        }

        // Add mock transaction log
        const localTxStr = localStorage.getItem('local_wallet_transactions');
        let txl = [];
        try { txl = localTxStr ? JSON.parse(localTxStr) : []; } catch { txl = []; }
        txl.unshift({
          id: Math.random().toString(),
          type: 'sub_charge',
          amount_naira: method === 'naira' ? cost : 0,
          amount_usd: 0,
          description: `Studio Upgrade Unlock: ${phase.title} (${method.toUpperCase()})`,
          created_at: new Date().toISOString()
        });
        localStorage.setItem('local_wallet_transactions', JSON.stringify(txl));
      }

      // Unlock all phase-related plugins inside DAW store
      phase.pluginIds.forEach((pId) => {
        purchasePlugin(pId);
      });
      purchasePlugin(phase.tag); // Tag phase ownership itself

      // Refresh local view
      await fetchWallet();
      setShowSuccess(phase.title);
      setTimeout(() => setShowSuccess(null), 4000);
    } catch (err: any) {
      alert("Upgrade purchase failed: " + (err.message || err));
    } finally {
      setPurchasingId(null);
    }
  };

  const handleEarnTokens = () => {
    // Open Unlimited Rewarded Ad instantly by setting the isPromptAd flag to true
    useAdMobStore.setState({ isPromptAd: true, rewardedActive: true });
    // Alert the user that the ad is loaded
    console.log("[Upgrades Hub] Redirect to unbounded rewarded ad stream.");
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-[#050608] border border-[#222] rounded-[32px] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.95)] flex flex-col relative text-white">
        
        {/* Confetti / Success Overlay element if just purchased */}
        {showSuccess && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md z-50 flex flex-col items-center justify-center space-y-6 p-8 animate-in zoom-in duration-350 text-center">
            <div className="h-24 w-24 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center relative animate-pulse">
              <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-2xl" />
              <Star size={44} className="text-[#00FFBC] fill-[#00FFBC] animate-bounce" />
            </div>
            <div className="space-y-2">
              <span className="px-3 py-1 font-mono text-[9px] uppercase font-bold tracking-widest bg-emerald-500/10 text-[#00FFBC] border border-emerald-500/30 rounded-full">
                Phase Activated Successfully
              </span>
              <h2 className="text-2xl font-black uppercase tracking-wide text-white font-sans">{showSuccess}</h2>
              <p className="text-xs font-mono text-zinc-400 max-w-md mx-auto leading-relaxed">
                Studio processing units initialized. Your premium plugins are now loaded inside the FX effects list and your AI Coproducer has been upgraded with new commands!
              </p>
            </div>
            <button 
              onClick={() => setShowSuccess(null)}
              className="px-8 py-3 bg-[#00FFBC] hover:bg-[#00E5A8] text-black font-sans font-bold text-xs rounded-xl transition-all uppercase tracking-wider"
            >
              Back to Console
            </button>
          </div>
        )}

        {/* Modal Header */}
        <div className="p-6 border-b border-white/5 bg-zinc-950/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Sparkles size={18} className="text-black" />
            </div>
            <div>
              <h1 className="text-base font-extrabold uppercase tracking-widest font-sans flex items-center gap-2">
                <span>See Vibe Studio Upgrades</span>
                <span className="text-amber-400">& AI Coproducer Hub</span>
              </h1>
              <p className="text-[10px] text-zinc-500 font-mono">Unlock advanced analog emulation algorithms, spatial widening, and self-authoritative AI synthesis.</p>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="text-zinc-500 hover:text-white hover:bg-white/10 h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Balance Status Ledger bar */}
        <div className="bg-[#0b0c0d] border-b border-white/5 px-6 py-3 flex items-center justify-between text-xs font-mono shrink-0">
          <div className="flex items-center space-x-6 text-zinc-400">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px]">USD/Naira Wallet:</span>
              <span className="text-white font-extrabold">₦{wallet ? Number(wallet.balance_naira).toLocaleString() : '0'}</span>
              <span className="text-zinc-500">(${wallet ? Number(wallet.balance_usd).toFixed(2) : '0.00'})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Award size={13} className="text-yellow-400" />
              <span>Vibe Tokens:</span>
              <span className="text-[#00FFBC] font-extrabold">{wallet ? Number(wallet.tk_balance).toFixed(1) : '0.0'} TK</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Unlimited tokens earn trigger button */}
            <button 
              onClick={handleEarnTokens}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#00FF5A]/10 hover:bg-[#00FF5A]/25 border border-[#00FF5A]/20 text-[#00FF5A] font-mono text-[9px] font-extrabold uppercase tracking-wider transition-all cursor-pointer"
            >
              <Zap size={11} className="animate-pulse" />
              <span>Earn +20 TK (Unlimited Ad Watch)</span>
            </button>
            <button 
              onClick={fetchWallet}
              title="Refresh Balance"
              className="p-1 hover:bg-white/5 rounded text-zinc-500 hover:text-white transition-all"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Modal Scroll Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 min-h-0">
          
          {/* Main Phase grid */}
          <div className="grid grid-cols-1 gap-6">
            {phases.map((phase) => {
              return (
                <div 
                  key={phase.id} 
                  className={`border rounded-2xl p-5 bg-gradient-to-br ${phase.color} shadow-lg transition-all relative overflow-hidden`}
                >
                  {/* Owned watermark ribbon indicator */}
                  {phase.isOwned && (
                    <div className="absolute top-4 right-4 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-emerald-400 text-[10px] font-bold uppercase tracking-widest font-mono flex items-center gap-1.5 z-10 animate-pulse">
                      <ShieldCheck size={12} />
                      <span>Unlocked & Active</span>
                    </div>
                  )}

                  {/* Top line detail */}
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-white/5 relative z-10">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className={`px-2 py-0.5 rounded-md text-[8px] font-mono font-black border uppercase tracking-wider ${phase.badgeColor}`}>
                          {phase.id.replace('_', ' ').toUpperCase()}
                        </span>
                        <h2 className="text-base font-black text-white">{phase.title}</h2>
                      </div>
                      <p className="text-[11px] text-zinc-300 font-mono italic max-w-2xl leading-normal">{phase.tagline}</p>
                    </div>

                    {!phase.isOwned && (
                      <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
                        {/* Buy with Naira button */}
                        <button
                          disabled={purchasingId !== null}
                          onClick={() => handlePurchase(phase, 'naira')}
                          className="flex-1 md:flex-initial px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:brightness-115 text-black font-mono font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 text-center flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {purchasingId === phase.id ? (
                            <span>Unlocking...</span>
                          ) : (
                            <>
                              <Gift size={12} />
                              <span>₦{phase.costNaira.toLocaleString()} Naira</span>
                            </>
                          )}
                        </button>

                        <span className="text-[9px] text-zinc-500 font-mono">OR</span>

                        {/* Buy with Vibe Tokens button */}
                        <button
                          disabled={purchasingId !== null}
                          onClick={() => handlePurchase(phase, 'tk')}
                          className="flex-1 md:flex-initial px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-white/20 text-white font-mono font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95 text-center flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {purchasingId === phase.id ? (
                            <span>Unlocking...</span>
                          ) : (
                            <>
                              <Award size={12} className="text-yellow-400" />
                              <span>{phase.costTk} Vibe Tokens</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Sub highlights - Grid columns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 text-xs relative z-10">
                    
                    {/* Left Column: Audio FX and Hardware */}
                    <div className="space-y-3 bg-black/40 p-4 rounded-xl border border-white/5 relative">
                      <div className="flex items-center gap-2 text-zinc-400 font-bold border-b border-white/5 pb-2">
                        <Sliders size={13} className="text-[#00FF5A]" />
                        <span className="font-mono text-[9px] uppercase tracking-wider">Studio Audio Engine Upgrades</span>
                      </div>
                      
                      <ul className="space-y-2.5 leading-relaxed text-zinc-300 font-sans text-[11px]">
                        {phase.studioHighlights.map((hl, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-emerald-400 font-mono">✦</span>
                            <span>{hl}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Right Column: AI Assistant capability modules */}
                    <div className="space-y-3 bg-black/40 p-4 rounded-xl border border-white/5 relative">
                      <div className="flex items-center gap-2 text-zinc-400 font-bold border-b border-white/5 pb-2">
                        <Code size={13} className="text-amber-400" />
                        <span className="font-mono text-[9px] uppercase tracking-wider">AI Coproducer Assistant Upgrades</span>
                      </div>

                      <ul className="space-y-2.5 leading-relaxed text-zinc-300 font-sans text-[11px]">
                        {phase.aiHighlights.map((hl, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-amber-400 font-mono">✦</span>
                            <span>{hl}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer disclaimer info */}
        <div className="p-4 border-t border-white/5 bg-zinc-950/60 flex items-center justify-between text-[10px] text-zinc-500 font-mono shrink-0">
          <div className="flex items-center gap-1">
            <Lock size={12} className="text-emerald-500" />
            <span>Digital Audio Cryptographic License Vaulted</span>
          </div>
          <span>See Vibe © 2026 Production Labs</span>
        </div>

      </div>
    </div>
  );
}