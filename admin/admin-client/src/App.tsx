import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, Outlet, useSearchParams } from 'react-router-dom';
import { Upload, Download, Plus } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useCategoryStore } from '@/store/useCategoryStore';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { ProductTable } from '@/components/products/ProductTable';
import { ProductForm } from '@/components/products/ProductForm';
import { ProductFilters } from '@/components/products/ProductFilters';
import { BulkActionModal } from '@/components/products/BulkActionModal';
import { ProductPreviewModal } from '@/components/products/ProductPreviewModal';
import { ProductImportModal } from '@/components/products/ProductImportModal';
import { useProductStore } from '@/store/useProductStore';
import type { Product, ProductStatus } from '@/types';
import toast from 'react-hot-toast';

// Import page components
import { CategoriesPage } from '@/components/pages/CategoriesPage';
import { MediaPage } from '@/components/pages/MediaPage';
import { SettingsPage } from '@/components/pages/SettingsPage';
import { SessionsPage } from '@/components/pages/SessionsPage';
import { ActivityLogPage } from '@/components/pages/ActivityLogPage';

// Login Page Component
const LoginPage = () => {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showForgotPassword, setShowForgotPassword] = React.useState(false);
  const [resetUsername, setResetUsername] = React.useState('');
  const [resetCode, setResetCode] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [resetStep, setResetStep] = React.useState(1);
  const [resetError, setResetError] = React.useState('');
  const [resetSuccess, setResetSuccess] = React.useState(false);
  const [isResetting, setIsResetting] = React.useState(false);
  const [logo, setLogo] = React.useState<string | null>(null);
  const [siteName, setSiteName] = React.useState('Luxe Looks');

  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/admin';

  React.useEffect(() => {
    clearError();
  }, [clearError]);

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/site');
        const settings = await res.json();
        if (settings.logo) {
          const logoUrl = settings.logo.startsWith('http') 
            ? settings.logo 
            : `http://localhost:3001${settings.logo}`;
          setLogo(logoUrl);
        }
        if (settings.site_name) {
          setSiteName(settings.site_name);
        }
      } catch (err) {
        console.error('Failed to fetch settings:', err);
      }
    };
    fetchSettings();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(username, password);
    if (success) {
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);
    setResetError('');

    try {
      const res = await fetch('http://localhost:3001/api/users/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: resetUsername }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResetError(data.error || 'Failed to process request');
        return;
      }

      setResetStep(2);
    } catch (err) {
      setResetError('Network error. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);
    setResetError('');

    try {
      const res = await fetch('http://localhost:3001/api/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: resetUsername, resetCode, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setResetError(data.error || 'Failed to reset password');
        return;
      }

      setResetSuccess(true);
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetStep(1);
        setResetUsername('');
        setResetCode('');
        setNewPassword('');
        setResetSuccess(false);
      }, 3000);
    } catch (err) {
      setResetError('Network error. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  const resetModal = (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-900 rounded-2xl border border-dark-800 w-full max-w-md p-6">
        <h2 className="text-2xl font-serif font-bold text-white mb-4">
          {resetStep === 1 ? 'Reset Password' : 'Enter New Password'}
        </h2>

        {resetSuccess ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <p className="text-green-400 text-lg mb-2">Password reset successful!</p>
            <p className="text-dark-400 text-sm">You can now login with your new password.</p>
          </div>
        ) : (
          <form onSubmit={resetStep === 1 ? handleForgotPassword : handleResetPassword} className="space-y-4">
            {resetStep === 1 ? (
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Username</label>
                <input
                  type="text"
                  value={resetUsername}
                  onChange={(e) => setResetUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white"
                  placeholder="Enter your username"
                  required
                />
                <p className="text-dark-400 text-xs mt-2">Contact admin for reset code</p>
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Reset Code</label>
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white"
                    placeholder="Enter reset code"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white"
                    placeholder="New password (min 6 chars)"
                    minLength={6}
                    required
                  />
                </div>
              </>
            )}

            {resetError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {resetError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowForgotPassword(false); setResetStep(1); setResetUsername(''); setResetError(''); }}
                className="flex-1 py-3 px-4 bg-dark-800 hover:bg-dark-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isResetting}
                className="flex-1 py-3 px-4 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-500/50 text-white font-semibold rounded-lg transition-colors"
              >
                {isResetting ? 'Processing...' : resetStep === 1 ? 'Verify' : 'Reset Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {logo ? (
            <img src={logo} alt={siteName} className="w-20 h-20 rounded-full mx-auto mb-4 object-cover" />
          ) : (
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 mb-4 shadow-lg shadow-primary-500/20">
              <span className="text-3xl font-serif font-bold text-white">LL</span>
            </div>
          )}
          <h1 className="text-3xl font-serif font-bold text-white mb-2">{siteName}</h1>
          <p className="text-dark-400">Admin Panel</p>
        </div>

        <div className="bg-dark-900 border border-dark-800 rounded-2xl p-8 shadow-xl">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-dark-300 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                placeholder="Enter your username"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-dark-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                placeholder="Enter your password"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 disabled:bg-primary-500/50 text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-900"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-sm text-dark-400 hover:text-primary-400 transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          </form>
        </div>
      </div>
      {showForgotPassword && resetModal}
    </div>
  );
};

// Products Page Component
const ProductsPage = () => {
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState<Product | null>(null);
  const [archivedProduct, setArchivedProduct] = React.useState<{ product: Product; previousStatus: Product['status']; toastId: string; timer: number } | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [bulkModalMode, setBulkModalMode] = React.useState<'status' | 'category' | 'price' | null>(null);
  const [previewProduct, setPreviewProduct] = React.useState<Product | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);

  const {
    products,
    isLoading,
    fetchProducts,
    deleteProduct,
    addProduct,
    updateProduct,
    searchQuery,
    setSearchQuery,
    filters,
    setFilters,
    sortBy,
    sortOrder,
    setSorting,
    selectedIds,
    clearSelection,
  } = useProductStore();

  const { categories, fetchCategories } = useCategoryStore();

  // Fetch categories on mount
  React.useEffect(() => {
    if (categories.length === 0) {
      fetchCategories();
    }
  }, [categories.length, fetchCategories]);

  // Sync URL query params with store on mount
  React.useEffect(() => {
    const search = searchParams.get('search') || '';
    const category = searchParams.get('category') || undefined;
    const status = searchParams.get('status') as 'draft' | 'published' | 'archived' | undefined;
    const minPrice = searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined;
    const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined;
    const minRating = searchParams.get('minRating') ? parseFloat(searchParams.get('minRating')!) : undefined;
    const maxRating = searchParams.get('maxRating') ? parseFloat(searchParams.get('maxRating')!) : undefined;
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');
    const sortByParam = searchParams.get('sortBy') || 'created_at';
    const sortOrderParam = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

    setSearchQuery(search);
    setFilters({
      category,
      status,
      minPrice,
      maxPrice,
      minRating,
      maxRating,
      dateFrom,
      dateTo,
      page,
      limit
    });
    setSorting(sortByParam, sortOrderParam);
  }, [searchParams, setSearchQuery, setFilters, setSorting]);

  // Update URL when store state changes
  const updateSearchParams = React.useCallback(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (filters.category) params.set('category', filters.category);
    if (filters.status) params.set('status', filters.status);
    if (filters.minPrice) params.set('minPrice', String(filters.minPrice));
    if (filters.maxPrice) params.set('maxPrice', String(filters.maxPrice));
    if (filters.minRating) params.set('minRating', String(filters.minRating));
    if (filters.maxRating) params.set('maxRating', String(filters.maxRating));
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.page && filters.page > 1) params.set('page', String(filters.page));
    if (filters.limit && filters.limit !== 25) params.set('limit', String(filters.limit));
    if (sortBy !== 'created_at') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);
    setSearchParams(params, { replace: true });
  }, [searchQuery, filters, sortBy, sortOrder, setSearchParams]);

  React.useEffect(() => {
    updateSearchParams();
  }, [updateSearchParams]);

  // Fetch products when filters change
  React.useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = React.useState(searchQuery);
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when search debounces or filters change
  React.useEffect(() => {
    if (filters.page && filters.page > 1) {
      setFilters({ page: 1 });
    }
  }, [debouncedSearch, filters.category, filters.status]);

  React.useEffect(() => {
    fetchProducts();
  }, [debouncedSearch, filters.category, filters.status, sortBy, sortOrder, filters.limit, filters.page]);

  const handleEdit = (product: Product) => {
    setSelectedProduct(product);
    setShowForm(true);
  };

  const handleAdd = () => {
    setSelectedProduct(null);
    setShowForm(true);
  };

  const handleDelete = async (product: Product) => {
    setDeleteConfirm(product);
  };

  const confirmArchive = async () => {
    if (deleteConfirm) {
      try {
        console.log('Confirming archive for product:', deleteConfirm.id, deleteConfirm.name);
        const previousStatus = deleteConfirm.status || 'published';
        const archived = await (useProductStore.getState().archiveProduct(deleteConfirm.id));
        console.log('Archive successful, returned product:', archived);
        setDeleteConfirm(null);

        // Generate a unique toast ID
        const toastId = `archive-${Date.now()}`;

        // Set a timer to auto-clear the archivedProduct state after 15 seconds
        const timer = window.setTimeout(() => {
          setArchivedProduct(null);
        }, 15000);

        setArchivedProduct({
          product: archived,
          previousStatus,
          toastId,
          timer,
        });

        console.log('Showing toast with ID:', toastId);

        // Show toast with Undo button
        toast.custom(
          (t) => (
            <div className="bg-dark-900 border border-dark-800 rounded-xl shadow-2xl p-4 min-w-[320px] flex items-center justify-between gap-4">
              <div>
                <p className="font-medium text-white">Product archived</p>
                <p className="text-sm text-dark-400 truncate max-w-[200px]">{archived.name}</p>
                <p className="text-xs text-dark-500 mt-1">Undo within 15 seconds</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    handleUndo(t.id);
                    toast.dismiss(t.id);
                  }}
                  className="px-3 py-1 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Undo
                </button>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                  }}
                  className="px-3 py-1 bg-dark-800 hover:bg-dark-700 text-dark-200 text-sm rounded-lg transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ),
          {
            id: toastId,
            duration: 15000,
          }
        );
      } catch (error: any) {
        console.error('Archive error:', error);
        toast.error(error.response?.data?.error || 'Failed to archive product');
        setDeleteConfirm(null);
      }
    }
  };

  const handleUndo = (toastId?: string) => {
    if (!archivedProduct) return;

    const { product, previousStatus, timer } = archivedProduct;
    window.clearTimeout(timer);

    useProductStore.getState().restoreProduct(product.id, previousStatus)
      .then(() => {
        if (toastId) toast.dismiss(toastId);
        toast.success('Product restored');
      })
      .catch((error: any) => {
        toast.error(error.response?.data?.error || 'Failed to restore product');
      })
      .finally(() => {
        setArchivedProduct(null);
      });
  };

  const handleFormSuccess = () => {
    fetchProducts();
    setShowForm(false);
    setSelectedProduct(null);
  };

  const handleDuplicate = async (product: Product) => {
    try {
      await useProductStore.getState().duplicateProduct(product.id);
      // No need to manually refresh - store will update
    } catch (error) {
      // Error handled in store
    }
  };

  const handlePreview = (product: Product) => {
    setPreviewProduct(product);
  };

  const closePreview = () => {
    setPreviewProduct(null);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleCategoryChange = (category: string) => {
    setFilters({ category: category || undefined, page: 1 });
  };

  const handleStatusChange = (status: string) => {
    setFilters({ status: status as 'draft' | 'published' | 'archived' | undefined, page: 1 });
  };

  const handleMinPriceChange = (value?: number) => {
    setFilters({ minPrice: value, page: 1 });
  };

  const handleMaxPriceChange = (value?: number) => {
    setFilters({ maxPrice: value, page: 1 });
  };

  const handleMinRatingChange = (value?: number) => {
    setFilters({ minRating: value, page: 1 });
  };

  const handleMaxRatingChange = (value?: number) => {
    setFilters({ maxRating: value, page: 1 });
  };

  const handleDateFromChange = (value?: string) => {
    setFilters({ dateFrom: value, page: 1 });
  };

  const handleDateToChange = (value?: string) => {
    setFilters({ dateTo: value, page: 1 });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilters({
      category: undefined,
      status: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      minRating: undefined,
      maxRating: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      page: 1,
      limit: 25
    });
    setSorting('created_at', 'desc');
  };

  const openBulkModal = (mode: 'status' | 'category' | 'price') => {
    setBulkModalMode(mode);
  };

  const closeBulkModal = () => {
    setBulkModalMode(null);
  };

  const handleBulkConfirm = async (payload: any) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      if (bulkModalMode === 'status' && payload.status) {
        await useProductStore.getState().bulkUpdate(ids, { status: payload.status });
      } else if (bulkModalMode === 'category' && payload.category) {
        await useProductStore.getState().bulkUpdate(ids, { category: payload.category });
      } else if (bulkModalMode === 'price' && payload.adjustment) {
        const { type, value, operation } = payload.adjustment;
        await useProductStore.getState().bulkAdjustPrice(ids, type, value, operation);
      }
    } catch (error) {
      // Errors handled in store
    }
  };

  const handleExport = async () => {
    try {
      // Build query params matching current filters
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (filters.category) params.append('category', filters.category);
      if (filters.status) params.append('status', filters.status);
      if (filters.minPrice) params.append('minPrice', filters.minPrice.toString());
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice.toString());
      if (filters.minRating) params.append('minRating', filters.minRating.toString());
      if (filters.maxRating) params.append('maxRating', filters.maxRating.toString());
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);

      // Request CSV export (the backend will return CSV with proper headers)
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/products/export?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const filename = `products-${new Date().toISOString().split('T')[0]}.csv`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Export downloaded successfully');
    } catch (error) {
      toast.error('Failed to export products');
    }
  };

  const handleImportComplete = () => {
    fetchProducts();
  };

  const activeFiltersCount =
    (searchQuery ? 1 : 0) +
    (!!filters.category ? 1 : 0) +
    (!!filters.status ? 1 : 0) +
    (!!filters.minPrice ? 1 : 0) +
    (!!filters.maxPrice ? 1 : 0) +
    (!!filters.minRating ? 1 : 0) +
    (!!filters.maxRating ? 1 : 0) +
    (!!filters.dateFrom ? 1 : 0) +
    (!!filters.dateTo ? 1 : 0);

  // Pagination calculations
  const totalItems = useProductStore.getState().totalCount;
  const currentPage = filters.page || 1;
  const itemsPerPage = filters.limit || 25;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  // Compute start and end indices for display
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

  // Server-side pagination: products array already contains the correct page items
  const displayedProducts = products;

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setFilters({ page });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-white">Products</h1>
          <p className="text-dark-400 mt-1">Manage your product catalog</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-700 hover:bg-dark-700 text-white font-medium rounded-lg transition-colors"
          >
            <Upload size={18} />
            Import
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
          >
            <Download size={18} />
            Export
          </button>
          <button
            onClick={handleAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus size={18} /> Add Product
          </button>
        </div>
      </div>

      <ProductFilters
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        category={filters.category || ''}
        onCategoryChange={handleCategoryChange}
        status={filters.status || ''}
        onStatusChange={handleStatusChange}
        minPrice={filters.minPrice}
        onMinPriceChange={handleMinPriceChange}
        maxPrice={filters.maxPrice}
        onMaxPriceChange={handleMaxPriceChange}
        minRating={filters.minRating}
        onMinRatingChange={handleMinRatingChange}
        maxRating={filters.maxRating}
        onMaxRatingChange={handleMaxRatingChange}
        dateFrom={filters.dateFrom}
        onDateFromChange={handleDateFromChange}
        dateTo={filters.dateTo}
        onDateToChange={handleDateToChange}
        onClearFilters={clearFilters}
        activeFiltersCount={activeFiltersCount}
        categories={categories}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <ProductTable
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onPreview={handlePreview}
          onBulkStatus={() => openBulkModal('status')}
          onBulkCategory={() => openBulkModal('category')}
          onBulkPriceAdjust={() => openBulkModal('price')}
          products={displayedProducts}
        />
      )}

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-dark-800">
        <div className="text-sm text-dark-400">
          Showing {startIndex + 1} - {endIndex} of {totalItems} products
          {totalItems === 0 && ' No products match your filters'}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-dark-400">Items per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setFilters({ limit: parseInt(e.target.value), page: 1 });
              }}
              className="px-3 py-1 bg-dark-800 border border-dark-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>

          {/* Page Navigation */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-sm bg-dark-800 border border-dark-700 rounded text-dark-400 hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="First page"
              >
                ⇤
              </button>
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-2 py-1 text-sm bg-dark-800 border border-dark-700 rounded text-dark-400 hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous page"
              >
                ←
              </button>

              <span className="px-4 py-1 text-sm text-white bg-dark-800 border border-dark-700 rounded whitespace-nowrap">
                Page {currentPage} / {totalPages}
              </span>

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-sm bg-dark-800 border border-dark-700 rounded text-dark-400 hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next page"
              >
                →
              </button>
              <button
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-2 py-1 text-sm bg-dark-800 border border-dark-700 rounded text-dark-400 hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Last page"
              >
                ⇥
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Product Preview Modal */}
      <ProductPreviewModal
        product={previewProduct}
        isOpen={previewProduct !== null}
        onClose={closePreview}
      />

      {/* Bulk Action Modal */}
      <BulkActionModal
        isOpen={bulkModalMode !== null}
        onClose={closeBulkModal}
        mode={bulkModalMode || 'status'}
        categories={categories}
        onConfirm={handleBulkConfirm}
      />

      {/* Import Modal */}
      <ProductImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={handleImportComplete}
      />

      {/* Archive Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-dark-900 border border-dark-800 rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-white mb-2">Archive Product</h3>
            <p className="text-dark-400 mb-6">
              Are you sure you want to archive "{deleteConfirm.name}"? It will be hidden from the public.
            </p>
            <p className="text-sm text-yellow-400 mb-4">
              You can undo this action within 15 seconds.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 bg-dark-800 hover:bg-dark-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmArchive}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Form Modal */}
      <ProductForm
        product={selectedProduct}
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setSelectedProduct(null);
        }}
        onSuccess={handleFormSuccess}
      />
    </div>
  );
};

// Logout handler component
const LogoutPage = () => {
  const { logout } = useAuthStore();
  const navigate = useNavigate();

  React.useEffect(() => {
    logout();
    navigate('/admin/login', { replace: true });
  }, [logout, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-900">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
    </div>
  );
};

// Main App Component
const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin/logout" element={<LogoutPage />} />

        {/* Protected routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="media" element={<MediaPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="activity-logs" element={<ActivityLogPage />} />
        </Route>

        {/* Catch all - redirect to admin */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
export default App;
