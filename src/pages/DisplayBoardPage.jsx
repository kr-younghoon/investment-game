import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Trophy,
  Users,
  Clock,
  Newspaper,
  Activity,
  BarChart3,
  Minus,
} from 'lucide-react';
import { useSocketSync } from '../hooks/useSocketSync';
import {
  STOCKS,
  PRACTICE_STOCKS,
  initialScenarios,
  practiceScenarios,
} from '../data/initialScenarios';
import { playBuySound, playSellSound } from '../utils/sounds';

// 주식 가격 변동률 계산 헬퍼
function getPriceChange(priceHistory, stockId, currentRound) {
  if (!priceHistory || !priceHistory[stockId]) return { change: 0, percent: 0 };
  const history = priceHistory[stockId];
  if (!Array.isArray(history) || history.length < 2 || currentRound < 1) {
    return { change: 0, percent: 0 };
  }
  const prevIdx = Math.min(currentRound - 1, history.length - 1);
  const currIdx = Math.min(currentRound, history.length - 1);
  const prev = history[prevIdx];
  const curr = history[currIdx];
  if (!prev || prev === 0) return { change: 0, percent: 0 };
  return {
    change: curr - prev,
    percent: ((curr - prev) / prev) * 100,
  };
}

// 숫자 포맷팅 헬퍼
function formatKRW(value) {
  if (value === undefined || value === null) return '0';
  return Number(value).toLocaleString('ko-KR', { maximumFractionDigits: 0 });
}

export default function DisplayBoardPage() {
  const {
    gameState,
    connected,
    rankList,
    playerCount,
    displayMessage,
    transactionLogs,
  } = useSocketSync(false, true);

  const [currentTime, setCurrentTime] = useState(new Date());
  const prevTransactionCountRef = useRef(0);
  const isTransactionInitRef = useRef(false);
  const [flashingStocks, setFlashingStocks] = useState({});

  // 활성 주식 목록 (커스텀 주식 지원)
  const activeStocks = useMemo(() => {
    if (gameState.customStocks && gameState.customStocks.length > 0) {
      return gameState.customStocks;
    }
    return gameState.isPracticeMode ? PRACTICE_STOCKS : STOCKS;
  }, [gameState.customStocks, gameState.isPracticeMode]);

  // 시나리오 목록 (총 라운드 수 계산용)
  const scenarios = useMemo(() => {
    return gameState.isPracticeMode ? practiceScenarios : initialScenarios;
  }, [gameState.isPracticeMode]);

  // 현재 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 거래 로그 신규 수신 시 사운드 재생
  useEffect(() => {
    if (!Array.isArray(transactionLogs)) return;

    if (!isTransactionInitRef.current) {
      isTransactionInitRef.current = true;
      prevTransactionCountRef.current = transactionLogs.length;
      return;
    }

    if (transactionLogs.length <= prevTransactionCountRef.current) {
      prevTransactionCountRef.current = transactionLogs.length;
      return;
    }

    const latest = transactionLogs[transactionLogs.length - 1];
    if (latest?.type === 'BUY') playBuySound();
    if (latest?.type === 'SELL') playSellSound();

    prevTransactionCountRef.current = transactionLogs.length;
  }, [transactionLogs]);

  // 주식 가격 변동 시 플래시 효과
  useEffect(() => {
    if (!gameState.stockPrices) return;
    const newFlashing = {};
    activeStocks.forEach((stock) => {
      const { change } = getPriceChange(
        gameState.priceHistory,
        stock.id,
        gameState.currentRound
      );
      if (change !== 0) {
        newFlashing[stock.id] = change > 0 ? 'up' : 'down';
      }
    });
    setFlashingStocks(newFlashing);
    const timeout = setTimeout(() => setFlashingStocks({}), 2000);
    return () => clearTimeout(timeout);
  }, [gameState.currentRound, gameState.stockPrices, activeStocks]);

  // 중복 제거된 순위 리스트
  const uniqueRankList = useMemo(() => {
    const nicknameMap = new Map();
    rankList.forEach((player) => {
      if (!nicknameMap.has(player.nickname)) {
        nicknameMap.set(player.nickname, player);
      } else {
        const existing = nicknameMap.get(player.nickname);
        if (player.totalAsset > existing.totalAsset) {
          nicknameMap.set(player.nickname, player);
        }
      }
    });
    const unique = Array.from(nicknameMap.values());
    unique.sort((a, b) => b.totalAsset - a.totalAsset);
    unique.forEach((player, index) => {
      player.rank = index + 1;
    });
    return unique;
  }, [rankList]);

  // 평균 자산 계산
  const averageAsset =
    uniqueRankList.length > 0
      ? uniqueRankList.reduce((sum, p) => sum + p.totalAsset, 0) /
        uniqueRankList.length
      : 0;

  // 현재 뉴스 (gameState에서 가져오기 - 커스텀 시나리오 지원)
  const currentNews = gameState.currentNews || null;
  const currentNewsBriefing = gameState.currentNewsBriefing || [];

  // 현재 주가
  const currentPrices = gameState.stockPrices || {};

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white relative overflow-hidden">
      {/* 배경 그라디언트 오브 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute -bottom-20 left-1/3 w-72 h-72 bg-pink-600/8 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '4s' }} />
      </div>

      {/* 전광판 메시지 오버레이 */}
      <AnimatePresence>
        {displayMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 30 }}
              transition={{ duration: 0.5, type: 'spring', bounce: 0.3 }}
              className="bg-gradient-to-br from-purple-600 via-pink-600 to-purple-700 rounded-3xl p-8 sm:p-12 md:p-16 lg:p-20 max-w-5xl mx-4 shadow-2xl border-2 border-white/20"
            >
              <div className="text-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black mb-6 sm:mb-8 text-white leading-tight break-words"
                >
                  {displayMessage.message}
                </motion.div>
                {displayMessage.adminId && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="text-lg sm:text-xl md:text-2xl text-white/70 mt-4 sm:mt-6"
                  >
                    - {displayMessage.adminId} -
                  </motion.div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative z-10 p-4 sm:p-6 md:p-8 max-w-[1920px] mx-auto">
        {/* 상단 헤더 */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black mb-1 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                STOCK GAME
              </h1>
              <div className="flex items-center gap-3 text-lg sm:text-xl md:text-2xl">
                <motion.span
                  key={gameState.currentRound}
                  initial={{ scale: 1.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  className="font-bold text-white/80"
                >
                  ROUND {gameState.currentRound + 1} / {scenarios.length + 1}
                </motion.span>
                {gameState.isPracticeMode && (
                  <span className="px-3 py-0.5 bg-yellow-500/20 text-yellow-300 rounded-lg font-semibold text-sm border border-yellow-500/30">
                    PRACTICE
                  </span>
                )}
                <span className="text-white/40 text-sm">
                  {playerCount}명 접속
                </span>
              </div>
            </div>

            {/* 카운트다운 */}
            {gameState.countdown !== null && gameState.countdown !== undefined && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="px-6 py-4 rounded-2xl font-black text-4xl sm:text-5xl md:text-6xl lg:text-7xl bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-2xl shadow-purple-500/30"
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-8 h-8 sm:w-10 sm:h-10 md:w-14 md:h-14" />
                  <span>{gameState.countdown}</span>
                </div>
              </motion.div>
            )}

            {/* 라운드 타이머 */}
            {gameState.isGameStarted &&
              !gameState.isWaitingMode &&
              gameState.roundTimer !== null &&
              gameState.countdown === null && (
                <motion.div
                  animate={{
                    scale: gameState.roundTimer <= 60 ? [1, 1.05, 1] : 1,
                  }}
                  transition={{
                    duration: 1,
                    repeat: gameState.roundTimer <= 60 ? Infinity : 0,
                    ease: 'easeInOut',
                  }}
                  className={`px-6 py-4 rounded-2xl font-black text-3xl sm:text-4xl md:text-5xl lg:text-6xl shadow-xl ${
                    gameState.roundTimer <= 60
                      ? 'bg-gradient-to-r from-red-600 to-red-500 text-white shadow-red-500/30'
                      : gameState.roundTimer <= 300
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-900 shadow-amber-500/30'
                      : 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-blue-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12" />
                    <span>
                      {Math.floor(gameState.roundTimer / 60)}:
                      {(gameState.roundTimer % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                </motion.div>
              )}
          </div>
        </div>

        {/* 실시간 주가 티커 */}
        <div className="mb-4 sm:mb-6">
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-5 h-5 text-blue-400" />
              <span className="text-sm font-bold text-white/70 uppercase tracking-wider">
                Live Market
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent ml-2" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
              {activeStocks.map((stock) => {
                const price = currentPrices[stock.id] || stock.basePrice;
                const { change, percent } = getPriceChange(
                  gameState.priceHistory,
                  stock.id,
                  gameState.currentRound
                );
                const isUp = change > 0;
                const isDown = change < 0;
                const isFlashing = flashingStocks[stock.id];

                return (
                  <motion.div
                    key={stock.id}
                    layout
                    animate={
                      isFlashing
                        ? {
                            backgroundColor:
                              isFlashing === 'up'
                                ? ['rgba(239,68,68,0.15)', 'rgba(239,68,68,0)', 'rgba(239,68,68,0.15)', 'rgba(239,68,68,0)']
                                : ['rgba(59,130,246,0.15)', 'rgba(59,130,246,0)', 'rgba(59,130,246,0.15)', 'rgba(59,130,246,0)'],
                          }
                        : {}
                    }
                    transition={{ duration: 1.5 }}
                    className={`rounded-xl p-2 sm:p-3 border transition-colors ${
                      isUp
                        ? 'bg-red-500/5 border-red-500/20'
                        : isDown
                        ? 'bg-blue-500/5 border-blue-500/20'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div className="text-xs sm:text-sm font-bold text-white/90 truncate mb-1">
                      {stock.name}
                    </div>
                    <div className="text-base sm:text-lg md:text-xl font-black text-white">
                      {formatKRW(price)}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {isUp ? (
                        <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />
                      ) : isDown ? (
                        <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-blue-400" />
                      ) : (
                        <Minus className="w-3 h-3 sm:w-4 sm:h-4 text-gray-400" />
                      )}
                      <span
                        className={`text-xs sm:text-sm font-bold ${
                          isUp
                            ? 'text-red-400'
                            : isDown
                            ? 'text-blue-400'
                            : 'text-gray-400'
                        }`}
                      >
                        {isUp ? '+' : ''}
                        {percent.toFixed(1)}%
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 메인 컨텐츠 그리드 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          {/* 좌측: 실시간 거래 로그 */}
          <div className="lg:col-span-4">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10 h-full">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                <h2 className="text-xl sm:text-2xl font-bold">실시간 거래</h2>
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-green-400/80">LIVE</span>
                </div>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
                <AnimatePresence initial={false}>
                  {(transactionLogs || [])
                    .slice(-20)
                    .reverse()
                    .map((t, idx) => {
                      const isBuy = t?.type === 'BUY';
                      const isSell = t?.type === 'SELL';
                      const nickname = t?.nickname || '';
                      const stockName = t?.stockName || t?.stockId || '';
                      const quantity =
                        t?.quantity !== null && t?.quantity !== undefined
                          ? `${t.quantity}주`
                          : '';
                      const price =
                        t?.price !== null && t?.price !== undefined
                          ? `${formatKRW(t.price)}`
                          : '';
                      const time = t?.timestamp
                        ? new Date(t.timestamp).toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
                        : '';

                      return (
                        <motion.div
                          key={`${t?.timestamp || 't'}-${idx}`}
                          initial={{ opacity: 0, x: -20, height: 0 }}
                          animate={{ opacity: 1, x: 0, height: 'auto' }}
                          transition={{ duration: 0.3 }}
                          className={`rounded-xl p-2.5 sm:p-3 border ${
                            isBuy
                              ? 'bg-red-500/8 border-red-500/20'
                              : isSell
                              ? 'bg-blue-500/8 border-blue-500/20'
                              : 'bg-white/5 border-white/10'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`px-2 py-0.5 rounded-md text-xs font-black ${
                                  isBuy
                                    ? 'bg-red-500/20 text-red-300'
                                    : isSell
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : 'bg-white/10 text-gray-300'
                                }`}
                              >
                                {isBuy ? 'BUY' : isSell ? 'SELL' : t?.type || '-'}
                              </span>
                              <span className="text-sm font-bold truncate text-white/90">
                                {nickname}
                              </span>
                            </div>
                            <span className="text-xs text-white/40 whitespace-nowrap">
                              {time}
                            </span>
                          </div>
                          <div className="text-sm text-white/70">
                            <span className="font-semibold text-white/90">{stockName}</span>{' '}
                            {quantity} @ {price}
                          </div>
                        </motion.div>
                      );
                    })}
                </AnimatePresence>

                {(transactionLogs || []).length === 0 && (
                  <div className="text-center py-12 text-white/30 text-base">
                    거래 대기 중...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 중앙: 순위표 */}
          <div className="lg:col-span-4">
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10 h-full">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
                <h2 className="text-xl sm:text-2xl font-bold">순위</h2>
                <span className="ml-auto text-sm text-white/40">
                  TOP {Math.min(uniqueRankList.length, 10)}
                </span>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 scrollbar-thin">
                {uniqueRankList.length > 0 ? (
                  uniqueRankList.slice(0, 10).map((player, index) => {
                    const isTop3 = player.rank <= 3;
                    const medalColors = {
                      1: 'from-yellow-400 to-amber-500',
                      2: 'from-gray-300 to-gray-400',
                      3: 'from-orange-400 to-amber-600',
                    };
                    const borderColors = {
                      1: 'border-yellow-500/50',
                      2: 'border-gray-400/40',
                      3: 'border-orange-500/40',
                    };

                    return (
                      <motion.div
                        key={`${player.nickname}-${player.rank}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.04 }}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                          isTop3
                            ? `bg-gradient-to-r ${
                                player.rank === 1
                                  ? 'from-yellow-500/10 to-amber-500/5'
                                  : player.rank === 2
                                  ? 'from-gray-400/10 to-gray-300/5'
                                  : 'from-orange-500/10 to-amber-500/5'
                              } ${borderColors[player.rank]}`
                            : 'bg-white/3 border-white/8 hover:bg-white/5'
                        }`}
                      >
                        {/* 순위 배지 */}
                        <div
                          className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full font-black text-lg sm:text-xl ${
                            isTop3
                              ? `bg-gradient-to-br ${medalColors[player.rank]} text-white shadow-lg`
                              : 'bg-white/10 text-white/60'
                          }`}
                        >
                          {player.rank}
                        </div>

                        {/* 플레이어 정보 */}
                        <div className="flex-1 min-w-0">
                          <div className="text-base sm:text-lg font-bold truncate">
                            {player.nickname}
                          </div>
                          <div className="text-sm text-white/50">
                            {formatKRW(player.totalAsset)}원
                          </div>
                        </div>

                        {/* 자산 변동 인디케이터 */}
                        {player.totalAsset > averageAsset ? (
                          <TrendingUp className="w-4 h-4 text-red-400 flex-shrink-0" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        )}
                      </motion.div>
                    );
                  })
                ) : (
                  <div className="text-center py-12 text-white/30 text-base">
                    참가자 대기 중...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 우측: 뉴스 + 통계 */}
          <div className="lg:col-span-4 space-y-4 sm:space-y-6">
            {/* 뉴스 */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <Newspaper className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                <h2 className="text-xl sm:text-2xl font-bold">뉴스</h2>
              </div>
              {currentNews ? (
                <motion.div
                  key={gameState.currentRound}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className="mb-3 px-3 py-1 bg-purple-500/15 text-purple-300 rounded-lg inline-block text-sm font-semibold border border-purple-500/20">
                    R{gameState.currentRound + 1}
                  </div>
                  <p className="text-base sm:text-lg md:text-xl font-bold leading-relaxed mb-3 text-white/90">
                    {currentNews}
                  </p>

                  {/* 뉴스 브리핑 아이템 */}
                  {currentNewsBriefing && currentNewsBriefing.length > 0 && (
                    <div className="space-y-2 mt-3 pt-3 border-t border-white/10">
                      {currentNewsBriefing.map((item, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + idx * 0.1, duration: 0.3 }}
                          className="flex gap-2 items-start"
                        >
                          <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-white/10 text-white/60 whitespace-nowrap mt-0.5">
                            {item.category}
                          </span>
                          <span className="text-sm text-white/70 leading-relaxed">
                            {item.content}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              ) : (
                <div className="text-white/30 text-base">
                  {gameState.isGameStarted
                    ? '다음 라운드 뉴스를 기다리는 중...'
                    : '게임이 시작되면 뉴스가 표시됩니다'}
                </div>
              )}
            </div>

            {/* 통계 */}
            <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-4 sm:p-5 border border-white/10">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
                <h2 className="text-xl sm:text-2xl font-bold">통계</h2>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-sm sm:text-base text-white/50">참가자</span>
                  <span className="text-lg sm:text-xl font-bold">{playerCount}명</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-sm sm:text-base text-white/50">평균 자산</span>
                  <span className="text-lg sm:text-xl font-bold">
                    {formatKRW(averageAsset)}원
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-sm sm:text-base text-white/50">거래 건수</span>
                  <span className="text-lg sm:text-xl font-bold">
                    {(transactionLogs || []).length}건
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-sm sm:text-base text-white/50">현재 시간</span>
                  <span className="text-base sm:text-lg font-bold text-white/70">
                    {currentTime.toLocaleTimeString('ko-KR')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 연결 상태 표시 */}
      <div className="fixed bottom-3 right-3 z-20">
        <div
          className={`px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-xl ${
            connected
              ? 'bg-green-500/15 text-green-400 border border-green-500/20'
              : 'bg-red-500/15 text-red-400 border border-red-500/20'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
              }`}
            />
            {connected ? 'LIVE' : 'OFFLINE'}
          </div>
        </div>
      </div>
    </div>
  );
}
