'use client';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { UserSettings, DEFAULT_SETTINGS, makeFmt, makeFmtShort } from '@/lib/currencies';
import { api } from '@/lib/api';
import { applyTheme, getThemeById } from '@/lib/themes';
import { t as translate, TranslationKey, Language } from '@/lib/translations';

interface SettingsContextType {
  settings: UserSettings;
  loading: boolean;
  fmt: (n: number) => string;
  fmtShort: (n: number) => string;
  lang: Language;
  t: (key: TranslationKey) => string;
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  reload: () => Promise<void>;
}

const DEFAULT_CONTEXT: SettingsContextType = {
  settings: DEFAULT_SETTINGS,
  loading: true,
  fmt: makeFmt(DEFAULT_SETTINGS),
  fmtShort: makeFmtShort(DEFAULT_SETTINGS),
  lang: 'en',
  t: (key) => translate(key, 'en'),
  updateSettings: async () => {},
  reload: async () => {},
};

const SettingsContext = createContext<SettingsContextType>(DEFAULT_CONTEXT);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('ft_token') : null;
      if (!token) { setLoading(false); return; }
      const data = await api.getSettings();
      const merged = { ...DEFAULT_SETTINGS, ...data };
      setSettings(merged);
      applyTheme(getThemeById(merged.theme));
    } catch {
      // silently fallback to defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setTimeout(() => { void reload(); }, 0);
  }, [reload]);

  const updateSettings = async (patch: Partial<UserSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next); // optimistic
    if (patch.theme) applyTheme(getThemeById(patch.theme)); // instant preview
    const saved = await api.updateSettings(patch);
    const merged = { ...DEFAULT_SETTINGS, ...saved };
    setSettings(merged);
    applyTheme(getThemeById(merged.theme));
  };

  const fmt      = makeFmt(settings);
  const fmtShort = makeFmtShort(settings);
  const lang     = (settings.language as Language) ?? 'en';
  const tFn      = (key: TranslationKey) => translate(key, lang);

  return (
    <SettingsContext.Provider value={{ settings, loading, fmt, fmtShort, lang, t: tFn, updateSettings, reload }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
