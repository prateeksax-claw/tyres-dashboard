export function KpiSkeleton() {
  return (
    <div className="glass-card relative overflow-hidden p-5 pt-6">
      <div className="absolute top-0 left-0 right-0 h-[3px] skeleton-shimmer" />
      <div className="flex items-start justify-between mb-3">
        <div className="h-2.5 w-16 bg-gray-200 dark:bg-slate-700 rounded skeleton-shimmer" />
        <div className="w-8 h-8 bg-gray-100 dark:bg-slate-700 rounded-lg skeleton-shimmer" />
      </div>
      <div className="h-8 w-28 bg-gray-200 dark:bg-slate-700 rounded-lg mb-2 skeleton-shimmer" />
      <div className="h-2.5 w-20 bg-gray-100 dark:bg-slate-700 rounded skeleton-shimmer" />
    </div>
  );
}

export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="glass-card p-5">
      <div className="h-4 w-36 bg-gray-200 dark:bg-slate-700 rounded mb-4 skeleton-shimmer" />
      <div className="rounded-lg skeleton-shimmer" style={{ height }} />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="glass-card p-5">
      <div className="h-4 w-40 bg-gray-200 dark:bg-slate-700 rounded mb-4 skeleton-shimmer" />
      <div className="space-y-3">
        <div className="flex gap-4 pb-2 border-b border-gray-100 dark:border-slate-700">
          {Array.from({ length: cols }).map((_, i) => (
            <div key={i} className="h-3 bg-gray-200 dark:bg-slate-700 rounded skeleton-shimmer" style={{ width: `${100 / cols}%` }} />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="h-3 bg-gray-100 dark:bg-slate-800 rounded skeleton-shimmer" style={{ width: `${100 / cols}%` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 max-w-[1600px] mx-auto fade-in">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-48 bg-gray-200 dark:bg-slate-700 rounded-lg mb-2 skeleton-shimmer" />
          <div className="h-3.5 w-32 bg-gray-100 dark:bg-slate-800 rounded skeleton-shimmer" />
        </div>
        <div className="h-9 w-32 bg-gray-100 dark:bg-slate-800 rounded-lg skeleton-shimmer" />
      </div>
      <div className="kpi-grid">
        {Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)}
      </div>
      <div className="chart-grid-2">
        <ChartSkeleton height={240} />
        <ChartSkeleton height={240} />
      </div>
      <TableSkeleton rows={6} cols={5} />
    </div>
  );
}
