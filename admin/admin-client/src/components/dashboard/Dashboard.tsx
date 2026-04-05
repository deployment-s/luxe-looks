import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, Tag, Star, MessageSquare, TrendingUp, Clock } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useProductStore } from '@/store/useProductStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { format } from 'date-fns';

export const Dashboard: React.FC = () => {
  const { products, fetchProducts, isLoading } = useProductStore();
  const [stats, setStats] = React.useState<{
    totalProducts: number;
    totalCategories: number;
    averageRating: string;
    totalReviews: number;
    changes: {
      products: string;
      categories: number;
      rating: string;
      reviews: number;
    };
    recentProducts: any[];
    productsByCategory: { name: string; count: number }[];
  } | null>(null);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchProducts]);

  const fetchDashboardStats = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/dashboard/stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    }
  };

  // Calculate statistics from products (fallback if API fails)
  const localStats = React.useMemo(() => {
    const productList = products || [];
    if (!stats) {
      const totalProducts = productList.length;
      const categories = new Set(productList.map((p) => p.category)).size;
      const avgRating =
        productList.length > 0
          ? productList.reduce((sum, p) => sum + p.rating, 0) / productList.length
          : 0;
      const totalReviews = productList.reduce((sum, p) => sum + p.reviews, 0);
      const recentProducts = productList
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .slice(0, 5);

      // Products by category
      const categoryData = Object.entries(
        productList.reduce((acc, p) => {
          acc[p.category] = (acc[p.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      ).map(([name, count]) => ({ name, count }));

      return {
        totalProducts,
        categories,
        avgRating: avgRating.toFixed(1),
        totalReviews,
        recentProducts,
        categoryData,
        changes: { products: '0', categories: 0, rating: '0', reviews: 0 } // placeholder
      };
    }
    return {
      totalProducts: stats.totalProducts,
      categories: stats.totalCategories,
      avgRating: stats.averageRating,
      totalReviews: stats.totalReviews,
      recentProducts: stats.recentProducts || [],
      categoryData: stats.categoryData || [],
      changes: stats.changes
    };
  }, [stats, products]);

  // Ensure localStats is never null/undefined for rendering
  const safeStats = localStats || {
    totalProducts: 0,
    categories: 0,
    avgRating: '0.0',
    totalReviews: 0,
    recentProducts: [],
    categoryData: [],
    changes: { products: '0', categories: 0, rating: '0', reviews: 0 }
  };

  const statCards = [
    {
      title: 'Total Products',
      value: safeStats.totalProducts.toString(),
      change: `${safeStats.changes.products >= 0 ? '+' : ''}${safeStats.changes.products}% from last month`,
      trend: safeStats.changes.products >= 0 ? 'up' : 'down',
      icon: Package,
      color: 'bg-blue-500',
    },
    {
      title: 'Categories',
      value: safeStats.categories.toString(),
      change: `${safeStats.changes.categories >= 0 ? '+' : ''}${safeStats.changes.categories} from last month`,
      trend: safeStats.changes.categories >= 0 ? 'up' : 'down',
      icon: Tag,
      color: 'bg-purple-500',
    },
    {
      title: 'Average Rating',
      value: safeStats.avgRating,
      change: `${safeStats.changes.rating >= 0 ? '+' : ''}${safeStats.changes.rating} from last month`,
      trend: safeStats.changes.rating >= 0 ? 'up' : 'down',
      icon: Star,
      color: 'bg-yellow-500',
    },
    {
      title: 'Total Reviews',
      value: safeStats.totalReviews.toLocaleString(),
      change: `${safeStats.changes.reviews >= 0 ? '+' : ''}${safeStats.changes.reviews} from last month`,
      trend: safeStats.changes.reviews >= 0 ? 'up' : 'down',
      icon: MessageSquare,
      color: 'bg-green-500',
    },
  ];

  const COLORS = ['#D4AF37', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  if (isLoading && products.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-serif font-bold text-white">Dashboard</h1>
        <p className="text-dark-400 mt-1">Welcome back! Here's what's happening.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-dark-400">{stat.title}</p>
                    <p className="text-3xl font-bold text-white mt-2">{stat.value}</p>
                    <p
                      className={`text-sm mt-2 ${
                        stat.trend === 'up' ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {stat.change} from last month
                    </p>
                  </div>
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <stat.icon className="text-white" size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Products by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {safeStats.categoryData.length > 0 ? (
                  <PieChart>
                    <Pie
                      data={safeStats.categoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {safeStats.categoryData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                ) : (
                  <div className="flex items-center justify-center h-full text-dark-400">
                    No category data available
                  </div>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {safeStats.recentProducts.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-4 p-3 bg-dark-800 rounded-lg"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center text-white font-bold">
                    {product.category.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-dark-400">{product.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-primary-500">
                      {product.price}
                    </p>
                    <p className="text-xs text-dark-400">
                      {format(new Date(product.created_at), 'MMM d, HH:mm')}
                    </p>
                  </div>
                </motion.div>
              ))}
              {safeStats.recentProducts.length === 0 && (
                <p className="text-center text-dark-400 py-8">
                  No products yet. Add your first product!
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};
