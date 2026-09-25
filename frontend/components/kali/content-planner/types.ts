import type { Platform } from '@/lib/kali/store/schema'

export type SidebarTab = 'engagement' | 'tips' | 'goals'

export type PlatformFilter = 'all' | Platform

export const START_HOUR = 6
export const END_HOUR = 23
export const HOUR_HEIGHT = 56

export function slotId(date: string, hour: number): string {
  return `slot_${date}_${hour}`
}

export function parseSlotId(id: string): { date: string; hour: number } | null {
  const [prefix, date, hourStr] = id.split('_')
  if (prefix !== 'slot' || !date || hourStr === undefined) return null
  const hour = Number(hourStr)
  if (!Number.isInteger(hour)) return null
  return { date, hour }
}

export function hourToTime(hour: number): string {
  if (!Number.isFinite(hour)) return ''
  const h = Math.floor(hour)
  const m = Math.round((hour - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}