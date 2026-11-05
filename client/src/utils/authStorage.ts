import { User } from '../types';

/**
 * Detects strictly whether the application is running as an installed PWA
 * (Progressive Web App in standalone / installed window mode).
 *
 * NOTE: Mobile web browsers (Chrome/Safari tab on a phone) return FALSE.
 * Desktop web browsers (Chrome/Edge/Firefox tab on PC) return FALSE.
 * ONLY installed PWAs running in standalone mode return TRUE.
 */
export function isPwa(): boolean {
  if (typeof window === 'undefined') return false;

  const isStandaloneDisplay =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches;

  // iOS Safari Home Screen standalone mode
  const isIosStandalone = (window.navigator as any).standalone === true;

  // Android TWA / APK wrapper
  const isAndroidApp = typeof document !== 'undefined' && document.referrer.startsWith('android-app://');

  return Boolean(isStandaloneDisplay || isIosStandalone || isAndroidApp);
}

export const authStorage = {
  /**
   * Retrieves the current auth token:
   * - In installed PWA: reads from localStorage (persistent for 3 days) or sessionStorage.
   * - In Web Browsers (both desktop & mobile): reads from sessionStorage (wiped on tab close).
   */
  getToken(): string | null {
    try {
      if (isPwa()) {
        return localStorage.getItem('athiveera_token') || sessionStorage.getItem('athiveera_token');
      }
      // For all web browsers: only check sessionStorage.
      // If any old token remains in localStorage from an old version, ignore and clear it so tab close works.
      const sessionToken = sessionStorage.getItem('athiveera_token');
      if (!sessionToken && localStorage.getItem('athiveera_token')) {
        // Lingering legacy local storage on browser - purge it
        localStorage.removeItem('athiveera_token');
        localStorage.removeItem('athiveera_user');
      }
      return sessionToken;
    } catch {
      return null;
    }
  },

  /**
   * Retrieves the cached user object:
   * - In installed PWA: reads from localStorage or sessionStorage.
   * - In Web Browsers: reads only from sessionStorage.
   */
  getUser(): User | null {
    try {
      const raw = isPwa()
        ? (localStorage.getItem('athiveera_user') || sessionStorage.getItem('athiveera_user'))
        : sessionStorage.getItem('athiveera_user');

      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  /**
   * Saves authentication session:
   * - PWA App: Saved in localStorage (persists across app closes, restarts, and reboots for 3 days).
   * - Web Browsers (Desktop & Mobile): Saved ONLY in sessionStorage.
   *   Closing the tab/window instantly destroys the session.
   */
  saveAuth(token: string, user: User, isPwaClient?: boolean) {
    const isApp = isPwaClient !== undefined ? isPwaClient : isPwa();
    const userStr = JSON.stringify(user);

    try {
      if (isApp) {
        // PWA App: Persistent 3-day storage
        localStorage.setItem('athiveera_token', token);
        localStorage.setItem('athiveera_user', userStr);
        sessionStorage.setItem('athiveera_token', token);
        sessionStorage.setItem('athiveera_user', userStr);
      } else {
        // Web Browser: Tab-scoped storage only (auto-logout on tab close)
        sessionStorage.setItem('athiveera_token', token);
        sessionStorage.setItem('athiveera_user', userStr);
        // Ensure localStorage has no token so browser cannot stay logged in across tab close
        localStorage.removeItem('athiveera_token');
        localStorage.removeItem('athiveera_user');
      }
    } catch (e) {
      console.warn('Unable to persist auth state to browser storage', e);
    }
  },

  /**
   * Updates cached user profile in active storage.
   */
  updateUser(user: User) {
    const userStr = JSON.stringify(user);
    try {
      if (sessionStorage.getItem('athiveera_token')) {
        sessionStorage.setItem('athiveera_user', userStr);
      }
      if (isPwa() && localStorage.getItem('athiveera_token')) {
        localStorage.setItem('athiveera_user', userStr);
      }
    } catch (e) {
      console.warn('Unable to update user in storage', e);
    }
  },

  /**
   * Completely purges auth credentials from all storage engines.
   */
  clearAuth() {
    try {
      sessionStorage.removeItem('athiveera_token');
      sessionStorage.removeItem('athiveera_user');
      localStorage.removeItem('athiveera_token');
      localStorage.removeItem('athiveera_user');
    } catch (e) {
      console.warn('Unable to clear auth storage', e);
    }
  }
};
