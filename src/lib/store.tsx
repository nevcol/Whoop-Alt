import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import type { Settings } from './types';

interface SettingsContextValue {
  settings: Settings | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setSettings: (s: Settings) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const s = await api.getSettings();
    setSettings(s);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh().catch(() => setLoading(false));
  }, [refresh]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

/** Convenience: the active currency code (falls back to USD). */
export function useCurrency(): string {
  return useContext(SettingsContext)?.settings?.currency ?? 'USD';
}
