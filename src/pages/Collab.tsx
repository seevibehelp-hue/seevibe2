// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Folder, Users, Share2, MessageCircle } from 'lucide-react';

export function Collab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'projects' | 'invites' | 'chat'>('projects');
  
  const [myProjects, setMyProjects] = useState<any[]>([]);
  const [collabProjects, setCollabProjects] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [activeProjectChat, setActiveProjectChat] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      const [{ data: mine }, { data: collabs }, { data: invs }] = await Promise.all([
        supabase.from('studio_projects').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
        supabase.from('collaboration_members').select('project_id, collaboration_projects(*)').eq('user_id', user.id),
        supabase.from('collaboration_invites').select('*, collaboration_projects(title)').eq('invited_user_id', user.id).eq('status', 'pending')
      ]);
      setMyProjects(mine || []);
      setCollabProjects((collabs || []).map(c => c.collaboration_projects));
      setInvites(invs || []);
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    if (tab === 'chat' && activeProjectChat) {
      // Load and sub to chat
      supabase.from('collaboration_messages').select('*, profiles(username)').eq('project_id', activeProjectChat).order('created_at', { ascending: true })
        .then(({ data }) => setChatMessages(data || []));

      const ch = supabase.channel('collab-chat')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'collaboration_messages', filter: `project_id=eq.${activeProjectChat}` }, 
          payload => {
            // Need to fetch username for the new message
            supabase.from('profiles').select('username').eq('id', payload.new.user_id).single()
              .then(({ data }) => setChatMessages(prev => [...prev, { ...payload.new, profiles: data }]));
          }
        ).subscribe();
      return () => { supabase.removeChannel(ch); };
    }
  }, [tab, activeProjectChat]);

  const sendMsg = async () => {
    if (!newMsg.trim() || !activeProjectChat || !user) return;
    await supabase.from('collaboration_messages').insert({ project_id: activeProjectChat, user_id: user.id, message: newMsg.trim() });
    setNewMsg('');
  };

  return (
    <div className="flex flex-col h-full bg-background p-4 pb-20">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Collaborate</h1>
        <button className="bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white font-semibold py-2 px-4 rounded-xl text-sm">
          + New
        </button>
      </div>

      <div className="flex bg-[#141414] rounded-full p-1 mb-6">
        {['projects', 'invites', 'chat'].map(t => (
          <button 
            key={t}
            onClick={() => setTab(t as any)}
            className={`flex-1 capitalize text-sm font-medium py-2 rounded-full transition-colors ${tab === t ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-md' : 'text-gray-400'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'projects' && (
        <div className="space-y-6 overflow-y-auto">
          <div>
            <h2 className="text-xs text-gray-500 font-bold mb-3 uppercase tracking-wider">Collaborating</h2>
            <div className="space-y-3">
              {collabProjects.map(p => (
                <div key={p.id} className="p-4 bg-[#141414] rounded-2xl border border-[#222]">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-[#1A1A1A] rounded-xl flex items-center justify-center text-cyan-400"><Users size={20}/></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{p.title}</span>
                        <span className="text-[10px] bg-fuchsia-500/20 text-fuchsia-400 px-2 py-0.5 rounded-full">Collab</span>
                      </div>
                      <div className="text-[10px] text-gray-400">{p.tempo} BPM • {p.time_signature}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => navigate(`/studio?project=${p.id}`)} className="flex-1 bg-[#1A1A1A] hover:bg-[#2A2A2A] text-sm py-2 rounded-xl flex items-center justify-center gap-2 transition-colors"><Folder size={14}/> Open</button>
                    <button onClick={() => { setActiveProjectChat(p.id); setTab('chat'); }} className="w-10 bg-[#1A1A1A] hover:bg-[#2A2A2A] rounded-xl flex items-center justify-center transition-colors"><MessageCircle size={14}/></button>
                  </div>
                </div>
              ))}
              {collabProjects.length === 0 && <p className="text-sm text-gray-500">No active collaborations.</p>}
            </div>
          </div>

          <div>
            <h2 className="text-xs text-gray-500 font-bold mb-3 uppercase tracking-wider">My Projects</h2>
            <div className="space-y-3">
              {myProjects.map(p => (
                <div key={p.id} className="p-4 bg-[#141414] rounded-2xl border border-[#222] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#1A1A1A] rounded-xl flex items-center justify-center text-fuchsia-400"><Folder size={20}/></div>
                    <div>
                      <div className="font-semibold text-sm">{p.title}</div>
                      <div className="text-[10px] text-gray-400">{p.bpm} BPM • {p.music_key}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="w-8 h-8 flex items-center justify-center bg-[#1A1A1A] rounded-lg hover:bg-[#2A2A2A]"><Share2 size={14}/></button>
                    <button onClick={() => navigate(`/studio?project=${p.id}`)} className="px-4 h-8 flex items-center justify-center text-xs font-semibold bg-[#1A1A1A] rounded-lg hover:bg-[#2A2A2A]">Open</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'invites' && (
        <div className="space-y-4">
          {invites.length === 0 ? <p className="text-sm text-gray-500 text-center mt-10">No pending invites.</p> : invites.map(inv => (
            <div key={inv.id} className="p-4 bg-[#141414] rounded-2xl border border-[#222]">
              <div className="font-semibold text-sm mb-1">{inv.collaboration_projects.title}</div>
              <p className="text-xs text-gray-400 mb-4">You have been invited to collaborate.</p>
              <div className="flex gap-2">
                <button className="flex-1 py-2 text-xs font-semibold bg-[#2A2A2A] rounded-xl">Decline</button>
                <button className="flex-1 py-2 text-xs font-semibold bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white rounded-xl">Accept</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'chat' && (
        <div className="flex-1 flex flex-col bg-[#141414] rounded-2xl border border-[#222] overflow-hidden relative">
          {!activeProjectChat ? (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">Select a project to chat</div>
          ) : (
            <>
              <div className="h-12 border-b border-[#2A2A2A] flex items-center px-4 bg-[#1A1A1A]">
                <MessageCircle size={16} className="text-fuchsia-400 mr-2" />
                <span className="font-semibold text-sm truncate">{collabProjects.find(p => p.id === activeProjectChat)?.title || 'Project Chat'}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.map(m => (
                  <div key={m.id} className={`flex flex-col ${m.user_id === user?.id ? 'items-end' : 'items-start'}`}>
                    <div className="text-[10px] text-gray-500 mb-1">{m.profiles?.username || 'User'}</div>
                    <div className={`px-4 py-2 rounded-2xl max-w-[80%] text-sm ${m.user_id === user?.id ? 'bg-fuchsia-500 text-white rounded-tr-none' : 'bg-[#2A2A2A] text-gray-200 rounded-tl-none'}`}>
                      {m.message}
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-[#2A2A2A] bg-[#1A1A1A] flex gap-2">
                <input 
                  type="text" 
                  value={newMsg} 
                  onChange={e => setNewMsg(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && sendMsg()}
                  placeholder="Type a message..." 
                  className="flex-1 bg-[#222] border border-[#333] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-fuchsia-500" 
                />
                <button onClick={sendMsg} className="w-10 bg-fuchsia-500 hover:bg-fuchsia-400 rounded-xl flex items-center justify-center transition-colors">
                  <Share2 size={16} className="text-white transform -rotate-45 -ml-1" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}