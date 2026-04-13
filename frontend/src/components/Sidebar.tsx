import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, UserCircle, Package, Warehouse,
  ChevronLeft, ChevronRight, CircleDot, Sun, Moon, Menu, X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useTheme } from '../lib/theme';

const NAV_ITEMS = [
  { path: '/', icon: LayoutDashboard, label: 'Overview' },
  { path: '/products', icon: Package, label: 'Products' },
  { path: '/salesmen', icon: Users, label: 'Salesmen' },
  { path: '/customers', icon: UserCircle, label: 'Customers' },
  { path: '/inventory', icon: Warehouse, label: 'Inventory' },
];

export function Sidebar() {
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { dark, toggle } = useTheme();

  const navContent = (
    <>
      {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
        const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
        return (
          <NavLink
            key={path}
            to={path}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-all',
              active
                ? 'bg-teal-50 dark:bg-teal-500/15 text-teal-600 dark:text-teal-400 shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 hover:text-gray-700 dark:hover:text-slate-200'
            )}
            title={label}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <AnimatePresence>
              {(expanded || mobileOpen) && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="whitespace-nowrap overflow-hidden"
                >
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        );
      })}
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 md:hidden p-2 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-gray-200 dark:border-slate-700 shadow-sm"
      >
        <Menu className="w-5 h-5 text-gray-600 dark:text-slate-300" />
      </button>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.aside
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            exit={{ x: -260 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-0 top-0 h-screen w-[260px] z-50 md:hidden flex flex-col bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-r border-gray-200/60 dark:border-slate-700/60 shadow-xl"
          >
            <div className="flex items-center justify-between h-14 px-4 border-b border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <CircleDot className="w-7 h-7 text-teal-500" />
                <span className="font-bold text-sm text-gray-800 dark:text-slate-200">AZ Tyres</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-1">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">{navContent}</nav>
            <div className="border-t border-gray-100 dark:border-slate-800 p-2 space-y-1">
              <button
                onClick={toggle}
                className="flex items-center gap-3 px-2.5 py-2 w-full rounded-xl text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
              >
                {dark ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
                <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: expanded ? 220 : 64 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="fixed left-0 top-0 h-screen z-40 hidden md:flex flex-col bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-gray-200/60 dark:border-slate-700/60 shadow-sm"
      >
        <div className="flex items-center h-14 px-4 border-b border-gray-100 dark:border-slate-800">
          <CircleDot className="w-7 h-7 text-teal-500 shrink-0" />
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="ml-3 font-bold text-sm text-gray-800 dark:text-slate-200 whitespace-nowrap overflow-hidden"
              >
                AZ Tyres
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">{navContent}</nav>

        <div className="border-t border-gray-100 dark:border-slate-800 p-2 space-y-1">
          <button
            onClick={toggle}
            className="flex items-center gap-3 px-2.5 py-2 w-full rounded-xl text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800 transition-all"
            title={dark ? 'Light Mode' : 'Dark Mode'}
          >
            {dark ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
            {expanded && <span>{dark ? 'Light' : 'Dark'}</span>}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-center w-full py-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
          >
            {expanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </motion.aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-gray-200/60 dark:border-slate-700/60 safe-area-bottom">
        <div className="flex items-center justify-around py-1.5 px-2">
          {NAV_ITEMS.map(({ path, icon: Icon, label }) => {
            const active = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
            return (
              <NavLink
                key={path}
                to={path}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all min-w-[52px]',
                  active
                    ? 'text-teal-600 dark:text-teal-400'
                    : 'text-gray-400 dark:text-slate-500'
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}
