'use client'

import type { CSSProperties } from 'react'
import { useState, useEffect } from 'react'
import type { SocialPost } from '@/lib/kali/store/schema'
import { toISODate, formatHour, isSameDay } from '@/lib/kali/utils/dates'
import { START_HOUR, END_HOUR, HOUR_HEIGHT } from './types'
import TimeSlotCell from './TimeSlotCell'

interface WeeklyTimeGridProps {
  days: Date[]
  posts: SocialPost[]
  onPostClick: (post: SocialPost) => void
  onSlotClick: (date: string, hour: number) => void
  style?: CSSProperties
}

const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

export default function WeeklyTimeGrid({ days, posts, onPostClick, onSlotClick, style }: WeeklyTimeGridProps) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const today = new Date()
  const nowHour = now.getHours() + now.getMinutes() / 60

  const dayPosts = (date: Date) => {
    const iso = toISODate(date)
    return posts
      .filter((p) => p.scheduledDate === iso)
      .sort((a, b) => {
        if (a.scheduledTime && b.scheduledTime) return a.scheduledTime.localeCompare(b.scheduledTime)
        if (a.scheduledTime) return -1
        if (b.scheduledTime) return 1
        return 0
      })
  }

  const postsInHour = (datePosts: SocialPost[], hour: number) => {
    return datePosts.filter((p) => {
      if (!p.scheduledTime) return hour === START_HOUR
      const h = Number(p.scheduledTime.split(':')[0])
      return h === hour
    })
  }

  return (
    <div className="scroll-slim flex min-h-0 min-w-[820px] flex-1 flex-col overflow-y-auto" style={style}>
      {/* Day headers */}
      <div className="sticky top-0 z-10 flex border-b border-border bg-surface">
        <div className="w-12 shrink-0 border-r border-border" />
        {days.map((d) => {
          const isToday = isSameDay(d, today)
          return (
            <div
              key={toISODate(d)}
              className={`flex-1 border-r border-border/50 px-1 py-1.5 text-center last:border-r-0 ${
                isToday ? 'bg-primary/5' : ''
              }`}
            >
              <p
                className={`text-[10px] font-semibold uppercase tracking-[0.06em] ${
                  isToday ? 'text-primary' : 'text-text-secondary'
                }`}
              >
                {d.toLocaleDateString('en-US', { weekday: 'short' })}
              </p>
              <p
                className={`font-mono text-sm font-bold ${
                  isToday ? 'text-primary' : 'text-text-primary'
                }`}
              >
                {d.getDate()}
              </p>
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="relative flex flex-1">
        {/* Time labels */}
        <div className="w-12 shrink-0">
          {HOURS.map((h) => (
            <div
              key={h}
              className="flex items-start justify-end border-b border-border/50 px-1.5 pt-0.5"
              style={{ height: HOUR_HEIGHT }}
            >
              <span className="font-mono text-[10px] leading-none text-text-muted">
                {formatHour(h)}
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((d) => {
          const iso = toISODate(d)
          const dPosts = dayPosts(d)
          const isToday = isSameDay(d, today)
          const showLine = isToday && nowHour >= START_HOUR && nowHour <= END_HOUR
          const lineOffset = (nowHour - START_HOUR) * HOUR_HEIGHT

          return (
            <div
              key={iso}
              className={`relative flex-1 border-l border-border/50 last:border-l-0 ${
                isToday ? 'bg-primary/[0.02]' : ''
              }`}
            >
              {HOURS.map((h) => (
                <TimeSlotCell
                  key={`${iso}-${h}`}
                  date={iso}
                  hour={h}
                  posts={postsInHour(dPosts, h)}
                  onPostClick={onPostClick}
                  onSlotClick={onSlotClick}
                />
              ))}
              {showLine && (
                <div
                  className="pointer-events-none absolute left-0 right-0 z-20 border-t-2 border-danger"
                  style={{ top: lineOffset }}
                >
                  <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-danger" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}