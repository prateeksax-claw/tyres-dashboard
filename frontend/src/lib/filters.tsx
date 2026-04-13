import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface FilterState {
  month: string;
  category: string;
  brand: string;
  salesman: string;
  customer: string;
  size: string;
  search: string;
}

const defaultMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const defaultFilters: FilterState = {
  month: defaultMonth(),
  category: 'all',
  brand: 'all',
  salesman: 'all',
  customer: 'all',
  size: 'all',
  search: '',
};

interface FilterContextValue extends FilterState {
  setMonth: (m: string) => void;
  setCategory: (c: string) => void;
  setBrand: (b: string) => void;
  setSalesman: (s: string) => void;
  setCustomer: (c: string) => void;
  setSize: (s: string) => void;
  setSearch: (s: string) => void;
  resetFilters: () => void;
  toggleFilter: (key: keyof FilterState, value: string) => void;
  activeFilterCount: number;
  activeFilters: { key: string; value: string; label: string }[];
}

const FilterContext = createContext<FilterContextValue>({
  ...defaultFilters,
  setMonth: () => {},
  setCategory: () => {},
  setBrand: () => {},
  setSalesman: () => {},
  setCustomer: () => {},
  setSize: () => {},
  setSearch: () => {},
  resetFilters: () => {},
  toggleFilter: () => {},
  activeFilterCount: 0,
  activeFilters: [],
});

export function FilterProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<FilterState>({
    month: searchParams.get('month') || defaultFilters.month,
    category: searchParams.get('category') || defaultFilters.category,
    brand: searchParams.get('brand') || defaultFilters.brand,
    salesman: searchParams.get('salesman') || defaultFilters.salesman,
    customer: searchParams.get('customer') || defaultFilters.customer,
    size: searchParams.get('size') || defaultFilters.size,
    search: searchParams.get('search') || defaultFilters.search,
  });

  useEffect(() => {
    const params: Record<string, string> = {};
    if (filters.month !== defaultFilters.month) params.month = filters.month;
    if (filters.category !== 'all') params.category = filters.category;
    if (filters.brand !== 'all') params.brand = filters.brand;
    if (filters.salesman !== 'all') params.salesman = filters.salesman;
    if (filters.customer !== 'all') params.customer = filters.customer;
    if (filters.size !== 'all') params.size = filters.size;
    if (filters.search) params.search = filters.search;
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  const setMonth = useCallback((m: string) => setFilters(f => ({ ...f, month: m })), []);
  const setCategory = useCallback((c: string) => setFilters(f => ({ ...f, category: c })), []);
  const setBrand = useCallback((b: string) => setFilters(f => ({ ...f, brand: b })), []);
  const setSalesman = useCallback((s: string) => setFilters(f => ({ ...f, salesman: s })), []);
  const setCustomer = useCallback((c: string) => setFilters(f => ({ ...f, customer: c })), []);
  const setSize = useCallback((s: string) => setFilters(f => ({ ...f, size: s })), []);
  const setSearch = useCallback((s: string) => setFilters(f => ({ ...f, search: s })), []);

  const resetFilters = useCallback(() => setFilters(f => ({ ...defaultFilters, month: f.month })), []);

  const toggleFilter = useCallback((key: keyof FilterState, value: string) => {
    setFilters(f => ({ ...f, [key]: f[key] === value ? 'all' : value }));
  }, []);

  const filterKeys: (keyof FilterState)[] = ['category', 'brand', 'salesman', 'customer', 'size'];
  const labelMap: Record<string, string> = {
    category: 'Category', brand: 'Brand', salesman: 'Salesman',
    customer: 'Customer', size: 'Size',
  };

  const activeFilters = filterKeys
    .filter(k => filters[k] !== 'all' && filters[k] !== '')
    .map(k => ({ key: k, value: filters[k], label: `${labelMap[k]}: ${filters[k]}` }));

  const activeFilterCount = activeFilters.length;

  return (
    <FilterContext.Provider value={{
      ...filters, setMonth, setCategory, setBrand, setSalesman, setCustomer,
      setSize, setSearch, resetFilters, toggleFilter, activeFilterCount, activeFilters,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export const useFilters = () => useContext(FilterContext);
