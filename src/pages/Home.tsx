// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import { Shield, Bell, Music, DollarSign, Users, Wallet, Video } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AdMobNative } from '../components/AdMobNative';
import { SecurityPolicyModal } from '../components/SecurityPolicyModal';
import { SeeVibeLogo } from '../components/SeeVibeLogo';

export function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [savedCount, setSavedCount] = useState(0);
  const [trendingType, setTrendingType] = useState<'music'|'videos'>('music');
  const [trendingItems, setTrendingItems] = useState<any[]>([]);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('studio_projects')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => {
        if (count !== null) setSavedCount(count);
      });
  }, [user]);

  useEffect(() => {
    const fetchTrending = async () => {
      try {
        if (trendingType === 'music') {
          const { data } = await supabase
            .from('music')
            .select('*, profiles(username,profile_picture)')
            .order('plays_count', { ascending: false })
            .limit(10);
          setTrendingItems(data || []);
        } else {
          const { data } = await supabase
            .from('videos')
            .select('*, profiles(username,profile_picture)')
            .order('likes_count', { ascending: false })
            .limit(10);
          setTrendingItems(data || []);
        }
      } catch (err) {
        console.error('Error fetching trending details:', err);
      }
    };

    fetchTrending();

    // Real-time PostgreSQL subscription channel
    const channel = supabase
      .channel('trending-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'music' }, () => {
        if (trendingType === 'music') fetchTrending();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, () => {
        if (trendingType === 'videos') fetchTrending();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [trendingType]);

  return (
    <div className="flex flex-col p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <SeeVibeLogo variant="lockup" size={38} className="scale-95" />
          <span className="text-xs text-zinc-500 font-mono tracking-wider pl-1.5 border-l border-zinc-800/85">Welcome</span>
        </div>
        <div className="flex space-x-3">
          <button className="w-10 h-10 bg-[#1A1A1A] rounded-xl flex items-center justify-center text-cyan-400 hover:bg-[#2A2A2A]">
            <Shield size={18} />
          </button>
          <button className="w-10 h-10 bg-[#1A1A1A] rounded-xl flex items-center justify-center text-white hover:bg-[#2A2A2A]">
            <Bell size={18} />
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => navigate('/studio')} className="flex flex-col items-start p-4 bg-[#141414] rounded-2xl border border-[#222]">
          <div className="w-10 h-10 bg-fuchsia-500 rounded-xl flex items-center justify-center mb-3">
            <Music size={20} className="text-white" />
          </div>
          <h3 className="font-semibold text-sm">Music Studio</h3>
          <p className="text-[10px] text-gray-400 mt-1 text-left">Create beats & record</p>
        </button>
        <button onClick={() => navigate('/earnings?path=/&title=SeeVibe Earning')} className="flex flex-col items-start p-4 bg-[#141414] rounded-2xl border border-[#222]">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center mb-3">
            <DollarSign size={20} className="text-white" />
          </div>
          <h3 className="font-semibold text-sm">SeeVibe Earning</h3>
          <p className="text-[10px] text-gray-400 mt-1 text-left">Earn & monetize</p>
        </button>
        <button onClick={() => navigate('/collab')} className="flex flex-col items-start p-4 bg-[#141414] rounded-2xl border border-[#222]">
          <div className="w-10 h-10 bg-cyan-500 rounded-xl flex items-center justify-center mb-3">
            <Users size={20} className="text-white" />
          </div>
          <h3 className="font-semibold text-sm">Collaborate</h3>
          <p className="text-[10px] text-gray-400 mt-1 text-left">Work with creators</p>
        </button>
        <button onClick={() => navigate('/wallet')} className="flex flex-col items-start p-4 bg-[#141414] rounded-2xl border border-[#222]">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center mb-3">
            <Wallet size={20} className="text-white" />
          </div>
          <h3 className="font-semibold text-sm">Wallet</h3>
          <p className="text-[10px] text-gray-400 mt-1 text-left">Manage funds</p>
        </button>
      </div>

      {/* Rewarded Ad Fast Trigger */}
      <button 
        onClick={() => {
          import('../store/useAdMobStore').then(({ useAdMobStore }) => {
            useAdMobStore.getState().setRewardedActive(true);
          });
        }} 
        className="w-full bg-[#111215] hover:bg-[#1C1E24] border border-yellow-500/30 text-yellow-400 font-mono text-[11px] font-bold rounded-[20px] py-3.5 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-95 uppercase tracking-wider shadow-md shadow-yellow-500/5 cursor-pointer"
      >
        <span>📺 WATCH AD FOR +20 VIBE TOKENS 💎</span>
      </button>

      {/* Inline Native Sponsor Ad */}
      <AdMobNative layout="feed" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <div className="w-5 h-5 rounded flex items-center justify-center border border-fuchsia-500 text-fuchsia-500"><Music size={12}/></div>
          Saved Projects ({savedCount})
        </div>
        <button className="text-xs text-gray-400" onClick={() => navigate('/studio')}>Show</button>
      </div>

      <div className="pt-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold flex items-center gap-2">
            <Music size={18} className="text-fuchsia-500"/> Trending Now
          </h2>
          <div className="flex bg-[#1A1A1A] rounded-full p-1">
            <button 
              onClick={() => setTrendingType('music')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${trendingType === 'music' ? 'bg-fuchsia-500 text-white' : 'text-gray-400'}`}
            >
              <Music size={12} className="inline mr-1"/> Music
            </button>
            <button 
              onClick={() => setTrendingType('videos')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${trendingType === 'videos' ? 'bg-fuchsia-500 text-white' : 'text-gray-400'}`}
            >
              <Video size={12} className="inline mr-1"/> Videos
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {trendingItems.length === 0 ? (
            <p className="text-sm text-gray-500">No tracks yet.</p>
          ) : (
            trendingItems.map((item, i) => (
              <div 
                key={item.id} 
                onClick={() => navigate(`/earnings?path=${trendingType === 'music' ? '/music' : '/videos'}&title=Trending%20${trendingType === 'music' ? 'Music' : 'Videos'}`)}
                className="flex items-center gap-3 bg-[#111] hover:bg-[#1A1A1A] transition-all p-2 rounded-xl cursor-pointer border border-[#1e1e1e]/40 hover:border-fuchsia-500/30 group"
              >
                <span className="text-xs text-gray-500 w-4 pl-1 group-hover:text-fuchsia-500 transition-colors">{i + 1}</span>
                <div className="w-12 h-12 bg-[#222] rounded-lg overflow-hidden flex-shrink-0">
                  {item.cover_image || item.thumbnail_url ? (
                    <img src={item.cover_image || item.thumbnail_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : <Music size={20} className="m-auto h-full text-gray-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm truncate group-hover:text-fuchsia-400 transition-colors">{item.title}</h4>
                   <p className="text-xs text-gray-400 truncate">@{item.profiles?.username || 'user'}</p>
                </div>
                <div className="text-[10px] text-gray-500 pr-1 shrink-0">
                  {trendingType === 'music' ? `${item.plays_count} plays` : `${item.likes_count} likes`}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Support Info */}
      <div className="pt-8 pb-4 border-t border-[#1A1A1A] flex flex-col items-center space-y-2.5">
        <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest text-center">Join & Connect with SeeVibe</p>
        <div className="flex flex-col sm:flex-row items-center gap-2 w-full max-w-sm justify-center">
          <a
            id="contact-seevibe-home"
            href="mailto:seevibehelp@gmail.com"
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-[#141414] hover:bg-[#1C1C1C] border border-[#222] rounded-xl text-xs font-mono text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span>seevibehelp@gmail.com</span>
          </a>
          
          <button
            type="button"
            id="btn-policy-home"
            onClick={() => setIsPolicyOpen(true)}
            className="flex-1 px-4 py-2.5 bg-[#141414] hover:bg-[#1C1C1C] border border-fuchsia-500/10 hover:border-fuchsia-500/20 rounded-xl text-[10px] font-mono text-fuchsia-400 hover:text-fuchsia-300 font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            Operating Manual & Policy
          </button>
        </div>
      </div>

      <SecurityPolicyModal isOpen={isPolicyOpen} onClose={() => setIsPolicyOpen(false)} />
    </div>
  );
}
