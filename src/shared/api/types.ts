/** Shared API DTOs — mirror the backend contract. */

export interface User {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  email?: string;
  email_verified?: boolean;
  phone?: string;
  phone_verified?: boolean;
  role?: "customer" | "creator" | "admin";
  is_creator?: boolean;
  is_verified?: boolean;
  photo_url?: string;
  language_code?: string;
  date_joined?: string;
}

export interface AuthTokenResponse {
  success: boolean;
  data: {
    token: string;
    user: User;
  }
}


export interface Paginated<T> {
  results: T[];
  next: string | null;
  previous: string | null;
  count?: number;
}

export interface StoreSummary {
  id: string | number;
  name: string;
  slug?: string;
  description?: string;
  avatar?: string | null;
  banner?: string | null;
  rating?: number | null;
}

export interface Currency {
  code: string;
  symbol: string;
  name?: string;
}

export interface StoreStats {
  total_products: number;
  total_sales: number;
  revenue: {
    amount: number;
    currency: Currency;
  };
  pending_orders: number;
  rating: number | null;
  review_count: number;
}

export interface Product {
  id: string | number;
  name: string;
  status: "draft" | "published" | "archived";
  pricing: number;
  thumbnail?: string | null;
  updated_at?: string;
}

export interface Wallet {
  balance: number;
  pending: number;
  currency: string;
}

export interface WalletTransaction {
  id: string | number;
  type: "credit" | "debit" | "withdrawal" | "payout";
  amount: number;
  description: string;
  created_at: string;
  status: "pending" | "completed" | "failed";
}

export interface StudioResponse {
  success: boolean;
  data: {
    apparel: any;
    brand: any;
    category: any;
    variants: any[];
    "3d_configuration": any;
    print_areas: any[];
    available_print_methods: any[];
  };
}