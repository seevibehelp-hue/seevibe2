// @ts-nocheck
/**
 * Specialized diagnostic wrapper and intelligent auto-healing local storage manager.
 * Prevents QuotaExceededError in DAW environments with heavy waveforms, vocal pitch streams, and chat histories.
 */

function downsampleArray(arr: number[] | undefined, maxLen = 64): number[] | undefined {
  if (!arr) return undefined;
  if (arr.length <= maxLen) return arr;
  const result: number[] = [];
  const step = arr.length / maxLen;
  for (let i = 0; i < maxLen; i++) {
    const idx = Math.floor(i * step);
    result.push(arr[idx]);
  }
  return result;
}

/**
 * Strips down a project state payload (safely deep-cloned) to be highly compact.
 * Keeps structural integrity intact while decreasing memory weight by 90%+.
 */
export function pruneProjectData(project: any, aggressive = false): any {
  if (!project) return project;
  
  // Create solid deep-clone to avoid mutating the in-memory React/Zustand store!
  let clone: any;
  try {
    clone = JSON.parse(JSON.stringify(project));
  } catch (err) {
    console.error("Storage Pruner JSON cloning error:", err);
    return project; // fallback
  }

  // 1. Truncate convo/chat histories
  if (clone.chatMessages && Array.isArray(clone.chatMessages)) {
    const maxMessages = aggressive ? 2 : 10;
    if (clone.chatMessages.length > maxMessages) {
      clone.chatMessages = clone.chatMessages.slice(-maxMessages);
    }
    clone.chatMessages.forEach((msg: any) => {
      if (msg && typeof msg.text === 'string' && msg.text.length > 2000) {
        msg.text = msg.text.substring(0, 2000) + '... [text pruned for offline storage quota]';
      }
      // If message contains other heavy structures or custom images
      if (msg && msg.fileData) {
        delete msg.fileData; // discard heavy file payload strings
      }
    });
  }

  // 2. Transduce and filter clip buffers/curves
  const clipsObj = clone.clips;
  if (clipsObj && typeof clipsObj === 'object') {
    Object.keys(clipsObj).forEach((id) => {
      const clip = clipsObj[id];
      if (!clip) return;

      // Downsample visual waveforms and levels
      if (clip.recordingPeaks && Array.isArray(clip.recordingPeaks)) {
        clip.recordingPeaks = downsampleArray(clip.recordingPeaks, aggressive ? 32 : 128);
      }

      // Truncate heavy vocal pitch roll sample tracks
      if (clip.vocalNotes && Array.isArray(clip.vocalNotes)) {
        clip.vocalNotes.forEach((vn: any) => {
          if (vn.pitchCurve && Array.isArray(vn.pitchCurve)) {
            vn.pitchCurve = downsampleArray(vn.pitchCurve, aggressive ? 4 : 16);
          }
          if (vn.originalPitchCurve && Array.isArray(vn.originalPitchCurve)) {
            vn.originalPitchCurve = downsampleArray(vn.originalPitchCurve, aggressive ? 4 : 16);
          }
        });
      }
    });
  }

  return clone;
}

/**
 * Saves item to localStorage with fallback auto-pruning mechanisms if storage is full.
 */
/**
 * Optimizes the cached projects list aggressively so that it never consumes more than a small fraction
 * of the 5MB localStorage limit. Keeps metadata for all projects but full data for only top 3.
 */
function optimizeCachedProjects(projects: any[]): any[] {
  if (!Array.isArray(projects)) return projects;

  // Find the active project ID to protect it
  const activeProjectId = (() => {
    try {
      const metaStr = localStorage.getItem('see-vibe-project-meta');
      if (metaStr) {
        const meta = JSON.parse(metaStr);
        return meta.id ? String(meta.id) : null;
      }
    } catch {}
    return null;
  })();

  // Sort projects so recent ones are kept in high-fidelity
  const sorted = [...projects].sort((a, b) => {
    const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
    const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
    return timeB - timeA;
  });

  return sorted.map((proj: any, index: number) => {
    if (!proj) return proj;
    const isCurrentActive = activeProjectId && String(proj.id) === activeProjectId;
    
    // Rule: Keep full/light pruned payload for active project AND top 2 most recent ones.
    // Strip heavy payload completely (retain skeleton) for index >= 3.
    const shouldRetainModelPayload = isCurrentActive || index < 3;

    let payload = proj.data;
    if (payload) {
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          payload = {};
        }
      }

      if (shouldRetainModelPayload) {
        // Prune the payload to be lightweight but keep structural beats/tracks
        const prunedPayload = pruneProjectData(payload, index >= 1);
        return {
          ...proj,
          data: JSON.stringify(prunedPayload)
        };
      } else {
        // Keeps empty/skeleton project. Metadata (title, dates, id) are fully intact.
        // This is perfectly fine since clicking the dashboard card will load the full data from Supabase anyway when online.
        return {
          ...proj,
          data: "{}"
        };
      }
    }
    return proj;
  });
}

/**
 * Saves item to localStorage with fallback auto-pruning mechanisms if storage is full.
 */
export function safeSetLocalStorage(key: string, data: any): boolean {
  let targetData = data;

  // Pre-emptive optimization for cached projects list
  if (key === 'see-vibe-cached-projects' && Array.isArray(data)) {
    try {
      targetData = optimizeCachedProjects(data);
    } catch (parseError) {
      console.warn("Storage Pruner pre-emptive parsing warning:", parseError);
    }
  }

  try {
    const rawString = JSON.stringify(targetData);
    localStorage.setItem(key, rawString);
    return true;
  } catch (e: any) {
    const isQuotaExceeded = 
      e.name === 'QuotaExceededError' || 
      e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 ||
      e.code === 1014;

    if (!isQuotaExceeded) {
      console.warn(`localStorage save warning for key "${key}" with general error:`, e);
      return false;
    }

    console.warn(`localStorage quota exceeded on key "${key}". Activating Auto-Healing storage compression...`);

    // Implement Auto-Healing recovery
    try {
      if (key === 'see-vibe-project') {
        // Active project saving failed - apply aggressive pruning
        const pruned = pruneProjectData(targetData, true);
        localStorage.setItem(key, JSON.stringify(pruned));
        console.info(`Saved active project "${key}" successfully after adaptive compression!`);
        return true;
      } 
      
      if (key === 'see-vibe-cached-projects') {
        // If it failed even with optimization, strip all payloads from list
        if (Array.isArray(targetData)) {
          const strippedList = targetData.map((proj: any) => ({
            ...proj,
            data: "{}"
          }));
          localStorage.setItem(key, JSON.stringify(strippedList));
          console.info(`Saved project list after extreme stripping of serialized project tracks.`);
          return true;
        }
      }

      // If it still fails, let's clear unrelated caches to make room
      const keysToClear = ['vibe_daw_presets', 'recent_activated_effects', 'see-vibe-sync-queue', 'admob_reward_timestamps'];
      for (const k of keysToClear) {
        try {
          localStorage.removeItem(k);
        } catch {}
      }

      // Try setting optimized targetData again
      localStorage.setItem(key, JSON.stringify(targetData));
      return true;

    } catch (innerErr) {
      console.warn(`Dynamic storage recovery was unable to allocate space for key "${key}" (safely ignored):`, innerErr);
      
      // Do absolute minimalist recovery: Only save active project structure, remove all chat logs entirely
      if (key === 'see-vibe-project') {
        try {
          const minimal = {
            ...targetData,
            chatMessages: [],
            clips: {} 
          };
          localStorage.setItem(key, JSON.stringify(minimal));
          return true;
        } catch (f) {
          console.warn("Critical: Absolutely out of localStorage space even for minimal metadata.", f);
        }
      } else if (key === 'see-vibe-cached-projects') {
        // Attempt to store only top 1 record, or clear cache completely so we do not crash the app
        try {
          localStorage.setItem(key, "[]");
          return true;
        } catch (f) {
           console.warn("Could not even set empty array for cache.", f);
        }
      }
      return false;
    }
  }
}
