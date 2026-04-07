import axios from 'axios';
import type { Product, User, DashboardStats, ProductFilters, Category, MediaItem, CategoryOrder, ActivityLog, ActivityLogFilters } from '@/types';

const API_URL = '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/admin';
    }
    return Promise.reject(error);
  }
);

// Auth services
export const authService = {
  login: async (username: string, password: string) => {
    const response = await api.post<{ token: string; user: User }>('/login', {
      username,
      password,
    });
    return response.data;
  },

  register: async (username: string, password: string) => {
    const response = await api.post<{ message: string }>('/register', {
      username,
      password,
    });
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.post<{ message: string }>('/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },
};

// Session services
export const sessionService = {
  getAll: async () => {
    const response = await api.get<{ sessions: Session[] }>('/sessions');
    return response.data;
  },

  revoke: async (tokenId: string) => {
    const response = await api.delete<{ message: string }>(`/sessions/${tokenId}`);
    return response.data;
  },

  revokeAllOthers: async () => {
    const response = await api.delete<{ message: string; revoked: number }>('/sessions');
    return response.data;
  },
};

export interface Session {
  id: string;
  sessionId: number;
  ip_address: string;
  user_agent: string;
  created_at: string;
  expires_at: string;
  isCurrent: boolean;
}

// Product services
export const productService = {
  getAll: async (filters?: ProductFilters) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '' && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const response = await api.get<PaginatedResponse<Product>>(`/products?${params.toString()}`);
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get<Product>(`/products/${id}`);
    return response.data;
  },

  create: async (formData: FormData) => {
    const response = await api.post<Product>(
      '/products',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return response.data;
  },

  update: async (id: number, formData: FormData) => {
    const response = await api.put<Product>(`/products/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete<{ message: string }>(`/products/${id}`);
    return response.data;
  },

  bulkDelete: async (ids: number[]) => {
    const response = await api.post<{ message: string }>('/products/bulk-delete', {
      ids,
    });
    return response.data;
  },

  duplicate: async (id: number) => {
    const response = await api.post<Product>(`/products/${id}/duplicate`);
    return response.data;
  },

  bulkUpdate: async (ids: number[], updates: Partial<Product>) => {
    const response = await api.post<{ message: string; updatedCount: number }>('/products/bulk-update', {
      ids,
      updates,
    });
    return response.data;
  },

  bulkAdjustPrice: async (ids: number[], adjustment: { type: 'percent' | 'fixed'; value: number; operation: 'increase' | 'decrease' }) => {
    const response = await api.post<{ message: string; adjustedCount: number }>('/products/bulk-price-adjust', {
      ids,
      adjustment,
    });
    return response.data;
  },

  exportProducts: async (filters?: ProductFilters) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    const response = await api.get('/products/export', {
      params,
      responseType: 'blob', // For file download
    });
    return response.data;
  },
};

// Category services
export const categoryService = {
  getAll: async () => {
    const response = await api.get<Category[]>('/categories');
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get<Category>(`/categories/${id}`);
    return response.data;
  },

  create: async (categoryData: Omit<Category, 'id' | 'created_at' | 'updated_at' | 'product_count'>) => {
    const response = await api.post<Category>('/categories', categoryData);
    return response.data;
  },

  update: async (id: number, updates: Partial<Category>) => {
    const response = await api.put<Category>(`/categories/${id}`, updates);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete<{ message: string }>(`/categories/${id}`);
    return response.data;
  },

  reorder: async (orders: CategoryOrder[]) => {
    const response = await api.post<{ message: string }>('/categories/reorder', {
      categoryOrders: orders,
    });
    return response.data;
  },
};

// Media services
export const mediaService = {
  getAll: async () => {
    const response = await api.get<MediaItem[]>('/media');
    return response.data;
  },

  upload: async (files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('images', file);
    });
    const response = await api.post<{ message: string; files: MediaItem[] }>('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  delete: async (filename: string) => {
    const response = await api.delete<{ message: string }>(`/media/${filename}`);
    return response.data;
  },
};

// Dashboard service
export const dashboardService = {
  getStats: async () => {
    const response = await api.get<DashboardStats>('/dashboard/stats');
    return response.data;
  },
};

// Settings service
export const settingsService = {
  getAll: async () => {
    const response = await api.get<Record<string, string>>('/settings');
    return response.data;
  },

  update: async (settings: Record<string, string>) => {
    const response = await api.put<{ message: string }>('/settings', settings);
    return response.data;
  },

  getSystemStatus: async () => {
    const response = await api.get<{
      database_size: number;
      database_size_formatted: string;
      uploads_size: number;
      uploads_size_formatted: string;
      active_sessions: number;
      uptime_seconds: number;
      uptime_formatted: string;
      sqlite_version: string;
      node_version: string;
      product_count: number;
    }>('/settings/system-status');
    return response.data;
  },

  downloadBackup: async () => {
    const response = await api.get('/settings/backup', {
      responseType: 'blob',
    });
    return response.data;
  },

  restoreBackup: async (file: File) => {
    const formData = new FormData();
    formData.append('backup', file);
    const response = await api.post<{ message: string }>('/settings/restore', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

// Activity Log service
export const activityLogService = {
  getAll: async (filters?: ActivityLogFilters) => {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '' && value !== null) {
          params.append(key, String(value));
        }
      });
    }
    const response = await api.get<{ items: ActivityLog[]; total: number; page: number; limit: number; totalPages: number }>(`/activity-logs?${params.toString()}`);
    return response.data;
  },

  exportLogs: async (dateFrom?: string, dateTo?: string) => {
    const params = new URLSearchParams();
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    const response = await api.get(`/activity-logs/export?${params.toString()}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  cleanup: async (days: number = 90) => {
    const response = await api.delete<{ message: string; deletedCount: number }>(`/activity-logs/cleanup?days=${days}`);
    return response.data;
  },
};

export default api;
