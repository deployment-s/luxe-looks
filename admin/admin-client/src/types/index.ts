export interface User {
  id: number;
  username: string;
  created_at: string;
}

export type ProductStatus = 'draft' | 'published' | 'archived';

export interface Product {
  id: number;
  name: string;
  category: string;
  price: string;
  description?: string;
  image?: string;
  rating: number;
  reviews: number;
  status: ProductStatus;
  is_active?: boolean;
  meta_title?: string;
  meta_description?: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  product_count?: number;
  created_at: string;
  updated_at: string;
}

export interface MediaItem {
  id?: number;
  filename: string;
  path: string;
  size: number;
  size_formatted: string;
  uploaded_at: string;
  product_count: number;
}

export interface DashboardStats {
  totalProducts: number;
  totalCategories: number;
  averageRating: string;
  totalReviews: number;
  changes: {
    products: string;
    categories: number;
    rating: string;
    reviews: number;
  };
  recentProducts: Product[];
  categoryData: { name: string; count: number }[];
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProductFilters {
  search?: string;
  category?: string;
  status?: ProductStatus;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  maxRating?: number;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CategoryOrder {
  id: number;
  sort_order: number;
}

export interface ActivityLog {
  id: number;
  user_id: number | null;
  username: string | null;
  action: 'create' | 'update' | 'delete' | 'upload';
  entity_type: string | null;
  entity_id: number | null;
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface ActivityLogFilters {
  user_id?: number;
  action?: string;
  entity_type?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}
