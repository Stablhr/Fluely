import { describe, expect, it } from 'vitest'
import { localToUTC } from './timezones'

describe('scheduled times in the poster’s time zone', () => {
  it('converts a Manila morning to UTC', () => {
    expect(localToUTC('2030-01-15', '09:30', 'Asia/Manila')).toBe('2030-01-15T01:30:00.000Z')
  })

  it('follows daylight saving time', () => {
    // New York is UTC-5 in winter and UTC-4 in summer.
    expect(localToUTC('2030-01-15', '09:00', 'America/New_York')).toBe('2030-01-15T14:00:00.000Z')
    expect(localToUTC('2030-07-15', '09:00', 'America/New_York')).toBe('2030-07-15T13:00:00.000Z')
  })

  it('returns an empty string for a date it cannot read', () => {
    expect(localToUTC('not-a-date', '09:00', 'UTC')).toBe('')
  })
})
