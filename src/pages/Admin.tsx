// @ts-nocheck
import React, { useEffect, useState } from "react";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Users, Sparkles, Plus, Trash2, Shield, Calendar, Upload, Music2 } from "lucide-react";
import { AdMobDashboard } from "../components/AdMobDashboard";

export function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"users" | "ai" | "samples" | "admob">("users");
  const [usersList, setUsersList] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [samples, setSamples] = useState<any[]>([]);
  const [sampleTitle, setSampleTitle] = useState("");
  const [sampleCategory, setSampleCategory] = useState("Uploaded");
  const [sampleBpm, setSampleBpm] = useState("120");
  const [sampleKey, setSampleKey] = useState("");
  const [sampleBars, setSampleBars] = useState("4");
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [isUploadingSample, setIsUploadingSample] = useState(false);
  const [detectingMeta, setDetectingMeta] = useState(false);
  const [editingSampleId, setEditingSampleId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBpm, setEditBpm] = useState("120");
  const [editKey, setEditKey] = useState("");
  const [editCategory, setEditCategory] = useState("Uploaded");

  // Form
  const [pPreset, setPPreset] = useState("OpenAI");
  const [pName, setPName] = useState("OpenAI GPT-4o-mini");
  const [pEndpoint, setPEndpoint] = useState("https://api.openai.com/v1/chat/completions");
  const [pModel, setPModel] = useState("gpt-4o-mini");
  const [pKey, setPKey] = useState("");
  const [pCost, setPCost] = useState("0.2");
  const [pDefault, setPDefault] = useState(false);
  // Edit-in-place: when set, the form populates from the matching provider
  // and addProvider() routes to .update() instead of .insert().
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchAdmin = async () => {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!isAdmin) {
        navigate("/");
        return;
      }

      const { data: profs } = await supabase.from("profiles").select("*");
      const { data: prompts } = await supabase.from("ai_prompt_logs").select("user_id");
      const { data: wallets } = await supabase.from("wallets").select("*");

      const combined = (profs || []).map((p) => {
        const w = (wallets || []).find((w) => w.user_id === p.id) || {};
        const pCount = (prompts || []).filter((pr) => pr.user_id === p.id).length;
        return { ...p, wallet: w, promptCount: pCount };
      });
      setUsersList(combined);

      const { data: provs } = await supabase
        .from("ai_providers")
        .select("*")
        .order("created_at", { ascending: false });
      setProviders(provs || []);

      const { data: sampleRows } = await supabase
        .from("platform_samples")
        .select("*")
        .order("created_at", { ascending: false });
      setSamples(sampleRows || []);
    };
    fetchAdmin();
  }, [user, navigate]);

  const handlePresetChange = (preset: string) => {
    setPPreset(preset);
    if (preset === "OpenAI") {
      setPName("OpenAI GPT-4o-mini");
      setPEndpoint("https://api.openai.com/v1/chat/completions");
      setPModel("gpt-4o-mini");
    } else if (preset === "Lovable") {
      setPName("Lovable AI (Gemini Flash)");
      setPEndpoint("https://ai.gateway.lovable.dev/v1/chat/completions");
      setPModel("google/gemini-3-flash-preview");
    } else if (preset === "Gemini") {
      setPName("Google Gemini (Direct)");
      setPEndpoint("https://generativelanguage.googleapis.com/v1beta/openai");
      setPModel("gemini-2.5-flash");
    } else if (preset === "Groq") {
      setPName("Groq (fast inference)");
      setPEndpoint("https://api.groq.com/openai/v1");
      setPModel("llama-3.3-70b-versatile");
    } else if (preset === "Mistral") {
      setPName("Mistral AI");
      setPEndpoint("https://api.mistral.ai/v1");
      setPModel("mistral-large-latest");
    }
    // 'Custom' leaves the form values as-is.
  };

  const startEditProvider = (p: any) => {
    setEditingProviderId(p.id);
    // Pick the closest matching preset so the dropdown reflects the type.
    if (p.provider_type === "lovable") setPPreset("Lovable");
    else if (p.provider_type === "gemini_direct") setPPreset("Gemini");
    else if (p.endpoint?.includes("groq.com")) setPPreset("Groq");
    else if (p.endpoint?.includes("mistral")) setPPreset("Mistral");
    else if (p.endpoint?.includes("api.openai.com")) setPPreset("OpenAI");
    else setPPreset("Custom");
    setPName(p.name || "");
    setPEndpoint(p.endpoint || "");
    setPModel(p.model || "");
    setPKey(""); // never echo the api_key back into the form
    setPCost(String(p.cost_per_prompt_usd ?? "0.20"));
    setPDefault(!!p.is_default);
    // Scroll the form into view so admin sees they're editing.
    setTimeout(() => {
      const form = document.getElementById("add-provider-form");
      form?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const cancelEditProvider = () => {
    setEditingProviderId(null);
    // Reset form back to OpenAI defaults so admin doesn't accidentally save
    // the previous edit's values into a fresh insert.
    setPPreset("OpenAI");
    setPName("OpenAI GPT-4o-mini");
    setPEndpoint("https://api.openai.com/v1/chat/completions");
    setPModel("gpt-4o-mini");
    setPKey("");
    setPCost("0.2");
    setPDefault(false);
  };

  const presetToProviderType = (preset: string): string => {
    if (preset === "Lovable") return "lovable";
    if (preset === "Gemini") return "gemini_direct";
    // OpenAI / Groq / Mistral / Custom are all OpenAI-compatible.
    return "openai_compatible";
  };

  const toggleDefault = async (providerId: string, currentVal: boolean) => {
    if (currentVal) return;
    await supabase.from("ai_providers").update({ is_default: false }).neq("id", providerId);
    await supabase.from("ai_providers").update({ is_default: true }).eq("id", providerId);
    const { data } = await supabase
      .from("ai_providers")
      .select("*")
      .order("created_at", { ascending: false });
    setProviders(data || []);
  };

  const toggleActive = async (providerId: string, currentVal: boolean) => {
    await supabase.from("ai_providers").update({ is_active: !currentVal }).eq("id", providerId);
    const { data } = await supabase
      .from("ai_providers")
      .select("*")
      .order("created_at", { ascending: false });
    setProviders(data || []);
  };

  const addProvider = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation.
    const costNum = parseFloat(pCost);
    if (!pName.trim() || !pEndpoint.trim() || !pModel.trim()) {
      alert("Name, endpoint, and model are required.");
      return;
    }
    if (!Number.isFinite(costNum) || costNum < 0) {
      alert("Cost must be a non-negative number.");
      return;
    }
    try {
      // Validate endpoint is a URL.
      // eslint-disable-next-line no-new
      new URL(pEndpoint);
    } catch {
      alert("Endpoint must be a valid URL (e.g. https://api.openai.com/v1).");
      return;
    }
    // Non-Lovable providers require an API key.
    if (pPreset !== "Lovable" && !pKey.trim() && !editingProviderId) {
      alert("API key is required for this provider type.");
      return;
    }

    const payload = {
      name: pName.trim(),
      endpoint: pEndpoint.trim(),
      model: pModel.trim(),
      cost_per_prompt_usd: costNum,
      is_default: pDefault,
      provider_type: presetToProviderType(pPreset),
      is_active: true,
    };
    // Only update api_key if admin typed a new one — leaving the field blank
    // on edit preserves the existing stored key.
    if (pKey.trim()) (payload as any).api_key = pKey.trim();

    if (editingProviderId) {
      // EDIT MODE: update in place
      if (pDefault) {
        await supabase
          .from("ai_providers")
          .update({ is_default: false })
          .neq("id", editingProviderId);
      }
      const { error } = await supabase
        .from("ai_providers")
        .update(payload)
        .eq("id", editingProviderId);
      if (error) {
        alert(error.message);
        return;
      }
      alert(`Provider "${pName.trim()}" updated.`);
      cancelEditProvider();
    } else {
      // ADD MODE: insert new
      if (pDefault) {
        await supabase
          .from("ai_providers")
          .update({ is_default: false })
          .neq("id", "placeholderId");
      }
      const { error } = await supabase.from("ai_providers").insert({
        ...payload,
        api_key: (payload as any).api_key ?? null,
        created_by: user?.id,
      });
      if (error) {
        alert(error.message);
        return;
      }
      alert(`Provider "${pName.trim()}" added.`);
    }

    const { data } = await supabase
      .from("ai_providers")
      .select("*")
      .order("created_at", { ascending: false });
    setProviders(data || []);
  };

  const uploadSample = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sampleFile || !sampleTitle.trim())
      return alert("Add a sample title and audio file first.");
    setIsUploadingSample(true);
    try {
      const ext = sampleFile.name.split(".").pop() || "wav";
      const path = `${user?.id || "admin"}/${Date.now()}_${sampleTitle
        .trim()
        .toLowerCase()
        .replace(/[\s\W]+/g, "_")}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("platform-samples")
        .upload(path, sampleFile, {
          cacheControl: "31536000",
          upsert: false,
          contentType: sampleFile.type || "audio/wav",
        });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from("platform-samples").getPublicUrl(path);
      const { error: insertError } = await supabase.from("platform_samples").insert({
        title: sampleTitle.trim(),
        category: sampleCategory.trim() || "Uploaded",
        bpm: Math.max(1, parseInt(sampleBpm, 10) || 120),
        music_key: sampleKey.trim() || null,
        duration16ths: Math.max(1, (parseInt(sampleBars, 10) || 4) * 16),
        file_path: path,
        public_url: publicData.publicUrl,
        mime_type: sampleFile.type || null,
        file_size: sampleFile.size,
        created_by: user?.id,
      });
      if (insertError) throw insertError;

      const { data } = await supabase
        .from("platform_samples")
        .select("*")
        .order("created_at", { ascending: false });
      setSamples(data || []);
      setSampleTitle("");
      setSampleCategory("Uploaded");
      setSampleBpm("120");
      setSampleKey("");
      setSampleBars("4");
      setSampleFile(null);
      alert("Sample uploaded and added to the platform library.");
    } catch (err: any) {
      alert(err?.message || "Sample upload failed.");
    } finally {
      setIsUploadingSample(false);
    }
  };

  const handleSampleFileSelect = async (file: File | null) => {
    setSampleFile(file);
    if (!file) return;
    setDetectingMeta(true);
    try {
      const { detectSampleMetadata } = await import("../utils/sampleAutoDetect");
      const meta = await detectSampleMetadata(file);
      if (!sampleTitle.trim()) setSampleTitle(meta.suggestedTitle);
      setSampleBpm(String(meta.bpm));
      setSampleKey(meta.keyLabel);
      setSampleBars(String(meta.bars));
    } catch (err) {
      console.warn("Sample auto-detect failed:", err);
    } finally {
      setDetectingMeta(false);
    }
  };

  const startEditSample = (s: any) => {
    setEditingSampleId(s.id);
    setEditTitle(s.title || "");
    setEditBpm(String(s.bpm || 120));
    setEditKey(s.music_key || "");
    setEditCategory(s.category || "Uploaded");
  };

  const saveEditSample = async () => {
    if (!editingSampleId) return;
    const { error } = await supabase
      .from("platform_samples")
      .update({
        title: editTitle.trim(),
        bpm: Math.max(1, parseInt(editBpm, 10) || 120),
        music_key: editKey.trim() || null,
        category: editCategory.trim() || "Uploaded",
      })
      .eq("id", editingSampleId);
    if (error) return alert(error.message);
    const { data } = await supabase
      .from("platform_samples")
      .select("*")
      .order("created_at", { ascending: false });
    setSamples(data || []);
    setEditingSampleId(null);
  };

  const deleteSample = async (s: any) => {
    if (!confirm(`Delete sample "${s.title}"? This cannot be undone.`)) return;
    if (s.file_path) {
      await supabase.storage
        .from("platform-samples")
        .remove([s.file_path])
        .catch(() => {});
    }
    const { error } = await supabase.from("platform_samples").delete().eq("id", s.id);
    if (error) return alert(error.message);
    setSamples(samples.filter((x) => x.id !== s.id));
  };

  return (
    <div className="flex flex-col h-full bg-background p-4 pb-20 overflow-y-auto">
      <div className="flex items-center mb-6">
        <Shield className="text-cyan-400 mr-3" size={24} />
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
      </div>

      <div className="flex bg-[#141414] rounded-xl p-1 mb-6 gap-1">
        <button
          onClick={() => setTab("users")}
          className={`flex-1 flex items-center justify-center py-2 rounded-lg text-sm font-medium transition-colors ${tab === "users" ? "bg-[#2A2A2A] text-white shadow-sm" : "text-gray-400"}`}
        >
          <Users size={16} className="mr-2" /> Users
        </button>
        <button
          onClick={() => setTab("ai")}
          className={`flex-1 flex items-center justify-center py-2 rounded-lg text-sm font-medium transition-colors ${tab === "ai" ? "bg-[#2A2A2A] text-white shadow-sm" : "text-gray-400"}`}
        >
          <Sparkles size={16} className="mr-2" /> AI Providers
        </button>
        <button
          onClick={() => setTab("samples")}
          className={`flex-1 flex items-center justify-center py-2 rounded-lg text-sm font-medium transition-colors ${tab === "samples" ? "bg-[#2A2A2A] text-white shadow-sm" : "text-gray-400"}`}
        >
          <Music2 size={16} className="mr-2" /> Samples
        </button>
        <button
          onClick={() => setTab("admob")}
          className={`flex-1 flex items-center justify-center py-2 rounded-lg text-sm font-medium transition-colors ${tab === "admob" ? "bg-[#2A2A2A] text-white shadow-sm" : "text-gray-400"}`}
        >
          <Shield size={16} className="mr-2" /> Ads Earnings
        </button>
      </div>

      {tab === "users" ? (
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            {usersList.length} users • balances and AI prompts used
          </p>
          {usersList.map((u) => (
            <div key={u.id} className="bg-[#141414] p-4 rounded-xl border border-[#222]">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-fuchsia-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {u.username?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <div className="font-semibold text-sm">@{u.username}</div>
                  <div className="text-[10px] text-gray-400">{u.email || u.full_name}</div>
                </div>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-[#222] pt-3">
                <div>
                  <div className="text-[10px] text-gray-500">Balance</div>
                  <div className="font-bold">
                    ₦{Number(u.wallet?.balance_naira || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">TK</div>
                  <div className="font-bold">{Number(u.wallet?.tk_balance || 0).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-gray-500">AI prompts</div>
                  <div className="font-bold">{u.promptCount}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : tab === "ai" ? (
        <div className="space-y-6">
          <form
            id="add-provider-form"
            onSubmit={addProvider}
            className="bg-[#141414] p-4 rounded-xl border border-[#222] space-y-4"
          >
            <h2 className="font-bold text-sm flex items-center mb-2">
              {editingProviderId ? (
                <>
                  <span className="text-amber-400">Edit provider</span>
                  <span className="ml-auto text-[10px] text-gray-500 font-mono">
                    id: {editingProviderId.slice(0, 8)}…
                  </span>
                </>
              ) : (
                <>
                  <Plus size={16} className="mr-2" /> Add AI provider
                </>
              )}
            </h2>

            <div>
              <label className="text-[10px] text-gray-400 font-semibold uppercase mb-1 block">
                Quick preset
              </label>
              <select
                value={pPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none appearance-none"
              >
                <option>OpenAI</option>
                <option>Lovable</option>
                <option>Gemini</option>
                <option>Groq</option>
                <option>Mistral</option>
                <option>Custom</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-semibold uppercase mb-1 block">
                Name
              </label>
              <input
                type="text"
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                placeholder="e.g. OpenAI GPT-4o-mini"
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-semibold uppercase mb-1 block">
                Endpoint
              </label>
              <input
                type="text"
                value={pEndpoint}
                onChange={(e) => setPEndpoint(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-semibold uppercase mb-1 block">
                Model
              </label>
              <input
                type="text"
                value={pModel}
                onChange={(e) => setPModel(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[10px] text-gray-400 font-semibold uppercase mb-1 block">
                API Key
              </label>
              <input
                type="password"
                value={pKey}
                onChange={(e) => setPKey(e.target.value)}
                placeholder="Leave blank for Lovable Gateway"
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 font-semibold uppercase mb-1 block">
                  Cost / prompt (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={pCost}
                  onChange={(e) => setPCost(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
                  required
                />
              </div>
              <div className="flex-1 flex items-center mt-5">
                <input
                  type="checkbox"
                  id="makedef"
                  checked={pDefault}
                  onChange={(e) => setPDefault(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="makedef" className="text-sm">
                  Make default
                </label>
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              {editingProviderId && (
                <button
                  type="button"
                  onClick={cancelEditProvider}
                  className="flex-1 bg-[#2A2A2A] text-gray-300 font-semibold rounded-lg py-3 hover:bg-[#333] transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className={`flex-1 ${editingProviderId ? "bg-gradient-to-r from-amber-500 to-orange-500" : "bg-gradient-to-r from-fuchsia-500 to-pink-500"} text-white font-semibold rounded-lg py-3`}
              >
                {editingProviderId ? "Save changes" : "Add provider"}
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {providers.map((p) => (
              <div
                key={p.id}
                className="bg-[#141414] p-4 rounded-xl border border-[#222] flex justify-between items-center relative overflow-hidden"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-sm truncate">{p.name}</span>
                    {p.is_default && (
                      <span className="text-[9px] bg-fuchsia-500 text-white px-1.5 py-0.5 rounded font-bold uppercase shrink-0">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {p.model} • ${p.cost_per_prompt_usd}/prompt
                  </div>
                  <div className="text-[10px] text-gray-500 truncate max-w-[250px]">
                    {p.endpoint}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(p.id, !!p.is_active)}
                    className={`text-[10px] px-2 py-1 rounded font-semibold transition-colors ${p.is_active ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-zinc-800 text-zinc-500 border border-transparent"}`}
                  >
                    {p.is_active ? "Active" : "Inactive"}
                  </button>
                  {!p.is_default && (
                    <button
                      onClick={() => toggleDefault(p.id, !!p.is_default)}
                      className="text-[10px] px-2 py-1 rounded font-semibold bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 hover:bg-fuchsia-500 hover:text-white transition-colors"
                    >
                      Make Default
                    </button>
                  )}
                  <button
                    onClick={() => startEditProvider(p)}
                    className="p-2 hover:bg-[#2A2A2A] rounded-lg text-gray-400 hover:text-amber-400 transition-colors"
                    title="Edit provider (model, endpoint, API key)"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm("Delete this provider?")) {
                        await supabase.from("ai_providers").delete().eq("id", p.id);
                        setProviders(providers.filter((x) => x.id !== p.id));
                        if (editingProviderId === p.id) cancelEditProvider();
                      }
                    }}
                    className="p-2 hover:bg-[#2A2A2A] rounded-lg text-gray-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : tab === "samples" ? (
        <div className="space-y-6">
          <form
            onSubmit={uploadSample}
            className="bg-[#141414] p-4 rounded-xl border border-[#222] space-y-4"
          >
            <h2 className="font-bold text-sm flex items-center mb-2">
              <Upload size={16} className="mr-2" /> Upload platform sample
            </h2>
            <div>
              <label className="text-[10px] text-gray-400 font-semibold uppercase mb-1 block">
                Sample title
              </label>
              <input
                value={sampleTitle}
                onChange={(e) => setSampleTitle(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-400 font-semibold uppercase mb-1 block">
                  Category
                </label>
                <input
                  value={sampleCategory}
                  onChange={(e) => setSampleCategory(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-semibold uppercase mb-1 block">
                  BPM
                </label>
                <input
                  type="number"
                  value={sampleBpm}
                  onChange={(e) => setSampleBpm(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-semibold uppercase mb-1 block">
                  Key
                </label>
                <input
                  value={sampleKey}
                  onChange={(e) => setSampleKey(e.target.value)}
                  placeholder="Am, C, Drum"
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 font-semibold uppercase mb-1 block">
                  Bars
                </label>
                <input
                  type="number"
                  value={sampleBars}
                  onChange={(e) => setSampleBars(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2 text-sm focus:border-fuchsia-500 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => handleSampleFileSelect(e.target.files?.[0] || null)}
                className="w-full text-xs text-gray-300 file:mr-3 file:rounded-lg file:border-0 file:bg-[#2A2A2A] file:px-3 file:py-2 file:text-white"
              />
              {detectingMeta && (
                <div className="text-[10px] text-cyan-400 mt-1 font-mono">
                  🔍 Auto-detecting BPM, key, and title…
                </div>
              )}
              {sampleFile && !detectingMeta && (
                <div className="text-[10px] text-emerald-400 mt-1 font-mono">
                  ✓ Detected. Edit fields above if needed.
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={isUploadingSample || detectingMeta}
              className="w-full bg-gradient-to-r from-cyan-500 to-emerald-500 disabled:opacity-50 text-black font-bold rounded-lg py-3 mt-2"
            >
              {isUploadingSample ? "Uploading sample..." : "Upload sample"}
            </button>
          </form>
          <div className="space-y-3">
            {samples.map((s) => (
              <div
                key={s.id}
                className="bg-[#141414] p-4 rounded-xl border border-[#222] space-y-2"
              >
                {editingSampleId === s.id ? (
                  <div className="space-y-2">
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Title"
                      className="w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded px-2 py-1.5 text-xs"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        value={editBpm}
                        onChange={(e) => setEditBpm(e.target.value)}
                        placeholder="BPM"
                        className="bg-[#1A1A1A] border border-[#2A2A2A] rounded px-2 py-1.5 text-xs"
                      />
                      <input
                        value={editKey}
                        onChange={(e) => setEditKey(e.target.value)}
                        placeholder="Key"
                        className="bg-[#1A1A1A] border border-[#2A2A2A] rounded px-2 py-1.5 text-xs"
                      />
                      <input
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        placeholder="Category"
                        className="bg-[#1A1A1A] border border-[#2A2A2A] rounded px-2 py-1.5 text-xs"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveEditSample}
                        className="flex-1 bg-emerald-500 text-black font-bold rounded py-1.5 text-xs"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingSampleId(null)}
                        className="flex-1 bg-[#222] text-gray-300 rounded py-1.5 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm truncate">{s.title}</div>
                      <div className="text-[10px] text-gray-500 truncate">
                        {s.category} • {s.bpm} BPM • {s.music_key || "No key"} •{" "}
                        {Math.round((s.file_size || 0) / 1024)} KB
                      </div>
                    </div>
                    <audio controls src={s.public_url} className="h-8 max-w-[140px]" />
                    <button
                      onClick={() => startEditSample(s)}
                      className="text-[10px] px-2 py-1 rounded bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 hover:bg-fuchsia-500 hover:text-white"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteSample(s)}
                      className="p-1.5 hover:bg-red-500/10 rounded text-gray-400 hover:text-red-400"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-[#141414] border border-[#222] p-4 rounded-xl flex flex-col items-center justify-center text-center">
            <span className="text-xs bg-[#00FF9C]/10 text-[#00FF5A] font-bold px-2.5 py-0.5 rounded-full mb-2 border border-[#00ff9c]/10 font-mono tracking-widest uppercase">
              REAL-TIME AD REVENUE LOGS
            </span>
            <p className="text-[10px] text-gray-400 max-w-sm">
              See Vibe AdSense and Google AdMob real-time publisher configuration analytics below.
            </p>
          </div>
          <AdMobDashboard />
        </div>
      )}
    </div>
  );
}
