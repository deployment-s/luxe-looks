import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, MessageCircle, Sparkles, X, ZoomIn } from 'lucide-react';
import Navigation from './Navigation';
import Footer from './Footer';
import FloatingWhatsApp from './FloatingWhatsApp';
import BackToTop from './BackToTop';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const ICON_MAP = {
  shoppingbag: '👜',
  watch: '⌚',
  gem: '💎',
  sparkles: '✨',
  heart: '💖',
  palette: '🎨',
  crown: '👑',
  droplets: '💧',
  scissors: '✂️',
  feather: '🪶',
  baby: '👶',
  glasses: '👓',
  umbrella: '☂️',
  sun: '☀️',
  anchor: '⚓',
  zap: '⚡',
};

const CategoryPage = ({ siteSettings, categories }) => {
  const { slug } = useParams();
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(null);
  const { whatsapp = '' } = siteSettings || {};
  
  const getWaLink = (product) => {
    const message = `Hi! I'm interested in:\n\n*Product:* ${product.name}\n*Price:* ${formatPrice(product.price)}${product.image ? `\n\nImage: ${product.image}` : ''}\n\nPlease confirm availability.`;
    const encodedMessage = encodeURIComponent(message);
    
    const waPhoneMatch = whatsapp?.match(/^(\d{10,15})$/);
    if (waPhoneMatch) {
      return `https://wa.me/${waPhoneMatch[1]}?text=${encodedMessage}`;
    }
    return `${whatsapp}?text=${encodedMessage}`;
  };

  const formatPrice = (price) => {
    if (!price) return 'KSh 0';
    const cleanPrice = price.replace(/[KSh\s,]/g, '');
    const num = parseFloat(cleanPrice);
    if (isNaN(num)) return `KSh ${price}`;
    return `KSh ${num.toLocaleString()}`;
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

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
      <div className="min-h-screen bg-dark-950">
        <Navigation siteSettings={siteSettings} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-dark-950">
        <Navigation siteSettings={siteSettings} />
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Sparkles className="w-16 h-16 text-gray-600 mb-4" />
          <h2 className="text-2xl font-serif text-accent mb-4">Category not found</h2>
          <Link to="/" className="text-primary hover:text-yellow-400 transition-colors font-medium">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const iconEmoji = ICON_MAP[category.icon?.toLowerCase()] || '✨';

  return (
    <div className="min-h-screen bg-dark-950">
      <Navigation siteSettings={siteSettings} />
      
      <div className="pt-24 pb-12">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 text-gray-400 hover:text-primary transition-colors font-medium"
            >
              <ChevronLeft size={20} />
              Back to Home
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center mb-16"
          >
            <div 
              className="w-24 h-24 mx-auto mb-6 rounded-2xl flex items-center justify-center text-5xl shadow-xl"
              style={{ 
                backgroundColor: category.color ? `${category.color}20` : 'rgba(212, 175, 55, 0.1)',
                border: `2px solid ${category.color || '#D4AF37'}`
              }}
            >
              {iconEmoji}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-gray-900 mb-4 drop-shadow-sm">
              {category.name}
            </h1>
            {category.description && (
              <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
                {category.description}
              </p>
            )}
            <p className="text-primary font-medium mt-4">
              {products.length} {products.length === 1 ? 'product' : 'products'} available
            </p>
          </motion.div>

          {products.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-dark-800 flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-gray-600" />
              </div>
              <p className="text-gray-400 text-xl">No products in this category yet</p>
              <p className="text-gray-500 mt-2">Check back soon for new arrivals!</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-dark-900 rounded-xl overflow-hidden border border-dark-800 hover:border-primary-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary-500/10 group"
                >
                  <div className="aspect-[4/5] relative overflow-hidden bg-dark-800">
                    {product.image ? (
                      <>
                        <img 
                          src={product.image} 
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer"
                          onClick={() => setSelectedImage(product.image)}
                        />
                        <div 
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                          onClick={() => setSelectedImage(product.image)}
                        >
                          <ZoomIn className="w-8 h-8 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        <Sparkles className="w-12 h-12" />
                      </div>
                    )}
                    {product.status === 'archived' && (
                      <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-semibold px-2 py-1 rounded">
                        Sold Out
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold text-accent mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-primary font-bold text-xl mb-4">
                      {formatPrice(product.price)}
                    </p>
                    <a
                      href={getWaLink(product)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 w-full justify-center px-4 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition-colors"
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
      </div>

      <Footer siteSettings={siteSettings} categories={categories} />
      <FloatingWhatsApp siteSettings={siteSettings} />
      <BackToTop />

      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <button
              className="absolute top-4 right-4 text-white hover:text-primary p-2"
              onClick={() => setSelectedImage(null)}
            >
              <X size={32} />
            </button>
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              src={selectedImage}
              alt="Preview"
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CategoryPage;