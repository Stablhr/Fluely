'use client'

import { Skeleton, SkeletonText } from '../shared/Skeleton'

export default function ContentPlannerSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2 sm:px-4 sm:py-3">
        <Skeleton className="h-6 w-36 rounded-md" />
        <div className="ml-auto flex items-center gap-1.5">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      <div className="scroll-slim flex h-full min-h-0 gap-4 overflow-x-auto p-4">
        <div className="hidden w-[180px] shrink-0 flex-col gap-2 lg:flex">
          <Skeleton className="h-5 w-24 rounded-md" />
          <SkeletonText lines={3} />
        </div>

        <div className="flex min-w-0 flex-1 gap-2">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-10 w-full rounded-md" />
              {Array.from({ length: 4 }, (_, j) => (
                <Skeleton key={j} className="h-10 w-full rounded-md" style={{ opacity: 1 - j * 0.18 }} />
              ))}
            </div>
          ))}
        </div>

        <div className="hidden w-[230px] shrink-0 flex-col gap-3 md:flex">
          <Skeleton className="h-5 w-28 rounded-md" />
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
          <Skeleton className="h-5 w-32 rounded-md" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    </div>
  )
}