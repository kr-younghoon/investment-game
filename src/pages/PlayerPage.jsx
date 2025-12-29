import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, TrendingUp, TrendingDown, LogIn, GraduationCap, Rocket, Clock, Edit2, X, Check, Trophy, Medal } from 'lucide-react';
import { useSocketSync } from '../hooks/useSocketSync';
import { useToast } from '../hooks/useToast';
import NewsModal from '../components/NewsModal';
import NewsTicker from '../components/NewsTicker';
import StockCard from '../components/StockCard';
import TransactionConfirmModal from '../components/TransactionConfirmModal';
import TradeModal from '../components/TradeModal';
import Toast from '../components/Toast';
import { STOCKS } from '../data/initialScenarios';

const INITIAL_CASH = 10000;
const STORAGE_KEY = 'mz_investment_portfolio';
const NICKNAME_STORAGE_KEY = 'mz_investment_nickname';

export default function PlayerPage() {
  const { gameState, connected, playerActions, playerRank, rankList, setBonusPointsCallback, setTransactionErrorCallback } = useSocketSync(false);
  const [nickname, setNickname] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showNicknameChange, setShowNicknameChange] = useState(false);
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [previousRound, setPreviousRound] = useState(-1);
  const [previousPracticeMode, setPreviousPracticeMode] = useState(false);
  const [hasAttemptedAutoLogin, setHasAttemptedAutoLogin] = useState(false); // 자동 로그인 시도 여부
  const { toasts, removeToast, success, info, error } = useToast();
  const [portfolio, setPortfolio] = useState({
    cash: INITIAL_CASH,
    stocks: {},
    bonusPoints: 0,
    totalAsset: INITIAL_CASH,
  });
  const [transactionError, setTransactionError] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [buyQuantities, setBuyQuantities] = useState({}); // 각 주식의 매수 수량
  const [sellQuantities, setSellQuantities] = useState({}); // 각 주식의 매도 수량
  const [confirmModal, setConfirmModal] = useState(null); // 확인 모달 상태 { type: 'buy'|'sell', stockId, quantity }
  const [tradeModal, setTradeModal] = useState(null); // 거래 모달 상태 { stockId }
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'trade', 'portfolio', 'rank'

  // localStorage에서 닉네임 불러오기
  useEffect(() => {
    const savedNickname = localStorage.getItem(NICKNAME_STORAGE_KEY);
    if (savedNickname) {
      setNickname(savedNickname);
    }
  }, []);

  // 자동 로그인: 저장된 닉네임이 있고 연결되었을 때 (한 번만 시도)
  useEffect(() => {
    const savedNickname = localStorage.getItem(NICKNAME_STORAGE_KEY);
    if (
      connected &&
      playerActions &&
      savedNickname &&
      savedNickname === nickname.trim() && // 저장된 닉네임과 현재 닉네임이 일치할 때만
      !isLoggedIn &&
      !nicknameError &&
      !hasAttemptedAutoLogin // 아직 자동 로그인을 시도하지 않았을 때만
    ) {
      // 짧은 지연 후 자동 로그인 시도 (서버 연결 안정화 대기)
      const autoLoginTimer = setTimeout(() => {
        if (playerActions && savedNickname && !isLoggedIn && !hasAttemptedAutoLogin) {
          setHasAttemptedAutoLogin(true);
          setNicknameError('');
          playerActions.join(savedNickname, (errorMessage) => {
            // 닉네임 중복 에러 처리
            setNicknameError(errorMessage);
            setIsLoggedIn(false);
          });
        }
      }, 500);

      return () => clearTimeout(autoLoginTimer);
    }
  }, [connected, playerActions, nickname, isLoggedIn, nicknameError, hasAttemptedAutoLogin]);

  // 서버에서 포트폴리오 업데이트 수신
  useEffect(() => {
    if (gameState.portfolio) {
      setPortfolio(gameState.portfolio);
      // 포트폴리오를 받으면 로그인 성공으로 간주
      if (!isLoggedIn && nickname.trim() && !nicknameError) {
        localStorage.setItem(NICKNAME_STORAGE_KEY, nickname.trim());
        setIsLoggedIn(true);
      }
    }
  }, [gameState.portfolio, nickname, isLoggedIn, nicknameError]);

  // 보너스 포인트 추가 알림 콜백 설정
  useEffect(() => {
    if (setBonusPointsCallback) {
      setBonusPointsCallback((points, totalBonusPoints) => {
        success(
          '보너스 포인트 추가',
          `₩${points.toLocaleString('ko-KR')} 포인트가 추가되었습니다. (총 ₩${totalBonusPoints.toLocaleString('ko-KR')})`,
          5000
        );
      });
    }
  }, [setBonusPointsCallback, success]);

  // 거래 오류 알림 콜백 설정
  useEffect(() => {
    if (setTransactionErrorCallback) {
      setTransactionErrorCallback((errorMessage) => {
        error('거래 실패', errorMessage, 4000);
      });
    }
  }, [setTransactionErrorCallback, error]);

  // 라운드 변경 시 뉴스 모달 표시 및 토스트
  useEffect(() => {
    if (
      gameState.currentRound !== previousRound &&
      gameState.currentRound >= 0 &&
      gameState.isGameStarted &&
      isLoggedIn
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
  }, [
    gameState.currentRound,
    previousRound,
    gameState.isGameStarted,
    gameState.currentNews,
    isLoggedIn,
    info,
  ]);

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


  // 로그인 처리
  const handleLogin = () => {
    if (nickname.trim()) {
      setNicknameError('');
      if (playerActions) {
        // 에러 콜백 설정
        playerActions.join(nickname.trim(), (errorMessage) => {
          // 닉네임 중복 에러 처리
          setNicknameError(errorMessage);
          setIsLoggedIn(false);
        });
        // 성공은 포트폴리오 업데이트를 받으면 자동으로 처리됨 (useEffect에서)
        // 하지만 서버 응답이 느릴 수 있으므로, 짧은 지연 후에도 체크
        setTimeout(() => {
          if (!nicknameError && gameState.portfolio) {
            localStorage.setItem(NICKNAME_STORAGE_KEY, nickname.trim());
            setIsLoggedIn(true);
          }
        }, 1000);
      }
    }
  };

  // 닉네임 변경 처리
  const handleNicknameChange = () => {
    if (nickname.trim()) {
      setNicknameError('');
      if (playerActions) {
        playerActions.join(nickname.trim(), (errorMessage) => {
          // 닉네임 중복 에러 처리
          setNicknameError(errorMessage);
          setShowNicknameChange(true); // 편집 모드 유지
        });
        // 성공은 포트폴리오 업데이트를 받으면 자동으로 처리됨
        // 에러가 없으면 변경 성공으로 간주하고 편집 모드 종료
        setTimeout(() => {
          if (!nicknameError) {
            localStorage.setItem(NICKNAME_STORAGE_KEY, nickname.trim());
            setShowNicknameChange(false);
          }
        }, 500);
      }
    }
  };

  // 로그아웃 처리
  const handleLogout = () => {
    setIsLoggedIn(false);
    setShowNicknameChange(false);
    setHasAttemptedAutoLogin(false); // 로그아웃 시 자동 로그인 플래그 리셋
  };

  // 주식 매수 확인 요청
  const requestBuyStock = (stockId, quantity) => {
    const qty = Math.max(1, Math.floor(parseFloat(quantity) || 1));
    setConfirmModal({
      type: 'buy',
      stockId,
      quantity: qty,
    });
  };

  // 주식 매수 실행
  const handleBuyStock = (stockId, quantity) => {
    if (!playerActions) return;
    const qty = Math.max(1, Math.floor(parseFloat(quantity) || 1));
    playerActions.buyStock(stockId, qty);
    setTransactionError('');
    setBuyQuantities({ ...buyQuantities, [stockId]: '' });
  };

  // 주식 매도 확인 요청
  const requestSellStock = (stockId, quantity) => {
    const qty = Math.max(1, Math.floor(parseFloat(quantity) || 1));
    setConfirmModal({
      type: 'sell',
      stockId,
      quantity: qty,
    });
  };

  // 주식 매도 실행
  const handleSellStock = (stockId, quantity) => {
    if (!playerActions) return;
    const qty = Math.max(1, Math.floor(parseFloat(quantity) || 1));
    playerActions.sellStock(stockId, qty);
    setTransactionError('');
    setSellQuantities({ ...sellQuantities, [stockId]: '' });
  };

  // 전체 현금으로 매수 가능한 수량 계산
  const calculateMaxBuyable = (stockId) => {
    const price = gameState.stockPrices[stockId] || STOCKS.find(s => s.id === stockId)?.basePrice || 0;
    if (price === 0) return 0;
    return Math.floor((portfolio.cash || 0) / price);
  };

  // 거래 금액 계산
  const calculateTradeAmount = (stockId, quantity, type) => {
    const price = gameState.stockPrices[stockId] || STOCKS.find(s => s.id === stockId)?.basePrice || 0;
    return price * quantity;
  };

  // 총 자산은 서버에서 계산된 값 사용
  const totalAsset = portfolio.totalAsset || portfolio.cash + portfolio.bonusPoints || INITIAL_CASH;
  
  // 이전 라운드 대비 수익률 계산 (간단 버전)
  const profitLoss = 0; // 필요시 구현
  const isProfit = profitLoss >= 0;

  // 로그인 화면
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        {/* 배경 그라데이션 효과 */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 via-pink-50/50 to-blue-50/50"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.05),transparent_50%)]"></div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="card-modern p-4 sm:p-6 md:p-8 max-w-md w-full relative z-10 mx-4"
        >
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <LogIn className="w-10 h-10 text-white" />
              </div>
            </motion.div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold gradient-text mb-3">
              2025 MZ 투자 생존
            </h1>
            <p className="text-gray-600 text-sm sm:text-base md:text-lg">닉네임을 입력하고 게임을 시작하세요</p>
          </div>

          <div className="mb-6">
            <input
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setNicknameError(''); // 입력 시 에러 메시지 초기화
                // 사용자가 직접 입력하면 자동 로그인 플래그 리셋
                const savedNickname = localStorage.getItem(NICKNAME_STORAGE_KEY);
                if (e.target.value !== savedNickname) {
                  setHasAttemptedAutoLogin(false);
                }
              }}
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="닉네임을 입력하세요"
              className={`input-modern w-full text-base sm:text-lg ${nicknameError ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''}`}
              autoFocus
            />
            {nicknameError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm"
              >
                {nicknameError}
              </motion.div>
            )}
          </div>

          <button
            onClick={handleLogin}
            disabled={!nickname.trim()}
            className={`w-full py-3 sm:py-4 rounded-xl font-semibold text-base sm:text-lg transition-all ${
              nickname.trim()
                ? 'btn-primary'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            입장하기
          </button>

          <div className="mt-6 space-y-2">
            <div
              className={`text-center text-sm flex items-center justify-center gap-2 ${
                connected ? 'text-green-400' : 'text-red-400'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
              {connected ? '서버 연결됨' : '서버 연결 안됨'}
            </div>
            {!connected && (
              <div className="text-center text-xs text-yellow-600">
                서버를 실행하세요: npm run server
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // 메인 화면
  return (
    <div className="min-h-screen p-2 sm:p-4 pb-20 sm:pb-24 relative">
      {/* 배경 효과 */}
      <div className="fixed inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-50 -z-10"></div>
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(120,119,198,0.05),transparent_50%)] -z-10"></div>
      
      {/* 대기 모드 화면 */}
      {gameState.isWaitingMode && (
        <div className="min-h-screen flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-modern p-12 max-w-2xl w-full text-center"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="mb-8"
            >
              <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center shadow-2xl">
                <Clock className="w-16 h-16 text-white animate-pulse" />
              </div>
            </motion.div>
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              게임 시작 대기 중
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              관리자가 게임을 시작할 때까지 기다려주세요
            </p>
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
              <div className="text-lg text-gray-700">
                <div className="font-semibold mb-2">현재 상태</div>
                <div className="flex items-center justify-center gap-2 text-blue-600">
                  <Clock className="w-5 h-5" />
                  <span>대기 모드</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* 카운트다운 오버레이 */}
      <AnimatePresence>
        {gameState.countdown !== null && gameState.countdown > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-[100] flex items-center justify-center"
          >
            <motion.div
              key={gameState.countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <div className="text-9xl sm:text-[12rem] md:text-[15rem] font-black text-white mb-4 drop-shadow-2xl">
                {gameState.countdown}
              </div>
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-white/90">
                다음 라운드로...
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 게임 화면 (대기 모드가 아닐 때만 표시) */}
      {!gameState.isWaitingMode && (
        <>
          {/* 연결 상태 */}
          <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50">
        <div
          className={`px-2 py-1 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-semibold backdrop-blur-xl ${
            connected
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
            {connected ? '연결됨' : '연결 안됨'}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto">
          {/* 헤더 */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-4 sm:mb-8"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 px-3 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-white backdrop-blur-xl border border-gray-200 shadow-lg relative"
            >
              <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
              {showNicknameChange ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => {
                        setNickname(e.target.value);
                        setNicknameError(''); // 입력 시 에러 메시지 초기화
                      }}
                      onKeyPress={(e) => e.key === 'Enter' && handleNicknameChange()}
                      className={`px-3 py-1 border rounded-lg text-gray-900 focus:outline-none ${
                        nicknameError
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-gray-300 focus:border-purple-500'
                      }`}
                      autoFocus
                    />
                    <button
                      onClick={handleNicknameChange}
                      className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                      title="저장"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        setShowNicknameChange(false);
                        setNicknameError('');
                        // 원래 닉네임으로 복원
                        const savedNickname = localStorage.getItem(NICKNAME_STORAGE_KEY);
                        if (savedNickname) {
                          setNickname(savedNickname);
                        }
                      }}
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="취소"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  {nicknameError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm"
                    >
                      {nicknameError}
                    </motion.div>
                  )}
                </div>
              ) : (
                <>
                  <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold gradient-text">
                    {nickname}님의 포트폴리오
                  </h1>
                  <button
                    onClick={() => setShowNicknameChange(true)}
                    className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                    title="닉네임 변경"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </motion.div>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {gameState.isGameStarted && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm ${
                  gameState.isPracticeMode
                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-400'
                    : 'bg-green-100 text-green-700 border border-green-400'
                }`}
              >
                {gameState.isPracticeMode ? (
                  <>
                    <GraduationCap className="w-4 h-4" />
                    연습 모드
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    실제 게임
                  </>
                )}
              </motion.div>
            )}
            <div className="text-xs sm:text-sm md:text-base text-gray-600 font-medium">
              라운드 {gameState.currentRound + 1} / {gameState.isPracticeMode ? 3 : 12}
            </div>
          </div>
        </motion.div>

        {/* 총 자산, 현금, 보너스 포인트, 순위 - 간략 버전 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-modern p-3 sm:p-4 md:p-6 mb-4 sm:mb-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-[120px]">
              <div className="text-xs text-gray-500 mb-1">총 자산</div>
              <div className="text-lg sm:text-xl md:text-2xl font-bold gradient-text">
                ₩{totalAsset.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="flex-1 min-w-[100px]">
              <div className="text-xs text-gray-500 mb-1">현금</div>
              <div className="text-base sm:text-lg md:text-xl font-semibold text-blue-600">
                ₩{portfolio.cash?.toLocaleString('ko-KR') || 0}
              </div>
            </div>
            <div className="flex-1 min-w-[100px]">
              <div className="text-xs text-gray-500 mb-1">보너스 포인트</div>
              <div className="text-base sm:text-lg md:text-xl font-semibold text-green-600">
                ₩{portfolio.bonusPoints?.toLocaleString('ko-KR') || 0}
              </div>
            </div>
            {playerRank && playerRank.totalPlayers > 0 && (
              <div className="flex-1 min-w-[100px]">
                <div className="text-xs text-gray-500 mb-1">순위</div>
                <div className="flex items-center gap-2">
                  {playerRank.rank <= 3 ? (
                    <Trophy className={`w-5 h-5 sm:w-6 sm:h-6 ${
                      playerRank.rank === 1 ? 'text-yellow-500' :
                      playerRank.rank === 2 ? 'text-gray-400' :
                      'text-orange-500'
                    }`} />
                  ) : (
                    <Medal className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500" />
                  )}
                  <div className={`text-base sm:text-lg md:text-xl font-bold ${
                    playerRank.rank === 1 ? 'text-yellow-600' :
                    playerRank.rank === 2 ? 'text-gray-600' :
                    playerRank.rank === 3 ? 'text-orange-600' :
                    'text-purple-600'
                  }`}>
                    {playerRank.rank}위
                  </div>
                  <div className="text-xs text-gray-500">
                    / {playerRank.totalPlayers}명
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* 탭 네비게이션 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card-modern p-3 sm:p-4 md:p-6 mb-4 sm:mb-6"
        >
          {/* 탭 버튼 */}
          <div className="flex gap-2 mb-4 sm:mb-6 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('info')}
              className={`px-4 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all border-b-2 ${
                activeTab === 'info'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              주식 정보
            </button>
            <button
              onClick={() => setActiveTab('trade')}
              className={`px-4 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all border-b-2 ${
                activeTab === 'trade'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              주식 거래
            </button>
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`px-4 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all border-b-2 ${
                activeTab === 'portfolio'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              포트폴리오 요약
            </button>
            <button
              onClick={() => setActiveTab('rank')}
              className={`px-4 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all border-b-2 ${
                activeTab === 'rank'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              순위
            </button>
          </div>

          {/* 탭 내용 */}
          <AnimatePresence mode="wait">
            {activeTab === 'info' && (
              <motion.div
                key="info"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
          <div className="overflow-x-auto -mx-3 sm:mx-0">
            <table className="w-full min-w-[400px] sm:min-w-0">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">주식명</th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">현재가</th>
                  <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">변동률</th>
                </tr>
              </thead>
              <tbody>
                {STOCKS.map((stock, index) => {
                  const price = gameState.stockPrices[stock.id] || stock.basePrice;
                  const changePercent =
                    gameState.currentRound > 0
                      ? ((price - stock.basePrice) / stock.basePrice) * 100
                      : 0;
                  const isPositive = changePercent >= 0;

                  return (
                    <tr
                      key={stock.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-2 sm:py-3 px-2 sm:px-4">
                        <div className="font-semibold text-xs sm:text-sm text-gray-900">{stock.name}</div>
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-right">
                        <div className="text-xs sm:text-sm font-bold text-gray-900">
                          ₩{price.toFixed(2)}
                        </div>
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-right">
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                          isPositive ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {isPositive ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          {isPositive ? '+' : ''}
                          {changePercent.toFixed(2)}%
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
              </motion.div>
            )}

            {activeTab === 'trade' && (
              <motion.div
                key="trade"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <table className="w-full min-w-[400px] sm:min-w-0">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">주식명</th>
                        <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">현재가</th>
                        <th className="text-right py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">보유</th>
                        <th className="text-center py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">거래</th>
                      </tr>
                    </thead>
                    <tbody>
                      {STOCKS.map((stock) => {
                        const price = gameState.stockPrices[stock.id] || stock.basePrice;
                        const quantity = portfolio.stocks?.[stock.id] || 0;
                        const value = quantity * price;

                        return (
                          <tr
                            key={stock.id}
                            className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            <td className="py-2 sm:py-3 px-2 sm:px-4">
                              <div className="font-semibold text-xs sm:text-sm text-gray-900">{stock.name}</div>
                              {quantity > 0 && (
                                <div className="text-[10px] sm:text-xs text-purple-600 mt-0.5">
                                  평가액: ₩{value.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                                </div>
                              )}
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-right">
                              <div className="text-xs sm:text-sm font-bold text-gray-900">
                                ₩{price.toFixed(2)}
                              </div>
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-right">
                              <div className="text-xs sm:text-sm font-semibold text-purple-600">
                                {quantity}주
                              </div>
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-center">
                              <button
                                onClick={() => setTradeModal({ stockId: stock.id })}
                                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg text-xs sm:text-sm transition-all shadow-md hover:shadow-lg active:scale-95"
                              >
                                거래하기
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {activeTab === 'portfolio' && (
              <motion.div
                key="portfolio"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-gray-600 font-semibold text-sm uppercase tracking-wider">
                    주식명
                  </th>
                  <th className="text-right py-3 px-4 text-gray-600 font-semibold text-sm uppercase tracking-wider">
                    현재가
                  </th>
                  <th className="text-right py-3 px-4 text-gray-600 font-semibold text-sm uppercase tracking-wider">
                    수량
                  </th>
                  <th className="text-right py-3 px-4 text-gray-600 font-semibold text-sm uppercase tracking-wider">
                    평가액
                  </th>
                </tr>
              </thead>
              <tbody>
                {STOCKS.map((stock) => {
                  const price =
                    gameState.stockPrices[stock.id] || stock.basePrice;
                  const quantity = portfolio.stocks?.[stock.id] || 0;
                  const value = quantity * price;

                  return (
                    <tr
                      key={stock.id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm text-gray-900">{stock.name}</td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-xs text-gray-700">
                        ₩{price.toFixed(2)}
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-xs text-gray-700">
                        {quantity.toLocaleString('ko-KR')}주
                      </td>
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-right font-bold text-xs sm:text-sm text-purple-600">
                        ₩{value.toLocaleString('ko-KR', {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-gray-200 font-semibold">
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-700" colSpan="3">
                    현금
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-xs sm:text-sm text-blue-600">
                    ₩{portfolio.cash.toLocaleString('ko-KR')}
                  </td>
                </tr>
                <tr className="border-t-2 border-purple-300 font-bold bg-gradient-to-r from-purple-50 to-pink-50">
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-900" colSpan="3">
                    총 자산
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-right gradient-text text-base sm:text-lg md:text-xl">
                    ₩{totalAsset.toLocaleString('ko-KR', {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
              </motion.div>
            )}
            {activeTab === 'rank' && (
              <motion.div
                key="rank"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  {rankList.length > 0 ? (
                    <table className="w-full min-w-[400px] sm:min-w-0">
                      <thead>
                        <tr className="border-b-2 border-gray-300">
                          <th className="text-center py-3 px-4 text-gray-600 font-semibold text-sm uppercase tracking-wider">
                            순위
                          </th>
                          <th className="text-left py-3 px-4 text-gray-600 font-semibold text-sm uppercase tracking-wider">
                            닉네임
                          </th>
                          <th className="text-right py-3 px-4 text-gray-600 font-semibold text-sm uppercase tracking-wider">
                            총 자산
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankList.map((player) => (
                          <tr
                            key={player.rank}
                            className={`border-b border-gray-100 transition-colors ${
                              player.isMe
                                ? 'bg-gradient-to-r from-purple-50 to-pink-50 font-semibold'
                                : 'hover:bg-gray-50'
                            } ${
                              player.rank === 1
                                ? 'bg-gradient-to-r from-yellow-50 to-transparent'
                                : player.rank === 2
                                ? 'bg-gradient-to-r from-gray-50 to-transparent'
                                : player.rank === 3
                                ? 'bg-gradient-to-r from-orange-50 to-transparent'
                                : ''
                            }`}
                          >
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-center">
                              <div className="flex items-center justify-center gap-1 sm:gap-2">
                                {player.rank === 1 ? (
                                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />
                                ) : player.rank === 2 ? (
                                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                ) : player.rank === 3 ? (
                                  <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                                ) : (
                                  <Medal className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500" />
                                )}
                                <span
                                  className={`font-bold text-xs sm:text-sm ${
                                    player.rank === 1
                                      ? 'text-yellow-600'
                                      : player.rank === 2
                                      ? 'text-gray-600'
                                      : player.rank === 3
                                      ? 'text-orange-600'
                                      : 'text-purple-600'
                                  }`}
                                >
                                  {player.rank}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4">
                              <div className="flex items-center gap-1 sm:gap-2">
                                {player.isMe && (
                                  <span className="text-purple-600 font-bold text-xs sm:text-sm">👑</span>
                                )}
                                {player.rank === 1 && !player.isMe && (
                                  <span className="text-yellow-600 text-xs sm:text-sm">👑</span>
                                )}
                                <span
                                  className={`text-xs sm:text-sm ${
                                    player.isMe ? 'text-purple-700 font-semibold' : 'text-gray-900'
                                  }`}
                                >
                                  {player.nickname}
                                </span>
                                {player.isMe && (
                                  <span className="text-[10px] sm:text-xs text-purple-600 bg-purple-100 px-1.5 sm:px-2 py-0.5 rounded-full">
                                    나
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 sm:py-3 px-2 sm:px-4 text-right">
                              <span
                                className={`font-bold text-xs sm:text-sm ${
                                  player.isMe
                                    ? 'text-purple-600'
                                    : player.rank === 1
                                    ? 'text-yellow-600'
                                    : player.rank === 2
                                    ? 'text-gray-600'
                                    : player.rank === 3
                                    ? 'text-orange-600'
                                    : 'text-gray-700'
                                }`}
                              >
                                ₩{player.totalAsset.toLocaleString('ko-KR', {
                                  maximumFractionDigits: 0,
                                })}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <p className="text-sm sm:text-base">
                        아직 순위 정보가 없습니다.
                      </p>
                      <p className="text-xs sm:text-sm mt-2">
                        게임이 시작되면 순위가 표시됩니다.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

          {/* 뉴스 모달 */}
          <NewsModal
            isOpen={showNewsModal}
            headline={gameState.currentNews || ''}
            onClose={() => setShowNewsModal(false)}
          />

          {/* 뉴스 티커 */}
          {gameState.isGameStarted && !gameState.isWaitingMode && (
            <NewsTicker headline={gameState.currentNews || ''} />
          )}
        </div>
        </>
      )}

      {/* 거래 모달 */}
      {tradeModal && (() => {
        const stock = STOCKS.find(s => s.id === tradeModal.stockId);
        const price = gameState.stockPrices[tradeModal.stockId] || stock?.basePrice || 0;
        const quantity = portfolio.stocks?.[tradeModal.stockId] || 0;
        const maxBuyable = calculateMaxBuyable(tradeModal.stockId);

        return (
          <TradeModal
            isOpen={!!tradeModal}
            onClose={() => setTradeModal(null)}
            stock={stock}
            price={price}
            quantity={quantity}
            maxBuyable={maxBuyable}
            currentCash={portfolio.cash || 0}
            onBuy={(qty) => {
              requestBuyStock(tradeModal.stockId, qty);
            }}
            onSell={(qty) => {
              requestSellStock(tradeModal.stockId, qty);
            }}
          />
        );
      })()}

      {/* 거래 확인 모달 */}
      {confirmModal && (() => {
        const stock = STOCKS.find(s => s.id === confirmModal.stockId);
        const price = gameState.stockPrices[confirmModal.stockId] || stock?.basePrice || 0;
        const totalAmount = price * confirmModal.quantity;
        const currentQuantity = portfolio.stocks?.[confirmModal.stockId] || 0;

        return (
          <TransactionConfirmModal
            isOpen={!!confirmModal}
            onClose={() => setConfirmModal(null)}
            onConfirm={() => {
              if (confirmModal.type === 'buy') {
                handleBuyStock(confirmModal.stockId, confirmModal.quantity);
              } else {
                handleSellStock(confirmModal.stockId, confirmModal.quantity);
              }
            }}
            type={confirmModal.type}
            stockName={stock?.name || ''}
            quantity={confirmModal.quantity}
            price={price}
            totalAmount={totalAmount}
            currentCash={portfolio.cash || 0}
            currentQuantity={currentQuantity}
          />
        );
      })()}

      {/* Toast 알림 */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

