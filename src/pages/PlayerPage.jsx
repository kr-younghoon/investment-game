import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  LogIn,
  Clock,
  Edit2,
  X,
  Check,
  Trophy,
  Medal,
  Newspaper,
  Lightbulb,
  Gift,
  BarChart3,
  Wallet,
  List,
  FileText,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  Gamepad2,
} from 'lucide-react';
import { useSocketSync } from '../hooks/useSocketSync';
import { useToast } from '../hooks/useToast';
import NewsModal from '../components/NewsModal';
import NewsTicker from '../components/NewsTicker';
import StockCard from '../components/StockCard';
import TradeModal from '../components/TradeModal';
import Toast from '../components/Toast';
import {
  initialScenarios,
  practiceScenarios,
} from '../data/initialScenarios';
import { getActiveStocks } from '../../shared/getActiveStocks';
import {
  playCountdownSound,
  playRoundStartSound,
  playBuySound,
  playSellSound,
  playHintSound,
} from '../utils/sounds';

const INITIAL_CASH = 3000000; // 3,000,000 포인트
const STORAGE_KEY = 'mz_investment_portfolio';
const NICKNAME_STORAGE_KEY = 'mz_investment_nickname';

export default function PlayerPage() {
  const {
    gameState,
    connected,
    playerActions,
    playerRank,
    rankList,
    playerTransactions,
    setBonusPointsCallback,
    setTransactionErrorCallback,
    setHintsUpdateCallback,
    setRumorUpdateCallback,
    setTradeExecutedCallback,
    setNicknameErrorCallback,
    setMinigameSuccessCallback,
    socket,
  } = useSocketSync(false, false);
  const [nickname, setNickname] = useState('');
  const [hideGameOverScreen, setHideGameOverScreen] =
    useState(false); // 게임 종료 화면 숨김 여부
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showNicknameChange, setShowNicknameChange] =
    useState(false);
  const [showNewsModal, setShowNewsModal] = useState(false);
  const [selectedRoundNews, setSelectedRoundNews] =
    useState(null); // 뉴스 탭에서 선택한 라운드 정보
  const [previousRound, setPreviousRound] = useState(-1);
  const [previousPracticeMode, setPreviousPracticeMode] =
    useState(false);
  const [hasAttemptedAutoLogin, setHasAttemptedAutoLogin] =
    useState(false); // 자동 로그인 시도 여부
  const [isUserTyping, setIsUserTyping] = useState(false); // 사용자가 입력 중인지 여부
  const { toasts, removeToast, success, info, error } =
    useToast();
  const [portfolio, setPortfolio] = useState({
    cash: INITIAL_CASH,
    stocks: {},
    bonusPoints: 0,
    totalAsset: INITIAL_CASH,
  });
  const [transactionError, setTransactionError] =
    useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'portfolio', 'rank', 'news', 'hints'
  const [previousRoundAsset, setPreviousRoundAsset] =
    useState(INITIAL_CASH); // 이전 라운드 총 자산
  const [hints, setHints] = useState([]); // 보유한 힌트 목록
  const [selectedStock, setSelectedStock] = useState(null); // 거래 모달용 선택된 주식
  const [currentRumor, setCurrentRumor] = useState(null); // 현재 찌라시
  const [showTradeModal, setShowTradeModal] =
    useState(false); // 거래 모달 표시 여부
  const [showTutorialModal, setShowTutorialModal] =
    useState(false); // 튜토리얼 모달 표시 여부
  const [tutorialStep, setTutorialStep] = useState(0); // 튜토리얼 단계
  const wasDisconnectedRef = useRef(false); // 재연결 감지용

  // 현재 게임에서 사용 중인 주식 목록 - 공유 유틸리티 사용
  const activeStocks = getActiveStocks(gameState);

  // 거래 내역 탭이 활성화되면 자동으로 요청
  const hasRequestedTransactionsRef = useRef(false);
  useEffect(() => {
    if (
      activeTab === 'transactions' &&
      isLoggedIn &&
      playerActions?.requestTransactions &&
      !hasRequestedTransactionsRef.current
    ) {
      console.log('[PlayerPage] 거래 내역 요청');
      hasRequestedTransactionsRef.current = true;
      playerActions.requestTransactions();
    }
    // 탭이 변경되면 리셋
    if (activeTab !== 'transactions') {
      hasRequestedTransactionsRef.current = false;
    }
  }, [activeTab, isLoggedIn, playerActions]);

  // localStorage에서 닉네임 및 포트폴리오 불러오기
  useEffect(() => {
    try {
      const savedNickname = localStorage.getItem(
        NICKNAME_STORAGE_KEY
      );
      if (savedNickname) {
        setNickname(savedNickname);

        // 저장된 포트폴리오 불러오기 (오프라인 상태에서도 자산 표시)
        const portfolioKey = `${STORAGE_KEY}_${savedNickname}`;
        const savedPortfolio =
          localStorage.getItem(portfolioKey);
        if (savedPortfolio) {
          try {
            const parsedPortfolio =
              JSON.parse(savedPortfolio);
            setPortfolio(parsedPortfolio);
            if (parsedPortfolio.totalAsset) {
              setPreviousRoundAsset(
                parsedPortfolio.totalAsset
              );
            }
          } catch (parseError) {
            console.error(
              '포트폴리오 데이터 파싱 오류:',
              parseError
            );
          }
        }

        // 저장된 힌트 불러오기 (오프라인 상태에서도 힌트 표시)
        const hintsKey = `${STORAGE_KEY}_hints_${savedNickname}`;
        const savedHints = localStorage.getItem(hintsKey);
        if (savedHints) {
          try {
            const parsedHints = JSON.parse(savedHints);
            setHints(parsedHints);
          } catch (parseError) {
            console.error('힌트 데이터 파싱 오류:', parseError);
          }
        }
      }
    } catch (storageError) {
      // localStorage 접근 불가 (private browsing 등)
      console.warn('localStorage 접근 불가:', storageError.message);
    }
  }, []);

  // 소켓 연결 상태 감지하여 자동 로그인 시도 가능 상태로 리셋
  useEffect(() => {
    if (!connected) {
      setHasAttemptedAutoLogin(false);
    }
  }, [connected]);

  // 재연결 감지 → 토스트 표시
  useEffect(() => {
    if (!connected) {
      wasDisconnectedRef.current = true;
    } else if (connected && wasDisconnectedRef.current) {
      wasDisconnectedRef.current = false;
      if (isLoggedIn) {
        info('재연결됨', '서버에 다시 연결되었습니다.', 3000);
      }
    }
  }, [connected, isLoggedIn, info]);

  // 자동 로그인: 저장된 닉네임이 있고 연결되었을 때 (한 번만 시도, 사용자가 입력 중이 아닐 때만)
  useEffect(() => {
    const savedNickname = localStorage.getItem(
      NICKNAME_STORAGE_KEY
    );
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
          playerActions.join(
            savedNickname,
            (errorMessage) => {
              // 닉네임 중복 에러 처리
              setNicknameError(errorMessage);
              setIsLoggedIn(false);
            }
          );
        }
      }, 1000); // 지연 시간을 조금 늘림

      return () => clearTimeout(autoLoginTimer);
    }
  }, [
    connected,
    playerActions,
    nickname,
    isLoggedIn,
    nicknameError,
    hasAttemptedAutoLogin,
    isUserTyping,
  ]);

  // 서버에서 포트폴리오 업데이트 수신
  useEffect(() => {
    if (gameState.portfolio) {
      const previousPortfolio = portfolio;
      setPortfolio(gameState.portfolio);

      // 포트폴리오를 받으면 로그인 성공으로 간주
      if (
        !isLoggedIn &&
        nickname.trim() &&
        !nicknameError
      ) {
        localStorage.setItem(
          NICKNAME_STORAGE_KEY,
          nickname.trim()
        );
        setIsLoggedIn(true);
      }

      // 포트폴리오를 localStorage에 저장 (오프라인 상태에서도 자산 표시)
      if (nickname.trim()) {
        const portfolioKey = `${STORAGE_KEY}_${nickname.trim()}`;
        try {
          localStorage.setItem(
            portfolioKey,
            JSON.stringify(gameState.portfolio)
          );
        } catch (error) {
          console.error('포트폴리오 저장 오류:', error);
        }
      }
    }
  }, [
    gameState.portfolio,
    nickname,
    isLoggedIn,
    nicknameError,
    portfolio,
  ]);

  // 게임 재시작 시 게임 종료 화면 숨김 상태 리셋
  useEffect(() => {
    // 게임이 시작되었거나 종료되지 않았으면 게임 종료 화면 숨김 상태 리셋
    if (gameState.isGameStarted || !gameState.isGameEnded) {
      setHideGameOverScreen(false);
    }
  }, [gameState.isGameEnded, gameState.isGameStarted]);

  // 보너스 포인트 추가 알림 콜백 설정
  useEffect(() => {
    if (setBonusPointsCallback) {
      setBonusPointsCallback(
        (points, totalBonusPoints, source, round) => {
          if (source === 'minigame') {
            const currentRound =
              (round !== undefined
                ? round
                : gameState.currentRound) + 1;
            success(
              '미니게임 성공!',
              `${currentRound}라운드 미니게임 성공! ₩${points.toLocaleString(
                'ko-KR'
              )}가 지급됩니다!`,
              5000
            );
          } else {
            success(
              '현금 추가',
              `₩${points.toLocaleString(
                'ko-KR'
              )}가 추가되었습니다.`,
              5000
            );
          }
        }
      );
    }
  }, [
    setBonusPointsCallback,
    success,
    gameState.currentRound,
  ]);

  // 거래 오류 알림 콜백 설정
  useEffect(() => {
    if (setTransactionErrorCallback) {
      setTransactionErrorCallback((errorMessage) => {
        error('거래 실패', errorMessage, 4000);
      });
    }
  }, [setTransactionErrorCallback, error]);

  // 찌라시 수신
  useEffect(() => {
    if (setRumorUpdateCallback) {
      setRumorUpdateCallback((data) => {
        console.log('[PlayerPage] 찌라시 수신:', data);
        setCurrentRumor(data);
        info('📰 찌라시 도착!', data.rumor, 5000);
      });
    }
    return () => {
      if (setRumorUpdateCallback) {
        setRumorUpdateCallback(null);
      }
    };
  }, [setRumorUpdateCallback, info]);

  // 힌트 업데이트 콜백 설정
  const previousHintsCountRef = useRef(0);
  const hintsUpdateCallbackRef = useRef(null);

  useEffect(() => {
    if (
      setHintsUpdateCallback &&
      !hintsUpdateCallbackRef.current
    ) {
      // 콜백이 이미 설정되어 있지 않을 때만 설정
      const callback = (newHints) => {
        const previousCount = previousHintsCountRef.current;
        const hintsArray = Array.isArray(newHints)
          ? newHints
          : [];
        console.log(
          `[PlayerPage] 힌트 업데이트 콜백 호출 - ${hintsArray.length}개 힌트 수신`,
          hintsArray.map((h) => ({
            difficulty: h.difficulty,
            round: h.round,
          }))
        );
        setHints(hintsArray);

        // 힌트를 localStorage에 저장 (오프라인 상태에서도 힌트 표시)
        const currentNickname =
          nickname.trim() ||
          localStorage.getItem(NICKNAME_STORAGE_KEY);
        if (currentNickname) {
          const hintsKey = `${STORAGE_KEY}_hints_${currentNickname}`;
          try {
            localStorage.setItem(
              hintsKey,
              JSON.stringify(hintsArray)
            );
          } catch (error) {
            console.error('힌트 저장 오류:', error);
          }
        }
        // 새로운 힌트가 추가되었을 때만 알림
        if (
          hintsArray.length > previousCount &&
          previousCount >= 0
        ) {
          // 힌트 도착 사운드 재생
          playHintSound();
          success(
            '힌트 받음',
            '새로운 힌트를 받았습니다!',
            3000
          );
        }
        previousHintsCountRef.current = hintsArray.length;
      };
      hintsUpdateCallbackRef.current = callback;
      setHintsUpdateCallback(callback);
    }
    // cleanup 함수: 컴포넌트 언마운트 시 콜백 제거
    return () => {
      if (
        setHintsUpdateCallback &&
        hintsUpdateCallbackRef.current
      ) {
        setHintsUpdateCallback(null);
        hintsUpdateCallbackRef.current = null;
      }
    };
  }, [setHintsUpdateCallback, success]); // nickname 의존성 제거

  // 초기 힌트 개수 설정
  useEffect(() => {
    previousHintsCountRef.current = hints.length;
  }, [hints.length]);

  // 닉네임 에러 콜백 등록 (관리자 강제 로그아웃 등 처리)
  useEffect(() => {
    if (setNicknameErrorCallback) {
      setNicknameErrorCallback((errorMessage) => {
        console.log(
          '[PlayerPage] 닉네임 에러 콜백 호출:',
          errorMessage
        );
        setNicknameError(errorMessage);
        setIsLoggedIn(false);
        setHasAttemptedAutoLogin(false);
        // 관리자에 의한 로그아웃/삭제인 경우 localStorage에서 닉네임 제거
        if (
          errorMessage.includes('관리자에 의해') ||
          errorMessage.includes('계정이 삭제')
        ) {
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
    // 0라운드에서는 뉴스를 표시하지 않음 (1라운드부터 뉴스 표시)
    if (
      gameState.currentRound !== previousRound &&
      gameState.currentRound > 0 && // 0라운드가 아닐 때만 뉴스 표시
      previousRound >= 0 && // 이전 라운드가 유효한 경우만 (초기 로드 제외)
      gameState.isGameStarted &&
      isLoggedIn
    ) {
      // 이전 라운드의 총 자산 저장
      const currentTotalAsset =
        portfolio.totalAsset ||
        (portfolio.cash || 0) +
          (portfolio.bonusPoints || 0) ||
        INITIAL_CASH;
      setPreviousRoundAsset(currentTotalAsset);

      // 이전 라운드의 주식 가격 저장
      const currentPrices = {};
      activeStocks.forEach((stock) => {
        const priceHistory =
          gameState.priceHistory?.[stock.id] || [];
        if (priceHistory.length > 0 && previousRound >= 0) {
          // 이전 라운드의 가격 가져오기
          const prevPrice =
            priceHistory[previousRound] ||
            priceHistory[priceHistory.length - 1];
          currentPrices[stock.id] = prevPrice;
        } else {
          // priceHistory가 없거나 첫 라운드면 현재 가격을 기본값으로
          currentPrices[stock.id] =
            gameState.stockPrices[stock.id] ||
            stock.basePrice;
        }
      });

      setShowNewsModal(true);

      // 라운드 시작 사운드 재생
      playRoundStartSound();

      // 마지막 라운드가 아니면 3초 후 자동으로 닫기
      if (!gameState.isLastRound) {
        const timer = setTimeout(
          () => setShowNewsModal(false),
          3000
        );

        // 라운드 변경 토스트
        info(
          `라운드 ${gameState.currentRound + 1} 시작`,
          gameState.currentNews || '',
          4000
        );

        // 이전 라운드 업데이트는 여기서만 수행
        setPreviousRound(gameState.currentRound);

        return () => clearTimeout(timer);
      } else {
        // 마지막 라운드: 자동으로 닫지 않음, "다음" 버튼으로만 닫기
        // 이전 라운드 업데이트는 여기서만 수행
        setPreviousRound(gameState.currentRound);
      }
    }

    // 초기 로드 시 previousRound만 업데이트 (메시지 표시 안 함)
    if (
      previousRound === -1 &&
      gameState.currentRound >= 0
    ) {
      setPreviousRound(gameState.currentRound);
    }
  }, [
    gameState.currentRound,
    previousRound,
    gameState.isGameStarted,
    gameState.isLastRound,
    gameState.currentNews,
    isLoggedIn,
    info,
    // portfolio는 의존성에서 제거 (라운드 변경과 무관하게 업데이트될 수 있음)
  ]);

  // 마지막 라운드 플래그 변경 시 뉴스 모달 표시
  useEffect(() => {
    if (
      gameState.isLastRound &&
      gameState.currentNews &&
      gameState.isGameStarted &&
      isLoggedIn &&
      !showNewsModal
    ) {
      setShowNewsModal(true);
    }
  }, [
    gameState.isLastRound,
    gameState.currentNews,
    gameState.isGameStarted,
    isLoggedIn,
    showNewsModal,
  ]);

  // 카운트다운 사운드 재생
  const previousCountdownRef = useRef(null);
  useEffect(() => {
    if (
      gameState.countdown !== null &&
      gameState.countdown > 0 &&
      gameState.countdown !== previousCountdownRef.current
    ) {
      // 카운트다운이 변경될 때마다 사운드 재생
      playCountdownSound();
      previousCountdownRef.current = gameState.countdown;
    }
  }, [gameState.countdown]);

  // 연습 모드 전환 감지
  useEffect(() => {
    if (
      previousPracticeMode !== undefined &&
      gameState.isPracticeMode !== previousPracticeMode
    ) {
      if (
        gameState.isPracticeMode &&
        gameState.isGameStarted
      ) {
        // 연습 모드가 시작되면 튜토리얼 모달 표시
        setShowTutorialModal(true);
        setTutorialStep(0);
        success(
          '연습 모드 시작',
          '주식 거래 튜토리얼이 시작되었습니다.',
          4000
        );
      } else if (previousPracticeMode) {
        success(
          '실제 게임 시작',
          `연습 모드가 종료되고 ${
            initialScenarios.length + 1
          }라운드 실제 게임이 시작되었습니다.`,
          4000
        );
      }
    }
    setPreviousPracticeMode(gameState.isPracticeMode);
  }, [
    gameState.isPracticeMode,
    previousPracticeMode,
    gameState.isGameStarted,
    success,
  ]);

  // 로그인 처리
  const handleLogin = () => {
    if (nickname.trim()) {
      setNicknameError('');
      if (playerActions) {
        // 에러 콜백 설정
        playerActions.join(
          nickname.trim(),
          (errorMessage) => {
            // 닉네임 중복 에러 처리
            setNicknameError(errorMessage);
            setIsLoggedIn(false);
          }
        );
        // 성공은 포트폴리오 업데이트를 받으면 자동으로 처리됨 (useEffect에서)
        // 하지만 서버 응답이 느릴 수 있으므로, 짧은 지연 후에도 체크
        setTimeout(() => {
          if (!nicknameError && gameState.portfolio) {
            localStorage.setItem(
              NICKNAME_STORAGE_KEY,
              nickname.trim()
            );
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
        playerActions.join(
          nickname.trim(),
          (errorMessage) => {
            // 닉네임 중복 에러 처리
            setNicknameError(errorMessage);
            setShowNicknameChange(true); // 편집 모드 유지
          }
        );
        // 성공은 포트폴리오 업데이트를 받으면 자동으로 처리됨
        // 에러가 없으면 변경 성공으로 간주하고 편집 모드 종료
        setTimeout(() => {
          if (!nicknameError) {
            localStorage.setItem(
              NICKNAME_STORAGE_KEY,
              nickname.trim()
            );
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
        const { type, stockName, quantity, averagePrice } =
          data;
        const typeText = type === 'BUY' ? '매수' : '매도';

        // 거래 체결 사운드 재생
        if (type === 'BUY') {
          playBuySound();
        } else {
          playSellSound();
        }

        success(
          `${typeText} 주문이 체결되었습니다.`,
          `${stockName} / ${quantity}주 / 평단가 ₩${
            averagePrice % 1 === 0
              ? averagePrice.toLocaleString('ko-KR')
              : averagePrice.toFixed(2).replace(/\.0+$/, '')
          }`,
          5000
        );
      });
    }
  }, [setTradeExecutedCallback, success]);

  // 미니게임 성공 알림 콜백 설정
  useEffect(() => {
    if (setMinigameSuccessCallback) {
      setMinigameSuccessCallback((data) => {
        const { rewardAmount, message } = data;
        success(
          '🎮 미니게임 성공!',
          message ||
            `₩${rewardAmount.toLocaleString(
              'ko-KR'
            )} 보상을 받았습니다!`,
          5000
        );
      });
    }
    return () => {
      if (setMinigameSuccessCallback) {
        setMinigameSuccessCallback(null);
      }
    };
  }, [setMinigameSuccessCallback, success]);

  // 총 자산은 서버에서 계산된 값 사용 (nullish coalescing으로 0 값 보존)
  const computedAsset = portfolio.totalAsset ?? ((portfolio.cash ?? 0) + (portfolio.bonusPoints ?? 0));
  const totalAsset = computedAsset || INITIAL_CASH;

  // 이전 라운드 대비 수익률 계산
  const assetChange = totalAsset - previousRoundAsset;
  const assetChangePercentValue =
    previousRoundAsset > 0
      ? (assetChange / previousRoundAsset) * 100
      : 0;
  // 수익률 포맷팅 (표시용)
  const assetChangePercent =
    assetChangePercentValue % 1 === 0
      ? assetChangePercentValue.toLocaleString('ko-KR')
      : assetChangePercentValue
          .toFixed(2)
          .replace(/\.0+$/, '');
  const isAssetRising = assetChange > 0;
  const isAssetFalling = assetChange < 0;

  // 투자 차단 화면 (전체 화면 가리기)
  if (
    isLoggedIn &&
    (gameState.isTradingBlocked ||
      gameState.isPlayerTradingBlocked)
  ) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="text-8xl mb-6"
          >
            🎮
          </motion.div>
          <h1 className="text-5xl md:text-6xl font-black text-white mb-4">
            미니게임 중!
          </h1>
          <p className="text-xl md:text-2xl text-white/80 mb-6">
            미니게임이 진행 중입니다.
            <br />
            미니게임이 끝날 때까지 기다려주세요.
          </p>
          {gameState.blockedRewardAmount && (
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-yellow-500/20 border-2 border-yellow-400/50 rounded-lg backdrop-blur-sm">
              <Gift className="w-6 h-6 text-yellow-300" />
              <span className="text-yellow-200 font-bold text-lg">
                성공 시 보상: ₩
                {gameState.blockedRewardAmount.toLocaleString(
                  'ko-KR'
                )}
              </span>
            </div>
          )}
          {gameState.isPlayerTradingBlocked && playerActions && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => playerActions.signalMinigameComplete()}
              className="mt-6 px-8 py-4 bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white font-bold text-xl rounded-2xl shadow-lg shadow-green-500/30 transition-all"
            >
              미니게임 완료!
            </motion.button>
          )}
        </motion.div>
      </div>
    );
  }

  // 게임 종료 화면 (로그인 후에만 표시, hideGameOverScreen이 false일 때만)
  if (
    gameState.isGameEnded &&
    isLoggedIn &&
    !hideGameOverScreen
  ) {
    const finalRank = playerRank?.rank || 0;
    const totalPlayers = rankList?.length || 0;
    const finalAsset =
      portfolio.totalAsset || portfolio.cash || 0;
    const initialAsset = INITIAL_CASH;
    const profit = finalAsset - initialAsset;
    const profitPercent = (
      (profit / initialAsset) *
      100
    ).toFixed(2);

    // 보유 주식 정보
    const ownedStocks = Object.entries(
      portfolio.stocks || {}
    )
      .filter(([_, qty]) => qty > 0)
      .map(([stockId, qty]) => {
        const stock = activeStocks.find((s) => s.id === stockId);
        const currentPrice =
          gameState.stockPrices?.[stockId]?.[
            gameState.currentRound
          ] ||
          gameState.priceHistory?.[stockId]?.[
            gameState.currentRound
          ] ||
          stock?.basePrice ||
          0;
        const totalValue = qty * currentPrice;
        return {
          stock,
          qty,
          currentPrice,
          totalValue,
        };
      })
      .filter((item) => item.stock);

    // 평가 메시지
    const getEvaluationMessage = () => {
      if (finalRank === 1) return '🏆 최고의 투자자!';
      if (finalRank <= 3) return '🥇 탁월한 성과!';
      if (finalRank <= 10) return '⭐ 우수한 성과!';
      if (profitPercent > 20) return '📈 훌륭한 수익률!';
      if (profitPercent > 0) return '👍 좋은 결과!';
      if (profitPercent > -10)
        return '💪 다음엔 더 잘할 수 있어요!';
      return '💼 투자의 여정은 계속됩니다!';
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 max-w-4xl w-full"
        >
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 sm:p-8 md:p-12 border-2 border-white/20 shadow-2xl relative">
            {/* X 버튼 */}
            <button
              onClick={() => setHideGameOverScreen(true)}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-full transition-all z-20"
              title="닫기"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </button>

            {/* 게임 종료 헤더 */}
            <div className="text-center mb-8">
              <motion.div
                initial={{ y: -20, opacity: 0, scale: 0.8 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{
                  delay: 0.2,
                  type: 'spring',
                  stiffness: 200,
                }}
                className="text-5xl sm:text-6xl md:text-7xl font-black mb-4 bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 bg-clip-text text-transparent"
              >
                🎉 게임 종료 🎉
              </motion.div>
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-xl sm:text-2xl text-white/80 mb-2"
              >
                {nickname}님의 최종 결과
              </motion.div>
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-lg sm:text-xl font-bold text-yellow-300"
              >
                {getEvaluationMessage()}
              </motion.div>
            </div>

            {/* 최종 순위 */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mb-8"
            >
              <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-2xl p-6 border-2 border-yellow-500/50">
                <div className="flex items-center justify-center gap-4 mb-4">
                  {finalRank <= 3 && (
                    <Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-400" />
                  )}
                  <div className="text-center">
                    <div className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-2">
                      {finalRank}위
                    </div>
                    <div className="text-lg sm:text-xl text-white/80">
                      전체 {totalPlayers}명 중
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 최종 자산 정보 */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
            >
              <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl p-6 border-2 border-purple-400/50">
                <div className="text-sm text-white/70 mb-2 flex items-center gap-2">
                  <Wallet className="w-4 h-4" />
                  최종 자산
                </div>
                <div className="text-3xl sm:text-4xl font-black text-white">
                  ₩
                  {Math.floor(finalAsset).toLocaleString(
                    'ko-KR'
                  )}
                </div>
                <div className="text-xs text-white/60 mt-2">
                  초기 자산: ₩
                  {initialAsset.toLocaleString('ko-KR')}
                </div>
              </div>
              <div className="bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-xl p-6 border-2 border-red-400/50">
                <div className="text-sm text-white/70 mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  수익률
                </div>
                <div
                  className={`text-3xl sm:text-4xl font-black ${
                    profit >= 0
                      ? 'text-red-400'
                      : 'text-blue-400'
                  }`}
                >
                  {profit >= 0 ? '+' : ''}
                  {profitPercent}%
                </div>
                <div
                  className={`text-xs mt-2 ${
                    profit >= 0
                      ? 'text-red-300'
                      : 'text-blue-300'
                  }`}
                >
                  {profit >= 0 ? '+' : ''}₩
                  {Math.floor(profit).toLocaleString(
                    'ko-KR'
                  )}
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-xl p-6 border-2 border-blue-400/50">
                <div className="text-sm text-white/70 mb-2 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  보유 주식
                </div>
                <div className="text-3xl sm:text-4xl font-black text-white">
                  {ownedStocks.length}개
                </div>
                <div className="text-xs text-white/60 mt-2">
                  총{' '}
                  {ownedStocks.reduce(
                    (sum, s) => sum + s.qty,
                    0
                  )}
                  주
                </div>
              </div>
            </motion.div>

            {/* 보유 주식 상세 */}
            {ownedStocks.length > 0 && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="mb-8 bg-white/10 rounded-xl p-6 border border-white/20"
              >
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <List className="w-6 h-6" />
                  보유 주식 상세
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ownedStocks.map((item, idx) => {
                    const stockProfit =
                      ((item.currentPrice -
                        item.stock.basePrice) /
                        item.stock.basePrice) *
                      100;
                    return (
                      <div
                        key={item.stock.id}
                        className="bg-white/5 rounded-lg p-4 border border-white/10"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-white">
                            {item.stock.name}
                          </span>
                          <span className="text-sm text-white/70">
                            {item.qty}주
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs text-white/60">
                              현재가
                            </div>
                            <div className="text-lg font-bold text-white">
                              ₩
                              {Math.floor(
                                item.currentPrice
                              ).toLocaleString('ko-KR')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-white/60">
                              수익률
                            </div>
                            <div
                              className={`text-lg font-bold ${
                                stockProfit >= 0
                                  ? 'text-red-400'
                                  : 'text-blue-400'
                              }`}
                            >
                              {stockProfit >= 0 ? '+' : ''}
                              {stockProfit.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 pt-2 border-t border-white/10 text-xs text-white/60">
                          평가액: ₩
                          {Math.floor(
                            item.totalValue
                          ).toLocaleString('ko-KR')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* 최종 순위표 (상위 10명) */}
            {rankList && rankList.length > 0 && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="bg-white/10 rounded-xl p-6 border border-white/20"
              >
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <Trophy className="w-6 h-6" />
                  최종 순위
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {rankList
                    .slice(0, 10)
                    .map((player, index) => (
                      <div
                        key={player.nickname}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          player.nickname === nickname
                            ? 'bg-gradient-to-r from-purple-500/30 to-pink-500/30 border-2 border-purple-400'
                            : 'bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                              player.rank === 1
                                ? 'bg-yellow-500 text-yellow-900'
                                : player.rank === 2
                                ? 'bg-gray-400 text-gray-900'
                                : player.rank === 3
                                ? 'bg-orange-500 text-orange-900'
                                : 'bg-white/20 text-white'
                            }`}
                          >
                            {player.rank <= 3 ? (
                              <Trophy className="w-5 h-5" />
                            ) : (
                              player.rank
                            )}
                          </div>
                          <span
                            className={`font-semibold ${
                              player.nickname === nickname
                                ? 'text-white text-lg'
                                : 'text-white/80'
                            }`}
                          >
                            {player.nickname}
                            {player.nickname === nickname &&
                              ' (나)'}
                          </span>
                        </div>
                        <div className="text-white font-bold">
                          ₩
                          {Math.floor(
                            player.totalAsset
                          ).toLocaleString('ko-KR')}
                        </div>
                      </div>
                    ))}
                </div>
              </motion.div>
            )}

            {/* 안내 메시지 */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="mt-8 text-center text-white/60 text-sm"
            >
              게임이 종료되었습니다. 관리자가 새 게임을
              시작할 때까지 대기해주세요.
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  }

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
              transition={{ delay: 0.2, type: 'spring' }}
            >
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <LogIn className="w-10 h-10 text-white" />
              </div>
            </motion.div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-3">
              2025 흔적 주식게임 📈
            </h1>
            <p className="text-gray-600 text-sm sm:text-base md:text-lg">
              닉네임을 입력하고 게임을 시작하세요
            </p>
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
                const savedNickname = localStorage.getItem(
                  NICKNAME_STORAGE_KEY
                );
                if (e.target.value !== savedNickname) {
                  setHasAttemptedAutoLogin(false);
                }
              }}
              onBlur={() => {
                // 입력 필드에서 포커스가 벗어나면 입력 중 상태 해제
                setTimeout(
                  () => setIsUserTyping(false),
                  500
                );
              }}
              onFocus={() => {
                // 입력 필드에 포커스가 있으면 입력 중 상태로 설정
                setIsUserTyping(true);
              }}
              onKeyPress={(e) =>
                e.key === 'Enter' && handleLogin()
              }
              placeholder="닉네임을 입력하세요"
              className={`input-modern w-full text-base sm:text-lg ${
                nicknameError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                  : ''
              }`}
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
                connected
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  connected
                    ? 'bg-green-400 animate-pulse'
                    : 'bg-red-400'
                }`}
              ></div>
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
              transition={{ delay: 0.2, type: 'spring' }}
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
                <div className="font-semibold mb-2">
                  현재 상태
                </div>
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
        {gameState.countdown !== null &&
          gameState.countdown > 0 && (
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

      {/* 게임 준비중 표시 (게임 종료 후 X 버튼을 눌렀을 때, 게임이 시작되지 않았을 때만) */}
      {gameState.isGameEnded &&
        hideGameOverScreen &&
        !gameState.isGameStarted && (
          <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-purple-900 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear',
                }}
                className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-6 border-4 border-white/30 border-t-white rounded-full"
              />
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4">
                게임 준비중
              </h2>
              <p className="text-lg sm:text-xl text-white/80">
                관리자가 새 게임을 시작할 때까지
                대기해주세요
              </p>
            </motion.div>
          </div>
        )}

      {/* 게임 화면 (대기 모드가 아닐 때만 표시, 게임 종료 화면이 숨겨지지 않았을 때만) */}
      {!gameState.isWaitingMode &&
        !(gameState.isGameEnded && hideGameOverScreen) && (
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

            {/* 라운드 타이머 - 독립적인 고정 위치 (왼쪽 상단) */}
            {gameState.isGameStarted &&
              !gameState.isWaitingMode &&
              gameState.roundTimer !== null && (
                <div className="fixed top-2 left-2 sm:top-4 sm:left-4 z-50">
                  <motion.div
                    initial={{
                      opacity: 0,
                      x: -50,
                      scale: 0.8,
                    }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{
                      opacity: 0,
                      x: -50,
                      scale: 0.8,
                    }}
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
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: 'linear',
                        }}
                      >
                        <Clock
                          className={`w-4 h-4 sm:w-5 sm:h-5 ${
                            gameState.roundTimer <= 60
                              ? 'text-red-400'
                              : gameState.roundTimer <= 300
                              ? 'text-yellow-400'
                              : 'text-blue-400'
                          }`}
                        />
                      </motion.div>
                      <span>
                        {Math.floor(
                          gameState.roundTimer / 60
                        )}
                        :
                        {(gameState.roundTimer % 60)
                          .toString()
                          .padStart(2, '0')}
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
                          onKeyPress={(e) =>
                            e.key === 'Enter' &&
                            handleNicknameChange()
                          }
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
                            const savedNickname =
                              localStorage.getItem(
                                NICKNAME_STORAGE_KEY
                              );
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
                        onClick={() =>
                          setShowNicknameChange(true)
                        }
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
                    <div className="text-xs text-gray-500 mb-1">
                      총 자산
                    </div>
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">
                      ₩
                      {totalAsset.toLocaleString('ko-KR', {
                        maximumFractionDigits: 0,
                      })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <div className="text-xs text-gray-500 mb-1">
                      현금
                    </div>
                    <div className="text-base sm:text-lg md:text-xl font-semibold text-blue-600">
                      ₩
                      {Math.floor(
                        (portfolio.cash || 0) +
                          (portfolio.bonusPoints || 0)
                      ).toLocaleString('ko-KR', {
                        maximumFractionDigits: 0,
                      })}
                    </div>
                  </div>
                  {playerRank &&
                    playerRank.totalPlayers > 0 && (
                      <div className="flex-1 min-w-[100px]">
                        <div className="text-xs text-gray-500 mb-1">
                          순위
                        </div>
                        <div className="flex items-center gap-2">
                          {playerRank.rank <= 3 ? (
                            <Trophy
                              className={`w-5 h-5 sm:w-6 sm:h-6 ${
                                playerRank.rank === 1
                                  ? 'text-yellow-500'
                                  : playerRank.rank === 2
                                  ? 'text-gray-400'
                                  : 'text-orange-500'
                              }`}
                            />
                          ) : (
                            <Medal className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500" />
                          )}
                          <div
                            className={`text-base sm:text-lg md:text-xl font-bold ${
                              playerRank.rank === 1
                                ? 'text-yellow-600'
                                : playerRank.rank === 2
                                ? 'text-gray-600'
                                : playerRank.rank === 3
                                ? 'text-orange-600'
                                : 'text-purple-600'
                            }`}
                          >
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
                    onClick={() =>
                      setActiveTab('portfolio')
                    }
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
                  <button
                    onClick={() => {
                      setActiveTab('transactions');
                    }}
                    className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm md:text-base font-semibold transition-all border-b-2 whitespace-nowrap flex-shrink-0 ${
                      activeTab === 'transactions'
                        ? 'border-purple-500 text-purple-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                    거래내역
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
                      {/* 온라인 거래 안내 메시지 */}
                      {!gameState.allowPlayerTrading && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mb-4 sm:mb-6 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-400 flex items-center justify-center mt-0.5">
                              <span className="text-yellow-900 font-bold text-sm">
                                !
                              </span>
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-yellow-900 mb-1">
                                온라인 거래가 비활성화되어
                                있습니다
                              </h3>
                              <p className="text-sm text-yellow-800">
                                현재는 오프라인 거래소를
                                이용해주세요. 관리자가
                                온라인 거래를 활성화하면
                                주식 카드를 클릭하여 직접
                                거래할 수 있습니다.
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                      {gameState.allowPlayerTrading && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mb-4 sm:mb-6 p-4 bg-green-50 border-2 border-green-300 rounded-xl"
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-400 flex items-center justify-center mt-0.5">
                              <TrendingUp className="w-4 h-4 text-green-900" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-bold text-green-900 mb-1">
                                온라인 거래 활성화됨
                              </h3>
                              <p className="text-sm text-green-800">
                                주식 카드를 클릭하면 거래
                                모달이 열립니다. 매수/매도를
                                선택하고 수량을 입력한 후
                                확인 버튼을 눌러주세요.
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                        {/* 연습 모드일 때는 연습용 주식들 표시 */}
                        {activeStocks.map((stock, index) => {
                          const priceHistory =
                            gameState.priceHistory?.[
                              stock.id
                            ] || [];
                          const price =
                            priceHistory.length >
                            gameState.currentRound
                              ? priceHistory[
                                  gameState.currentRound
                                ]
                              : gameState.stockPrices[
                                  stock.id
                                ] || stock.basePrice;

                          // 직전 라운드 대비 변동률 계산
                          const prevRoundPrice =
                            gameState.currentRound > 0 &&
                            priceHistory.length >
                              gameState.currentRound - 1
                              ? priceHistory[
                                  gameState.currentRound - 1
                                ]
                              : stock.basePrice;

                          const changePercent =
                            gameState.currentRound > 0 &&
                            prevRoundPrice > 0
                              ? ((price - prevRoundPrice) /
                                  prevRoundPrice) *
                                100
                              : 0;

                          return (
                            <motion.div
                              key={`${stock.id}-${gameState.currentRound}`}
                              initial={{
                                opacity: 0,
                                y: 20,
                              }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                delay: index * 0.05, // 딜레이 감소 (50명 대응)
                              }}
                            >
                              <StockCard
                                stock={stock}
                                price={price}
                                changePercent={
                                  changePercent
                                }
                                priceHistory={priceHistory}
                                onClick={() => {
                                  // 개별 플레이어 투자 차단 확인
                                  if (
                                    gameState.isPlayerTradingBlocked
                                  ) {
                                    info(
                                      '미니게임 진행 중',
                                      `현재 미니게임이 진행 중입니다. 미니게임이 끝날 때까지 투자를 할 수 없습니다.${
                                        gameState.blockedRewardAmount
                                          ? ` (성공 시 보상: ₩${gameState.blockedRewardAmount.toLocaleString(
                                              'ko-KR'
                                            )})`
                                          : ''
                                      }`,
                                      3000
                                    );
                                    return;
                                  }
                                  // 전체 투자 차단 확인
                                  if (
                                    gameState.isTradingBlocked
                                  ) {
                                    info(
                                      '미니게임 진행 중',
                                      '현재 미니게임이 진행 중입니다. 미니게임이 끝날 때까지 투자를 할 수 없습니다.',
                                      3000
                                    );
                                    return;
                                  }
                                  // 연습 모드에서는 항상 거래 가능
                                  if (
                                    gameState.allowPlayerTrading ||
                                    gameState.isPracticeMode
                                  ) {
                                    setSelectedStock(stock);
                                    setShowTradeModal(true);
                                  } else {
                                    // 온라인 거래가 비활성화된 경우 안내 메시지
                                    info(
                                      '온라인 거래 비활성화',
                                      '현재 온라인 거래가 비활성화되어 있습니다. 오프라인 거래소를 이용해주세요.',
                                      3000
                                    );
                                  }
                                }}
                                disabled={
                                  gameState.isTradingBlocked ||
                                  gameState.isPlayerTradingBlocked ||
                                  (!gameState.allowPlayerTrading &&
                                    !gameState.isPracticeMode)
                                }
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
                            {(() => {
                              // 보유 수량이 0보다 큰 주식만 필터링
                              // 연습 모드일 때는 연습용 주식들 확인
                              const stocksToCheck = activeStocks;
                              const ownedStocks =
                                stocksToCheck.filter(
                                  (stock) => {
                                    const quantity =
                                      portfolio.stocks?.[
                                        stock.id
                                      ] || 0;
                                    return quantity > 0;
                                  }
                                );

                              // 보유한 주식이 없으면 안내 메시지 표시
                              if (
                                ownedStocks.length === 0
                              ) {
                                return (
                                  <tr>
                                    <td
                                      colSpan="5"
                                      className="py-12 text-center text-gray-500"
                                    >
                                      <div className="flex flex-col items-center gap-3">
                                        <Wallet className="w-12 h-12 text-gray-300" />
                                        <p className="text-sm sm:text-base">
                                          아직 보유한 주식이
                                          없습니다.
                                        </p>
                                        <p className="text-xs text-gray-400">
                                          주식을 구매하면
                                          여기에 표시됩니다.
                                        </p>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              }

                              return ownedStocks.map(
                                (stock) => {
                                  // 주식 가격 가져오기 (배열 형태로 저장되어 있음)
                                  const priceHistory =
                                    gameState.stockPrices?.[
                                      stock.id
                                    ] || [];
                                  const price =
                                    Array.isArray(
                                      priceHistory
                                    ) &&
                                    priceHistory.length >
                                      gameState.currentRound
                                      ? priceHistory[
                                          gameState
                                            .currentRound
                                        ]
                                      : Array.isArray(
                                          priceHistory
                                        ) &&
                                        priceHistory.length >
                                          0
                                      ? priceHistory[
                                          priceHistory.length -
                                            1
                                        ]
                                      : typeof priceHistory ===
                                        'number'
                                      ? priceHistory
                                      : stock.basePrice;
                                  const quantity =
                                    portfolio.stocks?.[
                                      stock.id
                                    ] || 0;
                                  const value =
                                    quantity * price;

                                  // 매수 평균가 가져오기
                                  const averageBuyPrice =
                                    portfolio
                                      .averageBuyPrices?.[
                                      stock.id
                                    ];

                                  let profitRate = 0;
                                  let isProfit = false;
                                  let isLoss = false;

                                  // 매수 평균가가 있으면 수익률 계산
                                  if (
                                    averageBuyPrice &&
                                    averageBuyPrice > 0 &&
                                    quantity > 0
                                  ) {
                                    const profit =
                                      price -
                                      averageBuyPrice;
                                    profitRate =
                                      (profit /
                                        averageBuyPrice) *
                                      100;
                                    isProfit = profit > 0;
                                    isLoss = profit < 0;
                                  }

                                  return (
                                    <tr
                                      key={stock.id}
                                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                                    >
                                      <td className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm text-gray-900">
                                        {stock.name}
                                      </td>
                                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-xs text-gray-700">
                                        ₩
                                        {price % 1 === 0
                                          ? price.toLocaleString(
                                              'ko-KR'
                                            )
                                          : price
                                              .toFixed(2)
                                              .replace(
                                                /\.0+$/,
                                                ''
                                              )}
                                      </td>
                                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-xs text-gray-700">
                                        {quantity.toLocaleString(
                                          'ko-KR'
                                        )}
                                        주
                                      </td>
                                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-right font-bold text-xs sm:text-sm text-purple-600">
                                        ₩
                                        {value.toLocaleString(
                                          'ko-KR',
                                          {
                                            maximumFractionDigits: 0,
                                          }
                                        )}
                                      </td>
                                      <td className="py-2 sm:py-3 px-2 sm:px-4 text-right">
                                        {averageBuyPrice &&
                                        averageBuyPrice >
                                          0 &&
                                        quantity > 0 ? (
                                          <div className="flex items-center justify-end gap-1">
                                            {isProfit ? (
                                              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                                            ) : isLoss ? (
                                              <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />
                                            ) : null}
                                            <span
                                              className={`text-xs sm:text-sm font-semibold ${
                                                isProfit
                                                  ? 'text-green-600'
                                                  : isLoss
                                                  ? 'text-red-600'
                                                  : 'text-gray-600'
                                              }`}
                                            >
                                              {profitRate >
                                              0
                                                ? '+'
                                                : ''}
                                              {profitRate %
                                                1 ===
                                              0
                                                ? profitRate.toLocaleString(
                                                    'ko-KR'
                                                  )
                                                : profitRate
                                                    .toFixed(
                                                      2
                                                    )
                                                    .replace(
                                                      /\.0+$/,
                                                      ''
                                                    )}
                                              %
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-gray-400">
                                            -
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                }
                              );
                            })()}
                            {/* 현금 및 총 자산 행은 항상 표시 */}
                            <tr className="border-t-2 border-gray-200 font-semibold">
                              <td
                                className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-700"
                                colSpan="4"
                              >
                                현금
                              </td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-xs sm:text-sm text-blue-600">
                                ₩
                                {Math.floor(
                                  (portfolio.cash || 0) +
                                    (portfolio.bonusPoints ||
                                      0)
                                ).toLocaleString('ko-KR', {
                                  maximumFractionDigits: 0,
                                })}
                              </td>
                            </tr>
                            <tr className="border-t-2 border-gray-300 font-bold bg-white">
                              <td
                                className="py-2 sm:py-3 px-2 sm:px-4 text-xs sm:text-sm text-gray-900"
                                colSpan="4"
                              >
                                총 자산
                                {gameState.currentRound >
                                  0 && (
                                  <span className="ml-2 flex items-center gap-1 text-xs font-normal">
                                    {isAssetRising ? (
                                      <>
                                        <TrendingUp className="w-3 h-3 text-green-600" />
                                        <span className="text-green-600">
                                          +₩
                                          {Math.abs(
                                            assetChange
                                          ).toLocaleString(
                                            'ko-KR',
                                            {
                                              maximumFractionDigits: 0,
                                            }
                                          )}{' '}
                                          (
                                          {
                                            assetChangePercent
                                          }
                                          %)
                                        </span>
                                      </>
                                    ) : isAssetFalling ? (
                                      <>
                                        <TrendingDown className="w-3 h-3 text-red-600" />
                                        <span className="text-red-600">
                                          -₩
                                          {Math.abs(
                                            assetChange
                                          ).toLocaleString(
                                            'ko-KR',
                                            {
                                              maximumFractionDigits: 0,
                                            }
                                          )}{' '}
                                          (
                                          {Math.abs(
                                            assetChangePercent
                                          )}
                                          %)
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-gray-500">
                                        변동 없음
                                      </span>
                                    )}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 sm:py-3 px-2 sm:px-4 text-right text-gray-900 text-base sm:text-lg md:text-xl font-bold">
                                ₩
                                {totalAsset.toLocaleString(
                                  'ko-KR',
                                  {
                                    maximumFractionDigits: 0,
                                  }
                                )}
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
                                      ) : player.rank ===
                                        2 ? (
                                        <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                      ) : player.rank ===
                                        3 ? (
                                        <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                                      ) : (
                                        <Medal className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500" />
                                      )}
                                      <span
                                        className={`font-bold text-xs sm:text-sm ${
                                          player.rank === 1
                                            ? 'text-yellow-600'
                                            : player.rank ===
                                              2
                                            ? 'text-gray-600'
                                            : player.rank ===
                                              3
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
                                        <span className="text-purple-600 font-bold text-xs sm:text-sm">
                                          👑
                                        </span>
                                      )}
                                      {player.rank === 1 &&
                                        !player.isMe && (
                                          <span className="text-yellow-600 text-xs sm:text-sm">
                                            👑
                                          </span>
                                        )}
                                      <span
                                        className={`text-xs sm:text-sm ${
                                          player.isMe
                                            ? 'text-purple-700 font-semibold'
                                            : 'text-gray-900'
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
                                          : player.rank ===
                                            1
                                          ? 'text-yellow-600'
                                          : player.rank ===
                                            2
                                          ? 'text-gray-600'
                                          : player.rank ===
                                            3
                                          ? 'text-orange-600'
                                          : 'text-gray-700'
                                      }`}
                                    >
                                      ₩
                                      {player.totalAsset.toLocaleString(
                                        'ko-KR',
                                        {
                                          maximumFractionDigits: 0,
                                        }
                                      )}
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
                              게임이 시작되면 순위가
                              표시됩니다.
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
                            현재 라운드:{' '}
                            {gameState.currentRound}
                          </p>
                        </div>

                        <div className="space-y-3 max-h-[500px] overflow-y-auto">
                          {/* 연습 모드일 때는 practiceScenarios, 실제 모드일 때는 initialScenarios 사용 */}
                          {(() => {
                            const scenarios =
                              gameState.isPracticeMode
                                ? practiceScenarios
                                : initialScenarios;

                            const currentDisplayRound =
                              gameState.isPracticeMode
                                ? gameState.currentRound
                                : gameState.currentRound;

                            const filteredScenarios =
                              scenarios
                                .map((scenario, index) => {
                                  // 연습 모드일 때는 라운드 번호와 시나리오 인덱스 매핑 조정
                                  let displayRound;
                                  if (
                                    gameState.isPracticeMode
                                  ) {
                                    // 연습 모드: 라운드 0(뉴스 없음), 라운드 1(뉴스 없음), 라운드 2→scenarios[0](12월), 라운드 3→scenarios[1](1월), 라운드 4→scenarios[2](2월)
                                    displayRound =
                                      index + 2; // scenarios[0] → 라운드 2, scenarios[1] → 라운드 3, scenarios[2] → 라운드 4
                                  } else {
                                    // 실제 게임 모드: 라운드 1(뉴스 없음), 라운드 2→scenarios[0](1~2월), 라운드 3→scenarios[1](3~4월), ...
                                    displayRound =
                                      index + 2; // scenarios[0] → 라운드 2, scenarios[1] → 라운드 3, scenarios[2] → 라운드 4
                                  }

                                  return {
                                    scenario,
                                    displayRound,
                                    index,
                                  };
                                })
                                .filter(
                                  ({
                                    displayRound,
                                    scenario,
                                  }) => {
                                    // 0라운드는 표시하지 않음
                                    if (
                                      displayRound === 0
                                    ) {
                                      return false;
                                    }

                                    // 표시 라운드 기준으로 "현재 라운드 이하"만 보여주기
                                    if (
                                      displayRound >
                                      currentDisplayRound
                                    ) {
                                      return false;
                                    }

                                    // headline이 없으면 표시하지 않음
                                    if (
                                      !scenario.headline ||
                                      scenario.headline.trim() ===
                                        ''
                                    ) {
                                      return false;
                                    }

                                    return true;
                                  }
                                );

                            return filteredScenarios.length >
                              0 ? (
                              filteredScenarios.map(
                                ({
                                  scenario,
                                  displayRound,
                                  index,
                                }) => {
                                  const isCurrentRound =
                                    displayRound ===
                                    currentDisplayRound;
                                  const isPastRound =
                                    displayRound <
                                    currentDisplayRound;

                                  return (
                                    <motion.div
                                      key={index}
                                      initial={{
                                        opacity: 0,
                                        y: 10,
                                      }}
                                      animate={{
                                        opacity: 1,
                                        y: 0,
                                      }}
                                      transition={{
                                        delay:
                                          (index - 1) *
                                          0.05, // 0라운드를 제외했으므로 -1
                                      }}
                                      onClick={() => {
                                        setSelectedRoundNews(
                                          {
                                            round:
                                              displayRound,
                                            scenario:
                                              scenario,
                                          }
                                        );
                                      }}
                                      className={`p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-lg ${
                                        isCurrentRound
                                          ? 'bg-white border-purple-400 shadow-md hover:border-purple-500'
                                          : 'bg-white border-gray-200 hover:border-gray-300'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            <span
                                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                                isCurrentRound
                                                  ? 'bg-purple-500 text-white'
                                                  : 'bg-gray-400 text-white'
                                              }`}
                                            >
                                              라운드{' '}
                                              {displayRound}{' '}
                                              (
                                              {
                                                scenario.month
                                              }
                                              )
                                            </span>
                                            {isCurrentRound && (
                                              <span className="px-2 py-1 rounded text-xs font-semibold bg-green-500 text-white animate-pulse">
                                                현재
                                              </span>
                                            )}
                                          </div>
                                          <p
                                            className={`text-sm sm:text-base ${
                                              isCurrentRound
                                                ? 'font-semibold text-gray-900'
                                                : 'text-gray-700'
                                            }`}
                                          >
                                            {
                                              scenario.headline
                                            }
                                          </p>
                                          <p className="text-xs text-gray-500 mt-2">
                                            클릭하여 상세
                                            보기
                                          </p>
                                        </div>
                                        <Newspaper className="w-5 h-5 sm:w-6 sm:w-6 text-purple-500 flex-shrink-0" />
                                      </div>
                                    </motion.div>
                                  );
                                }
                              )
                            ) : (
                              <div className="text-center py-12 text-gray-500">
                                <Newspaper className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                <p className="text-sm sm:text-base">
                                  아직 뉴스가 없습니다.
                                </p>
                                <p className="text-xs sm:text-sm mt-2">
                                  {gameState.currentRound ===
                                  0
                                    ? '게임이 시작되면 뉴스가 표시됩니다.'
                                    : '게임이 진행되면 뉴스가 표시됩니다.'}
                                </p>
                              </div>
                            );
                          })()}
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
                            보유 힌트 (
                            {Array.isArray(hints)
                              ? hints.length
                              : 0}
                            개)
                          </h3>
                          {!hints ||
                          !Array.isArray(hints) ||
                          hints.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                              <Lightbulb className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                              <p className="text-sm sm:text-base text-gray-500">
                                아직 보유한 힌트가 없습니다.
                              </p>
                              <p className="text-xs sm:text-sm text-gray-400 mt-2">
                                힌트를 구매하시면 여기에
                                표시됩니다. 힌트 상점을
                                이용해보세요!
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4 max-h-[500px] overflow-y-auto">
                              {(() => {
                                // 힌트를 라운드별로 그룹화
                                const validHints =
                                  Array.isArray(hints)
                                    ? hints
                                    : [];
                                const hintsByRound =
                                  validHints.reduce(
                                    (acc, hint) => {
                                      const round =
                                        hint.round !==
                                        undefined
                                          ? hint.round
                                          : 0;
                                      if (!acc[round]) {
                                        acc[round] = [];
                                      }
                                      acc[round].push(hint);
                                      return acc;
                                    },
                                    {}
                                  );

                                // 라운드 번호를 내림차순으로 정렬 (최신 라운드가 위에)
                                const sortedRounds =
                                  Object.keys(hintsByRound)
                                    .map(Number)
                                    .sort((a, b) => b - a);

                                return sortedRounds.map(
                                  (round) => {
                                    const roundHints =
                                      hintsByRound[round];
                                    const isCurrentRound =
                                      round ===
                                      gameState.currentRound;

                                    return (
                                      <div
                                        key={round}
                                        className="space-y-2"
                                      >
                                        <div className="flex items-center gap-2 mb-2">
                                          <h4
                                            className={`text-sm font-bold ${
                                              isCurrentRound
                                                ? 'text-purple-600'
                                                : 'text-gray-600'
                                            }`}
                                          >
                                            라운드{' '}
                                            {round + 1}
                                          </h4>
                                          {isCurrentRound && (
                                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700">
                                              현재
                                            </span>
                                          )}
                                          <span className="text-xs text-gray-400">
                                            (
                                            {
                                              roundHints.length
                                            }
                                            개)
                                          </span>
                                        </div>
                                        <div className="space-y-2 pl-2 border-l-2 border-gray-200">
                                          {roundHints.map(
                                            (
                                              hint,
                                              index
                                            ) => (
                                              <motion.div
                                                key={index}
                                                initial={{
                                                  opacity: 0,
                                                  y: 10,
                                                }}
                                                animate={{
                                                  opacity: 1,
                                                  y: 0,
                                                }}
                                                transition={{
                                                  delay:
                                                    index *
                                                    0.05,
                                                }}
                                                className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-gray-300 transition-colors"
                                              >
                                                <div className="flex items-start gap-3">
                                                  <div
                                                    className={`p-2 rounded-lg ${
                                                      hint.difficulty ===
                                                      '상'
                                                        ? 'bg-red-100 text-red-600'
                                                        : hint.difficulty ===
                                                          '중'
                                                        ? 'bg-yellow-100 text-yellow-600'
                                                        : 'bg-green-100 text-green-600'
                                                    }`}
                                                  >
                                                    <Lightbulb className="w-4 h-4" />
                                                  </div>
                                                  <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                      <span
                                                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                                          hint.difficulty ===
                                                          '이영훈 힌트'
                                                            ? 'bg-blue-500 text-white'
                                                            : hint.difficulty ===
                                                              '김민철 힌트'
                                                            ? 'bg-purple-500 text-white'
                                                            : hint.difficulty ===
                                                              '조은별 힌트'
                                                            ? 'bg-pink-500 text-white'
                                                            : hint.difficulty ===
                                                              '랜덤'
                                                            ? 'bg-gray-500 text-white'
                                                            : 'bg-gray-400 text-white'
                                                        }`}
                                                      >
                                                        {
                                                          hint.difficulty
                                                        }
                                                      </span>
                                                      <span className="text-xs text-gray-500">
                                                        {new Date(
                                                          hint.receivedAt
                                                        ).toLocaleString(
                                                          'ko-KR'
                                                        )}
                                                      </span>
                                                    </div>
                                                    <p className="text-sm text-gray-800 font-medium">
                                                      {hint.content ||
                                                        '힌트 내용이 아직 없습니다.'}
                                                    </p>
                                                  </div>
                                                </div>
                                              </motion.div>
                                            )
                                          )}
                                        </div>
                                      </div>
                                    );
                                  }
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'transactions' && (
                    <motion.div
                      key="transactions"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="space-y-6">
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                          거래 내역 (
                          {playerTransactions?.length || 0}
                          개)
                        </h3>
                        {!playerTransactions ||
                        playerTransactions.length === 0 ? (
                          <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                            <p className="text-sm sm:text-base text-gray-500">
                              아직 거래 내역이 없습니다.
                            </p>
                            <p className="text-xs sm:text-sm text-gray-400 mt-2">
                              주식을 거래하거나 힌트를
                              구매하면 여기에 표시됩니다.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3 max-h-[600px] overflow-y-auto">
                            {playerTransactions
                              .slice()
                              .reverse()
                              .map((transaction, index) => {
                                const date = new Date(
                                  transaction.timestamp
                                );
                                const timeString =
                                  date.toLocaleTimeString(
                                    'ko-KR',
                                    {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                    }
                                  );
                                const dateString =
                                  date.toLocaleDateString(
                                    'ko-KR'
                                  );

                                let icon = null;
                                let bgColor = '';
                                let textColor = '';
                                let title = '';
                                let description = '';

                                if (
                                  transaction.type === 'BUY'
                                ) {
                                  icon = (
                                    <TrendingUp className="w-5 h-5" />
                                  );
                                  bgColor = 'bg-blue-100';
                                  textColor =
                                    'text-blue-600';
                                  title = '매수';
                                  description = `${
                                    transaction.stockName
                                  } ${
                                    transaction.quantity
                                  }주 매수 @ ₩${(
                                    transaction.price || 0
                                  ).toLocaleString(
                                    'ko-KR'
                                  )} (총 ₩${(
                                    transaction.totalCost ||
                                    0
                                  ).toLocaleString(
                                    'ko-KR'
                                  )})`;
                                } else if (
                                  transaction.type ===
                                  'SELL'
                                ) {
                                  icon = (
                                    <TrendingDown className="w-5 h-5" />
                                  );
                                  bgColor = 'bg-red-100';
                                  textColor =
                                    'text-red-600';
                                  title = '매도';
                                  description = `${
                                    transaction.stockName
                                  } ${
                                    transaction.quantity
                                  }주 매도 @ ₩${(
                                    transaction.price || 0
                                  ).toLocaleString(
                                    'ko-KR'
                                  )} (총 ₩${(
                                    transaction.totalRevenue ||
                                    0
                                  ).toLocaleString(
                                    'ko-KR'
                                  )})`;
                                } else if (
                                  transaction.type ===
                                  'HINT_PURCHASE'
                                ) {
                                  icon = (
                                    <Lightbulb className="w-5 h-5" />
                                  );
                                  bgColor = 'bg-yellow-100';
                                  textColor =
                                    'text-yellow-600';
                                  title = '힌트 구매';
                                  description = `${
                                    transaction.difficulty ||
                                    '알 수 없음'
                                  } 난이도 힌트 구매 (₩${(
                                    transaction.hintPrice ||
                                    0
                                  ).toLocaleString(
                                    'ko-KR'
                                  )})`;
                                } else if (
                                  transaction.type ===
                                  'MINIGAME_REWARD'
                                ) {
                                  icon = (
                                    <Gift className="w-5 h-5" />
                                  );
                                  bgColor = 'bg-green-100';
                                  textColor =
                                    'text-green-600';
                                  title = '미니게임 보상';
                                  description = `포인트 획득: ₩${(
                                    transaction.points || 0
                                  ).toLocaleString(
                                    'ko-KR'
                                  )}`;
                                } else if (
                                  transaction.type ===
                                  'ROUND_ADVANCE'
                                ) {
                                  icon = (
                                    <Clock className="w-5 h-5" />
                                  );
                                  bgColor = 'bg-purple-100';
                                  textColor =
                                    'text-purple-600';
                                  title = '라운드 진행';
                                  description = `라운드 ${
                                    transaction.round + 1
                                  }로 진행`;
                                } else {
                                  icon = (
                                    <FileText className="w-5 h-5" />
                                  );
                                  bgColor = 'bg-gray-100';
                                  textColor =
                                    'text-gray-600';
                                  title =
                                    transaction.type ||
                                    '알 수 없음';
                                  description = '거래 내역';
                                }

                                return (
                                  <motion.div
                                    key={index}
                                    initial={{
                                      opacity: 0,
                                      y: 10,
                                    }}
                                    animate={{
                                      opacity: 1,
                                      y: 0,
                                    }}
                                    transition={{
                                      delay: index * 0.05,
                                    }}
                                    className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-gray-300 transition-colors"
                                  >
                                    <div className="flex items-start gap-3">
                                      <div
                                        className={`p-2 rounded-lg ${bgColor} ${textColor}`}
                                      >
                                        {icon}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                          <h4 className="font-semibold text-gray-900 text-sm sm:text-base">
                                            {title}
                                          </h4>
                                          <div className="text-xs text-gray-500 flex flex-col items-end">
                                            <span>
                                              {dateString}
                                            </span>
                                            <span>
                                              {timeString}
                                            </span>
                                          </div>
                                        </div>
                                        <p className="text-sm text-gray-700">
                                          {description}
                                        </p>
                                        {transaction.round !==
                                          undefined && (
                                          <span className="inline-block mt-2 px-2 py-0.5 text-xs font-semibold bg-purple-100 text-purple-700 rounded">
                                            라운드{' '}
                                            {transaction.round +
                                              1}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </motion.div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* 뉴스 모달 (라운드 시작 시 자동 표시) */}
              <NewsModal
                isOpen={showNewsModal}
                headline={gameState.currentNews || ''}
                newsBriefing={
                  gameState.currentNewsBriefing || []
                }
                volatility={
                  gameState.isPracticeMode
                    ? (() => {
                        // 연습 모드: 라운드 1 → scenarios[0], 라운드 2 → scenarios[1], 라운드 3 → scenarios[2]
                        const scenarioIndex =
                          gameState.currentRound >= 1
                            ? gameState.currentRound - 1
                            : 0;
                        return practiceScenarios[
                          scenarioIndex
                        ]?.volatility;
                      })()
                    : (() => {
                        // 실제 모드: 라운드 1 → scenarios[0], 라운드 2 → scenarios[1], ...
                        const scenarioIndex =
                          gameState.currentRound >= 1
                            ? gameState.currentRound - 1
                            : 0;
                        return initialScenarios[
                          scenarioIndex
                        ]?.volatility;
                      })()
                }
                stocks={activeStocks}
                isLastRound={gameState.isLastRound}
                onClose={() => {
                  if (!gameState.isLastRound) {
                    setShowNewsModal(false);
                  }
                }}
                onNext={() => {
                  if (gameState.isLastRound && socket) {
                    socket.emit('PLAYER_REQUEST_END_GAME');
                    setShowNewsModal(false);
                  }
                }}
              />

              {/* 뉴스 탭에서 선택한 라운드 상세 모달 */}
              {selectedRoundNews && (
                <NewsModal
                  isOpen={!!selectedRoundNews}
                  headline={
                    selectedRoundNews.scenario.headline ||
                    ''
                  }
                  newsBriefing={
                    selectedRoundNews.scenario
                      .newsBriefing || []
                  }
                  volatility={
                    selectedRoundNews.scenario.volatility
                  }
                  stocks={activeStocks}
                  onClose={() => setSelectedRoundNews(null)}
                />
              )}

              {/* 뉴스 티커: 뉴스가 존재하면 라운드 번호와 무관하게 표시 */}
              {gameState.isGameStarted &&
                !gameState.isWaitingMode &&
                (gameState.currentNews?.trim() ||
                  (gameState.currentNewsBriefing || [])
                    .length > 0) && (
                  <NewsTicker
                    headline={gameState.currentNews || ''}
                    newsBriefing={
                      gameState.currentNewsBriefing || []
                    }
                  />
                )}

              {/* 튜토리얼 모달 (연습 모드일 때만) */}
              {gameState.isPracticeMode && (
                <AnimatePresence>
                  {showTutorialModal && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                      onClick={() => {
                        if (tutorialStep === 2) {
                          setShowTutorialModal(false);
                        }
                      }}
                    >
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white rounded-2xl p-6 sm:p-8 max-w-2xl w-full relative shadow-xl max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() =>
                            setShowTutorialModal(false)
                          }
                          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-100 rounded-lg"
                        >
                          <X className="w-5 h-5" />
                        </button>

                        <div className="text-center mb-6">
                          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-100 flex items-center justify-center">
                            <BookOpen className="w-8 h-8 text-yellow-600" />
                          </div>
                          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                            주식 거래 튜토리얼
                          </h2>
                          <p className="text-sm text-gray-600">
                            단계 {tutorialStep + 1} / 3
                          </p>
                        </div>

                        <div className="space-y-4 mb-6">
                          {tutorialStep === 0 && (
                            <motion.div
                              initial={{
                                opacity: 0,
                                y: 20,
                              }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-4"
                            >
                              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                                  <HelpCircle className="w-5 h-5 text-blue-600" />
                                  연습 게임이란?
                                </h3>
                                <ul className="space-y-2 text-sm text-gray-700">
                                  <li className="flex items-start gap-2">
                                    <span className="text-blue-600 font-bold">
                                      •
                                    </span>
                                    <span>
                                      연습 게임은{' '}
                                      <strong>
                                        3라운드
                                      </strong>
                                      로 진행되는 간단한
                                      튜토리얼입니다.
                                    </span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <span className="text-blue-600 font-bold">
                                      •
                                    </span>
                                    <span>
                                      주식을{' '}
                                      <strong>매수</strong>
                                      하고{' '}
                                      <strong>매도</strong>
                                      하는 방법을 배울 수
                                      있습니다.
                                    </span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <span className="text-blue-600 font-bold">
                                      •
                                    </span>
                                    <span>
                                      각 라운드마다{' '}
                                      <strong>뉴스</strong>
                                      가 발표되고, 주식
                                      가격이 변동합니다.
                                    </span>
                                  </li>
                                  <li className="flex items-start gap-2">
                                    <span className="text-blue-600 font-bold">
                                      •
                                    </span>
                                    <span>
                                      초기 자본금{' '}
                                      <strong>
                                        ₩3,000,000
                                      </strong>
                                      으로 시작합니다.
                                    </span>
                                  </li>
                                </ul>
                              </div>
                            </motion.div>
                          )}

                          {tutorialStep === 1 && (
                            <motion.div
                              initial={{
                                opacity: 0,
                                y: 20,
                              }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-4"
                            >
                              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                                  <TrendingUp className="w-5 h-5 text-green-600" />
                                  주식 거래 방법
                                </h3>
                                <div className="space-y-3 text-sm text-gray-700">
                                  <div>
                                    <p className="font-semibold mb-1">
                                      1. 주식 카드 클릭
                                    </p>
                                    <p className="text-gray-600">
                                      메인 화면의 주식
                                      카드를 클릭하면 거래
                                      모달이 열립니다.
                                    </p>
                                  </div>
                                  <div>
                                    <p className="font-semibold mb-1">
                                      2. 매수하기
                                    </p>
                                    <p className="text-gray-600">
                                      주식을 사고 싶다면{' '}
                                      <strong className="text-red-600">
                                        매수
                                      </strong>{' '}
                                      버튼을 누르고 수량을
                                      입력하세요.
                                    </p>
                                  </div>
                                  <div>
                                    <p className="font-semibold mb-1">
                                      3. 매도하기
                                    </p>
                                    <p className="text-gray-600">
                                      보유한 주식을 팔고
                                      싶다면{' '}
                                      <strong className="text-blue-600">
                                        매도
                                      </strong>{' '}
                                      버튼을 누르고 수량을
                                      입력하세요.
                                    </p>
                                  </div>
                                  <div>
                                    <p className="font-semibold mb-1">
                                      4. 내 자산 확인
                                    </p>
                                    <p className="text-gray-600">
                                      <strong>
                                        내 자산
                                      </strong>{' '}
                                      탭에서 보유한 주식과
                                      현금을 확인할 수
                                      있습니다.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}

                          {tutorialStep === 2 && (
                            <motion.div
                              initial={{
                                opacity: 0,
                                y: 20,
                              }}
                              animate={{ opacity: 1, y: 0 }}
                              className="space-y-4"
                            >
                              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                                <h3 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                                  <BarChart3 className="w-5 h-5 text-purple-600" />
                                  게임 진행 방법
                                </h3>
                                <div className="space-y-3 text-sm text-gray-700">
                                  <div>
                                    <p className="font-semibold mb-1">
                                      📰 뉴스 확인
                                    </p>
                                    <p className="text-gray-600">
                                      각 라운드 시작 시{' '}
                                      <strong>뉴스</strong>
                                      를 확인하세요. 뉴스는
                                      주식 가격에 영향을
                                      줍니다.
                                    </p>
                                  </div>
                                  <div>
                                    <p className="font-semibold mb-1">
                                      📊 순위 확인
                                    </p>
                                    <p className="text-gray-600">
                                      <strong>순위</strong>{' '}
                                      탭에서 다른
                                      플레이어와의 순위를
                                      비교할 수 있습니다.
                                    </p>
                                  </div>
                                  <div>
                                    <p className="font-semibold mb-1">
                                      🎮 미니게임
                                    </p>
                                    <p className="text-gray-600">
                                      돈이 없으시다고요? 한
                                      라운드를 주식 투자
                                      대신{' '}
                                      <strong>
                                        미니게임
                                      </strong>
                                      을 통해 돈을 벌 수
                                      있습니다.
                                    </p>
                                  </div>
                                  <div>
                                    <p className="font-semibold mb-1">
                                      💡 힌트 상점
                                    </p>
                                    <p className="text-gray-600">
                                      <strong>
                                        힌트 상점
                                      </strong>
                                      을 통해 힌트를 얻어
                                      어떤 것들이 주식이
                                      오르는지 정보를 살 수
                                      있습니다.
                                    </p>
                                  </div>
                                  <div className="bg-yellow-100 rounded-lg p-3 border border-yellow-300">
                                    <p className="font-semibold text-yellow-800">
                                      💡 팁: 다음 라운드에
                                      있었던 사건들을
                                      유추하여 주식 가격
                                      변동을 예측해보세요!
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-4">
                          <button
                            onClick={() => {
                              if (tutorialStep > 0) {
                                setTutorialStep(
                                  tutorialStep - 1
                                );
                              }
                            }}
                            disabled={tutorialStep === 0}
                            className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                              tutorialStep === 0
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            <ChevronLeft className="w-4 h-4" />
                            이전
                          </button>
                          <div className="flex gap-2">
                            {[0, 1, 2].map((step) => (
                              <div
                                key={step}
                                className={`w-2 h-2 rounded-full ${
                                  step === tutorialStep
                                    ? 'bg-purple-600'
                                    : 'bg-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              if (tutorialStep < 2) {
                                setTutorialStep(
                                  tutorialStep + 1
                                );
                              } else {
                                setShowTutorialModal(false);
                              }
                            }}
                            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                          >
                            {tutorialStep < 2 ? (
                              <>
                                다음
                                <ChevronRight className="w-4 h-4" />
                              </>
                            ) : (
                              <>
                                <Check className="w-4 h-4" />
                                시작하기
                              </>
                            )}
                          </button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}

              {/* 거래 모달 */}
              {selectedStock && (
                <TradeModal
                  isOpen={showTradeModal}
                  onClose={() => {
                    setShowTradeModal(false);
                    setSelectedStock(null);
                  }}
                  stock={selectedStock}
                  price={
                    gameState.stockPrices[
                      selectedStock.id
                    ] || selectedStock.basePrice
                  }
                  quantity={
                    portfolio.stocks?.[selectedStock.id] ||
                    0
                  }
                  maxBuyable={Math.floor(
                    portfolio.cash /
                      (gameState.stockPrices[
                        selectedStock.id
                      ] || selectedStock.basePrice)
                  )}
                  currentCash={portfolio.cash}
                  onBuy={(qty) => {
                    if (playerActions?.buyStock) {
                      playerActions.buyStock(
                        selectedStock.id,
                        qty
                      );
                    }
                  }}
                  onSell={(qty) => {
                    if (playerActions?.sellStock) {
                      playerActions.sellStock(
                        selectedStock.id,
                        qty
                      );
                    }
                  }}
                />
              )}
            </div>
          </>
        )}

      {/* Toast 알림 */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
