// @ts-nocheck
import { supabase } from '../integrations/supabase/client';
import { useDawStore } from '../store/useDawStore';
import { safeSetLocalStorage } from './storagePruner';

export interface PendingSyncItem {
  id: string; // project id (might be temporary offline id)
  action: 'insert' | 'update' | 'delete';
  title?: string;
  bpm?: number;
  music_key?: string;
  data?: any;
  timestamp: string;
}

// Memory and storage sync helpers
const CACHE_KEY = 'see-vibe-cached-projects';
const QUEUE_KEY = 'see-vibe-sync-queue';

export const offlineSync = {
  // Check active state
  isOnline(): boolean {
    return typeof window !== 'undefined' ? window.navigator.onLine : true;
  },

  // Projects cache reader
  getCachedProjects(): any[] {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  // Projects cache writer
  saveCachedProjects(projects: any[]) {
    safeSetLocalStorage(CACHE_KEY, projects);
  },

  // Read current pending synchronization queue
  getSyncQueue(): PendingSyncItem[] {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  // Save modified dynamic queue back to storage
  saveSyncQueue(queue: PendingSyncItem[]) {
    safeSetLocalStorage(QUEUE_KEY, queue);
  },

  // Queue a change to run, dynamically merges update paths
  queueChange(projectId: string, action: 'insert' | 'update' | 'delete', details?: any) {
    let queue = this.getSyncQueue();

    // If deleting, discard previous edits for this ID
    if (action === 'delete') {
      queue = queue.filter(item => item.id !== projectId);
      // Only insert delete request to queue if it's NOT a mock offline-created ID
      if (!projectId.startsWith('offline_')) {
        queue.push({
          id: projectId,
          action: 'delete',
          timestamp: new Date().toISOString()
        });
      }
      this.saveSyncQueue(queue);
      return;
    }

    // Try to find if there is an existing pending interaction for this project
    const existingIndex = queue.findIndex(item => item.id === projectId);
    if (existingIndex > -1) {
      const existing = queue[existingIndex];
      if (existing.action === 'insert' && action === 'update') {
        // Just merge details into original insertion
        queue[existingIndex] = {
          ...existing,
          ...details,
          data: details.data || existing.data,
          timestamp: new Date().toISOString()
        };
      } else {
        // Overwrite or update
        queue[existingIndex] = {
          ...existing,
          ...details,
          action,
          timestamp: new Date().toISOString()
        };
      }
    } else {
      queue.push({
        id: projectId,
        action,
        ...details,
        timestamp: new Date().toISOString()
      });
    }

    this.saveSyncQueue(queue);
  },

  // Triggers synchronization background protocol pushing updates to Supabase
  async triggerSync(onStatusUpdate?: (status: string) => void): Promise<void> {
    if (!this.isOnline()) {
      console.log('Offline: Skipping cloud sync routine.');
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      console.log('Offline Sync: No authenticated user active. Skipping.');
      return;
    }

    const queue = this.getSyncQueue();
    if (queue.length === 0) {
      return;
    }

    console.log(`Syncing ${queue.length} offline operations to database...`);
    onStatusUpdate?.(`Syncing ${queue.length} project changes...`);

    const remainingItems: PendingSyncItem[] = [];
    const localToCloudIdMap: { [offlineId: string]: string } = {};

    for (const item of queue) {
      try {
        if (item.action === 'insert') {
          // Push insert row to database
          const { data, error } = await supabase
            .from('studio_projects')
            .insert({
              user_id: user.id,
              title: item.title || 'Untitled Project',
              bpm: item.bpm || 120,
              music_key: item.music_key || 'C',
              data: item.data || {}
            })
            .select()
            .single();

          if (error) throw error;

          if (data) {
            localToCloudIdMap[item.id] = data.id;
            console.log(`Synchronized new project creation offline -> cloud: ${item.id} -> ${data.id}`);
          }
        } else if (item.action === 'update') {
          const targetId = localToCloudIdMap[item.id] || item.id;
          
          const updatePayload: any = {
            updated_at: new Date().toISOString()
          };
          if (item.title !== undefined) updatePayload.title = item.title;
          if (item.bpm !== undefined) updatePayload.bpm = item.bpm;
          if (item.music_key !== undefined) updatePayload.music_key = item.music_key;
          if (item.data !== undefined) updatePayload.data = item.data;

          const { error } = await supabase
            .from('studio_projects')
            .update(updatePayload)
            .eq('id', targetId);

          if (error) throw error;
          console.log(`Synchronized updates for project: ${targetId}`);
        } else if (item.action === 'delete') {
          const targetId = localToCloudIdMap[item.id] || item.id;
          const { error } = await supabase
            .from('studio_projects')
            .delete()
            .eq('id', targetId);

          if (error) throw error;
          console.log(`Synchronized deletion for project: ${targetId}`);
        }
      } catch (err) {
        console.error('Failed to sync item:', item, err);
        // Keep in queue for next retry
        remainingItems.push(item);
      }
    }

    this.saveSyncQueue(remainingItems);

    // After push sync completes, pull the fresh listing down to consolidate local cache representation
    try {
      const { data: remoteProjects } = await supabase
        .from('studio_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (remoteProjects) {
        this.saveCachedProjects(remoteProjects);

        // If the workspace is currently active on an updated project id, match it!
        const state = useDawStore.getState();
        const activeProjId = state.currentProjectId;
        if (activeProjId && localToCloudIdMap[activeProjId]) {
          const remoteId = localToCloudIdMap[activeProjId];
          const activeProjName = state.currentProjectName;
          
          console.log(`Updating active workspace ID dynamically: ${activeProjId} -> ${remoteId}`);
          useDawStore.setState({ currentProjectId: remoteId });
          safeSetLocalStorage('see-vibe-project-meta', {
            id: remoteId,
            title: activeProjName
          });
        }
      }
    } catch {}

    onStatusUpdate?.('Offline changes fully synchronized!');
    setTimeout(() => onStatusUpdate?.(''), 3000);
  }
};
