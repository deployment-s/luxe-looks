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
  averageRating: number;
  totalReviews: number;
  recentProducts: Product[];
  productsByCategory: { name: string; count: number }[];
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
