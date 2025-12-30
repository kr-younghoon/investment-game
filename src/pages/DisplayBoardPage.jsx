import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Trophy, Users, Clock, Newspaper } from 'lucide-react';
import { useSocketSync } from '../hooks/useSocketSync';
import { STOCKS, initialScenarios } from '../data/initialScenarios';

export default function DisplayBoardPage() {
  const { gameState, connected, rankList, playerCount } = useSocketSync(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // 현재 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 평균 자산 계산
  const averageAsset = rankList.length > 0
    ? rankList.reduce((sum, player) => sum + player.totalAsset, 0) / rankList.length
    : 0;

  // 현재 뉴스 가져오기
  const currentNews = gameState.currentRound >= 0 && gameState.currentRound < initialScenarios.length
    ? initialScenarios[gameState.currentRound]
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-4 sm:p-6 md:p-8">
      {/* 상단 헤더 */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              2025 흔적 주식게임 📈
            </h1>
            <div className="flex items-center gap-4 text-xl sm:text-2xl md:text-3xl">
              <span className="font-bold">
                라운드 {gameState.currentRound + 1} / {initialScenarios.length}
              </span>
              {gameState.isPracticeMode && (
                <span className="px-4 py-1 bg-yellow-500 text-yellow-900 rounded-lg font-semibold text-lg">
                  연습 모드
                </span>
              )}
            </div>
          </div>
          
          {/* 라운드 타이머 */}
          {gameState.isGameStarted && !gameState.isWaitingMode && gameState.roundTimer !== null && (
            <motion.div
              animate={{
                scale: gameState.roundTimer <= 60 ? [1, 1.05, 1] : 1,
              }}
              transition={{
                duration: 1,
                repeat: gameState.roundTimer <= 60 ? Infinity : 0,
                ease: "easeInOut"
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
                  {Math.floor(gameState.roundTimer / 60)}:{(gameState.roundTimer % 60).toString().padStart(2, '0')}
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
            <div className="space-y-3 sm:space-y-4">
              {STOCKS.map((stock, index) => {
                const price = gameState.stockPrices[stock.id] || stock.basePrice;
                const changePercent =
                  gameState.currentRound > 0
                    ? ((price - stock.basePrice) / stock.basePrice) * 100
                    : 0;
                const isPositive = changePercent >= 0;

                return (
                  <motion.div
                    key={stock.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white/5 rounded-xl p-3 sm:p-4 border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg sm:text-xl md:text-2xl font-bold">{stock.name}</h3>
                      {isPositive ? (
                        <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
                      ) : (
                        <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                      )}
                    </div>
                    <div className="flex items-end justify-between">
                      <div className={`text-2xl sm:text-3xl md:text-4xl font-black ${
                        isPositive ? 'text-red-400' : 'text-blue-400'
                      }`}>
                        ₩{price.toFixed(2)}
                      </div>
                      <div className={`px-3 py-1 rounded-lg text-sm sm:text-base font-bold ${
                        isPositive
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      }`}>
                        {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
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
              {rankList.length > 0 ? (
                rankList.slice(0, 10).map((player, index) => (
                  <motion.div
                    key={player.rank}
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
                        <Trophy className={`w-8 h-8 sm:w-10 sm:h-10 ${
                          player.rank === 1 ? 'text-yellow-400' :
                          player.rank === 2 ? 'text-gray-300' :
                          'text-orange-400'
                        }`} />
                      ) : (
                        <span>{player.rank}</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-lg sm:text-xl md:text-2xl font-bold mb-1">
                        {player.nickname}
                      </div>
                      <div className="text-sm sm:text-base md:text-lg text-gray-300">
                        ₩{player.totalAsset.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
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
              <div>
                <div className="mb-3 px-3 py-1 bg-purple-500/20 text-purple-300 rounded-lg inline-block text-sm sm:text-base font-semibold">
                  라운드 {gameState.currentRound + 1} ({currentNews.month})
                </div>
                <p className="text-lg sm:text-xl md:text-2xl font-semibold leading-relaxed">
                  {currentNews.headline}
                </p>
              </div>
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
                <span className="text-lg sm:text-xl text-gray-300">참가자 수</span>
                <span className="text-2xl sm:text-3xl font-bold">{playerCount}명</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <span className="text-lg sm:text-xl text-gray-300">평균 자산</span>
                <span className="text-2xl sm:text-3xl font-bold">
                  ₩{averageAsset.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                <span className="text-lg sm:text-xl text-gray-300">현재 시간</span>
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
        <div className={`px-4 py-2 rounded-full text-sm font-semibold backdrop-blur-xl ${
          connected
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
            {connected ? '연결됨' : '연결 안됨'}
          </div>
        </div>
      </div>
    </div>
  );
}

