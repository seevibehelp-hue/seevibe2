// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Mic, Square, Upload, Sparkles, Play, Pause, Download, Trash2, Wallet, AlertCircle, Music as MusicIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../integrations/supabase/client';
import { renderArrangementToWav, SongArrangement } from '../utils/songRenderer';
import { apiUrl } from '../lib/apiBase';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

interface SongRow {
  id: string;
  title: string;
  audio_url: string | null;
  cover_url: string | null;
  vocals_url: string | null;
  bpm: number | null;
  music_key: string | null;
  genre: string | null;
  duration_seconds: number | null;
  status: string;
  prompt: string;
  created_at: string;
  score_json: any;
}

const COST_USD = 0.20;

export function AiProducer() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: 'assistant', content: "Hey! I'm your AI producer. Describe the song you want — vibe, genre, mood, tempo, duration. Upload or record vocals if you want me to layer them in. Each generation costs $0.20.", ts: Date.now() },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ msg: string; pct: number } | null>(null);
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [vocalsBlob, setVocalsBlob] = useState<Blob | null>(null);
  const [vocalsName, setVocalsName] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load wallet + songs
  const refresh = async () => {
    if (!user) return;
    const [w, s] = await Promise.all([
      supabase.from('wallets').select('balance_usd').eq('user_id', user.id).maybeSingle(),
      supabase.from('songs').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
    ]);
    if (w.data) setBalance(Number(w.data.balance_usd || 0));
    if (s.data) setSongs(s.data as SongRow[]);
  };

  useEffect(() => { refresh(); }, [user]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, progress]);

  // Vocal recording
  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setVocalsBlob(blob);
        setVocalsName(`recording-${Date.now()}.webm`);
        stream.getTracks().forEach(t => t.stop());
      };
      rec.start();
      mediaRecRef.current = rec;
      setIsRecording(true);
    } catch (e: any) {
      alert('Mic permission required: ' + e.message);
    }
  };
  const stopRec = () => {
    mediaRecRef.current?.stop();
    setIsRecording(false);
  };

  const onPickVocals = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setVocalsBlob(f);
    setVocalsName(f.name);
  };

  const uploadToBucket = async (path: string, blob: Blob, contentType: string): Promise<string | null> => {
    const { error } = await supabase.storage.from('songs').upload(path, blob, { contentType, upsert: true });
    if (error) { console.error(error); return null; }
    const { data } = supabase.storage.from('songs').getPublicUrl(path);
    return data.publicUrl;
  };

  // Parse duration from text e.g. "2:30", "3 minutes"
  const parseDuration = (txt: string): number | null => {
    const m = txt.toLowerCase();
    const t = m.match(/(\d{1,2}):(\d{2})/);
    if (t) return Math.min(240, parseInt(t[1]) * 60 + parseInt(t[2]));
    const min = m.match(/(\d+)\s*(?:min|minute)/);
    if (min) return Math.min(240, parseInt(min[1]) * 60);
    const sec = m.match(/(\d+)\s*(?:sec|second)/);
    if (sec) return Math.min(240, parseInt(sec[1]));
    return null;
  };

  const handleSend = async () => {
    if (!user) { navigate('/auth'); return; }
    const text = input.trim();
    if (!text || busy) return;
    if (balance !== null && balance < COST_USD) {
      alert(`Insufficient wallet balance. You need $${COST_USD.toFixed(2)}. Top up in Wallet.`);
      return;
    }

    setMessages(m => [...m, { role: 'user', content: text, ts: Date.now() }]);
    setInput('');
    setBusy(true);
    setProgress({ msg: 'Reserving credits…', pct: 0.02 });

    try {
      // 1) Atomic deduction via RPC (returns insufficient_funds without giving free credit)
      const { data: chargeRes, error: dErr } = await supabase.rpc('charge_ai_prompt', {
        p_user_id: user.id,
        p_provider_id: null,
        p_prompt: text,
        p_cost_usd: COST_USD,
      });
      if (dErr) throw new Error(dErr.message || 'Wallet charge failed');
      if (chargeRes && (chargeRes as any).success === false) {
        const reason = (chargeRes as any).reason;
        if (reason === 'insufficient_funds') {
          throw new Error(`Insufficient funds — you have ₦${(chargeRes as any).balance_naira?.toLocaleString?.() ?? '0'}, need ₦${(chargeRes as any).required_naira?.toLocaleString?.() ?? '320'}. Top up in Wallet.`);
        }
        throw new Error(`Charge failed: ${reason}`);
      }
      // Refresh balance from DB after charge
      const { data: w } = await supabase.from('wallets').select('balance_usd').eq('user_id', user.id).maybeSingle();
      if (w) setBalance(Number(w.balance_usd || 0));


      // 2) Upload vocals (if any) + analyze structure for vocal-aware AI
      let vocalsUrl: string | null = null;
      let vocalAnalysis: any = null;
      if (vocalsBlob) {
        setProgress({ msg: 'Uploading vocals…', pct: 0.05 });
        const ext = vocalsName.split('.').pop() || 'webm';
        const path = `${user.id}/vocals/${Date.now()}.${ext}`;
        vocalsUrl = await uploadToBucket(path, vocalsBlob, vocalsBlob.type || 'audio/webm');

        // Analyze vocal: detect BPM-equivalent, silence regions, phrases
        try {
          setProgress({ msg: 'Analyzing vocal structure…', pct: 0.1 });
          const arrayBuf = await vocalsBlob.arrayBuffer();
          const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
          const ctx = new Ctx();
          const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
          const durationSec = decoded.duration;
          const assumedBpm = 100; // ruler-based default; analyzer is BPM-tolerant
          const [{ analyzeAudioPitch }, { VocalAnalyzerProcessor }] = await Promise.all([
            import('../audio/vocalAnalysis'),
            import('../audio/vocal-analyzer-processor'),
          ]);
          const notes = await analyzeAudioPitch(decoded, assumedBpm, 0.01);
          const total16ths = (durationSec / 60) * assumedBpm * 4;
          const phrases = VocalAnalyzerProcessor.detectPhrases(notes, total16ths);
          const structure = VocalAnalyzerProcessor.mapPhrasesToSongStructure(phrases, total16ths);
          vocalAnalysis = {
            durationSec,
            assumedBpm,
            phraseCount: phrases.length,
            phrases: phrases.slice(0, 24).map(p => ({
              startSec: (p.startTime16ths / 4) * (60 / assumedBpm),
              endSec: (p.endTime16ths / 4) * (60 / assumedBpm),
              loudness: Number(p.averageLoudness.toFixed(4)),
              pitchVariance: Number(p.pitchVariance.toFixed(2)),
            })),
            sections: structure.sections.map(s => ({
              type: s.type,
              name: s.name,
              startSec: (s.startBar * 16 / 4) * (60 / assumedBpm),
              lengthSec: (s.lengthBars * 16 / 4) * (60 / assumedBpm),
            })),
          };
          try { await ctx.close(); } catch {}
        } catch (analyzeErr) {
          console.warn("Vocal analysis failed; proceeding without it", analyzeErr);
        }
      }

      // 3) Ask AI for arrangement JSON
      const requestedDur = parseDuration(text);
      const durationSec = vocalAnalysis?.durationSec
        ? Math.min(240, Math.max(30, Math.round(vocalAnalysis.durationSec)))
        : (requestedDur ?? (120 + Math.floor(Math.random() * 60)));
      setProgress({ msg: 'AI composing…', pct: 0.15 });

      // Detect user region for culturally-aware genre selection (timezone is more reliable than language)
      let region = 'unknown';
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        // Map common timezones to ISO country hints
        const tzCountry: Record<string,string> = {
          'Africa/Lagos':'NG','Africa/Accra':'GH','Africa/Johannesburg':'ZA','Africa/Nairobi':'KE','Africa/Cairo':'EG',
          'America/New_York':'US','America/Los_Angeles':'US','America/Chicago':'US','America/Sao_Paulo':'BR',
          'America/Mexico_City':'MX','America/Jamaica':'JM',
          'Europe/London':'GB','Europe/Paris':'FR','Europe/Berlin':'DE','Europe/Madrid':'ES','Europe/Rome':'IT',
          'Asia/Tokyo':'JP','Asia/Seoul':'KR','Asia/Kolkata':'IN','Asia/Shanghai':'CN','Asia/Bangkok':'TH',
        };
        region = tzCountry[tz] || (navigator.language || '').split('-')[1] || tz || 'unknown';
      } catch {}

      // Try to extract an explicit genre from the user's text
      const genreMatch = text.match(/\b(afrobeat[s]?|amapiano|hip[ -]?hop|trap|pop|rnb|r&b|reggae|reggaeton|dancehall|house|techno|edm|jazz|rock|country|gospel|drill|afroswing|kpop|jpop|bollywood|funk|disco|lofi|ambient|classical|blues|salsa|samba)\b/i);
      const requestedGenre = genreMatch ? genreMatch[0] : '';

      const { data: { session } } = await supabase.auth.getSession();
      const aiRes = await fetch(apiUrl('/api/ai/produce-song'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(session?.access_token ? { authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          description: text,
          durationSec,
          hasVocals: !!vocalsUrl,
          seed: crypto.randomUUID(),
          region,
          requestedGenre,
          vocalAnalysis,
        }),
      });
      if (!aiRes.ok) {
        const j = await aiRes.json().catch(() => ({}));
        throw new Error(j.error || `AI error (${aiRes.status})`);
      }

      const { arrangement } = await aiRes.json() as { arrangement: SongArrangement };

      // 4) Render to WAV
      setProgress({ msg: 'Rendering audio…', pct: 0.35 });
      const wavBlob = await renderArrangementToWav(arrangement, vocalsUrl, (msg, pct) => {
        setProgress({ msg, pct: 0.35 + pct * 0.55 });
      });

      // 5) Upload final audio
      setProgress({ msg: 'Saving song…', pct: 0.92 });
      const audioPath = `${user.id}/songs/${Date.now()}.wav`;
      const audioUrl = await uploadToBucket(audioPath, wavBlob, 'audio/wav');

      // 6) Save song row
      const { data: songRow, error: sErr } = await supabase.from('songs').insert({
        user_id: user.id,
        title: arrangement.title || 'Untitled',
        prompt: text,
        description: arrangement.fxNotes || null,
        genre: arrangement.genre || null,
        bpm: arrangement.bpm || null,
        music_key: `${arrangement.key} ${arrangement.scale}`,
        duration_seconds: arrangement.durationSec,
        audio_url: audioUrl,
        vocals_url: vocalsUrl,
        score_json: arrangement,
        status: 'ready',
      }).select().single();
      if (sErr) throw new Error(sErr.message);

      setMessages(m => [...m, {
        role: 'assistant',
        content: `🎵 **${arrangement.title}** — ${arrangement.genre}, ${arrangement.bpm} BPM, key ${arrangement.key} ${arrangement.scale}. Duration ${Math.round(arrangement.durationSec)}s${vocalsUrl ? ' (vocals layered)' : ''}. Tap play below to listen.`,
        ts: Date.now(),
      }]);
      setVocalsBlob(null);
      setVocalsName('');
      await refresh();
    } catch (e: any) {
      console.error(e);
      setMessages(m => [...m, { role: 'assistant', content: `⚠️ ${e.message || 'Something went wrong.'}`, ts: Date.now() }]);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handlePlay = (s: SongRow) => {
    if (!s.audio_url) return;
    if (playingId === s.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const a = new Audio(s.audio_url);
    a.onended = () => setPlayingId(null);
    a.play();
    audioRef.current = a;
    setPlayingId(s.id);
  };

  const handleDownload = (s: SongRow) => {
    if (!s.audio_url) return;
    const a = document.createElement('a');
    a.href = s.audio_url;
    a.download = `${s.title || 'song'}.wav`;
    a.click();
  };

  const handleDelete = async (s: SongRow) => {
    if (!confirm(`Delete "${s.title}"?`)) return;
    if (playingId === s.id) { audioRef.current?.pause(); setPlayingId(null); }
    // best-effort remove storage objects
    if (s.audio_url) {
      const path = s.audio_url.split('/songs/').slice(1).join('/songs/');
      if (path) await supabase.storage.from('songs').remove([path]).catch(() => {});
    }
    await supabase.from('songs').delete().eq('id', s.id);
    setSongs(songs => songs.filter(x => x.id !== s.id));
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#1a1a1a]">
        <button onClick={() => navigate('/')} className="p-2 -ml-2"><ArrowLeft size={20} /></button>
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-fuchsia-400" />
          <h1 className="font-bold">AI Producer</h1>
        </div>
        <button onClick={() => navigate('/wallet')} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141414] rounded-full text-xs">
          <Wallet size={12} className="text-emerald-400" />
          <span>${balance === null ? '—' : balance.toFixed(2)}</span>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-fuchsia-600 text-white' : 'bg-[#161616] text-gray-100 border border-[#222]'}`}>
              {m.content}
            </div>
          </div>
        ))}

        {progress && (
          <div className="bg-[#0f0f0f] border border-[#222] rounded-xl p-3">
            <div className="flex justify-between text-[11px] text-gray-400 mb-1.5">
              <span>{progress.msg}</span><span>{Math.round(progress.pct * 100)}%</span>
            </div>
            <div className="h-1.5 bg-[#1c1c1c] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 transition-all" style={{ width: `${progress.pct * 100}%` }} />
            </div>
          </div>
        )}

        {/* Songs */}
        {songs.length > 0 && (
          <div className="pt-4 space-y-2">
            <h2 className="text-[11px] uppercase tracking-wider text-gray-500 font-mono px-1">Your Songs</h2>
            {songs.map(s => (
              <div key={s.id} className="bg-[#111] border border-[#1e1e1e] rounded-xl p-3 flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-fuchsia-600 to-cyan-500 flex items-center justify-center shrink-0">
                  <MusicIcon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{s.title}</div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {s.genre || 'song'} · {s.bpm || '–'} BPM · {s.music_key || '–'} · {s.duration_seconds ? `${Math.round(s.duration_seconds)}s` : ''}
                  </div>
                </div>
                <button onClick={() => handlePlay(s)} className="w-9 h-9 rounded-full bg-fuchsia-600 hover:bg-fuchsia-500 flex items-center justify-center" disabled={!s.audio_url}>
                  {playingId === s.id ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                </button>
                <button onClick={() => handleDownload(s)} className="w-9 h-9 rounded-full bg-[#1a1a1a] hover:bg-[#222] flex items-center justify-center" disabled={!s.audio_url}>
                  <Download size={14} />
                </button>
                <button onClick={() => handleDelete(s)} className="w-9 h-9 rounded-full bg-[#1a1a1a] hover:bg-red-600/20 hover:text-red-400 flex items-center justify-center">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-[#1a1a1a] p-3 space-y-2">
        {vocalsBlob && (
          <div className="flex items-center gap-2 bg-[#111] border border-[#222] rounded-lg px-3 py-1.5 text-xs">
            <Mic size={12} className="text-emerald-400" />
            <span className="flex-1 truncate text-gray-300">{vocalsName}</span>
            <button onClick={() => { setVocalsBlob(null); setVocalsName(''); }} className="text-gray-500 hover:text-red-400">
              <Trash2 size={12} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <label className="w-10 h-10 rounded-full bg-[#161616] hover:bg-[#1f1f1f] flex items-center justify-center cursor-pointer shrink-0">
            <Upload size={16} />
            <input type="file" accept="audio/*" className="hidden" onChange={onPickVocals} />
          </label>
          <button
            onClick={isRecording ? stopRec : startRec}
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-[#161616] hover:bg-[#1f1f1f]'}`}
          >
            {isRecording ? <Square size={14} /> : <Mic size={16} />}
          </button>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={busy ? 'Generating…' : 'Describe your song…'}
            rows={1}
            disabled={busy}
            className="flex-1 resize-none bg-[#0f0f0f] border border-[#222] rounded-2xl px-3.5 py-2.5 text-sm placeholder-gray-600 focus:outline-none focus:border-fuchsia-500/50 disabled:opacity-50 max-h-32"
          />
          <button
            onClick={handleSend}
            disabled={busy || !input.trim()}
            className="w-10 h-10 rounded-full bg-fuchsia-600 hover:bg-fuchsia-500 disabled:bg-[#222] disabled:text-gray-600 flex items-center justify-center shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="text-[10px] text-gray-600 text-center font-mono">${COST_USD.toFixed(2)} per generation · 2–3 min original songs</div>
      </div>
    </div>
  );
}
