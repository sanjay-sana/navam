// App-wide data context: loads the active baby + settings once at startup and
// exposes a refresh hook. Routing is gated on whether a baby exists yet
// (no baby → onboarding; baby → tabs).
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import * as repo from '@/src/db/repo';
import type { Baby, Settings } from '@/src/db/types';

interface AppData {
  ready: boolean;
  activeBaby: Baby | null;
  settings: Settings | null;
  /** Re-read baby + settings from the DB (call after a write). */
  refresh: () => Promise<void>;
}

const AppDataContext = createContext<AppData | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [activeBaby, setActiveBaby] = useState<Baby | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  const refresh = useCallback(async () => {
    const [baby, s] = await Promise.all([repo.getActiveBaby(), repo.getSettings()]);
    setActiveBaby(baby);
    setSettings(s);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return (
    <AppDataContext.Provider value={{ ready, activeBaby, settings, refresh }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
}
