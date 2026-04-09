import { Heart, Camera, Video, MessageCircle } from 'lucide-react';
import logo from '../assets/logo.png';
import PaymentMethods from './PaymentMethods';

const ASSETS_URL = import.meta.env.VITE_ASSETS_URL || 'http://localhost:3001';

const Footer = ({ siteSettings, categories: footerCategories = [] }) => {
  const currentYear = new Date().getFullYear();
  const { phone_number = '', contact_email = '', whatsapp = 'https://chat.whatsapp.com/Gb8xGhuAacOJzY7cuMO5tK', site_name = 'Luxe Looks', logo = '', footer_description = 'Timeless beauty, modern elegance. Your destination for premium beauty and luxury products in Kenya.', instagram = '', tiktok = '', facebook = '' } = siteSettings || {};

  const getLogoSrc = () => {
    if (!logo) return logo;
    if (logo.startsWith('http')) return logo;
    return logo?.startsWith('http') ? logo : logo ? `${ASSETS_URL}${logo}` : logo;
  };

  const socialLinks = [
    { name: 'Instagram', icon: Heart, url: instagram || 'https://www.instagram.com/luxe_looks15' },
    { name: 'TikTok', icon: Video, url: tiktok || 'https://www.tiktok.com/@luxe.looks.beautyke26' },
    { name: 'WhatsApp', icon: MessageCircle, url: whatsapp || 'https://chat.whatsapp.com/Gb8xGhuAacOJzY7cuMO5tK' },
  ];

  const categories = footerCategories.length > 0 
    ? footerCategories.map(cat => ({ name: cat.name, href: '#collections' }))
    : [
        { name: 'Fragrances', href: '#collections' },
        { name: 'Beauty', href: '#collections' },
        { name: 'Hair', href: '#collections' },
        { name: 'Bags', href: '#collections' },
        { name: 'Watches', href: '#collections' },
        { name: 'Jewelry', href: '#collections' },
      ];

  const quickLinks = [
    { name: 'Home', href: '#home' },
    { name: 'Collections', href: '#collections' },
    { name: 'About', href: '#about' },
    { name: 'Reviews', href: '#reviews' },
    { name: 'Contact', href: '#contact' },
  ];

  return (
    <footer className="bg-secondary text-accent">
      <div className="container-custom section pt-16 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand Column */}
          <div className="space-y-6">
            <img
              src={getLogoSrc()}
              alt={site_name}
              className="h-16 w-auto rounded-full"
            />
            <p className="text-gray-400 leading-relaxed">
              {footer_description}
            </p>

            {/* Social Icons */}
            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-800 hover:bg-primary p-3 rounded-full transition-all duration-300 hover:scale-110"
                  aria-label={social.name}
                >
                  <social.icon size={20} />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-lg font-bold text-accent mb-6">Quick Links</h4>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.name}>
                  <a
                    href={link.href}
                    onClick={(e) => scrollToSection(e, link.href)}
                    className="text-gray-400 hover:text-primary transition-colors duration-300"
                  >
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h4 className="text-lg font-bold text-accent mb-6">Categories</h4>
            <ul className="space-y-3">
              {categories.map((category) => (
                <li key={category.name}>
                  <a
                    href={category.href}
                    onClick={(e) => scrollToSection(e, category.href)}
                    className="text-gray-400 hover:text-primary transition-colors duration-300"
                  >
                    {category.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* WhatsApp CTA */}
          <div>
            <h4 className="text-lg font-bold text-accent mb-6">Stay Connected</h4>
            <p className="text-gray-400 mb-4">
              Join our WhatsApp community for exclusive deals and updates.
            </p>
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-center gap-2 w-full py-3 px-6 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-full transition-all duration-300 hover:shadow-lg hover:shadow-green-500/30"
            >
              <MessageCircle size={20} className="group-hover:scale-110 transition-transform" />
              <span>Join Community</span>
            </a>
          </div>
        </div>

        <PaymentMethods />

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 pt-8 mt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm text-center md:text-left">
              © {currentYear} Luxe Looks Beauty & Cosmetics KE. All rights reserved.
            </p>
            <p className="text-gray-500 text-sm flex items-center gap-2">
              Made with <Heart className="text-red-500" size={16} fill="currentColor" /> in Kenya
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
