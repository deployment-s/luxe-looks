import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { Product } from '@/types';

interface ProductPreviewModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ProductPreviewModal: React.FC<ProductPreviewModalProps> = ({
  product,
  isOpen,
  onClose,
}) => {
  if (!product) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-dark-900 border border-dark-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 bg-dark-800 hover:bg-dark-700 rounded-full text-dark-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="grid md:grid-cols-2 gap-0">
                {/* Image Section */}
                <div className="bg-dark-800 p-8 flex items-center justify-center min-h-[400px]">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="max-w-full max-h-[400px] object-contain rounded-lg"
                    />
                  ) : (
                    <div className="text-center text-dark-500">
                      <div className="text-6xl mb-4">{product.category?.charAt(0) || '?'}</div>
                      <p>No image available</p>
                    </div>
                  )}
                </div>

                {/* Details Section */}
                <div className="p-8">
                  <div className="mb-4">
                    <span className="inline-block px-3 py-1 bg-primary-500/20 text-primary-500 text-sm font-medium rounded-full border border-primary-500/30">
                      {product.category}
                    </span>
                    <span
                      className={`inline-block ml-2 px-3 py-1 text-sm font-medium rounded-full border ${
                        product.status === 'published'
                          ? 'bg-green-500/20 text-green-400 border-green-500/30'
                          : product.status === 'draft'
                          ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                      }`}
                    >
                      {product.status}
                    </span>
                  </div>

                  <h2 className="text-2xl font-serif font-bold text-white mb-4">
                    {product.name}
                  </h2>

                  <div className="flex items-center gap-4 mb-6">
                    <div className="text-3xl font-bold text-primary-500">
                      {product.price}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-yellow-500">★</span>
                      <span className="text-white font-medium">{product.rating.toFixed(1)}</span>
                      <span className="text-dark-400">({product.reviews} reviews)</span>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-dark-200 uppercase tracking-wider mb-2">
                      Description
                    </h3>
                    <p className="text-dark-300 leading-relaxed">
                      {product.description || 'No description available.'}
                    </p>
                  </div>

                  <div className="border-t border-dark-800 pt-6 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-dark-400">Product ID</span>
                      <span className="text-white font-mono">#{product.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dark-400">Created</span>
                      <span className="text-white">
                        {new Date(product.created_at).toLocaleDateString('en-KE', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-dark-400">Last Updated</span>
                      <span className="text-white">
                        {new Date(product.updated_at).toLocaleDateString('en-KE', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="mt-8 flex gap-3">
                    <button
                      onClick={onClose}
                      className="flex-1 py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg transition-colors"
                    >
                      Close Preview
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
