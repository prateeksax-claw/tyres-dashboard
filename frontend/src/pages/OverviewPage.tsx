import { PageSkeleton } from '../components/Skeletons';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { motion } from 'framer-motion';
import { api, buildUrl } from '../lib/api';
import { useFilters } from '../lib/filters';
import { formatCurrency, formatPct, monthLabel, generateMonthOptions, cn, gpColor, CHART_COLORS } from '../lib/utils';
import { KpiCard } from '../components/KpiCard';
import { SearchPill } from '../components/CommandPalette';
import { ExportPDF } from '../components/ExportPDF';
import { DollarSign, TrendingUp, Package, Users, ShoppingCart, Percent, Target, FileText, RefreshCw } from 'lucide-react';

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

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['overview', month],
    queryFn: () => api.get<any>(buildUrl('/api/overview', { month })),
    staleTime: 3 * 60 * 1000,
  });

  if (isLoading && !data) return <PageSkeleton />;

  const kpis = data?.kpis || {};
  const mom = data?.mom || {};
  const dailyChart = data?.daily_chart || [];
  const topSalesmen = data?.salesmen?.slice(0, 10) || [];
  const branches = data?.branches || [];
  const trend = data?.monthly_trend || [];
  const monthsAvailable = data?.months_available || monthOptions.map(m => m.value);
  const progressPct = kpis.days_in_month ? Math.round((kpis.days_elapsed / kpis.days_in_month) * 100) : 0;
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' }) : '';

  // Daily revenue trend
  const dailyTrendOption = dailyChart.length > 0 ? {
    tooltip: { trigger: 'axis' as const, backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#e2e8f0', borderWidth: 1, extraCssText: 'box-shadow:0 4px 20px rgba(0,0,0,0.08);border-radius:10px;', textStyle: { fontSize: 11 } },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category' as const, data: dailyChart.map((d: any) => d.date.split('-').pop()), axisLabel: { fontSize: 10, color: '#94a3b8' }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
    yAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => formatCurrency(v, true), fontSize: 10, color: '#94a3b8' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    series: [{
      type: 'bar' as const, data: dailyChart.map((d: any) => d.revenue),
      itemStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#14b8a6' }, { offset: 1, color: '#0d9488' }] }, borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 16,
    }],
  } : null;

  // Monthly trend (12 months)
  const monthlyTrendOption = trend.length > 0 ? {
    tooltip: { trigger: 'axis' as const, backgroundColor: 'rgba(255,255,255,0.96)', borderColor: '#e2e8f0', borderWidth: 1, extraCssText: 'box-shadow:0 4px 20px rgba(0,0,0,0.08);border-radius:10px;', textStyle: { fontSize: 11 } },
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category' as const, data: trend.map((t: any) => monthLabel(t.month)), axisLabel: { fontSize: 10, color: '#94a3b8', rotate: 30 }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
    yAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => formatCurrency(v, true), fontSize: 10, color: '#94a3b8' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    series: [{
      type: 'line' as const, smooth: true, data: trend.map((t: any) => t.revenue),
      lineStyle: { color: '#0d9488', width: 2.5 }, itemStyle: { color: '#0d9488' },
      areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(13,148,136,0.15)' }, { offset: 1, color: 'rgba(13,148,136,0.02)' }] } },
      symbol: 'circle', symbolSize: 5,
    }],
  } : null;

  // Top salesmen horizontal bar
  const smBarOption = topSalesmen.length > 0 ? {
    tooltip: { trigger: 'axis' as const, formatter: (params: any) => `<b>${params[0].name}</b><br/>AED ${formatCurrency(params[0].value)}` },
    grid: { left: 130, right: 50, top: 8, bottom: 8 },
    xAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => formatCurrency(v, true), fontSize: 10, color: '#94a3b8' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    yAxis: { type: 'category' as const, data: [...topSalesmen].reverse().map((s: any) => s.SalesMan), axisLabel: { fontSize: 10, color: '#475569', width: 120, overflow: 'truncate' as const }, axisTick: { show: false }, axisLine: { lineStyle: { color: '#e2e8f0' } } },
    series: [{ type: 'bar' as const, data: [...topSalesmen].reverse().map((s: any, i: number) => ({ value: s.Revenue, itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length], borderRadius: [0, 4, 4, 0] } })), barMaxWidth: 14, label: { show: true, position: 'right' as const, fontSize: 9, color: '#64748b', fontFamily: "'JetBrains Mono',monospace", formatter: (p: any) => formatCurrency(p.value, true) } }],
  } : null;

  // Branch donut
  const branchDonutOption = branches.length > 0 ? {
    tooltip: { trigger: 'item' as const, formatter: (p: any) => `<b>${p.name}</b><br/>AED ${formatCurrency(p.value)}<br/>${p.percent?.toFixed(1)}%` },
    legend: { bottom: 0, textStyle: { fontSize: 10, color: '#64748b' }, itemWidth: 12, itemHeight: 8 },
    series: [{
      type: 'pie' as const, radius: ['45%', '72%'], center: ['50%', '42%'],
      label: { show: false }, emphasis: { label: { show: true, fontSize: 12, fontWeight: 'bold' } },
      data: branches.slice(0, 8).map((b: any, i: number) => ({ name: b.branch, value: b.revenue, itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] } })),
    }],
  } : null;

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tyres Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {monthLabel(month)}
            {lastUpdated && <span className="ml-2 text-gray-400">Updated {lastUpdated}</span>}
          </p>
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

      {/* KPIs — 2 rows of 4 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Revenue" formattedValue={`AED ${formatCurrency(kpis.revenue || 0)}`} value={kpis.revenue || 0} numericValue={kpis.revenue} animate
          accentColor="teal" icon={<DollarSign />} change={mom.revenue_pct} changeLabel="MoM"
          progress={progressPct} progressLabel={`Day ${kpis.days_elapsed || 0} of ${kpis.days_in_month || 30}`} />
        <KpiCard title="Gross Profit %" formattedValue={formatPct(kpis.gp_pct)} value={kpis.gp_pct || 0}
          accentColor="emerald" icon={<Percent />} change={mom.gp_change} changeLabel="vs prev" />
        <KpiCard title="Projected Revenue" formattedValue={`AED ${formatCurrency(kpis.projected_revenue || 0)}`} value={kpis.projected_revenue || 0} numericValue={kpis.projected_revenue} animate
          accentColor="sky" icon={<TrendingUp />} subtitle={`Target: AED ${formatCurrency(kpis.target || 0, true)}`} />
        <KpiCard title="Target Achievement" formattedValue={`${kpis.achievement_pct || 0}%`} value={kpis.achievement_pct || 0}
          accentColor="indigo" icon={<Target />} progress={Math.min(kpis.achievement_pct || 0, 100)} progressLabel={`${kpis.achievement_pct || 0}% of target`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Units Sold" formattedValue={(kpis.units_sold || 0).toLocaleString()} value={kpis.units_sold || 0}
          accentColor="amber" icon={<Package />} change={mom.units_pct} changeLabel="MoM" />
        <KpiCard title="Avg Selling Price" formattedValue={`AED ${formatCurrency(kpis.avg_selling_price || 0)}`} value={kpis.avg_selling_price || 0}
          accentColor="sky" icon={<ShoppingCart />} />
        <KpiCard title="Customers" formattedValue={(kpis.customers || 0).toLocaleString()} value={kpis.customers || 0}
          accentColor="rose" icon={<Users />} change={mom.customers_pct} changeLabel="MoM" />
        <KpiCard title="Invoices" formattedValue={(kpis.invoices || 0).toLocaleString()} value={kpis.invoices || 0}
          accentColor="indigo" icon={<FileText />} />
      </div>

      {/* Row 1: Daily Trend + Monthly Trend */}
      <div className="chart-grid-2">
        {dailyTrendOption && (
          <Card title="Daily Revenue" subtitle={monthLabel(month)}>
            <ReactECharts option={dailyTrendOption} style={{ height: 280 }} />
          </Card>
        )}
        {monthlyTrendOption && (
          <Card title="Monthly Trend" subtitle="Last 12 months">
            <ReactECharts option={monthlyTrendOption} style={{ height: 280 }} />
          </Card>
        )}
      </div>

      {/* Row 2: Top Salesmen + Branch Donut */}
      <div className="chart-grid-2">
        {smBarOption && (
          <Card title="Top Salesmen" subtitle="By revenue">
            <ReactECharts option={smBarOption} style={{ height: 320 }} />
          </Card>
        )}
        {branchDonutOption && (
          <Card title="Revenue by Branch" subtitle="Location breakdown">
            <ReactECharts option={branchDonutOption} style={{ height: 320 }} />
          </Card>
        )}
      </div>
    </div>
  );
}
