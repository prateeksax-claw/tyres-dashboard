import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

/**
 * Thin bar at the top of the dashboard showing last refresh time
 * and a manual refresh button. Auto-refresh happens via React Query's
 * refetchInterval (5 min), this just shows the countdown.
 */
export function RefreshBar() {
  const queryClient = useQueryClient();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastRefresh.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [lastRefresh]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setLastRefresh(new Date());
    setSecondsAgo(0);
    setTimeout(() => setRefreshing(false), 800);
  };

  const fmtAgo = secondsAgo < 60
    ? `${secondsAgo}s ago`
    : `${Math.floor(secondsAgo / 60)}m ago`;

  const nextRefresh = Math.max(0, 300 - secondsAgo);
  const fmtNext = `${Math.floor(nextRefresh / 60)}:${String(nextRefresh % 60).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-3 text-[11px] text-gray-400 print:hidden">
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-teal-300 hover:text-teal-500 transition-all bg-white/60 dark:bg-slate-800/60"
      >
        <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
        <span>{refreshing ? 'Refreshing...' : fmtAgo}</span>
      </button>
      <span className="hidden sm:inline text-gray-300 dark:text-slate-600">
        Next: {fmtNext}
      </span>
    </div>
  );
}
