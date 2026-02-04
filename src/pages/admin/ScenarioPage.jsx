import { useState, useEffect, useRef } from 'react';
import {
  Newspaper,
  ChevronLeft,
  ChevronRight,
  Save,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/Toast';
import { initialScenarios } from '../../data/initialScenarios';

export default function ScenarioPage({
  gameState,
  adminActions,
  setAdminErrorCallback,
  playerCount,
  socket,
}) {
  const { toasts, removeToast, success, error } =
    useToast();
  const [selectedRound, setSelectedRound] = useState(0);
  const [rumor, setRumor] = useState('');
  const [roundRumors, setRoundRumors] = useState({}); // { round: rumor }
  const hasRequestedRef = useRef(false); // 한 번만 요청하도록 플래그

  // 최대 라운드 계산
  const maxRounds = gameState.isPracticeMode
    ? 4
    : initialScenarios.length + 1;

  // 관리자 에러 콜백 설정
  useEffect(() => {
    if (setAdminErrorCallback) {
      setAdminErrorCallback((errorMessage) => {
        error('오류', errorMessage, 3000);
      });
    }
  }, [setAdminErrorCallback, error]);

  // 라운드별 찌라시와 힌트 로드 (마운트 시 한 번만)
  useEffect(() => {
    // 한 번만 요청하도록 체크
    if (
      !hasRequestedRef.current &&
      adminActions &&
      adminActions.requestRoundScenarios
    ) {
      hasRequestedRef.current = true;
      adminActions.requestRoundScenarios();
    }

    // 서버에서 라운드별 찌라시 업데이트 수신
    const handleRoundScenariosUpdate = (data) => {
      setRoundRumors(data.roundRumors || {});
    };

    if (socket) {
      socket.on(
        'ROUND_SCENARIOS_UPDATE',
        handleRoundScenariosUpdate
      );
      return () => {
        socket.off(
          'ROUND_SCENARIOS_UPDATE',
          handleRoundScenariosUpdate
        );
      };
    }
  }, [adminActions, socket]);

  // 선택된 라운드 변경 시 해당 라운드의 찌라시 로드
  useEffect(() => {
    setRumor(roundRumors[selectedRound] || '');
  }, [selectedRound, roundRumors]);

  // 찌라시 저장
  const handleSaveRumor = () => {
    if (!rumor.trim()) {
      error('오류', '찌라시 내용을 입력해주세요.', 3000);
      return;
    }

    if (adminActions && adminActions.saveRoundRumor) {
      adminActions.saveRoundRumor(
        selectedRound,
        rumor.trim()
      );
      setRoundRumors((prev) => ({
        ...prev,
        [selectedRound]: rumor.trim(),
      }));
      success(
        '저장 완료',
        `라운드 ${
          selectedRound + 1
        }의 찌라시가 저장되었습니다.`,
        3000
      );
    }
  };

  // 이전 라운드
  const handlePreviousRound = () => {
    if (selectedRound > 0) {
      setSelectedRound(selectedRound - 1);
    }
  };

  // 다음 라운드
  const handleNextRound = () => {
    if (selectedRound < maxRounds - 1) {
      setSelectedRound(selectedRound + 1);
    }
  };

  return (
    <div className="p-2 sm:p-4 pb-20 sm:pb-24 relative">

      {/* 라운드 선택 */}
      <div className="card-modern p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Newspaper className="w-5 h-5" />
            라운드 선택
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousRound}
              disabled={selectedRound === 0}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="px-4 py-2 bg-blue-100 text-blue-700 font-bold rounded-lg min-w-[100px] text-center">
              라운드 {selectedRound + 1}
            </span>
            <button
              onClick={handleNextRound}
              disabled={selectedRound >= maxRounds - 1}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* 찌라시 설정 */}
      <div className="card-modern p-3 sm:p-4 mb-4 sm:mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Newspaper className="w-5 h-5" />
          찌라시 설정
        </h2>
        <div className="space-y-3">
          <textarea
            value={rumor}
            onChange={(e) => setRumor(e.target.value)}
            placeholder="이 라운드의 찌라시 내용을 입력하세요..."
            className="input-modern w-full min-h-[120px] resize-y"
            rows={5}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveRumor}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              찌라시 저장
            </button>
            <button
              onClick={() => {
                if (!rumor.trim()) {
                  error(
                    '오류',
                    '전송할 찌라시가 없습니다.',
                    3000
                  );
                  return;
                }
                if (
                  adminActions &&
                  adminActions.broadcastRumor
                ) {
                  adminActions.broadcastRumor(
                    selectedRound,
                    rumor.trim()
                  );
                  success(
                    '전송 완료',
                    `라운드 ${
                      selectedRound + 1
                    }의 찌라시가 모든 플레이어에게 전송되었습니다.`,
                    3000
                  );
                }
              }}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2"
            >
              <Newspaper className="w-5 h-5" />
              찌라시 전송
            </button>
          </div>
        </div>
      </div>

      {/* Toast 알림 */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
