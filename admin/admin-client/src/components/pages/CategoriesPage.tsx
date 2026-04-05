import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Tag, Plus, Edit2, Trash2, GripVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { Button } from '@/components/ui/Button';
import { useCategoryStore } from '@/store/useCategoryStore';
import toast from 'react-hot-toast';

interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

const INITIAL_FORM_DATA: CategoryFormData = {
  name: '',
  slug: '',
  description: '',
  icon: '',
  color: '#D4AF37',
  sort_order: 0,
  is_active: true,
};

const COLORS = [
  '#D4AF37', '#3B82F6', '#8B5CF6', '#EC4899', '#10B981',
  '#F59E0B', '#EF4444', '#6366F1', '#14B8A6', '#F97316'
];

export const CategoriesPage: React.FC = () => {
  const { categories, isLoading, fetchCategories, createCategory, updateCategory, deleteCategory, reorderCategories } = useCategoryStore();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingCategory, setEditingCategory] = React.useState<number | null>(null);
  const [formData, setFormData] = React.useState<CategoryFormData>(INITIAL_FORM_DATA);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData(INITIAL_FORM_DATA);
    setIsModalOpen(true);
  };

  const openEditModal = (category: any) => {
    setEditingCategory(category.id);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      icon: category.icon || '',
      color: category.color,
      sort_order: category.sort_order,
      is_active: category.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await updateCategory(editingCategory, formData);
        toast.success('Category updated successfully');
      } else {
        await createCategory(formData);
        toast.success('Category created successfully');
      }
      setIsModalOpen(false);
      setFormData(INITIAL_FORM_DATA);
      setEditingCategory(null);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to save category');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure? This cannot be undone.')) return;
    try {
      await deleteCategory(id);
      toast.success('Category deleted successfully');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to delete category');
    }
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    const newCategories = [...categories];
    const dragged = newCategories[dragIndex];
    newCategories.splice(dragIndex, 1);
    newCategories.splice(index, 0, dragged);

    // Update sort_order temporarily for visual feedback
    newCategories.forEach((cat, idx) => {
      cat.sort_order = idx;
    });

    useCategoryStore.setState({ categories: newCategories });
    setDragIndex(index);
  };

  const handleDragEnd = async () => {
    setDragIndex(null);
    const currentCategories = useCategoryStore.getState().categories;
    const orders = currentCategories.map((cat, index) => ({ id: cat.id, sort_order: index }));
    try {
      await reorderCategories(orders);
      toast.success('Categories reordered successfully');
    } catch (error) {
      toast.error('Failed to reorder categories');
      fetchCategories(); // Refresh to original order
    }
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif font-bold text-white">Categories</h1>
          <p className="text-dark-400 mt-1">Organize your products into categories</p>
        </div>
        <Button leftIcon={<Plus size={18} />} onClick={openCreateModal}>
          Add Category
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-dark-400">Loading categories...</div>
      ) : categories.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Tag className="mx-auto h-16 w-16 text-dark-700 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No categories yet</h3>
            <p className="text-dark-400 mb-4">Create your first category to organize products</p>
            <Button leftIcon={<Plus size={18} />} onClick={openCreateModal}>
              Add Category
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`${dragIndex === index ? 'opacity-50' : ''}`}
            >
              <Card hoverable className="group cursor-move">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0"
                        style={{ backgroundColor: category.color }}
                      >
                        <Tag size={24} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white truncate">{category.name}</h3>
                        <p className="text-sm text-dark-400">
                          {(category.product_count || 0)} {category.product_count === 1 ? 'product' : 'products'}
                        </p>
                        <code className="text-xs text-dark-500">/{category.slug}</code>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-2 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-white transition-colors cursor-grab"
                        title="Drag to reorder"
                      >
                        <GripVertical size={16} />
                      </button>
                      <button
                        onClick={() => openEditModal(category)}
                        className="p-2 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-white transition-colors"
                        title="Edit"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(category.id)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-dark-400 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {category.description && (
                    <p className="text-sm text-dark-400 mt-3">{category.description}</p>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs rounded ${category.is_active ? 'bg-green-500/20 text-green-400' : 'bg-dark-800 text-dark-400'}`}>
                      {category.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-dark-900 rounded-2xl border border-dark-800 w-full max-w-lg"
          >
            <div className="p-6 border-b border-dark-800">
              <h2 className="text-2xl font-serif font-bold text-white">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h2>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value, slug: generateSlug(e.target.value) });
                    }}
                    className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Category name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Slug</label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="category-slug"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    rows={3}
                    placeholder="Brief description..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="w-12 h-10 bg-dark-800 border border-dark-700 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="flex-1 px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Sort Order</label>
                    <input
                      type="number"
                      value={formData.sort_order}
                      onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 bg-dark-800 border border-dark-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-dark-700 bg-dark-800 text-primary-500 focus:ring-primary-500"
                  />
                  <label htmlFor="is_active" className="text-sm text-dark-300">Active</label>
                </div>
              </div>
              <div className="p-6 border-t border-dark-800 flex justify-end gap-3">
                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingCategory ? 'Update' : 'Create'} Category
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};
