import { motion } from 'framer-motion';

export default function NewsTicker({ headline }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-yellow-400 overflow-hidden z-40 h-12 sm:h-16 shadow-lg">
      <motion.div
        className="flex items-center h-full"
        animate={{
          x: [0, -1000],
        }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: 'loop',
            duration: 20,
            ease: 'linear',
          },
        }}
      >
        <div className="text-yellow-700 text-xs sm:text-sm font-bold mr-2 sm:mr-4 whitespace-nowrap px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-yellow-100">
          📰 BREAKING
        </div>
        <div className="text-gray-900 text-sm sm:text-base md:text-lg font-semibold whitespace-nowrap">
          {headline}
        </div>
        {/* 반복을 위한 복사본 */}
        <div className="text-yellow-700 text-xs sm:text-sm font-bold mr-2 sm:mr-4 ml-4 sm:ml-8 whitespace-nowrap px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-yellow-100">
          📰 BREAKING
        </div>
        <div className="text-gray-900 text-sm sm:text-base md:text-lg font-semibold whitespace-nowrap">
          {headline}
        </div>
      </motion.div>
    </div>
  );
}
