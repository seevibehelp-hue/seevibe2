// @ts-nocheck
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  Mic,
  Square,
  Upload,
  Sparkles,
  Play,
  Pause,
  Download,
  Trash2,
  Wallet,
  Music as MusicIcon,
  ChevronDown,
  ChevronUp,
  ListMusic,
  Layers,
  Zap,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../integrations/supabase/client";
import { renderArrangementToWav, SongArrangement } from "../utils/songRenderer";
import { apiUrl } from "../lib/apiBase";
import { useDawStore } from "../store/useDawStore";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  ts: number;
  arrangement?: SongArrangement; // attach arrangement to assistant messages for structure display
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

const COST_USD = 0.2;

// ─── Section helpers ──────────────────────────────────────────────────────────

const SECTION_ICONS: Record<string, string> = {
  intro: "🎬",
  verse: "🎤",
  verse2: "🎤",
  prechorus: "⚡",
  prechorus2: "⚡",
  chorus: "💥",
  chorus2: "💥",
  chorus3: "💥",
  bridge: "🎷",
  outro: "🎬",
};
const SIGNAL_ICONS: Record<string, string> = {
  riser: "📈",
  crash: "💢",
  fill: "🥁",
  snare_roll: "🥁",
  cymbal_swell: "🔔",
  fx_sweep: "🌊",
  drop_silence: "🤫",
  none: "",
};
const SECTION_COLORS: Record<string, string> = {
  intro: "#6366f1",
  verse: "#8b5cf6",
  verse2: "#8b5cf6",
  prechorus: "#f59e0b",
  prechorus2: "#f59e0b",
  chorus: "#ec4899",
  chorus2: "#ec4899",
  chorus3: "#ec4899",
  bridge: "#06b6d4",
  outro: "#6366f1",
};

function SectionTimeline({
  sections,
  bpm,
}: {
  sections: SongArrangement["sections"];
  bpm: number;
}) {
  const secPerBar = (60 / bpm) * 4;
  const totalBars = sections.reduce((s, x) => s + (x.bars || 0), 0);
  const totalSec = totalBars * secPerBar;

  return (
    <div className="mt-2 space-y-1">
      {/* Bar timeline */}
      <div className="flex h-5 rounded-md overflow-hidden w-full gap-px">
        {sections.map((sec, i) => {
          const pct = ((sec.bars || 0) / totalBars) * 100;
          const color = SECTION_COLORS[sec.name?.toLowerCase()] || "#555";
          return (
            <div
              key={i}
              title={`${sec.name} — ${sec.bars} bars`}
              style={{
                width: `${pct}%`,
                backgroundColor: color,
                opacity: 0.85 + (sec.energy || 0.6) * 0.15,
              }}
              className="flex items-center justify-center text-[7px] font-bold text-white/80 truncate px-0.5 min-w-[4px]"
            >
              {pct > 6 ? sec.name?.slice(0, 3).toUpperCase() : ""}
            </div>
          );
        })}
      </div>
      {/* Section list */}
      <div className="grid grid-cols-2 gap-1 mt-1">
        {sections.map((sec, i) => {
          const n = sec.name?.toLowerCase() || "";
          const icon = SECTION_ICONS[n] || "🎵";
          const signal =
            sec.signalEvent && sec.signalEvent !== "none"
              ? SIGNAL_ICONS[sec.signalEvent] || ""
              : "";
          const color = SECTION_COLORS[n] || "#555";
          return (
            <div
              key={i}
              className="flex items-center gap-1.5 bg-[#0f0f0f] border border-[#1e1e1e] rounded-lg px-2 py-1"
            >
              <span style={{ color }} className="text-[11px]">
                {icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold text-white/90 capitalize truncate">
                  {sec.name}
                </div>
                <div className="text-[8.5px] text-gray-500 font-mono">
                  {sec.bars}b{sec.energy ? ` · E${Math.round((sec.energy || 0) * 100)}` : ""}
                </div>
              </div>
              {signal && (
                <span className="text-[10px] shrink-0" title={sec.signalEvent}>
                  {signal}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-[8.5px] text-gray-600 text-right font-mono">
        {Math.round(totalSec)}s total · {bpm} BPM
      </div>
    </div>
  );
}

function ArrangementCard({ arr }: { arr: SongArrangement }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 bg-[#0c0c0c] border border-[#1e1e1e] rounded-xl p-2.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-[10px] text-gray-400 hover:text-white"
      >
        <div className="flex items-center gap-1.5">
          <ListMusic size={11} className="text-fuchsia-400" />
          <span className="font-mono font-semibold">
            {arr.sections?.length || 0} sections · {arr.genre}
          </span>
          {arr.synthProfile && (
            <span className="text-[8px] text-cyan-400/70 font-mono hidden sm:block">
              · {arr.synthProfile.kick} kick · {arr.synthProfile.bass} bass
            </span>
          )}
        </div>
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && arr.sections?.length > 0 && (
        <SectionTimeline sections={arr.sections} bpm={arr.bpm} />
      )}
      {open && arr.fxNotes && (
        <p className="mt-2 text-[9px] text-gray-500 font-mono leading-relaxed border-t border-[#1a1a1a] pt-1.5">
          {arr.fxNotes}
        </p>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function AiProducer() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Hey! I'm your AI producer 🎛️\n\nDescribe the song you want — genre, vibe, mood, tempo, duration. I'll produce a full original song with intro, verse, chorus, bridge and outro — section by section, like a pro.\n\nRecord or upload your vocals too and I'll layer them in professionally.",
      ts: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ msg: string; pct: number } | null>(null);
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [vocalsBlob, setVocalsBlob] = useState<Blob | null>(null);
  const [vocalsName, setVocalsName] = useState<string>("");
  const [isRecording, setIsRecording] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    if (!user) return;
    const [w, s] = await Promise.all([
      supabase.from("wallets").select("balance_usd").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("songs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    if (w.data) setBalance(Number(w.data.balance_usd || 0));
    if (s.data) setSongs(s.data as SongRow[]);
  };

  useEffect(() => {
    refresh();
  }, [user]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, progress]);

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setVocalsBlob(blob);
        setVocalsName(`recording-${Date.now()}.webm`);
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      mediaRecRef.current = rec;
      setIsRecording(true);
    } catch (e: any) {
      alert("Mic permission required: " + e.message);
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

  const uploadToBucket = async (path: string, blob: Blob, ct: string): Promise<string | null> => {
    const { error } = await supabase.storage
      .from("songs")
      .upload(path, blob, { contentType: ct, upsert: true });
    if (error) {
      console.error(error);
      return null;
    }
    return supabase.storage.from("songs").getPublicUrl(path).data.publicUrl;
  };

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
    if (!user) {
      navigate("/auth");
      return;
    }
    const text = input.trim();
    if (!text || busy) return;
    if (balance !== null && balance < COST_USD) {
      alert(`Insufficient balance. Need $${COST_USD.toFixed(2)}. Top up in Wallet.`);
      return;
    }

    setMessages((m) => [...m, { role: "user", content: text, ts: Date.now() }]);
    setInput("");
    setBusy(true);
    setProgress({ msg: "Reserving credits…", pct: 0.02 });

    try {
      // 1) Look up active AI provider (admin-configured) so we charge via
      // the right provider's per-prompt cost AND pass the provider config
      // to the server-side universal AI provider dispatcher.
      let activeProvider: any = null;
      try {
        const { data: activeProviders } = await supabase
          .from("ai_providers_public")
          .select("*")
          .eq("is_active", true)
          .order("is_default", { ascending: false })
          .limit(1);
        if (activeProviders && activeProviders.length > 0) {
          activeProvider = activeProviders[0];
        }
      } catch (lookupErr) {
        console.warn("Provider lookup failed, falling back to null provider:", lookupErr);
      }

      // 1) Charge wallet
      const { data: chargeRes, error: dErr } = await supabase.rpc("charge_ai_prompt", {
        p_user_id: user.id,
        p_provider_id: activeProvider?.id ?? null,
        p_prompt: text,
        p_cost_usd: COST_USD,
      });
      if (dErr) throw new Error(dErr.message || "Wallet charge failed");
      if (chargeRes && (chargeRes as any).success === false) {
        const r = chargeRes as any;
        if (r.reason === "insufficient_funds") {
          throw new Error(
            `Insufficient funds — you have ₦${r.balance_naira?.toLocaleString?.() ?? "0"}, need ₦${r.required_naira?.toLocaleString?.() ?? "320"}. Top up in Wallet.`,
          );
        }
        throw new Error(`Charge failed: ${r.reason}`);
      }
      const { data: w } = await supabase
        .from("wallets")
        .select("balance_usd")
        .eq("user_id", user.id)
        .maybeSingle();
      if (w) setBalance(Number(w.balance_usd || 0));

      // 2) Upload + analyze vocals
      let vocalsUrl: string | null = null;
      let vocalAnalysis: any = null;
      if (vocalsBlob) {
        setProgress({ msg: "Uploading vocals…", pct: 0.05 });
        const ext = vocalsName.split(".").pop() || "webm";
        vocalsUrl = await uploadToBucket(
          `${user.id}/vocals/${Date.now()}.${ext}`,
          vocalsBlob,
          vocalsBlob.type || "audio/webm",
        );
        try {
          setProgress({ msg: "Analyzing vocal structure…", pct: 0.1 });
          const arrayBuf = await vocalsBlob.arrayBuffer();
          const Ctx = window.AudioContext || (window as any).webkitAudioContext;
          const ctx = new Ctx();
          const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
          const assumedBpm = 100;
          const [{ analyzeAudioPitch }, { VocalAnalyzerProcessor }] = await Promise.all([
            import("../audio/vocalAnalysis"),
            import("../audio/vocal-analyzer-processor"),
          ]);
          const notes = await analyzeAudioPitch(decoded, assumedBpm, 0.01);
          const total16ths = (decoded.duration / 60) * assumedBpm * 4;
          const phrases = VocalAnalyzerProcessor.detectPhrases(notes, total16ths);
          const structure = VocalAnalyzerProcessor.mapPhrasesToSongStructure(phrases, total16ths);
          vocalAnalysis = {
            durationSec: decoded.duration,
            assumedBpm,
            phraseCount: phrases.length,
            phrases: phrases.slice(0, 24).map((p) => ({
              startSec: (p.startTime16ths / 4) * (60 / assumedBpm),
              endSec: (p.endTime16ths / 4) * (60 / assumedBpm),
              loudness: Number(p.averageLoudness.toFixed(4)),
              pitchVariance: Number(p.pitchVariance.toFixed(2)),
            })),
            sections: structure.sections.map((s) => ({
              type: s.type,
              name: s.name,
              startSec: ((s.startBar * 16) / 4) * (60 / assumedBpm),
              lengthSec: ((s.lengthBars * 16) / 4) * (60 / assumedBpm),
            })),
          };
          try {
            await ctx.close();
          } catch {}
        } catch (err) {
          console.warn("Vocal analysis failed:", err);
        }
      }

      // 3) Compose via AI
      const requestedDur = parseDuration(text);
      const durationSec = vocalAnalysis?.durationSec
        ? Math.min(240, Math.max(120, Math.round(vocalAnalysis.durationSec)))
        : (requestedDur ?? 150 + Math.floor(Math.random() * 30));
      setProgress({ msg: "AI composing full song…", pct: 0.15 });

      let region = "unknown";
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        const tzMap: Record<string, string> = {
          "Africa/Lagos": "NG",
          "Africa/Accra": "GH",
          "Africa/Johannesburg": "ZA",
          "Africa/Nairobi": "KE",
          "Africa/Cairo": "EG",
          "America/New_York": "US",
          "America/Los_Angeles": "US",
          "America/Chicago": "US",
          "America/Sao_Paulo": "BR",
          "America/Mexico_City": "MX",
          "America/Jamaica": "JM",
          "Europe/London": "GB",
          "Europe/Paris": "FR",
          "Europe/Berlin": "DE",
          "Europe/Madrid": "ES",
          "Asia/Tokyo": "JP",
          "Asia/Seoul": "KR",
          "Asia/Kolkata": "IN",
          "Asia/Shanghai": "CN",
          "Asia/Bangkok": "TH",
        };
        region = tzMap[tz] || (navigator.language || "").split("-")[1] || tz || "unknown";
      } catch {}

      const genreMatch = text.match(
        /\b(afrobeat[s]?|amapiano|hip[ -]?hop|trap|pop|rnb|r&b|reggae|reggaeton|dancehall|house|techno|edm|jazz|rock|country|gospel|drill|afroswing|kpop|jpop|bollywood|funk|disco|lofi|ambient|classical|blues|salsa|samba|gengetone|juju|fuji|highlife)\b/i,
      );
      const requestedGenre = genreMatch ? genreMatch[0] : "";

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const aiRes = await fetch(apiUrl("/api/ai/produce-song"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
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
          // Send only the provider id; server-side dispatcher looks up the
          // rest of the config (endpoint / model / api_key) via its
          // SUPABASE_SERVICE_ROLE_KEY, so API keys stay on the server.
          providerId: activeProvider?.id ?? null,
        }),
      });
      if (!aiRes.ok) {
        const j = await aiRes.json().catch(() => ({}));
        throw new Error(j.error || `AI error (${aiRes.status})`);
      }

      const { arrangement } = (await aiRes.json()) as { arrangement: SongArrangement };

      // 4) Render to WAV
      setProgress({ msg: "Rendering full song…", pct: 0.35 });
      const wavBlob = await renderArrangementToWav(arrangement, vocalsUrl, (msg, pct) => {
        setProgress({ msg, pct: 0.35 + pct * 0.52 });
      });

      // 5) Upload
      setProgress({ msg: "Saving song…", pct: 0.92 });
      const audioUrl = await uploadToBucket(
        `${user.id}/songs/${Date.now()}.wav`,
        wavBlob,
        "audio/wav",
      );

      // 6) Save DB row
      const { data: songRow, error: sErr } = await supabase
        .from("songs")
        .insert({
          user_id: user.id,
          title: arrangement.title || "Untitled",
          prompt: text,
          description: arrangement.fxNotes || null,
          genre: arrangement.genre || null,
          bpm: arrangement.bpm || null,
          music_key: `${arrangement.key} ${arrangement.scale}`,
          duration_seconds: arrangement.durationSec,
          audio_url: audioUrl,
          vocals_url: vocalsUrl,
          score_json: arrangement,
          status: "ready",
        })
        .select()
        .single();
      if (sErr) throw new Error(sErr.message);

      const secCount = arrangement.sections?.length || 0;
      const totalSec = Math.round(arrangement.durationSec);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      const sectionsLabel = arrangement.sections?.map((s) => s.name).join(" → ") || "";

      // Sync section markers to the studio arrangement view
      if (arrangement.sections?.length) {
        let barCursor = 0;
        const TYPE_MAP: Record<string, string> = {
          intro: "INTRO",
          verse: "VERSE",
          verse2: "VERSE",
          prechorus: "PRE_CHORUS",
          prechorus2: "PRE_CHORUS",
          chorus: "CHORUS",
          chorus2: "CHORUS",
          chorus3: "CHORUS",
          bridge: "BRIDGE",
          outro: "OUTRO",
        };
        const studioSections = arrangement.sections.map((sec, i) => {
          const type = TYPE_MAP[sec.name?.toLowerCase() || ""] || "VERSE";
          const s = {
            id: `ai_sec_${i}_${Date.now()}`,
            name: sec.name || type,
            type,
            startBar: barCursor,
            lengthBars: sec.bars || 4,
            energy: sec.energy,
            signalEvent: sec.signalEvent,
          };
          barCursor += sec.bars || 4;
          return s;
        });
        useDawStore.getState().setSongStructure({ sections: studioSections });
      }

      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `🎵 **${arrangement.title}**\n${arrangement.genre} · ${arrangement.bpm} BPM · ${arrangement.key} ${arrangement.scale} · ${mins}:${String(secs).padStart(2, "0")}\n\n${sectionsLabel}`,
          ts: Date.now(),
          arrangement,
        },
      ]);
      setVocalsBlob(null);
      setVocalsName("");
      await refresh();
    } catch (e: any) {
      console.error(e);
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: `⚠️ ${e.message || "Something went wrong."}`,
          ts: Date.now(),
        },
      ]);
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
    const a = document.createElement("a");
    a.href = s.audio_url;
    a.download = `${s.title || "song"}.wav`;
    a.click();
  };

  const handleDelete = async (s: SongRow) => {
    if (!confirm(`Delete "${s.title}"?`)) return;
    if (playingId === s.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    }
    if (s.audio_url) {
      const path = s.audio_url.split("/songs/").slice(1).join("/songs/");
      if (path)
        await supabase.storage
          .from("songs")
          .remove([path])
          .catch(() => {});
    }
    await supabase.from("songs").delete().eq("id", s.id);
    setSongs((songs) => songs.filter((x) => x.id !== s.id));
  };

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#1a1a1a]">
        <button onClick={() => navigate("/")} className="p-2 -ml-2">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-fuchsia-400" />
          <h1 className="font-bold">AI Producer</h1>
          <span className="text-[9px] font-mono text-fuchsia-400/60 bg-fuchsia-900/20 px-1.5 py-0.5 rounded-full">
            Full Songs
          </span>
        </div>
        <button
          onClick={() => navigate("/wallet")}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141414] rounded-full text-xs"
        >
          <Wallet size={12} className="text-emerald-400" />
          <span>${balance === null ? "—" : balance.toFixed(2)}</span>
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[90%] ${m.role === "user" ? "bg-fuchsia-600 text-white px-3.5 py-2.5 rounded-2xl" : "w-full"}`}
            >
              <div
                className={
                  m.role === "assistant"
                    ? "bg-[#161616] border border-[#222] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap text-gray-100"
                    : "text-sm"
                }
              >
                {m.content}
              </div>
              {m.role === "assistant" && m.arrangement && <ArrangementCard arr={m.arrangement} />}
            </div>
          </div>
        ))}

        {progress && (
          <div className="bg-[#0f0f0f] border border-[#222] rounded-xl p-3">
            <div className="flex justify-between text-[11px] text-gray-400 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Zap size={10} className="text-fuchsia-400" />
                {progress.msg}
              </span>
              <span>{Math.round(progress.pct * 100)}%</span>
            </div>
            <div className="h-1.5 bg-[#1c1c1c] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${progress.pct * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Songs library */}
        {songs.length > 0 && (
          <div className="pt-4 space-y-2">
            <h2 className="text-[11px] uppercase tracking-wider text-gray-500 font-mono px-1 flex items-center gap-1.5">
              <Layers size={10} /> Your Songs
            </h2>
            {songs.map((s) => (
              <div
                key={s.id}
                className="bg-[#111] border border-[#1e1e1e] rounded-xl p-3 flex items-center gap-3"
              >
                <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-fuchsia-600 to-cyan-500 flex items-center justify-center shrink-0">
                  <MusicIcon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{s.title}</div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {s.genre || "song"} · {s.bpm || "–"} BPM · {s.music_key || "–"} ·{" "}
                    {s.duration_seconds
                      ? `${Math.floor(s.duration_seconds / 60)}:${String(Math.round(s.duration_seconds % 60)).padStart(2, "0")}`
                      : ""}
                  </div>
                  {/* Mini section bar from saved score_json */}
                  {s.score_json?.sections?.length > 0 && (
                    <div className="flex h-1.5 mt-1 rounded-full overflow-hidden gap-px w-full max-w-[160px]">
                      {s.score_json.sections.map((sec: any, si: number) => {
                        const total = s.score_json.sections.reduce(
                          (a: number, x: any) => a + (x.bars || 0),
                          0,
                        );
                        const pct = ((sec.bars || 0) / total) * 100;
                        const color = SECTION_COLORS[sec.name?.toLowerCase()] || "#555";
                        return (
                          <div
                            key={si}
                            style={{ width: `${pct}%`, backgroundColor: color }}
                            className="min-w-[2px]"
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handlePlay(s)}
                  className="w-9 h-9 rounded-full bg-fuchsia-600 hover:bg-fuchsia-500 flex items-center justify-center shrink-0"
                  disabled={!s.audio_url}
                >
                  {playingId === s.id ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                </button>
                <button
                  onClick={() => handleDownload(s)}
                  className="w-9 h-9 rounded-full bg-[#1a1a1a] hover:bg-[#222] flex items-center justify-center"
                  disabled={!s.audio_url}
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={() => handleDelete(s)}
                  className="w-9 h-9 rounded-full bg-[#1a1a1a] hover:bg-red-600/20 hover:text-red-400 flex items-center justify-center"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Composer input */}
      <div className="border-t border-[#1a1a1a] p-3 space-y-2">
        {vocalsBlob && (
          <div className="flex items-center gap-2 bg-[#111] border border-[#222] rounded-lg px-3 py-1.5 text-xs">
            <Mic size={12} className="text-emerald-400" />
            <span className="flex-1 truncate text-gray-300">{vocalsName}</span>
            <button
              onClick={() => {
                setVocalsBlob(null);
                setVocalsName("");
              }}
              className="text-gray-500 hover:text-red-400"
            >
              <Trash2 size={12} />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <label
            className="w-10 h-10 rounded-full bg-[#161616] hover:bg-[#1f1f1f] flex items-center justify-center cursor-pointer shrink-0"
            title="Upload vocals"
          >
            <Upload size={16} />
            <input type="file" accept="audio/*" className="hidden" onChange={onPickVocals} />
          </label>
          <button
            onClick={isRecording ? stopRec : startRec}
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isRecording ? "bg-red-500 animate-pulse" : "bg-[#161616] hover:bg-[#1f1f1f]"}`}
            title="Record vocals"
          >
            {isRecording ? <Square size={14} /> : <Mic size={16} />}
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              busy ? "Producing your song…" : "Describe your song — genre, vibe, mood, duration…"
            }
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
        <div className="text-[10px] text-gray-600 text-center font-mono">
          ${COST_USD.toFixed(2)} · full song with intro · verse · chorus · bridge · outro
        </div>
      </div>
    </div>
  );
}
