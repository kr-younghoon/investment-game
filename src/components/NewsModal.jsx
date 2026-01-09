import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';

export default function NewsModal({
  isOpen,
  headline,
  newsBriefing,
  volatility,
  stocks,
  onClose,
  isLastRound = false,
  onNext,
}) {
  // newsBriefing이 배열이고 항목이 있으면 브리핑 모드, 아니면 기존 단일 헤드라인 모드
  const hasBriefing = Array.isArray(newsBriefing) && newsBriefing.length > 0;

  // 카테고리별 색상 매핑
  const getCategoryColor = (category) => {
    const colors = {
      경제: 'bg-blue-100 text-blue-700 border-blue-300',
      사회: 'bg-gray-100 text-gray-700 border-gray-300',
      정치: 'bg-red-100 text-red-700 border-red-300',
      문화: 'bg-purple-100 text-purple-700 border-purple-300',
      스포츠: 'bg-green-100 text-green-700 border-green-300',
      금융: 'bg-yellow-100 text-yellow-700 border-yellow-300',
      엔터: 'bg-pink-100 text-pink-700 border-pink-300',
      테크: 'bg-indigo-100 text-indigo-700 border-indigo-300',
      기업: 'bg-orange-100 text-orange-700 border-orange-300',
      레저: 'bg-cyan-100 text-cyan-700 border-cyan-300',
      외교: 'bg-teal-100 text-teal-700 border-teal-300',
      방송: 'bg-violet-100 text-violet-700 border-violet-300',
      국제: 'bg-rose-100 text-rose-700 border-rose-300',
      산업: 'bg-amber-100 text-amber-700 border-amber-300',
      민생: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      노동: 'bg-sky-100 text-sky-700 border-sky-300',
      과학: 'bg-lime-100 text-lime-700 border-lime-300',
      게임: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300',
      트렌드: 'bg-rose-100 text-rose-700 border-rose-300',
      사법: 'bg-slate-100 text-slate-700 border-slate-300',
    };
    return colors[category] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="card-modern p-4 sm:p-6 md:p-8 max-w-5xl w-full mx-2 sm:mx-4 relative border-yellow-400 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={onClose}
                className="absolute top-2 right-2 sm:top-4 sm:right-4 text-gray-600 hover:text-yellow-600 transition-colors p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg z-10"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>

              <div className="text-center mb-6">
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
                  className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-gray-900 mb-4 sm:mb-6 leading-tight px-2"
                >
                  {headline}
                </motion.h2>
              </div>

              {hasBriefing && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="space-y-3 sm:space-y-4 mb-6"
                >
                  {newsBriefing.map((news, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      className="bg-white rounded-lg p-4 sm:p-5 border-2 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        <span
                          className={`px-3 py-1 rounded-lg text-xs sm:text-sm font-bold border flex-shrink-0 ${getCategoryColor(
                            news.category
                          )}`}
                        >
                          {news.category}
                        </span>
                        <p className="text-sm sm:text-base text-gray-800 leading-relaxed flex-1">
                          {news.content}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {/* 주식별 등락률 표시 */}
              {volatility && stocks && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-6 pt-6 border-t-2 border-gray-200"
                >
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-gray-700" />
                    주식 시장 영향
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {stocks.map((stock) => {
                      const change = volatility[stock.id] || 0;
                      const isPositive = change >= 0;
                      const absChange = Math.abs(change);

                      return (
                        <motion.div
                          key={stock.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.6 + stocks.indexOf(stock) * 0.05 }}
                          className={`p-3 sm:p-4 rounded-lg border-2 ${
                            isPositive
                              ? 'bg-red-50 border-red-200'
                              : 'bg-blue-50 border-blue-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {isPositive ? (
                                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0" />
                              ) : (
                                <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                              )}
                              <span className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                                {stock.name}
                              </span>
                            </div>
                            <span
                              className={`text-sm sm:text-base font-bold flex-shrink-0 ${
                                isPositive
                                  ? 'text-red-600'
                                  : 'text-blue-600'
                              }`}
                            >
                              {isPositive ? '+' : ''}
                              {absChange.toFixed(2)}%
                            </span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* 마지막 라운드일 때 "다음" 버튼 표시 */}
              {isLastRound && onNext && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="mt-6 pt-6 border-t-2 border-gray-200 flex justify-center"
                >
                  <button
                    onClick={onNext}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center gap-2"
                  >
                    <span>다음</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

