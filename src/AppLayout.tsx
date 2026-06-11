// @ts-nocheck
import React from 'react';
import { Outlet, useLocation, NavLink } from 'react-router-dom';
import { MainBottomNav } from './components/MainBottomNav';
import { Home, Music, Users, Wallet, User, WifiOff, Wifi } from 'lucide-react';
import { AdMobBanner } from './components/AdMobBanner';
import { AdMobRewarded } from './components/AdMobRewarded';
import { AdMobInterstitial } from './components/AdMobInterstitial';
import { FloatingAIOrientedBall } from './components/daw/FloatingAIOrientedBall';
import { offlineSync } from './utils/offlineSync';
import { initFirebaseMessaging } from './lib/firebase';

export const AppLayout = () => {
  const location = useLocation();
  const isStudioPage = location.pathname === '/studio';
  const isEarningsPage = location.pathname === '/earnings';
  
  // Hide main bottom nav on Studio (has its own) and Earnings (webview)
  const showBottomNav = !isStudioPage && !isEarningsPage;

  // Track if layout should be expanded (landscape or desktop mode)
  const [isExpandedLayout, setIsExpandedLayout] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(offlineSync.isOnline());
  const [syncStatus, setSyncStatus] = React.useState('');

  React.useEffect(() => {
    const handleLayoutDetection = () => {
      const isLg = window.innerWidth >= 1024;
      const isLandscape = window.innerWidth > window.innerHeight;
      setIsExpandedLayout(isLg || isLandscape);
    };
    handleLayoutDetection();
    window.addEventListener('resize', handleLayoutDetection);
    window.addEventListener('orientationchange', handleLayoutDetection);
    return () => {
      window.removeEventListener('resize', handleLayoutDetection);
      window.removeEventListener('orientationchange', handleLayoutDetection);
    };
  }, []);

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      offlineSync.triggerSync((status) => setSyncStatus(status));
    };
    
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check and auto sync query runs
    if (offlineSync.isOnline()) {
      offlineSync.triggerSync((status) => setSyncStatus(status));
    }

    // Defer Firebase Messaging init until the browser is idle so it never
    // blocks Studio audio worklets/rendering on first paint. Skip entirely
    // while the user is on the Studio page.
    if (!isStudioPage) {
      const idle = (window as any).requestIdleCallback || ((cb: any) => setTimeout(cb, 2500));
      idle(() => { initFirebaseMessaging().catch(() => {}); });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="flex bg-background h-screen w-screen overflow-hidden text-foreground font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-64 bg-[#1E1E1E] border-r border-zinc-800/80 flex-col z-50">
        <div className="p-6 border-b border-zinc-800">
          <h1 className="text-xl font-bold bg-gradient-to-r from-pink-500 to-violet-500 bg-clip-text text-transparent">
            BEAT STUDIO
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'home', label: 'Home', icon: Home, path: '/' },
            { id: 'studio', label: 'Studio', icon: Music, path: '/studio' },
            { id: 'collab', label: 'Collab', icon: Users, path: '/collab' },
            { id: 'wallet', label: 'Wallet', icon: Wallet, path: '/wallet' },
            { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
          ].map((tab) => (
            <NavLink
              key={tab.id}
              to={tab.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-pink-500/10 text-pink-500 font-bold' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <tab.icon size={20} />
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex justify-center overflow-hidden bg-background">
        <div className={`relative w-full h-full flex flex-col bg-background shadow-2xl overflow-hidden transition-all duration-300 ${
          isExpandedLayout 
            ? 'max-w-none md:border-none' 
            : 'max-w-[420px] md:border-x border-zinc-800'
        }`}>
          {/* Offline / Synchronization notifications bar details */}
          {!isOnline && (
            <div className="bg-rose-500/95 text-white font-mono text-[9px] uppercase tracking-widest py-2 px-4 text-center flex items-center justify-center gap-1.5 animate-in slide-in-from-top duration-150 relative z-50 shrink-0 select-none shadow-md">
              <WifiOff size={11} className="animate-pulse text-white font-black" />
              <span>Offline Mode: Work will be saved locally & synced online</span>
            </div>
          )}

          {isOnline && syncStatus && (
            <div className="bg-[#00FFBC] text-zinc-950 font-mono text-[9px] font-black uppercase tracking-widest py-2 px-4 text-center flex items-center justify-center gap-1.5 animate-in slide-in-from-top duration-150 relative z-50 shrink-0 select-none shadow-md">
              <Wifi size={11} className="animate-bounce" />
              <span>{syncStatus}</span>
            </div>
          )}

          <div className={`flex-1 overflow-x-hidden overflow-y-auto ${showBottomNav ? 'pb-16 lg:pb-0' : ''}`}>
            <Outlet />
          </div>
          
          {/* AdMob Banner Placement — hidden in Studio to protect audio performance */}
          {!isStudioPage && <AdMobBanner />}

          {/* Bottom Nav: Only show on mobile/tablet */}
          {showBottomNav && (
            <div className="lg:hidden">
              <MainBottomNav />
            </div>
          )}

          {/* Floating AI System Control Ball */}
          <FloatingAIOrientedBall />
        </div>
      </div>

      {/* Global AdMob Fullscreen Overlays */}
      <AdMobRewarded />
      <AdMobInterstitial />
    </div>
  );
};

