import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function NewsModal({
  isOpen,
  headline,
  onClose,
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="card-modern p-4 sm:p-6 md:p-10 max-w-4xl mx-2 sm:mx-4 relative border-yellow-400"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={onClose}
                className="absolute top-2 right-2 sm:top-4 sm:right-4 text-gray-600 hover:text-yellow-600 transition-colors p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>

              <div className="text-center">
                <motion.div
                  initial={{ y: -20 }}
                  animate={{ y: 0 }}
                  className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-yellow-100 border border-yellow-400 text-yellow-700 text-xs sm:text-sm font-bold mb-4 sm:mb-6 tracking-wider"
                >
                  BREAKING NEWS
                </motion.div>
                <motion.h2
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-black gradient-text mb-3 sm:mb-4 leading-tight px-2"
                >
                  {headline}
                </motion.h2>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

