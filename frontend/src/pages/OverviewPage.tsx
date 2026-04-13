import { PageSkeleton } from '../components/Skeletons';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { motion } from 'framer-motion';
import { api, buildUrl } from '../lib/api';
import { useFilters } from '../lib/filters';
import { formatCurrency, formatPct, monthLabel, generateMonthOptions, cn, gpColor, CHART_COLORS, tyreTypeColor } from '../lib/utils';
import { KpiCard } from '../components/KpiCard';
import { SearchPill } from '../components/CommandPalette';
import { ExportPDF } from '../components/ExportPDF';
import { DollarSign, TrendingUp, Package, Users, ShoppingCart, Percent } from 'lucide-react';
import type { OverviewResponse } from '../types';

function Card({ title, subtitle, children, className = '' }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className={cn('overflow-hidden', className)}
      style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.04)', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02)' }}>
      <div className="px-5 pt-4 pb-2">
        <h3 className="text-[13px] font-bold text-gray-700">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-4 pb-4">{children}</div>
    </motion.div>
  );
}

export function OverviewPage() {
  const filters = useFilters();
  const { month } = filters;
  const monthOptions = generateMonthOptions(12);

  const { data, isLoading } = useQuery({
    queryKey: ['overview', month],
    queryFn: () => api.get<OverviewResponse>(buildUrl('/api/overview', { month })),
    staleTime: 3 * 60 * 1000,
  });

  if (isLoading && !data) return <PageSkeleton />;

  const kpis = data?.kpis;
  const dailyChart = data?.daily_chart || [];
  const topSalesmen = data?.top_salesmen || [];
  const topBrands = data?.top_brands || [];
  const categories = data?.categories || [];
  const alerts = data?.alerts || [];
  const monthsAvailable = data?.months_available || monthOptions.map(m => m.value);

  const progressPct = kpis ? Math.round((kpis.days_elapsed / kpis.days_in_month) * 100) : 0;

  // Daily revenue trend chart
  const dailyTrendOption = dailyChart.length > 0 ? {
    tooltip: { trigger: 'axis' as const, backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#e2e8f0', borderWidth: 1, extraCssText: 'box-shadow:0 4px 20px rgba(0,0,0,0.08);border-radius:10px;', textStyle: { fontSize: 11 } },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category' as const, data: dailyChart.map(d => d.date.split('-').pop()), axisLabel: { fontSize: 10, color: '#94a3b8' }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
    yAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => formatCurrency(v, true), fontSize: 10, color: '#94a3b8' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    series: [{
      type: 'bar' as const, data: dailyChart.map(d => d.revenue),
      itemStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#14b8a6' }, { offset: 1, color: '#0d9488' }] }, borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 16,
    }],
  } : null;

  // Tyre type donut chart
  const typeDonutOption = categories.length > 0 ? {
    tooltip: { trigger: 'item' as const, formatter: (p: any) => `<b>${p.name}</b><br/>AED ${formatCurrency(p.value)}<br/>${p.percent?.toFixed(1)}%` },
    legend: { bottom: 0, textStyle: { fontSize: 10, color: '#64748b' }, itemWidth: 12, itemHeight: 8 },
    series: [{
      type: 'pie' as const, radius: ['45%', '72%'], center: ['50%', '45%'],
      label: { show: false }, emphasis: { label: { show: true, fontSize: 12, fontWeight: 'bold' } },
      data: categories.map(c => ({ name: c.category, value: c.revenue, itemStyle: { color: tyreTypeColor(c.category) } })),
    }],
  } : null;

  // Top brands bar chart
  const maxBrandRev = Math.max(...topBrands.map(b => b.revenue), 1);
  const brandBarOption = topBrands.length > 0 ? {
    tooltip: { trigger: 'axis' as const, formatter: (params: any) => `<b>${params[0].name}</b><br/>AED ${formatCurrency(params[0].value)}` },
    grid: { left: 120, right: 50, top: 8, bottom: 8 },
    xAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => formatCurrency(v, true), fontSize: 10, color: '#94a3b8' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    yAxis: { type: 'category' as const, data: [...topBrands].reverse().map(b => b.brand), axisLabel: { fontSize: 10, color: '#475569', width: 110, overflow: 'truncate' as const }, axisTick: { show: false }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
    series: [{ type: 'bar' as const, data: [...topBrands].reverse().map((b, i) => ({ value: b.revenue, itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length], borderRadius: [0, 4, 4, 0] } })), barMaxWidth: 14, label: { show: true, position: 'right' as const, fontSize: 9, color: '#64748b', fontFamily: "'JetBrains Mono',monospace", formatter: (p: any) => formatCurrency(p.value, true) } }],
  } : null;

  // Top salesmen horizontal bar
  const smBarOption = topSalesmen.length > 0 ? {
    tooltip: { trigger: 'axis' as const, formatter: (params: any) => `<b>${params[0].name}</b><br/>AED ${formatCurrency(params[0].value)}` },
    grid: { left: 130, right: 50, top: 8, bottom: 8 },
    xAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => formatCurrency(v, true), fontSize: 10, color: '#94a3b8' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    yAxis: { type: 'category' as const, data: [...topSalesmen].reverse().map(s => s.salesman), axisLabel: { fontSize: 10, color: '#475569', width: 120, overflow: 'truncate' as const }, axisTick: { show: false }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
    series: [{ type: 'bar' as const, data: [...topSalesmen].reverse().map((s, i) => ({ value: s.revenue, itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length], borderRadius: [0, 4, 4, 0] } })), barMaxWidth: 14, label: { show: true, position: 'right' as const, fontSize: 9, color: '#64748b', fontFamily: "'JetBrains Mono',monospace", formatter: (p: any) => formatCurrency(p.value, true) } }],
  } : null;

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tyres Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">{monthLabel(month)}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPDF title="Tyres Dashboard" />
          <SearchPill />
          <select value={month} onChange={e => filters.setMonth(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white focus:ring-2 focus:ring-teal-200 outline-none shadow-sm">
            {monthsAvailable.map((m: string) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((alert, i) => (
            <div key={i} className={cn('px-4 py-2.5 rounded-xl border-l-4 text-sm',
              alert.severity === 'critical' ? 'bg-red-50 border-l-red-500 text-red-700' :
              alert.severity === 'warning' ? 'bg-amber-50 border-l-amber-500 text-amber-700' :
              alert.severity === 'success' ? 'bg-emerald-50 border-l-emerald-500 text-emerald-700' :
              'bg-blue-50 border-l-blue-500 text-blue-700'
            )}>
              <span className="font-semibold">{alert.title}</span>
              <span className="ml-2 text-xs opacity-75">{alert.detail}</span>
            </div>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="kpi-grid">
        <KpiCard title="Revenue" formattedValue={kpis ? `AED ${formatCurrency(kpis.revenue)}` : '—'} value={kpis?.revenue || 0} numericValue={kpis?.revenue} animate accentColor="teal" icon={<DollarSign />}
          progress={progressPct} progressLabel={`Day ${kpis?.days_elapsed || 0} of ${kpis?.days_in_month || 30}`} />
        <KpiCard title="Gross Profit %" formattedValue={formatPct(kpis?.gp_pct)} value={kpis?.gp_pct || 0} accentColor="emerald" icon={<Percent />} />
        <KpiCard title="Projected Revenue" formattedValue={kpis ? `AED ${formatCurrency(kpis.projected_revenue)}` : '—'} value={kpis?.projected_revenue || 0} numericValue={kpis?.projected_revenue} animate accentColor="sky" icon={<TrendingUp />} />
        <KpiCard title="Units Sold" formattedValue={kpis?.units_sold?.toLocaleString() || '—'} value={kpis?.units_sold || 0} accentColor="amber" icon={<Package />} />
        <KpiCard title="Avg Selling Price" formattedValue={kpis?.avg_selling_price ? `AED ${formatCurrency(kpis.avg_selling_price)}` : '—'} value={kpis?.avg_selling_price || 0} accentColor="indigo" icon={<ShoppingCart />} />
        <KpiCard title="Customers" formattedValue={kpis?.customers?.toLocaleString() || '—'} value={kpis?.customers || 0} accentColor="rose" icon={<Users />} />
      </div>

      {/* Row 1: Daily Trend + Tyre Type Donut */}
      <div className="chart-grid-2">
        {dailyTrendOption && (
          <Card title="Daily Revenue" subtitle={monthLabel(month)}>
            <ReactECharts option={dailyTrendOption} style={{ height: 280 }} />
          </Card>
        )}
        {typeDonutOption && (
          <Card title="Revenue by Tyre Type" subtitle="PCR / TBR / OTR breakdown">
            <ReactECharts option={typeDonutOption} style={{ height: 280 }} />
          </Card>
        )}
      </div>

      {/* Row 2: Top Brands + Top Salesmen */}
      <div className="chart-grid-2">
        {brandBarOption && (
          <Card title="Top Brands" subtitle="By revenue">
            <ReactECharts option={brandBarOption} style={{ height: 300 }} />
          </Card>
        )}
        {smBarOption && (
          <Card title="Top Salesmen" subtitle="By revenue">
            <ReactECharts option={smBarOption} style={{ height: 300 }} />
          </Card>
        )}
      </div>
    </div>
  );
}
