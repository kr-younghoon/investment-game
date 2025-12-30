import { useState, Fragment, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Play, GraduationCap, Rocket, Users, TrendingUp, TrendingDown, Circle, Gift, Lightbulb, Check, X, Trophy, Database, Settings, BarChart, Square, LogOut, Trash2, Clock, Gamepad2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import GameStartModal from '../../components/GameStartModal';
import { STOCKS } from '../../data/initialScenarios';

export default function DeveloperPage({ gameState, connected, playerCount, playerList, transactionLogs, adminActions, setRoundTimerEndCallback, setAdminsListCallback, setAdminSuccessCallback }) {
  const { toasts, removeToast, success, error, info } = useToast();
  const [activeTab, setActiveTab] = useState('game'); // 'game', 'players', 'transactions', 'hints', 'ranking', 'database', 'settings'
  const [admins, setAdmins] = useState([]); // 운영자 계정 목록
  const [newAdminId, setNewAdminId] = useState(''); // 새 운영자 ID
  const [newAdminPassword, setNewAdminPassword] = useState(''); // 새 운영자 비밀번호
  const [editingAdminId, setEditingAdminId] = useState(null); // 수정 중인 운영자 ID (admin.id)
  const [newPassword, setNewPassword] = useState(''); // 새 비밀번호
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [hintDifficulty, setHintDifficulty] = useState('하');
  const [hintPrice, setHintPrice] = useState('1000');
  const [hintContent, setHintContent] = useState('');
  const [expandedPlayerId, setExpandedPlayerId] = useState(null);
  const [previousRound, setPreviousRound] = useState(gameState.currentRound);
  const [isRoundChanging, setIsRoundChanging] = useState(false);
  const [roundChangeDirection, setRoundChangeDirection] = useState(null); // 'next' or 'previous'
  const [confirmModal, setConfirmModal] = useState(null); // { type: 'previous' | 'next' | 'end' | 'timer', onConfirm: function }
  const [gameStartModal, setGameStartModal] = useState(null); // { type: 'practice' | 'real', onConfirm: function }

  const isFirstRound = gameState.currentRound === 0;
  const maxRounds = gameState.isPracticeMode ? 3 : 12;
  const isLastRound = gameState.currentRound >= maxRounds - 1;

  // 라운드 변경 감지
  useEffect(() => {
    if (isRoundChanging && gameState.currentRound !== previousRound) {
      // 라운드 변경 완료
      setIsRoundChanging(false);
      const direction = roundChangeDirection;
      setRoundChangeDirection(null);
      
      if (direction === 'next') {
        success('라운드 전환 완료', '정상적으로 다음 라운드로 넘어갔습니다.', 3000);
      } else if (direction === 'previous') {
        success('라운드 전환 완료', '정상적으로 이전 라운드로 넘어갔습니다.', 3000);
      }
      
      setPreviousRound(gameState.currentRound);
    }
  }, [gameState.currentRound, previousRound, isRoundChanging, roundChangeDirection, success]);

  // 라운드 타이머 종료 콜백 설정
  useEffect(() => {
    if (setRoundTimerEndCallback) {
      setRoundTimerEndCallback((message) => {
        // 타이머가 0이 되면 확인 모달 표시
        setConfirmModal({
          type: 'timer',
          title: '라운드 시간 종료',
          message: message || '15분이 종료되었습니다. 다음 라운드로 진행하시겠습니까?',
          confirmText: '다음 라운드',
          cancelText: '취소',
          onConfirm: () => {
            setIsRoundChanging(true);
            setRoundChangeDirection('next');
            setPreviousRound(gameState.currentRound);
            info('라운드 전환 중', '다음 라운드로 넘어가는 중...', 0);
            adminActions?.nextRound();
          },
        });
      });
    }
  }, [setRoundTimerEndCallback, adminActions, info, gameState.currentRound]);

  // 운영자 계정 목록 조회
  useEffect(() => {
    if (activeTab === 'settings' && adminActions?.getAdmins) {
      adminActions.getAdmins();
    }
  }, [activeTab, adminActions]);

  // 운영자 계정 목록 콜백 설정
  useEffect(() => {
    if (setAdminsListCallback) {
      setAdminsListCallback((admins) => {
        setAdmins(admins);
      });
    }
    // 초기 운영자 목록 요청
    if (adminActions && adminActions.getAdmins) {
      adminActions.getAdmins();
    }
  }, [setAdminsListCallback, adminActions]);

  // 관리자 성공 콜백 설정
  useEffect(() => {
    if (setAdminSuccessCallback) {
      setAdminSuccessCallback((message) => {
        success('성공', message, 3000);
      });
    }
  }, [setAdminSuccessCallback, success]);

  // 주식 이름 가져오기
  const getStockName = (stockId) => {
    const stock = STOCKS.find(s => s.id === stockId);
    return stock ? stock.name : stockId;
  };

  return (
    <div className="min-h-screen p-2 sm:p-4 pb-20 sm:pb-24 relative">
      {/* 배경 효과 */}
      <div className="fixed inset-0 bg-white -z-10"></div>

      {/* 연결 상태 및 플레이어 수 */}
      <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50 flex gap-2 sm:gap-3 flex-wrap">
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
      <div className="text-center mb-6 sm:mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl sm:text-2xl md:text-3xl font-black mb-3 text-gray-900"
        >
          👨‍💻 개발 책임자
        </motion.h1>
        <div className="text-sm sm:text-base text-gray-600 mb-2">
          라운드 {gameState.currentRound + 1} / {maxRounds}
          {gameState.isPracticeMode && <span className="ml-2 text-yellow-600">(연습 모드)</span>}
        </div>
        {/* 라운드 타이머 */}
        {gameState.isGameStarted && !gameState.isWaitingMode && gameState.roundTimer !== null && (
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
              {Math.floor(gameState.roundTimer / 60)}:{(gameState.roundTimer % 60).toString().padStart(2, '0')}
            </span>
          </motion.div>
        )}
      </div>

      {/* 게임 제어 버튼 */}
      <div className="flex justify-center gap-2 sm:gap-3 mb-6 sm:mb-8 flex-wrap px-2">
        {!gameState.isGameStarted ? (
          <>
            <button
              onClick={() => {
                setGameStartModal({
                  type: 'practice',
                  onConfirm: () => {
                    adminActions?.startPractice();
                  },
                });
              }}
              className="btn-secondary px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base flex items-center gap-2 border-2 border-yellow-400 hover:border-yellow-500"
            >
              <GraduationCap className="w-4 h-4" />
              연습 게임 시작
            </button>
            <button
              onClick={() => {
                setGameStartModal({
                  type: 'real',
                  onConfirm: () => {
                    adminActions?.startRealGame();
                  },
                });
              }}
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
                onClick={() => {
                  setGameStartModal({
                    type: 'real',
                    onConfirm: () => {
                      adminActions?.startRealGame();
                    },
                  });
                }}
                className="btn-primary px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <Rocket className="w-4 h-4" />
                실제 게임으로 전환
              </button>
            )}
            <button
              onClick={() => {
                setConfirmModal({
                  type: 'previous',
                  title: '이전 라운드로 이동',
                  message: '이전 라운드로 넘어가시겠습니까?',
                  onConfirm: () => {
                    setIsRoundChanging(true);
                    setRoundChangeDirection('previous');
                    setPreviousRound(gameState.currentRound);
                    info('라운드 전환 중', '이전 라운드로 넘어가는 중...', 0);
                    adminActions?.previousRound();
                  },
                });
              }}
              disabled={isFirstRound || isRoundChanging}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                isFirstRound || isRoundChanging
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'btn-secondary'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              이전
            </button>
            <button
              onClick={() => {
                setConfirmModal({
                  type: 'next',
                  title: '다음 라운드로 이동',
                  message: '다음으로 넘어 가시겠습니까?',
                  onConfirm: () => {
                    setIsRoundChanging(true);
                    setRoundChangeDirection('next');
                    setPreviousRound(gameState.currentRound);
                    info('라운드 전환 중', '다음 라운드로 넘어가는 중...', 0);
                    adminActions?.nextRound();
                  },
                });
              }}
              disabled={isLastRound || isRoundChanging}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                isLastRound || isRoundChanging
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'btn-primary'
              }`}
            >
              다음
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setConfirmModal({
                  type: 'end',
                  title: '게임 종료',
                  message: '정말로 게임을 종료하시겠습니까? 모든 플레이어는 대기 모드로 돌아갑니다.',
                  confirmText: '종료',
                  cancelText: '취소',
                  onConfirm: () => {
                    adminActions?.endGame();
                    success('게임 종료', '게임이 종료되었습니다.', 3000);
                  },
                });
              }}
              className="px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white"
            >
              <Square className="w-4 h-4" />
              게임 종료
            </button>
          </>
        )}
      </div>

      {/* 탭 메뉴 */}
      <div className="flex gap-2 mb-6 sm:mb-8 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('game')}
          className={`px-3 py-2 text-xs sm:text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'game'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Play className="w-3 h-3 sm:w-4 sm:h-4 inline-block mr-1" />
          게임 진행
        </button>
        <button
          onClick={() => setActiveTab('players')}
          className={`px-3 py-2 text-xs sm:text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'players'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-3 h-3 sm:w-4 sm:h-4 inline-block mr-1" />
          플레이어
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-3 py-2 text-xs sm:text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'transactions'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 inline-block mr-1" />
          거래 로그
        </button>
        <button
          onClick={() => setActiveTab('hints')}
          className={`px-3 py-2 text-xs sm:text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'hints'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Lightbulb className="w-3 h-3 sm:w-4 sm:h-4 inline-block mr-1" />
          힌트
        </button>
        <button
          onClick={() => setActiveTab('ranking')}
          className={`px-3 py-2 text-xs sm:text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'ranking'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Trophy className="w-3 h-3 sm:w-4 sm:h-4 inline-block mr-1" />
          랭킹
        </button>
        <button
          onClick={() => setActiveTab('database')}
          className={`px-3 py-2 text-xs sm:text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'database'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Database className="w-3 h-3 sm:w-4 sm:h-4 inline-block mr-1" />
          데이터베이스
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-3 py-2 text-xs sm:text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'settings'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Settings className="w-3 h-3 sm:w-4 sm:h-4 inline-block mr-1" />
          설정
        </button>
      </div>

      {/* 탭 내용 */}
      <AnimatePresence mode="wait">
        {/* 게임 진행 탭 */}
        {activeTab === 'game' && (
          <motion.div
            key="game"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="card-modern p-3 sm:p-4 mb-6 sm:mb-8"
          >
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">
              게임 진행 상태
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">현재 라운드</div>
                  <div className="text-2xl font-bold text-blue-600">{gameState.currentRound + 1} / {maxRounds}</div>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">게임 상태</div>
                  <div className="text-2xl font-bold text-green-600">
                    {gameState.isGameStarted ? (gameState.isPracticeMode ? '연습' : '실제') : '대기'}
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">현재 뉴스</div>
                <div className="text-base font-semibold text-purple-700">{gameState.currentNews || '뉴스 없음'}</div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600 mb-2">주식 가격</div>
                <div className="space-y-2">
                  {STOCKS.map(stock => {
                    const price = gameState.stockPrices[stock.id]?.[gameState.currentRound] || stock.basePrice;
                    return (
                      <div key={stock.id} className="flex justify-between items-center">
                        <span className="text-sm font-medium">{stock.name}</span>
                        <span className="text-sm font-bold text-gray-700">₩{price.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 플레이어 관리 탭 - 기존 코드와 동일 */}
        {activeTab === 'players' && (
          <motion.div
            key="players"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            {playerList.length > 0 ? (
              <div className="card-modern p-3 sm:p-4 mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">
                  플레이어 관리 ({playerList.length}명)
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] sm:min-w-0">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">닉네임</th>
                        <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">상태</th>
                        <th className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">총 자산</th>
                        <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">힌트</th>
                        <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">포인트 추가</th>
                        <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {playerList
                        .sort((a, b) => (a.rank || 999) - (b.rank || 999))
                        .map((player) => (
                          <Fragment key={player.socketId}>
                            <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${!player.isOnline ? 'opacity-60' : ''}`}>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm text-gray-900">
                                {player.rank === 1 && <span className="text-yellow-600 mr-1">👑</span>}
                                {player.nickname}
                              </td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Circle className={`w-2 h-2 ${player.isOnline ? 'text-green-500 fill-green-500' : 'text-gray-400 fill-gray-400'}`} />
                                  <span className={`text-xs ${player.isOnline ? 'text-green-600' : 'text-gray-500'}`}>
                                    {player.isOnline ? '온라인' : '오프라인'}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-right font-bold text-xs sm:text-sm text-purple-600">
                                ₩{player.totalAsset?.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) || 0}
                              </td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4">
                                <div className="flex flex-col items-center gap-1">
                                  <button
                                    onClick={() => setExpandedPlayerId(expandedPlayerId === player.socketId ? null : player.socketId)}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all hover:bg-gray-100"
                                  >
                                    <Lightbulb className={`w-3 h-3 ${(player.hints?.length || 0) > 0 ? 'text-blue-500' : 'text-gray-400'}`} />
                                    <span className={((player.hints?.length || 0) > 0) ? 'text-blue-600' : 'text-gray-500'}>
                                      {(player.hints?.length || 0)}개
                                    </span>
                                    {expandedPlayerId === player.socketId ? <X className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  </button>
                                </div>
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
                              <td className="py-2 sm:py-3 px-2 sm:px-4">
                                <div className="flex items-center gap-2 justify-center">
                                  <button
                                    onClick={() => {
                                      setConfirmModal({
                                        type: 'kick',
                                        title: '플레이어 로그아웃',
                                        message: `정말로 ${player.nickname}님을 로그아웃시키시겠습니까?`,
                                        confirmText: '로그아웃',
                                        cancelText: '취소',
                                        onConfirm: () => {
                                          if (adminActions && adminActions.kickPlayer) {
                                            adminActions.kickPlayer(player.socketId);
                                            success('로그아웃', `${player.nickname}님을 로그아웃시켰습니다.`, 2000);
                                          }
                                        },
                                      });
                                    }}
                                    disabled={!player.isOnline}
                                    className="px-2 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold rounded-lg text-xs sm:text-sm transition-all flex items-center gap-1"
                                    title="로그아웃"
                                  >
                                    <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">로그아웃</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setConfirmModal({
                                        type: 'delete',
                                        title: '플레이어 삭제',
                                        message: `정말로 ${player.nickname}님의 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
                                        confirmText: '삭제',
                                        cancelText: '취소',
                                        onConfirm: () => {
                                          if (adminActions && adminActions.deletePlayer) {
                                            adminActions.deletePlayer(player.socketId);
                                            success('삭제 완료', `${player.nickname}님의 데이터를 삭제했습니다.`, 2000);
                                          }
                                        },
                                      });
                                    }}
                                    className="px-2 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold rounded-lg text-xs sm:text-sm transition-all flex items-center gap-1"
                                    title="삭제"
                                  >
                                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">삭제</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {expandedPlayerId === player.socketId && player.hints && player.hints.length > 0 && (
                              <tr>
                                <td colSpan="6" className="py-3 px-4 bg-white">
                                  <div className="space-y-2">
                                    <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                      <Lightbulb className="w-4 h-4 text-blue-500" />
                                      보유 힌트 ({player.hints.length}개)
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {player.hints.map((hint, hintIndex) => {
                                        const hintDate = new Date(hint.receivedAt);
                                        const dateStr = `${hintDate.getMonth() + 1}/${hintDate.getDate()} ${hintDate.getHours()}:${hintDate.getMinutes().toString().padStart(2, '0')}`;
                                        return (
                                          <div key={hintIndex} className="p-2 bg-white rounded-lg border border-blue-200">
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                              <div className="flex items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                                  hint.difficulty === '상' ? 'bg-red-100 text-red-700' :
                                                  hint.difficulty === '중' ? 'bg-yellow-100 text-yellow-700' :
                                                  'bg-green-100 text-green-700'
                                                }`}>
                                                  {hint.difficulty}급
                                                </span>
                                                <span className="text-xs text-gray-500">₩{hint.price?.toLocaleString('ko-KR') || 0}</span>
                                              </div>
                                              <span className="text-[10px] text-gray-400">{dateStr}</span>
                                            </div>
                                            <p className="text-xs text-gray-700 line-clamp-2">{hint.content || '힌트 내용이 없습니다.'}</p>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="card-modern p-8 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 text-sm sm:text-base">아직 접속한 플레이어가 없습니다.</p>
              </div>
            )}
          </motion.div>
        )}

        {/* 거래 로그 탭 - 기존 코드와 동일 */}
        {activeTab === 'transactions' && (
          <motion.div
            key="transactions"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="card-modern p-3 sm:p-4 mb-6 sm:mb-8"
          >
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">
              거래 로그 ({transactionLogs.length}건)
            </h2>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
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
                    <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">운영자</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionLogs.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="py-8 text-center text-gray-500 text-sm">아직 거래 로그가 없습니다.</td>
                    </tr>
                  ) : (
                    [...transactionLogs].reverse().map((log, index) => {
                      const date = new Date(log.timestamp);
                      const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
                      const isBuy = log.type === 'BUY';
                      const isBonusPoints = log.type === 'BONUS_POINTS';
                      const isMinigameReward = log.type === 'MINIGAME_REWARD';
                      const isHintPurchase = log.type === 'HINT_PURCHASE';
                      const amount = isBuy ? log.totalCost : (isBonusPoints || isMinigameReward ? log.points : (isHintPurchase ? log.hintPrice : log.totalRevenue));
                      
                      return (
                        <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="py-2 px-2 sm:px-4 text-xs text-gray-600">{timeStr}</td>
                          <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900">{log.nickname}</td>
                          <td className="py-2 px-2 sm:px-4 text-center">
                            {isMinigameReward ? (
                              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-yellow-100 text-yellow-700">
                                <Gamepad2 className="w-3 h-3" /> 미니게임 성공
                              </div>
                            ) : isBonusPoints ? (
                              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700">
                                <Gift className="w-3 h-3" /> 포인트 추가
                              </div>
                            ) : isHintPurchase ? (
                              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700">
                                <Lightbulb className="w-3 h-3" /> 힌트 구매
                              </div>
                            ) : (
                              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${isBuy ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {isBuy ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {isBuy ? '매수' : '매도'}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm text-gray-900">
                            {isBonusPoints || isMinigameReward || isHintPurchase ? '-' : getStockName(log.stockId)}
                          </td>
                          <td className="py-2 px-2 sm:px-4 text-right text-xs sm:text-sm text-gray-700">
                            {isBonusPoints || isMinigameReward || isHintPurchase ? '-' : `${log.quantity}주`}
                          </td>
                          <td className="py-2 px-2 sm:px-4 text-right text-xs sm:text-sm text-gray-700">
                            {isBonusPoints || isMinigameReward || isHintPurchase ? (isHintPurchase ? `${log.difficulty}급` : '-') : `₩${log.price.toFixed(2)}`}
                          </td>
                          <td className={`py-2 px-2 sm:px-4 text-right text-xs sm:text-sm font-bold ${
                            isMinigameReward ? 'text-yellow-600' : (isBonusPoints ? 'text-purple-600' : (isHintPurchase ? 'text-blue-600' : (isBuy ? 'text-green-600' : 'text-red-600')))
                          }`}>
                            {isMinigameReward ? `+₩${amount.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}` :
                             isBonusPoints ? `+${amount.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}포인트` :
                             isHintPurchase ? `-₩${amount.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}` :
                             `${isBuy ? '-' : '+'}₩${amount.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`}
                          </td>
                          <td className="py-2 px-2 sm:px-4 text-center text-xs text-gray-600">{log.round + 1}</td>
                          <td className="py-2 px-2 sm:px-4 text-center text-xs sm:text-sm text-gray-700">
                            {log.adminId ? (
                              <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-700 font-semibold">
                                {log.adminId}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
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

        {/* 힌트 부여 탭 - 기존 코드와 동일 */}
        {activeTab === 'hints' && (
          <motion.div
            key="hints"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="card-modern p-3 sm:p-4 mb-6 sm:mb-8"
          >
            <h2 className="text-lg sm:text-xl font-bold gradient-text mb-3 sm:mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6" />
              힌트 부여
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">플레이어 선택</label>
                <select value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)} className="input-modern w-full">
                  <option value="">플레이어를 선택하세요</option>
                  {playerList.map((player) => (
                    <option key={player.socketId} value={player.socketId}>
                      {player.nickname} (현금: ₩{player.cash.toLocaleString('ko-KR')})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">힌트 난이도</label>
                <div className="grid grid-cols-3 gap-2">
                  {['하', '중', '상'].map((difficulty) => (
                    <button
                      key={difficulty}
                      onClick={() => setHintDifficulty(difficulty)}
                      className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                        hintDifficulty === difficulty
                          ? difficulty === '상' ? 'bg-red-500 text-white shadow-md' :
                            difficulty === '중' ? 'bg-yellow-500 text-white shadow-md' :
                            'bg-green-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {difficulty}급
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">힌트 금액 (₩)</label>
                <input type="number" value={hintPrice} onChange={(e) => setHintPrice(e.target.value)} min="0" step="100" placeholder="금액을 입력하세요" className="input-modern w-full" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">힌트 내용</label>
                <textarea value={hintContent} onChange={(e) => setHintContent(e.target.value)} placeholder="힌트 내용을 입력하세요" className="input-modern w-full min-h-[100px]" />
              </div>
              <button
                onClick={() => {
                  if (!selectedPlayerId) {
                    error('오류', '플레이어를 선택해주세요.', 3000);
                    return;
                  }
                  const price = parseInt(hintPrice);
                  if (isNaN(price) || price < 0) {
                    error('오류', '올바른 금액을 입력해주세요.', 3000);
                    return;
                  }
                  if (adminActions) {
                    adminActions.grantHint(selectedPlayerId, hintDifficulty, price, hintContent || null);
                    const selectedPlayer = playerList.find(p => p.socketId === selectedPlayerId);
                    success('힌트 부여', `${selectedPlayer?.nickname || '플레이어'}에게 ${hintDifficulty}급 힌트를 부여했습니다. (₩${price.toLocaleString('ko-KR')})`, 3000);
                    setSelectedPlayerId('');
                    setHintDifficulty('하');
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

        {/* 랭킹 탭 - 기존 코드와 동일 */}
        {activeTab === 'ranking' && (
          <motion.div
            key="ranking"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="card-modern p-3 sm:p-4 mb-6 sm:mb-8"
          >
            <h2 className="text-lg sm:text-xl font-bold gradient-text mb-3 sm:mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
              플레이어 랭킹
            </h2>
            {playerList.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-sm sm:text-base">아직 플레이어가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {playerList
                  .filter(player => player.rank !== null && player.rank !== undefined)
                  .sort((a, b) => (a.rank || 999) - (b.rank || 999))
                  .map((player, index) => {
                    const isTopThree = player.rank <= 3;
                    const rankIcon = player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : player.rank === 3 ? '🥉' : null;
                    return (
                      <motion.div
                        key={player.socketId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          isTopThree
                            ? player.rank === 1 ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300 shadow-md' :
                              player.rank === 2 ? 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300 shadow-md' :
                              'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-300 shadow-md'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <div className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-base ${
                              isTopThree
                                ? player.rank === 1 ? 'bg-yellow-400 text-yellow-900' :
                                  player.rank === 2 ? 'bg-gray-300 text-gray-800' :
                                  'bg-orange-300 text-orange-900'
                                : 'bg-gray-200 text-gray-700'
                            }`}>
                              {rankIcon || player.rank}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`font-bold text-sm sm:text-base truncate ${isTopThree ? 'text-gray-900' : 'text-gray-800'}`}>
                                  {player.nickname}
                                </span>
                                {!player.isOnline && <span className="text-xs text-gray-400">(오프라인)</span>}
                              </div>
                              <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-600">
                                <span>총 자산</span>
                                <span className="font-semibold text-purple-600">₩{player.totalAsset?.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) || 0}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            {isTopThree && (
                              <Trophy className={`w-6 h-6 sm:w-8 sm:h-8 ${player.rank === 1 ? 'text-yellow-500' : player.rank === 2 ? 'text-gray-400' : 'text-orange-500'}`} />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
              </div>
            )}
          </motion.div>
        )}

        {/* 데이터베이스 탭 */}
        {activeTab === 'database' && (
          <motion.div
            key="database"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="card-modern p-3 sm:p-4 mb-6 sm:mb-8"
          >
            <h2 className="text-lg sm:text-xl font-bold gradient-text mb-3 sm:mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 sm:w-6 sm:h-6" />
              데이터베이스 상태
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">데이터베이스</div>
                <div className="text-lg font-bold text-green-600">SQLite (game_data.db)</div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600 mb-2">데이터베이스 확인</div>
                <p className="text-xs text-gray-700 mb-2">터미널에서 다음 명령어를 실행하세요:</p>
                <code className="block p-2 bg-gray-800 text-green-400 rounded text-xs">npm run check-db</code>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">총 거래 로그</div>
                  <div className="text-2xl font-bold text-purple-600">{transactionLogs.length}건</div>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">접속 플레이어</div>
                  <div className="text-2xl font-bold text-orange-600">{playerList.length}명</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 설정 탭 */}
        {activeTab === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="card-modern p-3 sm:p-4 mb-6 sm:mb-8"
          >
            <h2 className="text-lg sm:text-xl font-bold gradient-text mb-3 sm:mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
              게임 설정
            </h2>
            <div className="space-y-6">
              {/* 게임 설정 */}
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-3">게임 설정</h3>
                <div className="space-y-3">
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <div className="text-sm font-semibold text-gray-700 mb-2">게임 모드</div>
                    <div className="text-sm text-gray-600">
                      {gameState.isPracticeMode ? '연습 모드' : '실제 게임 모드'}
                    </div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <div className="text-sm font-semibold text-gray-700 mb-2">총 라운드</div>
                    <div className="text-sm text-gray-600">{maxRounds}라운드</div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <div className="text-sm font-semibold text-gray-700 mb-2">초기 현금</div>
                    <div className="text-sm text-gray-600">₩10,000</div>
                  </div>
                </div>
              </div>

              {/* 운영자 계정 관리 */}
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-3">운영자 계정 관리</h3>
                <div className="space-y-4">
                  {/* 운영자 계정 목록 */}
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <div className="text-sm font-semibold text-gray-700 mb-3">등록된 운영자</div>
                    {admins.length === 0 ? (
                      <p className="text-sm text-gray-500">등록된 운영자가 없습니다.</p>
                    ) : (
                      <div className="space-y-2">
                        {admins.map((admin) => (
                          <div key={admin.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">{admin.admin_id}</div>
                              <div className="text-xs text-gray-500">
                                생성일: {new Date(admin.created_at).toLocaleDateString('ko-KR')}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {editingAdminId === admin.id ? (
                                <div className="flex gap-2">
                                  <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="새 비밀번호"
                                    className="px-2 py-1 text-xs border rounded"
                                  />
                                  <button
                                    onClick={() => {
                                      if (adminActions?.updateAdminPassword && newPassword.trim()) {
                                        adminActions.updateAdminPassword(admin.id, newPassword);
                                        setEditingAdminId(null);
                                        setNewPassword('');
                                      } else {
                                        error('오류', '새 비밀번호를 입력해주세요.', 3000);
                                      }
                                    }}
                                    className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                                  >
                                    저장
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingAdminId(null);
                                      setNewPassword('');
                                    }}
                                    className="px-3 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                                  >
                                    취소
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingAdminId(admin.id);
                                      setNewPassword('');
                                    }}
                                    className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                                  >
                                    비밀번호 변경
                                  </button>
                                  <button
                                    onClick={() => {
                                      setConfirmModal({
                                        type: 'delete',
                                        title: '운영자 계정 삭제',
                                        message: `정말로 '${admin.admin_id}' 운영자 계정을 삭제하시겠습니까?`,
                                        confirmText: '삭제',
                                        cancelText: '취소',
                                        onConfirm: () => {
                                          if (adminActions?.deleteAdmin) {
                                            adminActions.deleteAdmin(admin.id);
                                          }
                                        },
                                      });
                                    }}
                                    className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                                  >
                                    삭제
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 새 운영자 계정 추가 */}
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <div className="text-sm font-semibold text-gray-700 mb-3">새 운영자 계정 추가</div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newAdminId}
                        onChange={(e) => setNewAdminId(e.target.value)}
                        placeholder="운영자 ID"
                        className="input-modern w-full text-sm"
                      />
                      <input
                        type="password"
                        value={newAdminPassword}
                        onChange={(e) => setNewAdminPassword(e.target.value)}
                        placeholder="비밀번호"
                        className="input-modern w-full text-sm"
                      />
                      <button
                        onClick={() => {
                          if (adminActions?.createAdmin) {
                            adminActions.createAdmin(newAdminId, newAdminPassword);
                            setNewAdminId('');
                            setNewAdminPassword('');
                          }
                        }}
                        disabled={!newAdminId.trim() || !newAdminPassword.trim()}
                        className={`w-full py-2 px-4 rounded-lg font-semibold text-sm ${
                          newAdminId.trim() && newAdminPassword.trim()
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        운영자 계정 추가
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast 알림 */}
      {/* 확인 모달 */}
      <ConfirmModal
        isOpen={!!confirmModal}
        onClose={() => setConfirmModal(null)}
        onConfirm={confirmModal?.onConfirm || (() => {})}
        title={confirmModal?.title || ''}
        message={confirmModal?.message || ''}
        confirmText={confirmModal?.confirmText || '확인'}
        cancelText={confirmModal?.cancelText || '취소'}
        type={confirmModal?.type === 'end' || confirmModal?.type === 'delete' ? 'danger' : confirmModal?.type === 'kick' ? 'warning' : 'default'}
      />

      {/* 게임 시작 모달 */}
      <GameStartModal
        isOpen={!!gameStartModal}
        onClose={() => setGameStartModal(null)}
        onConfirm={gameStartModal?.onConfirm || (() => {})}
        type={gameStartModal?.type || 'practice'}
      />

      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

