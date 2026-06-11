// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useDawStore, getFxDefaults } from '../../store/useDawStore';
import { Play, Plus, FolderOpen, Trash2, Mic, Settings, ArrowLeft, Pin, Pencil, Check, X, SkipBack, SkipForward, Rewind, FastForward, Pause, Music, Square } from 'lucide-react';
import { AuthModal } from './AuthModal';
import { SeeVibeLogo } from '../SeeVibeLogo';
import { offlineSync } from '../../utils/offlineSync';
import { TrackType, SynthType } from '../../types/daw';

import * as Tone from 'tone';

export function Home({ onOpenProject, onPreviewProject }: { onOpenProject: (proj?: any) => void, onPreviewProject?: (proj: any) => void }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [hasLocalProject, setHasLocalProject] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('see-vibe-pinned-projects');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isEditingId, setIsEditingId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('see-vibe-project');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.tracks && parsed.tracks.length > 0) {
          setHasLocalProject(true);
        }
      }
    } catch {}
  }, []);

  const handleResumeLastSession = () => {
    try {
      const saved = localStorage.getItem('see-vibe-project');
      if (saved) {
        const parsed = JSON.parse(saved);
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

        const storedMetaStr = localStorage.getItem('see-vibe-project-meta');
        if (storedMetaStr) {
          const meta = JSON.parse(storedMetaStr);
          useDawStore.getState().setCurrentProject(meta.id, meta.title);
        } else {
          useDawStore.getState().setCurrentProject(null, 'Local Session');
        }

        onOpenProject();
      }
    } catch (e) {
      console.error('Failed to resume local session', e);
    }
  };

  useEffect(() => {
    // cleanup preview when leaving home page
    return () => {
       if (previewingId) {
         Tone.Transport.stop();
       }
    };
  }, [previewingId]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      if (session?.user) {
        fetchProjects(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(err => {
      console.warn("Supabase session fetch failed on home:", err);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) fetchProjects(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProjects = async (userId: string) => {
    try {
      if (!offlineSync.isOnline()) {
        setProjects(offlineSync.getCachedProjects());
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('studio_projects')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
        
      if (error) {
        if (error.message.includes('Could not find the table')) {
          setTableMissing(true);
        } else {
          throw error;
        }
      } else {
        setProjects(data || []);
        offlineSync.saveCachedProjects(data || []);
      }
    } catch (e: any) {
      console.error(e.message);
      setProjects(offlineSync.getCachedProjects());
    }
    setLoading(false);
  };

  const handleCreateNew = async () => {
    const initialData = {
      tracks: [{
        id: 'track_1',
        name: 'Lead Synth',
        type: 'midi' as TrackType,
        color: '#3b82f6',
        volume: 0,
        pan: 0,
        muted: false,
        soloed: false,
        synthType: 'poly' as SynthType,
        fx: getFxDefaults(),
        clips: [] as string[]
      }], 
      clips: {},
      bpm: 120,
      projectKey: 'C',
      projectScale: 'Chromatic',
      purchasedPlugins: [],
      chatMessages: [{ role: 'assistant' as const, content: "Hey! I'm your AI production assistant. How can I help you with your project today?" }]
    };

    // Reset store
    useDawStore.setState({ 
      ...initialData,
      currentProjectId: null,
      currentProjectName: null,
    });

    try {
      localStorage.removeItem('see-vibe-project');
      localStorage.removeItem('see-vibe-project-meta');
    } catch {}

    if (user) {
      let createdOnCloud = false;

      if (offlineSync.isOnline()) {
        try {
          const { data, error } = await supabase.from('studio_projects').insert({
            user_id: user.id,
            title: 'Untitled Project',
            bpm: 120,
            music_key: 'C',
            data: initialData
          }).select().single();
          
          if (data && !error) {
             useDawStore.getState().setCurrentProject(data.id, data.title);
             createdOnCloud = true;
          }
        } catch (err) {
          console.error('Failed to create cloud project', err);
        }
      }

      if (!createdOnCloud) {
        const offlineId = 'offline_' + Math.random().toString(36).substr(2, 9);
        useDawStore.getState().setCurrentProject(offlineId, 'Untitled Project Offline');

        const cached = offlineSync.getCachedProjects();
        const localProjRecord = {
          id: offlineId,
          user_id: user.id,
          title: 'Untitled Project Offline',
          bpm: 120,
          music_key: 'C',
          data: initialData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        offlineSync.saveCachedProjects([localProjRecord, ...cached]);
        setProjects([localProjRecord, ...cached]);

        offlineSync.queueChange(offlineId, 'insert', {
          title: 'Untitled Project Offline',
          bpm: 120,
          music_key: 'C',
          data: initialData
        });
      }
    }
    
    onOpenProject();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      setProjects(prev => prev.filter(p => p.id !== id));
      const filtered = offlineSync.getCachedProjects().filter(p => p.id !== id);
      offlineSync.saveCachedProjects(filtered);

      if (offlineSync.isOnline() && !id.startsWith('offline_')) {
        await supabase.from('studio_projects').delete().eq('id', id);
      } else {
        offlineSync.queueChange(id, 'delete');
      }
    } catch (err: any) {
      console.error(err.message);
    }
  };

  const togglePin = (id: string) => {
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try {
        localStorage.setItem('see-vibe-pinned-projects', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleSaveTitle = async (id: string) => {
    if (!editTitleValue.trim()) return;
    try {
      setProjects(prev => prev.map(p => p.id === id ? { ...p, title: editTitleValue } : p));
      const updatedCache = offlineSync.getCachedProjects().map(p => p.id === id ? { ...p, title: editTitleValue } : p);
      offlineSync.saveCachedProjects(updatedCache);
      setIsEditingId(null);

      // Update local storage meta for currently loaded workspace if same id
      const storedMetaStr = localStorage.getItem('see-vibe-project-meta');
      if (storedMetaStr) {
        const meta = JSON.parse(storedMetaStr);
        if (meta.id === id) {
          meta.title = editTitleValue;
          localStorage.setItem('see-vibe-project-meta', JSON.stringify(meta));
          useDawStore.getState().setCurrentProject(id, editTitleValue);
        }
      }

      if (user) {
        if (offlineSync.isOnline() && !id.startsWith('offline_')) {
          const { error } = await supabase
            .from('studio_projects')
            .update({ title: editTitleValue })
            .eq('id', id);
          if (error) throw error;
        } else {
          offlineSync.queueChange(id, 'update', { title: editTitleValue });
        }
      }
    } catch (err: any) {
      console.error("Failed to rename project title:", err.message);
    }
  };

  // Helper sorting projects by Pinned status, then updated timestamp
  const sortedProjects = [...projects].sort((a, b) => {
    const aPinned = pinnedIds.includes(a.id);
    const bPinned = pinnedIds.includes(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return new Date(b.updated_at || b.created_at || Date.now()).getTime() - new Date(a.updated_at || a.created_at || Date.now()).getTime();
  });

  const previewingProject = sortedProjects.find(p => p.id === previewingId);
  const bpm = previewingProject?.bpm || 120;
  const totalBars = 32;
  const totalDurationSeconds = (totalBars * 4 * 60) / bpm || 120;

  useEffect(() => {
    let interval: any;
    if (previewingId && isPlaying) {
      interval = setInterval(() => {
        const currentSeconds = Tone.Transport.seconds || 0;
        setCurrentTime(Math.floor(currentSeconds));
        if (currentSeconds >= totalDurationSeconds) {
          // Loop back automatically or stop at the end
          Tone.Transport.seconds = 0;
          setCurrentTime(0);
        }
      }, 250);
    }
    return () => clearInterval(interval);
  }, [previewingId, isPlaying, totalDurationSeconds]);

  const startPreviewAndPlay = async (p: any) => {
    Tone.Transport.stop();
    Tone.Transport.seconds = 0;
    setCurrentTime(0);
    setPreviewingId(p.id);
    setIsPlaying(true);

    if (onPreviewProject) {
      onPreviewProject(p);
      setTimeout(async () => {
        await Tone.start();
        const rawCtx = Tone.getContext().rawContext as AudioContext;
        if (rawCtx) {
          await rawCtx.resume().catch(() => {});
        }
        Tone.Transport.start();
      }, 500);
    }
  };

  const handlePlayPause = async () => {
    if (!previewingId) return;
    try {
      await Tone.start();
      if (Tone.Transport.state === 'started') {
        Tone.Transport.pause();
        setIsPlaying(false);
      } else {
        const rawCtx = Tone.getContext().rawContext as AudioContext;
        if (rawCtx) {
          await rawCtx.resume().catch(() => {});
        }
        Tone.Transport.start();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error("Preview play/pause failed:", err);
    }
  };

  const handleRewind5s = () => {
    const nextTime = Math.max(0, Tone.Transport.seconds - 5);
    Tone.Transport.seconds = nextTime;
    setCurrentTime(Math.floor(nextTime));
  };

  const handleFastForward5s = () => {
    const nextTime = Math.min(totalDurationSeconds, Tone.Transport.seconds + 5);
    Tone.Transport.seconds = nextTime;
    setCurrentTime(Math.floor(nextTime));
  };

  const handleSkipBack = () => {
    if (!previewingId || sortedProjects.length === 0) return;
    const currentIndex = sortedProjects.findIndex(p => p.id === previewingId);
    if (currentIndex > 0) {
      startPreviewAndPlay(sortedProjects[currentIndex - 1]);
    } else {
      Tone.Transport.seconds = 0;
      setCurrentTime(0);
    }
  };

  const handleSkipForward = () => {
    if (!previewingId || sortedProjects.length === 0) return;
    const currentIndex = sortedProjects.findIndex(p => p.id === previewingId);
    if (currentIndex >= 0 && currentIndex < sortedProjects.length - 1) {
      startPreviewAndPlay(sortedProjects[currentIndex + 1]);
    } else {
      startPreviewAndPlay(sortedProjects[0]); // Wrap-around
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handlePreview = async (p: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (previewingId === p.id) {
       handlePlayPause();
    } else {
       startPreviewAndPlay(p);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-white p-8">
      <div className="max-w-5xl mx-auto w-full">
        <button 
          onClick={() => navigate('/')}
          className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-bold uppercase tracking-wider"
        >
          <ArrowLeft size={16} />
          Back to SeeVibe Home
        </button>
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-3">
             <SeeVibeLogo variant="lockup" size={44} />
          </div>
          
          <div>
            {user ? (
               <div className="flex items-center gap-4">
                 <span className="text-sm text-gray-400">{user.email}</span>
                 <button 
                   onClick={() => supabase.auth.signOut()}
                   className="text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-white"
                 >
                   Logout
                 </button>
               </div>
            ) : (
               <button 
                 onClick={() => setAuthOpen(true)}
                 className="px-6 py-2 bg-white text-black font-bold uppercase tracking-widest text-xs rounded-full hover:bg-gray-200 transition-colors"
               >
                 Sign In / Sign Up
               </button>
            )}
          </div>
        </div>

        <div className="flex justify-between items-end mb-8 border-b border-[#222] pb-4">
           <h2 className="text-2xl font-bold">Your Projects</h2>
           <button 
             onClick={handleCreateNew}
             className="px-4 py-2 bg-[#00FF9C] text-black font-bold text-sm rounded flex items-center gap-2 hover:bg-[#00cc7d] transition-colors"
           >
             <Plus size={18} /> New Project
           </button>
        </div>

        {/* RESUME ACTIVE WORKSPACE QUICK BANNER */}
        {hasLocalProject && (
          <div className="mb-8 p-4 bg-gradient-to-r from-[#17251F] to-[#0A110E] border border-[#00FF9C]/30 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-[0_0_20px_rgba(0,255,156,0.05)] animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#00FF9C]/10 border border-[#00FF9C]/30 flex items-center justify-center text-[#00FF9C] shrink-0">
                <Play className="animate-pulse animate-duration-1000" size={18} fill="currentColor" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  Active Project Saved Session
                  <span className="px-1.5 py-0.2 bg-[#00FF9C]/20 text-[#00FF9C] text-[8px] rounded-full uppercase tracking-wider font-mono">
                    In Progress
                  </span>
                </h4>
                <p className="text-xs text-gray-400 mt-0.5 font-sans leading-relaxed">
                  Resume your latest studio sessions and custom audio edits exactly where you left them.
                </p>
              </div>
            </div>
            <button
              onClick={handleResumeLastSession}
              className="w-full md:w-auto px-5 py-2 bg-[#00FF9C] hover:bg-[#00cc7d] text-black font-black uppercase text-xs rounded-lg shadow-lg flex items-center justify-center gap-1.5 transition-colors shrink-0"
            >
              Resume Workspace ⚡
            </button>
          </div>
        )}

        {tableMissing && (
          <div className="mb-8 p-6 bg-red-500/20 border border-red-500/50 rounded-xl text-red-200">
            <h3 className="text-lg font-bold mb-2">Database Setup Required</h3>
            <p className="mb-4">You have connected to Supabase, but the <code>studio_projects</code> table is missing. Run this SQL query in your Supabase SQL Editor:</p>
            <pre className="p-4 bg-[#0a0a0a] rounded-lg text-sm text-gray-300 overflow-x-auto whitespace-pre">
{`create table public.studio_projects (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null default 'Untitled Project',
  bpm int not null default 120,
  music_key text not null default 'C',
  data jsonb not null default '{}',
  cover_url text,
  is_published boolean not null default false,
  is_collaborative boolean not null default false,
  last_autosave_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.studio_projects enable row level security;
create policy "Users can view their own projects" on public.studio_projects for select using ( auth.uid() = user_id );
create policy "Users can insert their own projects" on public.studio_projects for insert with check ( auth.uid() = user_id );
create policy "Users can update their own projects" on public.studio_projects for update using ( auth.uid() = user_id );
create policy "Users can delete their own projects" on public.studio_projects for delete using ( auth.uid() = user_id );`}
            </pre>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500">Loading projects...</p>
        ) : !user ? (
          <div className="text-center py-20 bg-[#111] rounded-xl border border-[#222]">
            <p className="text-gray-400 mb-4">Sign in to save and sync your projects across devices.</p>
            <button 
              onClick={() => setAuthOpen(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 font-bold uppercase rounded-xl hover:opacity-90 transition-opacity"
            >
              Get Started for Free
            </button>
          </div>
        ) : projects.length === 0 ? (
           <div className="text-center py-20 border border-dashed border-[#333] rounded-xl">
             <p className="text-gray-500 mb-4">No projects yet.</p>
             <button 
               onClick={handleCreateNew}
               className="text-[#00FF9C] hover:text-white transition-colors"
             >
               Start your first beat
             </button>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-28">
            {sortedProjects.map(p => (
              <div 
                key={p.id}
                onClick={() => onOpenProject(p)}
                className={`bg-[#111] border rounded-xl p-6 cursor-pointer transition-all hover:-translate-y-1 group relative ${previewingId === p.id ? 'border-[#00FF9C] shadow-[0_0_15px_rgba(0,255,156,0.1)]' : 'border-[#222] hover:border-[#00FF9C]/60'}`}
              >
                {pinnedIds.includes(p.id) && (
                  <div className="absolute top-0 left-6 -translate-y-1/2 bg-[#00FF9C] text-black text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full shadow flex items-center gap-1">
                    <Pin size={8} className="fill-current" /> Pinned
                  </div>
                )}

                <div className="flex justify-between items-center mb-4 select-none">
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       if (previewingId === p.id) {
                         handlePlayPause();
                       } else {
                         startPreviewAndPlay(p);
                       }
                     }}
                     className="w-10 h-10 rounded-lg bg-[#222] flex items-center justify-center hover:bg-[#333] border border-zinc-850 hover:border-[#00FF9C]/40 transition-all active:scale-95"
                     title="Preview Mix"
                   >
                     {previewingId === p.id && isPlaying
                       ? <Pause size={16} fill="currentColor" className="text-[#00FF9C] animate-pulse" /> 
                       : <Play size={18} className="text-[#00FF9C] opacity-70 group-hover:opacity-100 ml-0.5" />
                     }
                   </button>

                   <div className="flex items-center gap-2">
                     <button 
                       onClick={(e) => {
                         e.stopPropagation();
                         togglePin(p.id);
                       }}
                       className={`p-2 bg-black/40 hover:bg-[#222]/80 border transition-all rounded shadow flex items-center justify-center cursor-pointer ${pinnedIds.includes(p.id) ? 'text-[#00FF9C] border-[#00FF9C]/40' : 'text-gray-500 hover:text-white border-zinc-800/80'}`}
                       title={pinnedIds.includes(p.id) ? "Unpin project from top" : "Pin project to top"}
                     >
                       <Pin size={14} className={pinnedIds.includes(p.id) ? "fill-current" : ""} />
                     </button>
                     <button 
                       onClick={(e) => handleDelete(p.id, e)}
                       className="text-gray-600 hover:text-red-500 hover:bg-red-500/10 border border-zinc-800/80 transition-all p-2 bg-black/40 rounded shadow flex items-center justify-center cursor-pointer"
                       title="Delete Project"
                     >
                       <Trash2 size={14} />
                     </button>
                   </div>
                </div>

                {isEditingId === p.id ? (
                  <div className="flex items-center gap-1.5 mt-2 select-none" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editTitleValue}
                      onChange={(e) => setEditTitleValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTitle(p.id);
                        if (e.key === 'Escape') setIsEditingId(null);
                      }}
                      className="bg-[#1A1A1A] text-white text-sm px-2.5 py-1.5 rounded border border-[#00FF9C] focus:outline-none flex-1 font-bold min-w-0"
                      autoFocus
                    />
                    <button 
                      onClick={() => handleSaveTitle(p.id)}
                      className="p-1.5 bg-[#00FF9C] text-black rounded hover:bg-[#00cc7d] transition-colors cursor-pointer"
                      title="Save"
                    >
                      <Check size={14} className="stroke-[3px]" />
                    </button>
                    <button 
                      onClick={() => setIsEditingId(null)}
                      className="p-1.5 bg-zinc-800 text-gray-400 rounded hover:text-white transition-colors cursor-pointer"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mt-2 min-w-0 group/info select-none">
                    <h3 className="text-base font-bold text-white truncate flex-1 min-w-0 tracking-tight group-hover/info:text-[#00FF9C]/90 transition-colors">
                      {p.title}
                    </h3>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditingId(p.id);
                        setEditTitleValue(p.title);
                      }}
                      className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 ml-2 bg-black/20 hover:bg-black/40 rounded-md inline-flex items-center justify-center shrink-0 cursor-pointer"
                      title="Rename Project"
                    >
                      <Pencil size={11} />
                    </button>
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-1 select-none">
                   Edited {new Date(p.updated_at || p.created_at || Date.now()).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Advanced Floating Preview Player Bar */}
      {previewingId && previewingProject && (
        <div 
          id="audio-preview-player" 
          className="fixed bottom-0 left-0 right-0 z-50 bg-[#0A0A0C]/95 backdrop-blur-md border-t border-[#00FF9C]/25 px-6 py-4 shadow-[0_-10px_35px_rgba(0,0,0,0.85)]"
        >
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Left Side Info */}
            <div className="flex items-center gap-3 w-full md:w-1/3 min-w-0">
              <div className="w-12 h-12 rounded-lg bg-[#141416] border border-[#00FF9C]/20 flex items-center justify-center text-[#00FF9C] shrink-0 relative overflow-hidden shadow-inner">
                <div className={`absolute inset-0 bg-[#00FF9C]/5 ${isPlaying ? 'animate-pulse' : ''}`} />
                <Music className={`${isPlaying ? 'animate-bounce text-[#00FF9C]' : 'text-gray-500'}`} size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono font-black tracking-wider text-fuchsia-400 bg-fuchsia-950/40 px-1.5 py-0.5 rounded border border-fuchsia-900/40 uppercase">Preview Mode</span>
                  <span className="text-[10px] font-mono text-zinc-500 font-bold">{bpm} BPM</span>
                </div>
                <h4 className="text-sm font-bold text-white truncate mt-1">{previewingProject.title}</h4>
              </div>
            </div>

            {/* Center Controls */}
            <div className="flex flex-col items-center gap-2 w-full md:w-1/3 shrink-0">
              <div className="flex items-center gap-4">
                {/* Back Next button */}
                <button
                  onClick={handleSkipBack}
                  className="p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-full cursor-pointer flex items-center justify-center"
                  title="Previous project preview"
                >
                  <SkipBack size={18} fill="currentColor" />
                </button>

                {/* Rewind -5s button */}
                <button
                  onClick={handleRewind5s}
                  className="p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-full cursor-pointer flex items-center justify-center"
                  title="-5 seconds"
                >
                  <Rewind size={18} />
                </button>

                {/* Primary Play/Pause Button */}
                <button
                  onClick={handlePlayPause}
                  className="w-11 h-11 rounded-full bg-[#00FF9C] text-black hover:bg-[#00cc7d] flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-[#00FF9C]/10 cursor-pointer"
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
                </button>

                {/* Fast Forward +5s button */}
                <button
                  onClick={handleFastForward5s}
                  className="p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-full cursor-pointer flex items-center justify-center"
                  title="+5 seconds"
                >
                  <FastForward size={18} />
                </button>

                {/* Forward Next button */}
                <button
                  onClick={handleSkipForward}
                  className="p-2 text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-full cursor-pointer flex items-center justify-center"
                  title="Next project preview"
                >
                  <SkipForward size={18} fill="currentColor" />
                </button>
              </div>

              {/* Live EQ Visualization bar (Purely visual/stylized aesthetic) */}
              {isPlaying && (
                <div className="flex items-center gap-[3px] h-3 select-none">
                  <span className="w-0.5 h-1 bg-[#00FF9C] animate-[pulse_0.4s_infinite_alternate]" />
                  <span className="w-0.5 h-3 bg-[#00FF9C] animate-[pulse_0.6s_infinite_alternate_0.2s]" />
                  <span className="w-0.5 h-2 bg-[#00FF9C] animate-[pulse_0.5s_infinite_alternate_0.1s]" />
                  <span className="w-0.5 h-3.5 bg-[#00FF9C] animate-[pulse_0.7s_infinite_alternate_0.3s]" />
                  <span className="w-0.5 h-1.5 bg-[#00FF9C] animate-[pulse_0.4s_infinite_alternate_0.15s]" />
                  <span className="w-0.5 h-2.5 bg-[#00FF9C] animate-[pulse_0.5s_infinite_alternate_0.05s]" />
                  <span className="w-0.5 h-1 bg-[#00FF9C] animate-[pulse_0.4s_infinite_alternate]" />
                </div>
              )}
            </div>

            {/* Right Side Slider Timeline */}
            <div className="flex items-center gap-3 w-full md:w-1/3 select-none">
              <span className="text-[10px] font-mono text-zinc-400 min-w-[28px] text-right">
                {formatTime(currentTime)}
              </span>
              
              <input
                type="range"
                min="0"
                max={totalDurationSeconds}
                value={currentTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCurrentTime(val);
                  Tone.Transport.seconds = val;
                }}
                className="flex-1 h-1 bg-zinc-805 rounded-lg appearance-none cursor-pointer accent-[#00FF9C] focus:outline-none"
              />

              <span className="text-[10px] font-mono text-zinc-400 min-w-[28px]">
                {formatTime(totalDurationSeconds)}
              </span>

              <button
                onClick={() => {
                  Tone.Transport.stop();
                  setIsPlaying(false);
                  setPreviewingId(null);
                  setCurrentTime(0);
                }}
                className="p-1 px-2 border border-zinc-800 hover:border-red-500/50 rounded-md hover:text-red-400 transition-all text-[9px] font-mono font-bold uppercase tracking-wider shrink-0 cursor-pointer ml-1 text-gray-400 hover:bg-red-500/5"
                title="Dismiss player"
              >
                <X size={10} className="inline mr-1" />
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
