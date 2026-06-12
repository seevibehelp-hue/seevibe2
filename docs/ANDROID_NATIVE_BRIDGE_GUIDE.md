# See Vibe Android Studio Native Bridge Guide

Use this guide after cloning the repo into Android Studio or wrapping the published web build in a native Android WebView/Capacitor shell.

## Web app contract

- Native bridge module: `src/utils/nativeBridge.ts`
- Bridge version exported by web: `see-vibe-native-bridge-v1`
- The web app already dispatches `native-dsp-command` DOM events for every native DSP command.
- Android Studio WebView should expose this JavaScript interface:

```kotlin
class NativeAudioEngineBridge {
  @JavascriptInterface
  fun setEffectParams(json: String) {
    // Parse JSON: { trackId, fxType, params, timestamp }
    // Route to Android/Kotlin DSP, Media3, Oboe, or your audio engine.
  }

  @JavascriptInterface
  fun resetEngine(json: String) {
    // Parse JSON: { trackId, timestamp }
    // Flush native DSP state for the track/master bus.
  }
}
```

Attach it before loading the See Vibe URL/build:

```kotlin
webView.settings.javaScriptEnabled = true
webView.settings.domStorageEnabled = true
webView.addJavascriptInterface(NativeAudioEngineBridge(), "NativeAudioEngine")
```

## Expected command payload

`setEffectParams(json)` receives:

```json
{
  "trackId": "track_123",
  "fxType": "pitchCorrection",
  "params": { "enabled": true, "amount": 95, "speed": 80 },
  "timestamp": "2026-06-09T00:00:00.000Z"
}
```

## Clone checklist

1. Clone the repo and install web dependencies with `bun install`.
2. Keep `.env` values out of git; configure Supabase and Lovable AI keys in the deployment/native environment.
3. For Android Studio, either load the published See Vibe URL in WebView or build the web app and copy the generated static bundle into Android assets.
4. Enable WebView microphone/audio permissions in `AndroidManifest.xml` for recording and playback.
5. Implement `NativeAudioEngineBridge` first; then map `fxType` values such as `pitchCorrection`, `reverb`, `delay`, `compressor`, `eq`, and `master` to native DSP code.
6. Test bridge calls from Logcat by triggering vocal presets/effects in the Studio; the web app falls back to `WebView Simulation Host` when no native bridge is attached.

## Permission reminders

Add only the permissions your native build actually uses:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.INTERNET" />
```

For Android 13+ media imports, request the scoped `READ_MEDIA_AUDIO` permission when needed.