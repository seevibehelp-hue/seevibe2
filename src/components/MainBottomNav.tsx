// @ts-nocheck
import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Music, Users, Wallet, User } from 'lucide-react';

export const MainBottomNav = () => {
  const tabs = [
    { id: 'home', label: 'Home', icon: Home, path: '/' },
    { id: 'studio', label: 'Studio', icon: Music, path: '/studio' },
    { id: 'collab', label: 'Collab', icon: Users, path: '/collab' },
    { id: 'wallet', label: 'Wallet', icon: Wallet, path: '/wallet' },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 h-16 bg-[#1E1E1E]/95 backdrop-blur-md border-t border-[#2A2A2A] flex items-center justify-around px-2 z-50">
      {tabs.map((tab) => (
        <NavLink
          key={tab.id}
          to={tab.path}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-16 h-full gap-1 transition-colors ${
              isActive ? 'text-pink-500' : 'text-gray-500 hover:text-gray-300'
            }`
          }
        >
          <tab.icon size={22} />
          <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
        </NavLink>
      ))}
    </div>
  );
};
