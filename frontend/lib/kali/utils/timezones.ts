// Lightweight IANA timezone helpers using Intl (no external dependency).
// Used to convert a local wall-clock time to UTC for the scheduler.

export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export const COMMON_TIMEZONES: Array<{ value: string; label: string }> = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern (US) — New York' },
  { value: 'America/Chicago', label: 'Central (US) — Chicago' },
  { value: 'America/Denver', label: 'Mountain (US) — Denver' },
  { value: 'America/Los_Angeles', label: 'Pacific (US) — Los Angeles' },
  { value: 'America/Anchorage', label: 'Alaska (US) — Anchorage' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (US) — Honolulu' },
  { value: 'America/Toronto', label: 'Eastern (CA) — Toronto' },
  { value: 'America/Vancouver', label: 'Pacific (CA) — Vancouver' },
  { value: 'America/Mexico_City', label: 'Central (MX) — Mexico City' },
  { value: 'America/Sao_Paulo', label: 'Brasília (BR) — São Paulo' },
  { value: 'Europe/London', label: 'GMT (UK) — London' },
  { value: 'Europe/Dublin', label: 'GMT — Dublin' },
  { value: 'Europe/Lisbon', label: 'WET — Lisbon' },
  { value: 'Europe/Madrid', label: 'CET — Madrid' },
  { value: 'Europe/Paris', label: 'CET — Paris' },
  { value: 'Europe/Berlin', label: 'CET — Berlin' },
  { value: 'Europe/Rome', label: 'CET — Rome' },
  { value: 'Europe/Amsterdam', label: 'CET — Amsterdam' },
  { value: 'Europe/Stockholm', label: 'CET — Stockholm' },
  { value: 'Europe/Warsaw', label: 'CET — Warsaw' },
  { value: 'Europe/Athens', label: 'EET — Athens' },
  { value: 'Europe/Helsinki', label: 'EET — Helsinki' },
  { value: 'Europe/Istanbul', label: 'TRT — Istanbul' },
  { value: 'Europe/Moscow', label: 'MSK — Moscow' },
  { value: 'Europe/Kyiv', label: 'EET — Kyiv' },
  { value: 'Asia/Dubai', label: 'GST — Dubai' },
  { value: 'Asia/Riyadh', label: 'AST — Riyadh' },
  { value: 'Asia/Karachi', label: 'PKT — Karachi' },
  { value: 'Asia/Kolkata', label: 'IST — Mumbai' },
  { value: 'Asia/Dhaka', label: 'BST — Dhaka' },
  { value: 'Asia/Bangkok', label: 'ICT — Bangkok' },
  { value: 'Asia/Jakarta', label: 'WIB — Jakarta' },
  { value: 'Asia/Shanghai', label: 'CST — Shanghai' },
  { value: 'Asia/Hong_Kong', label: 'HKT — Hong Kong' },
  { value: 'Asia/Taipei', label: 'CST — Taipei' },
  { value: 'Asia/Seoul', label: 'KST — Seoul' },
  { value: 'Asia/Tokyo', label: 'JST — Tokyo' },
  { value: 'Asia/Manila', label: 'PST (PH) — Manila' },
  { value: 'Asia/Singapore', label: 'SGT — Singapore' },
  { value: 'Australia/Sydney', label: 'AEST — Sydney' },
  { value: 'Australia/Melbourne', label: 'AEST — Melbourne' },
  { value: 'Australia/Brisbane', label: 'AEST — Brisbane' },
  { value: 'Australia/Perth', label: 'AWST — Perth' },
  { value: 'Pacific/Auckland', label: 'NZST — Auckland' },
]

// Convert a local (YYYY-MM-DD, HH:MM, IANA timezone) to a UTC ISO string.
// DST-correct and independent of the browser's local zone. No external dependency.
export function localToUTC(dateStr: string, timeStr: string | undefined, timezone: string): string {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [hh, mi] = (timeStr || '00:00').split(':').map(Number)

  // The user's local wall clock, treated numerically as UTC (no browser-zone influence).
  const wallAsUtc = Date.UTC(y, mo - 1, d, isNaN(hh) ? 0 : hh, isNaN(mi) ? 0 : mi, 0)
  if (isNaN(wallAsUtc)) return ''

  const ref = new Date(wallAsUtc)

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(ref)
      .reduce<Record<string, number>>((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = Number(part.value)
        return acc
      }, {})

    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    )
    const offsetMs = asUtc - ref.getTime()
    return new Date(wallAsUtc - offsetMs).toISOString()
  } catch {
    return new Date(wallAsUtc).toISOString()
  }
}
