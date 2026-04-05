import React from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ProductStatus, Category } from '@/types';

interface ProductFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  category: string;
  onCategoryChange: (category: string) => void;
  status: string;
  onStatusChange: (status: string) => void;
  minPrice?: number;
  onMinPriceChange: (value?: number) => void;
  maxPrice?: number;
  onMaxPriceChange: (value?: number) => void;
  minRating?: number;
  onMinRatingChange: (value?: number) => void;
  maxRating?: number;
  onMaxRatingChange: (value?: number) => void;
  dateFrom?: string;
  onDateFromChange: (value?: string) => void;
  dateTo?: string;
  onDateToChange: (value?: string) => void;
  onClearFilters: () => void;
  activeFiltersCount: number;
  categories?: Category[]; // Optional dynamic categories
}

export const ProductFilters: React.FC<ProductFiltersProps> = ({
  searchQuery,
  onSearchChange,
  category,
  onCategoryChange,
  status,
  onStatusChange,
  minPrice,
  onMinPriceChange,
  maxPrice,
  onMaxPriceChange,
  minRating,
  onMinRatingChange,
  maxRating,
  onMaxRatingChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onClearFilters,
  activeFiltersCount,
  categories,
}) => {
  // Use provided categories or fallback to hardcoded
  const categoryList = categories?.filter(c => c.is_active).map(c => c.name) || ['Fragrances', 'Beauty', 'Hair', 'Bags', 'Watches', 'Jewelry'];

  return (
    <div className="bg-dark-900 border border-dark-800 rounded-xl p-4 mb-6">
      <div className="flex flex-col gap-4">
        {/* First row: Search and basic filters */}
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
            <input
              type="text"
              placeholder="Search products by name or description..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Category Filter */}
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Categories</option>
            {categoryList.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>

          {/* Clear Filters */}
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={onClearFilters} leftIcon={<X size={16} />}>
              Clear ({activeFiltersCount})
            </Button>
          )}
        </div>

        {/* Second row: Advanced filters */}
        <div className="flex flex-col lg:flex-row gap-4 flex-wrap">
          {/* Price Range */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-dark-400">Price:</span>
            <input
              type="number"
              placeholder="Min"
              value={minPrice || ''}
              onChange={(e) => onMinPriceChange(e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-24 px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-dark-500">-</span>
            <input
              type="number"
              placeholder="Max"
              value={maxPrice || ''}
              onChange={(e) => onMaxPriceChange(e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-24 px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Rating Range */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-dark-400">Rating:</span>
            <input
              type="number"
              placeholder="Min"
              min="0"
              max="5"
              step="0.1"
              value={minRating || ''}
              onChange={(e) => onMinRatingChange(e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-20 px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-dark-500">-</span>
            <input
              type="number"
              placeholder="Max"
              min="0"
              max="5"
              step="0.1"
              value={maxRating || ''}
              onChange={(e) => onMaxRatingChange(e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-20 px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-dark-400">Date Added:</span>
            <input
              type="date"
              value={dateFrom || ''}
              onChange={(e) => onDateFromChange(e.target.value || undefined)}
              className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-dark-500">-</span>
            <input
              type="date"
              value={dateTo || ''}
              onChange={(e) => onDateToChange(e.target.value || undefined)}
              className="px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-dark-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
