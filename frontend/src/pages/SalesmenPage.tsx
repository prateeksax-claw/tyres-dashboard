import { PageSkeleton } from '../components/Skeletons';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, buildUrl } from '../lib/api';
import { useFilters } from '../lib/filters';
import { formatCurrency, formatPct, monthLabel, generateMonthOptions, cn, gpColor, CHART_COLORS } from '../lib/utils';
import { KpiCard } from '../components/KpiCard';
import { DollarSign, Users, TrendingUp, Target, ChevronRight, ChevronDown, Loader2, Download } from 'lucide-react';

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

export function SalesmenPage() {
  const filters = useFilters();
  const { month } = filters;
  const monthOptions = generateMonthOptions(12);
  const [expandedSM, setExpandedSM] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['salesmen', month],
    queryFn: () => api.get<any>(buildUrl('/api/salesmen', { month })),
    staleTime: 3 * 60 * 1000,
  });

  const { data: smDetail, isLoading: smLoading } = useQuery({
    queryKey: ['salesman-detail', expandedSM],
    queryFn: () => api.get<any>(`/api/salesman/${encodeURIComponent(expandedSM!)}?months=6`),
    enabled: !!expandedSM,
    staleTime: 5 * 60 * 1000,
  });

  const salesmen = data?.salesmen || [];
  const totalRev = salesmen.reduce((s: number, sm: any) => s + (sm.Revenue || sm.revenue || 0), 0);
  const totalCustomers = salesmen.reduce((s: number, sm: any) => s + (sm.Customers || sm.unique_customers || sm.customers || 0), 0);
  const maxRev = Math.max(...salesmen.map((s: any) => s.Revenue || s.revenue || 0), 1);
  const avgRevPerSM = salesmen.length > 0 ? totalRev / salesmen.length : 0;

  const smPerf = smDetail?.performance || {};
  const smCustomers = smDetail?.customers?.customers || [];
  const smTrend = smDetail?.trend?.salesmen?.[0]?.months || [];

  const trendOption = smTrend.length > 0 ? {
    tooltip: { trigger: 'axis' as const },
    grid: { left: 50, right: 12, top: 12, bottom: 24 },
    xAxis: { type: 'category' as const, data: smTrend.map((m: any) => monthLabel(m.month)), axisLabel: { fontSize: 10, color: '#94a3b8' } },
    yAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => formatCurrency(v, true), fontSize: 10, color: '#94a3b8' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    series: [{ type: 'line' as const, smooth: true, data: smTrend.map((m: any) => m.revenue), areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(13,148,136,0.15)' }, { offset: 1, color: 'rgba(13,148,136,0.02)' }] } }, lineStyle: { color: '#0d9488', width: 2.5 }, itemStyle: { color: '#0d9488' }, symbol: 'circle', symbolSize: 6 }],
  } : null;

  if (isLoading && !data) return <PageSkeleton />;

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Salesmen Performance</h1>
          <p className="text-xs text-gray-500 mt-0.5">{monthLabel(month)} · {salesmen.length} salesmen</p>
        </div>
        <select value={month} onChange={e => filters.setMonth(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white focus:ring-2 focus:ring-teal-200 outline-none shadow-sm">
          {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Total Salesmen" formattedValue={String(salesmen.length)} value={salesmen.length} accentColor="teal" icon={<Users />} />
        <KpiCard title="Total Revenue" formattedValue={`AED ${formatCurrency(totalRev)}`} value={totalRev} numericValue={totalRev} animate accentColor="emerald" icon={<DollarSign />} />
        <KpiCard title="Avg per Salesman" formattedValue={`AED ${formatCurrency(avgRevPerSM, true)}`} value={avgRevPerSM} accentColor="amber" icon={<Target />} />
        <KpiCard title="Top Performer" formattedValue={salesmen[0]?.SalesMan || salesmen[0]?.salesman || '—'} value={salesmen[0]?.SalesMan || salesmen[0]?.salesman || '—'} subtitle={salesmen[0] ? `AED ${formatCurrency(salesmen[0].Revenue || salesmen[0].revenue || 0, true)}` : undefined} accentColor="sky" icon={<TrendingUp />} />
      </div>

      <Card title="Salesman Ranking" subtitle="Click to expand details" actions={
        <button onClick={() => exportCSV(`salesmen-${month}`, [
          { label: 'Salesman', key: 'salesman' }, { label: 'Revenue', key: 'revenue' },
          { label: 'GP%', key: 'gp_pct' }, { label: 'Customers', key: 'unique_customers' },
        ], salesmen)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-all uppercase tracking-wider">
          <Download className="w-3 h-3" /> Export
        </button>
      }>
        <div className="space-y-1">
          {salesmen.map((sm: any, i: number) => {
            const isExpanded = expandedSM === (sm.SalesMan || sm.salesman);
            const smRev = sm.Revenue || sm.revenue || 0;
            const pct = Math.max(smRev / maxRev * 100, 0);
            return (
              <div key={i}>
                <button
                  onClick={() => setExpandedSM(isExpanded ? null : (sm.SalesMan || sm.salesman))}
                  className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all',
                    isExpanded ? 'bg-teal-50/80 border border-teal-200/60' : 'hover:bg-gray-50/60'
                  )}
                >
                  <span className="font-mono text-[10px] text-gray-400 font-bold w-5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-semibold text-gray-700 truncate">{sm.SalesMan || sm.salesman}</span>
                      <span className="font-mono text-[12px] text-gray-700 font-medium ml-2">AED {formatCurrency(sm.Revenue || sm.revenue || 0, true)}</span>
                    </div>
                    <div className="h-[4px] bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #0d9488, #14b8a6)' }} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                      <span className={gpColor(sm.gp_pct || sm.GP_Pct || 0)}>GP: {formatPct(sm.gp_pct || sm.GP_Pct)}</span>
                      <span>{sm.unique_customers || sm.Customers || sm.customers || 0} customers</span>
                      {(sm.Units || sm.units) ? <span>{(sm.Units || sm.units || 0).toLocaleString()} units</span> : null}
                      {(sm.Invoices || sm.invoices) ? <span>{(sm.Invoices || sm.invoices || 0)} invoices</span> : null}
                    </div>
                  </div>
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-teal-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 py-3 space-y-3">
                        {smLoading ? (
                          <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div>
                        ) : (
                          <>
                            {trendOption && (
                              <div>
                                <h4 className="text-[11px] font-semibold text-gray-500 mb-2">Revenue Trend (6 months)</h4>
                                <ReactECharts option={trendOption} style={{ height: 160 }} />
                              </div>
                            )}
                            {smCustomers.length > 0 && (
                              <div>
                                <h4 className="text-[11px] font-semibold text-gray-500 mb-2">Top Customers</h4>
                                <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                  <table className="w-full text-xs">
                                    <thead><tr className="text-gray-400 uppercase text-[10px] tracking-wider">
                                      <th className="text-left py-1 px-2">Customer</th>
                                      <th className="text-right py-1 px-2 w-24">Revenue</th>
                                      <th className="text-right py-1 px-1 w-14">GP%</th>
                                    </tr></thead>
                                    <tbody>
                                      {smCustomers.slice(0, 10).map((c: any, ci: number) => (
                                        <tr key={ci} className="hover:bg-gray-50/60 transition-colors">
                                          <td className="py-1.5 px-2 text-[11px] text-gray-600 truncate max-w-[200px]">{c.customer}</td>
                                          <td className="py-1.5 px-2 text-right font-mono text-[11px] text-gray-700">AED {formatCurrency(c.revenue || 0, true)}</td>
                                          <td className={cn('py-1.5 px-1 text-right font-mono text-[11px] font-medium', gpColor(c.gp_pct || 0))}>{formatPct(c.gp_pct)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
