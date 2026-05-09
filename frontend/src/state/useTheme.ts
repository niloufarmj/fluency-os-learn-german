import { useCallback } from 'react';

export type Theme = 'dark' | 'light';

const KEY = 'fluency_theme';

export function useTheme() {
  const initTheme = useCallback(() => {
    const saved = (localStorage.getItem(KEY) as Theme | null) ?? 'dark';
    document.documentElement.dataset.theme = saved;
  }, []);

  const setTheme = useCallback((t: Theme) => {
    document.documentElement.dataset.theme = t;
    localStorage.setItem(KEY, t);
  }, []);

  const toggleTheme = useCallback(() => {
    const cur = (document.documentElement.dataset.theme as Theme | undefined) ?? 'dark';
    setTheme(cur === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  const getTheme = useCallback(() => {
    return ((document.documentElement.dataset.theme as Theme | undefined) ?? 'dark') satisfies Theme;
  }, []);

  return { initTheme, setTheme, toggleTheme, getTheme };
}

