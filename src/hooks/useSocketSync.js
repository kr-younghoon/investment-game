import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// 현재 호스트의 IP 주소 자동 감지
function getSocketURL() {
  // 환경 변수가 설정되어 있으면 사용
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  
  // 현재 호스트의 포트와 프로토콜 사용
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // localhost가 아니면 현재 호스트의 3001 포트 사용
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `${protocol}//${hostname}:3001`;
  }
  
  // 기본값: localhost
  return 'http://localhost:3001';
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
  const [gameSettings, setGameSettings] = useState({
    initialCash: 10000,
    totalRounds: 12,
  });
  const socketRef = useRef(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // 이미 초기화되었으면 스킵 (React StrictMode 대응)
    if (isInitializedRef.current) {
      return;
    }

    // Socket 연결
    if (!socketRef.current || !socketRef.current.connected) {
      socketRef.current = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        timeout: 20000,
      });
    }

    const socket = socketRef.current;
    isInitializedRef.current = true;

    socket.on('connect', () => {
      setConnected(true);
      console.log('Socket 연결됨');

      // 관리자 인증
      if (isAdmin) {
        socket.emit('ADMIN_AUTH');
        // 관리자도 게임 상태 요청 (인증 후 상태 동기화)
        socket.emit('ADMIN_REQUEST_STATE');
      } else {
        // 플레이어는 연결 시 게임 상태 요청
        socket.emit('PLAYER_REQUEST_STATE');
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
      console.log('Socket 연결 해제');
    });

    socket.on('connect_error', (error) => {
      setConnected(false);
      console.error('Socket 연결 오류:', error.message);
      console.log('서버가 실행 중인지 확인하세요: npm run server');
    });

    socket.on('reconnect', (attemptNumber) => {
      setConnected(true);
      console.log(`Socket 재연결 성공 (시도 ${attemptNumber}회)`);
      
      // 관리자 인증 재시도
      if (isAdmin) {
        socket.emit('ADMIN_AUTH');
        // 관리자도 재연결 시 게임 상태 요청
        socket.emit('ADMIN_REQUEST_STATE');
      } else {
        // 플레이어는 재연결 시 게임 상태 요청
        socket.emit('PLAYER_REQUEST_STATE');
      }
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Socket 재연결 시도 중... (${attemptNumber}회)`);
    });

    socket.on('reconnect_failed', () => {
      setConnected(false);
      console.error('Socket 재연결 실패. 서버를 확인하세요.');
    });

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

    // 거래 오류 수신
    socket.on('TRANSACTION_ERROR', (error) => {
      console.error('거래 오류:', error.message);
      // 필요시 에러 상태 추가 가능
    });

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
        // 플레이어 리스트 요청
        socket.emit('ADMIN_REQUEST_PLAYER_LIST');
        // 게임 설정 요청
        socket.emit('ADMIN_REQUEST_GAME_SETTINGS');
      });

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

    // 정리
    return () => {
      // React StrictMode에서 cleanup이 두 번 호출될 수 있으므로 안전하게 처리
      if (socket && socket.connected) {
        socket.removeAllListeners(); // 모든 이벤트 리스너 제거
        socket.disconnect();
      }
      isInitializedRef.current = false;
    };
  }, [isAdmin]);

  // 관리자 액션 함수들
  const adminActions = isAdmin
    ? {
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

  return {
    gameState,
    connected,
    playerCount,
    playerList, // 관리자용 플레이어 리스트
    gameSettings, // 게임 설정
    adminActions,
    playerActions,
  };
}


