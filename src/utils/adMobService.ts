// @ts-nocheck
import { useAdMobStore } from '../store/useAdMobStore';
import { supabase } from '../integrations/supabase/client';

/**
 * Enterprise Production AdMob Bridge & SDK Controller
 * 
 * Automatically detects whether the application is running:
 * 1. Inside a hybrid Mobile App wrapper (e.g., Capacitor, Cordova)
 * 2. As a native desktop/laptop app wrapper (e.g., Electron, Tauri)
 * 3. On a standard secure Web browser platform
 * 
 * Routes ad requests to the real production AdMob Unit IDs:
 * — App ID: ca-app-pub-9845694462631583~4961837857
 * — Banner ID: ca-app-pub-9845694462631583/8423157440
 * — Rewarded ID: ca-app-pub-9845694462631583/8118925170
 * — Native ID: ca-app-pub-9845694462631583/2730867128
 * — Interstitial ID: ca-app-pub-9845694462631583/8231585756
 */

class AdMobProductionService {
  private publisherId = "pub-9845694462631583";
  private initialized = false;

  constructor() {
    this.initIfPossible();
  }

  /**
   * Safe transaction-level update to increase user's TK balance by 0.1 on Supabase
   */
  public async awardProductionTkReward(_userId?: string) {
    // Server-side atomic RPC: enforces auth + 3/hour rate limit + wallet
    // credit in a single transaction. Clients cannot bypass by clearing
    // localStorage or invoking this method directly — the RPC uses
    // auth.uid() and its own ad_reward_claims table for rate limiting.
    try {
      const { data, error } = await supabase.rpc('award_ad_reward');
      if (error) {
        console.error('[AdMob] award_ad_reward failed:', error.message);
        return;
      }
      if (data && (data as any).success) {
        this.addClaimTimestamp(); // UI hint only; server is source of truth
        console.log('[AdMob] TK reward credited via server RPC.');
      } else {
        console.warn('[AdMob] Reward rejected:', (data as any)?.reason);
      }
    } catch (err) {
      console.error('[AdMob] Reward RPC threw:', err);
    }
  }

  /**
   * Retrieve timestamp history of rewarded ad claims
   */
  public getClaimHistory(): number[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('admob_reward_timestamps');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(Number).filter(t => !isNaN(t));
      }
    } catch (e) {
      console.error("Failed to parse claim history:", e);
    }
    return [];
  }

  /**
   * Append a new claim timestamp
   */
  public addClaimTimestamp() {
    if (typeof window === 'undefined') return;
    try {
      const history = this.getClaimHistory();
      const now = Date.now();
      const updated = [...history, now];
      localStorage.setItem('admob_reward_timestamps', JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to add claim timestamp:", e);
    }
  }

  /**
   * Check if user is eligible to watch and earn under the 3-times-per-hour policy
   */
  public canWatchRewardedAd(isPromptAd: boolean = false): { allowed: boolean; remainingSeconds: number; countThisHour: number } {
    if (isPromptAd) {
      return {
        allowed: true,
        remainingSeconds: 0,
        countThisHour: 0
      };
    }

    const history = this.getClaimHistory();
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    // Filter claims in the last hour
    const claimsInLastHour = history.filter(t => t > oneHourAgo);
    
    if (claimsInLastHour.length >= 3) {
      // Cooldown is determined by the oldest claim within the last hour expiring (making way for a new claim slot)
      const oldestClaim = claimsInLastHour[0];
      const remainingMs = Math.max(0, oldestClaim + 3600000 - now);
      return {
        allowed: false,
        remainingSeconds: Math.ceil(remainingMs / 1000),
        countThisHour: claimsInLastHour.length
      };
    }
    
    return {
      allowed: true,
      remainingSeconds: 0,
      countThisHour: claimsInLastHour.length
    };
  }

  /**
   * Safe initialization of ad scripts for web browser environments and native app wrappers
   */
  public async initIfPossible() {
    if (this.initialized) return;

    try {
      // 1. Detect and register Google Publisher Tag (GPT) / AdSense for web & custom frames
      if (typeof window !== 'undefined') {
        const doc = window.document;
        
        // Dynamically insert standard Google Adsense / AdMob for Web script
        if (!doc.getElementById('adsbygoogle-sdk')) {
          const script = doc.createElement('script');
          script.id = 'adsbygoogle-sdk';
          script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-${this.publisherId}`;
          script.async = true;
          script.crossOrigin = "anonymous";
          doc.head.appendChild(script);
        }

        // 2. Check for Capacitor Mobile AdMob plugin
        const win = window as any;
        if (win.Capacitor && win.Capacitor.Plugins && win.Capacitor.Plugins.AdMob) {
          await win.Capacitor.Plugins.AdMob.initialize({
            requestTrackingAuthorization: true,
          });
          console.log("AdMob SDK initialized via Native Capacitor Bridge");
        } 
        // 3. Check for standard Cordova / phonegap window.AdMob
        else if (win.AdMob) {
          win.AdMob.start();
          console.log("AdMob SDK initialized via Cordova Bridge");
        }
      }
      this.initialized = true;
    } catch (e) {
      console.warn("AdMob script initialization caught:", e);
    }
  }

  /**
   * Triggers the load and display of the banner ad unit
   */
  public async loadProductionBanner() {
    await this.initIfPossible();
    const store = useAdMobStore.getState();
    const win = window as any;

    try {
      if (win.Capacitor?.Plugins?.AdMob) {
        // Native mobile banner trigger
        await win.Capacitor.Plugins.AdMob.showBanner({
          adId: store.config.bannerId,
          position: 'BOTTOM_CENTER',
          margin: 0,
          isTesting: false
        });
      } else if (win.AdMob) {
        // Cordova banner trigger
        win.AdMob.createBanner({
          adId: store.config.bannerId,
          position: win.AdMob.AD_POSITION.BOTTOM_CENTER,
          autoShow: true,
          isTesting: false
        });
      } else {
        // Fallback or Web Tag activation
        (win.adsbygoogle = win.adsbygoogle || []).push({});
      }
    } catch (_) {}
  }

  /**
   * Triggers the load and show sequence of the Interstitial ad unit during transitions
   */
  public async showProductionInterstitial() {
    await this.initIfPossible();
    const store = useAdMobStore.getState();
    const win = window as any;

    try {
      if (win.Capacitor?.Plugins?.AdMob) {
        // Prepare interstitial
        await win.Capacitor.Plugins.AdMob.prepareInterstitial({
          adId: store.config.interstitialId,
          isTesting: false
        });
        // Show interstitial
        await win.Capacitor.Plugins.AdMob.showInterstitial();
      } else if (win.AdMob) {
        // Cordova Interstitial
        win.AdMob.prepareInterstitial({
          adId: store.config.interstitialId,
          autoShow: true,
          isTesting: false
        });
      }
    } catch (_) {}
  }

  /**
   * Prepares and loads the Rewarded Ad unit for user micro-incentives (+20 Vibe Tokens)
   */
  public async showProductionRewarded() {
    await this.initIfPossible();
    const store = useAdMobStore.getState();
    const win = window as any;

    try {
      if (win.Capacitor?.Plugins?.AdMob) {
        await win.Capacitor.Plugins.AdMob.prepareRewardVideoAd({
          adId: store.config.rewardId,
          isTesting: false
        });
        
        // Listen to rewarded actions to grant tokens on native mobile
        win.Capacitor.Plugins.AdMob.addListener('onRewardedVideoAdReward', (info: any) => {
          store.addVibeTokens(20);
          this.awardProductionTkReward();
        });

        await win.Capacitor.Plugins.AdMob.showRewardVideoAd();
      } else if (win.AdMob) {
        win.AdMob.prepareRewardVideoAd({
          adId: store.config.rewardId,
          autoShow: true,
          isTesting: false
        });
        
        docEventListener('onRewardedVideoAdReward', () => {
          store.addVibeTokens(20);
          this.awardProductionTkReward();
        });
      }
    } catch (_) {}
  }
}

function docEventListener(event: string, callback: () => void) {
  if (typeof document !== 'undefined') {
    document.addEventListener(event, callback);
  }
}

export const adMobService = new AdMobProductionService();