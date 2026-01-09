import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Gamepad2,
  Gift,
  Clock,
  Users,
  Lock,
  Unlock,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/Toast';
import { initialScenarios } from '../../data/initialScenarios';

export default function MiniGamePage({
  gameState,
  playerList,
  adminActions,
  setAdminErrorCallback,
  playerCount,
}) {
  const { toasts, removeToast, success, error } =
    useToast();
  const [selectedPlayerId, setSelectedPlayerId] =
    useState('');
  const [points, setPoints] = useState('');
  const [blockedPlayers, setBlockedPlayers] = useState(
    new Map()
  ); // { socketId: { rewardAmount: number } }
  const [rewardAmount, setRewardAmount] = useState('');

  // 관리자 에러 콜백 설정
  useEffect(() => {
    if (setAdminErrorCallback) {
      setAdminErrorCallback((errorMessage) => {
        error('오류', errorMessage, 3000);
      });
    }
  }, [setAdminErrorCallback, error]);

  // 최대 라운드 계산
  const maxRounds = gameState.isPracticeMode
    ? 4
    : initialScenarios.length + 1;

  // 포인트 지급 처리
  const handleAddPoints = () => {
    if (!selectedPlayerId) {
      error('오류', '플레이어를 선택해주세요.', 3000);
      return;
    }

    const pointsNum = parseInt(points);
    if (isNaN(pointsNum) || pointsNum <= 0) {
      error('오류', '올바른 포인트를 입력해주세요.', 3000);
      return;
    }

    if (!gameState.isGameStarted) {
      error(
        '오류',
        '게임이 시작되지 않았습니다. 게임을 시작한 후 포인트를 지급할 수 있습니다.',
        3000
      );
      return;
    }

    if (adminActions && adminActions.addPoints) {
      // 미니게임 포인트 지급으로 표시하기 위해 source 추가
      adminActions.addPoints(
        selectedPlayerId,
        pointsNum,
        'minigame'
      );
      const selectedPlayer = playerList.find(
        (p) => p.socketId === selectedPlayerId
      );
      const currentRound = gameState.currentRound + 1;
      success(
        '미니게임 성공!',
        `${currentRound}라운드 미니게임 성공! ₩${pointsNum.toLocaleString(
          'ko-KR'
        )}가 지급됩니다!`,
        3000
      );
      setPoints('');
    }
  };

  return (
    <div className="min-h-screen p-2 sm:p-4 pb-20 sm:pb-24 relative">
      {/* 배경 효과 */}
      <div className="fixed inset-0 bg-white -z-10"></div>

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
      <div className="text-center mb-6 sm:mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl sm:text-2xl md:text-3xl font-black mb-3 text-gray-900"
        >
          🎮 미니게임방
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
        <div className="text-xs sm:text-sm text-gray-500 mt-2">
          플레이어에게 포인트를 지급하세요
        </div>
      </div>

      {/* 게임 시작 안내 */}
      {!gameState.isGameStarted && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-yellow-800">
            ⚠️ 게임이 시작되지 않았습니다. 게임을 시작한 후
            포인트를 지급할 수 있습니다.
          </p>
        </div>
      )}

      {/* 투자 차단 제어 */}
      <div className="card-modern p-3 sm:p-4 mb-4 sm:mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Gamepad2 className="w-5 h-5" />
          미니게임 투자 차단
        </h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            플레이어를 선택하여 투자를 차단하고, 미니게임
            성공/실패에 따라 자동으로 보상을 지급할 수
            있습니다.
          </p>

          {/* 플레이어 선택 및 보상 설정 */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                플레이어 선택
              </label>
              <select
                value={selectedPlayerId}
                onChange={(e) =>
                  setSelectedPlayerId(e.target.value)
                }
                disabled={!gameState.isGameStarted}
                className="input-modern w-full"
              >
                <option value="">
                  {playerList.length === 0
                    ? '접속한 플레이어가 없습니다'
                    : '플레이어를 선택하세요'}
                </option>
                {playerList
                  .filter(
                    (p) => !blockedPlayers.has(p.socketId)
                  )
                  .map((player) => (
                    <option
                      key={player.socketId}
                      value={player.socketId}
                    >
                      {player.nickname} (현금: ₩
                      {Math.floor(
                        player.cash || 0
                      ).toLocaleString('ko-KR', {
                        maximumFractionDigits: 0,
                      })}
                      )
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                성공 시 보상 금액
              </label>
              <input
                type="number"
                value={rewardAmount}
                onChange={(e) =>
                  setRewardAmount(e.target.value)
                }
                placeholder="보상 금액을 입력하세요"
                min="0"
                disabled={!gameState.isGameStarted}
                className="input-modern w-full"
              />
            </div>

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
                const reward = parseInt(rewardAmount) || 0;
                if (
                  adminActions &&
                  adminActions.blockTradingForPlayer
                ) {
                  adminActions.blockTradingForPlayer(
                    selectedPlayerId,
                    reward
                  );
                  const selectedPlayer = playerList.find(
                    (p) => p.socketId === selectedPlayerId
                  );
                  setBlockedPlayers((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(selectedPlayerId, {
                      rewardAmount: reward,
                    });
                    return newMap;
                  });
                  success(
                    '투자 차단 시작',
                    `${
                      selectedPlayer?.nickname || '플레이어'
                    }님의 투자가 차단되었습니다.`,
                    3000
                  );
                  setSelectedPlayerId('');
                  setRewardAmount('');
                }
              }}
              disabled={
                !selectedPlayerId ||
                !gameState.isGameStarted ||
                blockedPlayers.has(selectedPlayerId)
              }
              className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2"
            >
              <Lock className="w-5 h-5" />
              선택한 플레이어 투자 차단 시작
            </button>
          </div>

          {/* 차단된 플레이어 목록 */}
          {blockedPlayers.size > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">
                차단된 플레이어 ({blockedPlayers.size}명)
              </h3>
              {Array.from(blockedPlayers.entries()).map(
                ([socketId, info]) => {
                  const player = playerList.find(
                    (p) => p.socketId === socketId
                  );
                  if (!player) return null;
                  return (
                    <div
                      key={socketId}
                      className="p-3 bg-red-50 border border-red-200 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-red-800">
                          {player.nickname}
                        </span>
                        <span className="text-xs text-red-600">
                          보상: ₩
                          {(
                            info.rewardAmount || 0
                          ).toLocaleString('ko-KR')}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (
                              adminActions &&
                              adminActions.unblockTradingForPlayer
                            ) {
                              adminActions.unblockTradingForPlayer(
                                socketId,
                                true
                              );
                              setBlockedPlayers((prev) => {
                                const newMap = new Map(
                                  prev
                                );
                                newMap.delete(socketId);
                                return newMap;
                              });
                              success(
                                '미니게임 성공!',
                                `${player.nickname}님에게 보상이 지급되었습니다.`,
                                3000
                              );
                            }
                          }}
                          className="flex-1 px-3 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded text-xs transition-all"
                        >
                          ✅ 성공
                        </button>
                        <button
                          onClick={() => {
                            if (
                              adminActions &&
                              adminActions.unblockTradingForPlayer
                            ) {
                              adminActions.unblockTradingForPlayer(
                                socketId,
                                false
                              );
                              setBlockedPlayers((prev) => {
                                const newMap = new Map(
                                  prev
                                );
                                newMap.delete(socketId);
                                return newMap;
                              });
                              success(
                                '미니게임 실패',
                                `${player.nickname}님의 투자 차단이 해제되었습니다.`,
                                3000
                              );
                            }
                          }}
                          className="flex-1 px-3 py-2 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-semibold rounded text-xs transition-all"
                        >
                          ❌ 실패
                        </button>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          )}
        </div>
      </div>

      {/* 포인트 지급 폼 */}
      <div className="card-modern p-3 sm:p-4 mb-6 sm:mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Gift className="w-5 h-5" />
          포인트 지급
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
              disabled={!gameState.isGameStarted}
              className="input-modern w-full"
            >
              <option value="">
                {playerList.length === 0
                  ? '접속한 플레이어가 없습니다'
                  : '플레이어를 선택하세요'}
              </option>
              {playerList.map((player) => (
                <option
                  key={player.socketId}
                  value={player.socketId}
                >
                  {player.nickname} (현금: ₩
                  {Math.floor(
                    player.cash || 0
                  ).toLocaleString('ko-KR', {
                    maximumFractionDigits: 0,
                  })}
                  )
                </option>
              ))}
            </select>
            {playerList.length === 0 && (
              <p className="text-xs text-gray-500 mt-2">
                플레이어가 접속하면 여기에 표시됩니다.
              </p>
            )}
          </div>

          {/* 포인트 입력 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              지급할 포인트
            </label>
            <input
              type="number"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="포인트를 입력하세요"
              min="1"
              disabled={!gameState.isGameStarted}
              className="input-modern w-full"
            />
          </div>

          {/* 지급 버튼 */}
          <div className="space-y-2">
            <button
              onClick={handleAddPoints}
              disabled={
                !selectedPlayerId ||
                !points ||
                !gameState.isGameStarted
              }
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2"
            >
              <Gift className="w-5 h-5" />
              선택한 플레이어에게 지급
            </button>
            <button
              onClick={() => {
                if (!gameState.isGameStarted) {
                  error(
                    '오류',
                    '게임이 시작되지 않았습니다. 게임을 시작한 후 포인트를 지급할 수 있습니다.',
                    3000
                  );
                  return;
                }
                const pointsNum = parseInt(points);
                if (isNaN(pointsNum) || pointsNum <= 0) {
                  error(
                    '오류',
                    '올바른 포인트를 입력해주세요.',
                    3000
                  );
                  return;
                }
                if (playerList.length === 0) {
                  error(
                    '오류',
                    '접속한 플레이어가 없습니다.',
                    3000
                  );
                  return;
                }
                if (
                  adminActions &&
                  adminActions.addPointsToAll
                ) {
                  adminActions.addPointsToAll(
                    pointsNum,
                    'minigame'
                  );
                  const currentRound =
                    gameState.currentRound + 1;
                  success(
                    '모든 플레이어에게 지급 완료!',
                    `${currentRound}라운드 미니게임 성공! 모든 플레이어에게 ₩${pointsNum.toLocaleString(
                      'ko-KR'
                    )}가 지급되었습니다!`,
                    3000
                  );
                  setPoints('');
                }
              }}
              disabled={
                !points ||
                !gameState.isGameStarted ||
                playerList.length === 0
              }
              className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2"
            >
              <Gift className="w-5 h-5" />
              모든 플레이어에게 지급 ({playerList.length}명)
            </button>
          </div>
        </div>
      </div>

      {/* Toast 알림 */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
