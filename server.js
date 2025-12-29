import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import { STOCKS, initialScenarios } from './src/data/initialScenarios.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
});

app.use(cors());
app.use(express.json());
app.use(express.static('dist'));

// 게임 상태 관리
let gameState = {
  currentRound: 0,
  stockPrices: {},
  currentNews: '',
  isGameStarted: false,
  isPracticeMode: false,
  isWaitingMode: true, // 대기 모드 (게임 시작 전)
  scenarios: initialScenarios,
  countdown: null, // 라운드 전환 카운트다운 (초 단위)
};

// 초기 가격 설정
STOCKS.forEach((stock) => {
  gameState.stockPrices[stock.id] = [stock.basePrice];
});

// 연결된 플레이어 수 추적
let connectedPlayers = new Set();
let adminSocket = null;
// 거래 로그 저장 (관리자용)
const transactionLogs = [];

// 플레이어 데이터 관리 (socketId -> playerData)
const playersData = new Map(); // { socketId: { nickname, cash, stocks: {}, bonusPoints, totalAsset, transactions: [] } }
const practicePlayersData = new Map(); // 연습 모드용 플레이어 데이터
let INITIAL_CASH = 10000; // 게임 설정에서 변경 가능
let gameSettings = {
  initialCash: INITIAL_CASH,
  totalRounds: initialScenarios.length,
};

// 가격 계산 함수 (서버에서 실행하여 모든 클라이언트가 동일한 가격을 받음)
function calculateNextRoundPrices() {
  // 연습 모드일 때는 3라운드까지만 진행
  const maxRounds = gameState.isPracticeMode ? 3 : gameState.scenarios.length;
  
  if (gameState.currentRound >= maxRounds - 1) {
    return false; // 게임 종료
  }

  const nextRound = gameState.currentRound + 1;
  const scenario = gameState.scenarios[nextRound];

  // 새로운 가격 계산 (누적)
  STOCKS.forEach((stock) => {
    const currentPrice =
      gameState.stockPrices[stock.id][gameState.currentRound];
    const changeRate = scenario.volatility[stock.id] / 100;
    const newPrice = currentPrice * (1 + changeRate);

    if (!gameState.stockPrices[stock.id][nextRound]) {
      gameState.stockPrices[stock.id][nextRound] = newPrice;
    } else {
      gameState.stockPrices[stock.id][nextRound] = newPrice;
    }
  });

  gameState.currentRound = nextRound;
  gameState.currentNews = scenario.headline;

  return true;
}

// 현재 가격 가져오기
function getCurrentPrices() {
  const prices = {};
  STOCKS.forEach((stock) => {
    if (
      gameState.stockPrices[stock.id] &&
      gameState.stockPrices[stock.id].length > gameState.currentRound
    ) {
      prices[stock.id] =
        gameState.stockPrices[stock.id][gameState.currentRound];
    } else {
      prices[stock.id] = stock.basePrice;
    }
  });
  return prices;
}

// 플레이어 총 자산 계산
function calculatePlayerTotalAsset(socketId, isPractice = false) {
  const dataMap = isPractice ? practicePlayersData : playersData;
  const playerData = dataMap.get(socketId);
  if (!playerData) return 0;
  
  let total = playerData.cash + playerData.bonusPoints;
  const currentPrices = getCurrentPrices();
  
  STOCKS.forEach((stock) => {
    const qty = playerData.stocks[stock.id] || 0;
    const price = currentPrices[stock.id] || stock.basePrice;
    total += qty * price;
  });
  
  return total;
}

// 게임 상태 브로드캐스트
function broadcastGameState() {
  const stateToSend = {
    currentRound: gameState.currentRound,
    stockPrices: getCurrentPrices(),
    currentNews: gameState.currentNews,
    isGameStarted: gameState.isGameStarted,
    isPracticeMode: gameState.isPracticeMode,
    isWaitingMode: gameState.isWaitingMode,
    priceHistory: gameState.stockPrices,
    countdown: gameState.countdown, // 카운트다운 상태 추가
  };
  io.emit('GAME_STATE_UPDATE', stateToSend);
  
  // 모든 플레이어의 총 자산 업데이트
  const dataMap = gameState.isPracticeMode ? practicePlayersData : playersData;
  dataMap.forEach((playerData, socketId) => {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      const totalAsset = calculatePlayerTotalAsset(socketId, gameState.isPracticeMode);
      playerData.totalAsset = totalAsset;
      socket.emit('PLAYER_PORTFOLIO_UPDATE', {
        cash: playerData.cash,
        stocks: playerData.stocks,
        bonusPoints: playerData.bonusPoints,
        totalAsset: totalAsset,
      });
    }
  });
}

// 플레이어 리스트 브로드캐스트 (관리자에게)
function broadcastPlayerList() {
  if (!adminSocket) return;
  
  const dataMap = gameState.isPracticeMode ? practicePlayersData : playersData;
  const playerList = Array.from(dataMap.entries()).map(([socketId, data]) => {
    const totalAsset = calculatePlayerTotalAsset(socketId, gameState.isPracticeMode);
    const isOnline = connectedPlayers.has(socketId);
    // 마지막 거래 라운드 찾기
    const lastTransaction = data.transactions.length > 0 
      ? data.transactions[data.transactions.length - 1]
      : null;
    const lastTransactionRound = lastTransaction ? lastTransaction.round : null;
    return {
      socketId,
      nickname: data.nickname,
      cash: data.cash,
      bonusPoints: data.bonusPoints,
      stocks: data.stocks,
      totalAsset: totalAsset,
      transactionCount: data.transactions.length,
      isOnline: isOnline,
      lastTransactionRound: lastTransactionRound,
    };
  });
  
  // 총 자산 기준으로 정렬하고 순위 추가
  playerList.sort((a, b) => b.totalAsset - a.totalAsset);
  playerList.forEach((player, index) => {
    player.rank = index + 1;
  });
  
  adminSocket.emit('PLAYER_LIST_UPDATE', playerList);
  
  // 모든 플레이어에게 자신의 순위 및 전체 순위 리스트 전송
  playerList.forEach((player) => {
    const socket = io.sockets.sockets.get(player.socketId);
    if (socket) {
      // 자신의 순위 정보
      socket.emit('PLAYER_RANK_UPDATE', {
        rank: player.rank,
        totalPlayers: playerList.length,
        totalAsset: player.totalAsset,
      });
      // 전체 순위 리스트 (닉네임만 표시, 자신은 강조)
      const rankList = playerList.map(p => ({
        rank: p.rank,
        nickname: p.nickname,
        totalAsset: p.totalAsset,
        isMe: p.socketId === player.socketId,
      }));
      socket.emit('PLAYER_RANK_LIST_UPDATE', rankList);
    }
  });
}

  // Socket.io 연결 처리
  io.on('connection', (socket) => {
    const totalConnections = io.sockets.sockets.size;
    console.log(`클라이언트 연결: ${socket.id} (총 ${totalConnections}개 연결)`);
    
    // 플레이어가 게임 상태 요청
    socket.on('PLAYER_REQUEST_STATE', () => {
      socket.emit('GAME_STATE_UPDATE', {
        currentRound: gameState.currentRound,
        stockPrices: getCurrentPrices(),
        currentNews: gameState.currentNews,
        isGameStarted: gameState.isGameStarted,
        isPracticeMode: gameState.isPracticeMode,
        isWaitingMode: gameState.isWaitingMode,
        priceHistory: gameState.stockPrices,
        connectedPlayers: connectedPlayers.size,
        countdown: gameState.countdown,
      });
    });

  // 관리자 확인
  socket.on('ADMIN_AUTH', (password) => {
    if (password === 'holydownhill') {
      adminSocket = socket;
      socket.emit('ADMIN_AUTH_SUCCESS');
      socket.emit('GAME_STATE_UPDATE', {
        currentRound: gameState.currentRound,
        stockPrices: getCurrentPrices(),
        currentNews: gameState.currentNews,
        isGameStarted: gameState.isGameStarted,
        isPracticeMode: gameState.isPracticeMode,
        isWaitingMode: gameState.isWaitingMode,
        priceHistory: gameState.stockPrices,
        connectedPlayers: connectedPlayers.size,
        countdown: gameState.countdown,
      });
      socket.emit('GAME_SETTINGS_UPDATE', gameSettings);
      // 초기 플레이어 수 전송
      socket.emit('PLAYER_COUNT_UPDATE', connectedPlayers.size);
      // 거래 로그 전송 (최근 100개)
      socket.emit('TRANSACTION_LOGS_INIT', transactionLogs.slice(-100));
      broadcastPlayerList();
      console.log('관리자 인증 완료');
    } else {
      socket.emit('ADMIN_AUTH_ERROR', { message: '비밀번호가 올바르지 않습니다.' });
    }
  });

  // 관리자가 게임 상태 요청
  socket.on('ADMIN_REQUEST_STATE', () => {
    if (socket === adminSocket) {
      socket.emit('GAME_STATE_UPDATE', {
        currentRound: gameState.currentRound,
        stockPrices: getCurrentPrices(),
        currentNews: gameState.currentNews,
        isGameStarted: gameState.isGameStarted,
        isPracticeMode: gameState.isPracticeMode,
        isWaitingMode: gameState.isWaitingMode,
        priceHistory: gameState.stockPrices,
        connectedPlayers: connectedPlayers.size,
        countdown: gameState.countdown,
      });
      socket.emit('GAME_SETTINGS_UPDATE', gameSettings);
      broadcastPlayerList();
      console.log('관리자 게임 상태 전송');
    }
  });

  // 닉네임 중복 체크 함수
  function isNicknameDuplicate(nickname, excludeSocketId = null) {
    // 연습 모드와 실제 게임 모드 모두 체크
    const allPlayersData = new Map([...playersData, ...practicePlayersData]);
    
    for (const [socketId, playerData] of allPlayersData.entries()) {
      // 자기 자신은 제외
      if (excludeSocketId && socketId === excludeSocketId) {
        continue;
      }
      // 연결된 소켓인지 확인
      const playerSocket = io.sockets.sockets.get(socketId);
      if (playerSocket && playerData.nickname === nickname) {
        return true;
      }
    }
    return false;
  }

  // 플레이어 접속
  socket.on('PLAYER_JOIN', (nickname) => {
    // 닉네임 유효성 검사
    if (!nickname || !nickname.trim()) {
      socket.emit('NICKNAME_ERROR', { message: '닉네임을 입력해주세요.' });
      return;
    }

    const trimmedNickname = nickname.trim();
    const dataMap = gameState.isPracticeMode ? practicePlayersData : playersData;
    
    // 같은 닉네임으로 기존 플레이어 데이터 찾기
    let existingPlayerData = null;
    let existingSocketId = null;
    
    for (const [socketId, playerData] of dataMap.entries()) {
      if (playerData.nickname === trimmedNickname) {
        // 해당 소켓이 아직 연결되어 있는지 확인
        const existingSocket = io.sockets.sockets.get(socketId);
        if (existingSocket && existingSocket.id !== socket.id) {
          // 다른 소켓이 이미 이 닉네임을 사용 중
          socket.emit('NICKNAME_ERROR', { message: '이미 사용 중인 닉네임입니다. 다른 닉네임을 사용해주세요.' });
          return;
        }
        // 연결되지 않은 기존 데이터 발견
        if (!existingSocket) {
          existingPlayerData = playerData;
          existingSocketId = socketId;
          break;
        }
      }
    }
    
    // 연결된 소켓 중에서도 중복 체크
    if (!existingPlayerData) {
      for (const [socketId, playerData] of dataMap.entries()) {
        if (playerData.nickname === trimmedNickname) {
          const existingSocket = io.sockets.sockets.get(socketId);
          if (existingSocket && existingSocket.id !== socket.id) {
            socket.emit('NICKNAME_ERROR', { message: '이미 사용 중인 닉네임입니다. 다른 닉네임을 사용해주세요.' });
            return;
          }
        }
      }
    }

    connectedPlayers.add(socket.id);
    socket.nickname = trimmedNickname;
    
    // 기존 플레이어 데이터 재사용 또는 새로 생성
    if (existingPlayerData && existingSocketId) {
      // 기존 데이터를 새로운 socket.id로 이동
      dataMap.delete(existingSocketId);
      dataMap.set(socket.id, existingPlayerData);
      console.log(`기존 플레이어 재접속: ${trimmedNickname} (기존 socket: ${existingSocketId} -> 새 socket: ${socket.id})`);
    } else if (!dataMap.has(socket.id)) {
      // 새로운 플레이어 데이터 생성
      dataMap.set(socket.id, {
        nickname: trimmedNickname,
        cash: INITIAL_CASH,
        stocks: {},
        bonusPoints: 0,
        totalAsset: INITIAL_CASH,
        transactions: [],
      });
      // 초기 주식 수량 0으로 설정
      STOCKS.forEach((stock) => {
        dataMap.get(socket.id).stocks[stock.id] = 0;
      });
      console.log(`새 플레이어 접속: ${trimmedNickname}`);
    } else {
      // 같은 socket.id로 재접속 (닉네임 업데이트만)
      dataMap.get(socket.id).nickname = trimmedNickname;
    }
    
    // 플레이어에게 현재 포트폴리오 전송
    const playerData = dataMap.get(socket.id);
    socket.emit('PLAYER_PORTFOLIO_UPDATE', {
      cash: playerData.cash,
      stocks: playerData.stocks,
      bonusPoints: playerData.bonusPoints,
      totalAsset: calculatePlayerTotalAsset(socket.id, gameState.isPracticeMode),
    });
    
    socket.emit('GAME_STATE_UPDATE', {
      currentRound: gameState.currentRound,
      stockPrices: getCurrentPrices(),
      currentNews: gameState.currentNews,
      isGameStarted: gameState.isGameStarted,
      isPracticeMode: gameState.isPracticeMode,
      isWaitingMode: gameState.isWaitingMode,
      priceHistory: gameState.stockPrices,
      countdown: gameState.countdown,
    });
    
    // 관리자에게 플레이어 수 및 리스트 업데이트
    if (adminSocket) {
      adminSocket.emit('PLAYER_COUNT_UPDATE', connectedPlayers.size);
      broadcastPlayerList();
    }
    console.log(`플레이어 접속: ${nickname} (총 ${connectedPlayers.size}명)`);
  });

  // 관리자: 연습 게임 시작
  socket.on('ADMIN_START_PRACTICE', () => {
    if (socket === adminSocket) {
      gameState.isPracticeMode = true;
      gameState.isGameStarted = true;
      gameState.isWaitingMode = false;
      gameState.currentRound = 0;
      // 가격 초기화
      STOCKS.forEach((stock) => {
        gameState.stockPrices[stock.id] = [stock.basePrice];
      });
      gameState.currentNews = gameState.scenarios[0].headline;
      
      // 연습 모드 플레이어 데이터 초기화 (자본금, 주식, 보너스 포인트 모두 초기화)
      practicePlayersData.forEach((playerData, socketId) => {
        playerData.cash = INITIAL_CASH;
        playerData.bonusPoints = 0;
        playerData.totalAsset = INITIAL_CASH;
        playerData.transactions = [];
        // 모든 주식 수량 0으로 초기화
        STOCKS.forEach((stock) => {
          playerData.stocks[stock.id] = 0;
        });
        
        // 플레이어에게 초기화된 포트폴리오 전송
        const playerSocket = io.sockets.sockets.get(socketId);
        if (playerSocket) {
          playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
            cash: playerData.cash,
            stocks: playerData.stocks,
            bonusPoints: playerData.bonusPoints,
            totalAsset: playerData.totalAsset,
          });
        }
      });
      
      // 새로 접속한 플레이어를 위한 빈 맵 유지 (기존 데이터는 위에서 초기화됨)
      broadcastGameState();
      broadcastPlayerList();
      console.log('연습 게임 시작 (모든 플레이어 데이터 초기화)');
    }
  });

  // 관리자: 실제 게임 시작 (연습에서 전환)
  socket.on('ADMIN_START_REAL_GAME', () => {
    if (socket === adminSocket) {
      gameState.isPracticeMode = false;
      gameState.isGameStarted = true;
      gameState.isWaitingMode = false;
      gameState.currentRound = 0;
      // 가격 초기화
      STOCKS.forEach((stock) => {
        gameState.stockPrices[stock.id] = [stock.basePrice];
      });
      gameState.currentNews = gameState.scenarios[0].headline;
      // 실제 게임 플레이어 데이터 초기화 (자본금, 주식, 보너스 포인트 모두 초기화)
      playersData.forEach((playerData, socketId) => {
        playerData.cash = INITIAL_CASH;
        playerData.bonusPoints = 0;
        playerData.totalAsset = INITIAL_CASH;
        playerData.transactions = [];
        // 모든 주식 수량 0으로 초기화
        STOCKS.forEach((stock) => {
          playerData.stocks[stock.id] = 0;
        });
        
        // 플레이어에게 초기화된 포트폴리오 전송
        const playerSocket = io.sockets.sockets.get(socketId);
        if (playerSocket) {
          playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
            cash: playerData.cash,
            stocks: playerData.stocks,
            bonusPoints: playerData.bonusPoints,
            totalAsset: playerData.totalAsset,
          });
        }
      });
      
      broadcastGameState();
      broadcastPlayerList();
      console.log('실제 게임 시작 (연습 모드 종료, 모든 플레이어 데이터 초기화)');
    }
  });

  // 관리자: 게임 시작 (기존 호환성 유지)
  socket.on('ADMIN_START_GAME', () => {
    if (socket === adminSocket) {
      // 연습 모드가 아니면 실제 게임 시작
      if (!gameState.isPracticeMode) {
        gameState.isGameStarted = true;
        gameState.isWaitingMode = false;
        gameState.currentRound = 0;
        // 가격 초기화
        STOCKS.forEach((stock) => {
          gameState.stockPrices[stock.id] = [stock.basePrice];
        });
        gameState.currentNews = gameState.scenarios[0].headline;
        broadcastGameState();
        console.log('게임 시작');
      }
    }
  });

  // 관리자: 다음 라운드
  socket.on('ADMIN_NEXT_ROUND', () => {
    if (socket === adminSocket && gameState.isGameStarted && !gameState.isWaitingMode) {
      // 카운트다운 시작 (3초)
      gameState.countdown = 3;
      io.emit('ROUND_COUNTDOWN', { countdown: gameState.countdown });
      
      const countdownInterval = setInterval(() => {
        gameState.countdown--;
        io.emit('ROUND_COUNTDOWN', { countdown: gameState.countdown });
        
        if (gameState.countdown <= 0) {
          clearInterval(countdownInterval);
          gameState.countdown = null;
          
          // 실제 라운드 전환
          const success = calculateNextRoundPrices();
          if (success) {
            broadcastGameState();
            console.log(`라운드 ${gameState.currentRound + 1} 시작`);
          } else {
            socket.emit('GAME_END');
            console.log('게임 종료');
          }
        }
      }, 1000);
    }
  });

  // 관리자: 이전 라운드
  socket.on('ADMIN_PREVIOUS_ROUND', () => {
    if (socket === adminSocket && gameState.currentRound > 0) {
      gameState.currentRound--;
      gameState.currentNews =
        gameState.scenarios[gameState.currentRound].headline;
      broadcastGameState();
      console.log(`라운드 ${gameState.currentRound + 1}로 이동`);
    }
  });

  // 관리자: 게임 설정 업데이트
  socket.on('ADMIN_UPDATE_GAME_SETTINGS', (data) => {
    if (socket === adminSocket && !gameState.isGameStarted) {
      const { initialCash, totalRounds } = data;
      
      if (initialCash !== undefined && initialCash >= 0) {
        INITIAL_CASH = initialCash;
        gameSettings.initialCash = initialCash;
      }
      
      if (totalRounds !== undefined && totalRounds >= 1 && totalRounds <= 20) {
        gameSettings.totalRounds = totalRounds;
        // 시나리오 배열 조정
        if (totalRounds > gameState.scenarios.length) {
          // 라운드 추가
          const lastScenario = gameState.scenarios[gameState.scenarios.length - 1];
          for (let i = gameState.scenarios.length; i < totalRounds; i++) {
            gameState.scenarios.push({
              ...lastScenario,
              round: i,
              headline: `라운드 ${i + 1} 뉴스`,
              volatility: { ...lastScenario.volatility },
            });
          }
        } else if (totalRounds < gameState.scenarios.length) {
          // 라운드 제거
          gameState.scenarios = gameState.scenarios.slice(0, totalRounds);
        }
      }
      
      // 설정 정보 전송
      socket.emit('GAME_SETTINGS_UPDATE', gameSettings);
      console.log(`게임 설정 업데이트: 초기현금=${INITIAL_CASH}, 라운드수=${gameSettings.totalRounds}`);
    }
  });

  // 관리자: 게임 설정 요청
  socket.on('ADMIN_REQUEST_GAME_SETTINGS', () => {
    if (socket === adminSocket) {
      socket.emit('GAME_SETTINGS_UPDATE', gameSettings);
    }
  });

  // 관리자: 시나리오 업데이트
  socket.on('ADMIN_UPDATE_SCENARIO', (data) => {
    if (socket === adminSocket) {
      const { round, updates } = data;
      if (gameState.scenarios[round]) {
        gameState.scenarios[round] = {
          ...gameState.scenarios[round],
          ...updates,
        };
        // 가격 재계산
        if (round <= gameState.currentRound && updates.volatility) {
          for (let r = round; r <= gameState.currentRound; r++) {
            const scenario = gameState.scenarios[r];
            STOCKS.forEach((stock) => {
              if (r === 0) {
                gameState.stockPrices[stock.id][0] = stock.basePrice;
              } else {
                const prevPrice =
                  gameState.stockPrices[stock.id][r - 1] || stock.basePrice;
                const changeRate = scenario.volatility[stock.id] / 100;
                gameState.stockPrices[stock.id][r] =
                  prevPrice * (1 + changeRate);
              }
            });
          }
        }
        broadcastGameState();
        console.log(`라운드 ${round + 1} 시나리오 업데이트`);
      }
    }
  });

  // 플레이어: 주식 매수
  socket.on('PLAYER_BUY_STOCK', (data) => {
    const { stockId, quantity } = data;
    const dataMap = gameState.isPracticeMode ? practicePlayersData : playersData;
    const playerData = dataMap.get(socket.id);
    
    if (!playerData) {
      socket.emit('TRANSACTION_ERROR', { message: '플레이어 데이터를 찾을 수 없습니다.' });
      return;
    }
    
    const currentPrices = getCurrentPrices();
    const price = currentPrices[stockId];
    const totalCost = price * quantity;
    
    if (playerData.cash < totalCost) {
      socket.emit('TRANSACTION_ERROR', { message: '현금이 부족합니다.' });
      return;
    }
    
    // 매수 처리
    playerData.cash -= totalCost;
    playerData.stocks[stockId] = (playerData.stocks[stockId] || 0) + quantity;
    
    // 거래 기록
    const transaction = {
      type: 'BUY',
      stockId,
      quantity,
      price,
      totalCost,
      round: gameState.currentRound,
      timestamp: new Date().toISOString(),
      nickname: playerData.nickname,
    };
    playerData.transactions.push(transaction);
    
    // 거래 로그에 추가 (관리자용)
    transactionLogs.push(transaction);
    if (transactionLogs.length > 1000) {
      transactionLogs.shift(); // 최대 1000개까지만 유지
    }
    
    // 관리자에게 거래 로그 전송
    if (adminSocket) {
      adminSocket.emit('TRANSACTION_LOG_UPDATE', transaction);
    }
    
    // 플레이어에게 업데이트 전송
    const totalAsset = calculatePlayerTotalAsset(socket.id, gameState.isPracticeMode);
    playerData.totalAsset = totalAsset;
    socket.emit('PLAYER_PORTFOLIO_UPDATE', {
      cash: playerData.cash,
      stocks: playerData.stocks,
      bonusPoints: playerData.bonusPoints,
      totalAsset: totalAsset,
    });
    
    // 관리자에게 플레이어 리스트 업데이트
    broadcastPlayerList();
    const mode = gameState.isPracticeMode ? '[연습]' : '[실제]';
    console.log(`${mode} ${playerData.nickname} 매수: ${stockId} ${quantity}주 (${totalCost}원)`);
  });
  
  // 플레이어: 주식 매도
  socket.on('PLAYER_SELL_STOCK', (data) => {
    const { stockId, quantity } = data;
    const dataMap = gameState.isPracticeMode ? practicePlayersData : playersData;
    const playerData = dataMap.get(socket.id);
    
    if (!playerData) {
      socket.emit('TRANSACTION_ERROR', { message: '플레이어 데이터를 찾을 수 없습니다.' });
      return;
    }
    
    const currentStockQty = playerData.stocks[stockId] || 0;
    if (currentStockQty < quantity) {
      socket.emit('TRANSACTION_ERROR', { message: '보유 주식이 부족합니다.' });
      return;
    }
    
    const currentPrices = getCurrentPrices();
    const price = currentPrices[stockId];
    const totalRevenue = price * quantity;
    
    // 매도 처리
    playerData.cash += totalRevenue;
    playerData.stocks[stockId] = currentStockQty - quantity;
    
    // 거래 기록
    const transaction = {
      type: 'SELL',
      stockId,
      quantity,
      price,
      totalRevenue,
      round: gameState.currentRound,
      timestamp: new Date().toISOString(),
      nickname: playerData.nickname,
    };
    playerData.transactions.push(transaction);
    
    // 거래 로그에 추가 (관리자용)
    transactionLogs.push(transaction);
    if (transactionLogs.length > 1000) {
      transactionLogs.shift(); // 최대 1000개까지만 유지
    }
    
    // 관리자에게 거래 로그 전송
    if (adminSocket) {
      adminSocket.emit('TRANSACTION_LOG_UPDATE', transaction);
    }
    
    // 플레이어에게 업데이트 전송
    const totalAsset = calculatePlayerTotalAsset(socket.id, gameState.isPracticeMode);
    playerData.totalAsset = totalAsset;
    socket.emit('PLAYER_PORTFOLIO_UPDATE', {
      cash: playerData.cash,
      stocks: playerData.stocks,
      bonusPoints: playerData.bonusPoints,
      totalAsset: totalAsset,
    });
    
    // 관리자에게 플레이어 리스트 업데이트
    broadcastPlayerList();
    const mode = gameState.isPracticeMode ? '[연습]' : '[실제]';
    console.log(`${mode} ${playerData.nickname} 매도: ${stockId} ${quantity}주 (${totalRevenue}원)`);
  });
  
  // 관리자: 플레이어에게 포인트 추가
  socket.on('ADMIN_ADD_POINTS', (data) => {
    if (socket !== adminSocket) return;
    
    const { socketId, points } = data;
    const dataMap = gameState.isPracticeMode ? practicePlayersData : playersData;
    const playerData = dataMap.get(socketId);
    
    if (!playerData) {
      socket.emit('ADMIN_ERROR', { message: '플레이어를 찾을 수 없습니다.' });
      return;
    }
    
    playerData.bonusPoints += points;
    
    // 플레이어에게 업데이트 전송
    const playerSocket = io.sockets.sockets.get(socketId);
    if (playerSocket) {
      const totalAsset = calculatePlayerTotalAsset(socketId, gameState.isPracticeMode);
      playerData.totalAsset = totalAsset;
      playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
        cash: playerData.cash,
        stocks: playerData.stocks,
        bonusPoints: playerData.bonusPoints,
        totalAsset: totalAsset,
      });
      // 포인트 추가 알림 전송
      playerSocket.emit('BONUS_POINTS_ADDED', {
        points: points,
        totalBonusPoints: playerData.bonusPoints,
      });
    }
    
    // 관리자에게 플레이어 리스트 업데이트
    broadcastPlayerList();
    const mode = gameState.isPracticeMode ? '[연습]' : '[실제]';
    console.log(`${mode} ${playerData.nickname}에게 ${points}포인트 추가 (총 ${playerData.bonusPoints}포인트)`);
  });
  
  // 관리자: 플레이어 리스트 요청
  socket.on('ADMIN_REQUEST_PLAYER_LIST', () => {
    if (socket === adminSocket) {
      broadcastPlayerList();
    }
  });
  
  // 연결 해제
  socket.on('disconnect', () => {
    const totalConnections = io.sockets.sockets.size;
    if (socket === adminSocket) {
      adminSocket = null;
      console.log(`관리자 연결 해제: ${socket.id} (총 ${totalConnections}개 연결)`);
    } else {
      connectedPlayers.delete(socket.id);
      // 플레이어 데이터는 유지 (재접속 시 사용)
      // 같은 닉네임으로 재접속하면 기존 데이터를 재사용하므로 삭제하지 않음
      // playersData.delete(socket.id); // 필요시 주석 해제
      if (adminSocket) {
        adminSocket.emit('PLAYER_COUNT_UPDATE', connectedPlayers.size);
        broadcastPlayerList();
      }
      const nickname = socket.nickname || '알 수 없음';
      console.log(`플레이어 연결 해제: ${nickname} (socket: ${socket.id}, 접속 플레이어: ${connectedPlayers.size}명, 총 연결: ${totalConnections}개)`);
    }
  });
});

const PORT = process.env.PORT || 3001;
// 모든 네트워크 인터페이스에 바인딩 (0.0.0.0)
httpServer.listen(PORT, '0.0.0.0', () => {
  // 로컬 IP 주소 가져오기
  const networkInterfaces = os.networkInterfaces();
  let localIP = 'localhost';
  
  for (const interfaceName of Object.keys(networkInterfaces)) {
    const addresses = networkInterfaces[interfaceName];
    for (const address of addresses) {
      if (address.family === 'IPv4' && !address.internal) {
        localIP = address.address;
        break;
      }
    }
    if (localIP !== 'localhost') break;
  }

  console.log('='.repeat(50));
  console.log('🚀 Socket.io 서버가 실행되었습니다!');
  console.log('='.repeat(50));
  console.log(`📡 로컬 주소: http://localhost:${PORT}`);
  console.log(`📡 네트워크 주소: http://${localIP}:${PORT}`);
  console.log(`👨‍💼 관리자 페이지 (로컬): http://localhost:5173/admin`);
  console.log(`👨‍💼 관리자 페이지 (네트워크): http://${localIP}:5173/admin`);
  console.log(`👥 플레이어 페이지 (로컬): http://localhost:5173/player`);
  console.log(`👥 플레이어 페이지 (네트워크): http://${localIP}:5173/player`);
  console.log('='.repeat(50));
  console.log('💡 다른 기기에서 접속하려면 네트워크 주소를 사용하세요!');
  console.log('='.repeat(50));
});


