import {
  useState,
  Fragment,
  useEffect,
  useRef,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  GraduationCap,
  Rocket,
  Users,
  TrendingUp,
  TrendingDown,
  Circle,
  Gift,
  Lightbulb,
  Check,
  X,
  Trophy,
  Database,
  Settings,
  BarChart,
  Square,
  LogOut,
  Trash2,
  Clock,
  Gamepad2,
  Save,
  Shuffle,
  Send,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/Toast';
import ConfirmModal from '../../components/ConfirmModal';
import GameStartModal from '../../components/GameStartModal';
import ScenarioSetupModal from '../../components/ScenarioSetupModal';
import {
  STOCKS,
  initialScenarios,
} from '../../data/initialScenarios';

export default function DeveloperPage({
  gameState,
  connected,
  playerCount,
  playerList,
  connectedAdmins,
  transactionLogs,
  adminActions,
  setRoundTimerEndCallback,
  setAdminsListCallback,
  setAdminSuccessCallback,
  socket,
  setAdminErrorCallback,
}) {
  const { toasts, removeToast, success, error, info } =
    useToast();
  const [activeTab, setActiveTab] = useState('game'); // 'game', 'players', 'transactions', 'hints', 'ranking', 'settings', 'display'
  const [admins, setAdmins] = useState([]); // 운영자 계정 목록
  const [newAdminId, setNewAdminId] = useState(''); // 새 운영자 ID
  const [newAdminPassword, setNewAdminPassword] =
    useState(''); // 새 운영자 비밀번호
  const [editingAdminId, setEditingAdminId] =
    useState(null); // 수정 중인 운영자 ID (admin.id)
  const [newPassword, setNewPassword] = useState(''); // 새 비밀번호
  const [selectedPlayerId, setSelectedPlayerId] =
    useState('');
  const [hintDifficulty, setHintDifficulty] =
    useState('하');
  const [hintPrice, setHintPrice] = useState('1000');
  const [hintContent, setHintContent] = useState('');
  const [expandedPlayerId, setExpandedPlayerId] =
    useState(null);
  const [previousRound, setPreviousRound] = useState(
    gameState.currentRound
  );
  const [isRoundChanging, setIsRoundChanging] =
    useState(false);
  const [roundChangeDirection, setRoundChangeDirection] =
    useState(null); // 'next' or 'previous'
  const [confirmModal, setConfirmModal] = useState(null); // { type: 'previous' | 'next' | 'end' | 'timer', onConfirm: function }
  const [gameStartModal, setGameStartModal] =
    useState(null); // { type: 'practice' | 'real', onConfirm: function }
  const [scenarioSetupModal, setScenarioSetupModal] =
    useState(null); // { type: 'practice' | 'real' }
  const [displayMessage, setDisplayMessage] = useState(''); // 전광판 메시지 입력
  const [isMessageActive, setIsMessageActive] =
    useState(false); // 메시지 활성 상태
  // 포인트 지급 관련 상태
  const [pointReason, setPointReason] = useState(''); // 포인트 지급 사유
  const [pointAmount, setPointAmount] = useState(''); // 포인트 금액
  const [pointTarget, setPointTarget] = useState('all'); // 'all' 또는 'specific'
  const [pointTargetPlayerId, setPointTargetPlayerId] =
    useState(''); // 특정 플레이어 선택
  // 힌트 지급 관련 상태 (모두에게)
  const [hintForAllDifficulty, setHintForAllDifficulty] =
    useState('하'); // 모두에게 줄 힌트 난이도
  const [hintForAllContent, setHintForAllContent] =
    useState(''); // 모두에게 줄 힌트 내용

  // 랜덤 힌트 설정 관련 상태
  const [randomHints, setRandomHints] = useState(['']); // 힌트 배열
  const [selectedRoundForHints, setSelectedRoundForHints] =
    useState(0); // 선택된 라운드
  const [roundHints, setRoundHints] = useState({}); // { round: [hints] }
  const hasRequestedHintsRef = useRef(false); // 한 번만 요청하도록 플래그

  // 라운드 1 전용 힌트 목록
  const round1Hints = [
    "스키 클럽 '십메활' 시즌 피날레... 빙판길 44중 추돌 사고에 안전 주의보",
    '"이게 나라고?" AI 생성형 이미지 대유행... MZ세대 SNS 점령',
    "최저임금 10,030원 시대 개막... 자영업계 '밀크플레이션' 비상",
    '"이게 나라고?" AI 생성형 이미지 대유행... MZ세대 SNS 점령',
    "제주항공, 사고 여파 딛고 장애인 스포츠단 지원 등 'ESG 경영' 박차",
  ];

  const isFirstRound = gameState.currentRound === 0;
  // totalRounds는 서버에서 전달, 없으면 fallback
  const maxRounds = gameState.totalRounds
    || (gameState.isPracticeMode ? 4 : initialScenarios.length + 1);
  const isLastRound =
    gameState.currentRound >= maxRounds - 1;

  // 라운드 변경 감지
  useEffect(() => {
    if (
      isRoundChanging &&
      gameState.currentRound !== previousRound
    ) {
      // 라운드 변경 완료
      setIsRoundChanging(false);
      const direction = roundChangeDirection;
      setRoundChangeDirection(null);

      if (direction === 'next') {
        success(
          '라운드 전환 완료',
          '정상적으로 다음 라운드로 넘어갔습니다.',
          3000
        );
      } else if (direction === 'previous') {
        success(
          '라운드 전환 완료',
          '정상적으로 이전 라운드로 넘어갔습니다.',
          3000
        );
      }

      setPreviousRound(gameState.currentRound);
    }
  }, [
    gameState.currentRound,
    previousRound,
    isRoundChanging,
    roundChangeDirection,
    success,
  ]);

  // 라운드 타이머 종료 콜백 설정
  useEffect(() => {
    if (setRoundTimerEndCallback) {
      setRoundTimerEndCallback((message) => {
        // 타이머가 0이 되면 확인 모달 표시
        setConfirmModal({
          type: 'timer',
          title: '라운드 시간 종료',
          message:
            message ||
            (gameState.isPracticeMode
              ? '5분이 종료되었습니다. 다음 라운드로 진행하시겠습니까?'
              : '15분이 종료되었습니다. 다음 라운드로 진행하시겠습니까?'),
          confirmText: '다음 라운드',
          cancelText: '취소',
          onConfirm: () => {
            setIsRoundChanging(true);
            setRoundChangeDirection('next');
            setPreviousRound(gameState.currentRound);
            info(
              '라운드 전환 중',
              '다음 라운드로 넘어가는 중...',
              0
            );
            adminActions?.nextRound();
          },
        });
      });
    }
  }, [
    setRoundTimerEndCallback,
    adminActions,
    info,
    gameState.currentRound,
    gameState.isPracticeMode,
  ]);

  // 운영자 계정 목록 조회
  useEffect(() => {
    if (
      activeTab === 'settings' &&
      adminActions?.getAdmins
    ) {
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

  // 랜덤 힌트 설정: 라운드별 힌트 로드 (힌트 탭 활성화 시)
  useEffect(() => {
    if (
      activeTab === 'hints' &&
      !hasRequestedHintsRef.current &&
      adminActions &&
      adminActions.requestRoundScenarios
    ) {
      hasRequestedHintsRef.current = true;
      adminActions.requestRoundScenarios();
    }

    // 서버에서 라운드별 힌트 업데이트 수신
    const handleRoundScenariosUpdate = (data) => {
      const hintsMap = {};
      Object.keys(data.roundHints || {}).forEach(
        (round) => {
          hintsMap[round] = data.roundHints[round];
        }
      );
      setRoundHints(hintsMap);

      // 선택된 라운드의 힌트 로드
      if (selectedRoundForHints === 0) {
        const savedHints = hintsMap[selectedRoundForHints];
        setRandomHints(
          savedHints && savedHints.length > 0
            ? savedHints
            : round1Hints
        );
      } else {
        setRandomHints(
          hintsMap[selectedRoundForHints] || ['']
        );
      }
    };

    if (socket && activeTab === 'hints') {
      socket.on(
        'ROUND_SCENARIOS_UPDATE',
        handleRoundScenariosUpdate
      );
      return () => {
        socket.off(
          'ROUND_SCENARIOS_UPDATE',
          handleRoundScenariosUpdate
        );
      };
    }
  }, [
    activeTab,
    adminActions,
    socket,
    selectedRoundForHints,
  ]);

  // 선택된 라운드 변경 시 해당 라운드의 힌트 로드
  useEffect(() => {
    if (selectedRoundForHints === 0) {
      const savedHints = roundHints[selectedRoundForHints];
      setRandomHints(
        savedHints && savedHints.length > 0
          ? savedHints
          : round1Hints
      );
    } else {
      setRandomHints(
        roundHints[selectedRoundForHints] || ['']
      );
    }
  }, [selectedRoundForHints, roundHints]);

  // 힌트 추가
  const handleAddRandomHint = () => {
    setRandomHints([...randomHints, '']);
  };

  // 힌트 삭제
  const handleRemoveRandomHint = (index) => {
    if (randomHints.length > 1) {
      setRandomHints(
        randomHints.filter((_, i) => i !== index)
      );
    }
  };

  // 힌트 내용 변경
  const handleRandomHintChange = (index, value) => {
    const newHints = [...randomHints];
    newHints[index] = value;
    setRandomHints(newHints);
  };

  // 랜덤 힌트 생성
  const handleRandomHintsGenerate = () => {
    const randomHintsList = [
      '이번 라운드에는 큰 변동이 있을 수 있습니다.',
      '특정 종목에 주목해보세요.',
      '시장의 흐름을 잘 읽어야 합니다.',
      '과거 패턴을 분석해보세요.',
      '새로운 뉴스가 곧 나올 예정입니다.',
      '투자 타이밍이 중요합니다.',
      '리스크 관리를 잊지 마세요.',
      '장기적인 관점을 유지하세요.',
    ];
    const selectedHints = [];
    const count = Math.floor(Math.random() * 3) + 2; // 2-4개
    for (let i = 0; i < count; i++) {
      const hint =
        randomHintsList[
          Math.floor(Math.random() * randomHintsList.length)
        ];
      if (!selectedHints.includes(hint)) {
        selectedHints.push(hint);
      }
    }
    setRandomHints(
      selectedHints.length > 0 ? selectedHints : ['']
    );
  };

  // 힌트 저장
  const handleSaveRandomHints = () => {
    const validHints = randomHints.filter(
      (h) => h.trim() !== ''
    );
    if (validHints.length === 0) {
      error(
        '오류',
        '최소 1개 이상의 힌트를 입력해주세요.',
        3000
      );
      return;
    }

    if (adminActions && adminActions.saveRoundHints) {
      adminActions.saveRoundHints(
        selectedRoundForHints,
        validHints
      );
      setRoundHints((prev) => ({
        ...prev,
        [selectedRoundForHints]: validHints,
      }));
      success(
        '저장 완료',
        `라운드 ${selectedRoundForHints + 1}의 힌트 ${
          validHints.length
        }개가 저장되었습니다.`,
        3000
      );
    }
  };

  // 주식 이름 가져오기
  const getStockName = (stockId) => {
    const stock = STOCKS.find((s) => s.id === stockId);
    return stock ? stock.name : stockId;
  };

  return (
    <div className="p-2 sm:p-4 pb-20 sm:pb-24 relative">

      {/* 게임 제어 버튼 */}
      <div className="flex justify-center gap-2 sm:gap-3 mb-6 sm:mb-8 flex-wrap px-2">
        {!gameState.isGameStarted ? (
          <>
            <button
              onClick={() => {
                setScenarioSetupModal({ type: 'practice' });
              }}
              className="btn-secondary px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base flex items-center gap-2 border-2 border-yellow-400 hover:border-yellow-500"
            >
              <GraduationCap className="w-4 h-4" />
              연습 게임 시작
            </button>
            <button
              onClick={() => {
                setScenarioSetupModal({ type: 'real' });
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
                  setScenarioSetupModal({ type: 'real' });
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
                  message:
                    '이전 라운드로 넘어가시겠습니까?',
                  onConfirm: () => {
                    setIsRoundChanging(true);
                    setRoundChangeDirection('previous');
                    setPreviousRound(
                      gameState.currentRound
                    );
                    info(
                      '라운드 전환 중',
                      '이전 라운드로 넘어가는 중...',
                      0
                    );
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
                    setPreviousRound(
                      gameState.currentRound
                    );
                    info(
                      '라운드 전환 중',
                      '다음 라운드로 넘어가는 중...',
                      0
                    );
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
                  message:
                    '정말로 게임을 종료하시겠습니까? 모든 플레이어는 대기 모드로 돌아갑니다.',
                  confirmText: '종료',
                  cancelText: '취소',
                  onConfirm: () => {
                    adminActions?.endGame();
                    success(
                      '게임 종료',
                      '게임이 종료되었습니다.',
                      3000
                    );
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
        <button
          onClick={() => setActiveTab('display')}
          className={`px-3 py-2 text-xs sm:text-sm font-semibold transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'display'
              ? 'border-purple-500 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Gamepad2 className="w-3 h-3 sm:w-4 sm:h-4 inline-block mr-1" />
          전광판 메시지
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
                  <div className="text-sm text-gray-600 mb-1">
                    현재 라운드
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    {gameState.currentRound + 1} /{' '}
                    {maxRounds}
                  </div>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">
                    게임 상태
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {gameState.isGameStarted
                      ? gameState.isPracticeMode
                        ? '연습'
                        : '실제'
                      : '대기'}
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600 mb-1">
                  현재 뉴스
                </div>
                <div className="text-base font-semibold text-purple-700">
                  {gameState.currentNews || '뉴스 없음'}
                </div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600 mb-2">
                  주식 가격
                </div>
                <div className="space-y-2">
                  {STOCKS.map((stock) => {
                    const price =
                      gameState.stockPrices[stock.id]?.[
                        gameState.currentRound
                      ] || stock.basePrice;
                    return (
                      <div
                        key={stock.id}
                        className="flex justify-between items-center"
                      >
                        <span className="text-sm font-medium">
                          {stock.name}
                        </span>
                        <span className="text-sm font-bold text-gray-700">
                          ₩
                          {price % 1 === 0
                            ? price.toLocaleString('ko-KR')
                            : price
                                .toFixed(2)
                                .replace(/\.0+$/, '')}
                        </span>
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                    플레이어 관리 ({playerList.length}명)
                  </h2>
                  {(() => {
                    console.log(
                      '[DeveloperPage] connectedAdmins:',
                      connectedAdmins,
                      'type:',
                      typeof connectedAdmins,
                      'isArray:',
                      Array.isArray(connectedAdmins)
                    );
                    return null;
                  })()}
                  {connectedAdmins &&
                    Array.isArray(connectedAdmins) &&
                    connectedAdmins.length > 0 && (
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-lg border border-purple-200">
                        <Users className="w-4 h-4 text-purple-600 flex-shrink-0" />
                        <span className="text-xs sm:text-sm font-semibold text-purple-700 whitespace-nowrap">
                          접속 중인 운영자:
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {connectedAdmins.map(
                            (admin, index) => (
                              <span
                                key={admin.socketId}
                                className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium whitespace-nowrap"
                              >
                                {admin.adminId}
                                {index <
                                  connectedAdmins.length -
                                    1 && (
                                  <span className="ml-1.5 text-purple-400">
                                    ·
                                  </span>
                                )}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    )}
                </div>

                {/* 접속 중인 운영자 정보 (플레이어 목록 위에 표시) */}
                {connectedAdmins &&
                  Array.isArray(connectedAdmins) &&
                  connectedAdmins.length > 0 && (
                    <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-purple-600 flex-shrink-0" />
                        <span className="text-sm font-semibold text-purple-700">
                          접속 중인 운영자:
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          {connectedAdmins.map(
                            (admin, index) => (
                              <span
                                key={admin.socketId}
                                className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium whitespace-nowrap shadow-sm"
                              >
                                {admin.adminId}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] sm:min-w-0">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                          닉네임
                        </th>
                        <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                          상태
                        </th>
                        <th className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                          총 자산
                        </th>
                        <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                          힌트
                        </th>
                        <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                          포인트 추가
                        </th>
                        <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                          관리
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 온라인 플레이어 그룹 */}
                      {(() => {
                        const onlinePlayers = playerList
                          .filter(
                            (p) => p.isOnline === true
                          )
                          .sort(
                            (a, b) =>
                              (a.rank || 999) -
                              (b.rank || 999)
                          );
                        const offlinePlayers = playerList
                          .filter(
                            (p) => p.isOnline !== true
                          )
                          .sort(
                            (a, b) =>
                              (a.rank || 999) -
                              (b.rank || 999)
                          );

                        return (
                          <>
                            {/* 온라인 플레이어 섹션 */}
                            {onlinePlayers.length > 0 && (
                              <>
                                <tr className="bg-green-50 border-b-2 border-green-200">
                                  <td
                                    colSpan={6}
                                    className="py-3 px-2 sm:px-4"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Circle className="w-3 h-3 text-green-500 fill-green-500" />
                                      <span className="font-bold text-sm sm:text-base text-green-700">
                                        온라인 플레이어 (
                                        {
                                          onlinePlayers.length
                                        }
                                        명)
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                                {onlinePlayers.map(
                                  (player) => (
                                    <Fragment
                                      key={player.socketId}
                                    >
                                      <tr
                                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                                          !player.isOnline
                                            ? 'opacity-60'
                                            : ''
                                        }`}
                                      >
                                        <td className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm text-gray-900">
                                          {player.rank ===
                                            1 && (
                                            <span className="text-yellow-600 mr-1">
                                              👑
                                            </span>
                                          )}
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
                                            <span
                                              className={`text-xs ${
                                                player.isOnline
                                                  ? 'text-green-600'
                                                  : 'text-gray-500'
                                              }`}
                                            >
                                              {player.isOnline
                                                ? '온라인'
                                                : '오프라인'}
                                            </span>
                                          </div>
                                        </td>
                                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-right font-bold text-xs sm:text-sm text-purple-600">
                                          ₩
                                          {player.totalAsset?.toLocaleString(
                                            'ko-KR',
                                            {
                                              maximumFractionDigits: 0,
                                            }
                                          ) || 0}
                                        </td>
                                        <td className="py-2 sm:py-3 px-2 sm:px-4">
                                          <div className="flex flex-col items-center gap-1">
                                            <button
                                              onClick={() =>
                                                setExpandedPlayerId(
                                                  expandedPlayerId ===
                                                    player.socketId
                                                    ? null
                                                    : player.socketId
                                                )
                                              }
                                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all hover:bg-gray-100"
                                            >
                                              <Lightbulb
                                                className={`w-3 h-3 ${
                                                  (player
                                                    .hints
                                                    ?.length ||
                                                    0) > 0
                                                    ? 'text-blue-500'
                                                    : 'text-gray-400'
                                                }`}
                                              />
                                              <span
                                                className={
                                                  (player
                                                    .hints
                                                    ?.length ||
                                                    0) > 0
                                                    ? 'text-blue-600'
                                                    : 'text-gray-500'
                                                }
                                              >
                                                {player
                                                  .hints
                                                  ?.length ||
                                                  0}
                                                개
                                              </span>
                                              {expandedPlayerId ===
                                              player.socketId ? (
                                                <X className="w-3 h-3" />
                                              ) : (
                                                <ChevronRight className="w-3 h-3" />
                                              )}
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
                                                const input =
                                                  document.getElementById(
                                                    `points-${player.socketId}`
                                                  );
                                                if (
                                                  input &&
                                                  input.value &&
                                                  adminActions
                                                ) {
                                                  adminActions.addPoints(
                                                    player.socketId,
                                                    parseFloat(
                                                      input.value
                                                    )
                                                  );
                                                  input.value =
                                                    '';
                                                  success(
                                                    '포인트 추가',
                                                    `${player.nickname}에게 포인트를 추가했습니다.`,
                                                    2000
                                                  );
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
                                                setConfirmModal(
                                                  {
                                                    type: 'kick',
                                                    title:
                                                      '플레이어 로그아웃',
                                                    message: `정말로 ${player.nickname}님을 로그아웃시키시겠습니까?`,
                                                    confirmText:
                                                      '로그아웃',
                                                    cancelText:
                                                      '취소',
                                                    onConfirm:
                                                      () => {
                                                        if (
                                                          adminActions &&
                                                          adminActions.kickPlayer
                                                        ) {
                                                          adminActions.kickPlayer(
                                                            player.socketId
                                                          );
                                                          success(
                                                            '로그아웃',
                                                            `${player.nickname}님을 로그아웃시켰습니다.`,
                                                            2000
                                                          );
                                                        }
                                                      },
                                                  }
                                                );
                                              }}
                                              disabled={
                                                !player.isOnline
                                              }
                                              className="px-2 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold rounded-lg text-xs sm:text-sm transition-all flex items-center gap-1"
                                              title="로그아웃"
                                            >
                                              <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
                                              <span className="hidden sm:inline">
                                                로그아웃
                                              </span>
                                            </button>
                                            <button
                                              onClick={() => {
                                                setConfirmModal(
                                                  {
                                                    type: 'delete',
                                                    title:
                                                      '플레이어 삭제',
                                                    message: `정말로 ${player.nickname}님의 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
                                                    confirmText:
                                                      '삭제',
                                                    cancelText:
                                                      '취소',
                                                    onConfirm:
                                                      () => {
                                                        if (
                                                          adminActions &&
                                                          adminActions.deletePlayer
                                                        ) {
                                                          adminActions.deletePlayer(
                                                            player.socketId
                                                          );
                                                          // 서버에서 성공 메시지를 보내므로 여기서는 표시하지 않음
                                                        }
                                                      },
                                                  }
                                                );
                                              }}
                                              className="px-2 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold rounded-lg text-xs sm:text-sm transition-all flex items-center gap-1"
                                              title="삭제"
                                            >
                                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                              <span className="hidden sm:inline">
                                                삭제
                                              </span>
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                      {expandedPlayerId ===
                                        player.socketId &&
                                        player.hints &&
                                        player.hints
                                          .length > 0 && (
                                          <tr>
                                            <td
                                              colSpan="6"
                                              className="py-3 px-4 bg-white"
                                            >
                                              <div className="space-y-2">
                                                <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                                  <Lightbulb className="w-4 h-4 text-blue-500" />
                                                  보유 힌트
                                                  (
                                                  {
                                                    player
                                                      .hints
                                                      .length
                                                  }
                                                  개)
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                  {player.hints.map(
                                                    (
                                                      hint,
                                                      hintIndex
                                                    ) => {
                                                      const hintDate =
                                                        new Date(
                                                          hint.receivedAt
                                                        );
                                                      const dateStr = `${
                                                        hintDate.getMonth() +
                                                        1
                                                      }/${hintDate.getDate()} ${hintDate.getHours()}:${hintDate
                                                        .getMinutes()
                                                        .toString()
                                                        .padStart(
                                                          2,
                                                          '0'
                                                        )}`;
                                                      return (
                                                        <div
                                                          key={
                                                            hintIndex
                                                          }
                                                          className="p-2 bg-white rounded-lg border border-blue-200"
                                                        >
                                                          <div className="flex items-start justify-between gap-2 mb-1">
                                                            <div className="flex items-center gap-2">
                                                              <span
                                                                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                                                  hint.difficulty ===
                                                                  '상'
                                                                    ? 'bg-red-100 text-red-700'
                                                                    : hint.difficulty ===
                                                                      '중'
                                                                    ? 'bg-yellow-100 text-yellow-700'
                                                                    : 'bg-green-100 text-green-700'
                                                                }`}
                                                              >
                                                                {
                                                                  hint.difficulty
                                                                }

                                                                급
                                                              </span>
                                                              <span className="text-xs text-gray-500">
                                                                ₩
                                                                {hint.price?.toLocaleString(
                                                                  'ko-KR'
                                                                ) ||
                                                                  0}
                                                              </span>
                                                            </div>
                                                            <span className="text-[10px] text-gray-400">
                                                              {
                                                                dateStr
                                                              }
                                                            </span>
                                                          </div>
                                                          <p className="text-xs text-gray-700 line-clamp-2">
                                                            {hint.content ||
                                                              '힌트 내용이 없습니다.'}
                                                          </p>
                                                        </div>
                                                      );
                                                    }
                                                  )}
                                                </div>
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                    </Fragment>
                                  )
                                )}
                              </>
                            )}

                            {/* 오프라인 플레이어 섹션 */}
                            {offlinePlayers.length > 0 && (
                              <>
                                <tr className="bg-gray-50 border-b-2 border-gray-200">
                                  <td
                                    colSpan={6}
                                    className="py-3 px-2 sm:px-4"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Circle className="w-3 h-3 text-gray-400 fill-gray-400" />
                                      <span className="font-bold text-sm sm:text-base text-gray-700">
                                        오프라인 플레이어 (
                                        {
                                          offlinePlayers.length
                                        }
                                        명)
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                                {offlinePlayers.map(
                                  (player) => (
                                    <Fragment
                                      key={player.socketId}
                                    >
                                      <tr
                                        className={`border-b border-gray-100 hover:bg-gray-50 transition-colors opacity-60`}
                                      >
                                        <td className="py-2 sm:py-3 px-2 sm:px-4 font-semibold text-xs sm:text-sm text-gray-900">
                                          {player.rank ===
                                            1 && (
                                            <span className="text-yellow-600 mr-1">
                                              👑
                                            </span>
                                          )}
                                          {player.nickname}
                                        </td>
                                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-center">
                                          <div className="flex items-center justify-center gap-1">
                                            <Circle
                                              className={`w-2 h-2 text-gray-400 fill-gray-400`}
                                            />
                                            <span
                                              className={`text-xs text-gray-500`}
                                            >
                                              오프라인
                                            </span>
                                          </div>
                                        </td>
                                        <td className="py-2 sm:py-3 px-2 sm:px-4 text-right font-bold text-xs sm:text-sm text-purple-600">
                                          ₩
                                          {player.totalAsset?.toLocaleString(
                                            'ko-KR',
                                            {
                                              maximumFractionDigits: 0,
                                            }
                                          ) || 0}
                                        </td>
                                        <td className="py-2 sm:py-3 px-2 sm:px-4">
                                          <div className="flex flex-col items-center gap-1">
                                            <button
                                              onClick={() =>
                                                setExpandedPlayerId(
                                                  expandedPlayerId ===
                                                    player.socketId
                                                    ? null
                                                    : player.socketId
                                                )
                                              }
                                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all hover:bg-gray-100"
                                            >
                                              <Lightbulb
                                                className={`w-3 h-3 ${
                                                  (player
                                                    .hints
                                                    ?.length ||
                                                    0) > 0
                                                    ? 'text-blue-500'
                                                    : 'text-gray-400'
                                                }`}
                                              />
                                              <span
                                                className={
                                                  (player
                                                    .hints
                                                    ?.length ||
                                                    0) > 0
                                                    ? 'text-blue-600'
                                                    : 'text-gray-500'
                                                }
                                              >
                                                {player
                                                  .hints
                                                  ?.length ||
                                                  0}
                                                개
                                              </span>
                                              {expandedPlayerId ===
                                              player.socketId ? (
                                                <X className="w-3 h-3" />
                                              ) : (
                                                <ChevronRight className="w-3 h-3" />
                                              )}
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
                                              disabled
                                            />
                                            <button
                                              disabled
                                              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-300 text-gray-500 font-semibold rounded-lg text-xs sm:text-sm transition-all cursor-not-allowed"
                                            >
                                              추가
                                            </button>
                                          </div>
                                        </td>
                                        <td className="py-2 sm:py-3 px-2 sm:px-4">
                                          <div className="flex items-center gap-2 justify-center">
                                            <button
                                              disabled
                                              className="px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-300 text-gray-500 font-semibold rounded-lg text-xs sm:text-sm transition-all flex items-center gap-1 cursor-not-allowed"
                                              title="오프라인 플레이어는 로그아웃할 수 없습니다"
                                            >
                                              <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
                                              <span className="hidden sm:inline">
                                                로그아웃
                                              </span>
                                            </button>
                                            <button
                                              onClick={() => {
                                                setConfirmModal(
                                                  {
                                                    type: 'delete',
                                                    title:
                                                      '플레이어 삭제',
                                                    message: `정말로 ${player.nickname}님의 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
                                                    confirmText:
                                                      '삭제',
                                                    cancelText:
                                                      '취소',
                                                    onConfirm:
                                                      () => {
                                                        if (
                                                          adminActions &&
                                                          adminActions.deletePlayer
                                                        ) {
                                                          adminActions.deletePlayer(
                                                            player.socketId
                                                          );
                                                        }
                                                      },
                                                  }
                                                );
                                              }}
                                              className="px-2 sm:px-3 py-1.5 sm:py-2 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold rounded-lg text-xs sm:text-sm transition-all flex items-center gap-1"
                                              title="삭제"
                                            >
                                              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                              <span className="hidden sm:inline">
                                                삭제
                                              </span>
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                      {expandedPlayerId ===
                                        player.socketId &&
                                        player.hints &&
                                        player.hints
                                          .length > 0 && (
                                          <tr>
                                            <td
                                              colSpan="6"
                                              className="py-3 px-4 bg-white"
                                            >
                                              <div className="space-y-2">
                                                <div className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                                  <Lightbulb className="w-4 h-4 text-blue-500" />
                                                  보유 힌트
                                                  (
                                                  {
                                                    player
                                                      .hints
                                                      .length
                                                  }
                                                  개)
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                  {player.hints.map(
                                                    (
                                                      hint,
                                                      hintIndex
                                                    ) => {
                                                      const hintDate =
                                                        new Date(
                                                          hint.receivedAt
                                                        );
                                                      const dateStr = `${
                                                        hintDate.getMonth() +
                                                        1
                                                      }/${hintDate.getDate()} ${hintDate.getHours()}:${hintDate
                                                        .getMinutes()
                                                        .toString()
                                                        .padStart(
                                                          2,
                                                          '0'
                                                        )}`;
                                                      return (
                                                        <div
                                                          key={
                                                            hintIndex
                                                          }
                                                          className="p-2 bg-white rounded-lg border border-blue-200"
                                                        >
                                                          <div className="flex items-start justify-between gap-2 mb-1">
                                                            <div className="flex items-center gap-2">
                                                              <span
                                                                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                                                  hint.difficulty ===
                                                                  '상'
                                                                    ? 'bg-red-100 text-red-700'
                                                                    : hint.difficulty ===
                                                                      '중'
                                                                    ? 'bg-yellow-100 text-yellow-700'
                                                                    : 'bg-green-100 text-green-700'
                                                                }`}
                                                              >
                                                                {
                                                                  hint.difficulty
                                                                }

                                                                급
                                                              </span>
                                                              <span className="text-xs text-gray-500">
                                                                ₩
                                                                {hint.price?.toLocaleString(
                                                                  'ko-KR'
                                                                ) ||
                                                                  0}
                                                              </span>
                                                            </div>
                                                            <span className="text-[10px] text-gray-400">
                                                              {
                                                                dateStr
                                                              }
                                                            </span>
                                                          </div>
                                                          <p className="text-xs text-gray-700 line-clamp-2">
                                                            {hint.content ||
                                                              '힌트 내용이 없습니다.'}
                                                          </p>
                                                        </div>
                                                      );
                                                    }
                                                  )}
                                                </div>
                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                    </Fragment>
                                  )
                                )}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="card-modern p-8 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 text-sm sm:text-base">
                  아직 접속한 플레이어가 없습니다.
                </p>
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
                    <th className="text-left py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      시간
                    </th>
                    <th className="text-left py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      플레이어
                    </th>
                    <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      유형
                    </th>
                    <th className="text-left py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      주식
                    </th>
                    <th className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      수량
                    </th>
                    <th className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      가격
                    </th>
                    <th className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      금액
                    </th>
                    <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      라운드
                    </th>
                    <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      운영자
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactionLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan="9"
                        className="py-8 text-center text-gray-500 text-sm"
                      >
                        아직 거래 로그가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    [...transactionLogs]
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
                        const isBuy = log.type === 'BUY';
                        const isBonusPoints =
                          log.type === 'BONUS_POINTS';
                        const isMinigameReward =
                          log.type === 'MINIGAME_REWARD';
                        const isHintPurchase =
                          log.type === 'HINT_PURCHASE';
                        const isRoundAdvance =
                          log.type === 'ROUND_ADVANCE';
                        const amount = isBuy
                          ? log.totalCost
                          : isBonusPoints ||
                            isMinigameReward
                          ? log.points
                          : isHintPurchase
                          ? log.hintPrice
                          : log.totalRevenue;

                        return (
                          <tr
                            key={index}
                            className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            <td className="py-2 px-2 sm:px-4 text-xs text-gray-600">
                              {timeStr}
                            </td>
                            <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900">
                              {isRoundAdvance
                                ? log.adminId ||
                                  '알 수 없음'
                                : log.nickname}
                            </td>
                            <td className="py-2 px-2 sm:px-4 text-center">
                              {isRoundAdvance ? (
                                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-100 text-indigo-700">
                                  <ChevronRight className="w-3 h-3" />{' '}
                                  라운드 전환
                                </div>
                              ) : isMinigameReward ? (
                                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-yellow-100 text-yellow-700">
                                  <Gamepad2 className="w-3 h-3" />{' '}
                                  미니게임 성공
                                </div>
                              ) : isBonusPoints ? (
                                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-purple-100 text-purple-700">
                                  <Gift className="w-3 h-3" />{' '}
                                  포인트 추가
                                </div>
                              ) : isHintPurchase ? (
                                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold bg-blue-100 text-blue-700">
                                  <Lightbulb className="w-3 h-3" />{' '}
                                  힌트 구매
                                </div>
                              ) : (
                                <div
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                                    isBuy
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {isBuy ? (
                                    <TrendingUp className="w-3 h-3" />
                                  ) : (
                                    <TrendingDown className="w-3 h-3" />
                                  )}
                                  {isBuy ? '매수' : '매도'}
                                </div>
                              )}
                            </td>
                            <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm text-gray-900">
                              {isRoundAdvance ||
                              isBonusPoints ||
                              isMinigameReward ||
                              isHintPurchase
                                ? '-'
                                : getStockName(log.stockId)}
                            </td>
                            <td className="py-2 px-2 sm:px-4 text-right text-xs sm:text-sm text-gray-700">
                              {isRoundAdvance ||
                              isBonusPoints ||
                              isMinigameReward ||
                              isHintPurchase
                                ? '-'
                                : `${log.quantity}주`}
                            </td>
                            <td className="py-2 px-2 sm:px-4 text-right text-xs sm:text-sm text-gray-700">
                              {isRoundAdvance
                                ? '-'
                                : isBonusPoints ||
                                  isMinigameReward ||
                                  isHintPurchase
                                ? isHintPurchase
                                  ? `${log.difficulty}급`
                                  : '-'
                                : `₩${
                                    log.price % 1 === 0
                                      ? log.price.toLocaleString(
                                          'ko-KR'
                                        )
                                      : log.price
                                          .toFixed(2)
                                          .replace(
                                            /\.0+$/,
                                            ''
                                          )
                                  }`}
                            </td>
                            <td
                              className={`py-2 px-2 sm:px-4 text-right text-xs sm:text-sm font-bold ${
                                isRoundAdvance
                                  ? 'text-indigo-600'
                                  : isMinigameReward
                                  ? 'text-yellow-600'
                                  : isBonusPoints
                                  ? 'text-purple-600'
                                  : isHintPurchase
                                  ? 'text-blue-600'
                                  : isBuy
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {isRoundAdvance
                                ? log.message ||
                                  `라운드 ${
                                    (log.round || 0) + 1
                                  }로 전환`
                                : isMinigameReward
                                ? `+₩${amount.toLocaleString(
                                    'ko-KR',
                                    {
                                      maximumFractionDigits: 0,
                                    }
                                  )}`
                                : isBonusPoints
                                ? `+${amount.toLocaleString(
                                    'ko-KR',
                                    {
                                      maximumFractionDigits: 0,
                                    }
                                  )}포인트`
                                : isHintPurchase
                                ? `-₩${amount.toLocaleString(
                                    'ko-KR',
                                    {
                                      maximumFractionDigits: 0,
                                    }
                                  )}`
                                : `${
                                    isBuy ? '-' : '+'
                                  }₩${amount.toLocaleString(
                                    'ko-KR',
                                    {
                                      maximumFractionDigits: 0,
                                    }
                                  )}`}
                            </td>
                            <td className="py-2 px-2 sm:px-4 text-center text-xs text-gray-600">
                              {log.round + 1}
                            </td>
                            <td className="py-2 px-2 sm:px-4 text-center text-xs sm:text-sm text-gray-700">
                              {log.adminId ? (
                                <span className="px-2 py-1 rounded-lg bg-blue-100 text-blue-700 font-semibold">
                                  {log.adminId}
                                </span>
                              ) : (
                                <span className="text-gray-400">
                                  -
                                </span>
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
                      {Math.floor(
                        player.cash || 0
                      ).toLocaleString('ko-KR', {
                        maximumFractionDigits: 0,
                      })}
                      )
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  힌트 난이도
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['하', '중', '상'].map((difficulty) => (
                    <button
                      key={difficulty}
                      onClick={() =>
                        setHintDifficulty(difficulty)
                      }
                      className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                        hintDifficulty === difficulty
                          ? difficulty === '상'
                            ? 'bg-red-500 text-white shadow-md'
                            : difficulty === '중'
                            ? 'bg-yellow-500 text-white shadow-md'
                            : 'bg-green-500 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {difficulty}급
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  힌트 금액 (₩)
                </label>
                <input
                  type="number"
                  value={hintPrice}
                  onChange={(e) =>
                    setHintPrice(e.target.value)
                  }
                  min="0"
                  step="100"
                  placeholder="금액을 입력하세요"
                  className="input-modern w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  힌트 내용
                </label>
                <textarea
                  value={hintContent}
                  onChange={(e) =>
                    setHintContent(e.target.value)
                  }
                  placeholder="힌트 내용을 입력하세요"
                  className="input-modern w-full min-h-[100px]"
                />
              </div>
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
                  const price = parseInt(hintPrice);
                  if (isNaN(price) || price < 0) {
                    error(
                      '오류',
                      '올바른 금액을 입력해주세요.',
                      3000
                    );
                    return;
                  }
                  if (adminActions) {
                    adminActions.grantHint(
                      selectedPlayerId,
                      hintDifficulty,
                      price,
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
                      }에게 ${hintDifficulty}급 힌트를 부여했습니다. (₩${price.toLocaleString(
                        'ko-KR'
                      )})`,
                      3000
                    );
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

            {/* 랜덤 힌트 설정 섹션 */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Shuffle className="w-5 h-5" />
                랜덤 힌트 설정
              </h3>

              {/* 라운드 선택 */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  라운드 선택
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setSelectedRoundForHints(
                        Math.max(
                          0,
                          selectedRoundForHints - 1
                        )
                      )
                    }
                    disabled={selectedRoundForHints === 0}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="px-4 py-2 bg-blue-100 text-blue-700 font-bold rounded-lg min-w-[100px] text-center">
                    라운드 {selectedRoundForHints + 1}
                  </span>
                  <button
                    onClick={() =>
                      setSelectedRoundForHints(
                        Math.min(
                          maxRounds - 1,
                          selectedRoundForHints + 1
                        )
                      )
                    }
                    disabled={
                      selectedRoundForHints >= maxRounds - 1
                    }
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 힌트 입력 */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-700">
                    힌트 목록
                  </span>
                  <button
                    onClick={handleRandomHintsGenerate}
                    className="px-3 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold rounded-lg text-sm transition-all flex items-center gap-2"
                  >
                    <Shuffle className="w-4 h-4" />
                    랜덤 생성
                  </button>
                </div>
                {randomHints.map((hint, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={hint}
                      onChange={(e) =>
                        handleRandomHintChange(
                          index,
                          e.target.value
                        )
                      }
                      placeholder={`힌트 ${
                        index + 1
                      }을 입력하세요...`}
                      className="input-modern flex-1"
                    />
                    {randomHints.length > 1 && (
                      <button
                        onClick={() =>
                          handleRemoveRandomHint(index)
                        }
                        className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <div className="flex gap-2">
                  <button
                    onClick={handleAddRandomHint}
                    className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg text-sm transition-all"
                  >
                    + 힌트 추가
                  </button>
                  <button
                    onClick={handleSaveRandomHints}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Save className="w-5 h-5" />
                    힌트 저장
                  </button>
                </div>
              </div>

              {/* 라운드 1 전용 힌트 전송 버튼 */}
              {selectedRoundForHints === 0 && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <h4 className="text-sm font-bold text-blue-900 mb-2">
                    🎯 라운드 1 전용 힌트 전송
                  </h4>
                  <p className="text-xs text-blue-700 mb-3">
                    저장된 힌트 중 하나를 랜덤으로 모든
                    플레이어에게 전송합니다. 먼저 힌트를
                    저장해주세요.
                  </p>
                  <button
                    onClick={() => {
                      const validHints = randomHints.filter(
                        (h) => h.trim() !== ''
                      );
                      if (validHints.length === 0) {
                        error(
                          '오류',
                          '전송할 힌트가 없습니다. 먼저 힌트를 저장해주세요.',
                          3000
                        );
                        return;
                      }
                      if (
                        adminActions &&
                        adminActions.broadcastRandomHints
                      ) {
                        adminActions.broadcastRandomHints(
                          selectedRoundForHints,
                          validHints
                        );
                        success(
                          '전송 완료',
                          `라운드 1의 힌트가 모든 플레이어에게 랜덤으로 전송되었습니다.`,
                          3000
                        );
                      }
                    }}
                    className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    라운드 1 힌트 전송 (랜덤)
                  </button>
                </div>
              )}

              {/* 일반 랜덤 힌트 전송 버튼 (라운드 2 이상) */}
              {selectedRoundForHints > 0 && (
                <button
                  onClick={() => {
                    const validHints = randomHints.filter(
                      (h) => h.trim() !== ''
                    );
                    if (validHints.length === 0) {
                      error(
                        '오류',
                        '전송할 힌트가 없습니다.',
                        3000
                      );
                      return;
                    }
                    if (
                      adminActions &&
                      adminActions.broadcastRandomHints
                    ) {
                      adminActions.broadcastRandomHints(
                        selectedRoundForHints,
                        validHints
                      );
                      success(
                        '전송 완료',
                        `라운드 ${
                          selectedRoundForHints + 1
                        }의 랜덤 힌트가 모든 플레이어에게 전송되었습니다.`,
                        3000
                      );
                    }
                  }}
                  className="w-full px-4 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-semibold rounded-lg text-sm transition-all flex items-center justify-center gap-2 mt-2"
                >
                  <Send className="w-5 h-5" />
                  랜덤 힌트 전송
                </button>
              )}
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
                <p className="text-sm sm:text-base">
                  아직 플레이어가 없습니다.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {playerList
                  .filter(
                    (player) =>
                      player.rank !== null &&
                      player.rank !== undefined
                  )
                  .sort(
                    (a, b) =>
                      (a.rank || 999) - (b.rank || 999)
                  )
                  .map((player, index) => {
                    const isTopThree = player.rank <= 3;
                    const rankIcon =
                      player.rank === 1
                        ? '🥇'
                        : player.rank === 2
                        ? '🥈'
                        : player.rank === 3
                        ? '🥉'
                        : null;
                    return (
                      <motion.div
                        key={player.socketId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          isTopThree
                            ? player.rank === 1
                              ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300 shadow-md'
                              : player.rank === 2
                              ? 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-300 shadow-md'
                              : 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-300 shadow-md'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <div
                              className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-base ${
                                isTopThree
                                  ? player.rank === 1
                                    ? 'bg-yellow-400 text-yellow-900'
                                    : player.rank === 2
                                    ? 'bg-gray-300 text-gray-800'
                                    : 'bg-orange-300 text-orange-900'
                                  : 'bg-gray-200 text-gray-700'
                              }`}
                            >
                              {rankIcon || player.rank}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`font-bold text-sm sm:text-base truncate ${
                                    isTopThree
                                      ? 'text-gray-900'
                                      : 'text-gray-800'
                                  }`}
                                >
                                  {player.nickname}
                                </span>
                                {!player.isOnline && (
                                  <span className="text-xs text-gray-400">
                                    (오프라인)
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-600">
                                <span>총 자산</span>
                                <span className="font-semibold text-purple-600">
                                  ₩
                                  {player.totalAsset?.toLocaleString(
                                    'ko-KR',
                                    {
                                      maximumFractionDigits: 0,
                                    }
                                  ) || 0}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            {isTopThree && (
                              <Trophy
                                className={`w-6 h-6 sm:w-8 sm:h-8 ${
                                  player.rank === 1
                                    ? 'text-yellow-500'
                                    : player.rank === 2
                                    ? 'text-gray-400'
                                    : 'text-orange-500'
                                }`}
                              />
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
                <div className="text-sm text-gray-600 mb-1">
                  데이터베이스
                </div>
                <div className="text-lg font-bold text-green-600">
                  SQLite (game_data.db)
                </div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <div className="text-sm text-gray-600 mb-2">
                  데이터베이스 확인
                </div>
                <p className="text-xs text-gray-700 mb-2">
                  터미널에서 다음 명령어를 실행하세요:
                </p>
                <code className="block p-2 bg-gray-800 text-green-400 rounded text-xs">
                  npm run check-db
                </code>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">
                    총 거래 로그
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    {transactionLogs.length}건
                  </div>
                </div>
                <div className="p-4 bg-white rounded-lg border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">
                    접속 플레이어
                  </div>
                  <div className="text-2xl font-bold text-orange-600">
                    {playerList.length}명
                  </div>
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
                <h3 className="text-base font-bold text-gray-900 mb-3">
                  게임 설정
                </h3>
                <div className="space-y-3">
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <div className="text-sm font-semibold text-gray-700 mb-2">
                      게임 모드
                    </div>
                    <div className="text-sm text-gray-600">
                      {gameState.isPracticeMode
                        ? '연습 모드'
                        : '실제 게임 모드'}
                    </div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <div className="text-sm font-semibold text-gray-700 mb-2">
                      총 라운드
                    </div>
                    <div className="text-sm text-gray-600">
                      {maxRounds}라운드
                    </div>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <div className="text-sm font-semibold text-gray-700 mb-2">
                      초기 현금
                    </div>
                    <div className="text-sm text-gray-600">
                      ₩3,000,000
                    </div>
                  </div>
                </div>
              </div>

              {/* 온라인 거래 제어 */}
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-3">
                  거래 제어
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      adminActions?.togglePlayerTrading();
                    }}
                    className={`w-full px-4 py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                      gameState.allowPlayerTrading
                        ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                        : 'bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white'
                    }`}
                    title={
                      gameState.allowPlayerTrading
                        ? '온라인 거래 활성화됨 - 클릭하여 비활성화'
                        : '온라인 거래 비활성화됨 - 클릭하여 활성화'
                    }
                  >
                    <TrendingUp className="w-4 h-4" />
                    {gameState.allowPlayerTrading
                      ? '온라인 거래 ON'
                      : '온라인 거래 OFF'}
                  </button>
                </div>
              </div>

              {/* 포인트 지급 */}
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-3">
                  포인트 지급
                </h3>
                <div className="space-y-3">
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      사유
                    </label>
                    <input
                      type="text"
                      value={pointReason}
                      onChange={(e) =>
                        setPointReason(e.target.value)
                      }
                      placeholder="포인트 지급 사유를 입력하세요"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      포인트
                    </label>
                    <input
                      type="number"
                      value={pointAmount}
                      onChange={(e) =>
                        setPointAmount(e.target.value)
                      }
                      placeholder="지급할 포인트 금액"
                      min="0"
                      step="100"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      지급 대상
                    </label>
                    <select
                      value={pointTarget}
                      onChange={(e) => {
                        setPointTarget(e.target.value);
                        if (e.target.value === 'all') {
                          setPointTargetPlayerId('');
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="all">
                        모든 플레이어
                      </option>
                      <option value="specific">
                        특정 플레이어
                      </option>
                    </select>
                  </div>
                  {pointTarget === 'specific' && (
                    <div className="p-4 bg-white rounded-lg border border-gray-200">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        플레이어 선택
                      </label>
                      <select
                        value={pointTargetPlayerId}
                        onChange={(e) =>
                          setPointTargetPlayerId(
                            e.target.value
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">
                          플레이어를 선택하세요
                        </option>
                        {playerList
                          .filter(
                            (p) => p.isOnline === true
                          )
                          .map((player) => (
                            <option
                              key={player.socketId}
                              value={player.socketId}
                            >
                              {player.nickname} (
                              {player.isOnline
                                ? '온라인'
                                : '오프라인'}
                              )
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      if (!pointReason.trim()) {
                        error(
                          '입력 오류',
                          '사유를 입력해주세요.',
                          2000
                        );
                        return;
                      }
                      if (
                        !pointAmount ||
                        parseFloat(pointAmount) <= 0
                      ) {
                        error(
                          '입력 오류',
                          '올바른 포인트 금액을 입력해주세요.',
                          2000
                        );
                        return;
                      }
                      if (
                        pointTarget === 'specific' &&
                        !pointTargetPlayerId
                      ) {
                        error(
                          '입력 오류',
                          '플레이어를 선택해주세요.',
                          2000
                        );
                        return;
                      }

                      const points =
                        parseFloat(pointAmount);
                      const reason = pointReason.trim();

                      if (pointTarget === 'all') {
                        if (adminActions?.addPointsToAll) {
                          adminActions.addPointsToAll(
                            points,
                            reason
                          );
                          success(
                            '포인트 지급',
                            `모든 플레이어에게 ${points.toLocaleString(
                              'ko-KR'
                            )}포인트를 지급했습니다. (사유: ${reason})`,
                            3000
                          );
                          setPointReason('');
                          setPointAmount('');
                        }
                      } else {
                        if (adminActions?.addPoints) {
                          adminActions.addPoints(
                            pointTargetPlayerId,
                            points,
                            reason
                          );
                          const selectedPlayer =
                            playerList.find(
                              (p) =>
                                p.socketId ===
                                pointTargetPlayerId
                            );
                          success(
                            '포인트 지급',
                            `${
                              selectedPlayer?.nickname ||
                              '플레이어'
                            }에게 ${points.toLocaleString(
                              'ko-KR'
                            )}포인트를 지급했습니다. (사유: ${reason})`,
                            3000
                          );
                          setPointReason('');
                          setPointAmount('');
                          setPointTargetPlayerId('');
                        }
                      }
                    }}
                    disabled={
                      !pointReason.trim() ||
                      !pointAmount ||
                      parseFloat(pointAmount) <= 0 ||
                      (pointTarget === 'specific' &&
                        !pointTargetPlayerId)
                    }
                    className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Gift className="w-4 h-4" />
                    포인트 지급하기
                  </button>
                </div>
              </div>

              {/* 힌트 지급 (모두에게) */}
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-3">
                  힌트 지급 (모두에게, 포인트 차감 없음)
                </h3>
                <div className="space-y-3">
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      힌트 난이도
                    </label>
                    <select
                      value={hintForAllDifficulty}
                      onChange={(e) =>
                        setHintForAllDifficulty(
                          e.target.value
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="하">하급</option>
                      <option value="중">중급</option>
                      <option value="상">상급</option>
                    </select>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      힌트 내용
                    </label>
                    <textarea
                      value={hintForAllContent}
                      onChange={(e) =>
                        setHintForAllContent(e.target.value)
                      }
                      placeholder="힌트 내용을 입력하세요"
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (!hintForAllContent.trim()) {
                        error(
                          '입력 오류',
                          '힌트 내용을 입력해주세요.',
                          2000
                        );
                        return;
                      }

                      if (adminActions?.grantHintToAll) {
                        // 포인트 차감 없이 지급 (price = 0)
                        adminActions.grantHintToAll(
                          hintForAllDifficulty,
                          0,
                          hintForAllContent.trim()
                        );
                        success(
                          '힌트 지급',
                          `모든 플레이어에게 ${hintForAllDifficulty}급 힌트를 지급했습니다. (포인트 차감 없음)`,
                          3000
                        );
                        setHintForAllContent('');
                      }
                    }}
                    disabled={!hintForAllContent.trim()}
                    className="w-full px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Lightbulb className="w-4 h-4" />
                    모두에게 힌트 지급하기
                  </button>
                </div>
              </div>

              {/* 플레이어 데이터 관리 */}
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-3">
                  플레이어 데이터 관리
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setConfirmModal({
                        type: 'deleteAll',
                        title: '모든 플레이어 삭제',
                        message: `정말로 모든 플레이어 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 모든 플레이어가 강제로 로그아웃됩니다.`,
                        confirmText: '모두 삭제',
                        cancelText: '취소',
                        onConfirm: () => {
                          console.log(
                            '[DeveloperPage] 모든 플레이어 삭제 확인됨'
                          );
                          if (
                            adminActions?.deleteAllPlayers
                          ) {
                            console.log(
                              '[DeveloperPage] deleteAllPlayers 호출:',
                              gameState.isPracticeMode
                            );
                            adminActions.deleteAllPlayers(
                              gameState.isPracticeMode
                            );
                            setConfirmModal(null); // 모달 닫기
                          } else {
                            console.error(
                              '[DeveloperPage] adminActions.deleteAllPlayers가 없습니다.'
                            );
                            error(
                              '오류',
                              '삭제 기능을 사용할 수 없습니다.',
                              3000
                            );
                          }
                        },
                      });
                    }}
                    className="w-full px-4 py-3 bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    모든 플레이어 삭제
                  </button>
                  <button
                    onClick={() => {
                      setConfirmModal({
                        type: 'clearTransactions',
                        title: '거래로그 비우기',
                        message: `정말로 모든 거래 내역을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
                        confirmText: '비우기',
                        cancelText: '취소',
                        onConfirm: () => {
                          console.log(
                            '[DeveloperPage] 거래로그 비우기 확인됨'
                          );
                          if (
                            adminActions?.clearAllTransactions
                          ) {
                            console.log(
                              '[DeveloperPage] clearAllTransactions 호출:',
                              gameState.isPracticeMode
                            );
                            adminActions.clearAllTransactions(
                              gameState.isPracticeMode
                            );
                            setConfirmModal(null); // 모달 닫기
                          } else {
                            console.error(
                              '[DeveloperPage] adminActions.clearAllTransactions가 없습니다.'
                            );
                            error(
                              '오류',
                              '거래로그 비우기 기능을 사용할 수 없습니다.',
                              3000
                            );
                          }
                        },
                      });
                    }}
                    className="w-full px-4 py-3 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                  >
                    <Database className="w-4 h-4" />
                    거래로그 비우기
                  </button>
                </div>
              </div>

              {/* 운영자 계정 관리 */}
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-3">
                  운영자 계정 관리
                </h3>
                <div className="space-y-4">
                  {/* 운영자 계정 목록 */}
                  <div className="p-4 bg-white rounded-lg border border-gray-200">
                    <div className="text-sm font-semibold text-gray-700 mb-3">
                      등록된 운영자
                    </div>
                    {admins.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        등록된 운영자가 없습니다.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {admins.map((admin) => (
                          <div
                            key={admin.id}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                          >
                            <div>
                              <div className="text-sm font-semibold text-gray-900">
                                {admin.admin_id}
                              </div>
                              <div className="text-xs text-gray-500">
                                생성일:{' '}
                                {new Date(
                                  admin.created_at
                                ).toLocaleDateString(
                                  'ko-KR'
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {editingAdminId ===
                              admin.id ? (
                                <div className="flex gap-2">
                                  <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) =>
                                      setNewPassword(
                                        e.target.value
                                      )
                                    }
                                    placeholder="새 비밀번호"
                                    className="px-2 py-1 text-xs border rounded"
                                  />
                                  <button
                                    onClick={() => {
                                      if (
                                        adminActions?.updateAdminPassword &&
                                        newPassword.trim()
                                      ) {
                                        adminActions.updateAdminPassword(
                                          admin.id,
                                          newPassword
                                        );
                                        setEditingAdminId(
                                          null
                                        );
                                        setNewPassword('');
                                      } else {
                                        error(
                                          '오류',
                                          '새 비밀번호를 입력해주세요.',
                                          3000
                                        );
                                      }
                                    }}
                                    className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                                  >
                                    저장
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingAdminId(
                                        null
                                      );
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
                                      setEditingAdminId(
                                        admin.id
                                      );
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
                                        title:
                                          '운영자 계정 삭제',
                                        message: `정말로 '${admin.admin_id}' 운영자 계정을 삭제하시겠습니까?`,
                                        confirmText: '삭제',
                                        cancelText: '취소',
                                        onConfirm: () => {
                                          if (
                                            adminActions?.deleteAdmin
                                          ) {
                                            adminActions.deleteAdmin(
                                              admin.id
                                            );
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
                    <div className="text-sm font-semibold text-gray-700 mb-3">
                      새 운영자 계정 추가
                    </div>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newAdminId}
                        onChange={(e) =>
                          setNewAdminId(e.target.value)
                        }
                        placeholder="운영자 ID"
                        className="input-modern w-full text-sm"
                      />
                      <input
                        type="password"
                        value={newAdminPassword}
                        onChange={(e) =>
                          setNewAdminPassword(
                            e.target.value
                          )
                        }
                        placeholder="비밀번호"
                        className="input-modern w-full text-sm"
                      />
                      <button
                        onClick={() => {
                          if (adminActions?.createAdmin) {
                            adminActions.createAdmin(
                              newAdminId,
                              newAdminPassword
                            );
                            setNewAdminId('');
                            setNewAdminPassword('');
                          }
                        }}
                        disabled={
                          !newAdminId.trim() ||
                          !newAdminPassword.trim()
                        }
                        className={`w-full py-2 px-4 rounded-lg font-semibold text-sm ${
                          newAdminId.trim() &&
                          newAdminPassword.trim()
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

        {/* 전광판 메시지 탭 */}
        {activeTab === 'display' && (
          <motion.div
            key="display"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="card-modern p-3 sm:p-4 mb-6 sm:mb-8"
          >
            <h2 className="text-lg sm:text-xl font-bold gradient-text mb-3 sm:mb-4 flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 sm:w-6 sm:h-6" />
              전광판 메시지 관리
            </h2>
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 sm:p-6 border-2 border-purple-200">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={displayMessage}
                  onChange={(e) =>
                    setDisplayMessage(e.target.value)
                  }
                  placeholder="전광판에 표시할 메시지를 입력하세요"
                  className="flex-1 px-4 py-2 sm:py-3 rounded-lg border-2 border-purple-300 focus:border-purple-500 focus:outline-none text-sm sm:text-base"
                  disabled={isMessageActive}
                  onKeyPress={(e) => {
                    if (
                      e.key === 'Enter' &&
                      !isMessageActive &&
                      displayMessage.trim()
                    ) {
                      adminActions?.broadcastMessage(
                        displayMessage.trim()
                      );
                      setIsMessageActive(true);
                      success(
                        '메시지 전송',
                        '전광판에 메시지가 표시되었습니다.',
                        3000
                      );
                    }
                  }}
                />
                <div className="flex gap-2">
                  {!isMessageActive ? (
                    <button
                      onClick={() => {
                        if (displayMessage.trim()) {
                          adminActions?.broadcastMessage(
                            displayMessage.trim()
                          );
                          setIsMessageActive(true);
                          success(
                            '메시지 전송',
                            '전광판에 메시지가 표시되었습니다.',
                            3000
                          );
                        } else {
                          error(
                            '입력 오류',
                            '메시지를 입력해주세요.',
                            3000
                          );
                        }
                      }}
                      className="px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold text-sm sm:text-base bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white transition-all flex items-center gap-2"
                    >
                      <Rocket className="w-4 h-4" />
                      메시지 전송
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        adminActions?.closeMessage();
                        setIsMessageActive(false);
                        setDisplayMessage('');
                        success(
                          '메시지 종료',
                          '전광판 메시지가 종료되었습니다.',
                          3000
                        );
                      }}
                      className="px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold text-sm sm:text-base bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white transition-all flex items-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      메시지 종료
                    </button>
                  )}
                </div>
              </div>
              {isMessageActive && (
                <div className="mt-3 text-sm text-purple-700 font-semibold">
                  현재 전광판에 메시지가 표시 중입니다. 종료
                  버튼을 눌러 메시지를 닫을 수 있습니다.
                </div>
              )}
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
        type={
          confirmModal?.type === 'end' ||
          confirmModal?.type === 'delete' ||
          confirmModal?.type === 'deleteAll' ||
          confirmModal?.type === 'clearTransactions'
            ? 'danger'
            : confirmModal?.type === 'kick'
            ? 'warning'
            : 'default'
        }
      />

      {/* 게임 시작 모달 (레거시) */}
      <GameStartModal
        isOpen={!!gameStartModal}
        onClose={() => setGameStartModal(null)}
        onConfirm={gameStartModal?.onConfirm || (() => {})}
        type={gameStartModal?.type || 'practice'}
        gameState={gameState}
        playerCount={playerCount}
      />

      {/* 시나리오 설정 모달 */}
      <ScenarioSetupModal
        isOpen={!!scenarioSetupModal}
        onClose={() => setScenarioSetupModal(null)}
        onStartGame={(stocks, rounds, shouldDelete) => {
          const isPractice = scenarioSetupModal?.type === 'practice';
          adminActions?.startGameWithScenario(stocks, rounds, isPractice, shouldDelete);
          setScenarioSetupModal(null);
          success(
            '게임 시작',
            isPractice ? '연습 게임이 시작되었습니다.' : '실제 게임이 시작되었습니다.',
            3000
          );
        }}
        type={scenarioSetupModal?.type || 'practice'}
        socket={socket}
        adminActions={adminActions}
        gameState={gameState}
        playerCount={playerCount}
      />

      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
