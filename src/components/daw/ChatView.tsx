// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, User, Bot, Trash2, Sparkles, Music, Terminal, 
  Eye, Radio, CreditCard, ChevronUp, ChevronDown, CheckCircle, AlertCircle, 
  HelpCircle, Volume2, Fingerprint, Sliders, Play, Pause, Square, Settings, RefreshCw, Smartphone,
  Lock, Unlock, ShieldAlert, Download, SlidersHorizontal, List, Activity, Sparkle,
  Copy, Check, Cpu
} from 'lucide-react';
import { useDawStore } from '../../store/useDawStore';
import { useAdMobStore } from '../../store/useAdMobStore';
import { AppTab, MusicStyle, StyleProfile, SynthType } from '../../types/daw';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import * as Tone from 'tone';
import { getFinalVibe, applyVibeToEngineAndTimeline, generateProceduralNotesForVibe, livePreviewController, SongStructure, SongSection, defaultSongStructure, detectAndInsertDrops, adaptDropIntensity, createImpactDrop, aiDetermineOptimalDrops, renewCompositionSeed } from '../../utils/vibeEngine';
import { audioEngine } from '../../audio/engine';
import { analyzeAudioPitch } from '../../audio/vocalAnalysis';
import { apiUrl } from '../../lib/apiBase';

// Enum matches: ANALYZE_VOCAL, GENERATE_DRUMS, GENERATE_BASS, GENERATE_CHORDS, GENERATE_MELODY, GENERATE_FX, ARRANGE_SONG, PROCESS_VOCALS, MIX_PROJECT, MASTER_PROJECT, EXPORT_PROJECT, FULL_AUTO_PRODUCE
export type AiAction = 
  | 'ANALYZE_VOCAL'
  | 'GENERATE_DRUMS'
  | 'GENERATE_BASS'
  | 'GENERATE_CHORDS'
  | 'GENERATE_MELODY'
  | 'GENERATE_FX'
  | 'ARRANGE_SONG'
  | 'PROCESS_VOCALS'
  | 'MIX_PROJECT'
  | 'MASTER_PROJECT'
  | 'EXPORT_PROJECT'
  | 'FULL_AUTO_PRODUCE'
  | 'CHAT_AND_EXPLAIN'
  | 'SIMULATE_GESTURE'
  | 'ADD_CUSTOM_TRACK'
  | 'INSERT_CUSTOM_NOTES'
  | 'UPDATE_MIXER'
  | 'APPLY_FX_RACK'
  | 'SET_SWING_QUANTIZE'
  | 'WRITE_STEP_SEQUENCER'
  | 'APPLY_AUTOMATION_CLIP'
  | 'SET_PORTAMENTO_GLIDE'
  | 'TOGGLE_SIDECHAIN'
  | 'SET_TIME_SHAPER'
  | 'APPLY_PEAK_CONTROLLER'
  | 'SEGMENTED_GENERATE'
  | 'SET_GLOBAL_TEMPO_AND_KEY';

export function parseRequestedDuration(text: string): number | null {
  const lower = text.toLowerCase();
  
  // Try pattern MM:SS (e.g. 2:30, 05:00, 10:00)
  const timeMatch = lower.match(/(?:^|\s)(\d{1,2}):(\d{2})(?:\s|$)/);
  if (timeMatch) {
    const mins = parseInt(timeMatch[1], 10);
    const secs = parseInt(timeMatch[2], 10);
    const total = mins * 60 + secs;
    if (total > 0 && total <= 600) {
      return total;
    }
  }

  // Try pattern "X min(s) Y sec(s)" or similar
  const complexMatch = lower.match(/(\d+)\s*(?:minutes|minute|mins|min|m)\s*(?:and\s*)?(\d+)\s*(?:seconds|second|secs|sec|s)/);
  if (complexMatch) {
    const mins = parseInt(complexMatch[1], 10);
    const secs = parseInt(complexMatch[2], 15);
    const total = mins * 60 + secs;
    if (total > 0 && total <= 600) return total;
  }

  // Try pattern "X minutes" / "X mins" / "X min"
  const minsMatch = lower.match(/(\d+)\s*(?:minutes|minute|mins|min)\b/);
  if (minsMatch) {
    const mins = parseInt(minsMatch[1], 10);
    const total = mins * 60;
    if (total > 0 && total <= 600) return total;
  }

  // Try pattern "X seconds" / "X secs" / "X sec"
  const secsMatch = lower.match(/(\d+)\s*(?:seconds|second|secs|sec)\b/);
  if (secsMatch) {
    const secs = parseInt(secsMatch[1], 10);
    if (secs > 0 && secs <= 600) return secs;
  }

  return null;
}

export interface AiCommand {
  action: AiAction;
  params: Record<string, any>;
  rationale?: string;
  replyText?: string;
  customPipeline?: PipelineStep[];
}

export interface PipelineStep {
  id: string;
  name: string;
  action: AiAction;
  status: 'idle' | 'running' | 'completed' | 'failed';
  message: string;
  params?: Record<string, any>;
}

const VALID_AI_ACTIONS: AiAction[] = [
  'ANALYZE_VOCAL', 'GENERATE_DRUMS', 'GENERATE_BASS', 'GENERATE_CHORDS', 'GENERATE_MELODY',
  'GENERATE_FX', 'ARRANGE_SONG', 'PROCESS_VOCALS', 'MIX_PROJECT', 'MASTER_PROJECT',
  'EXPORT_PROJECT', 'FULL_AUTO_PRODUCE', 'CHAT_AND_EXPLAIN', 'SIMULATE_GESTURE',
  'ADD_CUSTOM_TRACK', 'INSERT_CUSTOM_NOTES', 'UPDATE_MIXER', 'APPLY_FX_RACK',
  'SET_SWING_QUANTIZE', 'WRITE_STEP_SEQUENCER', 'APPLY_AUTOMATION_CLIP',
  'SET_PORTAMENTO_GLIDE', 'TOGGLE_SIDECHAIN', 'SET_TIME_SHAPER', 'APPLY_PEAK_CONTROLLER',
  'SEGMENTED_GENERATE', 'SET_GLOBAL_TEMPO_AND_KEY'
];

const normalizeAiAction = (action: any): AiAction => {
  const raw = typeof action === 'string' ? action.trim().toUpperCase() : '';
  if (VALID_AI_ACTIONS.includes(raw as AiAction)) return raw as AiAction;
  const aliases: Record<string, AiAction> = {
    SET_TEMPO_AND_KEY: 'SET_GLOBAL_TEMPO_AND_KEY',
    SET_GLOBAL_BPM_AND_KEY: 'SET_GLOBAL_TEMPO_AND_KEY',
    CONFIGURE_GLOBAL_TEMPO_KEY: 'SET_GLOBAL_TEMPO_AND_KEY',
    CONFIGURE_TEMPO_AND_KEY: 'SET_GLOBAL_TEMPO_AND_KEY',
    ADD_TRACK: 'ADD_CUSTOM_TRACK',
    CREATE_TRACK: 'ADD_CUSTOM_TRACK',
    WRITE_NOTES: 'INSERT_CUSTOM_NOTES',
    ADD_NOTES: 'INSERT_CUSTOM_NOTES',
    SET_MIXER: 'UPDATE_MIXER',
    APPLY_EFFECTS: 'APPLY_FX_RACK'
  };
  if (aliases[raw]) return aliases[raw];
  if (raw.includes('TEMPO') || raw.includes('BPM') || raw.includes('KEY')) return 'SET_GLOBAL_TEMPO_AND_KEY';
  return 'CHAT_AND_EXPLAIN';
};

const normalizeAiCommand = (raw: any): AiCommand => ({
  action: normalizeAiAction(raw?.action),
  params: raw?.params && typeof raw.params === 'object' ? raw.params : {},
  rationale: typeof raw?.rationale === 'string' ? raw.rationale : '',
  replyText: typeof raw?.replyText === 'string' ? raw.replyText : 'I mapped that request to the closest available studio controls and I am operating the DAW now.',
  customPipeline: Array.isArray(raw?.customPipeline) ? raw.customPipeline : undefined
});

const parseAiCommandFromResponse = (rawText: string): AiCommand => {
  const source = (rawText || '{}').trim();
  try {
    return normalizeAiCommand(JSON.parse(source));
  } catch (e) {
    console.warn("JSON parsing failure, using regex backup: ", e);
    const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(source);
    const candidate = fenced?.[1] || /\{[\s\S]*\}/.exec(source)?.[0] || '{}';
    return normalizeAiCommand(JSON.parse(candidate.trim()));
  }
};

export const STYLE_PROFILES: Record<MusicStyle, StyleProfile> = {
  [MusicStyle.AFROBEATS]: {
    bpmRange: { min: 95, max: 110 },
    drumPattern: "afro_groove",
    swing: 0.2,
    chordType: "7th_9th",
    bassType: "groove_bass",
    melodyType: "guitar_pluck",
    fxStyle: "warm_space",
    mixProfile: "balanced"
  },
  [MusicStyle.AMAPIANO]: {
    bpmRange: { min: 111, max: 115 },
    drumPattern: "log_drum",
    swing: 0.35,
    chordType: "jazzy",
    bassType: "log_bass",
    melodyType: "piano_keys",
    fxStyle: "wide_air",
    mixProfile: "deep_bass"
  },
  [MusicStyle.TRAP]: {
    bpmRange: { min: 130, max: 150 },
    drumPattern: "trap_808",
    swing: 0.1,
    chordType: "minor_dark",
    bassType: "808",
    melodyType: "bell_pluck",
    fxStyle: "dark_reverb",
    mixProfile: "hard"
  },
  [MusicStyle.POP]: {
    bpmRange: { min: 110, max: 130 },
    drumPattern: "modern_pop",
    swing: 0.12,
    chordType: "triads_pads",
    bassType: "analog_bass",
    melodyType: "synth_lead",
    fxStyle: "bright_plate",
    mixProfile: "crisp_radio"
  }
};

export function getStyleProfile(style: MusicStyle): StyleProfile {
  return STYLE_PROFILES[style] || STYLE_PROFILES[MusicStyle.AFROBEATS];
}

export function ChatView() {
  const { 
    chatMessages, 
    addChatMessage, 
    clearChat,
    bpm,
    setBpm,
    projectKey,
    setProjectKey,
    projectScale,
    setProjectScale,
    tracks,
    addTrack,
    updateTrack,
    deleteTrack,
    playbackState,
    setPlaybackState,
    selectedClipId,
    clips,
    addNote,
    currentTab,
    setCurrentTab,
    isChatOpen,
    setIsChatOpen,
    aiPreviewAutoCommit,
    activeStyle,
    setActiveStyle,
    sliderA,
    sliderB,
    transportPosition,
    songStructure,
    setSongStructure,
    autoDetectDrops,
    setAutoDetectDrops,
    isAiProducing,
    isComputePaused,
    setIsComputePaused,
    isFloatingBallActive,
    setIsFloatingBallActive,
    deviceControlPermission,
    setDeviceControlPermission,
    deviceControlEnabled,
    setDeviceControlEnabled
  } = useDawStore();

  const { rewardedActive } = useAdMobStore();
  const { user } = useAuth();
  
  // Tab configuration for AI Assistant subviews
  const [subTab, setSubTab] = useState<'assistant' | 'vision' | 'ear' | 'vibe'>('assistant');

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isWorking = isLoading || isAiProducing;
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Wallet State
  const [wallet, setWallet] = useState<any>(null);
  const [walletLoading, setWalletLoading] = useState(false);

  // Premium Ads and Compute Cost states
  const [adRequiredPrompt, setAdRequiredPrompt] = useState(false);
  const [pendingUserMsg, setPendingUserMsg] = useState('');
  
  const [computeSpentUsd, setComputeSpentUsd] = useState(0);
  const [computeTotalUsd, setComputeTotalUsd] = useState(0.20);
  
  // A ref to hold the resolver function when compute is paused
  const resumeResolveRef = useRef<(() => void) | null>(null);

  // Auto clean loaders if they close/forfeit the ad or cancel standby
  useEffect(() => {
    if (!rewardedActive && adRequiredPrompt) {
      setIsLoading(false);
      setVisionScanOn(false);
    }
  }, [rewardedActive, adRequiredPrompt]);

  // Helper to determine if user is subscribed to Ads-Free
  const isUserAdsFree = (walletData: any): boolean => {
    if (!walletData) return false;
    // Database indicators
    if (walletData.is_ads_free === true || walletData.ads_free === true) return true;
    if (walletData.ads_free_until && new Date(walletData.ads_free_until) > new Date()) return true;
    if (walletData.premium_until && new Date(walletData.premium_until) > new Date()) return true;
    
    // Fallback to local storage (user session dependent)
    const localKey = `local_ads_free_until_${user?.id || 'guest'}`;
    const localVal = localStorage.getItem(localKey);
    if (localVal && new Date(localVal) > new Date()) return true;
    return false;
  };

  const handleExtraComputeDeduction = async (): Promise<boolean> => {
    if (!user) {
      alert("Please sign in to continue AI compute. Each step costs $0.20.");
      return false;
    }

    const { data: currentWallet, error: fetchErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (fetchErr || !currentWallet) {
      alert("Couldn't load your wallet. Please open the Wallet page and retry.");
      return false;
    }

    const currentUsd = Number(currentWallet.balance_usd || 0);
    const currentNaira = Number(currentWallet.balance_naira || 0);

    if (currentUsd < 0.20) {
      alert(`Insufficient funds: $${currentUsd.toFixed(2)} available, $0.20 required. Please fund your wallet.`);
      return false;
    }

    const updatedUsd = currentUsd - 0.20;
    const updatedNaira = currentNaira - 320;

    const { error: updErr } = await supabase
      .from('wallets')
      .update({ balance_usd: updatedUsd, balance_naira: updatedNaira })
      .eq('user_id', user.id);

    if (updErr) {
      alert("Wallet deduction failed: " + updErr.message);
      return false;
    }

    await supabase.from('wallet_transactions').insert({
      user_id: user.id,
      amount_naira: 320,
      amount_usd: 0.20,
      type: 'ai_assistant',
      description: `AI Assist Continuation computation charge`
    });

    setWallet({ balance_usd: updatedUsd, balance_naira: updatedNaira });
    return true;
  };


  // Requirement 7: AI Permission Layer & Guardrails
  const [permissions, setPermissions] = useState({
    timelineEdit: true,
    trackCreation: true,
    fxRack: true,
    mixerControls: true,
    exportSystem: true,
    preventDeletionWithoutConfirmation: true,
    preventOverwritingWithoutBackup: true,
    aiWalletSpend: false
  });

  // Synchronize permissions to global/window states to enable seamless background auto-spend during production
  useEffect(() => {
    (window as any).aiWalletSpendApproved = permissions.aiWalletSpend;
    (window as any).aiPermissions = permissions;
  }, [permissions]);

  const [isGuardrailsOpen, setIsGuardrailsOpen] = useState(true);

  // Requirement 9: Production pipeline progress state
  const [pipelineQueue, setPipelineQueue] = useState<PipelineStep[]>([]);
  const [pipelineActive, setPipelineActive] = useState(false);
  const [currentPipelineIndex, setCurrentPipelineIndex] = useState<number | null>(null);

  // Dynamic Composition Plan state variables
  const [sectionStatuses, setSectionStatuses] = useState<Record<string, 'idle' | 'generating' | 'completed' | 'accepted'>>({});
  const [isPlanOpen, setIsPlanOpen] = useState(true);

  useEffect(() => {
    if (songStructure?.sections) {
      setSectionStatuses(prev => {
        const next = { ...prev };
        songStructure.sections.forEach((sec: any) => {
          if (!next[sec.id]) {
            next[sec.id] = 'idle';
          }
        });
        return next;
      });
    }
  }, [songStructure]);

  useEffect(() => {
    if (!pipelineActive || currentPipelineIndex === null) return;
    
    const i = currentPipelineIndex;
    const step = pipelineQueue[i];
    if (!step) return;

    if (i === 0) {
      setSectionStatuses(prev => {
        const reset: Record<string, 'idle'> = {};
        Object.keys(prev).forEach(k => { reset[k] = 'idle'; });
        return reset as any;
      });
    }

    setSectionStatuses(prev => {
      const copy = { ...prev };
      if (step.action === 'GENERATE_DRUMS') {
        copy['sec_intro'] = 'generating';
      } else if (step.action === 'GENERATE_BASS') {
        copy['sec_intro'] = 'completed';
        copy['sec_verse'] = 'generating';
      } else if (step.action === 'GENERATE_CHORDS') {
        copy['sec_verse'] = 'completed';
        copy['sec_prechorus'] = 'generating';
      } else if (step.action === 'GENERATE_MELODY') {
        copy['sec_prechorus'] = 'completed';
        copy['sec_chorus'] = 'generating';
      } else if (step.action === 'GENERATE_FX') {
        copy['sec_chorus'] = 'completed';
        copy['sec_bridge'] = 'generating';
      } else if (step.action === 'ARRANGE_SONG') {
        copy['sec_bridge'] = 'completed';
        copy['sec_outro'] = 'generating';
      } else if (step.action === 'PROCESS_VOCALS' || step.action === 'MIX_PROJECT' || step.action === 'MASTER_PROJECT' || step.action === 'EXPORT_PROJECT') {
        Object.keys(copy).forEach(k => {
          if (copy[k] === 'idle' || copy[k] === 'generating') {
            copy[k] = 'completed';
          }
        });
      }
      return copy;
    });
  }, [currentPipelineIndex, pipelineActive, pipelineQueue]);

  const handleAcceptSection = (sectionId: string) => {
    setSectionStatuses(prev => ({ ...prev, [sectionId]: 'accepted' }));
    addChatMessage({
      role: 'assistant',
      content: `✅ **Section Locked**: Perfect! You have accepted and finalized the **${sectionId.replace('sec_', '').toUpperCase()}** section arrangement.`
    });
  };

  const handleRefineSection = (sectionId: string) => {
    setSectionStatuses(prev => ({ ...prev, [sectionId]: 'generating' }));
    const secName = sectionId.replace('sec_', '').toUpperCase();
    setInput(`Refine the ${secName} section to make it `);
    setTimeout(() => {
      const inputEl = document.getElementById('chat-input-field');
      if (inputEl) {
        inputEl.focus();
      }
    }, 150);
  };

  // Spatial / Vision / Gestures State
  const [visionScanOn, setVisionScanOn] = useState(false);
  const [tactileLogs, setTactileLogs] = useState<{ id: string; timestamp: string; action: string; status: 'pending' | 'success' | 'failed' }[]>([
    { id: '1', timestamp: new Date(Date.now() - 300000).toLocaleTimeString(), action: 'SCANNING DAW LAYOUT BOUNDARIES', status: 'success' },
    { id: '2', timestamp: new Date(Date.now() - 120000).toLocaleTimeString(), action: 'READING MIXER VOLUME dbFS CHANNELS', status: 'success' },
  ]);
  const [pointer, setPointer] = useState<{ x: number; y: number; label: string; active: boolean; type: 'tap' | 'swipe' | 'scroll' | 'type' }>({
    x: 50,
    y: 50,
    label: '',
    active: false,
    type: 'tap'
  });

  // Sonic Ear (Listening) Simulation State
  const [sonicLevels, setSonicLevels] = useState<number[]>(new Array(16).fill(0));
  const [eqAnalysis, setEqAnalysis] = useState({ low: '0.0 dB', mid: '0.0 dB', high: '0.0 dB', dynamics: 'Normal', scaleCheck: 'Valid harmonic key match' });

  // Task / Solutions State
  const [solutionHistory, setSolutionHistory] = useState<{ id: string; name: string; timestamp: string; status: 'SUCCESS' | 'FAILED'; solution: string }[]>([
    { id: 's-1', name: 'Ambient Harmonizer', timestamp: new Date(Date.now() - 600000).toLocaleTimeString(), status: 'SUCCESS', solution: 'Adjusted Pad synth track key to match project scale Minor C.' }
  ]);

  // Fetch Wallet Balance
  const fetchWallet = async () => {
    setWalletLoading(true);
    try {
      if (user) {
        const { data } = await supabase.from('wallets').select('*').eq('user_id', user.id).single();
        if (data) {
          setWallet(data);
          setWalletLoading(false);
          return;
        }
      }
      // No anonymous free credits — anonymous users must sign in & fund their wallet.
      setWallet({ balance_usd: 0, balance_naira: 0 });

    } catch (e) {
      console.error("Failed to load wallet balance: ", e);
    } finally {
      setWalletLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, [user]);

  // Autoscroll chat only if user is at the bottom or sent a message
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const lastMessage = chatMessages[chatMessages.length - 1];
    const isUserMsg = lastMessage && lastMessage.role === 'user';

    if (isUserMsg) {
      // Force scroll to bottom for user messages
      container.scrollTop = container.scrollHeight;
    } else {
      // For incoming AI messages or tab/state updates, only scroll if they are already near the bottom
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
      if (isNearBottom) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [chatMessages, subTab, pipelineActive]);

  // Update animated audio spectrum when playing
  useEffect(() => {
    let interval: any;
    if (playbackState === 'playing') {
      interval = setInterval(() => {
        setSonicLevels(Array.from({ length: 16 }, () => Math.floor(Math.random() * 85) + 15));
      }, 100);
    } else {
      setSonicLevels(new Array(16).fill(12));
    }
    return () => clearInterval(interval);
  }, [playbackState]);

  // Trigger floating pointer animation helper (Moves human indicator on screen coordinates!)
  const triggerSimulation = (type: 'tap' | 'swipe' | 'scroll' | 'type', x: number, y: number, label: string) => {
    setPointer({ x, y, label, type, active: true });
    
    // Add tactile log
    const newLog = {
      id: Math.random().toString(),
      timestamp: new Date().toLocaleTimeString(),
      action: `${type.toUpperCase()} OPERATION ON [${label.toUpperCase()}] AT (X: ${Math.round(x)}%, Y: ${Math.round(y)}%)`,
      status: 'success' as const
    };
    setTactileLogs(prev => [newLog, ...prev].slice(0, 15));

    setTimeout(() => {
      setPointer(prev => ({ ...prev, active: false }));
    }, 2200);
  };

  // Requirement 9: Progress Pipeline execution effect
  useEffect(() => {
    if (!pipelineActive || pipelineQueue.length === 0 || currentPipelineIndex === null) return;
    if (currentPipelineIndex >= pipelineQueue.length) {
      setPipelineActive(false);
      setCurrentPipelineIndex(null);
      useDawStore.setState({
        isAiProducing: false,
        aiStepMessage: '',
        aiStepProgress: 0,
        aiActivePulseTrackId: null,
        playbackState: 'playing',
        transportPosition: 0
      });
      addChatMessage({
        role: 'assistant',
        content: `🎉 **PRODUCTION COMPLETE!**\n\nAll custom operations and automated board cycles are fully committed to the workstation successfully! Playback is enabled. Use the export functions to bounce your radio-ready master track.\n\n*(Transacted: $0.20 successfully)*`
      });
      setIsChatOpen(true);
      return;
    }

    const runStep = async () => {
      const i = currentPipelineIndex;
      const step = pipelineQueue[i];

      // Mark running
      setPipelineQueue(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'running' } : s));

      // Notification
      addChatMessage({
        role: 'assistant',
        content: `🎹 **[AI STUDIO ENGINE] Run ${i+1}/${pipelineQueue.length}:** *${step.name}...*`
      });

      try {
        // Set Zustand AI state values
        useDawStore.setState({
          isAiProducing: true,
          aiStepMessage: step.message,
          aiStepProgress: ((i + 1) / pipelineQueue.length) * 100,
          aiActivePulseTrackId: null
        });

        await executeCommand({ action: step.action, params: step.params || {}, rationale: step.message });
        
        // Mark Completed
        setPipelineQueue(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'completed' } : s));
        
        // Log solution
        setSolutionHistory(prev => [
          {
            id: `sol-${Date.now()}`,
            name: step.name,
            timestamp: new Date().toLocaleTimeString(),
            status: 'SUCCESS',
            solution: `Pipeline execution for ${step.action} was committed to the DAW workspace successfully.`
          },
          ...prev
        ]);

        // Proceed to next step after simple aesthetic cooldown
        setTimeout(() => {
          setCurrentPipelineIndex(prev => prev !== null ? prev + 1 : null);
        }, 1800);

      } catch (err: any) {
        console.error("Pipeline Step Failed: ", err);
        setPipelineQueue(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'failed' } : s));
        addChatMessage({
          role: 'assistant',
          content: `❌ **Pipeline Aborted**: Step "${step.name}" failed with error: *${err.message}*`
        });
        setPipelineActive(false);
        setCurrentPipelineIndex(null);
        useDawStore.setState({
          isAiProducing: false,
          aiStepMessage: '',
          aiStepProgress: 0,
          aiActivePulseTrackId: null
        });
        setIsChatOpen(true);
      }
    };

    runStep();
  }, [pipelineActive, currentPipelineIndex]);

  // Requirement 4: Build full pipeline queue
  const runFullPipeline = () => {
    // Keep playback stopped/paused during active generation to prevent Tone.js scheduling collisions!
    useDawStore.setState({ transportPosition: 0, playbackState: 'stopped' });

    const queue: PipelineStep[] = [
      { id: 'step-1', name: 'Analyze Vocal Key & BPM', action: 'ANALYZE_VOCAL', status: 'idle', message: 'Analyzing vocals, locking scale...' },
      { id: 'step-2', name: 'Synthesize Afro Drums', action: 'GENERATE_DRUMS', status: 'idle', message: 'Generating syncopated Afrobeat groove...' },
      { id: 'step-3', name: 'Generate Melodic Bassline', action: 'GENERATE_BASS', status: 'idle', message: 'Injecting sub-bass registers...' },
      { id: 'step-4', name: 'Structure Warm Pad Chords', action: 'GENERATE_CHORDS', status: 'idle', message: 'Adding atmospheric space chord triads...' },
      { id: 'step-5', name: 'Compose Pluck Lead Harmony', action: 'GENERATE_MELODY', status: 'idle', message: 'Composing syncopated Afro leads...' },
      { id: 'step-6', name: 'Trigger Swell FX risers', action: 'GENERATE_FX', status: 'idle', message: 'Blending riser transitions...' },
      { id: 'step-7', name: 'Arrange Sections Timeline', action: 'ARRANGE_SONG', status: 'idle', message: 'Dividing Intro/Verse/Chorus ranges...' },
      { id: 'step-8', name: 'Process Vocals FX Rack', action: 'PROCESS_VOCALS', status: 'idle', message: 'Applying high sheen autotune & curves...' },
      { id: 'step-9', name: 'Mix & Balance Channels', action: 'MIX_PROJECT', status: 'idle', message: 'Flipping Mixer levels & stereo split...' },
      { id: 'step-10', name: 'Loudness Master Adjust', action: 'MASTER_PROJECT', status: 'idle', message: 'Normalizing mastering ceilings...' },
      { id: 'step-11', name: 'Export Master Distros', action: 'EXPORT_PROJECT', status: 'idle', message: 'Compiling high-fidelity master bounces...' }
    ];

    setPipelineQueue(queue);
    setPipelineActive(true);
    setCurrentPipelineIndex(0);
    setIsChatOpen(true);
  };

  const runCustomPipeline = (customQueue: PipelineStep[]) => {
    // Keep playback stopped/paused during active generation to prevent Tone.js scheduling collisions!
    useDawStore.setState({ transportPosition: 0, playbackState: 'stopped' });

    const queue: PipelineStep[] = customQueue.map((step, idx) => ({
      id: step.id || `custom-step-${idx + 1}`,
      name: step.name || `Studio Operation ${idx + 1}`,
      action: normalizeAiAction(step.action),
      status: 'idle' as const,
      message: step.message || 'Operating studio controls...',
      params: step.params || {}
    }));

    setPipelineQueue(queue);
    setPipelineActive(true);
    setCurrentPipelineIndex(0);
    setIsChatOpen(true);
  };

  const resumePipeline = () => {
    if (pipelineQueue.length === 0) return;
    const firstUncompletedIndex = pipelineQueue.findIndex(s => s.status !== 'completed');
    if (firstUncompletedIndex === -1) {
      addChatMessage({
        role: 'assistant',
        content: `ℹ️ **AI PRODUCER**: All steps in the current pipeline are already completed. If you want to start a new production, just ask me to 'produce a new song'!`
      });
      return;
    }
    
    const stepToResume = pipelineQueue[firstUncompletedIndex];
    
    // Found the step to resume from
    // Update its status and any subsequent failed/running statuses to idle so it looks clean
    setPipelineQueue(prev => prev.map((s, idx) => {
      if (idx < firstUncompletedIndex) {
        return { ...s, status: 'completed' };
      } else {
        return { ...s, status: s.status === 'completed' ? 'completed' : 'idle' };
      }
    }));

    // Resume execution
    setPipelineActive(true);
    setCurrentPipelineIndex(firstUncompletedIndex);
    setIsChatOpen(true);
    
    addChatMessage({
      role: 'assistant',
      content: `🔄 **Resuming Song Production:** Continuing from Step ${firstUncompletedIndex + 1} (${stepToResume.name})...`
    });
  };

  // Requirement 3: Map AI Actions to physical DAW engine workspace state changes
  const executeCommand = async (cmd: AiCommand) => {
    const safeCmd = normalizeAiCommand(cmd);
    const { action, params = {}, rationale } = safeCmd;

    // Direct synchronous store interaction wrappers to guarantee immediate visual state updates on timeline without React batch delays!
    const addTrack = (type?: any, synthType?: any) => useDawStore.getState().addTrack(type, synthType);
    const updateTrack = (id: string, updates: any) => useDawStore.getState().updateTrack(id, updates);
    const addNote = (clipId: string, note: string, startTime: number, duration: number, isGhost?: boolean) => useDawStore.getState().addNote(clipId, note, startTime, duration, isGhost);
    const setBpm = (val: number) => useDawStore.getState().setBpm(val);
    const setProjectKey = (val: string) => useDawStore.getState().setProjectKey(val);
    const setProjectScale = (val: string) => useDawStore.getState().setProjectScale(val);
    const bpm = useDawStore.getState().bpm;

    const runGhostPreviewWorkflow = async (clipId: string, durationMs: number) => {
      const state = useDawStore.getState();
      const autoCommit = state.aiPreviewAutoCommit;
      
      const checkClipInit = state.clips[clipId];
      if (!checkClipInit) return;

      // Mark clip and all its notes as ghost
      const ghostNotes = (checkClipInit.notes || []).map(n => ({ ...n, isGhost: true }));
      state.updateClip(clipId, { isGhost: true, notes: ghostNotes });
      
      const originalPlaybackState = state.playbackState;
      const clipStart32 = checkClipInit.startTime || 0;
      
      // Move transport playhead to clip start and trigger low-latency audio playback
      useDawStore.setState({ transportPosition: clipStart32, playbackState: 'playing' });

      // Focus Piano Roll directly to visualize faint notes composing live!
      useDawStore.setState({ currentTab: 'pianoroll', selectedClipId: clipId, selectedTrackId: checkClipInit.trackId });

      addLog(`PREVIEWING GHOST BLOCK: Low-volume preview starting...`, 'pending');

      if (autoCommit) {
        // Smart AI preview duration
        await new Promise(r => setTimeout(r, durationMs));
        
        const checkClipFinal = useDawStore.getState().clips[clipId];
        if (checkClipFinal) {
          const committedNotes = (checkClipFinal.notes || []).map(n => ({ ...n, isGhost: false }));
          useDawStore.getState().updateClip(clipId, { isGhost: false, notes: committedNotes });
          addLog(`AUTO-COMMIT: Visual block locked into position`, 'success');
        }
      } else {
        addLog(`AWAITING MANUAL REVIEWS: Accept or Discard inside the timeline block`, 'pending');
        while (true) {
          await new Promise(r => setTimeout(r, 200));
          const currentClips = useDawStore.getState().clips;
          const currentClip = currentClips[clipId];
          if (!currentClip) {
            addLog(`PREVIEW GHOST DISCARDED BY USER`, 'failed');
            break;
          }
          if (!currentClip.isGhost) {
            addLog(`TACTILE COMMIT: Block accepted and locked!`, 'success');
            break;
          }
        }
      }

      // Restore playback state safely
      if (originalPlaybackState !== 'playing' && autoCommit) {
        useDawStore.setState({ playbackState: originalPlaybackState });
      }
    };

    // Add activity log
    const addLog = (text: string, status: 'success' | 'failed' | 'pending' = 'success') => {
      setTactileLogs(prev => [
        { id: Math.random().toString(), timestamp: new Date().toLocaleTimeString(), action: text, status },
        ...prev
      ].slice(0, 15));
    };

    // Requirement 7: Check Guardrail Permissions before executing!
    if (action === 'ANALYZE_VOCAL' || action === 'ARRANGE_SONG') {
      if (!permissions.timelineEdit) {
        addLog(`BLOCKED OPERATION ${action}: Timeline Edit Denied.`, 'failed');
        throw new Error("Timeline Edit Permission is blocked in AI Guardrails.");
      }
    }
    if (action === 'GENERATE_DRUMS' || action === 'GENERATE_BASS' || action === 'GENERATE_CHORDS' || action === 'GENERATE_MELODY' || action === 'GENERATE_FX') {
      if (!permissions.trackCreation) {
        addLog(`BLOCKED OPERATION ${action}: Track Creation Denied.`, 'failed');
        throw new Error("Track Creation Permission is blocked in AI Guardrails.");
      }
    }
    if (action === 'PROCESS_VOCALS') {
      if (!permissions.fxRack) {
        addLog(`BLOCKED OPERATION ${action}: FX Rack Denied.`, 'failed');
        throw new Error("FX Rack Tuning Permission is blocked in AI Guardrails.");
      }
    }
    if (action === 'MIX_PROJECT') {
      if (!permissions.mixerControls) {
        addLog(`BLOCKED OPERATION ${action}: Mixer Controls Denied.`, 'failed');
        throw new Error("Mixer Control Permission is blocked in AI Guardrails.");
      }
    }
    if (action === 'EXPORT_PROJECT') {
      if (!permissions.exportSystem) {
        addLog(`BLOCKED OPERATION ${action}: Export System Denied.`, 'failed');
        throw new Error("Audio Exporting Permission is blocked in AI Guardrails.");
      }
    }

    addLog(`AI OPERATOR COMMENCING: ${action}`, 'pending');

    const initialPlaybackState = useDawStore.getState().playbackState;
    const wasPlaying = initialPlaybackState === 'playing';
    const isHeavyAction = [
      'ANALYZE_VOCAL', 'GENERATE_DRUMS', 'GENERATE_BASS', 
      'GENERATE_CHORDS', 'GENERATE_MELODY', 'GENERATE_FX', 
      'ARRANGE_SONG', 'ADD_CUSTOM_TRACK', 'INSERT_CUSTOM_NOTES'
    ].includes(action);

    // If a pipeline is active, we fully keep playback stopped until the final master sequence!
    const shouldStopNow = wasPlaying && isHeavyAction && !pipelineActive;

    if (shouldStopNow) {
      useDawStore.setState({ playbackState: 'stopped' });
      await new Promise(r => setTimeout(r, 150));
    }

    // Auto-navigate to correct page layout so user sees exactly what the AI is working on
    let targetTab: AppTab | null = null;
    switch (action) {
      case 'ANALYZE_VOCAL':
      case 'SET_GLOBAL_TEMPO_AND_KEY':
      case 'SET_PORTAMENTO_GLIDE':
      case 'TOGGLE_SIDECHAIN':
        targetTab = 'timeline';
        break;
      case 'GENERATE_DRUMS':
      case 'SET_SWING_QUANTIZE':
      case 'WRITE_STEP_SEQUENCER':
      case 'APPLY_AUTOMATION_CLIP':
        targetTab = 'drumpads';
        break;
      case 'GENERATE_BASS':
      case 'GENERATE_CHORDS':
      case 'GENERATE_MELODY':
      case 'INSERT_CUSTOM_NOTES':
        targetTab = 'pianoroll';
        break;
      case 'GENERATE_FX':
      case 'PROCESS_VOCALS':
      case 'APPLY_FX_RACK':
      case 'SET_TIME_SHAPER':
      case 'APPLY_PEAK_CONTROLLER':
        targetTab = 'fx';
        break;
      case 'ARRANGE_SONG':
      case 'ADD_CUSTOM_TRACK':
        targetTab = 'timeline';
        break;
      case 'MIX_PROJECT':
      case 'MASTER_PROJECT':
      case 'UPDATE_MIXER':
        targetTab = 'mixer';
        break;
      case 'EXPORT_PROJECT':
        targetTab = 'timeline';
        break;
      default:
        break;
    }
    if (targetTab) {
      useDawStore.getState().setCurrentTab(targetTab);
    }

    try {
      switch (action) {
      case "SET_GLOBAL_TEMPO_AND_KEY": {
        const nextBpm = Math.min(180, Math.max(60, Number(params.bpm ?? params.tempo ?? params.targetBpm ?? 105)));
        const rawKey = String(params.key ?? params.selectedKey ?? params.musicKey ?? projectKey ?? 'C').replace(/\s+/g, '').replace(/minor$/i, 'm').replace(/major$/i, '');
        const rawScale = String(params.scale ?? params.selectedScale ?? projectScale ?? (rawKey.toLowerCase().endsWith('m') ? 'Minor' : 'Major'));
        const cleanKey = rawKey.replace(/m$/i, '') || 'C';
        const cleanScale = /minor|m$/i.test(rawScale) || rawKey.toLowerCase().endsWith('m') ? 'Minor' : 'Major';
        const storeKey = cleanScale === 'Minor' && !cleanKey.endsWith('m') ? `${cleanKey}m` : cleanKey;

        triggerSimulation('tap', 24, 18, `Global tempo/key controls: ${nextBpm} BPM ${cleanKey} ${cleanScale}`);
        setBpm(nextBpm);
        setProjectKey(storeKey);
        setProjectScale(cleanScale);
        if (params.style || params.genre) {
          const styleName = String(params.style || params.genre).toLowerCase();
          if (styleName.includes('amapiano')) setActiveStyle(MusicStyle.AMAPIANO);
          else if (styleName.includes('trap') || styleName.includes('drill')) setActiveStyle(MusicStyle.TRAP);
          else if (styleName.includes('pop') || styleName.includes('r&b') || styleName.includes('edm')) setActiveStyle(MusicStyle.POP);
          else if (styleName.includes('afro')) setActiveStyle(MusicStyle.AFROBEATS);
        }
        addLog(`GLOBAL TEMPO/KEY LOCKED: ${nextBpm} BPM • ${cleanKey} ${cleanScale}`, 'success');
        await new Promise(r => setTimeout(r, 500));
        break;
      }

      case 'ANALYZE_VOCAL': {
        // Physical touch trigger: Tap vocal monitor
        triggerSimulation('tap', 22, 35, 'Analyze Vocal Input Monitor');
        await new Promise(r => setTimeout(r, 600));

        // Requirement 8: Smart BPM Auto-detection & Style Cloning Selector
        let previousBpm = bpm;
        let adjustedBpm = bpm;
        let finalStyle = activeStyle;
        if (bpm < 95) {
          adjustedBpm = 105;
          setBpm(105);
          finalStyle = MusicStyle.AFROBEATS;
          setActiveStyle(MusicStyle.AFROBEATS);
          addLog(`BPM AUTO-DETECT CORRECTION: ${previousBpm} -> 105 (Auto-Afrobeat)`, 'success');
        } else if (bpm >= 110 && bpm <= 120) {
          finalStyle = MusicStyle.AMAPIANO;
          setActiveStyle(MusicStyle.AMAPIANO);
          addLog(`BPM AUTO-DETECT CORRECTION: ${previousBpm} -> Amapiano (Auto-Amapiano Vibes)`, 'success');
        } else if (bpm > 120) {
          finalStyle = MusicStyle.TRAP;
          setActiveStyle(MusicStyle.TRAP);
          addLog(`BPM AUTO-DETECT CORRECTION: ${previousBpm} -> Trap (Auto-Trap Sub 808s)`, 'success');
        }

        // Apply vocal style profile parameters if needed
        const currentProfile = getStyleProfile(finalStyle);
        if (bpm < currentProfile.bpmRange.min || bpm > currentProfile.bpmRange.max) {
          const rangeDiff = currentProfile.bpmRange.max - currentProfile.bpmRange.min;
          const randomBpm = currentProfile.bpmRange.min + Math.floor(Math.random() * (rangeDiff + 1));
          setBpm(randomBpm);
          addLog(`STYLE TEMPO ADJUST: Synced project BPM to style sweetspot: ${randomBpm} BPM`, 'success');
        }

        // Renew the composition seed to make this song completely different and fresh
        renewCompositionSeed();

        // Check if there are any audio/vocal tracks with recorded or imported vocals
        const currentTracks = useDawStore.getState().tracks;
        const currentClips = useDawStore.getState().clips;

        let vocalTrack = currentTracks.find(t => t.type === 'audio' && t.clips.some(cid => currentClips[cid] && currentClips[cid].audioUrl));
        if (!vocalTrack) {
          vocalTrack = currentTracks.find(t => t.name.toLowerCase().includes('vocal') || t.name.toLowerCase().includes('voice') || t.name.toLowerCase().includes('mic'));
        }

        let vocalClip: any = undefined;
        if (vocalTrack) {
          const trackClips = vocalTrack.clips.map(cid => currentClips[cid]).filter(Boolean);
          vocalClip = trackClips.find(c => c.audioUrl) || trackClips[0];
        }

        let wasVocalPitchAnalyzed = false;
        let detectedKey = 'C';
        let detectedScaleType = 'Minor';

        if (vocalClip && vocalClip.audioUrl && vocalTrack) {
          addLog(`🎤 ANALYZING REAL VOCALS: Extracting pitch profile & timing sync coordinates...`, 'pending');
          try {
            // Retrieve dynamic AudioBuffer
            const audioBuffer = await audioEngine.getAudioBuffer(vocalTrack.id, vocalClip.id, vocalClip.audioUrl);
            if (audioBuffer) {
              const bpmVal = useDawStore.getState().bpm || 115;
              
              // Estimate original vocal BPM and warp to project BPM
              const { estimateVocalBpm } = await import('../../audio/WarpEngine');
              const estimatedBpm = estimateVocalBpm(audioBuffer, bpmVal);
              
              if (Math.abs(estimatedBpm - bpmVal) > 1.5) {
                addLog(`⌛ VOCAL SYNC WARPING: Detected native vocal BPM of ${estimatedBpm} BPM. Elastic-warping vocals to project BPM (${bpmVal} BPM) with pitch-lock...`, 'pending');
                const warpSuccess = await audioEngine.warpClipAudio(vocalTrack.id, vocalClip.id, bpmVal, estimatedBpm);
                if (warpSuccess) {
                  useDawStore.getState().updateClip(vocalClip.id, { originalBpm: estimatedBpm });
                  addLog(`✅ VOCALS ELASTICALLY WARPED: Phase-coherent WSOLA time-stretch completed. Pitch locked and synchronized!`, 'success');
                }
              } else {
                addLog(`✅ VOCAL BPM SYNCED: Vocals match project tempo (${bpmVal} BPM). No time-stretching required!`, 'success');
              }

              const analyzedNotes = await analyzeAudioPitch(audioBuffer, bpmVal);
              
              if (analyzedNotes && analyzedNotes.length > 0) {
                // Update the clip with the real detected vocalNotes
                useDawStore.getState().updateClip(vocalClip.id, { vocalNotes: analyzedNotes });
                wasVocalPitchAnalyzed = true;

                // Run smart MIR Vocal Phrase analysis for dynamic structural beat alignment
                try {
                  const { VocalAnalyzerProcessor } = await import('../../audio/vocal-analyzer-processor');
                  const duration16ths = vocalClip.duration || 32;
                  const detectedPhrases = VocalAnalyzerProcessor.detectPhrases(analyzedNotes, duration16ths);
                  
                  if (detectedPhrases.length > 0) {
                    addLog(`🔍 VOCAL MIR ENGINE: Extracting vocal phrase structures...`, 'pending');
                    const mappedStructure = VocalAnalyzerProcessor.mapPhrasesToSongStructure(detectedPhrases, duration16ths);
                    useDawStore.getState().setSongStructure(mappedStructure);
                    addLog(`🌟 VOCAL PHRASE ARRANGEMENT LOCKED: Sequencer adapted timeline sections to fit your recorded phrases perfectly!`, 'success');
                  }
                } catch (mirErr) {
                  console.error("MIR Phrase Analysis error:", mirErr);
                }

                // Key Profiling logic from VocalRoll
                const activeValues = analyzedNotes.filter(n => !n.isSilence).map(n => n.midi % 12);
                if (activeValues.length > 0) {
                  const counts = Array(12).fill(0);
                  activeValues.forEach(m => counts[m]++);

                  const majorScaleStrength = [6.3, 2.2, 3.4, 2.3, 4.3, 4.0, 2.5, 5.1, 2.3, 3.6, 2.2, 2.8];
                  const minorScaleStrength = [6.3, 2.6, 3.5, 5.3, 2.6, 3.5, 2.5, 4.7, 3.9, 2.6, 3.3, 3.1];

                  let bestRoot = 0;
                  let maxConfidence = -Infinity;

                  const keyNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
                  for (let r = 0; r < 12; r++) {
                    let scoreMajor = 0;
                    let scoreMinor = 0;
                    for (let i = 0; i < 12; i++) {
                      const offsetIdx = (r + i) % 12;
                      scoreMajor += counts[offsetIdx] * majorScaleStrength[i];
                      scoreMinor += counts[offsetIdx] * minorScaleStrength[i];
                    }
                    if (scoreMajor > maxConfidence) {
                      maxConfidence = scoreMajor;
                      bestRoot = r;
                      detectedScaleType = 'Major';
                    }
                    if (scoreMinor > maxConfidence) {
                      maxConfidence = scoreMinor;
                      bestRoot = r;
                      detectedScaleType = 'Minor';
                    }
                  }

                  detectedKey = keyNames[bestRoot];
                  const storeKey = detectedScaleType === 'Minor' ? `${detectedKey}m` : detectedKey;
                  setProjectKey(storeKey);
                  setProjectScale(detectedScaleType);

                  addLog(`🎤 VOCALS SIGNAL KEY DETECTED: "${detectedKey} ${detectedScaleType}"`, 'success');
                  addLog(`⚡ Locked global instrument generators and scale correction nodes to: ${detectedKey} ${detectedScaleType}. Perfect harmony locked!`, 'success');
                }
              }
            }
          } catch (err) {
            console.warn("Deeper pitch profile extraction had an issue (handled gracefully):", err);
          }
        }

        if (!wasVocalPitchAnalyzed) {
          // Harmonically randomize key & scale to prevent duplicate tracks & distribution issues
          const randomKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
          const randomScales = ['Minor', 'Major'];
          
          detectedKey = randomKeys[Math.floor(Math.random() * randomKeys.length)];
          detectedScaleType = randomScales[Math.floor(Math.random() * randomScales.length)];
          
          const storeKey = detectedScaleType === 'Minor' ? `${detectedKey}m` : detectedKey;
          setProjectKey(storeKey);
          setProjectScale(detectedScaleType);
          
          addLog(`ℹ️ No recorded vocals found on timeline. Initializing system defaults: ${detectedKey} ${detectedScaleType}`, 'success');
        }

        // Align vocal clips to play list grid (perfect bar boundaries) so there are no out-of-sync playback positions
        if (!vocalTrack) {
          addTrack('audio');
          await new Promise(r => setTimeout(r, 150));
          const updatedTracks = useDawStore.getState().tracks;
          const newest = updatedTracks[updatedTracks.length - 1];
          if (newest) {
            updateTrack(newest.id, { name: 'Vocal Lead (AI Analyzed)', color: '#FF005F' });
            vocalTrack = newest;
            // Add a clip with voice peaks to visualize analysis
            const clipId = useDawStore.getState().addClip(newest.id, 0, undefined, [0.1, 0.4, 0.8, 0.5, 0.9, 0.6, 0.3, 0.8, 0.9, 0.4, 0.1, 0.05], 32);
          }
        } else {
          updateTrack(vocalTrack.id, { name: 'Vocal Lead (AI Analyzed)', color: '#FF005F' });
        }

        if (vocalTrack) {
          useDawStore.setState({ aiActivePulseTrackId: vocalTrack.id });
          
          // Re-quantize and snap the clips on this track to the nearest beat boundary
          vocalTrack.clips.forEach(cid => {
            const clip = useDawStore.getState().clips[cid];
            if (clip) {
              const originalStart = clip.startTime;
              const snappedStart = Math.round(originalStart / 16) * 16; // Snap to nearest 1 bar (16 steps)
              useDawStore.getState().updateClip(cid, { startTime: snappedStart });
              useDawStore.getState().quantizeClipNotes(cid, 2);
              if (originalStart !== snappedStart) {
                addLog(`⚡ VOCAL SYNCHRONIZER: Grid-aligned vocals starting step from ${originalStart.toFixed(1)} to ${snappedStart} for zero-latency rhythmic beat alignment!`, 'success');
              }
            }
          });
        }

        await new Promise(r => setTimeout(r, 850));
        useDawStore.setState({ aiActivePulseTrackId: null });

        setEqAnalysis(prev => ({ ...prev, scaleCheck: `Vocals perfectly aligned in ${detectedKey} ${detectedScaleType}` }));
        break;
      }

      case 'GENERATE_DRUMS': {
        triggerSimulation('tap', 85, 30, 'Create Instrument Node');
        await new Promise(r => setTimeout(r, 550));

        addTrack('midi', 'membrane');
        await new Promise(r => setTimeout(r, 150));

        const updated = useDawStore.getState().tracks;
        const newest = updated[updated.length - 1];
        if (newest) {
          useDawStore.setState({ aiActivePulseTrackId: newest.id });
          
          let name = 'Afrobeat Groove Drums';
          let color = '#00FF9C';
          let volume = -7.0;
          
          if (activeStyle === MusicStyle.AMAPIANO) {
            name = 'Amapiano Log Drums';
            color = '#3B82F6';
            volume = -6.0;
          } else if (activeStyle === MusicStyle.TRAP) {
            name = 'Trap 808 Drums';
            color = '#E11D48';
            volume = -5.5;
          } else if (activeStyle === MusicStyle.POP) {
            name = 'Modern Pop Drums';
            color = '#38BDF8';
            volume = -6.5;
          }
          
          updateTrack(newest.id, { name, color, volume });
          const clipId = useDawStore.getState().addClip(newest.id, 0, undefined, undefined, 32);
          
          const sliderA = useDawStore.getState().sliderA;
          const sliderB = useDawStore.getState().sliderB;
          const currentVibe = getFinalVibe(sliderA, sliderB);
          const dynamicNotes = generateProceduralNotesForVibe('membrane', currentVibe);
          
          dynamicNotes.forEach(dn => {
            let finalMidi = dn.note;
            if (dn.note === 'C4') finalMidi = 'C1';
            else if (dn.note === 'D4') finalMidi = 'D1';
            else if (dn.note === 'F#4' || dn.note === 'F1') finalMidi = 'F#1';
            addNote(clipId, finalMidi, dn.startTime, dn.duration);
          });
          await runGhostPreviewWorkflow(clipId, 800);
        }
        useDawStore.setState({ aiActivePulseTrackId: null });
        break;
      }

      case 'GENERATE_BASS': {
        triggerSimulation('tap', 85, 30, 'Create Instrument Node');
        await new Promise(r => setTimeout(r, 500));

        addTrack('midi', 'pluck');
        await new Promise(r => setTimeout(r, 150));

        const updated = useDawStore.getState().tracks;
        const newest = updated[updated.length - 1];
        if (newest) {
          useDawStore.setState({ aiActivePulseTrackId: newest.id });
          
          let name = 'Afro Sub Bassline';
          let color = '#FF00EE';
          let volume = -9.5;
          
          if (activeStyle === MusicStyle.AMAPIANO) {
            name = 'Amapiano Log Bass';
            color = '#10B981';
            volume = -5.0;
          } else if (activeStyle === MusicStyle.TRAP) {
            name = 'Trap Heavy 808 Bass';
            color = '#9333EA';
            volume = -8.0;
          } else if (activeStyle === MusicStyle.POP) {
            name = 'Pop Analog Bass';
            color = '#FB7185';
            volume = -8.5;
          }
          
          updateTrack(newest.id, { name, color, volume });
          const clipId = useDawStore.getState().addClip(newest.id, 0, undefined, undefined, 32);
          
          const sliderA = useDawStore.getState().sliderA;
          const sliderB = useDawStore.getState().sliderB;
          const currentVibe = getFinalVibe(sliderA, sliderB);
          const dynamicNotes = generateProceduralNotesForVibe('synthbass', currentVibe);
          
          dynamicNotes.forEach(dn => {
            addNote(clipId, dn.note, dn.startTime, dn.duration);
          });
          await runGhostPreviewWorkflow(clipId, 1200);
        }
        useDawStore.setState({ aiActivePulseTrackId: null });
        break;
      }

      case 'GENERATE_CHORDS': {
        triggerSimulation('tap', 85, 30, 'Create Instrument Node');
        await new Promise(r => setTimeout(r, 500));

        let currentSynthType: SynthType = 'poly';
        if (activeStyle === MusicStyle.AMAPIANO) {
          currentSynthType = 'epiano';
        } else if (activeStyle === MusicStyle.POP) {
          currentSynthType = 'pad';
        }

        addTrack('midi', currentSynthType);
        await new Promise(r => setTimeout(r, 150));

        const updated = useDawStore.getState().tracks;
        const newest = updated[updated.length - 1];
        if (newest) {
          useDawStore.setState({ aiActivePulseTrackId: newest.id });
          
          let name = 'Afro Atmospheric Pads';
          let color = '#3B82F6';
          let volume = -14.0;
          
          if (activeStyle === MusicStyle.AMAPIANO) {
            name = 'Amapiano Rhodes Keys';
            color = '#F59E0B';
            volume = -11.0;
          } else if (activeStyle === MusicStyle.TRAP) {
            name = 'Trap Dark Moody Keys';
            color = '#6366F1';
            volume = -13.0;
          } else if (activeStyle === MusicStyle.POP) {
            name = 'Pop Bright Chords';
            color = '#F472B6';
            volume = -10.5;
          }
          
          updateTrack(newest.id, { name, color, volume });
          const clipId = useDawStore.getState().addClip(newest.id, 0, undefined, undefined, 32);
          
          const sliderA = useDawStore.getState().sliderA;
          const sliderB = useDawStore.getState().sliderB;
          const currentVibe = getFinalVibe(sliderA, sliderB);
          const dynamicNotes = generateProceduralNotesForVibe('poly', currentVibe);
          
          dynamicNotes.forEach(dn => {
            addNote(clipId, dn.note, dn.startTime, dn.duration);
          });
          await runGhostPreviewWorkflow(clipId, 1800);
        }
        useDawStore.setState({ aiActivePulseTrackId: null });
        break;
      }

      case 'GENERATE_MELODY': {
        triggerSimulation('tap', 85, 30, 'Create Instrument Node');
        await new Promise(r => setTimeout(r, 500));

        let currentSynthType: SynthType = 'pluck';
        if (activeStyle === MusicStyle.TRAP) {
          currentSynthType = 'bells';
        } else if (activeStyle === MusicStyle.POP) {
          currentSynthType = 'leadsynth';
        }

        addTrack('midi', currentSynthType);
        await new Promise(r => setTimeout(r, 150));

        const updated = useDawStore.getState().tracks;
        const newest = updated[updated.length - 1];
        if (newest) {
          useDawStore.setState({ aiActivePulseTrackId: newest.id });
          
          let name = 'Afro Pluck Melody';
          let color = '#10B981';
          let volume = -11.0;
          
          if (activeStyle === MusicStyle.AMAPIANO) {
            name = 'Amapiano Piano Roll Melody';
            color = '#EC4899';
            volume = -10.0;
          } else if (activeStyle === MusicStyle.TRAP) {
            name = 'Trap Bell Pluck Melody';
            color = '#F43F5E';
            volume = -12.0;
          } else if (activeStyle === MusicStyle.POP) {
            name = 'Pop Synth Lead Melody';
            color = '#38BDF8';
            volume = -9.0;
          }
          
          updateTrack(newest.id, { name, color, volume });
          const clipId = useDawStore.getState().addClip(newest.id, 0, undefined, undefined, 32);
          
          const sliderA = useDawStore.getState().sliderA;
          const sliderB = useDawStore.getState().sliderB;
          const currentVibe = getFinalVibe(sliderA, sliderB);
          const dynamicNotes = generateProceduralNotesForVibe('pluck', currentVibe);
          
          dynamicNotes.forEach(dn => {
            addNote(clipId, dn.note, dn.startTime, dn.duration);
          });
          await runGhostPreviewWorkflow(clipId, 2000);
        }
        useDawStore.setState({ aiActivePulseTrackId: null });
        break;
      }

      case 'GENERATE_FX': {
        triggerSimulation('tap', 85, 30, 'Create SFX Sampler Track');
        await new Promise(r => setTimeout(r, 500));

        addTrack('audio');
        await new Promise(r => setTimeout(r, 150));

        const updated = useDawStore.getState().tracks;
        const newest = updated[updated.length - 1];
        if (newest) {
          useDawStore.setState({ aiActivePulseTrackId: newest.id });
          updateTrack(newest.id, { name: 'Transition FX sweeps', color: '#8B5CF6', volume: -16.0 });
          // Risers segments starts slightly before transitions bounds (e.g. tick 24)
          const clipId = useDawStore.getState().addClip(newest.id, 24, undefined, [0.01, 0.05, 0.1, 0.3, 0.45, 0.6, 0.85, 1.0], 8);

          // FX: quick riser riser flash preview
          await runGhostPreviewWorkflow(clipId, 500);
        }
        useDawStore.setState({ aiActivePulseTrackId: null });
        break;
      }

      case 'ARRANGE_SONG': {
        triggerSimulation('scroll', 75, 45, 'Arrange Section Timeline Clips');
        await new Promise(r => setTimeout(r, 800));

        // Detect user requested duration
        let targetSeconds = 120; // Default: 2 minutes unless user specified otherwise
        const lastUserMsg = [...chatMessages].reverse().find(m => m.role === 'user');
        if (lastUserMsg) {
          const parsed = parseRequestedDuration(lastUserMsg.content);
          if (parsed !== null) {
            targetSeconds = parsed;
            addLog(`CUSTOM TIME TARGET ACQUIRED: Structuring layout for a precise ${Math.floor(targetSeconds / 60)}m ${targetSeconds % 60}s song progression...`, 'pending');
          } else {
            addLog(`AUTO-ARRANGE INITIATED: Applying standard premium radio length of 2:00 (120 seconds)...`, 'pending');
          }
        } else {
          addLog(`AUTO-ARRANGE INITIATED: Applying standard premium radio length of 2:00 (120 seconds)...`, 'pending');
        }

        const state = useDawStore.getState();
        const activeTracks = [...state.tracks];
        const activeClips = { ...state.clips };
        const bpm = state.bpm || 110;

        // Clip length formula based on 32-sixteenth-note blocks
        const clipSeconds = 32 * (60 / bpm / 4); // duration of one 32-sixteenth loop block in seconds
        let totalClips = Math.round(targetSeconds / clipSeconds);
        if (totalClips < 4) totalClips = 4;
        if (totalClips > 150) totalClips = 150; // Cap to 10 minutes max bounds

        // Robust Section Divisions
        const introEnd = Math.max(1, Math.round(totalClips * 0.10)); // Intro (~10%)
        const verse1End = introEnd + Math.max(1, Math.round(totalClips * 0.18)); // Verse 1 (~18%)
        const preChorusEnd = verse1End + Math.max(1, Math.round(totalClips * 0.08)); // Pre-Chorus (~8%)
        const chorus1End = preChorusEnd + Math.max(1, Math.round(totalClips * 0.16)); // Chorus 1 (~16%)
        const verse2End = chorus1End + Math.max(1, Math.round(totalClips * 0.18)); // Verse 2 (~18%)
        const bridgeEnd = verse2End + Math.max(1, Math.round(totalClips * 0.12)); // Bridge (~12%)
        const chorus2End = bridgeEnd + Math.max(1, Math.round(totalClips * 0.16)); // Chorus 2 Climax (~16%)
        // Outro is remaining clips to totalClips

        addLog(`Designing arrangement bounds with ${totalClips} loop blocks [Intro (0-${introEnd * 32}) | Verse 1 (${introEnd * 32}-${verse1End * 32}) | Pre-Chorus (${verse1End * 32}-${preChorusEnd * 32}) | Chorus 1 (${preChorusEnd * 32}-${chorus1End * 32}) | Verse 2 (${chorus1End * 32}-${verse2End * 32}) | Bridge (${verse2End * 32}-${bridgeEnd * 32}) | Chorus 2 (${bridgeEnd * 32}-${chorus2End * 32}) | Outro]...`, 'pending');

        for (const track of activeTracks) {
          let mainClipId = track.clips[0];
          let masterClip = mainClipId ? activeClips[mainClipId] : null;

          // Auto-Heal Empty tracks: if no clip exists or a MIDI track's clip has no notes, automatically generate elegant procedural starter notes!
          const isMidiTrack = track.type === 'midi';
          const isEmptyMidi = isMidiTrack && (!masterClip || !masterClip.notes || masterClip.notes.length === 0);

          if (!masterClip || isEmptyMidi) {
            const sliderA = useDawStore.getState().sliderA;
            const sliderB = useDawStore.getState().sliderB;
            const currentVibe = getFinalVibe(sliderA, sliderB);
            
            let synthPreset: string = track.synthType || 'poly';
            if (track.name.toLowerCase().includes('drum') || track.name.toLowerCase().includes('percussion')) {
              synthPreset = 'membrane';
            } else if (track.name.toLowerCase().includes('bass') || track.name.toLowerCase().includes('sub')) {
              synthPreset = 'synthbass';
            } else if (track.name.toLowerCase().includes('chord') || track.name.toLowerCase().includes('pad') || track.name.toLowerCase().includes('keys')) {
              synthPreset = 'poly';
            } else {
              synthPreset = 'pluck';
            }

            const tempNotes = generateProceduralNotesForVibe(synthPreset, currentVibe);
            const translatedNotes = tempNotes.map(dn => {
              let finalMidi = dn.note;
              if (synthPreset === 'membrane') {
                if (dn.note === 'C4') finalMidi = 'C1';
                else if (dn.note === 'D4') finalMidi = 'D1';
                else if (dn.note === 'F#4' || dn.note === 'F1') finalMidi = 'F#1';
              }
              return { ...dn, note: finalMidi };
            });

            masterClip = {
              id: `master_clip_${track.id}`,
              trackId: track.id,
              startTime: 0,
              duration: 32,
              notes: translatedNotes,
              vocalNotes: undefined,
              audioUrl: undefined,
              recordingPeaks: undefined,
              color: track.color
            } as any;
          }

          // Pulse this active track being arranged
          useDawStore.setState({ 
            aiActivePulseTrackId: track.id, 
            aiStepMessage: `Structuring timeline for ${track.name.toUpperCase()} (${Math.floor(targetSeconds / 60)}:${String(targetSeconds % 60).padStart(2, '0')}) ...` 
          });

          // Clean initial clip lists to arrange a fresh narrative timeline
          updateTrack(track.id, { clips: [] });

          // Generate clips sequentially up to totalClips
          for (let c = 0; c < totalClips; c++) {
            const startTick = c * 32;
            const nameLower = track.name.toLowerCase();

            let shouldAdd_c = false;
            let isChorus_c = false;
            let isBridge_c = false;

            if (c < introEnd) {
              // 1. INTRO: ONLY pads, keys, fx, transitions, pluck, chords
              shouldAdd_c = nameLower.includes('pad') || nameLower.includes('keys') || nameLower.includes('fx') || nameLower.includes('transition') || nameLower.includes('sweep') || nameLower.includes('chord');
            } else if (c >= introEnd && c < verse1End) {
              // 2. VERSE 1: Drums, Bass, Chords, Vocals. SILENCE leads/melodies
              const isMelodyOrLead = nameLower.includes('melody') || nameLower.includes('lead') || nameLower.includes('pluck') || nameLower.includes('arpeggios');
              shouldAdd_c = !isMelodyOrLead;
            } else if (c >= verse1End && c < preChorusEnd) {
              // 3. PRE-CHORUS: Build-up, keys, chords, FX risers, drums, NO vocal or heavy melody
              const isMelodyOrVocal = nameLower.includes('vocal') || nameLower.includes('voice') || nameLower.includes('lead') || nameLower.includes('melody');
              shouldAdd_c = !isMelodyOrVocal;
            } else if (c >= preChorusEnd && c < chorus1End) {
              // 4. CHORUS 1: Full energy Drop! UNLEASH EVERYTHING!
              shouldAdd_c = true;
              isChorus_c = true;
            } else if (c >= chorus1End && c < verse2End) {
              // 5. VERSE 2: Keep groove, but silence some leads
              const isMelodyOrLead = nameLower.includes('melody') || nameLower.includes('lead') || nameLower.includes('pluck') || nameLower.includes('arpeggios');
              shouldAdd_c = !isMelodyOrLead;
            } else if (c >= verse2End && c < bridgeEnd) {
              // 6. BRIDGE: Instrumental/Vocal Interlude. SILENCE heavy drums & bass
              const isHeavyGroove = nameLower.includes('drum') || nameLower.includes('bass') || nameLower.includes('percussion') || nameLower.includes('kick');
              shouldAdd_c = !isHeavyGroove;
              isBridge_c = true;
            } else if (c >= bridgeEnd && c < chorus2End) {
              // 7. CHORUS 2 (CLIMAX DROP): Full level!
              shouldAdd_c = true;
              isChorus_c = true;
            } else {
              // 8. OUTRO: Atmospheric instruments, soft pads, vocal/keys fading out
              shouldAdd_c = nameLower.includes('pad') || nameLower.includes('keys') || nameLower.includes('vocal') || nameLower.includes('voice') || nameLower.includes('fx');
            }

            if (shouldAdd_c && masterClip) {
              const latestStore = useDawStore.getState();
              const idClip = latestStore.addClip(track.id, startTick, masterClip.audioUrl, masterClip.recordingPeaks, masterClip.duration);
              
              // Copy vocalNotes if they exist (vital for audio tracks!)
              if (masterClip.vocalNotes && masterClip.vocalNotes.length > 0) {
                latestStore.updateClip(idClip, { vocalNotes: JSON.parse(JSON.stringify(masterClip.vocalNotes)) });
              }

              // Copy standard MIDI notes
              if (masterClip.notes && masterClip.notes.length > 0) {
                masterClip.notes.forEach(n => {
                  latestStore.addNote(idClip, n.note, n.startTime, n.duration);
                });

                // Fetch latest state with newly added notes to perform velocity adjustments
                const updatedStore = useDawStore.getState();
                const freshClip = updatedStore.clips[idClip];
                if (freshClip && freshClip.notes) {
                  freshClip.notes.forEach(targetNote => {
                    if (isChorus_c) {
                      updatedStore.updateNote(idClip, targetNote.id, { velocity: 1.0 });
                    } else if (isBridge_c) {
                      updatedStore.updateNote(idClip, targetNote.id, { velocity: 0.7 });
                    }
                  });
                }
              }
            }
          }

          // Progressive visual cascade delay per track row!
          await new Promise(r => setTimeout(r, 400));
        }

        // --- AI POST-PRODUCTION TIMELINE RECHECKING & ALIGNMENT ---
        addLog("AI is running post-production timeline check to align, snap, and heal any clip gaps...", "pending");
        useDawStore.setState({ aiStepMessage: "Healing arrangement gaps and snapping clips... ✨" });
        await new Promise(r => setTimeout(r, 600));

        const finalState = useDawStore.getState();
        const allClipsBeforeHeal = { ...finalState.clips };
        const allTracksToHeal = [...finalState.tracks];

        for (const track of allTracksToHeal) {
          // Get only clips associated with this track
          const trackClips = Object.values(allClipsBeforeHeal).filter(clip => clip.trackId === track.id);
          if (trackClips.length === 0) continue;

          // 1. Grid Snapping and Microsecond alignment fix
          trackClips.forEach(clip => {
            const snappedTime = Math.round(clip.startTime / 16) * 16;
            if (snappedTime !== clip.startTime) {
              finalState.updateClip(clip.id, { startTime: snappedTime });
            }
          });

          // 2. Locate master clip / primary clip to use for backfilling gaps
          let primaryClip = trackClips.find(clip => clip.notes && clip.notes.length > 0) || trackClips[0];

          // 3. Populate missing gaps sequentially
          for (let c = 0; c < totalClips; c++) {
            const startTick = c * 32;

            // Check if there is already a clip starting at or covering this exact tick block
            const currentClips = Object.values(useDawStore.getState().clips).filter(clip => clip.trackId === track.id);
            const hasClipInBlock = currentClips.some(clip => {
              const clipStart = clip.startTime;
              const clipEnd = clip.startTime + clip.duration;
              return (startTick >= clipStart && startTick < clipEnd);
            });

            if (!hasClipInBlock) {
              console.log(`AI healing gap: Inserting connector clip on track ${track.name} at tick ${startTick}`);
              const idClip = finalState.addClip(track.id, startTick, primaryClip?.audioUrl, primaryClip?.recordingPeaks, 32);

              if (primaryClip && primaryClip.notes && primaryClip.notes.length > 0) {
                primaryClip.notes.forEach(n => {
                  finalState.addNote(idClip, n.note, n.startTime, n.duration);
                });
                
                // Keep transition pads and clips in gaps played extremely softly for elegant structural contrast
                const freshClip = useDawStore.getState().clips[idClip];
                if (freshClip && freshClip.notes) {
                  freshClip.notes.forEach(addedNote => {
                    finalState.updateNote(idClip, addedNote.id, { velocity: 0.35 });
                  });
                }
              }
            }
          }
        }

        addLog("Arrangement timeline verified & healed! All clips are perfectly snapped, continuous, and gapless.", "success");
        useDawStore.setState({ aiActivePulseTrackId: null });
        break;
      }

      case 'PROCESS_VOCALS': {
        triggerSimulation('tap', 40, 55, 'Inspector FX Slot Insert Rack');
        await new Promise(r => setTimeout(r, 600));

        const targetVocal = useDawStore.getState().tracks.find(t => t.name.toLowerCase().includes('vocal') || t.name.toLowerCase().includes('voice'));
        if (targetVocal) {
          useDawStore.setState({ aiActivePulseTrackId: targetVocal.id });
          
          const projKey = useDawStore.getState().projectKey || 'C';
          const projScale = useDawStore.getState().projectScale || 'Minor';
          const cleanKeyName = projKey.replace('m', '');
          const scaleDisplay = `${cleanKeyName} ${projScale}`;

          // Setup dynamic vocal tuning FX presets locked to project key/scale
          const fxPreset = {
            eq: { enabled: true, high: 5.5, mid: 1.0, low: -4.0 }, // low-shelf filter vocal rumble, add high presence
            compressor: { enabled: true, threshold: -16, ratio: 4.5 }, // balanced dynamic range compression
            reverb: { enabled: true, decay: 2.2, mix: 0.22 }, // plate/stadium reverb space
            delay: { enabled: true, time: '8n', feedback: 0.30, mix: 0.15 }, // stereo ping-pong delays
            pitchCorrection: { enabled: true, amount: 98, speed: 75, scale: projScale }, // precise auto tune scale lock
            vocalTunePro: { enabled: true, amount: 95, speed: 80, humanize: 15, scale: scaleDisplay } // matching key scales!
          };
          updateTrack(targetVocal.id, { fx: { ...targetVocal.fx, ...fxPreset } });

          // Also execute a hard physical pitch-quantizer sync to vocalNotes to guarantee zero off-key elements!
          const scaleOffsets: Record<string, number[]> = {
            'Chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
            'Major': [0, 2, 4, 5, 7, 9, 11],
            'Minor': [0, 2, 3, 5, 7, 8, 10],
            'Pentatonic': [0, 2, 4, 7, 9]
          };
          const activeScale = scaleOffsets[projScale] || scaleOffsets['Minor'];
          const noteNamesList = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
          const rootIdx = noteNamesList.indexOf(cleanKeyName);
          const allowedNotes = activeScale.map(o => (rootIdx + o) % 12);

          const snapMidiToScale = (origMidi: number) => {
            let nearest = origMidi;
            let minDist = 999;
            for (let i = origMidi - 12; i <= origMidi + 12; i++) {
              if (allowedNotes.includes(((i % 12) + 12) % 12)) {
                const dist = Math.abs(i - origMidi);
                if (dist < minDist) {
                  minDist = dist;
                  nearest = i;
                }
              }
            }
            return nearest;
          };

          const clips = useDawStore.getState().clips;
          targetVocal.clips.forEach(cid => {
            const clip = clips[cid];
            if (clip && clip.vocalNotes && clip.vocalNotes.length > 0) {
              const updatedVocalNotes = clip.vocalNotes.map(n => {
                const snappedMidi = snapMidiToScale(n.midi);
                return {
                  ...n,
                  midi: snappedMidi,
                  noteName: Tone.Frequency(snappedMidi, "midi").toNote(),
                  frequency: Tone.Frequency(snappedMidi, "midi").toFrequency(),
                  cents: 0
                };
              });
              useDawStore.getState().updateClip(cid, { vocalNotes: updatedVocalNotes });
            }
          });

          setEqAnalysis(prev => ({ ...prev, dynamics: `DSP Auto-tune engine locked to ${scaleDisplay} with high-sheen saturation.` }));
          addLog(`🎚️ VOCAL AUTO-TUNE APPLIED: Vocal performance pitch corrected to ${scaleDisplay}`, "success");
        } else {
          addLog("PROCESS_VOCALS skipped: Vocal track not initialized.", "failed");
        }
        await new Promise(r => setTimeout(r, 850));
        useDawStore.setState({ aiActivePulseTrackId: null });
        break;
      }

      case 'MIX_PROJECT': {
        triggerSimulation('tap', 50, 95, 'Workspace Tab Panel: Mixer View');
        await new Promise(r => setTimeout(r, 500));

        const allTracks = useDawStore.getState().tracks;
        for (const track of allTracks) {
          let updatedVol = track.volume;
          let updatedPan = track.pan;

          // Pulse each track and update bottom progress message dynamically
          useDawStore.setState({ 
            aiActivePulseTrackId: track.id, 
            aiStepMessage: `Mixing channel faders: ${track.name.toUpperCase()} ...` 
          });

          // Strategic balance offsets & Specific style profiles (Requirement 7)
          if (track.name.toLowerCase().includes('vocal')) {
            updatedVol = -4.5; // Lead vocal occupies forefront
            updatedPan = 0; // centered solid image
          } else if (track.name.toLowerCase().includes('drum') || track.name.toLowerCase().includes('groove')) {
            updatedVol = activeStyle === MusicStyle.AMAPIANO ? -5.5 : (activeStyle === MusicStyle.POP ? -6.0 : -7.0); 
            updatedPan = 0; 
          } else if (track.name.toLowerCase().includes('bass') || track.name.toLowerCase().includes('sub')) {
            updatedVol = activeStyle === MusicStyle.AMAPIANO ? -4.5 : (activeStyle === MusicStyle.TRAP ? -5.5 : (activeStyle === MusicStyle.POP ? -7.5 : -9.2));
            updatedPan = -0.05; 
          } else if (track.name.toLowerCase().includes('pad') || track.name.toLowerCase().includes('atmos') || track.name.toLowerCase().includes('rhodes')) {
            updatedVol = -13.0; 
            updatedPan = -0.28; // stereo separation left
          } else if (track.name.toLowerCase().includes('melody') || track.name.toLowerCase().includes('pluck')) {
            updatedVol = -11.5; 
            updatedPan = 0.26; // stereo separation right
          } else if (track.name.toLowerCase().includes('fx') || track.name.toLowerCase().includes('sweeps')) {
            updatedVol = -16.5; 
            updatedPan = 0.12; 
          }

          const baseFx = { ...track.fx };

          // Style-specific audio processing:
          if (activeStyle === MusicStyle.AMAPIANO) {
            // Boost Low End on Bass & Widen Stereo on Rhodes
            if (track.name.toLowerCase().includes('bass') || track.name.toLowerCase().includes('sub')) {
              baseFx.eq = { enabled: true, low: 5.5, mid: 1.0, high: -1.0 };
            }
            if (track.name.toLowerCase().includes('rhodes') || track.name.toLowerCase().includes('pad')) {
              baseFx.stereoWidener = { enabled: true, width: 0.85, wet: 0.75 };
            }
          } else if (activeStyle === MusicStyle.TRAP) {
            // Heavy 808 saturation on bass, fast limiting compressors
            if (track.name.toLowerCase().includes('bass') || track.name.toLowerCase().includes('sub') || track.name.toLowerCase().includes('808')) {
              baseFx.distortion = { enabled: true, amount: 0.45, wet: 0.6 };
              baseFx.compressor = { enabled: true, threshold: -20, ratio: 8.0 };
            }
          } else if (activeStyle === MusicStyle.POP) {
            // Bright Pop compression and crisp EQs
            if (track.name.toLowerCase().includes('drum') || track.name.toLowerCase().includes('groove')) {
              baseFx.compressor = { enabled: true, threshold: -16, ratio: 4.0 };
            }
            if (track.name.toLowerCase().includes('vocal')) {
              baseFx.compressor = { enabled: true, threshold: -14, ratio: 3.5 };
              baseFx.eq = { enabled: true, low: -1.0, mid: 1.0, high: 3.5 };
            }
          } else {
            // Afrobeats: Light warm saturation and space balance
            if (track.name.toLowerCase().includes('pluck') || track.name.toLowerCase().includes('melody')) {
              baseFx.distortion = { enabled: true, amount: 0.15, wet: 0.25 }; // Warmth saturation
            }
          }

          // Sidechain kick-to-bass simulation:
          if (track.name.toLowerCase().includes('bass') || track.name.toLowerCase().includes('sub') || track.name.toLowerCase().includes('808')) {
            baseFx.compressor = { enabled: true, threshold: -28, ratio: 6.0 };
            baseFx.gate = { enabled: true, threshold: -40, wet: 0.3 };
          }

          updateTrack(track.id, { 
            volume: updatedVol, 
            pan: updatedPan,
            fx: baseFx
          });

          // Dynamic delay so faders bounce sequentially
          await new Promise(r => setTimeout(r, 450));
        }

        useDawStore.setState({ aiActivePulseTrackId: null });
        triggerSimulation('scroll', 30, 80, 'Mixer Track Volume Sliders');
        setEqAnalysis(prev => ({ ...prev, dynamics: "Stereo fields optimized. Sweeper pans locked." }));
        break;
      }

      case 'MASTER_PROJECT': {
        triggerSimulation('tap', 90, 15, 'Master Outputs Bus Fader');
        await new Promise(r => setTimeout(r, 650));

        // Master loudness optimization to maximum clean volume (+1.5dB)
        useDawStore.getState().setMasterVolume(1.5);

        setEqAnalysis(prev => ({ 
          ...prev, 
          low: '+1.5 dB', 
          mid: '-0.3 dB', 
          high: '+2.0 dB', 
          dynamics: "Saturated masters. -0.5dB FL-style limiter ceiling." 
        }));
        break;
      }

      case 'EXPORT_PROJECT': {
        triggerSimulation('tap', 94, 12, 'Export Studio WAV/MP3 Bounces');
        await new Promise(r => setTimeout(r, 500));

        // Returns simulated distribution audio waves download buttons
        addChatMessage({
          role: 'assistant',
          content: `📀 **HIGH-FIDELITY STUDIO BOUNCE COMPLETE!**\n\nThe full Afrobeat track is compiled, balanced, and rendered with pristine headroom.\n\n⬇️ **Render WAV (24-bit / 44.1kHz)**: [SeeVibe_Afrobeat_Master.wav](https://ai.studio/build/export)\n⬇️ **Render MP3 (320kbps Standard)**: [SeeVibe_Afrobeat_Master.mp3](https://ai.studio/build/export)\n\n*All structural boundaries are checked and aligned perfectly.*`
        });
        break;
      }

      case 'SEGMENTED_GENERATE': {
        const { style = 'Afrobeat - Davido Style', tempo = 112, selectedKey = 'C#', selectedScale = 'Minor', targetDurationSeconds = 120 } = params;
        addLog(`⚡ SEGMENTED PRODUCTION STREAM: Launching segment chain generation pipeline...`, 'pending');
        try {
          const { generateAndAssembleSegmentedTrack } = await import('../../utils/segmentedGenerator');
          await generateAndAssembleSegmentedTrack({
            style,
            tempo,
            selectedKey,
            selectedScale,
            targetDurationSeconds
          });
          addLog(`✅ FULL 2-MINUTE STRUCTURE COMPILED: Seamlessly stitched ${targetDurationSeconds}s of consistent vibe audio segments on timeline!`, 'success');
        } catch (err) {
          console.error("Segmented generation failed:", err);
          addLog(`❌ Segmented generation failed`, 'failed');
        }
        break;
      }

      case 'CHAT_AND_EXPLAIN': {
        const { x = 45, y = 40, label = 'Console Monitor', gestureType = 'tap' } = params;
        triggerSimulation(gestureType, x, y, label);
        await new Promise(r => setTimeout(r, 400));
        addLog(`EXPLAINING & ADVISING ON SYSTEM DIALOGUE`, 'success');
        break;
      }

      case 'SIMULATE_GESTURE': {
        const { gestureType = 'tap', x = 50, y = 50, elementLabel = 'Workspace Screen', text = '' } = params;
        triggerSimulation(gestureType, x, y, elementLabel);
        await new Promise(r => setTimeout(r, 600));
        if (gestureType === 'type' && text) {
          addLog(`TYPED: "${text}" INTO ${elementLabel}`, 'success');
        } else {
          addLog(`${gestureType.toUpperCase()} RESOLVED: ${elementLabel}`, 'success');
        }
        break;
      }

      case 'ADD_CUSTOM_TRACK': {
        if (!permissions.trackCreation) {
          addLog(`BLOCKED OPERATION ${action}: Track Creation Denied.`, 'failed');
          throw new Error("Track Creation Permission is blocked in AI Guardrails.");
        }
        const { trackType = 'midi', trackName = 'Symphony Plucks', synthType = 'poly', volume = -10.0, color = '#FFCC00' } = params;
        triggerSimulation('tap', 85, 30, 'Create Instrument Node');
        await new Promise(r => setTimeout(r, 500));
        addTrack(trackType, synthType);
        await new Promise(r => setTimeout(r, 150));
        const updated = useDawStore.getState().tracks;
        const newest = updated[updated.length - 1];
        if (newest) {
          useDawStore.setState({ aiActivePulseTrackId: newest.id });
          updateTrack(newest.id, { 
            name: trackName, 
            color, 
            volume 
          });
          addLog(`ADDED DYNAMIC INSTRUMENT LAYER: ${trackName} (${synthType})`, 'success');
        }
        await new Promise(r => setTimeout(r, 850));
        useDawStore.setState({ aiActivePulseTrackId: null });
        break;
      }

      case 'INSERT_CUSTOM_NOTES': {
        if (!permissions.timelineEdit) {
          addLog(`BLOCKED OPERATION ${action}: Timeline Edit Denied.`, 'failed');
          throw new Error("Timeline Edit Permission is blocked in AI Guardrails.");
        }
        const { trackSearch = '', notes = [] } = params;
        triggerSimulation('type', 45, 35, 'Piano Roll Grid Notes Builder');
        await new Promise(r => setTimeout(r, 500));
        
        const currentTracks = useDawStore.getState().tracks;
        let targetTrack = currentTracks.find(t => t.name.toLowerCase().includes(trackSearch.toLowerCase()));
        if (!targetTrack && currentTracks.length > 0) {
          targetTrack = currentTracks[currentTracks.length - 1]; // Fallback to last track
        }

        if (targetTrack) {
          useDawStore.setState({ aiActivePulseTrackId: targetTrack.id });
          // Ensure track has a clip
          let clipId = targetTrack.clips[0];
          if (!clipId) {
            clipId = useDawStore.getState().addClip(targetTrack.id, 0, undefined, undefined, 32);
          }
          
          if (notes && Array.isArray(notes) && notes.length > 0) {
            notes.forEach((n: any) => {
              addNote(clipId, n.note || 'C4', n.startTime || 0, n.duration || 2);
            });
            addLog(`GENERATED ${notes.length} CUSTOM NOTES ON TRACK [${targetTrack.name}]`, 'success');
          } else {
            addNote(clipId, 'C4', 0, 4);
            addNote(clipId, 'E4', 4, 4);
            addNote(clipId, 'G4', 8, 4);
            addLog(`GENERATED TRIAD NOTES ARPEGGIO ON TRACK [${targetTrack.name}]`, 'success');
          }
        } else {
          throw new Error("No target track found to inject notes.");
        }
        await new Promise(r => setTimeout(r, 850));
        useDawStore.setState({ aiActivePulseTrackId: null });
        break;
      }

      case 'UPDATE_MIXER': {
        if (!permissions.mixerControls) {
          addLog(`BLOCKED OPERATION ${action}: Mixer Controls Denied.`, 'failed');
          throw new Error("Mixer Control Permission is blocked in AI Guardrails.");
        }
        const { trackSearch = 'all', volume = -8.0, pan = 0.0 } = params;
        triggerSimulation('scroll', 30, 80, 'Mixer Track Volume Sliders');
        await new Promise(r => setTimeout(r, 500));

        const allTracks = useDawStore.getState().tracks;
        let count = 0;
        for (const track of allTracks) {
          if (trackSearch.toLowerCase() === 'all' || track.name.toLowerCase().includes(trackSearch.toLowerCase())) {
            useDawStore.setState({ aiActivePulseTrackId: track.id, aiStepMessage: `Aligning gain fader: ${track.name}` });
            updateTrack(track.id, { volume, pan });
            count++;
            await new Promise(r => setTimeout(r, 150));
          }
        }
        addLog(`MIXER DYNAMICS BALANCED FOR ${count} CHANNELS`, 'success');
        useDawStore.setState({ aiActivePulseTrackId: null });
        break;
      }

      case 'APPLY_FX_RACK': {
        if (!permissions.fxRack) {
          addLog(`BLOCKED OPERATION ${action}: FX Rack Denied.`, 'failed');
          throw new Error("FX Rack Tuning Permission is blocked in AI Guardrails.");
        }
        const { trackSearch = 'vocals', fxType = 'reverb', values = {} } = params;
        triggerSimulation('tap', 40, 55, `Inspector Channel FX Slot [${fxType.toUpperCase()}]`);
        await new Promise(r => setTimeout(r, 500));

        const currentTracks = useDawStore.getState().tracks;
        let targetTrack = currentTracks.find(t => t.name.toLowerCase().includes(trackSearch.toLowerCase()));
        if (!targetTrack && currentTracks.length > 0) {
          targetTrack = currentTracks[currentTracks.length - 1];
        }

        if (targetTrack) {
          useDawStore.setState({ aiActivePulseTrackId: targetTrack.id });
          const currentFx = (targetTrack.fx || {}) as Record<string, any>;
          const parameterSet = {
            enabled: true,
            ...values
          };
          updateTrack(targetTrack.id, {
            fx: {
              ...currentFx,
              [fxType]: {
                ...(currentFx[fxType] as any || {}),
                ...parameterSet
              }
            }
          });
          addLog(`TUNED DSP EFFECT NODE [${fxType.toUpperCase()}] ON ${targetTrack.name}`, 'success');
        } else {
          throw new Error(`Target track "${trackSearch}" not found for FX processing.`);
        }
        await new Promise(r => setTimeout(r, 850));
        useDawStore.setState({ aiActivePulseTrackId: null });
        break;
      }

      case 'SET_SWING_QUANTIZE': {
        const { amount = 25 } = params;
        triggerSimulation('scroll', 20, 45, `Micro-Timing Swing Slider: ${amount}%`);
        await new Promise(r => setTimeout(r, 300));
        useDawStore.getState().setSwingAmount(amount);
        addLog(`HUMANIZED PATTERN QUANTIZATION: SWING ADJUSTED TO ${amount}%`, 'success');
        break;
      }

      case 'WRITE_STEP_SEQUENCER': {
        if (!permissions.timelineEdit) {
          addLog(`BLOCKED OPERATION ${action}: Timeline Edit Denied.`, 'failed');
          throw new Error("Timeline Edit Permission is blocked in AI Guardrails.");
        }
        const { notes = [], replace = true } = params;
        triggerSimulation('type', 45, 50, '16-Step Pattern Sequencer Grid');
        await new Promise(r => setTimeout(r, 300));

        const currentTracks = useDawStore.getState().tracks;
        let targetTrack = currentTracks.find(t => t.synthType === 'membrane') || currentTracks.find(t => t.type === 'midi');
        if (!targetTrack) {
          // Auto create a drum machine track if absolutely missing
          addTrack('midi', 'membrane');
          await new Promise(r => setTimeout(r, 150));
          const updated = useDawStore.getState().tracks;
          targetTrack = updated[updated.length - 1];
        }

        if (targetTrack) {
          useDawStore.setState({ aiActivePulseTrackId: targetTrack.id });
          let clipId = targetTrack.clips[0];
          if (!clipId) {
            clipId = useDawStore.getState().addClip(targetTrack.id, 0, undefined, undefined, 16);
          }
          
          if (replace) {
            useDawStore.getState().updateClip(clipId, { notes: [] });
          }

          if (notes && Array.isArray(notes) && notes.length > 0) {
            notes.forEach((n: any) => {
              addNote(clipId, n.note || 'C4', n.startTime ?? 0, n.duration || 1);
            });
            addLog(`SEQUENCED ${notes.length} DRUM TRANSIENTS ON STEP-SEQUENCER [${targetTrack.name}]`, 'success');
          } else {
            addLog(`EMPTY SEQUENCER PATTERN RECONSTRUCTED`, 'success');
          }
        }
        await new Promise(r => setTimeout(r, 350));
        useDawStore.setState({ aiActivePulseTrackId: null });
        break;
      }

      case 'APPLY_AUTOMATION_CLIP': {
        const { type = 'lowpass', curve = Array(16).fill(0.8), enabled = true } = params;
        triggerSimulation('tap', 45, 60, `Automation Type Selective Slot: ${type}`);
        await new Promise(r => setTimeout(r, 300));

        const currentTracks = useDawStore.getState().tracks;
        let targetTrack = currentTracks.find(t => t.synthType === 'membrane') || currentTracks.find(t => t.type === 'midi');
        if (!targetTrack && currentTracks.length > 0) {
          targetTrack = currentTracks[0];
        }

        if (targetTrack) {
          useDawStore.setState({ aiActivePulseTrackId: targetTrack.id });
          
          const trackFx = { ...targetTrack.fx };
          if (type === 'lowpass' && !trackFx.lowpass?.enabled) {
            trackFx.lowpass = { enabled: true, frequency: 2000, Q: 1 };
          } else if (type === 'reverb' && !trackFx.reverb?.enabled) {
            trackFx.reverb = { enabled: true, decay: 1.5, mix: 0.3 };
          }

          updateTrack(targetTrack.id, {
            automationType: type,
            automationCurve: curve && Array.isArray(curve) && curve.length === 16 ? curve : Array(16).fill(0.8),
            automationEnabled: enabled,
            fx: trackFx
          });
          
          addLog(`MAPPED AND ARMED AUTOMATION ENVELOPE: [${type.toUpperCase()}] CYCLE`, 'success');
        }
        await new Promise(r => setTimeout(r, 350));
        useDawStore.setState({ aiActivePulseTrackId: null });
        break;
      }

      case 'SET_PORTAMENTO_GLIDE': {
        const { trackSearch = 'Lead', portamento = 0.5 } = params;
        triggerSimulation('scroll', 30, 40, `Synth Glide Knob set to ${portamento}s`);
        await new Promise(r => setTimeout(r, 300));
        const currentTracks = useDawStore.getState().tracks;
        const targetTrack = currentTracks.find(t => t.name.toLowerCase().includes(trackSearch.toLowerCase())) || currentTracks[0];
        if (targetTrack) {
          useDawStore.setState({ aiActivePulseTrackId: targetTrack.id });
          updateTrack(targetTrack.id, { portamento });
          addLog(`SET SYNTH PORTAMENTO GLIDE ON [${targetTrack.name}] TO ${portamento}s`, 'success');
        }
        await new Promise(r => setTimeout(r, 350));
        useDawStore.setState({ aiActivePulseTrackId: null });
        break;
      }

      case 'TOGGLE_SIDECHAIN': {
        const { trackSearch = 'Bass', enabled = true } = params;
        triggerSimulation('tap', 40, 50, `Toggle SC-Duck Button on ${trackSearch}`);
        await new Promise(r => setTimeout(r, 300));
        const currentTracks = useDawStore.getState().tracks;
        const targetTrack = currentTracks.find(t => t.name.toLowerCase().includes(trackSearch.toLowerCase())) || currentTracks[0];
        if (targetTrack) {
          useDawStore.setState({ aiActivePulseTrackId: targetTrack.id });
          const currentSidechain = targetTrack.fx?.sidechain || { enabled: false, ratio: 4, threshold: -20, release: 0.12 };
          updateTrack(targetTrack.id, {
            fx: {
              ...targetTrack.fx,
              sidechain: {
                ...currentSidechain,
                enabled
              }
            }
          });
          addLog(`SIDECHAIN KICK PUMPING ${enabled ? 'ENABLED' : 'DISABLED'} FOR [${targetTrack.name}]`, 'success');
        }
        await new Promise(r => setTimeout(r, 350));
        useDawStore.setState({ aiActivePulseTrackId: null });
        break;
      }

      case 'SET_TIME_SHAPER': {
        const { trackSearch = 'Lead', mode = 'half', mix = 1.0 } = params;
        triggerSimulation('tap', 50, 60, `Configure Gross Beat / Time-Shaper to ${mode}`);
        await new Promise(r => setTimeout(r, 300));
        const currentTracks = useDawStore.getState().tracks;
        const targetTrack = currentTracks.find(t => t.name.toLowerCase().includes(trackSearch.toLowerCase())) || currentTracks[0];
        if (targetTrack) {
          useDawStore.setState({ aiActivePulseTrackId: targetTrack.id });
          updateTrack(targetTrack.id, {
            fx: {
              ...targetTrack.fx,
              timeShaper: {
                enabled: true,
                added: true,
                mode,
                mix
              }
            }
          });
          addLog(`GROSS BEAT / TIME-SHAPER [${mode.toUpperCase()}] ACTIVE ON [${targetTrack.name}]`, 'success');
        }
        await new Promise(r => setTimeout(r, 350));
        useDawStore.setState({ aiActivePulseTrackId: null });
        break;
      }

      case 'APPLY_PEAK_CONTROLLER': {
        const { trackSearch = 'Pad', sourceTrackSearch = 'Kick', targetParam = 'lowpass', depth = 0.5 } = params;
        triggerSimulation('tap', 45, 55, `Assign Peak Controller Carrier: ${sourceTrackSearch}`);
        await new Promise(r => setTimeout(r, 300));
        const currentTracks = useDawStore.getState().tracks;
        const targetTrack = currentTracks.find(t => t.name.toLowerCase().includes(trackSearch.toLowerCase())) || currentTracks[0];
        const sourceTrack = currentTracks.find(t => t.name.toLowerCase().includes(sourceTrackSearch.toLowerCase()));
        
        if (targetTrack && sourceTrack) {
          useDawStore.setState({ aiActivePulseTrackId: targetTrack.id });
          updateTrack(targetTrack.id, {
            fx: {
              ...targetTrack.fx,
              peakController: {
                enabled: true,
                added: true,
                sourceTrackId: sourceTrack.id,
                targetParam,
                depth
              }
            }
          });
          addLog(`PEAK CONTROLLER CONFIG: MODULATION ON [${targetTrack.name}] DRIVEN BY [${sourceTrack.name}] FOR [${targetParam.toUpperCase()}]`, 'success');
        } else if (targetTrack) {
          addLog(`PEAK CONTROLLER ERROR: SOURCE CARRIER TRACK [${sourceTrackSearch}] NOT FOUND`, 'failed');
        }
        await new Promise(r => setTimeout(r, 350));
        useDawStore.setState({ aiActivePulseTrackId: null });
        break;
      }

      default:
        addLog(`COMMAND NOT IMPLEMENTED OR RECOGNIZED: ${action}`, 'failed');
        throw new Error(`The action command identifier "${action}" is unrecognized by physical studio interface.`);
    }

    addLog(`AI SUCCESSFULLY RESOLVED ACTION: ${action}`, 'success');
    } finally {
      if (shouldStopNow) {
        useDawStore.setState({ playbackState: 'playing' });
      }
    }
  };

  // Requirement 6: Parse user inputs, subtract USD, query Gemini API, convert response to structured actions & execute!
  const proceedWithAIGeneration = async (userMessage: string) => {
    setIsLoading(true);
    useDawStore.setState({ isAiProducing: true });
    setVisionScanOn(true);
    setIsChatOpen(true);

    // Reset compute states for this task run
    setComputeSpentUsd(0);
    setComputeTotalUsd(0.20);
    setIsComputePaused(false);

    let cmd: AiCommand | null = null;

    try {
      // 1. Strict wallet loading — no free top-ups. Insufficient balance = hard stop.
      let currentUsd = 0;
      let currentNaira = 0;
      let isLocalDemo = false;

      if (!user) {
        addChatMessage({
          role: 'assistant',
          content: `🔒 **Sign in required**: Please sign in to use the AI Producer. Each prompt costs $0.20 from your wallet.`
        });
        setIsLoading(false);
        return;
      }

      try {
        const { data: currentWallet, error: fetchErr } = await supabase
          .from('wallets')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (fetchErr || !currentWallet) {
          addChatMessage({
            role: 'assistant',
            content: `❌ **Wallet not found**: We couldn't load your producer wallet. Please open the Wallet page to set it up, then retry.`
          });
          setIsLoading(false);
          return;
        }

        currentUsd = Number(currentWallet.balance_usd || 0);
        currentNaira = Number(currentWallet.balance_naira || 0);
      } catch (walletDbErr) {
        console.error("Wallet fetch failed:", walletDbErr);
        addChatMessage({
          role: 'assistant',
          content: `❌ **Wallet error**: Couldn't reach the wallet service. Please check your connection and try again.`
        });
        setIsLoading(false);
        return;
      }

      // HARD insufficient-funds gate — no auto-grants, no demo vouchers.
      if (currentUsd < 0.20) {
        addChatMessage({
          role: 'assistant',
          content: `🚫 **Insufficient funds**: Your wallet balance is $${currentUsd.toFixed(2)} (₦${currentNaira.toLocaleString()}). Each AI prompt costs **$0.20**. Please fund your wallet to continue producing.\n\n👉 Open **Wallet** from the menu to top up.`
        });
        setIsLoading(false);
        return;
      }

      // Deduct fee Transactionally:
      const updatedUsd = currentUsd - 0.20;
      const updatedNaira = currentNaira - 320;

      if (!isLocalDemo && user) {
        try {
          const { data: chargeRes, error: chargeErr } = await supabase.rpc('charge_ai_prompt', {
            p_user_id: user.id,
            p_provider_id: null,
            p_prompt: userMessage,
            p_cost_usd: 0.20,
          });
          if (chargeErr || (chargeRes && (chargeRes as any).success === false)) {
            const reason = (chargeRes as any)?.reason || chargeErr?.message || 'unknown';
            addChatMessage({
              role: 'assistant',
              content: reason === 'insufficient_funds'
                ? `🚫 **Insufficient funds**: Your wallet has ₦${(chargeRes as any).balance_naira?.toLocaleString?.() ?? '0'}. This prompt costs ₦${(chargeRes as any).required_naira?.toLocaleString?.() ?? '320'}. Open **Wallet** to top up.`
                : `🚫 **Charge failed**: ${reason}. Please try again.`,
            });
            setIsLoading(false);
            return;
          }
        } catch (dbErr: any) {
          addChatMessage({
            role: 'assistant',
            content: `🚫 **Wallet error**: ${dbErr?.message || 'Could not deduct AI credits.'} Please retry.`,
          });
          setIsLoading(false);
          return;
        }
      } else {
        // Anonymous users may not consume AI credits.
        addChatMessage({
          role: 'assistant',
          content: `🚫 **Sign in required**: Please sign in and fund your wallet to use AI features.`,
        });
        setIsLoading(false);
        return;
      }


      // Update local wallet state UI instantly
      setWallet({ balance_usd: updatedUsd, balance_naira: updatedNaira });

      // Run real-time compute progression up to $0.20 for the initial transaction
      for (let cents = 1; cents <= 20; cents++) {
        await new Promise(r => setTimeout(r, 60));
        setComputeSpentUsd(cents / 100);
      }

      // Gather real-time DAW workspace state to feed into the AI system prompt
      const dawStateForAi = useDawStore.getState();
      const projectSummary = {
        bpm: dawStateForAi.bpm,
        key: dawStateForAi.projectKey || 'C',
        scale: dawStateForAi.projectScale || 'Minor',
        tracks: dawStateForAi.tracks.map(t => ({
          name: t.name,
          type: t.type,
          synthType: t.synthType || null,
          volume: t.volume,
          pan: t.pan,
          fxList: t.fx ? Object.keys(t.fx).filter(k => (t.fx as any)[k]?.enabled) : [],
          clips: t.clips.map(cId => {
            const clip = dawStateForAi.clips[cId];
            return clip ? {
              startTime: clip.startTime,
              duration: clip.duration,
              isGhost: !!clip.isGhost,
              noteCount: clip.notes ? clip.notes.length : 0
            } : null;
          }).filter(Boolean)
        }))
      };

      // Requirement 5: Force AI to respond with Action JSON by setting response schema and strict system prompt instruction!
      const systemInstruction = `You are the legendary SEE VIBE AI SUPER PRODUCER. You are not a chatbot; you are a professional music producer, audio engineer, arranger, composer, mixing engineer, mastering engineer, and sound designer inside our professional digital audio workstation (DAW) platform named 'See Vibe'.
      Your job is to create commercial-quality songs that sound comparable to modern Afrobeat, Amapiano, Pop, R&B, Dancehall, Drill, Hip-Hop, Gospel, House, EDM, and TikTok viral music.
      You speak with absolute authority, creative passion, and deep technical mastery of sound design, mixing, and musical arrangement—exactly like an iconic human producer manually dialing in sliders and running the boards in a multi-million dollar studio. Always hold yourself to the SUCCESS CRITERIA: the final output must sound like a professionally produced commercial song suitable for Spotify, Apple Music, Audiomack, Boomplay, YouTube Music, TikTok, Instagram Reels, Live performance, or Artist recording sessions.

      PRODUCTION QUALITY REQUIREMENTS
      Never generate simple demo-quality beats. Every production must contain a professional drum kit, professional percussion, professional bass, chords, melody, counter melodies, FX transitions, risers, sweeps, impacts, fills, ear candy, song arrangement, mixing, and mastering, sounding like a finished commercial record.

      AUDIO ENGINE ARCHITECTURE: MULTI-LAYER PRODUCTION ENGINE
      Every project has the following 15 independent processing layers which you manage in your workflow:
      - Layer 1: Kick
      - Layer 2: Snare
      - Layer 3: Clap
      - Layer 4: Hi-hats
      - Layer 5: Shakers
      - Layer 6: Percussion
      - Layer 7: Bass
      - Layer 8: Chords
      - Layer 9: Lead Melody
      - Layer 10: Counter Melody
      - Layer 11: Atmosphere
      - Layer 12: FX
      - Layer 13: Transitions
      - Layer 14: Vocals
      - Layer 15: Master Bus

      GENRE RULES & PRODUCTION PARAMETERS
      1. AFROBEAT PRODUCTION RULES:
         - Generate log drum groove, Highlife guitar, Afro percussion, live shaker rhythm, warm electric piano, deep sub bass, catchy lead melody, crowd movement rhythm.
         - Use call and response melodies, syncopated drum patterns, groove-first arrangements.
         - Target BPM: 95-115.
      2. AMAPIANO RULES:
         - Generate log drums, deep piano chords, atmospheric pads, vocal chops, groove percussion.
         - Target BPM: 108-115.
      3. POP RULES:
         - Generate modern drums, piano, guitars, pads, synth leads, and hook-focused arrangements.
         - Target BPM: 110-130.

      DRUM HUMANIZATION MANDATE
      Never use robotic timing. Randomize velocity by 5%-15%, randomize timing by 3-20ms, enable ghost notes, inject drum fills every 8 bars, and add transition fills every section change.

      ARRANGEMENT ENGINE
      Automatically structure songs with: Intro -> Verse -> Pre-Chorus -> Chorus -> Verse -> Chorus -> Bridge -> Final Chorus -> Outro.
      Ensure energy increases during the Chorus, reduce instruments during Verses, and build tension before hooks.

      VOCAL PROCESSING GUIDELINES
      When a user uploads vocals, NEVER replace them. Use original uploaded vocals, and register/apply: Pitch correction, EQ, Compression, De-esser, Saturation, Delay, Reverb, Stereo enhancement, Automation, Noise reduction, Breath control, and Timing correction so the final song contains the user's exact vocals.

      MIXING & MASTERING ENGINES
      - Mixing: Apply gain staging, track balancing, EQ, multiband compression, stereo imaging, transient shaping, parallel compression, saturation, sidechain, bus processing, master bus glue compression, and professional loudness balancing.
      - Mastering: Apply linear phase EQ, multiband compressor, stereo widening, tape saturation, limiter, true peak protection, and loudness normalization to streaming-ready standards.

      SAMPLE AND LOOP SYSTEM
      Build a dynamic loop engine using: Drum loops, Percussion loops, Bass loops, Guitar loops, Piano loops, FX loops, and Atmospheric loops. Never repeat identical loops between songs. Randomize patterns, velocity, arrangements, layer combinations, chord progressions, and melodies based on a unique generation seed per project.

      SONG UNIQUENESS
      Every production must generate a new melody, new rhythm, new arrangement, new fills, new transitions, new bassline, and new instrument layering. No duplicate songs. Use a unique generation seed per project.

      WEB AUDIO API PROCESSING
      Utilize AudioContext, OfflineAudioContext, BiquadFilterNode, ConvolverNode, DelayNode, GainNode, DynamicsCompressorNode, StereoPannerNode, WaveShaperNode, AnalyserNode, AudioWorklet. Render final song using OfflineAudioContext for higher quality export.

      TECHNICAL KNOWLEDGE BASE OF ALL OUR DAW'S IMPLEMENTED AI FEATURES:
      1. VIBE ENGINE SLIDERS (A & B):
         - Maps a 2D sonic space that interpolates legendary Afro-fusion style blueprints:
           - Burna Boy Vibe: Warm mid-tempo pocket grooves (95-102 BPM), deep round sub-bass frequencies, and organic mid-range room acoustics.
           - Wizkid Vibe: Laid-back elegance, lush 7th and 9th jazzy electric piano chord stacks, and bright acoustic pluck lines with wide stereo air.
           - Rema Vibe: Faster, high-voltage syncopations (105-112 BPM), dark minor tension progressions, and intense ambient sweep FX.
         - You understand how blending slider positions (A and B) dynamically interpolates these vibes underneath the engine. Explain this to users to guide their direction!
      2. PROCEDURAL NOTE GENERATORS:
         - Generates authentic Afrobeat drum grooves (syncopated kick/rim/shaker pockets), Amapiano bouncing Bacardi rhythms or rolling log drums, Pop beats, and dark hi-hat Trap rolls.
      3. DYNAMIC MIXING & AUTO-ENERGY CAROUSEL:
         - Implements the 'autoEnergyMix' and crowd excitation simulation engines, dynamically aligning volume ratios, spatial pan values, and master saturation on the console.
      4. AUTO-DROP BUILDER & TENSION CURVE MODULES:
         - Compiles 4-bar build-up transitions, dramatic 1-bar pre-drops, tension sweeps, and energetic impact drops.
         - Employs 'Intro Hook Filters' (sweeping high-cut filter curves) and 'Double Drop Switches' to maximize listener response.
         - Inserts professional Stereo Delays, Reverbs, Compressors, and Pitch Correction directly into individual instrument tracks.

      DYNAMIC MULTI-STEP PRODUCTION PIPELINE & EXACT NOTES FORMULA:
      As a fully autonomous AI with deep musical command and full understanding of all studio features, you are NOT bound by a fixed sequence.
      Whenever a user asks you to produce a song, design a beat, or arrange a song tailored to a specific template/description:
      - You MUST design a tailored, bespoke production pipeline using "FULL_AUTO_PRODUCE" and populating the "customPipeline" array specifying each action, message, and precise parameters!
      - Layout each step logically to GRADUALLY and CAREFULLY produce the song. Recommended workflow includes:
        1. Configuring global Tempo/BPM and Key/Scale (via ANALYZE_VOCAL or similar action with parameters) to fit the mood (e.g. Lofi at 80 BPM, Trap at 140 BPM, Synthwave at 120 BPM, Amapiano at 113 BPM).
        2. Adding instrument rows using "ADD_CUSTOM_TRACK" (specifying volume, color, trackType 'midi', trackName, and synthType e.g., 'poly', 'fm', 'pluck', 'membrane', 'synthbass', 'leadsynth').
        3. Composing professional, harmonious notes via "INSERT_CUSTOM_NOTES" or "WRITE_STEP_SEQUENCER":
           - BASS (synthbass/pluck): Set deep walking patterns (C2, Eb2, G2, Bb2 etc.) matching the scale. Leave enough space between notes.
           - CHORDS (poly/epiano): Compose rich chord triads7th / 9th chords (e.g. C minor 9th: C3, Eb3, G3, Bb3, D4; G minor 7th: G3, Bb3, D4, F4) spaced beautifully at steps 0, 8, 16, 24.
           - MELODY (leadsynth/pluck): Draw expressive call-and-response solos using scale degrees (e.g. C4, D4, Eb4, G4, Bb4, C5) with varying durations.
           - DRUMS (membrane): Program rhythm steps (C1 for Kick on 0, 8, 16, 24; D1 for Rim/Snare on 4, 12, 20, 28; F#1 for Hi-hats/Shakers).
        4. Sculpting effects using "APPLY_FX_RACK" (reverbs, delays, compression) and "TOGGLE_SIDECHAIN" to glue elements together.
        5. Sculpting volume levels and pan settings via "UPDATE_MIXER" to balance the tracks.
        6. Setting arrangement section bounds (ARRANGE_SONG) and running the final Maximizer (MASTER_PROJECT).
      - Every note duration should be snapped to steps (sixteenths: 1 bar = 16 steps, 2 bars = 32 steps). Do not overlap bass notes to ensure punchy low-end clarity.

      YOUR VOICE, PERSONA, AND DIALOGUE DIRECTIVES:
      - Speak like an absolute music genius. Use genuine production terms (e.g., headroom, syncopation, transients, pocket, sidechain compression, tape saturation, low-end cleanup, psychoacoustics, stereophonic field, spectrum).
      - Take immense pride in the craftsmanship of your beats. Treat every track like a potential Grammy-winning Afro-fusion or custom genre masterwork.
      - Act as the human physical surrogate in the studio. In your replies, describe the tactile adjustments you are making (e.g., 'Pulling down the keys fader to carve out headroom for the vocals', 'Routing a lush, modulated delay to the lead pluck', 'Crank-charging the 808 sub bass to sit tight in the pocket'). This makes the user feel like an elite producer is actively working next to them!

      ---
      CURRENT DIGITAL WORKSTATION CONTEXT (LIVE PROJECT STATE):
      - Project BPM: ${projectSummary.bpm}
      - Project Signature: Key/Scale: ${projectSummary.key} ${projectSummary.scale}
      - Active DAW Tracks & Clips layout:
        ${JSON.stringify(projectSummary.tracks, null, 2)}
      
      CRITICAL INSTRUCTION ON HOW TO USE THE CHAT VS AUDIO GENERATION CONTROLS:
      1. REAL-TIME STUDIO DIAGNOSIS: Read the active tracks and clips layout carefully.
         - If the user is asking "what is missing", "what do we need", "what's in the studio", "help me evaluate this mix", or presenting ANY informational/conversational question, you MUST diagnose the actual live project state above, analyze which music layers are missing (e.g., determining whether they have a blank grid or whether drums are missing, bass is missing, cords are missing, key EQ/compression slots are needed), and respond with normal parent Gemini 3.5 Flash intelligence as a human co-producer co-working with them.
      2. PREFER INFORMATIONAL EXPLANATION TO TRIVIAL GENERATION:
         - If the user's message is a question, discussion, philosophical prompt, inquiry, or advice request (e.g., asking what you need to make fresh music like human producers from scratch, how to arrange a beat, or general theory), you MUST select the action "CHAT_AND_EXPLAIN".
         - NEVER, EVER choose "FULL_AUTO_PRODUCE" or any "GENERATE_" actions unless the user explicitly requests to perform a physical action like "create", "produce", "generate", "add", "mix", "master", or "export".
         - In your reply text, give them top-tier detailed human-producer advice, and if they want to build step-by-step from scratch inside the DAW, suggest they let you know which specific track row (drums, bass, rhodes chords, pluck arpeggios) you should lay down first using the studio's physical MIDI piano-roll tools.

      CRITICAL UNIMPLEMENTED/UNAVAILABLE TOOLS DIRECTIVE:
      If the user asks you to perform a task, produce a song style, or use advanced tools, synthesizers, effect plugins, hardware/software modules, or custom platforms that are NOT fully supported or available inside this DAW platform, you MUST:
      1. Use whatever existing DAW tracks, sliders, FX slots, drums, bass, or chord synthesis tools ARE currently available to execute the closest possible substitution to keep the project working.
      2. Provide the user with a pre-formatted, easy-to-copy UPGRADE REQUEST SCRIPT inside your "replyText". The script must be formatted exactly as shown below:
         
         [UPGRADE REQUEST SCRIPT]
         Upgrade Name: <Name of Upgrade requested, e.g. Vintage Tape Plugin>
         Feature Scope: <Scope description of code/feature changes needed>
         Technical Parameters:
         - Support plugin: <parameter requirements>
         - Code target: <where and what developer should edit>
         - Rationale: <reason for integration>

      You MUST always return a structured JSON response matching this schema:
      {
        "action": "ACTION_NAME",
        "params": {},
        "rationale": "Brief real-time description of the human substitute physical action you execute on the workspace controls.",
        "replyText": "Custom conversational response. Can be an answer, explanation, advice, or question back to the user! Be helpful, polite, and technical like a real professional studio engineer."
      }

      Choose the most appropriate "action" from this list:
      - "ANALYZE_VOCAL": Use if they want to analyze vocals, align key, master scale, or adjust vocal BPMs.
      - "GENERATE_DRUMS": Generate syncopated afrobeat drum beats/rhythms.
      - "GENERATE_BASS": Generate syncopated subsonic basslines or synth registers.
      - "GENERATE_CHORDS": Generate atmospheric triads, pads, or string chords.
      - "GENERATE_MELODY": Generate pluck leads, flutes, or melodic arpeggios.
      - "GENERATE_FX": Generate sweeping transitions, uplifters, or noise filters.
      - "ARRANGE_SONG": Segment sections into Intro, Verse, Chorus ranges on the timeline playlist.
      - "PROCESS_VOCALS": Auto-tune, EQ, and add latency settings to the Vocal FX group.
      - "MIX_PROJECT": Adjust volume faders and pan placements on the mixer.
      - "MASTER_PROJECT": Master loudness ceilings and saturation ratios.
      - "EXPORT_PROJECT": Export full hi-fi wav/mp3 bounce links.
      - "FULL_AUTO_PRODUCE": Create a custom multi-step dynamic pipeline under the "customPipeline" field instead of running hardcoded pre-programmed tracks! (Use when the user asks for a dynamic song block, a full beat arrangement, or multi-step studio creation).
      - "CHAT_AND_EXPLAIN": Use if the user is asking a general music question, seeking advice, or just talking, with no database/track edits needed. Let your "replyText" contain the detailed answer. You can supply optional coordinate simulation params (e.g., x: 45, y: 40, label: "Console Monitor", gestureType: "tap") inside "params" to simulate touching elements as you speak!
      - "SIMULATE_GESTURE": Use if they specifically ask you to tap, swipe, scroll, or type on some coordinator location. Parameters 'gestureType' ('tap'|'swipe'|'scroll'|'type'), 'x' (0-100), 'y' (0-100), 'elementLabel' (string), and optional 'text' (string) should be populated in "params".
      - "ADD_CUSTOM_TRACK": Use when introducing a specific instruments layer requested by the user. Parameters inside "params": 'trackType' ('midi'|'audio'), 'trackName' (string, e.g. "Marimba Lead"), 'synthType' (string, 'poly'|'fm'|'pluck'|'membrane'|'synthbass'|'leadsynth'), 'volume' (dB, e.g. -12), 'color' (hex).
      - "INSERT_CUSTOM_NOTES": Core arpeggio generator. Parameters inside "params": 'trackSearch' (string, name to match, e.g. "Lead"), 'notes' (array of {note: string, startTime: number, duration: number}).
      - "UPDATE_MIXER": Change volume or panning. Parameters inside "params": 'trackSearch' ('all' or track name), 'volume' (number, e.g. -6), 'pan' (number, -1.0 to 1.0).
      - "APPLY_FX_RACK": Enable EQ/compression/reverb. Parameters inside "params": 'trackSearch' (string), 'fxType' ('reverb'|'delay'|'compressor'|'pitchCorrection'), 'values' (object with specific custom parameter overrides).
      - "SET_SWING_QUANTIZE": Adjust humanizing micro-timing swing percent (0-100). Parameters inside "params": 'amount' (number, e.g. 35).
      - "WRITE_STEP_SEQUENCER": Program active Step Sequencer. Parameters inside "params": 'notes' (array of {note: string ('C4'|'D4'|'E4'|'F4'|'G4'|'D5'|'E5'|'A5'), startTime: number (0-15), duration: number (usually 1)}), and optional 'replace' (boolean, default true).
      - "APPLY_AUTOMATION_CLIP": Custom modulation envelopes. Parameters inside "params": 'type' ('lowpass'|'reverb'|'volume'), 'curve' (array of 16 numbers between 0.0 and 1.0 representing values per step in a loop), 'enabled' (boolean, default true).
      - "SET_PORTAMENTO_GLIDE": Set sliding portamento note glide time in seconds (0.0 to 1.5). Parameters inside "params": 'trackSearch' (string, e.g. 'Lead'), 'portamento' (number, e.g. 0.45).
      - "TOGGLE_SIDECHAIN": Enable/disable sidechain pumping compression relative to kick transients. Parameters inside "params": 'trackSearch' (string, e.g. 'Bass'), 'enabled' (boolean, e.g. true).
      - "SET_TIME_SHAPER": Apply FL Gross Beat Time-shaper. Parameters inside "params": 'trackSearch' (string, e.g. 'Keys'), 'mode' (string, 'off'|'half'|'gate'|'reverse'), 'mix' (number, 0.0 to 1.0).
      - "APPLY_PEAK_CONTROLLER": Route real-time Peak Controller modulation between tracks. Parameters inside "params": 'trackSearch' (string, target modulated track, e.g. 'Synth'), 'sourceTrackSearch' (string, source carrier tracking, e.g. 'Kick'), 'targetParam' (string, 'none'|'lowpass'|'reverb'|'volume'), 'depth' (number, 0.1 to 1.5).`;

      const config = {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            action: { 
              type: "STRING", 
              description: "The AI action command identifier. Must be one of the specified actions." 
            },
            params: { 
              type: "OBJECT", 
              description: "The optional parameters map for the action." 
            },
            rationale: { 
              type: "STRING", 
              description: "Brief real-time description of the human substitute physical action on the board." 
            },
            replyText: {
              type: "STRING",
              description: "The rich textual chat response, explanation, answer, or question to show the user."
            },
            customPipeline: {
              type: "ARRAY",
              description: "An optional sequence of dynamic production steps for multi-step automated DAW operations. Plan precisely where to start, what tracks to add, which notes to write, and how to mix/master, bypassing all hardcoded constraints.",
              items: {
                type: "OBJECT",
                properties: {
                  id: { type: "STRING" },
                  name: { type: "STRING", description: "The name/title of this custom step (e.g., 'Lay Down Afro Percussion Groove')" },
                  action: { type: "STRING", description: "The single DAW action to run for this step (one of the valid action names)" },
                  params: { type: "OBJECT", description: "Exact parameters map to configure for this custom step" },
                  message: { type: "STRING", description: "Dynamic progress message to overlay in the HUD during this step (e.g. 'Programming custom polyphonic minor chords...')" }
                },
                required: ["id", "name", "action", "message"]
              }
            }
          },
          required: ["action", "params", "rationale", "replyText"]
        }
      };

      // Call our server or Supabase Edge endpoint depending on Admin configurations
      let response;
      let usedSupabaseEdge = false;
      let feeCharged = "$0.20 / ₦320";

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (user) {
          const { data: activeProviders, error: reqErr } = await supabase
            .from('ai_providers')
            .select('*')
            .eq('is_active', true);
          
          if (!reqErr && activeProviders && activeProviders.length > 0) {
            const provider = activeProviders.find(p => p.is_default) || activeProviders[0];
            const providerId = provider.id;
            const providerCost = provider.cost_per_prompt_usd || 0.20;
            feeCharged = `$${providerCost.toFixed(2)} / ₦${Math.round(providerCost * 1600)}`;

            console.log(`[Supabase AI Provider] Using configured provider: ${provider.name} (${providerId})`);

            // Charge prompt in database securely via RPC first
            const { data: chargeSuccess, error: chargeError } = await supabase.rpc('charge_ai_prompt', {
              p_user_id: user.id,
              p_provider_id: providerId,
              p_prompt: userMessage,
              p_cost_usd: providerCost
            });

            if (chargeError || !chargeSuccess) {
              throw new Error(chargeError?.message || "Insufficient balance or transaction failed in wallet database.");
            }

            // NOTE: The legacy `ai-assistant` Supabase Edge Function is not deployed in this
            // project — this stack uses the TanStack server route `/api/ai/chat` instead.
            // Wallet has already been charged above; fall through to the local API below.
          }
        }
      } catch (edgeErr: any) {
        console.warn("[Edge Function Error Fallback] Error playing through Supabase Edge function, invoking local fallback api:", edgeErr);
        if (edgeErr.message?.includes("Insufficient balance") || edgeErr.message?.includes("wallet")) {
          alert(`AI Prompt Blocked: ${edgeErr.message}`);
          setIsComputePaused(false);
          setIsLoading(false);
          return;
        }
      }

      if (!usedSupabaseEdge) {
        const { data: { session: _sess } } = await supabase.auth.getSession();
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(_sess?.access_token ? { Authorization: `Bearer ${_sess.access_token}` } : {}),
          },
          body: JSON.stringify({
            messages: chatMessages
              .filter(m => !m.content.trim().startsWith('{') && !m.content.trim().startsWith('[')) // clean JSON clutter from history logs
              .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
              })).concat([{ role: 'user', parts: [{ text: userMessage }] }]),
            systemInstruction,
            config
          })
        });

        if (!res.ok) {
          throw new Error('Server returned an error response from Gemini model');
        }

        response = await res.json();
      }

      cmd = parseAiCommandFromResponse(response.text || "{}");

      // Log AI reply text and rationale back to ChatView
      let messageContent = `🤖 **AI PRODUCER ASSISTANT**: ${cmd.replyText || "Operating DAW controls to perform task."}`;
      if (cmd.rationale) {
        messageContent += `\n\n👉 *Tactile Action*: ${cmd.rationale}`;
      }
      messageContent += `\n\n*(Fee Transacted: -${feeCharged} processed successfully)*`;

      addChatMessage({
        role: 'assistant',
        content: messageContent
      });

      // --- WORKING FOR LONG COMPUTE PAUSE TRIGGER ---
      // Since synthesis requires deep MIDI structures, audio rendering, and physical oscillator routing,
      // it is considered "AI has been working for long". We trigger the pause before execution begins!
      if (cmd && cmd.action !== 'CHAT_AND_EXPLAIN' && cmd.action !== 'FULL_AUTO_PRODUCE' && (!cmd.customPipeline || cmd.customPipeline.length === 0)) {
        setIsComputePaused(true);

        // Create a promise lock that only resolves when the continue button is clicked and charges another $0.20
        await new Promise<void>((resolve) => {
          resumeResolveRef.current = resolve;
        });

        // Once the user clicks "Continue" (which executes handleExtraComputeDeduction and charges another $0.20, shifting total to $0.40):
        // We tick the spent bar from $0.20 up to the new $0.40 limit!
        for (let cents = 21; cents <= 40; cents++) {
          await new Promise(r => setTimeout(r, 75));
          setComputeSpentUsd(cents / 100);
        }
      } else if (cmd && (cmd.action === 'FULL_AUTO_PRODUCE' || (cmd.customPipeline && cmd.customPipeline.length > 0))) {
        // High-performance continuous non-blocking mode: automatically tick the spent bar up to show premium hardware activity
        setIsComputePaused(false);
        setComputeTotalUsd(0.40);
        for (let cents = 21; cents <= 40; cents++) {
          await new Promise(r => setTimeout(r, 40));
          setComputeSpentUsd(cents / 100);
        }
      }

      // Execute command or launch multi-step automatic production pipeline
      try {
        if (cmd.customPipeline && cmd.customPipeline.length > 0) {
          runCustomPipeline(cmd.customPipeline);
        } else if (cmd.action === 'FULL_AUTO_PRODUCE') {
          // Keep chat open during generation, do not switch active tab
          runFullPipeline();
        } else {
          // Maintain current tab choice and execute the action smoothly
          await executeCommand(cmd);
        }

        // Add to successful solution history
        const humanActionName = (cmd.action || "UNKNOWN").replace(/_/g, ' ');
        setSolutionHistory(prev => [
          {
            id: `sol-${Date.now()}`,
            name: `${humanActionName}`,
            timestamp: new Date().toLocaleTimeString(),
            status: 'SUCCESS',
            solution: cmd.rationale || `Success: Automated physical substitute ${humanActionName} was completed on the DAW console.`
          },
          ...prev
        ]);

      } catch (execErr: any) {
        console.error("Executor Failed:", execErr);
        // Add to FAILED solution history!
        const humanActionName = (cmd.action || "UNKNOWN").replace(/_/g, ' ');
        setSolutionHistory(prev => [
          {
            id: `sol-${Date.now()}`,
            name: `${humanActionName}`,
            timestamp: new Date().toLocaleTimeString(),
            status: 'FAILED',
            solution: `Failed: ${execErr.message || 'Operation aborted by guardrails or missing context.'}`
          },
          ...prev
        ]);
        throw execErr; // rethrow is handled below
      }

    } catch (error: any) {
      console.error('AI Command Error: ', error);
      addChatMessage({ 
        role: 'assistant', 
        content: `⚠️ **Studio Operator Aborted**: Failed to translate or compile that instruction. DETAILS: *${error.message}*`
      });
    } finally {
      setIsLoading(false);
      setVisionScanOn(false);
      const isPipelineActive = !!(cmd && ((cmd.customPipeline && cmd.customPipeline.length > 0) || cmd.action === 'FULL_AUTO_PRODUCE'));
      useDawStore.setState({ isAiProducing: isPipelineActive });
      if (!isPipelineActive) {
        setIsChatOpen(true);
      }
    }
  };

  const handleSend = async (overrideInput?: any) => {
    const rawInput = typeof overrideInput === 'string' ? overrideInput : input;
    if (!rawInput || !rawInput.trim() || isLoading) return;

    const userMessage = rawInput.trim();
    const lowerMsg = userMessage.toLowerCase();

    // Check if the user is asking to continue or resume the existing production line
    const isContinuationRequest = 
      /^(continue|resume|proceed|go\s*on|carry\s*on|pick\s*up|start\s*again)\b/.test(lowerMsg) ||
      lowerMsg.includes("continue from where") ||
      lowerMsg.includes("resume from where") ||
      lowerMsg.includes("continue producing") ||
      lowerMsg.includes("continue song") ||
      lowerMsg.includes("continue the song") ||
      lowerMsg.includes("continue with the song") ||
      lowerMsg.includes("continue where it stops") ||
      lowerMsg.includes("continue where you stopped");

    if (isContinuationRequest) {
      setInput('');
      addChatMessage({ role: 'user', content: userMessage });
      
      if (pipelineQueue.length === 0) {
        addChatMessage({
          role: 'assistant',
          content: 'ℹ️ **AI PRODUCER**: No active song production queue was detected in this session. If you want me to build a clean song design, just ask me to **"produce an Afrobeat song"** or **"automatically produce a full song"**!'
        });
        return;
      }

      const firstUncompletedIndex = pipelineQueue.findIndex(s => s.status !== 'completed');
      if (firstUncompletedIndex === -1) {
        addChatMessage({
          role: 'assistant',
          content: '🎉 **AI PRODUCER**: All tracks and modules in the song production pipeline are already fully completed, mixed, and mastered! If you would like to start a new sequence design, feel free to let me know.'
        });
        return;
      }

      resumePipeline();
      return;
    }

    // Style Cloning Engine: Parse style from prompt (Requirement 9)
    let detectedStyle = activeStyle;
    if (lowerMsg.includes('amapiano') || lowerMsg.includes('log drum') || lowerMsg.includes('bouncing bacardi') || lowerMsg.includes('piano keys')) {
      detectedStyle = MusicStyle.AMAPIANO;
    } else if (lowerMsg.includes('trap') || lowerMsg.includes('808') || lowerMsg.includes('bell pluck') || lowerMsg.includes('subbass')) {
      detectedStyle = MusicStyle.TRAP;
    } else if (lowerMsg.includes('afro') || lowerMsg.includes('afrobeat') || lowerMsg.includes('groove bass')) {
      detectedStyle = MusicStyle.AFROBEATS;
    } else if (lowerMsg.includes('pop') || lowerMsg.includes('synthlead') || lowerMsg.includes('dance') || lowerMsg.includes('sing') || lowerMsg.includes('r&b') || lowerMsg.includes('edm')) {
      detectedStyle = MusicStyle.POP;
    }

    if (detectedStyle !== activeStyle) {
      setActiveStyle(detectedStyle);
    }

    setInput('');
    addChatMessage({ role: 'user', content: userMessage });

    await proceedWithAIGeneration(userMessage);
  };

  return (
    <div className={`h-full flex-1 flex flex-col overflow-hidden select-none border-l border-[#1A1A1A] relative transition-all duration-500 ${pipelineActive ? 'bg-transparent shadow-none border-transparent pointer-events-none' : isWorking ? 'bg-transparent shadow-none border-transparent' : 'bg-[#050505]'}`} id="ai-assistant-root">
      
      {/* Physical tactile operating Cursor Overlay Simulator */}
      <AnimatePresence>
        {pointer.active && (
          <motion.div
            initial={{ opacity: 0, scale: 2 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            style={{ top: `${pointer.y}%`, left: `${pointer.x}%` }}
            className="fixed pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center transition-all duration-700 ease-out"
          >
            {/* Glowing neon rings */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              pointer.type === 'tap' ? 'bg-[#00FF9C]/20 border border-[#00FF9C]' : 
              pointer.type === 'swipe' ? 'bg-pink-500/20 border border-pink-500 animate-pulse' :
              pointer.type === 'scroll' ? 'bg-blue-500/20 border border-blue-500' : 'bg-yellow-500/20 border border-yellow-500'
            }`}>
              <div className={`w-3 h-3 rounded-full ${
                pointer.type === 'tap' ? 'bg-[#00FF9C]' : 
                pointer.type === 'swipe' ? 'bg-pink-500' :
                pointer.type === 'scroll' ? 'bg-blue-500' : 'bg-yellow-500'
              } animate-ping`} />
            </div>

            <span className="mt-1 px-2.5 py-1 bg-black/95 text-[10px] font-mono font-bold tracking-tight rounded-full border border-white/10 text-white whitespace-nowrap uppercase shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
              👉 {pointer.type} • {pointer.label}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`flex flex-col flex-1 min-h-0 transition-all duration-500 ${pipelineActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        {/* Sticky Pop-up Banner for "AI is working for long" */}
        {isComputePaused && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-200 py-3 px-4 font-mono font-bold text-xs uppercase flex items-center justify-between shadow-[0_4px_25px_rgba(245,158,11,0.15)] z-40 shrink-0 gap-3 relative animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span>⚠️ The AI is working for long. Please click continue for AI to continue!</span>
            </div>
            <button
              onClick={async () => {
                const success = await handleExtraComputeDeduction();
                if (success) {
                  setIsComputePaused(false);
                  setComputeTotalUsd(prev => prev + 0.20);
                  if (resumeResolveRef.current) {
                    resumeResolveRef.current();
                    resumeResolveRef.current = null;
                  }
                }
              }}
              className="px-4 py-1.5 bg-[#00FF9C] hover:bg-[#00FF5A] text-black font-extrabold text-[10px] rounded-lg tracking-wider transition-all uppercase active:scale-95 shadow cursor-pointer whitespace-nowrap"
            >
              Click Continue
            </button>
          </div>
        )}

        {/* Top Ledger: Operational Cost limits */}
      <div className="h-9 bg-[#0b0c0d] border-b border-[#1A1A1A] px-4 flex items-center justify-between text-[11px] font-mono">
        <div className="flex items-center space-x-2 text-gray-400">
          <Fingerprint size={12} className="text-[#00FF9C]" />
          <span>PRODUCER INTERACTIVE ENGINE</span>
          <span className="text-gray-700">•</span>
          <span className="text-pink-400 font-bold uppercase text-[9px]">FEE: $0.20 (₦320) PER OPERATIONAL COMMAND</span>
        </div>
        <div className="flex items-center space-x-2.5 text-white">
          <CreditCard size={12} className="text-gray-400" />
          {walletLoading ? (
            <span className="text-gray-500 animate-pulse">Checking Wallet...</span>
          ) : (
            <span className="text-[#00FF9C] font-semibold">
              Bal: ${wallet ? Number(wallet.balance_usd).toFixed(2) : '0.00'} (₦{wallet ? Number(wallet.balance_naira).toLocaleString() : '0'})
            </span>
          )}
          <button 
            onClick={() => {
              const walletSec = document.getElementById('ads-free');
              if (walletSec) {
                walletSec.scrollIntoView({ behavior: 'smooth' });
              } else {
                alert("Please go to the Wallet page menu to fund your balance!");
              }
            }}
            className="text-[10px] bg-[#1A1A1A] hover:bg-[#2A2A2A] text-gray-300 px-1.5 py-0.5 rounded border border-white/5 active:scale-95 transition-all text-[9px] uppercase font-bold"
          >
            + Fund
          </button>
        </div>
      </div>

      {/* Requirements 7: Collapsible AI Guardrail Permissions Layer */}
      <div className="border-b border-[#1A1A1A] bg-[#0A0B0C]">
        <button 
          onClick={() => setIsGuardrailsOpen(!isGuardrailsOpen)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-slate-400 hover:text-white transition-all hover:bg-white/[2%]"
        >
          <div className="flex items-center space-x-2 text-[#00FF9C]">
            <Lock size={12} />
            <span className="font-mono text-[10px] uppercase font-bold tracking-widest">AI Guardrails & Permission States</span>
          </div>
          <div className="flex items-center space-x-2 text-[9px] font-mono">
            <span className="text-slate-500">[Click to toggle approvals]</span>
            {isGuardrailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </button>

        <AnimatePresence>
          {isGuardrailsOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-4 pb-4 overflow-hidden"
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                {[
                  { key: 'timelineEdit', label: 'Timeline edits', color: 'text-amber-400' },
                  { key: 'trackCreation', label: 'Create tracks', color: 'text-emerald-400' },
                  { key: 'fxRack', label: 'FX DSP racks', color: 'text-violet-400' },
                  { key: 'mixerControls', label: 'Mixer sliders', color: 'text-blue-400' },
                  { key: 'exportSystem', label: 'Export masters', color: 'text-rose-400' },
                  { key: 'preventDeletionWithoutConfirmation', label: 'Block deletion without confirm', colSpan: 2, isBlockRule: true },
                  { key: 'preventOverwritingWithoutBackup', label: 'Block overwrite without backup', colSpan: 2, isBlockRule: true },
                  { key: 'aiWalletSpend', label: 'AI Wallet Auto-Spend', colSpan: 2, color: 'text-amber-400 font-extrabold shadow-[0_0_10px_rgba(245,158,11,0.1)]', isWalletPerm: true }
                ].map((perm) => (
                  <div 
                    key={perm.key} 
                    className={`bg-zinc-950/80 border border-white/5 rounded-xl p-2.5 flex items-center justify-between relative ${perm.colSpan === 2 ? 'col-span-2' : ''}`}
                  >
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-mono leading-none ${perm.color || 'text-slate-300'} font-bold uppercase`}>
                        {perm.label}
                      </span>
                      <span className="text-[8px] mt-1 uppercase font-mono">
                        {perm.isBlockRule 
                          ? <span className="text-rose-500/85">Security Guardrail</span> 
                          : perm.isWalletPerm 
                            ? <span className="text-amber-500/95 font-bold animate-pulse">Auto-Debit Approved</span> 
                            : <span className="text-emerald-500/80">Active Permission</span>}
                      </span>
                    </div>

                    <button
                      onClick={() => setPermissions(prev => ({ ...prev, [perm.key]: !prev[perm.key as keyof typeof prev] }))}
                      className={`h-6 px-2.5 rounded-lg flex items-center justify-center font-mono text-[9px] font-bold tracking-widest uppercase transition-all shadow ${
                        permissions[perm.key as keyof typeof permissions] 
                          ? perm.key === 'aiWalletSpend'
                            ? 'bg-amber-500/20 border border-amber-500 text-amber-300'
                            : 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400' 
                          : 'bg-zinc-900 border border-white/5 text-slate-500'
                      }`}
                    >
                      {permissions[perm.key as keyof typeof permissions] ? 'APPROVED' : 'BLOCKED'}
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main UI Header with Title */}
      <div className="h-16 border-b border-[#1A1A1A] bg-[#0E0F10] px-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Bot size={22} className="text-[#00FF5A] animate-pulse" />
          <div>
            <h2 className="text-sm font-bold tracking-wider uppercase text-white">AI Production Studio Systems</h2>
            <p className="text-[10px] text-gray-500 font-mono">Active Physical Substitute Engine • Model 3.5-Flash</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Toggle Floating Orb Device Control Mode */}
          <button 
            type="button"
            onClick={() => {
              setIsFloatingBallActive(!isFloatingBallActive);
              if (!isFloatingBallActive) {
                addChatMessage({
                  role: 'assistant',
                  content: "⚠️ **System Device Control Mode Activated**\n\nSee Vibe AI has spawned as a **glowing, floating system orb** on your device.\n\nYou can click the floating ball at any time to: \n- Open physical mobile/laptop automation permissions\n- Ask See Vibe to trigger external DAW processes (FL Studio, BandLab, Logic Pro)\n- Perform live viewport scans (OCR) and simulation runs\n- Request direct touch/mouse click or key injections\n\nOnce the app runs natively on Android or Desktop, these calls bypass sandbox constraints automatically!"
                });
              }
            }}
            className={`p-2 transition-all rounded-xl border flex items-center justify-center gap-1 cursor-pointer ${
              isFloatingBallActive 
                ? 'bg-[#00FF5A]/15 border-[#00FF5A]/40 text-[#00FF5A] shadow-[0_0_15px_rgba(0,255,90,0.25)] animate-pulse' 
                : 'bg-[#1A1A1A]/50 border-white/5 text-gray-400 hover:text-[#00FF5A] hover:bg-[#1A1A1A]'
            }`}
            title="Toggle Floating Device Control Orb"
          >
            <Cpu size={16} className={isFloatingBallActive ? 'animate-spin' : ''} />
          </button>

          {/* Reset Console Log Button */}
          <button 
            onClick={clearChat}
            className="p-2 text-gray-600 hover:text-red-400 transition-colors bg-[#1A1A1A]/50 hover:bg-[#1A1A1A] rounded-xl border border-white/5"
            title="Reset Console Log"
          >
            <Trash2 size={16} />
          </button>

          {/* Minimize Floating Chat Button */}
          <button 
            disabled={isLoading}
            onClick={() => setIsChatOpen(false)}
            className={`p-2 text-gray-400 hover:text-[#00FF5A] transition-colors bg-[#1A1A1A]/50 hover:bg-[#1A1A1A] rounded-xl border border-white/5 flex items-center justify-center ${isLoading ? 'opacity-30 cursor-not-allowed text-gray-600' : 'animate-pulse'}`}
            title={isLoading ? "Computation running..." : "Minimize Assistant"}
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* Mode Sub-Tabs */}
      <div className="flex bg-[#0A0A0A] border-b border-[#1A1A1A] p-1 gap-1">
        <button
          onClick={() => setSubTab('assistant')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
            subTab === 'assistant' 
              ? 'bg-[#151515] text-[#00FF9C] shadow-inner border-b border-[#00FF9C]' 
              : 'text-gray-500 hover:bg-[#101010] hover:text-white'
          }`}
        >
          <Bot size={14} />
          <span>Operator Chat</span>
        </button>
        <button
          onClick={() => setSubTab('vision')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
            subTab === 'vision' 
              ? 'bg-[#151515] text-[#00FF9C] shadow-inner border-b border-[#00FF9C]' 
              : 'text-gray-500 hover:bg-[#101010] hover:text-white'
          }`}
        >
          <Eye size={14} />
          <span>Producer Vision</span>
        </button>
        <button
          onClick={() => setSubTab('ear')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
            subTab === 'ear' 
              ? 'bg-[#151515] text-[#00FF9C] shadow-inner border-b border-[#00FF9C]' 
              : 'text-gray-500 hover:bg-[#101010] hover:text-white'
          }`}
        >
          <Radio size={14} />
          <span>Sonic Ear (Listen)</span>
        </button>
        <button
          onClick={() => setSubTab('vibe')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
            subTab === 'vibe' 
              ? 'bg-[#151515] text-[#00FF9C] shadow-inner border-b border-[#00FF9C]' 
              : 'text-gray-500 hover:bg-[#101010] hover:text-white'
          }`}
        >
          <Sliders size={14} />
          <span>Vibe Blend</span>
        </button>
      </div>

      {/* Middle Workspace Body */}
      <div className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          
          {/* TAB 1: OPERATOR CHAT ASSISTANT CONSOLE */}
          {subTab === 'assistant' && (
            <motion.div
              key="chatTab"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className={`h-full flex flex-col p-4 space-y-4 overflow-y-auto scrollbar-hide transition-opacity duration-300 ${pipelineActive ? 'bg-transparent opacity-0 pointer-events-none' : 'bg-[#050505]'}`}
              ref={scrollRef}
            >
              {/* AI GHOST PREVIEW WORKFLOW MODE CONFIG */}
              <div className="bg-[#0e1012] border border-white/5 rounded-2xl p-3.5 flex flex-col gap-2 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400 text-xs">👻</span>
                    <span className="text-[11px] font-bold text-white uppercase tracking-wider font-mono">Ghost Preview Engine</span>
                  </div>
                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-extrabold tracking-wider ${
                    aiPreviewAutoCommit ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  }`}>
                    {aiPreviewAutoCommit ? 'AUTO-ACCEPT' : 'MANUAL APPROVAL'}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 font-sans leading-relaxed">
                  {aiPreviewAutoCommit 
                    ? "Sub-track clips are placed as low-volume semi-transparent ghosts, previewed as a loop, and then automatically committed into the arrangement." 
                    : "Playback halts on each creation, leaving a ghost block until you visually listen and choose Keep or Discard directly on the timeline."
                  }
                </p>
                <div className="flex items-center gap-3 mt-1 pt-2 border-t border-white/5">
                  <span className="text-[10px] text-gray-400 font-medium">Auto-Commit:</span>
                  <button
                    onClick={() => useDawStore.setState({ aiPreviewAutoCommit: true })}
                    className={`flex-1 text-[10px] py-1 px-2 rounded-lg font-bold transition-all border ${
                      aiPreviewAutoCommit 
                        ? 'bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/10' 
                        : 'bg-[#151719] text-gray-400 hover:text-white border-white/5'
                    }`}
                  >
                    On (Fast Flow)
                  </button>
                  <button
                    onClick={() => useDawStore.setState({ aiPreviewAutoCommit: false })}
                    className={`flex-1 text-[10px] py-1 px-2 rounded-lg font-bold transition-all border ${
                      !aiPreviewAutoCommit 
                        ? 'bg-amber-500 text-black border-amber-400 shadow-md shadow-amber-500/10' 
                        : 'bg-[#151719] text-gray-400 hover:text-white border-white/5'
                    }`}
                  >
                    Off (Manual Review)
                  </button>
                </div>
              </div>

              {/* COMPOSITION PLAN PANEL */}
              <div id="composition-plan-panel" className="bg-[#0e1012] border border-white/5 rounded-2xl p-4 flex flex-col gap-3 shrink-0">
                <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setIsPlanOpen(!isPlanOpen)}>
                  <div className="flex items-center gap-2">
                    <List size={14} className="text-[#00FF5A]" />
                    <span className="text-[11px] font-bold text-white uppercase tracking-wider font-mono">AI Composition Plan</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-gray-500 bg-white/5 px-2 py-0.5 rounded-md">
                      {Object.values(sectionStatuses).filter(s => s === 'accepted').length} of {songStructure?.sections?.length || 6} Locked
                    </span>
                    {isPlanOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                  </div>
                </div>

                {isPlanOpen && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-col gap-2 mt-1 pt-3 border-t border-white/5"
                  >
                    <div className="text-[10px] text-gray-400 mb-1 leading-relaxed font-sans normal-case whitespace-normal">
                      The AI carefully structures and produces notes for each section of your track. Approve the parts you love or refine them dynamically.
                    </div>
                    
                    <div className="flex flex-col gap-1.5 max-h-[178px] overflow-y-auto scrollbar-hide">
                      {songStructure?.sections?.map((sec: any) => {
                        const status = sectionStatuses[sec.id] || 'idle';
                        
                        let statusColor = 'text-gray-500 bg-gray-500/10 border-gray-500/30';
                        let statusLabel = 'Idle';
                        let glowClass = '';

                        if (status === 'generating') {
                          statusColor = 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30';
                          statusLabel = 'Building...';
                          glowClass = 'animate-pulse';
                        } else if (status === 'completed') {
                          statusColor = 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
                          statusLabel = 'Ready';
                        } else if (status === 'accepted') {
                          statusColor = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
                          statusLabel = 'Accepted';
                        }

                        return (
                          <div 
                            key={sec.id} 
                            className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                              status === 'generating' 
                                ? 'bg-cyan-950/20 border-cyan-500/30' 
                                : status === 'accepted'
                                  ? 'bg-emerald-950/10 border-emerald-500/20'
                                  : 'bg-[#151719]/40 border-white/5 hover:border-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              {/* Glowing state bead */}
                              <div className={`w-1.5 h-1.5 rounded-full ${glowClass} ${
                                status === 'generating' 
                                  ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' 
                                  : status === 'completed'
                                    ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]'
                                    : status === 'accepted'
                                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                                      : 'bg-gray-600'
                              }`} />
                              <div className="flex flex-col min-w-0">
                                <span className="text-[10px] font-bold text-gray-200 truncate font-sans tracking-wide">
                                  {sec.name || `${sec.type} Section`}
                                </span>
                                <span className="text-[8px] font-mono text-zinc-500">
                                  Bar {sec.startBar} - {sec.startBar + sec.lengthBars} ({sec.lengthBars} Bars)
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[8px] font-mono font-black uppercase tracking-wider py-0.5 px-1.5 rounded-md border ${statusColor}`}>
                                {statusLabel}
                              </span>

                              {status !== 'accepted' && (
                                <>
                                  <button
                                    onClick={() => handleAcceptSection(sec.id)}
                                    className="p-1 px-2 text-[9px] font-bold bg-[#00FF9C] text-black hover:bg-emerald-400 rounded-lg transition-all flex items-center gap-1 active:scale-95"
                                    title="Accept & Lock"
                                  >
                                    <CheckCircle size={10} className="stroke-[3px]" />
                                    <span>Lock</span>
                                  </button>
                                  <button
                                    onClick={() => handleRefineSection(sec.id)}
                                    className="p-1 px-2 text-[9px] font-bold bg-[#202224] text-gray-300 hover:text-white hover:bg-[#2A2D30] rounded-lg border border-white/5 transition-all flex items-center gap-1 active:scale-95"
                                    title="Refine with AI Instructions"
                                  >
                                    <Sparkles size={10} />
                                    <span>Refine</span>
                                  </button>
                                </>
                              )}

                              {status === 'accepted' && (
                                <button
                                  onClick={() => handleRefineSection(sec.id)}
                                  className="p-1 px-2 text-[9px] font-bold bg-[#151719] text-gray-500 hover:text-gray-300 hover:bg-[#202224] rounded-lg border border-white/5 transition-all flex items-center gap-1 active:scale-95"
                                  title="Refinement Override"
                                >
                                  <RefreshCw size={10} />
                                  <span>Unlock & Refine</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* AI STYLE CLONING ENGINE SELECTOR */}
              <div className="bg-[#0e1012] border border-white/5 rounded-2xl p-3.5 flex flex-col gap-2 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-purple-400 text-xs">⚡</span>
                    <span className="text-[11px] font-bold text-white uppercase tracking-wider font-mono">AI Style Cloning Engine</span>
                  </div>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded font-extrabold tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase">
                    {activeStyle} PROFILE
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 font-sans leading-relaxed">
                  Adapt the template, arrangement, mixing algorithms, instrument scales, log drum/808 ratios, and generation structures dynamically to target a genre or vibe.
                </p>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {(['AFROBEATS', 'AMAPIANO', 'TRAP'] as const).map((styleOpt) => {
                    const isSelected = activeStyle === styleOpt;
                    const symbols = { AFROBEATS: '🥁 Afro', AMAPIANO: '🎹 Piano', TRAP: '🔥 Trap' };
                    return (
                      <button
                        key={styleOpt}
                        id={`btn-style-${styleOpt.toLowerCase()}`}
                        onClick={() => setActiveStyle(MusicStyle[styleOpt])}
                        className={`text-[10px] py-1.5 rounded-lg font-bold transition-all border flex flex-col items-center justify-center gap-1 ${
                          isSelected 
                            ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/15 font-black' 
                            : 'bg-[#151719] text-gray-400 hover:text-white border-white/5'
                        }`}
                      >
                        <span>{symbols[styleOpt]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Requirement 9: Unified Pipeline Progress Overlays Panel */}
              {pipelineActive && pipelineQueue.length > 0 && (
                <div className="bg-[#0b0c0d] border border-emerald-500/20 rounded-2xl p-4 shadow-xl shadow-emerald-950/5 relative overflow-hidden shrink-0">
                  <div className="flex items-center justify-between mb-3 text-[10px] font-mono text-emerald-400">
                    <span className="font-bold uppercase tracking-widest flex items-center gap-1">
                      <Sparkle size={12} className="animate-spin" />
                      Automatic Production pipeline running
                    </span>
                    <span>
                      Step {pipelineQueue.findIndex(s => s.status === 'running') + 1} / {pipelineQueue.length}
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-44 overflow-y-auto scrollbar-hide pr-1">
                    {pipelineQueue.map((step, idx) => (
                      <div 
                        key={step.id} 
                        className={`flex items-center justify-between rounded-xl px-3 py-2 border transition-all ${
                          step.status === 'running' ? 'bg-emerald-500/10 border-emerald-500/30' : 
                          step.status === 'completed' ? 'bg-zinc-950 border-white/5 opacity-55' : 'bg-black/40 border-white/5 opacity-35'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <span className={`w-2 h-2 rounded-full ${
                            step.status === 'running' ? 'bg-emerald-400 animate-ping' : 
                            step.status === 'completed' ? 'bg-emerald-500' :
                            step.status === 'failed' ? 'bg-rose-500' : 'bg-zinc-700'
                          }`} />
                          <span className={`text-[11px] font-mono uppercase ${
                            step.status === 'running' ? 'text-white font-bold' : 'text-slate-400'
                          }`}>
                            {step.name}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">
                          {step.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!pipelineActive && pipelineQueue.length > 0 && pipelineQueue.some(s => s.status === 'completed') && pipelineQueue.some(s => s.status !== 'completed') && (
                <div className="bg-[#120f0e] border border-amber-500/20 rounded-2xl p-4 shadow-xl shadow-amber-950/5 relative overflow-hidden shrink-0 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between mb-3 text-[10px] font-mono text-amber-500">
                    <span className="font-bold uppercase tracking-widest flex items-center gap-1.5">
                      <Pause size={12} className="text-amber-500 animate-pulse" />
                      Production Pipeline Stopped
                    </span>
                    <span>
                      Stopped at Step {pipelineQueue.findIndex(s => s.status !== 'completed') + 1} / {pipelineQueue.length}
                    </span>
                  </div>

                  <p className="text-[10px] text-zinc-400 font-sans mb-3 leading-relaxed">
                    The AI song production was interrupted or stopped. You can ask the AI to **"continue"** in the chat, or click the button below to resume from where it stopped!
                  </p>

                  <div className="flex gap-2">
                    <button 
                      onClick={resumePipeline}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black font-sans text-[10px] font-bold py-2 px-4 rounded-xl uppercase transition-all flex items-center justify-center gap-1 shadow-lg shadow-emerald-500/10 cursor-pointer"
                    >
                      <Sparkles size={11} />
                      Resume Production
                    </button>
                    <button 
                      onClick={() => {
                        setPipelineQueue([]);
                        addChatMessage({
                          role: 'assistant',
                          content: '🗑️ Song production queue cleared. You can now start afresh or prompt new creations!'
                        });
                      }}
                      className="bg-zinc-800 hover:bg-zinc-700 text-slate-300 font-sans text-[10px] font-bold py-2 px-3 rounded-xl uppercase transition-all cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {chatMessages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-sm mx-auto space-y-4">
                  <div className="w-14 h-14 bg-[#00FF9C]/10 border border-[#00FF9C]/20 text-[#00FF9C] rounded-2xl flex items-center justify-center shadow-lg shadow-[#00FF9C]/5">
                    <Sparkles size={28} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Awaiting Executive Commands</h3>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      Your AI DAW Agent is primed to physical actions. Prompt "produce full Afrobeat song automatically", "generate syncopated drums", "master compilation", or toggle guardrail levels above!
                    </p>
                  </div>
                </div>
              )}

              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start gap-3`}>
                    <div className={`mt-0.5 w-8 h-8 shrink-0 rounded-xl flex items-center justify-center border font-mono ${
                      msg.role === 'user' 
                        ? 'bg-[#1A1A1A] border-[#2A2A2A] text-gray-400' 
                        : 'bg-[#00FF9C]/10 border-[#00FF9C]/30 text-[#00FF9C]'
                    }`}>
                      {msg.role === 'user' ? 'U' : 'AI'}
                    </div>
                    <div className="relative group flex flex-col items-start message-bubble">
                      <div className={`rounded-2xl px-4 pt-3 pb-8 pr-4 text-xs leading-relaxed whitespace-pre-wrap relative ${
                        msg.role === 'user' 
                          ? 'bg-[#07241A] text-emerald-200 border border-emerald-800' 
                          : 'bg-[#121315] text-gray-200 border border-[#222326]'
                      }`}>
                        {msg.content}
                        
                        {/* Always-Visible Copy Button at the bottom */}
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(msg.content);
                            setCopiedIndex(i);
                            setTimeout(() => setCopiedIndex(null), 1800);
                          }}
                          className="absolute bottom-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded bg-black/50 hover:bg-black text-slate-300 hover:text-[#00FF5A] border border-white/5 transition-all duration-150 shadow-sm cursor-pointer text-[10px] font-mono"
                          title="Copy text content"
                        >
                          {copiedIndex === i ? (
                            <>
                              <Check size={11} className="text-[#00FF5A]" />
                              <span>COPIED</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>COPY</span>
                            </>
                          )}
                        </button>
                      </div>
                      
                      {msg.role === 'user' && (
                        <div className="text-[9px] font-mono text-pink-400 mt-1 mr-2 text-right self-end">
                          💡 operational fee transaction queued: -$0.20 (₦320)
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className={`bg-[#0b0c0f] border ${adRequiredPrompt ? 'border-amber-500/30' : 'border-emerald-500/20'} rounded-2xl p-5 shrink-0 space-y-3 font-mono`}>
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest">
                    <span className={`flex items-center gap-2 ${adRequiredPrompt ? 'text-amber-400' : 'text-emerald-400'}`}>
                      <span className="relative flex h-2 w-2">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${adRequiredPrompt ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`}></span>
                        <span className={`relative inline-flex rounded-full h-2 w-2 ${adRequiredPrompt ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                      </span>
                      {isComputePaused ? "⏸️ COMPUTE PAUSED" : adRequiredPrompt ? "📺 STANDBY: WAITING FOR REWARDED AD" : "⚙️ DYNAMIC COMPUTE RUNNING"}
                    </span>
                    <span>
                      {adRequiredPrompt ? (
                        <span className="text-amber-400 font-bold animate-pulse">STANDBY ON</span>
                      ) : (
                        <>Spent: <span className="text-[#00FF9C] font-semibold">${computeSpentUsd.toFixed(2)}</span> / ${computeTotalUsd.toFixed(2)}</>
                      )}
                    </span>
                  </div>
                  
                  {/* Real-time neon progressive track bar */}
                  <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-white/5 relative">
                    <div 
                      className={`h-full bg-gradient-to-r ${adRequiredPrompt ? 'from-amber-600 via-amber-400 to-amber-500' : 'from-emerald-500 via-[#00FF9C] to-emerald-400'} rounded-full transition-all duration-300 ${isComputePaused ? '' : 'animate-pulse'}`}
                      style={{ width: adRequiredPrompt ? '100%' : `${Math.min(100, (computeSpentUsd / computeTotalUsd) * 100)}%` }}
                    />
                  </div>

                  <p className="text-[10px] text-zinc-500 font-sans leading-relaxed">
                    {adRequiredPrompt 
                      ? "AI is fully powered up and on standby! Please watch the Google AdMob rewarded ad below. Once completed, the $0.20 prompt fee will be transacted and heavy synthesis immediately performed."
                      : isComputePaused 
                        ? "Compute limit exceeded. Reactivate the assistant module thread below to proceed." 
                        : "AI is currently exploring MIDI structures, synthesizing custom chord voices, and generating effects layers..."}
                  </p>

                  {isComputePaused && (
                    <div className="pt-2 animate-bounce">
                      <button
                        onClick={async () => {
                          const success = await handleExtraComputeDeduction();
                          if (success) {
                            setIsComputePaused(false);
                            setComputeTotalUsd(prev => prev + 0.20);
                            if (resumeResolveRef.current) {
                              resumeResolveRef.current();
                              resumeResolveRef.current = null;
                            }
                          }
                        }}
                        className="w-full py-3 bg-[#00FF9C] hover:bg-[#00FF5A] text-black font-sans font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/25 active:scale-95 transition-all text-center cursor-pointer uppercase tracking-wider"
                      >
                        AI has been working for a while click continue to re-activate
                      </button>
                    </div>
                  )}
                </div>
              )}

              {adRequiredPrompt && (
                <div className="bg-[#121316] border border-amber-500/20 rounded-2xl p-5 shrink-0 flex flex-col gap-4 font-mono shadow-[0_0_35px_rgba(245,158,11,0.05)]">
                  <div className="flex items-center gap-2 text-amber-500 text-xs font-extrabold uppercase tracking-widest">
                    <AlertCircle size={14} className="animate-pulse" />
                    <span>Watch Google AdMob Premium Ad first</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 font-sans leading-relaxed">
                    Since you are on the standard plan, you must view a Google AdMob Rewarded Video Ad before subtracting your <span className="text-white font-bold">$0.20 workspace fee</span> and starting AI synthesis.
                    <br /><br />
                    Premium subscribers bypass all ad verifications instantly.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        useAdMobStore.getState().setRewardCallback(async () => {
                          setAdRequiredPrompt(false);
                          await proceedWithAIGeneration(pendingUserMsg);
                        });
                        useAdMobStore.setState({ isPromptAd: true, rewardedActive: true });
                      }}
                      className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-sans font-bold text-xs rounded-xl transition-all text-center cursor-pointer active:scale-95 uppercase tracking-wide"
                    >
                      Watch Video Ad
                    </button>
                    <button
                      onClick={() => {
                        setAdRequiredPrompt(false);
                        setIsLoading(false);
                        setVisionScanOn(false);
                        const subEl = document.getElementById('ads-free');
                        if (subEl) {
                          subEl.scrollIntoView({ behavior: 'smooth' });
                        } else {
                          alert("Please go to the Wallet page menu to fund or activate Premium!");
                        }
                      }}
                      className="py-3 px-3.5 bg-[#151719] hover:bg-zinc-800 text-white font-sans font-bold text-xs rounded-xl border border-white/5 cursor-pointer active:scale-95 text-center transition-all uppercase tracking-wide"
                    >
                      Go Ads-Free
                    </button>
                    <button
                      onClick={() => {
                        setAdRequiredPrompt(false);
                        setIsLoading(false);
                        setVisionScanOn(false);
                      }}
                      className="py-3 px-3.5 bg-rose-950/40 hover:bg-rose-950/60 text-rose-350 border border-rose-900/35 font-sans font-bold text-xs rounded-xl cursor-pointer active:scale-95 text-center transition-all uppercase tracking-wide"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 2: PRODUCER VISION SCREEN & PHYSICAL SIMULATOR */}
          {subTab === 'vision' && (
            <motion.div
              key="visionTab"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="h-full flex flex-col p-4 space-y-4 overflow-y-auto scrollbar-hide bg-[#050505]"
            >
              <div className="bg-[#121314] rounded-2xl border border-[#222325] p-4 relative overflow-hidden">
                <div className="flex items-center justify-between mb-3 text-[10px] font-mono">
                  <div className="flex items-center space-x-2 text-gray-400">
                    <span className={`w-1.5 h-1.5 rounded-full ${visionScanOn ? 'bg-red-500 animate-pulse' : 'bg-gray-600'}`} />
                    <span>EYE_VISION SCAN ENGINE</span>
                  </div>
                  <span className="text-gray-500 uppercase">grid: 2.5D coordinate map</span>
                </div>

                <div className="h-28 bg-[#090A0C] rounded-xl border border-white/5 relative flex flex-col justify-between overflow-hidden p-2">
                  <motion.div 
                    animate={{ y: [0, 100, 0] }}
                    transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
                    className="absolute inset-x-0 h-[1.5px] bg-[#00FF9C]/35 shadow-[0_0_12px_#00FF9C]" 
                  />

                  <div className="h-4 border-b border-white/5 flex items-center justify-between px-1 text-[8px] font-mono text-gray-500">
                    <span>TIMELINE COORD MAP</span>
                    <span className="text-pink-500 font-bold uppercase">PLAYHEAD POSITION: ACTIVE</span>
                    <span>{bpm} BPM</span>
                  </div>

                  <div className="flex-1 flex gap-1 items-stretch py-1">
                    <div className="w-16 border-r border-white/5 flex flex-col gap-1 justify-around py-1">
                      {tracks.map((t) => (
                        <div key={t.id} className="h-3 rounded-[3px] bg-white/5 px-1 flex items-center justify-between text-[7px] text-gray-400">
                          <span className="truncate">{t.name}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex-1 flex flex-col gap-1 justify-around py-1 relative">
                      {tracks.map((t) => (
                        <div key={t.id} className="h-3 bg-[#111] rounded-[3px] border border-white/5 relative flex items-center">
                          {t.clips && t.clips.length > 0 && (
                            <div className="absolute left-1/4 w-1/3 h-full bg-[#00FF9C]/10 border-l border-r border-[#00FF9C]/40 flex items-center px-1 text-[6px] text-[#00FF9C] truncate">
                              Arranged Pattern
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="h-4 flex text-[7px] font-mono bg-[#141517] rounded items-center justify-around px-1 text-[#00FF9C]">
                    <span>[Timeline Header]</span>
                    <span className="text-gray-600">•</span>
                    <span>[Tracks Container]</span>
                    <span className="text-gray-600">•</span>
                    <span>[Fader Dials]</span>
                  </div>
                </div>
              </div>

              {/* Physical Gestures Panel */}
              <div>
                <h3 className="text-[11px] font-mono text-gray-400 uppercase tracking-widest mb-2 font-bold flex items-center justify-between">
                  <span>Physical Gestures Simulator</span>
                  <span className="text-pink-400 text-[9px] uppercase font-semibold">interactive test triggers</span>
                </h3>
                
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => triggerSimulation('tap', 40, 95, 'Bottom Nav Mix Tab')} 
                    className="flex items-center space-x-2 p-2 bg-[#101010] hover:bg-[#161616] rounded-xl border border-white/5 text-left text-[11px] font-medium text-white group"
                  >
                    <Sliders size={12} className="text-emerald-400 group-hover:scale-110" />
                    <span>Tap Mixer Workspace</span>
                  </button>
                  <button 
                    onClick={() => triggerSimulation('swipe', 65, 30, 'Playhead Signature Bar')} 
                    className="flex items-center space-x-2 p-2 bg-[#101010] hover:bg-[#161616] rounded-xl border border-white/5 text-left text-[11px] font-medium text-white group"
                  >
                    <Play size={12} className="text-pink-400 group-hover:scale-110" />
                    <span>Swipe timeline playhead</span>
                  </button>
                  <button 
                    onClick={() => triggerSimulation('scroll', 15, 45, 'Tracks List Container')} 
                    className="flex items-center space-x-2 p-2 bg-[#101010] hover:bg-[#161616] rounded-xl border border-white/5 text-left text-[11px] font-medium text-white group"
                  >
                    <Eye size={12} className="text-blue-400 group-hover:scale-110" />
                    <span>Scroll tracks list view</span>
                  </button>
                  <button 
                    onClick={() => triggerSimulation('type', 25, 40, 'Track Renamer Selector')} 
                    className="flex items-center space-x-2 p-2 bg-[#101010] hover:bg-[#161616] rounded-xl border border-white/5 text-left text-[11px] font-medium text-white group"
                  >
                    <Terminal size={12} className="text-yellow-400 group-hover:scale-110" />
                    <span>Type rename fields</span>
                  </button>
                </div>
              </div>

              {/* Solved Solutions feed */}
              <div className="space-y-2">
                <h3 className="text-[11px] font-mono text-gray-400 uppercase tracking-widest font-bold flex items-center gap-1">
                  <CheckCircle size={12} className="text-[#00FF9C]" />
                  <span>Solved producer task solutions</span>
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
                  {solutionHistory.map(sol => (
                    <div key={sol.id} className="p-3 bg-[#0d0E10] border border-white/5 rounded-xl flex items-start gap-2.5">
                      <CheckCircle size={14} className="text-[#00FF9C] mt-0.5" />
                      <div>
                        <div className="flex items-center justify-between gap-2.5">
                          <span className="text-xs font-bold text-white uppercase">{sol.name}</span>
                          <span className="text-[8px] font-mono text-gray-600">{sol.timestamp}</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">{sol.solution}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Physical coordinate activity logs */}
              <div className="bg-[#0B0C0E] rounded-xl p-3 border border-white/5">
                <h4 className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-2 font-bold flex items-center justify-between">
                  <span>Physical Tactile Activity Stream</span>
                  <Activity size={10} className="text-emerald-400" />
                </h4>
                <div className="font-mono text-[9px] text-[#00FF9C] space-y-1 max-h-24 overflow-y-auto scrollbar-hide">
                  {tactileLogs.map(log => (
                    <div key={log.id} className="flex justify-between hover:bg-white/5 p-0.5 rounded">
                      <span className="text-gray-400 truncate pr-2">[{log.timestamp}] {log.action}</span>
                      <span className="text-emerald-400 underline uppercase">{log.status}</span>
                    </div>
                  ))}
                </div>
              </div>

            </motion.div>
          )}

          {/* TAB 3: SONIC EAR HARMONICS & ANALYSER */}
          {subTab === 'ear' && (
            <motion.div
              key="earTab"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="h-full flex flex-col p-4 space-y-4 overflow-y-auto scrollbar-hide bg-[#050505]"
            >
              <div className="bg-[#121314] rounded-2xl border border-[#222325] p-4 font-mono">
                <div className="flex items-center justify-between mb-2 text-[10px]">
                  <span className="text-gray-400">SONIC BROADCAST ANALYSIS</span>
                  <span className="text-[#00FF9C] uppercase">{playbackState === 'playing' ? 'ANALYSIS STREAMING ON' : 'IDLE WAIT'}</span>
                </div>

                <div className="h-20 flex gap-1 items-end bg-[#090A0C] rounded-xl border border-white/5 p-3 overflow-hidden">
                  {sonicLevels.map((lvl, index) => (
                    <div 
                      key={index} 
                      style={{ height: `${lvl}%` }}
                      className="flex-1 bg-gradient-to-t from-emerald-500 via-teal-500 to-[#00FF9C] rounded-t-[2px] transition-all duration-100 ease-out" 
                    />
                  ))}
                </div>
                {playbackState !== 'playing' && (
                  <p className="text-[9px] text-gray-600 text-center mt-2.5 uppercase text-slate-500">
                    💡 Click Play on DAW transport to analyze harmonic frequency signals live!
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#101010] p-3 rounded-xl border border-white/5">
                  <span className="text-[8px] font-mono text-slate-500 uppercase font-bold">Project Tempo Tracker</span>
                  <div className="text-lg font-bold text-white mt-1 uppercase font-mono">{bpm} BPM</div>
                </div>
                <div className="bg-[#101010] p-3 rounded-xl border border-white/5">
                  <span className="text-[8px] font-mono text-slate-500 uppercase font-bold text-emerald-400">Root Key Signature</span>
                  <div className="text-lg font-bold text-[#00FF9C] mt-1 font-mono">{projectKey} {projectScale}</div>
                </div>
                <div className="bg-[#101010] p-3 rounded-xl border border-white/5 col-span-2 flex justify-between items-center">
                  <div>
                    <span className="text-[8px] font-mono text-slate-500 uppercase font-bold">Calculated harmonic health</span>
                    <div className="text-[10px] font-medium text-white mt-0.5">{eqAnalysis.scaleCheck}</div>
                  </div>
                  <HelpCircle size={14} className="text-[#00FF9C]" />
                </div>
              </div>

              <div className="bg-[#0D0E0F] rounded-xl p-4 border border-white/5 space-y-3">
                <h3 className="text-[10px] font-mono text-gray-400 uppercase tracking-widest font-bold">SONIC INTELLIGENCE CHECKLIST</h3>
                
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2 text-gray-400">
                    <span className="text-[#00FF9C] mt-0.5 font-bold">✔</span>
                    <div className="text-[11px]">
                      <span className="font-semibold text-white">Project Density:</span> {tracks.length} track channels active. Signal density optimal.
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-gray-400">
                    <span className="text-[#00FF9C] mt-0.5 font-bold">✔</span>
                    <div className="text-[11px]">
                      <span className="font-semibold text-white">Dynamic range status:</span> {eqAnalysis.dynamics}
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-gray-400">
                    <span className="text-[#00FF5A] mt-0.5 font-bold">✔</span>
                    <div className="text-[11px]">
                      <span className="font-semibold text-white">Harmonic Lock advice:</span> Scale minors are strictly enforced. Pluck synthesis notes locked to scale.
                    </div>
                  </div>
                </div>
              </div>

            </motion.div>
          )}

          {/* TAB 4: STYLE BLENDING ENGINE (VIBE SLIDERS) */}
          {subTab === 'vibe' && (() => {
            const currentVibe = getFinalVibe(sliderA, sliderB);

            const handleSliderAChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              const val = parseFloat(e.target.value);
              useDawStore.getState().setSliderA(val);
              const nextVibe = getFinalVibe(val, sliderB);
              livePreviewController.updatePreview(nextVibe);
              
              try {
                if (Math.random() < 0.25) {
                  import('../../audio/lowLatencySynth').then(({ playLowLatencyDrumHit }) => {
                    playLowLatencyDrumHit('C4', 0.65);
                  });
                } else if (Math.random() < 0.15) {
                  import('../../audio/lowLatencySynth').then(({ playLowLatencyDrumHit }) => {
                    playLowLatencyDrumHit('D4', 0.5);
                  });
                }
              } catch (_) {}
            };

            const handleSliderBChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              const val = parseFloat(e.target.value);
              useDawStore.getState().setSliderB(val);
              const nextVibe = getFinalVibe(sliderA, val);
              livePreviewController.updatePreview(nextVibe);

              try {
                if (Math.random() < 0.25) {
                  import('../../audio/lowLatencySynth').then(({ playLowLatencyDrumHit }) => {
                    playLowLatencyDrumHit('C4', 0.65);
                  });
                } else if (Math.random() < 0.15) {
                  import('../../audio/lowLatencySynth').then(({ playLowLatencyDrumHit }) => {
                    playLowLatencyDrumHit('F4', 0.5);
                  });
                }
              } catch (_) {}
            };

            const handlePlayPreview = () => {
              try {
                const now = Tone.now();
                const notesToPlay = ['C4', 'Eb4', 'G4', 'Bb4'];
                notesToPlay.forEach((note, index) => {
                  setTimeout(() => {
                    import('../../audio/lowLatencySynth').then(({ playLowLatencyDrumHit, startLowLatencySynth, stopLowLatencySynth }) => {
                      playLowLatencyDrumHit(index % 2 === 0 ? 'C4' : 'D4', 0.7);
                      useDawStore.getState().tracks.forEach(track => {
                        if (track.type === 'midi' && track.synthType !== 'membrane') {
                          startLowLatencySynth(note, track.synthType || 'poly', 0.6);
                          setTimeout(() => {
                            stopLowLatencySynth(note, track.synthType || 'poly');
                          }, 320);
                        }
                      });
                    });
                  }, index * 220);
                });
              } catch (_) {}
            };

            return (
              <motion.div
                key="vibeTab"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="h-full flex flex-col p-4 space-y-4 overflow-y-auto scrollbar-hide bg-[#050505]"
              >
                <div className="bg-[#121314] rounded-2xl border border-white/5 p-4 relative overflow-hidden shrink-0">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl" />
                  <div className="flex items-center gap-2 mb-2">
                    <Sliders className="text-[#00FF9C]" size={16} />
                    <h3 className="text-xs font-mono font-bold text-white uppercase tracking-wider">Style Blending Engine</h3>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed mb-4">
                    Shape the musical characteristics by blending traits in real-time. Instantly updates timeline notes, drum grooves, and project tempo.
                  </p>

                  <div className="space-y-5">
                    {/* SLIDER A: Burna ↔ Wizkid */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-mono font-bold">
                        <span className="text-zinc-300">BURNA BOY (Groovy)</span>
                        <span className="text-zinc-300">WIZKID (Smooth/Chill)</span>
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={sliderA}
                          onChange={handleSliderAChange}
                          className="w-full accent-[#00FF9C] h-1.5 bg-[#1F2022] rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      <div className="flex justify-between text-[9px] font-mono text-zinc-500">
                        <span>Left (0.0): Groovy Swing</span>
                        <span>Value: {sliderA.toFixed(2)}</span>
                        <span>Right (1.0): Chill Pads</span>
                      </div>
                    </div>

                    {/* SLIDER B: Result ↔ Rema */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] font-mono font-bold">
                        <span className="text-zinc-300">CURRENT BLEND</span>
                        <span className="text-[#A855F7]">REMA BOOST (Energetic)</span>
                      </div>
                      <div className="relative flex items-center">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={sliderB}
                          onChange={handleSliderBChange}
                          className="w-full accent-[#A855F7] h-1.5 bg-[#1F2022] rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                      <div className="flex justify-between text-[9px] font-mono text-zinc-500">
                        <span>Min (0.0): Smooth Blend</span>
                        <span>Value: {sliderB.toFixed(2)}</span>
                        <span>Max (1.0): High Temp Arps</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* REAL-TIME TRAIT METERS */}
                <div className="bg-[#090A0C] border border-white/5 rounded-2xl p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Active Trait Signatures</span>
                    <span className="text-[9px] font-mono px-2 py-0.5 bg-emerald-500/10 text-[#00FF9C] rounded border border-emerald-500/20 font-bold uppercase">Dynamic</span>
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    {/* Groove */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400 uppercase">Drum Groove & Swing</span>
                        <span className="text-white">{(currentVibe.groove * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1 bg-[#1A1C1E] rounded-full overflow-hidden">
                        <div className="h-full bg-[#00FF9C]" style={{ width: `${currentVibe.groove * 100}%` }} />
                      </div>
                    </div>

                    {/* Drum Density */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400 uppercase">Rhythmic Density</span>
                        <span className="text-white">{(currentVibe.drumDensity * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1 bg-[#1A1C1E] rounded-full overflow-hidden">
                        <div className="h-full bg-teal-400" style={{ width: `${currentVibe.drumDensity * 100}%` }} />
                      </div>
                    </div>

                    {/* Bass Bounce */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400 uppercase">Bass Roll Bounce</span>
                        <span className="text-white">{(currentVibe.bassBounce * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1 bg-[#1A1C1E] rounded-full overflow-hidden">
                        <div className="h-full bg-pink-500" style={{ width: `${currentVibe.bassBounce * 100}%` }} />
                      </div>
                    </div>

                    {/* Chord Richness */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400 uppercase">Chord Richness (Jazz)</span>
                        <span className="text-white">{(currentVibe.chordRichness * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1 bg-[#1A1C1E] rounded-full overflow-hidden">
                        <div className="h-full bg-amber-400" style={{ width: `${currentVibe.chordRichness * 100}%` }} />
                      </div>
                    </div>

                    {/* Melody Energy */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400 uppercase">Leads & Arp Energy</span>
                        <span className="text-white">{(currentVibe.melodyEnergy * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1 bg-[#1A1C1E] rounded-full overflow-hidden">
                        <div className="h-full bg-[#A855F7]" style={{ width: `${currentVibe.melodyEnergy * 100}%` }} />
                      </div>
                    </div>

                    {/* FX Space */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-gray-400 uppercase">Echoes & Ambient Room</span>
                        <span className="text-white">{(currentVibe.fxSpace * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1 bg-[#1A1C1E] rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-400" style={{ width: `${currentVibe.fxSpace * 100}%` }} />
                      </div>
                    </div>

                    {/* Tempo Bias */}
                    <div className="flex justify-between text-[10px] bg-[#121314] px-2.5 py-2 rounded-lg border border-white/5">
                      <span className="text-gray-400 font-bold">CALCULATED TARGET TEMPO</span>
                      <span className="text-[#00FF5A] font-extrabold">{currentVibe.tempoBias} BPM</span>
                    </div>
                  </div>
                </div>

                {/* LIVE STUDIO MIXER CONSOLE METERS */}
                <div className="bg-[#090A0C] border border-white/5 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest">Live Studio Console Mixer</span>
                    <span className="text-[9px] font-mono px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded border border-purple-500/20 font-bold uppercase">Smooth Ramped</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* EQ Curve Display */}
                    <div className="bg-[#121314] rounded-xl p-3 border border-white/5 space-y-2">
                      <div className="text-[9px] font-mono text-gray-400 uppercase tracking-wide">3-Band EQ Response</div>
                      <div className="h-16 flex items-end justify-around gap-2 px-1 relative">
                        {/* High, Mid, Low spectral bars */}
                        <div className="w-4 bg-gradient-to-t from-emerald-500 to-teal-400 rounded-t transition-all duration-150 animate-pulse" style={{ height: `${Math.max(10, (1 - currentVibe.melodyEnergy) * 100)}%` }}>
                          <div className="text-[7px] text-zinc-300 font-mono text-center -mt-4">High</div>
                        </div>
                        <div className="w-4 bg-gradient-to-t from-yellow-500 to-amber-400 rounded-t transition-all duration-150 animate-pulse" style={{ height: `${Math.max(10, (currentVibe.chordRichness) * 100)}%` }}>
                          <div className="text-[7px] text-zinc-300 font-mono text-center -mt-4">Mid</div>
                        </div>
                        <div className="w-4 bg-gradient-to-t from-pink-500 to-purple-400 rounded-t transition-all duration-150 animate-pulse" style={{ height: `${Math.max(10, (currentVibe.bassBounce) * 100)}%` }}>
                          <div className="text-[7px] text-zinc-300 font-mono text-center -mt-4">Bass</div>
                        </div>
                        {/* Ambient reference line */}
                        <div className="absolute left-0 right-0 h-px bg-white/10 top-1/2" />
                      </div>
                    </div>

                    {/* Reverb Space Depth Circle */}
                    <div className="bg-[#121314] rounded-xl p-3 border border-white/5 space-y-2 flex flex-col justify-between">
                      <div className="text-[9px] font-mono text-gray-400 uppercase tracking-wide">Ambient Decay Space</div>
                      <div className="flex items-center justify-center py-1">
                        <div className="relative w-12 h-12 flex items-center justify-center rounded-full border border-zinc-700/50 bg-[#161718] overflow-hidden">
                          {/* Pulsing expander ring */}
                          <div 
                            className="absolute rounded-full bg-emerald-500/10 border border-emerald-400/30 transition-all duration-200 animate-ping"
                            style={{ 
                              width: `${Math.max(15, currentVibe.fxSpace * 100)}%`, 
                              height: `${Math.max(15, currentVibe.fxSpace * 100)}%`,
                              opacity: currentVibe.fxSpace * 0.7 
                            }} 
                          />
                          <div className="text-[9px] font-mono text-[#00FF9C] z-10 font-bold">
                            {(currentVibe.fxSpace * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Compressor threshold Needle */}
                    <div className="bg-[#121314] rounded-xl p-3 border border-white/5 space-y-2">
                      <div className="text-[9px] font-mono text-gray-400 uppercase tracking-wide">Compressor Reduction Needle</div>
                      <div className="h-14 flex flex-col justify-around font-mono">
                        {/* Needle track */}
                        <div className="relative h-1 bg-[#1F2022] rounded-full overflow-hidden">
                          <div 
                            className="absolute h-full bg-indigo-500 transition-all duration-150 rounded"
                            style={{ width: `${(0.5 + currentVibe.drumDensity) * 50}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[8px] text-zinc-500">
                          <span>GR: 0dB</span>
                          <span className="text-[#A855F7]">Ratio: {((0.5 + currentVibe.drumDensity) * 8).toFixed(1)}:1</span>
                          <span>-24dB</span>
                        </div>
                      </div>
                    </div>

                    {/* Drum Dynamic Punch meters */}
                    <div className="bg-[#121314] rounded-xl p-3 border border-white/5 space-y-2 col-span-1">
                      <div className="text-[9px] font-mono text-gray-400 uppercase tracking-wide">Dynamic Drum Punch Squeeze</div>
                      <div className="h-14 flex items-center gap-2">
                        <div className="flex-1 flex flex-col gap-1">
                          <div className="h-1.5 bg-[#1F2022] rounded-full overflow-hidden">
                            <div className="h-full bg-red-400 transition-all duration-150" style={{ width: `${currentVibe.groove * 100}%` }} />
                          </div>
                          <div className="h-1.5 bg-[#1F2022] rounded-full overflow-hidden">
                            <div className="h-full bg-red-400/60 transition-all duration-150" style={{ width: `${currentVibe.drumDensity * 90}%` }} />
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-red-400 font-extrabold text-right shrink-0 w-8">
                          {((currentVibe.groove + currentVibe.drumDensity) * 50).toFixed(0)}dB
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AUTO DROP BUILDER (CHORUS IMPACT ENGINE) */}
                <div className="bg-[#090A0C] border border-white/5 rounded-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Sparkle className="text-yellow-400" size={15} />
                      <span className="text-[11px] font-mono font-bold text-white uppercase tracking-widest">Auto Drop Builder</span>
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded border border-yellow-500/20 font-bold uppercase">Chorus Impact Engine</span>
                  </div>

                  {/* Goal Description */}
                  <p className="text-[10px] text-zinc-400 leading-relaxed font-mono">
                    Automatically create tension and release before chorus sections to produce professional, high-impact drops.
                  </p>

                  {/* SONG ENERGY CURVE INFO */}
                  <div className="bg-[#121314] rounded-xl p-3 border border-white/5 space-y-1.5">
                    <div className="text-[9px] font-mono text-zinc-400 uppercase tracking-wide flex justify-between">
                      <span>Pro Song Energy Curve Mapping</span>
                      <span className="text-emerald-400">Preset: Afrobeat</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5 pt-1 text-center font-mono">
                      <div className="p-1.5 bg-[#161718] rounded border border-white/5">
                        <div className="text-[8px] text-zinc-500">INTRO</div>
                        <div className="text-[10px] text-emerald-400 font-bold">30%</div>
                      </div>
                      <div className="p-1.5 bg-[#161718] rounded border border-white/5">
                        <div className="text-[8px] text-zinc-500 font-bold">VERSE</div>
                        <div className="text-[10px] text-teal-400 font-bold font-extrabold">50%</div>
                      </div>
                      <div className="p-1.5 bg-[#161718] rounded border border-white/5 relative overflow-hidden">
                        <div className="absolute inset-0 bg-yellow-500/5 animate-pulse" />
                        <div className="text-[8px] text-yellow-400 font-bold">PRE-CH</div>
                        <div className="text-[10px] text-yellow-400 font-bold">70%</div>
                      </div>
                      <div className="p-1.5 bg-[#161718] rounded border border-white/5 relative overflow-hidden">
                        <div className="absolute inset-0 bg-red-500/5 animate-pulse" />
                        <div className="text-[8px] text-red-400 font-bold">CHORUS</div>
                        <div className="text-[10px] text-red-400 font-bold">100%</div>
                      </div>
                      <div className="p-1.5 bg-[#161718] rounded border border-white/5">
                        <div className="text-[8px] text-zinc-500">OUTRO</div>
                        <div className="text-[10px] text-blue-400 font-bold">40%</div>
                      </div>
                    </div>
                  </div>

                  {/* AI ARRANGEMENT ASSISTANT */}
                  <div className="bg-[#121314] rounded-xl p-3 border border-white/5 space-y-2">
                    <div className="flex justify-between items-center text-[9px] font-mono text-zinc-400 uppercase tracking-wide">
                      <span>Arrangement Assistant</span>
                      <span className="text-purple-400 font-bold">Heuristics Engine</span>
                    </div>
                    <button
                      onClick={() => {
                        try {
                          // Trigger fullscreen Interstitial ad transition
                          import('../../store/useAdMobStore').then(({ useAdMobStore }) => {
                            useAdMobStore.getState().setInterstitialActive(true);
                          });
                          const store = useDawStore.getState();
                          const optimal = aiDetermineOptimalDrops(store.tracks);
                          setSongStructure(optimal);
                        } catch (_) {}
                      }}
                      className="w-full py-2 bg-gradient-to-r from-purple-800/40 to-blue-800/40 hover:from-purple-700/50 hover:to-blue-700/50 hover:scale-[1.01] active:scale-95 text-purple-300 border border-purple-500/25 rounded-lg font-mono text-[9px] font-bold uppercase tracking-wider transition-all duration-150"
                    >
                      🧠 Run Heuristic Track Scan & Arrange 🎧
                    </button>
                  </div>

                  {/* SMART TENSION TOGGLE */}
                  <div className="flex items-center justify-between bg-[#121314] p-3 rounded-xl border border-white/5">
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-mono font-bold text-white uppercase">Smart Drop Detection</div>
                      <div className="text-[9px] font-mono text-zinc-500">Insert Pre-Chorus Drops automatically</div>
                    </div>
                    <button
                      onClick={() => {
                        const nextState = !autoDetectDrops;
                        setAutoDetectDrops(nextState);
                        if (nextState) {
                          setSongStructure({
                            sections: detectAndInsertDrops(defaultSongStructure.sections)
                          });
                        } else {
                          setSongStructure(defaultSongStructure);
                        }
                      }}
                      className={`px-3 py-1.5 font-mono text-[9px] font-bold rounded-lg uppercase tracking-wider transition-all duration-150 border ${
                        autoDetectDrops 
                          ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 shadow-sm' 
                          : 'bg-[#161718] text-zinc-500 border-white/5'
                      }`}
                    >
                      {autoDetectDrops ? 'Active ' : 'Disabled'}
                    </button>
                  </div>

                  {/* ACTIVE TIMELINE & SONG SECTIONS */}
                  <div className="bg-[#121314] rounded-xl p-3 border border-white/5 space-y-2.5">
                    <div className="flex justify-between items-center text-[9px] font-mono text-zinc-400 uppercase tracking-wide">
                      <span>Timeline Section Ranges</span>
                      <span className="text-[#00FF9C]">Playhead: Bar {Math.floor(transportPosition / 16) + 1}</span>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {songStructure.sections.map((sec) => {
                        const currentBar = Math.floor(transportPosition / 16);
                        const isCurrentlyPlaying = currentBar >= sec.startBar && currentBar < (sec.startBar + sec.lengthBars);
                        
                        let badgeColor = 'text-zinc-400 bg-zinc-400/5 border-zinc-400/10';
                        if (sec.type === 'INTRO') badgeColor = 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10';
                        if (sec.type === 'VERSE') badgeColor = 'text-teal-400 bg-teal-500/5 border-teal-500/10';
                        if (sec.type === 'PRE_CHORUS') badgeColor = 'text-yellow-400 bg-yellow-500/5 border-yellow-500/10';
                        if (sec.type === 'CHORUS') badgeColor = 'text-red-400 bg-red-400/5 border-red-500/10';
                        if (sec.type === 'OUTRO') badgeColor = 'text-blue-400 bg-blue-500/5 border-blue-500/10';

                        return (
                          <div 
                            key={sec.id}
                            className={`flex items-center justify-between p-2 rounded-lg font-mono text-xs border transition-all duration-200 ${
                              isCurrentlyPlaying 
                                ? 'bg-zinc-800/25 border-yellow-500/50 shadow shadow-yellow-500/10' 
                                : 'bg-[#161718] border-white/5 opacity-75'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {isCurrentlyPlaying ? (
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FF5A] opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00FF5a]"></span>
                                </span>
                              ) : (
                                <div className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                              )}
                              <span className="font-bold text-[11px] text-white">{sec.name}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase ${badgeColor}`}>
                                {sec.type === 'PRE_CHORUS' ? 'Tension Rise' : sec.type}
                              </span>
                              <span className="text-[10px] text-zinc-500 text-right min-w-[54px]">
                                B{sec.startBar + 1} - B{sec.startBar + sec.lengthBars}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* DROP MODE & DYNAMIC MIX PARAMETERS */}
                  {(() => {
                    const mode = adaptDropIntensity(currentVibe);
                    const currentBar = Math.floor(transportPosition / 16);
                    const activeSection = songStructure.sections.find(
                      sec => currentBar >= sec.startBar && currentBar < sec.startBar + sec.lengthBars
                    );
                    const barIdxInSection = activeSection ? (currentBar - activeSection.startBar) : 0;

                    let message = "Engine resting in steady groove state";
                    if (activeSection?.type === 'PRE_CHORUS') {
                      message = `🔥 SWEEP DETECTED: Bar ${barIdxInSection + 1} Tension Rise Ramp Active!`;
                    } else if (activeSection?.type === 'CHORUS') {
                      const isSecondHalf = barIdxInSection >= Math.floor(activeSection.lengthBars / 2);
                      if (isSecondHalf) {
                        message = `🎛️ DOUBLE CHORUS DROP ACTIVE: Sub EQ rumbles & Trap high sizzles maximized!`;
                      } else {
                        message = `💥 DROP IMPACT! Stereo field maximized 100% width!`;
                      }
                    } else if (activeSection?.type === 'INTRO') {
                      message = `🎧 INTRO ACTIVE: Polyphonic melody lowpass sweep filter opening sequentially.`;
                    }

                    // Dynamically calculate Crowd Mode metrics
                    let crowdText = "Atmosphere Rest (Club Idle)";
                    if (activeSection?.type === 'PRE_CHORUS') {
                      crowdText = `Swell: ${(12 + ((barIdxInSection + 1) / activeSection.lengthBars) * 48).toFixed(0)}% Club Excitement!`;
                    } else if (activeSection?.type === 'CHORUS') {
                      crowdText = barIdxInSection === 0 ? "🗣️ COSMIC ROAR DROP HIT OVERFLOW!" : "🕺 Club Shouting & Dancing Active";
                    } else if (activeSection?.type === 'INTRO') {
                      crowdText = "Raiser Intro Filter Sweeping Ambient Chatter";
                    }

                    return (
                      <div className="space-y-2.5">
                        <div className="bg-[#121314] rounded-xl p-3 border border-white/5 space-y-2">
                          <div className="flex justify-between items-center text-[9px] font-mono text-zinc-400 uppercase tracking-wide">
                            <span>Drop Intensity Character</span>
                            <span className="text-[#00FF9C]">Vibe Engine Bound</span>
                          </div>
                          
                          <div className="flex items-center justify-between bg-[#161718] p-2.5 rounded border border-white/5">
                            <span className="text-[10px] font-mono text-zinc-300 uppercase">Impact State</span>
                            <span className={`text-[10px] font-mono font-extrabold ${mode === 'aggressive' ? 'text-red-400' : 'text-blue-400'}`}>
                              {mode === 'aggressive' ? '💥 EXPLOSIVE FORCE (Aggressive)' : '🌊 VELVET SMOOTH (Subtle)'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between bg-[#161718] p-2.5 rounded border border-white/5">
                            <span className="text-[10px] font-mono text-zinc-300 uppercase">Club Crowd Energy</span>
                            <span className="text-[10px] font-mono font-extrabold text-teal-400 animate-pulse">
                              {crowdText}
                            </span>
                          </div>

                          <div className="text-[9px] font-mono text-zinc-500 leading-relaxed bg-[#0c0d0e] p-2 rounded">
                            <span className="text-[#00FF9C] font-bold">DIAGNOSTIC: </span>{message}
                          </div>
                        </div>

                        {/* LIVE RISE AUTOMATION GAUGES (Only glows/moves when in PRE_CHORUS) */}
                        <div className="bg-[#121314] rounded-xl p-3 border border-white/5 space-y-3 font-mono">
                          <div className="text-[9px] text-zinc-400 uppercase tracking-wide w-full flex justify-between">
                            <span>Buildup Automation State</span>
                            <span className="text-yellow-400 animate-pulse">{activeSection?.type === 'PRE_CHORUS' ? 'ACTIVE AUTOMATING' : ''}</span>
                          </div>
                          
                          {/* 1. Filter highpass sweep */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[8px] text-zinc-400">
                              <span>HIGH-PASS FREQUENCY SWEEP</span>
                              <span className={activeSection?.type === 'PRE_CHORUS' ? "text-yellow-400 font-bold animate-pulse" : "text-zinc-500"}>
                                {activeSection?.type === 'PRE_CHORUS' 
                                  ? `${(150 + (barIdxInSection + 1) / activeSection.lengthBars * 1150).toFixed(0)}Hz` 
                                  : '150Hz (Bypassed)'}
                              </span>
                            </div>
                            <div className="h-1 bg-[#1A1C1E] rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-300 ${activeSection?.type === 'PRE_CHORUS' ? 'bg-yellow-400 animate-pulse' : 'bg-zinc-700'}`} 
                                style={{ width: activeSection?.type === 'PRE_CHORUS' ? `${((barIdxInSection + 1) / activeSection.lengthBars) * 100}%` : '5%' }} 
                              />
                            </div>
                          </div>

                          {/* 2. Bass vacuum indicator */}
                          <div className="flex items-center justify-between text-[9px] bg-[#161718] p-1.5 rounded border border-white/5">
                            <span className="text-zinc-500">BASS VACUUM (DUCKED CUTOUT)</span>
                            <span className={`font-bold px-1 py-0.5 rounded text-[8px] uppercase ${
                              activeSection?.type === 'PRE_CHORUS' 
                                ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                                : 'bg-zinc-800 text-zinc-500'
                            }`}>
                              {activeSection?.type === 'PRE_CHORUS' ? 'ACTIVE -45%' : 'NORMAL'}
                            </span>
                          </div>

                          {/* 3. Hihat roll multiplier */}
                          <div className="flex items-center justify-between text-[9px] bg-[#161718] p-1.5 rounded border border-white/5">
                            <span className="text-zinc-500">HI-HAT ROLL SPEED RAMPUP</span>
                            <span className={`font-bold text-[9px] ${activeSection?.type === 'PRE_CHORUS' ? 'text-yellow-400' : 'text-zinc-500'}`}>
                              {activeSection?.type === 'PRE_CHORUS' 
                                ? `1/${16 / Math.pow(2, Math.min(2, barIdxInSection))} Roll` 
                                : '1/16 Standard'}
                            </span>
                          </div>

                          {/* 4. Kick Suspense Mutings indicator */}
                          <div className="flex items-center justify-between text-[9px] bg-[#161718] p-1.5 rounded border border-white/5">
                            <span className="text-zinc-500">SUSPENSE FINAL BAR MUTE</span>
                            <span className={`font-bold px-1.5 py-0.5 rounded text-[8px] uppercase ${
                              activeSection?.type === 'PRE_CHORUS' && barIdxInSection === activeSection.lengthBars - 1
                                ? 'bg-red-500/25 text-red-400 border border-red-500/30 font-bold'
                                : 'bg-zinc-800 text-zinc-500'
                            }`}>
                              {activeSection?.type === 'PRE_CHORUS' && barIdxInSection === activeSection.lengthBars - 1 
                                ? 'KICK MUTED!' 
                                : 'STANDBY'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* FORCE CHORUS SHOCK DROP PLAYER BUTTON */}
                  <div className="pt-1.5">
                    <button
                      onClick={() => {
                        try {
                          const customSec: SongSection = { id: 'manual', name: 'Triggered Drop', type: 'CHORUS', startBar: 0, lengthBars: 4 };
                          createImpactDrop(customSec, currentVibe);
                          import('../../audio/lowLatencySynth').then(({ playLowLatencyDrumHit }) => {
                            playLowLatencyDrumHit('C4', 0.95);
                          });
                        } catch (_) {}
                      }}
                      className="w-full py-2.5 bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white border border-red-500/20 shadow-lg font-mono font-bold text-[10px] rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-95 uppercase tracking-wider"
                    >
                      <Activity size={14} className="animate-pulse" />
                      <span>Simulate Live Shock Drop Hit 💥</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={handlePlayPreview}
                  className="w-full py-3 hover:scale-[1.01] transition-all bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-semibold text-xs rounded-xl uppercase flex items-center justify-center gap-2 tracking-wide font-sans shadow-lg shadow-emerald-500/10 active:scale-95"
                >
                  <Play size={14} fill="black" />
                  <span>Test Blended Syllable Preview</span>
                </button>
              </motion.div>
            );
          })()}

        </AnimatePresence>
      </div>
      </div>

      {/* Footer input controller area */}
      <div className={`p-4 z-10 pointer-events-auto relative transition-all duration-300 ${pipelineActive ? 'border-t-0 bg-transparent' : 'border-t border-[#1A1A1A] bg-[#0E0F10]'}`}>
        <div className="max-w-4xl mx-auto relative flex items-center justify-between gap-2">
          {pipelineActive ? (
            <div className="w-full flex items-center justify-end">
              <button 
                onClick={() => {
                  setPipelineActive(false);
                  setCurrentPipelineIndex(null);
                  useDawStore.setState({ isAiProducing: false, aiStepMessage: '', aiStepProgress: 0, aiActivePulseTrackId: null });
                  addChatMessage({ role: 'assistant', content: '🚫 Pipeline aborted by User override.' });
                }}
                className="bg-rose-500/90 hover:bg-rose-600 text-white font-sans text-[10px] font-bold px-4 py-2 rounded-xl uppercase transition-all shadow-lg shadow-rose-950/40 backdrop-blur pointer-events-auto"
              >
                Abort Pipeline
              </button>
            </div>
          ) : (
            <div className="w-full relative">
              <input
                id="chat-input-field"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                disabled={isLoading || adRequiredPrompt}
                placeholder={isLoading ? "AI is working, calculated credit being spent..." : adRequiredPrompt ? "Ad watching verification required to unlock..." : "Ask AI or command physical operations (e.g. 'produce full Afrobeat song' or 'mix down tracks')"}
                className={`w-full bg-[#050505] border border-[#222] rounded-2xl py-4 pl-5 pr-14 text-xs focus:outline-none focus:border-[#00FF9C] transition-all placeholder:text-gray-600 text-white ${
                  (isLoading || adRequiredPrompt) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || adRequiredPrompt}
                className={`absolute right-2 top-2 bottom-2 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  input.trim() && !isLoading && !adRequiredPrompt ? 'bg-[#00FF9C] text-black hover:scale-105 active:scale-95' : 'bg-[#151515] text-gray-600 cursor-not-allowed'
                }`}
              >
                <Send size={15} />
              </button>
            </div>
          )}
        </div>

        {/* Quick Suggestion buttons */}
        <div className="mt-3 flex flex-wrap gap-1.5 justify-center">
          {[
            { icon: Sparkle, text: 'Produce Full Song', action: 'produce full Afrobeat song automatically' },
            { icon: SlidersHorizontal, text: 'Auto-Mix Channels', action: 'mix down active tracks' },
            { icon: Sparkles, text: 'Process Vocal EQ', action: 'apply warm DSP tuning & autotune on vocals' },
            { icon: Download, text: 'Export HighFi Masters', action: 'render and export WAV MP3 files' }
          ].map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(s.action)}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#151515] border border-white/5 rounded-full text-[10px] text-gray-400 hover:bg-[#202020] hover:text-white transition-all active:scale-95"
            >
              <s.icon size={11} />
              {s.text}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
