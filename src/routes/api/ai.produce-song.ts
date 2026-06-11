import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { requireAuth, sanitizeUserText } from "@/lib/api-auth.server";

/**
 * POST /api/ai/produce-song
 * Body: { description: string, durationSec?: number, hasVocals?: boolean, seed?: string }
 * Returns: { arrangement: SongArrangement } — a fresh, copyright-safe symbolic score
 *   that the client renders via Tone.Offline.
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
            region?: string;        // ISO country code or region name (e.g. "NG", "US")
            requestedGenre?: string; // explicit genre override
            vocalAnalysis?: any;     // optional analysis of imported vocal
          };
          const description = sanitizeUserText(body.description, 500);
          if (!description) {
            return Response.json({ error: "description is required" }, { status: 400 });
          }
          const durationSec = Math.min(
            Math.max(Number(body.durationSec) || 150, 30),
            240,
          );
          const hasVocals = Boolean(body.hasVocals);
          const seed = body.seed || Math.random().toString(36).slice(2);
          const region = sanitizeUserText(body.region, 60) || "unknown";
          const requestedGenre = sanitizeUserText(body.requestedGenre, 60);

          const key = process.env.LOVABLE_API_KEY;
          if (!key) {
            return Response.json(
              { error: "LOVABLE_API_KEY not configured" },
              { status: 500 },
            );
          }

          const gateway = createLovableAiGatewayProvider(key);
          const model = gateway("google/gemini-2.5-flash");

          const systemPrompt = `You are a professional music producer composing fresh, original songs.
Every song you write MUST be unique (use the seed "${seed}" to vary chord progressions, melody contours, and rhythms).
NEVER copy any existing song. Compose only original musical content.
Output ONLY valid JSON matching the schema below — no prose, no markdown, no codefences.`;

          const genreInstruction = requestedGenre
            ? `The user has explicitly requested the genre: "${requestedGenre}". Strictly compose in that genre.`
            : `The user did not specify a genre. The user's region is "${region}". Pick a genre that is culturally representative of that region (e.g. NG/GH → Afrobeats/Amapiano, US → Pop/HipHop/R&B, BR → Funk/Bossa, JP → J-Pop/City Pop, IN → Bollywood/Bhangra, FR → French House, KR → K-Pop, ZA → Amapiano, MX → Reggaeton/Latin Pop, JM → Reggae/Dancehall). Use seed "${seed}" to randomize the specific subgenre, tempo, instrumentation, and melodic ideas so every generation feels fresh.`;

          const vocalContext = body.vocalAnalysis
            ? `\nVOCAL CLIP ANALYSIS (the user imported a vocal — match it exactly):\n${JSON.stringify(body.vocalAnalysis).slice(0, 1500)}\nUse the detected BPM, fill the section boundaries identified, and leave silence regions empty so the vocal sits cleanly.`
            : "";

          const userPrompt = `Compose a complete original song of about ${durationSec} seconds based on this description:
"""${description}"""
${genreInstruction}${vocalContext}
${hasVocals ? "The user has supplied vocals that will be layered on top — leave space for them in the arrangement (especially during verses/choruses)." : "There are no vocals — make the melody and lead expressive enough to carry the song."}

Return JSON exactly in this shape (numbers, not strings, for numeric fields):
{
  "title": string,
  "genre": string,
  "bpm": integer between 70 and 170,
  "key": one of "C","C#","D","D#","E","F","F#","G","G#","A","A#","B",
  "scale": "major" | "minor",
  "durationSec": integer ~${durationSec},
  "sections": [
    { "name": "intro"|"verse"|"prechorus"|"chorus"|"bridge"|"outro", "bars": integer 2..16 }
  ],
  "chordProgression": array of chord symbols per bar across the whole song e.g. ["Am","F","C","G", ...] length === sum of section bars,
  "drums": {
    "kick":   array of 16 ints (0 or 1) — pattern repeats every bar,
    "snare":  array of 16 ints (0 or 1),
    "hihat":  array of 16 ints (0 or 1),
    "openHat":array of 16 ints (0 or 1)
  },
  "bassPattern": array of { "step": int 0..15, "note": "C2".."B3", "dur": float beats } — one bar that loops,
  "melody": array of { "bar": int (0-based across whole song), "step": int 0..15, "note": "C3".."C6", "dur": float beats, "vel": float 0..1 },
  "pads": array of { "bar": int, "note": "C3".."C5", "dur": float beats } — sustained chord tones,
  "fxNotes": string — short mixing/arrangement notes
}`;

          const result = await generateText({
            model,
            system: systemPrompt,
            prompt: userPrompt,
          });

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

          return Response.json({ arrangement });
        } catch (err: any) {
          console.error("[ai/produce-song]", err);
          const status = Number(err?.statusCode ?? err?.status ?? 0);
          if (status === 429) {
            return Response.json(
              { error: "AI is busy. Please try again in a few seconds." },
              { status: 429 },
            );
          }
          if (status === 402) {
            return Response.json(
              { error: "AI credits exhausted. Please top up in Lovable Settings." },
              { status: 402 },
            );
          }
          return Response.json(
            { error: err?.message ?? "AI error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
