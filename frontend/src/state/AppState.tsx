import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiGet, apiPost, getApiKey, setApiKey } from '../utils/api';
import type { Profile } from '../utils/types';
import { useTheme } from './useTheme';
import { useActiveSecondsTracker } from './useActiveSecondsTracker';

type AppStateValue = {
  isBooting: boolean;
  apiKey: string;
  setApiKey: (key: string) => void;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
};

const AppStateCtx = createContext<AppStateValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { initTheme } = useTheme();
  useActiveSecondsTracker();

  const [isBooting, setIsBooting] = useState(true);
  const [apiKeyState, setApiKeyState] = useState(getApiKey());
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  async function refreshProfile() {
    const p = await apiGet<Profile>('/profile');
    setProfile(p);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await refreshProfile();
      } catch {
        // If backend is down, still render onboarding to show a helpful error later.
        if (mounted) setProfile(null);
      } finally {
        if (mounted) setIsBooting(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({
      isBooting,
      apiKey: apiKeyState,
      setApiKey: (key: string) => {
        setApiKey(key);
        setApiKeyState(key);
      },
      profile,
      refreshProfile,
    }),
    [apiKeyState, isBooting, profile],
  );

  return <AppStateCtx.Provider value={value}>{children}</AppStateCtx.Provider>;
}

export function useApp() {
  const v = useContext(AppStateCtx);
  if (!v) throw new Error('useApp must be used within AppProvider');
  return v;
}

