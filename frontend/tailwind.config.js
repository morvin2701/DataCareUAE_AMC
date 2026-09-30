/** Colours come from CSS variables (rgb triplets) so light/dark + accent are runtime-dynamic — same as the ERP. */
const v = (name) => `rgb(var(${name}) / <alpha-value>)`;
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {
    colors: { bg: v('--bg'), surface: v('--surface'), 'surface-2': v('--surface-2'), 'surface-3': v('--surface-3'), line: v('--line'), ink: v('--ink'), muted: v('--muted'), faint: v('--faint'), accent: v('--accent'), 'accent-ink': v('--accent-ink'), ok: v('--ok'), warn: v('--warn'), bad: v('--bad'), info: v('--info') },
    fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], display: ['Manrope', 'Inter', 'sans-serif'], mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'] },
    boxShadow: { card: '0 1px 2px rgb(0 0 0 / .05), 0 8px 24px -12px rgb(0 0 0 / .18)', pop: '0 12px 40px -12px rgb(0 0 0 / .35)' },
    keyframes: { rise: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } } },
    animation: { rise: 'rise .28s ease-out both' },
  } },
  plugins: [],
};
