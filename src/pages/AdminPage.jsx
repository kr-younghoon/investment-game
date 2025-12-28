import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, GraduationCap, Rocket, Cog, Users, Clock } from 'lucide-react';
import StockCard from '../components/StockCard';
import NewsModal from '../components/NewsModal';
import ScenarioEditor from '../components/ScenarioEditor';
import GameSettings from '../components/GameSettings';
import Toast from '../components/Toast';
import { useSocketSync } from '../hooks/useSocketSync';
import { useToast } from '../hooks/useToast';
import { STOCKS, initialScenarios } from '../data/initialScenarios';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function AdminPage() {
  const { gameState, connected, playerCount, playerList, gameSettings, adminActions } =
    useSocketSync(true);
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlayerList, setShowPlayerList] = useState(true);
  const [previousRound, setPreviousRound] = useState(-1);
  const [previousPracticeMode, setPreviousPracticeMode] = useState(false);
  const [scenarios, setScenarios] = useState(initialScenarios);
  const { toasts, removeToast, success, info } = useToast();

  // 라운드 변경 시 뉴스 모달 표시 및 토스트
  useEffect(() => {
    if (
      gameState.currentRound !== previousRound &&
      gameState.currentRound >= 0 &&
      gameState.isGameStarted
    ) {
      setShowNewsModal(true);
      const timer = setTimeout(() => setShowNewsModal(false), 3000);
      
      // 라운드 변경 토스트
      info(
        `라운드 ${gameState.currentRound + 1} 시작`,
        gameState.currentNews || '',
        4000
      );
      
      return () => clearTimeout(timer);
    }
    setPreviousRound(gameState.currentRound);
  }, [gameState.currentRound, previousRound, gameState.isGameStarted, gameState.currentNews, info]);

  // 연습 모드 전환 감지
  useEffect(() => {
    if (previousPracticeMode !== undefined && gameState.isPracticeMode !== previousPracticeMode) {
      if (gameState.isPracticeMode) {
        success('연습 모드 시작', '3라운드 연습 게임이 시작되었습니다.', 4000);
      } else if (previousPracticeMode) {
        success('실제 게임 시작', '연습 모드가 종료되고 실제 게임이 시작되었습니다.', 4000);
      }
    }
    setPreviousPracticeMode(gameState.isPracticeMode);
  }, [gameState.isPracticeMode, previousPracticeMode, success]);


  const currentScenario =
    scenarios[gameState.currentRound] || initialScenarios[0];
  const isFirstRound = gameState.currentRound === 0;
  // 연습 모드일 때는 3라운드까지만 진행
  const maxRounds = gameState.isPracticeMode ? 3 : scenarios.length;
  const isLastRound = gameState.currentRound >= maxRounds - 1;

  // 차트 데이터 준비
  const chartData = [];
  const chartMaxRounds = Math.max(
    ...STOCKS.map(
      (stock) => gameState.priceHistory[stock.id]?.length || 1
    )
  );

  for (let i = 0; i < chartMaxRounds; i++) {
    const dataPoint = { round: `${i + 1}` };
    STOCKS.forEach((stock) => {
      const price =
        gameState.priceHistory[stock.id]?.[i] || stock.basePrice;
      dataPoint[stock.name] = price;
    });
    chartData.push(dataPoint);
  }

  // 각 주식의 변동률 계산
  const getChangePercent = (stockId) => {
    if (gameState.currentRound === 0) return 0;
    const priceHistory = gameState.priceHistory[stockId] || [];
    if (priceHistory.length < 2) return 0;
    const prevPrice = priceHistory[gameState.currentRound - 1];
    const currentPrice = gameState.stockPrices[stockId] || prevPrice;
    if (!prevPrice || prevPrice === 0) return 0;
    return ((currentPrice - prevPrice) / prevPrice) * 100;
  };

  const handleUpdateScenario = (round, updates) => {
    setScenarios((prev) => {
      const newScenarios = [...prev];
      newScenarios[round] = { ...newScenarios[round], ...updates };
      return newScenarios;
    });
    if (adminActions) {
      adminActions.updateScenario(round, updates);
    }
  };

  const handleSaveGameSettings = (settings) => {
    if (adminActions) {
      adminActions.updateGameSettings(settings);
      // 라운드 수가 변경되면 시나리오 배열도 업데이트
      if (settings.totalRounds !== scenarios.length) {
        setScenarios((prev) => {
          if (settings.totalRounds > prev.length) {
            // 라운드 추가
            const lastScenario = prev[prev.length - 1];
            const newScenarios = [...prev];
            for (let i = prev.length; i < settings.totalRounds; i++) {
              newScenarios.push({
                ...lastScenario,
                round: i,
                headline: `라운드 ${i + 1} 뉴스`,
                volatility: { ...lastScenario.volatility },
              });
            }
            return newScenarios;
          } else {
            // 라운드 제거
            return prev.slice(0, settings.totalRounds);
          }
        });
      }
    }
  };

  return (
    <div className="min-h-screen p-2 sm:p-4 md:p-8 pb-20 sm:pb-24 relative">
      {/* 배경 효과 */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-50 -z-10"></div>
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.05),transparent_50%)] -z-10"></div>
      
      {/* 연결 상태 및 플레이어 수 */}
      <div className="fixed top-2 left-2 sm:top-4 sm:left-4 z-50 flex gap-2 sm:gap-3 flex-wrap">
        <div
          className={`px-2 py-1 sm:px-4 sm:py-2 rounded-full backdrop-blur-xl font-semibold border text-xs sm:text-sm ${
            connected
              ? 'bg-green-100 text-green-700 border-green-300'
              : 'bg-red-100 text-red-700 border-red-300'
          }`}
        >
          <div className="flex items-center gap-1 sm:gap-2">
            <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
            <span className="hidden sm:inline">{connected ? '연결됨' : '연결 안됨'}</span>
            <span className="sm:hidden">{connected ? '✓' : '✗'}</span>
          </div>
        </div>
        <div className="px-2 py-1 sm:px-4 sm:py-2 rounded-full backdrop-blur-xl font-semibold bg-blue-100 text-blue-700 border border-blue-300 text-xs sm:text-sm">
          <span className="hidden sm:inline">👥 {playerCount}명 접속</span>
          <span className="sm:hidden">👥 {playerCount}</span>
        </div>
        <button
          onClick={() => setShowPlayerList(!showPlayerList)}
          className="px-2 py-1 sm:px-4 sm:py-2 rounded-full backdrop-blur-xl font-semibold bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-300 transition-all text-xs sm:text-sm"
        >
          <span className="hidden sm:inline">{showPlayerList ? '👁️ 리스트 숨기기' : '👁️ 리스트 보기'}</span>
          <span className="sm:hidden">{showPlayerList ? '👁️ 숨기기' : '👁️ 보기'}</span>
        </button>
        {!gameState.isGameStarted && (
          <button
            onClick={() => setShowSettings(true)}
            className="px-2 py-1 sm:px-4 sm:py-2 rounded-full backdrop-blur-xl font-semibold bg-orange-100 hover:bg-orange-200 text-orange-700 border border-orange-300 transition-all flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
          >
            <Cog className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">게임 설정</span>
            <span className="sm:hidden">설정</span>
          </button>
        )}
        {!connected && (
          <div className="px-2 py-1 sm:px-4 sm:py-2 rounded-full backdrop-blur-xl font-semibold bg-yellow-100 text-yellow-700 border border-yellow-300 text-xs sm:text-sm">
            <span className="hidden sm:inline">⚠️ 서버 실행 필요</span>
            <span className="sm:hidden">⚠️</span>
          </div>
        )}
      </div>

      {/* 헤더 */}
      <div className="text-center mb-6 sm:mb-8 md:mb-10">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl sm:text-3xl md:text-5xl lg:text-7xl font-black mb-3 sm:mb-4 gradient-text"
        >
          2025 MZ 투자 생존
        </motion.h1>
        {gameState.isWaitingMode ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-blue-100 border-2 border-blue-400 shadow-lg"
          >
            <Clock className="w-8 h-8 text-blue-600" />
            <span className="text-2xl md:text-4xl font-bold text-blue-700">
              대기 모드
            </span>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 sm:gap-3 px-3 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-white backdrop-blur-xl border border-gray-200 shadow-lg"
        >
          <span className="text-base sm:text-xl md:text-2xl lg:text-4xl font-bold text-gray-900">
            {currentScenario?.month || ''} 라운드 {gameState.currentRound + 1} /{' '}
            {gameState.isPracticeMode ? 3 : scenarios.length}
          </span>
        </motion.div>
        )}
      </div>

      {/* 게임 모드 표시 */}
      {gameState.isGameStarted && (
        <div className="text-center mb-6">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-lg ${
              gameState.isPracticeMode
                ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-400'
                : 'bg-green-100 text-green-700 border-2 border-green-400'
            }`}
          >
            {gameState.isPracticeMode ? (
              <>
                <GraduationCap className="w-5 h-5" />
                연습 모드
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5" />
                실제 게임
              </>
            )}
          </motion.div>
        </div>
      )}

      {/* 대기 모드 화면 */}
      {gameState.isWaitingMode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto mb-6 sm:mb-8 md:mb-10 px-2 sm:px-4"
        >
          <div className="card-modern p-6 sm:p-8 md:p-12 text-center">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring" }}
              className="mb-6 sm:mb-8"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 mx-auto mb-4 sm:mb-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shadow-2xl">
                <Users className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 text-white" />
              </div>
            </motion.div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
              플레이어 대기 중
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 sm:mb-8">
              플레이어들이 접속할 때까지 기다려주세요
            </p>
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8 border border-blue-200">
              <div className="flex items-center justify-center gap-2 sm:gap-4 text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-blue-600" />
                <span>접속 플레이어: {playerCount}명</span>
              </div>
            </div>
            <div className="space-y-3 sm:space-y-4">
              <button
                onClick={() => adminActions?.startPractice()}
                className="btn-secondary w-full px-6 sm:px-8 md:px-10 py-3 sm:py-4 md:py-5 text-base sm:text-lg md:text-xl flex items-center justify-center gap-2 sm:gap-3 border-2 border-yellow-400 hover:border-yellow-500"
              >
                <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6" />
                연습 게임 시작
              </button>
              <button
                onClick={() => adminActions?.startGame()}
                className="btn-primary w-full px-6 sm:px-8 md:px-10 py-3 sm:py-4 md:py-5 text-base sm:text-lg md:text-xl flex items-center justify-center gap-2 sm:gap-3"
              >
                <Play className="w-5 h-5 sm:w-6 sm:h-6" />
                실제 게임 시작
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* 게임 제어 버튼 */}
      {!gameState.isWaitingMode && (
        <div className="flex justify-center gap-2 sm:gap-3 md:gap-4 mb-6 sm:mb-8 md:mb-10 flex-wrap px-2">
          {!gameState.isGameStarted ? (
            <>
              <button
                onClick={() => adminActions?.startPractice()}
                className="btn-secondary px-4 sm:px-6 md:px-10 py-3 sm:py-4 md:py-5 text-sm sm:text-base md:text-xl flex items-center gap-2 sm:gap-3 border-2 border-yellow-400 hover:border-yellow-500"
              >
                <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                <span className="hidden sm:inline">연습 게임 시작</span>
                <span className="sm:hidden">연습</span>
              </button>
              <button
                onClick={() => adminActions?.startGame()}
                className="btn-primary px-4 sm:px-6 md:px-10 py-3 sm:py-4 md:py-5 text-sm sm:text-base md:text-xl flex items-center gap-2 sm:gap-3"
              >
                <Play className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                <span className="hidden sm:inline">실제 게임 시작</span>
                <span className="sm:hidden">시작</span>
              </button>
            </>
          ) : (
            <>
              {gameState.isPracticeMode && (
                <button
                  onClick={() => adminActions?.startRealGame()}
                  className="btn-primary px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 text-xs sm:text-sm md:text-lg flex items-center gap-1 sm:gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  <Rocket className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">실제 게임으로 전환</span>
                  <span className="sm:hidden">전환</span>
                </button>
              )}
              <button
                onClick={() => adminActions?.previousRound()}
                disabled={isFirstRound}
                className={`px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 rounded-xl font-semibold text-xs sm:text-sm md:text-lg transition-all flex items-center gap-1 sm:gap-2 ${
                  isFirstRound
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'btn-secondary'
                }`}
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                <span className="hidden sm:inline">이전</span>
              </button>
              <button
                onClick={() => adminActions?.nextRound()}
                disabled={isLastRound}
                className={`px-4 sm:px-6 md:px-8 py-2 sm:py-3 md:py-4 rounded-xl font-semibold text-xs sm:text-sm md:text-lg transition-all flex items-center gap-1 sm:gap-2 ${
                  isLastRound
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'btn-primary'
                }`}
              >
                <span className="hidden sm:inline">다음</span>
                <span className="sm:hidden">다음</span>
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </button>
            </>
          )}
        </div>
      )}

      {/* 게임 화면 (대기 모드가 아닐 때만 표시) */}
      {!gameState.isWaitingMode && (
        <>

      {/* 주식 카드 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-6 mb-6 sm:mb-8 md:mb-10">
        {STOCKS.map((stock, index) => {
          const price = gameState.stockPrices[stock.id] || stock.basePrice;
          const changePercent = getChangePercent(stock.id);
          const priceHistory =
            gameState.priceHistory[stock.id]?.slice(
              0,
              gameState.currentRound + 1
            ) || [stock.basePrice];

          return (
            <motion.div
              key={stock.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <StockCard
                stock={stock}
                price={price}
                changePercent={changePercent}
                priceHistory={priceHistory}
              />
            </motion.div>
          );
        })}
      </div>

          {/* 차트 */}
          {gameState.isGameStarted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card-modern p-4 sm:p-6 md:p-8 mb-6 sm:mb-8 md:mb-10"
        >
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold gradient-text mb-4 sm:mb-6">
            가격 추이
          </h2>
          <ResponsiveContainer width="100%" height={250} className="sm:h-[300px] md:h-[400px]">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="round" stroke="#374151" />
              <YAxis stroke="#374151" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  color: '#111827',
                }}
              />
              <Legend />
              {STOCKS.map((stock, index) => {
                const colors = [
                  '#ef4444',
                  '#3b82f6',
                  '#fbbf24',
                  '#10b981',
                  '#a855f7',
                ];
                return (
                  <Line
                    key={stock.id}
                    type="monotone"
                    dataKey={stock.name}
                    stroke={colors[index % colors.length]}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      )}

          {/* 뉴스 모달 */}
          <NewsModal
            isOpen={showNewsModal}
            headline={gameState.currentNews || currentScenario?.headline || ''}
            onClose={() => setShowNewsModal(false)}
          />


          {/* 플레이어 리스트 */}
          {showPlayerList && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-modern p-3 sm:p-4 md:p-8 mb-6 sm:mb-8 md:mb-10"
        >
          <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold gradient-text mb-4 sm:mb-6">
            플레이어 리스트 ({playerList.length}명)
          </h2>
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <table className="w-full min-w-[700px] sm:min-w-0">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 sm:py-3 md:py-4 px-2 sm:px-4 text-gray-600 font-semibold text-xs sm:text-sm uppercase tracking-wider">닉네임</th>
                  <th className="text-right py-2 sm:py-3 md:py-4 px-2 sm:px-4 text-gray-600 font-semibold text-xs sm:text-sm uppercase tracking-wider">현금</th>
                  <th className="text-right py-2 sm:py-3 md:py-4 px-2 sm:px-4 text-gray-600 font-semibold text-xs sm:text-sm uppercase tracking-wider">보너스</th>
                  <th className="text-right py-2 sm:py-3 md:py-4 px-2 sm:px-4 text-gray-600 font-semibold text-xs sm:text-sm uppercase tracking-wider">총 자산</th>
                  <th className="text-right py-2 sm:py-3 md:py-4 px-2 sm:px-4 text-gray-600 font-semibold text-xs sm:text-sm uppercase tracking-wider">거래 횟수</th>
                  <th className="text-center py-2 sm:py-3 md:py-4 px-2 sm:px-4 text-gray-600 font-semibold text-xs sm:text-sm uppercase tracking-wider">포인트 추가</th>
                </tr>
              </thead>
              <tbody>
                {playerList
                  .sort((a, b) => b.totalAsset - a.totalAsset)
                  .map((player, index) => (
                    <tr
                      key={player.socketId}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        index === 0 ? 'bg-gradient-to-r from-yellow-50 to-transparent' : ''
                      }`}
                    >
                      <td className="py-4 px-4 font-semibold text-gray-900">
                        {index === 0 && <span className="text-yellow-600 mr-2">👑</span>}
                        {player.nickname}
                      </td>
                      <td className="py-4 px-4 text-right text-gray-700">
                        ₩{player.cash?.toLocaleString('ko-KR') || 0}
                      </td>
                      <td className="py-4 px-4 text-right text-green-600 font-semibold">
                        ₩{player.bonusPoints?.toLocaleString('ko-KR') || 0}
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-purple-600 text-lg">
                        ₩{player.totalAsset?.toLocaleString('ko-KR', {
                          maximumFractionDigits: 0,
                        }) || 0}
                      </td>
                      <td className="py-4 px-4 text-right text-gray-600">
                        {player.transactionCount || 0}회
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2 justify-center">
                          <input
                            type="number"
                            id={`points-${player.socketId}`}
                            placeholder="포인트"
                            min="0"
                            step="100"
                            className="input-modern w-28 text-sm"
                          />
                          <button
                            onClick={() => {
                              const input = document.getElementById(
                                `points-${player.socketId}`
                              );
                              if (input && input.value && adminActions) {
                                adminActions.addPoints(
                                  player.socketId,
                                  parseFloat(input.value)
                                );
                                input.value = '';
                              }
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-xl text-sm transition-all shadow-lg hover:shadow-xl active:scale-95"
                          >
                            추가
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

          {/* 시나리오 에디터 */}
          <ScenarioEditor
            scenarios={scenarios}
            currentRound={gameState.currentRound}
            onUpdateScenario={handleUpdateScenario}
            isOpen={showEditor}
            onToggle={() => setShowEditor(!showEditor)}
          />
        </>
      )}

      {/* 게임 설정 */}
      <GameSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveGameSettings}
        initialCash={gameSettings.initialCash}
        scenarios={scenarios}
      />

      {/* Toast 알림 */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

