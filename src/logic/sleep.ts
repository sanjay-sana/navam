// Pure sleep logic. No React/DB.
// A sleep with end_time === null is in progress (baby asleep now).
import type { SleepEvent, SleepInput, SleepKind } from '@/src/db/types';

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

// --- Log-sleep form (completed sessions; ongoing is started from Today) ------

export interface SleepDraft {
  startTime: Date;
  endTime: Date | null; // null = ongoing (still asleep)
  kind: SleepKind;
  location?: string | null;
  how?: string | null;
  notes?: string;
}

export interface SleepErrors {
  time?: string;
  end?: string;
}

export type SleepResult = { ok: true; value: SleepInput } | { ok: false; errors: SleepErrors };

export function validateSleepDraft(draft: SleepDraft, now: Date = new Date()): SleepResult {
  const errors: SleepErrors = {};

  if (Number.isNaN(draft.startTime.getTime())) {
    errors.time = 'Invalid time';
  } else if (draft.startTime.getTime() > now.getTime()) {
    errors.time = "Start can't be in the future";
  }

  if (draft.endTime !== null) {
    if (Number.isNaN(draft.endTime.getTime())) {
      errors.end = 'Invalid time';
    } else if (draft.endTime.getTime() > now.getTime()) {
      errors.end = "End can't be in the future";
    } else if (draft.endTime.getTime() <= draft.startTime.getTime()) {
      errors.end = 'End must be after start';
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      start_time: draft.startTime.toISOString(),
      end_time: draft.endTime ? draft.endTime.toISOString() : null,
      kind: draft.kind,
      location: draft.location ?? null,
      how: draft.how ?? null,
      notes: draft.notes?.trim() || null,
    },
  };
}
