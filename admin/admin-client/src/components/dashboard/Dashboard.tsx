import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Tag, Star, MessageSquare, TrendingUp, Clock, AlertCircle } from 'lucide-react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/common/Card';
import { dashboardService } from '@/services/api';
import toast from 'react-hot-toast';

interface DashboardStats {
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
  categoryData: { name: string; count: number }[];
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statusDistribution, setStatusDistribution] = useState<{ name: string; value: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getStats();
      setStats(data);

      // Fetch status distribution (draft/published/archived)
      // We'll calculate from products if available or make a separate query
      // For now, we can add this to the API response later, but we'll compute locally
      // Since we don't have products list here easily, we'll skip for now or compute from data
      // Actually we don't have product status counts in current API - could be added later
    } catch (err: any) {
      console.error('Failed to fetch dashboard stats:', err);
      setError(err?.response?.data?.error || 'Failed to load dashboard statistics');
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  // Prepare stats for display
  const displayStats = stats || {
    totalProducts: 0,
    totalCategories: 0,
    averageRating: '0.0',
    totalReviews: 0,
    changes: { products: '0', categories: 0, rating: '0', reviews: 0 },
    recentProducts: [],
    categoryData: [],
  };

  const statCards = [
    {
      title: 'Total Products',
      value: displayStats.totalProducts.toString(),
      change: `${displayStats.changes.products >= 0 ? '+' : ''}${displayStats.changes.products}% from last month`,
      trend: displayStats.changes.products >= 0 ? 'up' : 'down',
      icon: Package,
      color: 'bg-blue-500',
    },
    {
      title: 'Categories',
      value: displayStats.totalCategories.toString(),
      change: `${displayStats.changes.categories >= 0 ? '+' : ''}${displayStats.changes.categories} from last month`,
      trend: displayStats.changes.categories >= 0 ? 'up' : 'down',
      icon: Tag,
      color: 'bg-purple-500',
    },
    {
      title: 'Average Rating',
      value: displayStats.averageRating,
      change: `${displayStats.changes.rating >= 0 ? '+' : ''}${displayStats.changes.rating} from last month`,
      trend: displayStats.changes.rating >= 0 ? 'up' : 'down',
      icon: Star,
      color: 'bg-yellow-500',
    },
    {
      title: 'Total Reviews',
      value: displayStats.totalReviews.toLocaleString(),
      change: `${displayStats.changes.reviews >= 0 ? '+' : ''}${displayStats.changes.reviews} from last month`,
      trend: displayStats.changes.reviews >= 0 ? 'up' : 'down',
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="py-8">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle size={24} />
              <p className="font-medium">Error loading dashboard</p>
            </div>
            <p className="text-sm text-red-300 mt-2">{error}</p>
            <Button onClick={fetchDashboardData} className="mt-4">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </motion.div>
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
                {displayStats.categoryData.length > 0 ? (
                  <PieChart>
                    <Pie
                      data={displayStats.categoryData}
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
                      {displayStats.categoryData.map((entry, index) => (
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
            <CardTitle>Recent Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {displayStats.recentProducts.map((product, index) => (
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
              {displayStats.recentProducts.length === 0 && (
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
