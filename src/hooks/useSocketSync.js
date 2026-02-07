import { useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';

// 현재 호스트의 IP 주소 자동 감지
function getSocketURL() {
  // 환경 변수가 설정되어 있으면 사용
  if (import.meta.env.VITE_SOCKET_URL) {
    console.log(
      '[getSocketURL] 환경 변수 사용:',
      import.meta.env.VITE_SOCKET_URL
    );
    return import.meta.env.VITE_SOCKET_URL;
  }

  // 현재 호스트의 포트와 프로토콜 사용
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;

  // Vite 개발 서버를 사용하는 경우 (localhost:5173 또는 네트워크 IP:5173)
  // Vite proxy를 통해 연결하므로 상대 경로 사용
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  ) {
    const url = 'http://localhost:3001';
    console.log('[getSocketURL] localhost 사용:', url);
    return url;
  }

  // 네트워크 IP를 사용하는 경우
  const url = `${protocol}//${hostname}:3001`;
  console.log('[getSocketURL] 네트워크 주소 사용:', url);
  return url;
}

const SOCKET_URL = getSocketURL();

export function useSocketSync(isAdmin = false, isDisplay = false) {
  const [gameState, setGameState] = useState({
    currentRound: 0,
    stockPrices: {},
    currentNews: '',
    currentNewsBriefing: [], // 뉴스 브리핑 배열
    isGameStarted: false,
    isPracticeMode: false,
    isWaitingMode: true,
    isGameEnded: false, // 게임 종료 상태
    priceHistory: {},
    portfolio: null, // 플레이어 포트폴리오
    countdown: null, // 라운드 전환 카운트다운
    roundTimer: null, // 라운드 타이머 (서버에서 동기화)
    allowPlayerTrading: false, // 플레이어 직접 거래 허용 여부
    isTradingBlocked: false, // 미니게임 진행 중 투자 차단 여부
    isPlayerTradingBlocked: false, // 개별 플레이어 투자 차단 여부
    blockedRewardAmount: null, // 차단 시 보상 금액
    blockedMessage: null, // 차단 시 관리자 메시지
  });
  const [displayMessage, setDisplayMessage] =
    useState(null); // 전광판 메시지
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [playerList, setPlayerList] = useState([]); // 관리자용 플레이어 리스트
  const [connectedAdmins, setConnectedAdmins] = useState(
    []
  ); // 접속 중인 운영자 목록
  const [playerRank, setPlayerRank] = useState(null); // 플레이어용 순위 정보 { rank, totalPlayers, totalAsset }
  const [rankList, setRankList] = useState([]); // 플레이어용 전체 순위 리스트
  const [transactionLogs, setTransactionLogs] = useState(
    []
  ); // 관리자용 거래 로그
  const [playerTransactions, setPlayerTransactions] =
    useState([]); // 플레이어용 거래 내역
  const [hintRequests, setHintRequests] = useState([]); // 관리자용 힌트 구매 요청 목록
  const [gameSettings, setGameSettings] = useState({
    initialCash: 3000000,
    totalRounds: 12,
  });
  const socketRef = useRef(null);
  const isInitializedRef = useRef(false);
  const bonusPointsCallbackRef = useRef(null); // 보너스 포인트 추가 콜백
  const transactionErrorCallbackRef = useRef(null); // 거래 오류 콜백
  const hintsUpdateCallbackRef = useRef(null); // 힌트 업데이트 콜백
  const tradeExecutedCallbackRef = useRef(null); // 거래 체결 콜백
  const adminErrorCallbackRef = useRef(null); // 관리자 에러 콜백
  const roundTimerEndCallbackRef = useRef(null); // 라운드 타이머 종료 콜백 (관리자만)
  const adminsListCallbackRef = useRef(null); // 운영자 계정 목록 콜백
  const adminSuccessCallbackRef = useRef(null); // 관리자 성공 콜백
  const minigameSuccessCallbackRef = useRef(null); // 미니게임 성공 콜백
  const hintErrorCallbackRef = useRef(null); // 힌트 에러 콜백 (관리자)
  const minigameCompleteCallbackRef = useRef(null); // 미니게임 완료 알림 콜백 (관리자)
  const rumorUpdateCallbackRef = useRef(null); // 찌라시 업데이트 콜백

  useEffect(() => {
    // 이미 초기화되었으면 스킵 (React StrictMode 대응)
    if (isInitializedRef.current && socketRef.current) {
      // 이미 연결되어 있으면 상태 업데이트
      if (socketRef.current.connected) {
        setConnected(true);
      }
      return;
    }

    // Socket 연결
    if (!socketRef.current) {
      console.log(
        `[useSocketSync] Socket 연결 시도: ${SOCKET_URL} (관리자: ${isAdmin}, 전광판: ${isDisplay})`
      );
      socketRef.current = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity, // 무한 재연결 시도
        timeout: 20000,
        autoConnect: true,
        forceNew: false, // 기존 연결 재사용
        upgrade: true, // HTTP long-polling에서 WebSocket으로 업그레이드 허용
      });
      isInitializedRef.current = true;
    }

    const socket = socketRef.current;

    // 이미 연결되어 있으면 상태 업데이트
    if (socket.connected) {
      setConnected(true);
      console.log('[useSocketSync] Socket 이미 연결됨');
    }

    // 이벤트 리스너 등록 (중복 방지를 위해 기존 리스너 제거 후 등록)
    const handleConnect = () => {
      setConnected(true);
      console.log('[useSocketSync] Socket 연결됨');

      // 관리자 인증은 AdminPage에서 비밀번호와 함께 수행
      if (!isAdmin) {
        // 플레이어는 연결 시 게임 상태 요청
        socket.emit('PLAYER_REQUEST_STATE');
      }
      // 전광판은 거래 로그를 구독
      if (isDisplay) {
        socket.emit('DISPLAY_REGISTER');
      }
    };

    const handleDisconnect = () => {
      setConnected(false);
      console.log('[useSocketSync] Socket 연결 해제');
    };

    const handleConnectError = (error) => {
      setConnected(false);
      console.error(
        '[useSocketSync] Socket 연결 오류:',
        error.message
      );
      console.log(
        '[useSocketSync] 서버가 실행 중인지 확인하세요: npm run server'
      );
    };

    // 기존 리스너 제거 후 새로 등록
    socket.off('connect', handleConnect);
    socket.off('disconnect', handleDisconnect);
    socket.off('connect_error', handleConnectError);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    const handleReconnect = (attemptNumber) => {
      setConnected(true);
      console.log(
        `[useSocketSync] Socket 재연결 성공 (시도 ${attemptNumber}회)`
      );

      // 관리자 인증 재시도는 AdminPage에서 처리
      if (!isAdmin) {
        // 플레이어는 재연결 시 게임 상태 요청
        socket.emit('PLAYER_REQUEST_STATE');

        // 저장된 닉네임으로 자동 재접속
        const savedNickname = localStorage.getItem('mz_investment_nickname');
        if (savedNickname) {
          socket.emit('PLAYER_JOIN', savedNickname);
        }
      }
      // 전광판은 재연결 시에도 다시 등록
      if (isDisplay) {
        socket.emit('DISPLAY_REGISTER');
      }
    };

    const handleReconnectAttempt = (attemptNumber) => {
      console.log(
        `[useSocketSync] Socket 재연결 시도 중... (${attemptNumber}회)`
      );
    };

    const handleReconnectFailed = () => {
      setConnected(false);
      console.error(
        '[useSocketSync] Socket 재연결 실패. 서버를 확인하세요.'
      );
    };

    socket.off('reconnect', handleReconnect);
    socket.off('reconnect_attempt', handleReconnectAttempt);
    socket.off('reconnect_failed', handleReconnectFailed);

    socket.on('reconnect', handleReconnect);
    socket.on('reconnect_attempt', handleReconnectAttempt);
    socket.on('reconnect_failed', handleReconnectFailed);

    // 게임 상태 업데이트 수신
    const handleGameStateUpdate = (state) => {
      console.log(
        '[useSocketSync] 게임 상태 업데이트 수신:',
        state
      );
      setGameState((prev) => {
        // isGameEnded가 명시적으로 false로 오면 무조건 업데이트 (게임 재시작)
        const newState = { ...prev, ...state };
        // isGameEnded가 false이거나 undefined가 아니면 항상 업데이트
        if (state.isGameEnded !== undefined) {
          newState.isGameEnded = state.isGameEnded;
        }
        return newState;
      });

      // DisplayBoard용: rankList와 playerCount 업데이트
      if (state.rankList !== undefined) {
        setRankList(state.rankList);
      }
      if (state.playerCount !== undefined) {
        setPlayerCount(state.playerCount);
      }
    };
    socket.off('GAME_STATE_UPDATE', handleGameStateUpdate);
    socket.on('GAME_STATE_UPDATE', handleGameStateUpdate);

    // 라운드 타이머 업데이트 수신
    const handleRoundTimerUpdate = (data) => {
      setGameState((prev) => ({
        ...prev,
        roundTimer: data.roundTimer,
      }));
    };
    socket.off('ROUND_TIMER_UPDATE', handleRoundTimerUpdate);
    socket.on('ROUND_TIMER_UPDATE', handleRoundTimerUpdate);

    // 카운트다운 업데이트 수신
    const handleRoundCountdown = (data) => {
      setGameState((prev) => ({
        ...prev,
        countdown: data.countdown,
      }));
    };
    socket.off('ROUND_COUNTDOWN', handleRoundCountdown);
    socket.on('ROUND_COUNTDOWN', handleRoundCountdown);

    // 전광판 메시지 수신
    const handleDisplayMessage = (data) => {
      setDisplayMessage({
        message: data.message,
        adminId: data.adminId,
        timestamp: data.timestamp,
      });
    };
    socket.off('DISPLAY_MESSAGE', handleDisplayMessage);
    socket.on('DISPLAY_MESSAGE', handleDisplayMessage);

    // 전광판 메시지 종료 수신
    const handleCloseDisplayMessage = () => {
      setDisplayMessage(null);
    };
    socket.off('CLOSE_DISPLAY_MESSAGE', handleCloseDisplayMessage);
    socket.on('CLOSE_DISPLAY_MESSAGE', handleCloseDisplayMessage);

    // 게임 종료 수신
    const handleGameEnd = () => {
      setGameState((prev) => ({
        ...prev,
        isGameEnded: true,
        isGameStarted: false,
        isWaitingMode: true,
      }));
    };
    socket.off('GAME_END', handleGameEnd);
    socket.on('GAME_END', handleGameEnd);

    // 게임 재시작 수신 (게임 종료 상태 해제)
    const handleGameRestart = () => {
      setGameState((prev) => ({
        ...prev,
        isGameEnded: false,
      }));
    };
    socket.off('GAME_RESTART', handleGameRestart);
    socket.on('GAME_RESTART', handleGameRestart);

    // 플레이어 포트폴리오 업데이트 수신
    const handlePortfolioUpdate = (portfolio) => {
      if (!isAdmin) {
        setGameState((prev) => ({ ...prev, portfolio }));
      }
    };
    socket.off('PLAYER_PORTFOLIO_UPDATE', handlePortfolioUpdate);
    socket.on('PLAYER_PORTFOLIO_UPDATE', handlePortfolioUpdate);

    // 플레이어 힌트 업데이트 수신
    if (!isAdmin) {
      const handleHintsUpdate = (hints) => {
        console.log(
          '[useSocketSync] 힌트 업데이트 수신:',
          hints
        );
        // 힌트 콜백이 있으면 호출 (PlayerPage에서 힌트 목록 업데이트용)
        if (hintsUpdateCallbackRef.current) {
          console.log('[useSocketSync] 힌트 콜백 호출');
          hintsUpdateCallbackRef.current(hints);
        } else {
          console.log(
            '[useSocketSync] 힌트 콜백이 설정되지 않음 - 나중에 설정되면 전달됨'
          );
        }
      };

      socket.off('PLAYER_HINTS_UPDATE', handleHintsUpdate);
      socket.on('PLAYER_HINTS_UPDATE', handleHintsUpdate);

      // 플레이어 투자 차단 상태 업데이트 수신
      const handleTradingBlocked = (data) => {
        console.log(
          '[useSocketSync] 투자 차단 상태 업데이트 수신:',
          data
        );
        setGameState((prev) => ({
          ...prev,
          isPlayerTradingBlocked: data.isBlocked || false,
          blockedRewardAmount: data.rewardAmount || null,
          blockedMessage: data.message || null,
        }));
      };

      socket.off(
        'PLAYER_TRADING_BLOCKED',
        handleTradingBlocked
      );
      socket.on(
        'PLAYER_TRADING_BLOCKED',
        handleTradingBlocked
      );

      // 미니게임 성공 알림 수신
      const handleMinigameSuccess = (data) => {
        console.log(
          '[useSocketSync] 미니게임 성공 알림 수신:',
          data
        );
        // 미니게임 성공 콜백이 있으면 호출
        if (minigameSuccessCallbackRef.current) {
          minigameSuccessCallbackRef.current(data);
        }
      };

      socket.off('MINIGAME_SUCCESS', handleMinigameSuccess);
      socket.on('MINIGAME_SUCCESS', handleMinigameSuccess);

      // 플레이어 찌라시 업데이트 수신
      const handleRumorUpdate = (data) => {
        console.log(
          '[useSocketSync] 찌라시 업데이트 수신:',
          data
        );
        // 찌라시 콜백이 있으면 호출 (PlayerPage에서 찌라시 표시용)
        if (rumorUpdateCallbackRef.current) {
          rumorUpdateCallbackRef.current(data);
        }
      };

      socket.off('PLAYER_RUMOR_UPDATE', handleRumorUpdate);
      socket.on('PLAYER_RUMOR_UPDATE', handleRumorUpdate);

      // 플레이어 거래 내역 업데이트 수신
      const handleTransactionsUpdate = (transactions) => {
        console.log(
          '[useSocketSync] 거래 내역 업데이트 수신:',
          transactions.length,
          '개'
        );
        setPlayerTransactions(transactions);
      };
      socket.off(
        'PLAYER_TRANSACTIONS_UPDATE',
        handleTransactionsUpdate
      );
      socket.on(
        'PLAYER_TRANSACTIONS_UPDATE',
        handleTransactionsUpdate
      );
    }

    // 플레이어 전용: 보너스 포인트 추가 알림
    const handleBonusPointsAdded = (data) => {
      if (bonusPointsCallbackRef.current) {
        bonusPointsCallbackRef.current(
          data.points,
          data.totalBonusPoints,
          data.source,
          data.round
        );
      }
    };
    if (!isAdmin) {
      socket.off('BONUS_POINTS_ADDED', handleBonusPointsAdded);
      socket.on('BONUS_POINTS_ADDED', handleBonusPointsAdded);
    }

    // 거래 오류 수신
    const handleTransactionError = (error) => {
      console.error('거래 오류:', error.message);
      if (transactionErrorCallbackRef.current) {
        transactionErrorCallbackRef.current(error.message);
      }
    };
    socket.off('TRANSACTION_ERROR', handleTransactionError);
    socket.on('TRANSACTION_ERROR', handleTransactionError);

    // 플레이어 전용: 거래 체결 알림
    if (!isAdmin) {
      const handleTradeExecuted = (data) => {
        if (tradeExecutedCallbackRef.current) {
          tradeExecutedCallbackRef.current(data);
        }
      };

      socket.off('TRADE_EXECUTED', handleTradeExecuted);
      socket.on('TRADE_EXECUTED', handleTradeExecuted);
    }

    // 플레이어 전용: 순위 업데이트 수신
    const handlePlayerRankUpdate = (rankData) => {
      setPlayerRank(rankData);
    };
    const handlePlayerRankListUpdate = (list) => {
      setRankList(list);
    };
    if (!isAdmin) {
      socket.off('PLAYER_RANK_UPDATE', handlePlayerRankUpdate);
      socket.off('PLAYER_RANK_LIST_UPDATE', handlePlayerRankListUpdate);
      socket.on('PLAYER_RANK_UPDATE', handlePlayerRankUpdate);
      socket.on('PLAYER_RANK_LIST_UPDATE', handlePlayerRankListUpdate);
    }

    // 닉네임 오류 수신 (플레이어만)
    const handleNicknameError = (error) => {
      console.error('닉네임 오류:', error.message);
      if (socket.nicknameErrorCallback) {
        socket.nicknameErrorCallback(error.message);
      }
    };
    const handleNicknameDuplicateKick = (data) => {
      console.warn('중복 로그인으로 인한 연결 끊김:', data.message);
      if (socket.nicknameErrorCallback) {
        socket.nicknameErrorCallback(data.message);
      }
      socket.disconnect();
    };
    const handleAdminKick = (data) => {
      console.warn('관리자에 의한 로그아웃:', data.message);
      if (socket.nicknameErrorCallback) {
        socket.nicknameErrorCallback(data.message);
      }
      socket.disconnect();
    };
    const handleAdminDelete = (data) => {
      console.warn('관리자에 의한 계정 삭제:', data.message);
      if (socket.nicknameErrorCallback) {
        socket.nicknameErrorCallback(data.message);
      }
      localStorage.removeItem('mz_investment_nickname');
      socket.disconnect();
    };
    if (!isAdmin) {
      socket.off('NICKNAME_ERROR', handleNicknameError);
      socket.off('NICKNAME_DUPLICATE_KICK', handleNicknameDuplicateKick);
      socket.off('ADMIN_KICK', handleAdminKick);
      socket.off('ADMIN_DELETE', handleAdminDelete);
      socket.on('NICKNAME_ERROR', handleNicknameError);
      socket.on('NICKNAME_DUPLICATE_KICK', handleNicknameDuplicateKick);
      socket.on('ADMIN_KICK', handleAdminKick);
      socket.on('ADMIN_DELETE', handleAdminDelete);
    }

    // 관리자 전용: 플레이어 수 업데이트
    if (isAdmin) {
      const handleAdminAuthSuccess = () => {
        console.log('[useSocketSync] ADMIN_AUTH_SUCCESS 이벤트 수신');
        // 콜백이 있으면 호출
        if (socket.adminAuthSuccessCallback) {
          console.log('[useSocketSync] adminAuthSuccessCallback 호출');
          socket.adminAuthSuccessCallback();
        } else {
          console.log('[useSocketSync] adminAuthSuccessCallback이 없음');
        }
        // 플레이어 리스트 요청
        socket.emit('ADMIN_REQUEST_PLAYER_LIST');
        // 게임 설정 요청
        socket.emit('ADMIN_REQUEST_GAME_SETTINGS');
      };

      // 기존 핸들러 모두 제거 후 새로 등록
      socket.removeAllListeners('ADMIN_AUTH_SUCCESS');
      socket.on(
        'ADMIN_AUTH_SUCCESS',
        handleAdminAuthSuccess
      );

      const handleAdminAuthError = (error) => {
        console.log('[useSocketSync] ADMIN_AUTH_ERROR 이벤트 수신:', error);
        if (socket.adminAuthErrorCallback) {
          socket.adminAuthErrorCallback(error.message);
        }
      };

      socket.removeAllListeners('ADMIN_AUTH_ERROR');
      socket.on('ADMIN_AUTH_ERROR', handleAdminAuthError);

      // 관리자용: 거래 로그 수신
      const handleAdminTransactionLogUpdate = (transaction) => {
        setTransactionLogs((prev) => {
          const next = [...prev, transaction];
          return next.length > 200 ? next.slice(-200) : next;
        });
      };
      const handleAdminTransactionLogsInit = (logs) => {
        setTransactionLogs(logs);
      };
      socket.off('TRANSACTION_LOG_UPDATE', handleAdminTransactionLogUpdate);
      socket.off('TRANSACTION_LOGS_INIT', handleAdminTransactionLogsInit);
      socket.on('TRANSACTION_LOG_UPDATE', handleAdminTransactionLogUpdate);
      socket.on('TRANSACTION_LOGS_INIT', handleAdminTransactionLogsInit);

      const handlePlayerCountUpdate = (count) => {
        setPlayerCount(count);
      };

      // 관리자용: 에러 수신
      const handleAdminError = (error) => {
        // error가 문자열이면 그대로 사용, 객체면 message 속성 사용
        const errorMessage =
          typeof error === 'string'
            ? error
            : error?.message ||
              error ||
              '알 수 없는 오류가 발생했습니다.';
        console.error('[관리자 에러]', errorMessage);
        // 에러 콜백이 있으면 호출 (각 페이지에서 Toast 표시용)
        if (adminErrorCallbackRef.current) {
          adminErrorCallbackRef.current(errorMessage);
        }
      };

      socket.off('ADMIN_ERROR', handleAdminError);
      socket.on('ADMIN_ERROR', handleAdminError);

      // 관리자용: 운영자 계정 목록 수신
      const handleAdminsListUpdate = (admins) => {
        if (adminsListCallbackRef.current) {
          adminsListCallbackRef.current(admins);
        }
      };
      socket.off(
        'ADMINS_LIST_UPDATE',
        handleAdminsListUpdate
      );
      socket.on(
        'ADMINS_LIST_UPDATE',
        handleAdminsListUpdate
      );

      // 관리자용: 성공 메시지 수신
      const handleAdminActionSuccess = (data) => {
        if (adminSuccessCallbackRef.current) {
          adminSuccessCallbackRef.current(data.message);
        }
      };
      socket.off(
        'ADMIN_ACTION_SUCCESS',
        handleAdminActionSuccess
      );
      socket.on(
        'ADMIN_ACTION_SUCCESS',
        handleAdminActionSuccess
      );

      // 관리자용: 힌트 에러 수신
      const handleHintError = (data) => {
        const msg = data?.message || '힌트 처리 중 오류가 발생했습니다.';
        console.error('[관리자 힌트 에러]', msg);
        if (hintErrorCallbackRef.current) {
          hintErrorCallbackRef.current(msg);
        }
      };

      socket.off('HINT_GRANT_ERROR', handleHintError);
      socket.off('HINT_BROADCAST_ERROR', handleHintError);
      socket.on('HINT_GRANT_ERROR', handleHintError);
      socket.on('HINT_BROADCAST_ERROR', handleHintError);

      // 관리자용: 미니게임 완료 알림 수신
      const handleMinigameCompleteNotification = (data) => {
        console.log('[관리자] 미니게임 완료 알림:', data);
        if (minigameCompleteCallbackRef.current) {
          minigameCompleteCallbackRef.current(data);
        }
      };
      socket.off('PLAYER_MINIGAME_COMPLETE_NOTIFICATION', handleMinigameCompleteNotification);
      socket.on('PLAYER_MINIGAME_COMPLETE_NOTIFICATION', handleMinigameCompleteNotification);

      // 관리자용: 라운드 타이머 종료 알림
      const handleRoundTimerEnd = (data) => {
        console.log(
          '[관리자] 라운드 타이머 종료:',
          data.message
        );
        // 콜백이 있으면 호출 (DeveloperPage에서 확인 모달 표시용)
        if (roundTimerEndCallbackRef.current) {
          roundTimerEndCallbackRef.current(data.message);
        }
      };

      socket.off('ROUND_TIMER_END', handleRoundTimerEnd);
      socket.on('ROUND_TIMER_END', handleRoundTimerEnd);

      const handlePlayerListUpdate = (data) => {
        console.log(
          '[useSocketSync] PLAYER_LIST_UPDATE 수신:',
          data
        );
        // 서버에서 객체로 전송하는 경우와 배열로 전송하는 경우 모두 처리
        if (Array.isArray(data)) {
          // 하위 호환성: 배열로 전송되는 경우
          console.log(
            '[useSocketSync] 배열 형식으로 수신, connectedAdmins 초기화'
          );
          setPlayerList(data);
          setConnectedAdmins([]);
        } else if (data && typeof data === 'object') {
          // 새로운 형식: 객체로 전송되는 경우
          console.log(
            '[useSocketSync] 객체 형식으로 수신, players:',
            data.players?.length || 0,
            'connectedAdmins:',
            data.connectedAdmins?.length || 0
          );
          setPlayerList(data.players || []);
          setConnectedAdmins(data.connectedAdmins || []);
        } else {
          console.warn(
            '[useSocketSync] 알 수 없는 형식:',
            data
          );
          setPlayerList([]);
          setConnectedAdmins([]);
        }
      };

      const handleGameSettingsUpdate = (settings) => {
        setGameSettings(settings);
      };

      socket.off(
        'PLAYER_COUNT_UPDATE',
        handlePlayerCountUpdate
      );
      socket.off(
        'PLAYER_LIST_UPDATE',
        handlePlayerListUpdate
      );
      socket.off(
        'GAME_SETTINGS_UPDATE',
        handleGameSettingsUpdate
      );

      socket.on(
        'PLAYER_COUNT_UPDATE',
        handlePlayerCountUpdate
      );
      socket.on(
        'PLAYER_LIST_UPDATE',
        handlePlayerListUpdate
      );
      socket.on(
        'GAME_SETTINGS_UPDATE',
        handleGameSettingsUpdate
      );
    }

    // 전광판(디스플레이)용: 거래 로그 수신 (isAdmin 블록 밖에서 등록)
    if (isDisplay && !isAdmin) {
      const handleDisplayTransactionLog = (transaction) => {
        setTransactionLogs((prev) => {
          const next = [...prev, transaction];
          return next.length > 200 ? next.slice(-200) : next;
        });
      };
      const handleDisplayTransactionInit = (logs) => {
        setTransactionLogs(logs);
      };

      socket.off('TRANSACTION_LOG_UPDATE', handleDisplayTransactionLog);
      socket.off('TRANSACTION_LOGS_INIT', handleDisplayTransactionInit);
      socket.on('TRANSACTION_LOG_UPDATE', handleDisplayTransactionLog);
      socket.on('TRANSACTION_LOGS_INIT', handleDisplayTransactionInit);
    }

    // cleanup: 리스너 해제 (소켓 연결은 유지, 리스너만 제거)
    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('reconnect', handleReconnect);
      socket.off('reconnect_attempt', handleReconnectAttempt);
      socket.off('reconnect_failed', handleReconnectFailed);
      socket.off('GAME_STATE_UPDATE', handleGameStateUpdate);
      socket.off('ROUND_TIMER_UPDATE', handleRoundTimerUpdate);
      socket.off('ROUND_COUNTDOWN', handleRoundCountdown);
      socket.off('DISPLAY_MESSAGE', handleDisplayMessage);
      socket.off('CLOSE_DISPLAY_MESSAGE', handleCloseDisplayMessage);
      socket.off('GAME_END', handleGameEnd);
      socket.off('GAME_RESTART', handleGameRestart);
      socket.off('PLAYER_PORTFOLIO_UPDATE', handlePortfolioUpdate);
      socket.off('TRANSACTION_ERROR', handleTransactionError);
      if (!isAdmin) {
        socket.off('PLAYER_HINTS_UPDATE');
        socket.off('PLAYER_TRADING_BLOCKED');
        socket.off('MINIGAME_SUCCESS');
        socket.off('PLAYER_RUMOR_UPDATE');
        socket.off('PLAYER_TRANSACTIONS_UPDATE');
        socket.off('BONUS_POINTS_ADDED', handleBonusPointsAdded);
        socket.off('TRADE_EXECUTED');
        socket.off('PLAYER_RANK_UPDATE', handlePlayerRankUpdate);
        socket.off('PLAYER_RANK_LIST_UPDATE', handlePlayerRankListUpdate);
        socket.off('NICKNAME_ERROR', handleNicknameError);
        socket.off('NICKNAME_DUPLICATE_KICK', handleNicknameDuplicateKick);
        socket.off('ADMIN_KICK', handleAdminKick);
        socket.off('ADMIN_DELETE', handleAdminDelete);
      }
      if (isDisplay && !isAdmin) {
        socket.off('TRANSACTION_LOG_UPDATE');
        socket.off('TRANSACTION_LOGS_INIT');
      }
    };
  }, [isAdmin, isDisplay]);

  // 관리자 액션 함수들
  const adminActions = useMemo(() => isAdmin
    ? {
        authenticate: (data, onSuccess, onError) => {
          if (socketRef.current) {
            socketRef.current.adminAuthSuccessCallback =
              onSuccess;
            socketRef.current.adminAuthErrorCallback =
              onError;
            // data가 문자열이면 기존 호환성을 위해 { adminId: '', password: data }로 변환
            const authData =
              typeof data === 'string'
                ? { adminId: '', password: data }
                : data;
            socketRef.current.emit('ADMIN_AUTH', authData);
            socketRef.current.emit('ADMIN_REQUEST_STATE');
          }
        },
        logout: (onSuccess, onError) => {
          console.log('[useSocketSync] logout 함수 호출');
          if (socketRef.current) {
            console.log(
              '[useSocketSync] socket 연결됨, 로그아웃 요청 전송'
            );
            // 로그아웃 성공 콜백 설정
            const handleLogoutSuccess = (data) => {
              console.log(
                '[useSocketSync] ADMIN_LOGOUT_SUCCESS 수신:',
                data
              );
              // localStorage에서 인증 정보 제거
              localStorage.removeItem('admin_auth_id');
              localStorage.removeItem(
                'admin_auth_password'
              );
              if (onSuccess) {
                console.log(
                  '[useSocketSync] onSuccess 콜백 호출'
                );
                onSuccess(data);
              }
            };

            const handleLogoutError = (error) => {
              console.error(
                '[useSocketSync] ADMIN_LOGOUT_ERROR 수신:',
                error
              );
              if (onError) {
                onError(error);
              }
            };

            // 타임아웃 ID 저장용 변수
            let timeoutId = null;
            let isHandled = false;

            const cleanup = () => {
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
              socketRef.current.off(
                'ADMIN_LOGOUT_SUCCESS',
                handleLogoutSuccess
              );
              socketRef.current.off(
                'ADMIN_LOGOUT_ERROR',
                handleLogoutError
              );
            };

            // 성공 핸들러 수정 (중복 처리 방지)
            const handleLogoutSuccessWrapper = (data) => {
              if (isHandled) {
                console.log(
                  '[useSocketSync] 이미 처리된 로그아웃 응답 무시'
                );
                return;
              }
              isHandled = true;
              cleanup();
              handleLogoutSuccess(data);
            };

            // 에러 핸들러 수정 (중복 처리 방지)
            const handleLogoutErrorWrapper = (error) => {
              if (isHandled) {
                console.log(
                  '[useSocketSync] 이미 처리된 로그아웃 에러 무시'
                );
                return;
              }
              isHandled = true;
              cleanup();
              handleLogoutError(error);
            };

            // 이벤트 리스너 등록
            socketRef.current.off(
              'ADMIN_LOGOUT_SUCCESS',
              handleLogoutSuccessWrapper
            );
            socketRef.current.off(
              'ADMIN_LOGOUT_ERROR',
              handleLogoutErrorWrapper
            );
            socketRef.current.on(
              'ADMIN_LOGOUT_SUCCESS',
              handleLogoutSuccessWrapper
            );
            socketRef.current.on(
              'ADMIN_LOGOUT_ERROR',
              handleLogoutErrorWrapper
            );

            // 로그아웃 요청 전송
            console.log(
              '[useSocketSync] ADMIN_LOGOUT 이벤트 emit'
            );
            socketRef.current.emit('ADMIN_LOGOUT');

            // 타임아웃 설정 (5초 후에도 응답이 없으면 직접 처리)
            timeoutId = setTimeout(() => {
              if (isHandled) {
                console.log(
                  '[useSocketSync] 타임아웃 발생했지만 이미 처리됨'
                );
                return;
              }
              isHandled = true;
              console.warn(
                '[useSocketSync] 로그아웃 응답 타임아웃, 직접 처리'
              );
              cleanup();
              localStorage.removeItem('admin_auth_id');
              localStorage.removeItem(
                'admin_auth_password'
              );
              if (onSuccess) {
                onSuccess({
                  message: '로그아웃되었습니다. (타임아웃)',
                });
              }
            }, 5000);
          } else {
            console.warn(
              '[useSocketSync] socket이 연결되지 않음, 직접 처리'
            );
            localStorage.removeItem('admin_auth_id');
            localStorage.removeItem('admin_auth_password');
            if (onSuccess) {
              onSuccess({ message: '로그아웃되었습니다.' });
            }
          }
        },
        requestState: () => {
          socketRef.current?.emit('ADMIN_REQUEST_STATE');
        },
        startGame: () => {
          socketRef.current?.emit('ADMIN_START_GAME');
        },
        startPractice: (shouldDelete = false) => {
          socketRef.current?.emit('ADMIN_START_PRACTICE', {
            shouldDelete,
          });
        },
        startRealGame: (shouldDelete = false) => {
          socketRef.current?.emit('ADMIN_START_REAL_GAME', {
            shouldDelete,
          });
        },
        nextRound: () => {
          socketRef.current?.emit('ADMIN_NEXT_ROUND');
        },
        previousRound: () => {
          socketRef.current?.emit('ADMIN_PREVIOUS_ROUND');
        },
        endGame: () => {
          socketRef.current?.emit('ADMIN_END_GAME');
        },
        updateScenario: (round, updates) => {
          socketRef.current?.emit('ADMIN_UPDATE_SCENARIO', {
            round,
            updates,
          });
        },
        addPoints: (socketId, points, source) => {
          socketRef.current?.emit('ADMIN_ADD_POINTS', {
            socketId,
            points,
            source, // 'minigame' 또는 undefined
          });
        },
        addPointsToAll: (points, source) => {
          socketRef.current?.emit(
            'ADMIN_ADD_POINTS_TO_ALL',
            {
              points,
              source,
            }
          );
        },
        requestPlayerList: () => {
          socketRef.current?.emit(
            'ADMIN_REQUEST_PLAYER_LIST'
          );
        },
        updateGameSettings: (settings) => {
          socketRef.current?.emit(
            'ADMIN_UPDATE_GAME_SETTINGS',
            settings
          );
        },
        requestGameSettings: () => {
          socketRef.current?.emit(
            'ADMIN_REQUEST_GAME_SETTINGS'
          );
        },
        grantHint: (
          socketId,
          difficulty,
          price,
          hintContent
        ) => {
          socketRef.current?.emit('ADMIN_GRANT_HINT', {
            socketId,
            difficulty,
            price,
            hintContent,
          });
        },
        grantHintToAll: (
          difficulty,
          price,
          hintContent
        ) => {
          socketRef.current?.emit(
            'ADMIN_GRANT_HINT_TO_ALL',
            {
              difficulty,
              price,
              hintContent,
            }
          );
        },
        executeTrade: (
          socketId,
          type,
          stockId,
          quantity
        ) => {
          socketRef.current?.emit('ADMIN_EXECUTE_TRADE', {
            socketId,
            type,
            stockId,
            quantity,
          });
        },
        kickPlayer: (socketId) => {
          socketRef.current?.emit('ADMIN_KICK_PLAYER', {
            socketId,
          });
        },
        deletePlayer: (socketId) => {
          console.log(
            '[useSocketSync] deletePlayer 호출:',
            socketId
          );
          if (socketRef.current) {
            socketRef.current.emit('ADMIN_DELETE_PLAYER', {
              socketId,
            });
            console.log(
              '[useSocketSync] ADMIN_DELETE_PLAYER 이벤트 전송 완료'
            );
          } else {
            console.error(
              '[useSocketSync] socketRef.current가 null입니다.'
            );
          }
        },
        deleteAllPlayers: (isPractice = false) => {
          console.log(
            '[useSocketSync] deleteAllPlayers 호출:',
            isPractice
          );
          if (socketRef.current) {
            socketRef.current.emit(
              'ADMIN_DELETE_ALL_PLAYERS',
              {
                isPractice,
              }
            );
            console.log(
              '[useSocketSync] ADMIN_DELETE_ALL_PLAYERS 이벤트 전송 완료'
            );
          } else {
            console.error(
              '[useSocketSync] socketRef.current가 null입니다.'
            );
          }
        },
        clearAllTransactions: (isPractice = false) => {
          console.log(
            '[useSocketSync] clearAllTransactions 호출:',
            isPractice
          );
          if (socketRef.current) {
            socketRef.current.emit(
              'ADMIN_CLEAR_ALL_TRANSACTIONS',
              {
                isPractice,
              }
            );
            console.log(
              '[useSocketSync] ADMIN_CLEAR_ALL_TRANSACTIONS 이벤트 전송 완료'
            );
          } else {
            console.error(
              '[useSocketSync] socketRef.current가 null입니다.'
            );
          }
        },
        blockTrading: () => {
          socketRef.current?.emit('ADMIN_BLOCK_TRADING');
        },
        unblockTrading: () => {
          socketRef.current?.emit('ADMIN_UNBLOCK_TRADING');
        },
        blockTradingForPlayer: (socketId, rewardAmount, message) => {
          socketRef.current?.emit(
            'ADMIN_BLOCK_TRADING_FOR_PLAYER',
            {
              socketId,
              rewardAmount,
              message,
            }
          );
        },
        unblockTradingForPlayer: (socketId, isSuccess) => {
          socketRef.current?.emit(
            'ADMIN_UNBLOCK_TRADING_FOR_PLAYER',
            {
              socketId,
              success: isSuccess,
            }
          );
        },
        getAdmins: () => {
          socketRef.current?.emit('ADMIN_GET_ADMINS');
        },
        createAdmin: (adminId, password) => {
          socketRef.current?.emit('ADMIN_CREATE_ADMIN', {
            adminId,
            password,
          });
        },
        updateAdminPassword: (adminId, newPassword) => {
          socketRef.current?.emit(
            'ADMIN_UPDATE_ADMIN_PASSWORD',
            {
              adminId,
              newPassword,
            }
          );
        },
        deleteAdmin: (adminId) => {
          socketRef.current?.emit('ADMIN_DELETE_ADMIN', {
            adminId,
          });
        },
        broadcastMessage: (message) => {
          socketRef.current?.emit(
            'ADMIN_BROADCAST_MESSAGE',
            {
              message,
            }
          );
        },
        closeMessage: () => {
          socketRef.current?.emit('ADMIN_CLOSE_MESSAGE');
        },
        togglePlayerTrading: () => {
          socketRef.current?.emit(
            'ADMIN_TOGGLE_PLAYER_TRADING'
          );
        },
        saveRoundRumor: (round, rumor) => {
          socketRef.current?.emit(
            'ADMIN_SAVE_ROUND_RUMOR',
            {
              round,
              rumor,
            }
          );
        },
        saveRoundHints: (round, hints) => {
          socketRef.current?.emit(
            'ADMIN_SAVE_ROUND_HINTS',
            {
              round,
              hints,
            }
          );
        },
        saveProviderRoundHints: (round, provider, hints) => {
          socketRef.current?.emit(
            'ADMIN_SAVE_PROVIDER_ROUND_HINTS',
            {
              round,
              provider,
              hints,
            }
          );
        },
        requestRoundScenarios: () => {
          socketRef.current?.emit(
            'ADMIN_REQUEST_ROUND_SCENARIOS'
          );
        },
        broadcastRumor: (round, rumor) => {
          socketRef.current?.emit('ADMIN_BROADCAST_RUMOR', {
            round,
            rumor,
          });
        },
        broadcastRandomHints: (round, hints) => {
          socketRef.current?.emit(
            'ADMIN_BROADCAST_RANDOM_HINTS',
            {
              round,
              hints,
            }
          );
        },
        // 시나리오 관련 액션
        getScenarios: (type = 'all') => {
          socketRef.current?.emit('ADMIN_GET_SCENARIOS', { type });
        },
        saveScenario: (id, name, type, stocks, rounds) => {
          socketRef.current?.emit('ADMIN_SAVE_SCENARIO', {
            id,
            name,
            type,
            stocks,
            rounds,
          });
        },
        deleteScenario: (id) => {
          socketRef.current?.emit('ADMIN_DELETE_SCENARIO', { id });
        },
        startGameWithScenario: (stocks, rounds, isPractice = false, shouldDelete = false) => {
          socketRef.current?.emit('ADMIN_START_GAME_WITH_SCENARIO', {
            stocks,
            rounds,
            isPractice,
            shouldDelete,
          });
        },
      }
    : null, [isAdmin]);

  // 플레이어 액션
  const playerActions = useMemo(() => !isAdmin
    ? {
        join: (nickname, onError) => {
          // 에러 콜백 저장
          if (socketRef.current) {
            socketRef.current.nicknameErrorCallback =
              onError;
          }
          socketRef.current?.emit('PLAYER_JOIN', nickname);
        },
        buyStock: (stockId, quantity) => {
          const requestId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          socketRef.current?.emit('PLAYER_BUY_STOCK', {
            stockId,
            quantity,
            requestId,
          });
        },
        sellStock: (stockId, quantity) => {
          const requestId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          socketRef.current?.emit('PLAYER_SELL_STOCK', {
            stockId,
            quantity,
            requestId,
          });
        },
        requestTransactions: () => {
          socketRef.current?.emit(
            'PLAYER_REQUEST_TRANSACTIONS'
          );
        },
        signalMinigameComplete: () => {
          socketRef.current?.emit('PLAYER_MINIGAME_COMPLETE');
        },
      }
    : null, [isAdmin]);

  // 보너스 포인트 콜백 설정 함수 (플레이어만)
  const setBonusPointsCallback = !isAdmin
    ? (callback) => {
        bonusPointsCallbackRef.current = callback;
      }
    : null;

  // 거래 오류 콜백 설정 함수 (플레이어만)
  const setTransactionErrorCallback = !isAdmin
    ? (callback) => {
        transactionErrorCallbackRef.current = callback;
      }
    : null;

  // 힌트 업데이트 콜백 설정 함수 (플레이어만)
  const setHintsUpdateCallback = !isAdmin
    ? (callback) => {
        hintsUpdateCallbackRef.current = callback;
      }
    : null;

  // 주문 승인 콜백 설정 함수 (플레이어만)
  const setOrderApprovedCallback = !isAdmin
    ? (callback) => {
        orderApprovedCallbackRef.current = callback;
      }
    : null;

  // 주문 거부 콜백 설정 함수 (플레이어만)
  const setOrderRejectedCallback = !isAdmin
    ? (callback) => {
        orderRejectedCallbackRef.current = callback;
      }
    : null;

  // 거래 체결 콜백 설정 함수 (플레이어만)
  const setTradeExecutedCallback = !isAdmin
    ? (callback) => {
        tradeExecutedCallbackRef.current = callback;
      }
    : null;

  // 닉네임 에러 콜백 설정 함수 (플레이어만)
  const setNicknameErrorCallback = !isAdmin
    ? (callback) => {
        if (socketRef.current) {
          socketRef.current.nicknameErrorCallback =
            callback;
        }
      }
    : null;

  // 관리자 에러 콜백 설정 함수 (관리자만)
  const setAdminErrorCallback = isAdmin
    ? (callback) => {
        adminErrorCallbackRef.current = callback;
      }
    : null;

  // 라운드 타이머 종료 콜백 설정 함수 (관리자만)
  const setRoundTimerEndCallback = isAdmin
    ? (callback) => {
        roundTimerEndCallbackRef.current = callback;
      }
    : null;

  // 운영자 계정 목록 콜백 설정 함수 (관리자만)
  const setAdminsListCallback = isAdmin
    ? (callback) => {
        adminsListCallbackRef.current = callback;
      }
    : null;

  // 관리자 성공 콜백 설정 함수 (관리자만)
  const setAdminSuccessCallback = isAdmin
    ? (callback) => {
        adminSuccessCallbackRef.current = callback;
      }
    : null;

  // 힌트 에러 콜백 설정 함수 (관리자만)
  const setHintErrorCallback = isAdmin
    ? (callback) => {
        hintErrorCallbackRef.current = callback;
      }
    : null;

  // 미니게임 완료 알림 콜백 설정 함수 (관리자만)
  const setMinigameCompleteCallback = isAdmin
    ? (callback) => {
        minigameCompleteCallbackRef.current = callback;
      }
    : null;

  // 찌라시 업데이트 콜백 설정 함수 (플레이어만)
  const setRumorUpdateCallback = !isAdmin
    ? (callback) => {
        rumorUpdateCallbackRef.current = callback;
      }
    : null;

  // 미니게임 성공 콜백 설정 함수 (플레이어만)
  const setMinigameSuccessCallback = !isAdmin
    ? (callback) => {
        minigameSuccessCallbackRef.current = callback;
      }
    : null;

  return {
    gameState,
    connected,
    playerCount,
    playerList, // 관리자용 플레이어 리스트
    playerRank, // 플레이어용 순위 정보
    rankList, // 플레이어용 전체 순위 리스트
    transactionLogs, // 관리자용 거래 로그
    playerTransactions, // 플레이어용 거래 내역
    gameSettings, // 게임 설정
    displayMessage, // 전광판 메시지
    adminActions,
    playerActions,
    socket: socketRef.current, // Socket 인스턴스
    setBonusPointsCallback, // 보너스 포인트 콜백 설정 함수
    setTransactionErrorCallback, // 거래 오류 콜백 설정 함수
    setHintsUpdateCallback, // 힌트 업데이트 콜백 설정 함수
    setRumorUpdateCallback, // 찌라시 업데이트 콜백 설정 함수
    setTradeExecutedCallback, // 거래 체결 콜백 설정 함수
    setNicknameErrorCallback, // 닉네임 에러 콜백 설정 함수
    setAdminErrorCallback, // 관리자 에러 콜백 설정 함수
    setRoundTimerEndCallback, // 라운드 타이머 종료 콜백 설정 함수
    setAdminsListCallback, // 운영자 계정 목록 콜백 설정 함수
    setAdminSuccessCallback, // 관리자 성공 콜백 설정 함수
    setHintErrorCallback, // 힌트 에러 콜백 설정 함수
    setMinigameCompleteCallback, // 미니게임 완료 알림 콜백 설정 함수
  };
}
