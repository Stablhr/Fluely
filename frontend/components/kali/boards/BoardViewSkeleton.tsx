'use client'

import { Skeleton } from '../shared/Skeleton'

export default function BoardViewSkeleton() {
  return (
    <div className="flex h-full flex-col">
      {/* Top bar skeleton */}
      <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
        <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
        <div className="ml-2 hidden h-9 w-48 items-center gap-2 rounded-lg px-2.5 sm:flex">
          <Skeleton className="h-3.5 w-3.5" />
          <Skeleton className="h-3.5 w-24" />
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>

      {/* Columns skeleton */}
      <div className="flex h-full items-start gap-3 overflow-hidden p-4">
        {Array.from({ length: 4 }, (_, col) => (
          <div key={col} className="w-[272px] shrink-0">
            <div className="rounded-xl border border-border bg-surface-alt" >
              {/* Column header */}
              <div className="flex items-center gap-1 px-2 pb-1 pt-2.5">
                <Skeleton className="h-3.5 w-3.5" />
                <Skeleton className="h-4 w-20 flex-1" />
                <Skeleton className="h-3.5 w-5" />
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-1.5 px-2 pb-2">
                {Array.from({ length: 2 + (col % 2) }, (_, card) => (
                  <div key={card} className="rounded-xl border border-border bg-surface p-2.5">
                    {card === 0 && <Skeleton className="mb-2 h-16 rounded-lg" />}
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="mt-1.5 h-2.5 w-1/2" />
                    {card === 0 && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <Skeleton className="h-4 w-8 rounded-full" />
                        <Skeleton className="h-4 w-8 rounded-full" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Add card button */}
                <div className="flex items-center gap-1.5 px-2 py-1.5">
                  <Skeleton className="h-3.5 w-3.5" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Add list button */}
        <div className="w-[272px] shrink-0">
          <Skeleton className="h-10 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
