// Resolves the base URL for calling our own server API routes.
//
// In the browser on the deployed/preview web app, relative URLs like
// "/api/ai/chat" work fine. But when this app is wrapped in a native
// shell (Capacitor / Cordova / Electron / Tauri / Android WebView with
// a custom scheme), the document origin is something like
// "capacitor://localhost", "http://localhost", "file://" or
// "https://localhost". Hitting "/api/..." there just returns the bundled
// SPA index.html, which causes the AI chat to fail with:
//   "Unexpected token '<', '<!doctype'... is not valid JSON"
//
// In those cases we must call the published web app instead.

const PUBLISHED_API_BASE = "https://seevibe2.lovable.app";

function isNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  if (w.Capacitor?.isNativePlatform?.()) return true;
  if (w.cordova) return true;
  if (w.electronAPI || w.__TAURI__) return true;
  if (w.NativeAudioEngine) return true; // Android Studio WebView JS interface

  const proto = window.location?.protocol || "";
  if (proto === "file:" || proto === "capacitor:" || proto === "ionic:") return true;

  // Plain http(s)://localhost inside a WebView shell – treat as native if
  // there's any indicator that we are not on a real Lovable-served origin.
  const host = window.location?.hostname || "";
  if ((proto === "http:" || proto === "https:") && (host === "localhost" || host === "127.0.0.1")) {
    // Real dev server is fine – it proxies /api. Only flag when there's a
    // native bridge object present (handled above). Otherwise assume dev.
    return false;
  }
  return false;
}

export function getApiBaseUrl(): string {
  const envBase = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  if (envBase) return envBase.replace(/\/+$/, "");
  if (isNativeShell()) return PUBLISHED_API_BASE;
  return "";
}

export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${p}`;
}
