import { useState, useEffect, useRef } from 'react';
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

export function useSocketSync(isAdmin = false) {
  const [gameState, setGameState] = useState({
    currentRound: 0,
    stockPrices: {},
    currentNews: '',
    isGameStarted: false,
    isPracticeMode: false,
    isWaitingMode: true,
    priceHistory: {},
    portfolio: null, // 플레이어 포트폴리오
    countdown: null, // 라운드 전환 카운트다운
    roundTimer: null, // 라운드 타이머 (서버에서 동기화)
  });
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [playerList, setPlayerList] = useState([]); // 관리자용 플레이어 리스트
  const [playerRank, setPlayerRank] = useState(null); // 플레이어용 순위 정보 { rank, totalPlayers, totalAsset }
  const [rankList, setRankList] = useState([]); // 플레이어용 전체 순위 리스트
  const [transactionLogs, setTransactionLogs] = useState(
    []
  ); // 관리자용 거래 로그
  const [hintRequests, setHintRequests] = useState([]); // 관리자용 힌트 구매 요청 목록
  const [pendingOrders, setPendingOrders] = useState([]); // 관리자용 대기 주문 목록
  const [gameSettings, setGameSettings] = useState({
    initialCash: 10000,
    totalRounds: 12,
  });
  const socketRef = useRef(null);
  const isInitializedRef = useRef(false);
  const bonusPointsCallbackRef = useRef(null); // 보너스 포인트 추가 콜백
  const transactionErrorCallbackRef = useRef(null); // 거래 오류 콜백
  const hintsUpdateCallbackRef = useRef(null); // 힌트 업데이트 콜백
  const orderApprovedCallbackRef = useRef(null); // 주문 승인 콜백
  const orderRejectedCallbackRef = useRef(null); // 주문 거부 콜백
  const tradeExecutedCallbackRef = useRef(null); // 거래 체결 콜백
  const adminErrorCallbackRef = useRef(null); // 관리자 에러 콜백
  const roundTimerEndCallbackRef = useRef(null); // 라운드 타이머 종료 콜백 (관리자만)
  const adminsListCallbackRef = useRef(null); // 운영자 계정 목록 콜백
  const adminSuccessCallbackRef = useRef(null); // 관리자 성공 콜백

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
        `[useSocketSync] Socket 연결 시도: ${SOCKET_URL} (관리자: ${isAdmin})`
      );
      socketRef.current = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        timeout: 20000,
        autoConnect: true,
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
      setGameState((prev) => ({ ...prev, ...state }));
    };
    socket.off('GAME_STATE_UPDATE', handleGameStateUpdate);
    socket.on('GAME_STATE_UPDATE', handleGameStateUpdate);

    // 라운드 타이머 업데이트 수신
    socket.on('ROUND_TIMER_UPDATE', (data) => {
      setGameState((prev) => ({
        ...prev,
        roundTimer: data.roundTimer,
      }));
    });

    // 카운트다운 업데이트 수신
    socket.on('ROUND_COUNTDOWN', (data) => {
      console.log('카운트다운 업데이트:', data.countdown);
      setGameState((prev) => ({
        ...prev,
        countdown: data.countdown,
      }));
    });

    // 플레이어 포트폴리오 업데이트 수신
    socket.on('PLAYER_PORTFOLIO_UPDATE', (portfolio) => {
      if (!isAdmin) {
        // 플레이어만 포트폴리오 업데이트 받음
        setGameState((prev) => ({ ...prev, portfolio }));
      }
    });

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
    }

    // 플레이어 전용: 보너스 포인트 추가 알림
    if (!isAdmin) {
      socket.on('BONUS_POINTS_ADDED', (data) => {
        // 콜백이 있으면 호출 (PlayerPage에서 Toast 표시용)
        if (bonusPointsCallbackRef.current) {
          bonusPointsCallbackRef.current(
            data.points,
            data.totalBonusPoints,
            data.source, // 'minigame' 또는 undefined
            data.round // 라운드 정보
          );
        }
      });
    }

    // 거래 오류 수신
    socket.on('TRANSACTION_ERROR', (error) => {
      console.error('거래 오류:', error.message);
      // 콜백이 있으면 호출 (PlayerPage에서 Toast 표시용)
      if (transactionErrorCallbackRef.current) {
        transactionErrorCallbackRef.current(error.message);
      }
    });

    // 플레이어 전용: 주문 관련 이벤트
    if (!isAdmin) {
      const handleOrderRequested = (data) => {
        console.log('주문 접수:', data);
        // 주문 접수 성공 알림은 이미 PlayerPage에서 처리됨
      };

      const handleOrderApproved = (data) => {
        console.log('주문 승인:', data);
        if (orderApprovedCallbackRef.current) {
          orderApprovedCallbackRef.current(data);
        }
      };

      const handleOrderRejected = (data) => {
        console.log('주문 거부:', data);
        if (orderRejectedCallbackRef.current) {
          orderRejectedCallbackRef.current(data);
        }
      };

      const handleOrderError = (error) => {
        console.error('주문 오류:', error.message);
        if (transactionErrorCallbackRef.current) {
          transactionErrorCallbackRef.current(
            error.message
          );
        }
      };

      // 거래 체결 알림
      const handleTradeExecuted = (data) => {
        if (tradeExecutedCallbackRef.current) {
          tradeExecutedCallbackRef.current(data);
        }
      };

      socket.off('ORDER_REQUESTED', handleOrderRequested);
      socket.off('ORDER_APPROVED', handleOrderApproved);
      socket.off('ORDER_REJECTED', handleOrderRejected);
      socket.off('ORDER_ERROR', handleOrderError);
      socket.off('TRADE_EXECUTED', handleTradeExecuted);

      socket.on('ORDER_REQUESTED', handleOrderRequested);
      socket.on('ORDER_APPROVED', handleOrderApproved);
      socket.on('ORDER_REJECTED', handleOrderRejected);
      socket.on('ORDER_ERROR', handleOrderError);
      socket.on('TRADE_EXECUTED', handleTradeExecuted);
    }

    // 플레이어 전용: 순위 업데이트 수신
    if (!isAdmin) {
      socket.on('PLAYER_RANK_UPDATE', (rankData) => {
        setPlayerRank(rankData);
      });
      socket.on('PLAYER_RANK_LIST_UPDATE', (list) => {
        setRankList(list);
      });
    }

    // 닉네임 오류 수신 (플레이어만)
    if (!isAdmin) {
      socket.on('NICKNAME_ERROR', (error) => {
        console.error('닉네임 오류:', error.message);
        // 에러 콜백이 있으면 호출
        if (socket.nicknameErrorCallback) {
          socket.nicknameErrorCallback(error.message);
        }
      });

      // 중복 로그인으로 인한 강제 연결 끊김 처리
      socket.on('NICKNAME_DUPLICATE_KICK', (data) => {
        console.warn(
          '중복 로그인으로 인한 연결 끊김:',
          data.message
        );
        // 에러 콜백이 있으면 호출 (PlayerPage에서 로그아웃 처리용)
        if (socket.nicknameErrorCallback) {
          socket.nicknameErrorCallback(data.message);
        }
        // 연결 끊기
        socket.disconnect();
      });

      // 관리자에 의한 강제 로그아웃 처리
      socket.on('ADMIN_KICK', (data) => {
        console.warn(
          '관리자에 의한 로그아웃:',
          data.message
        );
        // 에러 콜백이 있으면 호출 (PlayerPage에서 로그아웃 처리용)
        if (socket.nicknameErrorCallback) {
          socket.nicknameErrorCallback(data.message);
        }
        // 연결 끊기
        socket.disconnect();
      });

      // 관리자에 의한 계정 삭제 처리
      socket.on('ADMIN_DELETE', (data) => {
        console.warn(
          '관리자에 의한 계정 삭제:',
          data.message
        );
        // 에러 콜백이 있으면 호출 (PlayerPage에서 로그아웃 처리용)
        if (socket.nicknameErrorCallback) {
          socket.nicknameErrorCallback(data.message);
        }
        // localStorage에서 닉네임 삭제
        localStorage.removeItem('mz_investment_nickname');
        // 연결 끊기
        socket.disconnect();
      });
    }

    // 관리자 전용: 플레이어 수 업데이트
    if (isAdmin) {
      const handleAdminAuthSuccess = () => {
        // 콜백이 있으면 호출
        if (socket.adminAuthSuccessCallback) {
          socket.adminAuthSuccessCallback();
        }
        // 플레이어 리스트 요청
        socket.emit('ADMIN_REQUEST_PLAYER_LIST');
        // 게임 설정 요청
        socket.emit('ADMIN_REQUEST_GAME_SETTINGS');
      };
      socket.off(
        'ADMIN_AUTH_SUCCESS',
        handleAdminAuthSuccess
      );
      socket.on(
        'ADMIN_AUTH_SUCCESS',
        handleAdminAuthSuccess
      );

      socket.on('ADMIN_AUTH_ERROR', (error) => {
        // 비밀번호 인증이 제거되었으므로 에러는 무시
        // 서버가 재시작되지 않았을 경우에만 발생할 수 있음
        if (socket.adminAuthErrorCallback) {
          socket.adminAuthErrorCallback(error.message);
        }
      });

      // 관리자용: 거래 로그 수신
      if (isAdmin) {
        socket.on(
          'TRANSACTION_LOG_UPDATE',
          (transaction) => {
            setTransactionLogs((prev) => [
              ...prev,
              transaction,
            ]);
          }
        );
        socket.on('TRANSACTION_LOGS_INIT', (logs) => {
          setTransactionLogs(logs);
        });
        // 대기 주문 목록 수신
        socket.on('PENDING_ORDERS_UPDATE', (orders) => {
          setPendingOrders(orders);
        });
      }

      const handlePlayerCountUpdate = (count) => {
        setPlayerCount(count);
      };

      // 관리자용: 에러 수신
      const handleAdminError = (error) => {
        console.error('[관리자 에러]', error.message);
        // 에러 콜백이 있으면 호출 (각 페이지에서 Toast 표시용)
        if (adminErrorCallbackRef.current) {
          adminErrorCallbackRef.current(error.message);
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

      const handlePlayerListUpdate = (list) => {
        setPlayerList(list);
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

    // 정리 함수는 제거하지 않음 (StrictMode에서도 연결 유지)
    // 실제 unmount 시에만 정리가 필요하지만, StrictMode에서는 구분이 어려움
    // 따라서 이벤트 리스너는 위에서 중복 방지 처리하고, 연결은 유지
  }, [isAdmin]);

  // 관리자 액션 함수들
  const adminActions = isAdmin
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
        requestState: () => {
          socketRef.current?.emit('ADMIN_REQUEST_STATE');
        },
        startGame: () => {
          socketRef.current?.emit('ADMIN_START_GAME');
        },
        startPractice: () => {
          socketRef.current?.emit('ADMIN_START_PRACTICE');
        },
        startRealGame: () => {
          socketRef.current?.emit('ADMIN_START_REAL_GAME');
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
        getPendingOrders: () => {
          socketRef.current?.emit(
            'ADMIN_REQUEST_PENDING_ORDERS'
          );
        },
        approveOrder: (orderId) => {
          socketRef.current?.emit('ADMIN_APPROVE_ORDER', {
            orderId,
          });
        },
        rejectOrder: (orderId) => {
          socketRef.current?.emit('ADMIN_REJECT_ORDER', {
            orderId,
          });
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
        requestPendingMiniGames: () => {
          socketRef.current?.emit(
            'ADMIN_REQUEST_PENDING_MINIGAMES'
          );
        },
        approveMiniGame: (requestId) => {
          socketRef.current?.emit(
            'ADMIN_APPROVE_MINIGAME',
            {
              requestId,
            }
          );
        },
        rejectMiniGame: (requestId) => {
          socketRef.current?.emit('ADMIN_REJECT_MINIGAME', {
            requestId,
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
      }
    : null;

  // 플레이어 액션
  const playerActions = !isAdmin
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
          socketRef.current?.emit('PLAYER_BUY_STOCK', {
            stockId,
            quantity,
          });
        },
        sellStock: (stockId, quantity) => {
          socketRef.current?.emit('PLAYER_SELL_STOCK', {
            stockId,
            quantity,
          });
        },
        requestOrder: (type, stockId, quantity) => {
          socketRef.current?.emit('PLAYER_REQUEST_ORDER', {
            type,
            stockId,
            quantity,
          });
        },
        completeMiniGame: (score) => {
          socketRef.current?.emit(
            'PLAYER_COMPLETE_MINIGAME',
            {
              score,
            }
          );
        },
      }
    : null;

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

  return {
    gameState,
    connected,
    playerCount,
    playerList, // 관리자용 플레이어 리스트
    playerRank, // 플레이어용 순위 정보
    rankList, // 플레이어용 전체 순위 리스트
    transactionLogs, // 관리자용 거래 로그
    pendingOrders, // 관리자용 대기 주문 목록
    gameSettings, // 게임 설정
    adminActions,
    playerActions,
    socket: socketRef.current, // Socket 인스턴스
    setBonusPointsCallback, // 보너스 포인트 콜백 설정 함수
    setTransactionErrorCallback, // 거래 오류 콜백 설정 함수
    setHintsUpdateCallback, // 힌트 업데이트 콜백 설정 함수
    setOrderApprovedCallback, // 주문 승인 콜백 설정 함수
    setOrderRejectedCallback, // 주문 거부 콜백 설정 함수
    setTradeExecutedCallback, // 거래 체결 콜백 설정 함수
    setNicknameErrorCallback, // 닉네임 에러 콜백 설정 함수
    setAdminErrorCallback, // 관리자 에러 콜백 설정 함수
    setRoundTimerEndCallback, // 라운드 타이머 종료 콜백 설정 함수
    setAdminsListCallback, // 운영자 계정 목록 콜백 설정 함수
    setAdminSuccessCallback, // 관리자 성공 콜백 설정 함수
  };
}
