import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, LayoutDashboard, Package, Users, UserCircle, X } from 'lucide-react';
import { cn } from '../lib/utils';

const PAGES = [
  { path: '/', label: 'Overview', icon: LayoutDashboard, keywords: 'home dashboard overview kpi' },
  { path: '/products', label: 'Products & Brands', icon: Package, keywords: 'products tyres brands categories' },
  { path: '/salesmen', label: 'Salesmen', icon: Users, keywords: 'salesmen team performance' },
  { path: '/customers', label: 'Customers', icon: UserCircle, keywords: 'customers accounts clients' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const filtered = PAGES.filter(p =>
    !query || p.label.toLowerCase().includes(query.toLowerCase()) || p.keywords.includes(query.toLowerCase())
  );

  const go = (path: string) => {
    navigate(path);
    setOpen(false);
    setQuery('');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[20vh]"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-lg mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200/60 dark:border-slate-700/60 overflow-hidden">
              <div className="flex items-center px-4 border-b border-gray-100 dark:border-slate-700">
                <Search className="w-5 h-5 text-gray-400 shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search pages..."
                  className="flex-1 px-3 py-4 text-sm bg-transparent outline-none text-gray-700 dark:text-slate-200 placeholder-gray-400"
                />
                <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              <div className="max-h-[300px] overflow-y-auto py-2">
                {filtered.map(({ path, label, icon: Icon }) => (
                  <button
                    key={path}
                    onClick={() => go(path)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 dark:text-slate-300 hover:bg-teal-50 dark:hover:bg-teal-500/10 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">No results</div>
                )}
              </div>
              <div className="px-4 py-2 border-t border-gray-100 dark:border-slate-700 text-[10px] text-gray-400 flex items-center gap-3">
                <span>Navigate <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-[9px] font-mono">↑↓</kbd></span>
                <span>Open <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-[9px] font-mono">↵</kbd></span>
                <span>Close <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-[9px] font-mono">ESC</kbd></span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function SearchPill() {
  return (
    <button
      onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
      className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700 text-xs text-gray-400 hover:border-teal-300 hover:text-teal-500 transition-all bg-white/60 dark:bg-slate-800/60"
    >
      <Search className="w-3.5 h-3.5" />
      <span>Search</span>
      <kbd className="ml-1 px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 rounded text-[9px] font-mono">⌘K</kbd>
    </button>
  );
}
