import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import {
  STOCKS,
  initialScenarios,
} from './src/data/initialScenarios.js';
import { dbHelpers, closeDb } from './db.js';

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
  roundTimer: null, // 라운드 타이머 (초 단위, 15분 = 900초)
};

// 초기 가격 설정
STOCKS.forEach((stock) => {
  gameState.stockPrices[stock.id] = [stock.basePrice];
});

// 연결된 플레이어 수 추적
let connectedPlayers = new Set();
let adminSockets = new Set(); // 여러 관리자 지원
// 운영자 인증 정보 (socketId -> adminId)
const adminAuthMap = new Map(); // { socketId: adminId }
// 거래 로그 저장 (관리자용)
const transactionLogs = [];
// 카운트다운 interval 저장
let countdownInterval = null;
// 라운드 타이머 interval 저장
let roundTimerInterval = null;

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
  const maxRounds = gameState.isPracticeMode
    ? 3
    : gameState.scenarios.length;

  if (gameState.currentRound >= maxRounds - 1) {
    return false; // 게임 종료
  }

  const nextRound = gameState.currentRound + 1;
  const scenario = gameState.scenarios[nextRound];

  // 새로운 가격 계산 (누적)
  STOCKS.forEach((stock) => {
    const currentPrice =
      gameState.stockPrices[stock.id][
        gameState.currentRound
      ];
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
      gameState.stockPrices[stock.id].length >
        gameState.currentRound
    ) {
      prices[stock.id] =
        gameState.stockPrices[stock.id][
          gameState.currentRound
        ];
    } else {
      prices[stock.id] = stock.basePrice;
    }
  });
  return prices;
}

// 플레이어 총 자산 계산
function calculatePlayerTotalAsset(
  socketId,
  isPractice = false
) {
  const dataMap = isPractice
    ? practicePlayersData
    : playersData;
  const playerData = dataMap.get(socketId);
  if (!playerData) return 0;

  // bonusPoints가 있으면 cash에 통합
  if (
    playerData.bonusPoints &&
    playerData.bonusPoints > 0
  ) {
    playerData.cash += playerData.bonusPoints;
    playerData.bonusPoints = 0;
  }

  // cash만 사용 (bonusPoints는 이미 cash에 통합됨)
  let total = playerData.cash;
  const currentPrices = getCurrentPrices();

  STOCKS.forEach((stock) => {
    const qty = playerData.stocks[stock.id] || 0;
    const price =
      currentPrices[stock.id] || stock.basePrice;
    total += qty * price;
  });

  return total;
}

// 라운드 타이머 시작 함수
function startRoundTimer() {
  // 기존 타이머 정리
  if (roundTimerInterval) {
    clearInterval(roundTimerInterval);
    roundTimerInterval = null;
  }

  // 새 타이머 시작 (15분 = 900초)
  gameState.roundTimer = 15 * 60;

  roundTimerInterval = setInterval(() => {
    if (
      gameState.roundTimer === null ||
      gameState.roundTimer <= 0
    ) {
      clearInterval(roundTimerInterval);
      roundTimerInterval = null;
      gameState.roundTimer = 0;
      return;
    }

    gameState.roundTimer--;

    // 타이머 상태 브로드캐스트
    io.emit('ROUND_TIMER_UPDATE', {
      roundTimer: gameState.roundTimer,
    });

    // 타이머가 0이 되면 관리자에게 알림
    if (gameState.roundTimer === 0) {
      adminSockets.forEach((adminSocket) => {
        adminSocket.emit('ROUND_TIMER_END', {
          message:
            '15분이 종료되었습니다. 다음 라운드로 진행하시겠습니까?',
        });
      });
    }
  }, 1000);
}

// 라운드 타이머 정리 함수
function stopRoundTimer() {
  if (roundTimerInterval) {
    clearInterval(roundTimerInterval);
    roundTimerInterval = null;
  }
  gameState.roundTimer = null;
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
    roundTimer: gameState.roundTimer, // 라운드 타이머 추가
  };
  io.emit('GAME_STATE_UPDATE', stateToSend);

  // 모든 플레이어의 총 자산 업데이트
  const dataMap = gameState.isPracticeMode
    ? practicePlayersData
    : playersData;
  dataMap.forEach((playerData, socketId) => {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      // 기존 bonusPoints가 있으면 cash에 통합
      if (
        playerData.bonusPoints &&
        playerData.bonusPoints > 0
      ) {
        playerData.cash += playerData.bonusPoints;
        playerData.bonusPoints = 0;
      }
      const totalAsset = calculatePlayerTotalAsset(
        socketId,
        gameState.isPracticeMode
      );
      playerData.totalAsset = totalAsset;

      // 각 주식의 매수 평균가 계산
      const averageBuyPrices = {};
      STOCKS.forEach((stock) => {
        const stockId = stock.id;
        const quantity = playerData.stocks[stockId] || 0;

        if (quantity > 0) {
          // 해당 주식의 모든 매수 거래 찾기
          const buyTransactions =
            playerData.transactions.filter(
              (t) =>
                t.type === 'BUY' && t.stockId === stockId
            );

          if (buyTransactions.length > 0) {
            // 총 매수 금액과 총 수량 계산
            let totalBuyCost = 0;
            let totalBuyQuantity = 0;

            buyTransactions.forEach((t) => {
              totalBuyCost +=
                t.totalCost || t.price * t.quantity;
              totalBuyQuantity += t.quantity;
            });

            // 평균 매수가 계산
            if (totalBuyQuantity > 0) {
              averageBuyPrices[stockId] =
                totalBuyCost / totalBuyQuantity;
            }
          }
        }
      });

      socket.emit('PLAYER_PORTFOLIO_UPDATE', {
        cash: playerData.cash,
        stocks: playerData.stocks,
        bonusPoints: 0, // bonusPoints는 더 이상 사용하지 않음
        totalAsset: totalAsset,
        averageBuyPrices: averageBuyPrices, // 매수 평균가 추가
      });
      socket.emit(
        'PLAYER_HINTS_UPDATE',
        playerData.hints || []
      );
    }
  });
}

// 플레이어 리스트 브로드캐스트 (모든 관리자에게)
function broadcastPlayerList() {
  if (adminSockets.size === 0) {
    console.log('[broadcastPlayerList] 관리자가 없어서 브로드캐스트 스킵');
    return;
  }

  const dataMap = gameState.isPracticeMode
    ? practicePlayersData
    : playersData;

  console.log(
    `[broadcastPlayerList] dataMap 크기: ${dataMap.size}, connectedPlayers 크기: ${connectedPlayers.size}`
  );

  // 닉네임별로 그룹화하여 중복 제거 (연결된 플레이어 우선)
  const nicknameMap = new Map();

  Array.from(dataMap.entries()).forEach(
    ([socketId, data]) => {
      const isOnline = connectedPlayers.has(socketId);
      const existing = nicknameMap.get(data.nickname);

      // 같은 닉네임이 이미 있으면:
      // 1. 연결된 플레이어가 우선
      // 2. 둘 다 연결되어 있거나 둘 다 연결 안 되어 있으면 기존 것 유지
      if (!existing || (isOnline && !existing.isOnline)) {
        const totalAsset = calculatePlayerTotalAsset(
          socketId,
          gameState.isPracticeMode
        );
        // 마지막 거래 라운드 찾기
        const lastTransaction =
          data.transactions.length > 0
            ? data.transactions[
                data.transactions.length - 1
              ]
            : null;
        const lastTransactionRound = lastTransaction
          ? lastTransaction.round
          : null;

        nicknameMap.set(data.nickname, {
          socketId,
          nickname: data.nickname,
          cash: data.cash,
          bonusPoints: data.bonusPoints,
          stocks: data.stocks,
          totalAsset: totalAsset,
          transactionCount: data.transactions.length,
          isOnline: isOnline,
          lastTransactionRound: lastTransactionRound,
          hints: data.hints || [], // 힌트 목록 추가
        });
      }
    }
  );

  // Map에서 배열로 변환
  const playerList = Array.from(nicknameMap.values());

  // 총 자산 기준으로 정렬하고 순위 추가
  playerList.sort((a, b) => b.totalAsset - a.totalAsset);
  playerList.forEach((player, index) => {
    player.rank = index + 1;
  });

  // 모든 관리자에게 전송
  console.log(
    `[broadcastPlayerList] 플레이어 리스트 브로드캐스트: ${playerList.length}명, 관리자: ${adminSockets.size}명`
  );
  if (playerList.length > 0) {
    console.log(
      `[broadcastPlayerList] 플레이어 목록:`,
      playerList.map((p) => `${p.nickname} (${p.isOnline ? '온라인' : '오프라인'})`)
    );
  }
  adminSockets.forEach((adminSocket) => {
    adminSocket.emit('PLAYER_LIST_UPDATE', playerList);
  });

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
      const rankList = playerList.map((p) => ({
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
  console.log(
    `클라이언트 연결: ${socket.id} (총 ${totalConnections}개 연결)`
  );

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

  // 관리자 인증 (ID/PW 검증)
  socket.on('ADMIN_AUTH', (data) => {
    const { adminId, password } = data;

    if (!adminId || !password) {
      socket.emit('ADMIN_AUTH_ERROR', {
        message: 'ID와 비밀번호를 입력해주세요.',
      });
      return;
    }

    // DB에서 운영자 확인
    const admin = dbHelpers.getAdmin(adminId);

    if (!admin || admin.password !== password) {
      socket.emit('ADMIN_AUTH_ERROR', {
        message: 'ID 또는 비밀번호가 올바르지 않습니다.',
      });
      return;
    }

    // 인증 성공
    adminSockets.add(socket);
    adminAuthMap.set(socket.id, adminId);
    console.log(
      `[ADMIN_AUTH] 인증 성공 - socket.id: ${socket.id}, adminId: ${adminId}`
    );
    console.log(
      `[ADMIN_AUTH] 현재 adminSockets.size: ${adminSockets.size}`
    );
    console.log(
      `[ADMIN_AUTH] adminSockets 목록:`,
      Array.from(adminSockets).map((s) => s.id)
    );
    socket.emit('ADMIN_AUTH_SUCCESS', { adminId });
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
      roundTimer: gameState.roundTimer,
    });
    socket.emit('GAME_SETTINGS_UPDATE', gameSettings);
    // 초기 플레이어 수 전송
    socket.emit(
      'PLAYER_COUNT_UPDATE',
      connectedPlayers.size
    );
    // 거래 로그 전송 (데이터베이스에서 로드)
    const dbTransactions = dbHelpers.getAllTransactions(
      gameState.isPracticeMode
    );
    socket.emit('TRANSACTION_LOGS_INIT', dbTransactions);
    // 메모리에도 동기화
    transactionLogs.length = 0;
    transactionLogs.push(...dbTransactions);
    // 운영자 계정 목록 전송
    const admins = dbHelpers.getAllAdmins();
    socket.emit('ADMINS_LIST_UPDATE', admins);
    broadcastPlayerList();
    console.log(
      `관리자 인증 완료: ${adminId} (${socket.id})`
    );
  });

  // 관리자가 게임 상태 요청
  socket.on('ADMIN_REQUEST_STATE', () => {
    if (adminSockets.has(socket)) {
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
        roundTimer: gameState.roundTimer,
      });
      socket.emit('GAME_SETTINGS_UPDATE', gameSettings);
      broadcastPlayerList();
      console.log('관리자 게임 상태 전송');
    }
  });

  // 닉네임 중복 체크 함수
  function isNicknameDuplicate(
    nickname,
    excludeSocketId = null
  ) {
    // 연습 모드와 실제 게임 모드 모두 체크
    const allPlayersData = new Map([
      ...playersData,
      ...practicePlayersData,
    ]);

    for (const [
      socketId,
      playerData,
    ] of allPlayersData.entries()) {
      // 자기 자신은 제외
      if (excludeSocketId && socketId === excludeSocketId) {
        continue;
      }
      // 연결된 소켓인지 확인
      const playerSocket = io.sockets.sockets.get(socketId);
      if (
        playerSocket &&
        playerData.nickname === nickname
      ) {
        return true;
      }
    }
    return false;
  }

  // 플레이어 접속
  socket.on('PLAYER_JOIN', (nickname) => {
    // 닉네임 유효성 검사
    if (!nickname || typeof nickname !== 'string') {
      socket.emit(
        'NICKNAME_ERROR',
        '닉네임을 입력해주세요.'
      );
      return;
    }

    const trimmedNickname = nickname.trim();
    if (trimmedNickname.length === 0) {
      socket.emit(
        'NICKNAME_ERROR',
        '닉네임을 입력해주세요.'
      );
      return;
    }
    if (trimmedNickname.length > 20) {
      socket.emit(
        'NICKNAME_ERROR',
        '닉네임은 20자 이하여야 합니다.'
      );
      return;
    }

    const dataMap = gameState.isPracticeMode
      ? practicePlayersData
      : playersData;
    const isPractice = gameState.isPracticeMode;

    // 닉네임 중복 체크 (연결된 플레이어 중에서)
    if (isNicknameDuplicate(trimmedNickname, socket.id)) {
      // 기존 연결된 플레이어 찾기
      const allPlayersData = new Map([
        ...playersData,
        ...practicePlayersData,
      ]);

      let existingSocketId = null;
      for (const [
        existingSocketIdKey,
        playerData,
      ] of allPlayersData.entries()) {
        if (playerData.nickname === trimmedNickname) {
          const existingSocket = io.sockets.sockets.get(
            existingSocketIdKey
          );
          if (existingSocket && existingSocket.connected) {
            existingSocketId = existingSocketIdKey;
            break;
          }
        }
      }

      if (existingSocketId) {
        // 기존 연결 끊기
        const existingSocket = io.sockets.sockets.get(
          existingSocketId
        );
        if (existingSocket) {
          console.log(
            `기존 연결 끊기: ${trimmedNickname} (socket: ${existingSocketId})`
          );
          existingSocket.emit('NICKNAME_DUPLICATE_KICK', {
            message:
              '다른 곳에서 같은 닉네임으로 접속했습니다. 연결이 끊어집니다.',
          });
          // 기존 플레이어 데이터 정리
          connectedPlayers.delete(existingSocketId);
          const existingDataMap = gameState.isPracticeMode
            ? practicePlayersData
            : playersData;
          existingDataMap.delete(existingSocketId);
          existingSocket.disconnect();
        }
      }
    }

    // savePlayer는 기존 플레이어가 있으면 재사용하고, 없으면 새로 생성합니다
    // 먼저 savePlayer를 호출하여 기존 플레이어를 찾거나 새로 생성
    const savedPlayer = dbHelpers.savePlayer(
      socket.id,
      trimmedNickname,
      INITIAL_CASH,
      0,
      INITIAL_CASH,
      isPractice
    );
    const playerId = savedPlayer.id;
    const isNewPlayer = savedPlayer._isNew === true;

    if (!isNewPlayer) {
      // 기존 플레이어 데이터 로드
      const dbStocks = dbHelpers.getPlayerStocks(
        playerId,
        isPractice
      );
      const dbHints = dbHelpers.getPlayerHints(
        playerId,
        isPractice
      );

      // 메모리 데이터 구조로 변환
      const stocks = {};
      STOCKS.forEach((stock) => {
        const dbStock = dbStocks.find(
          (s) => s.stock_id === stock.id
        );
        stocks[stock.id] = dbStock ? dbStock.quantity : 0;
      });

      const hints = dbHints.map((hint) => ({
        difficulty: hint.difficulty,
        content: hint.content,
        receivedAt: hint.received_at,
        price: hint.price,
        round: hint.round,
      }));

      // 메모리에 기존 데이터 로드
      dataMap.set(socket.id, {
        nickname: trimmedNickname,
        cash: savedPlayer.cash,
        stocks: stocks,
        bonusPoints: 0,
        totalAsset: savedPlayer.total_asset,
        transactions: [],
        hints: hints,
        dbId: playerId,
      });

      console.log(
        `기존 플레이어 재사용: ${trimmedNickname} (ID: ${playerId})`
      );
    } else {
      // 새 플레이어 생성
      // 메모리에 데이터 생성
      dataMap.set(socket.id, {
        nickname: trimmedNickname,
        cash: INITIAL_CASH,
        stocks: {},
        bonusPoints: 0,
        totalAsset: INITIAL_CASH,
        transactions: [],
        hints: [],
        dbId: playerId,
      });

      // 초기 주식 수량 0으로 설정
      STOCKS.forEach((stock) => {
        dataMap.get(socket.id).stocks[stock.id] = 0;
        dbHelpers.savePlayerStock(
          playerId,
          stock.id,
          0,
          isPractice
        );
      });

      console.log(
        `새 플레이어 생성: ${trimmedNickname} (DB ID: ${playerId})`
      );
    }

    // 같은 닉네임으로 이미 연결된 소켓이 있는지 확인
    // 기존 연결을 끊고 새 연결을 허용
    for (const [
      socketId,
      playerData,
    ] of dataMap.entries()) {
      if (playerData.nickname === trimmedNickname) {
        const existingSocket =
          io.sockets.sockets.get(socketId);
        if (
          existingSocket &&
          existingSocket.id !== socket.id &&
          existingSocket.connected
        ) {
          console.log(
            `중복 로그인 감지: ${trimmedNickname} - 기존 연결(${socketId}) 끊기`
          );
          // 기존 연결에 알림 전송
          existingSocket.emit('NICKNAME_DUPLICATE_KICK', {
            message:
              '다른 곳에서 같은 닉네임으로 접속했습니다. 연결이 끊어집니다.',
          });
          // 기존 플레이어 데이터 정리
          connectedPlayers.delete(socketId);
          dataMap.delete(socketId);
          // 기존 소켓 연결 끊기
          existingSocket.disconnect();
          console.log(
            `기존 연결 끊김: ${trimmedNickname} (socket: ${socketId})`
          );
        }
      }
    }

    connectedPlayers.add(socket.id);
    socket.nickname = trimmedNickname;

    console.log(
      `[PLAYER_JOIN] 플레이어 데이터 저장 완료: ${trimmedNickname}, socket.id: ${socket.id}, dataMap 크기: ${dataMap.size}`
    );

    // 플레이어에게 현재 포트폴리오 전송
    const playerData = dataMap.get(socket.id);
    if (!playerData) {
      console.error(
        `[PLAYER_JOIN] 오류: 플레이어 데이터를 찾을 수 없음 - ${trimmedNickname}, socket.id: ${socket.id}`
      );
    }
    // 기존 bonusPoints가 있으면 cash에 통합
    if (
      playerData.bonusPoints &&
      playerData.bonusPoints > 0
    ) {
      playerData.cash += playerData.bonusPoints;
      playerData.bonusPoints = 0;
    }

    // 데이터베이스에 현금 업데이트
    if (playerData.dbId) {
      const totalAsset = calculatePlayerTotalAsset(
        socket.id,
        isPractice
      );
      dbHelpers.updatePlayerCashById(
        playerData.dbId,
        playerData.cash,
        totalAsset,
        isPractice
      );
    }

    // 각 주식의 매수 평균가 계산
    const averageBuyPrices = {};
    STOCKS.forEach((stock) => {
      const stockId = stock.id;
      const quantity = playerData.stocks[stockId] || 0;

      if (quantity > 0) {
        // 해당 주식의 모든 매수 거래 찾기
        const buyTransactions =
          playerData.transactions.filter(
            (t) => t.type === 'BUY' && t.stockId === stockId
          );

        if (buyTransactions.length > 0) {
          // 총 매수 금액과 총 수량 계산
          let totalBuyCost = 0;
          let totalBuyQuantity = 0;

          buyTransactions.forEach((t) => {
            totalBuyCost +=
              t.totalCost || t.price * t.quantity;
            totalBuyQuantity += t.quantity;
          });

          // 평균 매수가 계산
          if (totalBuyQuantity > 0) {
            averageBuyPrices[stockId] =
              totalBuyCost / totalBuyQuantity;
          }
        }
      }
    });

    socket.emit('PLAYER_PORTFOLIO_UPDATE', {
      cash: playerData.cash,
      stocks: playerData.stocks,
      bonusPoints: 0, // bonusPoints는 더 이상 사용하지 않음
      totalAsset: calculatePlayerTotalAsset(
        socket.id,
        gameState.isPracticeMode
      ),
      averageBuyPrices: averageBuyPrices, // 매수 평균가 추가
    });
    socket.emit(
      'PLAYER_HINTS_UPDATE',
      playerData.hints || []
    );

    socket.emit('GAME_STATE_UPDATE', {
      currentRound: gameState.currentRound,
      stockPrices: getCurrentPrices(),
      currentNews: gameState.currentNews,
      isGameStarted: gameState.isGameStarted,
      isPracticeMode: gameState.isPracticeMode,
      isWaitingMode: gameState.isWaitingMode,
      priceHistory: gameState.stockPrices,
      countdown: gameState.countdown,
      roundTimer: gameState.roundTimer,
    });

    // 관리자에게 플레이어 수 및 리스트 업데이트
    if (adminSockets.size > 0) {
      console.log(
        `[PLAYER_JOIN] 관리자에게 플레이어 수 업데이트 전송: ${connectedPlayers.size}명, 관리자 수: ${adminSockets.size}명`
      );
      adminSockets.forEach((adminSocket) => {
        adminSocket.emit(
          'PLAYER_COUNT_UPDATE',
          connectedPlayers.size
        );
      });
      broadcastPlayerList();
    } else {
      console.log(
        `[PLAYER_JOIN] 관리자가 없어서 플레이어 수 업데이트 전송 안 함`
      );
    }
    console.log(
      `[PLAYER_JOIN] 플레이어 접속: ${trimmedNickname} (총 ${connectedPlayers.size}명)`
    );
  });

  // 관리자: 연습 게임 시작
  socket.on('ADMIN_START_PRACTICE', () => {
    if (adminSockets.has(socket)) {
      gameState.isPracticeMode = true;
      gameState.isGameStarted = true;
      gameState.isWaitingMode = false;
      gameState.currentRound = 0;
      // 가격 초기화
      STOCKS.forEach((stock) => {
        gameState.stockPrices[stock.id] = [stock.basePrice];
      });
      gameState.currentNews =
        gameState.scenarios[0].headline;

      // 연습 모드 플레이어 데이터 초기화 (자본금, 주식, 보너스 포인트 모두 초기화)
      practicePlayersData.forEach(
        (playerData, socketId) => {
          playerData.cash = INITIAL_CASH;
          playerData.bonusPoints = 0;
          playerData.totalAsset = INITIAL_CASH;
          playerData.transactions = [];
          playerData.hints = []; // 힌트 초기화
          // 모든 주식 수량 0으로 초기화
          STOCKS.forEach((stock) => {
            playerData.stocks[stock.id] = 0;
          });

          // 플레이어에게 초기화된 포트폴리오 전송
          const playerSocket =
            io.sockets.sockets.get(socketId);
          if (playerSocket) {
            playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
              cash: playerData.cash,
              stocks: playerData.stocks,
              bonusPoints: 0,
              totalAsset: playerData.totalAsset,
            });
          }
        }
      );

      // 새로 접속한 플레이어를 위한 빈 맵 유지 (기존 데이터는 위에서 초기화됨)
      // 라운드 타이머 시작
      startRoundTimer();
      broadcastGameState();
      broadcastPlayerList();
      console.log(
        '연습 게임 시작 (모든 플레이어 데이터 초기화)'
      );
    }
  });

  // 관리자: 실제 게임 시작 (연습에서 전환)
  socket.on('ADMIN_START_REAL_GAME', () => {
    console.log('[ADMIN_START_REAL_GAME] 이벤트 수신');
    console.log('  - socket.id:', socket.id);
    console.log(
      '  - adminSockets.has(socket):',
      adminSockets.has(socket)
    );
    console.log(
      '  - adminSockets.size:',
      adminSockets.size
    );
    console.log(
      '  - adminSockets 목록:',
      Array.from(adminSockets).map((s) => s.id)
    );
    if (adminSockets.has(socket)) {
      console.log(
        '[ADMIN_START_REAL_GAME] 실제 게임 시작 처리 중...'
      );
      gameState.isPracticeMode = false;
      gameState.isGameStarted = true;
      gameState.isWaitingMode = false;
      gameState.currentRound = 0;
      // 가격 초기화
      STOCKS.forEach((stock) => {
        gameState.stockPrices[stock.id] = [stock.basePrice];
      });
      gameState.currentNews =
        gameState.scenarios[0].headline;
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
        const playerSocket =
          io.sockets.sockets.get(socketId);
        if (playerSocket) {
          playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
            cash: playerData.cash,
            stocks: playerData.stocks,
            bonusPoints: 0,
            totalAsset: playerData.totalAsset,
          });
        }
      });

      // 라운드 타이머 시작
      startRoundTimer();
      broadcastGameState();
      broadcastPlayerList();
      console.log(
        '[ADMIN_START_REAL_GAME] 실제 게임 시작 완료, isGameStarted:',
        gameState.isGameStarted,
        'isWaitingMode:',
        gameState.isWaitingMode,
        'connectedPlayers:',
        connectedPlayers.size
      );
    } else {
      console.log(
        '[ADMIN_START_REAL_GAME] 관리자 인증되지 않음'
      );
    }
  });

  // 관리자: 게임 시작 (기존 호환성 유지)
  socket.on('ADMIN_START_GAME', () => {
    console.log('[ADMIN_START_GAME] 이벤트 수신');
    console.log('  - socket.id:', socket.id);
    console.log(
      '  - adminSockets.has(socket):',
      adminSockets.has(socket)
    );
    console.log(
      '  - adminSockets.size:',
      adminSockets.size
    );
    console.log(
      '  - isPracticeMode:',
      gameState.isPracticeMode
    );
    if (adminSockets.has(socket)) {
      // 연습 모드가 아니면 실제 게임 시작
      if (!gameState.isPracticeMode) {
        console.log(
          '[ADMIN_START_GAME] 실제 게임 시작 처리 중...'
        );
        gameState.isGameStarted = true;
        gameState.isWaitingMode = false;
        gameState.currentRound = 0;
        // 가격 초기화
        STOCKS.forEach((stock) => {
          gameState.stockPrices[stock.id] = [
            stock.basePrice,
          ];
        });
        gameState.currentNews =
          gameState.scenarios[0].headline;

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
          const playerSocket =
            io.sockets.sockets.get(socketId);
          if (playerSocket) {
            playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
              cash: playerData.cash,
              stocks: playerData.stocks,
              bonusPoints: 0,
              totalAsset: playerData.totalAsset,
            });
          }
        });

        // 라운드 타이머 시작
        startRoundTimer();
        broadcastGameState();
        broadcastPlayerList();
        console.log(
          '[ADMIN_START_GAME] 게임 시작 완료, isGameStarted:',
          gameState.isGameStarted,
          'isWaitingMode:',
          gameState.isWaitingMode
        );
      } else {
        console.log(
          '[ADMIN_START_GAME] 연습 모드이므로 게임 시작 불가'
        );
      }
    } else {
      console.log(
        '[ADMIN_START_GAME] 관리자 인증되지 않음'
      );
    }
  });

  // 관리자: 다음 라운드
  socket.on('ADMIN_NEXT_ROUND', () => {
    if (
      adminSockets.has(socket) &&
      gameState.isGameStarted &&
      !gameState.isWaitingMode
    ) {
      // 기존 카운트다운이 있으면 정리
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }

      // 카운트다운 시작 (3초)
      gameState.countdown = 3;
      io.emit('ROUND_COUNTDOWN', {
        countdown: gameState.countdown,
      });

      countdownInterval = setInterval(() => {
        gameState.countdown--;
        io.emit('ROUND_COUNTDOWN', {
          countdown: gameState.countdown,
        });

        if (gameState.countdown <= 0) {
          clearInterval(countdownInterval);
          countdownInterval = null;
          gameState.countdown = null;

          // 실제 라운드 전환
          const success = calculateNextRoundPrices();
          if (success) {
            // 라운드 타이머 시작 (15분 = 900초)
            startRoundTimer();
            broadcastGameState();
            console.log(
              `라운드 ${gameState.currentRound + 1} 시작`
            );
          } else {
            stopRoundTimer();
            socket.emit('GAME_END');
            console.log('게임 종료');
          }
        }
      }, 1000);
    }
  });

  // 관리자: 이전 라운드
  socket.on('ADMIN_PREVIOUS_ROUND', () => {
    if (
      adminSockets.has(socket) &&
      gameState.currentRound > 0
    ) {
      gameState.currentRound--;
      gameState.currentNews =
        gameState.scenarios[
          gameState.currentRound
        ].headline;
      // 이전 라운드로 이동 시 타이머 리셋
      startRoundTimer();
      broadcastGameState();
      console.log(
        `라운드 ${gameState.currentRound + 1}로 이동`
      );
    }
  });

  // 관리자: 게임 종료
  socket.on('ADMIN_END_GAME', () => {
    if (adminSockets.has(socket)) {
      // 진행 중인 카운트다운 정리
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }

      gameState.isGameStarted = false;
      gameState.isWaitingMode = true;
      gameState.countdown = null;
      gameState.currentRound = 0;
      broadcastGameState();
      io.emit('GAME_END', {
        message:
          '관리자에 의해 게임이 종료되었습니다. 대기 모드로 전환됩니다.',
      });
      console.log('관리자에 의해 게임 종료');
    }
  });

  // 관리자: 게임 설정 업데이트
  socket.on('ADMIN_UPDATE_GAME_SETTINGS', (data) => {
    if (
      adminSockets.has(socket) &&
      !gameState.isGameStarted
    ) {
      const { initialCash, totalRounds } = data;

      if (initialCash !== undefined && initialCash >= 0) {
        INITIAL_CASH = initialCash;
        gameSettings.initialCash = initialCash;
      }

      if (
        totalRounds !== undefined &&
        totalRounds >= 1 &&
        totalRounds <= 20
      ) {
        gameSettings.totalRounds = totalRounds;
        // 시나리오 배열 조정
        if (totalRounds > gameState.scenarios.length) {
          // 라운드 추가
          const lastScenario =
            gameState.scenarios[
              gameState.scenarios.length - 1
            ];
          for (
            let i = gameState.scenarios.length;
            i < totalRounds;
            i++
          ) {
            gameState.scenarios.push({
              ...lastScenario,
              round: i,
              headline: `라운드 ${i + 1} 뉴스`,
              volatility: { ...lastScenario.volatility },
            });
          }
        } else if (
          totalRounds < gameState.scenarios.length
        ) {
          // 라운드 제거
          gameState.scenarios = gameState.scenarios.slice(
            0,
            totalRounds
          );
        }
      }

      // 설정 정보 전송
      socket.emit('GAME_SETTINGS_UPDATE', gameSettings);
      console.log(
        `게임 설정 업데이트: 초기현금=${INITIAL_CASH}, 라운드수=${gameSettings.totalRounds}`
      );
    }
  });

  // 관리자: 게임 설정 요청
  socket.on('ADMIN_REQUEST_GAME_SETTINGS', () => {
    if (adminSockets.has(socket)) {
      socket.emit('GAME_SETTINGS_UPDATE', gameSettings);
    }
  });

  // 관리자: 시나리오 업데이트
  socket.on('ADMIN_UPDATE_SCENARIO', (data) => {
    if (adminSockets.has(socket)) {
      const { round, updates } = data;
      if (gameState.scenarios[round]) {
        gameState.scenarios[round] = {
          ...gameState.scenarios[round],
          ...updates,
        };
        // 가격 재계산
        if (
          round <= gameState.currentRound &&
          updates.volatility
        ) {
          for (
            let r = round;
            r <= gameState.currentRound;
            r++
          ) {
            const scenario = gameState.scenarios[r];
            STOCKS.forEach((stock) => {
              if (r === 0) {
                gameState.stockPrices[stock.id][0] =
                  stock.basePrice;
              } else {
                const prevPrice =
                  gameState.stockPrices[stock.id][r - 1] ||
                  stock.basePrice;
                const changeRate =
                  scenario.volatility[stock.id] / 100;
                gameState.stockPrices[stock.id][r] =
                  prevPrice * (1 + changeRate);
              }
            });
          }
        }
        broadcastGameState();
        console.log(
          `라운드 ${round + 1} 시나리오 업데이트`
        );
      }
    }
  });

  // 플레이어: 주식 매수
  socket.on('PLAYER_BUY_STOCK', (data) => {
    const { stockId, quantity } = data;
    const dataMap = gameState.isPracticeMode
      ? practicePlayersData
      : playersData;
    const playerData = dataMap.get(socket.id);

    if (!playerData) {
      socket.emit('TRANSACTION_ERROR', {
        message: '플레이어 데이터를 찾을 수 없습니다.',
      });
      return;
    }

    const currentPrices = getCurrentPrices();
    const price = currentPrices[stockId];
    const totalCost = price * quantity;

    // cash만 확인 (bonusPoints는 이미 cash에 통합됨)
    if (playerData.cash < totalCost) {
      socket.emit('TRANSACTION_ERROR', {
        message: '현금이 부족합니다.',
      });
      return;
    }

    // 매수 처리: cash에서 차감
    playerData.cash -= totalCost;
    playerData.stocks[stockId] =
      (playerData.stocks[stockId] || 0) + quantity;

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

    // 데이터베이스에 저장
    if (playerData.dbId) {
      const totalAsset = calculatePlayerTotalAsset(
        socket.id,
        gameState.isPracticeMode
      );
      dbHelpers.updatePlayerCashById(
        playerData.dbId,
        playerData.cash,
        totalAsset,
        gameState.isPracticeMode
      );
      dbHelpers.savePlayerStock(
        playerData.dbId,
        stockId,
        playerData.stocks[stockId],
        gameState.isPracticeMode
      );
      dbHelpers.saveTransaction(
        playerData.dbId,
        playerData.nickname,
        'BUY',
        stockId,
        quantity,
        price,
        totalCost,
        null,
        null,
        null,
        null,
        gameState.currentRound,
        null, // 플레이어 직접 거래는 adminId 없음
        gameState.isPracticeMode
      );
    }

    // 거래 로그에 추가 (관리자용)
    transactionLogs.push(transaction);
    // 모든 로그 유지 (제한 없음)

    // 모든 관리자에게 거래 로그 전송
    adminSockets.forEach((adminSocket) => {
      adminSocket.emit(
        'TRANSACTION_LOG_UPDATE',
        transaction
      );
    });

    // 플레이어에게 업데이트 전송
    const totalAsset = calculatePlayerTotalAsset(
      socket.id,
      gameState.isPracticeMode
    );
    playerData.totalAsset = totalAsset;
    socket.emit('PLAYER_PORTFOLIO_UPDATE', {
      cash: playerData.cash,
      stocks: playerData.stocks,
      bonusPoints: 0,
      totalAsset: totalAsset,
    });

    // 관리자에게 플레이어 리스트 업데이트
    broadcastPlayerList();
    const mode = gameState.isPracticeMode
      ? '[연습]'
      : '[실제]';
    console.log(
      `${mode} ${playerData.nickname} 매수: ${stockId} ${quantity}주 (${totalCost}원)`
    );
  });

  // 플레이어: 주식 매도
  socket.on('PLAYER_SELL_STOCK', (data) => {
    const { stockId, quantity } = data;
    const dataMap = gameState.isPracticeMode
      ? practicePlayersData
      : playersData;
    const playerData = dataMap.get(socket.id);

    if (!playerData) {
      socket.emit('TRANSACTION_ERROR', {
        message: '플레이어 데이터를 찾을 수 없습니다.',
      });
      return;
    }

    const currentStockQty = playerData.stocks[stockId] || 0;
    if (currentStockQty < quantity) {
      socket.emit('TRANSACTION_ERROR', {
        message: '보유 주식이 부족합니다.',
      });
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

    // 데이터베이스에 저장
    if (playerData.dbId) {
      const totalAsset = calculatePlayerTotalAsset(
        socket.id,
        gameState.isPracticeMode
      );
      dbHelpers.updatePlayerCashById(
        playerData.dbId,
        playerData.cash,
        totalAsset,
        gameState.isPracticeMode
      );
      dbHelpers.savePlayerStock(
        playerData.dbId,
        stockId,
        playerData.stocks[stockId],
        gameState.isPracticeMode
      );
      dbHelpers.saveTransaction(
        playerData.dbId,
        playerData.nickname,
        'SELL',
        stockId,
        quantity,
        price,
        null,
        totalRevenue,
        null,
        null,
        null,
        gameState.currentRound,
        gameState.isPracticeMode
      );
    }

    // 거래 로그에 추가 (관리자용)
    transactionLogs.push(transaction);
    // 모든 로그 유지 (제한 없음)

    // 모든 관리자에게 거래 로그 전송
    adminSockets.forEach((adminSocket) => {
      adminSocket.emit(
        'TRANSACTION_LOG_UPDATE',
        transaction
      );
    });

    // 플레이어에게 업데이트 전송
    const totalAsset = calculatePlayerTotalAsset(
      socket.id,
      gameState.isPracticeMode
    );
    playerData.totalAsset = totalAsset;
    socket.emit('PLAYER_PORTFOLIO_UPDATE', {
      cash: playerData.cash,
      stocks: playerData.stocks,
      bonusPoints: 0,
      totalAsset: totalAsset,
    });
    socket.emit(
      'PLAYER_HINTS_UPDATE',
      playerData.hints || []
    );

    // 관리자에게 플레이어 리스트 업데이트
    broadcastPlayerList();
    const mode = gameState.isPracticeMode
      ? '[연습]'
      : '[실제]';
    console.log(
      `${mode} ${playerData.nickname} 매도: ${stockId} ${quantity}주 (${totalRevenue}원)`
    );
  });

  // 관리자: 직접 거래 실행
  socket.on('ADMIN_EXECUTE_TRADE', (data) => {
    if (!adminSockets.has(socket)) return;

    // 게임이 시작되지 않았으면 거래 실행 불가
    if (!gameState.isGameStarted) {
      socket.emit('ADMIN_ERROR', {
        message:
          '게임이 시작되지 않았습니다. 게임을 시작한 후 거래를 실행할 수 있습니다.',
      });
      return;
    }

    const { socketId, type, stockId, quantity } = data;
    const dataMap = gameState.isPracticeMode
      ? practicePlayersData
      : playersData;
    const playerData = dataMap.get(socketId);

    if (!playerData) {
      socket.emit('TRADE_EXECUTION_ERROR', {
        message: '플레이어 데이터를 찾을 수 없습니다.',
      });
      return;
    }

    const currentPrices = getCurrentPrices();
    const price = currentPrices[stockId];

    if (type === 'BUY') {
      const totalCost = price * quantity;

      // 현금 확인
      if (playerData.cash < totalCost) {
        socket.emit('TRADE_EXECUTION_ERROR', {
          message: `${playerData.nickname}의 현금이 부족합니다.`,
        });
        return;
      }

      // 매수 처리
      playerData.cash -= totalCost;
      playerData.stocks[stockId] =
        (playerData.stocks[stockId] || 0) + quantity;

      // 거래 기록
      const adminId = adminAuthMap.get(socket.id) || null;
      const transaction = {
        type: 'BUY',
        stockId: stockId,
        quantity: quantity,
        price: price,
        totalCost: totalCost,
        round: gameState.currentRound,
        timestamp: new Date().toISOString(),
        nickname: playerData.nickname,
        adminId: adminId,
      };
      playerData.transactions.push(transaction);
      transactionLogs.push(transaction);

      // 데이터베이스에 저장
      if (playerData.dbId) {
        const totalAsset = calculatePlayerTotalAsset(
          socketId,
          gameState.isPracticeMode
        );
        dbHelpers.updatePlayerCashById(
          playerData.dbId,
          playerData.cash,
          totalAsset,
          gameState.isPracticeMode
        );
        dbHelpers.savePlayerStock(
          playerData.dbId,
          stockId,
          playerData.stocks[stockId],
          gameState.isPracticeMode
        );
        const adminId = adminAuthMap.get(socket.id) || null;
        dbHelpers.saveTransaction(
          playerData.dbId,
          playerData.nickname,
          'BUY',
          stockId,
          quantity,
          price,
          totalCost,
          null,
          null,
          null,
          null,
          gameState.currentRound,
          adminId,
          gameState.isPracticeMode
        );
      }

      // 플레이어에게 업데이트 전송
      const totalAsset = calculatePlayerTotalAsset(
        socketId,
        gameState.isPracticeMode
      );
      playerData.totalAsset = totalAsset;
      const playerSocket = io.sockets.sockets.get(socketId);
      if (playerSocket) {
        playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
          cash: playerData.cash,
          stocks: playerData.stocks,
          bonusPoints: 0,
          totalAsset: totalAsset,
        });

        // 체결 알림 전송 (매수)
        const stock = STOCKS.find((s) => s.id === stockId);
        const stockName = stock ? stock.name : stockId;

        // 매수 평균가 계산
        let averagePrice = price;
        const buyTransactions =
          playerData.transactions.filter(
            (t) => t.type === 'BUY' && t.stockId === stockId
          );
        if (buyTransactions.length > 0) {
          let totalBuyCost = 0;
          let totalBuyQuantity = 0;
          buyTransactions.forEach((t) => {
            totalBuyCost +=
              t.totalCost || t.price * t.quantity;
            totalBuyQuantity += t.quantity;
          });
          if (totalBuyQuantity > 0) {
            averagePrice = totalBuyCost / totalBuyQuantity;
          }
        }

        playerSocket.emit('TRADE_EXECUTED', {
          type: 'BUY',
          stockName: stockName,
          quantity: quantity,
          averagePrice: averagePrice,
        });
      }

      // 관리자에게 거래 로그 전송
      adminSockets.forEach((adminSocket) => {
        adminSocket.emit(
          'TRANSACTION_LOG_UPDATE',
          transaction
        );
      });

      // 관리자에게 플레이어 리스트 업데이트
      broadcastPlayerList();
      const mode = gameState.isPracticeMode
        ? '[연습]'
        : '[실제]';
      console.log(
        `${mode} [관리자 실행] ${playerData.nickname} 매수: ${stockId} ${quantity}주 (${totalCost}원)`
      );
    } else if (type === 'SELL') {
      const currentStockQty =
        playerData.stocks[stockId] || 0;

      // 보유 주식 확인
      if (currentStockQty < quantity) {
        socket.emit('TRADE_EXECUTION_ERROR', {
          message: `${playerData.nickname}의 보유 주식이 부족합니다.`,
        });
        return;
      }

      const totalRevenue = price * quantity;

      // 매도 처리
      playerData.cash += totalRevenue;
      playerData.stocks[stockId] =
        currentStockQty - quantity;

      // 거래 기록
      const adminId = adminAuthMap.get(socket.id) || null;
      const transaction = {
        type: 'SELL',
        stockId: stockId,
        quantity: quantity,
        price: price,
        totalRevenue: totalRevenue,
        round: gameState.currentRound,
        timestamp: new Date().toISOString(),
        nickname: playerData.nickname,
        adminId: adminId,
      };
      playerData.transactions.push(transaction);
      transactionLogs.push(transaction);

      // 데이터베이스에 저장
      if (playerData.dbId) {
        const totalAsset = calculatePlayerTotalAsset(
          socketId,
          gameState.isPracticeMode
        );
        dbHelpers.updatePlayerCashById(
          playerData.dbId,
          playerData.cash,
          totalAsset,
          gameState.isPracticeMode
        );
        dbHelpers.savePlayerStock(
          playerData.dbId,
          stockId,
          playerData.stocks[stockId],
          gameState.isPracticeMode
        );
        const adminId = adminAuthMap.get(socket.id) || null;
        dbHelpers.saveTransaction(
          playerData.dbId,
          playerData.nickname,
          'SELL',
          stockId,
          quantity,
          price,
          null,
          totalRevenue,
          null,
          null,
          null,
          gameState.currentRound,
          adminId,
          gameState.isPracticeMode
        );
      }

      // 플레이어에게 업데이트 전송
      const totalAsset = calculatePlayerTotalAsset(
        socketId,
        gameState.isPracticeMode
      );
      playerData.totalAsset = totalAsset;
      const playerSocket = io.sockets.sockets.get(socketId);
      if (playerSocket) {
        playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
          cash: playerData.cash,
          stocks: playerData.stocks,
          bonusPoints: 0,
          totalAsset: totalAsset,
        });

        // 체결 알림 전송 (매도)
        const stock = STOCKS.find((s) => s.id === stockId);
        const stockName = stock ? stock.name : stockId;

        // 매도 시에는 현재 매도 가격 사용
        playerSocket.emit('TRADE_EXECUTED', {
          type: 'SELL',
          stockName: stockName,
          quantity: quantity,
          averagePrice: price,
        });
      }

      // 관리자에게 거래 로그 전송
      adminSockets.forEach((adminSocket) => {
        adminSocket.emit(
          'TRANSACTION_LOG_UPDATE',
          transaction
        );
      });

      // 관리자에게 플레이어 리스트 업데이트
      broadcastPlayerList();
      const mode = gameState.isPracticeMode
        ? '[연습]'
        : '[실제]';
      console.log(
        `${mode} [관리자 실행] ${playerData.nickname} 매도: ${stockId} ${quantity}주 (${totalRevenue}원)`
      );
    }
  });

  // 관리자: 플레이어에게 포인트 추가
  socket.on('ADMIN_ADD_POINTS', (data) => {
    if (!adminSockets.has(socket)) return;

    // 게임이 시작되지 않았으면 포인트 지급 불가
    if (!gameState.isGameStarted) {
      socket.emit('ADMIN_ERROR', {
        message:
          '게임이 시작되지 않았습니다. 게임을 시작한 후 포인트를 지급할 수 있습니다.',
      });
      return;
    }

    const { socketId, points, source } = data; // source: 'minigame' 또는 undefined
    const dataMap = gameState.isPracticeMode
      ? practicePlayersData
      : playersData;
    const playerData = dataMap.get(socketId);

    if (!playerData) {
      socket.emit('ADMIN_ERROR', {
        message: '플레이어를 찾을 수 없습니다.',
      });
      return;
    }

    // 포인트를 cash에 직접 추가 (현금처럼 사용 가능하도록)
    playerData.cash += points;
    // 기존 bonusPoints가 있으면 cash에 통합
    if (
      playerData.bonusPoints &&
      playerData.bonusPoints > 0
    ) {
      playerData.cash += playerData.bonusPoints;
      playerData.bonusPoints = 0;
    }

    // 데이터베이스에 저장
    if (playerData.dbId) {
      const totalAsset = calculatePlayerTotalAsset(
        socketId,
        gameState.isPracticeMode
      );
      dbHelpers.updatePlayerCashById(
        playerData.dbId,
        playerData.cash,
        totalAsset,
        gameState.isPracticeMode
      );
      const adminId = adminAuthMap.get(socket.id) || null;
      // 미니게임인 경우 MINIGAME_REWARD, 아니면 BONUS_POINTS
      const transactionType =
        source === 'minigame'
          ? 'MINIGAME_REWARD'
          : 'BONUS_POINTS';
      dbHelpers.saveTransaction(
        playerData.dbId,
        playerData.nickname,
        transactionType,
        null,
        null,
        null,
        null,
        null,
        points,
        null,
        null,
        gameState.currentRound,
        adminId,
        gameState.isPracticeMode
      );
    }

    // 포인트 추가 거래 로그 생성
    const adminId = adminAuthMap.get(socket.id) || null;
    // 미니게임인 경우 MINIGAME_REWARD, 아니면 BONUS_POINTS
    const transactionType =
      source === 'minigame'
        ? 'MINIGAME_REWARD'
        : 'BONUS_POINTS';
    const bonusTransaction = {
      type: transactionType,
      stockId: null,
      quantity: null,
      price: null,
      points: points,
      round: gameState.currentRound,
      timestamp: new Date().toISOString(),
      nickname: playerData.nickname,
      adminId: adminId,
    };

    // 거래 로그에 추가 (관리자용)
    transactionLogs.push(bonusTransaction);
    // 모든 로그 유지 (제한 없음)

    // 모든 관리자에게 거래 로그 전송
    adminSockets.forEach((adminSocket) => {
      adminSocket.emit(
        'TRANSACTION_LOG_UPDATE',
        bonusTransaction
      );
    });

    // 플레이어에게 업데이트 전송
    const playerSocket = io.sockets.sockets.get(socketId);
    if (playerSocket) {
      const totalAsset = calculatePlayerTotalAsset(
        socketId,
        gameState.isPracticeMode
      );
      playerData.totalAsset = totalAsset;
      playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
        cash: playerData.cash,
        stocks: playerData.stocks,
        bonusPoints: 0,
        totalAsset: totalAsset,
      });
      // 포인트 추가 알림 전송
      playerSocket.emit('BONUS_POINTS_ADDED', {
        points: points,
        totalBonusPoints: playerData.bonusPoints,
        source: source, // 'minigame' 또는 undefined
        round: gameState.currentRound,
      });
    }

    // 관리자에게 플레이어 리스트 업데이트
    broadcastPlayerList();
    const mode = gameState.isPracticeMode
      ? '[연습]'
      : '[실제]';
    console.log(
      `${mode} ${playerData.nickname}에게 ${points}포인트 추가 (총 ${playerData.bonusPoints}포인트)`
    );
  });

  // 관리자: 힌트 부여
  socket.on('ADMIN_GRANT_HINT', (data) => {
    if (!adminSockets.has(socket)) return;

    // 게임이 시작되지 않았으면 힌트 부여 불가
    if (!gameState.isGameStarted) {
      socket.emit('ADMIN_ERROR', {
        message:
          '게임이 시작되지 않았습니다. 게임을 시작한 후 힌트를 부여할 수 있습니다.',
      });
      return;
    }

    const { socketId, difficulty, price, hintContent } =
      data;
    const dataMap = gameState.isPracticeMode
      ? practicePlayersData
      : playersData;
    const playerData = dataMap.get(socketId);

    if (!playerData) {
      socket.emit('ADMIN_ERROR', {
        message: '플레이어를 찾을 수 없습니다.',
      });
      return;
    }

    const priceNum = parseInt(price);
    if (isNaN(priceNum) || priceNum < 0) {
      socket.emit('ADMIN_ERROR', {
        message: '올바른 금액을 입력해주세요.',
      });
      return;
    }

    const totalCash =
      playerData.cash + (playerData.bonusPoints || 0);
    if (totalCash < priceNum) {
      socket.emit('ADMIN_ERROR', {
        message: '플레이어의 현금이 부족합니다.',
      });
      return;
    }

    // 현금 차감
    playerData.cash -= priceNum;
    if (
      playerData.bonusPoints &&
      playerData.bonusPoints > 0
    ) {
      if (playerData.bonusPoints >= priceNum) {
        playerData.bonusPoints -= priceNum;
      } else {
        const remaining = priceNum - playerData.bonusPoints;
        playerData.bonusPoints = 0;
        playerData.cash -= remaining;
      }
    }

    // 힌트 부여
    const hint = {
      difficulty: difficulty,
      content:
        hintContent ||
        `[${difficulty}급 힌트] 힌트 내용이 아직 없습니다.`,
      receivedAt: new Date().toISOString(),
      price: priceNum,
      round: gameState.currentRound, // 현재 라운드 정보 추가
    };

    if (!playerData.hints) {
      playerData.hints = [];
    }
    playerData.hints.push(hint);

    // 데이터베이스에 힌트 저장
    if (playerData.dbId) {
      dbHelpers.saveHint(
        playerData.dbId,
        difficulty,
        hintContent ||
          `[${difficulty}급 힌트] 힌트 내용이 아직 없습니다.`,
        priceNum,
        gameState.currentRound,
        gameState.isPracticeMode
      );

      const totalAsset = calculatePlayerTotalAsset(
        socketId,
        gameState.isPracticeMode
      );
      dbHelpers.updatePlayerCashById(
        playerData.dbId,
        playerData.cash,
        totalAsset,
        gameState.isPracticeMode
      );
      const adminId = adminAuthMap.get(socket.id) || null;
      dbHelpers.saveTransaction(
        playerData.dbId,
        playerData.nickname,
        'HINT_PURCHASE',
        null,
        null,
        null,
        null,
        null,
        null,
        difficulty,
        priceNum,
        gameState.currentRound,
        adminId,
        gameState.isPracticeMode
      );
    }

    // 힌트 구매 거래 로그 생성
    const adminId = adminAuthMap.get(socket.id) || null;
    const hintTransaction = {
      type: 'HINT_PURCHASE',
      stockId: null,
      quantity: null,
      price: null,
      difficulty: difficulty,
      hintPrice: priceNum,
      round: gameState.currentRound,
      timestamp: new Date().toISOString(),
      nickname: playerData.nickname,
      adminId: adminId,
    };

    // 거래 로그에 추가 (관리자용)
    transactionLogs.push(hintTransaction);

    // 모든 관리자에게 거래 로그 전송
    adminSockets.forEach((adminSocket) => {
      adminSocket.emit(
        'TRANSACTION_LOG_UPDATE',
        hintTransaction
      );
    });

    // 플레이어에게 힌트 업데이트 전송
    const playerSocket = io.sockets.sockets.get(socketId);
    if (playerSocket) {
      const totalAsset = calculatePlayerTotalAsset(
        socketId,
        gameState.isPracticeMode
      );
      playerData.totalAsset = totalAsset;
      playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
        cash: playerData.cash,
        stocks: playerData.stocks,
        bonusPoints: 0,
        totalAsset: totalAsset,
      });
      playerSocket.emit(
        'PLAYER_HINTS_UPDATE',
        playerData.hints || []
      );
      console.log(
        `힌트 업데이트 전송: ${playerData.nickname}에게 ${
          playerData.hints?.length || 0
        }개의 힌트 전송`
      );
    } else {
      console.log(
        `플레이어 소켓을 찾을 수 없음: socketId=${socketId}, nickname=${
          playerData?.nickname || '알 수 없음'
        }`
      );
    }

    // 관리자에게 플레이어 리스트 업데이트
    broadcastPlayerList();

    const mode = gameState.isPracticeMode
      ? '[연습]'
      : '[실제]';
    console.log(
      `${mode} ${playerData.nickname}에게 ${difficulty}급 힌트 부여 (₩${priceNum})`
    );
  });

  // 관리자: 플레이어 리스트 요청
  socket.on('ADMIN_REQUEST_PLAYER_LIST', () => {
    console.log(
      `[ADMIN_REQUEST_PLAYER_LIST] 요청 수신 - socket.id: ${socket.id}, 인증됨: ${adminSockets.has(socket)}`
    );
    if (adminSockets.has(socket)) {
      broadcastPlayerList();
    } else {
      console.log(
        `[ADMIN_REQUEST_PLAYER_LIST] 관리자 인증되지 않음 - socket.id: ${socket.id}`
      );
    }
  });

  // 관리자: 플레이어 강제 로그아웃
  socket.on('ADMIN_KICK_PLAYER', (data) => {
    if (!adminSockets.has(socket)) return;

    const { socketId } = data;
    const dataMap = gameState.isPracticeMode
      ? practicePlayersData
      : playersData;
    const playerData = dataMap.get(socketId);

    if (!playerData) {
      socket.emit('ADMIN_ERROR', {
        message: '플레이어를 찾을 수 없습니다.',
      });
      return;
    }

    // 플레이어 소켓 찾기
    const playerSocket = io.sockets.sockets.get(socketId);
    if (playerSocket) {
      playerSocket.emit('ADMIN_KICK', {
        message: '관리자에 의해 로그아웃되었습니다.',
      });
      playerSocket.disconnect();
      console.log(
        `관리자에 의해 플레이어 로그아웃: ${playerData.nickname} (socket: ${socketId})`
      );
    }

    // 플레이어 연결만 끊기 (데이터는 유지 - 재로그인 가능)
    connectedPlayers.delete(socketId);
    // 메모리에서도 제거하지만, 데이터베이스에는 남아있어서 재로그인 시 복구됨
    dataMap.delete(socketId);

    console.log(
      `플레이어 로그아웃: ${playerData.nickname} (socket: ${socketId}) - 데이터베이스에는 유지되어 재로그인 가능`
    );

    // 관리자에게 플레이어 리스트 업데이트 (즉시)
    if (adminSockets.size > 0) {
      adminSockets.forEach((adminSocket) => {
        adminSocket.emit(
          'PLAYER_COUNT_UPDATE',
          connectedPlayers.size
        );
      });
      // 즉시 리스트 업데이트
      broadcastPlayerList();
    }
  });

  // 관리자: 플레이어 데이터 삭제
  socket.on('ADMIN_DELETE_PLAYER', (data) => {
    console.log(
      '[서버] ADMIN_DELETE_PLAYER 이벤트 수신:',
      data
    );
    if (!adminSockets.has(socket)) {
      console.log(
        '[서버] 관리자가 아닌 소켓에서 삭제 요청'
      );
      return;
    }

    const { socketId } = data;
    console.log('[서버] 삭제 대상 socketId:', socketId);
    const dataMap = gameState.isPracticeMode
      ? practicePlayersData
      : playersData;
    const playerData = dataMap.get(socketId);

    if (!playerData) {
      console.log(
        '[서버] 플레이어 데이터를 찾을 수 없음:',
        socketId
      );
      socket.emit('ADMIN_ERROR', {
        message: '플레이어를 찾을 수 없습니다.',
      });
      return;
    }

    console.log(
      '[서버] 플레이어 데이터 찾음:',
      playerData.nickname,
      'dbId:',
      playerData.dbId
    );

    // 플레이어 소켓이 있으면 연결 끊기
    const playerSocket = io.sockets.sockets.get(socketId);
    if (playerSocket) {
      playerSocket.emit('ADMIN_DELETE', {
        message: '관리자에 의해 계정이 삭제되었습니다.',
      });
      playerSocket.disconnect();
    }

    // 데이터베이스에서 완전 삭제 (재로그인 불가)
    if (playerData.dbId) {
      dbHelpers.deletePlayer(
        playerData.dbId,
        gameState.isPracticeMode
      );
      console.log(
        `플레이어 데이터 완전 삭제: ${playerData.nickname} (ID: ${playerData.dbId}) - 재로그인 불가`
      );
    }

    // 메모리에서 데이터 정리
    connectedPlayers.delete(socketId);
    dataMap.delete(socketId);

    console.log(
      `플레이어 삭제 완료: ${playerData.nickname}, 남은 플레이어: ${dataMap.size}명`
    );

    // 관리자에게 플레이어 리스트 업데이트 (즉시)
    if (adminSockets.size > 0) {
      adminSockets.forEach((adminSocket) => {
        adminSocket.emit(
          'PLAYER_COUNT_UPDATE',
          connectedPlayers.size
        );
      });
      // 즉시 리스트 업데이트
      broadcastPlayerList();
    }

    const mode = gameState.isPracticeMode
      ? '[연습]'
      : '[실제]';
    console.log(
      `${mode} 플레이어 삭제 완료: ${playerData.nickname}`
    );
  });

  // 관리자: 운영자 계정 목록 요청
  socket.on('ADMIN_GET_ADMINS', () => {
    if (!adminSockets.has(socket)) return;
    const admins = dbHelpers.getAllAdmins();
    socket.emit('ADMINS_LIST_UPDATE', admins);
  });

  // 관리자: 운영자 계정 생성
  socket.on('ADMIN_CREATE_ADMIN', (data) => {
    if (!adminSockets.has(socket)) return;
    const { adminId, password } = data;
    if (!adminId || !password) {
      socket.emit('ADMIN_ERROR', {
        message: 'ID와 비밀번호를 입력해주세요.',
      });
      return;
    }
    try {
      dbHelpers.createAdmin(adminId, password);
      const admins = dbHelpers.getAllAdmins();
      adminSockets.forEach((adminSocket) => {
        adminSocket.emit('ADMINS_LIST_UPDATE', admins);
      });
      socket.emit('ADMIN_ACTION_SUCCESS', {
        message: '운영자 계정이 생성되었습니다.',
      });
    } catch (error) {
      socket.emit('ADMIN_ERROR', {
        message:
          error.message ||
          '운영자 계정 생성에 실패했습니다.',
      });
    }
  });

  // 관리자: 운영자 비밀번호 변경
  socket.on('ADMIN_UPDATE_ADMIN_PASSWORD', (data) => {
    if (!adminSockets.has(socket)) return;
    const { adminId, newPassword } = data; // adminId는 숫자 ID (admin.id)
    if (!adminId || !newPassword) {
      socket.emit('ADMIN_ERROR', {
        message: 'ID와 새 비밀번호를 입력해주세요.',
      });
      return;
    }
    try {
      dbHelpers.updateAdminPassword(adminId, newPassword);
      socket.emit('ADMIN_ACTION_SUCCESS', {
        message: '비밀번호가 변경되었습니다.',
      });
    } catch (error) {
      socket.emit('ADMIN_ERROR', {
        message:
          error.message || '비밀번호 변경에 실패했습니다.',
      });
    }
  });

  // 관리자: 운영자 계정 삭제
  socket.on('ADMIN_DELETE_ADMIN', (data) => {
    if (!adminSockets.has(socket)) return;
    const { adminId } = data; // adminId는 숫자 ID (admin.id)
    if (!adminId) {
      socket.emit('ADMIN_ERROR', {
        message: '운영자 ID를 입력해주세요.',
      });
      return;
    }
    try {
      dbHelpers.deleteAdmin(adminId);
      const admins = dbHelpers.getAllAdmins();
      adminSockets.forEach((adminSocket) => {
        adminSocket.emit('ADMINS_LIST_UPDATE', admins);
      });
      socket.emit('ADMIN_ACTION_SUCCESS', {
        message: '운영자 계정이 삭제되었습니다.',
      });
    } catch (error) {
      socket.emit('ADMIN_ERROR', {
        message:
          error.message ||
          '운영자 계정 삭제에 실패했습니다.',
      });
    }
  });

  // 연결 해제
  socket.on('disconnect', () => {
    const totalConnections = io.sockets.sockets.size;
    if (adminSockets.has(socket)) {
      adminSockets.delete(socket);
      adminAuthMap.delete(socket.id); // 관리자 인증 정보도 제거
      console.log(
        `관리자 연결 해제: ${socket.id} (총 ${totalConnections}개 연결, 남은 관리자: ${adminSockets.size}명)`
      );
    } else {
      connectedPlayers.delete(socket.id);
      // 플레이어 데이터는 유지 (재접속 시 사용)
      // 같은 닉네임으로 재접속하면 기존 데이터를 재사용하므로 삭제하지 않음
      // playersData.delete(socket.id); // 필요시 주석 해제
      if (adminSockets.size > 0) {
        adminSockets.forEach((adminSocket) => {
          adminSocket.emit(
            'PLAYER_COUNT_UPDATE',
            connectedPlayers.size
          );
        });
        broadcastPlayerList();
      }
      const nickname = socket.nickname || '알 수 없음';
      console.log(
        `플레이어 연결 해제: ${nickname} (socket: ${socket.id}, 접속 플레이어: ${connectedPlayers.size}명, 총 연결: ${totalConnections}개)`
      );
    }
  });
});

// 서버 종료 시 데이터베이스 닫기
process.on('SIGINT', () => {
  console.log('\n서버 종료 중...');
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n서버 종료 중...');
  closeDb();
  process.exit(0);
});

const PORT = process.env.PORT || 3001;
// 모든 네트워크 인터페이스에 바인딩 (0.0.0.0)
httpServer.listen(PORT, '0.0.0.0', () => {
  // 로컬 IP 주소 가져오기
  const networkInterfaces = os.networkInterfaces();
  let localIP = 'localhost';

  for (const interfaceName of Object.keys(
    networkInterfaces
  )) {
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
  console.log(
    `📡 네트워크 주소: http://${localIP}:${PORT}`
  );
  console.log(
    `👨‍💼 관리자 페이지 (로컬): http://localhost:5173/admin`
  );
  console.log(
    `👨‍💼 관리자 페이지 (네트워크): http://${localIP}:5173/admin`
  );
  console.log(
    `👥 플레이어 페이지 (로컬): http://localhost:5173/player`
  );
  console.log(
    `👥 플레이어 페이지 (네트워크): http://${localIP}:5173/player`
  );
  console.log('='.repeat(50));
  console.log(
    '💡 다른 기기에서 접속하려면 네트워크 주소를 사용하세요!'
  );
  console.log('='.repeat(50));
});
