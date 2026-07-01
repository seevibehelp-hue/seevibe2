// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { Search, Loader2, CreditCard, Sparkles, CheckCircle } from 'lucide-react';
import { useDawStore } from '../../store/useDawStore';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../contexts/AuthContext';

export interface EffectDefinition {
  id: string;
  name: string;
  isPremium: boolean;
  costNaira: number;
  costTk: number;
  categories: string[];
}

export const FX_LIST: EffectDefinition[] = [
  // Pitch
  { id: 'pitchShift', name: 'Pitch Shifter', isPremium: false, costNaira: 0, costTk: 0, categories: ['Pitch', 'All effects'] },
  { id: 'voicePitcher', name: 'ToneBoosters Voice Pitcher V4 ($)', isPremium: true, costNaira: 150, costTk: 1.5, categories: ['Pitch', 'ToneBoosters', 'All effects'] },
  { id: 'pitchCorrection', name: 'Vocal Tune ($)', isPremium: true, costNaira: 150, costTk: 1.5, categories: ['Pitch', 'All effects'] },
  { id: 'vocalTunePro', name: 'Vocal Tune PRO ($)', isPremium: true, costNaira: 150, costTk: 1.5, categories: ['Pitch', 'All effects'] },
  
  // EQ / Filter
  { id: 'graphicEQ', name: 'Graphic EQ (10-band)', isPremium: false, costNaira: 0, costTk: 0, categories: ['EQ', 'All effects'] },
  { id: 'graphicEQ15', name: 'Graphic EQ (15-band)', isPremium: false, costNaira: 0, costTk: 0, categories: ['EQ', 'All effects'] },
  { id: 'graphicEQ30', name: 'Graphic EQ (30-band)', isPremium: false, costNaira: 0, costTk: 0, categories: ['EQ', 'All effects'] },
  { id: 'highpass', name: 'High Pass', isPremium: false, costNaira: 0, costTk: 0, categories: ['EQ', 'All effects'] },
  { id: 'lowpass', name: 'Low Pass', isPremium: false, costNaira: 0, costTk: 0, categories: ['EQ', 'All effects'] },
  { id: 'bandpass', name: 'Band Pass', isPremium: false, costNaira: 0, costTk: 0, categories: ['EQ', 'All effects'] },
  { id: 'gate', name: 'Noise Gate', isPremium: false, costNaira: 0, costTk: 0, categories: ['Amp', 'All effects'] },
  { id: 'eq', name: 'Parametric EQ', isPremium: false, costNaira: 0, costTk: 0, categories: ['EQ', 'All effects'] },
  { id: 'phaseInverter', name: 'Phase Inverter', isPremium: false, costNaira: 0, costTk: 0, categories: ['EQ', 'All effects'] },
  { id: 'tbEQ', name: 'ToneBoosters EQ ($)', isPremium: true, costNaira: 150, costTk: 1.5, categories: ['EQ', 'ToneBoosters', 'All effects'] },
  { id: 'tbEQv4', name: 'ToneBoosters EQ V4 ($)', isPremium: true, costNaira: 150, costTk: 1.5, categories: ['EQ', 'ToneBoosters', 'All effects'] },
  { id: 'tbDualVCF', name: 'ToneBoosters Dual VCF ($)', isPremium: true, costNaira: 150, costTk: 1.5, categories: ['EQ', 'ToneBoosters', 'All effects'] },

  // Delay / Reverb
  { id: 'delay', name: 'Delay', isPremium: false, costNaira: 0, costTk: 0, categories: ['Delay', 'All effects'] },
  { id: 'reverb', name: 'Reverb', isPremium: false, costNaira: 0, costTk: 0, categories: ['Reverb', 'All effects'] },
  { id: 'dualDelay', name: 'Dual Delay', isPremium: false, costNaira: 0, costTk: 0, categories: ['Delay', 'All effects'] },
  { id: 'pingPongDelay', name: 'Ping Pong Delay', isPremium: false, costNaira: 0, costTk: 0, categories: ['Delay', 'All effects'] },
  { id: 'reverseDelay', name: 'Reverse Delay', isPremium: false, costNaira: 0, costTk: 0, categories: ['Delay', 'All effects'] },
  { id: 'tbReverb', name: 'ToneBoosters Reverb ($)', isPremium: true, costNaira: 150, costTk: 1.5, categories: ['Reverb', 'ToneBoosters', 'All effects'] },
  { id: 'fxSend', name: 'Fx Send', isPremium: false, costNaira: 0, costTk: 0, categories: ['Delay', 'All effects'] },

  // Modulation
  { id: 'chorus', name: 'Chorus', isPremium: false, costNaira: 0, costTk: 0, categories: ['Modulation', 'All effects'] },
  { id: 'phaser', name: 'Phaser', isPremium: false, costNaira: 0, costTk: 0, categories: ['Modulation', 'All effects'] },
  { id: 'tremolo', name: 'Tremolo', isPremium: false, costNaira: 0, costTk: 0, categories: ['Modulation', 'All effects'] },
  { id: 'dimensionD', name: 'Dimension D', isPremium: false, costNaira: 0, costTk: 0, categories: ['Modulation', 'All effects'] },
  { id: 'flanger', name: 'Flanger', isPremium: false, costNaira: 0, costTk: 0, categories: ['Modulation', 'All effects'] },
  { id: 'rotarySpeaker', name: 'Rotary Speaker ($)', isPremium: true, costNaira: 150, costTk: 1.5, categories: ['Modulation', 'All effects'] },
  { id: 'wahWah', name: 'Wah Wah', isPremium: false, costNaira: 0, costTk: 0, categories: ['Modulation', 'All effects'] },

  // Amp / Distortion
  { id: 'timeShaper', name: 'FL Gross Beat / Time-Shaper', isPremium: false, costNaira: 0, costTk: 0, categories: ['Dynamics', 'Modulation', 'All effects'] },
  { id: 'peakController', name: 'Fruity Peak Controller (Mod)', isPremium: false, costNaira: 0, costTk: 0, categories: ['Dynamics', 'All effects'] },
  { id: 'distortion', name: 'Distortion', isPremium: false, costNaira: 0, costTk: 0, categories: ['Amp', 'All effects'] },
  { id: 'overdrive', name: 'Overdrive', isPremium: false, costNaira: 0, costTk: 0, categories: ['Amp', 'All effects'] },
  { id: 'tubeDrive', name: 'Tube Drive', isPremium: false, costNaira: 0, costTk: 0, categories: ['Amp', 'All effects'] },
  { id: 'speakerSim', name: 'Speaker Sim', isPremium: false, costNaira: 0, costTk: 0, categories: ['Amp', 'All effects'] },

  // Dynamics
  { id: 'compressor', name: 'Compressor', isPremium: false, costNaira: 0, costTk: 0, categories: ['Amp', 'All effects'] },
  { id: 'tbBarricade', name: 'ToneBoosters Barricade ($)', isPremium: true, costNaira: 150, costTk: 1.5, categories: ['Amp', 'ToneBoosters', 'All effects'] },
  { id: 'tbBarricadeV4', name: 'ToneBoosters Barricade V4 ($)', isPremium: true, costNaira: 150, costTk: 1.5, categories: ['Amp', 'ToneBoosters', 'All effects'] },
  { id: 'tbCompressor', name: 'ToneBoosters Compressor ($)', isPremium: true, costNaira: 150, costTk: 1.5, categories: ['Amp', 'ToneBoosters', 'All effects'] },
  { id: 'tbCompressorV4', name: 'ToneBoosters Compressor V4 ($)', isPremium: true, costNaira: 150, costTk: 1.5, categories: ['Amp', 'ToneBoosters', 'All effects'] },
  { id: 'tbDeEsser', name: 'ToneBoosters DeEsser ($)', isPremium: true, costNaira: 150, costTk: 1.5, categories: ['Amp', 'ToneBoosters', 'All effects'] },
  { id: 'tbGate', name: 'ToneBoosters Gate ($)', isPremium: true, costNaira: 150, costTk: 1.5, categories: ['Amp', 'ToneBoosters', 'All effects'] },
  { id: 'tbMBCV4', name: 'ToneBoosters MBC V4 ($)', isPremium: true, costNaira: 150, costTk: 1.5, categories: ['Amp', 'ToneBoosters', 'All effects'] },

  // Other / Utility
  { id: 'stereoWidener', name: 'Stereo Widener', isPremium: false, costNaira: 0, costTk: 0, categories: ['Modulation', 'All effects'] },
  { id: 'tbBitJugglerV4', name: 'ToneBoosters BitJuggler V4 ($)', isPremium: true, costNaira: 150, costTk: 1.5, categories: ['Modulation', 'ToneBoosters', 'All effects'] },
  { id: 'tbEnhancerV4', name: 'ToneBoosters Enhancer V4 ($)', isPremium: true, costNaira: 150, costTk: 1.5, categories: ['Modulation', 'ToneBoosters', 'All effects'] },
  { id: 'tbFerox', name: 'ToneBoosters Ferox ($)', isPremium: true, costNaira: 150, costTk: 1.5, categories: ['Amp', 'ToneBoosters', 'All effects'] },
  { id: 'tbGonioMeterV4', name: 'ToneBoosters GonioMeter V4', isPremium: false, costNaira: 0, costTk: 0, categories: ['ToneBoosters', 'All effects'] },
  { id: 'tbReelBusV4', name: 'ToneBoosters ReelBus V4 ($)', isPremium: true, costNaira: 150, costTk: 1.5, categories: ['Amp', 'ToneBoosters', 'All effects'] },
  
  { id: 'vocalRemover', name: 'Vocal Remover', isPremium: false, costNaira: 0, costTk: 0, categories: ['Pitch', 'All effects'] },
  { id: 'volPan', name: 'Vol/Pan', isPremium: false, costNaira: 0, costTk: 0, categories: ['Modulation', 'All effects'] },
];

export const CATEGORIES = [
  'All effects',
  'Last used',
  'Purchased',
  'ToneBoosters',
  'Amp',
  'Delay',
  'EQ',
  'Modulation',
  'Pitch',
  'Reverb'
];

interface FXSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFX: (id: string) => void;
  onPreviewFX?: (effect: EffectDefinition) => void;
  onCancelPreviewEffect?: () => void;
  activePreviewId?: string | null;
}

export function FXSelectorModal({ 
  isOpen, 
  onClose, 
  onSelectFX, 
  onPreviewFX, 
  onCancelPreviewEffect, 
  activePreviewId 
}: FXSelectorModalProps) {
  const { user } = useAuth();
  const { purchasedPlugins, purchasePlugin } = useDawStore();
  
  const [selectedCategory, setSelectedCategory] = useState('All effects');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentEffects, setRecentEffects] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('recent_activated_effects');
      return stored ? JSON.parse(stored) : ['eq', 'reverb', 'delay'];
    } catch {
      return ['eq', 'reverb', 'delay'];
    }
  });

  const [wallet, setWallet] = useState<any>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [checkoutEffect, setCheckoutEffect] = useState<EffectDefinition | null>(null);
  const [purchasing, setPurchasing] = useState(false);

  // Fetch wallets database when prompt opens
  useEffect(() => {
    if (!user || !checkoutEffect) return;
    const fetchWallet = async () => {
      setLoadingWallet(true);
      try {
        const { data } = await supabase.from('wallets').select('*').eq('user_id', user.id).single();
        if (data) setWallet(data);
      } catch (err) {
        console.error("Wallet loading failed: ", err);
      } finally {
        setLoadingWallet(false);
      }
    };
    fetchWallet();
  }, [user, checkoutEffect]);

  if (!isOpen) return null;

  // Filter dynamic list
  const filteredEffects = FX_LIST.filter(effect => {
    // 1. Filter by search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      if (!effect.name.toLowerCase().includes(q)) return false;
    }

    // 2. Filter by category
    if (selectedCategory === 'All effects') {
      return true;
    }
    if (selectedCategory === 'Last used') {
      return recentEffects.includes(effect.id);
    }
    if (selectedCategory === 'Purchased') {
      return effect.isPremium && (purchasedPlugins.includes(effect.id) || purchasedPlugins.includes(effect.name));
    }
    
    return effect.categories.includes(selectedCategory);
  });

  const handleSelect = (effect: EffectDefinition) => {
    // Check if premium
    const isUnlocked = !effect.isPremium || 
                       purchasedPlugins.includes(effect.id) || 
                       purchasedPlugins.includes(effect.name) ||
                       // Also allow toneboosters goniometer
                       effect.id === 'tbGonioMeterV4';

    if (!isUnlocked) {
      setCheckoutEffect(effect);
      return;
    }

    // Add to recent list
    const updatedRecent = [effect.id, ...recentEffects.filter(id => id !== effect.id)].slice(0, 8);
    setRecentEffects(updatedRecent);
    localStorage.setItem('recent_activated_effects', JSON.stringify(updatedRecent));

    onSelectFX(effect.id);
    onClose();
  };

  const handleBuy = async (type: 'tk' | 'naira') => {
    if (!user || !wallet || !checkoutEffect) return;
    setPurchasing(true);

    try {
      const priceTk = checkoutEffect.costTk;
      const priceNaira = checkoutEffect.costNaira;

      if (type === 'tk') {
        if (Number(wallet.tk_balance) < priceTk) {
          alert(`Insufficient TK balance. You need ${priceTk} TK, but your balance is ${Number(wallet.tk_balance).toFixed(1)} TK.`);
          setPurchasing(false);
          return;
        }

        const newTk = Number(wallet.tk_balance) - priceTk;
        const { error: updErr } = await supabase.from('wallets').update({ tk_balance: newTk }).eq('user_id', user.id);
        if (updErr) throw updErr;
      } else {
        // Atomic server-side deduction (SECURITY DEFINER RPC).
        const { data: res, error: spendErr } = await supabase.rpc('spend_wallet_naira', {
          p_amount: priceNaira,
          p_reason: 'purchase_plugin',
          p_description: `Purchased DSP Plugin: ${checkoutEffect.name}`,
        });
        if (spendErr) throw spendErr;
        if (!(res as any)?.success) {
          alert(`Insufficient Naira balance. Need ₦${priceNaira.toLocaleString()}, have ₦${(res as any)?.balance_naira ?? 0}.`);
          setPurchasing(false);
          return;
        }
      }


      // Add to store
      purchasePlugin(checkoutEffect.id);
      alert(`Successfully unlocked: ${checkoutEffect.name}!`);

      // Add to recent and activate
      const updatedRecent = [checkoutEffect.id, ...recentEffects.filter(id => id !== checkoutEffect.id)].slice(0, 8);
      setRecentEffects(updatedRecent);
      localStorage.setItem('recent_activated_effects', JSON.stringify(updatedRecent));

      onSelectFX(checkoutEffect.id);
      setCheckoutEffect(null);
      onClose();

    } catch (err: any) {
      console.error(err);
      alert("Purchase failed: " + (err.message || err));
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <div id="fx-selector-overlay" className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
      
      {/* Outer panel box matching images */}
      <div id="fx-selector-container" className="bg-[#2D2D2D] border border-neutral-700 rounded-lg shadow-2xl flex flex-col max-w-2xl w-full text-white overflow-hidden h-[450px]">
        
        {/* Symmetrical Two-Column Content wrapper */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Categories Sidebar (Left, 35%) */}
          <div className="w-[35%] border-r border-neutral-700 bg-[#282828] flex flex-col p-4 overflow-y-auto relative select-none">
            <h2 className="text-white font-semibold text-lg mb-4 tracking-wide font-sans">Categories</h2>
            <div className="space-y-1">
              {CATEGORIES.map(category => {
                const isActive = selectedCategory === category;
                return (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`w-full text-left p-2 pl-3 rounded-md text-sm font-medium transition-all relative ${
                      isActive 
                        ? 'bg-[#ffffff0c] text-[#FA9534] font-semibold pl-4' 
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1 bottom-1 w-[3px] bg-[#FA9534] rounded-r-sm" />
                    )}
                    {category}
                  </button>
                );
              })}
            </div>

            {/* Amber category separator line styling from original look */}
            <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-[#FA9534]/40 to-transparent" />
          </div>

          {/* Effects Panel (Right, 65%) */}
          <div className="w-[65%] flex flex-col p-4 bg-[#2D2D2D] relative pb-12">
            
            {/* Header row + Dynamic Search Input */}
            <div className="flex items-center justify-between mb-4 mt-1 border-b border-neutral-800 pb-2">
              <span className="text-[#FA9534] uppercase tracking-wider text-xs font-bold font-mono">
                {selectedCategory}
              </span>
              <div className="relative flex items-center w-48 group">
                <input
                  type="text"
                  placeholder="Query DSP effects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs text-white border-b border-neutral-600 focus:border-[#FA9534] pb-1 outline-none transition-all placeholder-neutral-500 pr-5"
                />
                <Search size={14} className="absolute right-0 bottom-1.5 text-neutral-500 group-focus-within:text-[#FA9534] transition-colors" />
              </div>
            </div>

            {/* Effects Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 select-none">
              {filteredEffects.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-neutral-500 text-xs py-10 italic">
                  No effects found in this category.
                </div>
              ) : (
                filteredEffects.map((effect) => {
                  const isUnlocked = !effect.isPremium || 
                                     purchasedPlugins.includes(effect.id) || 
                                     purchasedPlugins.includes(effect.name) ||
                                     effect.id === 'tbGonioMeterV4';
                  const isCurrentlyPreviewed = activePreviewId === effect.id;

                  return (
                    <div
                      key={effect.id}
                      onClick={() => handleSelect(effect)}
                      className={`group flex justify-between items-center px-3 py-2.5 rounded-md hover:bg-neutral-800 border transition-all active:scale-[0.99] ${
                        isCurrentlyPreviewed 
                          ? 'bg-neutral-800/80 border-[#FA9534]/50 shadow-[0_0_8px_rgba(250,149,52,0.15)]' 
                          : 'border-transparent hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-neutral-200 group-hover:text-white transition-colors">
                          {effect.name}
                        </span>
                        {effect.isPremium && (
                          <span className="text-[10px] text-amber-500 font-semibold uppercase font-mono tracking-wider flex items-center gap-1 mt-0.5">
                            {isUnlocked ? (
                              <span className="text-emerald-500 flex items-center gap-0.5">
                                <CheckCircle size={10} /> Active VST Pro
                              </span>
                            ) : (
                              <span>✨ Premium Pro Plugin</span>
                            )}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!isUnlocked && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isCurrentlyPreviewed) {
                                onCancelPreviewEffect?.();
                              } else {
                                onPreviewFX?.(effect);
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider font-mono border transition-all ${
                              isCurrentlyPreviewed
                                ? 'bg-rose-950/30 text-rose-400 border-rose-500/30 animate-pulse hover:bg-rose-900/40 text-[9px]'
                                : 'bg-[#FA9534]/10 text-[#FA9534] border-[#FA9534]/20 hover:bg-[#FA9534] hover:text-black hover:border-transparent'
                            }`}
                          >
                            {isCurrentlyPreviewed ? "🔊 Stop Preview" : "⚡ Preview"}
                          </button>
                        )}
                        
                        {!isUnlocked && (
                          <span className="text-[9px] bg-[#403020] text-[#FA9534] group-hover:bg-[#E28935] group-hover:text-black font-semibold uppercase px-2 py-0.5 rounded font-mono transition-colors">
                            ₦{effect.costNaira.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom cancel absolute control */}
            <div className="absolute bottom-4 right-4 flex justify-end">
              <button
                onClick={onClose}
                className="text-[#FA9534] hover:text-white text-sm font-semibold uppercase font-mono tracking-widest pl-4 py-1 transition-colors"
               >
                Cancel
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* Checkout Purchase Dialog */}
      {checkoutEffect && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[99999]">
          <div className="bg-[#1E1E1E] border border-[#FA9534]/30 rounded-2xl w-full max-w-sm p-6 text-white shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
            
            <div className="absolute top-0 right-0 p-3 opacity-15">
              <Sparkles size={100} className="text-[#FA9534]" />
            </div>

            <h3 className="text-[#FA9534] font-black tracking-wider uppercase text-xs mb-1 font-mono">Unlock Premium Plugin</h3>
            <h4 className="text-lg font-bold tracking-tight mb-4 border-b border-neutral-800 pb-2">{checkoutEffect.name}</h4>
            
            <p className="text-neutral-400 text-xs leading-relaxed mb-4">
              Unlock professional corrective DSP formulas, real-time filters, and dynamic hardware simulations for only <b>₦{checkoutEffect.costNaira.toLocaleString()}</b>. Unlocking grants permanent license ownership across all your tracks.
            </p>

            {/* Real-time VST Preview Action within popup */}
            {onPreviewFX && (
              <button
                type="button"
                onClick={() => {
                  if (activePreviewId === checkoutEffect.id) {
                    onCancelPreviewEffect?.();
                  } else {
                    onPreviewFX(checkoutEffect);
                  }
                }}
                className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-[10px] font-mono font-bold uppercase transition-all mb-4 border ${
                  activePreviewId === checkoutEffect.id
                    ? 'bg-rose-950/40 text-rose-400 border-rose-500/40 hover:border-rose-500'
                    : 'bg-[#403020] text-[#FA9534] border-[#FA9534]/30 hover:border-[#FA9534]'
                }`}
              >
                {activePreviewId === checkoutEffect.id ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping mr-1" />
                    Stop Real-time Sound Preview
                  </>
                ) : (
                  <>
                    <Sparkles size={11} className="text-[#FA9534] animate-pulse" />
                    Preview Live Sound on Track
                  </>
                )}
              </button>
            )}

            {loadingWallet ? (
              <div className="flex gap-2 items-center text-xs text-[#FA9534] justify-center py-6 font-mono">
                <Loader2 size={16} className="animate-spin" /> Retrieving Wallet Balances...
              </div>
            ) : wallet ? (
              <div className="space-y-4">
                
                {/* Current balances view */}
                <div className="bg-black/30 border border-neutral-800 rounded-lg p-3 text-xs mb-6 flex flex-col gap-1.5">
                  <div className="text-neutral-500 font-semibold uppercase font-mono tracking-wider text-[9px]">Your Available Funds</div>
                  <div className="flex justify-between font-mono">
                    <span className="text-neutral-400">Naira Wallet Balance:</span>
                    <span className="text-[#00FFBC] font-bold">₦{Number(wallet.balance_naira).toLocaleString()}</span>
                  </div>
                </div>

                {/* Purchase Buttons */}
                <div className="flex flex-col gap-2">
                  <button
                    disabled={purchasing}
                    onClick={() => handleBuy('naira')}
                    className="w-full bg-[#FA9534] hover:bg-amber-400 text-black font-extrabold py-2.5 px-4 rounded-xl text-xs flex justify-between items-center transition-all disabled:opacity-50 shadow-lg font-sans"
                  >
                    <span className="flex items-center gap-1.5">
                      <CreditCard size={14} /> Pay via Naira Wallet
                    </span>
                    <span className="font-mono text-xs font-black">₦{checkoutEffect.costNaira.toLocaleString()}</span>
                  </button>
                </div>

              </div>
            ) : (
              <div className="text-xs text-red-400 italic text-center py-4">
                Unable to load wallets. Please verify internet connection.
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3 border-t border-neutral-800 pt-4">
              <button
                disabled={purchasing}
                onClick={() => setCheckoutEffect(null)}
                className="text-neutral-400 hover:text-white text-xs font-semibold uppercase tracking-wider"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}