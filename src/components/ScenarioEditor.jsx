import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X } from 'lucide-react';
import { STOCKS } from '../data/initialScenarios';

export default function ScenarioEditor({
  scenarios,
  currentRound,
  onUpdateScenario,
  isOpen,
  onToggle,
}) {
  const [editingRound, setEditingRound] =
    useState(currentRound);
  const [editedScenario, setEditedScenario] = useState(
    scenarios[currentRound] || scenarios[0]
  );

  // currentRound나 scenarios가 변경되면 editedScenario 업데이트
  useEffect(() => {
    if (scenarios[editingRound]) {
      setEditedScenario(scenarios[editingRound]);
    }
  }, [editingRound, scenarios]);

  const handleUpdate = () => {
    onUpdateScenario(editingRound, editedScenario);
  };

  const handleVolatilityChange = (stockId, value) => {
    setEditedScenario({
      ...editedScenario,
      volatility: {
        ...editedScenario.volatility,
        [stockId]: parseFloat(value) || 0,
      },
    });
  };

  return (
    <>
      <button
        onClick={onToggle}
        className="fixed top-4 right-4 bg-white backdrop-blur-xl hover:bg-gray-50 p-3 rounded-xl border border-yellow-400 z-30 transition-all shadow-lg hover:shadow-xl"
      >
        <Settings className="w-6 h-6 text-yellow-600" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-center justify-center p-4"
            onClick={onToggle}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            className="card-modern p-4 sm:p-6 md:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto mx-2 sm:mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 sm:mb-6 md:mb-8">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
                시나리오 에디터
              </h2>
                <button
                  onClick={onToggle}
                  className="text-gray-600 hover:text-yellow-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-4 sm:mb-6">
                <label className="block text-gray-700 font-semibold mb-2 sm:mb-3 text-sm sm:text-base">
                  라운드 선택
                </label>
                <select
                  value={editingRound}
                  onChange={(e) => {
                    const round = parseInt(e.target.value);
                    setEditingRound(round);
                    setEditedScenario(scenarios[round]);
                  }}
                  className="input-modern w-full text-sm sm:text-base"
                >
                  {scenarios.map((_, idx) => (
                    <option key={idx} value={idx}>
                      라운드 {idx + 1}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4 sm:mb-6">
                <label className="block text-gray-700 font-semibold mb-2 sm:mb-3 text-sm sm:text-base">
                  뉴스 헤드라인
                </label>
                <input
                  type="text"
                  value={editedScenario.headline}
                  onChange={(e) =>
                    setEditedScenario({
                      ...editedScenario,
                      headline: e.target.value,
                    })
                  }
                  className="input-modern w-full text-sm sm:text-base"
                />
              </div>

              <div className="mb-4 sm:mb-6">
                <label className="block text-gray-700 font-semibold mb-3 sm:mb-4 text-sm sm:text-base">
                  변동률 (%)
                </label>
                <div className="space-y-2 sm:space-y-3">
                  {STOCKS.map((stock) => (
                    <div
                      key={stock.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4"
                    >
                      <label className="text-gray-700 font-medium w-full sm:w-32 text-sm sm:text-base">
                        {stock.name}
                      </label>
                      <div className="flex items-center gap-2 flex-1 w-full">
                        <input
                          type="number"
                          value={
                            editedScenario.volatility[
                              stock.id
                            ]
                          }
                          onChange={(e) =>
                            handleVolatilityChange(
                              stock.id,
                              e.target.value
                            )
                          }
                          step="0.1"
                          className="input-modern flex-1 text-sm sm:text-base"
                        />
                        <span className="text-gray-600 w-6 sm:w-8 text-xs sm:text-sm">
                          %
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={handleUpdate}
                className="btn-primary w-full py-3 sm:py-4 text-sm sm:text-base md:text-lg"
              >
                업데이트
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

