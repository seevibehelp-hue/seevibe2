// @ts-nocheck
import { VocalNote } from './vocalAnalysis';
import { SongStructure, SongSection } from '../utils/vibeEngine';
import { useDawStore } from '../store/useDawStore';
import * as Tone from 'tone';

export interface VocalPhrase {
  startTime16ths: number;
  endTime16ths: number;
  length16ths: number;
  averageLoudness: number;
  pitchVariance: number;
  noteDensity: number; // notes per 16th
}

/**
 * High-performance Worker or Async-Processor for Music Information Retrieval (MIR).
 * Analyzes raw vocal data, extracts dynamic phrases, detects energy thresholds
 * to categorize block structures (Verse/Chorus), and maps them back to the sequencer timeline.
 */
export class VocalAnalyzerProcessor {

  /**
   * Group individual vocal notes/grains into major vocal phrases based on silence intervals.
   */
  public static detectPhrases(notes: VocalNote[], totalLength16ths: number): VocalPhrase[] {
    if (notes.length === 0) return [];

    const phrases: VocalPhrase[] = [];
    let currentPhraseNotes: VocalNote[] = [];
    const maxSilence16ths = 8; // 2 beats of silence splits a phrase

    const sortedNotes = [...notes].sort((a, b) => a.startTime - b.startTime);

    for (let i = 0; i < sortedNotes.length; i++) {
      const note = sortedNotes[i];
      if (note.isSilence) continue;

      if (currentPhraseNotes.length === 0) {
        currentPhraseNotes.push(note);
      } else {
        const lastNote = currentPhraseNotes[currentPhraseNotes.length - 1];
        const gap = note.startTime - (lastNote.startTime + lastNote.duration);
        
        if (gap > maxSilence16ths) {
          // Close active phrase
          phrases.push(this.buildPhraseFromNotes(currentPhraseNotes));
          currentPhraseNotes = [note];
        } else {
          currentPhraseNotes.push(note);
        }
      }
    }

    if (currentPhraseNotes.length > 0) {
      phrases.push(this.buildPhraseFromNotes(currentPhraseNotes));
    }

    return phrases;
  }

  private static buildPhraseFromNotes(notes: VocalNote[]): VocalPhrase {
    const startTime16ths = notes[0].startTime;
    const lastNote = notes[notes.length - 1];
    const endTime16ths = lastNote.startTime + lastNote.duration;
    const length16ths = endTime16ths - startTime16ths;

    // Calculate metadata indicators
    let totalLoudness = 0;
    const midis: number[] = [];

    notes.forEach(n => {
      totalLoudness += n.loudness || 0;
      midis.push(n.midi);
    });

    const averageLoudness = totalLoudness / notes.length;

    // Standard deviation for pitch variance
    const meanMidi = midis.reduce((a, b) => a + b, 0) / midis.length;
    const variance = midis.reduce((s, m) => s + Math.pow(m - meanMidi, 2), 0) / midis.length;

    return {
      startTime16ths,
      endTime16ths,
      length16ths,
      averageLoudness,
      pitchVariance: Math.sqrt(variance),
      noteDensity: notes.length / (length16ths || 1)
    };
  }

  /**
   * Translates detected vocal phrases into a structural SongStructure timeline.
   * Maps quiet introductory segments to INSTROS, sparse vocals to VERSES,
   * high-energy/pitch-dense sections to CHORUSES, and build-ups to PRE-CHORUSES.
   */
  public static mapPhrasesToSongStructure(
    phrases: VocalPhrase[],
    totalDuration16ths: number
  ): SongStructure {
    const totalBars = Math.max(16, Math.ceil(totalDuration16ths / 16));
    const sections: SongSection[] = [];

    if (phrases.length === 0) {
      // Default placeholder if vocal is pure silent
      return {
        sections: [
          { id: 'sec_intro', name: 'Intro Vibe', type: 'INTRO', startBar: 0, lengthBars: 4 },
          { id: 'sec_verse', name: 'Vocal Verse', type: 'VERSE', startBar: 4, lengthBars: 8 },
          { id: 'sec_prechorus', name: 'Tension Rise Build', type: 'PRE_CHORUS', startBar: 12, lengthBars: 4 },
          { id: 'sec_chorus', name: 'Chorus DROP!', type: 'CHORUS', startBar: 16, lengthBars: 8 },
          { id: 'sec_outro', name: 'Heavy Outro Out', type: 'OUTRO', startBar: 24, lengthBars: 4 },
        ]
      };
    }

    // Determine the average loudness and density to set split references
    const allLoudness = phrases.map(p => p.averageLoudness);
    const avgLoudnessThreshold = allLoudness.reduce((a, b) => a + b, 0) / phrases.length;

    let currentBar = 0;

    // Start with Intro
    sections.push({
      id: 'vocal_sec_intro',
      name: 'Vocal Intro Preview',
      type: 'INTRO',
      startBar: 0,
      lengthBars: 4
    });
    currentBar = 4;

    phrases.forEach((phrase, idx) => {
      const phraseStartBar = Math.floor(phrase.startTime16ths / 16);
      const phraseLengthBars = Math.max(2, Math.ceil(phrase.length16ths / 16));

      // Fit empty spaces with Verse or Tension transitions
      if (phraseStartBar > currentBar) {
        const gapBars = phraseStartBar - currentBar;
        sections.push({
          id: `vocal_gap_${idx}`,
          name: gapBars >= 4 ? 'Groove Build' : 'Rhythmic Tension',
          type: gapBars >= 4 ? 'VERSE' : 'PRE_CHORUS',
          startBar: currentBar,
          lengthBars: gapBars
        });
        currentBar = phraseStartBar;
      }

      // Classify this phrase
      let type: 'VERSE' | 'CHORUS' | 'PRE_CHORUS' = 'VERSE';
      let name = `Vocal Verse Phrase ${idx + 1}`;

      const highEnergy = phrase.averageLoudness > avgLoudnessThreshold || phrase.noteDensity > 0.45;
      const dramaticPitch = phrase.pitchVariance > 2.5;

      if (highEnergy && dramaticPitch) {
        type = 'CHORUS';
        name = `Vocal Chorus DROP! 🎙️`;
      } else if (highEnergy) {
        type = 'CHORUS';
        name = `Vocal Chorus Phrase`;
      } else if (dramaticPitch && phrase.length16ths <= 16) {
        type = 'PRE_CHORUS';
        name = `Build-Up Bridge`;
      }

      sections.push({
        id: `vocal_sec_${idx}_${type}`,
        name,
        type,
        startBar: currentBar,
        lengthBars: phraseLengthBars
      });

      currentBar += phraseLengthBars;
    });

    // Add Outro to finish
    sections.push({
      id: 'vocal_sec_outro',
      name: 'Vocal Outro Decay',
      type: 'OUTRO',
      startBar: currentBar,
      lengthBars: 4
    });

    return {
      sections: this.cleanAndSettleSections(sections)
    };
  }

  private static cleanAndSettleSections(sections: SongSection[]): SongSection[] {
    // Settle overlaps and sanitize ordering
    let pointerBar = 0;
    return sections.map((sec, idx) => {
      const sanitized = {
        ...sec,
        startBar: pointerBar
      };
      pointerBar += sec.lengthBars;
      return sanitized;
    });
  }
}