import { create } from 'zustand';
import type { Product, ProductFilters, ProductStatus } from '@/types';
import { productService } from '@/services/api';
import toast from 'react-hot-toast';

interface ProductState {
  products: Product[];
  isLoading: boolean;
  selectedIds: Set<number>;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  searchQuery: string;
  filters: ProductFilters;
  totalCount: number;
  fetchProducts: () => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
  archiveProduct: (id: number) => Promise<Product>;
  restoreProduct: (id: number, previousStatus: ProductStatus) => Promise<Product>;
  duplicateProduct: (id: number) => Promise<Product>;
  bulkUpdate: (ids: number[], updates: Partial<Product>) => Promise<{ updatedCount: number }>;
  addProduct: (product: Product) => void;
  updateProduct: (updatedProduct: Product) => void;
  selectProduct: (id: number, selected: boolean) => void;
  selectAll: (selected: boolean) => void;
  clearSelection: () => void;
  setSorting: (by: string, order: 'asc' | 'desc') => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: Partial<ProductFilters>) => void;
}

export const useProductStore = create<ProductState>((set) => ({
  products: [],
  isLoading: false,
  selectedIds: new Set(),
  sortBy: 'created_at',
  sortOrder: 'desc',
  searchQuery: '',
  filters: {},
  totalCount: 0,

  fetchProducts: async () => {
    set({ isLoading: true });
    try {
      // Get current state
      const state = useProductStore.getState();
      const apiFilters: ProductFilters = {
        ...state.filters,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
      };
      if (state.searchQuery) {
        apiFilters.search = state.searchQuery;
      }
      const paginatedResponse = await productService.getAll(apiFilters);
      set({
        products: paginatedResponse.items,
        totalCount: paginatedResponse.total,
        isLoading: false
      });
    } catch (error) {
      console.error('Failed to fetch products:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  deleteProduct: async (id: number) => {
    try {
      await productService.delete(id);
      set((state) => ({
        products: state.products.filter((p) => p.id !== id),
        selectedIds: (() => {
          const newSet = new Set(state.selectedIds);
          newSet.delete(id);
          return newSet;
        })(),
      }));
    } catch (error) {
      console.error('Failed to delete product:', error);
      throw error;
    }
  },

  duplicateProduct: async (id: number) => {
    try {
      const duplicated = await productService.duplicate(id);
      set((state) => ({
        products: [duplicated, ...state.products],
      }));
      toast.success('Product duplicated successfully');
      return duplicated;
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to duplicate product');
      throw error;
    }
  },

  bulkUpdate: async (ids: number[], updates: Partial<Product>) => {
    try {
      const result = await productService.bulkUpdate(ids, updates);
      // Refresh products list to reflect changes
      await useProductStore.getState().fetchProducts();
      toast.success(`Updated ${result.updatedCount} products successfully`);
      return result;
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to bulk update products');
      throw error;
    }
  },

  bulkAdjustPrice: async (ids: number[], adjustmentType: 'percent' | 'fixed', value: number, operation: 'increase' | 'decrease') => {
    try {
      const result = await productService.bulkAdjustPrice(ids, {
        type: adjustmentType,
        value,
        operation,
      });
      await useProductStore.getState().fetchProducts();
      toast.success(`Adjusted prices for ${result.adjustedCount} products`);
      return result;
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to adjust prices');
      throw error;
    }
  },

  archiveProduct: async (id: number) => {
    try {
      const state = useProductStore.getState();
      const product = state.products.find(p => p.id === id);
      if (!product) throw new Error('Product not found');

      console.log('Archiving product:', product.id, product.name, 'current status:', product.status);

      // Create FormData with all product fields
      const formData = new FormData();
      formData.append('name', product.name);
      formData.append('category', product.category);
      formData.append('price', product.price);
      formData.append('description', product.description || '');
      formData.append('rating', String(product.rating));
      formData.append('reviews', String(product.reviews));
      formData.append('status', 'archived');
      // Note: image is not included to keep existing image

      // Call API to update status to 'archived'
      const updatedProduct = await productService.update(id, formData);
      console.log('Archive response:', updatedProduct);

      set((state) => ({
        products: state.products.map((p) =>
          p.id === id ? updatedProduct : p
        ),
      }));
      console.log('Store updated. Product count:', state.products.length);
      return updatedProduct;
    } catch (error) {
      console.error('Failed to archive product:', error);
      throw error;
    }
  },

  restoreProduct: async (id: number, previousStatus: ProductStatus) => {
    try {
      const state = useProductStore.getState();
      const product = state.products.find(p => p.id === id);
      if (!product) throw new Error('Product not found');

      // Create FormData with all product fields
      const formData = new FormData();
      formData.append('name', product.name);
      formData.append('category', product.category);
      formData.append('price', product.price);
      formData.append('description', product.description || '');
      formData.append('rating', String(product.rating));
      formData.append('reviews', String(product.reviews));
      formData.append('status', previousStatus);
      // Note: image is not included to keep existing image

      // Call API to restore status
      const updatedProduct = await productService.update(id, formData);
      set((state) => ({
        products: state.products.map((p) =>
          p.id === id ? updatedProduct : p
        ),
      }));
      return updatedProduct;
    } catch (error) {
      console.error('Failed to restore product:', error);
      throw error;
    }
  },

  addProduct: (product: Product) => {
    set((state) => ({
      products: [product, ...state.products],
    }));
  },

  updateProduct: (updatedProduct: Product) => {
    set((state) => ({
      products: state.products.map((p) =>
        p.id === updatedProduct.id ? updatedProduct : p
      ),
    }));
  },

  selectProduct: (id: number, selected: boolean) => {
    set((state) => {
      const newSet = new Set(state.selectedIds);
      if (selected) {
        newSet.add(id);
      } else {
        newSet.delete(id);
      }
      return { selectedIds: newSet };
    });
  },

  selectAll: (selected: boolean) => {
    set((state) => {
      if (selected) {
        const allIds = new Set(state.products.map((p) => p.id));
        return { selectedIds: allIds };
      } else {
        return { selectedIds: new Set() };
      }
    });
  },

  clearSelection: () => {
    set({ selectedIds: new Set() });
  },

  setSorting: (by: string, order: 'asc' | 'desc') => {
    set({ sortBy: by, sortOrder: order });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  setFilters: (newFilters: Partial<ProductFilters>) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },
}));
