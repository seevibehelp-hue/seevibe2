Six items were requested. They touch very different systems (audio engine, sample sources, per-project state, floating-ball UI). Before I dive in, here is what I'm proposing so we don't spend a full turn on the wrong thing.

## What I'll do

### 1. Floating AI ball not opening on desktop click (quick fix)
Root cause is real: `onMouseDown` immediately sets `isDragging = true`, so the subsequent `onClick`'s guard `if (!isDragging)` always sees `true` from the closure and does nothing. Fix by tracking actual pointer movement in a `ref` (only mark as dragged after >4px movement), and open the panel on click when no drag occurred. Same fix works on touch.

### 2. AI chat per project (fresh chat per project)
Currently `chatMessages` is one global array in `useDawStore`. Change to `chatMessagesByProject: Record<projectId, Message[]>`. `addChatMessage` / `clearChat` / selectors key off the active project ID. When a new project is created or loaded, its chat starts empty (with the greeting). Migration reads the old flat array once into the current project bucket.

### 3. Recorded clips on timeline are silent on playback
This is the highest-risk item — the audio engine is ~3.8k lines. I need one investigation pass (routing of recorded MIDI/audio clips → transport playback → destination) before I can commit to a fix. Likely candidates: recorded clip nodes not being connected to the master bus, or transport scheduler skipping clip parts. I'll only touch playback wiring, not the recording path.

### 4. Drum pads → standard production-grade sounds
Currently pads route through `playLowLatencyDrumHit` (synthesized). Upgrade to layered samples: bundle a small set of high-quality drum samples per kit (Trap / Hip-Hop / Pop / Electronic) via `lovable-assets`, load them into a `Tone.Players` bank on first pad hit, fall back to the current synth if a sample is missing. Pad label → sample mapping stays.

### 5. AI-generated drums use the standard kit (not the amapiano long drum)
Wherever the AI producer generates drums (`utils/segmentedGenerator.ts` / `songRenderer.ts` / `vibeEngine.ts`), switch the default kit from the amapiano long-tail drum to the new standard sample kit. Keep amapiano as an explicit opt-in genre.

### 6. Studio rolls (Piano/Vocal/Drum roll) are too quiet
Raise per-roll output gain and normalize velocity curve so preview hits match the pad/keyboard loudness. Add a small make-up gain node in the roll preview path rather than boosting each sample.

## What I need from you

This is roughly a full day of work if I do all six well in one pass. To keep quality high, I'd like to ship in this order and confirm before moving on:

1. Floating ball click + per-project AI chat (small, safe, done in this turn)
2. Playback-silence bug (needs investigation, likely 1 focused turn)
3. Drum pad + AI drum sound upgrade (needs sample assets)
4. Roll loudness pass

Reply "go" and I'll start with steps 1–2 this turn, or tell me to reorder.

## Technical notes

- Per-project chat: store shape becomes `chatMessagesByProject: Record<string, ChatMessage[]>`, plus a selector `getChatMessages(projectId)`. `ChatView.tsx` and `FloatingAIOrientedBall.tsx` read/write via the active project ID from the store.
- Floating ball: replace the `isDragging` state guard in `onClick` with a `didDragRef` set inside `handleDrag` after a movement threshold; reset on `pointerdown`.
- Sample kit: files uploaded via `lovable-assets` under `src/assets/drums/<kit>/<pad>.wav.asset.json`, loaded lazily by `DrumPads.tsx`.
- Playback fix: I'll instrument the transport → clip → destination chain and report findings before changing behavior.
