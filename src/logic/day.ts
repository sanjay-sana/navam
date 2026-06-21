// Local calendar-day boundaries. Events are stored in UTC ISO; "today" means
// the device-local day, so we build local midnight bounds and hand back UTC ISO
// strings for range queries (§6: day boundaries computed in local time).

/** Local midnight at the start of `now`'s calendar day. */
export function localDayStart(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Local midnight at the start of the next calendar day (exclusive upper bound). */
export function localDayEnd(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

/** [startIso, endIso) UTC bounds spanning `now`'s local calendar day. */
export function localDayBoundsIso(now: Date): { startIso: string; endIso: string } {
  return {
    startIso: localDayStart(now).toISOString(),
    endIso: localDayEnd(now).toISOString(),
  };
}
