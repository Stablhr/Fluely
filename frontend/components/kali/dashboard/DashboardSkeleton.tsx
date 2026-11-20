'use client'

import { Skeleton } from '../shared/Skeleton'

function PanelSkeleton({ rows, chart = false }: { rows: number; chart?: boolean }) {
  return (
    <div className="rounded-card border border-border bg-surface">
      <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
        <Skeleton className="h-7 w-7 rounded-chip" />
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="ml-auto h-3 w-16" />
      </div>
      {chart ? (
        <div className="grid h-52 grid-cols-7 items-end gap-3 px-5 py-4">
          {[40, 70, 30, 85, 55, 20, 45].map((h, i) => (
            <Skeleton key={i} className="w-full rounded-b-none" style={{ height: `${h}%` }} />
          ))}
        </div>
      ) : (
        <div className="space-y-4 px-5 py-4">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Mirrors DashboardView: header, four KPIs, then the two-column grid. */
export default function DashboardSkeleton() {
  return (
    <div className="h-full overflow-y-auto" aria-busy="true" aria-label="Loading dashboard">
      <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 lg:px-8 lg:py-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="mt-2 h-7 w-56" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>
        </div>

        <div className="stagger mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-card border border-border bg-surface p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-7 rounded-chip" />
              </div>
              <Skeleton className="mt-3 h-7 w-12" />
              <Skeleton className="mt-2 h-3 w-24" />
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="stagger flex flex-col gap-4">
            <PanelSkeleton rows={0} chart />
            <PanelSkeleton rows={4} />
          </div>
          <div className="stagger flex flex-col gap-4">
            <PanelSkeleton rows={3} />
            <PanelSkeleton rows={4} />
          </div>
        </div>
      </div>
    </div>
  )
}
