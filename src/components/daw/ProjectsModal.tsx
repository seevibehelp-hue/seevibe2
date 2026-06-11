// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Save, FolderOpen, Trash2 } from 'lucide-react';
import { useDawStore, getFxDefaults } from '../../store/useDawStore';

export function ProjectsModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [user, setUser] = useState<any>(null);
  const [tableMissing, setTableMissing] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    }).catch(err => {
      console.warn("Supabase session fetch failed in ProjectsModal:", err);
    });
  }, []);

  const fetchProjects = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('studio_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
        
      if (error) {
        if (error.message.includes('Could not find the table')) {
          setTableMissing(true);
        } else {
          throw error;
        }
      } else {
        setProjects(data || []);
      }
    } catch (e: any) {
      console.error(e.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
      const st = useDawStore.getState();
      if (st.currentProjectName) {
        setSaveName(st.currentProjectName);
      }
    }
  }, [isOpen]);

  const handleSave = async (asNew: boolean = false) => {
    if (!user || !saveName.trim()) return;
    const state = useDawStore.getState();
    const stateStr = JSON.stringify({
      tracks: state.tracks,
      clips: state.clips,
      bpm: state.bpm
    });

    try {
      const payload: any = {
        user_id: user.id,
        title: saveName.trim(),
        data: JSON.parse(stateStr),
        updated_at: new Date().toISOString()
      };
      
      if (!asNew && state.currentProjectId) {
        payload.id = state.currentProjectId;
      }

      const { data, error } = await supabase
        .from('studio_projects')
        .upsert(payload)
        .select()
        .single();
        
      if (error) {
        if (error.message.includes('Could not find the table')) {
          setTableMissing(true);
        } else {
          throw error;
        }
      }
      if (data) {
        useDawStore.getState().setCurrentProject(data.id, data.title);
      }
      fetchProjects();
    } catch (e: any) {
      console.error("Save failed", e.message);
    }
  };

  const handleLoad = (project: any) => {
    try {
      const parsed = (typeof project.data === 'string' && project.data !== 'undefined' && project.data.trim() !== '') ? JSON.parse(project.data) : (project.data || {});
      
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
        purchasedPlugins: parsed.purchasedPlugins || [],
        chatMessages: parsed.chatMessages || [{ role: 'assistant', content: "Hey! I'm your AI production assistant. How can I help you with your project today?" }]
      });
      const store = useDawStore.getState();
      if (parsed.bpm) store.setBpm(parsed.bpm);
      store.setCurrentProject(project.id, project.title);
      onClose();
    } catch (e) {
      console.error("Load failed", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('studio_projects').delete().eq('id', id);
      if (error) throw error;
      fetchProjects();
    } catch (e: any) {
      console.error("Delete failed", e.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#111] rounded-2xl w-full max-w-lg border border-[#2A2A2A] overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex justify-between items-center p-6 border-b border-[#2A2A2A]">
          <h2 className="text-xl font-bold text-white">Projects</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {tableMissing && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm">
              <strong className="block mb-1 font-bold">Supabase Database Setup Required</strong>
              <p className="mb-2">It looks like the <code>studio_projects</code> table doesn't exist in your Supabase project.</p>
              <p>Please run the following SQL query in your Supabase SQL Editor:</p>
              <pre className="mt-2 p-2 bg-[#111] rounded text-xs text-gray-300 overflow-x-auto">
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
          <div className="flex gap-2 mb-6">
            <input 
              type="text" 
              placeholder="Project Name..." 
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              className="flex-1 bg-[#222] border border-[#333] rounded px-3 py-2 text-white outline-none focus:border-[#00FF9C]"
            />
            <button 
              onClick={() => handleSave(false)}
              className="bg-[#00FF9C] text-black font-bold px-4 py-2 rounded flex items-center gap-2 hover:bg-[#00cc7d]"
            >
              <Save size={16} /> {useDawStore.getState().currentProjectId ? 'Save / Update' : 'Save'}
            </button>
            {useDawStore.getState().currentProjectId && (
              <button 
                onClick={() => handleSave(true)}
                className="bg-[#333] text-[#00FF9C] font-bold px-4 py-2 rounded flex items-center hover:bg-[#444]"
              >
                Save As Copy
              </button>
            )}
          </div>

          <div className="space-y-2 overflow-y-auto max-h-64">
            {loading ? (
              <p className="text-gray-500 text-center py-4">Loading...</p>
            ) : projects.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No projects saved.</p>
            ) : projects.map(p => (
              <div key={p.id} className="flex justify-between items-center bg-[#1A1A1A] p-3 rounded border border-[#2A2A2A]">
                <div>
                  <h3 className="text-white font-bold">{p.title}</h3>
                  <p className="text-gray-500 text-xs">{new Date(p.updated_at || p.created_at || Date.now()).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleLoad(p)}
                    className="p-2 bg-[#222] text-[#00FF9C] rounded hover:bg-[#333]"
                  >
                    <FolderOpen size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(p.id)}
                    className="p-2 bg-[#222] text-red-500 rounded hover:bg-[#333]"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}