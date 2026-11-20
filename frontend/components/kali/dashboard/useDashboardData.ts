'use client'

import { useMemo } from 'react'
import { useStore } from '@/lib/kali/store/useStore'
import { useSocialPosts } from '@/lib/kali/feature-hooks/useSocialPosts'
import type { Card, SocialPost } from '@/lib/kali/store/schema'
import { addDays, getUrgency, isDueThisWeek, toISODate } from '@/lib/kali/utils/dates'

export interface DayLoad {
  iso: string
  weekday: string
  day: number
  count: number
  isToday: boolean
}

export interface DueGroup {
  key: 'overdue' | 'today' | 'upcoming'
  label: string
  cards: Card[]
}

/** Statuses that mean a post is still going to go out. */
const PENDING_POST = new Set<SocialPost['status']>(['idea', 'draft', 'in_review', 'scheduled', 'publishing'])

/**
 * Everything the dashboard shows, derived once from the store. Widgets read
 * from here so a number means the same thing everywhere it appears.
 */
export function useDashboardData(dueLimit = 8, postLimit = 5) {
  const { data } = useStore()
  const { posts: socialPosts } = useSocialPosts()

  return useMemo(() => {
    const now = new Date()
    const today = toISODate(now)
    const weekAhead = toISODate(addDays(now, 7))

    const open = Object.values(data.cards).filter((c) => !c.archived && !c.done)
    const withDue = open.filter((c): c is Card & { dueDate: string } => Boolean(c.dueDate))

    const overdue = withDue.filter((c) => getUrgency(c.dueDate, now) === 'overdue')
    const dueToday = withDue.filter((c) => c.dueDate === today)
    const dueThisWeek = withDue.filter((c) => isDueThisWeek(c.dueDate, now))
    const boardsWithOpen = new Set(open.map((c) => c.boardId)).size

    // Next seven days starting today, for the workload chart.
    const week: DayLoad[] = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(now, i)
      const iso = toISODate(date)
      return {
        iso,
        weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
        day: date.getDate(),
        count: withDue.filter((c) => c.dueDate === iso).length,
        isToday: i === 0,
      }
    })

    // Due soon, grouped so the urgent things lead.
    const upcoming = withDue
      .filter((c) => c.dueDate > today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    const byDue = (a: Card, b: Card) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')
    // At most `dueLimit` rows in total, filled in urgency order.
    const overdueShown = [...overdue].sort(byDue).slice(0, dueLimit)
    const todayShown = dueToday.slice(0, dueLimit - overdueShown.length)
    const upcomingShown = upcoming.slice(0, dueLimit - overdueShown.length - todayShown.length)
    const dueGroups: DueGroup[] = [
      { key: 'overdue' as const, label: 'Overdue', cards: overdueShown },
      { key: 'today' as const, label: 'Today', cards: todayShown },
      { key: 'upcoming' as const, label: 'Upcoming', cards: upcomingShown },
    ].filter((g) => g.cards.length > 0)

    // Social posts going out in the next seven days.
    const posts = socialPosts
      .filter((p) => p.scheduledDate && p.scheduledDate >= today && PENDING_POST.has(p.status))
      .sort((a, b) =>
        `${a.scheduledDate}${a.scheduledTime ?? ''}`.localeCompare(`${b.scheduledDate}${b.scheduledTime ?? ''}`),
      )
    const postsThisWeek = posts.filter((p) => (p.scheduledDate ?? '') <= weekAhead)

    const recentBoards = Object.values(data.boards)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 5)

    return {
      openCount: open.length,
      boardsWithOpen,
      dueThisWeekCount: dueThisWeek.length,
      dueTodayCount: dueToday.length,
      overdueCount: overdue.length,
      postsThisWeekCount: postsThisWeek.length,
      week,
      dueGroups,
      totalDueShown: dueGroups.reduce((n, g) => n + g.cards.length, 0),
      upcomingPosts: posts.slice(0, postLimit),
      recentBoards,
      boards: data.boards,
    }
  }, [data.cards, data.boards, socialPosts, dueLimit, postLimit])
}
