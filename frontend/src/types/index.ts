export interface User {
  id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'management' | 'salesman' | 'viewer';
  salesman_name: string | null;
  enabled: number;
  permissions: {
    can_see_all_sales: boolean;
    can_see_gp: boolean;
    can_see_collections: boolean;
    can_manage_users: boolean;
  };
}

export interface KpiData {
  revenue: number;
  gp_pct?: number;
  units_sold?: number;
  avg_selling_price?: number;
  projected_revenue: number;
  days_elapsed: number;
  days_in_month: number;
  prev_period_revenue?: number;
  customers?: number;
  invoices?: number;
}

export interface DailyData {
  date: string;
  revenue: number;
  gp_pct?: number;
  units?: number;
  customers?: number;
  invoices?: number;
}

export interface TyreCategory {
  category: string;
  revenue: number;
  gp_pct?: number;
  units?: number;
  products_count?: number;
}

export interface TyreProduct {
  product: string;
  brand?: string;
  category?: string;
  size?: string;
  revenue: number;
  gp_pct?: number;
  units?: number;
  customers?: number;
}

export interface BrandData {
  brand: string;
  revenue: number;
  gp_pct?: number;
  units?: number;
  products_count?: number;
}

export interface SalesmanData {
  salesman: string;
  revenue: number;
  gp_pct?: number;
  units?: number;
  customers?: number;
  unique_customers?: number;
  invoices?: number;
}

export interface SalesmanDetail {
  name: string;
  performance: Record<string, any>;
  customers: { customers: CustomerRow[] };
  categories: Record<string, any>;
  trend: { salesmen: { name: string; months: { month: string; revenue: number }[] }[] };
  month: string;
}

export interface CustomerRow {
  customer: string;
  revenue: number;
  gp_pct?: number;
  units?: number;
  invoices?: number;
  salesman?: string;
}

export interface CustomerDetail {
  customer: string;
  total_revenue: number;
  total_gp_pct?: number;
  products?: TyreProduct[];
  trend?: { month: string; revenue: number; gp_pct?: number }[];
}

export interface InventoryItem {
  item_name: string;
  item_code?: string;
  location?: string;
  warehouse?: string;
  closing_qty?: number;
  so_pending_qty?: number;
  available_qty?: number;
  qty?: number;
}

export interface PendingOrder {
  so_number?: string;
  order_no?: string;
  customer: string;
  salesman?: string;
  amount?: number;
  value?: number;
  status?: string;
}

export interface AlertData {
  severity: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  detail: string;
  timestamp: string;
}

export interface OverviewResponse {
  kpis: KpiData;
  daily_chart: DailyData[];
  top_salesmen: SalesmanData[];
  top_brands: BrandData[];
  categories: TyreCategory[];
  alerts: AlertData[];
  month: string;
  months_available: string[];
}

export interface ProductsResponse {
  categories: { categories: TyreCategory[] };
  products: { products: TyreProduct[] };
  brands?: BrandData[];
  total_product_count?: number;
  month: string;
}

export interface FilterState {
  month: string;
  category: string;
  brand: string;
  salesman: string;
  customer: string;
  size: string;
  search: string;
}
