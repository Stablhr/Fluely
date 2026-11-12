'use client'

import { Skeleton } from '../shared/Skeleton'

/** Mirrors BoardsHome: title + count, create button, then board tiles (band + name). */
export default function BoardsHomeSkeleton() {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8" aria-busy="true" aria-label="Loading boards">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-28" />
          <Skeleton className="mt-2 h-3.5 w-20" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      <div className="stagger mt-4 grid grid-cols-2 gap-3 sm:mt-6 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-card border border-border bg-surface">
            <Skeleton className="h-14 rounded-none sm:h-16" />
            <div className="px-3 py-2.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="mt-1.5 h-2.5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
