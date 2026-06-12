// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Play, Square, Pause, Mic, Headphones, Undo2, Redo2, FolderOpen, User, Bell, ChevronDown, Menu, LogOut, FileDown, ExternalLink, Box, Sparkles, Share2, Loader2, Cpu, FileAudio, Layers, Bot } from 'lucide-react';
import { useDawStore } from '../../store/useDawStore';
import { audioEngine, toggleGlobalRecording } from '../../audio/engine';
import { supabase } from '../../lib/supabase';
import * as Tone from 'tone';
import { AuthModal } from './AuthModal';
import { ProjectsModal } from './ProjectsModal';
import { UpgradesHubModal } from './UpgradesHubModal';
import { KEYS_LIST, SCALES } from '../../lib/scales';
import { useNavigate } from 'react-router-dom';

import { IOSettingsModal } from './IOSettingsModal';
import { AudioEngineSelectorModal } from './AudioEngineSelectorModal';
import { separateStems, bufferToWav } from '../../utils/stemSeparator';

export function TopBar({ onHome }: { onHome?: () => void }) {
  const bpm = useDawStore(s => s.bpm);
  const playbackState = useDawStore(s => s.playbackState);
  const isRecording = useDawStore(s => s.isRecording);
  const recordingCountdown = useDawStore(s => s.recordingCountdown);
  const [peak, setPeak] = useState(0);
  const [tapTimes, setTapTimes] = useState<number[]>([]);

  const handleTapTempo = () => {
    const now = Date.now();
    let newTimes = [...tapTimes];

    // If the last tap was more than 2 seconds ago, treat this as a new first tap
    if (newTimes.length > 0 && now - newTimes[newTimes.length - 1] > 2000) {
      newTimes = [now];
    } else {
      newTimes = [...newTimes, now].slice(-5); // keep max 5 timestamps for responsive averaging
    }

    if (newTimes.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < newTimes.length; i++) {
        intervals.push(newTimes[i] - newTimes[i - 1]);
      }
      const avgInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
      const calculatedBpm = Math.round(60000 / avgInterval);
      if (calculatedBpm >= 30 && calculatedBpm <= 300) {
        setBpm(calculatedBpm);
      }
    }

    setTapTimes(newTimes);
  };

  useEffect(() => {
    let frame: number;
    const updateMeter = () => {
       const selectedTrackId = useDawStore.getState().selectedTrackId;
       if (selectedTrackId) {
         setPeak(audioEngine.getTrackLevel(selectedTrackId));
       } else {
         setPeak(0);
       }
       frame = requestAnimationFrame(updateMeter);
    };
    updateMeter();
    return () => cancelAnimationFrame(frame);
  }, []);

  const [localBpm, setLocalBpm] = useState(bpm.toString());

  useEffect(() => {
    setLocalBpm(bpm.toString());
  }, [bpm]);

  const commitBpm = () => {
    let parsed = parseInt(localBpm);
    if (isNaN(parsed)) parsed = 120;
    setBpm(Math.max(30, Math.min(300, parsed)));
  };

  const metronomeEnabled = useDawStore(s => s.metronomeEnabled);
  const autoQuantize = useDawStore(s => s.autoQuantize);
  const setBpm = useDawStore(s => s.setBpm);
  const setPlaybackState = useDawStore(s => s.setPlaybackState);
  const setIsRecording = useDawStore(s => s.setIsRecording);
  const setMetronomeEnabled = useDawStore(s => s.setMetronomeEnabled);
  const setAutoQuantize = useDawStore(s => s.setAutoQuantize);
  const autotuneEnabled = useDawStore(s => s.autotuneEnabled);
  const setAutotuneEnabled = useDawStore(s => s.setAutotuneEnabled);
  const projectKey = useDawStore(s => s.projectKey);
  const projectScale = useDawStore(s => s.projectScale);
  const setProjectKey = useDawStore(s => s.setProjectKey);
  const setProjectScale = useDawStore(s => s.setProjectScale);
  const selectedTrackId = useDawStore(s => s.selectedTrackId);
  const addClip = useDawStore(s => s.addClip);

  const inputMonitoring = useDawStore(s => s.inputMonitoring);
  const setInputMonitoring = useDawStore(s => s.setInputMonitoring);
  const globalEffectsMode = useDawStore(s => s.globalEffectsMode);
  const recordingStartTicksRef = React.useRef(0);
  
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const currentProjectId = useDawStore(s => s.currentProjectId);
  const currentProjectName = useDawStore(s => s.currentProjectName);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Sound Import and AI Stem Separation States
  const [importingFile, setImportingFile] = useState<File | null>(null);
  const [stemSeparatorProgress, setStemSeparatorProgress] = useState<{ stepName: string; percent: number } | null>(null);

  const processNativeImport = async () => {
    if (!importingFile) return;
    const file = importingFile;
    setImportingFile(null);

    // Make sure AudioContext is initialized
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }

    const url = URL.createObjectURL(file);
    const state = useDawStore.getState();
    state.addTrack('audio');
    const updatedState = useDawStore.getState();
    const newTrackId = updatedState.tracks[updatedState.tracks.length - 1].id;
    
    // Set a matching trace name
    useDawStore.getState().updateTrack(newTrackId, { 
      name: file.name.replace(/\.[^/.]+$/, "") 
    });

    try {
      const buffer = await new Tone.ToneAudioBuffer().load(url);
      const durationSecs = buffer.duration;
      const duration16ths = Math.ceil((durationSecs / 60) * state.bpm * 4);

      // Extract waveform peaks for visual display in the timeline
      let peaks: number[] | undefined;
      try {
        const raw = buffer.get();
        if (raw) {
          const { extractPeaks } = await import('../../audio/peakExtractor');
          peaks = extractPeaks(raw, Math.max(64, Math.min(1024, Math.floor(durationSecs * 32))));
        }
      } catch (peakErr) {
        console.warn("Peak extraction failed; clip will show without waveform", peakErr);
      }

      useDawStore.getState().addClip(newTrackId, useDawStore.getState().transportPosition, url, peaks, duration16ths);
    } catch(err) {
      console.error("Failed to load audio buffer for import", err);
      useDawStore.getState().addClip(newTrackId, useDawStore.getState().transportPosition, url, undefined, 32);
    }

  };

  const processStemSeparation = async () => {
    if (!importingFile) return;
    const file = importingFile;
    
    // Set first progress info
    setStemSeparatorProgress({ stepName: 'Reading digital waveform...', percent: 5 });

    if (Tone.context.state !== 'running') {
      await Tone.start();
    }

    try {
      const parentUrl = URL.createObjectURL(file);
      const loaderBuffer = await new Tone.ToneAudioBuffer().load(parentUrl);
      const rawAudioBuffer = loaderBuffer.get();
      if (!rawAudioBuffer) {
        throw new Error("Could not decode audio channels.");
      }

      // Execute DSP-based audio stem split
      const stems = await separateStems(rawAudioBuffer, (progress) => {
        setStemSeparatorProgress(progress);
      });

      // Prepare definitions
      const stemDefs = [
        { key: 'vocals', name: 'Vocals 🎙️', buffer: stems.vocals, color: '#ec4899' },
        { key: 'drums', name: 'Drums 🥁', buffer: stems.drums, color: '#00FF9C' },
        { key: 'bass', name: 'Bass 🎸', buffer: stems.bass, color: '#3b82f6' },
        { key: 'melody', name: 'Instruments 🎹', buffer: stems.melody, color: '#a855f7' },
      ];

      const durationSecs = rawAudioBuffer.duration;
      const state = useDawStore.getState();
      const duration16ths = Math.ceil((durationSecs / 60) * state.bpm * 4);
      const startPosition = state.transportPosition;

      // Add each tracks & associated clip onto timeline!
      for (const stem of stemDefs) {
        const wavBlob = bufferToWav(stem.buffer);
        const stemUrl = URL.createObjectURL(wavBlob);

        // Add track
        state.addTrack('audio');
        const updatedState = useDawStore.getState();
        const newTrackId = updatedState.tracks[updatedState.tracks.length - 1].id;

        // Custom label and themed separation color
        const cleanFileName = file.name.replace(/\.[^/.]+$/, "");
        useDawStore.getState().updateTrack(newTrackId, { 
          name: `[Stem] ${stem.name} - ${cleanFileName}`,
          color: stem.color
        });

        // Add clip with extracted peaks
        let stemPeaks: number[] | undefined;
        try {
          const { extractPeaks } = await import('../../audio/peakExtractor');
          stemPeaks = extractPeaks(stem.buffer, Math.max(64, Math.min(1024, Math.floor(stem.buffer.duration * 32))));
        } catch {}
        useDawStore.getState().addClip(newTrackId, startPosition, stemUrl, stemPeaks, duration16ths);

      }

    } catch (err) {
      console.error("Audio Separation Error: ", err);
      // Clean fallback
      alert("Encountered decoding error. Importing file as a native single track.");
      setImportingFile(file);
      await processNativeImport();
    } finally {
      setImportingFile(null);
      setStemSeparatorProgress(null);
    }
  };

  const handleCopyLink = () => {
    if (!currentProjectId) return;
    const link = `${window.location.origin}/studio?project_id=${currentProjectId}`;
    navigator.clipboard.writeText(link)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 3000);
      })
      .catch((e) => {
        console.error("Failed to copy link:", e);
      });
  };

  const handleDeviceSync = async () => {
    if (!currentProjectId) return;
    
    if (!user) {
      setIsAuthOpen(true);
      return;
    }

    setIsSyncing(true);
    setWalletError(null);

    try {
      // 1. Fetch current wallet details
      const { data: walletData, error: walletErr } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .single();

      let activeWallet = walletData;

      if (walletErr || !walletData) {
        // Create/Initialize wallet if missing
        const { data: newWallet, error: createErr } = await supabase
          .from('wallets')
          .insert({
            user_id: user.id,
            balance_usd: 10.00,
            balance_naira: 16000,
            tk_balance: 50.00,
            withdrawable_balance: 8000
          })
          .select('*')
          .single();

        if (createErr || !newWallet) {
          setWalletError("Unable to initialize your producer wallet. Please try again.");
          setIsSyncing(false);
          return;
        }
        
        activeWallet = newWallet;
      }

      const balanceUsd = Number(activeWallet.balance_usd || 0);

      // Verify that the user has at least $0.20 USD
      if (balanceUsd < 0.20) {
        setWalletError(`Insufficient balance. You have $${balanceUsd.toFixed(2)} USD, but Device Sync requires $0.20 USD. Please fund your wallet.`);
        setIsSyncing(false);
        return;
      }

      // 2. Perform wallet deduction
      const nextUsd = balanceUsd - 0.20;
      const nextNaira = Number(activeWallet.balance_naira || 0) - 320;

      const { error: deductErr } = await supabase
        .from('wallets')
        .update({
          balance_usd: nextUsd,
          balance_naira: nextNaira,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (deductErr) {
        setWalletError("Billing transaction error: " + deductErr.message);
        setIsSyncing(false);
        return;
      }

      // 3. Log transaction auditable entry
      await supabase.from('wallet_transactions').insert({
        user_id: user.id,
        type: 'ai_prompt', // standard AI/sync prompt charging
        amount_usd: 0.20,
        amount_naira: 320,
        status: 'success',
        meta: { description: `Device Sync for project ${currentProjectName || 'Untitled Project'}` }
      });

      // 4. Update project immediately in the DB to broadcast updates to everyone
      const state = useDawStore.getState();
      const dataToSave = {
        tracks: state.tracks,
        clips: state.clips,
        bpm: state.bpm,
        projectKey: state.projectKey,
        projectScale: state.projectScale,
        purchasedPlugins: state.purchasedPlugins,
        chatMessages: state.chatMessages
      };

      const syncedTime = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from('studio_projects')
        .update({
          data: dataToSave,
          bpm: state.bpm,
          music_key: state.projectKey,
          is_collaborative: true,
          last_autosave_at: syncedTime
        })
        .eq('id', currentProjectId);

      if (updateErr) {
        setWalletError("Failed to update project database payload: " + updateErr.message);
        setIsSyncing(false);
        return;
      }

      // Play chime/beep confirmation nicely (removed to avoid repetitive ringing)

      // Success visual animation feedback
      alert(`Project "${currentProjectName || 'Untitled'}" successfully synced! $0.20 has been deducted. All collaborative devices on this project are now updated.`);

    } catch (e: any) {
      console.error("Device sync failed", e);
      setWalletError(e.message || "Unknown synchronization error. Please retry.");
    } finally {
      setIsSyncing(false);
    }
  };

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isIOSettingsOpen, setIsIOSettingsOpen] = useState(false);
  const [isEngineOpen, setIsEngineOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUpgradesOpen, setIsUpgradesOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
       setUser(session?.user || null);
    }).catch(err => {
       console.warn("Supabase session fetch failed on TopBar:", err);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Zundo temporal hooks
  const undo = () => useDawStore.temporal.getState().undo();
  const redo = () => useDawStore.temporal.getState().redo();

  const handlePlay = async () => {
    try {
      await Tone.start();
      const rawCtx = Tone.getContext().rawContext as AudioContext;
      if (rawCtx) {
        await rawCtx.resume().catch(() => {});
      }
    } catch (e) {}
    await audioEngine.init();
    setPlaybackState(playbackState === 'playing' ? 'paused' : 'playing');
  };

  const handleStop = () => {
    setPlaybackState('stopped');
    useDawStore.getState().setTransportPosition(0);
    Tone.Transport.position = 0;
  };

  const toggleRecording = async () => {
    try {
      await Tone.start();
      const rawCtx = Tone.getContext().rawContext as AudioContext;
      if (rawCtx) {
        await rawCtx.resume().catch(() => {});
      }
    } catch (e) {}
    toggleGlobalRecording();
  };

  const toggleMonitor = () => {
    const newMon = !inputMonitoring;
    setInputMonitoring(newMon);
    audioEngine.toggleMicMonitor(newMon);
  };

  const handleImportAudio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingFile(file);
    e.target.value = ''; // clear input so user can re-import same file
  };

  return (
    <header className="h-12 flex items-center px-2 sm:px-4 bg-[#141414] border-b border-[#2A2A2A] shrink-0 select-none">
      <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
        <button onClick={onHome} className="flex items-center gap-2 group cursor-pointer hover:opacity-80 shrink-0">
          <div className="w-5 h-5 bg-[#00FF9C] rounded flex items-center justify-center group-hover:scale-110 transition-transform">
            <div className="w-2.5 h-2.5 bg-black rounded-sm rotate-45"></div>
          </div>
          <span className="font-bold tracking-tighter text-xs uppercase text-[#E0E0E0] hidden sm:block group-hover:text-[#00FF9C] transition-colors">HOME</span>
        </button>
        
        <div className="flex-1 overflow-x-auto min-w-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center bg-[#000] rounded-md border border-[#333] px-2 py-1 gap-2 sm:gap-4 w-max">
            <div className="flex items-center gap-1 border-r border-[#333] pr-2 sm:pr-4">
              <span className="text-[9px] text-gray-500 font-mono">BPM</span>
              <div className="flex items-center">
                <button onClick={() => setBpm(Math.max(30, bpm - 1))} className="text-gray-400 hover:text-white px-1 cursor-pointer">-</button>
                <input 
                  type="text" 
                  value={localBpm}
                  onChange={(e) => setLocalBpm(e.target.value)}
                  onBlur={commitBpm}
                  onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); } }}
                  className="bg-transparent text-[#00FF9C] w-10 text-center text-xs font-mono outline-none selection:bg-[#00FF9C]/30"
                />
                <button onClick={() => setBpm(Math.min(300, bpm + 1))} className="text-gray-400 hover:text-white px-1 cursor-pointer">+</button>
              </div>
              <button 
                onClick={handleTapTempo}
                className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#141414] hover:bg-[#222] text-[#00FF9C] hover:text-white transition-all select-none border border-[#333] active:scale-95"
                title="Tap Tempo (Keep clicking in rhythm)"
              >
                TAP
              </button>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 border-r border-[#333] pr-2 sm:pr-4">
              <span className="text-[9px] text-gray-500 font-mono uppercase">Key</span>
              <select 
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value)}
                className="bg-transparent text-[#00FF9C] text-xs font-mono outline-none cursor-pointer"
              >
                {KEYS_LIST.map(k => <option key={k} value={k} className="bg-black">{k}</option>)}
              </select>
              <select 
                value={projectScale}
                onChange={(e) => setProjectScale(e.target.value)}
                className="bg-transparent text-[#00FF9C] text-xs font-mono outline-none cursor-pointer max-w-[80px]"
              >
                {Object.keys(SCALES).map(s => <option key={s} value={s} className="bg-black">{s}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 border-r border-[#333] pr-2 py-0.5 relative">
              <button
                onClick={toggleRecording}
                className={`w-6 h-6 rounded-full flex items-center justify-center relative ${isRecording ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-pulse' : 'bg-[#222] text-red-500 hover:bg-[#333]'}`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-white' : 'bg-red-500'}`} />
              </button>
              
              {/* Live Input Meter */}
              <div className="w-[3px] h-6 bg-[#222] rounded-full overflow-hidden flex flex-col justify-end">
                <div 
                   className="w-full transition-all duration-75"
                   style={{ 
                     height: `${Math.min(100, Math.max(0, peak * 100))}%`, 
                     backgroundColor: peak > 0.9 ? '#ef4444' : peak > 0.7 ? '#eab308' : '#22c55e'
                   }} 
                />
              </div>
            </div>
            <div className="flex items-center gap-1 border-r border-[#333] pr-2">
              <button 
                className={`p-1 rounded flex items-center justify-center ${playbackState === 'playing' ? 'bg-[#00FF9C] text-black' : 'hover:bg-[#222]'}`}
                onClick={handlePlay}
              >
                <Play fill={playbackState === 'playing' ? 'currentColor' : 'none'} size={14} />
              </button>
              <button 
                className={`p-1 rounded flex items-center justify-center ${playbackState === 'stopped' ? 'text-gray-600' : 'hover:bg-[#222]'}`}
                onClick={handleStop}
              >
                <Square fill="currentColor" size={12} />
              </button>
            </div>
            <div className="flex items-center gap-1 border-r border-[#333] pr-2">
              <button
                 onClick={toggleMonitor}
                 className={`p-1 rounded flex items-center justify-center ${inputMonitoring ? 'bg-[#00FF9C] text-black' : 'text-gray-500 hover:text-white'}`}
                 title="Monitor Mic"
              >
                <Headphones size={14} />
              </button>
              <button
                 onClick={() => setMetronomeEnabled(!metronomeEnabled)}
                 className={`p-1 rounded flex items-center justify-center ${metronomeEnabled ? 'bg-[#00FF9C] text-black' : 'text-gray-500 hover:text-white'}`}
                 title="Metronome"
              >
                <Bell size={14} />
              </button>
              <button
                 onClick={() => setAutoQuantize(!autoQuantize)}
                 className={`px-1.5 py-0.5 rounded flex items-center justify-center text-[9px] font-bold ${autoQuantize ? 'bg-[#00FF9C] text-black' : 'bg-[#222] text-gray-500 hover:text-white'}`}
                 title="Auto Quantize Recording"
              >
                AQ
              </button>
              <button
                 onClick={() => setAutotuneEnabled(!autotuneEnabled)}
                 className={`px-1.5 py-0.5 rounded flex items-center justify-center text-[9px] font-bold ${autotuneEnabled ? 'bg-[#00FF9C] text-black' : 'bg-[#222] text-gray-500 hover:text-white'}`}
                 title="AutoTune Vocal Monitoring"
              >
                AT
              </button>
              <button
                 onClick={() => setIsEngineOpen(true)}
                 className={`px-2 py-0.5 rounded flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider relative transition-all duration-150 border cursor-pointer ${
                   globalEffectsMode === 'native' 
                     ? 'bg-[#00FF9C]/10 border-[#00FF9C]/35 text-[#00FF9C] shadow-[0_0_10px_rgba(0,255,156,0.15)]' 
                     : 'bg-[#222] border-[#333] text-gray-400 hover:text-white'
                 }`}
                 title="Hardware/Web Audio DSP Processing Engine Selection"
              >
                <Cpu size={11} className={globalEffectsMode === 'native' ? 'animate-pulse text-[#00FF9C]' : 'text-zinc-500'} />
                <span>{globalEffectsMode === 'native' ? 'NATIVE DSP' : 'WEB AUDIO'}</span>
              </button>
            </div>
            <div className="flex items-center gap-1">
              <button 
                className="p-1 rounded flex items-center justify-center text-gray-400 hover:text-white"
                onClick={undo}
                title="Undo"
              >
                <Undo2 size={12} />
              </button>
              <button 
                className="p-1 rounded flex items-center justify-center text-gray-400 hover:text-white"
                onClick={redo}
                title="Redo"
              >
                <Redo2 size={12} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center bg-[#000] rounded-md border border-[#333] px-2 py-1 shrink-0 relative">
          <div className="flex items-center gap-1.5 relative">
             {currentProjectId && (
               <>
                 <button 
                   onClick={handleCopyLink}
                   className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-all border shrink-0 ${isCopied ? 'bg-fuchsia-950/40 border-fuchsia-500 text-fuchsia-400' : 'bg-zinc-900 border-zinc-800 hover:border-[#00FFBC] text-zinc-300'}`}
                   title="Copy collaboration link to invite other users"
                 >
                   <Share2 size={11} className={isCopied ? 'animate-bounce text-fuchsia-400' : 'text-zinc-400'} />
                   <span className="hidden xs:inline">{isCopied ? 'Copied Link' : 'Invite'}</span>
                 </button>

                 <button 
                   onClick={handleDeviceSync}
                   disabled={isSyncing}
                   className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-extrabold uppercase tracking-widest transition-all shadow-[0_0_12px_rgba(0,192,255,0.2)] hover:scale-105 active:scale-95 shrink-0 ${isSyncing ? 'bg-zinc-800 text-zinc-500 shadow-none cursor-not-allowed' : 'bg-[#00D2FF] hover:bg-[#00E5FF] text-black shadow-[0_0_15px_rgba(0,210,255,0.3)]'}`}
                   title="Deducts $0.20 to push/sync changes immediately to all collaborative devices"
                 >
                   {isSyncing ? <Loader2 size={11} className="animate-spin" /> : <span>🔄</span>}
                   <span>Sync ($0.20)</span>
                 </button>
               </>
             )}



             <button 
               onClick={() => setIsMenuOpen(!isMenuOpen)}
               className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest transition-all ${isMenuOpen ? 'bg-[#00FF9C] text-black shadow-[0_0_10px_rgba(0,255,156,0.3)]' : 'bg-[#222] text-[#00FF9C] hover:bg-[#333]'}`}
             >
               <Menu size={14} />
               <span className="hidden xs:block">Menu</span>
             </button>

             {isMenuOpen && (
               <div className="absolute top-full right-0 mt-2 w-48 bg-[#111] border border-[#333] rounded-lg shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-2 border-b border-[#222] bg-[#1a1a1a]">
                    <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest px-2">Project Actions</p>
                  </div>
                  
                  <div className="p-1">
                    <button 
                      onClick={() => { setIsProjectsOpen(true); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-[11px] text-gray-300 hover:text-white hover:bg-[#222] rounded transition-colors"
                    >
                      <FolderOpen size={14} className="text-[#00FF9C]" />
                      Projects
                    </button>
                    
                    <div className="relative group">
                      <button 
                        className="w-full flex items-center gap-3 px-3 py-2 text-[11px] text-gray-300 hover:text-white hover:bg-[#222] rounded transition-colors"
                      >
                        <FileDown size={14} className="text-[#00FF9C]" />
                        Import Audio
                      </button>
                      <input type="file" accept="audio/*" onChange={(e) => { handleImportAudio(e); setIsMenuOpen(false); }} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>

                    <button 
                      onClick={() => {
                        useDawStore.getState().setIsExportModalOpen(true);
                        setIsMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-[11px] text-gray-300 hover:text-white hover:bg-[#222] rounded transition-colors"
                    >
                      <Box size={14} className="text-[#00FF9C]" />
                      Export Mix
                    </button>

                    <button 
                      onClick={() => { setIsIOSettingsOpen(true); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-[11px] text-gray-300 hover:text-white hover:bg-[#222] rounded transition-colors"
                    >
                      <ExternalLink size={14} className="text-blue-400" />
                      Audio I/O Settings
                    </button>
                  </div>

                  <div className="p-1 border-t border-[#222]">
                    {!user ? (
                      <button 
                        onClick={() => { setIsAuthOpen(true); setIsMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-[11px] text-[#00FF9C] hover:bg-[#00FF9C] hover:text-black rounded transition-all font-bold"
                      >
                        <User size={14} />
                        Login / Sign Up
                      </button>
                    ) : (
                      <div className="space-y-1">
                        <div className="px-3 py-2 flex items-center gap-3 select-none">
                          <div className="w-6 h-6 rounded-full bg-[#00FF9C]/10 flex items-center justify-center">
                            <User size={12} className="text-[#00FF9C]" />
                          </div>
                          <span className="text-[9px] text-gray-400 truncate">{user.email}</span>
                        </div>
                        <button 
                          onClick={() => { supabase.auth.signOut(); setIsMenuOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-[11px] text-red-400 hover:bg-red-500/10 rounded transition-colors"
                        >
                          <LogOut size={14} />
                          Sign Out
                        </button>
                      </div>
                    )}
                  </div>
               </div>
             )}
          </div>
        </div>
      </div>
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <ProjectsModal isOpen={isProjectsOpen} onClose={() => setIsProjectsOpen(false)} />
      <IOSettingsModal isOpen={isIOSettingsOpen} onClose={() => setIsIOSettingsOpen(false)} />
      <AudioEngineSelectorModal isOpen={isEngineOpen} onClose={() => setIsEngineOpen(false)} />
      <UpgradesHubModal isOpen={isUpgradesOpen} onClose={() => setIsUpgradesOpen(false)} />

      {/* Audio Import and Separation Prompt Modal */}
      {importingFile && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md transition-all">
          <div className="bg-[#101011] border border-zinc-800 rounded-2xl max-w-lg w-full relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6">
            
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-zinc-900 pb-4 mb-5">
              <div className="w-10 h-10 rounded-xl bg-[#00FF9C]/10 flex items-center justify-center text-[#00FF9C]">
                <Layers size={18} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold uppercase text-white tracking-wider">Audio Import Options</h3>
                <p className="text-[10px] text-zinc-500 font-mono truncate max-w-sm" title={importingFile.name}>
                  File: {importingFile.name} ({(importingFile.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
              </div>
            </div>

            {/* If In Progress, render Step Loader */}
            {stemSeparatorProgress ? (
              <div className="py-8 space-y-6 flex flex-col items-center justify-center text-center">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-16 h-16 rounded-full border-4 border-[#00FF9C]/20 animate-ping" />
                  <div className="w-16 h-16 rounded-full border-4 border-t-[#00FF9C] border-zinc-800 animate-spin flex items-center justify-center">
                    <Bot size={22} className="text-[#00FF9C]" />
                  </div>
                </div>

                <div className="space-y-2 w-full max-w-xs">
                  <p className="text-xs text-white font-bold uppercase tracking-wider animate-pulse">
                    {stemSeparatorProgress.stepName}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    DSP Filter Alignment in Progress...
                  </p>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-zinc-900 rounded-full h-2.5 overflow-hidden border border-zinc-800 max-w-sm">
                  <div 
                    className="bg-[#00FF9C] h-full rounded-full transition-all duration-300"
                    style={{ width: `${stemSeparatorProgress.percent}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-[#00FF9C] font-bold">
                  {stemSeparatorProgress.percent}%
                </span>
              </div>
            ) : (
              // Selecting Pathways
              <div className="space-y-4">
                <p className="text-xs text-zinc-400 font-normal leading-relaxed">
                  How would you like to load this audio file onto your playlist arrangement timeline?
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  
                  {/* Native Import Card */}
                  <button
                    onClick={processNativeImport}
                    className="flex flex-col text-left p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 hover:bg-zinc-900/60 hover:border-[#00FF9C]/40 transition-all group cursor-pointer active:scale-95"
                  >
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 flex items-center justify-center text-zinc-400 group-hover:text-white mb-3 transition-colors">
                      <FileAudio size={16} />
                    </div>
                    <span className="text-xs font-bold text-white uppercase tracking-wide group-hover:text-[#00FF9C] transition-colors mb-1">
                      Native Import
                    </span>
                    <span className="text-[10px] text-zinc-500 leading-normal">
                      Places original audio file onto a single stereo track on the playlist playhead.
                    </span>
                  </button>

                  {/* Stem Separator Card */}
                  <button
                    onClick={processStemSeparation}
                    className="flex flex-col text-left p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 hover:bg-zinc-900/60 hover:border-[#00FF9C]/40 transition-all group cursor-pointer active:scale-95"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[#00FF9C]/10 flex items-center justify-center text-[#00FF9C] mb-3">
                      <Sparkles size={16} className="animate-pulse" />
                    </div>
                    <span className="text-xs font-bold text-white uppercase tracking-wide group-hover:text-[#00FF9C] transition-colors mb-1">
                      Separate Stems
                    </span>
                    <span className="text-[10px] text-zinc-500 leading-normal">
                      AI-Powered local DSP separation. Extracts Vocals, Drums, Bass, and Melodies into 4 editable tracks.
                    </span>
                  </button>

                </div>

                <div className="flex justify-end pt-4 border-t border-zinc-900">
                  <button
                    onClick={() => setImportingFile(null)}
                    className="text-[10px] text-zinc-500 hover:text-white uppercase font-bold tracking-wider px-3 py-1.5 rounded transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {walletError && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#141414] border border-red-500/30 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-[0_10px_50px_rgba(239,68,68,0.25)] animate-in zoom-in duration-150">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mx-auto">
              <span className="text-xl font-bold">⚠️</span>
            </div>
            <h3 className="text-base font-black uppercase text-white tracking-wide">Sync Billing Error</h3>
            <p className="text-xs text-gray-400 leading-relaxed font-sans">{walletError}</p>
            <div className="flex gap-2 pt-2">
              <button 
                onClick={() => setWalletError(null)}
                className="flex-1 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-xs font-bold uppercase py-2.5 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  setWalletError(null);
                  navigate('/wallet');
                }}
                className="flex-1 bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:opacity-90 text-white text-xs font-bold uppercase py-2.5 rounded-xl transition-all shadow-[0_0_15px_rgba(236,72,153,0.3)]"
              >
                Add Funds
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
