import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { ProductStatus, Category } from '@/types';

interface BulkActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'status' | 'category' | 'price';
  categories?: Category[];
  onConfirm: (data: any) => void;
}

export const BulkActionModal: React.FC<BulkActionModalProps> = ({
  isOpen,
  onClose,
  mode,
  categories = [],
  onConfirm,
}) => {
  const [status, setStatus] = useState<ProductStatus>('published');
  const [category, setCategory] = useState('');
  const [priceAdjustType, setPriceAdjustType] = useState<'percent' | 'fixed'>('percent');
  const [priceAdjustValue, setPriceAdjustValue] = useState<number>(0);
  const [priceAdjustOperation, setPriceAdjustOperation] = useState<'increase' | 'decrease'>('increase');

  const resetState = () => {
    setStatus('published');
    setCategory('');
    setPriceAdjustType('percent');
    setPriceAdjustValue(0);
    setPriceAdjustOperation('increase');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleConfirm = () => {
    let payload: any = {};
    if (mode === 'status') {
      payload.status = status;
    } else if (mode === 'category') {
      payload.category = category;
    } else if (mode === 'price') {
      payload.adjustment = {
        type: priceAdjustType,
        value: priceAdjustValue,
        operation: priceAdjustOperation,
      };
    }
    onConfirm(payload);
    handleClose();
  };

  const isValid = () => {
    if (mode === 'status') return true; // always valid
    if (mode === 'category') return category.trim().length > 0;
    if (mode === 'price') return priceAdjustValue > 0;
    return false;
  };

  const getTitle = () => {
    switch (mode) {
      case 'status':
        return 'Update Status';
      case 'category':
        return 'Update Category';
      case 'price':
        return 'Adjust Price';
      default:
        return 'Bulk Update';
    }
  };

  const getDescription = () => {
    switch (mode) {
      case 'status':
        return 'Change the status for selected products';
      case 'category':
        return 'Assign a new category to selected products';
      case 'price':
        return 'Adjust prices by percentage or fixed amount';
      default:
        return '';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-dark-900 border border-dark-800 rounded-xl shadow-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white">{getTitle()}</h3>
                <p className="text-sm text-dark-400 mt-1">{getDescription()}</p>
              </div>
              <button onClick={handleClose} className="text-dark-400 hover:text-white transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              {mode === 'status' && (
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">New Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProductStatus)}
                    className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              )}

              {mode === 'category' && (
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">New Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Select a category...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {mode === 'price' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Adjustment Type</label>
                    <div className="flex gap-4 mb-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="priceAdjustType"
                          checked={priceAdjustType === 'percent'}
                          onChange={() => setPriceAdjustType('percent')}
                          className="w-4 h-4 text-primary-500 focus:ring-primary-500 bg-dark-800 border-dark-600"
                        />
                        <span className="text-dark-300">Percentage (%)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="priceAdjustType"
                          checked={priceAdjustType === 'fixed'}
                          onChange={() => setPriceAdjustType('fixed')}
                          className="w-4 h-4 text-primary-500 focus:ring-primary-500 bg-dark-800 border-dark-600"
                        />
                        <span className="text-dark-300">Fixed Amount</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      {priceAdjustType === 'percent' ? 'Percentage' : 'Amount (KSh)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step={priceAdjustType === 'percent' ? '1' : '0.01'}
                      value={priceAdjustValue || ''}
                      onChange={(e) => setPriceAdjustValue(parseFloat(e.target.value) || 0)}
                      placeholder={priceAdjustType === 'percent' ? 'e.g., 10 for 10%' : 'e.g., 500'}
                      className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Operation</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="priceAdjustOp"
                          checked={priceAdjustOperation === 'increase'}
                          onChange={() => setPriceAdjustOperation('increase')}
                          className="w-4 h-4 text-primary-500 focus:ring-primary-500 bg-dark-800 border-dark-600"
                        />
                        <span className="text-dark-300">Increase (+)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="priceAdjustOp"
                          checked={priceAdjustOperation === 'decrease'}
                          onChange={() => setPriceAdjustOperation('decrease')}
                          className="w-4 h-4 text-primary-500 focus:ring-primary-500 bg-dark-800 border-dark-600"
                        />
                        <span className="text-dark-300">Decrease (-)</span>
                      </label>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex gap-3">
              <AlertCircle size={20} className="text-yellow-500 shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-200">
                This action will affect all selected products and cannot be undone automatically. Make sure you've selected the correct products.
              </p>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={!isValid()}>
                Apply Changes
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
