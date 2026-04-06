import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Star } from 'lucide-react';

const ProductShowcase = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

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
      const response = await fetch('http://localhost:3001/api/products?status=published');

      if (!response.ok) {
        throw new Error('API not available');
      }

      const data = await response.json();

      // Map API products to component format
      const mappedProducts = data.items.map((product, index) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price,
        rating: product.rating,
        reviews: product.reviews,
        description: product.description,
        gradient: getGradientByCategory(product.category, index),
        image: product.image ? `http://localhost:3001${product.image}` : null,
      }));

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
              <div className={`relative h-64 bg-gradient-to-br ${product.gradient} overflow-hidden flex items-center justify-center`}>
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
                  href="https://chat.whatsapp.com/Gb8xGhuAacOJzY7cuMO5tK"
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
            href="https://chat.whatsapp.com/Gb8xGhuAacOJzY7cuMO5tK"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary inline-flex items-center gap-3"
          >
            View Full Catalog
            <MessageCircle size={20} />
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default ProductShowcase;
