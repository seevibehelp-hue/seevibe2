# See Vibe — Native Features Implementation Guide

This guide covers everything required to wrap the See Vibe web app inside a
**native Android** (Android Studio / WebView / Capacitor) shell **or a
desktop** (Electron / Tauri) shell, and to wire real native audio DSP and
device control to the existing web UI.

The web app already speaks to every native target through a single
abstraction: `src/utils/nativeBridge.ts`. You only need to implement the
native side that the bridge calls into.

---

## 1. Architecture overview

```
┌─────────────────────────────────────────────┐
│  See Vibe Web UI (React + Tone.js fallback) │
└──────────────────┬──────────────────────────┘
                   │
       src/utils/nativeBridge.ts
       dispatchNativeEffectCommand()
       resetNativeAudioEngine()
                   │
   ┌───────────────┼────────────────┬─────────────────┐
   ▼               ▼                ▼                 ▼
Android       Capacitor         Electron          Tauri / WKWebView
WebView       (Android/iOS)     (Desktop)         (Desktop / iOS)
JavascriptInterface
```

- Bridge version exported by web: `see-vibe-native-bridge-v1`
- The web app dispatches the DOM event `native-dsp-command` for every call.
- Without a native host attached the bridge logs `"WebView Simulation Host"`.

---

## 2. Android Studio (recommended path)

### 2.1 Project layout

```
android-app/
├── app/
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── java/com/seevibe/app/
│   │   │   ├── MainActivity.kt
│   │   │   ├── NativeAudioEngineBridge.kt
│   │   │   └── audio/
│   │   │       ├── OboeEngine.kt    (low-latency)
│   │   │       └── EffectChain.kt
│   │   └── res/
│   └── build.gradle.kts
└── build.gradle.kts
```

### 2.2 AndroidManifest.xml — permissions

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"
    android:maxSdkVersion="28" />
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" /> <!-- 33+ -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
```

### 2.3 MainActivity.kt — WebView host

```kotlin
class MainActivity : AppCompatActivity() {
  private lateinit var webView: WebView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    webView = WebView(this).also { setContentView(it) }

    webView.settings.apply {
      javaScriptEnabled = true
      domStorageEnabled = true
      mediaPlaybackRequiresUserGesture = false
      allowFileAccess = true
      cacheMode = WebSettings.LOAD_DEFAULT
    }

    // Required so getUserMedia() can capture the mic inside the WebView
    webView.webChromeClient = object : WebChromeClient() {
      override fun onPermissionRequest(request: PermissionRequest) {
        request.grant(request.resources)
      }
    }

    webView.addJavascriptInterface(
      NativeAudioEngineBridge(this),
      "NativeAudioEngine"
    )

    webView.loadUrl("https://seevibe.lovable.app") // or local assets
  }
}
```

### 2.4 NativeAudioEngineBridge.kt — DSP entry point

The web app calls **exactly** these two methods:

```kotlin
class NativeAudioEngineBridge(private val ctx: Context) {

  @JavascriptInterface
  fun setEffectParams(json: String) {
    // Payload shape:
    // { trackId, fxType, params: { ... }, timestamp }
    val p = JSONObject(json)
    val trackId = p.getString("trackId")
    val fxType  = p.getString("fxType")
    val params  = p.getJSONObject("params")
    OboeEngine.routeEffect(trackId, fxType, params)
  }

  @JavascriptInterface
  fun resetEngine(json: String) {
    val trackId = JSONObject(json).getString("trackId")
    OboeEngine.flushTrack(trackId)
  }
}
```

### 2.5 fxType values the web sends

| fxType            | params keys                                              |
|-------------------|----------------------------------------------------------|
| `pitchCorrection` | `enabled, amount (0-100), speed (0-100), key, scale`     |
| `reverb`          | `wet, roomSize, dampening`                               |
| `delay`           | `wet, time, feedback`                                    |
| `compressor`      | `threshold, ratio, attack, release`                      |
| `eq`              | `low, mid, high`  (and `graphicEQ: number[10]` if used)  |
| `gate`            | `threshold`                                              |
| `distortion`      | `wet, amount`                                            |
| `bitcrusher`      | `wet, bits`                                              |
| `phaser`          | `wet, frequency`                                         |
| `tremolo`         | `wet, frequency, depth`                                  |
| `chorus`          | `wet, frequency, depth, delayTime`                       |
| `pingPongDelay`   | `wet, delayTime, feedback`                               |
| `voicePitcher`    | `wet, pitch`                                             |
| `master`          | sent by `resetEngine` only                               |

Recommended native audio stack: **Oboe** (low-latency) → per-track
`EffectChain` → `AAudio` output. Keep the SR at the device's preferred
rate (usually 48000) and **never resample at the JS boundary**.

### 2.6 Verifying the bridge

Trigger any FX in the Studio. In Logcat you should see your `setEffectParams`
call. In the web console you'll see the bridge log say
`"Android WebView JavascriptInterface"` instead of `"WebView Simulation Host"`.

---

## 3. Capacitor (iOS + Android with one project)

Install:

```bash
npm i @capacitor/core @capacitor/cli
npx cap init "See Vibe" com.seevibe.app
npx cap add android
npx cap add ios
```

Create the plugin `NativeAudioEngine`:

```ts
// capacitor.config.ts (snippet)
plugins: {
  CapacitorHttp: { enabled: true }
}
```

```kotlin
// android/.../NativeAudioEnginePlugin.kt
@CapacitorPlugin(name = "NativeAudioEngine")
class NativeAudioEnginePlugin : Plugin() {
  @PluginMethod
  fun setEffectParams(call: PluginCall) {
    val payload = call.data            // already JSON
    OboeEngine.routeEffect(
      payload.getString("trackId"),
      payload.getString("fxType"),
      payload.getJSObject("params")
    )
    call.resolve()
  }
}
```

```swift
// ios/.../NativeAudioEnginePlugin.swift
@objc(NativeAudioEnginePlugin)
public class NativeAudioEnginePlugin: CAPPlugin {
  @objc func setEffectParams(_ call: CAPPluginCall) {
    let trackId = call.getString("trackId") ?? ""
    let fxType  = call.getString("fxType") ?? ""
    let params  = call.getObject("params") ?? [:]
    AVAudioEngineHost.shared.route(trackId, fxType, params)
    call.resolve()
  }
}
```

The web bridge already detects Capacitor and routes through it
automatically — no JS changes required.

---

## 4. iOS (WKWebView, no Capacitor)

```swift
let userContentController = WKUserContentController()
userContentController.add(self, name: "nativeAudioEngine")
let config = WKWebViewConfiguration()
config.userContentController = userContentController
config.allowsInlineMediaPlayback = true
config.mediaTypesRequiringUserActionForPlayback = []

extension AppViewController: WKScriptMessageHandler {
  func userContentController(_ uc: WKUserContentController,
                             didReceive msg: WKScriptMessage) {
    guard let body = msg.body as? [String: Any],
          let command = body["command"] as? String,
          let payload = body["payload"] as? [String: Any] else { return }
    switch command {
    case "setEffectParams": AVAudioEngineHost.shared.route(payload)
    case "resetEngine":     AVAudioEngineHost.shared.reset(payload)
    default: break
    }
  }
}
```

The web bridge already calls
`webkit.messageHandlers.nativeAudioEngine.postMessage({command, payload})`.

`Info.plist` keys required:

```
NSMicrophoneUsageDescription   "See Vibe needs the microphone to record vocals."
NSAppleMusicUsageDescription   "See Vibe imports audio from your library."
```

---

## 5. Desktop — Electron

```ts
// electron/preload.ts
import { contextBridge, ipcRenderer } from "electron"
contextBridge.exposeInMainWorld("electronAPI", {
  send: (ch: string, data: any) => ipcRenderer.send(ch, data),
})
```

```ts
// electron/main.ts
ipcMain.on("native-dsp-effect-change", (_e, payload) => {
  nativeDsp.route(payload)
})
ipcMain.on("native-dsp-reset", (_e, payload) => {
  nativeDsp.reset(payload)
})
```

The bridge auto-detects `window.electronAPI.send` and routes through it.

---

## 6. Desktop — Tauri (Rust)

```rust
// src-tauri/src/main.rs
#[tauri::command]
fn set_native_effect_params(payload: serde_json::Value) {
  native_dsp::route(payload);
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![set_native_effect_params])
    .run(tauri::generate_context!())
    .unwrap();
}
```

The bridge calls `__TAURI__.invoke('set_native_effect_params', payload)`
automatically.

---

## 7. Device control features

| Feature                  | Web call                                       | Native target           |
|--------------------------|------------------------------------------------|-------------------------|
| Mic capture              | `navigator.mediaDevices.getUserMedia`          | OS permission grant     |
| Audio output routing     | `enumerateDevices` / sinkId                    | AAudio / CoreAudio      |
| MIDI                     | `navigator.requestMIDIAccess`                  | android.media.midi      |
| Bluetooth audio          | system A2DP                                    | enable in Manifest      |
| Wake-lock (during record)| `navigator.wakeLock.request('screen')`         | `WAKE_LOCK` permission  |
| Background record        | foreground service                             | `FOREGROUND_SERVICE_*`  |
| Push notifications       | `firebase-messaging-sw.js` (already shipped)   | FCM token registration  |
| File pickers             | `<input type="file">`                          | `READ_MEDIA_AUDIO`      |
| Share / Save audio       | Web Share API + MediaStore                     | `ACTION_CREATE_DOCUMENT`|

For low-latency: target **Oboe AAudio EXCLUSIVE mode** with a 96-frame
buffer if the device supports it. Fall back to OpenSL ES.

---

## 8. Cloning checklist (one-pass setup)

1. `git clone https://github.com/seevibehelp-hue/seevibeabelossu`
   _OR_ clone this Lovable project from the GitHub integration.
2. `bun install`
3. Configure secrets (see `.env.example` if present): `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`, server-only `LOVABLE_API_KEY`.
4. `bun run dev` — confirm the web Studio plays audio (Tone.js fallback).
5. Open the Android Studio project, add `NativeAudioEngineBridge`,
   point WebView at your deployment URL or local bundled assets.
6. Trigger an FX in the Studio. Logcat should show your handler firing.
7. Implement `OboeEngine.routeEffect` track by track. Start with `eq` and
   `compressor` since they're trivial parameter maps.
8. Once `pitchCorrection` is mapped, the AI Producer pipeline becomes
   fully native-accelerated.

---

## 9. Known web-side guarantees

- Tone.js is pinned to **14.7.77** — Tone 15 broke `Tone.Transport` timing
  inside the engine. Keep it pinned.
- The web bridge dispatches a synchronous `native-dsp-command` DOM event for
  every command, useful for native test harnesses that inject a listener.
- All AI HTTP endpoints under `/api/ai/*` require a Bearer token (Supabase
  session). When wrapping in a native shell, the WebView already holds the
  user's Supabase session in `localStorage`, so no extra work is required.

---

## 10. Quick troubleshooting

| Symptom                                  | Cause / fix                                       |
|------------------------------------------|---------------------------------------------------|
| Bridge logs "WebView Simulation Host"    | Native interface not attached before `loadUrl`.   |
| Playback at half/double speed            | Tone.js was upgraded past 14.x — repin to 14.7.77.|
| Mic permission prompt never appears      | Missing `WebChromeClient.onPermissionRequest`.    |
| No audio after backgrounding (Android)   | Add a foreground service for media playback.      |
| 401 on `/api/ai/*` from native           | WebView lost session cookies — clear app data, re-login. |

---

# v2 Additions — License Proof, Wallet Enforcement, Region Detection, Timeline

## License Proof PDF (native sharing)

The web app generates the License Proof PDF entirely client-side
(`src/utils/licenseProofPdf.ts`) and triggers a normal browser download.
For a native shell, intercept the download and forward to the OS share sheet.

### Android (WebView)
```kotlin
webView.setDownloadListener { url, _, _, mimeType, _ ->
  if (mimeType == "application/pdf") {
    val intent = Intent(Intent.ACTION_SEND).apply {
      type = "application/pdf"
      putExtra(Intent.EXTRA_STREAM, Uri.parse(url))
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    startActivity(Intent.createChooser(intent, "Share License Proof"))
  }
}
```

### iOS (WKWebView)
Use `UIActivityViewController` with the downloaded PDF `URL`.

## Wallet enforcement (no free top-ups)

The AI Producer now hard-blocks prompts when the wallet balance is below
$0.20. Native shells MUST NOT inject demo credits. Wire native IAP top-ups
(Google Play Billing / Apple StoreKit) to call your existing `wallets` table
update via Supabase — never bypass the balance check.

```kotlin
// Android: after successful Play Billing purchase
val newBalance = oldBalance + purchasedUsd
supabaseClient.from("wallets").update(mapOf("balance_usd" to newBalance))
  .eq("user_id", userId).execute()
```

## Region detection for culturally-aware AI

Web uses `navigator.language`. Native bridges should expose the device
locale + country code:

```kotlin
@JavascriptInterface
fun getDeviceRegion(): String =
  Locale.getDefault().country ?: ""
```

```javascript
const region = (window as any).NativeRegion?.getDeviceRegion?.() ?? navigator.language;
```

Pass `region` into `/api/ai/produce-song` so the AI picks a regionally
representative genre when the user doesn't specify one.

## Timeline ruler & playhead

Timeline ruler now starts at `0`. Future native overlays (Oboe-backed
playhead, custom waveform views) should treat ruler unit 0 as transport
position 0. Pixel-per-second base = `(bpm/60) * 4 * GRID_SIZE` from
`Arrangement.tsx`. When a native timeline-zoom gesture
(`ScaleGestureDetector` on Android / `UIPinchGestureRecognizer` on iOS) is
implemented, dispatch a `timeline-zoom` CustomEvent the web app can listen
to:

```kotlin
webView.evaluateJavascript(
  "window.dispatchEvent(new CustomEvent('timeline-zoom', { detail: { scale: $scale } }))",
  null
)
```

## Vocal waveform rendering (planned)

Imported vocal clips will gain an in-timeline waveform (red, mirrored,
BandLab-style). Native shells can offload decode + peak extraction to Oboe
(Android) or AVAudioEngine (iOS) and push peaks back to the web via:

```javascript
window.dispatchEvent(new CustomEvent('native-waveform-peaks', {
  detail: { clipId, peaks: [/* normalized 0..1 floats, ~one per pixel */] }
}));
```

The web app stores these on the clip and renders without re-decoding.
