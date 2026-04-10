import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Quote, ChevronLeft, ChevronRight } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const Reviews = () => {
  const [reviews, setReviews] = useState([
    {
      id: 1,
      name: 'Jane Wairimu',
      location: 'Nairobi',
      rating: 5,
      text: "Absolutely love Luxe Looks! The perfumes are long-lasting and the quality is unmatched. Fast delivery and excellent customer service. My go-to for luxury beauty products in Kenya.",
      is_verified: true,
      avatar: 'JW',
    },
    {
      id: 2,
      name: 'Titus Muthiani',
      location: 'Mombasa',
      rating: 5,
      text: "Premium quality human hair at an amazing price. The team is very helpful on WhatsApp and answered all my questions. Delivery was super fast. Highly recommend!",
      is_verified: true,
      avatar: 'TM',
    },
    {
      id: 3,
      name: 'Sarah K.',
      location: 'Kisumu',
      rating: 5,
      text: "Finally found authentic designer perfumes in Kenya! The oil-based fragrances last all day. Luxe Looks has exceeded my expectations. Will definitely be ordering again.",
      is_verified: true,
      avatar: 'SK',
    },
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await fetch(`${API_URL}/reviews?active=true`);
        if (response.ok) {
          const data = await response.json();
          if (data.length > 0) {
            setReviews(data);
          }
        }
      } catch (error) {
        console.log('Using fallback reviews');
      }
    };
    fetchReviews();
  }, []);

  useEffect(() => {
    if (!isAutoPlaying || reviews.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % reviews.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isAutoPlaying, reviews.length]);

  const goToPrevious = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev - 1 + reviews.length) % reviews.length);
  };

  const goToNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % reviews.length);
  };

  const goToSlide = (index) => {
    setIsAutoPlaying(false);
    setCurrentIndex(index);
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        size={24}
        className={i < rating ? 'text-yellow-400' : 'text-gray-600'}
        fill={i < rating ? 'currentColor' : 'none'}
      />
    ));
  };

  return (
    <section id="reviews" className="section bg-gradient-to-b from-secondary to-gray-900">
      <div className="container-custom">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-accent mb-6">
            Customer Reviews
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            See what our valued customers are saying about their Luxe Looks experience
          </p>
        </motion.div>

        {/* Carousel */}
        <div 
          className="relative max-w-4xl mx-auto"
          onMouseEnter={() => setIsAutoPlaying(false)}
          onMouseLeave={() => setIsAutoPlaying(true)}
        >
          {/* Navigation Arrows */}
          {reviews.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-dark-800/80 hover:bg-primary-500 text-gray-300 hover:text-white transition-all duration-300 shadow-lg"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={goToNext}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-dark-800/80 hover:bg-primary-500 text-gray-300 hover:text-white transition-all duration-300 shadow-lg"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          {/* Review Card */}
          <div className="relative mx-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.5 }}
                className="bg-dark-900/80 backdrop-blur-md border border-primary-500/20 rounded-3xl p-10 md:p-14 relative overflow-hidden"
              >
                {/* Background Quote */}
                <div className="absolute top-4 left-4 text-primary/10">
                  <Quote size={120} />
                </div>

                {/* Content */}
                <div className="relative z-10">
                  {/* Rating */}
                  <div className="flex gap-1 mb-6 justify-center">
                    {renderStars(reviews[currentIndex].rating)}
                  </div>

                  {/* Review Text */}
                  <p className="text-gray-300 leading-relaxed mb-8 text-lg md:text-2xl text-center font-light">
                    "{reviews[currentIndex].text}"
                  </p>

                  {/* Reviewer Info */}
                  <div className="flex items-center justify-center gap-4 pt-6 border-t border-gray-800/50">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary to-yellow-600 rounded-full flex items-center justify-center text-secondary font-bold text-2xl shadow-lg shadow-primary-500/20">
                      {reviews[currentIndex].avatar || reviews[currentIndex].name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-3">
                        <h4 className="font-bold text-accent text-xl">
                          {reviews[currentIndex].name}
                        </h4>
                        {reviews[currentIndex].is_verified && (
                          <span className="bg-green-500/20 text-green-400 text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1">
                            <span className="w-2 h-2 bg-green-400 rounded-full inline-block" />
                            Verified
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-base mt-1">{reviews[currentIndex].location}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Dots Indicator */}
          {reviews.length > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {reviews.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentIndex 
                      ? 'bg-primary w-8' 
                      : 'bg-dark-700 hover:bg-dark-600'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Trust Badge */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex items-center gap-4 glass-dark rounded-full px-8 py-4">
            <div className="flex -space-x-2">
              {['🛍️', '✨', '💎', '🌹', '💄'].map((emoji, i) => (
                <span key={i} className="text-2xl">{emoji}</span>
              ))}
            </div>
            <p className="text-accent font-semibold">
              {reviews.length}+ Happy Customers & Counting
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Reviews;