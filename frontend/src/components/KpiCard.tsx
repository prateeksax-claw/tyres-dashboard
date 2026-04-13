import { ReactNode, useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../lib/utils';

const ACCENT_GRADIENTS: Record<string, { stripe: string; barFrom: string; barTo: string; iconBg: string; iconColor: string }> = {
  teal:    { stripe: 'linear-gradient(90deg, #0d9488, #14b8a6)', barFrom: '#0d9488', barTo: '#14b8a6', iconBg: 'rgba(13,148,136,0.10)', iconColor: '#0d9488' },
  indigo:  { stripe: 'linear-gradient(90deg, #6366f1, #8b5cf6)', barFrom: '#6366f1', barTo: '#8b5cf6', iconBg: 'rgba(99,102,241,0.10)', iconColor: '#6366f1' },
  emerald: { stripe: 'linear-gradient(90deg, #10b981, #14b8a6)', barFrom: '#10b981', barTo: '#14b8a6', iconBg: 'rgba(16,185,129,0.10)', iconColor: '#10b981' },
  amber:   { stripe: 'linear-gradient(90deg, #f59e0b, #f97316)', barFrom: '#f59e0b', barTo: '#f97316', iconBg: 'rgba(245,158,11,0.10)', iconColor: '#f59e0b' },
  sky:     { stripe: 'linear-gradient(90deg, #0ea5e9, #3b82f6)', barFrom: '#0ea5e9', barTo: '#3b82f6', iconBg: 'rgba(14,165,233,0.10)', iconColor: '#0ea5e9' },
  rose:    { stripe: 'linear-gradient(90deg, #ef4444, #f97316)', barFrom: '#ef4444', barTo: '#f97316', iconBg: 'rgba(239,68,68,0.10)', iconColor: '#ef4444' },
};

export function useAnimatedNumber(target: number, duration = 800, enabled = true) {
  const [val, setVal] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    if (!enabled || target === 0) { setVal(target); prevRef.current = target; return; }
    const start = prevRef.current;
    const diff = target - start;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const pct = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - pct, 3);
      setVal(start + diff * eased);
      if (pct < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    prevRef.current = target;
  }, [target, duration, enabled]);
  return val;
}

function SparkBars({ data, fromColor, toColor }: { data: number[]; fromColor: string; toColor: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const barCount = Math.min(data.length, 8);
  const bars = data.slice(-barCount);

  return (
    <div className="flex items-end gap-[3px] h-[28px] mt-1">
      {bars.map((v, i) => {
        const h = Math.max(3, (v / max) * 28);
        const opacity = 0.3 + (i / (barCount - 1)) * 0.7;
        return (
          <div
            key={i}
            className="rounded-sm transition-all duration-300"
            style={{ width: 6, height: h, background: `linear-gradient(180deg, ${fromColor}, ${toColor})`, opacity }}
          />
        );
      })}
    </div>
  );
}

export interface KpiCardProps {
  title: string;
  value: string | number;
  formattedValue?: string;
  change?: number;
  changeLabel?: string;
  yoyChange?: number;
  yoyLabel?: string;
  subtitle?: string;
  subtitle2?: string;
  sparkData?: number[];
  sparkline?: number[];
  progress?: number;
  progressLabel?: string;
  accentColor?: string;
  color?: string;
  icon?: ReactNode;
  loading?: boolean;
  numericValue?: number;
  animate?: boolean;
}

function resolveAccent(accentColor?: string, color?: string): string {
  if (accentColor && ACCENT_GRADIENTS[accentColor]) return accentColor;
  if (color) {
    if (color.includes('teal') || color.includes('#0d9488')) return 'teal';
    if (color.includes('indigo') || color.includes('#6366f1')) return 'indigo';
    if (color.includes('emerald') || color.includes('#10b981')) return 'emerald';
    if (color.includes('amber') || color.includes('#f59e0b')) return 'amber';
    if (color.includes('sky') || color.includes('#0ea5e9')) return 'sky';
    if (color.includes('rose') || color.includes('#ef4444') || color.includes('red')) return 'rose';
  }
  return 'teal';
}

export function KpiCard({
  title, value, formattedValue, change, changeLabel, yoyChange, yoyLabel,
  subtitle, subtitle2, sparkData, sparkline, progress, progressLabel,
  accentColor, color, icon, loading, numericValue, animate = true,
}: KpiCardProps) {
  const resolvedAccent = resolveAccent(accentColor, color);
  const accent = ACCENT_GRADIENTS[resolvedAccent] || ACCENT_GRADIENTS.teal;
  const effectiveSparkData = sparkData || sparkline;
  const isPositive = change != null && change > 0;
  const isNegative = change != null && change < 0;
  const animatedNum = useAnimatedNumber(numericValue || 0, 800, animate && !!numericValue);

  const displayValue = animate && numericValue
    ? `AED ${Math.round(animatedNum).toLocaleString()}`
    : formattedValue || String(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden group cursor-default"
      style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(0,0,0,0.04)',
        borderRadius: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02)',
        transition: 'all 0.25s ease',
      }}
      whileHover={{
        y: -2,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        borderColor: 'rgba(13,148,136,0.15)',
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: accent.stripe }} />

      <div className="p-5 pt-6">
        <div className="flex items-start justify-between mb-3">
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1.2px', color: '#94a3b8' }}>
            {title}
          </p>
          {icon && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
              style={{ background: accent.iconBg }}
            >
              <div style={{ color: accent.iconColor }} className="[&>svg]:w-4 [&>svg]:h-4">
                {icon}
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="h-8 w-32 bg-gray-100 rounded-lg animate-pulse mb-2" />
        ) : (
          <p
            className="font-data truncate mb-1"
            style={{ fontSize: 28, fontWeight: 700, color: '#1e293b', letterSpacing: '-1px' }}
          >
            {displayValue}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {change != null && (
            <span className={cn(
              'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full',
              isPositive && 'text-emerald-700',
              isNegative && 'text-red-600',
              !isPositive && !isNegative && 'text-gray-500',
            )} style={{
              background: isPositive ? 'rgba(16,185,129,0.08)' : isNegative ? 'rgba(239,68,68,0.08)' : 'rgba(0,0,0,0.04)',
            }}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {isPositive ? '▲' : isNegative ? '▼' : '—'} {Math.abs(change).toFixed(1)}%
              {changeLabel && <span className="font-normal ml-0.5">{changeLabel}</span>}
            </span>
          )}
          {subtitle && (
            <span className="text-[11px] text-gray-400 font-medium">{subtitle}</span>
          )}
        </div>

        {yoyChange != null && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className={cn(
              'inline-flex items-center gap-0.5 text-[10px] font-medium',
              yoyChange > 0 ? 'text-emerald-600' : yoyChange < 0 ? 'text-red-500' : 'text-gray-400',
            )}>
              {yoyChange > 0 ? '▲' : yoyChange < 0 ? '▼' : '—'} {Math.abs(yoyChange).toFixed(1)}%
              {yoyLabel && <span className="text-gray-400 font-normal ml-0.5">{yoyLabel}</span>}
            </span>
          </div>
        )}

        {subtitle2 && (
          <p className="text-[10px] text-gray-400 mt-1">{subtitle2}</p>
        )}

        {effectiveSparkData && effectiveSparkData.length >= 2 && (
          <SparkBars data={effectiveSparkData} fromColor={accent.barFrom} toColor={accent.barTo} />
        )}

        {progress != null && (
          <div className="mt-3">
            <div className="h-[4px] bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(progress, 100)}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                className="h-full rounded-full"
                style={{ background: accent.stripe }}
              />
            </div>
            {progressLabel && (
              <p className="text-[10px] text-gray-400 mt-1 text-right font-medium">{progressLabel}</p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
