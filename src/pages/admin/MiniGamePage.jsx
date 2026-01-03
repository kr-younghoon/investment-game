import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Gamepad2, Gift } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/Toast';

export default function MiniGamePage({
  gameState,
  playerList,
  adminActions,
  setAdminErrorCallback,
}) {
  const { toasts, removeToast, success, error } =
    useToast();
  const [selectedPlayerId, setSelectedPlayerId] =
    useState('');
  const [points, setPoints] = useState('');

  // 관리자 에러 콜백 설정
  useEffect(() => {
    if (setAdminErrorCallback) {
      setAdminErrorCallback((errorMessage) => {
        error('오류', errorMessage, 3000);
      });
    }
  }, [setAdminErrorCallback, error]);

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

      {/* 헤더 */}
      <div className="text-center mb-6 sm:mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl sm:text-2xl md:text-3xl font-black mb-3 text-gray-900"
        >
          🎮 미니게임방
        </motion.h1>
        <div className="text-sm sm:text-base text-gray-600">
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
                  {player.cash.toLocaleString('ko-KR')})
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
            포인트 지급
          </button>
        </div>
      </div>

      {/* Toast 알림 */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
