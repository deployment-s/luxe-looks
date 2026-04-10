import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, MessageCircle } from 'lucide-react';
import FloatingWhatsApp from './FloatingWhatsApp';
import BackToTop from './BackToTop';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const CategoryPage = ({ siteSettings }) => {
  const { slug } = useParams();
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { whatsapp = '' } = siteSettings || {};
  const waLink = whatsapp || 'https://chat.whatsapp.com/Gb8xGhuAacOJzY7cuMO5tK';

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, prodRes] = await Promise.all([
          fetch(`${API_URL}/categories`),
          fetch(`${API_URL}/products?category=${encodeURIComponent(slug)}`)
        ]);
        
        const categoriesData = await catRes.json();
        const productsData = await prodRes.json();
        
        const cats = categoriesData.items || categoriesData || [];
        const foundCategory = cats.find(c => c.slug === slug || c.name.toLowerCase() === slug?.toLowerCase());
        setCategory(foundCategory);
        
        const prods = productsData.items || productsData || [];
        setProducts(prods);
      } catch (err) {
        console.error('Error fetching category:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center">
        <h2 className="text-2xl text-accent mb-4">Category not found</h2>
        <Link to="/" className="text-primary hover:underline">Go back home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950">
      <div className="container-custom py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-primary hover:text-yellow-400 transition-colors"
          >
            <ChevronLeft size={20} />
            Back to Home
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-12"
        >
          {category.icon && (
            <div 
              className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: category.color || '#D4AF37' }}
            >
              <span className="text-4xl">{category.name.charAt(0)}</span>
            </div>
          )}
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-accent mb-2">
            {category.name}
          </h1>
          {category.description && (
            <p className="text-gray-400 max-w-2xl mx-auto">
              {category.description}
            </p>
          )}
        </motion.div>

        {products.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">No products in this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-dark-900 rounded-xl overflow-hidden border border-dark-800 hover:border-primary-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary-500/10 group"
              >
                <div className="aspect-[4/5] relative overflow-hidden bg-dark-800">
                  {product.image ? (
                    <img 
                      src={product.image} 
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      No Image
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-accent mb-1 line-clamp-1">
                    {product.name}
                  </h3>
                  <p className="text-primary font-bold mb-3">
                    {product.price}
                  </p>
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 w-full justify-center px-4 py-2 bg-primary hover:bg-yellow-600 text-white font-medium rounded-lg transition-colors"
                  >
                    <MessageCircle size={18} />
                    Order via WhatsApp
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <FloatingWhatsApp siteSettings={siteSettings} />
      <BackToTop />
    </div>
  );
};

export default CategoryPage;