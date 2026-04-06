import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Image as ImageIcon, FolderOpen } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/Button';
import { useProductStore } from '@/store/useProductStore';
import { useCategoryStore } from '@/store/useCategoryStore';
import { useMediaStore } from '@/store/useMediaStore';
import { productService } from '@/services/api';
import type { Product, ProductStatus } from '@/types';
import toast from 'react-hot-toast';

interface ProductFormProps {
  product?: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  name: string;
  category: string;
  price: string;
  description: string;
  rating: number;
  reviews: number;
  status: ProductStatus;
  meta_title?: string;
  meta_description?: string;
}

export const ProductForm: React.FC<ProductFormProps> = ({
  product,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { addProduct, updateProduct } = useProductStore();
  const { categories, fetchCategories } = useCategoryStore();
  const { media, fetchMedia, selectMedia, clearSelection: clearMediaSelection } = useMediaStore();
  const [formData, setFormData] = useState<FormData>({
    name: '',
    category: '',
    price: '',
    description: '',
    rating: 4.0,
    reviews: 0,
    status: 'published',
    meta_title: '',
    meta_description: '',
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedLibraryImage, setSelectedLibraryImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    if (categories.length === 0) {
      fetchCategories();
    }
  }, [categories.length, fetchCategories]);

  // Fetch media when media picker opens
  useEffect(() => {
    if (showMediaPicker && media.length === 0) {
      fetchMedia();
    }
  }, [showMediaPicker, media.length, fetchMedia]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      setImageFile(file);
      setSelectedLibraryImage(null);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    },
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        category: product.category,
        price: product.price,
        description: product.description || '',
        rating: product.rating,
        reviews: product.reviews,
        status: product.status || 'published',
        meta_title: product.meta_title || '',
        meta_description: product.meta_description || '',
      });
      if (product.image) {
        setImagePreview(product.image);
        setSelectedLibraryImage(product.image);
      } else {
        setSelectedLibraryImage(null);
      }
    } else {
      setFormData({
        name: '',
        category: '',
        price: '',
        description: '',
        rating: 4.0,
        reviews: 0,
        status: 'published',
        meta_title: '',
        meta_description: '',
      });
      setImageFile(null);
      setImagePreview(null);
      setSelectedLibraryImage(null);
    }
  }, [product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('category', formData.category);
      formDataToSend.append('price', formData.price);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('rating', String(formData.rating));
      formDataToSend.append('reviews', String(formData.reviews));
      formDataToSend.append('status', formData.status);
      if (formData.meta_title) {
        formDataToSend.append('meta_title', formData.meta_title);
      }
      if (formData.meta_description) {
        formDataToSend.append('meta_description', formData.meta_description);
      }
      if (imageFile) {
        formDataToSend.append('image', imageFile);
      } else if (selectedLibraryImage) {
        formDataToSend.append('existing_image', selectedLibraryImage);
      }

      if (product) {
        await productService.update(product.id, formDataToSend);
        toast.success('Product updated successfully!');
      } else {
        await productService.create(formDataToSend);
        toast.success('Product created successfully!');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save product');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
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
          className="bg-dark-900 border border-dark-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b border-dark-800">
            <h2 className="text-2xl font-bold text-white">
              {product ? 'Edit Product' : 'Add New Product'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-dark-800 text-dark-400 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="label">Product Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="input"
                  placeholder="Enter product name"
                />
              </div>

              <div>
                <label className="label">Category *</label>
                {categories.length === 0 ? (
                  <div className="text-dark-400 text-sm py-2">Loading categories...</div>
                ) : (
                  <select
                    required
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="select"
                  >
                    <option value="">Select category</option>
                    {categories
                      .filter(c => c.is_active)
                      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
                      .map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              <div>
                <label className="label">Price *</label>
                <input
                  type="text"
                  required
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: e.target.value })
                  }
                  className="input"
                  placeholder="e.g., KSh 4,500"
                />
              </div>

              <div>
                <label className="label">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as 'draft' | 'published' | 'archived' })
                  }
                  className="select"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
                <p className="text-xs text-dark-500 mt-1">
                  Draft products are hidden from customers
                </p>
              </div>

              <div>
                <label className="label">Rating (0-5)</label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={formData.rating}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      rating: parseFloat(e.target.value),
                    })
                  }
                  className="input"
                />
              </div>

              <div>
                <label className="label">Reviews Count</label>
                <input
                  type="number"
                  min="0"
                  value={formData.reviews}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      reviews: parseInt(e.target.value) || 0,
                    })
                  }
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                rows={4}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="input"
                placeholder="Enter product description"
              />
            </div>

            {/* SEO Fields */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-dark-800"></div>
                <span className="text-sm text-dark-400 font-medium">SEO Settings</span>
                <div className="h-px flex-1 bg-dark-800"></div>
              </div>

              <div>
                <label className="label">Meta Title</label>
                <input
                  type="text"
                  value={formData.meta_title || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, meta_title: e.target.value })
                  }
                  className="input"
                  placeholder="SEO title (optional, defaults to product name)"
                />
                <p className="text-xs text-dark-500 mt-1">
                  Leave empty to use product name as page title
                </p>
              </div>

              <div>
                <label className="label">Meta Description</label>
                <textarea
                  rows={2}
                  value={formData.meta_description || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, meta_description: e.target.value })
                  }
                  className="input"
                  placeholder="Short description for search engines (optional)"
                />
                <p className="text-xs text-dark-500 mt-1">
                  Recommended: 150-160 characters for optimal SEO
                </p>
              </div>
            </div>

            <div>
              <label className="label">Product Image</label>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-dark-700 hover:border-dark-600'
                }`}
              >
                <input {...getInputProps()} />
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="max-h-48 mx-auto rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImageFile(null);
                        setImagePreview(null);
                        setSelectedLibraryImage(null);
                      }}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto h-12 w-12 text-dark-500 mb-3" />
                    <p className="text-sm text-dark-400">
                      Drag & drop an image here, or click to select
                    </p>
                    <p className="text-xs text-dark-500 mt-1">
                      PNG, JPG, GIF, WebP up to 5MB
                    </p>
                  </>
                )}
              </div>
              <div className="mt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leftIcon={<FolderOpen size={16} />}
                  onClick={() => setShowMediaPicker(true)}
                  className="mt-2"
                >
                  Browse Media Library
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4 border-t border-dark-800">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                {product ? 'Update Product' : 'Create Product'}
              </Button>
            </div>
          </form>
        </motion.div>
      </motion.div>

      {/* Media Library Picker Modal */}
      {showMediaPicker && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => {
            setShowMediaPicker(false);
            clearMediaSelection();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-dark-900 border border-dark-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-dark-800 flex justify-between items-center">
              <h2 className="text-2xl font-serif font-bold text-white">
                Select Image from Media Library
              </h2>
              <button
                onClick={() => {
                  setShowMediaPicker(false);
                  clearMediaSelection();
                }}
                className="p-2 rounded-lg hover:bg-dark-800 text-dark-400 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {media.length === 0 ? (
                <div className="text-center py-12 text-dark-400">
                  No images in media library. Upload some images first.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {media.map((item) => (
                    <div
                      key={item.filename}
                      className="group relative aspect-square bg-dark-900 rounded-xl overflow-hidden border-2 border-dark-800 hover:border-primary-500 cursor-pointer transition-all"
                      onClick={() => {
                        setImagePreview(item.path);
                        setImageFile(null);
                        setSelectedLibraryImage(item.path);
                        setShowMediaPicker(false);
                        clearMediaSelection();
                      }}
                    >
                      <img
                        src={item.path}
                        alt={item.filename}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-primary-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="bg-dark-900/80 text-white px-3 py-1 rounded-lg text-sm">
                          Select
                        </span>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-xs text-white truncate">{item.filename}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
