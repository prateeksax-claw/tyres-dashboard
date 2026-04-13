import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FilterProvider } from './lib/filters';
import { ThemeProvider } from './lib/theme';
import { Sidebar } from './components/Sidebar';
import { CommandPalette } from './components/CommandPalette';
import { RefreshBar } from './components/RefreshBar';
import { OverviewPage } from './pages/OverviewPage';
import { ProductsPage } from './pages/ProductsPage';
import { SalesmenPage } from './pages/SalesmenPage';
import { CustomersPage } from './pages/CustomersPage';
import { InventoryPage } from './pages/InventoryPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchInterval: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function DashboardLayout() {
  return (
    <FilterProvider>
      <Sidebar />
      <CommandPalette />
      <main className="ml-16 min-h-screen mesh-bg p-6">
        <div className="max-w-[1600px] mx-auto flex justify-end mb-2 print:hidden">
          <RefreshBar />
        </div>
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/salesmen" element={<SalesmenPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </FilterProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <DashboardLayout />
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
