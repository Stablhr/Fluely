export type Urgency = 'none' | 'normal' | 'soon' | 'overdue'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function getUrgency(due: string | null, now: Date = new Date()): Urgency {
  if (!due) return 'none'
  const dueDate = new Date(`${due}T00:00:00`)
  if (Number.isNaN(dueDate.getTime())) return 'none'
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diffDays = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000)
  if (diffDays < 0) return 'overdue'
  if (diffDays < 2) return 'soon'
  return 'normal'
}

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function isDueThisWeek(iso: string, now: Date = new Date()): boolean {
  const dueDate = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(dueDate.getTime())) return false
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(today)
  end.setDate(today.getDate() + 6)
  return dueDate >= today && dueDate <= end
}

export function startOfWeek(now: Date = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b)
}

export function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return '12 AM'
  if (hour === 12) return '12 PM'
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
}

/* ── Planner range helpers ─────────────────────────────────── */

export type PlannerRange = 'today' | '3days' | 'week' | 'month' | 'year'

export const PLANNER_RANGES: PlannerRange[] = ['today', '3days', 'week', 'month', 'year']

export const PLANNER_RANGE_LABELS: Record<PlannerRange, string> = {
  today: 'Today',
  '3days': '3 days',
  week: 'Week',
  month: 'Month',
  year: 'Year',
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function daysInYear(year: number): number {
  return daysInMonth(year, 1) === 29 ? 366 : 365
}

/** Anchor date for "jump to now" in a given range. */
export function plannerAnchorForToday(range: PlannerRange, now: Date = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  switch (range) {
    case 'week':
      return startOfWeek(d)
    case 'month':
      return new Date(d.getFullYear(), d.getMonth(), 1)
    case 'year':
      return new Date(d.getFullYear(), 0, 1)
    default:
      return d
  }
}

/** Step the anchor backward/forward within a range. */
export function plannerStep(range: PlannerRange, dir: 1 | -1): (d: Date) => Date {
  return (d: Date) => {
    switch (range) {
      case 'today':
        return addDays(d, dir)
      case '3days':
        return addDays(d, dir * 3)
      case 'week':
        return addDays(d, dir * 7)
      case 'month':
        return new Date(d.getFullYear(), d.getMonth() + dir, 1)
      case 'year':
        return new Date(d.getFullYear() + dir, 0, 1)
    }
  }
}

/** The list of day columns for a range, anchored at the given date. */
export function plannerDays(range: PlannerRange, anchor: Date): Date[] {
  switch (range) {
    case 'today':
      return [anchor]
    case '3days':
      return [0, 1, 2].map((i) => addDays(anchor, i))
    case 'week':
      return Array.from({ length: 7 }, (_, i) => addDays(anchor, i))
    case 'month':
      return Array.from(
        { length: daysInMonth(anchor.getFullYear(), anchor.getMonth()) },
        (_, i) => new Date(anchor.getFullYear(), anchor.getMonth(), i + 1),
      )
    case 'year':
      return Array.from(
        { length: daysInYear(anchor.getFullYear()) },
        (_, i) => new Date(anchor.getFullYear(), 0, i + 1),
      )
  }
}

/** Human-readable range label for the toolbar. */
export function plannerRangeLabel(range: PlannerRange, anchor: Date): string {
  const iso = toISODate
  switch (range) {
    case 'today':
      return formatDate(iso(anchor))
    case '3days':
      return `${formatDate(iso(anchor))} – ${formatDate(iso(addDays(anchor, 2)))}`
    case 'week':
      return `${formatDate(iso(anchor))} – ${formatDate(iso(addDays(anchor, 6)))}`
    case 'month':
      return anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    case 'year':
      return String(anchor.getFullYear())
  }
}
