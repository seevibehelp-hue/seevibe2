// @ts-nocheck
export type TimelineEvent =
  | { type: 'AddClip'; trackId: string; clipId: string; startTime: number; duration: number; clipType?: string }
  | { type: 'MoveClip'; clipId: string; newStartTime: number }
  | { type: 'DeleteClip'; clipId: string }
  | { type: 'UpdateClipFX'; clipId: string; fxId: string; value: any }
  | { type: 'ShowGhostClip'; trackId: string; ghostId: string; startBar: number; length: number; clipType?: string }
  | { type: 'CommitGhostClip'; ghostId: string; realClipId: string }
  | { type: 'RemoveGhostClip'; ghostId: string };

type TimelineEventListener = (event: TimelineEvent) => void;

class TimelineEventBus {
  private listeners: Set<TimelineEventListener> = new Set();

  subscribe(listener: TimelineEventListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: TimelineEvent) {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error("Error in timeline event subscriber:", err);
      }
    });
  }
}

export const timelineEvents = new TimelineEventBus();