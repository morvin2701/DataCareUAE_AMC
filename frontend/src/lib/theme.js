export const ACCENTS = [{ name: 'Gold', hex: '#C9A227' }, { name: 'Rose gold', hex: '#C97C6B' }, { name: 'Emerald', hex: '#149A6A' }, { name: 'Sapphire', hex: '#2F6BE0' }, { name: 'Ruby', hex: '#C8324A' }, { name: 'Amethyst', hex: '#7C4DDB' }, { name: 'Slate', hex: '#4B5563' }];
const KEY_T = 'dcamc.theme', KEY_A = 'dcamc.accent';
export const getTheme = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
export function getThemeMode() { try { return localStorage.getItem(KEY_T) || 'system'; } catch { return 'system'; } }
export function setTheme(mode) {
  const dark = mode === 'system' ? matchMedia('(prefers-color-scheme: dark)').matches : mode === 'dark';
  document.documentElement.classList.toggle('dark', dark);
  try { if (mode === 'system') localStorage.removeItem(KEY_T); else localStorage.setItem(KEY_T, mode); } catch {}
  window.dispatchEvent(new Event('themechange'));
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (getThemeMode() === 'system') setTheme('system'); });
export const toggleTheme = () => setTheme(getTheme() === 'dark' ? 'light' : 'dark');
export function getAccent() { try { return localStorage.getItem(KEY_A) || ACCENTS[0].hex; } catch { return ACCENTS[0].hex; } }
export function setAccent(hex) {
  const h = hex.replace('#', ''); const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const root = document.documentElement;
  root.style.setProperty('--accent', `${r} ${g} ${b}`);
  root.style.setProperty('--accent-ink', (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.6 ? '20 18 12' : '255 255 255');
  let [sr, sg, sb] = [r, g, b];
  for (let i = 0; i < 8 && (0.2126 * sr + 0.7152 * sg + 0.0722 * sb) / 255 < 0.5; i++) [sr, sg, sb] = [sr, sg, sb].map((c) => Math.round(c + (255 - c) * 0.18));
  root.style.setProperty('--sb-accent-lift', `${sr} ${sg} ${sb}`);
  try { localStorage.setItem(KEY_A, hex); } catch {}
  window.dispatchEvent(new Event('themechange'));
}
