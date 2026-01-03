import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, TrendingUp, TrendingDown, LogIn, Clock, Edit2, X, Check, Trophy, Medal, Newspaper, Lightbulb, Gift, BarChart3, Wallet, List } from 'lucide-react';
import { useSocketSync } from '../hooks/useSocketSync';
import { useToast } from '../hooks/useToast';
import NewsModal from '../components/NewsModal';
import NewsTicker from '../components/NewsTicker';
import StockCard from '../components/StockCard';
import Toast from '../components/Toast';
import { STOCKS, initialScenarios } from '../data/initialScenarios';

const INITIAL_CASH = 10000;
const STORAGE_KEY = 'mz_investment_portfolio';
const NICKNAME_STORAGE_KEY = 'mz_investment_nickname';

export default function PlayerPage() {
  const { gameState, connected, playerActions, playerRank, rankList, setBonusPointsCallback, setTransactionErrorCallback, setHintsUpdateCallback, setTradeExecutedCallback, setNicknameErrorCallback, socket } = useSocketSync(false);
  const [nickname, setNickname] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showNicknameChange, setShowNicknameChange] = useState(false);
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [previousRound, setPreviousRound] = useState(-1);
  const [previousPracticeMode, setPreviousPracticeMode] = useState(false);
  const [hasAttemptedAutoLogin, setHasAttemptedAutoLogin] = useState(false); // 자동 로그인 시도 여부
  const [isUserTyping, setIsUserTyping] = useState(false); // 사용자가 입력 중인지 여부
  const { toasts, removeToast, success, info, error } = useToast();
  const [portfolio, setPortfolio] = useState({
    cash: INITIAL_CASH,
    stocks: {},
    bonusPoints: 0,
    totalAsset: INITIAL_CASH,
  });
  const [transactionError, setTransactionError] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'portfolio', 'rank', 'news', 'hints'
  const [previousRoundAsset, setPreviousRoundAsset] = useState(INITIAL_CASH); // 이전 라운드 총 자산
  const [previousRoundPrices, setPreviousRoundPrices] = useState({}); // 이전 라운드 주식 가격
  const [hints, setHints] = useState([]); // 보유한 힌트 목록

  // localStorage에서 닉네임 불러오기
  useEffect(() => {
    const savedNickname = localStorage.getItem(NICKNAME_STORAGE_KEY);
    if (savedNickname) {
      setNickname(savedNickname);
    }
  }, []);

  // 자동 로그인: 저장된 닉네임이 있고 연결되었을 때 (한 번만 시도, 사용자가 입력 중이 아닐 때만)
  useEffect(() => {
    const savedNickname = localStorage.getItem(NICKNAME_STORAGE_KEY);
    if (
      connected &&
      playerActions &&
      savedNickname &&
      savedNickname === nickname.trim() && // 저장된 닉네임과 현재 닉네임이 일치할 때만
      !isLoggedIn &&
      !nicknameError &&
      !hasAttemptedAutoLogin && // 아직 자동 로그인을 시도하지 않았을 때만
      !isUserTyping // 사용자가 입력 중이 아닐 때만
    ) {
      // 짧은 지연 후 자동 로그인 시도 (서버 연결 안정화 대기)
      const autoLoginTimer = setTimeout(() => {
        if (
          playerActions && 
          savedNickname && 
          !isLoggedIn && 
          !hasAttemptedAutoLogin &&
          !isUserTyping // 타이머 실행 시점에도 다시 확인
        ) {
          setHasAttemptedAutoLogin(true);
          setNicknameError('');
          playerActions.join(savedNickname, (errorMessage) => {
            // 닉네임 중복 에러 처리
            setNicknameError(errorMessage);
            setIsLoggedIn(false);
          });
        }
      }, 1000); // 지연 시간을 조금 늘림

      return () => clearTimeout(autoLoginTimer);
    }
  }, [connected, playerActions, nickname, isLoggedIn, nicknameError, hasAttemptedAutoLogin, isUserTyping]);

  // 서버에서 포트폴리오 업데이트 수신
  useEffect(() => {
    if (gameState.portfolio) {
      const previousPortfolio = portfolio;
      setPortfolio(gameState.portfolio);
      
      // 포트폴리오를 받으면 로그인 성공으로 간주
      if (!isLoggedIn && nickname.trim() && !nicknameError) {
        localStorage.setItem(NICKNAME_STORAGE_KEY, nickname.trim());
        setIsLoggedIn(true);
      }
    }
  }, [gameState.portfolio, nickname, isLoggedIn, nicknameError, portfolio]);

  // 보너스 포인트 추가 알림 콜백 설정
  useEffect(() => {
    if (setBonusPointsCallback) {
      setBonusPointsCallback((points, totalBonusPoints, source, round) => {
        if (source === 'minigame') {
          const currentRound = (round !== undefined ? round : gameState.currentRound) + 1;
          success(
            '미니게임 성공!',
            `${currentRound}라운드 미니게임 성공! ₩${points.toLocaleString('ko-KR')}가 지급됩니다!`,
            5000
          );
        } else {
          success(
            '현금 추가',
            `₩${points.toLocaleString('ko-KR')}가 추가되었습니다.`,
            5000
          );
        }
      });
    }
  }, [setBonusPointsCallback, success, gameState.currentRound]);

  // 거래 오류 알림 콜백 설정
  useEffect(() => {
    if (setTransactionErrorCallback) {
      setTransactionErrorCallback((errorMessage) => {
        error('거래 실패', errorMessage, 4000);
      });
    }
  }, [setTransactionErrorCallback, error]);

  // 힌트 업데이트 콜백 설정
  const previousHintsCountRef = useRef(0);
  const hintsUpdateCallbackRef = useRef(null);
  
  useEffect(() => {
    if (setHintsUpdateCallback) {
      console.log('[PlayerPage] 힌트 업데이트 콜백 설정');
      const callback = (newHints) => {
        console.log('[PlayerPage] 힌트 업데이트 콜백 호출:', newHints);
        const previousCount = previousHintsCountRef.current;
        const hintsArray = Array.isArray(newHints) ? newHints : [];
        console.log('[PlayerPage] 힌트 배열 설정:', hintsArray);
        setHints(hintsArray);
        // 새로운 힌트가 추가되었을 때만 알림
        if (hintsArray.length > previousCount && previousCount >= 0) {
          success('힌트 받음', '새로운 힌트를 받았습니다!', 3000);
        }
        previousHintsCountRef.current = hintsArray.length;
      };
      hintsUpdateCallbackRef.current = callback;
      setHintsUpdateCallback(callback);
    } else {
      console.log('[PlayerPage] setHintsUpdateCallback이 없음');
    }
  }, [setHintsUpdateCallback, success]);
  
  // 초기 힌트 개수 설정
  useEffect(() => {
    previousHintsCountRef.current = hints.length;
  }, [hints.length]);

  // 닉네임 에러 콜백 등록 (관리자 강제 로그아웃 등 처리)
  useEffect(() => {
    if (setNicknameErrorCallback) {
      setNicknameErrorCallback((errorMessage) => {
        console.log('[PlayerPage] 닉네임 에러 콜백 호출:', errorMessage);
        setNicknameError(errorMessage);
        setIsLoggedIn(false);
        setHasAttemptedAutoLogin(false);
        // 관리자에 의한 로그아웃/삭제인 경우 localStorage에서 닉네임 제거
        if (errorMessage.includes('관리자에 의해') || errorMessage.includes('계정이 삭제')) {
          localStorage.removeItem(NICKNAME_STORAGE_KEY);
          error('로그아웃', errorMessage, 5000);
        } else {
          error('오류', errorMessage, 3000);
        }
      });
    }
  }, [setNicknameErrorCallback, error]);

  // 라운드 변경 시 뉴스 모달 표시 및 토스트
  useEffect(() => {
    // 라운드가 실제로 변경되었을 때만 실행
    if (
      gameState.currentRound !== previousRound &&
      gameState.currentRound >= 0 &&
      previousRound >= 0 && // 이전 라운드가 유효한 경우만 (초기 로드 제외)
      gameState.isGameStarted &&
      isLoggedIn
    ) {
      // 이전 라운드의 총 자산 저장
      const currentTotalAsset = portfolio.totalAsset || (portfolio.cash || 0) + (portfolio.bonusPoints || 0) || INITIAL_CASH;
      setPreviousRoundAsset(currentTotalAsset);
      
      // 이전 라운드의 주식 가격 저장
      const currentPrices = {};
      STOCKS.forEach((stock) => {
        const priceHistory = gameState.priceHistory?.[stock.id] || [];
        if (priceHistory.length > 0 && previousRound >= 0) {
          // 이전 라운드의 가격 가져오기
          const prevPrice = priceHistory[previousRound] || priceHistory[priceHistory.length - 1];
          currentPrices[stock.id] = prevPrice;
        } else {
          // priceHistory가 없거나 첫 라운드면 현재 가격을 기본값으로
          currentPrices[stock.id] = gameState.stockPrices[stock.id] || stock.basePrice;
        }
      });
      setPreviousRoundPrices(currentPrices);
      
      setShowNewsModal(true);
      const timer = setTimeout(() => setShowNewsModal(false), 3000);
      
      // 라운드 변경 토스트
      info(
        `라운드 ${gameState.currentRound + 1} 시작`,
        gameState.currentNews || '',
        4000
      );
      
      // 이전 라운드 업데이트는 여기서만 수행
      setPreviousRound(gameState.currentRound);
      
      return () => clearTimeout(timer);
    }
    
    // 초기 로드 시 previousRound만 업데이트 (메시지 표시 안 함)
    if (previousRound === -1 && gameState.currentRound >= 0) {
      setPreviousRound(gameState.currentRound);
    }
  }, [
    gameState.currentRound,
    previousRound,
    gameState.isGameStarted,
    gameState.currentNews,
    isLoggedIn,
    info,
    // portfolio는 의존성에서 제거 (라운드 변경과 무관하게 업데이트될 수 있음)
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



  // 거래 체결 알림 콜백 설정
  useEffect(() => {
    if (setTradeExecutedCallback) {
      setTradeExecutedCallback((data) => {
        const { type, stockName, quantity, averagePrice } = data;
        const typeText = type === 'BUY' ? '매수' : '매도';
        success(
          '주문이 체결되었습니다.',
          `${stockName} / ${quantity}주 / 평단가 ₩${averagePrice.toFixed(2)}`,
          5000
        );
      });
    }
  }, [setTradeExecutedCallback, success]);


  // 총 자산은 서버에서 계산된 값 사용
  const totalAsset = portfolio.totalAsset || (portfolio.cash || 0) + (portfolio.bonusPoints || 0) || INITIAL_CASH;
  
  // 이전 라운드 대비 수익률 계산
  const assetChange = totalAsset - previousRoundAsset;
  const assetChangePercent = previousRoundAsset > 0 
    ? ((assetChange / previousRoundAsset) * 100).toFixed(2)
    : 0;
  const isAssetRising = assetChange > 0;
  const isAssetFalling = assetChange < 0;

  // 로그인 화면
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
        {/* 배경 그라데이션 효과 */}
        <div className="absolute inset-0 bg-white"></div>
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
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-3">
              2025 흔적 주식게임 📈
            </h1>
            <p className="text-gray-600 text-sm sm:text-base md:text-lg">닉네임을 입력하고 게임을 시작하세요</p>
          </div>

          <div className="mb-6">
            <input
              type="text"
              value={nickname}
              onChange={(e) => {
                setIsUserTyping(true); // 사용자가 입력 중임을 표시
                setNickname(e.target.value);
                setNicknameError(''); // 입력 시 에러 메시지 초기화
                // 사용자가 직접 입력하면 자동 로그인 플래그 리셋
                const savedNickname = localStorage.getItem(NICKNAME_STORAGE_KEY);
                if (e.target.value !== savedNickname) {
                  setHasAttemptedAutoLogin(false);
                }
              }}
              onBlur={() => {
                // 입력 필드에서 포커스가 벗어나면 입력 중 상태 해제
                setTimeout(() => setIsUserTyping(false), 500);
              }}
              onFocus={() => {
                // 입력 필드에 포커스가 있으면 입력 중 상태로 설정
                setIsUserTyping(true);
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
      <div className="fixed inset-0 bg-white -z-10"></div>
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
            <div className="bg-white rounded-xl p-6 border border-gray-200">
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

      {/* 라운드 타이머 - 독립적인 고정 위치 (왼쪽 상단) */}
      {gameState.isGameStarted && !gameState.isWaitingMode && gameState.roundTimer !== null && (
        <div className="fixed top-2 left-2 sm:top-4 sm:left-4 z-50">
          <motion.div
            initial={{ opacity: 0, x: -50, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -50, scale: 0.8 }}
            className={`px-2 py-1 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-semibold backdrop-blur-xl ${
              gameState.roundTimer <= 60
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : gameState.roundTimer <= 300
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Clock className={`w-4 h-4 sm:w-5 sm:h-5 ${
                  gameState.roundTimer <= 60
                    ? 'text-red-400'
                    : gameState.roundTimer <= 300
                    ? 'text-yellow-400'
                    : 'text-blue-400'
                }`} />
              </motion.div>
              <span>
                {Math.floor(gameState.roundTimer / 60)}:{(gameState.roundTimer % 60).toString().padStart(2, '0')}
              </span>
            </div>
          </motion.div>
        </div>
      )}

      <div className="max-w-5xl mx-auto mt-16 sm:mt-20 md:mt-24">
          {/* 헤더 */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8 sm:mb-10 md:mb-12"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 px-6 sm:px-8 md:px-10 py-4 sm:py-5 md:py-6 rounded-xl sm:rounded-2xl bg-white backdrop-blur-xl border border-gray-200 shadow-lg relative"
            >
              <Calculator className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-purple-400 flex-shrink-0" />
              {showNicknameChange ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={nickname}
                      onChange={(e) => {
                        setNickname(e.target.value);
                        setNicknameError(''); // 입력 시 에러 메시지 초기화
                      }}
                      onKeyPress={(e) => e.key === 'Enter' && handleNicknameChange()}
                      className={`px-4 py-2 border rounded-lg text-gray-900 focus:outline-none text-base sm:text-lg ${
                        nicknameError
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-gray-300 focus:border-purple-500'
                      }`}
                      autoFocus
                    />
                    <button
                      onClick={handleNicknameChange}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
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
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                  <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-gray-900 break-words max-w-[200px] sm:max-w-[300px] md:max-w-[400px]">
                    {nickname}님의 포트폴리오
                  </h1>
                  <button
                    onClick={() => setShowNicknameChange(true)}
                    className="p-2 sm:p-2.5 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors flex-shrink-0"
                    title="닉네임 변경"
                  >
                    <Edit2 className="w-5 h-5 sm:w-6 sm:h-6" />
                  </button>
                </>
              )}
            </motion.div>
            
        </motion.div>

        {/* 총 자산, 현금, 보너스 포인트, 순위 - 간략 버전 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card-modern p-3 sm:p-4 md:p-6 mb-6 sm:mb-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-[120px]">
              <div className="text-xs text-gray-500 mb-1">총 자산</div>
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                ₩{totalAsset.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="flex-1 min-w-[100px]">
              <div className="text-xs text-gray-500 mb-1">현금</div>
              <div className="text-base sm:text-lg md:text-xl font-semibold text-blue-600">
                ₩{((portfolio.cash || 0) + (portfolio.bonusPoints || 0)).toLocaleString('ko-KR')}
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
          className="card-modern p-3 sm:p-4 md:p-6 mb-6 sm:mb-8"
        >
          {/* 탭 버튼 */}
          <div className="flex gap-1 sm:gap-2 mb-6 sm:mb-8 border-b border-gray-200 overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
            <button
              onClick={() => setActiveTab('info')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm md:text-base font-semibold transition-all border-b-2 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'info'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
              시세
            </button>
            <button
              onClick={() => setActiveTab('portfolio')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm md:text-base font-semibold transition-all border-b-2 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'portfolio'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
              내 자산
            </button>
            <button
              onClick={() => setActiveTab('rank')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm md:text-base font-semibold transition-all border-b-2 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'rank'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
              순위
            </button>
            <button
              onClick={() => setActiveTab('news')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm md:text-base font-semibold transition-all border-b-2 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'news'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Newspaper className="w-4 h-4 sm:w-5 sm:h-5" />
              뉴스
            </button>
            <button
              onClick={() => setActiveTab('hints')}
              className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm md:text-base font-semibold transition-all border-b-2 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'hints'
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Lightbulb className="w-4 h-4 sm:w-5 sm:h-5" />
              힌트
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {STOCKS.map((stock, index) => {
                    const price = gameState.stockPrices[stock.id] || stock.basePrice;
                    const priceHistory = gameState.priceHistory?.[stock.id] || [stock.basePrice];
                    const changePercent =
                      gameState.currentRound > 0
                        ? ((price - stock.basePrice) / stock.basePrice) * 100
                        : 0;
                    
                    return (
                      <motion.div
                        key={stock.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
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
                  <th className="text-right py-3 px-4 text-gray-600 font-semibold text-sm uppercase tracking-wider">
                    수익률
                  </th>
                </tr>
              </thead>
              <tbody>
                {STOCKS.map((stock) => {
                  const price =
                    gameState.stockPrices[stock.id] || stock.basePrice;
                  const quantity = portfolio.stocks?.[stock.id] || 0;
                  const value = quantity * price;
                  
                  // 매수 평균가 가져오기
                  const averageBuyPrice = portfolio.averageBuyPrices?.[stock.id];
                  
                  let profitRate = 0;
                  let isProfit = false;
                  let isLoss = false;
                  
                  // 매수 평균가가 있으면 수익률 계산
                  if (averageBuyPrice && averageBuyPrice > 0 && quantity > 0) {
                    const profit = price - averageBuyPrice;
                    profitRate = ((profit / averageBuyPrice) * 100);
                    isProfit = profit > 0;
                    isLoss = profit < 0;
                  }

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
                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-right">
                        {averageBuyPrice && averageBuyPrice > 0 && quantity > 0 ? (
                          <div className="flex items-center justify-end gap-1">
                            {isProfit ? (
                              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                            ) : isLoss ? (
                              <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                            ) : null}
                            <span className={`text-xs sm:text-sm font-semibold ${
                              isProfit ? 'text-green-600' :
                              isLoss ? 'text-red-600' :
                              'text-gray-600'
                            }`}>
                              {profitRate > 0 ? '+' : ''}{profitRate.toFixed(2)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-gray-200 font-semibold">
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-700" colSpan="4">
                    현금
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-xs sm:text-sm text-blue-600">
                    ₩{((portfolio.cash || 0) + (portfolio.bonusPoints || 0)).toLocaleString('ko-KR')}
                  </td>
                </tr>
                <tr className="border-t-2 border-gray-300 font-bold bg-white">
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-900" colSpan="4">
                    총 자산
                    {gameState.currentRound > 0 && (
                      <span className="ml-2 flex items-center gap-1 text-xs font-normal">
                        {isAssetRising ? (
                          <>
                            <TrendingUp className="w-3 h-3 text-green-600" />
                            <span className="text-green-600">
                              +₩{Math.abs(assetChange).toLocaleString('ko-KR', { maximumFractionDigits: 0 })} ({assetChangePercent}%)
                            </span>
                          </>
                        ) : isAssetFalling ? (
                          <>
                            <TrendingDown className="w-3 h-3 text-red-600" />
                            <span className="text-red-600">
                              -₩{Math.abs(assetChange).toLocaleString('ko-KR', { maximumFractionDigits: 0 })} ({Math.abs(assetChangePercent)}%)
                            </span>
                          </>
                        ) : (
                          <span className="text-gray-500">변동 없음</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-gray-900 text-base sm:text-lg md:text-xl font-bold">
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
                                ? 'bg-white font-semibold'
                                : 'hover:bg-gray-50'
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

            {activeTab === 'news' && (
              <motion.div
                key="news"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                      라운드별 뉴스
                    </h3>
                    <p className="text-sm text-gray-600">
                      현재 라운드: {gameState.currentRound + 1}
                    </p>
                  </div>
                  
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {initialScenarios
                      .filter((scenario, index) => index <= gameState.currentRound)
                      .map((scenario, filteredIndex) => {
                        const index = filteredIndex;
                        const isCurrentRound = index === gameState.currentRound;
                        const isPastRound = index < gameState.currentRound;
                        
                        return (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              isCurrentRound
                                ? 'bg-white border-purple-400 shadow-md'
                                : 'bg-white border-gray-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                    isCurrentRound
                                      ? 'bg-purple-500 text-white'
                                      : 'bg-gray-400 text-white'
                                  }`}>
                                    라운드 {index + 1} ({scenario.month})
                                  </span>
                                  {isCurrentRound && (
                                    <span className="px-2 py-1 rounded text-xs font-semibold bg-green-500 text-white animate-pulse">
                                      현재
                                    </span>
                                  )}
                                </div>
                                <p className={`text-sm sm:text-base ${
                                  isCurrentRound
                                    ? 'font-semibold text-gray-900'
                                    : 'text-gray-700'
                                }`}>
                                  {scenario.headline}
                                </p>
                              </div>
                              {isCurrentRound && (
                                <Newspaper className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500 flex-shrink-0" />
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'hints' && (
              <motion.div
                key="hints"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="space-y-6">
                  {/* 보유 힌트 목록 */}
                  <div>
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Gift className="w-5 h-5 sm:w-6 sm:h-6" />
                      보유 힌트 ({Array.isArray(hints) ? hints.length : 0}개)
                    </h3>
                    {!hints || !Array.isArray(hints) || hints.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <Lightbulb className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-sm sm:text-base text-gray-500">
                          아직 보유한 힌트가 없습니다.
                        </p>
                        <p className="text-xs sm:text-sm text-gray-400 mt-2">
                          힌트를 구매하시면 여기에 표시됩니다. 힌트 상점을 이용해보세요!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-[500px] overflow-y-auto">
                        {(() => {
                          // 힌트를 라운드별로 그룹화
                          const validHints = Array.isArray(hints) ? hints : [];
                          const hintsByRound = validHints.reduce((acc, hint) => {
                            const round = hint.round !== undefined ? hint.round : 0;
                            if (!acc[round]) {
                              acc[round] = [];
                            }
                            acc[round].push(hint);
                            return acc;
                          }, {});
                          
                          // 라운드 번호를 내림차순으로 정렬 (최신 라운드가 위에)
                          const sortedRounds = Object.keys(hintsByRound)
                            .map(Number)
                            .sort((a, b) => b - a);
                          
                          return sortedRounds.map((round) => {
                            const roundHints = hintsByRound[round];
                            const isCurrentRound = round === gameState.currentRound;
                            
                            return (
                              <div key={round} className="space-y-2">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className={`text-sm font-bold ${
                                    isCurrentRound ? 'text-purple-600' : 'text-gray-600'
                                  }`}>
                                    라운드 {round + 1}
                                  </h4>
                                  {isCurrentRound && (
                                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700">
                                      현재
                                    </span>
                                  )}
                                  <span className="text-xs text-gray-400">
                                    ({roundHints.length}개)
                                  </span>
                                </div>
                                <div className="space-y-2 pl-2 border-l-2 border-gray-200">
                                  {roundHints.map((hint, index) => (
                                    <motion.div
                                      key={index}
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: index * 0.05 }}
                                      className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-gray-300 transition-colors"
                                    >
                                      <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-lg ${
                                          hint.difficulty === '상' ? 'bg-red-100 text-red-600' :
                                          hint.difficulty === '중' ? 'bg-yellow-100 text-yellow-600' :
                                          'bg-green-100 text-green-600'
                                        }`}>
                                          <Lightbulb className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                              hint.difficulty === '상' ? 'bg-red-500 text-white' :
                                              hint.difficulty === '중' ? 'bg-yellow-500 text-white' :
                                              'bg-green-500 text-white'
                                            }`}>
                                              {hint.difficulty}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                              {new Date(hint.receivedAt).toLocaleString('ko-KR')}
                                            </span>
                                          </div>
                                          <p className="text-sm text-gray-800 font-medium">
                                            {hint.content || '힌트 내용이 아직 없습니다.'}
                                          </p>
                                        </div>
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
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


      {/* Toast 알림 */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

