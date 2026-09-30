import { Moon, Sun, Check } from 'lucide-react';
import { ACCENTS, setAccent, toggleTheme } from '../../lib/theme.js';
import { useTheme } from '../../hooks/useTheme.js';
export function ThemeToggle({ className = '' }) { const { theme } = useTheme(); return <button onClick={toggleTheme} aria-label="Toggle dark mode" title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'} className={`flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface text-muted transition hover:text-ink ${className}`}>{theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>; }
export function AccentPicker() {
  const { accent } = useTheme();
  return <div className="flex flex-wrap gap-2">{ACCENTS.map((a) => <button key={a.hex} onClick={() => setAccent(a.hex)} title={a.name} aria-label={a.name} className="flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition hover:scale-105" style={{ background: a.hex, boxShadow: accent.toLowerCase() === a.hex.toLowerCase() ? `0 0 0 2px rgb(var(--surface)), 0 0 0 4px ${a.hex}` : undefined }}>{accent.toLowerCase() === a.hex.toLowerCase() && <Check className="h-4 w-4 text-white drop-shadow" />}</button>)}</div>;
}
