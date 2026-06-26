// Pure sleep logic for the Today screen. No React/DB.
// A sleep with end_time === null is in progress (baby asleep now).
import type { SleepEvent, SleepKind } from '@/src/db/types';

const MS_PER_MIN = 60_000;

/** Night = starts 20:00–05:59 local; otherwise a nap (decision #2). */
export function classifyKind(start: Date): SleepKind {
  const h = start.getHours();
  return h >= 20 || h < 6 ? 'night' : 'nap';
}

export type SleepState =
  | { kind: 'asleep'; sinceMs: number }
  | { kind: 'awake'; sinceMs: number | null }; // null = no prior sleep yet

/**
 * Current asleep/awake state for Today. `sinceMs` is time asleep (when asleep) or
 * the wake window (when awake), or null if awake with no completed sleep yet.
 */
export function sleepState(args: {
  openSleep: SleepEvent | null;
  lastEndedSleep: SleepEvent | null;
  now: Date;
}): SleepState {
  const { openSleep, lastEndedSleep, now } = args;
  if (openSleep) {
    return { kind: 'asleep', sinceMs: Math.max(0, now.getTime() - new Date(openSleep.start_time).getTime()) };
  }
  if (lastEndedSleep?.end_time) {
    return { kind: 'awake', sinceMs: Math.max(0, now.getTime() - new Date(lastEndedSleep.end_time).getTime()) };
  }
  return { kind: 'awake', sinceMs: null };
}

/** Duration of a session in ms (now − start for an in-progress one). */
function sessionMs(s: SleepEvent, now: Date): number {
  const end = s.end_time ? new Date(s.end_time).getTime() : now.getTime();
  return Math.max(0, end - new Date(s.start_time).getTime());
}

/** Naps + total sleep for the day (caller passes sessions that started that day). */
export function sleepDayStats(sessions: SleepEvent[], now: Date): { naps: number; totalMin: number } {
  const naps = sessions.filter((s) => s.kind === 'nap').length;
  const totalMin = Math.round(sessions.reduce((sum, s) => sum + sessionMs(s, now), 0) / MS_PER_MIN);
  return { naps, totalMin };
}

/** Duration as "7h 20m" / "45m" / "0m". */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / MS_PER_MIN));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
