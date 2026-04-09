import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import logo from '../assets/logo.png';

const ASSETS_URL = import.meta.env.VITE_ASSETS_URL || 'http://localhost:3001';

const PageLoader = ({ siteSettings, isReady }) => {
  const [showLoader, setShowLoader] = useState(true);

  const siteName = siteSettings?.site_name || 'Luxe Looks';
  const logoUrl = siteSettings?.logo || null;

  const getLogoSrc = () => {
    if (!logoUrl) return logo;
    if (logoUrl.startsWith('http')) return logoUrl;
    return logoUrl?.startsWith('http') ? logoUrl : logoUrl ? `${ASSETS_URL}${logoUrl}` : logo;
  };

  useEffect(() => {
    // Wait for both minimum time AND settings to be ready
    const minTime = 800;
    const timer = setTimeout(() => {
      if (isReady) {
        setShowLoader(false);
      }
    }, minTime);

    return () => clearTimeout(timer);
  }, [isReady]);

  // When isReady becomes true, hide loader
  useEffect(() => {
    if (isReady) {
      setShowLoader(false);
    }
  }, [isReady]);

  return (
    <AnimatePresence>
      {showLoader && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[100] bg-secondary flex items-center justify-center"
        >
          <div className="flex flex-col items-center">
            <motion.img
              src={getLogoSrc()}
              alt={siteName}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="w-32 h-32 object-cover mb-4 rounded-full"
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-accent font-serif text-2xl tracking-wider"
            >
              {siteName.toUpperCase()}
            </motion.div>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 200 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="h-1 bg-primary mx-auto mt-4 rounded-full"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PageLoader;
