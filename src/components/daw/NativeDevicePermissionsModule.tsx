// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, Cpu, Eye, Terminal, Play, Check, 
  Volume2, VolumeX, Globe, Languages, Settings, RefreshCw, Sparkles, HelpCircle 
} from 'lucide-react';
import { useDawStore } from '../../store/useDawStore';
import { motion } from 'framer-motion';

// BCP-47 Speech Synthesis / Language code registry
export const WORLDWIDE_LANGUAGES = [
  { code: 'en-US', name: 'English (United States)', native: 'English', flag: '🇺🇸', voiceName: 'Google US English' },
  { code: 'es-ES', name: 'Spanish (Spain)', native: 'Español', flag: '🇪🇸', voiceName: 'Google Español' },
  { code: 'fr-FR', name: 'French (France)', native: 'Français', flag: '🇫🇷', voiceName: 'Google Français' },
  { code: 'de-DE', name: 'German (Germany)', native: 'Deutsch', flag: '🇩🇪', voiceName: 'Google Deutsch' },
  { code: 'it-IT', name: 'Italian (Italy)', native: 'Italiano', flag: '🇮🇹', voiceName: 'Google Italiano' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)', native: 'Português', flag: '🇧🇷', voiceName: 'Google Português do Brasil' },
  { code: 'ru-RU', name: 'Russian (Russia)', native: 'Русский', flag: '🇷🇺', voiceName: 'Google Русский' },
  { code: 'zh-CN', name: 'Chinese (Mandarin)', native: '简体中文', flag: '🇨🇳', voiceName: 'Google 普通话' },
  { code: 'ja-JP', name: 'Japanese (Japan)', native: '日本語', flag: '🇯🇵', voiceName: 'Google 日本語' },
  { code: 'ko-KR', name: 'Korean (South Korea)', native: '한국어', flag: '🇰🇷', voiceName: 'Google 한국어' },
  { code: 'hi-IN', name: 'Hindi (India)', native: 'हिन्दी', flag: '🇮🇳', voiceName: 'Google हिन्दी' },
  { code: 'ar-SA', name: 'Arabic (Saudi Arabia)', native: 'العربية', flag: '🇸🇦', voiceName: 'Google Arabic' },
  { code: 'tr-TR', name: 'Turkish (Turkey)', native: 'Türkçe', flag: '🇹🇷', voiceName: 'Google Türkçe' },
  { code: 'nl-NL', name: 'Dutch (Netherlands)', native: 'Nederlands', flag: '🇳🇱', voiceName: 'Google Nederlands' },
  { code: 'sv-SE', name: 'Swedish (Sweden)', native: 'Svenska', flag: '🇸🇪', voiceName: 'Google Svenska' },
  { code: 'pl-PL', name: 'Polish (Poland)', native: 'Polski', flag: '🇵🇱', voiceName: 'Google Polski' },
  { code: 'id-ID', name: 'Indonesian (Indonesia)', native: 'Bahasa Indonesia', flag: '🇮🇩', voiceName: 'Google Bahasa Indonesia' },
  { code: 'th-TH', name: 'Thai (Thailand)', native: 'ไทย', flag: '🇹🇭', voiceName: 'Google Thai' },
  { code: 'vi-VN', name: 'Vietnamese (Vietnam)', native: 'Tiếng Việt', flag: '🇻🇳', voiceName: 'Google Tiếng Việt' }
];

// Utility function to speak text out loud with browser TTS API
export function speakText(text: string, langCode: string, pitch = 1.0, rate = 1.0) {
  if (!window.speechSynthesis) return;
  
  // Cancel active speaking queues
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langCode;
  utterance.pitch = pitch;
  utterance.rate = rate;
  
  // Try to find matching voice for language
  const voices = window.speechSynthesis.getVoices();
  const matchedVoice = voices.find(v => v.lang.startsWith(langCode.slice(0, 2)));
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }
  
  window.speechSynthesis.speak(utterance);
}

export function NativeDevicePermissionsModule() {
  const {
    speakingModeEnabled,
    setSpeakingModeEnabled,
    selectedLanguage,
    setSelectedLanguage,
    accessibilityPermissionGranted,
    setAccessibilityPermissionGranted,
    inputSimulationGranted,
    setInputSimulationGranted,
    screenOCRGranted,
    setScreenOCRGranted,
    backgroundDaemonGranted,
    setBackgroundDaemonGranted,
    shellBindingGranted,
    setShellBindingGranted
  } = useDawStore();

  // Component state
  const [testSpeechText, setTestSpeechText] = useState('Speaking mode is active. I am ready to assist you on your device!');
  const [translationInputText, setTranslationInputText] = useState('How can I help you play games or produce music today?');
  const [translationOutputText, setTranslationOutputText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [speechPitch, setSpeechPitch] = useState(1.0);
  const [speechRate, setSpeechRate] = useState(1.05);

  // Play a beautiful audio frequency verification on permission change
  const playPulseFeedback = (authorized: boolean) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(authorized ? 880 : 330, audioCtx.currentTime); // A5 (success) or E3 (disconnect)
      
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch {}
  };

  // Trigger TTS voice test
  const handleTestSpeech = (textToSpeak = testSpeechText) => {
    speakText(textToSpeak, selectedLanguage, speechPitch, speechRate);
  };

  // Perform MyMemory Translation fetch + Speak
  const handleTranslateAndSpeak = async () => {
    if (!translationInputText.trim()) return;
    setIsTranslating(true);
    setTranslationOutputText('Translating text globally...');

    try {
      // Decode language pair. Translate from English to selected target language
      // e.g. en|es
      const targetShortCode = selectedLanguage.split('-')[0];
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
          translationInputText
        )}&langpair=en|${targetShortCode}`
      );
      const data = await response.json();
      
      if (data?.responseData?.translatedText) {
        const translatedResult = data.responseData.translatedText;
        setTranslationOutputText(translatedResult);
        
        // Auto Speak the translated result aloud keying accent parameters
        speakText(translatedResult, selectedLanguage, speechPitch, speechRate);
      } else {
        setTranslationOutputText('Translation error: Standard lookup limit crossed.');
      }
    } catch (err) {
      setTranslationOutputText('Translation failed. Please check internet connections.');
    } finally {
      setIsTranslating(false);
    }
  };

  // Initialize Speech Voices when they are loaded (Chrome issues)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const languageObj = WORLDWIDE_LANGUAGES.find(l => l.code === selectedLanguage) || WORLDWIDE_LANGUAGES[0];

  return (
    <div className="space-y-6">
      
      {/* SECTION 1: SYSTEM PERMISSIONS INTEGRATION */}
      <section className="bg-[#151518] border border-zinc-850 rounded-2xl overflow-hidden shadow-lg p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="text-[9px] font-black uppercase text-pink-500 tracking-wider">Device Integrator</span>
            <h3 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-1.5 mt-0.5">
              <ShieldCheck size={16} className="text-[#00FF5A]" />
              OS-Level Permissions Board
            </h3>
          </div>
          <span className="text-[10px] bg-[#222] border border-zinc-700 px-2 py-0.5 rounded-full text-zinc-400 font-mono">
            SANDBOX BRIDGE: ENABLED
          </span>
        </div>

        <p className="text-[10px] text-zinc-400 leading-normal mb-5 border-b border-zinc-850 pb-4">
          Enable or revoke low-level desktop/mobile operations. These settings simulate native system-level API bindings (Electron IPC handles, desktop RobotJS hooks, Android Accessibility Services) to safely inspect active window handles and inject mouse vectors.
        </p>

        {/* Permissions Switches List */}
        <div className="space-y-4">
          
          {/* Permission 1: Accessibility */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-500 shrink-0 mt-0.5">
                <Cpu size={15} />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-white uppercase">1. Accessibility Service Hook</h4>
                <p className="text-[9px] text-zinc-500 mt-0.5">
                  Direct windows accessibility hook. Needed to identify active visual targets in background apps.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const nextVal = !accessibilityPermissionGranted;
                setAccessibilityPermissionGranted(nextVal);
                playPulseFeedback(nextVal);
              }}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-150 border cursor-pointer ${
                accessibilityPermissionGranted 
                  ? 'bg-[#00FF5A]/10 border-[#00FF5A]/30 text-[#00FF5A]' 
                  : 'bg-red-500/10 border-red-500/25 text-red-400 font-bold'
              }`}
            >
              {accessibilityPermissionGranted ? 'GRANTED' : 'REVOKED'}
            </button>
          </div>

          {/* Permission 2: Input Simulation */}
          <div className="flex items-start justify-between gap-4 border-t border-zinc-900 pt-3.5">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#00FF5A]/10 border border-[#00FF5A]/20 flex items-center justify-center text-[#00FF5A] shrink-0 mt-0.5">
                <Settings size={15} />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-white uppercase">2. Input Simulation & Macros</h4>
                <p className="text-[9px] text-zinc-500 mt-0.5">
                  Allows simulating mouse cursor coordinates, clicks, scrolling, and keyboard shortcuts [WASD, Space].
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const nextVal = !inputSimulationGranted;
                setInputSimulationGranted(nextVal);
                playPulseFeedback(nextVal);
              }}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-150 border cursor-pointer ${
                inputSimulationGranted 
                  ? 'bg-[#00FF5A]/10 border-[#00FF5A]/30 text-[#00FF5A]' 
                  : 'bg-red-500/10 border-red-500/25 text-red-400 font-bold'
              }`}
            >
              {inputSimulationGranted ? 'GRANTED' : 'REVOKED'}
            </button>
          </div>

          {/* Permission 3: OCR Screen scanning */}
          <div className="flex items-start justify-between gap-4 border-t border-zinc-900 pt-3.5">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                <Eye size={15} />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-white uppercase">3. Real-Time Viewport OCR scanning</h4>
                <p className="text-[9px] text-zinc-500 mt-0.5">
                  Scans target screen frame buffer pixels to locate game interfaces, obstacles, buttons, and HUD controls.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const nextVal = !screenOCRGranted;
                setScreenOCRGranted(nextVal);
                playPulseFeedback(nextVal);
              }}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-150 border cursor-pointer ${
                screenOCRGranted 
                  ? 'bg-[#00FF5A]/10 border-[#00FF5A]/30 text-[#00FF5A]' 
                  : 'bg-red-500/10 border-red-500/25 text-red-400'
              }`}
            >
              {screenOCRGranted ? 'GRANTED' : 'REVOKED'}
            </button>
          </div>

          {/* Permission 4: Terminal Command Line Binding */}
          <div className="flex items-start justify-between gap-4 border-t border-zinc-900 pt-3.5">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                <Terminal size={15} />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-white uppercase">4. CLI Daemon Binding (Advanced)</h4>
                <p className="text-[9px] text-zinc-500 mt-0.5">
                  Authorizes executing local custom bash scripts and launching local software (Chrome, FL Studio) from terminal threads.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const nextVal = !shellBindingGranted;
                setShellBindingGranted(nextVal);
                playPulseFeedback(nextVal);
              }}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-150 border cursor-pointer ${
                shellBindingGranted 
                  ? 'bg-[#00FF5A]/10 border-[#00FF5A]/30 text-[#00FF5A]' 
                  : 'bg-zinc-800 border-zinc-700 text-zinc-500'
              }`}
            >
              {shellBindingGranted ? 'GRANTED' : 'REVOKE'}
            </button>
          </div>

          {/* Permission 5: Background Idle Execution */}
          <div className="flex items-start justify-between gap-4 border-t border-zinc-905 pt-3.5">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0 mt-0.5">
                <RefreshCw size={14} />
              </div>
              <div>
                <h4 className="text-[11px] font-bold text-white uppercase">5. Background Running Thread</h4>
                <p className="text-[9px] text-zinc-500 mt-0.5">
                  Allows persistent automation (assisted gameplay, Twitter scrolling, Chrome lookup) when browser is inactive.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const nextVal = !backgroundDaemonGranted;
                setBackgroundDaemonGranted(nextVal);
                playPulseFeedback(nextVal);
              }}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-150 border cursor-pointer ${
                backgroundDaemonGranted 
                  ? 'bg-[#00FF5A]/10 border-[#00FF5A]/30 text-[#00FF5A]' 
                  : 'bg-zinc-800 border-zinc-700 text-zinc-500'
              }`}
            >
              {backgroundDaemonGranted ? 'GRANTED' : 'REVOKE'}
            </button>
          </div>

        </div>
      </section>

      {/* SECTION 2: AI SPEAKING MOOD & DYNAMIC WORLDWIDE LANGUAGE SELECTION */}
      <section className="bg-[#151518] border border-zinc-850 rounded-2xl overflow-hidden shadow-lg p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="text-[9px] font-black uppercase text-[#00FF5A] tracking-wider">Voice Sync</span>
            <h3 className="text-sm font-black text-white uppercase tracking-wide flex items-center gap-1.5 mt-0.5">
              <Volume2 size={16} className="text-pink-500" />
              AI Speaking Co-Driver
            </h3>
          </div>
          <button
            onClick={() => {
              const nextVal = !speakingModeEnabled;
              setSpeakingModeEnabled(nextVal);
              
              if (nextVal) {
                setTimeout(() => speakText('Speaking Mode Enabled. I will speak while working.', selectedLanguage, speechPitch, speechRate), 100);
              } else if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border cursor-pointer transition-all ${
              speakingModeEnabled 
                ? 'bg-pink-600 border-pink-500/20 text-white shadow-[0_0_12px_rgba(219,39,119,0.35)]' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {speakingModeEnabled ? (
              <>
                <Volume2 size={11} className="animate-bounce" />
                SPEAKING ACTIVE
              </>
            ) : (
              <>
                <VolumeX size={11} />
                MUTED
              </>
            )}
          </button>
        </div>

        <p className="text-[10px] text-zinc-400 leading-normal mb-5 border-b border-zinc-850 pb-4">
          Turn on this "Speaking Mode" features. When activated, See Vibe AI will use realistic vocal synthesis to speak answers and keep you coordinates-guided aloud in real-time as it executes tasks.
        </p>

        {/* Speaking Settings Controls */}
        <div className="space-y-4">
          
          {/* Target Language dropdown */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] text-zinc-500 uppercase font-black tracking-wider flex items-center gap-1">
              <Globe size={11} className="text-[#00FF5A]" />
              Select World Language Accent
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={selectedLanguage}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedLanguage(val);
                  
                  // Instantly speak test statement to verify accent
                  const selectedName = WORLDWIDE_LANGUAGES.find(l => l.code === val)?.name || 'Language';
                  speakText(`Accent updated to ${selectedName}`, val, speechPitch, speechRate);
                }}
                className="w-full bg-[#111] border border-zinc-800 hover:border-zinc-700 p-2.5 px-3 rounded-xl text-white text-[11px] outline-none focus:border-pink-500 font-sans custom-dropdown transition-colors cursor-pointer"
              >
                {WORLDWIDE_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name} ({lang.native})
                  </option>
                ))}
              </select>

              <div className="p-2.5 bg-[#1B1B1F] border border-zinc-850 rounded-xl flex items-center justify-between text-[10px]">
                <span className="text-zinc-500 font-mono">Accent Type:</span>
                <span className="text-[#00FF5A] font-black uppercase tracking-wider">
                  {languageObj.native} Spoken
                </span>
              </div>
            </div>
          </div>

          {/* Voice synthesis details (Sliders) */}
          <div className="grid grid-cols-2 gap-4 bg-[#111113] p-3 border border-zinc-850 rounded-xl">
            {/* Pitch */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span className="uppercase font-bold">Voice Pitch</span>
                <span className="text-pink-500 font-mono">{speechPitch.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.8"
                step="0.1"
                value={speechPitch}
                onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
                className="w-full accent-pink-500 h-1 bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>
            
            {/* Speed Rate */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] text-zinc-500">
                <span className="uppercase font-bold">Spoken Speed</span>
                <span className="text-[#00FF5A] font-mono">{speechRate.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.6"
                max="1.6"
                step="0.05"
                value={speechRate}
                onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                className="w-full accent-[#00FF5A] h-1 bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>
          </div>

          {/* Speaking Demo input */}
          <div className="flex flex-col gap-1.5 border-t border-zinc-900 pt-4">
            <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">AI Voice Tester</span>
            <div className="flex gap-2">
              <input 
                type="text"
                value={testSpeechText}
                onChange={(e) => setTestSpeechText(e.target.value)}
                placeholder="Type anything to test our vocal feedback sound..."
                className="flex-1 bg-[#111] text-xs text-white p-2.5 px-3.5 rounded-xl border border-zinc-800 focus:outline-none focus:border-pink-500"
              />
              <button
                onClick={() => handleTestSpeech()}
                disabled={!speakingModeEnabled}
                className={`p-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
                  speakingModeEnabled 
                    ? 'bg-[#00FF5A] text-black hover:bg-emerald-400' 
                    : 'bg-zinc-850 text-zinc-500 cursor-not-allowed'
                }`}
              >
                <Play size={13} fill="currentColor" />
                Speak
              </button>
            </div>
            {!speakingModeEnabled && (
              <p className="text-[8px] text-zinc-600 italic">
                * Turn on "SPEAKING ACTIVE" above to authorize speech synthesis sound tests.
              </p>
            )}
          </div>

        </div>
      </section>

      {/* SECTION 3: WORLDWIDE MULTILINGUAL TRANSLATOR & SPEAKER */}
      <section className="bg-[#151518] border border-zinc-850 rounded-2xl overflow-hidden shadow-lg p-5">
        <div className="flex items-center gap-2 mb-2">
          <Languages className="text-[#00FF5A]" size={16} />
          <h3 className="text-sm font-black text-white uppercase tracking-wide">
            Multilingual Speak Translator
          </h3>
        </div>

        <p className="text-[10px] text-zinc-400 leading-normal mb-5.5">
          Type queries or instructions in English, translate them, and speak them instantly. Perfect for operating devices in multilingual context or reading spoken coordinates translated to any worldwide dialect.
        </p>

        <div className="space-y-4">
          {/* Translation inputs wrapper */}
          <div className="space-y-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[8.5px] text-zinc-500 uppercase font-black">1. Source text (English)</span>
              <textarea
                value={translationInputText}
                onChange={(e) => setTranslationInputText(e.target.value)}
                rows={2}
                className="w-full bg-[#111113] border border-zinc-800 p-2.5 rounded-xl text-white text-[11px] font-sans outline-none focus:border-pink-500 resize-none"
                placeholder="Write any phrasing or instructions..."
              />
            </div>

            <div className="flex justify-center my-0.5">
              <button
                onClick={handleTranslateAndSpeak}
                disabled={isTranslating}
                className="py-2 px-6 rounded-xl bg-gradient-to-r from-pink-600 to-violet-600 hover:brightness-110 text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
              >
                {isTranslating ? (
                  <>
                    <RefreshCw size={11} className="animate-spin" />
                    TRANSLATING ACCENT...
                  </>
                ) : (
                  <>
                    <Sparkles size={11} className="text-[#00FF5A] animate-pulse" />
                    Translate & Speak Aloud
                  </>
                )}
              </button>
            </div>

            {translationOutputText && (
              <div className="flex flex-col gap-1.5 bg-[#111113] p-3 rounded-xl border border-zinc-850 mt-1">
                <div className="flex justify-between items-center text-[8.5px] text-zinc-500 uppercase">
                  <span>2. Translation result ({languageObj.name})</span>
                  <button 
                    onClick={() => speakText(translationOutputText, selectedLanguage, speechPitch, speechRate)}
                    className="text-pink-500 hover:underline cursor-pointer"
                  >
                    REPLAY SYNTH
                  </button>
                </div>
                <p className="text-[11px] text-[#00FF5A] font-medium leading-relaxed">
                  {translationOutputText}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

    </div>
  );
}
