import { PageSkeleton } from '../components/Skeletons';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { motion } from 'framer-motion';
import { api, buildUrl } from '../lib/api';
import { useFilters } from '../lib/filters';
import { formatCurrency, formatPct, monthLabel, generateMonthOptions, cn, gpColor, CHART_COLORS } from '../lib/utils';
import { KpiCard } from '../components/KpiCard';
import { Package, BarChart3, TrendingUp, DollarSign, Download, MapPin } from 'lucide-react';

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
  const [sortBy, setSortBy] = useState<'revenue' | 'units' | 'gp_pct'>('revenue');

  const { data, isLoading } = useQuery({
    queryKey: ['products', month],
    queryFn: () => api.get<any>(buildUrl('/api/products', { month })),
    staleTime: 3 * 60 * 1000,
  });

  const products: any[] = data?.products || [];
  const branches: any[] = data?.branches || [];
  const totalProducts = data?.total_product_count || products.length;
  const totalRevenue = products.reduce((s: number, p: any) => s + (p.revenue || 0), 0);
  const totalUnits = products.reduce((s: number, p: any) => s + (p.units || 0), 0);

  const sortedProducts = [...products].sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0));

  // Top products bar chart
  const topProducts = sortedProducts.slice(0, 15);
  const productBarOption = topProducts.length > 0 ? {
    tooltip: { trigger: 'axis' as const, formatter: (params: any) => `<b>${params[0].name}</b><br/>AED ${formatCurrency(params[0].value)}<br/>GP: ${topProducts.find((p: any) => p.product === params[0].name)?.gp_pct?.toFixed(1) || '—'}%` },
    grid: { left: 200, right: 60, top: 8, bottom: 8 },
    xAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => formatCurrency(v, true), fontSize: 10, color: '#94a3b8' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    yAxis: {
      type: 'category' as const, data: [...topProducts].reverse().map((p: any) => p.product),
      axisLabel: { fontSize: 9, color: '#475569', width: 190, overflow: 'truncate' as const, formatter: (v: string) => v.length > 40 ? v.slice(0, 40) + '...' : v },
      axisTick: { show: false }, axisLine: { lineStyle: { color: '#e2e8f0' } },
    },
    series: [{ type: 'bar' as const, data: [...topProducts].reverse().map((p: any) => ({ value: p.revenue || 0, itemStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#14b8a6' }, { offset: 1, color: '#0d9488' }] }, borderRadius: [0, 4, 4, 0] } })), barMaxWidth: 14, label: { show: true, position: 'right' as const, fontSize: 9, color: '#64748b', fontFamily: "'JetBrains Mono',monospace", formatter: (p: any) => formatCurrency(p.value, true) } }],
  } : null;

  // Revenue vs GP% scatter
  const scatterOption = products.length > 0 ? {
    tooltip: { trigger: 'item' as const, formatter: (p: any) => `<b>${p.data[3]}</b><br/>Revenue: AED ${formatCurrency(p.data[0])}<br/>GP%: ${p.data[1]?.toFixed(1)}%<br/>Units: ${p.data[2]}` },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'value' as const, name: 'Revenue', nameLocation: 'middle' as const, nameGap: 25, axisLabel: { fontSize: 10, color: '#94a3b8', formatter: (v: number) => formatCurrency(v, true) }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    yAxis: { type: 'value' as const, name: 'GP%', nameLocation: 'middle' as const, nameGap: 35, axisLabel: { fontSize: 10, color: '#94a3b8', formatter: (v: number) => `${v}%` }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    series: [{
      type: 'scatter' as const, symbolSize: (val: number[]) => Math.max(8, Math.min(30, Math.sqrt(val[2] || 1) * 2)),
      data: products.slice(0, 40).map((p: any) => [p.revenue || 0, p.gp_pct || 0, p.units || 1, p.product?.slice(0, 40) || 'Unknown']),
      itemStyle: { color: (params: any) => (params.data[1] || 0) >= 12 ? '#10b981' : (params.data[1] || 0) >= 5 ? '#f59e0b' : '#ef4444', opacity: 0.7 },
    }],
  } : null;

  // Branch treemap
  const branchTreemapOption = branches.length > 0 ? {
    tooltip: { formatter: (p: any) => `<b>${p.name}</b><br/>AED ${formatCurrency(p.value)}<br/>GP: ${formatPct(p.data?.gpPct)}<br/>Units: ${p.data?.units?.toLocaleString() || 0}` },
    series: [{
      type: 'treemap', roam: false, width: '100%', height: '100%',
      breadcrumb: { show: false },
      label: { show: true, fontSize: 11, fontWeight: 'bold' as const, formatter: (p: any) => `${p.name}\nAED ${formatCurrency(p.value, true)}`, lineHeight: 16 },
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 3, gapWidth: 2 },
      data: branches.slice(0, 12).map((b: any, i: number) => ({
        name: b.branch, value: b.revenue || 0, gpPct: b.gp_pct, units: b.units,
        itemStyle: { color: CHART_COLORS[i % CHART_COLORS.length] },
      })),
    }],
  } : null;

  const maxProdRev = Math.max(...products.map((p: any) => p.revenue || 0), 1);

  if (isLoading && !data) return <PageSkeleton />;

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Products & Branches</h1>
          <p className="text-xs text-gray-500 mt-0.5">{monthLabel(month)} · {totalProducts} products · {branches.length} branches</p>
        </div>
        <select value={month} onChange={e => filters.setMonth(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white focus:ring-2 focus:ring-teal-200 outline-none shadow-sm">
          {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Products" formattedValue={String(totalProducts)} value={totalProducts} accentColor="teal" icon={<Package />} />
        <KpiCard title="Total Revenue" formattedValue={`AED ${formatCurrency(totalRevenue)}`} value={totalRevenue} numericValue={totalRevenue} animate accentColor="emerald" icon={<DollarSign />} />
        <KpiCard title="Units Sold" formattedValue={totalUnits.toLocaleString()} value={totalUnits} accentColor="amber" icon={<BarChart3 />} />
        <KpiCard title="Branches" formattedValue={String(branches.length)} value={branches.length} accentColor="sky" icon={<MapPin />} />
      </div>

      {/* Row 1: Top Products Bar + Scatter */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {productBarOption && (
          <Card title="Top Products" subtitle="By revenue">
            <ReactECharts option={productBarOption} style={{ height: 380 }} />
          </Card>
        )}
        {scatterOption && (
          <Card title="Revenue vs GP%" subtitle="Size = units sold. Green = high GP, Red = low GP">
            <ReactECharts option={scatterOption} style={{ height: 380 }} />
          </Card>
        )}
      </div>

      {/* Row 2: Branch Treemap */}
      {branchTreemapOption && (
        <Card title="Branch Treemap" subtitle="Size = Revenue">
          <ReactECharts option={branchTreemapOption} style={{ height: 300 }} />
        </Card>
      )}

      {/* Row 3: Products Table + Branch Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card title="Product Ranking" actions={
          <div className="flex items-center gap-2">
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
              className="text-[10px] border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none">
              <option value="revenue">By Revenue</option>
              <option value="units">By Units</option>
              <option value="gp_pct">By GP%</option>
            </select>
            <button onClick={() => exportCSV(`products-${month}`, [
              { label: 'Product', key: 'product' }, { label: 'Branch', key: 'branch' },
              { label: 'Revenue', key: 'revenue' }, { label: 'GP%', key: 'gp_pct' },
              { label: 'Units', key: 'units' }, { label: 'Customers', key: 'customers' },
            ], sortedProducts)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-all uppercase tracking-wider">
              <Download className="w-3 h-3" /> CSV
            </button>
          </div>
        }>
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(255,255,255,0.95)' }}>
                <tr className="text-gray-400 uppercase text-[10px] tracking-wider">
                  <th className="text-left py-1.5 px-1 w-6">#</th>
                  <th className="text-left py-1.5 px-2">Product</th>
                  <th className="text-right py-1.5 px-2 w-20">Revenue</th>
                  <th className="text-right py-1.5 px-1 w-12">GP%</th>
                  <th className="text-right py-1.5 px-1 w-14">Units</th>
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((p: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50/60 transition-colors border-b border-gray-50/80">
                    <td className="py-2 px-1 font-mono text-[10px] text-gray-400 font-bold">{i + 1}</td>
                    <td className="py-2 px-2">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 rounded-r" style={{ width: `${(p.revenue || 0) / maxProdRev * 100}%`, background: 'linear-gradient(90deg, rgba(13,148,136,0.10), rgba(13,148,136,0.03))' }} />
                        <div className="relative z-10">
                          <span className="text-[11px] font-semibold text-gray-700 block truncate max-w-[200px]">{p.product}</span>
                          {p.branch && <span className="text-[9px] text-gray-400">{p.branch}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-[11px] text-gray-700 font-medium">{formatCurrency(p.revenue || 0, true)}</td>
                    <td className={cn('py-2 px-1 text-right font-mono text-[11px] font-medium', gpColor(p.gp_pct || 0))}>{formatPct(p.gp_pct)}</td>
                    <td className="py-2 px-1 text-right font-mono text-[11px] text-gray-500">{(p.units || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Branch Performance" actions={
          <button onClick={() => exportCSV(`branches-${month}`, [
            { label: 'Branch', key: 'branch' }, { label: 'Revenue', key: 'revenue' },
            { label: 'GP%', key: 'gp_pct' }, { label: 'Units', key: 'units' }, { label: 'Customers', key: 'customers' },
          ], branches)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-all uppercase tracking-wider">
            <Download className="w-3 h-3" /> CSV
          </button>
        }>
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(255,255,255,0.95)' }}>
                <tr className="text-gray-400 uppercase text-[10px] tracking-wider">
                  <th className="text-left py-1.5 px-1 w-6">#</th>
                  <th className="text-left py-1.5 px-2">Branch</th>
                  <th className="text-right py-1.5 px-2 w-20">Revenue</th>
                  <th className="text-right py-1.5 px-1 w-12">GP%</th>
                  <th className="text-right py-1.5 px-1 w-14">Custs</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b: any, i: number) => {
                  const maxBRev = Math.max(...branches.map((x: any) => x.revenue || 0), 1);
                  return (
                    <tr key={i} className="hover:bg-gray-50/60 transition-colors border-b border-gray-50/80">
                      <td className="py-2 px-1 font-mono text-[10px] text-gray-400 font-bold">{i + 1}</td>
                      <td className="py-2 px-2">
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 rounded-r" style={{ width: `${(b.revenue || 0) / maxBRev * 100}%`, background: 'linear-gradient(90deg, rgba(13,148,136,0.12), rgba(13,148,136,0.04))' }} />
                          <span className="relative z-10 text-[11px] font-semibold">{b.branch}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-[11px] text-gray-700 font-medium">{formatCurrency(b.revenue || 0, true)}</td>
                      <td className={cn('py-2 px-1 text-right font-mono text-[11px] font-medium', gpColor(b.gp_pct || 0))}>{formatPct(b.gp_pct)}</td>
                      <td className="py-2 px-1 text-right font-mono text-[11px] text-gray-500">{b.customers || 0}</td>
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
