import { motion } from 'framer-motion';

export default function NewsTicker({ headline, newsBriefing }) {
  // newsBriefing이 있으면 각 뉴스 항목을 표시, 없으면 헤드라인만 표시
  const hasBriefing = Array.isArray(newsBriefing) && newsBriefing.length > 0;
  
  // 뉴스 항목들을 하나의 긴 텍스트로 연결 (구분자: •)
  const newsItems = hasBriefing
    ? newsBriefing.map((news) => `[${news.category}] ${news.content}`).join(' • ')
    : headline || '';

  // 텍스트 길이에 따라 애니메이션 duration 조정
  const textLength = newsItems.length;
  const baseDuration = 20; // 기본 20초
  const duration = Math.max(baseDuration, textLength / 30); // 텍스트 길이에 비례하여 조정

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-yellow-400 overflow-hidden z-40 h-12 sm:h-16 shadow-lg">
      <motion.div
        className="flex items-center h-full"
        animate={{
          x: [0, -textLength * 8], // 텍스트 길이에 따라 이동 거리 조정
        }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: 'loop',
            duration: duration,
            ease: 'linear',
          },
        }}
      >
        {/* 무한 스크롤을 위한 2회 반복 */}
        {[0, 1].map((i) => (
          <div key={i} className={`flex items-center ${i === 1 ? 'ml-4 sm:ml-8' : ''}`}>
            <div className="text-yellow-700 text-xs sm:text-sm font-bold mr-2 sm:mr-4 whitespace-nowrap px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-yellow-100">
              📰 BREAKING
            </div>
            <div className="text-gray-900 text-sm sm:text-base md:text-lg font-semibold whitespace-nowrap">
              {newsItems}
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
