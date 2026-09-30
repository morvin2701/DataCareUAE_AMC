import { useEffect, useRef, useState } from 'react';
import { authService } from '../services/authService.js';
const ACTIVITY = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
const WARN_BEFORE_MS = 60_000, HEARTBEAT_MS = 60_000;
/** Auto-logout after `idleMinutes` of no activity, with a 60 s warning; a heartbeat every minute keeps the server session alive. */
export function useIdleLogout({ idleMinutes = 15, enabled = true, onLogout }) {
  const [secondsLeft, setSecondsLeft] = useState(null); const lastActive = useRef(Date.now()); const lastBeat = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    if (Number(idleMinutes) === 0) { const beat = setInterval(() => authService.heartbeat().catch(() => {}), 5 * 60_000); return () => clearInterval(beat); }
    const limit = Math.max(1, Number(idleMinutes) || 15) * 60_000;
    const bump = () => { lastActive.current = Date.now(); if (secondsLeft !== null) setSecondsLeft(null); };
    ACTIVITY.forEach((ev) => window.addEventListener(ev, bump, { passive: true }));
    const t = setInterval(() => {
      const idle = Date.now() - lastActive.current;
      if (idle >= limit) { onLogout?.('idle'); return; }
      if (idle >= limit - WARN_BEFORE_MS) setSecondsLeft(Math.ceil((limit - idle) / 1000));
      else if (Date.now() - lastBeat.current > HEARTBEAT_MS) { lastBeat.current = Date.now(); authService.heartbeat().catch(() => {}); }
    }, 1000);
    return () => { ACTIVITY.forEach((ev) => window.removeEventListener(ev, bump)); clearInterval(t); };
  }, [idleMinutes, enabled, onLogout, secondsLeft]);
  return { secondsLeft, stayActive: () => { lastActive.current = Date.now(); setSecondsLeft(null); authService.heartbeat().catch(() => {}); } };
}
