import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, GraduationCap, Rocket, Users, Clock, Lock, TrendingUp, TrendingDown, Circle } from 'lucide-react';
import Toast from '../components/Toast';
import { useSocketSync } from '../hooks/useSocketSync';
import { useToast } from '../hooks/useToast';
import { STOCKS } from '../data/initialScenarios';

const ADMIN_PASSWORD = 'holydownhill';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const { gameState, connected, playerCount, playerList, transactionLogs, adminActions } =
    useSocketSync(true);
  const { toasts, removeToast, success, error } = useToast();

  // 비밀번호 인증
  const handleLogin = () => {
    if (!password.trim()) {
      setPasswordError('비밀번호를 입력하세요');
      return;
    }
    if (!connected) {
      setPasswordError('서버에 연결되지 않았습니다. 서버가 실행 중인지 확인하세요.');
      error('연결 오류', '서버에 연결되지 않았습니다. npm run server를 실행하세요.', 4000);
      return;
    }
    if (!adminActions) {
      setPasswordError('관리자 액션을 사용할 수 없습니다. 페이지를 새로고침하세요.');
      error('초기화 오류', '관리자 액션을 사용할 수 없습니다.', 4000);
      return;
    }
    adminActions.authenticate(
      password.trim(),
      () => {
        setIsAuthenticated(true);
        setPasswordError('');
        success('인증 성공', '관리자 페이지에 접속했습니다.', 3000);
      },
      (errorMessage) => {
        setPasswordError(errorMessage);
        error('인증 실패', errorMessage, 3000);
      }
    );
  };

  // 로그인 화면
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        <div className="fixed inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-50 -z-10"></div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card-modern p-8 max-w-md w-full"
        >
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold gradient-text mb-2">관리자 페이지</h1>
            <p className="text-gray-600 text-sm">비밀번호를 입력하세요</p>
          </div>
          <div className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError('');
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="비밀번호"
                className={`input-modern w-full ${passwordError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
                autoFocus
              />
              {passwordError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm"
                >
                  {passwordError}
                </motion.div>
              )}
            </div>
            <button
              onClick={handleLogin}
              disabled={!password.trim() || !connected}
              className={`w-full py-3 rounded-xl font-semibold transition-all ${
                password.trim() && connected
                  ? 'btn-primary'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {!connected ? '서버 연결 대기 중...' : '로그인'}
            </button>
            <div className={`text-center text-sm flex items-center justify-center gap-2 ${
              connected ? 'text-green-600' : 'text-red-600'
            }`}>
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
              {connected ? '서버 연결됨' : '서버 연결 안됨'}
            </div>
            {!connected && (
              <div className="text-center text-xs text-gray-500 mt-2">
                서버를 실행하세요: <code className="bg-gray-100 px-2 py-1 rounded">npm run server</code>
              </div>
            )}
          </div>
        </motion.div>
        <Toast toasts={toasts} onRemove={removeToast} />
      </div>
    );
  }

  const isFirstRound = gameState.currentRound === 0;
  const maxRounds = gameState.isPracticeMode ? 3 : 12;
  const isLastRound = gameState.currentRound >= maxRounds - 1;

  // 주식 이름 가져오기
  const getStockName = (stockId) => {
    const stock = STOCKS.find(s => s.id === stockId);
    return stock ? stock.name : stockId;
  };

  return (
    <div className="min-h-screen p-2 sm:p-4 pb-20 sm:pb-24 relative">
      {/* 배경 효과 */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-50 -z-10"></div>
      
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
            <span>{connected ? '연결됨' : '연결 안됨'}</span>
          </div>
        </div>
        <div className="px-2 py-1 sm:px-4 sm:py-2 rounded-full backdrop-blur-xl font-semibold bg-blue-100 text-blue-700 border border-blue-300 text-xs sm:text-sm">
          👥 {playerCount}명 접속
        </div>
      </div>

      {/* 헤더 */}
      <div className="text-center mb-4 sm:mb-6">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl sm:text-2xl md:text-3xl font-black mb-2 gradient-text"
        >
          관리자 페이지
        </motion.h1>
        <div className="text-sm sm:text-base text-gray-600">
          라운드 {gameState.currentRound + 1} / {maxRounds}
          {gameState.isPracticeMode && <span className="ml-2 text-yellow-600">(연습 모드)</span>}
        </div>
      </div>

      {/* 게임 제어 버튼 */}
      <div className="flex justify-center gap-2 sm:gap-3 mb-4 sm:mb-6 flex-wrap px-2">
        {!gameState.isGameStarted ? (
          <>
            <button
              onClick={() => adminActions?.startPractice()}
              className="btn-secondary px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base flex items-center gap-2 border-2 border-yellow-400 hover:border-yellow-500"
            >
              <GraduationCap className="w-4 h-4" />
              연습 게임 시작
            </button>
            <button
              onClick={() => adminActions?.startGame()}
              className="btn-primary px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              실제 게임 시작
            </button>
          </>
        ) : (
          <>
            {gameState.isPracticeMode && (
              <button
                onClick={() => adminActions?.startRealGame()}
                className="btn-primary px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <Rocket className="w-4 h-4" />
                실제 게임으로 전환
              </button>
            )}
            <button
              onClick={() => adminActions?.previousRound()}
              disabled={isFirstRound}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                isFirstRound
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'btn-secondary'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              이전
            </button>
            <button
              onClick={() => adminActions?.nextRound()}
              disabled={isLastRound}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                isLastRound
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'btn-primary'
              }`}
            >
              다음
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* 플레이어 리스트 및 포인트 추가 */}
      {playerList.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-modern p-3 sm:p-4 mb-4 sm:mb-6"
        >
          <h2 className="text-lg sm:text-xl font-bold gradient-text mb-3 sm:mb-4">
            플레이어 관리 ({playerList.length}명)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] sm:min-w-0">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">닉네임</th>
                  <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">상태</th>
                  <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">마지막 거래</th>
                  <th className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">총 자산</th>
                  <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">포인트 추가</th>
                </tr>
              </thead>
              <tbody>
                {playerList
                  .sort((a, b) => (a.rank || 999) - (b.rank || 999))
                  .map((player) => (
                    <tr
                      key={player.socketId}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        !player.isOnline ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm text-gray-900">
                        {player.rank === 1 && <span className="text-yellow-600 mr-1">👑</span>}
                        {player.nickname}
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Circle
                            className={`w-2 h-2 ${
                              player.isOnline
                                ? 'text-green-500 fill-green-500'
                                : 'text-gray-400 fill-gray-400'
                            }`}
                          />
                          <span className={`text-xs ${
                            player.isOnline ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            {player.isOnline ? '온라인' : '오프라인'}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-center">
                        {player.lastTransactionRound !== null ? (
                          <div className="flex flex-col items-center">
                            <span className={`text-xs sm:text-sm font-semibold ${
                              player.lastTransactionRound === gameState.currentRound
                                ? 'text-green-600'
                                : player.lastTransactionRound < gameState.currentRound
                                ? 'text-gray-500'
                                : 'text-blue-600'
                            }`}>
                              라운드 {player.lastTransactionRound + 1}
                            </span>
                            {player.lastTransactionRound < gameState.currentRound && (
                              <span className="text-[10px] text-gray-400">
                                ({gameState.currentRound - player.lastTransactionRound}라운드 전)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">거래 없음</span>
                        )}
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-right font-bold text-xs sm:text-sm text-purple-600">
                        ₩{player.totalAsset?.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) || 0}
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4">
                        <div className="flex items-center gap-2 justify-center">
                          <input
                            type="number"
                            id={`points-${player.socketId}`}
                            placeholder="포인트"
                            min="0"
                            step="100"
                            className="input-modern w-24 sm:w-28 text-xs sm:text-sm"
                          />
                          <button
                            onClick={() => {
                              const input = document.getElementById(`points-${player.socketId}`);
                              if (input && input.value && adminActions) {
                                adminActions.addPoints(player.socketId, parseFloat(input.value));
                                input.value = '';
                                success('포인트 추가', `${player.nickname}에게 포인트를 추가했습니다.`, 2000);
                              }
                            }}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold rounded-lg text-xs sm:text-sm transition-all"
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

      {/* 거래 로그 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-modern p-3 sm:p-4 mb-4 sm:mb-6"
      >
        <h2 className="text-lg sm:text-xl font-bold gradient-text mb-3 sm:mb-4">
          거래 로그 ({transactionLogs.length}건)
        </h2>
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
          <table className="w-full min-w-[600px] sm:min-w-0">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">시간</th>
                <th className="text-left py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">플레이어</th>
                <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">유형</th>
                <th className="text-left py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">주식</th>
                <th className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">수량</th>
                <th className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">가격</th>
                <th className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">금액</th>
                <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">라운드</th>
              </tr>
            </thead>
            <tbody>
              {transactionLogs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-gray-500 text-sm">
                    아직 거래 로그가 없습니다.
                  </td>
                </tr>
              ) : (
                [...transactionLogs].reverse().map((log, index) => {
                  const date = new Date(log.timestamp);
                  const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
                  const isBuy = log.type === 'BUY';
                  const amount = isBuy ? log.totalCost : log.totalRevenue;
                  
                  return (
                    <tr
                      key={index}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-2 px-2 sm:px-4 text-xs text-gray-600">{timeStr}</td>
                      <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900">{log.nickname}</td>
                      <td className="py-2 px-2 sm:px-4 text-center">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                          isBuy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {isBuy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {isBuy ? '매수' : '매도'}
                        </div>
                      </td>
                      <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm text-gray-900">{getStockName(log.stockId)}</td>
                      <td className="py-2 px-2 sm:px-4 text-right text-xs sm:text-sm text-gray-700">{log.quantity}주</td>
                      <td className="py-2 px-2 sm:px-4 text-right text-xs sm:text-sm text-gray-700">₩{log.price.toFixed(2)}</td>
                      <td className={`py-2 px-2 sm:px-4 text-right text-xs sm:text-sm font-bold ${
                        isBuy ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {isBuy ? '-' : '+'}₩{amount.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-2 px-2 sm:px-4 text-center text-xs text-gray-600">{log.round + 1}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Toast 알림 */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
