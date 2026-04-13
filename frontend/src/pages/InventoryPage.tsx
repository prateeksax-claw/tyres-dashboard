import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api, buildUrl } from '../lib/api';
import { formatCurrency, cn } from '../lib/utils';
import { KpiCard } from '../components/KpiCard';
import { Warehouse, Search, Package, ClipboardList, AlertCircle, Download } from 'lucide-react';

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

export function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [query, setQuery] = useState('');
  const [soSalesman, setSoSalesman] = useState('all');

  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ['stock', query],
    queryFn: () => api.get<{ results: any; query: string }>(`/api/inventory/stock?item=${encodeURIComponent(query)}`),
    enabled: !!query,
    staleTime: 60 * 1000,
  });

  const { data: soData, isLoading: soLoading } = useQuery({
    queryKey: ['pending-so', soSalesman],
    queryFn: () => api.get<{ pending: any; salesman: string }>(buildUrl('/api/inventory/pending-so', { salesman: soSalesman })),
    staleTime: 3 * 60 * 1000,
  });

  const results = stockData?.results;
  const items: any[] = Array.isArray(results) ? results : (results?.items || []);
  const totalResults = results?.results_count || items.length;

  const pending = soData?.pending || {};
  const openOrders: any[] = pending.open_orders || [];
  const blockedOrders: any[] = pending.blocked_orders || [];
  const totalPendingValue = pending.total_pending_value || 0;
  const openCount = pending.open_orders_count || openOrders.length;
  const blockedCount = pending.blocked_orders_count || blockedOrders.length;
  const allOrders = [...openOrders, ...blockedOrders];

  const handleSearch = () => {
    if (searchTerm.trim()) setQuery(searchTerm.trim());
  };

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Inventory & Orders</h1>
        <p className="text-xs text-gray-500 mt-0.5">Search tyre stock levels and pending sales orders</p>
      </div>

      {/* Stock Search */}
      <Card title="Stock Search" subtitle="Search by tyre name, brand, or size">
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Search tyres (e.g., 205/55R16, Bridgestone, PCR)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 bg-white"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }} />
          </div>
          <button onClick={handleSearch}
            className="px-5 py-2.5 text-white text-sm font-medium rounded-xl transition-all"
            style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6)', boxShadow: '0 2px 8px rgba(13,148,136,0.25)' }}>
            Search
          </button>
        </div>

        {stockLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-teal-200 border-t-teal-500 rounded-full animate-spin" />
          </div>
        )}

        {items.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-gray-400">{totalResults} items found for "{query}"</span>
              <button onClick={() => exportCSV(`stock-${query}`, [
                { label: 'Item', key: 'item_name' }, { label: 'Location', key: 'location' },
                { label: 'Closing', key: 'closing_qty' }, { label: 'SO Pending', key: 'so_pending_qty' },
                { label: 'Available', key: 'available_qty' },
              ], items)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-all uppercase tracking-wider">
                <Download className="w-3 h-3" /> Export
              </button>
            </div>
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10" style={{ background: 'rgba(255,255,255,0.95)' }}>
                  <tr className="text-gray-400 uppercase text-[10px] tracking-wider">
                    <th className="text-left py-2 px-2">Item</th>
                    <th className="text-left py-2 px-2 w-24">Location</th>
                    <th className="text-right py-2 px-2 w-20">Closing</th>
                    <th className="text-right py-2 px-2 w-20">SO Pending</th>
                    <th className="text-right py-2 px-2 w-20">Available</th>
                  </tr>
                </thead>
                <tbody>
                  {items.slice(0, 100).map((item, i) => (
                    <tr key={i} className="border-b border-gray-50/80 hover:bg-teal-50/30 transition-colors">
                      <td className="py-1.5 px-2">
                        <span className="text-[11px] font-medium text-gray-700 block truncate max-w-[400px]" title={item.item_name || item.item || item.stock_desc}>
                          {item.item_name || item.item || item.stock_desc || '—'}
                        </span>
                        {item.item_code && <span className="text-[9px] text-gray-400">{item.item_code}</span>}
                      </td>
                      <td className="py-1.5 px-2 text-[11px] text-gray-500">{item.location || item.warehouse || '—'}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-[11px] text-gray-700">{item.closing_qty ?? item.qty ?? '—'}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-[11px] text-amber-600">{item.so_pending_qty ?? '—'}</td>
                      <td className={cn('py-1.5 px-2 text-right font-mono text-[11px] font-medium',
                        (item.available_qty || 0) > 0 ? 'text-emerald-600' : 'text-red-500'
                      )}>{item.available_qty ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {query && !stockLoading && items.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">No items found for "{query}"</div>
        )}
      </Card>

      {/* Pending SO KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard title="Pending SO Lines" formattedValue={String(openCount + blockedCount)} value={openCount + blockedCount} accentColor="teal" icon={<ClipboardList />} />
        <KpiCard title="Pending Value" formattedValue={`AED ${formatCurrency(totalPendingValue, true)}`} value={totalPendingValue} accentColor="emerald" icon={<Package />} />
        <KpiCard title="Blocked Orders" formattedValue={String(blockedCount)} value={blockedCount}
          accentColor={blockedCount > 0 ? 'rose' : 'emerald'} icon={<AlertCircle />} />
      </div>

      {/* Pending Orders Table */}
      {allOrders.length > 0 && (
        <Card title="Pending Sales Orders" subtitle={`${openCount} open, ${blockedCount} blocked`} actions={
          <button onClick={() => exportCSV('pending-so', [
            { label: 'SO #', key: 'so_number' }, { label: 'Customer', key: 'customer' },
            { label: 'Salesman', key: 'salesman' }, { label: 'Amount', key: 'amount' },
            { label: 'Status', key: 'status' },
          ], allOrders)} className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-all uppercase tracking-wider">
            <Download className="w-3 h-3" /> Export
          </button>
        }>
          <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10" style={{ background: 'rgba(255,255,255,0.95)' }}>
                <tr className="text-gray-400 uppercase text-[10px] tracking-wider">
                  <th className="text-left py-2 px-2">SO #</th>
                  <th className="text-left py-2 px-2">Customer</th>
                  <th className="text-left py-2 px-2">Salesman</th>
                  <th className="text-right py-2 px-2 w-24">Amount</th>
                  <th className="text-center py-2 px-2 w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                {allOrders.map((order, i) => {
                  const isBlocked = blockedOrders.includes(order);
                  return (
                    <tr key={i} className={cn('border-b border-gray-50/80 transition-colors', isBlocked ? 'bg-red-50/30' : 'hover:bg-teal-50/30')}>
                      <td className="py-1.5 px-2 font-mono text-[11px] text-gray-700 font-medium">{order.so_number || order.order_no || '—'}</td>
                      <td className="py-1.5 px-2 text-[11px] text-gray-600 truncate max-w-[200px]">{order.customer || '—'}</td>
                      <td className="py-1.5 px-2 text-[11px] text-gray-500">{order.salesman || '—'}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-[11px] text-gray-700">AED {formatCurrency(order.amount || order.value || 0)}</td>
                      <td className="py-1.5 px-2 text-center">
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full',
                          isBlocked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                        )}>{isBlocked ? 'Blocked' : 'Open'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!soLoading && allOrders.length === 0 && (
        <Card title="Pending Sales Orders">
          <div className="text-center py-8 text-gray-400 text-sm">
            <ClipboardList className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            No pending sales orders found
          </div>
        </Card>
      )}
    </div>
  );
}
