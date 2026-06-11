// @ts-nocheck
import React from 'react';
import { LayoutList, SlidersHorizontal, Grid, Mic2, Layers, Bot, Library } from 'lucide-react';
import { useDawStore } from '../../store/useDawStore';
import { AppTab } from '../../types/daw';

interface BottomNavProps {
  isSidebar?: boolean;
}

export function BottomNav({ isSidebar = false }: BottomNavProps) {
  const { currentTab, setCurrentTab } = useDawStore();

  const tabs: { id: AppTab; label: string; icon: React.FC<any> }[] = [
    { id: 'timeline', label: 'Timeline', icon: LayoutList },
    { id: 'samples', label: 'Loops', icon: Library },
    { id: 'mixer', label: 'Mixer', icon: SlidersHorizontal },
    { id: 'pianoroll', label: 'Keys', icon: Grid },
    { id: 'drumpads', label: 'Pads', icon: Layers },
    { id: 'fx', label: 'Effects', icon: Mic2 },
  ];

  if (isSidebar) {
    return (
      <aside className="w-16 bg-[#1E1E1E] border-r border-[#2A2A2A] flex flex-col items-center py-4 space-y-4 shrink-0 h-full z-50 select-none overflow-y-auto scrollbar-thin">
        <div className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1 pointer-events-none shrink-0 font-mono">DAW</div>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              className={`flex flex-col items-center justify-center w-full py-3 space-y-1 relative group transition-all duration-200 ${
                isActive ? 'text-[#00FFBC]' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              title={tab.label}
            >
              {/* Active sidebar pill indicator */}
              <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-md transition-all duration-150 ${isActive ? 'bg-[#00FFBC]' : 'bg-transparent group-hover:bg-zinc-700'}`} />
              
              <Icon size={18} className="transition-transform group-hover:scale-105" />
              <span className="text-[8px] uppercase font-bold tracking-wider text-center scale-90">{tab.label}</span>
            </button>
          );
        })}
      </aside>
    );
  }

  return (
    <nav className="h-14 bg-[#1E1E1E] border-t border-[#2A2A2A] flex justify-around items-center shrink-0 z-50">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setCurrentTab(tab.id)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
              isActive ? 'text-[#00FF9C]' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            <Icon size={18} />
            <span className="text-[9px] uppercase font-bold tracking-widest">{tab.label}</span>
            {/* Active Indicator */}
            <div className={`h-[2px] w-6 rounded-full mt-0.5 transition-all ${isActive ? 'bg-[#00FF9C]' : 'bg-transparent'}`} />
          </button>
        );
      })}
    </nav>
  );
}
