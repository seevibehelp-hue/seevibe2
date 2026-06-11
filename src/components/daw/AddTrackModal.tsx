// @ts-nocheck
import React from 'react';
import { Mic, Drum, Piano, Music, Guitar, Zap, Disc3, Upload, Library, X } from 'lucide-react';
import { useDawStore } from '../../store/useDawStore';
import { TrackType, SynthType } from '../../types/daw';

export function AddTrackModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { addTrack } = useDawStore();

  const handleCreate = (type: TrackType, synthType?: SynthType) => {
    addTrack(type, synthType);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="bg-[#111] rounded-2xl w-full max-w-lg border border-[#2A2A2A] overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex justify-between items-center p-6 border-b border-[#2A2A2A]">
          <h2 className="text-xl font-bold text-white">Add a new track</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white bg-[#222] hover:bg-[#333] p-2 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            
            <button onClick={() => handleCreate('audio')} className="bg-[#1A1A1A] hover:bg-[#222] border border-[#2A2A2A] hover:border-[#444] rounded-xl p-4 flex items-center gap-4 transition-all text-left">
              <div className="w-12 h-12 rounded-full bg-pink-500/20 text-pink-500 flex items-center justify-center shrink-0">
                <Mic size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-sm">Voice / Mic</h3>
                <p className="text-gray-500 text-xs">Record vocals and mic input</p>
              </div>
            </button>

            <button onClick={() => handleCreate('midi', 'membrane')} className="bg-[#1A1A1A] hover:bg-[#222] border border-[#2A2A2A] hover:border-[#444] rounded-xl p-4 flex items-center gap-4 transition-all text-left">
              <div className="w-12 h-12 rounded-full bg-pink-500/20 text-pink-500 flex items-center justify-center shrink-0">
                <Drum size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-sm">Drums</h3>
                <p className="text-gray-500 text-xs">Pads, kits, beat maker</p>
              </div>
            </button>

            <button onClick={() => handleCreate('midi', 'poly')} className="bg-[#1A1A1A] hover:bg-[#222] border border-[#2A2A2A] hover:border-[#444] rounded-xl p-4 flex items-center gap-4 transition-all text-left">
              <div className="w-12 h-12 rounded-full bg-pink-500/20 text-pink-500 flex items-center justify-center shrink-0">
                <Piano size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-sm">Piano / Keys</h3>
                <p className="text-gray-500 text-xs">Chords and melodies</p>
              </div>
            </button>

            <button onClick={() => handleCreate('midi', 'fm')} className="bg-[#1A1A1A] hover:bg-[#222] border border-[#2A2A2A] hover:border-[#444] rounded-xl p-4 flex items-center gap-4 transition-all text-left">
              <div className="w-12 h-12 rounded-full bg-pink-500/20 text-pink-500 flex items-center justify-center shrink-0">
                <Music size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-sm">Bass</h3>
                <p className="text-gray-500 text-xs">Sub & basslines</p>
              </div>
            </button>

            <button onClick={() => handleCreate('midi', 'am')} className="bg-[#1A1A1A] hover:bg-[#222] border border-[#2A2A2A] hover:border-[#444] rounded-xl p-4 flex items-center gap-4 transition-all text-left">
              <div className="w-12 h-12 rounded-full bg-pink-500/20 text-pink-500 flex items-center justify-center shrink-0">
                <Zap size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-sm">Synth</h3>
                <p className="text-gray-500 text-xs">Lead, pad, arps</p>
              </div>
            </button>

            <button onClick={() => handleCreate('midi', 'poly')} className="bg-[#1A1A1A] hover:bg-[#222] border border-[#2A2A2A] hover:border-[#444] rounded-xl p-4 flex items-center gap-4 transition-all text-left">
              <div className="w-12 h-12 rounded-full bg-pink-500/20 text-pink-500 flex items-center justify-center shrink-0">
                <Guitar size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-sm">Guitar</h3>
                <p className="text-gray-500 text-xs">Acoustic / Electric</p>
              </div>
            </button>

            <button onClick={() => handleCreate('audio')} className="bg-[#1A1A1A] hover:bg-[#222] border border-[#2A2A2A] hover:border-[#444] rounded-xl p-4 flex items-center gap-4 transition-all text-left">
              <div className="w-12 h-12 rounded-full bg-pink-500/20 text-pink-500 flex items-center justify-center shrink-0">
                <Disc3 size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-sm">Loop / Sample</h3>
                <p className="text-gray-500 text-xs">Browse loops</p>
              </div>
            </button>

            <button onClick={() => handleCreate('audio')} className="bg-[#1A1A1A] hover:bg-[#222] border border-[#2A2A2A] hover:border-[#444] rounded-xl p-4 flex items-center gap-4 transition-all text-left">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
                <Upload size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-sm">Upload audio</h3>
                <p className="text-gray-500 text-xs">MP3, WAV, M4A</p>
              </div>
            </button>

          </div>
          
          <button onClick={() => handleCreate('audio')} className="mt-4 w-full bg-[#1A1A1A] hover:bg-[#222] border border-[#2A2A2A] hover:border-[#444] rounded-xl p-4 flex items-center gap-4 transition-all text-left">
            <div className="w-12 h-12 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0">
              <Library size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-bold text-sm">Browse loop library</h3>
              <p className="text-gray-500 text-xs">Drums, kicks, 808s, piano, bass, FX, vocal chops</p>
            </div>
          </button>
        </div>

      </div>
    </div>
  );
}