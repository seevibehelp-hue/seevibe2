// @ts-nocheck
/**
 * Firebase Cloud Messaging initialization for See Vibe.
 * Lazy-loaded after the app is idle to avoid impacting Studio audio performance.
 */
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { supabase } from '../integrations/supabase/client';

const firebaseConfig = {
  apiKey: 'AIzaSyAQWdlIJZo6bxl0jJx5lDQq3ZU50XMUB9w',
  projectId: 'seevibe-352e3',
  messagingSenderId: '530405655071',
  appId: '1:530405655071:android:4e35686ac90f8b0cf5cb2a',
  storageBucket: 'seevibe-352e3.firebasestorage.app',
};

// VAPID public key for web push. Replace with your own from Firebase Console
// (Project Settings → Cloud Messaging → Web configuration → Web Push certificates).
// Web push notifications will not deliver until this is set.
const VAPID_KEY =
  (import.meta as any).env?.VITE_FIREBASE_VAPID_KEY ||
  'BExDB6wshmCGp2PAhOvMeqMEy4x6kORn5Spu7nkCcwVdx94Chn-E6ek4eSjwa6HDYubRGoNS-_HXUsPQKbUJmKA';

let initialized = false;

export async function initFirebaseMessaging(): Promise<string | null> {
  if (initialized) return null;
  initialized = true;

  try {
    if (typeof window === 'undefined') return null;
    if (!(await isSupported())) {
      console.info('[FCM] Not supported in this browser');
      return null;
    }

    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

    // Register the dedicated FCM service worker (does not interfere with PWA SW).
    const registration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js',
      { scope: '/firebase-cloud-messaging-push-scope' }
    );

    const messaging = getMessaging(app);

    // Foreground messages
    onMessage(messaging, (payload) => {
      try {
        const title = payload.notification?.title || 'See Vibe';
        const body = payload.notification?.body || '';
        if (Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/favicon.ico' });
        }
      } catch (e) {
        console.warn('[FCM] foreground notify failed', e);
      }
    });

    // Permission gate — don't auto-prompt; only request if user already granted
    // or the app explicitly asks.
    if (Notification.permission !== 'granted') return null;

    if (!VAPID_KEY) {
      console.info('[FCM] VITE_FIREBASE_VAPID_KEY not set; skipping token fetch.');
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      await persistDeviceToken(token);
    }
    return token || null;
  } catch (e) {
    console.warn('[FCM] init failed', e);
    return null;
  }
}

export async function requestNotificationPermissionAndRegister(): Promise<string | null> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return null;
    if (Notification.permission === 'default') {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return null;
    } else if (Notification.permission !== 'granted') {
      return null;
    }
    initialized = false; // allow re-init after permission grant
    return await initFirebaseMessaging();
  } catch (e) {
    console.warn('[FCM] permission request failed', e);
    return null;
  }
}

async function persistDeviceToken(token: string) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      localStorage.setItem('fcm_pending_token', token);
      return;
    }
    await supabase.from('device_tokens').upsert(
      {
        user_id: user.id,
        token,
        platform: 'web',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'token' }
    );
  } catch (e) {
    console.warn('[FCM] persist token failed', e);
  }
}
