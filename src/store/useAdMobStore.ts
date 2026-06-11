// @ts-nocheck
import { create } from 'zustand';

export interface AdMobConfig {
  appName: string;
  appId: string;
  bannerId: string;
  rewardId: string;
  nativeId: string;
  interstitialId: string;
}

export interface AdMobMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
  ecpm: number; // in USD per 1000 impressions
  estimatedEarnings: number; // in USD
}

interface AdMobStore {
  // Config
  config: AdMobConfig;
  testMode: boolean;
  toggleTestMode: () => void;

  // Ad Live State
  bannerVisible: boolean;
  setBannerVisible: (visible: boolean) => void;
  
  interstitialActive: boolean;
  setInterstitialActive: (active: boolean) => void;
  
  rewardedActive: boolean;
  setRewardedActive: (active: boolean) => void;
  isPromptAd: boolean;
  rewardCallback: (() => void) | null;
  setRewardCallback: (cb: (() => void) | null) => void;

  // User balance earned from watching Rewarded Ads
  vibeTokens: number;
  addVibeTokens: (amt: number) => void;
  useVibeTokens: (amt: number) => boolean;

  // Real-time developer simulator metrics
  metrics: AdMobMetrics;
  recordImpression: (adType: 'banner' | 'rewarded' | 'native' | 'interstitial') => void;
  recordClick: (adType: 'banner' | 'rewarded' | 'native' | 'interstitial') => void;
  resetMetrics: () => void;
}

export const useAdMobStore = create<AdMobStore>((set, get) => ({
  config: {
    appName: "See Vibe",
    appId: "ca-app-pub-9845694462631583~4961837857",
    bannerId: "ca-app-pub-9845694462631583/8423157440",
    rewardId: "ca-app-pub-9845694462631583/8118925170",
    nativeId: "ca-app-pub-9845694462631583/2730867128",
    interstitialId: "ca-app-pub-9845694462631583/8231585756",
  },
  testMode: false,
  toggleTestMode: () => set((state) => ({ testMode: !state.testMode })),

  bannerVisible: true,
  setBannerVisible: (visible) => set({ bannerVisible: visible }),
  
  interstitialActive: false,
  setInterstitialActive: (active) => set({ interstitialActive: active }),
  
  rewardedActive: false,
  setRewardedActive: (active) => set({ rewardedActive: active }),
  isPromptAd: false,
  rewardCallback: null,
  setRewardCallback: (cb) => set({ rewardCallback: cb }),

  // 45 starting Vibe Tokens
  vibeTokens: 45,
  addVibeTokens: (amt) => set((state) => ({ vibeTokens: state.vibeTokens + amt })),
  useVibeTokens: (amt) => {
    const current = get().vibeTokens;
    if (current >= amt) {
      set({ vibeTokens: current - amt });
      return true;
    }
    return false;
  },

  metrics: {
    impressions: 114,
    clicks: 12,
    ctr: 10.5,
    ecpm: 4.85,
    estimatedEarnings: 0.5529
  },

  recordImpression: (adType) => set((state) => {
    const isTest = state.testMode;
    const increment = 1;
    const ecpmRate = adType === 'rewarded' ? 12.50 : adType === 'interstitial' ? 8.20 : adType === 'native' ? 3.40 : 1.85;
    
    const newImpressions = state.metrics.impressions + increment;
    const newEstimatedEarnings = state.metrics.estimatedEarnings + (ecpmRate / 1000);
    const newCtr = newImpressions > 0 ? (state.metrics.clicks / newImpressions) * 100 : 0;
    
    // Average eCPM calculation
    const currentECPM = (newEstimatedEarnings / newImpressions) * 1000;

    return {
      metrics: {
        ...state.metrics,
        impressions: newImpressions,
        estimatedEarnings: Math.round(newEstimatedEarnings * 10000) / 10000,
        ctr: Math.round(newCtr * 100) / 100,
        ecpm: Math.round(currentECPM * 100) / 100
      }
    };
  }),

  recordClick: (adType) => set((state) => {
    const newClicks = state.metrics.clicks + 1;
    const clickBonus = adType === 'rewarded' ? 0.45 : adType === 'interstitial' ? 0.32 : adType === 'native' ? 0.18 : 0.08;
    const newEstimatedEarnings = state.metrics.estimatedEarnings + clickBonus;
    const newCtr = state.metrics.impressions > 0 ? (newClicks / state.metrics.impressions) * 100 : 100;
    
    const currentECPM = (newEstimatedEarnings / state.metrics.impressions) * 1000;

    return {
      metrics: {
        ...state.metrics,
        clicks: newClicks,
        estimatedEarnings: Math.round(newEstimatedEarnings * 10000) / 10000,
        ctr: Math.round(newCtr * 100) / 100,
        ecpm: Math.round(currentECPM * 100) / 100
      }
    };
  }),

  resetMetrics: () => set({
    metrics: {
      impressions: 0,
      clicks: 0,
      ctr: 0,
      ecpm: 3.50,
      estimatedEarnings: 0.0
    }
  })
}));