'use client'

import { Skeleton } from '../shared/Skeleton'

export default function BoardsHomeSkeleton() {
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-24" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
