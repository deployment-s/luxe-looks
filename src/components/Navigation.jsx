import { useState, useEffect } from 'react';
import { Menu, X, Search, ShoppingBag, MessageCircle } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { motion, AnimatePresence } from 'framer-motion';
import logo from '../assets/logo.png';

const ASSETS_URL = import.meta.env.VITE_ASSETS_URL || '';

const Navigation = ({ siteSettings }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const whatsapp = siteSettings?.whatsapp || 'https://chat.whatsapp.com/Gb8xGhuAacOJzY7cuMO5tK';
  const siteName = siteSettings?.site_name || 'Luxe Looks';
  const logoUrl = siteSettings?.logo || null;

  const getLogoSrc = () => {
    if (!logoUrl) return logo;
    if (logoUrl.startsWith('http')) return logoUrl;
    return logoUrl?.startsWith('http') ? logoUrl : logoUrl ? `${ASSETS_URL}${logoUrl}` : logo;
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'Collections', href: '#collections' },
    { name: 'About', href: '#about' },
    { name: 'Reviews', href: '#reviews' },
    { name: 'Contact', href: '#contact' },
  ];

  const scrollToSection = (e, href) => {
    e.preventDefault();
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <>
      <Helmet>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Helmet>

      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 overflow-hidden ${
          isScrolled
            ? 'bg-secondary/95 backdrop-blur-md py-2 md:py-3 shadow-lg'
            : 'bg-transparent py-4 md:py-6'
        }`}
      >
        <div className="container-custom">
          <div className="flex items-center justify-between w-full">
            {/* Logo & Site Name */}
            <a
              href="#home"
              onClick={(e) => scrollToSection(e, '#home')}
              className="flex items-center gap-2 md:gap-3 min-w-0"
            >
              <img
                src={getLogoSrc()}
                alt={siteName}
                className="h-8 w-8 md:h-10 lg:h-12 md:w-10 lg:w-auto w-auto rounded-full object-contain"
              />
              <span className="hidden md:block lg:block text-base md:text-lg lg:text-xl font-serif font-bold text-primary tracking-wide">
                {siteName}
              </span>
            </a>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-6 lg:space-x-8">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => scrollToSection(e, link.href)}
                  className="text-accent/90 hover:text-primary font-medium transition-colors duration-300 text-sm uppercase tracking-wider"
                >
                  {link.name}
                </a>
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center gap-3 lg:gap-4">
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 px-4 lg:px-5 py-2 lg:py-2.5 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-full transition-all duration-300 hover:shadow-lg hover:shadow-green-500/30 text-sm lg:text-base"
              >
                <MessageCircle size={16} lg:size={18} className="group-hover:scale-110 transition-transform" />
                <span className="hidden lg:inline">Join WhatsApp</span>
                <span className="lg:hidden">WhatsApp</span>
              </a>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden text-accent p-1"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-secondary/98 backdrop-blur-lg border-t border-gray-800 absolute left-0 right-0"
            >
              <div className="container-custom py-6 space-y-4">
                {navLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={(e) => scrollToSection(e, link.href)}
                    className="block text-accent hover:text-primary font-medium py-2 text-lg"
                  >
                    {link.name}
                  </a>
                ))}
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-full transition-all duration-300 text-sm"
                >
                  <MessageCircle size={16} />
                  <span>Join WhatsApp</span>
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
};

export default Navigation;
