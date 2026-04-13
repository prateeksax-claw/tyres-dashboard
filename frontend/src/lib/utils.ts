export function formatCurrency(value: number, compact = false): string {
  if (compact) {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toFixed(0);
  }
  return new Intl.NumberFormat('en-AE', {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-AE', { maximumFractionDigits: 0 }).format(value);
}

export function formatPct(value: number | undefined | null): string {
  if (value == null) return '—';
  return `${value.toFixed(1)}%`;
}

/** Consistent GP% color coding across all pages */
export function gpColor(gp: number): string {
  if (gp < 0) return 'text-red-600';
  if (gp < 5) return 'text-red-500';
  if (gp < 8) return 'text-orange-500';
  if (gp < 12) return 'text-amber-600';
  if (gp < 16) return 'text-emerald-600';
  return 'text-green-600';
}

export function gpBgColor(gp: number): string {
  if (gp < 0) return 'bg-red-50 text-red-600';
  if (gp < 5) return 'bg-red-50 text-red-500';
  if (gp < 8) return 'bg-orange-50 text-orange-500';
  if (gp < 12) return 'bg-amber-50 text-amber-600';
  if (gp < 16) return 'bg-emerald-50 text-emerald-600';
  return 'bg-green-50 text-green-600';
}

/** Tyre type color mapping */
export const TYRE_TYPE_COLORS: Record<string, string> = {
  PCR: '#0ea5e9',
  TBR: '#8b5cf6',
  OTR: '#f59e0b',
  AGRI: '#10b981',
  'ALL SEASON': '#6366f1',
  'WINTER': '#3b82f6',
  'SUMMER': '#ef4444',
};

/** Brand color mapping for top tyre brands */
export const BRAND_COLORS: Record<string, string> = {
  BRIDGESTONE: '#ef4444',
  MICHELIN: '#f59e0b',
  CONTINENTAL: '#f97316',
  GOODYEAR: '#3b82f6',
  PIRELLI: '#eab308',
  DUNLOP: '#6366f1',
  HANKOOK: '#ec4899',
  YOKOHAMA: '#8b5cf6',
  KUMHO: '#14b8a6',
  MAXXIS: '#10b981',
  GT_RADIAL: '#64748b',
  DOUBLE_COIN: '#0ea5e9',
};

export function tyreTypeColor(type: string): string {
  return TYRE_TYPE_COLORS[type.toUpperCase()] || '#94a3b8';
}

export function brandColor(brand: string): string {
  return BRAND_COLORS[brand.toUpperCase().replace(/\s+/g, '_')] || '#94a3b8';
}

export const SEVERITY_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  critical: { bg: 'bg-red-50', border: 'border-l-red-500', text: 'text-red-700' },
  warning: { bg: 'bg-amber-50', border: 'border-l-amber-500', text: 'text-amber-700' },
  info: { bg: 'bg-blue-50', border: 'border-l-blue-500', text: 'text-blue-700' },
  success: { bg: 'bg-emerald-50', border: 'border-l-emerald-500', text: 'text-emerald-700' },
};

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

export function generateMonthOptions(count = 12): { value: string; label: string }[] {
  const options = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    options.push({ value, label: monthLabel(value) });
  }
  return options;
}

export const CHART_COLORS = ['#0d9488', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ec4899', '#10b981', '#6366f1', '#f97316', '#ef4444', '#64748b'];
