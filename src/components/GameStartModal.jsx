import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import {
  AlertCircle,
  X,
  GraduationCap,
  Rocket,
  Users,
  Trash2,
  CheckCircle,
} from 'lucide-react';
import {
  STOCKS,
  initialScenarios,
  PRACTICE_STOCKS,
  practiceScenarios,
} from '../data/initialScenarios';

export default function GameStartModal({
  isOpen,
  onClose,
  onConfirm,
  type, // 'practice' or 'real'
  gameState, // 게임 상태
  playerCount, // 플레이어 수
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  // 모달이 열릴 때마다 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setConfirmDelete(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isPractice = type === 'practice';
  const practiceRounds = practiceScenarios; // 연습 게임용 시나리오 사용

  // 이전 게임 데이터가 있는지 확인
  const hasPreviousData =
    gameState?.isGameStarted ||
    (playerCount && playerCount > 0) ||
    (gameState?.currentRound && gameState.currentRound > 0);

  // 삭제 확인이 필요한지 확인
  const needsDeleteConfirmation =
    hasPreviousData && !confirmDelete;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl p-6 sm:p-8 max-w-2xl w-full relative shadow-xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div
                className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  isPractice
                    ? 'bg-yellow-100'
                    : 'bg-blue-100'
                }`}
              >
                {isPractice ? (
                  <GraduationCap className="w-8 h-8 text-yellow-600" />
                ) : (
                  <Rocket className="w-8 h-8 text-blue-600" />
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                {isPractice
                  ? '연습 게임을 시작하시겠습니까?'
                  : '실제 게임을 시작하시겠습니까?'}
              </h2>
            </div>

            {/* 이전 게임 데이터 확인 */}
            {hasPreviousData && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-red-900 mb-2">
                      이전 게임 데이터가 있습니다
                    </h3>
                    <div className="space-y-1 text-sm text-red-800 mb-3">
                      {gameState?.isGameStarted && (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">
                            게임 상태:
                          </span>
                          <span>
                            {gameState.isPracticeMode
                              ? '연습 모드'
                              : '실제 게임 모드'}{' '}
                            (라운드{' '}
                            {gameState.currentRound + 1})
                          </span>
                        </div>
                      )}
                      {playerCount > 0 && (
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span className="font-semibold">
                            접속 플레이어:
                          </span>
                          <span>{playerCount}명</span>
                        </div>
                      )}
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-red-200">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={confirmDelete}
                          onChange={(e) =>
                            setConfirmDelete(
                              e.target.checked
                            )
                          }
                          className="mt-1 w-5 h-5 text-red-600 border-red-300 rounded focus:ring-red-500 focus:ring-2"
                        />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-red-900 mb-1">
                            이전 게임 데이터 삭제 확인
                          </div>
                          <div className="text-xs text-red-700">
                            체크하면 이전 게임의 모든
                            데이터(플레이어 정보, 거래 내역,
                            주식 보유량 등)가 삭제되고 새
                            게임이 시작됩니다.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {isPractice && (
              <div className="mb-6 space-y-4">
                <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">
                    3라운드
                  </h3>
                  <div className="space-y-3">
                    {practiceRounds.map(
                      (scenario, index) => (
                        <div
                          key={index}
                          className="bg-white rounded-lg p-3 border border-yellow-100"
                        >
                          <div className="text-sm font-semibold text-gray-700 mb-1">
                            라운드 {index + 1} (
                            {scenario.month})
                          </div>
                          <div className="text-sm text-gray-600">
                            {scenario.headline}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-3">
                    주식 종목
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PRACTICE_STOCKS.map((stock) => (
                      <div
                        key={stock.id}
                        className="bg-white rounded-lg p-3 border border-gray-100"
                      >
                        <div className="text-sm font-semibold text-gray-700">
                          {stock.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          초기 가격: ₩
                          {stock.basePrice.toLocaleString(
                            'ko-KR'
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {!isPractice && (
              <div className="mb-6">
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {initialScenarios.length}라운드 실제
                    게임
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    실제 게임은 {initialScenarios.length}
                    라운드로 진행되며, 모든 라운드의 뉴스와
                    주식 변동이 적용됩니다.
                  </p>
                  <div className="bg-white rounded-lg p-3 border border-blue-100">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                      주식 종목
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {STOCKS.map((stock) => (
                        <div
                          key={stock.id}
                          className="text-sm"
                        >
                          <span className="font-semibold text-gray-700">
                            {stock.name}
                          </span>
                          <span className="text-gray-500 ml-2">
                            ₩
                            {stock.basePrice.toLocaleString(
                              'ko-KR'
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (!needsDeleteConfirmation) {
                    const shouldDelete =
                      confirmDelete && hasPreviousData;
                    setConfirmDelete(false); // 상태 초기화
                    onConfirm(shouldDelete);
                    onClose();
                  }
                }}
                disabled={needsDeleteConfirmation}
                className={`flex-1 px-4 py-3 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 ${
                  needsDeleteConfirmation
                    ? 'bg-gray-400 cursor-not-allowed'
                    : isPractice
                    ? 'bg-yellow-500 hover:bg-yellow-600'
                    : 'bg-blue-500 hover:bg-blue-600'
                }`}
              >
                {needsDeleteConfirmation ? (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    삭제 확인 필요
                  </>
                ) : (
                  <>
                    {isPractice ? (
                      <>
                        <GraduationCap className="w-4 h-4" />
                        연습 게임 시작
                      </>
                    ) : (
                      <>
                        <Rocket className="w-4 h-4" />
                        실제 게임 시작
                      </>
                    )}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
