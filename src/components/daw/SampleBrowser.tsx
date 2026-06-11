// @ts-nocheck
import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Square, 
  Plus, 
  Check, 
  Search, 
  Library, 
  Sparkles, 
  FolderHeart, 
  Music2, 
  Grid3X3, 
  Compass, 
  Sliders, 
  Tv, 
  ChevronRight, 
  Star, 
  PlusCircle, 
  SlidersHorizontal,
  FolderOpen,
  Save
} from 'lucide-react';
import * as Tone from 'tone';
import { useDawStore, getFxDefaults } from '../../store/useDawStore';
import { SynthType } from '../../types/daw';
import { PRESETS, GenrePreset } from '../../lib/presets';
import { audioEngine } from '../../audio/engine';
import { supabase } from '../../integrations/supabase/client';

// --- Types ---
interface Sample {
  id: string;
  name: string;
  url?: string;
  category: string;
  bpm: number;
  duration16ths: number; 
  key?: string;
  type?: 'audio' | 'midi';
  notes?: any[];
}

interface LooperPack {
  id: string;
  name: string;
  bpm: number;
  key: string;
  genre: string;
  coverColor: string;
  imageUrl?: string;
  isPopular?: boolean;
}

interface VocalPreset {
  id: string;
  name: string;
  portrait: string;
  category: string;
  recommendedFor: string;
  description: string;
  settings: {
    reverbMix: number;
    decay: number;
    high: number;
    low: number;
    pitchCorrection: boolean;
    compressorRatio: number;
  }
}

// --- Mock Data matching images ---
const LOOPER_PACKS: LooperPack[] = [
  { id: 'pack_1', name: 'Absolute Amapiano Pocket', bpm: 110, key: 'D minor', genre: 'Amapiano', coverColor: 'from-[#FF2E93] to-[#FF8E53]', isPopular: true },
  { id: 'pack_2', name: 'Amapiano Vibe Pocket', bpm: 113, key: 'A minor', genre: 'Amapiano', coverColor: 'from-[#FF8E53] to-[#FFD066]' },
  { id: 'pack_3', name: 'Afrostep Pocket', bpm: 110, key: 'E minor', genre: 'Afrostep', coverColor: 'from-[#00F2FE] to-[#4FACFE]' },
  { id: 'pack_4', name: 'Pure Afrobeat Grooves Pocket', bpm: 110, key: 'D minor', genre: 'Afrobeat', coverColor: 'from-[#F35555] to-[#FF932C]', isPopular: true },
  { id: 'pack_5', name: 'just_skay CookHits Pocket', bpm: 114, key: 'G major', genre: 'Hip Hop', coverColor: 'from-[#42E695] to-[#3BB2B8]' },
  { id: 'pack_6', name: 'Wizzy Afrobeat Pocket', bpm: 98, key: 'E minor', genre: 'Afrobeat', coverColor: 'from-[#3023AE] to-[#C86DD7]' },
  { id: 'pack_7', name: 'Modern Afrobeat Pocket', bpm: 100, key: 'A minor', genre: 'Afrobeat', coverColor: 'from-[#F5576C] to-[#F093FB]' },
  { id: 'pack_8', name: 'Digit Darkside DnB Pocket', bpm: 170, key: 'D minor', genre: 'Drum & Bass', coverColor: 'from-[#243B55] to-[#141E30]' },
  { id: 'pack_9', name: 'Protovolt Idols (K-pop) Pocket', bpm: 128, key: 'D# minor', genre: 'K-pop', coverColor: 'from-[#E14ECA] to-[#FFD6FF]' }
];

const VOCAL_PRESETS: VocalPreset[] = [
  { 
    id: 'vp_1', 
    name: 'Studio Vocals', 
    portrait: 'cassette', 
    category: 'Lead', 
    recommendedFor: 'Pop & RnB Clean lead vocals',
    description: 'Ultra-crisp modern radio-ready vocal stack with soft compression and warm spacious room decay.',
    settings: { reverbMix: 0.35, decay: 1.8, high: 4, low: -2, pitchCorrection: true, compressorRatio: 8 }
  },
  { 
    id: 'vp_2', 
    name: 'Amapiano (3)', 
    portrait: 'portrait_1', 
    category: 'Vibe', 
    recommendedFor: 'Smooth deep house vocal double',
    description: 'Chamber Reverb paired with double-stacked detuned chorus for smooth deep-house Afro vibes.',
    settings: { reverbMix: 0.5, decay: 3.2, high: 2, low: 1, pitchCorrection: true, compressorRatio: 4 }
  },
  { 
    id: ' vp_3', 
    name: 'Amapiano (2)', 
    portrait: 'portrait_2', 
    category: 'Vibe', 
    recommendedFor: 'Wide airy ambient textures',
    description: 'Maximized delay reflections with micro-shimmers. Great for back-end dynamic hums and chops.',
    settings: { reverbMix: 0.65, decay: 4.0, high: 5, low: -1, pitchCorrection: false, compressorRatio: 2 }
  },
  { 
    id: 'vp_4', 
    name: 'beat filter', 
    portrait: 'portrait_3', 
    category: 'Filter', 
    recommendedFor: 'Telephone lo-fi bridge effect',
    description: 'Bandpass filtration that carves out bass and sparkles, creating a stylized nostalgic speaker tone.',
    settings: { reverbMix: 0.2, decay: 1.0, high: -6, low: -8, pitchCorrection: true, compressorRatio: 12 }
  },
  { 
    id: 'vp_5', 
    name: 'fire 🔥', 
    portrait: 'portrait_4', 
    category: 'Saturate', 
    recommendedFor: 'Aggressive rap vocal crisp',
    description: 'Bold upfront presence, heavily compressed with top-end sheen to cut straight through complex rhythm beds.',
    settings: { reverbMix: 0.15, decay: 0.8, high: 6, low: 1, pitchCorrection: true, compressorRatio: 16 }
  },
  { 
    id: 'vp_6', 
    name: 'My New voice', 
    portrait: 'portrait_5', 
    category: 'Pitch', 
    recommendedFor: 'T-Pain autotuned signature',
    description: 'Maximum pitch correction speed with heavy gating. Ideal for modern urban trap melodies.',
    settings: { reverbMix: 0.4, decay: 2.2, high: 3, low: 0, pitchCorrection: true, compressorRatio: 10 }
  },
  { 
    id: 'vp_7', 
    name: '★ li base 🍑', 
    portrait: 'portrait_6', 
    category: 'Sub', 
    recommendedFor: 'Sub-harmonic voice enhancer',
    description: 'Thickened octave doubling effect to enrich thin male or airy female register segments.',
    settings: { reverbMix: 0.3, decay: 1.5, high: 1, low: 5, pitchCorrection: false, compressorRatio: 6 }
  }
];

const BANDLAB_SAMPLES: Sample[] = [
  { id: 'bs_1', name: 'JTS_HMD_Kick_Med_3', url: 'https://tonejs.github.io/audio/drum-samples/CR78/kick.mp3', category: 'Kick', bpm: 120, duration16ths: 4, key: 'Punchy' },
  { id: 'bs_2', name: 'Mar_102_Em_Gtr_04_2bars', url: 'https://tonejs.github.io/audio/casio/A1.mp3', category: 'Guitar', bpm: 102, duration16ths: 32, key: 'Em Key' },
  { id: 'bs_3', name: 'DustyTape_Castanet', url: 'https://tonejs.github.io/audio/drum-samples/CR78/hihat.mp3', category: 'Percussion', bpm: 120, duration16ths: 8, key: 'Dry SFX' },
  { id: 'bs_4', name: 'PV_Carpenter_Es_Ebm3_130bpm', url: 'https://tonejs.github.io/audio/casio/C4.mp3', category: 'Synth', bpm: 130, duration16ths: 32, key: 'Ebm Key' },
  { 
    id: 'bs_midi_1', 
    name: 'Amapiano Log Drum Loop (MIDI)', 
    category: 'Bass', 
    bpm: 110, 
    duration16ths: 16, 
    key: 'D minor', 
    type: 'midi',
    notes: [
      { id: 'm_1', note: 'D2', startTime: 0, duration: 2, velocity: 0.9 },
      { id: 'm_2', note: 'D2', startTime: 3, duration: 1, velocity: 0.8 },
      { id: 'm_3', note: 'F2', startTime: 4, duration: 2, velocity: 0.9 },
      { id: 'm_4', note: 'E2', startTime: 8, duration: 4, velocity: 0.95 },
      { id: 'm_5', note: 'A1', startTime: 12, duration: 4, velocity: 0.9 }
    ]
  },
  { 
    id: 'bs_midi_2', 
    name: 'Futuristic House Chords (MIDI)', 
    category: 'Keys', 
    bpm: 124, 
    duration16ths: 32, 
    key: 'A minor', 
    type: 'midi',
    notes: [
      { id: 'h_1', note: 'A3', startTime: 0, duration: 6, velocity: 0.8 },
      { id: 'h_2', note: 'C4', startTime: 0, duration: 6, velocity: 0.8 },
      { id: 'h_3', note: 'E4', startTime: 0, duration: 6, velocity: 0.8 },
      { id: 'h_4', note: 'G3', startTime: 8, duration: 6, velocity: 0.8 },
      { id: 'h_5', note: 'B3', startTime: 8, duration: 6, velocity: 0.8 },
      { id: 'h_6', note: 'D4', startTime: 8, duration: 6, velocity: 0.8 },
      { id: 'h_7', note: 'F3', startTime: 16, duration: 6, velocity: 0.8 },
      { id: 'h_8', note: 'A3', startTime: 16, duration: 6, velocity: 0.8 },
      { id: 'h_9', note: 'C4', startTime: 16, duration: 6, velocity: 0.8 },
      { id: 'h_10', note: 'E3', startTime: 24, duration: 8, velocity: 0.8 },
      { id: 'h_11', note: 'G#3', startTime: 24, duration: 8, velocity: 0.8 },
      { id: 'h_12', note: 'B3', startTime: 24, duration: 8, velocity: 0.8 }
    ]
  },
  { id: 'bs_5', name: 'AnalogueBrks_Interval_Sequence', url: 'https://tonejs.github.io/audio/drum-samples/breakbeat.mp3', category: 'Breakbeat', bpm: 120, duration16ths: 16, key: '4 Bars' },
  { id: 'bs_6', name: 'NR_123_A_Arua_Pluck_8bars', url: 'https://tonejs.github.io/audio/casio/A2.mp3', category: 'Keys', bpm: 123, duration16ths: 64, key: 'A minor' },
  { id: 'bs_7', name: 'Beat-Enhancers_TopLoop_01', url: 'https://tonejs.github.io/audio/drum-samples/handdrum-loop.mp3', category: 'Tops', bpm: 120, duration16ths: 16, key: 'Hi-Hat Loop' },
  { 
    id: 'bs_midi_3', 
    name: 'Ambient Electronic Plucks (MIDI)', 
    category: 'Lead', 
    bpm: 100, 
    duration16ths: 16, 
    key: 'E minor', 
    type: 'midi',
    notes: [
      { id: 'p_1', note: 'E4', startTime: 0, duration: 2, velocity: 0.7 },
      { id: 'p_2', note: 'G4', startTime: 2, duration: 2, velocity: 0.75 },
      { id: 'p_3', note: 'B4', startTime: 4, duration: 2, velocity: 0.8 },
      { id: 'p_4', note: 'A4', startTime: 6, duration: 2, velocity: 0.7 },
      { id: 'p_5', note: 'B4', startTime: 8, duration: 2, velocity: 0.75 },
      { id: 'p_6', note: 'D5', startTime: 10, duration: 2, velocity: 0.8 },
      { id: 'p_7', note: 'E5', startTime: 12, duration: 4, velocity: 0.85 }
    ]
  },
  { id: 'bs_8', name: 'LHH_Roule_92_F#m_Strings', url: 'https://tonejs.github.io/audio/casio/C2.mp3', category: 'Strings', bpm: 92, duration16ths: 64, key: 'F#m Key' },
  { id: 'bs_9', name: 'CDP_Lazers_Cmin_148_Lead', url: 'https://tonejs.github.io/audio/casio/A1.mp3', category: 'Lead', bpm: 148, duration16ths: 32, key: 'C minor' }
];

// --- Interface for Looper Pad ---
interface LooperPadDef {
  label: string;
  category: 'Bass' | 'Lead' | 'Keyboard' | 'Kick' | 'Percussion' | 'Snare';
  colorClass: string;
  note: string;
  subdivision: number; // in 16ths format (e.g. 2 for 8th note, 4 for quarter)
}

const LOOPER_PADS: LooperPadDef[] = [
  // Red/Bass Row
  { label: 'Sub Pulse', category: 'Bass', colorClass: 'bg-red-950 text-red-400 border-red-800 hover:bg-red-900', note: 'C2', subdivision: 4 },
  { label: 'Slam Bass', category: 'Bass', colorClass: 'bg-red-950 text-red-400 border-red-800 hover:bg-red-900', note: 'E2', subdivision: 4 },
  { label: 'Deep Drop', category: 'Bass', colorClass: 'bg-red-950 text-red-400 border-red-800 hover:bg-red-900', note: 'F2', subdivision: 8 },
  { label: 'Vibe Growl', category: 'Bass', colorClass: 'bg-red-950 text-red-400 border-red-800 hover:bg-red-900', note: 'A1', subdivision: 2 },
  
  // Blue/Lead Row
  { label: 'High Pluck', category: 'Lead', colorClass: 'bg-blue-950 text-blue-400 border-blue-800 hover:bg-blue-900', note: 'C4', subdivision: 2 },
  { label: 'Pluck Vibe', category: 'Lead', colorClass: 'bg-blue-950 text-blue-400 border-blue-800 hover:bg-blue-900', note: 'E4', subdivision: 2 },
  { label: 'Mallet Run', category: 'Lead', colorClass: 'bg-sky-950 text-sky-400 border-sky-800 hover:bg-sky-900', note: 'G4', subdivision: 1 },
  { label: 'Melody Pad', category: 'Lead', colorClass: 'bg-sky-950 text-sky-400 border-sky-800 hover:bg-sky-900', note: 'B4', subdivision: 8 },

  // Purple/Keys Row
  { label: 'E-Piano', category: 'Keyboard', colorClass: 'bg-purple-950 text-purple-400 border-purple-800 hover:bg-purple-900', note: 'C3', subdivision: 8 },
  { label: 'House Vibe', category: 'Keyboard', colorClass: 'bg-purple-950 text-purple-400 border-purple-800 hover:bg-purple-900', note: 'F3', subdivision: 4 },
  { label: 'Warm Shimmer', category: 'Keyboard', colorClass: 'bg-fuchsia-950 text-fuchsia-400 border-fuchsia-800 hover:bg-fuchsia-900', note: 'G3', subdivision: 16 },
  { label: 'Lofi Chords', category: 'Keyboard', colorClass: 'bg-fuchsia-950 text-fuchsia-400 border-fuchsia-800 hover:bg-fuchsia-900', note: 'A3', subdivision: 8 },

  // Magenta/Drums Row
  { label: 'Solid Kick', category: 'Kick', colorClass: 'bg-rose-950 text-rose-400 border-rose-800 hover:bg-rose-900', note: 'C1', subdivision: 4 },
  { label: 'Trap Sub', category: 'Kick', colorClass: 'bg-rose-950 text-rose-400 border-rose-800 hover:bg-rose-900', note: 'C1', subdivision: 2 },
  { label: 'Clap Stack', category: 'Kick', colorClass: 'bg-rose-950 text-rose-400 border-rose-800 hover:bg-rose-900', note: 'D1', subdivision: 8 },
  { label: 'Cyber Kick', category: 'Kick', colorClass: 'bg-rose-950 text-rose-400 border-rose-800 hover:bg-rose-900', note: 'C1', subdivision: 4 },

  // Green/Perc Row
  { label: 'Cabasa Trip', category: 'Percussion', colorClass: 'bg-emerald-950 text-emerald-400 border-emerald-800 hover:bg-emerald-900', note: 'F#1', subdivision: 2 },
  { label: 'Wood Block', category: 'Percussion', colorClass: 'bg-emerald-950 text-emerald-400 border-emerald-800 hover:bg-emerald-900', note: 'G1', subdivision: 4 },
  { label: 'Shaker Vibe', category: 'Percussion', colorClass: 'bg-green-950 text-green-400 border-green-800 hover:bg-green-900', note: 'A1', subdivision: 1 },
  { label: 'Afro Perc', category: 'Percussion', colorClass: 'bg-green-950 text-green-400 border-green-800 hover:bg-green-900', note: 'B1', subdivision: 2 },

  // Orange/Snare Row
  { label: 'Classic Snr', category: 'Snare', colorClass: 'bg-amber-950 text-amber-400 border-amber-800 hover:bg-amber-900', note: 'D2', subdivision: 8 },
  { label: 'Rim Strike', category: 'Snare', colorClass: 'bg-amber-950 text-amber-400 border-amber-800 hover:bg-amber-900', note: 'D#2', subdivision: 4 },
  { label: 'Gong Bell', category: 'Snare', colorClass: 'bg-yellow-950 text-yellow-400 border-yellow-800 hover:bg-yellow-900', note: 'F#2', subdivision: 16 },
  { label: 'Sidestick', category: 'Snare', colorClass: 'bg-yellow-950 text-yellow-400 border-yellow-800 hover:bg-yellow-900', note: 'G#2', subdivision: 4 }
];

export function SampleBrowser() {
  // Browsing Modes: sounds, packs, looper, vocals
  const [subTab, setSubTab] = useState<'sounds' | 'packs' | 'looper' | 'vocals'>('sounds');
  const [soundSubTab, setSoundSubTab] = useState<'browse' | 'samples'>('browse');
  const [vocalSubTab, setVocalSubTab] = useState<'my' | 'new' | 'rec' | 'trend'>('my');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>('Amapiano');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [platformSamples, setPlatformSamples] = useState<Sample[]>([]);
  
  // Active Looper Pack
  const [activePack, setActivePack] = useState<LooperPack>(LOOPER_PACKS[0]);
  const [activeLooppads, setActiveLooppads] = useState<Record<number, boolean>>({});
  const [pendingLooppads, setPendingLooppads] = useState<Record<number, boolean>>({});
  const [lpadIntervalTicks, setLpadIntervalTicks] = useState<number>(0);
  const [xyEnabled, setXyEnabled] = useState(false);
  const [xyPadFilterCoords, setXyPadFilterCoords] = useState({ x: 0.5, y: 0.4 });
  const [xyPadGaterCoords, setXyPadGaterCoords] = useState({ x: 0.2, y: 0.7 });
  const [isApplyingVocalPreset, setIsApplyingVocalPreset] = useState<string | null>(null);

  // Vocal Presets List State (restores custom ones first, merges with original presets)
  const [vocalPresets, setVocalPresets] = useState<VocalPreset[]>(() => {
    try {
      const saved = localStorage.getItem('custom_vocal_presets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return [...parsed, ...VOCAL_PRESETS.filter(p => !parsed.some(custom => custom.id === p.id))];
        }
      }
    } catch (e) {
      console.error("Local vocal presets restore error:", e);
    }
    return VOCAL_PRESETS;
  });

  const [activePreset, setActivePreset] = useState<VocalPreset | null>(() => {
    return VOCAL_PRESETS[0]; // Studio Vocals loaded by default
  });

  const playerRef = useRef<Tone.Player | null>(null);
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const filterRef = useRef<Tone.Filter | null>(null);
  const autoGaterRef = useRef<Tone.Gate | null>(null);
  const audioContextActive = useRef<boolean>(false);
  
  // Keep track of timeouts for live interactive MIDI clip previewing
  const midiPreviewTimeoutRefs = useRef<NodeJS.Timeout[]>([]);

  const { tracks, selectedTrackId, updateTrack, addTrack } = useDawStore();

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('platform_samples')
      .select('id,title,category,bpm,music_key,duration16ths,public_url,created_at')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setPlatformSamples((data || []).map((row: any) => ({
          id: `platform_${row.id}`,
          name: row.title,
          url: row.public_url,
          category: row.category || 'Uploaded',
          bpm: Number(row.bpm) || 120,
          duration16ths: Number(row.duration16ths) || 16,
          key: row.music_key || 'Platform',
          type: 'audio'
        })));
      });
    return () => { cancelled = true; };
  }, []);

  const allSamples = [...platformSamples, ...BANDLAB_SAMPLES];

  const getCuratedPadsForPack = (pack: LooperPack): LooperPadDef[] => {
    const isAmapiano = pack.genre === 'Amapiano';
    const isAfro = pack.genre === 'Afrobeat' || pack.genre === 'Afrostep';
    const isDnb = pack.genre === 'Drum & Bass';
    
    if (isAmapiano) {
      return [
        { label: 'Log Low Roll', category: 'Bass', colorClass: 'bg-red-950 text-red-300 border-red-800 hover:bg-red-900', note: 'D2', subdivision: 16 },
        { label: 'Log Pitch Bend', category: 'Bass', colorClass: 'bg-red-950 text-red-300 border-red-800 hover:bg-red-900', note: 'A1', subdivision: 4 },
        { label: 'Deep Log Stab', category: 'Bass', colorClass: 'bg-red-950 text-red-300 border-red-800 hover:bg-red-900', note: 'F2', subdivision: 8 },
        { label: 'Warm Sub Slide', category: 'Bass', colorClass: 'bg-red-950 text-red-300 border-red-800 hover:bg-red-900', note: 'D1', subdivision: 2 },
        { label: 'Amapiano Whistle', category: 'Lead', colorClass: 'bg-blue-950 text-blue-300 border-blue-800 hover:bg-blue-900', note: 'C5', subdivision: 2 },
        { label: 'Sax Vibe Ref', category: 'Lead', colorClass: 'bg-blue-950 text-blue-300 border-blue-800 hover:bg-blue-900', note: 'A4', subdivision: 4 },
        { label: 'Synth Flute Run', category: 'Lead', colorClass: 'bg-sky-950 text-sky-305 border-sky-800 hover:bg-sky-900', note: 'E5', subdivision: 16 },
        { label: 'Glitch Chop', category: 'Lead', colorClass: 'bg-sky-950 text-sky-305 border-sky-800 hover:bg-sky-900', note: 'G4', subdivision: 8 },
        { label: 'Wurlitzer Chords', category: 'Keyboard', colorClass: 'bg-purple-950 text-purple-350 border-purple-800 hover:bg-purple-900', note: 'D3', subdivision: 4 },
        { label: 'Smooth Rhodes', category: 'Keyboard', colorClass: 'bg-purple-950 text-purple-350 border-purple-800 hover:bg-purple-900', note: 'F3', subdivision: 8 },
        { label: 'Muted Plucks', category: 'Keyboard', colorClass: 'bg-fuchsia-950 text-fuchsia-350 border-fuchsia-800 hover:bg-fuchsia-900', note: 'A3', subdivision: 8 },
        { label: 'Vibe Organ', category: 'Keyboard', colorClass: 'bg-fuchsia-950 text-fuchsia-350 border-fuchsia-800 hover:bg-fuchsia-900', note: 'D4', subdivision: 16 },
        { label: 'Fat Log Kick', category: 'Kick', colorClass: 'bg-rose-950 text-rose-350 border-rose-800 hover:bg-rose-900', note: 'C1', subdivision: 4 },
        { label: 'Afro Shaker Loop', category: 'Kick', colorClass: 'bg-rose-950 text-rose-350 border-rose-800 hover:bg-rose-900', note: 'D1', subdivision: 16 },
        { label: 'Amapiano Clap', category: 'Kick', colorClass: 'bg-rose-950 text-[#f43f5e] border-rose-800 hover:bg-rose-900', note: 'E1', subdivision: 8 },
        { label: 'Rim Trip Block', category: 'Kick', colorClass: 'bg-rose-950 text-[#f43f5e] border-rose-800 hover:bg-rose-900', note: 'G1', subdivision: 4 },
        { label: 'Conga Mid Hit', category: 'Percussion', colorClass: 'bg-emerald-950 text-emerald-305 border-emerald-800 hover:bg-emerald-900', note: 'A1', subdivision: 4 },
        { label: 'Wood Shake Clave', category: 'Percussion', colorClass: 'bg-emerald-950 text-emerald-305 border-emerald-800 hover:bg-emerald-900', note: 'F1', subdivision: 8 },
        { label: 'High Bongo Rim', category: 'Percussion', colorClass: 'bg-green-950 text-green-305 border-green-800 hover:bg-green-900', note: 'B1', subdivision: 16 },
        { label: 'Cabasa Sweeper', category: 'Percussion', colorClass: 'bg-green-950 text-green-305 border-green-800 hover:bg-green-900', note: 'C2', subdivision: 8 },
        { label: 'Double Snare Hit', category: 'Snare', colorClass: 'bg-amber-950 text-amber-305 border-amber-800 hover:bg-amber-900', note: 'D2', subdivision: 8 },
        { label: 'Trap Rim Shot', category: 'Snare', colorClass: 'bg-amber-950 text-amber-305 border-amber-800 hover:bg-amber-900', note: 'E2', subdivision: 4 },
        { label: 'Cowbell Acc', category: 'Snare', colorClass: 'bg-yellow-950 text-yellow-305 border-yellow-800 hover:bg-yellow-900', note: 'G2', subdivision: 2 },
        { label: 'Crash Accent', category: 'Snare', colorClass: 'bg-yellow-950 text-yellow-305 border-yellow-800 hover:bg-yellow-900', note: 'A2', subdivision: 1 }
      ];
    } else if (isAfro) {
      return [
        { label: 'Afro Bass Drop', category: 'Bass', colorClass: 'bg-red-950 text-red-350 border-red-800 hover:bg-red-900', note: 'E1', subdivision: 4 },
        { label: 'Rhythm Bass Growl', category: 'Bass', colorClass: 'bg-red-950 text-red-350 border-red-800 hover:bg-red-900', note: 'G1', subdivision: 8 },
        { label: 'Bounce sub Line', category: 'Bass', colorClass: 'bg-red-950 text-red-350 border-red-800 hover:bg-red-900', note: 'A1', subdivision: 16 },
        { label: 'Afro Sub Muted', category: 'Bass', colorClass: 'bg-red-950 text-red-350 border-red-800 hover:bg-red-900', note: 'C1', subdivision: 2 },
        { label: 'Afro Kalimba Air', category: 'Lead', colorClass: 'bg-blue-950 text-blue-305 border-blue-800 hover:bg-blue-900', note: 'C4', subdivision: 8 },
        { label: 'Sweet Trumpet', category: 'Lead', colorClass: 'bg-blue-950 text-blue-305 border-blue-800 hover:bg-blue-900', note: 'E4', subdivision: 4 },
        { label: 'Melodic Afro Horn', category: 'Lead', colorClass: 'bg-sky-950 text-sky-355 border-sky-800 hover:bg-sky-900', note: 'G4', subdivision: 16 },
        { label: 'High Marimba Bounce', category: 'Lead', colorClass: 'bg-sky-950 text-sky-355 border-sky-800 hover:bg-sky-900', note: 'A4', subdivision: 2 },
        { label: 'Sunny Organ Wurl', category: 'Keyboard', colorClass: 'bg-purple-950 text-purple-305 border-purple-800 hover:bg-purple-900', note: 'A2', subdivision: 4 },
        { label: 'Afro Rhodes Air', category: 'Keyboard', colorClass: 'bg-purple-950 text-purple-305 border-purple-800 hover:bg-purple-900', note: 'C3', subdivision: 8 },
        { label: 'Reggae Bubbling', category: 'Keyboard', colorClass: 'bg-fuchsia-950 text-fuchsia-305 border-fuchsia-800 hover:bg-fuchsia-900', note: 'E3', subdivision: 16 },
        { label: 'Chop Keys', category: 'Keyboard', colorClass: 'bg-fuchsia-950 text-fuchsia-305 border-fuchsia-800 hover:bg-fuchsia-900', note: 'G3', subdivision: 8 },
        { label: 'Deep Afro Kick', category: 'Kick', colorClass: 'bg-rose-950 text-rose-305 border-rose-800 hover:bg-rose-900', note: 'C1', subdivision: 4 },
        { label: 'Rim Shot Afrobeat', category: 'Kick', colorClass: 'bg-rose-950 text-rose-305 border-rose-800 hover:bg-rose-900', note: 'D1', subdivision: 8 },
        { label: 'Djembe Open Slap', category: 'Kick', colorClass: 'bg-rose-950 text-rose-350 border-rose-800 hover:bg-rose-900', note: 'E1', subdivision: 16 },
        { label: 'Tribal Tom Fill', category: 'Kick', colorClass: 'bg-rose-950 text-rose-350 border-rose-800 hover:bg-rose-900', note: 'G1', subdivision: 8 },
        { label: 'Shekere Sweep', category: 'Percussion', colorClass: 'bg-emerald-950 text-emerald-350 border-emerald-800 hover:bg-emerald-900', note: 'C2', subdivision: 8 },
        { label: 'Udu Deep Resonance', category: 'Percussion', colorClass: 'bg-emerald-950 text-emerald-350 border-emerald-800 hover:bg-emerald-900', note: 'E2', subdivision: 16 },
        { label: 'Afro Clave Stick', category: 'Percussion', colorClass: 'bg-emerald-950 text-emerald-350 border-emerald-800 hover:bg-emerald-900', note: 'G2', subdivision: 4 },
        { label: 'Tambourine Shimmer', category: 'Percussion', colorClass: 'bg-emerald-950 text-emerald-350 border-emerald-800 hover:bg-emerald-900', note: 'A2', subdivision: 16 },
        { label: 'Afro Snare Syncop', category: 'Snare', colorClass: 'bg-amber-950 text-amber-305 border-amber-800 hover:bg-amber-900', note: 'D2', subdivision: 8 },
        { label: 'Rim Strike Click', category: 'Snare', colorClass: 'bg-amber-950 text-amber-305 border-amber-800 hover:bg-amber-900', note: 'E2', subdivision: 4 },
        { label: 'Gong Bell Ring', category: 'Snare', colorClass: 'bg-yellow-950 text-yellow-305 border-yellow-800 hover:bg-yellow-900', note: 'A2', subdivision: 8 },
        { label: 'Splash Cymbal', category: 'Snare', colorClass: 'bg-yellow-950 text-yellow-305 border-yellow-800 hover:bg-yellow-900', note: 'B2', subdivision: 2 }
      ];
    } else if (isDnb) {
      return [
        { label: 'Reese Bass Heavy', category: 'Bass', colorClass: 'bg-red-950 text-red-350 border-red-800 hover:bg-red-900', note: 'C1', subdivision: 16 },
        { label: '808 Glide Pitch', category: 'Bass', colorClass: 'bg-red-950 text-red-350 border-red-800 hover:bg-red-900', note: 'G1', subdivision: 4 },
        { label: 'Sub Boom Wobble', category: 'Bass', colorClass: 'bg-red-950 text-red-350 border-red-800 hover:bg-red-900', note: 'F1', subdivision: 8 },
        { label: 'Acid Square Bass', category: 'Bass', colorClass: 'bg-red-950 text-red-350 border-red-800 hover:bg-red-900', note: 'A1', subdivision: 16 },
        { label: 'Screamer Lead Synth', category: 'Lead', colorClass: 'bg-blue-950 text-blue-350 border-blue-800 hover:bg-blue-900', note: 'C4', subdivision: 2 },
        { label: 'Laser Arpeggiator', category: 'Lead', colorClass: 'bg-blue-950 text-blue-350 border-blue-800 hover:bg-blue-900', note: 'E4', subdivision: 16 },
        { label: 'Siren Synth sweep', category: 'Lead', colorClass: 'bg-sky-950 text-sky-400 border-sky-800 hover:bg-sky-900', note: 'G4', subdivision: 8 },
        { label: 'Vocal Siren Strobe', category: 'Lead', colorClass: 'bg-sky-950 text-sky-400 border-sky-800 hover:bg-sky-900', note: 'B4', subdivision: 4 },
        { label: 'Rave Chords Deep', category: 'Keyboard', colorClass: 'bg-purple-950 text-purple-305 border-purple-800 hover:bg-purple-900', note: 'C3', subdivision: 4 },
        { label: 'Atmosphere Pad FX', category: 'Keyboard', colorClass: 'bg-purple-950 text-purple-305 border-purple-800 hover:bg-purple-900', note: 'E3', subdivision: 2 },
        { label: 'Hypnotic Stabs', category: 'Keyboard', colorClass: 'bg-fuchsia-950 text-fuchsia-350 border-fuchsia-800 hover:bg-fuchsia-900', note: 'G3', subdivision: 8 },
        { label: 'Acid Plucks Line', category: 'Keyboard', colorClass: 'bg-fuchsia-950 text-fuchsia-350 border-fuchsia-800 hover:bg-fuchsia-900', note: 'A3', subdivision: 16 },
        { label: 'Break Kick High', category: 'Kick', colorClass: 'bg-rose-950 text-rose-350 border-rose-800 hover:bg-rose-900', note: 'C1', subdivision: 4 },
        { label: 'Ghost Hi-Hat Beat', category: 'Kick', colorClass: 'bg-rose-950 text-rose-350 border-rose-800 hover:bg-rose-900', note: 'D1', subdivision: 16 },
        { label: 'Closed Hat Fast', category: 'Kick', colorClass: 'bg-rose-950 text-[#f43f5e] border-rose-800 hover:bg-rose-900', note: 'F#1', subdivision: 16 },
        { label: 'Open Break Cymbal', category: 'Kick', colorClass: 'bg-rose-950 text-[#f43f5e] border-rose-800 hover:bg-rose-900', note: 'A1', subdivision: 8 },
        { label: 'Rattle Loop Shake', category: 'Percussion', colorClass: 'bg-emerald-950 text-emerald-350 border-emerald-800 hover:bg-emerald-900', note: 'C2', subdivision: 16 },
        { label: 'Anvil Hit Perc', category: 'Percussion', colorClass: 'bg-emerald-950 text-emerald-350 border-emerald-800 hover:bg-emerald-900', note: 'E2', subdivision: 8 },
        { label: 'Metal Shimmer Fx', category: 'Percussion', colorClass: 'bg-green-950 text-green-305 border-green-800 hover:bg-green-900', note: 'G2', subdivision: 4 },
        { label: 'Laser Impact Drop', category: 'Percussion', colorClass: 'bg-green-950 text-green-305 border-green-800 hover:bg-green-900', note: 'B2', subdivision: 2 },
        { label: 'Snare Breakbeat 1', category: 'Snare', colorClass: 'bg-amber-950 text-amber-350 border-amber-800 hover:bg-amber-900', note: 'D2', subdivision: 16 },
        { label: 'Break Rim Shot', category: 'Snare', colorClass: 'bg-amber-950 text-amber-350 border-amber-800 hover:bg-amber-900', note: 'E2', subdivision: 8 },
        { label: 'Double Snare Tap', category: 'Snare', colorClass: 'bg-yellow-950 text-yellow-350 border-yellow-800 hover:bg-yellow-900', note: 'G2', subdivision: 16 },
        { label: 'Clap Attack Accent', category: 'Snare', colorClass: 'bg-yellow-950 text-yellow-350 border-yellow-800 hover:bg-yellow-905', note: 'A2', subdivision: 4 }
      ];
    }
    return LOOPER_PADS;
  };

  const getPadsList = () => {
    return getCuratedPadsForPack(activePack);
  };

  const [isRecordingLoops, setIsRecordingLoops] = useState(false);
  const isRecordingLoopsRef = useRef(isRecordingLoops);
  useEffect(() => {
    isRecordingLoopsRef.current = isRecordingLoops;
  }, [isRecordingLoops]);

  const handleToggleRecordingLoops = async () => {
    const nextState = !isRecordingLoops;
    setIsRecordingLoops(nextState);
    if (nextState) {
      try {
        if (Tone.context.state !== 'running') {
          await Tone.start();
        }
        const rawCtx = Tone.getContext().rawContext as AudioContext;
        if (rawCtx && rawCtx.state !== 'running') {
          await rawCtx.resume().catch(() => {});
        }
      } catch (e) {}
      const store = useDawStore.getState();
      if (store.playbackState !== 'playing') {
        store.setPlaybackState('playing');
      }
    } else {
      const store = useDawStore.getState();
      if (store.playbackState === 'playing') {
        store.setPlaybackState('stopped');
      }
    }
  };

  const activeLooppadsRef = useRef(activeLooppads);
  useEffect(() => {
    activeLooppadsRef.current = activeLooppads;
  }, [activeLooppads]);

  const pendingLooppadsRef = useRef(pendingLooppads);
  useEffect(() => {
    pendingLooppadsRef.current = pendingLooppads;
  }, [pendingLooppads]);

  const looperTickRef = useRef(0);

  const activePackRef = useRef(activePack);
  useEffect(() => {
    activePackRef.current = activePack;
  }, [activePack]);

  const recordLooperNoteTrigger = (category: string, noteName: string, subdivision: number) => {
    const store = useDawStore.getState();
    const isMasterRecording = store.isRecording;
    const isLooperRecording = isRecordingLoopsRef.current;
    if (!isMasterRecording && !isLooperRecording) return;

    // 1. Determine corresponding track name/settings based on category
    let trackName = "Lead Synth";
    let synthType: SynthType = 'leadsynth';
    if (category === 'Bass') {
      trackName = "Bass Loop";
      synthType = 'synthbass';
    } else if (category === 'Lead') {
      trackName = "Lead Loop";
      synthType = 'leadsynth';
    } else if (category === 'Keyboard' || category === 'Synth') {
      trackName = "Keys Loop";
      synthType = 'epiano';
    } else if (category === 'Kick' || category === 'Snare' || category === 'Perc' || category === 'Percussion') {
      trackName = "Drums Loop";
      synthType = 'membrane';
    } else if (category === 'Vocal') {
      trackName = "Vocal Midi Loop";
      synthType = 'pad';
    }

    // 2. Find or create the track
    let track = store.tracks.find(t => t.name === trackName && t.type === 'midi');
    if (!track) {
      // Create track automatically!
      const newTrackId = `track_looper_${category.toLowerCase()}_${Date.now()}`;
      track = {
        id: newTrackId,
        name: trackName,
        type: 'midi',
        color: category === 'Bass' ? '#ef4444' : category === 'Keyboard' ? '#8b5cf6' : category === 'Kick' ? '#f43f5e' : '#3b82f6',
        muted: false,
        soloed: false,
        volume: -10,
        pan: 0,
        synthType: synthType,
        fx: getFxDefaults(),
        clips: [],
        midiChannel: 1,
        midiInputId: 'all',
        audioInputId: 'default',
        armed: false
      };
      
      // Update tracks state
      useDawStore.setState(state => ({
        tracks: [...state.tracks, track!]
      }));
    }

    // 3. Find or create the clip at the current transport timeline position
    let pos16ths = store.transportPosition;
    if (Tone.Transport.state === "started") {
      const secondsPer16th = 15 / store.bpm;
      pos16ths = Tone.Transport.seconds / secondsPer16th;
    }
    
    // Grid alignment for looper recording
    const alignedStart = Math.round(pos16ths);
    
    // Let's hold our clips for this track
    const trackClips = Object.values(store.clips).filter(c => c.trackId === track!.id);
    let activeClip = trackClips.find(c => alignedStart >= c.startTime && alignedStart < c.startTime + c.duration);

    const noteDuration = Math.max(1, 16 / subdivision); // note duration in 16th notes

    if (!activeClip) {
      // Align clip start to 16-bar boundaries for neat organization
      const clipStartTime = Math.floor(alignedStart / 16) * 16;
      const relativeStart = alignedStart - clipStartTime;
      
      const newNote = {
        id: `n_${Date.now()}_l_${Math.random().toString(36).substr(2, 5)}`,
        note: noteName,
        startTime: relativeStart,
        duration: noteDuration,
        velocity: 0.8
      };

      // Create new clip synchronously in store to prevent async race conditions
      const newClipId = store.addClip(track!.id, clipStartTime, undefined, undefined, 32);
      
      const currentStore = useDawStore.getState();
      const createdClip = currentStore.clips[newClipId];
      if (createdClip) {
        currentStore.updateClip(newClipId, { 
          notes: [...(createdClip.notes || []), newNote] 
        });
      }
    } else {
      // Calculate relative start inside existing clip
      const relativeStart = alignedStart - activeClip.startTime;
      
      const newNote = {
        id: `n_${Date.now()}_l_${Math.random().toString(36).substr(2, 5)}`,
        note: noteName,
        startTime: relativeStart,
        duration: noteDuration,
        velocity: 0.8
      };

      // Check if duplicate note at exactly same start time of this clip exists to prevent stacked notes duplication
      const currentNotes = activeClip.notes || [];
      const hasDuplicate = currentNotes.some(n => n.note === noteName && Math.abs(n.startTime - relativeStart) < 0.1);
      if (!hasDuplicate) {
        store.updateClip(activeClip.id, {
          notes: [...currentNotes, newNote]
        });
      }
    }
  };

  // Continuous background clock synced with active pads to prevent timer reset on pad click
  useEffect(() => {
    let timer: NodeJS.Timeout;
    const bpm = activePack ? activePack.bpm : 120;
    const stepMs = (60000 / bpm) / 4; // 16th note length in ms

    timer = setInterval(() => {
      const currentTick = looperTickRef.current;
      looperTickRef.current = (looperTickRef.current + 1) % 115200;

      const activePads = activeLooppadsRef.current;
      const pendingPads = pendingLooppadsRef.current;
      const currentPack = activePackRef.current;
      const activePadsList = getCuratedPadsForPack(currentPack);

      // Check if we need to promote pending pads to active
      const activeIdxs = Object.keys(activePads).filter(k => activePads[Number(k)]).map(Number);
      const pendingIdxs = Object.keys(pendingPads).filter(k => pendingPads[Number(k)]).map(Number);

      if (pendingIdxs.length > 0 && activeIdxs.length > 0) {
        // Find the first active pad to calculate the sync period
        const firstActiveIdx = activeIdxs[0];
        const firstActivePad = activePadsList[firstActiveIdx];
        if (firstActivePad) {
          const firstTicksPerHit = Math.max(1, 16 / firstActivePad.subdivision);
          const syncPeriod = Math.max(4, firstTicksPerHit); // Sync at least on beat (4 ticks)
          
          if (currentTick % syncPeriod === 0) {
            // It's a synchronization point! We safely promote all pending pads to active
            setActiveLooppads(prev => {
              const next = { ...prev };
              pendingIdxs.forEach(pidx => {
                next[pidx] = true;
              });
              return next;
            });
            setPendingLooppads(prev => {
              const next = { ...prev };
              pendingIdxs.forEach(pidx => {
                delete next[pidx];
              });
              return next;
            });
            
            // Update local mutation copies immediately for this tick callback execution
            pendingIdxs.forEach(pidx => {
              activePads[pidx] = true;
              delete pendingPads[pidx];
            });
          }
        }
      }

      activePadsList.forEach((pad, idx) => {
        if (activePads[idx]) {
          const ticksPerHit = Math.max(1, 16 / pad.subdivision);
          if (currentTick % ticksPerHit === 0) {
            if (synthRef.current && !synthRef.current.disposed) {
              try {
                synthRef.current.triggerAttackRelease(pad.note, "16n", undefined, 0.45);
              } catch (err) {
                console.error("Synthesizer step sequence error:", err);
              }
            }
            
            // Record the triggered pad note if running in record mode
            recordLooperNoteTrigger(pad.category, pad.note, pad.subdivision);
          }
        }
      });

      setLpadIntervalTicks(currentTick % 16);
    }, stepMs);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activePack?.id, activePack?.bpm]);

  // Audio nodes setup
  useEffect(() => {
    // Synth, filter & gater effect setup
    const previewBus = audioEngine.masterHeadroom || Tone.Destination;
    filterRef.current = new Tone.Filter({
      frequency: 2000,
      Q: 1
    }).connect(previewBus);

    synthRef.current = new Tone.PolySynth(Tone.Synth, {
      volume: -14,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.05, decay: 0.1, sustain: 0.3, release: 0.8 }
    }).connect(filterRef.current);

    return () => {
      if (playerRef.current) playerRef.current.dispose();
      if (synthRef.current) synthRef.current.dispose();
      if (filterRef.current) filterRef.current.dispose();
      if (midiPreviewTimeoutRefs.current) {
        midiPreviewTimeoutRefs.current.forEach(clearTimeout);
      }
    };
  }, []);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (midiPreviewTimeoutRefs.current) {
        midiPreviewTimeoutRefs.current.forEach(clearTimeout);
      }
    };
  }, []);

  // Set effect coords changes real-time
  const updateXYEffects = (type: 'filter' | 'gater', x: number, y: number) => {
    if (type === 'filter') {
      const freq = Math.round(50 + x * 8000); // 50Hz to 8050Hz
      const resonance = Math.max(0.1, parseFloat((y * 12).toFixed(1))); // 0.1 to 12
      if (filterRef.current) {
        filterRef.current.frequency.rampTo(freq, 0.05);
        filterRef.current.Q.rampTo(resonance, 0.05);
      }
    } else {
      if (synthRef.current && !synthRef.current.disposed) {
        synthRef.current.set({
          portamento: parseFloat((x * 0.1).toFixed(2))
        });
      }
    }
  };

  const initAudio = async () => {
    if (!audioContextActive.current) {
      if (Tone.context.state !== 'running') {
        await Tone.start();
        try { await (Tone.context.rawContext as AudioContext).resume(); } catch (e) {}
      }
      await audioEngine.init().catch(() => {});
      audioContextActive.current = true;
    }
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePlayPreview = async (sampleId: string, sample: Sample) => {
    await initAudio();

    if (playingId === sampleId) {
      if (playerRef.current) playerRef.current.stop();
      if (midiPreviewTimeoutRefs.current) {
        midiPreviewTimeoutRefs.current.forEach(clearTimeout);
        midiPreviewTimeoutRefs.current = [];
      }
      setPlayingId(null);
      return;
    }

    if (playerRef.current) {
      playerRef.current.stop();
      playerRef.current.dispose();
      playerRef.current = null;
    }
    if (midiPreviewTimeoutRefs.current) {
      midiPreviewTimeoutRefs.current.forEach(clearTimeout);
      midiPreviewTimeoutRefs.current = [];
    }

    setPlayingId(sampleId);

    if (sample.type === 'midi' && sample.notes) {
      const bpm = sample.bpm || 120;
      const stepMs = (60000 / bpm) / 4; // 16th note length in ms

      sample.notes.forEach(note => {
        const timeoutId = setTimeout(() => {
          if (synthRef.current && !synthRef.current.disposed) {
            try {
              synthRef.current.triggerAttackRelease(note.note, (note.duration * stepMs) / 1000, undefined, note.velocity || 0.85);
            } catch (err) {}
          }
        }, note.startTime * stepMs);
        midiPreviewTimeoutRefs.current.push(timeoutId);
      });

      const totalDurationMs = sample.duration16ths * stepMs;
      const resetTimeoutId = setTimeout(() => {
        setPlayingId(null);
      }, totalDurationMs);
      midiPreviewTimeoutRefs.current.push(resetTimeoutId);

    } else if (sample.url) {
      const player = new Tone.Player({
        url: sample.url,
        autostart: true,
        fadeIn: 0.01,
        fadeOut: 0.03,
        volume: -10,
        onload: () => {},
        onstop: () => {
          if (playerRef.current === player) {
            setPlayingId(null);
          }
        }
      }).connect(audioEngine.masterHeadroom || Tone.Destination);
      playerRef.current = player;
    }
  };

  const handleAddSampleToTimeline = (sample: Sample) => {
    let targetTrackId = selectedTrackId;
    const selectedTrack = tracks.find(t => t.id === targetTrackId);

    const isMidi = sample.type === 'midi';

    if (isMidi) {
      if (!selectedTrack || selectedTrack.type !== 'midi') {
        const midiTrack = tracks.find(t => t.type === 'midi');
        if (midiTrack) {
          targetTrackId = midiTrack.id;
        } else {
          addTrack('midi');
          const state = useDawStore.getState();
          targetTrackId = state.selectedTrackId;
        }
      }
    } else {
      if (!selectedTrack || selectedTrack.type !== 'audio') {
        addTrack('audio');
        const state = useDawStore.getState();
        targetTrackId = state.selectedTrackId;
      }
    }

    if (targetTrackId) {
      const currentPos = useDawStore.getState().transportPosition;
      const clipId = useDawStore.getState().addClip(
        targetTrackId, 
        currentPos, 
        isMidi ? undefined : sample.url, 
        undefined, 
        sample.duration16ths, 
        sample.bpm
      );
      
      if (isMidi && sample.notes) {
        useDawStore.getState().updateClip(clipId, { notes: sample.notes });
      }

      setAddedItems(prev => {
        const next = new Set(prev);
        next.add(sample.id);
        return next;
      });

      setTimeout(() => {
        setAddedItems(prev => {
          const next = new Set(prev);
          next.delete(sample.id);
          return next;
        });
      }, 1200);

      // Select and highlight clip for active rendering
      useDawStore.getState().selectClip(clipId);
    }
  };

  // Click Looper pad to toggle sequencer step playback
  const toggleLooperPad = async (index: number) => {
    await initAudio();
    const isCurrentlyActive = !!activeLooppads[index];
    const isCurrentlyPending = !isCurrentlyActive && !!pendingLooppads[index];
    
    if (isCurrentlyActive || isCurrentlyPending) {
      setActiveLooppads(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      setPendingLooppads(prev => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    } else {
      const activeIdxs = Object.keys(activeLooppads).filter(k => activeLooppads[Number(k)]).map(Number);
      if (activeIdxs.length > 0) {
        setPendingLooppads(prev => ({
          ...prev,
          [index]: true
        }));
      } else {
        looperTickRef.current = 0;
        setActiveLooppads(prev => ({
          ...prev,
          [index]: true
        }));
      }
    }
  };

  // Load and apply a full vocal preset
  const applyVocalPreset = (v: VocalPreset) => {
    if (!selectedTrackId) return;
    setIsApplyingVocalPreset(v.id);
    setActivePreset(v);

    setTimeout(() => {
      updateTrack(selectedTrackId, {
        fx: {
          eq: { enabled: true, high: v.settings.high, mid: 2, low: v.settings.low },
          reverb: { enabled: true, decay: v.settings.decay, mix: v.settings.reverbMix },
          delay: { enabled: v.settings.reverbMix > 0.4, time: '8n', feedback: 0.3, mix: 0.2 },
          pitchShift: { enabled: false, pitch: 0 },
          compressor: { enabled: true, threshold: -24, ratio: v.settings.compressorRatio },
          chorus: { enabled: v.portrait !== 'cassette', depth: 0.4, frequency: 1, delayTime: 2.5, wet: 0.4 },
          pitchCorrection: { enabled: v.settings.pitchCorrection, amount: 80, speed: 70, scale: "Minor" }
        }
      });
      setIsApplyingVocalPreset(null);
    }, 400);
  };

  // Dial in dynamic updates as the user drags sliders on the customizer
  const handleTweakSetting = (key: keyof VocalPreset['settings'], val: number | boolean) => {
    if (!activePreset) return;

    const updatedSettings = {
      ...activePreset.settings,
      [key]: val
    };

    const updatedPreset = {
      ...activePreset,
      settings: updatedSettings
    };

    setActivePreset(updatedPreset);

    // Save back to general list so it reflects in real-time
    setVocalPresets(prev => prev.map(p => p.id === activePreset.id ? updatedPreset : p));

    // Instantly map to track FX so they hear the faders changing live
    if (selectedTrackId) {
      updateTrack(selectedTrackId, {
        fx: {
          eq: { enabled: true, high: updatedSettings.high, mid: 2, low: updatedSettings.low },
          reverb: { enabled: true, decay: updatedSettings.decay, mix: updatedSettings.reverbMix },
          delay: { enabled: updatedSettings.reverbMix > 0.4, time: '8n', feedback: 0.3, mix: 0.2 },
          pitchShift: { enabled: false, pitch: 0 },
          compressor: { enabled: true, threshold: -24, ratio: updatedSettings.compressorRatio },
          chorus: { enabled: activePreset.portrait !== 'cassette', depth: 0.4, frequency: 1, delayTime: 2.5, wet: 0.4 },
          pitchCorrection: { enabled: updatedSettings.pitchCorrection, amount: 80, speed: 70, scale: "Minor" }
        }
      });
    }
  };

  const saveVocalPresetChanges = (editedPreset: VocalPreset) => {
    const updated = vocalPresets.map(p => p.id === editedPreset.id ? editedPreset : p);
    setVocalPresets(updated);

    const customOnly = updated.filter(p => !VOCAL_PRESETS.some(original => original.id === p.id));
    localStorage.setItem('custom_vocal_presets', JSON.stringify(customOnly));
    alert(`Preset "${editedPreset.name}" successfully saved to your vocal chains library!`);
  };

  const createNewCustomPreset = () => {
    if (!activePreset) return;
    const newId = `vp_cust_${Date.now()}`;
    const newName = prompt("Enter a unique name for your new vocal preset chain:", `${activePreset.name} (My Tweak)`);
    if (!newName) return;

    const newPreset: VocalPreset = {
      ...activePreset,
      id: newId,
      name: newName,
      category: 'Lead',
      recommendedFor: 'Custom user-saved vocal signature',
      description: 'Dialed in preset chain from my Studio session.',
      settings: { ...activePreset.settings }
    };

    const updated = [newPreset, ...vocalPresets];
    setVocalPresets(updated);

    const customOnly = updated.filter(p => !VOCAL_PRESETS.some(original => original.id === p.id));
    localStorage.setItem('custom_vocal_presets', JSON.stringify(customOnly));
    
    setActivePreset(newPreset);
    alert(`New custom vocal preset "${newName}" generated and added to "My Presets"!`);
  };

  // Generate simulated AI Voice stack setup
  const runAiPresetGeneration = () => {
    if (!selectedTrackId) return;
    setIsApplyingVocalPreset('ai_gen');
    setTimeout(() => {
      updateTrack(selectedTrackId, {
        fx: {
          eq: { enabled: true, high: 4.5, mid: 2.2, low: -3 },
          reverb: { enabled: true, decay: 2.8, mix: 0.45 },
          delay: { enabled: true, time: '8n', feedback: 0.4, mix: 0.25 },
          pitchShift: { enabled: false, pitch: 0 },
          compressor: { enabled: true, threshold: -20, ratio: 10 },
          chorus: { enabled: true, depth: 0.5, frequency: 1.5, delayTime: 3, wet: 0.35 },
          pitchCorrection: { enabled: true, amount: 100, speed: 100, scale: "Minor" }
        }
      });
      setIsApplyingVocalPreset(null);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0a0a0b] overflow-hidden text-[#e0e0e0] font-sans">
      {/* Premium Master Hub Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-zinc-900 bg-black/60 p-3 pb-0 select-none shrink-0">
        <div className="flex items-center gap-2 px-1 py-1 mb-2 sm:mb-0">
          <Library className="text-[#00FF9C]" size={18} />
          <span className="text-xs font-black tracking-widest uppercase bg-gradient-to-r from-[#00FF9C] to-emerald-400 bg-clip-text text-transparent">SOUNDS ENGINE</span>
        </div>

        {/* Global tab options */}
        <div className="flex border-b sm:border-b-0 border-zinc-900 pb-2 sm:pb-0 gap-1 overflow-x-auto scrollbar-hide">
          <button 
            onClick={() => setSubTab('sounds')}
            className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${subTab === 'sounds' ? 'border-[#00FF9C] text-white bg-white/5' : 'border-transparent text-zinc-500 hover:text-zinc-200'}`}
          >
            Loops DB
          </button>
          <button 
            onClick={() => setSubTab('packs')}
            className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${subTab === 'packs' ? 'border-[#00FF9C] text-white bg-white/5' : 'border-transparent text-zinc-500 hover:text-zinc-200'}`}
          >
            Packs Explorer
          </button>
          <button 
            onClick={() => setSubTab('looper')}
            className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${subTab === 'looper' ? 'border-[#00FF9C] text-white bg-white/5' : 'border-transparent text-zinc-500 hover:text-zinc-200'}`}
          >
            Looper Matrix
          </button>
          <button 
            onClick={() => setSubTab('vocals')}
            className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${subTab === 'vocals' ? 'border-[#00FF9C] text-white bg-white/5' : 'border-transparent text-zinc-500 hover:text-zinc-200'}`}
          >
            Vocal Presets
          </button>
        </div>
      </div>

      {/* Main Panel Content Scroll Area */}
      <div className="flex-1 overflow-y-auto bg-[#0a0a0b] relative">
        
        {/* ======================= TABS 1: SOUNDS BROWSER ======================= */}
        {subTab === 'sounds' && (
          <div className="p-4 space-y-6">
            
            {/* Search Sound DB bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3 text-zinc-500" size={15} />
              <input 
                type="text" 
                placeholder="Search global sounds catalog..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#121214] border border-zinc-900 rounded-lg py-2.5 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-[#00FF9C] transition-all"
              />
            </div>

            {/* Sub-tab view buttons */}
            <div className="flex gap-2 border-b border-zinc-900 pb-2">
              <button 
                onClick={() => setSoundSubTab('browse')}
                className={`px-4 py-1.5 rounded-full text-[10px] font-extrabold transition-all ${soundSubTab === 'browse' ? 'bg-[#00FF9C] text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}
              >
                DISCOVER AUDIO
              </button>
              <button 
                onClick={() => setSoundSubTab('samples')}
                className={`px-4 py-1.5 rounded-full text-[10px] font-extrabold transition-all relative ${soundSubTab === 'samples' ? 'bg-[#00FF9C] text-black' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}
              >
                10,000 SAMPLES
                <span className="absolute -top-1 right-0 w-2.5 h-2.5 bg-sky-500 rounded-full border border-black animate-ping" />
              </button>
            </div>

            {soundSubTab === 'browse' ? (
              <div className="space-y-6 animate-fadeIn">
                {/* Palette Generation Try Now card */}
                <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-purple-950 via-zinc-900 to-indigo-950 p-5 border border-purple-900/30 shadow-2xl">
                  <div className="max-w-md space-y-2">
                    <span className="text-[9px] font-black tracking-widest text-[#00FF9C] uppercase bg-black/40 px-2 py-1 rounded">AI CO-CREATOR PRESET</span>
                    <h3 className="text-sm font-black text-white italic">Sound Palette Generator</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Instantly generate synchronized melodic stems & matching looper layers in your chosen genre for immediate inspiration in your project playlist.
                    </p>
                    <button 
                      onClick={() => {
                        let targetId = selectedTrackId || (tracks[0]?.id);
                        if (targetId) {
                          const currentPos = useDawStore.getState().transportPosition;
                          useDawStore.getState().addClip(targetId, currentPos, 'https://tonejs.github.io/audio/drum-samples/breakbeat.mp3', undefined, 16);
                          const state = useDawStore.getState();
                          state.addChatMessage({ role: 'assistant', content: '✨ I have generated a gorgeous matching Breakbeat audio layer suited for your selected track! Feel free to jam with it.' });
                          alert("AI Palette generated! 1 loop layer loaded onto current track timeline.");
                        }
                      }}
                      className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-[10px] px-4 py-2 rounded uppercase tracking-widest shadow-lg shadow-purple-950 transition-all cursor-pointer"
                    >
                      Try Now
                    </button>
                  </div>
                  <div className="absolute right-4 bottom-2 opacity-5 pointer-events-none">
                    <Sparkles size={110} />
                  </div>
                </div>

                {/* Made For You Carousel */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black tracking-widest text-zinc-400 uppercase">MADE FOR YOU DETECTOR</h4>
                    <span className="text-[10px] text-zinc-500 font-bold">Click to Play • Drag to Timeline</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { 
                        title: "Stutter House", 
                        genre: "HOUSE", 
                        bg: "bg-[#2d1b54]", 
                        sample: BANDLAB_SAMPLES.find(s => s.id === 'bs_5') || BANDLAB_SAMPLES[5],
                        typeText: "LOOP"
                      },
                      { 
                        title: "Futuristic House", 
                        genre: "JAY ESKAR", 
                        bg: "bg-[#13505c]", 
                        sample: BANDLAB_SAMPLES.find(s => s.id === 'bs_midi_2') || BANDLAB_SAMPLES[4],
                        typeText: "MIDI BEAT"
                      },
                      { 
                        title: "Pure Ambient House", 
                        genre: "ELECTRONIC", 
                        bg: "bg-[#4d1033]", 
                        sample: BANDLAB_SAMPLES.find(s => s.id === 'bs_midi_3') || BANDLAB_SAMPLES[7],
                        typeText: "MIDI PLUCK"
                      }
                    ].map((item, idx) => {
                      const isPlaying = playingId === item.sample.id;
                      const isAdded = addedItems.has(item.sample.id);
                      return (
                        <div 
                          key={idx} 
                          className={`group relative overflow-hidden rounded-xl bg-zinc-900/40 border p-2 transition-all cursor-pointer ${isPlaying ? 'border-[#00FF9C] bg-zinc-900/90' : 'border-zinc-900 hover:border-zinc-700'}`}
                        >
                          <div 
                            onClick={() => handlePlayPreview(item.sample.id, item.sample)}
                            className={`h-24 rounded-lg bg-cover bg-center ${item.bg} mb-2 flex flex-col items-center justify-center relative overflow-hidden shadow-inner`}
                          >
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 shadow-md ${isPlaying ? 'bg-[#00FF9C] text-black' : 'bg-black/60 text-white hover:bg-black/80'}`}>
                              {isPlaying ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
                            </div>
                            <span className="absolute bottom-1 right-2 text-[8px] font-black text-white uppercase bg-black/70 px-1.5 py-0.5 rounded">
                              {item.typeText}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between gap-1.5 min-w-0">
                            <div className="flex-1 min-w-0">
                              <span className="block text-xs font-black text-zinc-200 truncate group-hover:text-[#00FF9C] transition-colors">{item.title}</span>
                              <span className="block text-[8px] text-zinc-500 uppercase font-mono tracking-tighter">{item.genre} • {item.sample.bpm} BPM</span>
                            </div>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddSampleToTimeline(item.sample);
                              }}
                              className={`p-1.5 rounded bg-zinc-950 border transition-all shrink-0 ${isAdded ? 'border-[#00FF9C] text-[#00FF9C]' : 'border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
                              title="Load onto Timeline"
                            >
                              {isAdded ? <Check size={11} /> : <Plus size={11} />}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* BandLab Picks */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black tracking-widest text-zinc-400 uppercase">BANDLAB CURATED PICKS</h4>
                  <div className="space-y-2">
                    {[
                      { 
                        title: "Hyper Hip Hop Waves", 
                        artist: "Fo'Real Beatz", 
                        desc: "Hip Hop, Pop / Free loop pack", 
                        sample: BANDLAB_SAMPLES.find(s => s.id === 'bs_1') || BANDLAB_SAMPLES[0]
                      },
                      { 
                        title: "The Village Sessions", 
                        artist: "Kash Iyengar", 
                        desc: "Funk, Lofi / Dynamic raw acoustic instrumentals", 
                        sample: BANDLAB_SAMPLES.find(s => s.id === 'bs_2') || BANDLAB_SAMPLES[1]
                      },
                      { 
                        title: "Degraw Sound Presents Indie Rock", 
                        artist: "Indie Rockers", 
                        desc: "Raw rock guitars / Heavy live performance kits", 
                        sample: BANDLAB_SAMPLES.find(s => s.id === 'bs_6') || BANDLAB_SAMPLES[6]
                      }
                    ].map((pick, id) => {
                      const isPlaying = playingId === pick.sample.id;
                      const isAdded = addedItems.has(pick.sample.id);
                      return (
                        <div 
                          key={id} 
                          className={`flex items-center justify-between p-3 border rounded-lg transition-all ${isPlaying ? 'border-[#00FF9C] bg-zinc-900/40' : 'bg-[#0e0e10]/40 border-zinc-900 hover:border-zinc-800'}`}
                        >
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => handlePlayPreview(pick.sample.id, pick.sample)}
                              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${isPlaying ? 'bg-[#00FF9C] text-black border-[#00FF9C]' : 'bg-zinc-900 border-zinc-800 text-white hover:bg-zinc-800'}`}
                            >
                              {isPlaying ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" className="ml-0.5" />}
                            </button>
                            <div>
                              <span className="block text-xs font-extrabold text-white">{pick.title}</span>
                              <span className="block text-[10px] text-zinc-500">{pick.artist} • {pick.desc}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAddSampleToTimeline(pick.sample)}
                              className={`px-2.5 py-1 text-[9px] font-black uppercase rounded border transition-all ${isAdded ? 'border-[#00FF9C] text-[#00FF9C] bg-[#00FF9C]/5' : 'bg-transparent border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900'}`}
                            >
                              {isAdded ? "ADDED" : "+ ADD"}
                            </button>
                            <span className="text-[9px] px-2 py-0.5 font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded uppercase">
                              Free
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            ) : (
              // 10,000 Samples detailed list (Image 8 style)
              <div className="space-y-3 animate-fadeIn">
                <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
                  <span>{allSamples.length.toLocaleString()} samples loaded</span>
                  <span className="flex items-center gap-1">Sort: <strong className="text-zinc-300 cursor-pointer">Random ▾</strong></span>
                </div>

                <div className="space-y-2.5">
                  {allSamples.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.category.toLowerCase().includes(searchQuery.toLowerCase())).map((sample) => {
                    const isFav = favorites.has(sample.id);
                    const isAdded = addedItems.has(sample.id);
                    return (
                      <div 
                        key={sample.id}
                        className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-900 hover:border-zinc-800 rounded-lg transition-all"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Play/Pause Button */}
                          <button 
                            onClick={() => handlePlayPreview(sample.id, sample)}
                            className={`w-9 h-9 rounded flex items-center justify-center border transition-all ${playingId === sample.id ? 'bg-[#00FF9C] text-black border-[#00FF9C]' : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800'}`}
                          >
                            {playingId === sample.id ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" className="ml-0.5" />}
                          </button>

                          {/* Detail / Waveform representation */}
                          <div className="flex-1 min-w-0">
                            <span className="block text-xs font-extrabold text-zinc-200 truncate">{sample.name}</span>
                            
                            {/* Waveforms & subdivisions representation */}
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[9px] px-1 bg-zinc-900 border border-zinc-800/80 rounded text-zinc-400 font-bold uppercase">{sample.key}</span>
                              
                              {/* Waveform graphic bars representation */}
                              <div className="flex items-end gap-[1.5px] h-3 px-1 border-l border-zinc-800">
                                {[3, 6, 8, 4, 10, 12, 5, 8, 3, 7, 11, 4, 6].map((h, i) => (
                                  <div 
                                    key={i} 
                                    className={`w-[1px] rounded-full transition-all ${playingId === sample.id ? 'bg-[#00FF9C] animate-pulse' : 'bg-zinc-700'}`}
                                    style={{ height: `${h}px` }} 
                                  />
                                ))}
                              </div>
                              <span className="text-[9px] text-zinc-500 font-mono tracking-tighter">
                                {sample.duration16ths === 4 ? '00:01' : `${sample.duration16ths / 4} bars`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions buttons */}
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={(e) => toggleFavorite(sample.id, e)}
                            className="p-1.5 text-zinc-500 hover:text-amber-400 transition-colors"
                          >
                            <Star size={14} fill={isFav ? "currentColor" : "transparent"} className={isFav ? "text-amber-400" : ""} />
                          </button>
                          <button 
                            onClick={() => handleAddSampleToTimeline(sample)}
                            className={`p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all ${isAdded ? 'border-[#00FF9C] text-[#00FF9C]' : ''}`}
                            title="Add to Track timeline"
                          >
                            {isAdded ? <Check size={14} /> : <Plus size={14} />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ======================= TABS 2: PACKS EXPLORER ======================= */}
        {subTab === 'packs' && (
          <div className="p-4 space-y-6">
            
            {/* Filter Tags bar from Image 4 */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              <button className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white shrink-0 scrollbar-hide">🕒</button>
              <button 
                onClick={() => setSelectedGenre(null)}
                className={`px-3 py-1 border rounded-lg text-xs font-semibold shrink-0 transition-all ${selectedGenre === null ? 'bg-[#00FF9C] text-black border-[#00FF9C]' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}
              >
                Starred
              </button>
              <button 
                onClick={() => setSelectedGenre('Amapiano')}
                className={`px-3 py-1 border rounded-lg text-xs font-semibold shrink-0 transition-all ${selectedGenre === 'Amapiano' ? 'bg-[#00FF9C] text-black border-[#00FF9C]' : 'bg-zinc-900 text-zinc-400 border-zinc-800'}`}
              >
                Genre {selectedGenre === 'Amapiano' && '●'}
              </button>
              <button className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white shrink-0">Character</button>
              <button className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white shrink-0">Key</button>
              <button className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white shrink-0">BPM</button>
            </div>

            {/* Huge Pop & Bop Spotlight Banner (Image 5) */}
            {!selectedGenre && (
              <div className="relative h-44 rounded-xl overflow-hidden group border border-zinc-800/30 animate-fadeIn">
                <div className="absolute inset-0 bg-gradient-to-r from-yellow-500 via-pink-600 to-indigo-900 opacity-80" />
                <div className="absolute inset-0 bg-black/30" />
                <div className="absolute inset-0 p-5 flex flex-col justify-end text-white z-10 space-y-2">
                  <span className="text-[10px] uppercase font-black tracking-widest text-[#00FF9C] bg-black/60 px-2 py-0.5 rounded-full w-max">Pop & Bop Packs</span>
                  <h3 className="text-xl font-black italic tracking-tight leading-none text-white shadow-sm">Top of Pop</h3>
                  <span className="text-[11px] text-zinc-200">15 Premium loop templates assembled ready</span>
                  <button 
                    onClick={() => {
                      const samplePack = LOOPER_PACKS[LOOPER_PACKS.length - 1]; // Kpop pack
                      setActivePack(samplePack);
                      setSubTab('looper');
                      alert(`Spotlight pack "${samplePack.name}" explored! Opening in Looper Grid Matrix.`);
                    }}
                    className="w-max bg-white text-black font-extrabold text-[10px] px-4 py-2 rounded-full uppercase tracking-wider hover:bg-neutral-100 transition-all active:scale-95 cursor-pointer shadow-lg mt-1"
                  >
                    Explore Pack
                  </button>
                </div>
                {/* Simulated circle play background */}
                <div className="absolute right-6 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white/10 hover:bg-white/20 transition-all flex items-center justify-center">
                  <Play size={24} className="text-white ml-1" />
                </div>
              </div>
            )}

            {/* List Header */}
            <div>
              <h4 className="text-xs font-black tracking-widest text-zinc-400 uppercase mb-3">Looper Packs</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {LOOPER_PACKS.filter(p => !selectedGenre || p.genre === selectedGenre).map((pack) => (
                  <div 
                    key={pack.id}
                    className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-900 rounded-xl hover:border-zinc-800 hover:bg-zinc-900/10 transition-colors select-none cursor-pointer"
                    onClick={() => {
                      setActivePack(pack);
                      setSubTab('looper');
                    }}
                  >
                    {/* Visual Art Box resembling Image 4 covers */}
                    <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${pack.coverColor} flex items-center justify-center shadow-lg relative group transition-transform hover:scale-105 shrink-0`}>
                      <Play size={16} className="text-white drop-shadow-[0_2px_4px_black] group-hover:scale-115 transition-transform" />
                      {pack.isPopular && (
                        <span className="absolute -top-1.5 -right-1.5 text-[8px] bg-sky-500 font-extrabold text-white px-1.5 py-0.5 rounded-full border border-zinc-950">
                          HOT
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="block text-xs font-black text-zinc-100 truncate">{pack.name}</span>
                      <span className="block text-[10px] text-zinc-500 uppercase tracking-tighter mt-0.5">
                        {pack.bpm} BPM • {pack.key} • {pack.genre} 
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={(e) => toggleFavorite(pack.id, e)}
                        className="p-1.5 text-zinc-500 hover:text-amber-400 transition-colors"
                      >
                        <Star size={14} fill={favorites.has(pack.id) ? "currentColor" : "transparent"} className={favorites.has(pack.id) ? "text-amber-400" : ""} />
                      </button>
                      <button 
                        onClick={() => {
                          setActivePack(pack);
                          setSubTab('looper');
                        }}
                        className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:text-white transition-all text-[#00FF9C]"
                        title="Open Looper matrix"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* ======================= TABS 3: LOOPER GRID & XY EFFECTS ======================= */}
        {subTab === 'looper' && (
          <div className="p-4 space-y-4 animate-fadeIn">
            
            {/* Active looper pack descriptor header (Image 3) */}
            <div className="flex items-center justify-between bg-zinc-900/30 border border-zinc-900 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#00FF9C]" />
                <div>
                  <span className="block text-[10px] uppercase font-black tracking-widest text-[#00FF9C]">ACTIVE LOOPER PACK</span>
                  <span className="block text-xs font-extrabold text-white hover:underline cursor-pointer" onClick={() => setSubTab('packs')}>
                    {activePack.name} ›
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleToggleRecordingLoops}
                  className={`text-[9px] px-3 py-1.5 font-black uppercase rounded-md flex items-center gap-1.5 transition-all cursor-pointer ${
                    isRecordingLoops 
                      ? 'bg-red-500 text-white shadow-lg shadow-red-950/50 animate-pulse' 
                      : 'bg-zinc-900 text-red-500 border border-zinc-850 hover:bg-neutral-800'
                  }`}
                  title="Record pad loops directly to timelines in real-time"
                >
                  <div className={`w-1.5 h-1.5 rounded-full ${isRecordingLoops ? 'bg-white animate-ping' : 'bg-red-505'}`} style={{ backgroundColor: isRecordingLoops ? 'white' : '#ef4444' }} />
                  {isRecordingLoops ? 'RECORDING LOOPS' : 'RECORD LOOPS'}
                </button>

                <button 
                  onClick={() => setXyEnabled(!xyEnabled)}
                  className={`text-[9px] px-3 py-1.5 font-bold uppercase rounded-md flex items-center gap-1 transition-all ${xyEnabled ? 'bg-[#00FF9C] text-black shadow-lg shadow-emerald-950' : 'bg-zinc-900 text-zinc-400 border border-zinc-800'}`}
                >
                  <Sliders size={11} /> {xyEnabled ? 'Close FX' : '+FX Pads'}
                </button>
              </div>
            </div>

            {/* Standard Looper grid trigger grid triggers */}
            {!xyEnabled ? (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-2.5">
                  {LOOPER_PADS.map((pad, idx) => {
                    const isActive = !!activeLooppads[idx];
                    const isPending = !isActive && !!pendingLooppads[idx];
                    return (
                      <button
                        key={idx}
                        onClick={() => toggleLooperPad(idx)}
                        className={`group relative h-20 rounded-xl border flex flex-col justify-between p-2.5 text-left transition-all ${pad.colorClass} ${
                          isActive 
                            ? 'ring-2 ring-[#00FF9C] scale-95 shadow-lg shadow-black/60' 
                            : isPending
                              ? 'ring-2 ring-yellow-400 scale-95 animate-pulse shadow-lg shadow-black/50'
                              : 'opacity-80 hover:opacity-100 shadow-inner'
                        }`}
                      >
                        {/* Inner spinner/circular looper progress based on subdivision */}
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[8px] font-black tracking-widest uppercase text-white/50">{pad.category}</span>
                          
                          {/* Circle play animation widget matching Image 3 loops progress circle */}
                          <div 
                            className={`w-3.5 h-3.5 rounded-full border border-dashed flex items-center justify-center ${
                              isActive 
                                ? 'border-[#00FF9C] animate-spin' 
                                : isPending
                                  ? 'border-yellow-400 animate-pulse'
                                  : 'border-white/20'
                            }`} 
                            style={{ animationDuration: `${pad.subdivision * 500}ms` }}
                          >
                            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-[#00FF9C]" />}
                            {isPending && <div className="w-1.5 h-1.5 rounded-full bg-yellow-400" />}
                          </div>
                        </div>

                        {/* Text and key */}
                        <div className="space-y-0.5">
                          <span className="block text-[10px] font-black text-white leading-none whitespace-pre-wrap">{pad.label}</span>
                          <span className="block text-[8px] opacity-40 font-mono tracking-tighter leading-none">
                            {pad.note} {isPending && '• SYNCING'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="bg-zinc-950/40 p-3 rounded-lg border border-zinc-900 flex justify-between items-center text-[10px] text-zinc-500">
                  <span>💡 Loops lock to transport BPM & play back MIDI Synths.</span>
                  <button 
                    onClick={() => setActiveLooppads({})}
                    className="text-red-400 hover:text-red-300 font-extrabold uppercase"
                  >
                    Mute All
                  </button>
                </div>
              </div>
            ) : (
              // XY PAD View (Image 1) Filter vs Gater
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                
                {/* 1. FILTER (Cutoff vs Resonance) and drag handle */}
                <div className="bg-[#0f2a40] rounded-xl border border-blue-900/50 p-4 flex flex-col space-y-2 relative h-80 overflow-hidden">
                  <div className="flex items-center justify-between z-10">
                    <div>
                      <span className="block text-[10px] uppercase font-black text-blue-300">XY PAD 1</span>
                      <h4 className="text-xs font-black text-white italic">Filter Effect</h4>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 bg-black/40 px-2 py-0.5 rounded">
                      Cutoff: {Math.round(50 + xyPadFilterCoords.x * 8000)}Hz
                    </span>
                  </div>

                  {/* Dot Plot Drag Area */}
                  <div 
                    className="flex-1 bg-[#0b1c2b] rounded-lg relative cursor-crosshair border border-blue-950 select-none"
                    onPointerDown={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const updateHandler = (pv: PointerEvent) => {
                        const nextX = Math.min(1, Math.max(0, (pv.clientX - rect.left) / rect.width));
                        const nextY = Math.min(1, Math.max(0, 1 - (pv.clientY - rect.top) / rect.height));
                        setXyPadFilterCoords({ x: nextX, y: nextY });
                        updateXYEffects('filter', nextX, nextY);
                      };
                      
                      const upHandler = () => {
                        window.removeEventListener('pointermove', updateHandler);
                        window.removeEventListener('pointerup', upHandler);
                      };
                      window.addEventListener('pointermove', updateHandler);
                      window.addEventListener('pointerup', upHandler);
                      updateHandler(e.nativeEvent);
                    }}
                  >
                    {/* Grid Pattern Dots */}
                    <div className="absolute inset-0 bg-[radial-gradient(#1e3a5f_1px,transparent_1px)] [background-size:12px_12px] opacity-40" />
                    
                    {/* XY Drag Handler Coordinate glowing cursor */}
                    <div 
                      className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-cyan-400 shadow-[0_0_15px_#22d3ee] border-2 border-white pointer-events-none flex items-center justify-center flex-col transition-all"
                      style={{ left: `${xyPadFilterCoords.x * 100}%`, top: `${(1 - xyPadFilterCoords.y) * 100}%` }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-950" />
                    </div>

                    <div className="absolute bottom-2 left-2 text-[9px] uppercase tracking-wider text-blue-400/60 font-mono font-bold">Resonance (Y axis)</div>
                    <div className="absolute top-2 right-2 text-[9px] uppercase tracking-wider text-blue-400/60 font-mono font-bold">Cutoff (X axis)</div>
                  </div>
                </div>

                {/* 2. GATER (Depth vs Rate) in Rich Purple */}
                <div className="bg-[#2a0e3b] rounded-xl border border-purple-900/50 p-4 flex flex-col space-y-2 relative h-80 overflow-hidden">
                  <div className="flex items-center justify-between z-10">
                    <div>
                      <span className="block text-[10px] uppercase font-black text-purple-300">XY PAD 2</span>
                      <h4 className="text-xs font-black text-white italic">Gater / Envelope</h4>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 bg-black/40 px-2 py-0.5 rounded">
                      Depth: {Math.round(xyPadGaterCoords.y * 100)}%
                    </span>
                  </div>

                  {/* Dot Plot Drag Area */}
                  <div 
                    className="flex-1 bg-[#1e072b] rounded-lg relative cursor-crosshair border border-purple-950 select-none"
                    onPointerDown={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const updateHandler = (pv: PointerEvent) => {
                        const nextX = Math.min(1, Math.max(0, (pv.clientX - rect.left) / rect.width));
                        const nextY = Math.min(1, Math.max(0, 1 - (pv.clientY - rect.top) / rect.height));
                        setXyPadGaterCoords({ x: nextX, y: nextY });
                        updateXYEffects('gater', nextX, nextY);
                      };
                      
                      const upHandler = () => {
                        window.removeEventListener('pointermove', updateHandler);
                        window.removeEventListener('pointerup', upHandler);
                      };
                      window.addEventListener('pointermove', updateHandler);
                      window.addEventListener('pointerup', upHandler);
                      updateHandler(e.nativeEvent);
                    }}
                  >
                    {/* Grid Pattern Dots */}
                    <div className="absolute inset-0 bg-[radial-gradient(#4a2060_1px,transparent_1px)] [background-size:12px_12px] opacity-40" />
                    
                    {/* XY Drag Handler Coordinate glowing cursor pink */}
                    <div 
                      className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full bg-pink-400 shadow-[0_0_15px_#f472b6] border-2 border-white pointer-events-none flex items-center justify-center flex-col transition-all"
                      style={{ left: `${xyPadGaterCoords.x * 100}%`, top: `${(1 - xyPadGaterCoords.y) * 100}%` }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-purple-950" />
                    </div>

                    <div className="absolute bottom-2 left-2 text-[9px] uppercase tracking-wider text-purple-400/60 font-mono font-bold">Rate (Y axis)</div>
                    <div className="absolute top-2 right-2 text-[9px] uppercase tracking-wider text-purple-400/60 font-mono font-bold">Depth (X axis)</div>
                  </div>
                </div>

              </div>
            )}

          </div>
        )}

        {/* ======================= TABS 4: VOCAL PRESETS ======================= */}
        {subTab === 'vocals' && (
          <div className="p-4 space-y-4 animate-fadeIn">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Vocal Presets Grid Browser */}
              <div className="lg:col-span-7 space-y-4">
                {/* Nav tabs for Vocal Presets */}
                <div className="flex gap-2 border-b border-zinc-900 pb-2">
                  <button 
                    onClick={() => setVocalSubTab('my')}
                    className={`py-1 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${vocalSubTab === 'my' ? 'border-[#00FF9C] text-white' : 'border-transparent text-zinc-500 hover:text-zinc-200'}`}
                  >
                    My Presets
                  </button>
                  <button 
                    onClick={() => setVocalSubTab('new')}
                    className={`py-1 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all relative ${vocalSubTab === 'new' ? 'border-[#00FF9C] text-white' : 'border-transparent text-zinc-500 hover:text-zinc-200'}`}
                  >
                    All Presets
                  </button>
                  <button 
                    onClick={() => setVocalSubTab('rec')}
                    className={`py-1 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${vocalSubTab === 'rec' ? 'border-[#00FF9C] text-white' : 'border-transparent text-zinc-500 hover:text-zinc-200'}`}
                  >
                    Recommended
                  </button>
                  <button 
                    onClick={() => setVocalSubTab('trend')}
                    className={`py-1 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${vocalSubTab === 'trend' ? 'border-[#00FF9C] text-white' : 'border-transparent text-zinc-500 hover:text-zinc-200'}`}
                  >
                    Trending
                  </button>
                </div>

                {/* Vocal cards grid */}
                <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {vocalPresets
                    .filter((p) => {
                      if (vocalSubTab === 'my') {
                        // Custom presets only (those that are not default VOCAL_PRESETS)
                        return !VOCAL_PRESETS.some(original => original.id === p.id);
                      }
                      if (vocalSubTab === 'rec') {
                        return p.category === 'Lead' || p.category === 'Vibe';
                      }
                      if (vocalSubTab === 'trend') {
                        return p.category === 'Filter' || p.category === 'Saturate' || p.category === 'Pitch' || p.category === 'Sub';
                      }
                      return true; // All Presets
                    })
                    .map((p) => {
                      const isApplying = isApplyingVocalPreset === p.id;
                      const isSelected = activePreset?.id === p.id;
                      return (
                        <div 
                          key={p.id}
                          onClick={() => applyVocalPreset(p)}
                          className={`group relative overflow-hidden rounded-xl border p-2.5 transition-all select-none cursor-pointer flex flex-col justify-between space-y-2 text-left bg-zinc-950/40 ${isSelected ? 'border-[#00FF9C] bg-zinc-900/30 font-bold' : 'border-zinc-900 hover:border-zinc-700'}`}
                        >
                          {/* Visual Art Cover mimicking Image 2 cassete & singer graphics */}
                          <div className={`h-24 rounded-lg flex flex-col items-center justify-center relative overflow-hidden shadow-inner transition-transform group-hover:scale-102 ${isSelected ? 'bg-[#3b124d]' : 'bg-[#180a22]'}`}>
                            {p.portrait === 'cassette' ? (
                              <div className="w-14 h-8 bg-amber-500 border border-amber-600 rounded flex flex-col justify-between p-1 shadow-md">
                                <div className="h-1.5 bg-zinc-900 rounded" />
                                <div className="flex justify-around items-center h-3">
                                  <div className="w-2.5 h-2.5 rounded-full border border-zinc-900 bg-zinc-100" />
                                  <div className="w-2.5 h-2.5 rounded-full border border-zinc-900 bg-zinc-100" />
                                </div>
                                <div className="h-1 bg-zinc-900 rounded" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full border-2 border-[#00FF9C]/40 bg-gradient-to-tr from-fuchsia-500 to-[#00FF9C] relative overflow-hidden">
                                <div className="absolute inset-x-1.5 bottom-0 h-6 bg-zinc-950 opacity-90 rounded-t-lg" />
                                <div className="absolute top-1.5 left-2.5 w-5 h-3.5 bg-zinc-300 rounded-full" />
                              </div>
                            )}
                            
                            <span className="absolute bottom-1 right-2 text-[6px] bg-black/60 text-zinc-300 font-bold uppercase tracking-wider px-1 rounded-sm">
                              {VOCAL_PRESETS.some(original => original.id === p.id) ? 'DEFAULT' : 'MY TWEAK'}
                            </span>
                          </div>

                          <div>
                            <span className="block text-xs font-black text-zinc-100 truncate group-hover:text-[#00FF9C] transition-colors">{p.name}</span>
                            <span className="block text-[8.5px] text-zinc-500 truncate leading-relaxed">{p.recommendedFor}</span>
                          </div>

                          {isApplying && (
                            <div className="absolute inset-0 bg-black/80 flex items-center justify-center flex-col space-y-1 rounded-xl">
                              <div className="w-3 h-3 border-2 border-[#00FF9C] border-t-transparent rounded-full animate-spin" />
                              <span className="text-[8px] font-black uppercase text-[#00FF9C]">Applying...</span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {vocalSubTab === 'my' && vocalPresets.filter(p => !VOCAL_PRESETS.some(original => original.id === p.id)).length === 0 && (
                    <div className="col-span-full py-8 text-center bg-zinc-950/20 border border-dashed border-zinc-900 rounded-xl space-y-2">
                      <p className="text-zinc-500 text-[10px]">No customized preset chains found.</p>
                      <p className="text-[#00FF9C] text-[9px] font-bold">Tweak any default preset faders on the right side and click "Save Tweak"!</p>
                    </div>
                  )}
                </div>

                {/* Vocal Bottom Buttons */}
                <div className="pt-4 border-t border-zinc-900 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <button 
                    onClick={runAiPresetGeneration}
                    className="relative overflow-hidden group bg-[#111114] hover:bg-[#15151b] border border-zinc-800 active:scale-98 rounded-full py-2.5 px-6 font-extrabold text-[10px] tracking-widest uppercase flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Sparkles size={12} className="text-[#00FF9C] animate-pulse" />
                    <span className="bg-gradient-to-r from-teal-400 to-[#00FF9C] bg-clip-text text-transparent">Generate AI Preset</span>
                    {isApplyingVocalPreset === 'ai_gen' && (
                      <div className="absolute inset-0 bg-black/90 flex items-center justify-center">
                        <span className="text-[9px] font-black text-[#00FF9C] animate-pulse">AI PROCESSING...</span>
                      </div>
                    )}
                  </button>

                  <button 
                    onClick={createNewCustomPreset}
                    className="bg-[#222] hover:bg-[#333] active:scale-95 text-white border border-zinc-800 py-2.5 px-6 font-extrabold text-[10px] tracking-widest uppercase rounded-full transition-all cursor-pointer"
                  >
                    + Create Preset
                  </button>
                </div>
              </div>

              {/* Right Column: 🛠️ Vocal Preset Settings Customizer */}
              <div className="lg:col-span-5 bg-[#0d0d0f] border border-zinc-900 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                  <div className="flex items-center gap-2">
                    <Sliders size={12} className="text-[#00FF9C]" />
                    <h4 className="text-[10px] uppercase font-black text-white tracking-widest">CHAIN CUSTOMIZER</h4>
                  </div>
                  {activePreset && !VOCAL_PRESETS.some(original => original.id === activePreset.id) && (
                    <span className="text-[8px] bg-[#00FF9C]/10 text-[#00FF9C] font-bold px-1.5 py-0.5 rounded border border-[#00FF9C]/20 uppercase">
                      Custom Library
                    </span>
                  )}
                </div>

                {activePreset ? (
                  <div className="space-y-4 animate-fadeIn">
                    
                    {/* Preset info */}
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[8px] font-black uppercase text-zinc-500 tracking-wider mb-1">Preset Name</label>
                        <input 
                          type="text"
                          value={activePreset.name}
                          onChange={(e) => {
                            const updated = { ...activePreset, name: e.target.value };
                            setActivePreset(updated);
                            setVocalPresets(prev => prev.map(p => p.id === activePreset.id ? updated : p));
                          }}
                          className="w-full bg-zinc-950/85 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#00FF9C]"
                          placeholder="My Custom Preset..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] font-black uppercase text-zinc-500 tracking-wider mb-1">Category</label>
                          <select 
                            value={activePreset.category}
                            onChange={(e) => {
                              const updated = { ...activePreset, category: e.target.value };
                              setActivePreset(updated);
                              setVocalPresets(prev => prev.map(p => p.id === activePreset.id ? updated : p));
                            }}
                            className="w-full bg-zinc-950/85 border border-zinc-800 rounded px-2 py-1 text-[10px] outline-none text-zinc-300"
                          >
                            <option value="Lead">Lead Vocal</option>
                            <option value="Vibe">Vibe Vocal</option>
                            <option value="Filter">Filter Vocal</option>
                            <option value="Saturate">Saturate FX</option>
                            <option value="Pitch">Pitch Correction</option>
                            <option value="Sub">Sub Vocal</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[8px] font-black uppercase text-zinc-500 tracking-wider mb-1">Cover Art Template</label>
                          <select 
                            value={activePreset.portrait}
                            onChange={(e) => {
                              const updated = { ...activePreset, portrait: e.target.value };
                              setActivePreset(updated);
                              setVocalPresets(prev => prev.map(p => p.id === activePreset.id ? updated : p));
                            }}
                            className="w-full bg-zinc-950/85 border border-zinc-800 rounded px-2 py-1 text-[10px] outline-none text-zinc-300"
                          >
                            <option value="portrait_1">Artist Hot Pink</option>
                            <option value="portrait_2">Artist Cobalt</option>
                            <option value="portrait_3">Artist Emerald</option>
                            <option value="cassette">Legendary Gold Cassette</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Tweak Sliders */}
                    <div className="space-y-3.5 bg-zinc-950/20 p-3 rounded-xl border border-zinc-900/60">
                      
                      {/* Reverb mix */}
                      <div>
                        <div className="flex justify-between items-center text-[9px] mb-1.5 font-bold">
                          <span className="text-zinc-400">REVERB WET MIX</span>
                          <span className="text-[#00FF9C] font-mono">{(activePreset.settings.reverbMix * 100).toFixed(0)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="0" 
                          max="1" 
                          step="0.05"
                          value={activePreset.settings.reverbMix}
                          onChange={(e) => handleTweakSetting('reverbMix', parseFloat(e.target.value))}
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#00FF9C]"
                        />
                      </div>

                      {/* Reverb decay */}
                      <div>
                        <div className="flex justify-between items-center text-[9px] mb-1.5 font-bold">
                          <span className="text-zinc-400">REVERB DECAY TIME</span>
                          <span className="text-[#00FF9C] font-mono">{activePreset.settings.decay.toFixed(1)} seconds</span>
                        </div>
                        <input 
                          type="range" 
                          min="0.5" 
                          max="8" 
                          step="0.1"
                          value={activePreset.settings.decay}
                          onChange={(e) => handleTweakSetting('decay', parseFloat(e.target.value))}
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#00FF9C]"
                        />
                      </div>

                      {/* EQ high shelf */}
                      <div>
                        <div className="flex justify-between items-center text-[9px] mb-1.5 font-bold">
                          <span className="text-zinc-400">EQ HIGH BRIGHTNESS</span>
                          <span className="text-[#00FF9C] font-mono">{activePreset.settings.high > 0 ? `+${activePreset.settings.high}` : activePreset.settings.high} dB</span>
                        </div>
                        <input 
                          type="range" 
                          min="-12" 
                          max="12" 
                          step="1"
                          value={activePreset.settings.high}
                          onChange={(e) => handleTweakSetting('high', parseInt(e.target.value))}
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#00FF9C]"
                        />
                      </div>

                      {/* EQ Low shelf */}
                      <div>
                        <div className="flex justify-between items-center text-[9px] mb-1.5 font-bold">
                          <span className="text-zinc-400">EQ LOW WARMTH</span>
                          <span className="text-[#00FF9C] font-mono">{activePreset.settings.low > 0 ? `+${activePreset.settings.low}` : activePreset.settings.low} dB</span>
                        </div>
                        <input 
                          type="range" 
                          min="-12" 
                          max="12" 
                          step="1"
                          value={activePreset.settings.low}
                          onChange={(e) => handleTweakSetting('low', parseInt(e.target.value))}
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#00FF9C]"
                        />
                      </div>

                      {/* Compressor ratio */}
                      <div>
                        <div className="flex justify-between items-center text-[9px] mb-1.5 font-bold">
                          <span className="text-zinc-400">COMPRESSOR RATIO</span>
                          <span className="text-[#00FF9C] font-mono">{activePreset.settings.compressorRatio}:1 Compression</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="20" 
                          step="1"
                          value={activePreset.settings.compressorRatio}
                          onChange={(e) => handleTweakSetting('compressorRatio', parseInt(e.target.value))}
                          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#00FF9C]"
                        />
                      </div>

                      {/* Auto Autotune */}
                      <div className="flex items-center justify-between py-1 bg-zinc-900/35 px-2.5 rounded-lg border border-zinc-800/40">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase">Speedy Autotune Pitch Correction</span>
                        <button 
                          onClick={() => handleTweakSetting('pitchCorrection', !activePreset.settings.pitchCorrection)}
                          className={`w-9 h-5 rounded-full relative transition-colors ${activePreset.settings.pitchCorrection ? 'bg-[#00FF9C]' : 'bg-zinc-800'}`}
                        >
                          <div className={`w-3.5 h-3.5 bg-black rounded-full absolute top-[3px] transition-all ${activePreset.settings.pitchCorrection ? 'right-1' : 'left-1'}`} />
                        </button>
                      </div>

                    </div>

                    {/* Top Action Row to Save or Tweak */}
                    <div className="flex gap-2">
                      <button 
                        onClick={() => saveVocalPresetChanges(activePreset)}
                        className="flex-1 bg-[#00FF9C]/15 text-[#00FF9C] hover:bg-[#00FF9C]/25 border border-[#00FF9C]/35 py-2 rounded-lg font-extrabold text-[10px] tracking-wide uppercase transition-all flex items-center justify-center gap-1 cursor-pointer font-bold"
                      >
                        <Save size={12} /> Save Tweak Chain
                      </button>
                    </div>

                  </div>
                ) : (
                  <div className="py-20 text-center font-bold text-zinc-500 text-[10px]">
                    Select any vocal preset card on the left side to load its custom parameters customizer faders!
                  </div>
                )}
              </div>

            </div>

            {/* Notifications and states warning banner */}
            {selectedTrackId ? (
              <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg">
                <Check size={14} className="text-emerald-400 flex-shrink-0" />
                <span className="text-[10px] leading-relaxed text-emerald-400">
                  Selecting a preset maps directly onto your active track vocal matrix chain in real-time. Feel free to tweak parameters in the Effects panel.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
                <SlidersHorizontal size={14} className="text-amber-400 flex-shrink-0" />
                <span className="text-[10px] leading-relaxed text-amber-500">
                  Select a vocal audio track first to directly load these presets onto its active effect channels.
                </span>
              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
}