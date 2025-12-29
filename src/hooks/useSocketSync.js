import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// 현재 호스트의 IP 주소 자동 감지
function getSocketURL() {
  // 환경 변수가 설정되어 있으면 사용
  if (import.meta.env.VITE_SOCKET_URL) {
    console.log('[getSocketURL] 환경 변수 사용:', import.meta.env.VITE_SOCKET_URL);
    return import.meta.env.VITE_SOCKET_URL;
  }
  
  // 현재 호스트의 포트와 프로토콜 사용
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // Vite 개발 서버를 사용하는 경우 (localhost:5173 또는 네트워크 IP:5173)
  // Vite proxy를 통해 연결하므로 상대 경로 사용
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
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
  });
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [playerList, setPlayerList] = useState([]); // 관리자용 플레이어 리스트
  const [playerRank, setPlayerRank] = useState(null); // 플레이어용 순위 정보 { rank, totalPlayers, totalAsset }
  const [rankList, setRankList] = useState([]); // 플레이어용 전체 순위 리스트
  const [transactionLogs, setTransactionLogs] = useState([]); // 관리자용 거래 로그
  const [gameSettings, setGameSettings] = useState({
    initialCash: 10000,
    totalRounds: 12,
  });
  const socketRef = useRef(null);
  const isInitializedRef = useRef(false);
  const bonusPointsCallbackRef = useRef(null); // 보너스 포인트 추가 콜백
  const transactionErrorCallbackRef = useRef(null); // 거래 오류 콜백

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
      console.log(`[useSocketSync] Socket 연결 시도: ${SOCKET_URL} (관리자: ${isAdmin})`);
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
      console.error('[useSocketSync] Socket 연결 오류:', error.message);
      console.log('[useSocketSync] 서버가 실행 중인지 확인하세요: npm run server');
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
      console.log(`[useSocketSync] Socket 재연결 성공 (시도 ${attemptNumber}회)`);
      
      // 관리자 인증 재시도는 AdminPage에서 처리
      if (!isAdmin) {
        // 플레이어는 재연결 시 게임 상태 요청
        socket.emit('PLAYER_REQUEST_STATE');
      }
    };

    const handleReconnectAttempt = (attemptNumber) => {
      console.log(`[useSocketSync] Socket 재연결 시도 중... (${attemptNumber}회)`);
    };

    const handleReconnectFailed = () => {
      setConnected(false);
      console.error('[useSocketSync] Socket 재연결 실패. 서버를 확인하세요.');
    };

    socket.off('reconnect', handleReconnect);
    socket.off('reconnect_attempt', handleReconnectAttempt);
    socket.off('reconnect_failed', handleReconnectFailed);
    
    socket.on('reconnect', handleReconnect);
    socket.on('reconnect_attempt', handleReconnectAttempt);
    socket.on('reconnect_failed', handleReconnectFailed);

        // 게임 상태 업데이트 수신
        socket.on('GAME_STATE_UPDATE', (state) => {
          console.log('게임 상태 업데이트 수신:', state);
          setGameState((prev) => ({ ...prev, ...state }));
        });

        // 카운트다운 업데이트 수신
        socket.on('ROUND_COUNTDOWN', (data) => {
          console.log('카운트다운 업데이트:', data.countdown);
          setGameState((prev) => ({ ...prev, countdown: data.countdown }));
        });

    // 플레이어 포트폴리오 업데이트 수신
    socket.on('PLAYER_PORTFOLIO_UPDATE', (portfolio) => {
      if (!isAdmin) {
        // 플레이어만 포트폴리오 업데이트 받음
        setGameState((prev) => ({ ...prev, portfolio }));
      }
    });

    // 플레이어 전용: 보너스 포인트 추가 알림
    if (!isAdmin) {
      socket.on('BONUS_POINTS_ADDED', (data) => {
        // 콜백이 있으면 호출 (PlayerPage에서 Toast 표시용)
        if (bonusPointsCallbackRef.current) {
          bonusPointsCallbackRef.current(data.points, data.totalBonusPoints);
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
    }

    // 관리자 전용: 플레이어 수 업데이트
    if (isAdmin) {
      socket.on('ADMIN_AUTH_SUCCESS', () => {
        console.log('관리자 인증 성공');
        // 콜백이 있으면 호출
        if (socket.adminAuthSuccessCallback) {
          socket.adminAuthSuccessCallback();
        }
        // 플레이어 리스트 요청
        socket.emit('ADMIN_REQUEST_PLAYER_LIST');
        // 게임 설정 요청
        socket.emit('ADMIN_REQUEST_GAME_SETTINGS');
      });

      socket.on('ADMIN_AUTH_ERROR', (error) => {
        console.error('관리자 인증 실패:', error.message);
        if (socket.adminAuthErrorCallback) {
          socket.adminAuthErrorCallback(error.message);
        }
      });

      // 관리자용: 거래 로그 수신
      if (isAdmin) {
        socket.on('TRANSACTION_LOG_UPDATE', (transaction) => {
          setTransactionLogs((prev) => [...prev.slice(-99), transaction]);
        });
        socket.on('TRANSACTION_LOGS_INIT', (logs) => {
          setTransactionLogs(logs);
        });
      }

      socket.on('PLAYER_COUNT_UPDATE', (count) => {
        setPlayerCount(count);
      });

      socket.on('PLAYER_LIST_UPDATE', (list) => {
        setPlayerList(list);
      });

      socket.on('GAME_SETTINGS_UPDATE', (settings) => {
        setGameSettings(settings);
      });
    }

    // 정리 함수는 제거하지 않음 (StrictMode에서도 연결 유지)
    // 실제 unmount 시에만 정리가 필요하지만, StrictMode에서는 구분이 어려움
    // 따라서 이벤트 리스너는 위에서 중복 방지 처리하고, 연결은 유지
  }, [isAdmin]);

  // 관리자 액션 함수들
  const adminActions = isAdmin
    ? {
        authenticate: (password, onSuccess, onError) => {
          if (socketRef.current) {
            socketRef.current.adminAuthSuccessCallback = onSuccess;
            socketRef.current.adminAuthErrorCallback = onError;
            socketRef.current.emit('ADMIN_AUTH', password);
            socketRef.current.emit('ADMIN_REQUEST_STATE');
          }
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
        updateScenario: (round, updates) => {
          socketRef.current?.emit('ADMIN_UPDATE_SCENARIO', {
            round,
            updates,
          });
        },
        addPoints: (socketId, points) => {
          socketRef.current?.emit('ADMIN_ADD_POINTS', { socketId, points });
        },
        requestPlayerList: () => {
          socketRef.current?.emit('ADMIN_REQUEST_PLAYER_LIST');
        },
        updateGameSettings: (settings) => {
          socketRef.current?.emit('ADMIN_UPDATE_GAME_SETTINGS', settings);
        },
        requestGameSettings: () => {
          socketRef.current?.emit('ADMIN_REQUEST_GAME_SETTINGS');
        },
      }
    : null;

  // 플레이어 액션
  const playerActions = !isAdmin
    ? {
        join: (nickname, onError) => {
          // 에러 콜백 저장
          if (socketRef.current) {
            socketRef.current.nicknameErrorCallback = onError;
          }
          socketRef.current?.emit('PLAYER_JOIN', nickname);
        },
        buyStock: (stockId, quantity) => {
          socketRef.current?.emit('PLAYER_BUY_STOCK', { stockId, quantity });
        },
        sellStock: (stockId, quantity) => {
          socketRef.current?.emit('PLAYER_SELL_STOCK', { stockId, quantity });
        },
      }
    : null;

  // 보너스 포인트 콜백 설정 함수 (플레이어만)
  const setBonusPointsCallback = !isAdmin ? (callback) => {
    bonusPointsCallbackRef.current = callback;
  } : null;

  // 거래 오류 콜백 설정 함수 (플레이어만)
  const setTransactionErrorCallback = !isAdmin ? (callback) => {
    transactionErrorCallbackRef.current = callback;
  } : null;

  return {
    gameState,
    connected,
    playerCount,
    playerList, // 관리자용 플레이어 리스트
    playerRank, // 플레이어용 순위 정보
    rankList, // 플레이어용 전체 순위 리스트
    transactionLogs, // 관리자용 거래 로그
    gameSettings, // 게임 설정
    adminActions,
    playerActions,
    setBonusPointsCallback, // 보너스 포인트 콜백 설정 함수
    setTransactionErrorCallback, // 거래 오류 콜백 설정 함수
  };
}


