import { useDawStore } from '../store/useDawStore';
import { audioEngine } from '../audio/engine';
import * as Tone from 'tone';
import { KEYS_LIST, SCALES, getNotesInScale } from '../lib/scales';
import { MusicStyle } from '../types/daw';

export interface VibeProfile {
  groove: number;        // swing & bounce
  drumDensity: number;   // how busy drums are
  bassBounce: number;    // rhythmic bass movement
  chordRichness: number; // simple → jazzy
  melodyEnergy: number;  // calm → energetic
  fxSpace: number;       // dry → wide
  tempoBias: number;     // BPM preference
}

export const burnaVibe: VibeProfile = {
  groove: 0.35,
  drumDensity: 0.6,
  bassBounce: 0.8,
  chordRichness: 0.7,
  melodyEnergy: 0.5,
  fxSpace: 0.6,
  tempoBias: 100
};

export const wizkidVibe: VibeProfile = {
  groove: 0.25,
  drumDensity: 0.4,
  bassBounce: 0.5,
  chordRichness: 0.8,
  melodyEnergy: 0.3,
  fxSpace: 0.8,
  tempoBias: 98
};

export const remaVibe: VibeProfile = {
  groove: 0.2,
  drumDensity: 0.7,
  bassBounce: 0.6,
  chordRichness: 0.4,
  melodyEnergy: 0.9,
  fxSpace: 0.7,
  tempoBias: 105
};

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function blendVibes(a: VibeProfile, b: VibeProfile, t: number): VibeProfile {
  return {
    groove: lerp(a.groove, b.groove, t),
    drumDensity: lerp(a.drumDensity, b.drumDensity, t),
    bassBounce: lerp(a.bassBounce, b.bassBounce, t),
    chordRichness: lerp(a.chordRichness, b.chordRichness, t),
    melodyEnergy: lerp(a.melodyEnergy, b.melodyEnergy, t),
    fxSpace: lerp(a.fxSpace, b.fxSpace, t),
    tempoBias: Math.round(a.tempoBias + (b.tempoBias - a.tempoBias) * t)
  };
}

export function getFinalVibe(sliderA: number, sliderB: number): VibeProfile {
  const base = blendVibes(burnaVibe, wizkidVibe, sliderA);
  return blendVibes(base, remaVibe, sliderB);
}

// Static list of highly emotional, popular, and professional chord progression scale-degree indices
const PROGRESSIONS = [
  [0, 3, 4, 3], // i - iv - v - iv (Classical & Rhythmic)
  [0, 4, 5, 3], // i - v - VI - iv (Dramatic & Atmospheric)
  [0, 2, 3, 4], // i - III - iv - v (Epic Adventure)
  [0, 5, 3, 4], // i - VI - iv - v (Soulful R&B & Afro)
  [1, 4, 0, 5], // ii - V - i - VI (Polished Jazzy Turnaround)
  [5, 4, 3, 4], // VI - v - iv - v (Epic Cinematic minor climb)
  [0, 6, 5, 4], // i - VII - VI - v (Classic Spanish Andalusian Cadence)
  [0, 3, 5, 4], // i - iv - VI - v (Emotional Wave)
];

// Memory seed refreshed on every auto-produce pipeline run to block copyright conflicts
export let sessionSeed = Math.floor(Math.random() * 1000);

export function renewCompositionSeed() {
  sessionSeed = Math.floor(Math.random() * 10000);
}

// Maps scale degree indices cleanly to exact music notes across multiple octaves
export function getScaleNotesWithOctave(rootKey: string, scaleName: string, startOctave: number = 3, numNotes: number = 24): string[] {
  const rootIndex = KEYS_LIST.indexOf(rootKey);
  const intervals = SCALES[scaleName as keyof typeof SCALES] || SCALES["Chromatic"];
  const result: string[] = [];
  
  for (let i = 0; i < numNotes; i++) {
    const scaleDegree = i % intervals.length;
    const octaveOffset = Math.floor(i / intervals.length);
    const interval = intervals[scaleDegree] + (octaveOffset * 12);
    
    const noteIndex = (rootIndex + interval) % 12;
    const addedOctave = startOctave + Math.floor((rootIndex + interval) / 12);
    
    result.push(`${KEYS_LIST[noteIndex]}${addedOctave}`);
  }
  
  return result;
}

// Deterministic progression mapped uniquely per session seed, key, and scale to ensure absolute internal harmony
export function getProgressionForProject(): number[] {
  const store = useDawStore.getState();
  const key = store.projectKey || 'C';
  const scale = store.projectScale || 'Minor';
  
  const seedString = `${key}-${scale}-${sessionSeed}`;
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = seedString.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % PROGRESSIONS.length;
  return PROGRESSIONS[index];
}

// Generates high-quality procedural loop notes on-the-fly according to the active VibeProfile
// This is critical for the "instantly update timeline ghost notes and play preview" requirement
export function generateProceduralNotesForVibe(
  synthType: string,
  vibe: VibeProfile
): { note: string; startTime: number; duration: number; velocity: number }[] {
  const notes: { note: string; startTime: number; duration: number; velocity: number }[] = [];
  const len = 32; // 2 bars (32 sixteenths)

  const store = useDawStore.getState();
  const activeStyle = store.activeStyle;
  const projectKey = store.projectKey || 'C';
  const projectScale = store.projectScale || 'Minor';

  if (synthType === 'membrane') {
    // ----------------------------------------------------
    // 1. MEMBRANE DRUMS (PROCEDURAL PERCUSSION PATTERNS)
    // ----------------------------------------------------
    
    if (activeStyle === MusicStyle.AFROBEATS) {
      // 🥁 Drum track (Kick/Snare/Rimshot/Shaker) for Afrobeat
      // Kick (consistent sub-heavy pulse, swing adjusted)
      for (let step = 0; step < len; step += 4) {
        const swingOffset = step > 0 && Math.random() < vibe.groove ? 0.5 : 0;
        notes.push({ note: 'C1', startTime: step + swingOffset, duration: 2, velocity: 0.9 });
        
        // Dynamic Syncopated Double Kick Hits
        if ((step === 4 || step === 12 || step === 20 || step === 28) && Math.random() < 0.6) {
          notes.push({ note: 'C1', startTime: step - 1.5, duration: 1, velocity: 0.5 });
        }
      }

      // Syncopated Afro Rimshots
      const rimPatterns = [
        [3, 6, 11, 14, 19, 22, 27, 30],
        [3, 10, 11, 19, 26, 27],
        [2, 3, 10, 14, 18, 19, 26, 30]
      ];
      // Select stable index based on sessionSeed hash
      const rimPatternIdx = Math.abs(sessionSeed) % rimPatterns.length;
      const rimsteps = rimPatterns[rimPatternIdx];
      
      rimsteps.forEach(step => {
        notes.push({ note: 'D1', startTime: step, duration: 1, velocity: 0.75 + (Math.random() * 0.1) });
      });

      // Shakers/Hats with dynamic swing
      const shakerSteps = [2, 6, 10, 14, 18, 22, 26, 30];
      if (vibe.drumDensity > 0.56) {
        shakerSteps.push(0, 4, 8, 12, 16, 20, 24, 28);
      }
      shakerSteps.forEach(step => {
        const isGhost = Math.random() < 0.2;
        notes.push({ note: 'F#1', startTime: step, duration: 1, velocity: isGhost ? 0.25 : 0.45 + (Math.random() * 0.1) });
      });

    } else if (activeStyle === MusicStyle.AMAPIANO) {
      // 🥁 Amapiano House Kicks (straight four-on-the-floor)
      for (let step = 0; step < len; step += 4) {
        notes.push({ note: 'C1', startTime: step, duration: 1.5, velocity: 0.9 });
      }

      // Shakers - rapid 16th subdivisions (shuffled / humanized)
      const shakerSteps = [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15, 16, 17, 19, 20, 21, 23, 24, 25, 27, 28, 29, 31];
      shakerSteps.forEach(step => {
        // Humanize velocities to give authentic rolling feels
        const vol = step % 4 === 0 ? 0.6 : (step % 2 === 0 ? 0.45 : 0.3);
        notes.push({ note: 'F#1', startTime: step, duration: 1, velocity: vol + (Math.random() * 0.08) });
      });

      // Congas & rimshots on bouncy off-beats (randomly chosen per session for originality)
      const congaPatterns = [
        [4, 10, 14, 20, 26, 30],
        [2, 6, 10, 18, 22, 26, 30],
        [4, 8, 12, 20, 24, 28]
      ];
      const selectedCongas = congaPatterns[Math.abs(sessionSeed + 1) % congaPatterns.length];
      selectedCongas.forEach(step => {
        notes.push({ note: 'D1', startTime: step, duration: 1, velocity: 0.70 });
      });

    } else if (activeStyle === MusicStyle.POP) {
      // 🥁 Modern Pop Drums (Four-on-the-floor kick, backbeat snare/claps)
      for (let step = 0; step < len; step += 4) {
        notes.push({ note: 'C1', startTime: step, duration: 1.5, velocity: 0.95 });
      }
      // Claps/snare on 4, 12, 20, 28
      const snareSteps = [4, 12, 20, 28];
      snareSteps.forEach(step => {
        notes.push({ note: 'D1', startTime: step, duration: 1, velocity: 0.88 });
      });
      // Hi-Hats pattern (8th notes pattern with alternating velocities)
      for (let step = 0; step < len; step += 2) {
        const vel = step % 4 === 0 ? 0.7 : 0.45;
        notes.push({ note: 'F#1', startTime: step, duration: 1, velocity: vel + (Math.random() * 0.08) });
      }
      // Syncopated secondary claps / ear candy rims
      if (Math.random() < 0.5) {
        notes.push({ note: 'D1', startTime: 14, duration: 1, velocity: 0.5 });
        notes.push({ note: 'D1', startTime: 30, duration: 1, velocity: 0.5 });
      }

    } else { 
      // 🥁 TRAP (Double-time half-time groove with rolling hi-hats)
      const kickSteps = [0, 8, 14, 16, 24, 26];
      kickSteps.forEach(step => {
        notes.push({ note: 'C1', startTime: step, duration: 2, velocity: 0.95 });
        // Random double kick rolls
        if (step === 24 && Math.random() < 0.65) {
          notes.push({ note: 'C1', startTime: step + 1.5, duration: 1, velocity: 0.6 });
        }
      });

      // Sharp half-time snares on 4, 12, 20, 28
      const snareSteps = [4, 12, 20, 28];
      snareSteps.forEach(step => {
        notes.push({ note: 'D1', startTime: step, duration: 1, velocity: 0.85 });
      });

      // Trap hi-hat rolling patterns
      const straightHats = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];
      straightHats.forEach(step => {
        const isHatRollInterval = (step === 10 || step === 12 || step === 26 || step === 28);
        if (isHatRollInterval && Math.random() < 0.75) {
          // Play a rapid 16th triplet hat roll
          notes.push({ note: 'F1', startTime: step, duration: 0.5, velocity: 0.70 });
          notes.push({ note: 'F1', startTime: step + 0.5, duration: 0.5, velocity: 0.60 });
          notes.push({ note: 'F1', startTime: step + 1.0, duration: 0.5, velocity: 0.75 });
        } else {
          notes.push({ note: 'F#1', startTime: step, duration: 1, velocity: 0.65 });
        }
      });
    }

  } else if (synthType === 'pluck' || synthType === 'synthbass') {
    // ----------------------------------------------------
    // 2. PLUCK BASSLINE / SYNTH BASS (SCALED & RANDOMIZED)
    // ----------------------------------------------------
    
    // Fetch absolute scale notes at Octave 1 and 2
    const scaleNotesOct1 = getScaleNotesWithOctave(projectKey, projectScale, 1, 14);
    const scaleNotesOct2 = getScaleNotesWithOctave(projectKey, projectScale, 2, 14);
    
    // Choose our deterministic chord progression degrees
    const progression = getProgressionForProject();

    // Map degrees to actual notes
    progression.forEach((degreeIndex, chordIdx) => {
      const baseTick = chordIdx * 8; // Each chord spans 8 ticks (32ths)
      const octave1Note = scaleNotesOct1[degreeIndex % scaleNotesOct1.length];
      const octave2Note = scaleNotesOct2[degreeIndex % scaleNotesOct2.length];

      if (activeStyle === MusicStyle.AFROBEATS) {
        // Afrobeat syncopated bouncy bassline
        notes.push({ note: octave2Note, startTime: baseTick, duration: 2, velocity: 0.85 });
        notes.push({ note: octave2Note, startTime: baseTick + 3, duration: 2, velocity: 0.80 });
        
        if (vibe.bassBounce > 0.4 && Math.random() < 0.7) {
          // Play a bouncy octave-up jump or fifth
          const fifthDegreeIdx = (degreeIndex + 4) % scaleNotesOct2.length;
          const jumpNote = Math.random() < 0.5 ? octave1Note : scaleNotesOct2[fifthDegreeIdx];
          notes.push({ note: jumpNote, startTime: baseTick + 5.5, duration: 1.5, velocity: 0.65 });
        } else {
          notes.push({ note: octave2Note, startTime: baseTick + 6, duration: 1.5, velocity: 0.70 });
        }

      } else if (activeStyle === MusicStyle.AMAPIANO) {
        // Amapiano sliding Log bouncers
        notes.push({ note: octave1Note, startTime: baseTick, duration: 2, velocity: 0.90 });
        notes.push({ note: octave1Note, startTime: baseTick + 3, duration: 1, velocity: 0.85 });
        
        // Sliding notes
        const slideNote = scaleNotesOct1[(degreeIndex + 2) % scaleNotesOct1.length];
        notes.push({ note: slideNote, startTime: baseTick + 4, duration: 1.5, velocity: 0.75 });
        
        if (Math.random() < 0.6) {
          notes.push({ note: octave1Note, startTime: baseTick + 6, duration: 2, velocity: 0.80 });
        }

      } else if (activeStyle === MusicStyle.POP) {
        // Pop steady groove bassline (pumping 8th notes or driving patterns on chord changes)
        notes.push({ note: octave1Note, startTime: baseTick, duration: 2, velocity: 0.85 });
        notes.push({ note: octave1Note, startTime: baseTick + 2, duration: 1.5, velocity: 0.80 });
        notes.push({ note: octave1Note, startTime: baseTick + 4, duration: 2, velocity: 0.85 });
        notes.push({ note: octave2Note, startTime: baseTick + 6, duration: 1.5, velocity: 0.70 });

      } else {
        // Trap heavy sustained sliding 808s
        notes.push({ note: octave1Note, startTime: baseTick, duration: 6, velocity: 0.95 });
        
        if (vibe.bassBounce > 0.6 && Math.random() < 0.5) {
          // Play a sliding upper register note in the middle of chords
          const slideOctaveNote = scaleNotesOct2[(degreeIndex + 4) % scaleNotesOct2.length];
          notes.push({ note: slideOctaveNote, startTime: baseTick + 6, duration: 2, velocity: 0.75 });
        }
      }
    });

  } else if (synthType === 'poly' || synthType === 'epiano' || synthType === 'organ' || synthType === 'grand' || synthType === 'rhodes') {
    // ----------------------------------------------------
    // 3. KEYBOARDS & CHORDS (HARMONIOUS SCALED CHORDS)
    // ----------------------------------------------------
    
    // Retrieve absolute scale degrees starting at Octave 3 (Chord base)
    const scaleNotes = getScaleNotesWithOctave(projectKey, projectScale, 3, 21);
    const progression = getProgressionForProject();

    progression.forEach((degreeIndex, chordIdx) => {
      const baseTick = chordIdx * 8;
      
      // Select chord extension degrees
      const chordDegrees = [degreeIndex, degreeIndex + 2, degreeIndex + 4]; // Standard Triad
      
      // Amapiano/Jazzier Richness Expansion
      if (activeStyle === MusicStyle.AMAPIANO || vibe.chordRichness > 0.4) {
        chordDegrees.push(degreeIndex + 6); // Soulful 7th
      }
      if (vibe.chordRichness > 0.7) {
        chordDegrees.push(degreeIndex + 8); // Deep 9th keys
      }

      const chordNotes = chordDegrees.map(deg => scaleNotes[deg % scaleNotes.length]);

      if (activeStyle === MusicStyle.TRAP) {
        // Slow moody atmospheric sustained keys
        chordNotes.forEach(note => {
          notes.push({ note, startTime: baseTick, duration: 7.5, velocity: 0.60 });
        });
      } else if (activeStyle === MusicStyle.AMAPIANO) {
        // Rhythmic bouncing Rhodes keys (Amapiano jazz style)
        chordNotes.forEach((note, noteIdx) => {
          // Strummed entry
          const strum = noteIdx * 0.25;
          notes.push({ note, startTime: baseTick + strum, duration: 3.5 - strum, velocity: 0.68 });
          notes.push({ note, startTime: baseTick + 4 + strum, duration: 3.5 - strum, velocity: 0.60 });
        });
      } else if (activeStyle === MusicStyle.POP) {
        // Pop clean piano/pad triad chords on the beats with light offbeat syncopation
        chordNotes.forEach((note, noteIdx) => {
          notes.push({ note, startTime: baseTick, duration: 3.5, velocity: 0.70 });
          notes.push({ note, startTime: baseTick + 4, duration: 3.5, velocity: 0.65 });
        });
      } else {
        // Triad rhythmic Afro-pads
        chordNotes.forEach((note, noteIdx) => {
          const strum = noteIdx * 0.15;
          notes.push({ note, startTime: baseTick + strum, duration: 6.5 - strum, velocity: 0.65 });
        });
      }
    });

  } else {
    // ----------------------------------------------------
    // 4. MELODIST / PLUCK LEADS (100% ORIGINAL COMPOSITIONS)
    // ----------------------------------------------------
    
    // Choose scale notes at upper octave 4/5
    const melScaleNotes = getScaleNotesWithOctave(projectKey, projectScale, 4, 18);
    const progression = getProgressionForProject();

    // Map deterministic melodic motifs based on the current sessionSeed hash
    const motifSelection = Math.abs(sessionSeed) % 3;

    if (motifSelection === 0) {
      // Harmonic arpeggiator (climbs chord tones smoothly)
      for (let chordIdx = 0; chordIdx < 4; chordIdx++) {
        const baseTick = chordIdx * 8;
        const currentChordDegree = progression[chordIdx];
        
        const arpeggioDegrees = [
          currentChordDegree,
          currentChordDegree + 2,
          currentChordDegree + 4,
          currentChordDegree + 7
        ];

        arpeggioDegrees.forEach((deg, stepIdx) => {
          const note = melScaleNotes[deg % melScaleNotes.length];
          notes.push({
            note,
            startTime: baseTick + (stepIdx * 2), // plays steps: 0, 2, 4, 6
            duration: 1.5,
            velocity: 0.72 - (stepIdx * 0.04)
          });
        });
      }
    } else if (motifSelection === 1) {
      // Syncopated lyrical leads
      const phrasingSteps = [1, 3, 5, 10, 12, 14, 18, 20, 22, 26, 28, 30];
      phrasingSteps.forEach(step => {
        const chordIdx = Math.floor(step / 8);
        const currentChordDegree = progression[chordIdx];
        
        // Randomly pull chord tone to keep it in scale harmony
        const degreesPool = [0, 2, 4, 6];
        const offset = degreesPool[Math.floor(Math.random() * degreesPool.length)];
        const note = melScaleNotes[(currentChordDegree + offset) % melScaleNotes.length];
        
        notes.push({
          note,
          startTime: step,
          duration: 1.25,
          velocity: 0.7 + (Math.random() * 0.1)
        });
      });
    } else {
      // Triplet syncopation motif
      const rhythmTicks = [2, 3, 5, 8, 10, 11, 13, 16, 18, 19, 21, 24, 26, 27, 29];
      rhythmTicks.forEach(tick => {
        const chordIdx = Math.floor(tick / 8);
        const currentChordDegree = progression[chordIdx];
        const offsetDegrees = [0, 2, 4, 7];
        const offset = offsetDegrees[Math.floor(Math.random() * offsetDegrees.length)];
        const note = melScaleNotes[(currentChordDegree + offset) % melScaleNotes.length];
        
        notes.push({
          note,
          startTime: tick,
          duration: 1.0,
          velocity: 0.65 + (Math.random() * 0.12)
        });
      });
    }
  }

  return notes;
}

// Modures the engine parameter configurations and schedules a real-time playback preselection review
export function applyVibeToEngineAndTimeline(vibe: VibeProfile) {
  try {
    const store = useDawStore.getState();
    
    // 1. Apply tempo Bias
    store.setBpm(vibe.tempoBias);
    Tone.Transport.bpm.value = vibe.tempoBias;

    // 2. Adjust mix FX properties
    const mixState = mapVibeToMix(vibe);
    applyLiveMix(mixState);
    autoEnergyMix(vibe);

    // 3. Update ghost preview notes on the target track if available, or regenerate the tracks!
    const activeTrackId = store.selectedTrackId;
    if (activeTrackId) {
      const activeTrack = store.tracks.find(t => t.id === activeTrackId);
      if (activeTrack && activeTrack.type === 'midi') {
        const firstClipId = activeTrack.clips[0];
        if (firstClipId) {
          const generated = generateProceduralNotesForVibe(activeTrack.synthType, vibe);
          const mappedNotes = generated.map((n, i) => ({
            id: `vibenote_${i}`,
            note: n.note,
            startTime: n.startTime,
            duration: n.duration,
            velocity: n.velocity,
            isGhost: true // make them visual ghost notes instantly
          }));

          store.updateClip(firstClipId, {
            notes: mappedNotes,
            isGhost: true
          });
        }
      }
    }
  } catch (err) {
    console.error('[vibeEngine] Error applying vibe:', err);
  }
}

export interface LiveMixState {
  bassLevel: number;        // maps low eq gain
  trebleLevel: number;      // maps high eq gain
  reverbAmount: number;     // reverb wet mix scale
  compressionRatio: number; // compressor ratio
  stereoWidth: number;      // chorus wet scale
  drumPunch: number;        // drum dynamic threshold
}

export function mapVibeToMix(vibe: VibeProfile): LiveMixState {
  return {
    bassLevel: vibe.bassBounce,
    trebleLevel: 1.0 - vibe.melodyEnergy,
    reverbAmount: vibe.fxSpace,
    compressionRatio: 0.5 + vibe.drumDensity,
    stereoWidth: vibe.fxSpace,
    drumPunch: vibe.groove
  };
}

export function applyLiveMix(mix: LiveMixState) {
  try {
    const store = useDawStore.getState();

    store.tracks.forEach(track => {
      const updatedFX = { ...track.fx };

      // Ensure nodes are initialized/enabled
      if (!updatedFX.eq) {
        updatedFX.eq = { enabled: true, high: 0, mid: 0, low: 0 };
      } else {
        updatedFX.eq = { ...updatedFX.eq, enabled: true };
      }

      if (!updatedFX.reverb) {
        updatedFX.reverb = { enabled: true, decay: 2.2, mix: 0.2 };
      } else {
        updatedFX.reverb = { ...updatedFX.reverb, enabled: true };
      }

      if (!updatedFX.compressor) {
        updatedFX.compressor = { enabled: true, threshold: -24, ratio: 4 };
      } else {
        updatedFX.compressor = { ...updatedFX.compressor, enabled: true };
      }

      if (!updatedFX.chorus) {
        updatedFX.chorus = { enabled: true, depth: 0.5, frequency: 1.5, delayTime: 2.5, wet: 0.1 };
      } else {
        updatedFX.chorus = { ...updatedFX.chorus, enabled: true };
      }

      // 1. Smooth Real-Time Transitions (Rule 5)
      const currentLow = updatedFX.eq.low ?? 0;
      const targetLow = lerp(-12, 12, mix.bassLevel);
      updatedFX.eq.low = currentLow + (targetLow - currentLow) * 0.15; // Smooth 15% step filter

      const currentHigh = updatedFX.eq.high ?? 0;
      const targetHigh = lerp(-12, 12, mix.trebleLevel);
      updatedFX.eq.high = currentHigh + (targetHigh - currentHigh) * 0.15;

      const currentReverb = updatedFX.reverb.mix ?? 0.2;
      const targetReverb = lerp(0.01, 0.75, mix.reverbAmount);
      updatedFX.reverb.mix = currentReverb + (targetReverb - currentReverb) * 0.15;
      updatedFX.reverb.decay = lerp(1.2, 4.0, mix.reverbAmount);

      const currentRatio = updatedFX.compressor.ratio ?? 4;
      const targetRatio = lerp(1, 16, Math.max(0, mix.compressionRatio - 0.5));
      updatedFX.compressor.ratio = currentRatio + (targetRatio - currentRatio) * 0.15;

      // Punch threshold for drums dynamics
      if (track.synthType === 'membrane' || track.name.toLowerCase().includes('drum')) {
        const targetThreshold = lerp(-12, -38, mix.drumPunch);
        const currentThreshold = updatedFX.compressor.threshold ?? -24;
        updatedFX.compressor.threshold = currentThreshold + (targetThreshold - currentThreshold) * 0.15;
      }

      // Chorus wet as stereo space expansion
      const currentChorusWet = updatedFX.chorus.wet ?? 0.1;
      const targetChorusWet = lerp(0.01, 0.65, mix.stereoWidth);
      updatedFX.chorus.wet = currentChorusWet + (targetChorusWet - currentChorusWet) * 0.15;
      updatedFX.chorus.enabled = updatedFX.chorus.wet > 0.05;

      store.updateTrack(track.id, { fx: updatedFX });
    });
  } catch (err) {
    console.warn('[vibeEngine] applyLiveMix failed:', err);
  }
}

export function autoEnergyMix(vibe: VibeProfile) {
  try {
    const store = useDawStore.getState();

    store.tracks.forEach(track => {
      const updatedFX = { ...track.fx };

      if (vibe.melodyEnergy > 0.7) {
        if (updatedFX.eq) {
          updatedFX.eq.high = Math.min((updatedFX.eq.high ?? 0) + 2.5, 12);
        }
        if (updatedFX.chorus) {
          updatedFX.chorus.wet = Math.min((updatedFX.chorus.wet ?? 0) + 0.15, 0.8);
        }
      }

      if (vibe.drumDensity > 0.7) {
        if (updatedFX.compressor) {
          updatedFX.compressor.threshold = Math.max((updatedFX.compressor.threshold ?? -24) - 4.0, -42);
          updatedFX.compressor.ratio = Math.min((updatedFX.compressor.ratio ?? 4) + 2.0, 20);
        }
      }

      if (vibe.groove > 0.3) {
        if (updatedFX.compressor) {
          updatedFX.compressor.threshold = Math.max((updatedFX.compressor.threshold ?? -24) - 2.0, -42);
        }
      }

      store.updateTrack(track.id, { fx: updatedFX });
    });
  } catch (err) {
    console.warn('[vibeEngine] autoEnergyMix failed:', err);
  }
}

export interface LivePreviewState {
  isPlaying: boolean;
  currentNotes: { note: string; startTime: number; duration: number; velocity: number }[];
  currentStyle: VibeProfile | null;
}

export class LivePreviewController {
  public state: LivePreviewState = {
    isPlaying: false,
    currentNotes: [],
    currentStyle: null
  };

  private debounceTimeout: any = null;

  public updatePreview(vibe: VibeProfile) {
    // 1. Clear previous debounce timeout for high reactive slider response
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = setTimeout(() => {
      this.state.currentStyle = vibe;
      
      // 2. Update visual ghost notes and apply vibe modifiers to active engine
      applyVibeToEngineAndTimeline(vibe);

      const store = useDawStore.getState();
      const activeTrackId = store.selectedTrackId;
      
      if (activeTrackId) {
        // 3. Keep the playhead running - only swap midi notes internally (crossfade filter keeps pop-free)
        this.crossfadePreview(activeTrackId);
        
        // Start playback if stopped/paused
        if (Tone.Transport.state !== "started") {
          try {
            if (Tone.context.state !== "running") {
              Tone.context.resume();
            }
            Tone.Transport.start();
            store.setPlaybackState("playing");
          } catch (_) {}
        }
        this.state.isPlaying = true;
      }
    }, 150); // 150ms debounce
  }

  // Pure click/pop avoidance crossfade by scaling track gain
  public crossfadePreview(trackId: string) {
    try {
      const store = useDawStore.getState();
      const track = store.tracks.find(t => t.id === trackId);
      if (!track) return;

      const originalVolume = track.volume ?? -8;
      // Fade down volume
      store.updateTrack(trackId, { volume: originalVolume - 12 });

      setTimeout(() => {
        // Restore volume over 100ms
        const currentTrack = useDawStore.getState().tracks.find(t => t.id === trackId);
        if (currentTrack) {
          store.updateTrack(trackId, { volume: originalVolume });
        }
      }, 110);
    } catch (_) {}
  }
}

export const livePreviewController = new LivePreviewController();

export interface EnergyCurve {
  intro: number;
  verse: number;
  preChorus: number;
  chorus: number;
  outro: number;
}

export const afroEnergy: EnergyCurve = {
  intro: 0.3,
  verse: 0.5,
  preChorus: 0.7,
  chorus: 1.0,
  outro: 0.4
};

export interface SongSection {
  id: string;
  name: string;
  type: 'INTRO' | 'VERSE' | 'PRE_CHORUS' | 'CHORUS' | 'OUTRO' | 'BRIDGE';
  startBar: number;
  lengthBars: number;
}

export interface SongStructure {
  sections: SongSection[];
}

export const defaultSongStructure: SongStructure = {
  sections: [
    { id: 'sec_intro', name: 'Intro Vibe', type: 'INTRO', startBar: 0, lengthBars: 4 },
    { id: 'sec_verse', name: 'Vocal Verse', type: 'VERSE', startBar: 4, lengthBars: 8 },
    { id: 'sec_prechorus', name: 'Tension Rise Build', type: 'PRE_CHORUS', startBar: 12, lengthBars: 4 },
    { id: 'sec_chorus', name: 'Chorus DROP!', type: 'CHORUS', startBar: 16, lengthBars: 8 },
    { id: 'sec_outro', name: 'Heavy Outro Out', type: 'OUTRO', startBar: 24, lengthBars: 4 },
  ]
};

// Smart Auto-detection: If Verse is followed directly by Chorus, insert a tension Pre-Chorus!
export function detectAndInsertDrops(sections: SongSection[]): SongSection[] {
  const result: SongSection[] = [];
  for (let i = 0; i < sections.length; i++) {
    const current = sections[i];
    result.push(current);
    
    const next = sections[i + 1];
    if (current.type === 'VERSE' && next && next.type === 'CHORUS') {
      result.push({
        id: `auto_pre_chorus_${Date.now()}_${i}`,
        name: 'Auto Pre-Chorus DropBuilder',
        type: 'PRE_CHORUS',
        startBar: current.startBar + current.lengthBars,
        lengthBars: 4
      });
    }
  }

  // Offset-align starting bar indexes sequentially
  let pointerBar = 0;
  return result.map(sec => {
    const aligned = { ...sec, startBar: pointerBar };
    pointerBar += sec.lengthBars;
    return aligned;
  });
}

// Adapts Drop Intesity based on Vibe Energy
export function adaptDropIntensity(vibe: VibeProfile): 'aggressive' | 'smooth' {
  return vibe.melodyEnergy > 0.7 ? 'aggressive' : 'smooth';
}

// Track previous section for timeline event emission boundaries
let lastActiveSectionId = '';

export function runAutoDropBuilderTick(
  pos16ths: number, 
  vibe: VibeProfile, 
  customStructure: SongStructure = defaultSongStructure
) {
  try {
    const currentBar = Math.floor(pos16ths / 16);
    
    // Find active section
    const activeSection = customStructure.sections.find(
      sec => currentBar >= sec.startBar && currentBar < sec.startBar + sec.lengthBars
    );

    if (!activeSection) {
      crowdSimulator.stop();
      return null;
    }

    const barIdxInSection = currentBar - activeSection.startBar;

    // Trigger visual timeline ghost overlay upon section change
    if (activeSection.id !== lastActiveSectionId) {
      lastActiveSectionId = activeSection.id;
      
      import('./timelineEvents').then(({ timelineEvents }) => {
        if (activeSection.type === 'PRE_CHORUS') {
          timelineEvents.emit({
            type: 'ShowGhostClip',
            trackId: 'master',
            ghostId: 'tension_build_zone',
            startBar: activeSection.startBar,
            length: activeSection.lengthBars,
            clipType: 'TENSION_ZONE'
          });
        } else if (activeSection.type === 'CHORUS') {
          timelineEvents.emit({
            type: 'ShowGhostClip',
            trackId: 'master',
            ghostId: 'impact_drop_zone',
            startBar: activeSection.startBar,
            length: activeSection.lengthBars,
            clipType: 'DROP_ZONE'
          });
        } else {
          timelineEvents.emit({
            type: 'RemoveGhostClip',
            ghostId: 'tension_build_zone'
          });
          timelineEvents.emit({
            type: 'RemoveGhostClip',
            ghostId: 'impact_drop_zone'
          });
        }
      });
    }

    // Process specific build-up or impact automation based on the active section type
    if (activeSection.type === 'INTRO') {
      // 🎧 Automatic Intro Hook Melody Filter Sweep
      applyIntroHookFilter(activeSection, barIdxInSection);
      crowdSimulator.setEnergy(0.02);
    } else if (activeSection.type === 'PRE_CHORUS') {
      clearIntroHookFilter();
      buildTension(activeSection, barIdxInSection, vibe);
      prepareBuildUp(activeSection, barIdxInSection, vibe);
      
      // 🔥 Crowd Energy progressive swell
      const progress = (barIdxInSection + 1) / activeSection.lengthBars;
      crowdSimulator.setEnergy(0.12 + progress * 0.48);
    } else if (activeSection.type === 'CHORUS') {
      clearIntroHookFilter();
      
      // 🎛️ Double Drop system switch-up on second half of chorus
      const isSecondHalf = barIdxInSection >= Math.floor(activeSection.lengthBars / 2);
      
      if (barIdxInSection === 0) {
        createImpactDrop(activeSection, vibe);
        // 🔥 Crowd cheering roar explosion on the drop moment
        crowdSimulator.setEnergy(1.0, 'drop');
      } else if (isSecondHalf) {
        // Double Drop trap switch up active
        applyDoubleDropSwitch(activeSection, barIdxInSection, vibe);
        crowdSimulator.setEnergy(0.4);
      } else {
        // Maintain standard high energy mixing values inside other chorus bars
        const store = useDawStore.getState();
        const mix = mapVibeToMix(vibe);
        mix.bassLevel = Math.min(mix.bassLevel * 1.25, 1.0);
        mix.drumPunch = 1.0;
        mix.stereoWidth = 1.0;
        applyLiveMix(mix);
        crowdSimulator.setEnergy(0.35);
      }
    } else {
      // Verse, Outro or other sections - restore default vibe mixed traits
      clearIntroHookFilter();
      const mix = mapVibeToMix(vibe);
      applyLiveMix(mix);
      
      if (activeSection.type === 'VERSE') {
        crowdSimulator.setEnergy(0.08);
      } else if (activeSection.type === 'OUTRO') {
        crowdSimulator.setEnergy(0.04);
      } else {
        crowdSimulator.setEnergy(0.0);
      }
    }

    return {
      activeSection,
      barIdxInSection,
      dropIntensityMode: adaptDropIntensity(vibe)
    };
  } catch (err) {
    console.error('[vibeEngine] runAutoDropBuilderTick failed:', err);
    return null;
  }
}

// 4. PRE-CHORUS TENSION BUILDER
export function buildTension(section: SongSection, barIndex: number, vibe: VibeProfile) {
  try {
    const store = useDawStore.getState();
    const mix = mapVibeToMix(vibe);

    // Anticipation: attenuate low bass slightly to create a bass vacuum
    mix.bassLevel = mix.bassLevel * 0.55; 

    // Gradually open the reverb tail (up to 0.75 wet mix) for a massive spacious wash before the drop
    const sweepIntensity = (barIndex + 1) / section.lengthBars;
    mix.reverbAmount = lerp(mix.reverbAmount, 0.78, sweepIntensity);

    // Apply modified pre-chorus tension mix
    applyLiveMix(mix);
    
    // Attenuate drum/kick volume slightly on every other beat to let the tension instruments shine
    store.tracks.forEach(track => {
      if (track.synthType === 'membrane' || track.name.toLowerCase().includes('drum')) {
        const originalVol = track.volume ?? -8;
        // Duck slightly for tension anticipation
        store.updateTrack(track.id, { volume: originalVol - 3.5 });
      }
    });
  } catch (_) {}
}

// 5. CHORUS DROP IMPACT MOMENT
let lastSubDropTime = 0;

export function createImpactDrop(section: SongSection, vibe: VibeProfile) {
  try {
    const store = useDawStore.getState();
    const mix = mapVibeToMix(vibe);

    // FULL ENERGY RESET & IMPACT MAXIMUMS!
    mix.bassLevel = 1.0;
    mix.drumPunch = 1.0;
    mix.reverbAmount = 0.15; // instanly tighten space for razor-sharp punchy direct transient impact
    mix.stereoWidth = 1.0;   // Widen stereo field massively for massive chorus width!
    mix.compressionRatio = 1.0; // tight punchy dynamic squeeze

    applyLiveMix(mix);

    // Re-enable and boost all tracks (unmute, maximize volume and thickeners)
    store.tracks.forEach(track => {
      // Re-introduce full drum kit
      if (track.synthType === 'membrane' || track.name.toLowerCase().includes('drum')) {
        store.updateTrack(track.id, { volume: -4.0, muted: false });
      }
      
      // Thicken chords logic: add wide chorus spread and extra mid EQ boost!
      if (track.synthType === 'poly' || track.name.toLowerCase().includes('chord')) {
        const updatedFX = { ...track.fx };
        if (updatedFX.chorus) {
          updatedFX.chorus.wet = 0.75;
          updatedFX.chorus.enabled = true;
        }
        if (updatedFX.eq) {
          updatedFX.eq.mid = Math.min((updatedFX.eq.mid ?? 0) + 3.0, 12);
          updatedFX.eq.high = Math.min((updatedFX.eq.high ?? 0) + 1.5, 12);
        }
        store.updateTrack(track.id, { fx: updatedFX, volume: (track.volume ?? -10) + 1.5 });
      }
    });

    // Sub Drop Sweep: synthesize low sub bass drop sine sweep tone
    const now = Date.now();
    if (now - lastSubDropTime > 5000) {
      lastSubDropTime = now;
      const osc = new Tone.Oscillator({
        frequency: 90,
        type: 'sine',
        volume: -6
      }).toDestination();
      
      osc.start();
      // Downward frequency sweep from 90Hz to 30Hz inside 1.2 seconds (massive dynamic feel!)
      osc.frequency.rampTo(28, 1.2);
      osc.volume.rampTo(-40, 1.4);
      setTimeout(() => {
        osc.stop();
        osc.dispose();
      }, 1500);
    }
  } catch (err) {
    console.warn('[vibeEngine] createImpactDrop error:', err);
  }
}

// 7. BUILD UP AUTOMATION
export function prepareBuildUp(section: SongSection, barIndex: number, vibe: VibeProfile) {
  try {
    const store = useDawStore.getState();
    const intensityFactor = (barIndex + 1) / section.lengthBars; // from 0.25 to 1.0

    // Increase hi-hat speed speed, riser sweeps, and reduce kick density based on bar position
    store.tracks.forEach(track => {
      // Riser Intensity: automate HighPass filter sweep upwards on plucks or synth leads
      if (track.synthType === 'pluck' || track.name.toLowerCase().includes('melody') || track.name.toLowerCase().includes('pad')) {
        const updatedFX = { ...track.fx };
        if (!updatedFX.highpass) {
          updatedFX.highpass = { enabled: true, frequency: 150, Q: 1.2 };
        } else {
          updatedFX.highpass = { ...updatedFX.highpass, enabled: true };
        }
        // sweep highpass filter from 150Hz up to 1300Hz to roll off low end create a riser build
        updatedFX.highpass.frequency = lerp(150, 1300, intensityFactor);
        store.updateTrack(track.id, { fx: updatedFX });
      }

      // Reduce kick density for the drop suspense (the final bar before drop)
      if (track.synthType === 'membrane' || track.name.toLowerCase().includes('drum')) {
        const firstClipId = track.clips[0];
        if (firstClipId) {
          const notes = store.clips[firstClipId]?.notes || [];
          if (notes.length > 0) {
            // If it is the last bar (barIndex === section.lengthBars - 1), remove kick notes entirely for total suspense pause!
            const isSuspenseFinalBar = (barIndex === section.lengthBars - 1);
            const filteredNotes = notes.map(n => {
              if (isSuspenseFinalBar && n.note === 'C1') {
                // Mute kick notes by minimizing velocity to 0!
                return { ...n, velocity: 0.0 };
              }
              return n;
            });
            store.updateClip(firstClipId, { notes: filteredNotes });
          }
        }
      }
    });
  } catch (_) {}
}

// 1. CROWD ENERGY SIMULATOR (CLUB MODE)
class CrowdEnergySimulator {
  private noise: any = null;
  private filter: any = null;
  private initialized = false;

  init() {
    if (this.initialized) return;
    try {
      this.noise = new Tone.Noise("pink");
      this.filter = new Tone.Filter({
        type: "lowpass",
        frequency: 240,
        Q: 1.0
      });
      this.noise.connect(this.filter);
      this.filter.toDestination();
      this.noise.volume.value = -95; // quiet initially
      this.noise.start();
      this.initialized = true;
    } catch (_) {}
  }

  setEnergy(level: number, type?: string) {
    this.init();
    if (!this.noise || !this.filter) return;
    try {
      const targetFreq = 160 + level * 1400;
      this.filter.frequency.rampTo(targetFreq, 0.5);

      let targetVol = -95 + level * 71; // range from -95 to -24dB
      if (type === 'drop') {
        targetVol = -15; // louder on drop
      }
      this.noise.volume.rampTo(targetVol, 0.4);

      if (type === 'drop') {
        setTimeout(() => {
          if (this.noise) {
            this.noise.volume.rampTo(-28, 2.5);
          }
        }, 500);
      }
    } catch (_) {}
  }

  stop() {
    if (this.noise) {
      try {
        this.noise.volume.rampTo(-95, 0.5);
      } catch (_) {}
    }
  }

  dispose() {
    if (this.noise) { this.noise.dispose(); this.noise = null; }
    if (this.filter) { this.filter.dispose(); this.filter = null; }
    this.initialized = false;
  }
}

export const crowdSimulator = new CrowdEnergySimulator();

// 2. INTRO HOOK MELODY FILTER SWEEP
export function applyIntroHookFilter(section: SongSection, barIndex: number) {
  try {
    const store = useDawStore.getState();
    const progress = (barIndex + 1) / section.lengthBars;

    store.tracks.forEach(track => {
      if (track.synthType === 'poly' || track.synthType === 'pluck' || track.name.toLowerCase().includes('lead') || track.name.toLowerCase().includes('melody')) {
        const updatedFX = { ...track.fx };
        if (!updatedFX.lowpass) {
          updatedFX.lowpass = { enabled: true, frequency: 300, Q: 1.0 };
        } else {
          updatedFX.lowpass = { ...updatedFX.lowpass, enabled: true };
        }
        updatedFX.lowpass.frequency = lerp(280, 1600, progress);
        store.updateTrack(track.id, { fx: updatedFX });
      }
    });
  } catch (_) {}
}

export function clearIntroHookFilter() {
  try {
    const store = useDawStore.getState();
    store.tracks.forEach(track => {
      if (track.fx?.lowpass?.enabled) {
        const updatedFX = { ...track.fx };
        if (updatedFX.lowpass) {
          updatedFX.lowpass.enabled = false;
        }
        store.updateTrack(track.id, { fx: updatedFX });
      }
    });
  } catch (_) {}
}

// 3. DOUBLE CHORUS DROP (AFROBEATS - TRAP SWITCH-UP)
export function applyDoubleDropSwitch(section: SongSection, barIndex: number, vibe: VibeProfile) {
  try {
    const store = useDawStore.getState();
    const mix = mapVibeToMix(vibe);

    // Maximize sub rumbles & hats sparkle
    mix.bassLevel = Math.min(mix.bassLevel * 1.45, 1.0);
    mix.trebleLevel = Math.min(mix.trebleLevel * 1.35, 1.0);
    mix.drumPunch = 1.0;
    mix.compressionRatio = 1.0;

    applyLiveMix(mix);

    store.tracks.forEach(track => {
      if (track.synthType === 'membrane' || track.name.toLowerCase().includes('drum')) {
        const updatedFX = { ...track.fx };
        if (updatedFX.compressor) {
          updatedFX.compressor.threshold = -38;
          updatedFX.compressor.ratio = 16;
        }
        store.updateTrack(track.id, { fx: updatedFX, volume: -1.5 });
      }
    });
  } catch (_) {}
}

// 4. AI DROP-POINT DESIGNATION DECISION ENGINE
export function aiDetermineOptimalDrops(tracks: any[]): SongStructure {
  if (!tracks || tracks.length === 0) {
    return defaultSongStructure;
  }

  let foundVocal = false;
  tracks.forEach(t => {
    if (t.name.toLowerCase().includes('vocal') || t.name.toLowerCase().includes('voice')) {
      foundVocal = true;
    }
  });

  const sections: SongSection[] = [
    { id: 'sec_intro', name: 'Intro Hook Preview 🎧', type: 'INTRO', startBar: 0, lengthBars: 4 },
    { id: 'sec_verse', name: foundVocal ? 'AI Vocal Verse 🎙️' : 'AI Verse Groove 🌊', type: 'VERSE', startBar: 4, lengthBars: 8 },
    { id: 'sec_prechorus', name: 'AI Tension Build 🔥', type: 'PRE_CHORUS', startBar: 12, lengthBars: 4 },
    { id: 'sec_chorus', name: 'AI CHORUS DROP! 💥', type: 'CHORUS', startBar: 16, lengthBars: 8 },
    { id: 'sec_bridge', name: 'AI Breakdown Bridge 🎷', type: 'BRIDGE', startBar: 24, lengthBars: 8 },
    { id: 'sec_outro', name: 'AI Club Outro 🏎️', type: 'OUTRO', startBar: 32, lengthBars: 4 },
  ];

  return { sections };
}

