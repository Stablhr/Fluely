'use client'

import { Skeleton } from '../shared/Skeleton'

export default function DashboardSkeleton() {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:px-8 lg:py-6">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-4 w-72" />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[2fr_3fr]">
        <div className="rounded-card bg-base-surface p-6 shadow-card">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-8 w-16" />
          <Skeleton className="mt-2 h-12 w-full" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-card bg-base-surface p-5 shadow-card">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-8 w-12" />
            </div>
          ))}
        </div>
      </div>

      <Skeleton className="mt-6 h-11 max-w-md rounded-pill" />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:mt-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* DueSoonList skeleton */}
          <div className="rounded-card bg-base-surface p-6 shadow-card">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-chip" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="mt-3 divide-y divide-border">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex items-center gap-3 py-3">
                  <Skeleton className="h-3.5 flex-1" />
                  <Skeleton className="h-5 w-20 rounded-pill" />
                  <Skeleton className="h-5 w-16 rounded-pill" />
                </div>
              ))}
            </div>
          </div>

          {/* RecentBoardsList skeleton */}
          <div className="rounded-card bg-base-surface p-6 shadow-card">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-chip" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-16 rounded-card" />
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* PlannerPreview skeleton */}
          <div className="rounded-card bg-base-surface p-6 shadow-card">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-7 rounded-chip" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="ml-auto h-3 w-20" />
            </div>
            <div className="mt-4 grid grid-cols-7 gap-1.5">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="flex flex-col items-center rounded-chip px-1 py-2 shadow-card">
                  <Skeleton className="h-2.5 w-3" />
                  <Skeleton className="mt-1 h-4 w-4" />
                  <Skeleton className="mt-1 h-1.5 w-1.5 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          {/* PromoCard skeleton */}
          <div className="rounded-card bg-sidebar-bg p-6 shadow-card">
            <Skeleton className="h-9 w-9 rounded-chip" />
            <Skeleton className="mt-4 h-4 w-32 bg-white/20" />
            <Skeleton className="mt-2 h-3 w-44 bg-white/20" />
            <Skeleton className="mt-4 h-8 w-28 rounded-pill bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  )
}