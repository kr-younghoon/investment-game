import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Trophy,
  Users,
  Clock,
  Newspaper,
  X,
} from 'lucide-react';
import { useSocketSync } from '../hooks/useSocketSync';
import {
  STOCKS,
  initialScenarios,
} from '../data/initialScenarios';

export default function DisplayBoardPage() {
  const {
    gameState,
    connected,
    rankList,
    playerCount,
    displayMessage,
  } = useSocketSync(false);
  const [currentTime, setCurrentTime] = useState(
    new Date()
  );
  const stockScrollRef = useRef(null);
  const scrollIntervalRef = useRef(null);
  const prevRoundRef = useRef(gameState.currentRound);

  // 현재 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 실시간 시세 자동 스크롤
  useEffect(() => {
    const scrollContainer = stockScrollRef.current;
    if (!scrollContainer) return;

    // 스크롤 가능한 높이 확인
    const isScrollable =
      scrollContainer.scrollHeight >
      scrollContainer.clientHeight;

    if (!isScrollable) {
      // 스크롤이 필요 없으면 정리
      if (scrollIntervalRef.current) {
        cancelAnimationFrame(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
      return;
    }

    // 자동 스크롤 시작
    const startAutoScroll = () => {
      if (scrollIntervalRef.current) {
        cancelAnimationFrame(scrollIntervalRef.current);
      }

      let scrollPosition = 0;
      const scrollSpeed = 0.2; // 스크롤 속도 (픽셀/프레임) - 천천히

      const animateScroll = () => {
        if (!scrollContainer) return;

        const maxScroll =
          scrollContainer.scrollHeight -
          scrollContainer.clientHeight;

        // 스크롤 진행 (부드럽게)
        scrollPosition += scrollSpeed;
        scrollContainer.scrollTop = scrollPosition;

        // 끝에 도달하면 즉시 위로 리셋하고 계속 (무한 루프)
        if (scrollPosition >= maxScroll) {
          scrollPosition = 0;
          scrollContainer.scrollTop = 0;
        }

        scrollIntervalRef.current =
          requestAnimationFrame(animateScroll);
      };

      scrollIntervalRef.current =
        requestAnimationFrame(animateScroll);
    };

    startAutoScroll();

    return () => {
      if (scrollIntervalRef.current) {
        cancelAnimationFrame(scrollIntervalRef.current);
        scrollIntervalRef.current = null;
      }
    };
  }, [STOCKS.length, gameState.currentRound]); // 주식 개수나 라운드가 변경되면 재시작

  // 라운드 전환 감지 및 애니메이션
  useEffect(() => {
    if (
      prevRoundRef.current !== gameState.currentRound &&
      gameState.currentRound > prevRoundRef.current
    ) {
      // 라운드가 증가했을 때만 애니메이션 (다음 라운드로 전환)
      console.log(
        `라운드 전환: ${prevRoundRef.current + 1} -> ${
          gameState.currentRound + 1
        }`
      );
    }
    prevRoundRef.current = gameState.currentRound;
  }, [gameState.currentRound]);

  // 중복 제거된 순위 리스트 (닉네임 기준)
  const uniqueRankList = React.useMemo(() => {
    const nicknameMap = new Map();
    rankList.forEach((player) => {
      if (!nicknameMap.has(player.nickname)) {
        nicknameMap.set(player.nickname, player);
      } else {
        // 이미 있으면 총 자산이 더 큰 것을 선택
        const existing = nicknameMap.get(player.nickname);
        if (player.totalAsset > existing.totalAsset) {
          nicknameMap.set(player.nickname, player);
        }
      }
    });
    const unique = Array.from(nicknameMap.values());
    // 총 자산 기준으로 다시 정렬하고 순위 재계산
    unique.sort((a, b) => b.totalAsset - a.totalAsset);
    unique.forEach((player, index) => {
      player.rank = index + 1;
    });
    return unique;
  }, [rankList]);

  // 평균 자산 계산
  const averageAsset =
    uniqueRankList.length > 0
      ? uniqueRankList.reduce(
          (sum, player) => sum + player.totalAsset,
          0
        ) / uniqueRankList.length
      : 0;

  // 현재 뉴스 가져오기 (0라운드에서는 뉴스를 표시하지 않음)
  const currentNews =
    gameState.currentRound > 0 &&
    gameState.currentRound < initialScenarios.length
      ? initialScenarios[gameState.currentRound]
      : null;

  // 전광판 메시지 디버깅
  useEffect(() => {
    if (displayMessage) {
      console.log(
        '[DisplayBoard] 전광판 메시지 수신:',
        displayMessage
      );
    }
  }, [displayMessage]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 sm:p-6 md:p-8 relative">
      {/* 전광판 메시지 오버레이 */}
      {displayMessage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-gradient-to-br from-purple-600 via-pink-600 to-purple-700 rounded-3xl p-8 sm:p-12 md:p-16 lg:p-20 max-w-5xl mx-4 shadow-2xl border-4 border-white/30"
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
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="text-lg sm:text-xl md:text-2xl text-white/90 mt-4 sm:mt-6"
              >
                - {displayMessage.adminId} 관리자
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* 상단 헤더 */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              2025 흔적 주식게임 📈
            </h1>
            <div className="flex items-center gap-4 text-xl sm:text-2xl md:text-3xl">
              <motion.span
                key={gameState.currentRound}
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="font-bold"
              >
                라운드 {gameState.currentRound + 1} /{' '}
                {gameState.isPracticeMode
                  ? 4
                  : initialScenarios.length + 1}
              </motion.span>
              {gameState.isPracticeMode && (
                <span className="px-4 py-1 bg-yellow-500 text-yellow-900 rounded-lg font-semibold text-lg">
                  연습 모드
                </span>
              )}
            </div>
          </div>

          {/* 라운드 전환 카운트다운 */}
          {gameState.countdown !== null &&
            gameState.countdown !== undefined && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="px-8 py-6 rounded-2xl font-black text-4xl sm:text-5xl md:text-6xl lg:text-7xl bg-purple-600 text-white shadow-2xl"
              >
                <div className="flex items-center gap-4">
                  <Clock className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16" />
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
                  scale:
                    gameState.roundTimer <= 60
                      ? [1, 1.05, 1]
                      : 1,
                }}
                transition={{
                  duration: 1,
                  repeat:
                    gameState.roundTimer <= 60
                      ? Infinity
                      : 0,
                  ease: 'easeInOut',
                }}
                className={`px-6 py-4 rounded-2xl font-black text-3xl sm:text-4xl md:text-5xl lg:text-6xl ${
                  gameState.roundTimer <= 60
                    ? 'bg-red-500 text-white'
                    : gameState.roundTimer <= 300
                    ? 'bg-yellow-500 text-yellow-900'
                    : 'bg-blue-500 text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12" />
                  <span>
                    {Math.floor(gameState.roundTimer / 60)}:
                    {(gameState.roundTimer % 60)
                      .toString()
                      .padStart(2, '0')}
                  </span>
                </div>
              </motion.div>
            )}
        </div>
      </div>

      {/* 메인 컨텐츠 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
        {/* 좌측: 실시간 주식 시세 */}
        <div className="lg:col-span-1">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-white/20">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8" />
              실시간 시세
            </h2>
            <div
              ref={stockScrollRef}
              className="space-y-3 sm:space-y-4 max-h-[600px] overflow-y-auto scroll-smooth"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor:
                  'rgba(255, 255, 255, 0.2) transparent',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {STOCKS.map((stock, index) => {
                // 현재 라운드의 주식 가격 가져오기
                // priceHistory 또는 stockPrices 사용 (서버에서 priceHistory로 전송)
                const priceHistory =
                  gameState.priceHistory?.[stock.id] ||
                  gameState.stockPrices?.[stock.id];
                const price =
                  priceHistory &&
                  Array.isArray(priceHistory) &&
                  priceHistory.length >
                    gameState.currentRound
                    ? priceHistory[gameState.currentRound]
                    : priceHistory &&
                      Array.isArray(priceHistory) &&
                      priceHistory.length > 0
                    ? priceHistory[priceHistory.length - 1]
                    : typeof priceHistory === 'number'
                    ? priceHistory
                    : stock.basePrice;

                // 이전 라운드 가격 (변동률 계산용)
                const prevPrice =
                  priceHistory &&
                  Array.isArray(priceHistory) &&
                  priceHistory.length >
                    gameState.currentRound - 1 &&
                  gameState.currentRound > 0
                    ? priceHistory[
                        gameState.currentRound - 1
                      ]
                    : stock.basePrice;

                const changePercent =
                  gameState.currentRound > 0
                    ? ((price - prevPrice) / prevPrice) *
                      100
                    : 0;
                const isPositive = changePercent >= 0;

                return (
                  <motion.div
                    key={`${stock.id}-${gameState.currentRound}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      duration: 0.3,
                      delay: index * 0.05,
                    }}
                    className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg sm:text-xl md:text-2xl font-bold">
                        {stock.name}
                      </h3>
                      {isPositive ? (
                        <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
                      ) : (
                        <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                      )}
                    </div>
                    <div className="flex items-end justify-between">
                      <div
                        className={`text-2xl sm:text-3xl md:text-4xl font-black ${
                          isPositive
                            ? 'text-red-400'
                            : 'text-blue-400'
                        }`}
                      >
                        ₩
                        {price % 1 === 0
                          ? price.toLocaleString('ko-KR')
                          : price
                              .toFixed(2)
                              .replace(/\.0+$/, '')}
                      </div>
                      <div
                        className={`px-3 py-1 rounded-lg text-sm sm:text-base font-bold ${
                          isPositive
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {changePercent % 1 === 0
                          ? changePercent.toLocaleString(
                              'ko-KR'
                            )
                          : changePercent
                              .toFixed(2)
                              .replace(/\.0+$/, '')}
                        %
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 중앙: 순위표 */}
        <div className="lg:col-span-1">
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-white/20">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
              <Trophy className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400" />
              순위
            </h2>
            <div className="space-y-2 sm:space-y-3 max-h-[600px] overflow-y-auto">
              {uniqueRankList.length > 0 ? (
                uniqueRankList
                  .slice(0, 10)
                  .map((player, index) => (
                    <motion.div
                      key={`${player.nickname}-${player.rank}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl ${
                        player.rank <= 3
                          ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/50'
                          : 'bg-white/5 border border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/10 font-black text-xl sm:text-2xl md:text-3xl">
                        {player.rank <= 3 ? (
                          <Trophy
                            className={`w-8 h-8 sm:w-10 sm:h-10 ${
                              player.rank === 1
                                ? 'text-yellow-400'
                                : player.rank === 2
                                ? 'text-gray-300'
                                : 'text-orange-400'
                            }`}
                          />
                        ) : (
                          <span>{player.rank}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="text-lg sm:text-xl md:text-2xl font-bold mb-1">
                          {player.nickname}
                        </div>
                        <div className="text-sm sm:text-base md:text-lg text-gray-300">
                          ₩
                          {player.totalAsset.toLocaleString(
                            'ko-KR',
                            { maximumFractionDigits: 0 }
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
              ) : (
                <div className="text-center py-12 text-gray-400 text-lg">
                  아직 순위 정보가 없습니다
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 우측: 뉴스 및 통계 */}
        <div className="lg:col-span-1 space-y-4 sm:space-y-6">
          {/* 현재 뉴스 */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-white/20">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
              <Newspaper className="w-6 h-6 sm:w-8 sm:h-8" />
              현재 뉴스
            </h2>
            {currentNews ? (
              <motion.div
                key={gameState.currentRound}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="mb-3 px-3 py-1 bg-purple-500/20 text-purple-300 rounded-lg inline-block text-sm sm:text-base font-semibold">
                  라운드 {gameState.currentRound + 1} (
                  {currentNews.month})
                </div>
                <p className="text-lg sm:text-xl md:text-2xl font-semibold leading-relaxed">
                  {currentNews.headline}
                </p>
              </motion.div>
            ) : (
              <div className="text-gray-400 text-lg">
                게임이 시작되면 뉴스가 표시됩니다
              </div>
            )}
          </div>

          {/* 통계 정보 */}
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-white/20">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
              <Users className="w-6 h-6 sm:w-8 sm:h-8" />
              통계
            </h2>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <span className="text-lg sm:text-xl text-gray-300">
                  참가자 수
                </span>
                <span className="text-2xl sm:text-3xl font-bold">
                  {playerCount}명
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <span className="text-lg sm:text-xl text-gray-300">
                  평균 자산
                </span>
                <span className="text-2xl sm:text-3xl font-bold">
                  ₩
                  {averageAsset.toLocaleString('ko-KR', {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <span className="text-lg sm:text-xl text-gray-300">
                  현재 시간
                </span>
                <span className="text-xl sm:text-2xl font-bold">
                  {currentTime.toLocaleTimeString('ko-KR')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 연결 상태 표시 */}
      <div className="fixed bottom-4 right-4">
        <div
          className={`px-4 py-2 rounded-full text-sm font-semibold backdrop-blur-xl ${
            connected
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                connected
                  ? 'bg-green-400 animate-pulse'
                  : 'bg-red-400'
              }`}
            ></div>
            {connected ? '연결됨' : '연결 안됨'}
          </div>
        </div>
      </div>
    </div>
  );
}
