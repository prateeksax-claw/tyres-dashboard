import { PageSkeleton } from '../components/Skeletons';
import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api, buildUrl } from '../lib/api';
import { useFilters } from '../lib/filters';
import { formatCurrency, formatPct, monthLabel, generateMonthOptions, cn, gpColor, CHART_COLORS } from '../lib/utils';
import { KpiCard } from '../components/KpiCard';
import { UserCircle, DollarSign, FileText, Search, Download, ChevronDown, Loader2 } from 'lucide-react';

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

export function CustomersPage() {
  const filters = useFilters();
  const { month } = filters;
  const monthOptions = generateMonthOptions(12);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [expandedCustomer, setExpandedCustomer] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'revenue' | 'gp_pct' | 'invoices'>('revenue');
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchInput]);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', month, debouncedSearch],
    queryFn: () => api.get<any>(buildUrl('/api/customers', { month, search: debouncedSearch || undefined, limit: '200' })),
    staleTime: 3 * 60 * 1000,
  });

  const { data: custDetail, isLoading: custLoading } = useQuery({
    queryKey: ['customer-detail', expandedCustomer, month],
    queryFn: () => api.get<any>(buildUrl(`/api/customer/${encodeURIComponent(expandedCustomer!)}`, { month })),
    enabled: !!expandedCustomer,
    staleTime: 5 * 60 * 1000,
  });

  const rawCustomers = data?.customers || [];
  const customers = [...rawCustomers].sort((a: any, b: any) => (b[sortBy] || 0) - (a[sortBy] || 0));
  const totalRev = customers.reduce((s: number, c: any) => s + (c.revenue || 0), 0);
  const totalInvoices = customers.reduce((s: number, c: any) => s + (c.invoices || 0), 0);
  const maxRev = Math.max(...customers.map((c: any) => c.revenue || 0), 1);

  const custProducts = custDetail?.products || [];
  const custTrend = custDetail?.trend || [];

  const trendOption = custTrend.length > 0 ? {
    tooltip: { trigger: 'axis' as const },
    grid: { left: 50, right: 12, top: 12, bottom: 24 },
    xAxis: { type: 'category' as const, data: custTrend.map((m: any) => monthLabel(m.month)), axisLabel: { fontSize: 10, color: '#94a3b8' } },
    yAxis: { type: 'value' as const, axisLabel: { formatter: (v: number) => formatCurrency(v, true), fontSize: 10, color: '#94a3b8' }, splitLine: { lineStyle: { color: '#f1f5f9' } } },
    series: [{ type: 'line' as const, smooth: true, data: custTrend.map((m: any) => m.revenue), areaStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(13,148,136,0.15)' }, { offset: 1, color: 'rgba(13,148,136,0.02)' }] } }, lineStyle: { color: '#0d9488', width: 2.5 }, itemStyle: { color: '#0d9488' }, symbol: 'circle', symbolSize: 6 }],
  } : null;

  if (isLoading && !data) return <PageSkeleton />;

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Customers</h1>
          <p className="text-xs text-gray-500 mt-0.5">{monthLabel(month)} · {customers.length} customers</p>
        </div>
        <select value={month} onChange={e => filters.setMonth(e.target.value)}
          className="text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-white focus:ring-2 focus:ring-teal-200 outline-none shadow-sm">
          {monthOptions.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard title="Total Customers" formattedValue={String(customers.length)} value={customers.length} accentColor="teal" icon={<UserCircle />} />
        <KpiCard title="Total Revenue" formattedValue={`AED ${formatCurrency(totalRev)}`} value={totalRev} numericValue={totalRev} animate accentColor="emerald" icon={<DollarSign />} />
        <KpiCard title="Total Invoices" formattedValue={String(totalInvoices)} value={totalInvoices} accentColor="amber" icon={<FileText />} />
      </div>

      <Card title="Customer List" subtitle="Click to expand details" actions={
        <div className="flex items-center gap-2">
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="text-[10px] border border-gray-200 rounded-lg px-2 py-1 bg-white outline-none">
            <option value="revenue">By Revenue</option>
            <option value="gp_pct">By GP%</option>
            <option value="invoices">By Invoices</option>
          </select>
          <button onClick={() => exportCSV(`customers-${month}`, [
          { label: 'Customer', key: 'customer' }, { label: 'Revenue', key: 'revenue' },
          { label: 'GP%', key: 'gp_pct' }, { label: 'Invoices', key: 'invoices' },
          { label: 'Salesman', key: 'salesman' },
        ], customers)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-all uppercase tracking-wider">
          <Download className="w-3 h-3" /> Export
          </button>
        </div>
      }>
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Search customers..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 bg-white"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }} />
        </div>

        <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(255,255,255,0.95)' }}>
              <tr className="text-gray-400 uppercase text-[10px] tracking-wider">
                <th className="text-left py-2 px-1 w-6">#</th>
                <th className="text-left py-2 px-2">Customer</th>
                <th className="text-right py-2 px-2 w-24">Revenue</th>
                <th className="text-right py-2 px-1 w-14">GP%</th>
                <th className="text-left py-2 px-2 w-28 hidden md:table-cell">Salesman</th>
                <th className="w-6"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c: any, i: number) => {
                const isExpanded = expandedCustomer === c.customer;
                return (
                  <tr key={i} onClick={() => setExpandedCustomer(isExpanded ? null : c.customer)}
                    className={cn('cursor-pointer transition-all border-b border-gray-50/80',
                      isExpanded ? 'bg-teal-50/60' : 'hover:bg-gray-50/60'
                    )}>
                    <td className="py-2 px-1 font-mono text-[10px] text-gray-400 font-bold">{i + 1}</td>
                    <td className="py-2 px-2">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 rounded-r" style={{ width: `${(c.revenue || 0) / maxRev * 100}%`, background: 'linear-gradient(90deg, rgba(13,148,136,0.10), rgba(13,148,136,0.03))' }} />
                        <span className="relative z-10 text-[11px] font-semibold text-gray-700 truncate block max-w-[250px]">{c.customer}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-[11px] text-gray-700 font-medium">AED {formatCurrency(c.revenue || 0, true)}</td>
                    <td className={cn('py-2 px-1 text-right font-mono text-[11px] font-medium', gpColor(c.gp_pct || 0))}>{formatPct(c.gp_pct)}</td>
                    <td className="py-2 px-2 text-[11px] text-gray-500 truncate hidden md:table-cell">{c.salesman || '—'}</td>
                    <td className="py-2 px-1">{isExpanded ? <ChevronDown className="w-3 h-3 text-teal-500" /> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Customer Detail Panel */}
      <AnimatePresence>
        {expandedCustomer && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <Card title={expandedCustomer} subtitle="Customer Detail">
              {custLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-teal-500 animate-spin" /></div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {trendOption && (
                    <div>
                      <h4 className="text-[11px] font-semibold text-gray-500 mb-2">Revenue Trend</h4>
                      <ReactECharts option={trendOption} style={{ height: 180 }} />
                    </div>
                  )}
                  {custProducts.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-semibold text-gray-500 mb-2">Top Products</h4>
                      <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-xs">
                          <thead><tr className="text-gray-400 uppercase text-[10px] tracking-wider">
                            <th className="text-left py-1 px-2">Product</th>
                            <th className="text-right py-1 px-2 w-24">Revenue</th>
                            <th className="text-right py-1 px-1 w-14">GP%</th>
                          </tr></thead>
                          <tbody>
                            {custProducts.slice(0, 10).map((p: any, pi: number) => (
                              <tr key={pi} className="hover:bg-gray-50/60 transition-colors">
                                <td className="py-1.5 px-2 text-[11px] text-gray-600 truncate max-w-[200px]">{p.product}</td>
                                <td className="py-1.5 px-2 text-right font-mono text-[11px] text-gray-700">AED {formatCurrency(p.revenue || 0, true)}</td>
                                <td className={cn('py-1.5 px-1 text-right font-mono text-[11px] font-medium', gpColor(p.gp_pct || 0))}>{formatPct(p.gp_pct)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
