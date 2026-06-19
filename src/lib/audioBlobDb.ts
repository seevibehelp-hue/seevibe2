/**
 * audioBlobDb.ts
 *
 * Lightweight IndexedDB wrapper for persisting audio Blobs keyed by clip ID.
 * clip.audioUrl stores a `blob:` URL that becomes invalid on page reload;
 * the actual binary is kept here so it can be re-hydrated after a reload.
 */

const DB_NAME = 'seevibe-audio';
const STORE_NAME = 'blobs';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAudioBlob(clipId: string, blob: Blob): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(blob, clipId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadAudioBlob(clipId: string): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(clipId);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteAudioBlob(clipId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(clipId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Re-hydrate all clips that have an IndexedDB entry but whose audioUrl is
 * missing (because blob: URLs don't survive a page reload).
 * Returns a partial clips map with restored audioUrl values.
 */
export async function rehydrateAudioUrls(
  clips: Record<string, { audioUrl?: string }>
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  await Promise.all(
    Object.entries(clips).map(async ([id, clip]) => {
      // Only rehydrate clips whose URL is gone or was a stale blob: URL
      if (!clip.audioUrl || clip.audioUrl.startsWith('blob:')) {
        try {
          const blob = await loadAudioBlob(id);
          if (blob) {
            result[id] = URL.createObjectURL(blob);
          }
        } catch (_) {}
      }
    })
  );
  return result;
}
