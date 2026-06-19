// @ts-nocheck
import React, { useEffect, useRef } from 'react';
import { Volume2, VolumeX, Settings, Plus, Trash2, Mic, Copy, ChevronDown, ChevronUp, FolderPlus, Folder, Disc } from 'lucide-react';
import { useDawStore } from '../../store/useDawStore';
import { audioEngine } from '../../audio/engine';

function TrackLevelMeter({ trackId }: { trackId: string }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frameId: number;
    const update = () => {
      const val = audioEngine.getTrackLevel(trackId);
      if (barRef.current) {
        barRef.current.style.height = `${Math.min(100, Math.max(0, val * 100))}%`;
        const color = val > 0.9 ? '#ef4444' : val > 0.7 ? '#eab308' : '#00FF9C';
        barRef.current.style.backgroundColor = color;
      }
      frameId = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frameId);
  }, [trackId]);

  return (
    <div className="w-[4px] h-6 bg-[#0c0c0e] rounded-sm overflow-hidden flex flex-col justify-end ring-1 ring-[#222]/50" title="Audio Level Meter">
      <div 
        ref={barRef} 
        className="w-full rounded-sm transition-all duration-75"
        style={{ height: '0%', backgroundColor: '#00FF9C' }}
      />
    </div>
  );
}

export function TrackList() {
  const { tracks, selectedTrackId, selectTrack, addTrack, updateTrack, deleteTrack, isTrackListOpen, setIsTrackListOpen, aiActivePulseTrackId, isAiProducing } = useDawStore();
  // Subscribe reactively so dropdowns refresh when devices connect/disconnect at runtime
  const midiDevices = useDawStore(s => s.midiDevices);
  const audioInputs  = useDawStore(s => s.audioInputs);

  const handleVocalDouble = (trackId: string) => {
    const state = useDawStore.getState();
    const sourceTrack = state.tracks.find(t => t.id === trackId);
    if (!sourceTrack) return;
    
    state.addTrack(sourceTrack.type, sourceTrack.synthType);
    
    setTimeout(() => {
      const newState = useDawStore.getState();
      const newTrack = newState.tracks[newState.tracks.length - 1];
      
      newState.updateTrack(newTrack.id, {
        name: `${sourceTrack.name} (Double)`,
        pan: sourceTrack.pan === 0 ? Math.random() > 0.5 ? 0.8 : -0.8 : -sourceTrack.pan,
        volume: sourceTrack.volume - 2,
        fx: {
          ...sourceTrack.fx,
          pitchShift: { ...sourceTrack.fx.pitchShift, enabled: true, pitch: 0 }
        }
      });
      
      const clipsToCopy = Object.values(newState.clips).filter(c => c.trackId === trackId);
      clipsToCopy.forEach(clip => {
        const newClipId = newState.addClip(newTrack.id, clip.startTime + 0.1, clip.audioUrl);
        if (sourceTrack.type === 'midi' && typeof newClipId === 'string') {
           newState.updateClip(newClipId, { notes: clip.notes || [] });
        }
      });
    }, 100);
  };

  return (
    <aside className={`w-52 bg-[#1E1E1E] border-r border-[#2A2A2A] flex flex-col overflow-y-auto shrink-0 z-50 transition-transform ${isTrackListOpen ? 'absolute inset-y-0 left-0 shadow-2xl translate-x-0' : 'absolute -translate-x-full sm:translate-x-0'} sm:static sm:flex sm:shadow-none`}>
      <div className="p-3 border-b border-[#2A2A2A] flex justify-between items-center bg-[#1E1E1E]">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tracks</span>
        <div className="flex gap-1 items-center">
          <button 
            onClick={() => setIsTrackListOpen(false)}
            className="text-gray-400 p-1 sm:hidden hover:text-white"
            title="Close"
          >
            <Settings size={14} className="rotate-90 hidden" />
            &times;
          </button>
          <button 
            onClick={() => addTrack('midi')}
            className="text-gray-400 hover:text-[#00FF9C] p-1 rounded hover:bg-[#222]"
            title="Add MIDI Track"
          >
            <Plus size={14} />
          </button>
          <button 
            onClick={() => addTrack('audio')}
            className="text-gray-400 hover:text-red-400 p-1 rounded hover:bg-[#222]"
            title="Add Audio Track"
          >
            <Mic size={14} />
          </button>
          <button 
            onClick={() => addTrack('group')}
            className="text-gray-400 hover:text-green-400 p-1 rounded hover:bg-[#222]"
            title="Add Group Track"
          >
            <FolderPlus size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {(() => {
          const sorted: typeof tracks = [];
          const rootTracks = tracks.filter(t => !t.groupId);
          rootTracks.forEach(root => {
            sorted.push(root);
            if (root.type === 'group') {
              const children = tracks.filter(t => t.groupId === root.id);
              sorted.push(...children);
            }
          });
          // Avoid orphans if a groupId goes wonky
          tracks.forEach(track => {
            if (!sorted.find(s => s.id === track.id)) {
              sorted.push(track);
            }
          });

          return sorted.map(track => {
            const hasGroupParent = !!track.groupId && tracks.some(t => t.id === track.groupId);
            const isAiEdited = aiActivePulseTrackId === track.id;
            return (
              <div 
                key={track.id} 
                className={`border-b border-[#1A1A1A] px-2 py-1 flex flex-col justify-between cursor-pointer transition-all overflow-hidden ${
                  hasGroupParent ? 'pl-6 bg-[#151517] border-l border-zinc-700' : 'bg-[#181818] border-l-4 border-transparent'
                } ${
                  selectedTrackId === track.id ? 'bg-[#1c1c1e] !border-l-4 !border-[#00FF9C]' : ''
                } ${
                  isAiEdited ? 'ring-2 ring-[#00FF9C]/50 shadow-[0_0_15px_rgba(0,255,156,0.25)] animate-pulse bg-[#00FF9C]/10 border-l-4 !border-[#00FF9C]' : ''
                }`}
                style={{ height: track.collapsed ? 28 : 72 }}
                onClick={() => selectTrack(track.id)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-1 flex-1 min-w-0">
                    <button 
                      onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { collapsed: !track.collapsed }); }}
                      className="text-gray-500 hover:text-white p-0.5"
                    >
                      {track.collapsed ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
                    </button>
                    {hasGroupParent && (
                      <span className="text-[10px] text-zinc-500 font-bold select-none mr-0.5 font-mono">└─</span>
                    )}
                    {track.type === 'group' && (
                      <Folder size={12} className="text-green-400 shrink-0 mr-1" />
                    )}
                    <input 
                      value={track.name}
                      onChange={(e) => updateTrack(track.id, { name: e.target.value })}
                      className={`bg-transparent text-[11px] font-bold w-full outline-none focus:border-b focus:border-gray-500 uppercase truncate ${selectedTrackId === track.id ? 'text-[#00FF9C]' : 'text-[#E0E0E0]'}`}
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <TrackLevelMeter trackId={track.id} />
                    {track.collapsed && (
                      <div className="flex items-center gap-1 mr-2 opacity-60">
                        <div className={`w-1.5 h-1.5 rounded-full ${track.muted ? 'bg-red-500' : 'bg-green-500'}`} />
                        <span className="text-[8px] text-gray-400 font-mono">{track.volume}dB</span>
                      </div>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteTrack(track.id); }}
                      className="text-gray-600 hover:text-red-400 p-1"
                      title="Delete track"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {!track.collapsed && (
                  <div className="flex flex-col space-y-2 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex space-x-1 text-[9px] font-mono items-center">
                    <button 
                      className={`w-5 h-5 rounded flex relative items-center justify-center font-bold ${track.armed ? 'bg-red-600 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse' : 'bg-[#333] text-gray-300 hover:bg-[#444]'}`}
                      onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { armed: !track.armed }) }}
                      title="Arm for Recording"
                    >
                      <div className={`w-2 h-2 rounded-full ${track.armed ? 'bg-white' : 'bg-red-500'}`} />
                    </button>
                    <button 
                      className={`w-5 h-5 rounded flex items-center justify-center ${track.muted ? 'bg-red-900 text-red-100' : 'bg-[#333] text-gray-300 hover:bg-[#444]'}`}
                      onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { muted: !track.muted }) }}
                      title="Mute"
                    >
                      M
                    </button>
                    <button 
                      className={`w-5 h-5 rounded flex items-center justify-center font-bold ${track.soloed ? 'bg-yellow-600 text-black' : 'bg-[#333] text-gray-300 hover:bg-[#444]'}`}
                      onClick={(e) => { e.stopPropagation(); updateTrack(track.id, { soloed: !track.soloed }) }}
                      title="Solo"
                    >
                      S
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleVocalDouble(track.id); }}
                      className="w-5 h-5 rounded flex items-center justify-center bg-[#333] text-gray-300 hover:bg-[#444]"
                      title="Create Vocal Double"
                    >
                      <Copy size={10} />
                    </button>

                    {track.type === 'midi' ? (
                      <div className="flex flex-col flex-1 gap-1">
                        <select 
                          value={track.synthType}
                          onChange={(e) => { e.stopPropagation(); updateTrack(track.id, { synthType: e.target.value as any }) }}
                          className="bg-[#000] text-gray-300 rounded border border-[#333] px-1 outline-none text-[9px] flex-1 ml-1"
                          onClick={e => e.stopPropagation()}
                        >
                          <option value="poly">Poly</option>
                          <option value="fm">FM</option>
                          <option value="am">AM</option>
                          <option value="pluck">Pluck (Guitar)</option>
                          <option value="membrane">Drum</option>
                          <option value="flute">Flute</option>
                          <option value="epiano">Electric Piano</option>
                          <option value="grand">Grand Piano</option>
                          <option value="organ">Organ</option>
                          <option value="rhodes">Rhodes</option>
                          <option value="synthbass">Synth Bass</option>
                          <option value="pad">Pad</option>
                          <option value="leadsynth">Lead Synth</option>
                          <option value="strings">Strings</option>
                          <option value="brass">Brass</option>
                          <option value="bells">Bells</option>
                        </select>
                        <div className="flex gap-1 ml-1 overflow-hidden" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1 bg-[#000] px-1 rounded border border-[#222]">
                            <span className="text-[7px] text-gray-500 font-bold uppercase">Ch</span>
                            <select 
                              value={track.midiChannel || 1}
                              onChange={(e) => updateTrack(track.id, { midiChannel: Number(e.target.value) })}
                              className="bg-transparent text-[#00FF9C] text-[8px] outline-none"
                            >
                              <option value={0}>All</option>
                              {Array.from({ length: 16 }).map((_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
                            </select>
                          </div>
                          <div className="flex items-center gap-1 bg-[#000] px-1 rounded border border-[#222] flex-1 min-w-0">
                            <span className="text-[7px] text-gray-500 font-bold uppercase">In</span>
                            <select 
                              value={track.midiInputId || 'all'}
                              onChange={(e) => updateTrack(track.id, { midiInputId: e.target.value })}
                              className="bg-transparent text-blue-400 text-[8px] outline-none w-full"
                            >
                              <option value="all">ANY Device</option>
                              {midiDevices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : track.type === 'group' ? (
                      <div className="bg-green-950/40 text-[#00FF9C] rounded border border-green-800/50 flex-1 px-1 flex items-center justify-center text-[8px] ml-1 uppercase font-semibold font-mono tracking-wider">
                        Group Bus / Aux
                      </div>
                    ) : (
                      <div className="flex flex-col flex-1 gap-1">
                        <div className="bg-red-900/30 text-red-500 rounded border border-red-900/50 flex-1 px-1 flex items-center justify-center text-[9px] ml-1 uppercase font-bold">
                          Audio / Mic
                        </div>
                        <div className="flex items-center gap-1 ml-1 bg-[#000] px-1 rounded border border-[#222]" onClick={e => e.stopPropagation()}>
                           <span className="text-[7px] text-gray-500 font-bold uppercase">In</span>
                           <select 
                             value={track.audioInputId || 'default'}
                             onChange={(e) => updateTrack(track.id, { audioInputId: e.target.value })}
                             className="bg-transparent text-red-400 text-[8px] outline-none w-full"
                           >
                             <option value="default">Default Mic</option>
                             {audioInputs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                           </select>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 w-full">
                    <Volume2 size={10} className="text-gray-500" />
                    <input 
                      type="range" 
                      min="-60" 
                      max="6" 
                      value={track.volume}
                      onChange={(e) => { e.stopPropagation(); updateTrack(track.id, { volume: Number(e.target.value) }) }}
                      onClick={e => e.stopPropagation()}
                      className="flex-1 h-1 bg-[#222] rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Humanizing & FL Studio style performance tools */}
                  {track.type !== 'group' && (
                    <div className="flex items-center gap-2 w-full mt-1" onClick={e => e.stopPropagation()}>
                      {/* Portamento Glide (only for midi tracks) */}
                      {track.type === 'midi' && (
                        <div className="flex-1 flex items-center gap-1.5 bg-[#000] px-1.5 py-1 rounded border border-[#222]">
                          <span className="text-[7px] text-gray-500 font-bold uppercase select-none tracking-tight">Glide</span>
                          <input 
                            type="range" 
                            min="0" 
                            max="1.5" 
                            step="0.05"
                            value={track.portamento ?? 0}
                            onChange={(e) => updateTrack(track.id, { portamento: Number(e.target.value) })}
                            className="flex-1 h-0.5 bg-[#222] rounded appearance-none cursor-pointer"
                            title="Portamento Glide Time (seconds)"
                          />
                          <span className="text-[7px] text-[#00FF9C] font-mono select-none w-6 text-right">
                            {track.portamento ? `${track.portamento.toFixed(2)}s` : 'OFF'}
                          </span>
                        </div>
                      )}

                      {/* Kick Sidechain Switch fader simulation */}
                      <button 
                        onClick={() => {
                          const currentSidechain = track.fx?.sidechain || { enabled: false, ratio: 4, threshold: -20, release: 0.12 };
                          updateTrack(track.id, {
                            fx: {
                              ...track.fx,
                              sidechain: {
                                ...currentSidechain,
                                enabled: !currentSidechain.enabled
                              }
                            }
                          });
                        }}
                        className={`px-1.5 py-1 rounded text-[7px] font-mono font-bold uppercase tracking-wider transition-all select-none border flex items-center justify-center gap-1 shrink-0 ${
                          track.fx?.sidechain?.enabled 
                            ? 'bg-purple-950/40 border-purple-500/50 text-[#FA9534] shadow-[0_0_8px_rgba(250,149,52,0.15)] animate-pulse' 
                            : 'bg-black border-[#222] text-gray-400 hover:text-gray-200'
                        }`}
                        title="Ducks channel volume when Kick trigger plays"
                      >
                        <Disc size={8} className={track.fx?.sidechain?.enabled ? 'animate-spin' : ''} />
                        <span>SC-Duck</span>
                      </button>
                    </div>
                  )}

                  {track.type !== 'group' && (
                    <div className="flex items-center gap-1.5 w-full bg-[#090909] px-1.5 py-1 rounded border border-[#222] mt-0.5" onClick={e => e.stopPropagation()}>
                      <span className="text-[7px] text-gray-500 font-bold uppercase tracking-wider shrink-0 select-none">Bus Out:</span>
                      <select 
                        value={track.groupId || ''}
                        onChange={(e) => updateTrack(track.id, { groupId: e.target.value || undefined })}
                        className="bg-transparent text-green-400 text-[8px] outline-none flex-1 font-bold font-mono cursor-pointer"
                      >
                        <option value="" className="bg-[#111] text-gray-400">Master Out</option>
                        {tracks.filter(t => t.type === 'group' && t.id !== track.id).map(g => (
                          <option key={g.id} value={g.id} className="bg-[#111] text-green-400 font-bold">{g.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        });
      })()}
      </div>
    </aside>
  );
}
