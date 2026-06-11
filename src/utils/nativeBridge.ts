// @ts-nocheck
/**
 * Native DSP Audio Engine Bridge
 * Provides high-fidelity serialization and dispatching of track effect commands 
 * to native interfaces (iOS/Android WebView handlers, Electron main process, or Cordova/Capacitor plugins).
 * Keeps a real-time reactive log stream of native commands for developers.
 */

export interface NativeCommandLog {
  id: string;
  timestamp: string;
  trackId: string;
  fxType: string;
  action: string;
  payload: any;
  platformCalled: string[];
}

const commandLogs: NativeCommandLog[] = [];
const listeners: Set<(logs: NativeCommandLog[]) => void> = new Set();
export const NATIVE_BRIDGE_VERSION = 'see-vibe-native-bridge-v1';

export const subscribeToNativeBridgeLogs = (callback: (logs: NativeCommandLog[]) => void) => {
  listeners.add(callback);
  callback([...commandLogs]);
  return () => {
    listeners.delete(callback);
  };
};

const notifyLogsChanged = () => {
  const currentLogs = [...commandLogs];
  listeners.forEach(cb => cb(currentLogs));
};

/**
 * Dispatches a high-quality functional audio effect change command to the native boundaries.
 * In a native mobile/desktop app compile, this directly speaks to target native DSP assemblies.
 */
export function dispatchNativeEffectCommand(trackId: string, fxType: string, params: any) {
  const payload = {
    trackId,
    fxType,
    params,
    timestamp: new Date().toISOString(),
  };

  const platformsCalled: string[] = [];

  // 1. ELECTRON (Desktop Main Process Wrapper)
  if ((window as any).electronAPI?.send) {
    (window as any).electronAPI.send('native-dsp-effect-change', payload);
    platformsCalled.push('Electron (IPC)');
  }

  // 2. CAPACITOR (Android/iOS Native Plugins)
  if ((window as any).Capacitor?.Plugins?.NativeAudioEngine) {
    (window as any).Capacitor.Plugins.NativeAudioEngine.setEffectParams(payload);
    platformsCalled.push('Capacitor Plugin');
  }

  // 2b. ANDROID STUDIO WEBVIEW JavascriptInterface
  // Native side should expose: window.NativeAudioEngine.setEffectParams(jsonString)
  if ((window as any).NativeAudioEngine?.setEffectParams) {
    (window as any).NativeAudioEngine.setEffectParams(JSON.stringify(payload));
    platformsCalled.push('Android WebView JavascriptInterface');
  }

  // 3. CORDOVA (Fallback Android/iOS plugins)
  if ((window as any).cordova?.plugins?.NativeAudioEngine?.setEffectParams) {
    (window as any).cordova.plugins.NativeAudioEngine.setEffectParams(trackId, fxType, params);
    platformsCalled.push('Cordova Plugin');
  }

  // 4. WKWEBVIEW / SAFARI / CHROME WEB SHELL HANDLER (iOS/macOS Native Apps)
  if ((window as any).webkit?.messageHandlers?.nativeAudioEngine) {
    (window as any).webkit.messageHandlers.nativeAudioEngine.postMessage({
      command: "setEffectParams",
      payload
    });
    platformsCalled.push('WKWebView Handler');
  }

  // 5. TAURI (Desktop Rust Webview)
  if ((window as any).__TAURI__?.invoke) {
    (window as any).__TAURI__.invoke('set_native_effect_params', payload).catch(() => {});
    platformsCalled.push('Tauri Invoke');
  }

  if (platformsCalled.length === 0) {
    platformsCalled.push('WebView Simulation Host');
  }

  const logEntry: NativeCommandLog = {
    id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: new Date().toLocaleTimeString(),
    trackId,
    fxType,
    action: 'SET_EFFECT_PARAMS',
    payload: JSON.parse(JSON.stringify(params)),
    platformCalled: platformsCalled,
  };

  // Keep logs bounded to 50 entries
  commandLogs.unshift(logEntry);
  if (commandLogs.length > 50) {
    commandLogs.pop();
  }

  notifyLogsChanged();

  // Create Custom DOM Event for component synchronization
  const evt = new CustomEvent('native-dsp-command', { detail: logEntry });
  window.dispatchEvent(evt);

  // Return generated payload for inspection
  return payload;
}

/**
 * Reset Native Audio process engine
 */
export function resetNativeAudioEngine(trackId: string) {
  const payload = { trackId, timestamp: new Date().toISOString() };
  
  if ((window as any).electronAPI?.send) {
    (window as any).electronAPI.send('native-dsp-reset', payload);
  }
  if ((window as any).NativeAudioEngine?.resetEngine) {
    (window as any).NativeAudioEngine.resetEngine(JSON.stringify(payload));
  }
  if ((window as any).webkit?.messageHandlers?.nativeAudioEngine) {
    (window as any).webkit.messageHandlers.nativeAudioEngine.postMessage({
      command: "resetEngine",
      payload
    });
  }

  const logEntry: NativeCommandLog = {
    id: `${Date.now()}_reset`,
    timestamp: new Date().toLocaleTimeString(),
    trackId,
    fxType: 'master',
    action: 'RESET_TRACK_DSP_PIPELINE',
    payload: { state: "flushed" },
    platformCalled: ['Native Core assemblies'],
  };

  commandLogs.unshift(logEntry);
  notifyLogsChanged();
}