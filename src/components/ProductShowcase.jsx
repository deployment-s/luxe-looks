import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Star, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const ASSETS_URL = import.meta.env.VITE_ASSETS_URL || 'http://localhost:3001';

const ProductShowcase = ({ siteSettings }) => {
  const { whatsapp = '' } = siteSettings || {};
  const waLink = whatsapp || 'https://chat.whatsapp.com/Gb8xGhuAacOJzY7cuMO5tK';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Fallback static products if API is not available
  const fallbackProducts = [
    {
      id: 1,
      name: 'Parisian Rose Oil Perfume',
      category: 'Fragrances',
      price: 'KSh 4,500',
      rating: 4.9,
      reviews: 127,
      description: 'Long-lasting oil-based fragrance with French rose notes',
      gradient: 'from-pink-200 to-rose-300',
    },
    {
      id: 2,
      name: 'Premium Human Hair Bundle',
      category: 'Hair',
      price: 'KSh 8,999',
      rating: 4.8,
      reviews: 89,
      description: 'Virgin Brazilian hair, natural texture, 16 inches',
      gradient: 'from-amber-200 to-orange-300',
    },
    {
      id: 3,
      name: 'Luxury Makeup Palette',
      category: 'Beauty',
      price: 'KSh 3,250',
      rating: 4.7,
      reviews: 203,
      description: '24-shade eyeshadow palette with matte & shimmer finishes',
      gradient: 'from-purple-200 to-pink-300',
    },
    {
      id: 4,
      name: 'Designer Leather Handbag',
      category: 'Bags',
      price: 'KSh 12,500',
      rating: 4.9,
      reviews: 56,
      description: 'Genuine leather tote bag with gold-tone hardware',
      gradient: 'from-stone-200 to-gray-300',
    },
    {
      id: 5,
      name: 'Swiss Luxury Watch',
      category: 'Watches',
      price: 'KSh 35,000',
      rating: 5.0,
      reviews: 34,
      description: 'Automatic movement with genuine leather strap',
      gradient: 'from-blue-200 to-slate-300',
    },
    {
      id: 6,
      name: 'Gold-Plated Necklace Set',
      category: 'Jewelry',
      price: 'KSh 6,800',
      rating: 4.8,
      reviews: 92,
      description: '18k gold-plated with cubic zirconia stones',
      gradient: 'from-yellow-200 to-amber-300',
    },
  ];

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/products?status=published&active=true`);

      if (!response.ok) {
        throw new Error('API not available');
      }

      const data = await response.json();

      // Map API products to component format
      const mappedProducts = data.items.map((product, index) => {
        // Format price with KSh prefix
        let formattedPrice = product.price;
        if (product.price) {
          // Remove any existing KSh or currency symbols and spaces
          const numericPrice = product.price.replace(/[KSh,\s]/gi, '').trim();
          // Format with commas and add KSh prefix
          const num = parseFloat(numericPrice);
          if (!isNaN(num)) {
            formattedPrice = `KSh ${num.toLocaleString()}`;
          }
        }
        
        return {
          id: product.id,
          name: product.name,
          category: product.category,
          price: formattedPrice,
          rating: product.rating,
          reviews: product.reviews,
          description: product.description,
          gradient: getGradientByCategory(product.category, index),
          image: product.image ? (product.image.startsWith('http') ? product.image : `${ASSETS_URL}${product.image}`) : null,
        };
      });

      setProducts(mappedProducts);
    } catch (error) {
      console.log('Using fallback products (API not running)');
      setProducts(fallbackProducts);
    } finally {
      setLoading(false);
    }
  };

  const getGradientByCategory = (category, index) => {
    const gradients = {
      Fragrances: 'from-pink-200 to-rose-300',
      Beauty: 'from-purple-200 to-pink-300',
      Hair: 'from-amber-200 to-orange-300',
      Bags: 'from-stone-200 to-gray-300',
      Watches: 'from-blue-200 to-slate-300',
      Jewelry: 'from-yellow-200 to-amber-300',
    };
    return gradients[category] || fallbackProducts[index]?.gradient || 'from-gray-200 to-gray-300';
  };

  if (loading) {
    return (
      <section id="products" className="section bg-white">
        <div className="container-custom">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="mt-4 text-gray-600">Loading products...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="products" className="section bg-white">
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-secondary mb-6">
            Featured Products
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Explore our best-selling luxury items - all available for immediate delivery
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -12, transition: { duration: 0.3 } }}
              className="bg-white rounded-2xl shadow-lg overflow-hidden group border border-gray-100"
            >
              {/* Product Image */}
              <div 
                className={`relative h-64 bg-gradient-to-br ${product.gradient} overflow-hidden flex items-center justify-center cursor-pointer`}
                onClick={() => setSelectedProduct(product)}
              >
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className={`text-white/40 text-8xl font-serif ${product.image ? 'hidden' : 'flex'}`}>
                  {product.category.charAt(0)}
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />

                {/* Price Badge */}
                <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm text-primary font-bold px-4 py-2 rounded-full shadow-md">
                  {product.price}
                </div>

                {/* Category Badge */}
                <div className="absolute bottom-4 left-4">
                  <span className="bg-secondary/80 text-accent text-xs uppercase tracking-wider px-3 py-1 rounded-full">
                    {product.category}
                  </span>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-secondary mb-2 group-hover:text-primary transition-colors">
                  {product.name}
                </h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {product.description}
                </p>

                {/* Rating */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={i < Math.floor(product.rating) ? 'text-primary fill-primary' : 'text-gray-300'}
                        fill={i < Math.floor(product.rating) ? 'currentColor' : 'none'}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-600">
                    {product.rating} ({product.reviews} reviews)
                  </span>
                </div>

                {/* CTA */}
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-yellow-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg"
                >
                  <MessageCircle size={20} />
                  Enquire via WhatsApp
                </a>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-12"
        >
          <p className="text-gray-500 italic mb-6">
            Want to see more products? Browse our full catalog on WhatsApp!
          </p>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary inline-flex items-center gap-3"
          >
            View Full Catalog
            <MessageCircle size={20} />
          </a>
        </motion.div>
      </div>

      {/* Image Preview Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-white/80 hover:bg-white rounded-full text-gray-700 hover:text-black transition-colors"
              >
                <X size={24} />
              </button>

              <div className="grid md:grid-cols-2">
                {/* Image */}
                <div className="bg-gray-100 h-[400px] md:h-[500px] flex items-center justify-center">
                  {selectedProduct.image ? (
                    <img
                      src={selectedProduct.image}
                      alt={selectedProduct.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-8xl font-serif text-gray-300">
                      {selectedProduct.category.charAt(0)}
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="p-8 flex flex-col justify-center">
                  <span className="inline-block self-start px-3 py-1 bg-primary/20 text-primary text-sm font-medium rounded-full mb-4">
                    {selectedProduct.category}
                  </span>
                  <h3 className="text-2xl font-bold text-secondary mb-4">
                    {selectedProduct.name}
                  </h3>
                  <p className="text-3xl font-bold text-primary mb-4">
                    {selectedProduct.price}
                  </p>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex text-yellow-400">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={18}
                          fill={i < Math.floor(selectedProduct.rating) ? 'currentColor' : 'none'}
                        />
                      ))}
                    </div>
                    <span className="text-gray-600">({selectedProduct.reviews} reviews)</span>
                  </div>
                  <p className="text-gray-600 mb-6">
                    {selectedProduct.description}
                  </p>
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-primary hover:bg-yellow-600 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300"
                  >
                    <MessageCircle size={20} />
                    Enquire on WhatsApp
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default ProductShowcase;
