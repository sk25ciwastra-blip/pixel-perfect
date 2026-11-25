import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  B25_THEME_STORAGE_KEY,
  isB25ThemePreference,
  nextB25ThemeBoundaryDelayMs,
  resolveB25Appearance,
  type B25ThemeAppearance,
  type B25ThemePreference,
} from './b25-appearance';

type ThemeContextValue = {
  preference: B25ThemePreference;
  appearance: B25ThemeAppearance;
  setPreference: (next: B25ThemePreference) => void;
};

const B25ThemeContext = createContext<ThemeContextValue>({
  preference: 'auto',
  appearance: 'night',
  setPreference: () => {},
});

export function B25ThemeProvider({ children }: { children: ReactNode }) {
  // A fixed first render avoids SSR/client hydration mismatch.
  const [preference, setPreferenceState] = useState<B25ThemePreference>('auto');
  const [clockMs, setClockMs] = useState(0);

  useEffect(() => {
    try {
      const saved: unknown = window.localStorage.getItem(B25_THEME_STORAGE_KEY);
      if (isB25ThemePreference(saved)) setPreferenceState(saved);
    } catch {
      // Private browsing/storage restrictions: retain Auto without failing the app.
    }
    setClockMs(Date.now());
  }, []);

  useEffect(() => {
    const refresh = () => setClockMs(Date.now());
    // Schedule exact WIB boundary instead of only a periodic timer.
    const wait = nextB25ThemeBoundaryDelayMs(Date.now());
    const boundaryTimer = window.setTimeout(refresh, wait);
    // Re-check after background-tab throttling, system clock changes and wake.
    const safetyTimer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearTimeout(boundaryTimer);
      window.clearInterval(safetyTimer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [clockMs]);

  const appearance = useMemo(
    () => resolveB25Appearance(preference, clockMs),
    [preference, clockMs],
  );

  useEffect(() => {
    document.documentElement.dataset['b25Theme'] = appearance;
    return () => {
      delete document.documentElement.dataset['b25Theme'];
    };
  }, [appearance]);

  function setPreference(next: B25ThemePreference) {
    if (!isB25ThemePreference(next)) return;
    setPreferenceState(next);
    setClockMs(Date.now());
    try {
      window.localStorage.setItem(B25_THEME_STORAGE_KEY, next);
    } catch {
      // Storage failure does not disable theme control for current session.
    }
  }

  return (
    <B25ThemeContext.Provider value={{ preference, appearance, setPreference }}>
      {children}
    </B25ThemeContext.Provider>
  );
}

export function useB25Theme() {
  return useContext(B25ThemeContext);
}
