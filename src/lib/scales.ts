// @ts-nocheck

export const KEYS_LIST = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export const SCALES = {
  "Chromatic": [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  "Major": [0, 2, 4, 5, 7, 9, 11],
  "Minor": [0, 2, 3, 5, 7, 8, 10],
  "Dorian": [0, 2, 3, 5, 7, 9, 10],
  "Mixolydian": [0, 2, 4, 5, 7, 9, 10],
  "Pentatonic Major": [0, 2, 4, 7, 9],
  "Pentatonic Minor": [0, 3, 5, 7, 10],
};

export function getNotesInScale(rootKey: string, scaleName: string): string[] {
  const rootIndex = KEYS_LIST.indexOf(rootKey);
  if (rootIndex === -1) return KEYS_LIST;

  const intervals = SCALES[scaleName as keyof typeof SCALES] || SCALES["Chromatic"];
  
  return intervals.map(interval => {
    const noteIndex = (rootIndex + interval) % 12;
    return KEYS_LIST[noteIndex];
  });
}