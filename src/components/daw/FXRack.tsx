// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useDawStore, getFxDefaults } from '../../store/useDawStore';
import { FXSelectorModal, FX_LIST, EffectDefinition } from './FXSelectorModal';
import { TimeShaperEnvelopeEditor } from './TimeShaperEnvelopeEditor';
import { supabase } from '../../integrations/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Plus, Trash2, Sliders, Activity, Disc, Eye, Sparkles, Save, 
  Globe, Lock, Coins, Check, AlertCircle, History, RefreshCw, 
  HelpCircle, Sparkle, Download, CheckSquare, Award, ArrowUpRight, DollarSign, Terminal, Cpu
} from 'lucide-react';
import * as Tone from 'tone';
import { dispatchNativeEffectCommand, subscribeToNativeBridgeLogs, NativeCommandLog } from '../../utils/nativeBridge';
import { AudioEngineSelectorModal } from './AudioEngineSelectorModal';

// Default pre-seeded public Marketplace presets
const DEFAULT_MARKETPLACE_PRESETS = [
  {
    id: "preset_master_1",
    name: "Golden Afrobeat Lead Vibe",
    description: "Crisp and upfront vocal chain configured with double-tracked pitch corrections and high-end air compression.",
    creator_email: "vibe_legend_99@gmail.com",
    creator_id: "0a1b2c3d-4e5f-6a7b-8c9d-0a1b2c3d4e5f",
    premium_effects: ["voicePitcher", "vocalTunePro"],
    fx_settings: {
      eq: { enabled: true, high: 4, mid: -1, low: -3 },
      vocalTunePro: { enabled: true, amount: 90, speed: 85, humanize: 15, scale: "Chromatic" },
      voicePitcher: { enabled: true, shift: 12, formant: 6, wet: 0.35 },
      reverb: { enabled: true, decay: 2.2, mix: 0.2 },
      delay: { enabled: true, time: "8n", feedback: 0.25, mix: 0.1 }
    }
  },
  {
    id: "preset_master_2",
    name: "Classic Amapiano Chops (Wide FX)",
    description: "Wide spatial reflections, micro-delay taps, and resonant VCF filtering perfect for back-end dynamic hums and vocal chops.",
    creator_email: "abelossu7@gmail.com",
    creator_id: "bf8b31a5-8e4d-440d-8302-69019b88f3ea",
    premium_effects: ["tbReverb", "tbDualVCF", "tbBitJugglerV4"],
    fx_settings: {
      tbReverb: { enabled: true, decay: 4.5, mix: 0.6 },
      tbDualVCF: { enabled: true, cutoff: 1400, resonance: 2.5, wet: 0.5 },
      tbBitJugglerV4: { enabled: true, bits: 8, wet: 0.3 },
      lowpass: { enabled: true, frequency: 4000, Q: 1.2 }
    }
  },
  {
    id: "preset_master_3",
    name: "Radio-Ready Rap Vocal PRO",
    description: "Pure studio clarity. Gated de-esser paired with tube warmth and barricade ceiling control.",
    creator_email: "admin@vibe.io",
    creator_id: "99999999-9999-9999-9999-999999999999",
    premium_effects: ["tbDeEsser", "tbBarricadeV4", "tbCompressorV4"],
    fx_settings: {
      tbDeEsser: { enabled: true, threshold: -28, reduction: 6, wet: 0.7 },
      tbBarricadeV4: { enabled: true, limit: -0.1, threshold: -3, wet: 1.0 },
      tbCompressorV4: { enabled: true, threshold: -18, ratio: 4, wet: 1.0 },
      eq: { enabled: true, high: 2, mid: 0, low: -1 }
    }
  }
];

// Helper to provide defaults for custom/premium effects
const getModuleDefaults = (fxId: string) => {
  let inner = {};
  switch (fxId) {
    case 'tbEQ': inner = { high: 0, mid: 0, low: 0 }; break;
    case 'tbEQv4': inner = { high: 0, mid: 0, low: 0, q: 1.2 }; break;
    case 'tbDualVCF': inner = { cutoff: 1200, resonance: 1.5, wet: 0.5 }; break;
    case 'tbReverb': inner = { decay: 2.5, mix: 0.4 }; break;
    case 'rotarySpeaker': inner = { speed: 2.0, wet: 0.4 }; break;
    case 'tbBarricade':
    case 'tbBarricadeV4': inner = { limit: -0.2, threshold: -2, wet: 1.0 }; break;
    case 'tbCompressor':
    case 'tbCompressorV4': inner = { threshold: -24, ratio: 6, wet: 1.0 }; break;
    case 'tbDeEsser': inner = { threshold: -25, reduction: 5, wet: 0.8 }; break;
    case 'tbGate': inner = { threshold: -45, wet: 1.0 }; break;
    case 'tbMBCV4': inner = { lowBand: 0, midBand: 0, highBand: 0, wet: 0.8 }; break;
    case 'tbBitJugglerV4': inner = { bits: 10, wet: 0.6 }; break;
    case 'tbEnhancerV4': inner = { compression: 4, air: 2, wet: 0.5 }; break;
    case 'tbFerox': inner = { saturation: 3, tapeAge: 4, wet: 0.5 }; break;
    case 'tbReelBusV4': inner = { drive: 3, wowFlutter: 2, wet: 0.4 }; break;
    case 'bandpass': inner = { frequency: 1000, Q: 1 }; break;
    case 'stereoWidener': inner = { width: 0.6, wet: 0.5 }; break;
    case 'flanger': inner = { feedback: 0.5, delayTime: 0.005, wet: 0.5 }; break;
    case 'pitchCorrection': inner = { amount: 80, speed: 80, scale: "Minor" }; break;
    
    // Core and others:
    case 'eq': inner = { high: 0, mid: 0, low: 0 }; break;
    case 'graphicEQ': inner = { band1: 0, band2: 0, band3: 0, band4: 0, band5: 0, band6: 0, band7: 0, band8: 0, band9: 0, band10: 0 }; break;
    case 'reverb': inner = { decay: 1.5, mix: 0.3 }; break;
    case 'delay': inner = { time: '8n', feedback: 0.3, mix: 0.2 }; break;
    case 'pitchShift': inner = { pitch: 0 }; break;
    case 'compressor': inner = { threshold: -24, ratio: 12 }; break;
    case 'chorus': inner = { depth: 0.5, frequency: 1.5, delayTime: 2.5, wet: 0.5 }; break;
    case 'distortion': inner = { amount: 0.4, wet: 0 }; break;
    case 'phaser': inner = { frequency: 1.5, depth: 0.5, wet: 0 }; break;
    case 'tremolo': inner = { frequency: 5, depth: 0.5, wet: 0 }; break;
    case 'gate': inner = { threshold: -40, wet: 0 }; break;
    case 'highpass': inner = { frequency: 200, Q: 1 }; break;
    case 'lowpass': inner = { frequency: 2000, Q: 1 }; break;
    case 'pingPongDelay': inner = { time: '4n', feedback: 0.3, wet: 0 }; break;
    case 'vocalTunePro': inner = { amount: 80, speed: 80, humanize: 20, scale: "Chromatic" }; break;
    case 'voicePitcher': inner = { shift: 0, formant: 5, wet: 0 }; break;
    default: break;
  }
  return { ...inner, enabled: true, added: true };
};

export function FXRack() {
  const { user } = useAuth();
  const { tracks, selectedTrackId, updateTrack, purchasedPlugins, purchasePlugin } = useDawStore() as any;
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isEngineOpen, setIsEngineOpen] = useState(false);
  const [activeRackView, setActiveRackView] = useState<'rack' | 'presets'>('rack');
  const [nativeLogs, setNativeLogs] = useState<NativeCommandLog[]>([]);

  useEffect(() => {
    return subscribeToNativeBridgeLogs(setNativeLogs);
  }, []);

  // Preset saving states
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDesc, setNewPresetDesc] = useState('');
  const [newPresetIsPublic, setNewPresetIsPublic] = useState(false);
  const [savingPreset, setSavingPreset] = useState(false);

  // Marketplace states
  const [activeMarketplaceTab, setActiveMarketplaceTab] = useState<'public' | 'private'>('public');
  const [presetsList, setPresetsList] = useState<any[]>([]);
  const [loadingMarketplace, setLoadingMarketplace] = useState(false);
  const [userWallet, setUserWallet] = useState<any>(null);
  
  // Checkout presets
  const [checkoutPreset, setCheckoutPreset] = useState<any | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  // Dynamic preview states for premium elements (effects and presets)
  const [activePreview, setActivePreview] = useState<{
    type: 'effect' | 'preset';
    id: string; // effect.id or preset.id
    name: string; // name
    originalFx: any; // deep copy of track.fx backup before preview
    unownedPremiumEffects: string[]; // list of required unowned premium effect IDs
    presetObj?: any; // the whole preset if preset preview
    effectObj?: any; // the whole effect definition if effect preview
    trackId: string; // track the preview was applied on
  } | null>(null);

  const [checkoutEffect, setCheckoutEffect] = useState<any | null>(null);
  const [checkingOutEffect, setCheckingOutEffect] = useState(false);

  const track = tracks.find((t: any) => t.id === selectedTrackId);

  // Cancel/cleanup preview when selected track changes or FXRack unmounts
  useEffect(() => {
    return () => {
      // Revert track state if unmounting with active preview
      if (activePreview) {
        const storeTracks = useDawStore.getState().tracks;
        const targetTrack = storeTracks.find((t: any) => t.id === activePreview.trackId);
        if (targetTrack && activePreview.originalFx) {
          updateTrack(activePreview.trackId, { fx: activePreview.originalFx });
        }
      }
    };
  }, [activePreview]);

  // Handle track switching: if active track changes, revert prev track and clear preview
  useEffect(() => {
    if (activePreview && activePreview.trackId !== selectedTrackId) {
      const prevTrackId = activePreview.trackId;
      const prevTrackObj = tracks.find((t: any) => t.id === prevTrackId);
      if (prevTrackObj && activePreview.originalFx) {
        updateTrack(prevTrackId, { fx: activePreview.originalFx });
      }
      setActivePreview(null);
    }
  }, [selectedTrackId]);

  // Fetch presets list (Supabase fallback to LocalStorage)
  const fetchPresetsAndWallet = async () => {
    setLoadingMarketplace(true);
    try {
      if (user) {
        // Fetch user wallet
        const { data: wData } = await supabase.from('wallets').select('*').eq('user_id', user.id).single();
        if (wData) setUserWallet(wData);
      } else {
        setUserWallet(null);
      }

      // Load presets in LocalStorage first
      let localSaved: any[] = [];
      try {
        const str = localStorage.getItem('vibe_daw_presets');
        if (str) localSaved = JSON.parse(str);
      } catch {}

      // Attempt to load from public table. If table missing, fallback gracefully
      try {
        const { data: dbData, error: dbErr } = await supabase.from('vocal_presets' as any).select('*');
        if (!dbErr && dbData) {
          // Merge
          const all = [...dbData, ...localSaved];
          const uniq = Array.from(new Map(all.map(item => [item.id, item])).values());
          setPresetsList(uniq);
        } else {
          // Set merged default
          const uniq = Array.from(new Map([...DEFAULT_MARKETPLACE_PRESETS, ...localSaved].map(item => [item.id, item])).values());
          setPresetsList(uniq);
        }
      } catch {
        const uniq = Array.from(new Map([...DEFAULT_MARKETPLACE_PRESETS, ...localSaved].map(item => [item.id, item])).values());
        setPresetsList(uniq);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMarketplace(false);
    }
  };

  useEffect(() => {
    fetchPresetsAndWallet();
  }, [user, selectedTrackId]);

  // Keep added: true synchronised for any effect that is currently active/enabled on the tract
  // This ensures that when a preset is loaded or track state is synchronized, bypassing (enabled=false) on an effect does not "delete" it from the rack.
  useEffect(() => {
    if (!track || !track.fx) return;
    
    let needsUpdate = false;
    const updatedFx = { ...track.fx };
    
    Object.keys(updatedFx).forEach((key) => {
      const module = (track.fx as any)[key];
      if (module && module.enabled && module.added !== true) {
        updatedFx[key as keyof typeof updatedFx] = { ...module, added: true };
        needsUpdate = true;
      }
    });
    
    if (needsUpdate) {
      updateTrack(track.id, { fx: updatedFx });
    }
  }, [track?.id, track?.fx]);

  if (!track) {
    return (
      <div className="h-full bg-background flex items-center justify-center text-gray-500">
        Select a track in the Timeline to view its Effects Rack.
      </div>
    );
  }

  const { fx } = track;

  const isAdded = (fxKey: string) => {
    const module = fx[fxKey as keyof typeof fx] as any;
    if (!module) return false;
    if (module.added !== undefined) return module.added;
    
    // Core effects standard fallback to added by default
    const coreEffects = ['eq', 'compressor', 'pitchShift', 'reverb', 'chorus', 'delay'];
    if (coreEffects.includes(fxKey)) return true;
    return !!module.enabled;
  };

  const getCardStyleClass = (fxKey: string, isPremium: boolean = false, isColSpan2: boolean = false) => {
    const module = fx[fxKey as keyof typeof fx] as any;
    const isEnabled = module?.enabled !== false;
    
    return [
      isColSpan2 ? "col-span-1 md:col-span-2" : "",
      "rounded p-4 relative group transition-all duration-300 border flex flex-col justify-between h-full min-h-[190px]",
      isEnabled 
        ? (isPremium ? "bg-[#141414] border-[#FA9534]/30 hover:border-[#FA9534]/50 shadow-[0_2px_12px_rgba(250,149,52,0.03)]" : "bg-[#141414] border-[#2A2A2A] hover:border-neutral-700")
        : "opacity-60 saturate-[0.15] bg-[#0A0A0A] border-dashed border-zinc-800 shadow-none hover:opacity-90 hover:saturate-[0.5]"
    ].join(" ");
  };

  const updateFX = (fxType: keyof typeof track.fx, params: any) => {
    const currentTrack = useDawStore.getState().tracks.find((t: any) => t.id === track.id);
    if (!currentTrack || !currentTrack.fx) return;

    const updatedModule = { ...((currentTrack.fx as any)[fxType] || {}), ...params };

    updateTrack(track.id, {
      fx: {
        ...currentTrack.fx,
        [fxType]: updatedModule
      }
    });

    // Handle native effects bridge serialization call
    if (currentTrack.effectsMode === 'native') {
      dispatchNativeEffectCommand(track.id, fxType as string, updatedModule);
    }
  };

  const removeFX = (fxType: keyof typeof track.fx) => {
    updateFX(fxType, { added: false, enabled: false });
  };

  const getPreset = (name: string) => {
    if (name === 'Studio Vocal') {
      updateFX('eq', { enabled: true, added: true, high: 2, mid: -1, low: -2 });
      updateFX('compressor', { enabled: true, added: true, threshold: -20, ratio: 4 });
      updateFX('reverb', { enabled: true, added: true, decay: 1.5, mix: 0.15 });
      updateFX('delay', { enabled: true, added: true, mix: 0.05 });
      updateFX('pitchShift', { enabled: true, added: true, pitch: 0 });
    } else if (name === 'Trap Vocal') {
      updateFX('eq', { enabled: true, added: true, high: 4, mid: -3, low: -4 });
      updateFX('compressor', { enabled: true, added: true, threshold: -24, ratio: 8 });
      updateFX('reverb', { enabled: true, added: true, decay: 2.0, mix: 0.25 });
      updateFX('delay', { enabled: true, added: true, mix: 0.15 });
      updateFX('pitchShift', { enabled: true, added: true, pitch: 0 });
    } else if (name === 'Podcast') {
      updateFX('eq', { enabled: true, added: true, high: 1, mid: 2, low: 1 });
      updateFX('compressor', { enabled: true, added: true, threshold: -18, ratio: 3 });
      updateFX('reverb', { enabled: false, added: true, mix: 0 });
      updateFX('delay', { enabled: false, added: true, mix: 0 });
      updateFX('pitchShift', { enabled: false, added: true, pitch: 0 });
    }
  };

  const [aiLoading, setAiLoading] = React.useState(false);

  const enhanceVocalWithAI = async () => {
    const description = window.prompt("What vibe are you going for? (e.g. 'Warm Podcast', 'Punchy Rap', 'Ethereal Pop')");
    if (!description) return;
    
    setAiLoading(true);
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const { data: { session } } = await supabase.auth.getSession();
      const { apiUrl } = await import('@/lib/apiBase');
      const res = await fetch(apiUrl('/api/ai/enhance-vocal'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ description })
      });
      const data = await res.json();
      
      if (data.eq) updateFX('eq', { enabled: true, added: true, ...data.eq });
      if (data.compressor) updateFX('compressor', { enabled: true, added: true, ...data.compressor });
      if (data.reverb) updateFX('reverb', { enabled: true, added: true, ...data.reverb });
      if (data.delay) updateFX('delay', { enabled: true, added: true, ...data.delay });
      updateFX('pitchShift', { enabled: true, added: true });
    } catch (e) {
      console.error(e);
      alert("Failed to get AI settings");
    }
    setAiLoading(false);
  };

  const handleSelectFX = (fxId: string) => {
    // Enable the newly selected effect with defaults
    updateFX(fxId as any, getModuleDefaults(fxId));
  };

  // Preset saving handler
  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim()) {
      alert("Please enter a preset name");
      return;
    }
    if (!user) {
      alert("Please login first to save presets");
      return;
    }

    setSavingPreset(true);

    try {
      // Find all active premium effects
      const activePremiumIds = Object.keys(fx).filter((k) => {
        const val = fx[k];
        if (!val || !val.enabled) return false;
        const def = FX_LIST.find((d) => d.id === k);
        return def?.isPremium === true;
      });

      const newPreset = {
        id: "preset_" + Date.now(),
        name: newPresetName.trim(),
        description: newPresetDesc.trim(),
        creator_email: user.email || "user@vibe.io",
        creator_id: user.id,
        premium_effects: activePremiumIds,
        fx_settings: JSON.parse(JSON.stringify(fx)), // deep copy of channel FX rack
        created_at: new Date().toISOString(),
        is_public: newPresetIsPublic
      };

      // Save to LocalStorage
      const localStr = localStorage.getItem('vibe_daw_presets');
      const localList = localStr ? JSON.parse(localStr) : [];
      localList.unshift(newPreset);
      localStorage.setItem('vibe_daw_presets', JSON.stringify(localList));

      // Attempt Supabase Insert
      try {
        await supabase.from('vocal_presets' as any).insert({
          id: newPreset.id,
          name: newPreset.name,
          description: newPreset.description,
          creator_id: user.id,
          creator_email: newPreset.creator_email,
          premium_effects: newPreset.premium_effects,
          fx_settings: newPreset.fx_settings,
          is_public: newPreset.is_public
        });
      } catch (err) {
        console.log("Not critical: skipped Cloud Insert due to Schema availability. LocalStorage cache is primary.");
      }

      alert(`Successfully saved preset "${newPresetName}"!`);
      setNewPresetName('');
      setNewPresetDesc('');
      setIsSaveModalOpen(false);
      fetchPresetsAndWallet();
    } catch (err: any) {
      alert("Saving failed: " + err.message);
    } finally {
      setSavingPreset(false);
    }
  };
  
  const handleDeletePreset = async (presetId: string) => {
    if (!window.confirm("Are you sure you want to delete this preset? This action cannot be undone.")) return;
    
    try {
      // Delete from LocalStorage
      const localStr = localStorage.getItem('vibe_daw_presets');
      if (localStr) {
        let localList = JSON.parse(localStr);
        localList = localList.filter((p: any) => p.id !== presetId);
        localStorage.setItem('vibe_daw_presets', JSON.stringify(localList));
      }

      // Delete from Supabase
      if (user) {
        try {
          await supabase.from('vocal_presets' as any).delete().eq('id', presetId).eq('creator_id', user.id);
        } catch (dbErr) {
          console.log("Supabase delete skipped/unsupported:", dbErr);
        }
      }

      alert("Preset deleted successfully.");
      fetchPresetsAndWallet();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  // Preview / Audition Actions
  const handleCancelPreview = () => {
    if (!activePreview) return;
    const storeTracks = useDawStore.getState().tracks;
    const targetTrack = storeTracks.find((t: any) => t.id === activePreview.trackId);
    if (targetTrack && activePreview.originalFx) {
      updateTrack(activePreview.trackId, { fx: activePreview.originalFx });
    }
    setActivePreview(null);
  };

  const handlePreviewEffect = (effect: any) => {
    if (!track) return;
    
    // Cancel any active preview first to ensure a fresh, clean backup
    if (activePreview) {
      handleCancelPreview();
    }

    setCheckoutEffect(null);

    const originalFxBackup = JSON.parse(JSON.stringify(track.fx || {}));
    
    // Set active preview context
    setActivePreview({
      type: 'effect',
      id: effect.id,
      name: effect.name,
      originalFx: originalFxBackup,
      unownedPremiumEffects: [effect.id],
      effectObj: effect,
      trackId: track.id
    });

    // Injects the premium effect with its specific defaults in enabled state
    updateTrack(track.id, {
      fx: {
        ...(track.fx || {}),
        [effect.id]: {
          ...(getModuleDefaults(effect.id) || { enabled: true })
        }
      }
    });
  };

  const handlePreviewPreset = (preset: any) => {
    if (!track) return;

    // Cancel active preview first
    if (activePreview) {
      handleCancelPreview();
    }

    const originalFxBackup = JSON.parse(JSON.stringify(track.fx || {}));

    setActivePreview({
      type: 'preset',
      id: preset.id,
      name: preset.name,
      originalFx: originalFxBackup,
      unownedPremiumEffects: (preset.premium_effects || []).filter((id: string) => !purchasedPlugins.includes(id)),
      presetObj: preset,
      trackId: track.id
    });

    // Directly mount the preset's complete VST map onto the track for immediate listening
    updateTrack(track.id, {
      fx: JSON.parse(JSON.stringify(preset.fx_settings))
    });
  };

  const handleCheckoutEffectPurchase = async (currencyType: 'naira' | 'tk') => {
    if (!user || !userWallet || !checkoutEffect) return;

    setCheckingOutEffect(true);

    try {
      const priceNaira = checkoutEffect.costNaira || 150;
      const priceTk = checkoutEffect.costTk || 1.5;

      // Verify Purchaser's Wallet funds
      if (currencyType === 'naira') {
        const { data: res, error: spendErr } = await supabase.rpc('spend_wallet_naira', {
          p_amount: priceNaira,
          p_reason: 'purchase_plugin',
          p_description: `Purchased DSP Plugin: ${checkoutEffect.name}`,
        });
        if (spendErr || !(res as any)?.success) {
          alert(spendErr?.message || `Insufficient Naira. Need ₦${priceNaira.toLocaleString()}.`);
          setCheckingOutEffect(false);
          return;
        }

      } else {
        if (Number(userWallet.tk_balance) < priceTk) {
          alert(`Insufficient TK balance. You need ${priceTk} TK, but your balance is ${Number(userWallet.tk_balance).toFixed(1)} TK.`);
          setCheckingOutEffect(false);
          return;
        }

        // Deduct TK
        const newTk = Number(userWallet.tk_balance) - priceTk;
        await supabase.from('wallets').update({ tk_balance: newTk }).eq('user_id', user.id);

        // Write purchaser transaction log
        await supabase.from('wallet_transactions').insert({
          user_id: user.id,
          amount_naira: 0,
          amount_usd: 0.10,
          type: 'purchase_plugin',
          description: `Purchased DSP Plugin: ${checkoutEffect.name} (via TK Coins)`
        });
      }

      // Add permanent ownership to the profile
      purchasePlugin(checkoutEffect.id);
      
      alert(`Successfully unlocked premium plugin "${checkoutEffect.name}"!`);
      
      // Clean up states
      setCheckoutEffect(null);
      if (activePreview?.type === 'effect' && activePreview.id === checkoutEffect.id) {
        // Keep their current tweaks live since VST is now officially licensed! Just end the temporary mode
        setActivePreview(null);
      }
      
      fetchPresetsAndWallet();

    } catch (err: any) {
      console.error(err);
      alert("Checkout failed: " + err.message);
    } finally {
      setCheckingOutEffect(false);
    }
  };

  // Applying preset & resolving monetization payouts ($0.10 price, $0.02 royalty)
  const handleApplyPreset = async (preset: any) => {
    if (!user) {
      alert("Logged in account required to apply presets");
      return;
    }

    // Identify which premium effects are contained in the preset
    const containedPremiumIds = preset.premium_effects || [];
    
    // Check which of those premium effects the current user DOES NOT yet own
    const unownedPremiumIds = containedPremiumIds.filter((id: string) => {
      return !purchasedPlugins.includes(id);
    });

    if (unownedPremiumIds.length === 0) {
      // Apply instantly for free
      applyPresetFxSettings(preset);
      return;
    }

    // Set checkout preset to open prompt
    setCheckoutPreset(preset);
  };

  const applyPresetFxSettings = (preset: any) => {
    // Start with a comprehensive clean default FX set to ensure all parameters are present
    const cleanDefaults = getFxDefaults();
    const presetSettings = preset.fx_settings || {};
    
    // Deep clone the defaults and merge preset settings over them
    const mergedFx = JSON.parse(JSON.stringify(cleanDefaults));
    const clonedPresetSettings = JSON.parse(JSON.stringify(presetSettings));

    Object.keys(clonedPresetSettings).forEach((key) => {
      if (mergedFx[key] === undefined) {
        // If a custom model is not in normal defaults, add it
        mergedFx[key] = clonedPresetSettings[key];
      } else {
        // Merge preset values over default values
        mergedFx[key] = {
          ...mergedFx[key],
          ...clonedPresetSettings[key]
        };
      }
    });

    // Make sure all modules present / active in the preset are rendered and editable in "My Channels Rack"
    Object.keys(mergedFx).forEach((key) => {
      const module = mergedFx[key];
      if (module) {
        const isPremium = preset.premium_effects?.includes(key);
        const isExplicitlyEnabled = module.enabled === true;
        const existsInPreset = Object.prototype.hasOwnProperty.call(presetSettings, key);

        if (isPremium || isExplicitlyEnabled || existsInPreset || module.added === true) {
          module.added = true;
          if (module.enabled === undefined) {
            module.enabled = true;
          }
        }
      }
    });

    // Replace track's fx rack with our fully hydrated and editable FX chain
    updateTrack(track.id, {
      fx: mergedFx
    });

    // Automatically transition the active session view from presets marketplace back to My Channels Rack so they can immediately see and edit the effects
    setActiveRackView('rack');

    alert(`Preset "${preset.name}" applied successfully to track "${track.name}"! Loaded into My Channels Rack for editing.`);
  };

  const handleCheckoutPresetPurchase = async (currencyType: 'naira' | 'tk') => {
    if (!user || !userWallet || !checkoutPreset) return;

    setCheckingOut(true);

    try {
      const unownedPremiumIds = checkoutPreset.premium_effects.filter((id: string) => {
        return !purchasedPlugins.includes(id);
      });

      const count = unownedPremiumIds.length;
      const totalNaira = count * 150; // $0.10 per effect is 150 Naira
      const totalTk = count * 1.5;   // $0.10 per effect is 1.5 TK

      // Verify Purchaser's Wallet funds
      if (currencyType === 'naira') {
        const { data: res, error: spendErr } = await supabase.rpc('spend_wallet_naira', {
          p_amount: totalNaira,
          p_reason: 'purchase_plugin',
          p_description: `Purchased Preset Unlock: ${checkoutPreset.name} (${count} Premium Effects)`,
        });
        if (spendErr || !(res as any)?.success) {
          alert(spendErr?.message || `Insufficient Naira. Need ₦${totalNaira.toLocaleString()}.`);
          setCheckingOut(false);
          return;
        }

      } else {
        if (Number(userWallet.tk_balance) < totalTk) {
          alert(`Insufficient TK balance. You need ${totalTk} TK, but your balance is ${Number(userWallet.tk_balance).toFixed(1)} TK.`);
          setCheckingOut(false);
          return;
        }

        // Deduct TK
        const newTk = Number(userWallet.tk_balance) - totalTk;
        await supabase.from('wallets').update({ tk_balance: newTk }).eq('user_id', user.id);

        // Write purchaser transaction log
        await supabase.from('wallet_transactions').insert({
          user_id: user.id,
          amount_naira: 0,
          amount_usd: count * 0.10,
          type: 'purchase_plugin',
          description: `Purchased Preset Unlock: ${checkoutPreset.name} (via TK Coins)`
        });
      }

      // ROYALTY CALCULATION: Publisher earns $0.02 (30 Naira or 0.3 TK) per premium effect in the preset!
      const earningNaira = count * 30;
      const earningTk = count * 0.3;

      if (checkoutPreset.creator_id && checkoutPreset.creator_id !== user.id) {
        try {
          const { data: pubWallet } = await supabase.from('wallets').select('*').eq('user_id', checkoutPreset.creator_id).single();
          if (pubWallet) {
            const newWithdrawable = Number(pubWallet.withdrawable_balance || 0) + earningNaira;
            const newNaira = Number(pubWallet.balance_naira || 0) + earningNaira;
            
            await supabase.from('wallets').update({
              withdrawable_balance: newWithdrawable,
              balance_naira: newNaira
            }).eq('user_id', checkoutPreset.creator_id);

            // Record Publisher Transaction Log
            await supabase.from('wallet_transactions').insert({
              user_id: checkoutPreset.creator_id,
              amount_naira: earningNaira,
              amount_usd: count * 0.02,
              type: 'revenue',
              description: `Creator Preset Royalty: ${user.email} unlocked "${checkoutPreset.name}" containing ${count} premium effects`
            });
          }
        } catch (pubErr) {
          console.error("Failed to credit publisher royalty: ", pubErr);
        }
      }

      // Unlock these premium plugins for the purchaser's profile
      unownedPremiumIds.forEach((id: string) => {
        purchasePlugin(id);
      });

      // Apply the settings to active FX rack!
      applyPresetFxSettings(checkoutPreset);
      setCheckoutPreset(null);
      if (activePreview?.type === 'preset' && activePreview.id === checkoutPreset.id) {
        setActivePreview(null);
      }
      fetchPresetsAndWallet();

    } catch (err: any) {
      console.error(err);
      alert("Checkout failed: " + err.message);
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="h-full bg-background flex flex-col overflow-y-auto w-full pb-36 select-none">
      
      {/* Upper toolbar panel */}
      <div className="p-4 border-b border-[#2A2A2A] bg-[#1E1E1E] flex flex-col sm:flex-row justify-between items-start sm:items-center sticky top-0 z-10 gap-4">
        <div>
          <h2 className="text-white font-bold uppercase tracking-widest text-sm flex items-center gap-2">
            FX Rack <span className="px-1.5 py-0.5 bg-[#403020] text-[#FA9534] text-[9px] rounded uppercase tracking-wider font-mono">Dynamic VST</span>
          </h2>
          <p className="text-gray-500 text-[10px] font-mono">TRACK: {track.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => setIsEngineOpen(true)}
            className={`px-2 py-1 rounded flex items-center gap-1.5 border shadow-md hover:scale-[1.02] active:scale-95 transition-all text-[10px] font-black uppercase tracking-wider cursor-pointer ${
              track.effectsMode === 'native' 
                ? 'bg-[#00FF5A]/15 border-[#00FF5A]/35 text-[#00FF5A] shadow-[0_0_10px_rgba(0,255,90,0.1)]' 
                : 'bg-zinc-805 hover:bg-zinc-750 text-zinc-300 border-zinc-750'
            }`}
            title="Configure Active DSP Processing Engine"
          >
            <Cpu size={10} className={track.effectsMode === 'native' ? 'text-[#00FF5A] animate-pulse' : 'text-zinc-500'} />
            <span>Engine: {track.effectsMode === 'native' ? 'NATIVE DSP' : 'WEB AUDIO'}</span>
          </button>

          <button 
            onClick={() => setIsSelectorOpen(true)}
            className="px-2 py-1 bg-[#FA9534] hover:bg-amber-400 text-black font-bold uppercase tracking-wider rounded text-[10px] flex items-center gap-1 shadow-md"
          >
            <Plus size={10} /> Add FX Module
          </button>
          
          <button 
            onClick={() => setIsSaveModalOpen(true)}
            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-wider rounded text-[10px] flex items-center gap-1 shadow-md border border-emerald-500/30"
          >
            <Save size={10} /> Save FX Preset
          </button>

          <button onClick={enhanceVocalWithAI} disabled={aiLoading} className="px-2 py-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 rounded text-[10px] font-bold uppercase text-white shadow-lg disabled:opacity-50">
            {aiLoading ? '✨ Tuning...' : '✨ Optimize with AI'}
          </button>
          <button onClick={() => getPreset('Studio Vocal')} className="px-2 py-1 bg-[#222] hover:bg-[#333] rounded text-[10px] font-bold uppercase text-[#00FF9C]">Studio Vocal</button>
          <button onClick={() => getPreset('Trap Vocal')} className="px-2 py-1 bg-[#222] hover:bg-[#333] rounded text-[10px] font-bold uppercase text-[#00FF9C]">Trap Vocal</button>
          <button onClick={() => getPreset('Podcast')} className="px-2 py-1 bg-[#222] hover:bg-[#333] rounded text-[10px] font-bold uppercase text-[#00FF9C]">Podcast</button>
        </div>
      </div>

      {/* Sub-tab Selection Bar */}
      <div className="mx-4 mt-4 bg-[#141414] p-1 rounded-xl border border-[#222] flex gap-2 shrink-0 select-none">
        <button
          onClick={() => setActiveRackView('rack')}
          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeRackView === 'rack'
              ? 'bg-[#FA9534] text-black shadow-lg shadow-amber-500/10'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          <Sliders size={12} /> My Channels Rack
        </button>
        <button
          onClick={() => setActiveRackView('presets')}
          className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-1.5 relative ${
            activeRackView === 'presets'
              ? 'bg-[#FA9534] text-black shadow-lg shadow-amber-500/10'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
          }`}
        >
          <Award size={12} /> Presets Marketplace & Library
          <span className="absolute -top-1 -right-4 px-1.5 py-0.2 bg-rose-500 text-white font-sans font-black text-[7px] uppercase tracking-widest rounded-full animate-bounce">
            Hot
          </span>
        </button>
      </div>

      {/* ⚠️ REAL-TIME AUDIO AUDITION/PREVIEW BANNER */}
      {activePreview && (
        <div className="mx-4 mt-4 p-4 rounded-xl border border-[#FA9534] bg-gradient-to-r from-[#302010] via-black to-[#302010] shadow-[0_4px_24px_rgba(250,149,52,0.15)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in slide-in-from-top-4 duration-300 relative overflow-hidden">
          
          {/* Left accent color strip */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#FA9534] to-amber-600 animate-pulse" />
          
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-[#FA9534]/10 border border-[#FA9534]/30 flex items-center justify-center text-[#FA9534] animate-bounce shrink-0">
              <Sparkles size={16} className="animate-pulse" />
            </div>
            <div>
              <div className="text-[9px] text-[#FA9534] font-black uppercase font-mono tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                Live VST Audition Active
              </div>
              <h4 className="text-white text-xs font-bold font-sans mt-0.5">
                Previewing {activePreview.type === 'preset' ? 'Vocal Chain Preset' : 'Premium DSP Module'}: 
                <span className="text-[#00FFBC] font-extrabold ml-1.5">"{activePreview.name}"</span> on track <span className="underline font-mono">"{track.name}"</span>
              </h4>
              <p className="text-neutral-500 text-[9px] font-mono leading-relaxed mt-0.5">
                {activePreview.type === 'preset' 
                  ? "Adjust module parameters in the cards below to customize the audition. Click Apply/Unlock to keep changes." 
                  : "Listen to the premium DSP module processed live. Tune the controls below. Apply/Unlock to license permanently."}
              </p>
            </div>
          </div>

          <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0 shrink-0 select-none">
            <button
              onClick={handleCancelPreview}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white font-bold uppercase font-mono text-[9px] rounded-lg border border-neutral-700 hover:border-neutral-600 transition-colors flex items-center justify-center gap-1"
            >
              Cancel & Discard
            </button>
            <button
              onClick={() => {
                if (activePreview.type === 'preset') {
                  setCheckoutPreset(activePreview.presetObj);
                } else {
                  setCheckoutEffect(activePreview.effectObj);
                }
              }}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-gradient-to-r from-[#FA9534] to-amber-500 hover:opacity-95 text-black font-extrabold uppercase text-[9px] rounded-lg shadow-lg shadow-amber-950/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-1"
            >
              Pay to Apply (₦{(activePreview.unownedPremiumEffects.length * 150).toLocaleString()})
            </button>
          </div>

        </div>
      )}

      {/* FX Modules Grid Layout */}
      {activeRackView === 'rack' && (
        <div id="vst-engine-mode-card" className="mx-4 mt-2 mb-4 p-4 rounded-xl border border-neutral-800 bg-[#0B0B0C] relative overflow-hidden">
          {/* Neon active light pulse indicator */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent" style={{ backgroundImage: track.effectsMode === 'native' ? 'linear-gradient(to right, transparent, #00FFBC, transparent)' : undefined }} />

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center border transition-all ${
                track.effectsMode === 'native' 
                  ? 'bg-[#00FFBC]/10 border-[#00FFBC]/30 text-[#00FFBC] shadow-[0_0_10px_rgba(0,255,188,0.15)]' 
                  : 'bg-blue-600/10 border-blue-500/20 text-blue-400'
              }`}>
                <Globe size={15} className={track.effectsMode === 'native' ? 'animate-pulse' : ''} />
              </div>
              <div>
                <h4 className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                  Audio DSP Engine Mode
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                    track.effectsMode === 'native' ? 'bg-[#00FFBC]/20 text-[#00FFBC]' : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {track.effectsMode === 'native' ? 'Native SDK ACTIVE' : 'Web Audio (Tone.js)'}
                  </span>
                </h4>
                <p className="text-zinc-500 text-[9px] font-mono leading-relaxed mt-0.5 max-w-[500px]">
                  {track.effectsMode === 'native' 
                    ? "Routing real-time functional DSP commands to mobile/desktop native binaries for zero-latency offline production. Premium algorithms are actively validated."
                    : "Running inside sandbox standard Web Audio nodes. Switch to Native DSP to test native build exports for iOS, Android, and laptops."}
                </p>
              </div>
            </div>

            <div>
              <button
                onClick={() => setIsEngineOpen(true)}
                className={`py-2 px-4 rounded-xl text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-2 border shadow-lg transition-all active:scale-95 cursor-pointer ${
                  track.effectsMode === 'native'
                    ? 'bg-[#00FF9C]/10 border-[#00FF9C]/30 text-[#00FF5A] shadow-[0_0_15px_rgba(0,255,156,0.15)]'
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                }`}
              >
                <Cpu size={12} className={track.effectsMode === 'native' ? 'animate-pulse text-[#00FF9C]' : 'text-zinc-500'} />
                <span>Configure DSP Engine</span>
              </button>
            </div>
          </div>

          {/* Core Premium Warning: "The premium effects on web effects should also be premium on native effects" */}
          <div className="mt-3 pt-2.5 border-t border-neutral-900 flex items-center justify-between text-[8px] text-zinc-500 uppercase tracking-widest font-mono">
            <span>PREMIUM VERIFICATION AGENT: ONLINE</span>
            <span className="text-[#FA9534] flex items-center gap-1 font-bold">
              <Sparkle size={10} fill="currentColor" /> Web Plugins match Native Licences
            </span>
          </div>
        </div>
      )}

      {/* FX Modules Grid Layout */}
      {activeRackView === 'rack' && (
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* EQ-3 */}
        {isAdded('eq') && (
          <div className={getCardStyleClass('eq')}>
            <button 
              onClick={() => removeFX('eq')}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete Module"
            >
              <Trash2 size={12} />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5">
                EQ-3
                {fx.eq?.enabled === false && (
                  <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-455 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => updateFX('eq', { enabled: fx.eq?.enabled === false })}
                  className={`w-10 h-5 rounded-full relative transition-colors ${fx.eq?.enabled !== false ? 'bg-[#FA9534]' : 'bg-[#333]'}`}
                >
                  <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fx.eq?.enabled !== false ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>HIGH</span><span>{fx.eq?.high ?? 0}dB</span>
                </div>
                <input type="range" min="-12" max="12" value={fx.eq?.high ?? 0} onChange={(e) => updateFX('eq', { high: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>MID</span><span>{fx.eq?.mid ?? 0}dB</span>
                </div>
                <input type="range" min="-12" max="12" value={fx.eq?.mid ?? 0} onChange={(e) => updateFX('eq', { mid: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>LOW</span><span>{fx.eq?.low ?? 0}dB</span>
                </div>
                <input type="range" min="-12" max="12" value={fx.eq?.low ?? 0} onChange={(e) => updateFX('eq', { low: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {/* 10-Band Graphic EQ */}
        {isAdded('graphicEQ') && (
          <div className={getCardStyleClass('graphicEQ', false, true)}>
            <button 
              onClick={() => removeFX('graphicEQ')}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove Module"
            >
              <Trash2 size={12} />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5">
                <Sliders size={12} className="text-[#FA9534]" /> Graphic EQ (10-Band)
                {fx.graphicEQ?.enabled === false && (
                  <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-455 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                )}
              </h3>
              <button 
                onClick={() => updateFX('graphicEQ', { enabled: fx.graphicEQ?.enabled === false })}
                className={`w-10 h-5 rounded-full relative transition-colors ${fx.graphicEQ?.enabled !== false ? 'bg-[#FA9534]' : 'bg-[#333]'}`}
              >
                <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fx.graphicEQ?.enabled !== false ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            
            <div className="grid grid-cols-10 gap-1 h-36 pt-2">
              {[
                { band: 'band1', label: '31' },
                { band: 'band2', label: '62' },
                { band: 'band3', label: '125' },
                { band: 'band4', label: '250' },
                { band: 'band5', label: '500' },
                { band: 'band6', label: '1k' },
                { band: 'band7', label: '2k' },
                { band: 'band8', label: '4k' },
                { band: 'band9', label: '8k' },
                { band: 'band10', label: '16k' }
              ].map(({ band, label }) => {
                const val = (fx.graphicEQ as any)?.[band] ?? 0;
                return (
                  <div key={band} className="flex flex-col items-center justify-between h-full">
                    <span className="text-[8px] text-gray-500 font-mono leading-none">{val > 0 ? `+${val}` : val}d</span>
                    <input 
                      type="range" 
                      min="-12" 
                      max="12" 
                      value={val} 
                      {...({ orient: "vertical" } as any)}
                      onChange={(e) => updateFX('graphicEQ', { [band]: Number(e.target.value) })}
                      className="h-20 bg-neutral-800 rounded outline-none custom-vertical-slider accent-[#FA9534] w-2"
                    />
                    <span className="text-[8px] text-gray-400 font-semibold font-mono mt-1">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Dynamic Compressor */}
        {isAdded('compressor') && (
          <div className={getCardStyleClass('compressor')}>
            <button 
              onClick={() => removeFX('compressor')}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete Module"
            >
              <Trash2 size={12} />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5">
                Compressor
                {fx.compressor?.enabled === false && (
                  <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-455 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                )}
              </h3>
              <button 
                onClick={() => updateFX('compressor', { enabled: fx.compressor?.enabled === false })}
                className={`w-10 h-5 rounded-full relative transition-colors ${fx.compressor?.enabled !== false ? 'bg-[#FA9534]' : 'bg-[#333]'}`}
              >
                <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fx.compressor?.enabled !== false ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>THRESH</span><span>{fx.compressor?.threshold ?? -24}dB</span>
                </div>
                <input type="range" min="-60" max="0" value={fx.compressor?.threshold ?? -24} onChange={(e) => updateFX('compressor', { threshold: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>RATIO</span><span>{fx.compressor?.ratio ?? 12}:1</span>
                </div>
                <input type="range" min="1" max="20" value={fx.compressor?.ratio ?? 12} onChange={(e) => updateFX('compressor', { ratio: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                    <span>ATTACK</span><span>{((fx.compressor?.attack ?? 0.003) * 1000).toFixed(1)}ms</span>
                  </div>
                  <input type="range" min="0.001" max="0.2" step="0.001" value={fx.compressor?.attack ?? 0.003} onChange={(e) => updateFX('compressor', { attack: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                    <span>RELEASE</span><span>{Math.round((fx.compressor?.release ?? 0.25) * 1000)}ms</span>
                  </div>
                  <input type="range" min="0.01" max="1.0" step="0.01" value={fx.compressor?.release ?? 0.25} onChange={(e) => updateFX('compressor', { release: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Noise Gate */}
        {isAdded('gate') && (
          <div className={getCardStyleClass('gate')}>
            <button 
              onClick={() => removeFX('gate')}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove Module"
            >
              <Trash2 size={11} />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1">
                <Sliders size={12} className="text-[#FA9534]" /> Noise Gate
                {fx.gate?.enabled === false && (
                  <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-455 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                )}
              </h3>
              <button 
                onClick={() => updateFX('gate', { enabled: fx.gate?.enabled === false })}
                className={`w-10 h-5 rounded-full relative transition-colors ${fx.gate?.enabled !== false ? 'bg-[#FA9534]' : 'bg-[#333]'}`}
              >
                <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fx.gate?.enabled !== false ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>THRESHOLD</span><span>{fx.gate?.threshold ?? -40}dB</span>
                </div>
                <input type="range" min="-80" max="-10" value={fx.gate?.threshold ?? -40} onChange={(e) => updateFX('gate', { threshold: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {/* AutoTune / Pitch Shift */}
        {isAdded('pitchShift') && (
          <div className={getCardStyleClass('pitchShift')}>
            <button 
              onClick={() => removeFX('pitchShift')}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete Module"
            >
              <Trash2 size={12} />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5">
                AutoTune
                {fx.pitchShift?.enabled === false && (
                  <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-455 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                )}
              </h3>
              <button 
                onClick={() => updateFX('pitchShift', { enabled: fx.pitchShift?.enabled === false })}
                className={`w-10 h-5 rounded-full relative transition-colors ${fx.pitchShift?.enabled !== false ? 'bg-[#FA9534]' : 'bg-[#333]'}`}
              >
                <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fx.pitchShift?.enabled !== false ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-4 flex-1">
              <div className="flex justify-between gap-2 mb-2">
                <div className="flex-1">
                  <span className="text-[10px] text-gray-500 font-mono block mb-1">KEY</span>
                  <select
                    value={fx.pitchShift?.key ?? 'C'}
                    onChange={(e) => updateFX('pitchShift', { key: e.target.value })}
                    className="w-full bg-[#1e1e1e] text-white text-[10px] p-1 rounded outline-none border border-neutral-800"
                  >
                    {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <span className="text-[10px] text-gray-500 font-mono block mb-1">SCALE</span>
                  <select
                    value={fx.pitchShift?.scale ?? 'chromatic'}
                    onChange={(e) => updateFX('pitchShift', { scale: e.target.value })}
                    className="w-full bg-[#1e1e1e] text-white text-[10px] p-1 rounded outline-none border border-neutral-800"
                  >
                    <option value="major">Major</option>
                    <option value="minor">Minor</option>
                    <option value="chromatic">Chromatic</option>
                  </select>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>SHIFT (ST)</span><span>{fx.pitchShift?.pitch ?? 0}</span>
                </div>
                <input type="range" min="-12" max="12" value={fx.pitchShift?.pitch ?? 0} onChange={(e) => updateFX('pitchShift', { pitch: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {/* ToneBoosters Voice Pitcher V4 */}
        {isAdded('voicePitcher') && (
          <div className={getCardStyleClass('voicePitcher', true)}>
            <button 
              onClick={() => removeFX('voicePitcher')}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove Module"
            >
              <Trash2 size={11} />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles size={11} className="text-[#FA9534]" /> TB Voice Pitch V4
                {fx.voicePitcher?.enabled === false && (
                  <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-455 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                )}
              </h3>
              <button 
                onClick={() => updateFX('voicePitcher', { enabled: fx.voicePitcher?.enabled === false })}
                className={`w-10 h-5 rounded-full relative transition-colors ${fx.voicePitcher?.enabled !== false ? 'bg-[#FA9534]' : 'bg-[#333]'}`}
              >
                <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fx.voicePitcher?.enabled !== false ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>PITCH SHIFT</span><span>{fx.voicePitcher?.shift ?? 0} ST</span>
                </div>
                <input type="range" min="-12" max="12" value={fx.voicePitcher?.shift ?? 0} onChange={(e) => updateFX('voicePitcher', { shift: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>FORMANT</span><span>{fx.voicePitcher?.formant ?? 5}</span>
                </div>
                <input type="range" min="0" max="10" step="1" value={fx.voicePitcher?.formant ?? 5} onChange={(e) => updateFX('voicePitcher', { formant: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>WET CONTROL</span><span>{Math.round((fx.voicePitcher?.wet ?? 0.5) * 100)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={fx.voicePitcher?.wet ?? 0.5} onChange={(e) => updateFX('voicePitcher', { wet: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {/* Vocal Tune PRO */}
        {isAdded('vocalTunePro') && (
          <div className={getCardStyleClass('vocalTunePro', true)}>
            <button 
              onClick={() => removeFX('vocalTunePro')}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove Module"
            >
              <Trash2 size={11} />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1">
                <Sparkles size={11} className="text-[#FA9534]" /> Vocal Tune PRO
                {fx.vocalTunePro?.enabled === false && (
                  <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-455 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                )}
              </h3>
              <button 
                onClick={() => updateFX('vocalTunePro', { enabled: fx.vocalTunePro?.enabled === false })}
                className={`w-10 h-5 rounded-full relative transition-colors ${fx.vocalTunePro?.enabled !== false ? 'bg-[#FA9534]' : 'bg-[#333]'}`}
              >
                <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fx.vocalTunePro?.enabled !== false ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-gray-500 block mb-0.5">SPEED</span>
                  <input type="range" min="0" max="100" value={fx.vocalTunePro?.speed ?? 80} onChange={(e) => updateFX('vocalTunePro', { speed: Number(e.target.value) })} className="w-full bg-[#222]" />
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">HUMANIZE</span>
                  <input type="range" min="0" max="100" value={fx.vocalTunePro?.humanize ?? 20} onChange={(e) => updateFX('vocalTunePro', { humanize: Number(e.target.value) })} className="w-full bg-[#222]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>CORRECTION STRENGTH</span><span>{fx.vocalTunePro?.amount ?? 80}%</span>
                </div>
                <input type="range" min="0" max="100" value={fx.vocalTunePro?.amount ?? 80} onChange={(e) => updateFX('vocalTunePro', { amount: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {/* Distortion / tape saturation */}
        {isAdded('distortion') && (
          <div className={getCardStyleClass('distortion')}>
            <button 
              onClick={() => removeFX('distortion')}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove Module"
            >
              <Trash2 size={11} />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5">
                <Disc size={11} className="text-[#FA9534]" /> Saturation / Distortion
                {fx.distortion?.enabled === false && (
                  <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-455 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                )}
              </h3>
              <button 
                onClick={() => updateFX('distortion', { enabled: fx.distortion?.enabled === false })}
                className={`w-10 h-5 rounded-full relative transition-colors ${fx.distortion?.enabled !== false ? 'bg-[#FA9534]' : 'bg-[#333]'}`}
              >
                <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fx.distortion?.enabled !== false ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>GAIN DRIVE</span><span>{Math.round((fx.distortion?.amount ?? 0.4) * 100)}%</span>
                </div>
                <input type="range" min="0.05" max="0.95" step="0.05" value={fx.distortion?.amount ?? 0.4} onChange={(e) => updateFX('distortion', { amount: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>WET MIX</span><span>{Math.round((fx.distortion?.wet ?? 0.5) * 100)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={fx.distortion?.wet ?? 0.5} onChange={(e) => updateFX('distortion', { wet: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {/* Bitcrusher (BitJuggler) */}
        {isAdded('bitcrusher') && (
          <div className={getCardStyleClass('bitcrusher')}>
            <button 
              onClick={() => removeFX('bitcrusher')}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove Module"
            >
              <Trash2 size={11} />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1">
                <Disc size={11} className="text-[#FA9534]" /> BitJuggler (LoFi)
                {fx.bitcrusher?.enabled === false && (
                  <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-455 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                )}
              </h3>
              <button 
                onClick={() => updateFX('bitcrusher', { enabled: fx.bitcrusher?.enabled === false })}
                className={`w-10 h-5 rounded-full relative transition-colors ${fx.bitcrusher?.enabled !== false ? 'bg-[#FA9534]' : 'bg-[#333]'}`}
              >
                <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fx.bitcrusher?.enabled !== false ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-1">
                  <span>BIT RATE DEPTH</span><span>{fx.bitcrusher?.bits ?? 8} bits</span>
                </div>
                <input type="range" min="2" max="16" step="1" value={fx.bitcrusher?.bits ?? 8} onChange={(e) => updateFX('bitcrusher', { bits: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-1">
                  <span>WET MIX</span><span>{Math.round((fx.bitcrusher?.wet ?? 0.5) * 100)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={fx.bitcrusher?.wet ?? 0.5} onChange={(e) => updateFX('bitcrusher', { wet: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {/* Phaser */}
        {isAdded('phaser') && (
          <div className={getCardStyleClass('phaser')}>
            <button 
              onClick={() => removeFX('phaser')}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove Module"
            >
              <Trash2 size={11} />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5">
                <Activity size={12} className="text-[#FA9534]" /> phaser
                {fx.phaser?.enabled === false && (
                  <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-455 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                )}
              </h3>
              <button 
                onClick={() => updateFX('phaser', { enabled: fx.phaser?.enabled === false })}
                className={`w-10 h-5 rounded-full relative transition-colors ${fx.phaser?.enabled !== false ? 'bg-[#FA9534]' : 'bg-[#333]'}`}
              >
                <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fx.phaser?.enabled !== false ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-1">
                  <span>MOD FREQUENCY</span><span>{fx.phaser?.frequency ?? 1.5}Hz</span>
                </div>
                <input type="range" min="0.1" max="10" step="0.1" value={fx.phaser?.frequency ?? 1.5} onChange={(e) => updateFX('phaser', { frequency: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-1">
                  <span>PHASE DEPTH</span><span>{Math.round((fx.phaser?.depth ?? 0.5) * 100)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={fx.phaser?.depth ?? 0.5} onChange={(e) => updateFX('phaser', { depth: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {/* Tremolo */}
        {isAdded('tremolo') && (
          <div className={getCardStyleClass('tremolo')}>
            <button 
              onClick={() => removeFX('tremolo')}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove Module"
            >
              <Trash2 size={11} />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5">
                <Sliders size={12} className="text-[#FA9534]" /> Tremolo
                {fx.tremolo?.enabled === false && (
                  <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-455 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                )}
              </h3>
              <button 
                onClick={() => updateFX('tremolo', { enabled: fx.tremolo?.enabled === false })}
                className={`w-10 h-5 rounded-full relative transition-colors ${fx.tremolo?.enabled !== false ? 'bg-[#FA9534]' : 'bg-[#333]'}`}
              >
                <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fx.tremolo?.enabled !== false ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-1">
                  <span>RATE SPEED</span><span>{fx.tremolo?.frequency ?? 5}Hz</span>
                </div>
                <input type="range" min="0.1" max="20" step="0.1" value={fx.tremolo?.frequency ?? 5} onChange={(e) => updateFX('tremolo', { frequency: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-1">
                  <span>TREM DEPTH</span><span>{Math.round((fx.tremolo?.depth ?? 0.5) * 100)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={fx.tremolo?.depth ?? 0.5} onChange={(e) => updateFX('tremolo', { depth: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {/* High Pass Filter */}
        {isAdded('highpass') && (
          <div className={getCardStyleClass('highpass')}>
            <button 
              onClick={() => removeFX('highpass')}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove Module"
            >
              <Trash2 size={11} />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5">
                <Sliders size={12} className="text-[#FA9534]" /> High Pass Filter
                {fx.highpass?.enabled === false && (
                  <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-455 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                )}
              </h3>
              <button 
                onClick={() => updateFX('highpass', { enabled: fx.highpass?.enabled === false })}
                className={`w-10 h-5 rounded-full relative transition-colors ${fx.highpass?.enabled !== false ? 'bg-[#FA9534]' : 'bg-[#333]'}`}
              >
                <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fx.highpass?.enabled !== false ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-1">
                  <span>FREQUENCY</span><span>{fx.highpass?.frequency ?? 200}Hz</span>
                </div>
                <input type="range" min="30" max="8000" step="10" value={fx.highpass?.frequency ?? 200} onChange={(e) => updateFX('highpass', { frequency: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-1">
                  <span>RESONANCE (Q)</span><span>{fx.highpass?.Q ?? 1}</span>
                </div>
                <input type="range" min="0.1" max="5" step="0.1" value={fx.highpass?.Q ?? 1} onChange={(e) => updateFX('highpass', { Q: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {/* Low Pass Filter */}
        {isAdded('lowpass') && (
          <div className={getCardStyleClass('lowpass')}>
            <button 
              onClick={() => removeFX('lowpass')}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove Module"
            >
              <Trash2 size={11} />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5">
                <Sliders size={12} className="text-[#FA9534]" /> Low Pass Filter
                {fx.lowpass?.enabled === false && (
                  <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-455 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                )}
              </h3>
              <button 
                onClick={() => updateFX('lowpass', { enabled: fx.lowpass?.enabled === false })}
                className={`w-10 h-5 rounded-full relative transition-colors ${fx.lowpass?.enabled !== false ? 'bg-[#FA9534]' : 'bg-[#333]'}`}
              >
                <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fx.lowpass?.enabled !== false ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-1">
                  <span>FREQUENCY</span><span>{fx.lowpass?.frequency ?? 2000}Hz</span>
                </div>
                <input type="range" min="200" max="18000" step="50" value={fx.lowpass?.frequency ?? 2000} onChange={(e) => updateFX('lowpass', { frequency: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-1">
                  <span>RESONANCE (Q)</span><span>{fx.lowpass?.Q ?? 1}</span>
                </div>
                <input type="range" min="0.1" max="5" step="0.1" value={fx.lowpass?.Q ?? 1} onChange={(e) => updateFX('lowpass', { Q: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {/* Reverb */}
        {isAdded('reverb') && (
          <div className={getCardStyleClass('reverb')}>
            <button 
              onClick={() => removeFX('reverb')}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete Module"
            >
              <Trash2 size={12} />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5">
                Reverb
                {fx.reverb?.enabled === false && (
                  <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-455 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                )}
              </h3>
              <button 
                onClick={() => updateFX('reverb', { enabled: fx.reverb?.enabled === false })}
                className={`w-10 h-5 rounded-full relative transition-colors ${fx.reverb?.enabled !== false ? 'bg-[#FA9534]' : 'bg-[#333]'}`}
              >
                <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fx.reverb?.enabled !== false ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>MIX</span><span>{Math.round((fx.reverb?.mix ?? 0.3) * 100)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={fx.reverb?.mix ?? 0.3} onChange={(e) => updateFX('reverb', { mix: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>DECAY</span><span>{fx.reverb?.decay ?? 1.5}s</span>
                </div>
                <input type="range" min="0.1" max="10" step="0.1" value={fx.reverb?.decay ?? 1.5} onChange={(e) => updateFX('reverb', { decay: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {/* Chorus */}
        {isAdded('chorus') && (
          <div className={getCardStyleClass('chorus')}>
            <button 
              onClick={() => removeFX('chorus')}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete Module"
            >
              <Trash2 size={12} />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5">
                Chorus
                {fx.chorus?.enabled === false && (
                  <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-455 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                )}
              </h3>
              <button 
                onClick={() => updateFX('chorus', { enabled: fx.chorus?.enabled === false })}
                className={`w-10 h-5 rounded-full relative transition-colors ${fx.chorus?.enabled !== false ? 'bg-[#FA9534]' : 'bg-[#333]'}`}
              >
                <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fx.chorus?.enabled !== false ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>MIX</span><span>{Math.round((fx.chorus?.wet ?? 0.5) * 100)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={fx.chorus?.wet ?? 0.5} onChange={(e) => updateFX('chorus', { wet: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>DEPTH</span><span>{Math.round((fx.chorus?.depth ?? 0.5) * 100)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={fx.chorus?.depth ?? 0.5} onChange={(e) => updateFX('chorus', { depth: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>FREQ</span><span>{fx.chorus?.frequency ?? 1.5}Hz</span>
                </div>
                <input type="range" min="0.1" max="10" step="0.1" value={fx.chorus?.frequency ?? 1.5} onChange={(e) => updateFX('chorus', { frequency: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {/* Delay */}
        {isAdded('delay') && (
          <div className={getCardStyleClass('delay')}>
            <button 
              onClick={() => removeFX('delay')}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Delete Module"
            >
              <Trash2 size={12} />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5">
                Delay
                {fx.delay?.enabled === false && (
                  <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-455 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                )}
              </h3>
              <button 
                onClick={() => updateFX('delay', { enabled: fx.delay?.enabled === false })}
                className={`w-10 h-5 rounded-full relative transition-colors ${fx.delay?.enabled !== false ? 'bg-[#FA9534]' : 'bg-[#333]'}`}
              >
                <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fx.delay?.enabled !== false ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>TIME</span>
                </div>
                <select
                  value={fx.delay?.time ?? '8n'}
                  onChange={(e) => updateFX('delay', { time: e.target.value })}
                  className="w-full bg-[#222] text-xs text-white p-1 rounded border border-[#333] outline-none"
                >
                  <option value="2n">Half Note (2n)</option>
                  <option value="4n">Quarter Note (4n)</option>
                  <option value="8n">Eighth Note (8n)</option>
                  <option value="16n">Sixteenth Note (16n)</option>
                </select>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>MIX</span><span>{Math.round((fx.delay?.mix ?? 0.2) * 100)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={fx.delay?.mix ?? 0.2} onChange={(e) => updateFX('delay', { mix: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>FEEDBACK</span><span>{Math.round((fx.delay?.feedback ?? 0.3) * 100)}%</span>
                </div>
                <input type="range" min="0" max="0.95" step="0.05" value={fx.delay?.feedback ?? 0.3} onChange={(e) => updateFX('delay', { feedback: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {/* Ping Pong Delay */}
        {isAdded('pingPongDelay') && (
          <div className={getCardStyleClass('pingPongDelay')}>
            <button 
              onClick={() => removeFX('pingPongDelay')}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove Module"
            >
              <Trash2 size={11} />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5">
                <Sliders size={12} className="text-[#FA9534]" /> Ping Pong Delay
                {fx.pingPongDelay?.enabled === false && (
                  <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-455 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                )}
              </h3>
              <button 
                onClick={() => updateFX('pingPongDelay', { enabled: fx.pingPongDelay?.enabled === false })}
                className={`w-10 h-5 rounded-full relative transition-colors ${fx.pingPongDelay?.enabled !== false ? 'bg-[#FA9534]' : 'bg-[#333]'}`}
              >
                <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fx.pingPongDelay?.enabled !== false ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>feedback</span><span>{Math.round((fx.pingPongDelay?.feedback ?? 0.3) * 100)}%</span>
                </div>
                <input type="range" min="0" max="0.95" step="0.05" value={fx.pingPongDelay?.feedback ?? 0.3} onChange={(e) => updateFX('pingPongDelay', { feedback: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>delay division</span>
                </div>
                <select 
                  value={fx.pingPongDelay?.time ?? '4n'} 
                  onChange={(e) => updateFX('pingPongDelay', { time: e.target.value })} 
                  className="w-full bg-[#222] text-xs text-white p-1 rounded border border-[#333] outline-none"
                >
                  <option value="2n">Half Note (2n)</option>
                  <option value="4n">Quarter Note (4n)</option>
                  <option value="8n">Eighth Note (8n)</option>
                  <option value="16n">Sixteenth Note (16n)</option>
                </select>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 font-mono mb-1">
                  <span>WET MIX</span><span>{Math.round((fx.pingPongDelay?.wet ?? 0.4) * 100)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={fx.pingPongDelay?.wet ?? 0.4} onChange={(e) => updateFX('pingPongDelay', { wet: Number(e.target.value) })} className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {/* FL Gross Beat / Time-shaper */}
        {isAdded('timeShaper') && (
          <div className={getCardStyleClass('timeShaper')}>
            <button 
              onClick={() => removeFX('timeShaper')}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove Module"
            >
              <Trash2 size={11} />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                <Sliders size={12} className="text-[#00FF5A]" /> Gross Beat / Time-shaper
                {fx.timeShaper?.enabled === false && (
                  <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                )}
              </h3>
              <button 
                onClick={() => updateFX('timeShaper', { enabled: fx.timeShaper?.enabled === false })}
                className={`w-10 h-5 rounded-full relative transition-colors ${fx.timeShaper?.enabled !== false ? 'bg-[#00FF5A]' : 'bg-[#333]'}`}
              >
                <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fx.timeShaper?.enabled !== false ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-gray-400 font-mono block mb-1.5 font-bold">TIME SHAPING PRESET</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'off', name: 'Off / Direct' },
                    { id: 'half', name: '1/2 Time/Speed' },
                    { id: 'gate', name: 'Gated Trance Chop' },
                    { id: 'reverse', name: 'Vinyl Tape-Stop' },
                    { id: 'custom', name: '✏️ Draw Custom LFO' }
                  ].map((modeItem) => (
                    <button
                      key={modeItem.id}
                      onClick={() => updateFX('timeShaper', { mode: modeItem.id as any })}
                      className={`px-2 py-1.5 rounded text-left transition-all duration-150 border text-[10px] uppercase font-mono tracking-tight font-semibold ${
                        (fx.timeShaper?.mode || 'off') === modeItem.id 
                          ? 'bg-[#00FF5A]/10 border-[#00FF5A] text-[#00FF5A]' 
                          : 'bg-[#151515] border-white/5 text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {modeItem.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Draw Custom envelope layout when custom is selected */}
              {fx.timeShaper?.mode === 'custom' && (
                <TimeShaperEnvelopeEditor
                  curve={fx.timeShaper?.curve || [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]}
                  onChange={(newCurve) => updateFX('timeShaper', { curve: newCurve })}
                  mix={fx.timeShaper?.mix ?? 1.0}
                />
              )}

              <div>
                <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-1">
                  <span>EFFECT MIX (WET)</span><span>{Math.round((fx.timeShaper?.mix ?? 1.0) * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.05" 
                  value={fx.timeShaper?.mix ?? 1.0} 
                  onChange={(e) => updateFX('timeShaper', { mix: Number(e.target.value) })} 
                  className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" 
                />
              </div>
            </div>
          </div>
        )}

        {/* Fruity Peak Controller */}
        {isAdded('peakController') && (
          <div className={getCardStyleClass('peakController')}>
            <button 
              onClick={() => removeFX('peakController')}
              className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove Module"
            >
              <Trash2 size={11} />
            </button>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5">
                <Activity size={12} className="text-[#3b82f6]" /> Fruity Peak Controller (Mod)
                {fx.peakController?.enabled === false && (
                  <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                )}
              </h3>
              <button 
                onClick={() => updateFX('peakController', { enabled: fx.peakController?.enabled === false })}
                className={`w-10 h-5 rounded-full relative transition-colors ${fx.peakController?.enabled !== false ? 'bg-[#3b82f6]' : 'bg-[#333]'}`}
              >
                <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fx.peakController?.enabled !== false ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-gray-400 font-mono block mb-1">INPUT SOURCE TRACK</span>
                <select
                  value={fx.peakController?.sourceTrackId || ''}
                  onChange={(e) => updateFX('peakController', { sourceTrackId: e.target.value })}
                  className="w-full bg-[#151515] text-[11px] text-gray-200 border border-white/10 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                >
                  <option value="">-- Choose Carrier --</option>
                  {tracks
                    .filter((t: any) => t.id !== track.id)
                    .map((t: any) => (
                      <option key={t.id} value={t.id}>
                        {t.name.toUpperCase()} (RMS Peak Tracker)
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <span className="text-[10px] text-gray-400 font-mono block mb-1">TARGET MODULATION</span>
                <select
                  value={fx.peakController?.targetParam || 'none'}
                  onChange={(e) => updateFX('peakController', { targetParam: e.target.value })}
                  className="w-full bg-[#151515] text-[11px] text-gray-200 border border-white/10 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                >
                  <option value="none">-- Select Target --</option>
                  <option value="lowpass">LOWPASS FILTER CUTOFF SWEEPS</option>
                  <option value="reverb">REVERB WET ENVELOPE SHAPER</option>
                  <option value="volume">VOLUME COMPRESSION / SIDECHAIN DUCK</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-1">
                  <span>MODULATION RANGE (DEPTH)</span><span>{Math.round((fx.peakController?.depth ?? 0.5) * 100)}%</span>
                </div>
                <input 
                  type="range" 
                  min="0.1" 
                  max="1.5" 
                  step="0.05" 
                  value={fx.peakController?.depth ?? 0.5} 
                  onChange={(e) => updateFX('peakController', { depth: Number(e.target.value) })} 
                  className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" 
                />
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Parameter fallsback for all OTHER custom & premium effects */}
        {Object.keys(fx).map((fxKey) => {
          const customKeys = [
            'eq', 'graphicEQ', 'compressor', 'gate', 'pitchShift',
            'voicePitcher', 'vocalTunePro', 'distortion', 'bitcrusher',
            'phaser', 'tremolo', 'highpass', 'lowpass', 'reverb',
            'chorus', 'delay', 'pingPongDelay', 'timeShaper', 'peakController'
          ];
          if (customKeys.includes(fxKey)) return null;

          const fxModule = fx[fxKey as keyof typeof fx] as any;
          if (!isAdded(fxKey as any)) return null;

          const def = FX_LIST.find((d) => d.id === fxKey);
          const name = def?.name || fxKey;

          return (
            <div key={fxKey} className={`${getCardStyleClass(fxKey as any)} flex flex-col justify-between`}>
              <div>
                <button 
                  onClick={() => removeFX(fxKey as any)}
                  className="absolute top-2 right-2 p-1 text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove Module"
                >
                  <Trash2 size={11} />
                </button>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-gray-300 font-bold text-xs uppercase tracking-widest flex items-center gap-1.5 pr-6">
                    <Sparkles size={11} className="text-[#FA9534]" /> {name}
                    {fxModule?.enabled === false && (
                      <span className="text-[8px] tracking-wider uppercase font-mono bg-zinc-800 text-zinc-455 px-1.5 py-0.5 rounded font-bold">Bypassed</span>
                    )}
                  </h3>
                  <button 
                    onClick={() => updateFX(fxKey as any, { enabled: fxModule?.enabled === false })}
                    className={`w-10 h-5 rounded-full relative transition-colors ${fxModule?.enabled !== false ? 'bg-[#FA9534]' : 'bg-[#333]'}`}
                  >
                    <div className={`w-3 h-3 bg-black rounded-full absolute top-1 transition-transform ${fxModule?.enabled !== false ? 'right-1' : 'left-1'}`} />
                  </button>
                </div>

                <div className="space-y-4">
                  {Object.entries(fxModule).map(([paramKey, paramVal]) => {
                    if (paramKey === 'enabled' || typeof paramVal !== 'number') return null;
                    
                    let min = 0;
                    let max = 1;
                    let step = 0.05;
                    let unit = "";

                    if (paramKey.toLowerCase().includes('freq') || paramKey.toLowerCase().includes('hz') || paramKey.toLowerCase().includes('cutoff')) {
                      min = 20; max = 18000; step = 20; unit = "Hz";
                    } else if (paramKey.toLowerCase().includes('db') || paramKey.toLowerCase().includes('gain') || paramKey.toLowerCase().includes('thresh') || paramKey.toLowerCase().includes('band') || paramKey.toLowerCase().includes('high') || paramKey.toLowerCase().includes('mid') || paramKey.toLowerCase().includes('low')) {
                      min = -48; max = 12; step = 1; unit = "dB";
                    } else if (paramKey.toLowerCase().includes('pitch') || paramKey.toLowerCase().includes('shift')) {
                      min = -12; max = 12; step = 1; unit = "ST";
                    } else if (paramKey.toLowerCase().includes('ratio')) {
                      min = 1; max = 20; step = 0.5; unit = ":1";
                    } else if (paramKey.toLowerCase().includes('decay')) {
                      min = 0.1; max = 8; step = 0.1; unit = "s";
                    } else if (paramKey.toLowerCase().includes('bits')) {
                      min = 2; max = 16; step = 1; unit = " bits";
                    } else if (paramKey.toLowerCase().includes('resonance') || paramKey.toLowerCase().includes('q')) {
                      min = 0.1; max = 6; step = 0.1;
                    } else if (paramKey.toLowerCase().includes('strength') || paramKey.toLowerCase().includes('speed') || paramKey.toLowerCase().includes('amount') || paramKey.toLowerCase().includes('humanize')) {
                      min = 0; max = 100; step = 5; unit = "%";
                    } else if (paramKey.toLowerCase().includes('drive') || paramKey.toLowerCase().includes('saturation') || paramKey.toLowerCase().includes('tapeage') || paramKey.toLowerCase().includes('wow')) {
                      min = 0; max = 10; step = 0.5;
                    }

                    return (
                      <div key={paramKey}>
                        <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-1">
                          <span className="uppercase">{paramKey.replace(/([A-Z])/g, ' $1')}</span>
                          <span>{typeof paramVal === 'number' && paramVal % 1 !== 0 ? paramVal.toFixed(1) : paramVal}{unit}</span>
                        </div>
                        <input 
                          type="range" 
                          min={min} 
                          max={max} 
                          step={step} 
                          value={paramVal} 
                          onChange={(e) => updateFX(fxKey as any, { [paramKey]: Number(e.target.value) })} 
                          className="w-full h-1 bg-[#222] rounded-lg appearance-none cursor-pointer" 
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-neutral-900 text-[9px] text-zinc-500 font-mono uppercase flex justify-between items-center">
                <span>VST Node</span>
                <span className="text-[#FA9534]">Active</span>
              </div>
            </div>
          );
        })}

        {/* Add FX Slot trigger */}
        <button 
          onClick={() => setIsSelectorOpen(true)}
          className="border-2 border-dashed border-[#2A2A2A] hover:border-[#FA9534] bg-black/25 hover:bg-black/40 rounded p-6 flex flex-col items-center justify-center text-gray-500 hover:text-[#FA9534] min-h-[160px] cursor-pointer transition-all gap-2 group"
        >
          <div className="w-10 h-10 rounded-full border border-neutral-700 flex items-center justify-center group-hover:border-[#FA9534] transition-colors bg-neutral-900 group-hover:scale-105 transform">
            <Plus size={18} />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest font-mono">Add FX Effect</span>
          <span className="text-[10px] text-neutral-500 font-sans tracking-normal font-medium">Expand rack with professional VST modules</span>
        </button>

        {/* Real-time Native Command Interprocess Diagnostics console */}
        {track.effectsMode === 'native' && (
          <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-6 bg-black border border-neutral-800 rounded-xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="px-4 py-3 bg-[#0D0D0E] border-b border-neutral-800 flex justify-between items-center select-none font-mono">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-[#00FFBC] animate-ping" />
                <span className="text-[9px] text-[#00FFBC] font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Terminal size={12} className="text-[#00FFBC]" />
                  Native DSP Interprocess Bridge logs trace
                </span>
              </div>
              <span className="text-[8px] text-zinc-500 font-bold uppercase">
                Continuous JSON API Serialization
              </span>
            </div>

            <div className="p-3 max-h-[220px] overflow-y-auto font-mono text-[9px] space-y-2 select-text text-zinc-350 scrollbar-none">
              {nativeLogs.length === 0 ? (
                <div className="text-zinc-600 italic text-center py-6">
                  Adjust sliders or toggle effects on the channel above to transmit and preview real-time native engine parameters commands.
                </div>
              ) : (
                nativeLogs.map((log) => (
                  <div key={log.id} className="p-2.5 bg-neutral-950/80 border border-neutral-900 rounded-lg hover:border-neutral-850 hover:bg-neutral-900/10 transition-colors">
                    <div className="flex justify-between items-center text-[7.5px] text-zinc-500 mb-1 border-b border-neutral-900 pb-1">
                      <span className="text-[#00FFBC] font-bold">
                        [{log.timestamp}] {log.action}
                      </span>
                      <span>
                        Transport layer: <strong className="text-zinc-400">{log.platformCalled.join(', ')}</strong>
                      </span>
                    </div>
                    <div className="text-[9.5px] text-zinc-300 font-bold">
                      node_instance: <span className="text-[#FA9534] font-bold">{log.fxType}</span>
                    </div>
                    <pre className="text-zinc-400 overflow-x-auto text-[8px] p-2 mt-1.5 bg-black rounded border border-white/5 leading-relaxed font-sans select-all select-none">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
      )}

      {/* VOCAL & FX PRESETS MARKETPLACE & LIBRARY */}
      {activeRackView === 'presets' && (
        <div id="vocal-preset-marketplace" className="mx-4 mt-8 bg-[#111] border border-[#222] rounded-lg overflow-visible pb-12 mb-12">
        
        {/* Marketplace subheader panel */}
        <div className="p-4 bg-gradient-to-r from-neutral-900 to-[#141414] border-b border-[#222] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Award className="text-[#00FFBF] w-4 h-4 animate-pulse" />
              <h3 className="text-white text-xs font-bold uppercase tracking-wider font-sans">
                Vibe Presets Marketplace & Library
              </h3>
            </div>
            <p className="text-zinc-500 text-[10px] font-mono mt-0.5">
              Publish or apply premium templates with $0.02 payout per premium plugin used
            </p>
          </div>
          <div className="flex bg-black p-0.5 rounded border border-[#222]">
            <button 
              onClick={() => setActiveMarketplaceTab('public')}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${activeMarketplaceTab === 'public' ? 'bg-[#FA9534] text-black' : 'text-zinc-400 hover:text-white'}`}
            >
              Public Marketplace
            </button>
            <button 
              onClick={() => setActiveMarketplaceTab('private')}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded transition-colors ${activeMarketplaceTab === 'private' ? 'bg-[#FA9534] text-black' : 'text-zinc-400 hover:text-white'}`}
            >
              My Presets
            </button>
          </div>
        </div>

        {/* Presets List display grid */}
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loadingMarketplace ? (
            <div className="col-span-full py-8 text-center text-xs text-zinc-500 font-mono flex items-center justify-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin text-[#FA9534]" /> Loading presets catalog...
            </div>
          ) : (
            presetsList
              .filter((p: any) => activeMarketplaceTab === 'public' ? p.is_public !== false : p.creator_id === user?.id)
              .map((preset: any) => {
                const count = (preset.premium_effects || []).length;
                
                // Track which items are un-owned
                const unowned = (preset.premium_effects || []).filter((pId: string) => !purchasedPlugins.includes(pId));
                const allOwned = unowned.length === 0;
                
                // Cost calculation
                const nairaCost = unowned.length * 150;
                const tkCost = unowned.length * 1.5;

                // Is user the publisher of this preset?
                const isPublisher = preset.creator_id === user?.id;

                return (
                  <div key={preset.id} className="bg-[#141414] border border-[#222] hover:border-[#333] transition-colors rounded p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-white font-bold text-xs tracking-tight line-clamp-1">{preset.name}</span>
                        {preset.is_public ? (
                          <span className="px-1 py-0.2 bg-emerald-900/40 text-emerald-400 border border-emerald-500/20 text-[8px] rounded uppercase font-mono tracking-widest flex items-center gap-1">
                            <Globe size={8} /> Public
                          </span>
                        ) : (
                          <span className="px-1 py-0.2 bg-zinc-800 text-zinc-400 text-[8px] rounded uppercase font-mono tracking-widest flex items-center gap-1">
                            <Lock size={8} /> Private
                          </span>
                        )}
                      </div>

                      <p className="text-zinc-500 text-[10px] line-clamp-2 leading-relaxed mb-3">
                        {preset.description || "No description provided."}
                      </p>

                      {/* Display plugins included in preset */}
                      <div className="mb-4">
                        <span className="text-[9px] text-zinc-500 uppercase font-mono block mb-1">VST Modules Included ({count}):</span>
                        <div className="flex flex-wrap gap-1">
                          {count === 0 ? (
                            <span className="text-[8px] text-zinc-400 bg-neutral-900 px-1 py-0.5 rounded border border-neutral-800 font-mono">
                              Basic standard effects only
                            </span>
                          ) : (
                            (preset.premium_effects || []).map((id: string) => {
                              const pDef = FX_LIST.find(d => d.id === id);
                              const pName = pDef?.name || id;
                              const owned = purchasedPlugins.includes(id);

                              return (
                                <span 
                                  key={id} 
                                  className={`text-[8px] px-1.5 py-0.5 rounded border font-mono flex items-center gap-0.5 ${
                                    owned 
                                      ? 'bg-emerald-990/20 text-emerald-400 border-emerald-800/30' 
                                      : 'bg-amber-950/20 text-amber-400 border-amber-800/20'
                                  }`}
                                  title={owned ? "Unlocked" : "Premium Locked ($0.10)"}
                                >
                                  {pName} {owned ? "✓" : "$"}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-900">
                      <div className="flex justify-between items-center text-[9px] text-neutral-500 mb-2 font-mono">
                        <span>BY: {preset.creator_email ? preset.creator_email.split('@')[0] : 'vibe_producer'}</span>
                        {isPublisher && (
                          <span className="text-[#00FFAC] font-bold uppercase tracking-wider flex items-center gap-0.5">
                            <Award size={10} /> My Preset
                          </span>
                        )}
                      </div>

                      {allOwned ? (
                        <button 
                          onClick={() => applyPresetFxSettings(preset)}
                          className="w-full py-1.5 bg-[#403020] hover:bg-[#504030] text-[#FA9534] font-bold uppercase tracking-wider text-[9px] rounded transition-colors flex items-center justify-center gap-1"
                        >
                          <Download size={10} /> Apply Preset (Free)
                        </button>
                      ) : (
                        <div className="space-y-1.5">
                          <button 
                            type="button"
                            onClick={() => {
                              if (activePreview?.type === 'preset' && activePreview.id === preset.id) {
                                handleCancelPreview();
                              } else {
                                handlePreviewPreset(preset);
                              }
                            }}
                            className={`w-full py-1.5 text-[9px] font-bold uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1 border border-dashed ${
                              activePreview?.type === 'preset' && activePreview.id === preset.id
                                ? 'bg-rose-950/30 text-rose-400 border-rose-500/40 animate-pulse font-extrabold text-[10px]'
                                : 'bg-neutral-900 border-[#FA9534]/30 hover:border-[#FA9534] text-[#FA9534] hover:bg-neutral-800'
                            }`}
                          >
                            {activePreview?.type === 'preset' && activePreview.id === preset.id ? (
                              <>🔊 Stop Auditioning</>
                            ) : (
                              <>⚡ Preview Sound Live</>
                            )}
                          </button>

                          <button 
                            onClick={() => handleApplyPreset(preset)}
                            className="w-full py-1.5 bg-gradient-to-r from-[#FA9534] to-amber-500 hover:opacity-95 text-black font-bold uppercase tracking-wider text-[9px] rounded shadow-lg transition-opacity flex items-center justify-center gap-1"
                          >
                            Unlock & Apply Preset (₦{nairaCost})
                          </button>
                        </div>
                      )}

                      {isPublisher && (
                        <button 
                          type="button"
                          onClick={() => handleDeletePreset(preset.id)}
                          className="w-full mt-2 py-1 bg-red-950/40 hover:bg-red-900/60 border border-red-900/40 hover:border-red-800 text-red-500 hover:text-red-400 font-bold uppercase tracking-wider text-[8.5px] rounded transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={10} /> Delete My Preset
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
          )}
          
          {presetsList.filter((p: any) => activeMarketplaceTab === 'public' ? p.is_public !== false : p.creator_id === user?.id).length === 0 && !loadingMarketplace && (
            <div className="col-span-full py-12 text-center text-zinc-500 text-[10px] font-mono flex flex-col items-center justify-center gap-2">
              <AlertCircle size={20} className="text-zinc-600" />
              <span>No presets found in this panel selection yet.</span>
              <button 
                onClick={() => setIsSaveModalOpen(true)}
                className="mt-2 text-[#FA9534] underline hover:text-amber-400"
              >
                Create and save your first vocal chain setup preset
              </button>
            </div>
          )}
        </div>

        {/* Dynamic publisher earning wallet summary card */}
        {userWallet && (
          <div className="mx-4 mt-2 p-3 bg-black/40 border border-[#222] rounded flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="flex items-center gap-2">
              <Award className="text-[#00FFBF] w-4 h-4" />
              <div className="text-[10px] font-mono text-zinc-400">
                My Preset Creator Wallet Balance: 
                <span className="text-[#00FFBF] font-extrabold ml-1.5">
                  ₦{Number(userWallet.withdrawable_balance || 0).toLocaleString()} Naira
                </span>
              </div>
            </div>
            
            <a 
              href="/earnings?path=/wallet/withdraw&title=Withdraw" 
              className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-bold uppercase text-[8px] rounded font-mono tracking-widest flex items-center gap-1"
            >
              Request Withdrawal <ArrowUpRight size={10} />
            </a>
          </div>
        )}
      </div>
      )}

      {/* MODAL: SAVE NEW PRESET OVERLAY */}
      {isSaveModalOpen && (
        <div id="save-preset-dialog" className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[99999]">
          <div className="bg-[#222] border border-neutral-700 rounded-lg max-w-md w-full text-white overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-neutral-800 bg-[#161616] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Save className="text-[#FA9534] w-4 h-4" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-neutral-300">Save Preset Session</h3>
              </div>
              <button onClick={() => setIsSaveModalOpen(false)} className="text-zinc-500 hover:text-white text-xs">✕</button>
            </div>

            <form onSubmit={handleSavePreset} className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] text-zinc-400 uppercase font-mono mb-1">Preset Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Dreamy Vocal Lead V4"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  className="w-full bg-[#141414] border border-[#333] rounded p-2 text-xs text-white outline-none focus:border-[#FA9534]"
                  maxLength={40}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-400 uppercase font-mono mb-1">Description</label>
                <textarea 
                  placeholder="Briefly describe the sonic color / parameters used..."
                  value={newPresetDesc}
                  onChange={(e) => setNewPresetDesc(e.target.value)}
                  className="w-full bg-[#141414] border border-[#333] rounded p-2 text-xs text-white outline-none focus:border-[#FA9534] h-20 resize-none"
                  maxLength={120}
                />
              </div>

              {/* Economic model notice info */}
              <div className="p-3 bg-neutral-900 border border-neutral-800 rounded space-y-2">
                <div className="flex items-start gap-1.5 text-[10px] font-sans text-neutral-300">
                  <Coins size={12} className="text-[#00FFBC] mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold block text-neutral-200">Preset Monetization Model Enabled</span>
                    Other users can load your preset in their tracks by purchasing any premium modules they do not own for <span className="text-[#FA9534] font-semibold">$0.10</span> each.
                  </div>
                </div>
                <div className="flex items-start gap-1.5 text-[9px] font-mono text-zinc-400 border-t border-neutral-800/60 pt-1.5">
                  <Award size={11} className="text-[#00FFBC] shrink-0" />
                  <span>
                    You earn <span className="text-[#00FFBC] font-bold">$0.02 (₦30 or 0.3 TK)</span> per premium module purchase done through your preset!
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 bg-[#1b1b1b] rounded border border-[#333]/40">
                <span className="text-[10px] text-zinc-300 font-mono uppercase">Publish to Public Marketplace?</span>
                <button 
                  type="button"
                  onClick={() => setNewPresetIsPublic(!newPresetIsPublic)}
                  className={`w-12 h-6 rounded-full relative transition-colors border ${newPresetIsPublic ? 'bg-emerald-600 border-emerald-500' : 'bg-neutral-800 border-neutral-700'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${newPresetIsPublic ? 'right-1' : 'left-1'}`} />
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
                <button 
                  type="button" 
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded text-[10px] font-bold uppercase transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={savingPreset}
                  className="px-3 py-1.5 bg-[#FA9534] hover:bg-amber-400 text-black font-semibold rounded text-[10px] uppercase font-sans tracking-wider disabled:opacity-50"
                >
                  {savingPreset ? "Saving Preset..." : "Save & Publish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PRESET PURCHASE / UNLOCK FLOW CHECKOUT */}
      {checkoutPreset && (
        <div id="checkout-preset-overlay" className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-[99999]">
          <div className="bg-[#252525] border border-neutral-700 rounded-lg max-w-sm w-full max-h-[90vh] flex flex-col text-white overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-neutral-800 bg-black/30 flex justify-between items-center shrink-0">
              <span className="font-bold text-xs uppercase tracking-wider text-neutral-300">Unlock Preset VST Modules</span>
              <button onClick={() => setCheckoutPreset(null)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase font-mono block">Preset Selected:</span>
                <span className="text-white text-sm font-bold block">{checkoutPreset.name}</span>
                <span className="text-zinc-400 text-[10px] block mt-1">{checkoutPreset.description}</span>
              </div>

              <div className="p-3 bg-neutral-900 rounded border border-neutral-800">
                <span className="text-[9px] text-zinc-400 uppercase font-mono block mb-2">Required Locked Premium Plugins:</span>
                <div className="space-y-1.5">
                  {checkoutPreset.premium_effects
                    .filter((p: string) => !purchasedPlugins.includes(p))
                    .map((id: string) => {
                      const d = FX_LIST.find(def => def.id === id);
                      return (
                        <div key={id} className="flex justify-between items-center text-[10px] text-zinc-300 font-mono">
                          <span>• {d?.name || id}</span>
                          <span className="text-[#FA9534] font-semibold">₦150</span>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="bg-[#1c1c1c] p-3 rounded text-[10px] font-sans border border-neutral-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Total Naira Cost:</span>
                  <span className="text-[#00FFBC] font-extrabold text-xs">
                    ₦{(checkoutPreset.premium_effects.filter((p: string) => !purchasedPlugins.includes(p)).length * 150).toLocaleString()}
                  </span>
                </div>
                <div className="text-[9px] text-zinc-500 border-t border-neutral-800/60 pt-2 font-mono uppercase">
                  ₦30 goes to {checkoutPreset.creator_email ? checkoutPreset.creator_email.split('@')[0] : 'the creator'} as royalty
                </div>
              </div>
            </div>

            {/* Purchase action choices (Pay with Naira Wallet & Cancel Button) */}
            <div className="p-4 bg-[#1e1e1e] border-t border-neutral-800 shrink-0 flex gap-2">
              <button 
                type="button"
                onClick={() => setCheckoutPreset(null)}
                className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-750 text-zinc-300 hover:text-white font-bold uppercase tracking-wider rounded-xl text-center text-[10px] transition-colors border border-neutral-700/60"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleCheckoutPresetPurchase('naira')}
                disabled={checkingOut}
                className="flex-[2] py-2.5 bg-[#FA9534] hover:bg-amber-400 text-black font-extrabold uppercase tracking-wider rounded-xl flex items-center justify-center gap-1 border-none shadow-lg disabled:opacity-50 text-[10px] transition-all cursor-pointer"
              >
                <DollarSign size={12} /> Pay with Naira Wallet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Purchase Single Effect Dialog */}
      {checkoutEffect && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-[99999]">
          <div className="bg-[#1E1E1E] border border-[#FA9534]/30 rounded-2xl w-full max-w-sm p-6 text-white shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
            
            <div className="absolute top-0 right-0 p-3 opacity-15">
              <Sparkles size={100} className="text-[#FA9534]" />
            </div>

            <div className="flex justify-between items-center mb-2 border-b border-neutral-800/80 pb-2">
              <h3 className="text-[#FA9534] font-black tracking-wider uppercase text-xs font-mono">Unlock Premium Plugin</h3>
              <button onClick={() => setCheckoutEffect(null)} className="text-zinc-500 hover:text-white">✕</button>
            </div>
            
            <h4 className="text-lg font-bold tracking-tight mb-4">{checkoutEffect.name}</h4>
            
            <p className="text-neutral-400 text-xs leading-relaxed mb-6">
              Unlock professional corrective DSP formulas, real-time filters, and dynamic hardware simulations for only <b>₦150</b>. Unlocking grants permanent license ownership across all your tracks.
            </p>

            {userWallet ? (
              <div className="space-y-4">
                
                {/* Current balances view */}
                <div className="bg-black/30 border border-neutral-800 rounded-lg p-3 text-xs mb-6 flex flex-col gap-1.5">
                  <div className="text-neutral-500 font-semibold uppercase font-mono tracking-wider text-[9px]">Your Available Funds</div>
                  <div className="flex justify-between font-mono">
                    <span className="text-neutral-400">Naira Wallet Balance:</span>
                    <span className="text-[#00FFBC] font-bold">₦{Number(userWallet.balance_naira).toLocaleString()}</span>
                  </div>
                </div>

                {/* Purchase Buttons (Exclusive Naira) */}
                <div className="flex flex-col gap-2">
                  <button
                    disabled={checkingOutEffect}
                    onClick={() => handleCheckoutEffectPurchase('naira')}
                    className="w-full bg-[#FA9534] hover:bg-amber-400 text-black font-extrabold py-2.5 px-4 rounded-xl text-xs flex justify-between items-center transition-all disabled:opacity-50 shadow-lg"
                  >
                    <span className="flex items-center gap-1.5">
                      <DollarSign size={14} /> Pay via Naira Wallet
                    </span>
                    <span className="font-mono text-xs font-black">₦150</span>
                  </button>
                </div>

              </div>
            ) : (
              <div className="text-xs text-red-400 italic text-center py-4 font-mono">
                Loading wallet balances...
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3 border-t border-neutral-800 pt-4">
              <button
                disabled={checkingOutEffect}
                onClick={() => setCheckoutEffect(null)}
                className="text-neutral-400 hover:text-white text-xs font-semibold uppercase tracking-wider font-mono"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Selection overlay drawer */}
      <FXSelectorModal 
        isOpen={isSelectorOpen} 
        onClose={() => setIsSelectorOpen(false)} 
        onSelectFX={handleSelectFX} 
        onPreviewFX={handlePreviewEffect}
        onCancelPreviewEffect={handleCancelPreview}
        activePreviewId={activePreview?.type === 'effect' ? activePreview.id : null}
      />

      <AudioEngineSelectorModal 
        isOpen={isEngineOpen} 
        onClose={() => setIsEngineOpen(false)} 
      />

    </div>
  );
}
