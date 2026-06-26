// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Vercel deployment uses Nitro's `vercel` preset which produces a
// `.vercel/output/` tree that Vercel auto-detects. Inside a Lovable build
// the preset is forced to Cloudflare, so we only honour the override when
// the user explicitly opts into a non-Cloudflare target via NITRO_PRESET.
const explicitPreset = process.env.NITRO_PRESET;
const nitroConfig = explicitPreset ? { preset: explicitPreset } : undefined;

export default defineConfig({
  // @ts-ignore — `nitro` is forwarded to the lovable config which accepts it.
  nitro: nitroConfig,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
