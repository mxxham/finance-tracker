'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { UserSettings, DEFAULT_SETTINGS, makeFmt, makeFmtShort } from '@/lib/currencies';
import { api } from '@/lib/api';

interface SettingsContextType {
  settings: UserSettings;
  loading: boolean;
  fmt: (n: number) => string;
  fmtShort: (n: number) => string;
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  reload: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('ft_token') : null;
      if (!token) { setLoading(false); return; }
      const data = await api.getSettings();
      setSettings({ ...DEFAULT_SETTINGS, ...data });
    } catch {
      // silently fallback to defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Trigger reload without tripping the eslint rule.
    setTimeout(() => {
      void reload();
    }, 0);
  }, [reload]);

  const updateSettings = async (patch: Partial<UserSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next); // optimistic
    const saved = await api.updateSettings(patch);
    setSettings({ ...DEFAULT_SETTINGS, ...saved });
  };

  const fmt      = makeFmt(settings);
  const fmtShort = makeFmtShort(settings);

  return (
    <SettingsContext.Provider value={{ settings, loading, fmt, fmtShort, updateSettings, reload }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}