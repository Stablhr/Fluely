'use client'

import { Skeleton } from '../shared/Skeleton'

export default function PlannerViewSkeleton() {
  return (
    <div className="flex h-full flex-col">
      {/* Toolbar skeleton */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2 sm:px-4 sm:py-3">
        <Skeleton className="h-6 w-20" />
        <div className="ml-2 flex items-center gap-1">
          <Skeleton className="h-7 w-7 rounded-md" />
          <Skeleton className="h-6 w-12 rounded-md" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
        <Skeleton className="ml-2 h-3.5 w-36" />
      </div>

      {/* Day columns skeleton */}
      <div className="flex h-full gap-4 overflow-hidden p-4">
        {/* Unscheduled pool skeleton */}
        <div className="w-[180px] shrink-0 rounded-lg ring-1 ring-border sm:w-[230px]">
          <div className="flex items-center gap-1.5 px-1 pb-2 pt-2 sm:px-1 sm:pt-3">
            <Skeleton className="h-3.5 w-3.5" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="ml-auto h-3 w-4" />
          </div>
          <div className="flex flex-col gap-1.5 p-2 sm:p-3 sm:pt-0">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="rounded-lg border border-border bg-surface p-2">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="mt-1 h-2.5 w-1/2" />
              </div>
            ))}
          </div>
        </div>

        {/* Day columns */}
        <div className="flex min-w-0 flex-1 gap-2">
          {Array.from({ length: 7 }, (_, day) => (
            <div key={day} className="flex min-w-0 flex-1 flex-col">
              {/* Day header */}
              <div className={`mb-2 rounded-md px-2 py-1.5 text-center ${day === 0 ? 'bg-primary' : 'bg-surface-alt'}`}>
                <Skeleton className={`mx-auto h-2.5 w-5 ${day === 0 ? 'opacity-50' : ''}`} />
                <Skeleton className={`mx-auto mt-1 h-4 w-4 ${day === 0 ? 'opacity-50' : ''}`} />
              </div>

              {/* Cards area */}
              <div className="min-h-[120px] flex-1 rounded-lg p-1.5 ring-1 ring-border">
                <div className="flex flex-col gap-1.5">
                  {Array.from({ length: day % 3 === 0 ? 2 : 1 }, (_, i) => (
                    <div key={i} className="rounded-lg border border-border bg-surface p-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="mt-1 h-2.5 w-2/3" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
