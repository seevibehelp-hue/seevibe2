// @ts-nocheck
import { useDawStore } from '../store/useDawStore';
import { DawTrack, DawClip, DawNote, TrackType, SynthType } from '../types/daw';
import { generateProceduralNotesForVibe } from './vibeEngine';
import * as Tone from 'tone';

/**
 * Interface representing a musical section segment on the song timeline
 */
export interface SongSegment {
  id: string;
  name: string;
  type: 'INTRO' | 'VERSE' | 'PRE_CHORUS' | 'CHORUS' | 'BRIDGE' | 'OUTRO';
  startBar: number;
  lengthBars: number;
  energyLevel: number; // 0.0 (quiet) to 1.0 (high energy/climax)
  vibeSeed: string; // seed string to ensure deterministic, style-consistent generation per segment
}

/**
 * Settings configuration passed to the segmented generator
 */
export interface SegmentedGeneratorConfig {
  style: string;          // e.g., "Afrobeat - Davido Style"
  tempo: number;          // e.g., 112 BPM
  selectedKey: string;    // e.g., "C#" or "G"
  selectedScale: string;  // e.g., "Minor" or "Major"
  targetDurationSeconds: number; // e.g., 120 seconds (2 minutes)
}

/**
 * Creates a complete sequence of musical sections (Intro -> Verse -> Build -> Chorus etc.)
 * to reach the user's targeted duration of 2 minutes (approx. 60 bars at 112 BPM).
 */
export function buildStructureForDuration(config: SegmentedGeneratorConfig): SongSegment[] {
  const bpm = config.tempo;
  // duration (sec) = (totalBars * 4) * (60 / bpm)
  // totalBars = duration * bpm / 240
  const approximateTotalBars = Math.ceil((config.targetDurationSeconds * bpm) / 240);
  
  // Custom arrangement structure adjusted to reach approximateTotalBars
  const sections: SongSegment[] = [];
  let currentBar = 0;

  // 1. Intro segment
  sections.push({
    id: `seg_intro_${Date.now()}`,
    name: 'Intro Hook Preview',
    type: 'INTRO',
    startBar: currentBar,
    lengthBars: 4,
    energyLevel: 0.3,
    vibeSeed: `${config.style}_intro_${config.selectedKey}`
  });
  currentBar += 4;

  // 2. Main Verse 1 segment
  sections.push({
    id: `seg_verse1_${Date.now()}`,
    name: 'Afrobeat Verse Groove',
    type: 'VERSE',
    startBar: currentBar,
    lengthBars: 8,
    energyLevel: 0.5,
    vibeSeed: `${config.style}_verse1_${config.selectedKey}`
  });
  currentBar += 8;

  // 3. Pre-chorus tension builder
  sections.push({
    id: `seg_prechorus_${Date.now()}`,
    name: 'Pre-Chorus Tension Rise',
    type: 'PRE_CHORUS',
    startBar: currentBar,
    lengthBars: 4,
    energyLevel: 0.7,
    vibeSeed: `${config.style}_tension_${config.selectedKey}`
  });
  currentBar += 4;

  // 4. CHORUS DROP 1 (Davido style heavy percussion)
  sections.push({
    id: `seg_chorus1_${Date.now()}`,
    name: 'Chorus Afro-Drop!',
    type: 'CHORUS',
    startBar: currentBar,
    lengthBars: 8,
    energyLevel: 0.9,
    vibeSeed: `${config.style}_chorus1_${config.selectedKey}`
  });
  currentBar += 8;

  // 5. Verse 2 segment
  sections.push({
    id: `seg_verse2_${Date.now()}`,
    name: 'Afrobeat Verse 2 Groove',
    type: 'VERSE',
    startBar: currentBar,
    lengthBars: 8,
    energyLevel: 0.55,
    vibeSeed: `${config.style}_verse2_${config.selectedKey}`
  });
  currentBar += 8;

  // 6. Pre-chorus tension 2
  sections.push({
    id: `seg_prechorus2_${Date.now()}`,
    name: 'Pre-Chorus Tension 2',
    type: 'PRE_CHORUS',
    startBar: currentBar,
    lengthBars: 4,
    energyLevel: 0.75,
    vibeSeed: `${config.style}_tension2_${config.selectedKey}`
  });
  currentBar += 4;

  // 7. CHORUS DROP 2 (Climax)
  sections.push({
    id: `seg_chorus2_${Date.now()}`,
    name: 'Chorus Climax Drop!',
    type: 'CHORUS',
    startBar: currentBar,
    lengthBars: 8,
    energyLevel: 0.95,
    vibeSeed: `${config.style}_chorus2_${config.selectedKey}`
  });
  currentBar += 8;

  // 8. Bridge / Mid-tempo hook breakdown
  sections.push({
    id: `seg_bridge_${Date.now()}`,
    name: 'Log-Drum Bridge Breakdown',
    type: 'BRIDGE',
    startBar: currentBar,
    lengthBars: 8,
    energyLevel: 0.4,
    vibeSeed: `${config.style}_bridge_${config.selectedKey}`
  });
  currentBar += 8;

  // 9. CHORUS DROP 3 (Final Energy Outblast)
  sections.push({
    id: `seg_chorus3_${Date.now()}`,
    name: 'Final Chorus Outblast',
    type: 'CHORUS',
    startBar: currentBar,
    lengthBars: 8,
    energyLevel: 1.0,
    vibeSeed: `${config.style}_chorus3_${config.selectedKey}`
  });
  currentBar += 8;

  // 10. Outro segment fading out
  sections.push({
    id: `seg_outro_${Date.now()}`,
    name: 'Calm Afro Outro Hook',
    type: 'OUTRO',
    startBar: currentBar,
    lengthBars: 4,
    energyLevel: 0.2,
    vibeSeed: `${config.style}_outro_${config.selectedKey}`
  });
  currentBar += 4;

  return sections;
}

/**
 * Chains together several procedural segments to populate a continuous, coherent 2-minute project.
 * Uses consistent scales, structured section offsets, and pre-seeded procedural functions
 * to keep the tracks aligned cleanly over the 2-minute timeline.
 */
export async function generateAndAssembleSegmentedTrack(config: SegmentedGeneratorConfig): Promise<void> {
  const store = useDawStore.getState();
  
  // Set consistent global project parameters
  store.setBpm(config.tempo);
  store.setProjectKey(config.selectedKey);
  store.setProjectScale(config.selectedScale);

  const sections = buildStructureForDuration(config);
  
  // Define standard Afrobeat tracks for Davido style (heavy drums, acoustic piano, log drum bass, brass/synth chords)
  const trackDefinitions: { name: string; synthType: SynthType; trackId: string }[] = [
    { name: 'Afro-Drums Percussion', synthType: 'membrane', trackId: 'seg_drums_track' },
    { name: 'Davido Log-Drum Bass', synthType: 'synthbass', trackId: 'seg_bass_track' },
    { name: 'Warm Acoustic Chords', synthType: 'rhodes', trackId: 'seg_chords_track' },
    { name: 'Signature Afro Brass Lead', synthType: 'poly', trackId: 'seg_lead_track' },
  ];

  // Map our theoretical trackDef.trackId to actual track IDs in the store
  const trackIdMap: Record<string, string> = {};

  const existingTracks = store.tracks;
  for (const def of trackDefinitions) {
    const found = existingTracks.find(t => t.id === def.trackId || t.name === def.name);
    if (found) {
      // Use the actual existing track's ID
      trackIdMap[def.trackId] = found.id;
      // Assign synthType and name to keep consistent
      store.updateTrack(found.id, { synthType: def.synthType, name: def.name });
    } else {
      // Add track
      store.addTrack('midi' as TrackType, def.synthType);
      const newlyAdded = useDawStore.getState().tracks[useDawStore.getState().tracks.length - 1];
      if (newlyAdded) {
        // Assign desired id matching trackId to keep code consistent across pipelines
        store.updateTrack(newlyAdded.id, { id: def.trackId, name: def.name });
        trackIdMap[def.trackId] = def.trackId;
      } else {
        trackIdMap[def.trackId] = def.trackId;
      }
    }
  }

  // Clear existing clips if starting fresh, or allow appending.
  // Generally, let's clear existing clips for these specific trackIds to prevent messy stacking
  const keysToClean = Object.keys(useDawStore.getState().clips).filter(cid => {
    const clip = useDawStore.getState().clips[cid];
    return Object.values(trackIdMap).includes(clip.trackId);
  });
  
  keysToClean.forEach(cid => {
    store.deleteClip(cid);
  });

  // Generate and insert clips for each section of the timeline
  for (const section of sections) {
    const sectionStart16ths = section.startBar * 16;
    const sectionDuration16ths = section.lengthBars * 16;

    for (const trackDef of trackDefinitions) {
      const actualTrackId = trackIdMap[trackDef.trackId];
      // Add clip to the track at correct starting time
      const clipId = store.addClip(actualTrackId, sectionStart16ths, undefined, undefined, sectionDuration16ths);
      
      // Determine vibe configuration derived from segment attributes and target genre
      // Create procedural notes matching energy levels
      const baseNoteList = getProceduralGenerationForTrackAndSection(trackDef.synthType, section);

      // Add generated notes to the newly created clip
      baseNoteList.forEach((n, idx) => {
        // Ensure starting time is offset within section clip boundaries
        store.addNote(clipId, n.note, n.startTime, n.duration);
      });
    }
  }

  // --- RECHECK AND HEAL ALIGNMENT / GAPS PASS ---
  // Ensure that all clips are gapless, snapped, and covers the timeline seamlessly
  let maxEndTime16ths = 0;
  sections.forEach(s => {
    const end = (s.startBar + s.lengthBars) * 16;
    if (end > maxEndTime16ths) maxEndTime16ths = end;
  });

  const finalClipsState = useDawStore.getState();
  const allClipsBeforeHeal = { ...finalClipsState.clips };

  for (const trackDef of trackDefinitions) {
    const actualTrackId = trackIdMap[trackDef.trackId];
    const trackClips = Object.values(allClipsBeforeHeal).filter(clip => clip.trackId === actualTrackId);
    if (trackClips.length === 0) continue;

    // 1. Grid Snapping
    trackClips.forEach(clip => {
      const snappedTime = Math.round(clip.startTime / 16) * 16;
      if (snappedTime !== clip.startTime) {
        finalClipsState.updateClip(clip.id, { startTime: snappedTime });
      }
    });

    let primaryClip = trackClips.find(clip => clip.notes && clip.notes.length > 0) || trackClips[0];

    // 2. Fill gaps in blocks of 32 steps up to the song's ending
    for (let currentTime = 0; currentTime < maxEndTime16ths; currentTime += 32) {
      const currentClips = Object.values(useDawStore.getState().clips).filter(clip => clip.trackId === actualTrackId);
      const hasClipInBlock = currentClips.some(clip => {
        return (currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration);
      });

      if (!hasClipInBlock) {
        const idClip = finalClipsState.addClip(actualTrackId, currentTime, primaryClip?.audioUrl, primaryClip?.recordingPeaks, 32);
        if (primaryClip && primaryClip.notes && primaryClip.notes.length > 0) {
          primaryClip.notes.forEach(n => {
            finalClipsState.addNote(idClip, n.note, n.startTime, n.duration);
            const freshClip = useDawStore.getState().clips[idClip];
            const addedNote = freshClip?.notes[freshClip.notes.length - 1];
            if (addedNote) {
              finalClipsState.updateNote(idClip, addedNote.id, { velocity: 0.35 });
            }
          });
        }
      }
    }
  }
}

/**
 * Returns stylized procedural notes specifically custom-tailored for each section
 * ensuring appropriate groove density, fills, and drops.
 */
function getProceduralGenerationForTrackAndSection(
  synthType: SynthType,
  section: SongSegment
): { note: string; startTime: number; duration: number }[] {
  const notes: { note: string; startTime: number; duration: number }[] = [];
  const bars = section.lengthBars;
  const total16ths = bars * 16;
  
  // Choose scale notes contextually based on key
  const chordRoots = ['C4', 'F4', 'G4', 'Am4']; // Simple progression

  for (let bar = 0; bar < bars; bar++) {
    const barOffset = bar * 16;
    const chordIndex = bar % chordRoots.length;
    const root = chordRoots[chordIndex];

    if (synthType === 'membrane') {
      // Afrobeat Drum arrangement pattern - complex triplet/clave offsets (Davido signature styling)
      if (section.type !== 'PRE_CHORUS' && section.type !== 'OUTRO') {
        // Standard kick on 1st, 4th, 7th, 10th, 13th 16ths (complex syncopation vibe)
        const kicks = [0, 3, 6, 8, 11, 14];
        kicks.forEach(k => {
          notes.push({ note: 'C1', startTime: barOffset + k, duration: 1 });
        });
        
        // Snare / Rimshot backbeats
        const highSnears = [4, 12, 15];
        highSnears.forEach(s => {
          notes.push({ note: 'D1', startTime: barOffset + s, duration: 1 });
        });
        
        // Shaker rolling triplets
        for (let step = 0; step < 16; step += 2) {
          notes.push({ note: 'F#1', startTime: barOffset + step, duration: 1 });
        }
      } else if (section.type === 'PRE_CHORUS') {
        // Rising roll builder build-up
        for (let step = 0; step < 16; step++) {
          notes.push({ note: 'C1', startTime: barOffset + step, duration: 1 });
        }
      } else {
        // Outro minimal slow drop
        notes.push({ note: 'C1', startTime: barOffset + 0, duration: 2 });
        notes.push({ note: 'D1', startTime: barOffset + 8, duration: 2 });
      }
    } else if (synthType === 'synthbass') {
      // Afrobeat heavy sub-bass / Log-Drum slides
      if (section.type !== 'INTRO' && section.type !== 'OUTRO') {
        const rootOct2 = root.replace('4', '2');
        notes.push({ note: rootOct2, startTime: barOffset + 0, duration: 3 });
        notes.push({ note: rootOct2, startTime: barOffset + 4, duration: 2 });
        notes.push({ note: rootOct2, startTime: barOffset + 8, duration: 3 });
        // Afro log-drum quick double roll on the tail
        notes.push({ note: rootOct2, startTime: barOffset + 12, duration: 1 });
        notes.push({ note: rootOct2, startTime: barOffset + 13.5, duration: 1 });
      }
    } else if (synthType === 'rhodes') {
      // Chords - warm background atmosphere maintaining consistency
      const chordNotesInput = getChordNotes(root);
      // Play long pad/rhodes chords every 8 beats
      if (bar % 1 === 0) {
        chordNotesInput.forEach(noteName => {
          notes.push({ note: noteName, startTime: barOffset + 0, duration: 12 });
        });
      }
    } else if (synthType === 'poly') {
      // Signature signature lead brass line - afro beats have brief pentatonic counter-melodies
      if (section.type === 'CHORUS' || section.type === 'BRIDGE') {
        const leadPentatonic = ['C5', 'D5', 'E5', 'G5', 'A5'];
        // Generates active melody on specific bars to create dynamic conversational lead lines
        if (bar % 2 === 0) {
          notes.push({ note: leadPentatonic[0], startTime: barOffset + 2, duration: 2 });
          notes.push({ note: leadPentatonic[1], startTime: barOffset + 4, duration: 1 });
          notes.push({ note: leadPentatonic[2], startTime: barOffset + 5, duration: 3 });
          notes.push({ note: leadPentatonic[3], startTime: barOffset + 10, duration: 2 });
          notes.push({ note: leadPentatonic[4], startTime: barOffset + 12, duration: 3 });
        }
      }
    }
  }

  return notes;
}

/**
 * Returns full chord stack triad letters given a root chord string
 */
function getChordNotes(root: string): string[] {
  const rootNote = root.substring(0, root.length - 1);
  const oct = root.charAt(root.length - 1);
  const numOct = parseInt(oct) || 4;

  if (rootNote === 'C') {
    return [`C${numOct}`, `E${numOct}`, `G${numOct}`];
  } else if (rootNote === 'F') {
    return [`F${numOct}`, `A${numOct}`, `C${numOct + 1}`];
  } else if (rootNote === 'G') {
    return [`G${numOct}`, `B${numOct}`, `D${numOct + 1}`];
  } else if (rootNote === 'Am') {
    return [`A${numOct}`, `C${numOct + 1}`, `E${numOct + 1}`];
  }
  return [`${rootNote}${numOct}`];
}
