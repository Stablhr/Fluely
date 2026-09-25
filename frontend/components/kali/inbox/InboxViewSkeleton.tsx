'use client'

import { Skeleton } from '../shared/Skeleton'

export default function InboxViewSkeleton() {
  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto p-4 sm:p-6 md:p-8">
      <Skeleton className="h-7 w-20" />
      <Skeleton className="mt-2 h-4 w-72" />

      <Skeleton className="mt-6 h-10 rounded-xl" />

      <div className="mt-6 space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-3 w-20 sm:block" />
            <div className="flex items-center gap-1">
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-7 w-7 rounded-lg" />
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
