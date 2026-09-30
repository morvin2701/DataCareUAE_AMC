import { useEffect, useState } from 'react';
import { getTheme, getAccent, getThemeMode } from '../lib/theme.js';
export function useTheme() {
  const [state, set] = useState({ theme: getTheme(), mode: getThemeMode(), accent: getAccent() });
  useEffect(() => { const h = () => set({ theme: getTheme(), mode: getThemeMode(), accent: getAccent() }); window.addEventListener('themechange', h); return () => window.removeEventListener('themechange', h); }, []);
  return state;
}
