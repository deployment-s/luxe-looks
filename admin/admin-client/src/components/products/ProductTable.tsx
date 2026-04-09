import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Copy,
  Eye,
} from 'lucide-react';
import { useProductStore } from '@/store/useProductStore';
import { Button } from '@/components/ui/Button';
import type { Product } from '@/types';
import { format } from 'date-fns';

interface ProductTableProps {
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onDuplicate?: (product: Product) => void;
  onPreview?: (product: Product) => void;
  onBulkStatus?: () => void;
  onBulkCategory?: () => void;
  onBulkPriceAdjust?: () => void;
  products?: Product[];
}

export const ProductTable: React.FC<ProductTableProps> = ({
  onEdit,
  onDelete,
  onDuplicate,
  onPreview,
  onBulkStatus,
  onBulkCategory,
  onBulkPriceAdjust,
  products: propProducts,
}) => {
  const {
    products: storeProducts,
    selectedIds,
    selectProduct,
    selectAll,
    clearSelection,
    sortBy,
    sortOrder,
    setSorting,
    bulkDelete,
  } = useProductStore();

  // Use prop products if provided, otherwise use store products
  const products = propProducts || storeProducts;

  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  const allSelected = products.length > 0 && selectedIds.size === products.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < products.length;

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSorting(column, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSorting(column, 'asc');
    }
  };

  // Note: Sorting is done in parent component (App.tsx) when using pagination
  // When propProducts is provided, it's already sorted and paginated
  // When not provided (fallback to store products), sorting happens in parent too
  // So we just use the products array directly here

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} products? This action cannot be undone.`)) {
      return;
    }

    try {
      await bulkDelete(Array.from(selectedIds));
      // Note: clearSelection() is called in the store after successful delete
    } catch (error) {
      // Error toast handled in store
    }
  };

  const SortingIcon: React.FC<{ column: string }> = ({ column }) => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? (
      <ChevronUp size={14} />
    ) : (
      <ChevronDown size={14} />
    );
  };

  return (
    <div className="bg-dark-900 border border-dark-800 rounded-xl overflow-hidden">
      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-primary-500/10 border-b border-primary-500/30 px-6 py-3 flex flex-wrap items-center gap-4"
        >
          <span className="text-sm text-primary-500 font-medium">
            {selectedIds.size} selected
          </span>
          <div className="flex flex-wrap gap-2">
            {onBulkStatus && (
              <Button size="sm" variant="ghost" onClick={onBulkStatus} className="text-white hover:text-white">
                Update Status
              </Button>
            )}
            {onBulkCategory && (
              <Button size="sm" variant="ghost" onClick={onBulkCategory} className="text-white hover:text-white">
                Update Category
              </Button>
            )}
            {onBulkPriceAdjust && (
              <Button size="sm" variant="ghost" onClick={onBulkPriceAdjust} className="text-white hover:text-white">
                Adjust Price
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={handleBulkDelete} leftIcon={<Trash2 size={14} />} className="text-red-400 hover:text-red-300">
              Delete Selected
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection} className="text-white hover:text-white">
              Clear Selection
            </Button>
          </div>
        </motion.div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-dark-800 bg-dark-800/50">
              <th className="px-6 py-3 w-12">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={(e) => selectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-dark-600 text-primary-500 focus:ring-primary-500 bg-dark-700"
                />
              </th>
              <th className="table-header" onClick={() => handleSort('name')}>
                <div className="flex items-center gap-2">
                  Product
                  <SortingIcon column="name" />
                </div>
              </th>
              <th className="table-header" onClick={() => handleSort('category')}>
                <div className="flex items-center gap-2">
                  Category
                  <SortingIcon column="category" />
                </div>
              </th>
              <th className="table-header" onClick={() => handleSort('status')}>
                <div className="flex items-center gap-2">
                  Status
                  <SortingIcon column="status" />
                </div>
              </th>
              <th className="table-header" onClick={() => handleSort('price')}>
                <div className="flex items-center gap-2">
                  Price
                  <SortingIcon column="price" />
                </div>
              </th>
              <th className="table-header" onClick={() => handleSort('rating')}>
                <div className="flex items-center gap-2">
                  Rating
                  <SortingIcon column="rating" />
                </div>
              </th>
              <th className="table-header" onClick={() => handleSort('created_at')}>
                <div className="flex items-center gap-2">
                  Date Added
                  <SortingIcon column="created_at" />
                </div>
              </th>
              <th className="table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-800">
            {products.map((product, index) => (
              <motion.tr
                key={product.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className={`hover:bg-dark-800/50 transition-colors ${
                  selectedIds.has(product.id) ? 'bg-primary-500/10' : ''
                }`}
              >
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(product.id)}
                    onChange={(e) => selectProduct(product.id, e.target.checked)}
                    className="w-4 h-4 rounded border-dark-600 text-primary-500 focus:ring-primary-500 bg-dark-700"
                  />
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-12 h-12 rounded-lg overflow-hidden bg-dark-800 flex items-center justify-center border border-dark-700 cursor-pointer hover:ring-2 hover:ring-primary-500 hover:scale-110 transition-all duration-200"
                      onClick={() => onPreview?.(product)}
                      title="Click to preview"
                    >
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLElement).nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`${product.image ? 'hidden' : ''} text-2xl font-serif text-primary-500`}>
                        {product.category?.charAt(0) || '?'}
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-white">{product.name}</p>
                      <p className="text-xs text-dark-400 line-clamp-1">
                        {product.description || 'No description'}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="table-cell">
                  <span className="badge badge-blue">{product.category}</span>
                </td>
                <td className="table-cell">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      product.status === 'published'
                        ? 'bg-green-900/50 text-green-400 border border-green-800'
                        : product.status === 'draft'
                        ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-800'
                        : 'bg-gray-900/50 text-gray-400 border border-gray-800'
                    }`}
                  >
                    {product.status}
                  </span>
                </td>
                <td className="table-cell font-medium text-primary-500">
                  {product.price ? `KSh ${parseFloat(product.price.replace(/[KSh,\s]/gi, '')).toLocaleString()}` : '-'}
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <span className="text-yellow-500">★</span>
                    <span>{product.rating.toFixed(1)}</span>
                    <span className="text-dark-500">({product.reviews})</span>
                  </div>
                </td>
                <td className="table-cell text-dark-400">
                  {format(new Date(product.created_at), 'MMM d, yyyy')}
                </td>
                <td className="table-cell text-right">
                  <div className="flex items-center justify-end gap-2">
                    {onPreview && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPreview(product)}
                        title="Preview"
                        className="!text-green-400 hover:!text-green-300"
                      >
                        <Eye size={16} />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(product)}
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </Button>
                    {onDuplicate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDuplicate(product)}
                        title="Duplicate"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        <Copy size={16} />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(product)}
                      title="Delete"
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>

        {products.length === 0 && (
          <div className="text-center py-12">
            <p className="text-dark-400">No products found. Add your first product!</p>
          </div>
        )}
      </div>
    </div>
  );
};
