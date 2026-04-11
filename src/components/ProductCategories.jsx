import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ShoppingBag, Watch, Gem, Sparkles, Heart, ArrowRight, Palette, Crown, Droplets, Scissors, Feather, Baby, Glasses, Umbrella, Sun, Anchor, Zap } from 'lucide-react';

const ICON_MAP = {
  shoppingbag: ShoppingBag,
  watch: Watch,
  gem: Gem,
  sparkles: Sparkles,
  heart: Heart,
  palette: Palette,
  crown: Crown,
  droplets: Droplets,
  scissors: Scissors,
  feather: Feather,
  baby: Baby,
  glasses: Glasses,
  umbrella: Umbrella,
  sun: Sun,
  anchor: Anchor,
  zap: Zap,
  tag: Gem,
};

const DEFAULT_CATEGORIES = [
  {
    id: 1,
    name: 'Fragrances',
    subtitle: 'Oil-Based Perfumes',
    description: 'Long-lasting designer fragrances with premium oil-based formulations',
    icon: 'sparkles',
    color: '#D4AF37',
    link: '',
  },
  {
    id: 2,
    name: 'Beauty',
    subtitle: 'Cosmetics & Skincare',
    description: 'Luxury makeup and skincare products for radiant, flawless beauty',
    icon: 'heart',
    color: '#EC4899',
    link: '',
  },
  {
    id: 3,
    name: 'Hair',
    subtitle: 'Premium Human Hair',
    description: 'Authentic human hair wigs, extensions, and hair care products',
    icon: 'sparkles',
    color: '#D97706',
    link: '',
  },
  {
    id: 4,
    name: 'Bags',
    subtitle: 'Luxury Accessories',
    description: 'Elegant handbags and accessories for the modern woman',
    icon: 'shoppingbag',
    color: '#57534E',
    link: '',
  },
  {
    id: 5,
    name: 'Watches',
    subtitle: 'Timeless Elegance',
    description: 'Sophisticated timepieces that make a statement',
    icon: 'watch',
    color: '#3B82F6',
    link: '',
  },
  {
    id: 6,
    name: 'Jewelry',
    subtitle: 'Fine Accessories',
    description: 'Exquisite jewelry pieces to complement your style',
    icon: 'gem',
    color: '#EAB308',
    link: '',
  },
];

const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const getColorShade = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return { from: 'from-gray-400', to: 'to-gray-600' };
  
  const { r, g, b } = rgb;
  if (r > g && r > b) return { from: 'from-amber-600', to: 'to-yellow-600' };
  if (b > r && b > g) return { from: 'from-blue-600', to: 'to-slate-600' };
  if (g > r && g > b) return { from: 'from-green-600', to: 'to-emerald-600' };
  if (r > 200 && g > 100) return { from: 'from-yellow-500', to: 'to-amber-500' };
  if (r > 200 && g < 100 && b < 100) return { from: 'from-pink-500', to: 'to-rose-500' };
  
  const colors = [
    { from: 'from-amber-600', to: 'to-yellow-600' },
    { from: 'from-pink-500', to: 'to-rose-500' },
    { from: 'from-amber-800', to: 'to-amber-600' },
    { from: 'from-stone-600', to: 'to-gray-600' },
    { from: 'from-blue-600', to: 'to-slate-600' },
    { from: 'from-yellow-500', to: 'to-amber-500' },
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

const getBgColor = (hex) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 'bg-gradient-to-br from-gray-50 to-gray-100';
  
  const { r, g, b } = rgb;
  if (r > g && r > b) return 'bg-gradient-to-br from-amber-50 to-yellow-50';
  if (b > r && b > g) return 'bg-gradient-to-br from-blue-50 to-slate-50';
  if (g > r && g > b) return 'bg-gradient-to-br from-green-50 to-emerald-50';
  if (r > 200 && g > 100) return 'bg-gradient-to-br from-yellow-50 to-amber-50';
  if (r > 200 && g < 100 && b < 100) return 'bg-gradient-to-br from-pink-50 to-rose-50';
  
  return 'bg-gradient-to-br from-gray-50 to-gray-100';
};

const ProductCategories = ({ siteSettings, categories: apiCategories }) => {
  const { whatsapp = '' } = siteSettings || {};
  const waLink = whatsapp || 'https://chat.whatsapp.com/Gb8xGhuAacOJzY7cuMO5tK';

  const categories = (apiCategories && apiCategories.length > 0) 
    ? apiCategories.map(cat => ({
        ...cat,
        link: `/category/${cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-')}`,
        icon: cat.icon?.toLowerCase() || 'sparkles',
      }))
    : DEFAULT_CATEGORIES.map(cat => ({ ...cat, link: '/#' }));

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' },
    },
  };

  return (
    <section id="collections" className="section bg-secondary">
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-serif font-bold text-accent mb-4">
            Our Collections
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto">
            Explore our curated selection of premium beauty and lifestyle products
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {categories.map((category) => {
            const IconComponent = ICON_MAP[category.icon] || Sparkles;
            const colorShade = getColorShade(category.color || '#D4AF37');
            const bgColor = getBgColor(category.color || '#D4AF37');
            
            return (
              <motion.div
                key={category.id}
                variants={cardVariants}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="group"
              >
                <Link to={category.link} className="block h-full">
                  <div className="relative h-full bg-dark-900 rounded-2xl overflow-hidden border border-dark-800 hover:border-primary-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-primary-500/10">
                    {/* Icon Section */}
                    <div className={`${bgColor} p-10 flex items-center justify-center relative overflow-hidden`}>
                      <div className={`absolute inset-0 bg-gradient-to-br ${colorShade.from} ${colorShade.to} opacity-0 group-hover:opacity-20 transition-opacity duration-500`} />
                      <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-2xl" />
                      <div className="relative z-10 w-20 h-20 flex items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform duration-300">
                        <IconComponent
                          className="text-secondary"
                          size={48}
                        />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-accent mb-1 group-hover:text-primary transition-colors">
                        {category.name}
                      </h3>
                      <p className="text-sm text-primary font-medium mb-3">
                        {category.subtitle || category.name}
                      </p>
                      <p className="text-gray-400 text-sm leading-relaxed mb-4">
                        {category.description}
                      </p>
                      
                      <div className="flex items-center gap-2 text-primary text-sm font-medium">
                        <span>Shop Now</span>
                        <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>

                    {/* Corner accent */}
                    <div className="absolute top-0 right-0 w-16 h-16 overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-primary/20 to-transparent" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center mt-12"
        >
          <a
            href="#products"
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary hover:bg-yellow-600 text-white font-semibold rounded-full transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/30"
          >
            View All Products
          </a>
        </motion.div>
      </div>
    </section>
  );
};

export default ProductCategories;
