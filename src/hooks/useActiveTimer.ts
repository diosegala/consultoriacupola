import { useEffect, useRef, useCallback } from 'react';

/**
 * Mede o tempo ATIVO do usuário em uma página: conta apenas enquanto a aba está
 * em foco E houve interação (mousemove, keydown, click) nos últimos 5 minutos.
 * Mantém também o tempo total decorrido (relógio corrido).
 *
 * Uso silencioso: o consultor não vê nada e não precisa controlar nada.
 */

const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutos
const TICK_MS = 1000;

export interface ActiveTimerSnapshot {
  startedAt: Date;
  endedAt: Date;
  activeSeconds: number;
  totalSeconds: number;
}

export function useActiveTimer(enabled: boolean) {
  const startedAtRef = useRef<Date | null>(null);
  const activeMsRef = useRef(0);
  const lastInteractionRef = useRef<number>(Date.now());
  const tickHandleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickAtRef = useRef<number>(Date.now());

  const markInteraction = useCallback(() => {
    lastInteractionRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (!startedAtRef.current) startedAtRef.current = new Date();
    lastTickAtRef.current = Date.now();
    lastInteractionRef.current = Date.now();

    const onActivity = () => markInteraction();
    const events: (keyof DocumentEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => document.addEventListener(ev, onActivity, { passive: true }));

    const onVisibility = () => {
      // reset tick reference so we don't accumulate background time
      lastTickAtRef.current = Date.now();
      if (document.visibilityState === 'visible') markInteraction();
    };
    document.addEventListener('visibilitychange', onVisibility);

    tickHandleRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTickAtRef.current;
      lastTickAtRef.current = now;

      const visible = document.visibilityState === 'visible';
      const recentlyActive = now - lastInteractionRef.current <= INACTIVITY_MS;
      if (visible && recentlyActive) {
        // limita o incremento ao próprio intervalo de tick — protege contra
        // saltos grandes quando o navegador hiberna timers em background.
        activeMsRef.current += Math.min(elapsed, TICK_MS * 2);
      }
    }, TICK_MS);

    return () => {
      events.forEach((ev) => document.removeEventListener(ev, onActivity));
      document.removeEventListener('visibilitychange', onVisibility);
      if (tickHandleRef.current) clearInterval(tickHandleRef.current);
      tickHandleRef.current = null;
    };
  }, [enabled, markInteraction]);

  const snapshot = useCallback((): ActiveTimerSnapshot | null => {
    if (!startedAtRef.current) return null;
    const endedAt = new Date();
    const totalSeconds = Math.max(0, Math.round((endedAt.getTime() - startedAtRef.current.getTime()) / 1000));
    const activeSeconds = Math.max(0, Math.round(activeMsRef.current / 1000));
    return { startedAt: startedAtRef.current, endedAt, activeSeconds, totalSeconds };
  }, []);

  const reset = useCallback(() => {
    startedAtRef.current = new Date();
    activeMsRef.current = 0;
    lastInteractionRef.current = Date.now();
    lastTickAtRef.current = Date.now();
  }, []);

  return { snapshot, reset, markInteraction };
}