// @ts-nocheck
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

try {
  const getFiles = (dir: string): string[] => {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        results = results.concat(getFiles(filePath));
      } else {
        results.push(filePath);
      }
    });
    return results;
  };

  const allRepoFiles = getFiles('temp_repo');
  console.log("All repo files:");
  allRepoFiles.forEach(f => {
    if (f.includes('useAudioEngine') || f.includes('audio') || f.includes('engine') || f.includes('audioEngine')) {
      console.log("Audio file match:", f);
    }
  });

} catch (e: any) {
  console.error("Error occurred:", e.message || e);
}