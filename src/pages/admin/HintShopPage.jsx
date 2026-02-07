import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Lightbulb,
  Check,
  TrendingUp,
  Gift,
  Users,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/Toast';
import { initialScenarios } from '../../data/initialScenarios';
import {
  PROVIDER_HINT_PRICES,
  PROVIDER_HINT_POOLS,
} from '../../data/providerHintPools';

export default function HintShopPage({
  gameState,
  playerList,
  transactionLogs,
  adminActions,
  playerCount,
  setHintErrorCallback,
}) {
  const { toasts, removeToast, success, error } =
    useToast();
  const [activeTab, setActiveTab] = useState('grant'); // 'grant' | 'register' | 'logs'
  const [selectedPlayerId, setSelectedPlayerId] =
    useState('');
  const [hintDifficulty, setHintDifficulty] =
    useState('이영훈 힌트');
  const [hintContent, setHintContent] = useState(''); // 비우면 라운드 풀에서 랜덤 지급

  const [registerRound, setRegisterRound] = useState(2);
  const [registerProvider, setRegisterProvider] = useState(
    '이영훈 힌트'
  );
  const [registerHintsText, setRegisterHintsText] =
    useState('');

  // 힌트 에러 콜백 등록
  useEffect(() => {
    if (setHintErrorCallback) {
      setHintErrorCallback((msg) => {
        error('힌트 오류', msg, 4000);
      });
    }
    return () => {
      if (setHintErrorCallback) {
        setHintErrorCallback(null);
      }
    };
  }, [setHintErrorCallback]);

  const providerPrice =
    PROVIDER_HINT_PRICES?.[hintDifficulty] ?? 0;

  const maxRounds = gameState.totalRounds
    || (gameState.isPracticeMode ? 4 : initialScenarios.length + 1);

  const roundOptions = useMemo(() => {
    // 실제 게임 라운드 표기 기준(1~)의 힌트 등록 라운드: 2 ~ maxRounds-1
    const start = 2;
    const end = Math.max(2, maxRounds - 1);
    const arr = [];
    for (let r = start; r <= end; r++) arr.push(r);
    return arr;
  }, [maxRounds]);

  // 힌트 로그만 필터링
  const hintLogs = transactionLogs.filter(
    (log) => log.type === 'HINT_PURCHASE'
  );

  const suggestedHints = useMemo(() => {
    const byProvider = PROVIDER_HINT_POOLS?.[registerProvider];
    const pool = byProvider?.[registerRound];
    return Array.isArray(pool) ? pool.join('\n') : '';
  }, [registerProvider, registerRound]);

  return (
    <div className="p-2 sm:p-4 pb-20 sm:pb-24 relative">

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
          onClick={() => setActiveTab('register')}
          className={`px-4 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all border-b-2 ${
            activeTab === 'register'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Gift className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-2" />
          힌트 등록
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
                <div className="mt-2 text-sm text-gray-600">
                  가격: <span className="font-bold text-gray-900">₩{providerPrice.toLocaleString('ko-KR')}</span>
                  <span className="ml-2 text-gray-500">
                    (힌트 내용이 비어있으면 현재 라운드의 등록 풀에서 랜덤 지급)
                  </span>
                </div>
              </div>

              {/* 힌트 내용 입력 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  힌트 내용 (선택)
                </label>
                <textarea
                  value={hintContent}
                  onChange={(e) =>
                    setHintContent(e.target.value)
                  }
                  placeholder="비워두면 현재 라운드에 등록된 힌트 중 랜덤으로 지급됩니다."
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
                  if (adminActions) {
                    adminActions.grantHint(
                      selectedPlayerId,
                      hintDifficulty,
                      providerPrice,
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
                      }에게 ${hintDifficulty}를 부여했습니다. (₩${providerPrice.toLocaleString(
                        'ko-KR'
                      )})`,
                      3000
                    );
                    setSelectedPlayerId('');
                    setHintDifficulty('이영훈 힌트');
                    setHintContent('');
                  }
                }}
                disabled={!selectedPlayerId}
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                선택 플레이어에게 부여
              </button>

              {/* 전체 플레이어 힌트 부여 버튼 */}
              <button
                onClick={() => {
                  if (playerList.length === 0) {
                    error('오류', '접속 중인 플레이어가 없습니다.', 3000);
                    return;
                  }
                  if (adminActions) {
                    adminActions.grantHintToAll(
                      hintDifficulty,
                      providerPrice,
                      hintContent || null
                    );
                    success(
                      '전체 힌트 부여',
                      `전체 플레이어(${playerList.length}명)에게 ${hintDifficulty}를 부여했습니다. (₩${providerPrice.toLocaleString('ko-KR')})`,
                      3000
                    );
                    setHintContent('');
                  }
                }}
                disabled={playerList.length === 0}
                className="w-full px-4 py-3 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2"
              >
                <Users className="w-5 h-5" />
                전체 플레이어에게 부여 ({playerList.length}명)
              </button>
            </div>
          </motion.div>
        )}

        {/* 힌트 등록 탭 */}
        {activeTab === 'register' && (
          <motion.div
            key="register"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="card-modern p-3 sm:p-4 mb-4 sm:mb-6"
          >
            <h2 className="text-lg sm:text-xl font-bold gradient-text mb-3 sm:mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5 sm:w-6 sm:h-6" />
              라운드별 힌트 풀 등록
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    라운드(표시)
                  </label>
                  <select
                    value={registerRound}
                    onChange={(e) =>
                      setRegisterRound(Number(e.target.value))
                    }
                    className="input-modern w-full"
                  >
                    {roundOptions.map((r) => (
                      <option key={r} value={r}>
                        라운드 {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    제공자(힌트 꾸러미)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      '이영훈 힌트',
                      '김민철 힌트',
                      '조은별 힌트',
                    ].map((p) => (
                      <button
                        key={p}
                        onClick={() => setRegisterProvider(p)}
                        className={`px-3 py-2 rounded-lg font-semibold text-xs sm:text-sm transition-all ${
                          registerProvider === p
                            ? p === '이영훈 힌트'
                              ? 'bg-blue-500 text-white shadow-md'
                              : p === '김민철 힌트'
                              ? 'bg-purple-500 text-white shadow-md'
                              : 'bg-pink-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 text-sm text-gray-600">
                    고정 가격: <span className="font-bold text-gray-900">₩{(PROVIDER_HINT_PRICES?.[registerProvider] ?? 0).toLocaleString('ko-KR')}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  힌트 목록 (줄바꿈으로 여러 개)
                </label>
                <textarea
                  value={registerHintsText}
                  onChange={(e) => setRegisterHintsText(e.target.value)}
                  placeholder={suggestedHints ? `기본값 예시:\n${suggestedHints}` : '힌트를 한 줄에 하나씩 입력하세요.'}
                  className="input-modern w-full min-h-[180px]"
                />
                {suggestedHints && !registerHintsText.trim() && (
                  <div className="mt-2 text-xs text-gray-500">
                    위 예시는 기본 제공 풀입니다. 그대로 등록하려면 아래 버튼을 눌러 자동 채우기 후 저장하세요.
                  </div>
                )}
                {suggestedHints && !registerHintsText.trim() && (
                  <button
                    onClick={() => setRegisterHintsText(suggestedHints)}
                    className="mt-2 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold"
                  >
                    기본 예시로 채우기
                  </button>
                )}
              </div>

              <button
                onClick={() => {
                  if (!adminActions?.saveProviderRoundHints) {
                    error('오류', '관리자 액션을 사용할 수 없습니다.', 3000);
                    return;
                  }
                  const hints = registerHintsText
                    .split('\n')
                    .map((h) => h.trim())
                    .filter((h) => h.length > 0);
                  if (hints.length === 0) {
                    error('오류', '힌트를 1개 이상 입력해주세요.', 3000);
                    return;
                  }
                  adminActions.saveProviderRoundHints(
                    registerRound,
                    registerProvider,
                    hints
                  );
                  success(
                    '저장 완료',
                    `라운드 ${registerRound} / ${registerProvider} 힌트 ${hints.length}개를 저장했습니다.`,
                    3000
                  );
                }}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2"
              >
                <Check className="w-5 h-5" />
                힌트 풀 저장하기
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
