import { motion } from 'framer-motion';
import { Truck, Shield, Clock, Award, MapPin, MessageCircle } from 'lucide-react';

const extractSrcFromIframe = (input) => {
  if (!input) return '';
  if (input.includes('<iframe')) {
    const match = input.match(/src=["']([^"']+)["']/);
    return match ? match[1] : input;
  }
  return input;
};

const About = ({ siteSettings }) => {
  const whatsapp = siteSettings?.whatsapp || 'https://chat.whatsapp.com/Gb8xGhuAacOJzY7cuMO5tK';
  const map_embed_about = siteSettings?.map_embed_about || '';
  const delivery_map_title = siteSettings?.delivery_map_title || 'Where to Find Us / Delivery Coverage';
  const delivery_map_subtitle = siteSettings?.delivery_map_subtitle || 'We deliver to all major towns across Kenya including Nairobi, Mombasa, Kisumu, Nakuru, Eldoret, and more. Stay updated on our social media for occasional pop-up events!';
  const features = [
    {
      icon: Truck,
      title: 'Free Delivery',
      description: 'Door-to-door delivery across major towns in Kenya',
    },
    {
      icon: Shield,
      title: '100% Authentic',
      description: 'Only genuine, premium products from trusted suppliers',
    },
    {
      icon: Clock,
      title: 'Fast Service',
      description: 'Quick response and efficient order processing',
    },
    {
      icon: Award,
      title: 'Premium Quality',
      description: 'Curated selection of luxury beauty & fashion items',
    },
  ];

  return (
    <section id="about" className="section bg-secondary text-accent">
      <div className="container-custom">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Image Side */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative"
          >
            <div className="relative z-10">
              <div className="aspect-square rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src="https://images.unsplash.com/photo-1596462502278-27bfdc403348?q=80&w=800&auto=format&fit=crop"
                  alt="Luxury beauty products showcase"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Decorative element */}
            <div className="absolute -bottom-6 -right-6 w-48 h-48 bg-primary/20 rounded-2xl -z-10" />

            {/* Map indicator */}
            <motion.div
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="absolute -top-6 -right-6 glass-dark rounded-full p-4"
            >
              <MapPin className="text-primary" size={24} />
            </motion.div>
          </motion.div>

          {/* Content Side */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-serif font-bold text-accent mb-6">
              About Luxe Looks
            </h2>

            <div className="space-y-6 text-lg leading-relaxed text-gray-300">
              <p>
                At <span className="text-primary font-semibold">Luxe Looks Beauty & Cosmetics KE</span>, we believe that every individual deserves to experience the finest in beauty and luxury. Our mission is to bring premium quality products — from authentic designer fragrances to exquisite human hair and luxury accessories — closer to you.
              </p>

              <p>
                While we're currently an online-first store, we're committed to serving customers across Kenya with the same level of personalized service you'd expect from a luxury boutique. Our WhatsApp Community is the heart of our customer experience, where we share exclusive deals, beauty tips, and personalized recommendations.
              </p>

              <p>
                We carefully curate our collection to ensure only the highest quality products make it to your doorstep. Every item is authentic, sourced from trusted suppliers, and selected with you in mind.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-6 mt-12">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.1 * index }}
                  className="glass-dark rounded-xl p-5"
                >
                  <feature.icon className="text-primary mb-3" size={28} />
                  <h4 className="font-bold text-accent mb-2">{feature.title}</h4>
                  <p className="text-sm text-gray-400">{feature.description}</p>
                </motion.div>
              ))}
            </div>

            <div className="mt-12">
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-3 px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-full transition-all duration-300 hover:shadow-lg hover:shadow-green-500/30"
              >
                <MessageCircle size={22} className="group-hover:scale-110 transition-transform" />
                <span>Connect with Us</span>
              </a>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Delivery Coverage */}
      <div className="mt-24 border-t border-gray-800 pt-16">
        <div className="container-custom">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h3 className="text-3xl font-serif font-bold text-accent mb-6">
              {delivery_map_title}
            </h3>
            <p className="text-gray-300 max-w-2xl mx-auto mb-10 leading-relaxed">
              {delivery_map_subtitle}
            </p>

            {/* Embedded Map */}
            {map_embed_about ? (
              <div className="max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
                <iframe
                  src={extractSrcFromIframe(map_embed_about)}
                  width="100%"
                  height="400"
                  style={{ border: 0 }}
                  allowFullScreen=""
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Luxe Looks Beauty and Cosmetics Kenya Location"
                />
              </div>
            ) : (
              <div className="max-w-4xl mx-auto rounded-2xl bg-gray-900 h-[400px] flex items-center justify-center">
                <p className="text-gray-500">No map configured</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default About;
