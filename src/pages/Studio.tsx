// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { TopBar } from '../components/daw/TopBar';
import { TrackList } from '../components/daw/TrackList';
import { Arrangement } from '../components/daw/Arrangement';
import { PianoRoll } from '../components/daw/PianoRoll';
import { VirtualKeyboard } from '../components/daw/VirtualKeyboard';
import { VocalRoll } from '../components/daw/VocalRoll';
import { BottomNav } from '../components/daw/BottomNav';
import { FXRack } from '../components/daw/FXRack';
import { DrumPads } from '../components/daw/DrumPads';
import { Mixer } from '../components/daw/Mixer';
import { ChatView } from '../components/daw/ChatView';
import { SampleBrowser } from '../components/daw/SampleBrowser';
import { AddTrackModal } from '../components/daw/AddTrackModal';
import { Home } from '../components/daw/Home';
import { offlineSync } from '../utils/offlineSync';
import { safeSetLocalStorage } from '../utils/storagePruner';
import { audioEngine } from '../audio/engine';
import * as Tone from 'tone';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { useDawStore, getFxDefaults } from '../store/useDawStore';
import { Plus, Bot, Loader2, Disc, X, Download, FileAudio, FileArchive, Music, ChevronDown, Sparkles } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';

let lastSpokenProjectId: string | null = null;
let sessionSyncNoticeShown = false;
let sessionSyncNoticeDismissed = false;

export default function StudioShell() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const lastSyncedTimestampRef = useRef<string | null>(null);
  const clientSessionIdRef = useRef<string>(Math.random().toString(36).substring(7) + "_" + Date.now());
  const lastStateChangeTimeRef = useRef<number>(Date.now());
  const currentProjectId = useDawStore(s => s.currentProjectId);
  const [isDesktopMode, setIsDesktopMode] = useState(false);

  useEffect(() => {
    const handleLayoutDetection = () => {
      // isDesktopMode is active if screen is lg scale (width >= 1024), OR
      // if mobile/tablet rotated to landscape (width > height)
      const isLg = window.innerWidth >= 1024;
      const isLandscape = window.innerWidth > window.innerHeight;
      setIsDesktopMode(isLg || isLandscape);
    };
    handleLayoutDetection();
    window.addEventListener('resize', handleLayoutDetection);
    window.addEventListener('orientationchange', handleLayoutDetection);
    return () => {
      window.removeEventListener('resize', handleLayoutDetection);
      window.removeEventListener('orientationchange', handleLayoutDetection);
    };
  }, []);

  const { 
    currentTab, 
    setBpm, 
    isTrackListOpen, 
    setIsTrackListOpen, 
    selectedClipId, 
    clips, 
    tracks, 
    bpm, 
    projectKey, 
    projectScale, 
    purchasedPlugins, 
    chatMessages,
    isChatOpen,
    setIsChatOpen,
    isAiProducing,
    isComputePaused,
    aiStepMessage,
    audioEditMode,
    isExporting,
    exportProgress,
    exportSecondsRemaining,
    exportPhase,
    isExportModalOpen,
    setIsExportModalOpen,
    exportFormat: activeExportFormat,
    exportTitle: activeExportTitle,
    exportType: activeExportType,
    cancelExport
  } = useDawStore();
  const { user } = useAuth();
  const [isAddTrackOpen, setIsAddTrackOpen] = useState(false);
  const [page, setPage] = useState<'home' | 'studio'>('home');

  // Global Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
    if (page !== 'studio') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if target is an input or textarea to avoid interrupting writing notes/chat
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.getAttribute('contenteditable') === 'true'
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (isCmdOrCtrl) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            // Ctrl+Shift+Z = Redo
            console.log("Global Redo triggered (Ctrl+Shift+Z)");
            useDawStore.temporal.getState().redo();
          } else {
            // Ctrl+Z = Undo
            console.log("Global Undo triggered (Ctrl+Z)");
            useDawStore.temporal.getState().undo();
          }
        } else if (e.key.toLowerCase() === 'y') {
          // Ctrl+Y = Redo
          e.preventDefault();
          console.log("Global Redo triggered (Ctrl+Y)");
          useDawStore.temporal.getState().redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [page]);

  const [exportTitle, setExportTitle] = useState('mixdown');
  const [exportFormat, setExportFormat] = useState('wav'); // wav, mp3, flac
  const [exportType, setExportType] = useState('master'); // master, stems, single
  const [selectedSingleTrackId, setSelectedSingleTrackId] = useState('');

  // Auto-sync current track ID on list load
  useEffect(() => {
    if (tracks.length > 0 && !selectedSingleTrackId) {
      setSelectedSingleTrackId(tracks[0].id);
    }
  }, [tracks, selectedSingleTrackId]);

  // Set the default export title when modal is opened 
  useEffect(() => {
    if (isExportModalOpen) {
      const projName = useDawStore.getState().currentProjectName;
      setExportTitle(projName || 'mixdown');
    }
  }, [isExportModalOpen]);

  // Draggable floating trigger button states
  const [dragPosition, setDragPosition] = useState({ x: 16, y: 110 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const posStartRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    posStartRef.current = { ...dragPosition };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      hasMovedRef.current = true;
    }
    
    const nextLeft = Math.max(8, Math.min(window.innerWidth - 64, posStartRef.current.x + dx));
    const nextBottom = Math.max(80, Math.min(window.innerHeight - 80, posStartRef.current.y - dy));
    setDragPosition({ x: nextLeft, y: nextBottom });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleTriggerClick = (e: React.MouseEvent) => {
    if (hasMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setIsChatOpen(true);
  };

  useEffect(() => {
    const initAudioOnFirstInteraction = () => {
      try {
        Tone.start();
        const rawCtx = Tone.getContext().rawContext as AudioContext;
        if (rawCtx) {
          rawCtx.resume().catch(() => {});
        }
      } catch (e) {}
      audioEngine.init();
      window.removeEventListener('click', initAudioOnFirstInteraction);
      window.removeEventListener('keydown', initAudioOnFirstInteraction);
      window.removeEventListener('touchstart', initAudioOnFirstInteraction);
      window.removeEventListener('pointerdown', initAudioOnFirstInteraction);
    };
    
    window.addEventListener('click', initAudioOnFirstInteraction);
    window.addEventListener('keydown', initAudioOnFirstInteraction);
    window.addEventListener('touchstart', initAudioOnFirstInteraction);
    window.addEventListener('pointerdown', initAudioOnFirstInteraction);
    
    return () => {
      window.removeEventListener('click', initAudioOnFirstInteraction);
      window.removeEventListener('keydown', initAudioOnFirstInteraction);
      window.removeEventListener('touchstart', initAudioOnFirstInteraction);
      window.removeEventListener('pointerdown', initAudioOnFirstInteraction);
    };
  }, []);

  useEffect(() => {
    if (page !== 'studio') return;

    // Track when local state changes occur to guard against stale cloud merges
    lastStateChangeTimeRef.current = Date.now();

    // Immediately save to local storage to guarantee no lost modifications
    const state = useDawStore.getState();
    const dataToSave = {
      tracks: state.tracks,
      clips: state.clips,
      bpm: state.bpm,
      projectKey: state.projectKey,
      projectScale: state.projectScale,
      purchasedPlugins: state.purchasedPlugins,
      chatMessages: state.chatMessages,
      last_writer_session_id: clientSessionIdRef.current
    };
    
    safeSetLocalStorage('see-vibe-project', dataToSave);
    safeSetLocalStorage('see-vibe-project-meta', {
      id: state.currentProjectId,
      title: state.currentProjectName
    });

    // Debounce cloud autosave to prevent spamming Supabase during slider dragging
    const cloudSaveTimeout = setTimeout(async () => {
      if (state.currentProjectId && user) {
        const isOfflineProject = state.currentProjectId.startsWith('offline_');
        const isOnlineNow = offlineSync.isOnline();

        // Update local memory cache listing
        try {
          const cached = offlineSync.getCachedProjects();
          const pIndex = cached.findIndex(p => p.id === state.currentProjectId);
          if (pIndex > -1) {
            cached[pIndex] = {
              ...cached[pIndex],
              data: dataToSave,
              bpm: state.bpm,
              music_key: state.projectKey,
              updated_at: new Date().toISOString()
            };
            offlineSync.saveCachedProjects(cached);
          }
        } catch {}

        if (isOnlineNow && !isOfflineProject) {
          try {
            const timestamp = new Date().toISOString();
            lastSyncedTimestampRef.current = timestamp;
            await supabase.from('studio_projects').update({
              data: dataToSave,
              bpm: state.bpm,
              music_key: state.projectKey,
              last_autosave_at: timestamp
            }).eq('id', state.currentProjectId);
          } catch (e) {
            console.error('Supabase autosave failed:', e);
            offlineSync.queueChange(state.currentProjectId, 'update', {
              bpm: state.bpm,
              music_key: state.projectKey,
              data: dataToSave
            });
          }
        } else {
          offlineSync.queueChange(state.currentProjectId, 'update', {
            bpm: state.bpm,
            music_key: state.projectKey,
            data: dataToSave
          });
        }
      }
    }, 1200);

    return () => clearTimeout(cloudSaveTimeout);
  }, [tracks, clips, bpm, projectKey, projectScale, purchasedPlugins, chatMessages, page, user]);

  // Load collaborative project from URL search query parameter
  useEffect(() => {
    const projectId = searchParams.get('project') || searchParams.get('project_id');
    if (!projectId) return;

    let isSubscribed = true;

    async function loadSharedProject() {
      try {
        console.log("Loading collaborative project URL param:", projectId);
        // Get session
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user;

        // Fetch collaboration project details from studio_projects
        const { data: project, error: fetchErr } = await supabase
          .from('studio_projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (fetchErr || !project) {
          console.error("Shared project not found:", fetchErr);
          return;
        }

        if (!isSubscribed) return;

        // Automatically join as collaborator if logged in and not the owner
        if (currentUser && project.user_id !== currentUser.id) {
          const { data: contributor } = await supabase
            .from('studio_project_collaborators')
            .select('*')
            .eq('project_id', projectId)
            .eq('user_id', currentUser.id)
            .maybeSingle();

          if (!contributor) {
            console.log("Joining user as collaborator on project:", projectId);
            await supabase
              .from('studio_project_collaborators')
              .insert({
                project_id: projectId,
                user_id: currentUser.id,
                role: 'editor'
              });
          }
        }

        // Toggle project collaborative status to true if not already specified
        if (!project.is_collaborative) {
          await supabase
            .from('studio_projects')
            .update({ is_collaborative: true })
            .eq('id', projectId);
          project.is_collaborative = true;
        }

        // Initialize last autosave timestamp ref
        if (project.last_autosave_at) {
          lastSyncedTimestampRef.current = project.last_autosave_at;
        }

        // Load project into DAW
        handleOpenProject(project);

      } catch (err) {
        console.error("Failed to fetch or open shared project:", err);
      }
    }

    loadSharedProject();

    return () => {
      isSubscribed = false;
    };
  }, [searchParams, user]);

  // Realtime subscription for collaborative sync updates
  useEffect(() => {
    if (page !== 'studio' || !currentProjectId) return;

    console.log("Subscribing to realtime sync channel for project:", currentProjectId);

    const channel = supabase
      .channel(`project-collab-sync-${currentProjectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'studio_projects',
          filter: `id=eq.${currentProjectId}`
        },
        async (payload) => {
          const lastAutosave = payload.new.last_autosave_at;
          console.log("Received realtime project update:", lastAutosave);

          // Robust epoch comparisons
          const dbTime = lastAutosave ? new Date(lastAutosave).getTime() : 0;
          const localSyncedTime = lastSyncedTimestampRef.current ? new Date(lastSyncedTimestampRef.current).getTime() : 0;

          // Check if we have very recent user interactions (within 3000ms) to avoid wiping live mid-press edits
          const timeSinceLastLocalChange = Date.now() - lastStateChangeTimeRef.current;
          if (timeSinceLastLocalChange < 3000) {
            console.log("Ignoring realtime sync update: user is actively editing project in-memory.");
            // If the database has a newer timestamp than our ref, pull it up to match
            if (lastAutosave && dbTime > localSyncedTime) {
              lastSyncedTimestampRef.current = lastAutosave;
            }
            return;
          }

          // Merge if timestamp is newer and was not published by ourselves
          if (dbTime > localSyncedTime) {
            lastSyncedTimestampRef.current = lastAutosave;

            try {
              const dataVal = payload.new.data;
              const parsed = (typeof dataVal === 'string' && dataVal.trim() !== '') 
                ? JSON.parse(dataVal) 
                : (dataVal || {});

              // Prevent echo loop rollback: ignore the broadcast if it was authored by this exact window session
              if (parsed && parsed.last_writer_session_id === clientSessionIdRef.current) {
                console.log("Ignoring realtime sync update: matches current writer session.");
                return;
              }

              const migratedTracks = (parsed.tracks || []).map((t: any) => ({
                ...t,
                clips: t.clips || [],
                fx: {
                  ...getFxDefaults(),
                  ...(t.fx || {})
                }
              }));

              // Gently merge into store to reflect visual and playback changes
              useDawStore.setState({
                tracks: migratedTracks,
                clips: parsed.clips || {},
                bpm: parsed.bpm || 120,
                projectKey: parsed.projectKey || 'C',
                projectScale: parsed.projectScale || 'Chromatic',
                purchasedPlugins: parsed.purchasedPlugins || [],
                chatMessages: parsed.chatMessages || [{ role: 'assistant', content: "Hey! I'm your AI production assistant. How can I help you with your project today?" }]
              });

              if (!sessionSyncNoticeShown && !sessionSyncNoticeDismissed) {
                setSyncNotice("Project synced! Your workstation incorporates active other device updates.");
                sessionSyncNoticeShown = true;
              }

              // Sound confirmation chime has been removed to prevent persistent background ringing
              console.log("Collaborative project state synced from server.");
            } catch (err) {
              console.error("Realtime merge error:", err);
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log("Unsubscribing from sync channel:", currentProjectId);
      supabase.removeChannel(channel);
    };
  }, [page, currentProjectId]);

  const speakProjectSync = (projectName: string) => {
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const text = `Project ${projectName || 'untitled'} synchronized.`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.05;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.error("Speech synthesis failed", e);
    }
  };

  const handleOpenProject = (proj?: any, noNavigate?: boolean) => {
    if (proj) {
      try {
        const parsed = (typeof proj.data === 'string' && proj.data !== 'undefined' && proj.data.trim() !== '') ? JSON.parse(proj.data) : (proj.data || {});
        
        const migratedTracks = (parsed.tracks || []).map((t: any) => ({
          ...t,
          clips: t.clips || [],
          fx: {
            ...getFxDefaults(),
            ...(t.fx || {})
          }
        }));

        useDawStore.setState({ 
          tracks: migratedTracks, 
          clips: parsed.clips || {},
          bpm: parsed.bpm || 120,
          projectKey: parsed.projectKey || 'C',
          projectScale: parsed.projectScale || 'Chromatic',
          purchasedPlugins: parsed.purchasedPlugins || [],
          chatMessages: parsed.chatMessages || [{ role: 'assistant', content: "Hey! I'm your AI production assistant. How can I help you with your project today?" }]
        });
        safeSetLocalStorage('see-vibe-project-meta', {
          id: proj.id,
          title: proj.title
        });
        useDawStore.getState().setCurrentProject(proj.id, proj.title);

        // Vocalize "Project opened and synced" exactly ONCE on load
        if (proj.id && lastSpokenProjectId !== proj.id) {
          lastSpokenProjectId = proj.id;
          speakProjectSync(proj.title);
        }
      } catch (e) {
        console.error("Load failed", e);
      }
    }
    if (!noNavigate) {
      setPage('studio');
    }
  };

  // Reset lastSpokenProjectId and session sync notice flags when user unmounts/navigates back home
  useEffect(() => {
    if (page === 'home') {
      lastSpokenProjectId = null;
      setSyncNotice(null);
      sessionSyncNoticeShown = false;
      sessionSyncNoticeDismissed = false;
    }
  }, [page]);

  useEffect(() => {
    return () => {
      lastSpokenProjectId = null;
    };
  }, []);

  if (page === 'home') {
    return <Home onOpenProject={(proj) => handleOpenProject(proj, false)} onPreviewProject={(proj) => handleOpenProject(proj, true)} />;
  }

  return (
    <div id="studio-root" className="flex flex-col h-full w-full bg-background text-[#E0E0E0] font-sans overflow-hidden">
      {syncNotice && (
        <div id="project-sync-notice" className="fixed top-14 left-1/2 transform -translate-x-1/2 z-50 bg-[#00FFBC]/25 border border-[#00FFBC]/35 text-[#00FFBC] text-[11px] font-black uppercase tracking-widest pl-4 pr-3 py-2 rounded-full shadow-[0_4px_25px_rgba(0,255,188,0.25)] flex items-center gap-3 animate-bounce">
          <Sparkles size={11} className="animate-spin text-fuchsia-400" />
          <span>{syncNotice}</span>
          <button
            id="close-sync-notice"
            onClick={() => {
              setSyncNotice(null);
              sessionSyncNoticeDismissed = true;
            }}
            className="hover:bg-white/10 p-1 rounded-full text-[#00FFBC] transition-colors cursor-pointer flex items-center justify-center min-w-[20px] min-h-[20px]"
            title="Dismiss notification"
          >
            <X size={13} className="stroke-[3px]" />
          </button>
        </div>
      )}
      <TopBar onHome={() => {
        lastSpokenProjectId = null;
        setPage('home');
      }} />
      
      <div className="flex flex-1 overflow-hidden relative flex-row">
        {/* Sidebar Nav: visible in either landscape or desktop screens */}
        {isDesktopMode && <BottomNav isSidebar={true} />}

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-hidden relative flex-col">
          
          {/* Timeline Pane: full height when active tab, completely hidden otherwise */}
          <div className={`flex flex-1 overflow-hidden relative ${currentTab !== 'timeline' ? 'hidden' : 'flex h-full'}`}>
            <TrackList />
            <Arrangement />
            
            <button
              onClick={() => setIsTrackListOpen(true)}
              className={`absolute top-4 left-4 z-40 bg-[#111] border border-[#333] p-2 text-xs font-bold uppercase rounded text-white shadow-xl sm:hidden ${isTrackListOpen ? 'hidden' : 'block'}`}
            >
              Tracks
            </button>
            
            <button
              onClick={() => setIsAddTrackOpen(true)}
              className={`absolute bottom-6 right-6 ${isDesktopMode ? 'w-10 h-10' : 'w-12 h-12 lg:w-14 lg:h-14'} bg-pink-500 hover:bg-pink-400 text-white rounded-full flex items-center justify-center shadow-[0_0_20px_#ec4899] z-40 transition-transform active:scale-95`}
            >
              <Plus size={isDesktopMode ? 20 : 28} />
            </button>
          </div>

          {/* Expanded Bottom Pane Editor (Full screen layout for focused workspace precision) */}
          {currentTab !== 'timeline' && (
            <div className="h-full relative overflow-hidden bg-[#0A0A0B] flex flex-col flex-1 border-[#2A2A2A]">
              {currentTab === 'mixer' && <Mixer />}
              {currentTab === 'samples' && <SampleBrowser />}
              {currentTab === 'drumpads' && <DrumPads />}
              {currentTab === 'fx' && <FXRack />}
              {currentTab === 'pianoroll' && (
                <div className="flex-1 flex flex-col h-full w-full min-h-0">
                  {(() => {
                    const clip = selectedClipId ? clips[selectedClipId] : null;
                    const track = clip ? tracks.find(t => t.id === clip.trackId) : null;
                    const isPianoMode = clip && audioEditMode[clip.id] === 'piano';
                    if (track?.type === 'audio' && !isPianoMode) {
                       return <VocalRoll />;
                    }
                    return (
                      <>
                        <PianoRoll />
                        <VirtualKeyboard />
                      </>
                    );
                  })()}
                </div>
              )}
              
              {/* Back to main timeline/arrangement overview control */}
              <button 
                onClick={() => useDawStore.getState().setCurrentTab('timeline')}
                className="absolute top-2 right-4 text-[10px] text-zinc-400 hover:text-white font-[900] uppercase tracking-wider z-50 bg-[#121214] hover:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-all shadow-[0_4px_12px_rgba(0,0,0,0.5)] cursor-pointer flex items-center gap-1.5"
                title="Return to Arrangement Timeline"
              >
                <span>Back to Arrangement</span>
                <X size={10} className="stroke-[3px]" />
              </button>
            </div>
          )}
          
          <AddTrackModal isOpen={isAddTrackOpen} onClose={() => setIsAddTrackOpen(false)} />
        </div>
      </div>

      {/* Classic Horizontal BottomNav for portrait mobile mode */}
      {!isDesktopMode && <BottomNav isSidebar={false} />}

      {/* Persistent Floating Chat overlay system */}
      {isChatOpen ? (
        <div className={`fixed md:left-6 md:bottom-28 bottom-24 right-4 left-4 md:right-auto md:w-[460px] h-[640px] max-h-[calc(100vh-140px)] z-50 rounded-2xl overflow-hidden border flex flex-col transition-all duration-500 ${
          (isAiProducing && !isComputePaused) 
            ? 'bg-[#050505]/12 border-[#2b2b2b]/30 shadow-none pointer-events-none' 
            : 'bg-[#050505] border-[#2b2b2b]/85 shadow-[0_20px_60px_rgba(0,0,0,0.9)]'
        }`}>
          <ChatView />
        </div>
      ) : (
        <div 
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{
            left: `${dragPosition.x}px`,
            bottom: `${dragPosition.y}px`,
            touchAction: 'none'
          }}
          className="fixed z-50 flex items-center space-x-3 group select-none cursor-grab active:cursor-grabbing"
        >
          {/* Glowing round floating trigger */}
          <button 
            type="button"
            onClick={handleTriggerClick}
            className={`w-14 h-14 rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all cursor-pointer shadow-[0_0_25px_rgba(0,128,64,0.45)] relative shrink-0 ${
              isAiProducing 
                ? 'bg-[#10B981] text-black shadow-[0_0_30px_rgba(16,185,129,0.7)] animate-pulse border border-emerald-400' 
                : 'bg-[#00FF9C] hover:bg-[#00E580] text-black border border-emerald-400/35'
            }`}
          >
            <Bot size={28} className={isAiProducing ? "animate-spin-slow text-black" : "text-black"} />
            
            {isAiProducing && (
              <span className="absolute -top-1 -right-1 flex h-4.5 w-4.5 pointer-events-none">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-80"></span>
                <span className="relative inline-flex rounded-full h-4.5 w-4.5 bg-pink-500 text-[8px] text-white font-mono font-bold items-center justify-center">⚙</span>
              </span>
            )}
          </button>

          {/* Neon Mini label hint on hover - positioned beautifully to the right of the ball */}
          <div className="bg-zinc-950/95 border border-[#2b2b2b] px-3.5 py-2 rounded-xl text-[10px] font-mono tracking-tight text-emerald-400 font-bold shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap flex items-center gap-2">
            {isAiProducing ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>PRODUCING BEAT: {aiStepMessage || 'Working...'}</span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>AI PRODUCER (DRAG TO MOVE • CLICK TO EXPAND)</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* High-Fidelity Exporting Mixdown Overlay Modal */}
      {isExporting && (
        <div className="fixed inset-0 bg-[#050505]/90 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0C0D11] border border-zinc-850 rounded-[28px] w-full max-w-sm overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.85)] flex flex-col p-8 items-center text-center space-y-6">
            
            {/* Rotating Vinyl/Disc Graphic */}
            <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-[#00FFBC]/20 to-[#0099FF]/20 border border-white/10 flex items-center justify-center relative shadow-[0_0_30px_rgba(0,255,188,0.1)]">
              <div className="absolute inset-2 border-2 border-dashed border-zinc-800 rounded-full animate-spin" style={{ animationDuration: '10s' }} />
              <Disc size={44} className="text-[#00FFBC] animate-spin" style={{ animationDuration: '3s' }} />
              <div className="absolute h-3 w-3 bg-zinc-950 border border-white/20 rounded-full" />
            </div>

            <div className="space-y-2 w-full">
              <span className="px-3 py-1 rounded-full bg-[#00FFBC]/10 border border-[#00FFBC]/20 text-[#00FFBC] font-mono text-[9px] font-extrabold uppercase tracking-widest">
                {activeExportType === 'stems' ? 'Stem Package compilation' : 'Exporting Mixdown'}
              </span>
              <h3 className="text-lg font-black text-white uppercase tracking-wider">
                {activeExportType === 'stems' ? 'Baking Stems Archive' : activeExportType === 'single' ? 'Extracting Single Track' : 'Rendering Stereo Master'}
              </h3>
              <p className="text-xs text-zinc-400 font-mono italic max-w-[280px] mx-auto min-h-[32px] flex items-center justify-center leading-normal">
                "{exportPhase || 'Compiling track buffers...'}"
              </p>
            </div>

            {/* Circular or horizontal Progress indicators */}
            <div className="w-full space-y-2">
              <div className="flex justify-between items-end font-mono text-xs">
                <span className="text-zinc-500 uppercase font-bold tracking-wider text-[10px]">Processing</span>
                <span className="text-[#00FFBC] font-black text-sm">{exportProgress}%</span>
              </div>
              <div className="h-2 w-full bg-zinc-900 border border-white/5 rounded-full overflow-hidden p-[1px]">
                <div 
                  className="h-full bg-gradient-to-r from-[#00A3FF] to-[#00FFBC] rounded-full shadow-[0_0_10px_rgba(0,255,188,0.5)] transition-all duration-150"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>

            {/* Simulated Estimated Time Remaining based on 100% */}
            <div className="w-full p-3.5 rounded-2xl bg-zinc-950 border border-white/5 font-mono text-[10px] text-zinc-450 space-y-1.5 flex flex-col text-left">
              <div className="flex justify-between">
                <span>File Name:</span>
                <span className="text-zinc-200 font-bold max-w-[180px] truncate" title={`${activeExportTitle}.${activeExportType === 'stems' ? 'zip' : activeExportFormat}`}>
                  {activeExportTitle || 'mixdown'}.{activeExportType === 'stems' ? 'zip' : activeExportFormat}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Output Format:</span>
                <span className="text-zinc-200 font-bold uppercase">
                  {activeExportType === 'stems' 
                    ? `ZIP (${activeExportFormat.toUpperCase()})` 
                    : activeExportFormat.toUpperCase() + (activeExportFormat === 'mp3' ? ' (MPEG 320kbps)' : activeExportFormat === 'flac' ? ' (Lossless Compact)' : ' (CD-Quality 16-bit)')
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span>Time Remaining:</span>
                <span className="text-[#00FFBC] font-bold">
                  {exportProgress >= 100 
                    ? "Completed" 
                    : `${exportSecondsRemaining || 1} second${exportSecondsRemaining !== 1 ? 's' : ''}`}
                </span>
              </div>
            </div>

            {/* Cancel Button */}
            <button
              id="btn-cancel-export"
              onClick={() => {
                cancelExport();
              }}
              className="w-full py-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/15 text-rose-405 hover:text-rose-400 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors cursor-pointer"
            >
              Cancel Export
            </button>

            {/* Security note */}
            <p className="font-mono text-[9px] text-zinc-650 tracking-wider">
              Do not close your browser tab during rendering fusions.
            </p>
          </div>
        </div>
      )}

      {/* Sleek Export Configuration Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-[#0C0D11] border border-zinc-800 rounded-[28px] w-full max-w-lg overflow-hidden shadow-[0_30px_70px_rgba(0,0,0,0.85)] flex flex-col p-8 space-y-6">
            
            {/* Header */}
            <div className="flex justify-between items-center pb-2 border-b border-zinc-805">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[#00FFBC]/10 text-[#00FFBC]">
                  <Download size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Export Audio Mixdown</h3>
                  <p className="text-[10px] text-zinc-400 font-mono uppercase tracking-wider">Premium Sound Bakery</p>
                </div>
              </div>
              <button 
                onClick={() => setIsExportModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-450 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Title Configuration */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block font-bold">
                Mixdown Output File Title
              </label>
              <input 
                type="text" 
                value={exportTitle}
                onChange={(e) => setExportTitle(e.target.value)}
                placeholder="Name your masterpiece..."
                className="w-full bg-zinc-950 border border-zinc-800 text-sm font-bold text-white px-4 py-3 rounded-xl focus:border-[#00FFBC] focus:ring-1 focus:ring-[#00FFBC] outline-none transition-all placeholder:text-zinc-700 font-sans"
              />
            </div>

            {/* Audio File Format Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block font-bold">
                Audio File Format
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'wav', name: 'WAV (WAVE)', desc: 'Lossless CD-Quality' },
                  { id: 'mp3', name: 'MP3 (MPEG)', desc: 'Compressed Quality' },
                  { id: 'flac', name: 'FLAC Lossless', desc: 'Compact Lossless' },
                  { id: 'license-proof', name: 'License Proof', desc: 'PDF ownership doc' }
                ].map((fmt) => (
                  <button
                    key={fmt.id}
                    onClick={() => setExportFormat(fmt.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all text-center space-y-1 ${
                      exportFormat === fmt.id 
                        ? 'bg-[#00FFBC]/5 border-[#00FFBC] text-white shadow-[0_0_15px_rgba(0,255,188,0.1)]' 
                        : 'bg-zinc-950 border-zinc-850 text-zinc-400 hover:bg-[#12131A] hover:border-zinc-700'
                    }`}
                  >
                    <span className="text-xs font-black tracking-wider uppercase">{fmt.id === 'license-proof' ? 'LIC' : fmt.id}</span>
                    <span className="text-[9px] font-mono opacity-80">{fmt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Export Type Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest block font-bold">
                Export Distribution Type
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'master', name: 'Full Mixdown', icon: Music, desc: 'Complete master stereo' },
                  { id: 'stems', name: 'Stems ZIP Pack', icon: FileArchive, desc: 'Individual tracks zip' },
                  { id: 'single', name: 'Single Track', icon: FileAudio, desc: 'Extract solo track' }
                ].map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setExportType(t.id)}
                      className={`flex flex-col items-center justify-center p-3.5 rounded-2xl border transition-all text-center space-y-2 ${
                        exportType === t.id 
                          ? 'bg-[#00FFBC]/5 border-[#00FFBC] text-white shadow-[0_0_15px_rgba(0,255,188,0.1)]' 
                          : 'bg-zinc-950 border-zinc-850 text-zinc-400 hover:bg-[#12131A] hover:border-zinc-700'
                      }`}
                    >
                      <Icon size={16} className={exportType === t.id ? 'text-[#00FFBC]' : 'text-zinc-500'} />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black tracking-wider uppercase">{t.name}</span>
                        <span className="text-[8px] font-mono opacity-85 mt-0.5 leading-tight">{t.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Conditional Dropdown for Track Select */}
            {exportType === 'single' && (
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-850 space-y-2 animate-in slide-in-from-top-1 duration-200">
                <label className="text-[9px] font-mono text-zinc-450 uppercase tracking-widest block font-bold">
                  Select Track to Bounce
                </label>
                <div className="relative">
                  <select
                    value={selectedSingleTrackId}
                    onChange={(e) => setSelectedSingleTrackId(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-xs font-bold text-white px-3.5 py-2.5 rounded-xl outline-none focus:border-[#00FFBC] cursor-pointer appearance-none pr-10 font-sans"
                  >
                    {tracks.map((track) => (
                      <option key={track.id} value={track.id}>
                        {track.name.toUpperCase()} ({track.type.toUpperCase()})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-zinc-450">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>
            )}

            {/* Buttons Row */}
            <div className="pt-2 flex gap-3.5">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="flex-1 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-bold text-xs uppercase tracking-wider py-4 rounded-2xl transition-all border border-zinc-850"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    // Close configuration modal first
                    setIsExportModalOpen(false);
                    const safeTitle = (exportTitle || 'mixdown').trim().toLowerCase().replace(/[\s\W]+/g, '_');

                    // === LICENSE PROOF PDF ===
                    if (exportFormat === 'license-proof') {
                      // Render master WAV in-memory for fingerprinting
                      const wavUrl = await audioEngine.exportWithConfig({
                        title: exportTitle || 'mixdown',
                        format: 'wav',
                        exportType: 'master',
                        singleTrackId: undefined,
                      });
                      const wavBuf = await fetch(wavUrl).then((r) => r.arrayBuffer());
                      URL.revokeObjectURL(wavUrl);

                      const { generateLicenseProofPdf } = await import('../utils/licenseProofPdf');
                      const state = useDawStore.getState();
                      const { data: { user } } = await supabase.auth.getUser();
                      const aiPromptHistory = (state.chatMessages || [])
                        .filter((m: any) => m.role === 'user')
                        .map((m: any) => String(m.content || ''));
                      const tracksMeta = (state.tracks || []).map((t: any) => {
                        const fx = t.fx && typeof t.fx === 'object' ? t.fx : {};
                        const enabledFx = Array.isArray(fx)
                          ? fx.map((f: any) => f?.type).filter(Boolean)
                          : Object.entries(fx)
                              .filter(([, v]: any) => v && (v.enabled === true || v.enabled === undefined))
                              .map(([k]) => k);
                        return {
                          name: t.name,
                          type: t.type,
                          clipCount: Object.values(state.clips || {}).filter((c: any) => c.trackId === t.id).length,
                          fxSummary: enabledFx.join(', '),
                        };
                      });

                      // Capture visual snapshot of the studio for proof of work
                      let snapshotPng: ArrayBuffer | undefined;
                      try {
                        const html2canvas = (await import('html2canvas')).default;
                        const target = document.getElementById('studio-root') || document.body;
                        const canvas = await html2canvas(target, {
                          backgroundColor: '#0a0a0a',
                          scale: Math.min(1.5, window.devicePixelRatio || 1),
                          logging: false,
                          useCORS: true,
                        });
                        const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/png', 0.92)!);
                        snapshotPng = await blob.arrayBuffer();
                      } catch (snapErr) {
                        console.warn('Snapshot capture failed, continuing without image', snapErr);
                      }
                      const durationSec = wavBuf.byteLength / 4 / 44100; // rough estimate (16-bit stereo)

                      const blob = await generateLicenseProofPdf({
                        projectId: state.currentProjectId || 'local',
                        projectName: exportTitle || state.currentProjectName || 'Untitled Project',
                        ownerName: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Unknown',
                        ownerEmail: user?.email || '',
                        bpm: state.bpm,
                        key: state.projectKey,
                        scale: state.projectScale,
                        durationSec,
                        sampleRate: 44100,
                        tracks: tracksMeta,
                        aiPromptHistory,
                        masterWavBuffer: wavBuf,
                        snapshotPng,
                      });

                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `${safeTitle}_license_proof.pdf`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      setTimeout(() => URL.revokeObjectURL(url), 5000);
                      return;
                    }

                    // Standard audio export
                    const downloadUrl = await audioEngine.exportWithConfig({
                      title: exportTitle || 'mixdown',
                      format: exportFormat,
                      exportType: exportType,
                      singleTrackId: selectedSingleTrackId
                    });
                    
                    if (downloadUrl) {
                      const ext = exportType === 'stems' ? 'zip' : exportFormat;
                      const link = document.createElement('a');
                      link.href = downloadUrl;
                      link.download = `${safeTitle}.${ext}`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
                    }
                  } catch (err: any) {
                    console.error("Custom export failed", err);
                    const detail = err?.message || err?.name || (typeof err === 'string' ? err : '') || 'Unknown error';
                    const stack = err?.stack ? `\n\nDetails:\n${String(err.stack).split('\n').slice(0, 4).join('\n')}` : '';
                    alert(`Export failed: ${detail}${stack}\n\nTry: fewer tracks, shorter range, or remove broken sample URLs.`);
                  }
                }}
                disabled={exportType === 'single' && !selectedSingleTrackId}
                className="flex-1 bg-[#00FFBC] hover:bg-[#00E5A3] disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-black text-xs uppercase tracking-wider py-4 rounded-2xl transition-all shadow-[0_4px_25px_rgba(0,255,188,0.2)] disabled:shadow-none hover:shadow-[0_4px_30px_rgba(0,255,188,0.35)] flex items-center justify-center gap-2"
              >
                <Download size={14} />
                Bake Sound File
              </button>
            </div>

            {/* Footnote */}
            <p className="text-zinc-600 font-mono text-[8.5px] text-center tracking-wide uppercase leading-normal">
              Zero latency rendering fusions • 44.1kHz Multi-core offline engine
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
