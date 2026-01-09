import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lightbulb,
  Check,
  TrendingUp,
  Gift,
  Clock,
  Users,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/Toast';
import { initialScenarios } from '../../data/initialScenarios';

export default function HintShopPage({
  gameState,
  playerList,
  transactionLogs,
  adminActions,
  playerCount,
}) {
  const { toasts, removeToast, success, error } =
    useToast();
  const [activeTab, setActiveTab] = useState('grant'); // 'grant' or 'logs'
  const [selectedPlayerId, setSelectedPlayerId] =
    useState('');
  const [hintDifficulty, setHintDifficulty] =
    useState('이영훈 힌트');
  const [hintPrice, setHintPrice] = useState('1000');
  const [hintContent, setHintContent] = useState('');

  // 힌트 로그만 필터링
  const hintLogs = transactionLogs.filter(
    (log) => log.type === 'HINT_PURCHASE'
  );

  // 최대 라운드 계산
  const maxRounds = gameState.isPracticeMode
    ? 4
    : initialScenarios.length + 1;

  return (
    <div className="min-h-screen p-2 sm:p-4 pb-20 sm:pb-24 relative">
      {/* 배경 효과 */}
      <div className="fixed inset-0 bg-gradient-to-br from-purple-50 via-pink-50 to-purple-50 -z-10"></div>

      {/* 게임 상태 정보 */}
      <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50 flex gap-2 sm:gap-3 flex-wrap">
        {!gameState.isGameStarted ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-2 py-1 sm:px-4 sm:py-2 rounded-full backdrop-blur-xl font-semibold bg-gray-100 text-gray-700 border border-gray-300 text-xs sm:text-sm"
          >
            ⏸️ 게임 시작 전
          </motion.div>
        ) : null}
        <div className="px-2 py-1 sm:px-4 sm:py-2 rounded-full backdrop-blur-xl font-semibold bg-blue-100 text-blue-700 border border-blue-300 text-xs sm:text-sm">
          <Users className="w-3 h-3 sm:w-4 sm:h-4 inline-block mr-1" />
          {playerCount || 0}명 접속
        </div>
      </div>

      {/* 헤더 */}
      <div className="text-center mb-4 sm:mb-6">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl sm:text-2xl md:text-3xl font-black mb-2 gradient-text"
        >
          💡 힌트 상점
        </motion.h1>
        {gameState.isGameStarted && (
          <>
            <div className="text-sm sm:text-base text-gray-600 mb-2">
              라운드 {gameState.currentRound + 1} /{' '}
              {maxRounds}
              {gameState.isPracticeMode && (
                <span className="ml-2 text-yellow-600">
                  (연습 모드)
                </span>
              )}
            </div>
            {/* 라운드 타이머 */}
            {!gameState.isWaitingMode &&
              gameState.roundTimer !== null && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-base sm:text-lg ${
                    gameState.roundTimer <= 60
                      ? 'bg-red-100 text-red-700 border-2 border-red-300'
                      : gameState.roundTimer <= 300
                      ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-300'
                      : 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                  }`}
                >
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>
                    {Math.floor(gameState.roundTimer / 60)}:
                    {(gameState.roundTimer % 60)
                      .toString()
                      .padStart(2, '0')}
                  </span>
                </motion.div>
              )}
          </>
        )}
      </div>

      {/* 탭 메뉴 */}
      <div className="flex gap-2 mb-4 sm:mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('grant')}
          className={`px-4 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all border-b-2 ${
            activeTab === 'grant'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-2" />
          힌트 부여
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all border-b-2 ${
            activeTab === 'logs'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-2" />
          힌트 로그 ({hintLogs.length})
        </button>
      </div>

      {/* 탭 내용 */}
      <AnimatePresence mode="wait">
        {/* 힌트 부여 탭 */}
        {activeTab === 'grant' && (
          <motion.div
            key="grant"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="card-modern p-3 sm:p-4 mb-4 sm:mb-6"
          >
            <h2 className="text-lg sm:text-xl font-bold gradient-text mb-3 sm:mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6" />
              힌트 부여
            </h2>
            <div className="space-y-4">
              {/* 플레이어 선택 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  플레이어 선택
                </label>
                <select
                  value={selectedPlayerId}
                  onChange={(e) =>
                    setSelectedPlayerId(e.target.value)
                  }
                  className="input-modern w-full"
                >
                  <option value="">
                    플레이어를 선택하세요
                  </option>
                  {playerList.map((player) => (
                    <option
                      key={player.socketId}
                      value={player.socketId}
                    >
                      {player.nickname} (현금: ₩
                      {player.cash.toLocaleString('ko-KR')})
                    </option>
                  ))}
                </select>
              </div>

              {/* 힌트 꾸러미 선택 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  힌트 꾸러미
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    '이영훈 힌트',
                    '김민철 힌트',
                    '조은별 힌트',
                  ].map((hintPack) => (
                    <button
                      key={hintPack}
                      onClick={() =>
                        setHintDifficulty(hintPack)
                      }
                      className={`px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all ${
                        hintDifficulty === hintPack
                          ? hintPack === '이영훈 힌트'
                            ? 'bg-blue-500 text-white shadow-md'
                            : hintPack === '김민철 힌트'
                            ? 'bg-purple-500 text-white shadow-md'
                            : 'bg-pink-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {hintPack}
                    </button>
                  ))}
                </div>
              </div>

              {/* 금액 입력 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  힌트 금액 (₩)
                </label>
                <input
                  type="number"
                  value={hintPrice}
                  onChange={(e) =>
                    setHintPrice(e.target.value)
                  }
                  min="0"
                  step="100"
                  placeholder="금액을 입력하세요"
                  className="input-modern w-full"
                />
              </div>

              {/* 힌트 내용 입력 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  힌트 내용
                </label>
                <textarea
                  value={hintContent}
                  onChange={(e) =>
                    setHintContent(e.target.value)
                  }
                  placeholder="힌트 내용을 입력하세요"
                  className="input-modern w-full min-h-[100px]"
                />
              </div>

              {/* 힌트 부여 버튼 */}
              <button
                onClick={() => {
                  if (!selectedPlayerId) {
                    error(
                      '오류',
                      '플레이어를 선택해주세요.',
                      3000
                    );
                    return;
                  }
                  const price = parseInt(hintPrice);
                  if (isNaN(price) || price < 0) {
                    error(
                      '오류',
                      '올바른 금액을 입력해주세요.',
                      3000
                    );
                    return;
                  }
                  if (adminActions) {
                    adminActions.grantHint(
                      selectedPlayerId,
                      hintDifficulty,
                      price,
                      hintContent || null
                    );
                    const selectedPlayer = playerList.find(
                      (p) => p.socketId === selectedPlayerId
                    );
                    success(
                      '힌트 부여',
                      `${
                        selectedPlayer?.nickname ||
                        '플레이어'
                      }에게 ${hintDifficulty}를 부여했습니다. (₩${price.toLocaleString(
                        'ko-KR'
                      )})`,
                      3000
                    );
                    setSelectedPlayerId('');
                    setHintDifficulty('이영훈 힌트');
                    setHintPrice('1000');
                    setHintContent('');
                  }
                }}
                disabled={!selectedPlayerId || !hintPrice}
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                힌트 부여하기
              </button>
            </div>
          </motion.div>
        )}

        {/* 힌트 로그 탭 */}
        {activeTab === 'logs' && (
          <motion.div
            key="logs"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="card-modern p-3 sm:p-4 mb-4 sm:mb-6"
          >
            <h2 className="text-lg sm:text-xl font-bold gradient-text mb-3 sm:mb-4">
              힌트 로그 ({hintLogs.length}건)
            </h2>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full min-w-[600px] sm:min-w-0">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      시간
                    </th>
                    <th className="text-left py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      플레이어
                    </th>
                    <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      난이도
                    </th>
                    <th className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      금액
                    </th>
                    <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      라운드
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {hintLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan="5"
                        className="py-8 text-center text-gray-500 text-sm"
                      >
                        아직 힌트 로그가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    [...hintLogs]
                      .reverse()
                      .map((log, index) => {
                        const date = new Date(
                          log.timestamp
                        );
                        const timeStr = `${date
                          .getHours()
                          .toString()
                          .padStart(2, '0')}:${date
                          .getMinutes()
                          .toString()
                          .padStart(2, '0')}:${date
                          .getSeconds()
                          .toString()
                          .padStart(2, '0')}`;

                        return (
                          <tr
                            key={index}
                            className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            <td className="py-2 px-2 sm:px-4 text-xs text-gray-600">
                              {timeStr}
                            </td>
                            <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900">
                              {log.nickname}
                            </td>
                            <td className="py-2 px-2 sm:px-4 text-center">
                              <div
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                                  log.difficulty ===
                                  '이영훈 힌트'
                                    ? 'bg-blue-100 text-blue-700'
                                    : log.difficulty ===
                                      '김민철 힌트'
                                    ? 'bg-purple-100 text-purple-700'
                                    : log.difficulty ===
                                      '조은별 힌트'
                                    ? 'bg-pink-100 text-pink-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                <Lightbulb className="w-3 h-3" />
                                {log.difficulty}
                              </div>
                            </td>
                            <td className="py-2 px-2 sm:px-4 text-right text-xs sm:text-sm font-bold text-blue-600">
                              -₩
                              {log.hintPrice.toLocaleString(
                                'ko-KR',
                                { maximumFractionDigits: 0 }
                              )}
                            </td>
                            <td className="py-2 px-2 sm:px-4 text-center text-xs text-gray-600">
                              {log.round + 1}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast 알림 */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
