import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Save } from 'lucide-react';
import { STOCKS } from '../data/initialScenarios';

export default function GameSettings({
  isOpen,
  onClose,
  onSave,
  initialCash = 10000,
  scenarios = [],
}) {
  const [settings, setSettings] = useState({
    initialCash: initialCash,
    totalRounds: scenarios.length,
  });

  useEffect(() => {
    if (isOpen) {
      setSettings({
        initialCash: initialCash,
        totalRounds: scenarios.length,
      });
    }
  }, [isOpen, initialCash, scenarios.length]);

  const handleSave = () => {
    onSave(settings);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="card-modern p-4 sm:p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto mx-2 sm:mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 sm:mb-6 md:mb-8">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold gradient-text flex items-center gap-2 sm:gap-3">
                <Settings className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8" />
                게임 설정
              </h2>
              <button
                onClick={onClose}
                className="text-gray-600 hover:text-gray-900 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

              <div className="space-y-4 sm:space-y-6">
              {/* 초기 현금 설정 */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2 sm:mb-3 text-sm sm:text-base md:text-lg">
                  초기 현금 (₩)
                </label>
                <input
                  type="number"
                  value={settings.initialCash}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      initialCash: Math.max(0, parseInt(e.target.value) || 0),
                    })
                  }
                  min="0"
                  step="1000"
                  className="input-modern w-full text-sm sm:text-base md:text-lg"
                  placeholder="초기 현금을 입력하세요"
                />
                <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2">
                  각 플레이어가 게임 시작 시 받을 초기 현금입니다.
                </p>
              </div>

              {/* 라운드 수 설정 */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2 sm:mb-3 text-sm sm:text-base md:text-lg">
                  총 라운드 수
                </label>
                <input
                  type="number"
                  value={settings.totalRounds}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      totalRounds: Math.max(1, Math.min(20, parseInt(e.target.value) || 1)),
                    })
                  }
                  min="1"
                  max="20"
                  step="1"
                  className="input-modern w-full text-sm sm:text-base md:text-lg"
                  placeholder="라운드 수를 입력하세요"
                />
                <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2">
                  게임의 총 라운드 수입니다. (1-20)
                </p>
              </div>

              {/* 주식 종목 정보 */}
              <div>
                <label className="block text-gray-700 font-semibold mb-2 sm:mb-3 text-sm sm:text-base md:text-lg">
                  주식 종목 ({STOCKS.length}개)
                </label>
                <div className="bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                    {STOCKS.map((stock) => (
                      <div
                        key={stock.id}
                        className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white rounded-lg border border-gray-200"
                      >
                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-purple-500 flex-shrink-0"></div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm sm:text-base text-gray-900 truncate">{stock.name}</div>
                          <div className="text-xs sm:text-sm text-gray-500">
                            초기가: ₩{stock.basePrice.toLocaleString('ko-KR')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  주식 종목은 고정되어 있으며, 시나리오 에디터에서 각 라운드의 변동률을 설정할 수 있습니다.
                </p>
              </div>

              {/* 설정 요약 */}
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 sm:p-6 border border-purple-200">
                <h3 className="font-bold text-gray-900 mb-2 sm:mb-3 text-sm sm:text-base md:text-lg">설정 요약</h3>
                <div className="space-y-1.5 sm:space-y-2 text-sm sm:text-base text-gray-700">
                  <div className="flex justify-between">
                    <span>초기 현금:</span>
                    <span className="font-semibold">₩{settings.initialCash.toLocaleString('ko-KR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>총 라운드:</span>
                    <span className="font-semibold">{settings.totalRounds}라운드</span>
                  </div>
                  <div className="flex justify-between">
                    <span>주식 종목:</span>
                    <span className="font-semibold">{STOCKS.length}개</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-2 sm:gap-4 mt-4 sm:mt-6 md:mt-8">
              <button
                onClick={onClose}
                className="btn-secondary flex-1 py-3 sm:py-4 text-sm sm:text-base md:text-lg"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="btn-primary flex-1 py-3 sm:py-4 text-sm sm:text-base md:text-lg flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4 sm:w-5 sm:h-5" />
                저장
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

