// @ts-nocheck
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { ArrowLeft, RefreshCw, ExternalLink, ShieldCheck, DollarSign } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { AdMobDashboard } from "../components/AdMobDashboard";

const BASE_URL = "https://seevibe-backend-kit.lovable.app";

export function Earnings() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) navigate("/auth");
      else setSession(data.session);
    }).catch(err => {
      console.warn("Supabase session fetch failed in Earnings:", err);
      navigate("/auth");
    });
  }, [navigate]);

  const path = params.get("path") ?? "/";
  const title = params.get("title") ?? "Creator Earnings";

  const src = useMemo(() => {
    if (!session) return "";
    const hash = new URLSearchParams({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: String(session.expires_in ?? 3600),
      token_type: "bearer",
      type: "recovery",
    }).toString();
    const sep = path.includes("?") ? "&" : "?";
    return `${BASE_URL}${path}${sep}sso=1#${hash}`;
  }, [session, path, reloadKey]);

  if (!session) return <div className="h-screen bg-background animate-pulse" />;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#050505] max-w-[420px] mx-auto border-x border-[#1A1A1A]">
      <header className="flex items-center gap-2 px-3 h-14 border-b border-[#2A2A2A] bg-[#141414] shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-[#2A2A2A] rounded-full transition-colors"><ArrowLeft className="size-5 text-white" /></button>
        <h1 className="font-semibold text-sm flex-1 truncate text-white">{title}</h1>
        <button onClick={() => setReloadKey(k => k + 1)} className="p-2 hover:bg-[#2A2A2A] rounded-full transition-colors text-zinc-400 hover:text-white"><RefreshCw className="size-4" /></button>
        <button onClick={() => window.open(src, "_blank")} className="p-2 hover:bg-[#2A2A2A] rounded-full transition-colors text-zinc-400 hover:text-white"><ExternalLink className="size-4" /></button>
      </header>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <iframe
          key={reloadKey}
          src={src}
          title={title}
          className="w-full h-full bg-[#050505] border-none"
          allow="clipboard-write; payment; camera; microphone"
        />
      </div>
    </div>
  );
}