// @ts-nocheck
import * as Tone from "tone";
import { useDawStore } from "../store/useDawStore";
import { DawTrack, SynthType, TrackType } from "../types/daw";
import { analyzeAudioPitch } from "./vocalAnalysis";
import { VocalPipeline } from "./engine/VocalPipeline";
import { startLowLatencySynth, stopLowLatencySynth, stopAllLowLatencyVoices, playLowLatencyDrumHit, mapDrumNoteToType, renderReferenceDrumAt } from "./lowLatencySynth";
import JSZip from "jszip";

const globalBufferCache = new Map<string, Tone.ToneAudioBuffer>();

// ---------------------------------------------------------------------------
// Shared PCM encoder — used by both the Worker string and the synchronous
// fallback so the conversion logic only ever lives in one place.
// NOTE: The function body is also embedded verbatim in wavWorkerCode below
// (Workers can't import modules) — keep the two in sync.
// ---------------------------------------------------------------------------
function encodeInt16PCM(
  view: DataView,
  channelData: Float32Array[],
  numChannels: number,
  length: number,
  startPos: number
): void {
  let pos = startPos;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const arr = channelData[ch];
      const raw = arr && i < arr.length ? arr[i] : 0;
      let s = Math.max(-1, Math.min(1, raw));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(pos, s, true);
      pos += 2;
    }
  }
}

// encodeInt16PCM body embedded for Worker scope (Workers cannot import modules).
const _encodeInt16PCMSrc = `
function encodeInt16PCM(view, channelData, numChannels, length, startPos) {
  let pos = startPos;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const arr = channelData[ch];
      const raw = arr && i < arr.length ? arr[i] : 0;
      let s = Math.max(-1, Math.min(1, raw));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(pos, s, true);
      pos += 2;
    }
  }
}
`;

const wavWorkerCode = _encodeInt16PCMSrc + `
self.onmessage = function(e) {
  const { channelData, sampleRate, numChannels, length, bitDepth = 16 } = e.data;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  // Allocate buffer
  const wavBuffer = new ArrayBuffer(44 + length * blockAlign);
  const view = new DataView(wavBuffer);
  
  const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  // WAV Header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + length * blockAlign, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM Format = 1
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, "data");
  view.setUint32(40, length * blockAlign, true);
  
  // Delegate PCM conversion to the shared encodeInt16PCM helper (defined above).
  encodeInt16PCM(view, channelData, numChannels, length, 44);
  self.postMessage({ type: 'progress', progress: 99 });
  self.postMessage({ type: 'done', wavBuffer: wavBuffer }, [wavBuffer]);
};
`;

function encodeWavInWorker(audioBuffer: any, onProgress: (p: number) => void): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!audioBuffer) {
      reject(new Error("Cannot encode wav: audio buffer is empty/null"));
      return;
    }
    // Deep unpack any wrapped Tone.js or native AudioBuffer structures
    let nativeBuf = audioBuffer;
    if (typeof audioBuffer.get === "function") {
      const g = audioBuffer.get();
      if (g) nativeBuf = g;
    }
    if (nativeBuf && nativeBuf._buffer) {
      nativeBuf = nativeBuf._buffer;
    }

    const numChannels = nativeBuf.numberOfChannels || 1;
    const sampleRate = nativeBuf.sampleRate || 44100;
    const length = nativeBuf.length || 0;
    
    const channelData: Float32Array[] = [];
    for (let c = 0; c < numChannels; c++) {
      let data: Float32Array;
      if (typeof nativeBuf.getChannelData === "function") {
        data = nativeBuf.getChannelData(c).slice();
      } else if (typeof nativeBuf.toArray === "function") {
        data = nativeBuf.toArray(c).slice();
      } else {
        data = new Float32Array(length);
      }
      channelData.push(data);
    }
    
    function runSynchronousEncode() {
      try {
        const bytesPerSample = 2; // 16-bit PCM
        const blockAlign = numChannels * bytesPerSample;
        const wavBuffer = new ArrayBuffer(44 + length * blockAlign);
        const view = new DataView(wavBuffer);
        
        const writeString = (v: DataView, offset: number, string: string) => {
          for (let idx = 0; idx < string.length; idx++) {
            v.setUint8(offset + idx, string.charCodeAt(idx));
          }
        };
        
        // WAV Header
        writeString(view, 0, "RIFF");
        view.setUint32(4, 36 + length * blockAlign, true);
        writeString(view, 8, "WAVE");
        writeString(view, 12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM Format = 1
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, "data");
        view.setUint32(40, length * blockAlign, true);
        
        const totalFrames = length;
        const batchSize = Math.max(40000, Math.floor(totalFrames / 15));
        let i = 0;

        function processBatch() {
          const state = useDawStore.getState();
          if (state.isExportCancelled) {
            reject(new Error("Export aborted by user"));
            return;
          }

          const end = Math.min(totalFrames, i + batchSize);
          // Delegate to shared PCM encoder for this batch slice.
          // We create a temporary slice view so encodeInt16PCM writes only
          // the frames [i, end) at the correct DataView offset.
          const sliceChannels = channelData.map((ch: Float32Array) => ch.slice(i, end));
          encodeInt16PCM(view, sliceChannels, numChannels, end - i, 44 + i * numChannels * 2);
          i = end;

          const completionPercent = Math.min(99, Math.round(95 + (i / totalFrames) * 4));
          onProgress(completionPercent);
          
          if (i < totalFrames) {
            setTimeout(processBatch, 0);
          } else {
            const finalBlob = new Blob([wavBuffer], { type: "audio/wav" });
            resolve(finalBlob);
          }
        }
        
        processBatch();
      } catch (encodeError) {
        reject(encodeError);
      }
    }

    let worker: Worker | null = null;
    let workerUrl = "";
    try {
      const workerBlob = new Blob([wavWorkerCode], { type: 'application/javascript' });
      workerUrl = URL.createObjectURL(workerBlob);
      worker = new Worker(workerUrl);
      
      const unsubscribe = useDawStore.subscribe((state) => {
        if (state.isExportCancelled) {
          if (worker) worker.terminate();
          if (workerUrl) URL.revokeObjectURL(workerUrl);
          unsubscribe();
          reject(new Error("Export aborted by user"));
        }
      });
      
      worker.onmessage = (e) => {
        if (e.data.type === 'progress') {
          onProgress(e.data.progress);
        } else if (e.data.type === 'done') {
          unsubscribe();
          if (worker) worker.terminate();
          if (workerUrl) URL.revokeObjectURL(workerUrl);
          const finalBlob = new Blob([e.data.wavBuffer], { type: "audio/wav" });
          resolve(finalBlob);
        }
      };
      
      worker.onerror = (err) => {
        console.warn("WAV Worker background error, running non-blocking synchronous fallback", err);
        unsubscribe();
        if (worker) worker.terminate();
        if (workerUrl) URL.revokeObjectURL(workerUrl);
        runSynchronousEncode();
      };
      
      worker.postMessage({
        channelData,
        sampleRate,
        numChannels,
        length
      });
      
    } catch (workerError) {
      console.warn("Failed to construct Worker context, falling back to non-blocking synchronous encoder", workerError);
      if (workerUrl) URL.revokeObjectURL(workerUrl);
      runSynchronousEncode();
    }
  });
}

interface TrackContext {
  synth?: Tone.PolySynth;
  synthType?: SynthType;
  channel: Tone.Channel;
  eq: Tone.EQ3;
  // Per-track reverb/delay kept for compatibility but replaced by send levels
  // to the shared return buses (see AudioEngine.sharedReverb / sharedDelay).
  reverb: Tone.Freeverb;
  delay: Tone.FeedbackDelay;
  // Send gain nodes to the shared return buses
  reverbSend?: Tone.Gain;
  delaySend?: Tone.Gain;
  compressor: Tone.Compressor;
  pitchShift: Tone.PitchShift;
  chorus: Tone.Chorus;
  players: Map<string, Tone.Player>;
  distortion?: Tone.Distortion;
  phaser?: Tone.Phaser;
  tremolo?: Tone.Tremolo;
  gate?: Tone.Gate;
  highpass?: Tone.Filter;
  lowpass?: Tone.Filter;
  bandpass?: Tone.Filter;
  bitcrusher?: Tone.BitCrusher;
  pingPongDelay?: Tone.PingPongDelay;
  voicePitcher?: Tone.PitchShift;
  graphicEQFilters?: Tone.Filter[];
  meter?: Tone.Meter;
  micStream?: MediaStream;
  micNode?: Tone.Gain;
  inputGain?: Tone.Gain;
  inputLimiter?: Tone.Limiter;
  recorder?: Tone.Recorder;
  isRecording?: boolean;
  recordingStartTimeCtx?: number;
  liveRecordingPeaks?: number[];
  liveRecordingSegments?: { start16thsOffset: number, duration16ths: number, peaks: number[], audioOffset16ths: number }[];
  recordingInterval?: any;
  currentChainStr?: string;
}

const DRUM_SAMPLES_URLS: Record<string, string> = {};

async function preloadOfflineDrums() {}

class DrumVoice {
  kick: Tone.MembraneSynth;
  snare: Tone.NoiseSynth;
  snareTone: Tone.MembraneSynth;
  hat: Tone.NoiseSynth;
  tom: Tone.MembraneSynth;
  clap: Tone.NoiseSynth;
  crash: Tone.MetalSynth;
  cowbell: Tone.MetalSynth;
  fx: Tone.FMSynth;

  private snareFilter: Tone.Filter;
  private hatFilter: Tone.Filter;
  private clapFilter: Tone.Filter;

  constructor() {
    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.1,
      octaves: 4,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0.01, release: 0.3 },
      volume: -16
    });

    this.snareFilter = new Tone.Filter({ type: "highpass", frequency: 1000 });
    this.snare = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.2 },
      volume: -20
    }).connect(this.snareFilter);

    this.snareTone = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 2,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
      volume: -18
    });

    this.hatFilter = new Tone.Filter({ type: "highpass", frequency: 8000 });
    this.hat = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.04 },
      volume: -18
    }).connect(this.hatFilter);

    this.tom = new Tone.MembraneSynth({
      pitchDecay: 0.05,
      octaves: 3,
      oscillator: { type: "sine" },
      envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.5 },
      volume: -16
    });

    this.clapFilter = new Tone.Filter({ type: "bandpass", frequency: 1500 });
    this.clap = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
      volume: -16
    }).connect(this.clapFilter);

    this.crash = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 1.5, release: 0.8 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 4000,
      octaves: 1.5,
      volume: -20
    });
    this.crash.frequency.value = 200;

    this.cowbell = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.4, release: 0.1 },
      harmonicity: 1.2,
      modulationIndex: 12,
      resonance: 800,
      octaves: 1,
      volume: -16
    });
    this.cowbell.frequency.value = 400;

    this.fx = new Tone.FMSynth({
      harmonicity: 8,
      modulationIndex: 20,
      oscillator: { type: "square" },
      envelope: { attack: 0.01, decay: 0.5, sustain: 0.2, release: 0.5 },
      volume: -20
    });
  }

  connect(dest: any) {
    this.kick.connect(dest);
    this.snareFilter.connect(dest);
    this.snareTone.connect(dest);
    this.hatFilter.connect(dest);
    this.tom.connect(dest);
    this.clapFilter.connect(dest);
    this.crash.connect(dest);
    this.cowbell.connect(dest);
    this.fx.connect(dest);
  }

  toDestination() {
    this.kick.toDestination();
    this.snareFilter.toDestination();
    this.snareTone.toDestination();
    this.hatFilter.toDestination();
    this.tom.toDestination();
    this.clapFilter.toDestination();
    this.crash.toDestination();
    this.cowbell.toDestination();
    this.fx.toDestination();
  }

  dispose() {
    this.kick.dispose();
    this.snare.dispose();
    this.snareTone.dispose();
    this.hat.dispose();
    this.tom.dispose();
    this.snareFilter.dispose();
    this.hatFilter.dispose();
    this.clap.dispose();
    this.clapFilter.dispose();
    this.crash.dispose();
    this.cowbell.dispose();
    this.fx.dispose();
  }
}

class ReferenceDrumKitSynth {
  public disposed = false;
  private destination: AudioNode | null = null;

  connect(destination: any) {
    this.destination = ((destination as any)?.input || destination) as AudioNode;
    return this;
  }

  toDestination() {
    this.destination = ((Tone.getDestination() as any)?.input || Tone.getDestination()) as AudioNode;
    return this;
  }

  dispose() {
    this.destination = null;
    this.disposed = true;
  }

  triggerAttackRelease(note: string | string[], _duration: string | number, time?: any, velocity?: number) {
    this.triggerAttack(note, time, velocity);
  }

  triggerAttack(note: string | string[], time?: any, velocity?: number) {
    if (this.disposed || !this.destination) return;
    const ctx = Tone.getContext().rawContext as AudioContext;
    const notes = Array.isArray(note) ? note : [note];
    const startTime = typeof time === 'number' ? time : Tone.immediate();
    const safeVelocity = Math.min(1, Math.max(0, velocity ?? 0.8));
    notes.forEach((value) => {
      renderReferenceDrumAt(ctx, this.destination!, mapDrumNoteToType(value), startTime, safeVelocity);
    });
  }

  triggerRelease() {}
  releaseAll() {}
}

class AudioEngine {
  private trackContexts: Map<string, TrackContext> = new Map();
  private parts: Map<string, Tone.Part> = new Map();
  private clipPitchShifts: Map<string, Tone.PitchShift> = new Map();

  // WakeLock sentinel — kept alive while recording or playing so the screen
  // does not sleep mid-session and drop audio.
  private _wakeLock: WakeLockSentinel | null = null;

  private async _acquireWakeLock() {
    if (this._wakeLock) return; // already held
    try {
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        this._wakeLock = await (navigator as any).wakeLock.request('screen');
        this._wakeLock?.addEventListener('release', () => {
          this._wakeLock = null;
        });
      }
    } catch (_) {}
  }

  private _releaseWakeLock() {
    try { this._wakeLock?.release(); } catch (_) {}
    this._wakeLock = null;
  }
  private audioBufferCache: Map<string, Tone.ToneAudioBuffer> = new Map();

  public vocalPipeline: VocalPipeline | null = null;
  public micNode: Tone.UserMedia | any = null;
  public micStream: MediaStream | null = null;
  public recorder: Tone.Recorder;
  private micChannel: Tone.Channel;
  public masterHeadroom: Tone.Volume;
  public masterCompressor: Tone.Compressor;
  public masterTrim: Tone.Volume;
  public masterLimiter: Tone.Limiter;

  // Shared return buses — every track sends to these instead of instantiating
  // its own reverb/delay.  Wet=0 tracks cost nothing; per-track instances cost
  // CPU even when bypassed.
  public sharedReverb: Tone.Freeverb;
  public sharedDelay: Tone.FeedbackDelay;
  public pitchAnalyser: Tone.Analyser;

  private unsubscribe: (() => void) | null = null;

  private metronomeSynth: Tone.MembraneSynth;
  private metronomePart: Tone.Loop | null = null;
  public meter: Tone.Meter;
  public isInitialized = false;

  // Visualizer / Waveform peaks while recording
  public liveRecordingSegments: { start16thsOffset: number, duration16ths: number, peaks: number[], audioOffset16ths: number }[] = [];
  public currentRecordingPeakLevel: number = 0;

  /**
   * Returns a direct reference to the live peak array for the given track.
   * Read-only — do not mutate. Sampled every 50 ms by the recording interval.
   * Returns an empty array when the track is not recording.
   */
  public getLivePeaksForTrack(trackId: string): number[] {
    return this.trackContexts.get(trackId)?.liveRecordingPeaks ?? [];
  }
  private recordingInterval: any = null;
  private liveRecordingPeaks: number[] = [];

  // Exact timing

  public recordingStartTimeCtx: number = 0;
  public recordingStartTicks: number = 0;

  // MIDI support
  private midiInputs: Map<string, MIDIInput> = new Map();
  public activeMidiRecordings: Map<string, Map<string, { clipId: string; noteId: string; start16ths: number }>> = new Map();

  constructor() {
    // Real-time master chain kept intentionally conservative for mobile stability.
    this.masterLimiter = new Tone.Limiter(-1).toDestination();
    
    const initialVolume = useDawStore.getState().masterVolume ?? 0;
    // -6 dB padding provides perfect high-precision summing headroom in modern 32-bit float audio engines
    this.masterHeadroom = new Tone.Volume(initialVolume - 6);
    
    // Transparent glue compression — barely touches peaks, never audibly pumps.
    this.masterCompressor = new Tone.Compressor({
      threshold: -6,
      ratio: 1.5,
      attack: 0.02,
      release: 0.25
    });

    // Keep a small safety trim in real-time to avoid speaker-tear artifacts on mobile.
    this.masterTrim = new Tone.Volume(-1.3) // safety trim (was misnamed masterMaximizer);
    
    this.masterHeadroom.connect(this.masterCompressor);
    this.masterCompressor.connect(this.masterTrim);
    this.masterTrim.connect(this.masterLimiter);

    // Shared return buses — instantiated once, shared across all tracks.
    // Default settings match what each track was instantiating individually.
    this.sharedReverb = new Tone.Freeverb({ roomSize: 0.7, dampening: 3000, wet: 1 });
    this.sharedReverb.connect(this.masterHeadroom);

    this.sharedDelay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.3, wet: 1 });
    this.sharedDelay.connect(this.masterHeadroom);
    
    this.recorder = new Tone.Recorder();
    this.meter = new Tone.Meter();
    this.pitchAnalyser = new Tone.Analyser("waveform", 2048);

    this.micChannel = new Tone.Channel().connect(this.masterHeadroom);
    this.micChannel.mute = !useDawStore.getState().inputMonitoring;
    this.metronomeSynth = new Tone.MembraneSynth({ volume: -14 }).connect(this.masterHeadroom);

    this.initMidi();
    this.installVisibilityHandler();
  }

  private visibilityHandlerInstalled = false;
  private installVisibilityHandler() {
    if (this.visibilityHandlerInstalled) return;
    if (typeof document === 'undefined') return;
    this.visibilityHandlerInstalled = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // Rebuild audio-clip players that mobile WebViews drop when backgrounded.
        this.refreshAudioPlayersAfterResume();
      }
    });
    window.addEventListener('pageshow', () => {
      if (document.visibilityState === 'visible') {
        this.refreshAudioPlayersAfterResume();
      }
    });
  }

  public async getMediaStream(
    echoCancellation: boolean = false,
    noiseSuppression: boolean = false,
    deviceId?: string,
  ) {
    if (this.micNode && typeof this.micNode.disconnect === 'function') {
      this.micNode.disconnect();
    }
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
           audio: {
              deviceId: deviceId ? { exact: deviceId } : undefined,
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false
           }
        });

      if (!this.vocalPipeline) {
        this.vocalPipeline = new VocalPipeline();
        await this.vocalPipeline.init();
      }
      
      this.micNode = new Tone.Gain(1);
      const rawContext = Tone.getContext().rawContext as any;
      
      if (this.vocalPipeline) {
         this.vocalPipeline.connectInput(this.micStream);
         const processedStream = this.vocalPipeline.getOutputStream();
         // Connect processed native stream to Tone's context
         const sourceNode = rawContext.createMediaStreamSource(processedStream);
         sourceNode.connect(this.micNode.input);
      } else {
         const sourceNode = rawContext.createMediaStreamSource(this.micStream);
         sourceNode.connect(this.micNode.input);
      }

      // Connect properly based on monitor state
      this.routeMicToSelectedTrack(useDawStore.getState().inputMonitoring);
    } catch (err: any) {
      console.error("Microphone access failed", err);
      // alert(`Microphone access failed: \${err.message || String(err)}`);
    }
  }

  private async initMidi() {
    if (navigator.requestMIDIAccess) {
      try {
        const midiAccess = await navigator.requestMIDIAccess();
        this.updateMidiDevices(midiAccess);

        midiAccess.onstatechange = (e) => {
          this.updateMidiDevices(e.target as MIDIAccess);
        };
        console.log("Web MIDI API connected");
      } catch (err) {
        console.warn("MIDI could not be initialized:", err);
      }
    }
  }

  private updateMidiDevices(midiAccess: MIDIAccess) {
    this.midiInputs.clear();
    const devices: { id: string; name: string }[] = [];
    for (const input of midiAccess.inputs.values()) {
      this.midiInputs.set(input.id, input);
      devices.push({ id: input.id, name: input.name || "Unknown Device" });
      input.onmidimessage = this.handleMidiMessage.bind(this);
    }
    useDawStore.getState().setMidiDevices(devices);
  }

  private handleMidiMessage(message: MIDIMessageEvent) {
    if (!message.data) return;
    const [status, note, velocity] = message.data;
    const command = status & 0xf0;
    const channel = (status & 0x0f) + 1; // 1-16
    const inputId = (message.target as any).id;

    const state = useDawStore.getState();

    // Route to all MIDI tracks that match the criteria
    state.tracks.forEach((track) => {
      if (track.type !== "midi") return;

      const channelMatch =
        !track.midiChannel ||
        track.midiChannel === 0 ||
        track.midiChannel === channel;
      const deviceMatch =
        !track.midiInputId ||
        track.midiInputId === "all" ||
        track.midiInputId === inputId;

      if (channelMatch && deviceMatch) {
        // Only trigger "All Inputs" devices if the track is armed or selected
        const hasArmedMidi = state.tracks.some(t => t.type === 'midi' && t.armed);
        const isActiveTarget = track.armed || (!hasArmedMidi && track.id === state.selectedTrackId);
        
        if (track.midiInputId === "all" && !isActiveTarget) {
          return;
        }

        const isDrumKit = track.synthType === "membrane";

        if (command === 144 && velocity > 0) {
          // Note on
          const pcNote = Tone.Frequency(note, "midi").toNote();
          if (isDrumKit) {
            playLowLatencyDrumHit(pcNote, velocity / 127);
          } else {
            startLowLatencySynth(pcNote, track.synthType || "poly", velocity / 127);
          }

          if (state.isRecording && isActiveTarget) {
             this.recordMidiNoteStart(track.id, pcNote, velocity / 127);
          }

          // Visual feedback
          if (track.id === state.selectedTrackId) {
            window.dispatchEvent(
              new CustomEvent("midi-note-on", {
                detail: { note: pcNote, velocity: velocity / 127 },
              }),
            );
          }
        } else if (command === 128 || (command === 144 && velocity === 0)) {
          // Note off
          const pcNote = Tone.Frequency(note, "midi").toNote();
          if (!isDrumKit) {
            stopLowLatencySynth(pcNote, track.synthType || "poly");
          }

          if (state.isRecording && isActiveTarget) {
             this.recordMidiNoteEnd(track.id, pcNote);
          }

          if (track.id === state.selectedTrackId) {
            window.dispatchEvent(
              new CustomEvent("midi-note-off", { detail: { note: pcNote } }),
            );
          }
        }
      }
    });
  }

  public async enumerateAudioDevices() {
    try {
      // Prompt for permission if haven't already so labels can be read
      try {
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempStream.getTracks().forEach(t => t.stop());
      } catch(e) {}
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          id: d.deviceId,
          name: d.label || `Input ${d.deviceId.slice(0, 5)}`,
        }));
      useDawStore.getState().setAudioInputs(inputs);

      const outputs = devices
        .filter((d) => d.kind === "audiooutput")
        .map((d) => ({
          id: d.deviceId,
          name: d.label || `Output ${d.deviceId.slice(0, 5)}`,
        }));
      useDawStore.getState().setAudioOutputs(outputs);
    } catch (e) {
      console.warn("Could not enumerate audio devices", e);
    }
  }

  private initPromise: Promise<void> | null = null;

  async init() {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      // Create the AudioContext with a low-latency hint before Tone.start() so the
      // browser picks the smallest feasible buffer size (typically 256 samples on
      // desktop, ~512 on mobile) instead of the default "balanced" ~100 ms.
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx({ latencyHint: 'interactive', sampleRate: 44100 });
          Tone.setContext(ctx);
        }
      } catch (_) {}

      await Tone.start();
      console.log("Audio Engine Started");

      // Start with a conservative lookahead; tightened dynamically for live input.
      Tone.getContext().lookAhead = 0.05;

      try {
        await preloadOfflineDrums();
        await this.enumerateAudioDevices();
      } catch (e) {}

      Tone.Destination.mute = false;
      Tone.Destination.volume.value = 0;

      Tone.Transport.loop = true;
      Tone.Transport.loopStart = 0;
      Tone.Transport.loopEnd = "4m";

      Tone.Transport.scheduleRepeat((time) => {
        const state = useDawStore.getState();
        if (state.playbackState === "playing") {
          const currentPos = Tone.Transport.ticks / 48;
          state.setTransportPosition(currentPos);

          // Real-time automation envelope controller
          const current16th = Math.floor(currentPos) % 16;
          state.tracks.forEach(track => {
            if (track.automationEnabled && track.automationCurve && track.automationType) {
              const val = track.automationCurve[current16th];
              if (val !== undefined && val !== null) {
                const ctx = this.trackContexts.get(track.id);
                if (ctx) {
                  if (track.automationType === 'lowpass' && ctx.lowpass) {
                    // Map 0-1 logarithmically to 150Hz - 16000Hz for incredible analog synth sweeps
                    const targetFreq = Math.round(150 * Math.pow(106, val));
                    ctx.lowpass.frequency.rampTo(targetFreq, 0.05);
                  } else if (track.automationType === 'reverb' && ctx.reverb) {
                    ctx.reverb.wet.rampTo(val, 0.05);
                  } else if (track.automationType === 'volume' && ctx.channel) {
                    // Map 0-1 to fader volume db ranges (-36dB to +6dB)
                    const targetDb = val === 0 ? -99 : -36 + (val * 42);
                    ctx.channel.volume.rampTo(targetDb, 0.05);
                  }
                }
              }
            }
          });

          // Real-time Sidechain compression fader simulation (FL Studio pumping style)
          const isKickStep = (current16th % 4 === 0);
          state.tracks.forEach(track => {
            const ctx = this.trackContexts.get(track.id);
            if (ctx && ctx.channel) {
              if (track.fx?.sidechain?.enabled) {
                if (isKickStep) {
                  const baseVol = track.volume ?? 0;
                  const ratio = track.fx.sidechain.ratio ?? 4;
                  // Ratio controls the depth of sidechain ducking (-3dB to -24dB)
                  const duckAmt = Math.min(24, Math.max(3, ratio * 3));
                  // Use the scheduler `time` arg for sample-accurate ducking
                  ctx.channel.volume.setValueAtTime(baseVol - duckAmt, time);
                  // Glide/ramp volume back to original fader level over release seconds
                  const releaseTime = track.fx.sidechain.release ?? 0.12;
                  ctx.channel.volume.rampTo(baseVol, releaseTime, time + 0.04);
                }
              }
            }
          });

          // -------------------------------------------------------------
          // FL Gross Beat / Time-Shaping Engine simulation
          // -------------------------------------------------------------
          state.tracks.forEach(track => {
            const ctx = this.trackContexts.get(track.id);
            if (ctx && track.fx?.timeShaper?.enabled) {
              const mode = track.fx.timeShaper.mode || 'off';
              const mix = track.fx.timeShaper.mix ?? 1.0;
              const curve = track.fx.timeShaper.curve || [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1];
              const stepInBar = current16th % 16;
              const curveVal = curve[stepInBar] ?? 1.0;
              
              if (mode === 'half') {
                // Pitch shift dropped by 12 steps (one octave down) to emulate Half-Time vinyl slow down
                if (ctx.pitchShift) {
                  ctx.pitchShift.pitch = -12;
                  ctx.pitchShift.wet.value = mix;
                }
              } else if (mode === 'reverse') {
                // Vinyl tape stop glide scratch simulation
                // Every 8 steps, ramp pitch from 0 down to -24 to simulate turntable slowdown
                const barPosition = current16th % 8;
                if (ctx.pitchShift) {
                  ctx.pitchShift.wet.value = mix;
                  if (barPosition === 0) {
                    ctx.pitchShift.pitch = 0;
                  } else if (barPosition >= 4) {
                    // Glide pitch down linearly to make that gorgeous tape stop sound!
                    const targetPitch = -24 * ((barPosition - 4) / 4);
                    ctx.pitchShift.pitch = targetPitch;
                  }
                }
              } else if (mode === 'gate') {
                // Gated rhythm chop (e.g. 1/3 gating or custom trance rhythmic chop)
                // We create a staccato pulse: mute on alternate steps or every 3rd step
                const shouldMute = (current16th % 3 === 0);
                if (ctx.channel) {
                  if (shouldMute) {
                    ctx.channel.volume.setValueAtTime(-99, time);
                  } else {
                    const baseVol = track.volume ?? 0;
                    ctx.channel.volume.setValueAtTime(baseVol, time);
                  }
                }
              } else if (mode === 'custom') {
                // Highly customizable user-drawn envelope curve tracker!
                // Can sweep both pitch and gate volumes!
                if (ctx.channel) {
                  const baseVol = track.volume ?? 0;
                  // Map curveVal (0.0 to 1.0) to decibel ducking (down to -80dB)
                  const targetVol = curveVal <= 0.05 ? -99 : Math.max(-99, baseVol + 20 * Math.log10(curveVal));
                  ctx.channel.volume.setValueAtTime(targetVol, time);
                }
                
                if (ctx.pitchShift) {
                  // Connect curveVal directly to slide pitch (pitch shifts down on lower envelope points to simulate vinyl slows/stop!)
                  const targetPitch = (curveVal - 1.0) * 18; // slide down to -18 semitones
                  ctx.pitchShift.pitch = targetPitch;
                  // If curve is flat 1s, don't apply pitch Shift, else apply with wet mix
                  ctx.pitchShift.wet.value = curveVal < 0.99 ? mix : 0;
                }
              }
            } else if (ctx && ctx.pitchShift && !track.fx?.pitchShift?.enabled) {
              // Reset pitch shift if TimeShaper is off and pitch shift effect isn't otherwise on
              ctx.pitchShift.pitch = 0;
              ctx.pitchShift.wet.value = 0;
            }
          });

          // -------------------------------------------------------------
          // Fruity Peak Controller Internal Modulation Routing
          // -------------------------------------------------------------
          // Scan all active peak controller configurations
          state.tracks.forEach(track => {
            const ctx = this.trackContexts.get(track.id);
            if (ctx && track.fx?.peakController?.enabled && track.fx.peakController.sourceTrackId) {
              const sourceTrackId = track.fx.peakController.sourceTrackId;
              const targetParam = track.fx.peakController.targetParam || 'none';
              const depth = track.fx.peakController.depth ?? 0.5;
              
              const srcCtx = this.trackContexts.get(sourceTrackId);
              if (srcCtx && srcCtx.meter) {
                // Read signal RMS amplitude level in Db
                const rawVal = srcCtx.meter.getValue();
                const db = Array.isArray(rawVal) ? rawVal[0] : (rawVal as number);
                
                // Convert DB to raw linear amplitude (0.0 to 1.0 range)
                let amplitude = Math.pow(10, db / 20);
                if (isNaN(amplitude) || amplitude < 0.01) amplitude = 0;
                if (amplitude > 1.0) amplitude = 1.0;
                
                // Scale according to controller depth
                const modVal = amplitude * depth;
                
                if (targetParam === 'lowpass' && ctx.lowpass) {
                  // Sweep lowpass cutoff filter downwards relative to amplitude peak (classic pumping swipe!)
                  const maxFreq = 20000;
                  const minFreq = 150;
                  const targetCutoff = Math.round(maxFreq - (modVal * (maxFreq - minFreq)));
                  ctx.lowpass.frequency.rampTo(Math.max(minFreq, Math.min(maxFreq, targetCutoff)), 0.05);
                } else if (targetParam === 'reverb' && ctx.reverb) {
                  // Boost reverb wet amount directly in tandem with sound peaks
                  ctx.reverb.wet.rampTo(modVal, 0.05);
                } else if (targetParam === 'volume' && ctx.channel) {
                  // Duck volume relative to peak input (custom sidechain pumping effect)
                  const baseVol = track.volume ?? 0;
                  const duckAmountDb = modVal * -24; // duck up to -24dB at max peaks
                  ctx.channel.volume.setValueAtTime(baseVol + duckAmountDb, time);
                }
              }
            }
          });
        }
      }, "16n");

      this.setupStoreSubscription();
      this.isInitialized = true;

      const state = useDawStore.getState();
      this.syncToneWithState(state);
    })();

    return this.initPromise;
  }

  async toggleMicMonitor(enable: boolean) {
    if (!this.isInitialized) await this.init();
    await this.syncAudioInputsWithTracks();
  }

  public routeMicToSelectedTrack(monitorEnabled: boolean) {
    // Left as compatibility wrapper
    this.syncAudioInputsWithTracks();
  }

  public async syncAudioInputsWithTracks() {
    if (!this.isInitialized) return;
    const state = useDawStore.getState();
    
    for (const track of state.tracks) {
      if (track.type !== "audio") continue;
      
      let ctx = this.trackContexts.get(track.id);
      if (!ctx) continue;

      // Determine the target device ID
      const targetDeviceId = track.audioInputId || state.selectedAudioInputId || "default";
      const currentStreamId = (ctx as any).currentDeviceId;
      
      if (!ctx.micStream || currentStreamId !== targetDeviceId || !ctx.recorder) {
        // Stop and cleanup previous
        if (ctx.micNode) {
          try { ctx.micNode.disconnect(); } catch (e) {}
        }
        if (ctx.inputGain) {
          try { ctx.inputGain.dispose(); } catch (e) {}
        }
        if (ctx.inputLimiter) {
          try { ctx.inputLimiter.dispose(); } catch (e) {}
        }
        if (ctx.recorder) {
          try { ctx.recorder.dispose(); } catch (e) {}
        }
        if (ctx.micStream) {
          ctx.micStream.getTracks().forEach(t => t.stop());
        }

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
              audio: targetDeviceId === "default"
                ? {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                  }
                : {
                    deviceId: { exact: targetDeviceId },
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                  }
            });
          
          ctx.micStream = stream;
          (ctx as any).currentDeviceId = targetDeviceId;
          
          ctx.inputGain = new Tone.Gain(1.0); // Unity gain — let user control level via track fader
          ctx.micNode = new Tone.Gain(1);
          
          const rawContext = Tone.getContext().rawContext as any;
          const sourceNode = rawContext.createMediaStreamSource(stream);
          sourceNode.connect((ctx.inputGain as any).input);
          ctx.inputGain.connect(ctx.micNode.input);
          
          ctx.recorder = new Tone.Recorder();
          ctx.micNode.connect(ctx.recorder);
          if (ctx.meter) {
             ctx.micNode.connect(ctx.meter);
          }
        } catch (err) {
          console.error(`Failed to setup inputs for track ${track.name}:`, err);
        }
      }
      
      // Control monitoring: Only route to channel FX chains if this track is selected AND input monitoring is on
      if (ctx.micNode) {
        try {
          ctx.micNode.disconnect();
          ctx.micNode.connect(ctx.recorder!);
          if (ctx.meter) {
            ctx.micNode.connect(ctx.meter);
          }
        } catch (e) {}

        const isSelected = state.selectedTrackId === track.id;
        if (isSelected && state.inputMonitoring) {
          ctx.micNode.connect(ctx.eq);
        }
      }
    }
  }

  public getTrackLevel(trackId: string): number {
    const state = useDawStore.getState();
    const track = state.tracks.find(t => t.id === trackId);
    if (!track) return 0;

    const ctx = this.trackContexts.get(trackId);
    let level = -100;

    if (ctx && ctx.meter) {
      const val = ctx.meter.getValue();
      const trackLevel = Array.isArray(val) ? val[0] : (val as number);
      level = Math.max(level, trackLevel);
    }

    // Convert dB (-60 to 0) to normalized 0-1 range
    if (level === -Infinity || level < -60) return 0;
    const minDb = -60;
    const normalized = Math.max(0, (level - minDb) / -minDb);
    return Math.min(1.0, normalized);
  }

  public recordMidiNoteStart(trackId: string, noteName: string, velocity: number) {
    const state = useDawStore.getState();
    const currentTicks = Tone.Transport.state === 'started' ? Tone.Transport.ticks : (state.transportPosition * 48);
    const current16ths = currentTicks / 48;

    const trackClips = Object.values(state.clips).filter(c => c.trackId === trackId);
    let activeClip = trackClips.find(c => current16ths >= c.startTime && current16ths <= c.startTime + (c.duration || 32));

    const quantize = (val: number) => {
       if (!state.autoQuantize) return val;
       const strength = state.quantizeStrength / 100;
       const nearest16th = Math.round(val);
       return val + (nearest16th - val) * strength;
    };

    const noteId = `n_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    if (!activeClip) {
       const clipStartTime = Math.floor(current16ths / 16) * 16;
       const relativeStart = Math.max(0, current16ths - clipStartTime);
       const startToRecord = quantize(relativeStart);
       const startGlobalToRecord = clipStartTime + startToRecord;

       const newNote = {
         id: noteId,
         note: noteName,
         startTime: startToRecord,
         duration: 0.1,
         velocity,
         isRecording: true
       };

       const newClipId = state.addClip(trackId, clipStartTime);
       
       if (!this.activeMidiRecordings.has(trackId)) {
         this.activeMidiRecordings.set(trackId, new Map());
       }
       this.activeMidiRecordings.get(trackId)!.set(noteName, { clipId: newClipId, noteId, start16ths: startGlobalToRecord });

       setTimeout(() => {
          const stateSync = useDawStore.getState();
          stateSync.updateClip(newClipId, { notes: [newNote] });
       }, 50);
    } else {
       const relativeStart = Math.max(0, current16ths - activeClip.startTime);
       const startToRecord = quantize(relativeStart);
       const startGlobalToRecord = activeClip.startTime + startToRecord;

       const newNote = {
         id: noteId,
         note: noteName,
         startTime: startToRecord,
         duration: 0.1,
         velocity,
         isRecording: true
       };

       if (!this.activeMidiRecordings.has(trackId)) {
         this.activeMidiRecordings.set(trackId, new Map());
       }
       this.activeMidiRecordings.get(trackId)!.set(noteName, { clipId: activeClip.id, noteId, start16ths: startGlobalToRecord });
       
       state.updateClip(activeClip.id, { notes: [...(activeClip.notes || []), newNote] });
    }
  }

  public recordMidiNoteEnd(trackId: string, noteName: string) {
    const trackRecordings = this.activeMidiRecordings.get(trackId);
    if (!trackRecordings) return;

    const rec = trackRecordings.get(noteName);
    if (!rec) return;

    trackRecordings.delete(noteName);

    const state = useDawStore.getState();
    const clip = state.clips[rec.clipId];
    if (!clip) return;

    const currentTicks = Tone.Transport.state === 'started' ? Tone.Transport.ticks : (state.transportPosition * 48);
    const current16ths = currentTicks / 48;
    const duration = Math.max(0.25, current16ths - rec.start16ths);

    const updatedNotes = (clip.notes || []).map(n => {
       if (n.id === rec.noteId) {
          return { ...n, duration, isRecording: false };
       }
       return n;
    });

    state.updateClip(clip.id, { notes: updatedNotes });
  }

  async startRecording() {
    if (!this.isInitialized) await this.init();
    await this.syncAudioInputsWithTracks();

    const state = useDawStore.getState();
    const activeAudioTracks = state.tracks.filter(t => t.type === 'audio' && (t.armed || t.id === state.selectedTrackId));

    for (const track of activeAudioTracks) {
        let ctx = this.trackContexts.get(track.id);
        if (ctx && ctx.recorder) {
            try {
               ctx.recorder.start();
               ctx.liveRecordingPeaks = [];
               ctx.liveRecordingSegments = [];
               (ctx as any).isVoiceActive = false;
               (ctx as any).voiceStartIdx = 0;
            } catch(e){}
        }
    }

    this.recordingStartTimeCtx = Tone.context.currentTime;
    this.recordingStartTicks =
      Tone.Transport.state === "started"
        ? Tone.Transport.ticks
        : useDawStore.getState().transportPosition * 48;
    
    if (this.recordingInterval) clearInterval(this.recordingInterval);
    this.recordingInterval = setInterval(() => {
      activeAudioTracks.forEach(track => {
        let ctx = this.trackContexts.get(track.id);
        if (!ctx || !ctx.meter) return;

        let level = Array.isArray(ctx.meter.getValue())
          ? ctx.meter.getValue()[0]
          : (ctx.meter.getValue() as number);
        const minDb = -60;
        const normalized = Math.max(0, (level - minDb) / -minDb);
        const peaks = ctx.liveRecordingPeaks || [];
        peaks.push(normalized);
        ctx.liveRecordingPeaks = peaks;
        
        let isVoiceActive = (ctx as any).isVoiceActive || false;
        let voiceStartIdx = (ctx as any).voiceStartIdx || 0;

        if (normalized > 0.05) {
          if (!isVoiceActive) {
            isVoiceActive = true;
            voiceStartIdx = peaks.length - 1;
            (ctx as any).isVoiceActive = isVoiceActive;
            (ctx as any).voiceStartIdx = voiceStartIdx;
          }
        } else {
          if (isVoiceActive) {
             let silenceCount = 0;
             for(let i = peaks.length - 1; i >= Math.max(0, peaks.length - 10); i--) {
                if (peaks[i] <= 0.05) silenceCount++;
             }
             if (silenceCount >= 10) {
                isVoiceActive = false;
                (ctx as any).isVoiceActive = false;
                const bpm = useDawStore.getState().bpm;
                const samplesPer16th = (15 / bpm) / 0.05; 
                
                if (!ctx.liveRecordingSegments) ctx.liveRecordingSegments = [];
                ctx.liveRecordingSegments.push({
                   start16thsOffset: voiceStartIdx / samplesPer16th,
                   duration16ths: (peaks.length - voiceStartIdx) / samplesPer16th,
                   peaks: peaks.slice(voiceStartIdx),
                   audioOffset16ths: voiceStartIdx / samplesPer16th
                });
             }
          }
        }
      });
    }, 50); // Every 50ms
  }

  async stopRecording(): Promise<{ trackId: string, url: string, peaks: number[], start16ths: number, duration16ths: number, segments?: any[] }[]> {
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }

    const recordingEndTimeCtx = Tone.context.currentTime;
    const ctx = Tone.context.rawContext as AudioContext;
    const latencySecs = (ctx.baseLatency || 0) + (ctx.outputLatency || 0);
    const state = useDawStore.getState();
    const latency16ths = latencySecs * (state.bpm / 15);

    const durationSecs = recordingEndTimeCtx - this.recordingStartTimeCtx;
    const computedDuration16ths = (durationSecs / 60) * state.bpm * 4;

    const start16ths = Math.max(
      0,
      this.recordingStartTicks / 48 - latency16ths,
    );
    const duration16ths = Math.max(
      1,
      computedDuration16ths,
    );

    const armedAudioTracks = state.tracks.filter(t => t.type === 'audio' && (t.armed || t.id === state.selectedTrackId));
    let results: any[] = [];

    for (const track of armedAudioTracks) {
        let trackCtx = this.trackContexts.get(track.id);
        if (!trackCtx || !trackCtx.recorder || trackCtx.recorder.state !== "started") continue;

        try {
           const recording = await trackCtx.recorder.stop();
           const url = URL.createObjectURL(recording);
           const peaks = [...(trackCtx.liveRecordingPeaks || [])];
           
           const totalPeaks = Math.max(1, peaks.length);
           const sixteenthsPerPeak = duration16ths / totalPeaks;
           const oldSamplesPer16th = (15 / state.bpm) / 0.05;

            const segments = [{
               start16thsOffset: 0,
               duration16ths: duration16ths,
               peaks: peaks,
               audioOffset16ths: 0
            }];

            results.push({ trackId: track.id, url, peaks, start16ths, duration16ths, segments });
        } catch(e) {
           console.error("Failed to stop recorder on track", track.id, e);
        }
    }

    return results;
  }

  private setupStoreSubscription() {
    this.unsubscribe = useDawStore.subscribe((state, prevState) => {
      // WakeLock: acquire while playing or recording, release when idle.
      const isActive = state.playbackState === 'playing' || state.isRecording;
      const wasActive = prevState.playbackState === 'playing' || prevState.isRecording;
      if (isActive && !wasActive) this._acquireWakeLock();
      if (!isActive && wasActive) this._releaseWakeLock();

      // Handle Master Volume changes
      if (state.masterVolume !== prevState.masterVolume) {
        // rampTo avoids the click/zipper artifact on live master-fader moves
        this.masterHeadroom.volume.rampTo(state.masterVolume - 6, 0.01);
      }

      // Handle audio input change
      if (state.selectedAudioInputId !== prevState.selectedAudioInputId) {
        this.getMediaStream(
          false,
          false,
          state.selectedAudioInputId || undefined,
        );
      }
      
      if (state.selectedAudioOutputId !== prevState.selectedAudioOutputId) {
        const rawCtx = Tone.getContext().rawContext as any;
        if (typeof rawCtx.setSinkId === "function") {
          rawCtx.setSinkId(state.selectedAudioOutputId || "").catch((e: Error) => {
             console.warn("Audio output routing failed:", e);
          });
        }
      }

      if (state.selectedTrackId !== prevState.selectedTrackId) {
         this.routeMicToSelectedTrack(state.inputMonitoring);
      }

      if (state.inputMonitoring !== prevState.inputMonitoring) {
         this.toggleMicMonitor(state.inputMonitoring);
      }
      
      if (state.autotuneEnabled !== prevState.autotuneEnabled) {
         if (this.vocalPipeline) {
            this.vocalPipeline.autotuneEnabled = state.autotuneEnabled;
         }
      }
      
      if (state.projectKey !== prevState.projectKey || state.projectScale !== prevState.projectScale) {
         if (this.vocalPipeline) {
            this.vocalPipeline.setScale(state.projectKey, state.projectScale);
         }
      }

      // If only transportPosition changed, don't resync the entire Tone.js graph
      const onlyPositionChanged =
        state.transportPosition !== prevState.transportPosition &&
        state.playbackState === prevState.playbackState &&
        state.bpm === prevState.bpm &&
        state.tracks === prevState.tracks &&
        state.clips === prevState.clips &&
        state.metronomeEnabled === prevState.metronomeEnabled;

      if (onlyPositionChanged) return;

      this.syncToneWithState(state, prevState);
    });
  }

  private createSynth(type: SynthType): any {
    if (type === "membrane") {
      return new ReferenceDrumKitSynth();
    }
    if (type === "pluck") {
      const p = new Tone.PolySynth(Tone.Synth, {
        volume: -12,
        oscillator: { type: "triangle" },
        envelope: { attack: 0.001, decay: 0.3, sustain: 0.1, release: 0.5 },
      });
      p.maxPolyphony = 8;
      return p;
    }

    let synthProps: any = {
      volume: -14,
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 1.5, sustain: 0.2, release: 1.5 },
    };

    let voice: any = Tone.Synth;

    switch (type) {
      case "fm":
        voice = Tone.FMSynth;
        synthProps = {
          volume: -14,
          modulationIndex: 12.22,
          envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.2 },
          modulation: { type: "square" },
          modulationEnvelope: {
            attack: 0.01,
            decay: 0.2,
            sustain: 0.3,
            release: 0.2,
          },
        };
        break;
      case "am":
        voice = Tone.AMSynth;
        synthProps = {
          volume: -14,
          harmonicity: 3,
          detune: 0,
          oscillator: { type: "sine" },
          envelope: { attack: 0.1, decay: 0.2, sustain: 1.0, release: 0.2 },
          modulation: { type: "square" },
          modulationEnvelope: {
            attack: 0.5,
            decay: 0,
            sustain: 1.0,
            release: 0.2,
          },
        };
        break;
      case "flute":
        voice = Tone.FMSynth;
        synthProps = {
          volume: -12,
          harmonicity: 2,
          modulationIndex: 2,
          oscillator: { type: "sine" },
          envelope: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 0.4 },
          modulation: { type: "triangle" },
          modulationEnvelope: { attack: 0.1, decay: 0.1, sustain: 1, release: 0.4 },
        };
        break;
      case "epiano":
        voice = Tone.FMSynth;
        synthProps = {
          volume: -10,
          harmonicity: 3,
          modulationIndex: 5,
          oscillator: { type: "triangle" },
          envelope: { attack: 0.01, decay: 1.5, sustain: 0.1, release: 1.2 },
          modulation: { type: "sine" },
          modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0.1, release: 0.5 },
        };
        break;
      case "grand":
        voice = Tone.Synth;
        synthProps = {
          volume: -10,
          oscillator: { type: "triangle" },
          envelope: { attack: 0.005, decay: 2.0, sustain: 0.1, release: 1.5 },
        };
        break;
      case "organ":
        voice = Tone.FMSynth;
        synthProps = {
          volume: -12,
          harmonicity: 1,
          modulationIndex: 1.5,
          oscillator: { type: "sine" },
          envelope: { attack: 0.05, decay: 0.1, sustain: 1.0, release: 0.2 },
          modulation: { type: "square" },
          modulationEnvelope: { attack: 0.05, decay: 0.1, sustain: 1.0, release: 0.2 },
        };
        break;
      case "rhodes":
        voice = Tone.FMSynth;
        synthProps = {
          volume: -10,
          harmonicity: 4,
          modulationIndex: 3,
          oscillator: { type: "sine" },
          envelope: { attack: 0.01, decay: 2.5, sustain: 0.2, release: 1.5 },
          modulation: { type: "sine" },
          modulationEnvelope: { attack: 0.01, decay: 2.0, sustain: 0.1, release: 1.0 },
        };
        break;
      case "synthbass":
        voice = Tone.FMSynth;
        synthProps = {
          volume: -8,
          harmonicity: 1,
          modulationIndex: 5,
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.02, decay: 0.3, sustain: 0.4, release: 0.8 },
          modulation: { type: "square" },
          modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.4 },
        };
        break;
      case "pad":
        voice = Tone.Synth;
        synthProps = {
          volume: -16,
          oscillator: { type: "sine" },
          envelope: { attack: 1.5, decay: 1.0, sustain: 0.8, release: 3.0 },
        };
        break;
      case "leadsynth":
        voice = Tone.Synth;
        synthProps = {
          volume: -12,
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.05, decay: 0.2, sustain: 0.4, release: 0.5 },
        };
        break;
      case "strings":
        voice = Tone.Synth;
        synthProps = {
          volume: -14,
          oscillator: { type: "triangle" },
          envelope: { attack: 0.8, decay: 0.5, sustain: 0.8, release: 2.0 },
        };
        break;
      case "brass":
        voice = Tone.FMSynth;
        synthProps = {
          volume: -12,
          harmonicity: 1.5,
          modulationIndex: 2,
          oscillator: { type: "sawtooth" },
          envelope: { attack: 0.1, decay: 0.2, sustain: 0.7, release: 0.5 },
          modulation: { type: "sine" },
          modulationEnvelope: { attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.4 },
        };
        break;
      case "bells":
        voice = Tone.FMSynth;
        synthProps = {
          volume: -14,
          harmonicity: 2.1,
          modulationIndex: 10,
          oscillator: { type: "sine" },
          envelope: { attack: 0.01, decay: 1.5, sustain: 0.0, release: 2.0 },
          modulation: { type: "sine" },
          modulationEnvelope: { attack: 0.01, decay: 1.0, sustain: 0.0, release: 1.5 },
        };
        break;
      case "poly":
      default:
        // Use a classic electric piano style FM synthesis for poly
        voice = Tone.FMSynth;
        synthProps = {
          volume: -14,
          harmonicity: 3.01,
          modulationIndex: 14,
          oscillator: { type: "triangle" },
          envelope: { attack: 0.005, decay: 1.5, sustain: 0.2, release: 2.5 },
          modulation: { type: "square" },
          modulationEnvelope: {
            attack: 0.005,
            decay: 0.8,
            sustain: 0.1,
            release: 1.5,
          },
        };
        break;
    }
    // Sustained pads/strings/brass can hold many notes simultaneously; a cap of
    // 8 voices means 8× peak summing which overloads the limiter.  Use 4–6 voices
    // for those instruments and lean on oldest-voice stealing for the rest.
    const padTypes: SynthType[] = ['pad', 'strings', 'brass', 'rhodes', 'organ'];
    const maxPolyphony = padTypes.includes(type) ? 4 : 6;
    return new Tone.PolySynth(
      voice,
      Object.assign({}, synthProps, { maxPolyphony }),
    );
  }

  private createTrackContext(track: DawTrack): TrackContext {
    const channel = new Tone.Channel().connect(this.masterHeadroom);
    const eq = new Tone.EQ3();
    const compressor = new Tone.Compressor();
    const pitchShift = new Tone.PitchShift({ windowSize: 0.12, wet: 0 });
    const chorus = new Tone.Chorus({ frequency: 1.5, delayTime: 2.5, depth: 0.5, wet: 0 });
    const delay = new Tone.FeedbackDelay({ wet: 0 });
    const reverb = new Tone.Freeverb({ roomSize: 0.7, dampening: 3000, wet: 0 });
    const meter = new Tone.Meter();

    // New premium and standard effect nodes
    const distortion = new Tone.Distortion({ distortion: 0.4, wet: 0 });
    const phaser = new Tone.Phaser({ frequency: 1.5, wet: 0 });
    const tremolo = new Tone.Tremolo({ frequency: 5, depth: 0.5, wet: 0 }).start();
    const gate = new Tone.Gate({ threshold: -40 });
    const highpass = new Tone.Filter({ type: "highpass", frequency: 200 });
    const lowpass = new Tone.Filter({ type: "lowpass", frequency: 2000 });
    const bandpass = new Tone.Filter({ type: "bandpass", frequency: 1000 });
    
    // BitCrusher instantiation matching Tone.js types
    const bitcrusher = new Tone.BitCrusher(8);
    bitcrusher.wet.value = 0;
    
    const pingPongDelay = new Tone.PingPongDelay({ delayTime: "4n", feedback: 0.3, wet: 0 });
    const voicePitcher = new Tone.PitchShift({ windowSize: 0.12, wet: 0 });

    const freqs = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
    const graphicEQFilters = freqs.map(freq => new Tone.Filter({
      type: "peaking",
      frequency: freq,
      Q: 1.4,
      gain: 0
    }));

    // Series connect graphic EQ peaking filters
    for (let i = 0; i < graphicEQFilters.length - 1; i++) {
      graphicEQFilters[i].connect(graphicEQFilters[i+1]);
    }
    // Connect the last EQ band to standard eq
    graphicEQFilters[graphicEQFilters.length - 1].connect(eq);

    // Setup base chain
    eq.connect(compressor);
    compressor.connect(channel);
    channel.connect(meter);

    // Send nodes to shared return buses — start at gain 0 (dry).
    // syncToneWithState drives them via rampTo based on the track FX settings.
    const reverbSend = new Tone.Gain(0);
    reverbSend.connect(this.sharedReverb);
    channel.connect(reverbSend);

    const delaySend = new Tone.Gain(0);
    delaySend.connect(this.sharedDelay);
    channel.connect(delaySend);

    const ctx: TrackContext = {
      channel,
      eq,
      compressor,
      pitchShift,
      chorus,
      delay,
      reverb,
      reverbSend,
      delaySend,
      players: new Map(),
      synthType: track.synthType,
      meter,
      distortion,
      phaser,
      tremolo,
      gate,
      highpass,
      lowpass,
      bandpass,
      bitcrusher,
      pingPongDelay,
      voicePitcher,
      graphicEQFilters,
    };

    if (track.type === "midi") {
      ctx.synth = this.createSynth(track.synthType);
      ctx.synth.connect(graphicEQFilters[0]); // Connect to start of peaking series
    }

    return ctx;
  }

  private syncToneWithState(
    state: ReturnType<typeof useDawStore.getState>,
    prevState?: ReturnType<typeof useDawStore.getState>,
  ) {
    Tone.Transport.bpm.value = state.bpm;
    Tone.Transport.loop = !state.isRecording;

    if (state.isRecording) {
      Tone.Transport.loopEnd = "9999m";
    }

    if (
      state.playbackState === "playing" &&
      Tone.Transport.state !== "started"
    ) {
      // Tighten lookahead for timeline playback — 50 ms is enough scheduling buffer
      // without the 100 ms lag that the old fixed value imposed.
      Tone.getContext().lookAhead = 0.05;
      Tone.Transport.start("+0.05");
    } else if (
      state.playbackState === "paused" &&
      Tone.Transport.state === "started"
    ) {
      Tone.Transport.pause();
      this.trackContexts.forEach((ctx) => this.hardStopAudioPlayers(ctx));
    } else if (
      state.playbackState === "stopped" &&
      Tone.Transport.state !== "stopped"
    ) {
      // Tighten lookahead when stopped so live pads/MIDI feel immediate.
      Tone.getContext().lookAhead = 0.01;
      Tone.Transport.stop();
      this.releaseAllNotes();
    }

    if (state.metronomeEnabled && !this.metronomePart) {
      this.metronomePart = new Tone.Loop((time) => {
        try {
          // Transport position is typically "bars:beats:sixteenths", e.g., "0:0:0"
          const positionParts = Tone.Transport.position.toString().split(":");
          const isDownbeat = positionParts[1] === "0";
          const pitch = isDownbeat ? "C6" : "C5";
          const velocity = isDownbeat ? 1 : 0.5;
          this.metronomeSynth.triggerAttackRelease(
            pitch,
            "32n",
            time,
            velocity,
          );
        } catch (e) {
          console.warn("Metronome scheduling issue:", e);
        }
      }, "4n").start(0);
    } else if (!state.metronomeEnabled && this.metronomePart) {
      this.metronomePart.stop();
      this.metronomePart.dispose();
      this.metronomePart = null;
    }

    // Only rebuild tracks and context if tracks, clips, bpm, or recording state changed.
    // isRecording must be included: when recording stops the loopEnd reset lives
    // below this guard, and skipping it would leave loopEnd stuck at "9999m".
    if (
      prevState &&
      state.tracks === prevState.tracks &&
      state.clips === prevState.clips &&
      state.bpm === prevState.bpm &&
      state.isRecording === prevState.isRecording
    ) {
      return;
    }

    // Calculate total duration in 16ths
    let max16ths = 16; // Minimum 1 bar
    Object.values(state.clips).forEach((clip) => {
      const end = clip.startTime + clip.duration;
      if (end > max16ths) max16ths = end;
    });

    // Convert 16ths to measures for Tone.js
    // 16 16ths = 1m
    const bars = Math.ceil(max16ths / 16);
    // Let's add 1 bar for safety tail
    if (!state.isRecording) {
      Tone.Transport.loopEnd = `${bars + 1}m`;
    }

    // Sync Tracks
    const currentTrackIds = new Set(state.tracks.map((t) => t.id));

    // Remove deleted tracks
    for (const [id, ctx] of this.trackContexts.entries()) {
      if (!currentTrackIds.has(id)) {
        ctx.synth?.dispose();
        ctx.eq.dispose();
        ctx.compressor.dispose();
        ctx.pitchShift.dispose();
        ctx.chorus.dispose();
        ctx.delay.dispose();
        ctx.reverb.dispose();
        ctx.channel.dispose();
        ctx.players.forEach((p) => p.dispose());
        this.trackContexts.delete(id);
      }
    }

    state.tracks.forEach((track) => {
      let ctx = this.trackContexts.get(track.id);

      if (ctx) {
        // Check if synthType changed, recreate synth
        const needsRecreate = track.type === "midi" && ctx.synthType !== track.synthType;
        if (needsRecreate) {
          ctx.synth?.dispose();
          ctx.synth = this.createSynth(track.synthType || "poly") as any;
          ctx.synthType = track.synthType;
          if (ctx.graphicEQFilters && ctx.graphicEQFilters.length > 0) {
            ctx.synth?.connect(ctx.graphicEQFilters[0]);
          } else {
            ctx.synth?.connect(ctx.eq);
          }
        }
      }

      if (!ctx) {
        ctx = this.createTrackContext(track);
        this.trackContexts.set(track.id, ctx);
      }

      // Update FX and Channel — use rampTo to avoid zipper/click noise during live playback
      ctx.channel.volume.rampTo(track.volume ?? 0, 0.01);
      ctx.channel.pan.rampTo(track.pan ?? 0, 0.01);
      ctx.channel.mute = !!track.muted;
      ctx.channel.solo = !!track.soloed;

      // Update synth portamento (glide/slide)
      if (ctx.synth) {
        try {
          if ('set' in ctx.synth) {
            ctx.synth.set({ portamento: track.portamento ?? 0 });
          }
          (ctx.synth as any).portamento = track.portamento ?? 0;
        } catch (portErr) {
          console.warn("Could not sync synth portamento:", portErr);
        }
      }

      if (track.fx?.eq?.enabled) {
        ctx.eq.high.value = track.fx.eq.high ?? 0;
        ctx.eq.mid.value = track.fx.eq.mid ?? 0;
        ctx.eq.low.value = track.fx.eq.low ?? 0;
      } else {
        ctx.eq.high.value = 0;
        ctx.eq.mid.value = 0;
        ctx.eq.low.value = 0;
      }

      ctx.compressor.threshold.value = track.fx?.compressor?.enabled
        ? (track.fx.compressor.threshold ?? -24)
        : 0;
      ctx.compressor.ratio.value = track.fx?.compressor?.enabled
        ? (track.fx.compressor.ratio ?? 12)
        : 1;
      ctx.compressor.attack.value = track.fx?.compressor?.enabled
        ? (track.fx.compressor.attack ?? 0.003)
        : 0.003;
      ctx.compressor.release.value = track.fx?.compressor?.enabled
        ? (track.fx.compressor.release ?? 0.25)
        : 0.25;
      ctx.pitchShift.pitch = track.fx?.pitchShift?.enabled
        ? (track.fx.pitchShift.pitch ?? 0)
        : 0;
      ctx.pitchShift.wet.rampTo(track.fx?.pitchShift?.enabled ? 1 : 0, 0.01);

      ctx.chorus.depth.value = track.fx?.chorus?.depth ?? 0.5;
      ctx.chorus.frequency.value = track.fx?.chorus?.frequency ?? 1.5;
      ctx.chorus.delayTime = track.fx?.chorus?.delayTime ?? 2.5;
      ctx.chorus.wet.rampTo(track.fx?.chorus?.enabled
        ? (track.fx.chorus.wet ?? 0.5)
        : 0, 0.01);

      // Route through shared return buses via send-level gain nodes.
      // The per-track delay/reverb instances are kept as fallback but their wet
      // stays 0 — all signal flows through the shared buses.
      if (ctx.delaySend) {
        ctx.delaySend.gain.rampTo(track.fx?.delay?.enabled
          ? (track.fx.delay.mix ?? 0.2)
          : 0, 0.01);
      }
      if (track.fx?.delay) {
        this.sharedDelay.feedback.rampTo(Math.min(0.95, track.fx.delay.feedback ?? 0.3), 0.01);
        try { this.sharedDelay.delayTime.value = track.fx.delay.time ?? '8n'; } catch (_) {}
      }
      if (ctx.reverbSend) {
        ctx.reverbSend.gain.rampTo(track.fx?.reverb?.enabled
          ? (track.fx.reverb.mix ?? 0.3)
          : 0, 0.01);
      }
      // Sync roomSize from decay slider (0.1–10s → 0.01–0.98 normalised)
      if (track.fx?.reverb) {
        ctx.reverb.roomSize.rampTo(Math.min(0.98, (track.fx.reverb.decay ?? 1.5) / 10.2), 0.01);
      }

      // Update Graphic EQ
      if (ctx.graphicEQFilters && track.fx?.graphicEQ) {
        const bands = [
          track.fx.graphicEQ.band1 ?? 0,
          track.fx.graphicEQ.band2 ?? 0,
          track.fx.graphicEQ.band3 ?? 0,
          track.fx.graphicEQ.band4 ?? 0,
          track.fx.graphicEQ.band5 ?? 0,
          track.fx.graphicEQ.band6 ?? 0,
          track.fx.graphicEQ.band7 ?? 0,
          track.fx.graphicEQ.band8 ?? 0,
          track.fx.graphicEQ.band9 ?? 0,
          track.fx.graphicEQ.band10 ?? 0,
        ];
        ctx.graphicEQFilters.forEach((filter, idx) => {
          filter.gain.value = track.fx?.graphicEQ?.enabled ? (bands[idx] ?? 0) : 0;
        });
      }

      // Update gate threshold
      if (ctx.gate && track.fx?.gate) {
        ctx.gate.threshold = track.fx.gate.enabled ? (track.fx.gate.threshold ?? -40) : -100;
      }

      // Update HPF / LPF / BPF filter frequencies
      if (ctx.highpass && track.fx?.highpass) {
        ctx.highpass.frequency.value = track.fx.highpass.frequency ?? 200;
        ctx.highpass.Q.value = track.fx.highpass.Q ?? 1;
      }
      if (ctx.lowpass && track.fx?.lowpass) {
        ctx.lowpass.frequency.value = track.fx.lowpass.frequency ?? 2000;
        ctx.lowpass.Q.value = track.fx.lowpass.Q ?? 1;
      }
      if (ctx.bandpass && track.fx?.bandpass) {
        ctx.bandpass.frequency.value = track.fx.bandpass.frequency ?? 1000;
        ctx.bandpass.Q.value = track.fx.bandpass.Q ?? 1;
      }

      // Update Distortion
      if (ctx.distortion && track.fx?.distortion) {
        ctx.distortion.distortion = track.fx.distortion.amount ?? 0.4;
        ctx.distortion.wet.value = track.fx.distortion.enabled ? (track.fx.distortion.wet ?? 0.5) : 0;
      }

      // Update Bitcrusher — bits is a plain number property in Tone.js v15
      if (ctx.bitcrusher && track.fx?.bitcrusher) {
        ctx.bitcrusher.wet.value = track.fx.bitcrusher.enabled ? (track.fx.bitcrusher.wet ?? 0.5) : 0;
        ctx.bitcrusher.bits = track.fx.bitcrusher.bits ?? 8;
      }

      // Update Phaser — octaves controls sweep depth (Tone.Phaser has no .Q)
      if (ctx.phaser && track.fx?.phaser) {
        ctx.phaser.frequency.value = track.fx.phaser.frequency ?? 1.5;
        ctx.phaser.octaves = (track.fx.phaser.depth ?? 0.5) * 6;
        ctx.phaser.wet.value = track.fx.phaser.enabled ? (track.fx.phaser.wet ?? 0.5) : 0;
      }

      // Update Tremolo
      if (ctx.tremolo && track.fx?.tremolo) {
        ctx.tremolo.frequency.value = track.fx.tremolo.frequency ?? 5;
        ctx.tremolo.depth.value = track.fx.tremolo.depth ?? 0.5;
        ctx.tremolo.wet.value = track.fx.tremolo.enabled ? (track.fx.tremolo.wet ?? 0.5) : 0;
      }

      // Update Ping Pong Delay
      if (ctx.pingPongDelay && track.fx?.pingPongDelay) {
        ctx.pingPongDelay.feedback.value = track.fx.pingPongDelay.feedback ?? 0.3;
        ctx.pingPongDelay.delayTime.value = track.fx.pingPongDelay.time as any ?? "4n";
        ctx.pingPongDelay.wet.value = track.fx.pingPongDelay.enabled ? (track.fx.pingPongDelay.wet ?? 0.4) : 0;
      }

      // Update Voice Pitcher
      if (ctx.voicePitcher && track.fx?.voicePitcher) {
        ctx.voicePitcher.pitch = track.fx.voicePitcher.shift ?? 0;
        ctx.voicePitcher.wet.value = track.fx.voicePitcher.enabled ? (track.fx.voicePitcher.wet ?? 0.5) : 0;
      }

      // Dynamic CPU-saving routing (rebuilds chain only if FX toggle state changes)
      const fxChain: any[] = [ctx.eq, ctx.compressor];
      if (track.fx?.gate?.enabled && ctx.gate) fxChain.push(ctx.gate);
      if (track.fx?.highpass?.enabled && ctx.highpass) fxChain.push(ctx.highpass);
      if (track.fx?.lowpass?.enabled && ctx.lowpass) fxChain.push(ctx.lowpass);
      if (track.fx?.bandpass?.enabled && ctx.bandpass) fxChain.push(ctx.bandpass);
      if (track.fx?.distortion?.enabled && ctx.distortion) fxChain.push(ctx.distortion);
      if (track.fx?.bitcrusher?.enabled && ctx.bitcrusher) fxChain.push(ctx.bitcrusher);
      if (track.fx?.pitchShift?.enabled) fxChain.push(ctx.pitchShift);
      if (track.fx?.voicePitcher?.enabled && ctx.voicePitcher) fxChain.push(ctx.voicePitcher);
      if (track.fx?.phaser?.enabled && ctx.phaser) fxChain.push(ctx.phaser);
      if (track.fx?.tremolo?.enabled && ctx.tremolo) fxChain.push(ctx.tremolo);
      if (track.fx?.chorus?.enabled) fxChain.push(ctx.chorus);
      if (track.fx?.delay?.enabled) fxChain.push(ctx.delay);
      if (track.fx?.pingPongDelay?.enabled && ctx.pingPongDelay) fxChain.push(ctx.pingPongDelay);
      if (track.fx?.reverb?.enabled) fxChain.push(ctx.reverb);
      fxChain.push(ctx.channel);

      const chainStr = fxChain.map((n: any) => n.name).join("->");
      if (ctx.currentChainStr !== chainStr) {
        ctx.currentChainStr = chainStr;
        ctx.eq.disconnect();
        ctx.compressor.disconnect();
        ctx.pitchShift.disconnect();
        ctx.chorus.disconnect();
        ctx.delay.disconnect();
        ctx.reverb.disconnect();
        if (ctx.distortion) ctx.distortion.disconnect();
        if (ctx.phaser) ctx.phaser.disconnect();
        if (ctx.tremolo) ctx.tremolo.disconnect();
        if (ctx.gate) ctx.gate.disconnect();
        if (ctx.highpass) ctx.highpass.disconnect();
        if (ctx.lowpass) ctx.lowpass.disconnect();
        if (ctx.bandpass) ctx.bandpass.disconnect();
        if (ctx.bitcrusher) ctx.bitcrusher.disconnect();
        if (ctx.pingPongDelay) ctx.pingPongDelay.disconnect();
        if (ctx.voicePitcher) ctx.voicePitcher.disconnect();

        for (let i = 0; i < fxChain.length - 1; i++) {
          fxChain[i].connect(fxChain[i + 1]);
        }
      }

      // Routing for Track Grouping (only disconnect/connect when group changes to avoid dropouts)
      const prevGroupId = prevState?.tracks.find((t) => t.id === track.id)?.groupId;
      if (prevGroupId !== track.groupId || !ctx.currentChainStr) {
        ctx.channel.disconnect();
        const parentGroup = track.groupId && track.groupId !== track.id 
          ? state.tracks.find(t => t.id === track.groupId) 
          : null;
        const groupCtx = parentGroup && parentGroup.type === 'group' 
          ? this.trackContexts.get(parentGroup.id) 
          : null;

        if (groupCtx) {
          ctx.channel.connect(groupCtx.eq);
        } else {
          ctx.channel.connect(this.masterHeadroom);
        }
      }
    });

    // Clear old parts if they no longer exist
    const currentClipIds = new Set(Object.keys(state.clips));
    this.parts.forEach((part, clipId) => {
      if (!currentClipIds.has(clipId)) {
        part.dispose();
        this.parts.delete(clipId);
      }
    });

    let audioClipsChangedBounds = false;

    // Cleanup old players in contexts
    this.trackContexts.forEach((ctx) => {
      for (const [clipId, player] of ctx.players.entries()) {
        if (!currentClipIds.has(clipId)) {
          player.dispose();
          ctx.players.delete(clipId);
          audioClipsChangedBounds = true;
        }
      }
    });

    const format16thsToTimeStr = (pos: number): string => {
      const bar = Math.floor(pos / 16);
      const remaining = pos % 16;
      const beat = Math.floor(remaining / 4);
      const sixteenth = remaining % 4;
      return `${bar}:${beat}:${sixteenth}`;
    };

    const bpmChanged = !prevState || state.bpm !== prevState.bpm;

    Object.values(state.clips).forEach((clip) => {
      const track = state.tracks.find((t) => t.id === clip.trackId);
      const ctx = this.trackContexts.get(clip.trackId);
      if (!track || !ctx) return;
      
      const prevClip = prevState?.clips[clip.id];
      if (track.type === 'audio' && clip !== prevClip) {
         if (!prevClip || prevClip.startTime !== clip.startTime || prevClip.duration !== clip.duration || prevClip.audioOffset !== clip.audioOffset) {
            audioClipsChangedBounds = true;
         }
      }

      const muteVelocity = clip.muted ? 0 : 1;
      const speed = clip.speed || 1;

      if (track.type === "midi" && ctx.synth) {
        const baseNotes = (clip.notes || []).filter(note => !note.isRecording);
        
        // Skip rebuilding MIDI Part if notes, position, speed, loop settings, mute status, and BPM did not change.
        // Use notesRevision (an integer counter) instead of JSON.stringify for O(1) comparison.
        let part = this.parts.get(clip.id);
        const notesSame = prevClip &&
                          clip.notesRevision !== undefined
                            ? clip.notesRevision === prevClip.notesRevision
                            : (() => {
                                const prevNotes = (prevClip.notes || []).filter(note => !note.isRecording);
                                return baseNotes.length === prevNotes.length &&
                                       JSON.stringify(baseNotes) === JSON.stringify(prevNotes);
                              })();
        const paramsSame = prevClip &&
                           prevClip.startTime === clip.startTime &&
                           prevClip.duration === clip.duration &&
                           prevClip.audioOffset === clip.audioOffset &&
                           prevClip.loopLength === clip.loopLength &&
                           prevClip.muted === clip.muted &&
                           prevClip.gain === clip.gain &&
                           prevClip.speed === clip.speed &&
                           prevClip.isGhost === clip.isGhost &&
                           prevState?.swingAmount === state.swingAmount;

        if (part && notesSame && paramsSame && !bpmChanged) {
          return; // Skip and keep existing part playing flawlessly!
        }

        let maxNoteEnd = 0;
        baseNotes.forEach(n => {
            if (n.startTime + n.duration > maxNoteEnd) maxNoteEnd = n.startTime + n.duration;
        });
        const calculatedPatternLength = Math.max(1, Math.ceil(maxNoteEnd / 4) * 4); // round up to nearest beat
        const loopLength = clip.loopLength || calculatedPatternLength;

        const totalDuration = clip.duration;
        const clipOffset = clip.audioOffset || 0;
        
        type MidiEvent = { time: string | number, note: string, duration: string | number, velocity: number, isSlide?: boolean };
        const events: MidiEvent[] = [];
        
        baseNotes.forEach((note) => {
          for (let offset = 0; offset < totalDuration + clipOffset; offset += loopLength) {
            const rawStart = note.startTime + offset - clipOffset;
            const end = rawStart + note.duration;
            
            if (rawStart >= totalDuration) break;
            if (end <= 0) continue;
            
            const clippedStart = Math.max(0, rawStart);
            const trimLeft = clippedStart - rawStart;
            
            const remaining = totalDuration - clippedStart;
            const clippedDuration = Math.min(note.duration - trimLeft, remaining);
            
            if (clippedDuration <= 0) continue;
            
            let swingDelay16th = 0;
            if (state.swingAmount > 0 && Math.round(rawStart) % 2 === 1) {
              // Apply up to 50% of a sixteenth note delay for extreme swing feel
              swingDelay16th = (state.swingAmount / 100) * 0.5;
            }

            const final16thPosition = (clip.startTime + (clippedStart / speed)) + (swingDelay16th / speed);
            const duration16ths = clippedDuration / speed;

            events.push({
              time: format16thsToTimeStr(final16thPosition),
              note: note.note,
              duration: format16thsToTimeStr(duration16ths),
              velocity: Math.min(1, Math.max(0, (note.velocity ?? 0.8) * muteVelocity * (1 + (clip.gain || 0) / 20) * ((note.isGhost || clip.isGhost) ? 0.35 : 1.0))),
              isSlide: !!note.isSlide
            });
          }
        });

        if (!part) {
          part = new Tone.Part((time, value) => {
            if (value.velocity > 0) {
              try {
                if (ctx.synth && !ctx.synth.disposed) {
                  if (value.isSlide) {
                    // FL studio glide: dynamically enable portamento, trigger note, and schedule restoring original state
                    const originalPortamento = (ctx.synth as any).portamento ?? track.portamento ?? 0;
                    const slideDurationSeconds = Math.max(0.08, Math.min(0.35, Tone.Time(value.duration).toSeconds()));
                    
                    if ('set' in ctx.synth) {
                      ctx.synth.set({ portamento: slideDurationSeconds });
                    } else {
                      (ctx.synth as any).portamento = slideDurationSeconds;
                    }
                    
                    ctx.synth.triggerAttackRelease(
                      value.note,
                      value.duration,
                      time,
                      value.velocity,
                    );
                    
                    // Restore original portamento glide after a short delay
                    Tone.Draw.schedule(() => {
                      setTimeout(() => {
                        try {
                          if (ctx.synth && !ctx.synth.disposed) {
                            if ('set' in ctx.synth!) {
                              ctx.synth!.set({ portamento: originalPortamento });
                            } else {
                              (ctx.synth as any).portamento = originalPortamento;
                            }
                          }
                        } catch (_) {}
                      }, Math.round(slideDurationSeconds * 1000) + 10);
                    }, time);
                  } else {
                    ctx.synth.triggerAttackRelease(
                      value.note,
                      value.duration,
                      time,
                      value.velocity,
                    );
                  }
                }
              } catch (e) {
                console.warn("Tone.js scheduling issue:", e);
              }
            }
          }, events).start(0);
          this.parts.set(clip.id, part);
        } else {
          // If we are recording and modifying this clip, updating the part directly avoids
          // disposing the old part which can cause audio glitches.
          // For simplicity we just clear and re-add all events.
          part.clear();
          events.forEach((e) => part!.add(e.time, e));
          // make sure it's started if not
          if ((part as any).state !== "started") {
            part.start(0);
          }
        }
      } else if (track.type === "audio" && clip.audioUrl) {
        let player = ctx.players.get(clip.id);

        const paramsSame = prevClip &&
                           prevClip.audioUrl === clip.audioUrl &&
                           prevClip.startTime === clip.startTime &&
                           prevClip.duration === clip.duration &&
                           prevClip.audioOffset === clip.audioOffset &&
                           prevClip.speed === clip.speed &&
                           prevClip.loopLength === clip.loopLength &&
                           prevClip.muted === clip.muted &&
                           prevClip.fadeIn === clip.fadeIn &&
                           prevClip.fadeOut === clip.fadeOut &&
                           prevClip.gain === clip.gain &&
                           JSON.stringify(prevClip.vocalNotes) === JSON.stringify(clip.vocalNotes);

        const skipPlayerRebuild = player && paramsSame && !bpmChanged;

        const schedulePlayer = (p: Tone.Player) => {
          p.unsync();
          let originalBpm = clip.originalBpm || state.bpm;
          let offsetTime = (clip.audioOffset || 0) * (60 / originalBpm) / 4;
          
          let rate = clip.speed || 1;
          if (clip.originalBpm) {
            rate = rate * (state.bpm / clip.originalBpm);
          }

          const actualDuration16ths = clip.duration / rate;
          let durationTime = actualDuration16ths * Tone.Time("16n").toSeconds();
          
          const loopLength16ths = (clip.loopLength || clip.duration) / rate;
          let loopEndTime = loopLength16ths * Tone.Time("16n").toSeconds();

          if (p.buffer && p.buffer.loaded && p.buffer.duration > 0) {
            if (offsetTime >= p.buffer.duration) offsetTime = Math.max(0, p.buffer.duration - 0.01);
            if (loopEndTime > p.buffer.duration) loopEndTime = p.buffer.duration;
            
            p.loop = loopLength16ths < actualDuration16ths;
            if (!p.loop) {
              const maxDuration = Math.max(0, p.buffer.duration - offsetTime - 0.01);
              if (durationTime > maxDuration) {
                durationTime = maxDuration;
              }
            }
          } else {
            p.loop = loopLength16ths < actualDuration16ths;
          }

          p.playbackRate = rate;
          if (p.loop) {
            p.loopStart = 0; // we might want to offset, but typically from 0 of buffer
            p.loopEnd = Math.max(0.01, loopEndTime);
          }

          p.sync().start(clip.startTime * Tone.Time("16n").toSeconds(), offsetTime, durationTime);
        };

        let targetUrl = clip.audioUrl;
        const brokenUrls: Record<string, string> = {
          'https://tonejs.github.io/audio/loop/FW3_snare.mp3': 'https://tonejs.github.io/audio/drum-samples/breakbeat.mp3',
          'https://tonejs.github.io/audio/loop/chords.mp3': 'https://tonejs.github.io/audio/casio/A1.mp3',
          'https://tonejs.github.io/audio/loop/bass.mp3': 'https://tonejs.github.io/audio/casio/C2.mp3',
          'https://tonejs.github.io/audio/drum-samples/CR78/beat.mp3': 'https://tonejs.github.io/audio/drum-samples/breakbeat.mp3',
          'https://tonejs.github.io/audio/loop/female_ah.mp3': 'https://tonejs.github.io/audio/casio/A2.mp3'
        };
        if (brokenUrls[targetUrl]) {
          targetUrl = brokenUrls[targetUrl];
        }

        if (skipPlayerRebuild && player) {
          // Keep running beautifully, skip any `.unsync()` or `.sync()` calls!
        } else if (!player) {
          const cachedBuffer = this.audioBufferCache.get(targetUrl);
          player = new Tone.Player({
            url: cachedBuffer || targetUrl,
            loop: false,
            onload: () => {
              if (player) {
                 if (!cachedBuffer && player.buffer) {
                    this.audioBufferCache.set(targetUrl, player.buffer);
                 }
                 schedulePlayer(player);
              }
            },
          });
          
          // If using cached buffer, it is already loaded, but onload won't fire until we execute it or naturally 
          // Tone handles it, but just in case we can schedule immediately if it's already a buffer
          if (cachedBuffer) {
              schedulePlayer(player);
          }
          
          const isPcEnabled = track?.fx?.pitchCorrection?.enabled ?? false;
          if (clip.vocalNotes && clip.vocalNotes.length > 0 && isPcEnabled) {
            const pitchShift = new Tone.PitchShift({ windowSize: 0.15 }).connect(ctx.eq);
            player.connect(pitchShift);
            this.clipPitchShifts.set(clip.id, pitchShift);
          } else {
            player.connect(ctx.eq);
          }
          
          ctx.players.set(clip.id, player);
          player.fadeIn = clip.fadeIn || 0;
          player.fadeOut = clip.fadeOut || 0;
        } else {
          // Check if pitch shift changed
          const isPcEnabled = track?.fx?.pitchCorrection?.enabled ?? false;
          const hasVocalNotes = clip.vocalNotes && clip.vocalNotes.length > 0 && isPcEnabled;
          let pitchShift = this.clipPitchShifts.get(clip.id);
          
          if (hasVocalNotes && !pitchShift) {
             player.disconnect();
             pitchShift = new Tone.PitchShift({ windowSize: 0.15 }).connect(ctx.eq);
             player.connect(pitchShift);
             this.clipPitchShifts.set(clip.id, pitchShift);
          } else if (!hasVocalNotes && pitchShift) {
             player.disconnect();
             pitchShift.dispose();
             this.clipPitchShifts.delete(clip.id);
             player.connect(ctx.eq);
          }

          if (player.loaded) {
            schedulePlayer(player);
          } else {
            const oldOnLoad = (player as any).onload;
            (player as any).onload = () => {
              if (oldOnLoad) oldOnLoad();
              if (player) schedulePlayer(player);
            };
          }
          player.fadeIn = clip.fadeIn || 0;
          player.fadeOut = clip.fadeOut || 0;
        }

        // Schedule Vocal Pitch Tuning
        const pcSettings = track?.fx?.pitchCorrection;
        const isPcEnabled = pcSettings?.enabled ?? false;

        if (clip.vocalNotes && clip.vocalNotes.length > 0 && isPcEnabled) {
          const pitchShift = this.clipPitchShifts.get(clip.id);
          if (pitchShift) {
            const pcAmount = pcSettings?.amount ?? 100; // 0 to 100
            const pcSpeed = pcSettings?.speed ?? 100; // 0 to 100
            const pcScale = pcSettings?.scale || 'Chromatic';
            
            const projectKey = state.projectKey || 'C';
            const scaleOffsets: Record<string, number[]> = {
              'Chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
              'Major': [0, 2, 4, 5, 7, 9, 11],
              'Minor': [0, 2, 3, 5, 7, 8, 10],
              'Pentatonic': [0, 2, 4, 7, 9]
            };
            const activeScale = scaleOffsets[pcScale] || scaleOffsets['Chromatic'];
            const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
            const rootIdx = noteNames.indexOf(projectKey.replace(/m$/, ''));
            const allowedNotes = activeScale.map(o => (rootIdx + o) % 12);

            const events = clip.vocalNotes.flatMap(vn => {
              let targetMidi = vn.midi; 
              
              if (isPcEnabled) {
                 const origNote = Math.round(vn.originalMidi);
                 let nearest = origNote;
                 let minDist = 999;
                 for (let i = origNote - 12; i <= origNote + 12; i++) {
                   if (allowedNotes.includes(((i % 12) + 12) % 12)) {
                      const dist = Math.abs(i - vn.originalMidi);
                      if (dist < minDist) {
                         minDist = dist;
                         nearest = i;
                      }
                   }
                 }
                 const shiftAmount = nearest - vn.originalMidi;
                 targetMidi = vn.originalMidi + (shiftAmount * (pcAmount / 100));
              }
              
              if (isPcEnabled && vn.pitchCurve && vn.pitchCurve.length > 0) {
                 // Dynamic Autotune (T-Pain effect) Using Pitch Curve
                 const noteDurSeconds = (vn.duration / speed) * Tone.Time("16n").toSeconds();
                 const timePerPoint = noteDurSeconds / vn.pitchCurve.length;
                 const noteStartSeconds = (clip.startTime + vn.startTime / speed) * Tone.Time("16n").toSeconds();
                 
                 // Smoothing factor based on pcSpeed (0 = slow, 100 = instant)
                 const alpha = pcSpeed === 100 ? 1.0 : (pcSpeed / 100) * 0.3;
                 let currentShift = 0;
                 
                 return vn.pitchCurve.map((curveMidi, idx) => {
                    if (curveMidi <= 0) {
                       return {
                          time: noteStartSeconds + (idx * timePerPoint),
                          pitch: currentShift // maintain previous shift during unvoiced/silence
                       };
                    }
                    
                    // target shift is the difference between where we want to be and where the vocal actually was
                    const rawShift = targetMidi - curveMidi;
                    // Apply Amount (0 to 100)
                    const wantedShift = rawShift * (pcAmount / 100);
                    // Apply Retune Speed (smoothing)
                    currentShift = currentShift + alpha * (wantedShift - currentShift);
                    
                    return {
                       time: noteStartSeconds + (idx * timePerPoint),
                       pitch: currentShift
                    };
                 });
              } else {
                 return [{
                   time: (clip.startTime + vn.startTime / speed) * Tone.Time("16n").toSeconds(),
                   pitch: targetMidi - vn.originalMidi
                 }];
              }
            });
            
            // Return to 0 when no note is present (optional, but good for natural pieces between notes)
            clip.vocalNotes.forEach(vn => {
               events.push({
                 time: (clip.startTime + (vn.startTime + vn.duration) / speed) * Tone.Time("16n").toSeconds(),
                 pitch: 0
               });
            });

            // Sort events by time
            events.sort((a, b) => a.time - b.time);

            let part = this.parts.get(clip.id + "_pitch");
            if (!part) {
              part = new Tone.Part((time, value) => {
                // Tone.PitchShift's pitch is not a Signal, it must be set directly.
                // It takes effect immediately when the callback fires.
                pitchShift.pitch = value.pitch;
              }, events);
              this.parts.set(clip.id + "_pitch", part);
              part.start(0);
            } else {
              part.clear();
              events.forEach(e => (part as Tone.Part).add(e.time, e));
            }
          }
        } else {
           const part = this.parts.get(clip.id + "_pitch");
           if (part) {
             part.dispose();
             this.parts.delete(clip.id + "_pitch");
           }
        }

        player.playbackRate = speed;
        player.mute = !!clip.muted;
        player.volume.value = (clip.gain || 0) + (clip.isGhost ? -18 : 0);

        // Simple denoise approximation by applying highpass if denoised is true
        // Doing this via Tone properties or track eq could be complex, we'll leave it as proxy for now
      }
    });
    
    if (audioClipsChangedBounds && Tone.Transport.state === "started") {
       // Force Tone.js to re-evaluate the synced timeline so moved audio clips 
       // immediately resume playback from their correct shifted position, 
       // ensuring movable/shiftable clips track during live playback.
       Tone.Transport.seconds = Tone.Transport.seconds;
    }
  }

  async stop() {
    Tone.Transport.stop();
    this.releaseAllNotes();
    const state = useDawStore.getState();
    state.setPlaybackState("stopped");
    state.setTransportPosition(0);
  }

  public releaseAllNotes(trackId?: string) {
    if (trackId) {
      const ctx = this.trackContexts.get(trackId);
      if (ctx && ctx.synth && !ctx.synth.disposed) {
        try {
          (ctx.synth as any).triggerRelease(); // Releases all active notes on this synth
          if ((ctx.synth as any).releaseAll) (ctx.synth as any).releaseAll();
        } catch (e) {}
      }
      if (ctx) this.hardStopAudioPlayers(ctx);
      stopAllLowLatencyVoices();
    } else {
      this.trackContexts.forEach((ctx) => {
        if (ctx.synth && !ctx.synth.disposed) {
          try {
            (ctx.synth as any).triggerRelease();
            if ((ctx.synth as any).releaseAll) (ctx.synth as any).releaseAll();
          } catch (e) {}
        }
        this.hardStopAudioPlayers(ctx);
      });
      stopAllLowLatencyVoices();
    }
  }

  /**
   * Force-stops every audio Tone.Player on a track context. This is needed on
   * mobile WebViews where Transport.pause()/stop() sometimes leaves underlying
   * BufferSource nodes ringing (the "cricket"/"teared speaker" artifact).
   */
  private hardStopAudioPlayers(ctx: any) {
    if (!ctx || !ctx.players) return;
    ctx.players.forEach((p: any) => {
      try {
        if (p && !p.disposed && p.state === 'started') {
          p.stop();
        }
      } catch (e) {}
    });
    stopAllLowLatencyVoices();
  }

  /**
   * Re-attach all audio-clip players after the page becomes visible again.
   * On mobile, when the WebView is backgrounded the AudioContext is suspended
   * and Tone.Players that were started via `.sync().start()` lose their
   * underlying BufferSource; the only reliable recovery is to dispose and
   * rebuild them. MIDI tracks resynthesize on demand so they are unaffected.
   */
  public async refreshAudioPlayersAfterResume() {
    try {
      const raw = (Tone.context.rawContext as AudioContext);
      if (raw.state === 'suspended') {
        await raw.resume().catch(() => {});
      }
      this.trackContexts.forEach((ctx) => {
        if (!ctx?.players) return;
        ctx.players.forEach((p: any, clipId: string) => {
          try {
            p.unsync();
            p.stop();
            p.dispose();
          } catch (e) {}
          ctx.players.delete(clipId);
        });
      });
      // Force a re-sync on next tick so all audio clips get rebuilt and re-scheduled.
      const state = useDawStore.getState();
      // After a mobile WebView resume the Transport may internally be stalled even
      // though Tone.Transport.state still reads "started".  Force an explicit
      // restart so audio clips don't stay silent.
      if (state.playbackState === 'playing') {
        try {
          Tone.Transport.stop();
          Tone.Transport.start('+0.05');
        } catch (_) {}
      }
      // Pass null as prevState to bypass the track-diff guard so every clip
      // player gets fully rebuilt after the resume.
      this.syncToneWithState(state, null);
    } catch (e) {
      console.warn('[engine] refreshAudioPlayersAfterResume failed:', e);
    }
  }


  async getAudioBuffer(trackId: string, clipId: string, clipUrl?: string): Promise<AudioBuffer | null> {
    const ctx = this.trackContexts.get(trackId);
    if (!ctx) return null;
    const player = ctx.players.get(clipId);
    if (!player || !player.buffer) return null;
    if (!player.loaded) {
       try {
         await player.buffer.load((player as any)._url || clipUrl || "");
       } catch (err) {
         console.warn(`[getAudioBuffer] Failed to load audio buffer for track/clip:`, err);
         return null;
       }
    }
    return player.buffer.get() as AudioBuffer;
  }

  async preloadAudioUrls(urls: string[]): Promise<void> {
    const uniqueUrls = Array.from(new Set(urls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)));
    const promises = uniqueUrls.map(async (url) => {
      if (this.audioBufferCache.has(url)) return;
      try {
        const buffer = new Tone.ToneAudioBuffer();
        await buffer.load(url);
        this.audioBufferCache.set(url, buffer);
        console.log(`[AudioEngine] Optimized and preloaded ToneAudioBuffer for seamless segment playback: ${url}`);
      } catch (err) {
        console.warn(`[AudioEngine] Optional pre-loading failed for segment URL: ${url}`, err);
      }
    });
    await Promise.all(promises);
  }

  async warpClipAudio(trackId: string, clipId: string, currentBpm: number, originalBpm: number): Promise<boolean> {
    try {
      const originalBuffer = await this.getAudioBuffer(trackId, clipId);
      if (!originalBuffer) return false;

      const ratio = currentBpm / originalBpm;
      if (ratio === 1 || ratio <= 0 || isNaN(ratio)) return true;

      const { stretchAudioBuffer } = await import("./WarpEngine");
      const audioContext = Tone.context.rawContext as AudioContext;
      // stretchAudioBuffer now runs in a Web Worker — must be awaited
      const stretched = await stretchAudioBuffer(audioContext, originalBuffer, ratio);

      const ctx = this.trackContexts.get(trackId);
      if (ctx) {
        const player = ctx.players.get(clipId);
        if (player) {
          const newToneBuffer = new Tone.ToneAudioBuffer(stretched);
          player.buffer = newToneBuffer;
          
          const clip = useDawStore.getState().clips[clipId];
          if (clip && clip.audioUrl) {
            this.audioBufferCache.set(clip.audioUrl, newToneBuffer);
          }
        }
      }
      return true;
    } catch (e) {
      console.error("Failed to warp audio clip:", e);
      return false;
    }
  }

  async triggerNote(trackId: string, note: string, duration: string = "8n") {
    if (Tone.context.state !== "running") await Tone.start();
    const ctx = this.trackContexts.get(trackId);
    if (ctx && ctx.synth && !ctx.synth.disposed) {
      try {
        console.log(`[AudioEngine] triggerNote ${note} on track ${trackId}`);
        ctx.synth.triggerAttackRelease(note, duration, Tone.immediate());
      } catch (e) {
        console.warn("Tone.js scheduling issue:", e);
      }
    }
  }

  async triggerNoteWithVelocity(trackId: string, note: string, durationSeconds: number, velocity: number = 0.5) {
    if (Tone.context.state !== "running") await Tone.start();
    const ctx = this.trackContexts.get(trackId);
    if (ctx && ctx.synth && !ctx.synth.disposed) {
      try {
        ctx.synth.triggerAttackRelease(note, durationSeconds, Tone.immediate(), velocity);
      } catch (e) {
        console.warn("Tone.js triggerNoteWithVelocity issue:", e);
      }
    }
  }

  async triggerNoteStart(
    trackId: string,
    note: string,
    velocity: number = 0.8,
  ) {
    if (Tone.context.state !== "running") {
      await Tone.start();
      try {
        await (Tone.context.rawContext as AudioContext).resume();
      } catch (e) {}
    }
    const ctx = this.trackContexts.get(trackId);
    if (ctx && ctx.synth && !ctx.synth.disposed) {
      try {
        console.log(
          `[AudioEngine] triggerNoteStart ${note} on track ${trackId} with velocity ${velocity}`,
        );
        ctx.synth.triggerAttack(note, Tone.immediate(), velocity);
      } catch (e) {
        console.warn("Tone.js scheduling issue:", e);
      }
    } else {
      console.warn(
        `[AudioEngine] triggerNoteStart failed: no context, synth disposed, or no synth for track ${trackId}`,
      );
    }
  }

  triggerNoteRelease(trackId: string, note: string) {
    const ctx = this.trackContexts.get(trackId);
    if (ctx && ctx.synth && !ctx.synth.disposed) {
      try {
        ctx.synth.triggerRelease(note, Tone.immediate());
      } catch (e) {
        console.warn("Tone.js scheduling issue:", e);
      }
    }
  }

  async exportWithProgress() {
    return this.exportWithConfig({
      title: "mixdown",
      format: "wav",
      exportType: "master"
    });
  }

  async exportWithConfig(config: {
    title: string;
    format: string;
    exportType: string;
    singleTrackId?: string;
  }) {
    const store = useDawStore.getState();
    store.setExportProgressConfig(config.title, config.format, config.exportType);
    
    // Quick timeline length pre-flight check to get estimated rendering time
    let max16ths = 0;
    const activeTrackIds = new Set((store.tracks || []).map(t => t.id));
    Object.values(store.clips || {}).forEach((clip) => {
      if (config.exportType === "single" && clip.trackId !== config.singleTrackId) return;
      if (!activeTrackIds.has(clip.trackId)) return;
      const clipStart = Number(clip.startTime) || 0;
      const clipDuration = Number(clip.duration) || 0;
      const end16ths = clipStart + clipDuration;
      if (end16ths > max16ths) max16ths = end16ths;
    });
    if (max16ths === 0) max16ths = 64;
    const safeBpm = Math.max(1, Number(store.bpm) || 120);
    const beats = max16ths / 4;
    const durationSeconds = (beats * 60) / safeBpm;
    const renderDuration = Math.max(1.5, Math.min(600, durationSeconds || 10) + 1.5); // Cap at 10 minutes defensive limit, min 1.5s

    const estRenderTimeMs = Math.max(2500, renderDuration * 40); // estimate ~40ms per audio second, min 2.5s duration
    const totalEstSecs = Math.max(3, Math.ceil(estRenderTimeMs / 1000) + 1);

    store.setIsExporting(true, 1, "Initializing synthesis parameters...", totalEstSecs);

    let progress = 1;
    const stepMs = 150;
    const totalSteps = estRenderTimeMs / stepMs;
    const progressPerStep = 94 / totalSteps;
    const startTimeStamp = Date.now();

    const interval = setInterval(() => {
      const currentStore = useDawStore.getState();
      if (currentStore.isExportCancelled) {
        clearInterval(interval);
        return;
      }

      const elapsedMs = Date.now() - startTimeStamp;
      const remainingMs = Math.max(100, (estRenderTimeMs + 1000) - elapsedMs); // Add 1s buffer for format wrapping
      const remainingSecs = Math.max(1, Math.ceil(remainingMs / 1000));

      if (progress < 95) {
        progress += progressPerStep;
        if (progress > 95) progress = 95;

        const roundedProgress = Math.floor(progress);
        let phase = "Rendering playlist layout...";
        if (roundedProgress < 22) phase = "Mapping memory clip fusions & audio layers...";
        else if (roundedProgress < 48) phase = "Compiling synthesizer matrices & sample maps...";
        else if (roundedProgress < 72) phase = "Summing multi-track stereo submix waveforms...";
        else phase = "Applying master EQ, limiting & safety ceilings...";

        store.setIsExporting(true, roundedProgress, phase, remainingSecs);
      } else if (progress >= 95 && progress < 99) {
        // Safe smooth trickle as we encode the audio container format
        progress += 0.25;
        if (progress > 99) progress = 99;
        store.setIsExporting(true, Math.floor(progress), "Encoding to target audio codec, wrapping audio blocks...", remainingSecs);
      }
    }, stepMs);

    try {
      if (useDawStore.getState().isExportCancelled) {
        throw new Error("Export aborted by user");
      }

      if (config.exportType === "stems") {
        // Zip multi-track stem export!
        const zip = new JSZip();
        const tracksToExport = store.tracks.filter(t => t.clips && t.clips.length > 0);
        
        if (tracksToExport.length === 0) {
          throw new Error("No tracks with clips found to export stems!");
        }

        let renderedCount = 0;
        const secondsPerStem = estRenderTimeMs / 1000;
        const totalStemsEstSecs = Math.max(3, Math.ceil(tracksToExport.length * secondsPerStem));

        for (const track of tracksToExport) {
          if (useDawStore.getState().isExportCancelled) {
            throw new Error("Export aborted by user");
          }

          renderedCount++;
          const currentProgress = Math.round((renderedCount / tracksToExport.length) * 80);
          const stemsRemainingSecs = Math.max(1, Math.ceil((tracksToExport.length - renderedCount + 1) * secondsPerStem));

          store.setIsExporting(
            true, 
            currentProgress, 
            `Rendering stem ${renderedCount}/${tracksToExport.length}: "${track.name}"...`,
            stemsRemainingSecs
          );

          const result = await this.exportMix({ onlyTrackId: track.id });
          const mimeType = config.format === "mp3" ? "audio/mp3" : config.format === "flac" ? "audio/flac" : "audio/wav";
          const finalBlob = new Blob([result.blob], { type: mimeType });
          const safeTrackName = track.name.replace(/[\s\W]+/g, "_") || `track_${track.id}`;
          
          zip.file(`${safeTrackName}.${config.format}`, finalBlob);
        }

        if (useDawStore.getState().isExportCancelled) {
          throw new Error("Export aborted by user");
        }

        store.setIsExporting(true, 85, "Assembling & compressing stem ZIP archive...", 1);
        const zipBlob = await zip.generateAsync({ type: "blob" }, (metadata) => {
          const zipPercent = Math.round(85 + metadata.percent * 0.12);
          store.setIsExporting(true, zipPercent, "Finalizing ZIP stems archive compilation...", 1);
        });

        clearInterval(interval);
        store.setIsExporting(true, 100, "Stems package complete! Readying download...", 0);
        await new Promise(resolve => setTimeout(resolve, 800));
        store.setIsExporting(false, 0, "", 0);

        const url = URL.createObjectURL(zipBlob);
        return url;

      } else {
        // Master or Single track export
        const singleOrMasterEstSecs = Math.max(2, Math.ceil(estRenderTimeMs / 1000));
        store.setIsExporting(true, 10, `Synthesizing ${config.exportType === "single" ? "single track" : "stereo master"} bounce buffer...`, singleOrMasterEstSecs);
        const result = await this.exportMix({
          onlyTrackId: config.exportType === "single" ? config.singleTrackId : undefined
        });

        if (useDawStore.getState().isExportCancelled) {
          throw new Error("Export aborted by user");
        }

        // Convert Blob to selected format MIME type
        const mimeType = config.format === "mp3" ? "audio/mp3" : config.format === "flac" ? "audio/flac" : "audio/wav";
        const finalBlob = new Blob([result.blob], { type: mimeType });

        clearInterval(interval);
        store.setIsExporting(true, 100, "Export mixdown ready! Triggering download...", 0);
        await new Promise(resolve => setTimeout(resolve, 800));
        store.setIsExporting(false, 0, "", 0);

        const url = URL.createObjectURL(finalBlob);
        return url;
      }

    } catch (err) {
      clearInterval(interval);
      store.setIsExporting(false, 0, "", 0);
      throw err;
    }
  }

  private getNativeAudioBuffer(buffer: any): AudioBuffer | null {
    if (!buffer) return null;
    const nativeBuffer = typeof buffer.get === "function" ? buffer.get() : (buffer._buffer || buffer);
    if (nativeBuffer && typeof nativeBuffer.getChannelData === "function") return nativeBuffer;
    return null;
  }

  private noteToFrequency(note: string): number {
    const match = String(note || "C4").match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
    if (!match) return 261.625565;
    const semis: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const name = match[1].toUpperCase();
    const accidental = match[2] === "#" ? 1 : match[2] === "b" ? -1 : 0;
    const octave = parseInt(match[3], 10);
    const midi = (octave + 1) * 12 + semis[name] + accidental;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  private createImpulse(ctx: OfflineAudioContext, duration = 1.2, decay = 2.2): AudioBuffer {
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < impulse.numberOfChannels; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  private makeTrackMixChain(ctx: OfflineAudioContext, track: any, state: any, destination: AudioNode) {
    const input = ctx.createGain();
    let current: AudioNode = input;
    const fx = track.fx || {};
    const connectSerial = (node: AudioNode) => {
      current.connect(node);
      current = node;
    };

    if (fx.highpass?.enabled) {
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = Math.max(10, Number(fx.highpass.frequency) || 200);
      hp.Q.value = Math.max(0.0001, Number(fx.highpass.Q) || 1);
      connectSerial(hp);
    }
    if (fx.lowpass?.enabled) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = Math.max(10, Number(fx.lowpass.frequency) || 2000);
      lp.Q.value = Math.max(0.0001, Number(fx.lowpass.Q) || 1);
      connectSerial(lp);
    }
    if (fx.bandpass?.enabled) {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = Math.max(10, Number(fx.bandpass.frequency) || 1000);
      bp.Q.value = Math.max(0.0001, Number(fx.bandpass.Q) || 1);
      connectSerial(bp);
    }
    if (fx.eq?.enabled) {
      const low = ctx.createBiquadFilter();
      low.type = "lowshelf";
      low.frequency.value = 220;
      low.gain.value = Number(fx.eq.low) || 0;
      const mid = ctx.createBiquadFilter();
      mid.type = "peaking";
      mid.frequency.value = 1100;
      mid.Q.value = 0.9;
      mid.gain.value = Number(fx.eq.mid) || 0;
      const high = ctx.createBiquadFilter();
      high.type = "highshelf";
      high.frequency.value = 4200;
      high.gain.value = Number(fx.eq.high) || 0;
      connectSerial(low);
      connectSerial(mid);
      connectSerial(high);
    }
    if (fx.graphicEQ?.enabled) {
      const freqs = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
      freqs.forEach((freq, idx) => {
        const peq = ctx.createBiquadFilter();
        peq.type = "peaking";
        peq.frequency.value = freq;
        peq.Q.value = 1.4;
        peq.gain.value = Number(fx.graphicEQ[`band${idx + 1}`]) || 0;
        connectSerial(peq);
      });
    }
    if (fx.distortion?.enabled) {
      const shaper = ctx.createWaveShaper();
      const amount = Math.max(0, Math.min(1, Number(fx.distortion.amount) || 0.35)) * 80;
      const curve = new Float32Array(2048);
      for (let i = 0; i < curve.length; i++) {
        const x = (i * 2) / curve.length - 1;
        curve[i] = ((3 + amount) * x * 20 * Math.PI / 180) / (Math.PI + amount * Math.abs(x));
      }
      shaper.curve = curve;
      shaper.oversample = "2x";
      connectSerial(shaper);
    }
    if (fx.compressor?.enabled) {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = Number(fx.compressor.threshold) || -24;
      comp.ratio.value = Number(fx.compressor.ratio) || 4;
      comp.attack.value = 0.01;
      comp.release.value = 0.18;
      connectSerial(comp);
    }
    if (fx.delay?.enabled || fx.pingPongDelay?.enabled) {
      const mix = fx.pingPongDelay?.enabled ? (Number(fx.pingPongDelay.wet) || 0.3) : (Number(fx.delay.mix) || 0.2);
      const timeValue = fx.pingPongDelay?.enabled ? fx.pingPongDelay.time : fx.delay.time;
      const seconds = String(timeValue || "8n").includes("4n") ? 60 / Math.max(1, state.bpm || 120) : (60 / Math.max(1, state.bpm || 120)) / 2;
      const splitter = ctx.createGain();
      const dry = ctx.createGain();
      const delay = ctx.createDelay(Math.max(1, seconds * 2));
      const feedback = ctx.createGain();
      const wet = ctx.createGain();
      const sum = ctx.createGain();
      dry.gain.value = Math.max(0, 1 - mix);
      wet.gain.value = Math.max(0, Math.min(1, mix));
      delay.delayTime.value = seconds;
      feedback.gain.value = Math.max(0, Math.min(0.85, fx.pingPongDelay?.enabled ? (Number(fx.pingPongDelay.feedback) || 0.3) : (Number(fx.delay.feedback) || 0.25)));
      current.connect(splitter);
      splitter.connect(dry).connect(sum);
      splitter.connect(delay).connect(wet).connect(sum);
      delay.connect(feedback).connect(delay);
      current = sum;
    }
    if (fx.reverb?.enabled) {
      const mix = Math.max(0, Math.min(1, Number(fx.reverb.mix) || 0.25));
      const splitter = ctx.createGain();
      const dry = ctx.createGain();
      const conv = ctx.createConvolver();
      const wet = ctx.createGain();
      const sum = ctx.createGain();
      conv.buffer = this.createImpulse(ctx, Math.max(0.2, Number(fx.reverb.decay) || 1.4), 2.2);
      dry.gain.value = 1 - mix;
      wet.gain.value = mix;
      current.connect(splitter);
      splitter.connect(dry).connect(sum);
      splitter.connect(conv).connect(wet).connect(sum);
      current = sum;
    }

    const volume = ctx.createGain();
    volume.gain.value = Math.pow(10, (Number(track.volume) || 0) / 20);
    connectSerial(volume);
    if (typeof ctx.createStereoPanner === "function") {
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, Number(track.pan) || 0));
      connectSerial(pan);
    }
    current.connect(destination);
    return input;
  }

  private scheduleSynthNote(ctx: OfflineAudioContext, input: AudioNode, note: any, startSecs: number, durationSecs: number, track: any, gainMul = 1) {
    if (durationSecs <= 0 || startSecs >= ctx.length / ctx.sampleRate) return;
    const frequency = this.noteToFrequency(note.note || "C4");
    const velocity = Math.max(0, Math.min(1, Number(note.velocity ?? 0.8))) * gainMul;
    const gain = ctx.createGain();
    const safeStart = Math.max(0, startSecs);
    const safeEnd = Math.min(ctx.length / ctx.sampleRate, safeStart + durationSecs);
    gain.gain.setValueAtTime(0, safeStart);
    gain.gain.linearRampToValueAtTime(velocity * 0.26, safeStart + 0.008);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, velocity * 0.18), Math.min(safeEnd, safeStart + Math.max(0.02, durationSecs * 0.65)));
    gain.gain.linearRampToValueAtTime(0, safeEnd);

    if (track.synthType === "membrane" || track.synthType === "synthbass") {
      const osc = ctx.createOscillator();
      osc.type = track.synthType === "membrane" ? "sine" : "sawtooth";
      osc.frequency.setValueAtTime(track.synthType === "membrane" ? Math.max(45, frequency / 4) : frequency, safeStart);
      osc.connect(gain).connect(input);
      osc.start(safeStart);
      osc.stop(safeEnd + 0.02);
      return;
    }

    const osc = ctx.createOscillator();
    osc.type = track.synthType === "fm" || track.synthType === "bells" ? "triangle" : track.synthType === "pad" || track.synthType === "strings" ? "sawtooth" : "square";
    osc.frequency.value = frequency;
    osc.connect(gain).connect(input);
    osc.start(safeStart);
    osc.stop(safeEnd + 0.02);
  }

  private async renderNativeMixChunk(params: any): Promise<AudioBuffer> {
    const { state, options, clipBufferMap, renderDuration, chunkStartSec, chunkDurationSec } = params;
    const sampleRate = 44100;
    const ctx = new OfflineAudioContext(2, Math.ceil(chunkDurationSec * sampleRate), sampleRate);
    const oneSixteenthSecs = 15 / Math.max(1, Number(state.bpm) || 120);
    const masterInput = ctx.createGain();
    masterInput.gain.value = Math.pow(10, ((Number(state.masterVolume) || 0) - 6) / 20);
    const masterComp = ctx.createDynamicsCompressor();
    masterComp.threshold.value = -12;
    masterComp.ratio.value = 3;
    masterComp.attack.value = 0.004;
    masterComp.release.value = 0.18;
    const safety = ctx.createGain();
    safety.gain.value = 0.86;
    masterInput.connect(masterComp).connect(safety).connect(ctx.destination);

    const hasSolo = (state.tracks || []).some((t: any) => t.soloed);
    const trackInputs = new Map<string, AudioNode>();
    const audibleTrackIds = new Set<string>();
    (state.tracks || []).forEach((track: any) => {
      const parentSoloed = track.groupId && (state.tracks || []).find((t: any) => t.id === track.groupId)?.soloed;
      const audible = options?.onlyTrackId ? track.id === options.onlyTrackId : (!track.muted && (!hasSolo || track.soloed || parentSoloed || track.type === "group"));
      if (audible) audibleTrackIds.add(track.id);
      const input = this.makeTrackMixChain(ctx, { ...track, muted: !audible }, state, masterInput);
      if (!audible) {
        const silent = ctx.createGain();
        silent.gain.value = 0;
        input.connect(silent);
      }
      trackInputs.set(track.id, input);
    });

    Object.values(state.clips || {}).forEach((clip: any) => {
      if (options?.onlyTrackId && clip.trackId !== options.onlyTrackId) return;
      if (clip.muted) return;
      const track = (state.tracks || []).find((t: any) => t.id === clip.trackId);
      const input = trackInputs.get(clip.trackId);
      if (!track || !input || !audibleTrackIds.has(track.id)) return;
      const speedBase = Math.max(0.01, Number(clip.speed) || 1);
      const speed = clip.originalBpm ? speedBase * ((Number(state.bpm) || 120) / Math.max(1, Number(clip.originalBpm) || 120)) : speedBase;
      const clipStartSec = (Number(clip.startTime) || 0) * oneSixteenthSecs;
      const clipDurSec = Math.max(0.01, (Number(clip.duration) || 0.01) * oneSixteenthSecs / speed);
      const clipEndSec = clipStartSec + clipDurSec;
      const chunkEndSec = chunkStartSec + chunkDurationSec;
      if (clipEndSec <= chunkStartSec || clipStartSec >= chunkEndSec) return;

      if (track.type === "midi") {
        const baseNotes = clip.notes || [];
        let maxNoteEnd = 0;
        baseNotes.forEach((n: any) => { maxNoteEnd = Math.max(maxNoteEnd, (Number(n.startTime) || 0) + (Number(n.duration) || 0)); });
        const loopLength = Math.max(0.01, Number(clip.loopLength) || Math.max(4, Math.ceil(maxNoteEnd / 4) * 4));
        const totalDuration = Math.max(0.01, Number(clip.duration) || 1);
        const clipOffset = Number(clip.audioOffset) || 0;
        baseNotes.forEach((note: any) => {
          for (let offset = 0; offset < totalDuration + clipOffset; offset += loopLength) {
            const rawStart = (Number(note.startTime) || 0) + offset - clipOffset;
            const end = rawStart + (Number(note.duration) || 0);
            if (rawStart >= totalDuration) break;
            if (end <= 0) continue;
            const clippedStart = Math.max(0, rawStart);
            const clippedDur = Math.min((Number(note.duration) || 0) - (clippedStart - rawStart), totalDuration - clippedStart);
            const absStart = ((Number(clip.startTime) || 0) + clippedStart / speed) * oneSixteenthSecs;
            const absDur = (clippedDur / speed) * oneSixteenthSecs;
            if (absStart + absDur <= chunkStartSec || absStart >= chunkEndSec) continue;
            this.scheduleSynthNote(ctx, input, note, Math.max(0, absStart - chunkStartSec), Math.min(absDur, chunkEndSec - absStart), track, Math.pow(10, (Number(clip.gain) || 0) / 20));
          }
        });
      } else if (track.type === "audio" && clip.audioUrl) {
        const nativeBuffer = this.getNativeAudioBuffer(clipBufferMap.get(clip.id));
        if (!nativeBuffer) return;
        const localStart = Math.max(clipStartSec, chunkStartSec);
        const localEnd = Math.min(clipEndSec, chunkEndSec);
        const source = ctx.createBufferSource();
        source.buffer = nativeBuffer;
        source.playbackRate.value = speed * Math.pow(2, ((track.fx?.pitchShift?.enabled ? Number(track.fx.pitchShift.pitch) || 0 : 0) + (track.fx?.voicePitcher?.enabled ? Number(track.fx.voicePitcher.shift) || 0 : 0)) / 12);
        const clipGain = ctx.createGain();
        clipGain.gain.value = Math.pow(10, (Number(clip.gain) || 0) / 20);
        const fadeIn = Math.max(0, Number(clip.fadeIn) || 0);
        const fadeOut = Math.max(0, Number(clip.fadeOut) || 0);
        const startAt = localStart - chunkStartSec;
        const playFor = Math.max(0.01, localEnd - localStart);
        let offsetSecs = Math.max(0, (Number(clip.audioOffset) || 0) * oneSixteenthSecs + Math.max(0, localStart - clipStartSec) * speed);
        if (nativeBuffer.duration > 0) offsetSecs = Math.min(offsetSecs, Math.max(0, nativeBuffer.duration - 0.01));
        if (fadeIn > 0 && localStart <= clipStartSec + fadeIn) {
          clipGain.gain.setValueAtTime(0, startAt);
          clipGain.gain.linearRampToValueAtTime(Math.pow(10, (Number(clip.gain) || 0) / 20), Math.min(startAt + fadeIn, startAt + playFor));
        }
        if (fadeOut > 0 && localEnd >= clipEndSec - fadeOut) {
          clipGain.gain.setValueAtTime(clipGain.gain.value, Math.max(startAt, startAt + playFor - fadeOut));
          clipGain.gain.linearRampToValueAtTime(0, startAt + playFor);
        }
        source.connect(clipGain).connect(input);
        source.start(startAt, offsetSecs, playFor);
      }
    });
    return ctx.startRendering();
  }

  private async renderNativeMix(params: any): Promise<any> {
    const sampleRate = 44100;
    const chunkSeconds = Math.min(45, Math.max(12, params.renderDuration));
    const totalLength = Math.ceil(params.renderDuration * sampleRate);
    const channels = [new Float32Array(totalLength), new Float32Array(totalLength)];
    let written = 0;
    for (let start = 0; start < params.renderDuration; start += chunkSeconds) {
      if (useDawStore.getState().isExportCancelled) throw new Error("Export aborted by user");
      const chunkDurationSec = Math.min(chunkSeconds, params.renderDuration - start);
      const chunk = await this.renderNativeMixChunk({ ...params, chunkStartSec: start, chunkDurationSec });
      const copyLength = Math.min(chunk.length, totalLength - written);
      for (let ch = 0; ch < 2; ch++) {
        channels[ch].set(chunk.getChannelData(Math.min(ch, chunk.numberOfChannels - 1)).subarray(0, copyLength), written);
      }
      written += copyLength;
      const pct = Math.min(92, Math.round((written / totalLength) * 92));
      useDawStore.getState().setIsExporting(true, pct, "Rendering playlist timeline with track effects...", Math.max(1, Math.ceil((params.renderDuration - start) / 10)));
    }
    return {
      numberOfChannels: 2,
      sampleRate,
      length: totalLength,
      getChannelData: (ch: number) => channels[Math.max(0, Math.min(1, ch))],
    };
  }

  async exportMix(options?: { onlyTrackId?: string }) {
    await this.init();
    const state = useDawStore.getState();

    // Find the end of the last clip
    let max16ths = 0;
    Object.values(state.clips || {}).forEach((clip) => {
      // Find clips belonging to active tracks or the soloed/only track
      if (options?.onlyTrackId && clip.trackId !== options.onlyTrackId) return;
      
      const clipStart = Number(clip.startTime) || 0;
      const clipDuration = Number(clip.duration) || 0;
      const end16ths = clipStart + clipDuration;
      if (end16ths > max16ths) max16ths = end16ths;
    });

    if (max16ths === 0) max16ths = 64; // Fallback to 4 bars
    const safeBpm = Math.max(1, Number(state.bpm) || 120);
    // Convert max 16ths to seconds
    const beats = max16ths / 4;
    const durationSeconds = (beats * 60) / safeBpm;
    // Cap duration strictly to 600 seconds (10 minutes) max to prevent memory bloat/hanging in virtual sandboxes
    const cappedDurationSeconds = Math.max(1.0, Math.min(600, durationSeconds || 10));
    // Add small tail for reverb/decay
    const renderDuration = cappedDurationSeconds + 1.5;

    const brokenUrls: Record<string, string> = {
      'https://tonejs.github.io/audio/loop/FW3_snare.mp3': 'https://tonejs.github.io/audio/drum-samples/breakbeat.mp3',
      'https://tonejs.github.io/audio/loop/chords.mp3': 'https://tonejs.github.io/audio/casio/A1.mp3',
      'https://tonejs.github.io/audio/loop/synth.mp3': 'https://tonejs.github.io/audio/casio/A1.mp3',
      'https://tonejs.github.io/audio/loop/melody.mp3': 'https://tonejs.github.io/audio/casio/A1.mp3',
      'https://tonejs.github.io/audio/drum-samples/808kick.mp3': 'https://tonejs.github.io/audio/instruments/kick.mp3'
    };

    // Preload audio buffers with high-speed parallel abortable fetch to prevent browser network hang loops
    const bufferPromises = Object.values(state.clips || {})
      .filter((clip) => clip.audioUrl && (!options?.onlyTrackId || clip.trackId === options.onlyTrackId))
      .map(async (clip) => {
        let url = clip.audioUrl!;
        if (brokenUrls[url]) {
          url = brokenUrls[url];
        }
        
        if (globalBufferCache.has(url)) {
          return { clipId: clip.id, buffer: globalBufferCache.get(url)! };
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 seconds hard max timeout

        try {
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
          const arrayBuffer = await res.arrayBuffer();
          const audioCtx = Tone.getContext().rawContext;
          const decodedData = await audioCtx.decodeAudioData(arrayBuffer);
          const buffer = new Tone.ToneAudioBuffer(decodedData);
          globalBufferCache.set(url, buffer);
          return { clipId: clip.id, buffer };
        } catch (e) {
          clearTimeout(timeoutId);
          console.warn("Buffer fetch bypassed for offline rendering stability", e);
        }

        // Clean safety placeholder/silence buffer so offline renders never stall
        let placeholder: Tone.ToneAudioBuffer;
        try {
          const rawCtx = Tone.getContext().rawContext;
          // Create a valid silent audio buffer of 0.1 seconds
          const silentNativeBuffer = rawCtx.createBuffer(1, Math.max(1, Math.floor(rawCtx.sampleRate * 0.1)), rawCtx.sampleRate);
          if (silentNativeBuffer.numberOfChannels > 0) {
            const channel = silentNativeBuffer.getChannelData(0);
            for (let idx = 0; idx < channel.length; idx++) {
              channel[idx] = 0;
            }
          }
          placeholder = new Tone.ToneAudioBuffer(silentNativeBuffer);
        } catch (_) {
          placeholder = new Tone.ToneAudioBuffer();
        }
        return { clipId: clip.id, buffer: placeholder };
      });

    const loadedBuffers = await Promise.all(bufferPromises);
    const clipBufferMap = new Map<string, Tone.ToneAudioBuffer>();
    loadedBuffers.forEach((item) =>
      clipBufferMap.set(item.clipId, item.buffer),
    );

    // Mobile Chromium/WebView can throw a bare SyntaxError inside Tone.Offline's
    // AudioWorklet capability probe. Export through a direct Web Audio offline
    // renderer instead so long multi-track arrangements can still be bounced.
    const nativeRenderedBuffer = await this.renderNativeMix({
      state,
      options,
      clipBufferMap,
      renderDuration,
    });
    if (useDawStore.getState().isExportCancelled) {
      throw new Error("Export aborted by user");
    }
    const nativeBlob = await encodeWavInWorker(nativeRenderedBuffer, (progress) => {
      useDawStore.getState().setIsExporting(true, progress, "Encoding final WAV mixdown...", 1);
    });
    return {
      url: URL.createObjectURL(nativeBlob),
      blob: nativeBlob,
    };
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
    this._releaseWakeLock();
    this.micNode?.dispose();
    this.recorder.dispose();
    this.micChannel.dispose();
    this.trackContexts.forEach((ctx) => {
      ctx.synth?.dispose();
      ctx.eq.dispose();
      ctx.compressor.dispose();
      ctx.pitchShift.dispose();
      ctx.delay.dispose();
      ctx.reverb.dispose();
      ctx.reverbSend?.dispose();
      ctx.delaySend?.dispose();
      ctx.channel.dispose();
      ctx.players.forEach((p) => p.dispose());
    });
    this.parts.forEach((p) => p.dispose());
    this.sharedReverb?.dispose();
    this.sharedDelay?.dispose();
  }
}

export const toggleGlobalRecording = async () => {
  await audioEngine.init();
  const state = useDawStore.getState();
  
  if (!state.isRecording) {
    const hasArmed = state.tracks.some(t => t.armed);
    const audioToRecord = state.tracks.some(t => t.type === 'audio' && (t.armed || (!hasArmed && t.id === state.selectedTrackId)));
    
    if (audioToRecord) {
      await audioEngine.toggleMicMonitor(state.inputMonitoring);
      await audioEngine.startRecording();
    }

    const currentPosition = state.transportPosition;
    const currentTicks = Tone.Transport.state === "started" ? Tone.Transport.ticks : currentPosition * 48;
    const start16ths = Math.max(0, currentTicks / 48);

    state.setIsRecording(true, start16ths);

    if (state.playbackState !== "playing") {
      state.setPlaybackState("playing");
    }
  } else {
    state.setIsRecording(false, undefined);
    state.setPlaybackState("stopped");

    const trackResults = await audioEngine.stopRecording();
    
    trackResults.forEach(({ trackId, url, peaks, start16ths, duration16ths, segments }) => {
       if (!url) return;
       const addedClips: { id: string, seg: any }[] = [];
       let clipIdToAnalyze = '';
       
       if (segments && segments.length > 0) {
         segments.forEach(seg => {
           const cid = state.addClip(trackId, start16ths + seg.start16thsOffset, url, seg.peaks, seg.duration16ths, state.bpm, seg.audioOffset16ths);
           addedClips.push({ id: cid, seg });
         });
       } else {
         clipIdToAnalyze = state.addClip(trackId, start16ths, url, peaks, duration16ths, state.bpm);
       }
       
       // Auto-analyze pitch for the recorded clip asynchronously
       setTimeout(async () => {
          try {
             const toneBuffer = await new Tone.ToneAudioBuffer().load(url);
             const audioBuffer = toneBuffer.get() as AudioBuffer;
             const notes = await analyzeAudioPitch(audioBuffer, state.bpm);
             
             if (addedClips.length > 0) {
                addedClips.forEach(({ id, seg }) => {
                   const offsetNotes = notes
                     .filter(n => n.startTime >= seg.audioOffset16ths && n.startTime <= seg.audioOffset16ths + seg.duration16ths)
                     .map(n => ({...n, startTime: n.startTime - seg.audioOffset16ths}));
                   useDawStore.getState().updateClip(id, { vocalNotes: offsetNotes });
                });
             } else if (clipIdToAnalyze) {
                useDawStore.getState().updateClip(clipIdToAnalyze, { vocalNotes: notes });
             }
          } catch(e) {
             console.warn("Auto-analysis failed", e);
          }
       }, 100);
    });
  }
};

export const audioEngine = new AudioEngine();
