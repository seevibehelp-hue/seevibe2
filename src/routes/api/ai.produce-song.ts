import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { requireAuth, sanitizeUserText } from "@/lib/api-auth.server";

/**
 * POST /api/ai/produce-song
 * Body: { description, durationSec?, hasVocals?, seed?, region?, requestedGenre?, vocalAnalysis? }
 * Returns: { arrangement: FullSongArrangement }
 *
 * FullSongArrangement is a richer schema than the old SongArrangement — it includes:
 *  - per-section drum patterns, bass, melody, and pad layers
 *  - section signal events (risers, crashes, fills, cymbal swells)
 *  - mix automation per section (energy 0-1, bass boost, reverb wet)
 *  - genre-specific synth hints for the renderer
 */
export const Route = createFileRoute("/api/ai/produce-song")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const auth = await requireAuth(request);
          if (auth instanceof Response) return auth;

          const body = (await request.json()) as {
            description?: string;
            durationSec?: number;
            hasVocals?: boolean;
            seed?: string;
            region?: string;
            requestedGenre?: string;
            vocalAnalysis?: any;
          };

          const description = sanitizeUserText(body.description, 500);
          if (!description) {
            return Response.json({ error: "description is required" }, { status: 400 });
          }

          const durationSec = Math.min(Math.max(Number(body.durationSec) || 150, 120), 240);
          const hasVocals = Boolean(body.hasVocals);
          const seed = body.seed || Math.random().toString(36).slice(2);
          const region = sanitizeUserText(body.region, 60) || "unknown";
          const requestedGenre = sanitizeUserText(body.requestedGenre, 60);

          const key = process.env.LOVABLE_API_KEY;
          if (!key) {
            return Response.json({ error: "LOVABLE_API_KEY not configured" }, { status: 500 });
          }

          const gateway = createLovableAiGatewayProvider(key);
          const model = gateway("google/gemini-2.5-flash");

          // ─── Genre selection ────────────────────────────────────────────────
          const genreInstruction = requestedGenre
            ? `Genre: "${requestedGenre}" — compose strictly in this style.`
            : `No genre specified. Region: "${region}". Choose the most culturally authentic genre:
  NG/GH → Afrobeats or Amapiano  |  ZA → Amapiano  |  KE → Gengetone or Afropop
  US → Pop, Hip-Hop, or R&B      |  UK → UK Drill or Grime  |  JM → Dancehall
  BR → Baile Funk or Bossa Nova  |  MX/CO → Reggaeton or Cumbia
  JP → J-Pop or City Pop         |  KR → K-Pop  |  IN → Bollywood or Bhangra
  FR → French House              |  Default → Global Pop
  Use seed "${seed}" to pick a specific sub-style within that genre.`;

          // ─── Vocal context ──────────────────────────────────────────────────
          const vocalContext = body.vocalAnalysis
            ? `\nUSER VOCAL ANALYSIS — match this exactly:\n${JSON.stringify(body.vocalAnalysis).slice(0, 1500)}\nAlign section boundaries to detected phrase positions. Leave space for the vocal in every verse and chorus.`
            : "";

          const systemPrompt = `You are a world-class professional music producer (think Metro Boomin, Timbaland, DJ Khaled, Max Martin).
You compose 100% original songs — never copy existing melodies, chord patterns, or rhythms.
Seed "${seed}" must make every generation unique: vary the chord progressions, melodic contours, rhythmic syncopation, and arrangement structure each time.
Output ONLY valid JSON. No prose, no markdown, no code fences. Numbers must be numbers, not strings.`;

          const userPrompt = `Produce a complete, professional, radio-ready ${durationSec}-second original song.
${genreInstruction}${vocalContext}

The song must have:
- A clear intro that hooks the listener within 4-8 bars
- At least 2 verses with distinct energy from the chorus
- A pre-chorus or build that creates tension before the drop
- A powerful chorus (the biggest moment — full layers, max energy)
- A bridge or breakdown (different texture, emotional pivot)
- An outro (callback to chorus or gentle fade)
- Minimum 2 full minutes of musical content (never stop early)

${hasVocals ? "The user is providing vocals. Leave space for them in EVERY verse and chorus (reduce melody density there). The beat is the backdrop." : "No vocals supplied — the melody and lead must be expressive enough to carry the song by itself."}

Return EXACTLY this JSON schema (all fields required):
{
  "title": string,
  "genre": string (specific sub-genre, e.g. "Afropop", "UK Drill", "Bedroom Pop"),
  "bpm": integer 70-180,
  "key": one of C C# D D# E F F# G G# A A# B,
  "scale": "major" | "minor",
  "durationSec": integer ~${durationSec},
  "synthProfile": {
    "kick": "808" | "acoustic" | "electronic" | "afro",
    "bass": "808" | "sawtooth" | "sine" | "pluck" | "electric",
    "lead": "synth" | "piano" | "guitar" | "brass" | "flute" | "strings",
    "pad": "lush" | "analog" | "choir" | "ambient" | "stab",
    "hats": "trap" | "acoustic" | "percussion"
  },
  "sections": [
    {
      "name": "intro" | "verse" | "prechorus" | "chorus" | "verse2" | "prechorus2" | "chorus2" | "bridge" | "chorus3" | "outro",
      "bars": integer 2-16,
      "energy": float 0.0-1.0,
      "vocalSpace": boolean,
      "layerFlags": {
        "drums": boolean,
        "bass": boolean,
        "pads": boolean,
        "melody": boolean,
        "extraPerc": boolean
      },
      "signalEvent": "none" | "riser" | "crash" | "fill" | "snare_roll" | "cymbal_swell" | "fx_sweep" | "drop_silence",
      "mixAutomation": {
        "bassBoost": float -6 to 6,
        "reverbWet": float 0.0-0.8,
        "compressionRatio": float 2-20,
        "stereoWidth": float 0.0-1.0
      }
    }
  ],
  "chordProgression": string[] length === sum(section.bars) — one chord symbol per bar,
  "drums": {
    "kick":    int[16] — 0 or 1 — base pattern (modified per-section by energy),
    "snare":   int[16],
    "hihat":   int[16],
    "openHat": int[16],
    "perc":    int[16] — shakers, congas, or extra percussion
  },
  "drumVariations": {
    "chorus":  { "kick": int[16], "snare": int[16], "hihat": int[16], "perc": int[16] },
    "bridge":  { "kick": int[16], "snare": int[16], "hihat": int[16], "perc": int[16] }
  },
  "bassPattern": { "step": int 0-15, "note": string "C1"-"B3", "dur": float }[],
  "bassVariations": {
    "chorus": { "step": int, "note": string, "dur": float }[],
    "bridge": { "step": int, "note": string, "dur": float }[]
  },
  "melody": { "bar": int, "step": int 0-15, "note": string "C3"-"C6", "dur": float, "vel": float 0-1 }[],
  "pads": { "bar": int, "note": string, "dur": float, "vel": float }[],
  "hooks": { "bar": int, "step": int, "note": string, "dur": float, "vel": float }[],
  "fxNotes": string — 1-2 sentences on the sound design and mix approach
}

IMPORTANT RULES:
1. sections array must produce durationSec worth of bars at the given BPM
2. chordProgression must have exactly sum(section.bars) entries
3. melody notes must be in the correct key and scale — never chromatic clashes
4. chorus energy must be >= 0.85, verse energy 0.4-0.65, bridge 0.3-0.5
5. Every chorus section must have signalEvent "crash" or "drop_silence" before it
6. Every prechorus must have signalEvent "riser" or "snare_roll"
7. hooks array contains a secondary call-and-response melody (different from melody array) — used during choruses only
8. Make the song sound like a ${durationSec >= 180 ? 'full 3-minute chart hit' : 'radio-ready 2-minute banger'}`;

          const result = await generateText({ model, system: systemPrompt, prompt: userPrompt });

          let raw = (result.text ?? "").trim();
          raw = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();

          let arrangement: any;
          try {
            arrangement = JSON.parse(raw);
          } catch {
            const match = raw.match(/\{[\s\S]*\}/);
            if (!match) {
              return Response.json(
                { error: "Model did not return parseable JSON", raw: raw.slice(0, 400) },
                { status: 502 },
              );
            }
            arrangement = JSON.parse(match[0]);
          }

          // Enforce minimum duration
          if (!arrangement.durationSec || arrangement.durationSec < 120) {
            arrangement.durationSec = durationSec;
          }

          return Response.json({ arrangement });
        } catch (err: any) {
          console.error("[ai/produce-song]", err);
          const status = Number(err?.statusCode ?? err?.status ?? 0);
          if (status === 429) return Response.json({ error: "AI is busy — try again in a few seconds." }, { status: 429 });
          if (status === 402) return Response.json({ error: "AI credits exhausted. Top up in Settings." }, { status: 402 });
          return Response.json({ error: err?.message ?? "AI error" }, { status: 500 });
        }
      },
    },
  },
});
