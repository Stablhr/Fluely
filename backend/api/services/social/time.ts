/**
 * Converts a wall-clock date and time in an IANA time zone to a UTC instant,
 * e.g. ("2026-12-01", "09:30", "Asia/Manila") → 2026-12-01T01:30:00Z.
 * Uses the runtime's time-zone data (Intl); an unknown zone falls back to UTC.
 */
function offsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instant / 1000) * 1000;
}

export function zonedToUtc(date: string, time: string | undefined, timeZone: string | undefined): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '09:00').split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  let zone = timeZone || 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', {timeZone: zone});
  } catch {
    zone = 'UTC';
  }
  // Two passes settle the offset across daylight-saving changes.
  let guess = wall - offsetMs(wall, zone);
  guess = wall - offsetMs(guess, zone);
  return new Date(guess);
}
