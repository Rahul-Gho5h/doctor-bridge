/**
 * Page-level loading skeletons.
 * Each skeleton mirrors the real layout so the page feels instant
 * rather than showing a spinner or "Loading…" text.
 */
import { Skeleton } from "@/components/ui/skeleton";

// ── Primitives ────────────────────────────────────────────────────────────────

function SkeletonCard({ className }: { className?: string }) {
  return <Skeleton className={`rounded-xl ${className ?? ""}`} />;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Heading */}
      <div className="rounded-2xl border bg-card p-6 shadow-card space-y-2">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Primary KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 shadow-card">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="mt-3 h-7 w-14" />
            <Skeleton className="mt-1 h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Secondary KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3.5 shadow-card">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="space-y-1">
              <Skeleton className="h-5 w-10" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>

      {/* Chart + quick actions */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-6 shadow-card lg:col-span-2">
          <div className="mb-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <Skeleton className="h-60 w-full rounded-lg" />
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-card">
          <Skeleton className="h-5 w-32 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>

      {/* Recent lists */}
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((panel) => (
          <div key={panel} className="rounded-xl border bg-card shadow-card">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="divide-y">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-6 py-3.5">
                  <div className="space-y-1.5">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <div className="space-y-1.5 text-right">
                    <Skeleton className="h-4 w-16 ml-auto" />
                    <Skeleton className="h-3 w-12 ml-auto" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Generic table ─────────────────────────────────────────────────────────────

export function TableSkeleton({
  columns = 6,
  rows = 6,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      {/* Header */}
      <div className="flex gap-4 bg-muted/40 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {/* Rows */}
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            {Array.from({ length: columns }).map((_, j) => (
              <Skeleton
                key={j}
                className={`h-4 flex-1 ${j === 0 ? "max-w-[80px]" : j === columns - 1 ? "max-w-[60px]" : ""}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Doctor cards grid ─────────────────────────────────────────────────────────

export function DoctorCardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col rounded-xl border bg-card p-5 shadow-card">
          {/* Name + badge */}
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-3.5 w-24" />
            </div>
            <Skeleton className="h-5 w-20 rounded-md" />
          </div>
          {/* Qualifications */}
          <Skeleton className="mt-2 h-3 w-48" />
          {/* Tags */}
          <div className="mt-3 flex gap-1.5">
            {[56, 72, 48, 64].map((w) => (
              <Skeleton key={w} className={`h-5 rounded-md`} style={{ width: w }} />
            ))}
          </div>
          {/* Stats grid */}
          <div className="mt-4 grid grid-cols-2 gap-y-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-3 w-24" />
            ))}
          </div>
          {/* Capacity bar */}
          <Skeleton className="mt-4 h-8 w-full rounded-md" />
          {/* Buttons */}
          <div className="mt-4 flex gap-2 border-t pt-4">
            <Skeleton className="h-8 flex-1 rounded-md" />
            <Skeleton className="h-8 flex-1 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Analytics ────────────────────────────────────────────────────────────────

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 shadow-card space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      {/* Charts 2x2 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 shadow-card space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-[260px] w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── EMR timeline ─────────────────────────────────────────────────────────────

export function EmrSkeleton() {
  return (
    <div className="space-y-6">
      {/* Type filter pills */}
      <div className="flex flex-wrap gap-2">
        {[48, 56, 80, 96, 64, 72, 56].map((w, i) => (
          <Skeleton key={i} className="h-6 rounded-full" style={{ width: w }} />
        ))}
      </div>

      {/* Search + select row */}
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1 rounded-md" />
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>

      {/* Timeline groups */}
      {[3, 2, 2].map((count, gi) => (
        <section key={gi} className="space-y-2">
          {/* Date header */}
          <Skeleton className="h-3 w-48 mb-3" />
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 rounded-xl border bg-card p-4 shadow-card">
              {/* Type icon */}
              <Skeleton className="mt-0.5 h-8 w-8 shrink-0 rounded-md" />
              {/* Content */}
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20 rounded-md" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              {/* Arrow button */}
              <Skeleton className="h-7 w-16 shrink-0 rounded-md" />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

// ── Patient / referral detail (single-card) ───────────────────────────────────

export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-5 shadow-card space-y-3">
            <Skeleton className="h-5 w-32" />
            {Array.from({ length: 3 }).map((_, j) => (
              <Skeleton key={j} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
