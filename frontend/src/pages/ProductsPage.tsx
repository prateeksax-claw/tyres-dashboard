import { PageSkeleton } from '../components/Skeletons';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { motion } from 'framer-motion';
import { api, buildUrl } from '../lib/api';
import { useFilters } from '../lib/filters';
import { formatCurrency, formatPct, monthLabel, generateMonthOptions, cn, gpColor, CHART_COLORS, tyreTypeColor } from '../lib/utils';
import { KpiCard } from '../components/KpiCard';
import { Package, BarChart3, TrendingUp, DollarSign, Download } from 'lucide-react';

function Card({ title, subtitle, children, className = '', actions }: {
  title: string; subtitle?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
      className={cn('overflow-hidden', className)}
      style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(0,0,0,0.04)', borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02)' }}>
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div><h3 className="text-[13px] font-bold text-gray-700">{title}</h3>{subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}</div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="px-4 pb-4">{children}</div>
    </motion.div>
  );
}

function exportCSV(title: string, columns: { label: string; key: string }[], data: any[]) {
  const headers = columns.map(c => c.label).join(',');
  const rows = data.map(row => columns.map(c => { const v = row[c.key]; return typeof v === 'string' && v.includes(',') ? `"${v}"` : v ?? ''; }).join(',')).join('\n');
  const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${title}.csv`; a.click(); URL.revokeObjectURL(url);
}

export function ProductsPage() {
  const filters = useFilters();
  const { month } = filters;
  const monthOptions = generateMonthOptions(12);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['products', month],
    queryFn: () => api.get<any>(buildUrl('/api/products', { month })),
    staleTime: 3 * 60 * 1000,
  });

  const categories = data?.categories?.categories || data?.categories || [];
  const products = data?.products?.products || data?.products || [];
  const brands = data?.brands || [];
  const totalProductCount = data?.total_product_count || products.length;
  const totalCatRevenue = categories.reduce((s: number, c: any) => s + (c.revenue || 0), 0);

  // Treemap: category
  const treemapOption = categories.length > 0 ? {
    tooltip: { formatter: (p: any) => `<b>${p.name}</b><br/>Revenue: AED ${formatCurrency(p.value)}<br/>GP%: ${formatPct(p.data?.gpPct)}` },
    series: [{
      type: 'treemap', roam: false, width: '100%', height: '100%',
      breadcrumb: { show: false },
      label: { show: true, fontSize: 12, fontWeight: 'bold' as const, formatter: (p: any) => `${p.name}\nAED ${formatCurrency(p.value, true)}`, lineHeight: 16 },
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 3, gapWidth: 2 },
      data: categories.slice(0, 15).map((c: any, i: number) => ({
        name: c.category, value: c.revenue || 0, gpPct: c.gp_pct,
        itemStyle: { color: tyreTypeColor(c.category) || CHART_COLORS[i % CHART_COLORS.length] },
      })),
    }],
  } : null;

  // Top products bar chart
  const topProducts = products.slice(0, 20);
  const productBarOption = topProducts.length > 0 ? {
    tooltip: { trigger: 'axis' as const, formatter: (params: any) => `<b>${params[0].name}</b><br/>AED ${formatCurrency(params[0].value)}` },
    grid: { left: 180, right: 60, top: 8, bottom: 8 },
    xAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => formatCurrency(v, true), fontSize: 10, color: '#94a3b8' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    yAxis: {
      type: 'category' as const, data: [...topProducts].reverse().map(p => p.product || p.name),
      axisLabel: { fontSize: 9, color: '#475569', width: 170, overflow: 'truncate' as const, formatter: (v: string) => v.length > 35 ? v.slice(0, 35) + '...' : v },
      axisTick: { show: false }, axisLine: { lineStyle: { color: '#e2e8f0' } },
    },
    series: [{ type: 'bar' as const, data: [...topProducts].reverse().map(p => ({ value: p.revenue || 0, itemStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#14b8a6' }, { offset: 1, color: '#0d9488' }] }, borderRadius: [0, 4, 4, 0] } })), barMaxWidth: 14, label: { show: true, position: 'right' as const, fontSize: 9, color: '#64748b', fontFamily: "'JetBrains Mono',monospace", formatter: (p: any) => formatCurrency(p.value, true) } }],
  } : null;

  // Revenue vs GP% scatter
  const scatterOption = products.length > 0 ? {
    tooltip: { trigger: 'item' as const, formatter: (p: any) => `<b>${p.data[3]}</b><br/>Revenue: AED ${formatCurrency(p.data[0])}<br/>GP%: ${p.data[1]?.toFixed(1)}%` },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'value' as const, name: 'Revenue', nameLocation: 'middle' as const, nameGap: 25, axisLabel: { fontSize: 10, color: '#94a3b8', formatter: (v: number) => formatCurrency(v, true) }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    yAxis: { type: 'value' as const, name: 'GP%', nameLocation: 'middle' as const, nameGap: 35, axisLabel: { fontSize: 10, color: '#94a3b8', formatter: (v: number) => `${v}%` }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    series: [{
      type: 'scatter' as const, symbolSize: (val: number[]) => Math.max(8, Math.min(30, (val[2] || 1) * 3)),
      data: products.slice(0, 30).map((p: any, i: number) => [p.revenue || 0, p.gp_pct || 0, p.customers || 1, p.product?.slice(0, 40) || `Product ${i}`]),
      itemStyle: { color: (params: any) => (params.data[1] || 0) >= 12 ? '#10b981' : (params.data[1] || 0) >= 5 ? '#f59e0b' : '#ef4444', opacity: 0.7 },
    }],
  } : null;

  const maxCatRev = Math.max(...categories.map((c: any) => c.revenue || 0), 1);

  if (isLoading && !data) return <PageSkeleton />;

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Products & Brands</h1>
          <p className="text-xs text-gray-500 mt-0.5">{monthLabel(month)} · {categories.length} categories · {products.length} products</p>
        </div>
        <select value={month} onChange={e => filters.setMonth(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white focus:ring-2 focus:ring-teal-200 outline-none shadow-sm">
          {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Categories" formattedValue={String(categories.length)} value={categories.length} accentColor="teal" icon={<Package />} />
        <KpiCard title="Total Revenue" formattedValue={`AED ${formatCurrency(totalCatRevenue)}`} value={totalCatRevenue} numericValue={totalCatRevenue} animate accentColor="emerald" icon={<DollarSign />} />
        <KpiCard title="Products Tracked" formattedValue={totalProductCount.toLocaleString()} value={totalProductCount} accentColor="amber" icon={<BarChart3 />} />
        <KpiCard title="Top Category" formattedValue={categories[0]?.category || '—'} value={categories[0]?.category || '—'} subtitle={categories[0] ? `AED ${formatCurrency(categories[0].revenue || 0, true)}` : undefined} accentColor="sky" icon={<TrendingUp />} />
      </div>

      {/* Row 1: Treemap + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {treemapOption && (
          <Card title="Category Treemap" subtitle="Size = Revenue, click to filter">
            <ReactECharts option={treemapOption} style={{ height: 320 }} onEvents={{ click: (p: any) => setSelectedCategory(selectedCategory === p.name ? null : p.name) }} />
          </Card>
        )}
        {productBarOption && (
          <Card title="Top 20 Products" subtitle="By revenue">
            <ReactECharts option={productBarOption} style={{ height: 320 }} />
          </Card>
        )}
      </div>

      {/* Row 2: Scatter */}
      {scatterOption && (
        <Card title="Revenue vs GP% Scatter" subtitle="Products: high GP + high revenue = stars">
          <ReactECharts option={scatterOption} style={{ height: 280 }} />
        </Card>
      )}

      {/* Row 3: Category + Brand tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card title="Category Breakdown" actions={
          <button onClick={() => exportCSV(`categories-${month}`, [
            { label: 'Category', key: 'category' }, { label: 'Revenue', key: 'revenue' },
            { label: 'GP%', key: 'gp_pct' }, { label: 'Units', key: 'units' },
          ], categories)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-all uppercase tracking-wider">
            <Download className="w-3 h-3" /> Export
          </button>
        }>
          <div className="max-h-[340px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(255,255,255,0.95)' }}>
                <tr className="text-gray-400 uppercase text-[10px] tracking-wider">
                  <th className="text-left py-1.5 px-1 w-6">#</th>
                  <th className="text-left py-1.5 px-2">Category</th>
                  <th className="text-right py-1.5 px-2 w-24">Revenue</th>
                  <th className="text-right py-1.5 px-1 w-14">GP%</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c: any, i: number) => {
                  const pct = Math.max((c.revenue || 0) / maxCatRev * 100, 0);
                  const isActive = selectedCategory === c.category;
                  return (
                    <tr key={i} onClick={() => setSelectedCategory(isActive ? null : c.category)}
                      className={cn('cursor-pointer transition-all', isActive ? 'font-semibold' : 'hover:bg-gray-50/60')}
                      style={{ background: isActive ? 'rgba(13,148,136,0.08)' : undefined, borderLeft: isActive ? '3px solid #0d9488' : '3px solid transparent' }}>
                      <td className="py-2 px-1 font-mono text-[10px] text-gray-400 font-bold">{i + 1}</td>
                      <td className="py-2 px-2">
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 rounded-r" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${tyreTypeColor(c.category)}15, ${tyreTypeColor(c.category)}05)` }} />
                          <span className="relative z-10 text-[11px] font-semibold">{c.category}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[11px] text-gray-700 font-medium">{formatCurrency(c.revenue || 0, true)}</td>
                      <td className={cn('py-2 px-1 text-right font-mono text-[11px] font-medium', gpColor(c.gp_pct || 0))}>{formatPct(c.gp_pct)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Brand Performance" actions={
          <button onClick={() => exportCSV(`brands-${month}`, [
            { label: 'Brand', key: 'brand' }, { label: 'Revenue', key: 'revenue' }, { label: 'GP%', key: 'gp_pct' },
          ], brands)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-all uppercase tracking-wider">
            <Download className="w-3 h-3" /> Export
          </button>
        }>
          <div className="max-h-[340px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(255,255,255,0.95)' }}>
                <tr className="text-gray-400 uppercase text-[10px] tracking-wider">
                  <th className="text-left py-1.5 px-1 w-6">#</th>
                  <th className="text-left py-1.5 px-2">Brand</th>
                  <th className="text-right py-1.5 px-2 w-24">Revenue</th>
                  <th className="text-right py-1.5 px-1 w-14">GP%</th>
                </tr>
              </thead>
              <tbody>
                {brands.map((b: any, i: number) => {
                  const maxBRev = Math.max(...brands.map((x: any) => x.revenue || 0), 1);
                  const pct = Math.max((b.revenue || 0) / maxBRev * 100, 0);
                  return (
                    <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-2 px-1 font-mono text-[10px] text-gray-400 font-bold">{i + 1}</td>
                      <td className="py-2 px-2">
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 rounded-r" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, rgba(13,148,136,0.12), rgba(13,148,136,0.04))' }} />
                          <span className="relative z-10 text-[11px] font-semibold">{b.brand}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[11px] text-gray-700 font-medium">{formatCurrency(b.revenue || 0, true)}</td>
                      <td className={cn('py-2 px-1 text-right font-mono text-[11px] font-medium', gpColor(b.gp_pct || 0))}>{formatPct(b.gp_pct)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
