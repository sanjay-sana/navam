// Pure next-feed prediction + formatting for the Today ring. No React, no DB.
// Source of truth: next_feed = latest qualifying feed start + interval (§5.4).
// "Qualifying" = breast | bottle (pump excluded); the caller supplies the
// already-resolved MAX(start_time).

const MS_PER_MIN = 60_000;

export type FeedRing =
  | { kind: 'cold' }
  | { kind: 'counting'; sinceLastMs: number; nextFeedAt: Date; progress: number }
  | { kind: 'overdue'; sinceLastMs: number; nextFeedAt: Date; overdueMs: number };

export function computeFeedRing(args: {
  lastFeedStart: Date | null;
  intervalMinutes: number;
  now: Date;
}): FeedRing {
  const { lastFeedStart, intervalMinutes, now } = args;
  if (!lastFeedStart) return { kind: 'cold' };

  const intervalMs = intervalMinutes * MS_PER_MIN;
  const nextFeedAt = new Date(lastFeedStart.getTime() + intervalMs);
  const sinceLastMs = Math.max(0, now.getTime() - lastFeedStart.getTime());

  if (now.getTime() <= nextFeedAt.getTime()) {
    const progress = intervalMs > 0 ? Math.min(1, sinceLastMs / intervalMs) : 1;
    return { kind: 'counting', sinceLastMs, nextFeedAt, progress };
  }
  return { kind: 'overdue', sinceLastMs, nextFeedAt, overdueMs: now.getTime() - nextFeedAt.getTime() };
}

/** Elapsed time as H:MM (e.g. 2:14). Used for the big ring number. */
export function formatElapsed(ms: number): string {
  const totalMin = Math.floor(ms / MS_PER_MIN);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Overdue amount as "Xm" or "Xh Ym" — never negative. */
export function formatOverdue(ms: number): string {
  const totalMin = Math.max(0, Math.round(ms / MS_PER_MIN));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
