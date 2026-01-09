import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import {
  STOCKS,
  initialScenarios,
  PRACTICE_STOCKS,
  practiceScenarios,
} from './src/data/initialScenarios.js';
import { dbHelpers, closeDb, createGameId } from './db.js';

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
  currentNewsBriefing: [], // 뉴스 브리핑 배열
  isGameStarted: false,
  isGameEnded: false, // 게임 종료 상태
  isPracticeMode: false,
  isWaitingMode: true, // 대기 모드 (게임 시작 전)
  scenarios: initialScenarios,
  countdown: null, // 라운드 전환 카운트다운 (초 단위)
  roundTimer: null, // 라운드 타이머 (초 단위, 15분 = 900초)
  allowPlayerTrading: false, // 플레이어 직접 거래 허용 여부 (기본값: false, 관리자가 활성화 가능)
  isTradingBlocked: false, // 미니게임 진행 중 투자 차단 여부 (기본값: false, 미니게임 운영자가 설정)
  isLastRound: false, // 마지막 라운드 플래그 (뉴스 표시 후 게임 종료)
  gameId: null, // 현재 게임 고유 ID
};

// 기본 게임 설정 (복원 로직에서 사용되므로 최상단에 배치)
let INITIAL_CASH = 3000000; // 게임 설정에서 변경 가능 (3,000,000 포인트)
let gameSettings = {
  initialCash: INITIAL_CASH,
  totalRounds: initialScenarios.length,
};
// 서버 재시작 시 자동 재개 여부 (기본: 재개하지 않음)
const RESUME_ON_RESTART =
  process.env.RESUME_ON_RESTART === 'true';

// 초기 가격 설정 (실제 게임용)
STOCKS.forEach((stock) => {
  gameState.stockPrices[stock.id] = [stock.basePrice];
});
// 연습 게임용 초기 가격 설정 (3개 주식)
PRACTICE_STOCKS.forEach((stock) => {
  gameState.stockPrices[stock.id] = [stock.basePrice];
});
console.log(
  `[초기화] 연습 게임 주식 가격 설정: ${PRACTICE_STOCKS.map(
    (s) => `${s.id} = [${s.basePrice}]`
  ).join(', ')}`
);

function normalizeStockPriceHistory(stockList) {
  stockList.forEach((stock) => {
    const history = gameState.stockPrices[stock.id];
    if (!Array.isArray(history) || history.length === 0) {
      gameState.stockPrices[stock.id] = [stock.basePrice];
      return;
    }
    if (
      history[0] === undefined ||
      history[0] === null ||
      Number.isNaN(history[0])
    ) {
      gameState.stockPrices[stock.id][0] = stock.basePrice;
    }
  });
}

function applySavedGameState(saved) {
  if (
    !saved ||
    !saved.state ||
    typeof saved.state !== 'object'
  ) {
    return false;
  }
  const state = saved.state;

  if (state.gameId || saved.gameId) {
    gameState.gameId = state.gameId || saved.gameId;
  }
  if (Number.isInteger(state.currentRound)) {
    gameState.currentRound = state.currentRound;
  }
  if (
    state.stockPrices &&
    typeof state.stockPrices === 'object'
  ) {
    gameState.stockPrices = state.stockPrices;
  }
  if (typeof state.currentNews === 'string') {
    gameState.currentNews = state.currentNews;
  }
  if (Array.isArray(state.currentNewsBriefing)) {
    gameState.currentNewsBriefing =
      state.currentNewsBriefing;
  }
  if (state.isGameStarted !== undefined) {
    gameState.isGameStarted = Boolean(state.isGameStarted);
  }
  if (state.isGameEnded !== undefined) {
    gameState.isGameEnded = Boolean(state.isGameEnded);
  }
  if (state.isPracticeMode !== undefined) {
    gameState.isPracticeMode = Boolean(
      state.isPracticeMode
    );
  }
  if (state.isWaitingMode !== undefined) {
    gameState.isWaitingMode = Boolean(state.isWaitingMode);
  }
  if (state.countdown !== undefined) {
    gameState.countdown = state.countdown;
  }
  if (state.roundTimer !== undefined) {
    gameState.roundTimer = state.roundTimer;
  }
  if (state.allowPlayerTrading !== undefined) {
    gameState.allowPlayerTrading = Boolean(
      state.allowPlayerTrading
    );
  }
  if (state.isTradingBlocked !== undefined) {
    gameState.isTradingBlocked = Boolean(
      state.isTradingBlocked
    );
  }
  if (state.isLastRound !== undefined) {
    gameState.isLastRound = Boolean(state.isLastRound);
  }

  gameState.scenarios = gameState.isPracticeMode
    ? practiceScenarios
    : initialScenarios;
  gameSettings.totalRounds = gameState.scenarios.length;

  // 재시작 시 자동 재개를 막고 대기 상태로 초기화 (env로 활성화 가능)
  if (!RESUME_ON_RESTART) {
    gameState.isGameStarted = false;
    gameState.isGameEnded = false;
    gameState.isWaitingMode = true;
    gameState.currentRound = 0;
    gameState.currentNews = '';
    gameState.currentNewsBriefing = [];
    gameState.countdown = null;
    gameState.roundTimer = null;
    gameState.allowPlayerTrading = false;
    gameState.isTradingBlocked = false;
    gameState.isLastRound = false;
    gameState.gameId = null;
  }

  normalizeStockPriceHistory(STOCKS);
  normalizeStockPriceHistory(PRACTICE_STOCKS);
  return true;
}

const savedGameState = dbHelpers.getLatestGameState();
if (applySavedGameState(savedGameState)) {
  console.log(
    `[초기화] 저장된 게임 상태 복원 완료 (gameId: ${gameState.gameId}, updatedAt: ${savedGameState.updatedAt})`
  );
}

// 연결된 플레이어 수 추적
let connectedPlayers = new Set();
let practiceConnectedPlayers = new Set(); // 연습 모드 연결된 플레이어 (하위 호환성)
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
// 플레이어별 투자 차단 상태 관리 (socketId -> { isBlocked: boolean, rewardAmount: number | null })
const playerTradingBlocked = new Map(); // { socketId: { isBlocked: true, rewardAmount: 50000 } }

// 가격 계산 함수 (서버에서 실행하여 모든 클라이언트가 동일한 가격을 받음)
function calculateNextRoundPrices() {
  const scenarios = gameState.scenarios;
  const maxRounds = scenarios.length;

  // 마지막 라운드인지 확인
  const isLastRound =
    gameState.currentRound >= maxRounds - 1;

  if (isLastRound) {
    // 마지막 라운드의 뉴스를 먼저 설정
    const lastRoundIndex = gameState.isPracticeMode
      ? gameState.currentRound - 1 // 연습 모드: 라운드 3 → scenarios[2]
      : gameState.currentRound - 1; // 실제 모드: 라운드 9 → scenarios[8] (12월)

    const lastScenario = scenarios[lastRoundIndex];
    if (lastScenario && lastScenario.headline) {
      gameState.currentNews = lastScenario.headline;
      gameState.currentNewsBriefing =
        lastScenario.newsBriefing || [];
      gameState.isLastRound = true; // 마지막 라운드 플래그 설정
      console.log(
        `[calculateNextRoundPrices] 마지막 라운드 뉴스 설정 - currentRound: ${gameState.currentRound}, scenarioIndex: ${lastRoundIndex}, headline: ${lastScenario.headline}`
      );
    }
    return false; // 게임 종료 (하지만 뉴스는 먼저 표시)
  }

  const nextRound = gameState.currentRound + 1;
  gameState.isLastRound = false; // 마지막 라운드 플래그 해제

  // 연습 모드일 때는 라운드 번호와 시나리오 인덱스 매핑 조정
  // 라운드 1 → scenarios[0] (12월), 라운드 2 → scenarios[1] (1월), 라운드 3 → scenarios[2] (2월)
  let scenarioIndex;
  if (gameState.isPracticeMode) {
    // 연습 모드: 라운드 1부터 시작하므로 nextRound - 1을 사용
    // nextRound = 1 → scenarioIndex = 0 (12월)
    // nextRound = 2 → scenarioIndex = 1 (1월)
    // nextRound = 3 → scenarioIndex = 2 (2월)
    scenarioIndex = nextRound >= 1 ? nextRound - 1 : 0;
  } else {
    // 실제 게임 모드: 라운드 1 → scenarios[0], 라운드 2 → scenarios[1], ...
    // nextRound = 1 → scenarioIndex = 0 (1~2월)
    // nextRound = 2 → scenarioIndex = 1 (3~4월)
    // nextRound = 9 → scenarioIndex = 8 (12월)
    scenarioIndex = nextRound >= 1 ? nextRound - 1 : 0;
  }

  const scenario = scenarios[scenarioIndex];

  console.log(
    `[calculateNextRoundPrices] 라운드 진행 - currentRound: ${gameState.currentRound}, nextRound: ${nextRound}, scenarioIndex: ${scenarioIndex}, scenarios.length: ${scenarios.length}, isPracticeMode: ${gameState.isPracticeMode}`
  );

  // 시나리오가 없으면 오류 로그 출력
  if (!scenario) {
    console.error(
      `[calculateNextRoundPrices] 시나리오를 찾을 수 없음 - nextRound: ${nextRound}, scenarioIndex: ${scenarioIndex}, scenarios.length: ${scenarios.length}, isPracticeMode: ${gameState.isPracticeMode}`
    );
    return false;
  }

  console.log(
    `[calculateNextRoundPrices] 시나리오 로드 - headline: ${scenario.headline}, month: ${scenario.month}`
  );

  // 연습 모드일 때는 연습용 주식들(PRACTICE_STOCKS) 처리
  if (gameState.isPracticeMode) {
    PRACTICE_STOCKS.forEach((stock) => {
      const currentPrice =
        gameState.stockPrices[stock.id]?.[
          gameState.currentRound
        ] || stock.basePrice;
      const changeRate =
        scenario.volatility[stock.id] / 100;
      const newPrice = currentPrice * (1 + changeRate);

      if (!gameState.stockPrices[stock.id]) {
        gameState.stockPrices[stock.id] = [];
      }
      if (!gameState.stockPrices[stock.id][nextRound]) {
        gameState.stockPrices[stock.id][nextRound] =
          newPrice;
      } else {
        gameState.stockPrices[stock.id][nextRound] =
          newPrice;
      }
    });
  } else {
    // 실제 게임 모드: 모든 종목 처리
    STOCKS.forEach((stock) => {
      const currentPrice =
        gameState.stockPrices[stock.id]?.[
          gameState.currentRound
        ] || stock.basePrice;
      const changeRate =
        scenario.volatility[stock.id] / 100;
      const newPrice = currentPrice * (1 + changeRate);

      if (!gameState.stockPrices[stock.id]) {
        gameState.stockPrices[stock.id] = [];
      }
      if (!gameState.stockPrices[stock.id][nextRound]) {
        gameState.stockPrices[stock.id][nextRound] =
          newPrice;
      } else {
        gameState.stockPrices[stock.id][nextRound] =
          newPrice;
      }
    });
  }

  gameState.currentRound = nextRound;
  // 0라운드에서는 뉴스를 표시하지 않음 (1라운드부터 뉴스 표시)
  if (nextRound === 0) {
    gameState.currentNews = '';
    gameState.currentNewsBriefing = [];
  } else {
    // 시나리오가 있으면 뉴스 설정
    if (scenario && scenario.headline) {
      gameState.currentNews = scenario.headline;
      gameState.currentNewsBriefing =
        scenario.newsBriefing || [];
      console.log(
        `[calculateNextRoundPrices] 뉴스 설정 - nextRound: ${nextRound}, scenarioIndex: ${scenarioIndex}, headline: ${scenario.headline}, isPracticeMode: ${gameState.isPracticeMode}`
      );
    } else {
      console.error(
        `[calculateNextRoundPrices] 시나리오 또는 headline이 없음 - nextRound: ${nextRound}, scenarioIndex: ${scenarioIndex}, scenario:`,
        scenario
      );
      gameState.currentNews = '';
      gameState.currentNewsBriefing = [];
    }
  }

  return true;
}

// 게임 종료 처리 함수 (자동 매도 및 상태 설정)
function handleGameEnd() {
  // 게임 종료 전 모든 주식 자동 매도
  const dataMap = gameState.isPracticeMode
    ? practicePlayersData
    : playersData;

  const currentPrices = getCurrentPrices();
  const stocksToSell = gameState.isPracticeMode
    ? PRACTICE_STOCKS
    : STOCKS;

  dataMap.forEach((playerData, socketId) => {
    // 모든 주식 자동 매도
    stocksToSell.forEach((stock) => {
      const qty = playerData.stocks[stock.id] || 0;
      if (qty > 0) {
        const price =
          currentPrices[stock.id] || stock.basePrice;
        const totalValue = qty * price;

        // 현금에 매도 금액 추가
        playerData.cash += totalValue;

        // 거래 내역 기록
        const sellTransaction = {
          type: 'SELL',
          stockId: stock.id,
          stockName: stock.name,
          quantity: qty,
          price: price,
          totalCost: totalValue,
          timestamp: new Date().toISOString(),
          round: gameState.currentRound,
          isAutoSell: true, // 자동 매도 표시
        };

        if (!playerData.transactions) {
          playerData.transactions = [];
        }
        playerData.transactions.push(sellTransaction);

        // 주식 수량 0으로 설정
        playerData.stocks[stock.id] = 0;

        // 데이터베이스 업데이트
        if (playerData.dbId) {
          try {
            // 현금 업데이트
            const newTotalAsset = calculatePlayerTotalAsset(
              socketId,
              gameState.isPracticeMode
            );
            dbHelpers.updatePlayerCashById(
              playerData.dbId,
              playerData.cash,
              newTotalAsset,
              gameState.isPracticeMode
            );

            // 주식 수량 업데이트
            const currentGameId =
              gameState.gameId || 'legacy';
            dbHelpers.savePlayerStock(
              currentGameId,
              playerData.dbId,
              stock.id,
              0,
              gameState.isPracticeMode
            );

            // 거래 내역 저장
            dbHelpers.saveTransaction(
              currentGameId,
              playerData.dbId,
              playerData.nickname,
              'SELL',
              stock.id,
              qty,
              price,
              totalValue,
              0,
              0,
              null,
              null,
              gameState.currentRound,
              null,
              gameState.isPracticeMode
            );
          } catch (error) {
            console.error(
              `[게임 종료] 자동 매도 DB 저장 오류: ${playerData.nickname} - ${stock.name}`,
              error
            );
          }
        }

        console.log(
          `[게임 종료] 자동 매도: ${
            playerData.nickname
          } - ${
            stock.name
          } ${qty}주 @ ${price.toLocaleString()}원 = ${totalValue.toLocaleString()}원`
        );
      }
    });

    // 총 자산 재계산
    playerData.totalAsset = calculatePlayerTotalAsset(
      socketId,
      gameState.isPracticeMode
    );

    // 플레이어에게 포트폴리오 업데이트 전송
    const playerSocket = io.sockets.sockets.get(socketId);
    if (playerSocket) {
      playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
        cash: playerData.cash,
        stocks: playerData.stocks,
        bonusPoints: 0,
        totalAsset: playerData.totalAsset,
      });
    }
  });

  // 게임 종료 상태 설정
  gameState.isGameEnded = true;
  gameState.isGameStarted = false;
  gameState.isWaitingMode = true;
  gameState.allowPlayerTrading = false;
  gameState.isLastRound = false; // 마지막 라운드 플래그 해제

  dbHelpers.markGameEnded(gameState.gameId);
  persistGameState({ force: true });

  // 최종 순위 계산 및 브로드캐스트 (자동 매도 후 최종 자산 반영)
  broadcastGameState();
  io.emit('GAME_END', {
    message: '게임이 종료되었습니다.',
  });
  console.log('게임 종료 (모든 주식 자동 매도 완료)');

  // 거래 내역도 삭제 (게임 종료 시) - 현재 게임만
  try {
    const currentGameId = gameState.gameId || 'legacy';
    const deletedCount = dbHelpers.clearAllTransactions(
      currentGameId,
      gameState.isPracticeMode
    );
    console.log(
      `[게임 종료] 거래 내역 삭제 완료: ${deletedCount}개`
    );
    // 메모리의 거래로그도 초기화
    transactionLogs.length = 0;
    // 관리자에게 거래로그 리스트 업데이트 (빈 배열 전송)
    adminSockets.forEach((adminSocket) => {
      adminSocket.emit('TRANSACTION_LOGS_INIT', []);
      adminSocket.emit('TRANSACTION_LOGS_UPDATE', []);
    });
  } catch (error) {
    console.error(
      '[게임 종료] 거래 내역 삭제 중 오류:',
      error
    );
  }
}

// 현재 가격 가져오기
function getCurrentPrices() {
  const prices = {};
  // 연습 모드일 때는 PRACTICE_STOCKS 포함
  if (gameState.isPracticeMode) {
    PRACTICE_STOCKS.forEach((stock) => {
      // stockPrices는 배열 형태 [round0, round1, ...]
      if (
        gameState.stockPrices[stock.id] !== undefined &&
        gameState.stockPrices[stock.id] !== null
      ) {
        if (
          Array.isArray(gameState.stockPrices[stock.id])
        ) {
          // 배열인 경우
          if (
            gameState.stockPrices[stock.id].length >
            gameState.currentRound
          ) {
            prices[stock.id] =
              gameState.stockPrices[stock.id][
                gameState.currentRound
              ];
          } else {
            // 배열이 있지만 인덱스가 범위를 벗어난 경우, 마지막 요소 사용
            const lastIndex =
              gameState.stockPrices[stock.id].length - 1;
            if (lastIndex >= 0) {
              prices[stock.id] =
                gameState.stockPrices[stock.id][lastIndex];
            } else {
              prices[stock.id] = stock.basePrice;
            }
          }
        } else {
          // 배열이 아닌 경우 (단일 값) - 초기 가격
          prices[stock.id] =
            gameState.stockPrices[stock.id];
        }
      } else {
        // stockPrices[stock.id]가 undefined 또는 null인 경우
        prices[stock.id] = stock.basePrice;
      }

      // 최종 검증
      if (
        prices[stock.id] === undefined ||
        prices[stock.id] === null ||
        isNaN(prices[stock.id])
      ) {
        console.error(
          `[getCurrentPrices] 가격이 유효하지 않음! stock.id: ${
            stock.id
          }, price: ${prices[stock.id]}, basePrice로 대체`
        );
        prices[stock.id] = stock.basePrice;
      }
    });
  } else {
    // 실제 게임 모드: 모든 종목
    STOCKS.forEach((stock) => {
      // stockPrices는 배열 형태 [round0, round1, ...]
      if (
        gameState.stockPrices[stock.id] !== undefined &&
        gameState.stockPrices[stock.id] !== null
      ) {
        if (
          Array.isArray(gameState.stockPrices[stock.id])
        ) {
          // 배열인 경우
          if (
            gameState.stockPrices[stock.id].length >
            gameState.currentRound
          ) {
            prices[stock.id] =
              gameState.stockPrices[stock.id][
                gameState.currentRound
              ];
          } else {
            // 배열이 있지만 인덱스가 범위를 벗어난 경우, 마지막 요소 사용
            const lastIndex =
              gameState.stockPrices[stock.id].length - 1;
            if (lastIndex >= 0) {
              prices[stock.id] =
                gameState.stockPrices[stock.id][lastIndex];
            } else {
              prices[stock.id] = stock.basePrice;
            }
          }
        } else {
          // 배열이 아닌 경우 (단일 값) - 초기 가격
          prices[stock.id] =
            gameState.stockPrices[stock.id];
        }
      } else {
        // stockPrices[stock.id]가 undefined 또는 null인 경우
        prices[stock.id] = stock.basePrice;
      }

      // 최종 검증
      if (
        prices[stock.id] === undefined ||
        prices[stock.id] === null ||
        isNaN(prices[stock.id])
      ) {
        console.error(
          `[getCurrentPrices] 가격이 유효하지 않음! stock.id: ${
            stock.id
          }, price: ${prices[stock.id]}, basePrice로 대체`
        );
        prices[stock.id] = stock.basePrice;
      }
    });
  }
  console.log(`[getCurrentPrices] 최종 prices:`, prices);
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

  // 연습 모드일 때는 PRACTICE_STOCKS 계산
  if (isPractice) {
    PRACTICE_STOCKS.forEach((stock) => {
      const qty = playerData.stocks[stock.id] || 0;
      const price =
        currentPrices[stock.id] || stock.basePrice;
      total += qty * price;
    });
  } else {
    // 실제 게임 모드: 모든 종목
    STOCKS.forEach((stock) => {
      const qty = playerData.stocks[stock.id] || 0;
      const price =
        currentPrices[stock.id] || stock.basePrice;
      total += qty * price;
    });
  }

  return total;
}

function resetPlayerDbForNewGame(
  socketId,
  playerData,
  isPractice
) {
  const currentGameId = gameState.gameId || 'legacy';
  const savedPlayer = dbHelpers.savePlayer(
    currentGameId,
    socketId,
    playerData.nickname,
    INITIAL_CASH,
    0,
    INITIAL_CASH,
    isPractice
  );

  playerData.dbId = savedPlayer.id;

  dbHelpers.updatePlayerCashById(
    playerData.dbId,
    INITIAL_CASH,
    INITIAL_CASH,
    isPractice
  );

  STOCKS.forEach((stock) => {
    dbHelpers.savePlayerStock(
      currentGameId,
      playerData.dbId,
      stock.id,
      0,
      isPractice
    );
  });
  PRACTICE_STOCKS.forEach((stock) => {
    dbHelpers.savePlayerStock(
      currentGameId,
      playerData.dbId,
      stock.id,
      0,
      isPractice
    );
  });

  dbHelpers.clearPlayerHints(
    currentGameId,
    playerData.dbId,
    isPractice
  );
}

// 라운드 타이머 시작 함수
function startRoundTimer() {
  // 기존 타이머 정리
  if (roundTimerInterval) {
    clearInterval(roundTimerInterval);
    roundTimerInterval = null;
  }

  // 연습 모드일 때는 5분(300초), 실제 모드일 때는 15분(900초)
  const roundTimeMinutes = gameState.isPracticeMode
    ? 5
    : 15;
  const roundTimeSeconds = roundTimeMinutes * 60;
  gameState.roundTimer = roundTimeSeconds;

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
    persistGameState();

    // 타이머가 0이 되면 관리자에게 알림
    if (gameState.roundTimer === 0) {
      const timeMessage = gameState.isPracticeMode
        ? '5분이 종료되었습니다. 다음 라운드로 진행하시겠습니까?'
        : '15분이 종료되었습니다. 다음 라운드로 진행하시겠습니까?';

      adminSockets.forEach((adminSocket) => {
        adminSocket.emit('ROUND_TIMER_END', {
          message: timeMessage,
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

let lastStatePersistTime = 0;
const STATE_PERSIST_THROTTLE_MS = 1000;

function persistGameState(options = {}) {
  if (!gameState.gameId) {
    return;
  }
  const now = Date.now();
  if (
    !options.force &&
    now - lastStatePersistTime < STATE_PERSIST_THROTTLE_MS
  ) {
    return;
  }
  lastStatePersistTime = now;

  const stateToPersist = {
    gameId: gameState.gameId,
    currentRound: gameState.currentRound,
    stockPrices: gameState.stockPrices,
    currentNews: gameState.currentNews,
    currentNewsBriefing: gameState.currentNewsBriefing,
    isGameStarted: gameState.isGameStarted,
    isGameEnded: gameState.isGameEnded,
    isPracticeMode: gameState.isPracticeMode,
    isWaitingMode: gameState.isWaitingMode,
    countdown: gameState.countdown,
    roundTimer: gameState.roundTimer,
    allowPlayerTrading: gameState.allowPlayerTrading,
    isTradingBlocked: gameState.isTradingBlocked,
    isLastRound: gameState.isLastRound,
  };

  try {
    dbHelpers.saveGameState(
      gameState.gameId,
      stateToPersist
    );
  } catch (error) {
    console.error('[persistGameState] 오류:', error);
  }
}

// 브로드캐스트 최적화: 마지막 브로드캐스트 시간 추적
let lastBroadcastTime = 0;
const BROADCAST_THROTTLE_MS = 100; // 100ms마다 최대 1회 브로드캐스트

// 게임 상태 브로드캐스트
function broadcastGameState() {
  // Throttle: 너무 자주 브로드캐스트하지 않도록 제한
  const now = Date.now();
  if (now - lastBroadcastTime < BROADCAST_THROTTLE_MS) {
    return; // 너무 자주 호출되면 스킵
  }
  lastBroadcastTime = now;
  // 모든 플레이어의 순위 리스트 생성 (DisplayBoard용)
  const dataMap = gameState.isPracticeMode
    ? practicePlayersData
    : playersData;

  // 닉네임별로 그룹화하여 중복 제거 (연결된 플레이어 우선)
  const nicknameMap = new Map();

  dataMap.forEach((playerData, socketId) => {
    const isOnline = connectedPlayers.has(socketId);
    const existing = nicknameMap.get(playerData.nickname);

    // 같은 닉네임이 이미 있으면:
    // 1. 연결된 플레이어가 우선
    // 2. 둘 다 연결되어 있거나 둘 다 연결 안 되어 있으면 총 자산이 더 큰 것을 선택
    const totalAsset = calculatePlayerTotalAsset(
      socketId,
      gameState.isPracticeMode
    );

    if (!existing) {
      // 없으면 추가
      nicknameMap.set(playerData.nickname, {
        socketId,
        nickname: playerData.nickname,
        totalAsset,
        isOnline,
      });
    } else if (isOnline && !existing.isOnline) {
      // 온라인 플레이어가 오프라인 플레이어보다 우선
      nicknameMap.set(playerData.nickname, {
        socketId,
        nickname: playerData.nickname,
        totalAsset,
        isOnline,
      });
    } else if (
      isOnline === existing.isOnline &&
      totalAsset > existing.totalAsset
    ) {
      // 같은 온라인 상태면 총 자산이 더 큰 것을 선택
      nicknameMap.set(playerData.nickname, {
        socketId,
        nickname: playerData.nickname,
        totalAsset,
        isOnline,
      });
    }
  });

  // Map에서 배열로 변환 (온라인 플레이어만 필터링)
  const allPlayers = Array.from(
    nicknameMap.values()
  ).filter((p) => p.isOnline === true);

  // 총 자산 기준으로 정렬하고 순위 추가 (50명 이상 대응: 효율적인 정렬)
  if (allPlayers.length > 0) {
    allPlayers.sort((a, b) => b.totalAsset - a.totalAsset);
    allPlayers.forEach((player, index) => {
      player.rank = index + 1;
    });
  }

  // 순위 리스트 생성 (DisplayBoard용 - 온라인 플레이어만 포함)
  const rankList = allPlayers.map((p) => ({
    rank: p.rank,
    nickname: p.nickname,
    totalAsset: p.totalAsset,
  }));

  const stateToSend = {
    currentRound: gameState.currentRound,
    stockPrices: getCurrentPrices(),
    currentNews: gameState.currentNews,
    currentNewsBriefing: gameState.currentNewsBriefing,
    isGameStarted: gameState.isGameStarted,
    isGameEnded: gameState.isGameEnded, // 게임 종료 상태
    isPracticeMode: gameState.isPracticeMode,
    isWaitingMode: gameState.isWaitingMode,
    priceHistory: gameState.stockPrices,
    countdown: gameState.countdown, // 카운트다운 상태 추가
    roundTimer: gameState.roundTimer, // 라운드 타이머 추가
    rankList: rankList, // 순위 리스트 추가 (DisplayBoard용)
    playerCount: connectedPlayers.size, // 플레이어 수 추가
    allowPlayerTrading: gameState.allowPlayerTrading, // 플레이어 직접 거래 허용 여부
    isTradingBlocked: gameState.isTradingBlocked, // 미니게임 진행 중 투자 차단 여부
    isLastRound: gameState.isLastRound, // 마지막 라운드 플래그
  };
  io.emit('GAME_STATE_UPDATE', stateToSend);
  persistGameState();

  // 모든 플레이어의 총 자산 업데이트

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

      // 순위 정보 업데이트 (온라인 플레이어만 포함)
      const playerRankInfo = allPlayers.find(
        (p) => p.socketId === socketId
      );
      if (playerRankInfo) {
        socket.emit('PLAYER_RANK_UPDATE', {
          rank: playerRankInfo.rank,
          totalPlayers: allPlayers.length, // 온라인 플레이어 수만
          totalAsset: playerRankInfo.totalAsset,
        });
        // 전체 순위 리스트 전송 (온라인 플레이어만)
        const rankList = allPlayers.map((p) => ({
          rank: p.rank,
          nickname: p.nickname,
          totalAsset: p.totalAsset,
          isMe: p.socketId === socketId,
        }));
        socket.emit('PLAYER_RANK_LIST_UPDATE', rankList);
      }
    }
  });
}

// 플레이어 리스트 브로드캐스트 최적화: 마지막 브로드캐스트 시간 추적
let lastPlayerListBroadcastTime = 0;
const PLAYER_LIST_BROADCAST_THROTTLE_MS = 200; // 200ms마다 최대 1회 브로드캐스트

// 플레이어 리스트 브로드캐스트 (모든 관리자에게)
function broadcastPlayerList() {
  if (adminSockets.size === 0) {
    return;
  }

  // Throttle: 너무 자주 브로드캐스트하지 않도록 제한
  // 단, lastPlayerListBroadcastTime이 0이면 강제 실행 (게임 시작 시 등)
  const now = Date.now();
  if (
    lastPlayerListBroadcastTime > 0 &&
    now - lastPlayerListBroadcastTime <
      PLAYER_LIST_BROADCAST_THROTTLE_MS
  ) {
    return; // 너무 자주 호출되면 스킵
  }
  lastPlayerListBroadcastTime = now;

  const dataMap = gameState.isPracticeMode
    ? practicePlayersData
    : playersData;
  const isPractice = gameState.isPracticeMode;

  // 닉네임별로 그룹화하여 중복 제거 (연결된 플레이어 우선)
  const nicknameMap = new Map();

  // 1. 메모리의 온라인 플레이어 정보 추가
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
          isPractice
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

  // 2. 데이터베이스에서 모든 플레이어 정보 가져와서 오프라인 플레이어 추가
  // 50명 이상 대응: 배치 쿼리로 N+1 쿼리 문제 해결
  try {
    // 현재 게임의 플레이어만 가져오기
    const currentGameId = gameState.gameId || 'legacy';
    const allDbPlayers = dbHelpers.getAllPlayers(
      currentGameId,
      isPractice
    );
    const currentPrices = getCurrentPrices();

    // 배치 쿼리로 모든 데이터를 한 번에 가져오기 (현재 게임만)
    const allDbStocks = dbHelpers.getAllPlayerStocks(
      currentGameId,
      isPractice
    );
    const allDbHints = dbHelpers.getAllPlayerHints(
      currentGameId,
      isPractice
    );
    const allDbTransactions =
      dbHelpers.getAllPlayerTransactions(
        currentGameId,
        isPractice
      );

    // playerId별로 그룹화 (성능 최적화)
    const stocksByPlayerId = new Map();
    allDbStocks.forEach((stock) => {
      if (!stocksByPlayerId.has(stock.player_id)) {
        stocksByPlayerId.set(stock.player_id, []);
      }
      stocksByPlayerId.get(stock.player_id).push(stock);
    });

    const hintsByPlayerId = new Map();
    allDbHints.forEach((hint) => {
      if (!hintsByPlayerId.has(hint.player_id)) {
        hintsByPlayerId.set(hint.player_id, []);
      }
      hintsByPlayerId.get(hint.player_id).push(hint);
    });

    const transactionsByPlayerId = new Map();
    allDbTransactions.forEach((t) => {
      if (!transactionsByPlayerId.has(t.playerId)) {
        transactionsByPlayerId.set(t.playerId, []);
      }
      transactionsByPlayerId.get(t.playerId).push(t);
    });

    allDbPlayers.forEach((dbPlayer) => {
      // 이미 온라인 플레이어로 추가된 경우 스킵
      if (nicknameMap.has(dbPlayer.nickname)) {
        return;
      }

      // 오프라인 플레이어: 배치 쿼리 결과에서 데이터 가져오기
      const dbStocks =
        stocksByPlayerId.get(dbPlayer.id) || [];
      const dbHints =
        hintsByPlayerId.get(dbPlayer.id) || [];
      const playerTransactions =
        transactionsByPlayerId.get(dbPlayer.id) || [];

      // 주식 정보 변환
      const stocks = {};
      STOCKS.forEach((stock) => {
        const dbStock = dbStocks.find(
          (s) => s.stock_id === stock.id
        );
        stocks[stock.id] = dbStock ? dbStock.quantity : 0;
      });

      // 거래 내역을 기반으로 정확한 cash 계산
      let calculatedCash = INITIAL_CASH;
      playerTransactions.forEach((t) => {
        if (t.type === 'BUY') {
          calculatedCash -=
            t.totalCost || t.price * t.quantity;
        } else if (t.type === 'SELL') {
          calculatedCash +=
            t.totalRevenue || t.price * t.quantity;
        } else if (t.type === 'HINT_PURCHASE') {
          calculatedCash -= t.hintPrice || 0;
        } else if (t.type === 'MINIGAME_REWARD') {
          calculatedCash += t.points || 0;
        }
      });

      // 총 자산 계산 (현재 주식 가격 기준)
      let totalAsset = calculatedCash;
      STOCKS.forEach((stock) => {
        const qty = stocks[stock.id] || 0;
        const price =
          currentPrices[stock.id] || stock.basePrice;
        totalAsset += qty * price;
      });

      // 힌트 정보 변환
      const hints = dbHints.map((hint) => ({
        difficulty: hint.difficulty,
        content: hint.content,
        receivedAt: hint.received_at,
        price: hint.price,
        round: hint.round,
      }));

      // 마지막 거래 라운드 찾기
      const lastTransaction =
        playerTransactions.length > 0
          ? playerTransactions[
              playerTransactions.length - 1
            ]
          : null;
      const lastTransactionRound = lastTransaction
        ? lastTransaction.round
        : null;

      // 오프라인 플레이어는 항상 offline_${dbPlayer.id} 형식의 socketId 사용
      // (dbPlayer.socket_id는 이전 연결의 socketId일 수 있어서 사용하지 않음)
      nicknameMap.set(dbPlayer.nickname, {
        socketId: `offline_${dbPlayer.id}`, // 오프라인 플레이어는 항상 이 형식 사용
        nickname: dbPlayer.nickname,
        cash: calculatedCash, // 거래 내역으로 재계산된 cash 사용
        bonusPoints: 0,
        stocks: stocks,
        totalAsset: totalAsset,
        transactionCount: playerTransactions.length,
        isOnline: false, // 오프라인 플레이어
        lastTransactionRound: lastTransactionRound,
        hints: hints,
        dbId: dbPlayer.id, // dbId도 함께 전송 (삭제 시 사용)
      });
    });
  } catch (error) {
    console.error(
      '[broadcastPlayerList] 데이터베이스에서 플레이어 정보 가져오기 오류:',
      error
    );
  }

  // Map에서 배열로 변환
  const playerList = Array.from(nicknameMap.values());

  // 총 자산 기준으로 정렬하고 순위 추가 (관리자용 - 모든 플레이어 포함)
  playerList.sort((a, b) => b.totalAsset - a.totalAsset);
  playerList.forEach((player, index) => {
    player.rank = index + 1;
  });

  // 현재 접속 중인 운영자 목록 생성
  const connectedAdmins = Array.from(adminSockets).map(
    (adminSocket) => {
      const adminId =
        adminAuthMap.get(adminSocket.id) || '알 수 없음';
      return {
        socketId: adminSocket.id,
        adminId: adminId,
      };
    }
  );

  console.log(
    `[broadcastPlayerList] 접속 중인 운영자 수: ${connectedAdmins.length}`,
    connectedAdmins.map((a) => a.adminId)
  );

  // 모든 관리자에게 전송 (모든 플레이어 포함 + 접속 중인 운영자 정보)
  adminSockets.forEach((adminSocket) => {
    const payload = {
      players: playerList,
      connectedAdmins: connectedAdmins,
    };
    console.log(
      `[broadcastPlayerList] ${adminSocket.id}에게 전송 - players: ${playerList.length}, connectedAdmins: ${connectedAdmins.length}`
    );
    adminSocket.emit('PLAYER_LIST_UPDATE', payload);
  });

  // 온라인 플레이어만 필터링하여 순위 재계산
  const onlinePlayers = playerList.filter(
    (p) => p.isOnline === true
  );
  onlinePlayers.sort((a, b) => b.totalAsset - a.totalAsset);
  onlinePlayers.forEach((player, index) => {
    player.rank = index + 1; // 온라인 플레이어만의 순위
  });

  // 모든 온라인 플레이어에게 자신의 순위 및 전체 순위 리스트 전송
  onlinePlayers.forEach((player) => {
    const socket = io.sockets.sockets.get(player.socketId);
    if (socket) {
      // 자신의 순위 정보 (온라인 플레이어 기준)
      socket.emit('PLAYER_RANK_UPDATE', {
        rank: player.rank,
        totalPlayers: onlinePlayers.length, // 온라인 플레이어 수만
        totalAsset: player.totalAsset,
      });
      // 전체 순위 리스트 (온라인 플레이어만 포함, 닉네임만 표시, 자신은 강조)
      const onlineRankList = onlinePlayers.map((p) => ({
        rank: p.rank,
        nickname: p.nickname,
        totalAsset: p.totalAsset,
        isMe: p.socketId === player.socketId,
      }));
      socket.emit(
        'PLAYER_RANK_LIST_UPDATE',
        onlineRankList
      );
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
      currentNewsBriefing: gameState.currentNewsBriefing,
      isGameStarted: gameState.isGameStarted,
      isGameEnded: gameState.isGameEnded, // 게임 종료 상태
      isPracticeMode: gameState.isPracticeMode,
      isWaitingMode: gameState.isWaitingMode,
      priceHistory: gameState.stockPrices,
      connectedPlayers: connectedPlayers.size,
      countdown: gameState.countdown,
      roundTimer: gameState.roundTimer,
      allowPlayerTrading: gameState.allowPlayerTrading, // 플레이어 직접 거래 허용 여부
    });
  });

  // 관리자 로그아웃
  socket.on('ADMIN_LOGOUT', () => {
    console.log(
      `[ADMIN_LOGOUT] 이벤트 수신 - socket.id: ${socket.id}`
    );
    console.log(
      `[ADMIN_LOGOUT] adminSockets.has(socket): ${adminSockets.has(
        socket
      )}`
    );

    if (!adminSockets.has(socket)) {
      console.log(
        `[ADMIN_LOGOUT] 이미 로그아웃된 상태이거나 관리자가 아님`
      );
      // 이미 로그아웃된 상태여도 성공 응답 전송
      socket.emit('ADMIN_LOGOUT_SUCCESS', {
        message: '로그아웃되었습니다.',
      });
      return;
    }

    const adminId =
      adminAuthMap.get(socket.id) || '알 수 없음';
    console.log(
      `[ADMIN_LOGOUT] 로그아웃 처리 - socket.id: ${socket.id}, adminId: ${adminId}`
    );

    // 관리자 목록에서 제거
    adminSockets.delete(socket);
    adminAuthMap.delete(socket.id);

    console.log(
      `[ADMIN_LOGOUT] 현재 adminSockets.size: ${adminSockets.size}`
    );

    // 로그아웃 성공 응답
    console.log(
      `[ADMIN_LOGOUT] ADMIN_LOGOUT_SUCCESS 이벤트 전송`
    );
    socket.emit('ADMIN_LOGOUT_SUCCESS', {
      message: '로그아웃되었습니다.',
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
      currentNewsBriefing: gameState.currentNewsBriefing,
      isGameStarted: gameState.isGameStarted,
      isGameEnded: gameState.isGameEnded, // 게임 종료 상태
      isPracticeMode: gameState.isPracticeMode,
      isWaitingMode: gameState.isWaitingMode,
      priceHistory: gameState.stockPrices,
      connectedPlayers: connectedPlayers.size,
      countdown: gameState.countdown,
      roundTimer: gameState.roundTimer,
      allowPlayerTrading: gameState.allowPlayerTrading,
      isTradingBlocked: gameState.isTradingBlocked,
    });
    socket.emit('GAME_SETTINGS_UPDATE', gameSettings);
    // 초기 플레이어 수 전송
    socket.emit(
      'PLAYER_COUNT_UPDATE',
      connectedPlayers.size
    );
    // 거래 로그 전송 (데이터베이스에서 로드) - 현재 게임만
    const currentGameId = gameState.gameId || 'legacy';
    const dbTransactions = dbHelpers.getAllTransactions(
      currentGameId,
      gameState.isPracticeMode
    );
    socket.emit('TRANSACTION_LOGS_INIT', dbTransactions);
    // 메모리에도 동기화
    transactionLogs.length = 0;
    transactionLogs.push(...dbTransactions);
    // 운영자 계정 목록 전송
    const admins = dbHelpers.getAllAdmins();
    socket.emit('ADMINS_LIST_UPDATE', admins);

    // 인증 직후 즉시 플레이어 리스트 전송 (throttle 무시)
    // broadcastPlayerList()를 직접 호출하는 대신, 인증한 관리자에게만 즉시 전송
    const dataMap = gameState.isPracticeMode
      ? practicePlayersData
      : playersData;

    // 간단한 플레이어 리스트 생성 (인증 직후 즉시 전송용)
    const nicknameMap = new Map();

    // 메모리의 온라인 플레이어 정보 추가
    dataMap.forEach((playerData, socketId) => {
      if (playerData.nickname) {
        nicknameMap.set(playerData.nickname, {
          socketId: socketId,
          nickname: playerData.nickname,
          cash: playerData.cash || 0,
          bonusPoints: 0,
          stocks: playerData.stocks || {},
          totalAsset:
            playerData.totalAsset || playerData.cash || 0,
          transactionCount: (playerData.transactions || [])
            .length,
          isOnline: true,
          hints: playerData.hints || [],
          dbId: playerData.dbId,
        });
      }
    });

    const playerList = Array.from(nicknameMap.values());
    playerList.sort((a, b) => b.totalAsset - a.totalAsset);
    playerList.forEach((player, index) => {
      player.rank = index + 1;
    });

    // 현재 접속 중인 운영자 목록 생성 (인증 직후이므로 현재 socket 포함)
    const connectedAdmins = Array.from(adminSockets).map(
      (adminSocket) => {
        const adminId =
          adminAuthMap.get(adminSocket.id) || '알 수 없음';
        return {
          socketId: adminSocket.id,
          adminId: adminId,
        };
      }
    );

    console.log(
      `[ADMIN_AUTH] 인증 직후 플레이어 리스트 전송 - players: ${playerList.length}, connectedAdmins: ${connectedAdmins.length}`,
      connectedAdmins.map((a) => a.adminId)
    );

    // 인증한 관리자에게 즉시 전송
    socket.emit('PLAYER_LIST_UPDATE', {
      players: playerList,
      connectedAdmins: connectedAdmins,
    });

    // 다른 관리자들에게도 브로드캐스트 (throttle 적용)
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
        currentNewsBriefing: gameState.currentNewsBriefing,
        isGameStarted: gameState.isGameStarted,
        isGameEnded: gameState.isGameEnded, // 게임 종료 상태
        isPracticeMode: gameState.isPracticeMode,
        isWaitingMode: gameState.isWaitingMode,
        priceHistory: gameState.stockPrices,
        connectedPlayers: connectedPlayers.size,
        countdown: gameState.countdown,
        roundTimer: gameState.roundTimer,
        allowPlayerTrading: gameState.allowPlayerTrading, // 플레이어 직접 거래 허용 여부
      });
      socket.emit('GAME_SETTINGS_UPDATE', gameSettings);
      // broadcastPlayerList()는 ADMIN_REQUEST_PLAYER_LIST에서만 호출하도록 변경
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

    // 게임이 시작된 상태라면 초기값으로 시작 (DB 데이터 무시)
    const isGameStarted =
      gameState.isGameStarted && !gameState.isWaitingMode;

    // savePlayer는 기존 플레이어가 있으면 재사용하고, 없으면 새로 생성합니다
    // 먼저 savePlayer를 호출하여 기존 플레이어를 찾거나 새로 생성
    // gameId가 없으면 'legacy' 사용 (게임 시작 전)
    const currentGameId = gameState.gameId || 'legacy';

    // 재접속 시 기존 플레이어를 찾기 위해 먼저 닉네임으로 조회
    const existingPlayer = dbHelpers.getPlayerByNickname(
      currentGameId,
      trimmedNickname,
      isPractice
    );

    // 기존 플레이어가 있으면 그 데이터를 사용하고, 없으면 새로 생성
    // savePlayer는 기존 플레이어를 찾으면 cash/total_asset을 업데이트하지 않으므로
    // 기존 플레이어가 있을 때는 기존 데이터를 전달하지만, 실제로는 무시됨
    const savedPlayer = existingPlayer
      ? dbHelpers.savePlayer(
          currentGameId,
          socket.id,
          trimmedNickname,
          existingPlayer.cash, // 기존 현금 유지 (savePlayer가 업데이트하지 않음)
          0,
          existingPlayer.total_asset, // 기존 총 자산 유지 (savePlayer가 업데이트하지 않음)
          isPractice
        )
      : dbHelpers.savePlayer(
          currentGameId,
          socket.id,
          trimmedNickname,
          INITIAL_CASH,
          0,
          INITIAL_CASH,
          isPractice
        );

    console.log(
      `[PLAYER_JOIN] ${trimmedNickname} - 기존 플레이어: ${
        existingPlayer ? '예' : '아니오'
      }, DB cash: ${savedPlayer.cash}, DB total_asset: ${
        savedPlayer.total_asset
      }`
    );

    if (!savedPlayer || !savedPlayer.id) {
      console.error(
        `[PLAYER_JOIN] 플레이어 생성/조회 실패: ${trimmedNickname}`
      );
      socket.emit('NICKNAME_ERROR', {
        message:
          '플레이어 생성 중 오류가 발생했습니다. 다시 시도해주세요.',
      });
      return;
    }

    const playerId = savedPlayer.id;
    const isNewPlayer = savedPlayer._isNew === true;

    if (!isNewPlayer) {
      // 기존 플레이어 재접속: DB에서 저장된 데이터 사용
      // DB에서 로드한 최신 현금 및 총 자산 사용 (없을 때만 초기값)
      let playerCash =
        savedPlayer.cash !== undefined &&
        savedPlayer.cash !== null
          ? savedPlayer.cash
          : INITIAL_CASH;
      let playerTotalAsset =
        savedPlayer.total_asset !== undefined &&
        savedPlayer.total_asset !== null
          ? savedPlayer.total_asset
          : INITIAL_CASH;

      const stocks = {};
      const hints = [];

      // 힌트는 게임 시작 여부와 관계없이 항상 DB에서 로드
      const dbHints = dbHelpers.getPlayerHints(
        currentGameId,
        playerId,
        isPractice
      );

      console.log(
        `[PLAYER_JOIN] ${trimmedNickname} 힌트 로드 - DB에서 ${dbHints.length}개 발견`,
        dbHints.map((h) => ({
          difficulty: h.difficulty,
          round: h.round,
          content: h.content?.substring(0, 20) + '...',
        }))
      );

      // 힌트 로드
      hints.push(
        ...dbHints.map((hint) => ({
          difficulty: hint.difficulty,
          content: hint.content,
          receivedAt: hint.received_at,
          price: hint.price,
          round: hint.round,
        }))
      );

      // 거래 내역 로드
      const dbTransactions =
        dbHelpers.getTransactionsByPlayerId(
          currentGameId,
          playerId,
          isPractice
        );
      const transactions = dbTransactions.map((t) => ({
        type: t.type,
        stockId: t.stockId,
        stockName: t.stockName || t.stockId,
        quantity: t.quantity,
        price: t.price,
        totalCost: t.totalCost,
        totalRevenue: t.totalRevenue,
        timestamp: t.timestamp,
        round: t.round,
        isAutoSell: t.isAutoSell === 1,
      }));

      console.log(
        `[PLAYER_JOIN] ${trimmedNickname} 데이터 로드 - 힌트: ${hints.length}개, 거래: ${transactions.length}개`
      );

      // 게임이 시작되지 않은 상태에서만 주식 데이터 로드
      if (!isGameStarted) {
        // 기존 플레이어 주식 데이터 로드
        const dbStocks = dbHelpers.getPlayerStocks(
          currentGameId,
          playerId,
          isPractice
        );

        // 메모리 데이터 구조로 변환
        STOCKS.forEach((stock) => {
          const dbStock = dbStocks.find(
            (s) => s.stock_id === stock.id
          );
          stocks[stock.id] = dbStock ? dbStock.quantity : 0;
        });

        // 연습 모드용 주식도 확인
        if (isPractice) {
          PRACTICE_STOCKS.forEach((stock) => {
            const dbStock = dbStocks.find(
              (s) => s.stock_id === stock.id
            );
            stocks[stock.id] = dbStock
              ? dbStock.quantity
              : 0;
          });
        }

        // 기존 플레이어의 cash가 INITIAL_CASH보다 작아도 게임이 시작된 후라면 유지
        // (게임 시작 전 대기 상태에서만 최소 자본금 보장)
        if (!isGameStarted && playerCash < INITIAL_CASH) {
          console.log(
            `[PLAYER_JOIN] 게임 시작 전 자본금 보정: ${trimmedNickname} (${playerCash} -> ${INITIAL_CASH})`
          );
          playerCash = INITIAL_CASH;
          playerTotalAsset = INITIAL_CASH;

          // 데이터베이스 업데이트
          dbHelpers.updatePlayerCashById(
            playerId,
            playerCash,
            playerTotalAsset,
            isPractice
          );
        }

        // 총 자산을 현재 주식 가격 기준으로 재계산
        const currentPrices = getCurrentPrices();
        let calculatedTotalAsset = playerCash;
        if (isPractice) {
          PRACTICE_STOCKS.forEach((stock) => {
            const qty = stocks[stock.id] || 0;
            const price =
              currentPrices[stock.id] || stock.basePrice;
            calculatedTotalAsset += qty * price;
          });
        } else {
          STOCKS.forEach((stock) => {
            const qty = stocks[stock.id] || 0;
            const price =
              currentPrices[stock.id] || stock.basePrice;
            calculatedTotalAsset += qty * price;
          });
        }
        playerTotalAsset = calculatedTotalAsset;
      } else {
        // 게임이 시작된 상태: 재접속 시 기존 데이터 유지
        // 주식 데이터 로드
        const dbStocks = dbHelpers.getPlayerStocks(
          currentGameId,
          playerId,
          isPractice
        );

        // 메모리 데이터 구조로 변환
        STOCKS.forEach((stock) => {
          const dbStock = dbStocks.find(
            (s) => s.stock_id === stock.id
          );
          stocks[stock.id] = dbStock ? dbStock.quantity : 0;
        });

        // 연습 모드용 주식도 확인
        if (isPractice) {
          PRACTICE_STOCKS.forEach((stock) => {
            const dbStock = dbStocks.find(
              (s) => s.stock_id === stock.id
            );
            stocks[stock.id] = dbStock
              ? dbStock.quantity
              : 0;
          });
        }

        // 현금과 총 자산은 DB에서 로드 (초기화하지 않음)
        playerCash = savedPlayer.cash;
        playerTotalAsset = savedPlayer.total_asset;

        // 총 자산을 현재 주식 가격 기준으로 재계산
        const currentPrices = getCurrentPrices();
        let calculatedTotalAsset = playerCash;
        if (isPractice) {
          PRACTICE_STOCKS.forEach((stock) => {
            const qty = stocks[stock.id] || 0;
            const price =
              currentPrices[stock.id] || stock.basePrice;
            calculatedTotalAsset += qty * price;
          });
        } else {
          STOCKS.forEach((stock) => {
            const qty = stocks[stock.id] || 0;
            const price =
              currentPrices[stock.id] || stock.basePrice;
            calculatedTotalAsset += qty * price;
          });
        }
        playerTotalAsset = calculatedTotalAsset;

        console.log(
          `[PLAYER_JOIN] 게임 시작 상태: ${trimmedNickname} 재접속 - cash: ${playerCash}, 힌트: ${hints.length}개`
        );
      }

      // 메모리에 데이터 로드
      dataMap.set(socket.id, {
        nickname: trimmedNickname,
        cash: playerCash,
        stocks: stocks,
        bonusPoints: 0,
        totalAsset: playerTotalAsset,
        transactions: transactions || [], // 로드된 거래 내역 할당
        hints: hints,
        dbId: playerId,
      });

      console.log(
        `[PLAYER_JOIN] ${trimmedNickname} 메모리 저장 완료 - 힌트 ${hints.length}개 저장됨`
      );

      console.log(
        `기존 플레이어 재사용: ${trimmedNickname} (ID: ${playerId}, cash: ${playerCash})`
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
      const currentGameId = gameState.gameId || 'legacy';
      if (playerId) {
        STOCKS.forEach((stock) => {
          dataMap.get(socket.id).stocks[stock.id] = 0;
          try {
            dbHelpers.savePlayerStock(
              currentGameId,
              playerId,
              stock.id,
              0,
              isPractice
            );
          } catch (error) {
            console.error(
              `[PLAYER_JOIN] 주식 초기화 오류: ${trimmedNickname}, stock: ${stock.id}`,
              error
            );
          }
        });

        // 연습 모드용 주식도 초기화
        if (isPractice) {
          PRACTICE_STOCKS.forEach((stock) => {
            dataMap.get(socket.id).stocks[stock.id] = 0;
            try {
              dbHelpers.savePlayerStock(
                currentGameId,
                playerId,
                stock.id,
                0,
                isPractice
              );
            } catch (error) {
              console.error(
                `[PLAYER_JOIN] 연습 주식 초기화 오류: ${trimmedNickname}, stock: ${stock.id}`,
                error
              );
            }
          });
        }
      } else {
        console.error(
          `[PLAYER_JOIN] playerId가 없어 주식 초기화를 건너뜁니다: ${trimmedNickname}`
        );
      }

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

    // 플레이어에게 현재 포트폴리오 전송
    const playerData = dataMap.get(socket.id);
    if (!playerData) {
      console.error(
        `[PLAYER_JOIN] 오류: 플레이어 데이터를 찾을 수 없음 - ${trimmedNickname}, socket.id: ${socket.id}`
      );
      return;
    }

    // 힌트가 제대로 로드되었는지 확인 및 로그
    console.log(
      `[PLAYER_JOIN] ${trimmedNickname} 힌트 로드 확인 - 메모리: ${
        playerData.hints?.length || 0
      }개`
    );
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

    // 힌트 전송 (재접속 시 힌트 복원)
    const hintsToSend = playerData.hints || [];
    console.log(
      `[PLAYER_JOIN] ${trimmedNickname}에게 힌트 전송: ${hintsToSend.length}개`,
      hintsToSend.map((h) => ({
        difficulty: h.difficulty,
        round: h.round,
      }))
    );
    socket.emit('PLAYER_HINTS_UPDATE', hintsToSend);

    socket.emit('GAME_STATE_UPDATE', {
      currentRound: gameState.currentRound,
      stockPrices: getCurrentPrices(),
      currentNews: gameState.currentNews,
      currentNewsBriefing: gameState.currentNewsBriefing,
      isGameStarted: gameState.isGameStarted,
      isGameEnded: gameState.isGameEnded, // 게임 종료 상태
      isPracticeMode: gameState.isPracticeMode,
      isWaitingMode: gameState.isWaitingMode,
      priceHistory: gameState.stockPrices,
      countdown: gameState.countdown,
      roundTimer: gameState.roundTimer,
      allowPlayerTrading: gameState.allowPlayerTrading, // 플레이어 직접 거래 허용 여부
    });

    // 모든 클라이언트에게 게임 상태 업데이트 (DisplayBoard용 playerCount 포함)
    broadcastGameState();

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
  socket.on('ADMIN_START_PRACTICE', (data) => {
    if (adminSockets.has(socket)) {
      const { shouldDelete = false } = data || {};

      // 이전 게임 데이터 삭제가 요청된 경우
      if (shouldDelete) {
        console.log(
          '[ADMIN_START_PRACTICE] 이전 게임 데이터 삭제 시작'
        );
        try {
          // 데이터베이스에서 모든 플레이어 삭제 (연습 모드)
          // shouldDelete가 true일 때는 모든 게임의 데이터를 삭제하므로 gameId는 null
          const deletedCount = dbHelpers.deleteAllPlayers(
            null,
            true
          );
          console.log(
            `[ADMIN_START_PRACTICE] 데이터베이스에서 ${deletedCount}명의 플레이어 삭제 완료`
          );

          // 메모리에서 플레이어 데이터는 유지 (접속 중인 플레이어 연결 유지)
          // practicePlayersData와 practiceConnectedPlayers는 유지하여
          // 접속 중인 플레이어가 게임을 계속할 수 있도록 함

          // 거래 로그 삭제
          const deletedTransactions =
            dbHelpers.clearAllTransactions(null, true);
          console.log(
            `[ADMIN_START_PRACTICE] 데이터베이스에서 ${deletedTransactions}개의 거래 내역 삭제 완료`
          );
          transactionLogs.length = 0;

          // 관리자에게 업데이트 전송
          if (adminSockets.size > 0) {
            adminSockets.forEach((adminSocket) => {
              adminSocket.emit(
                'PLAYER_COUNT_UPDATE',
                connectedPlayers.size
              );
              adminSocket.emit('TRANSACTION_LOGS_INIT', []);
              adminSocket.emit(
                'TRANSACTION_LOGS_UPDATE',
                []
              );
            });
            broadcastPlayerList();
          }

          console.log(
            `[ADMIN_START_PRACTICE] 이전 게임 데이터 삭제 완료 (접속 중인 플레이어: ${connectedPlayers.size}명 유지)`
          );
        } catch (error) {
          console.error(
            '[ADMIN_START_PRACTICE] 이전 게임 데이터 삭제 중 오류:',
            error
          );
        }
      }

      // 게임 고유 ID 생성 및 저장
      const newGameId = createGameId();
      gameState.gameId = newGameId;
      dbHelpers.createGame(newGameId, true);
      console.log(
        `[ADMIN_START_PRACTICE] 새 게임 ID 생성: ${newGameId}`
      );

      gameState.isPracticeMode = true;
      gameState.isGameStarted = true;
      gameState.isGameEnded = false; // 게임 종료 상태 해제
      gameState.isWaitingMode = false;
      gameState.currentRound = 0;
      // 연습 게임용 시나리오 설정
      gameState.scenarios = practiceScenarios;
      gameSettings.totalRounds = gameState.scenarios.length;
      // 연습 게임용 가격 초기화 (3개 종목)
      PRACTICE_STOCKS.forEach((stock) => {
        gameState.stockPrices[stock.id] = [stock.basePrice];
      });
      console.log(
        `[ADMIN_START_PRACTICE] 주식 가격 초기화: ${PRACTICE_STOCKS.map(
          (s) => `${s.id} = [${s.basePrice}]`
        ).join(', ')}`
      );
      // 0라운드에서는 뉴스를 표시하지 않음 (1라운드부터 뉴스 표시)
      gameState.currentNews = '';
      gameState.currentNewsBriefing = [];

      // 연습 모드에서는 오프라인 거래소 및 힌트 구매소 상시 OPEN
      gameState.allowPlayerTrading = true; // 연습 모드에서는 온라인 거래 활성화

      // shouldDelete가 false일 때만 기존 플레이어 데이터 초기화 (true일 때는 이미 삭제됨)
      if (!shouldDelete) {
        // 기존 플레이어들을 playersData에서 practicePlayersData로 이동
        playersData.forEach((playerData, socketId) => {
          // playersData에서 제거하고 practicePlayersData로 이동
          practicePlayersData.set(socketId, {
            ...playerData,
            cash: INITIAL_CASH,
            bonusPoints: 0,
            totalAsset: INITIAL_CASH,
            transactions: [],
            hints: [],
          });
          // stocks 초기화
          STOCKS.forEach((stock) => {
            practicePlayersData.get(socketId).stocks[
              stock.id
            ] = 0;
          });
          PRACTICE_STOCKS.forEach((stock) => {
            practicePlayersData.get(socketId).stocks[
              stock.id
            ] = 0;
          });
        });
        // playersData 비우기 (연습 모드에서는 사용하지 않음)
        playersData.clear();

        // 기존 플레이어들을 playersData에서 practicePlayersData로 이동
        // (연습 게임 시작 전에 접속한 플레이어들이 playersData에 있을 수 있음)
        playersData.forEach((playerData, socketId) => {
          // playersData에서 제거하고 practicePlayersData로 이동
          practicePlayersData.set(socketId, {
            ...playerData,
            cash: INITIAL_CASH,
            bonusPoints: 0,
            totalAsset: INITIAL_CASH,
            transactions: [],
            hints: [],
          });
          // stocks 초기화
          STOCKS.forEach((stock) => {
            practicePlayersData.get(socketId).stocks[
              stock.id
            ] = 0;
          });
          PRACTICE_STOCKS.forEach((stock) => {
            practicePlayersData.get(socketId).stocks[
              stock.id
            ] = 0;
          });

          // DB도 초기화
          try {
            resetPlayerDbForNewGame(
              socketId,
              playerData,
              true
            );
          } catch (error) {
            console.error(
              `[ADMIN_START_PRACTICE] 플레이어 데이터 이동 중 DB 초기화 오류: ${playerData.nickname}`,
              error
            );
          }

          // 플레이어에게 초기화된 데이터 전송
          const playerSocket =
            io.sockets.sockets.get(socketId);
          if (playerSocket) {
            // connectedPlayers에 추가 (연결된 플레이어로 표시)
            if (!connectedPlayers.has(socketId)) {
              connectedPlayers.add(socketId);
            }
            playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
              cash: INITIAL_CASH,
              stocks:
                practicePlayersData.get(socketId).stocks,
              bonusPoints: 0,
              totalAsset: INITIAL_CASH,
            });
            playerSocket.emit('PLAYER_HINTS_UPDATE', []);
          }
        });
        // playersData 비우기 (연습 모드에서는 사용하지 않음)
        playersData.clear();

        // 연습 모드 플레이어 데이터 초기화 (자본금, 주식, 보너스 포인트 모두 초기화)
        practicePlayersData.forEach(
          (playerData, socketId) => {
            // 메모리 데이터 초기화
            playerData.cash = INITIAL_CASH;
            playerData.bonusPoints = 0;
            playerData.totalAsset = INITIAL_CASH;
            playerData.transactions = [];
            playerData.hints = []; // 힌트 초기화
            // 모든 주식 수량 0으로 초기화 (연습 모드에서는 PRACTICE_STOCK도 포함)
            STOCKS.forEach((stock) => {
              playerData.stocks[stock.id] = 0;
            });
            // 연습 모드용 주식도 초기화
            PRACTICE_STOCKS.forEach((stock) => {
              playerData.stocks[stock.id] = 0;
            });

            // 데이터베이스 데이터도 초기화
            try {
              resetPlayerDbForNewGame(
                socketId,
                playerData,
                gameState.isPracticeMode
              );
            } catch (error) {
              console.error(
                `[연습 게임 시작] 플레이어 데이터 초기화 오류: ${playerData.nickname}`,
                error
              );
            }

            // 플레이어에게 초기화된 포트폴리오 전송
            const playerSocket =
              io.sockets.sockets.get(socketId);
            if (playerSocket) {
              // connectedPlayers에 추가 (연결된 플레이어로 표시)
              if (!connectedPlayers.has(socketId)) {
                connectedPlayers.add(socketId);
              }
              playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
                cash: playerData.cash,
                stocks: playerData.stocks,
                bonusPoints: 0,
                totalAsset: playerData.totalAsset,
              });
              // 힌트도 초기화된 상태로 전송
              playerSocket.emit('PLAYER_HINTS_UPDATE', []);
            }
          }
        );
      } // shouldDelete가 false일 때만 실행

      // 게임 시작 시 모든 접속 중인 플레이어를 connectedPlayers에 추가
      // (playersData나 practicePlayersData에 없는 플레이어도 포함)
      io.sockets.sockets.forEach((socket) => {
        // 관리자가 아니고 닉네임이 있는 경우만 플레이어로 인식
        if (socket.nickname && !adminSockets.has(socket)) {
          const socketId = socket.id;
          if (!connectedPlayers.has(socketId)) {
            connectedPlayers.add(socketId);
            console.log(
              `[ADMIN_START_PRACTICE] 접속 중인 플레이어를 connectedPlayers에 추가: ${socket.nickname} (${socketId})`
            );
          }
        }
      });

      // 새로 접속한 플레이어를 위한 빈 맵 유지 (기존 데이터는 위에서 초기화됨)
      // 라운드 타이머 시작
      startRoundTimer();
      // 게임 재시작 이벤트 전송 (게임 종료 화면 해제) - broadcastGameState 전에 전송
      io.emit('GAME_RESTART');

      // 모든 연결된 플레이어에게 게임 상태 업데이트 직접 전송
      connectedPlayers.forEach((socketId) => {
        const playerSocket =
          io.sockets.sockets.get(socketId);
        if (playerSocket) {
          playerSocket.emit('GAME_STATE_UPDATE', {
            currentRound: gameState.currentRound,
            stockPrices: getCurrentPrices(),
            currentNews: gameState.currentNews,
            currentNewsBriefing:
              gameState.currentNewsBriefing,
            isGameStarted: gameState.isGameStarted,
            isGameEnded: false,
            isPracticeMode: gameState.isPracticeMode,
            isWaitingMode: gameState.isWaitingMode,
            priceHistory: gameState.stockPrices,
            countdown: gameState.countdown,
            roundTimer: gameState.roundTimer,
            allowPlayerTrading:
              gameState.allowPlayerTrading,
          });
        }
      });

      // 게임 상태 브로드캐스트 (isGameEnded = false 포함)
      broadcastGameState();
      broadcastPlayerList();
      persistGameState({ force: true });
      console.log(
        `연습 게임 시작 (모든 플레이어 데이터 초기화) - 연결된 플레이어: ${connectedPlayers.size}명`
      );
    }
  });

  // 관리자: 실제 게임 시작 (연습에서 전환)
  socket.on('ADMIN_START_REAL_GAME', (data) => {
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
      const { shouldDelete = false } = data || {};

      // 이전 게임 데이터 삭제가 요청된 경우
      if (shouldDelete) {
        console.log(
          '[ADMIN_START_REAL_GAME] 이전 게임 데이터 삭제 시작'
        );
        try {
          // 데이터베이스에서 모든 플레이어 삭제 (실제 게임 모드)
          // shouldDelete가 true일 때는 모든 게임의 데이터를 삭제하므로 gameId는 null
          const deletedCount = dbHelpers.deleteAllPlayers(
            null,
            false
          );
          console.log(
            `[ADMIN_START_REAL_GAME] 데이터베이스에서 ${deletedCount}명의 플레이어 삭제 완료`
          );

          // 메모리에서 플레이어 데이터는 유지 (접속 중인 플레이어 연결 유지)
          // playersData와 connectedPlayers는 유지하여
          // 접속 중인 플레이어가 게임을 계속할 수 있도록 함
          // DB만 삭제하고 메모리 데이터는 새 게임 시작 시 초기화됨

          // 거래 로그 삭제
          const deletedTransactions =
            dbHelpers.clearAllTransactions(null, false);
          console.log(
            `[ADMIN_START_REAL_GAME] 데이터베이스에서 ${deletedTransactions}개의 거래 내역 삭제 완료`
          );
          transactionLogs.length = 0;

          // 관리자에게 업데이트 전송
          if (adminSockets.size > 0) {
            adminSockets.forEach((adminSocket) => {
              adminSocket.emit(
                'PLAYER_COUNT_UPDATE',
                connectedPlayers.size
              );
              adminSocket.emit('TRANSACTION_LOGS_INIT', []);
              adminSocket.emit(
                'TRANSACTION_LOGS_UPDATE',
                []
              );
            });
            broadcastPlayerList();
          }

          console.log(
            `[ADMIN_START_REAL_GAME] 이전 게임 데이터 삭제 완료 (접속 중인 플레이어: ${connectedPlayers.size}명 유지)`
          );
        } catch (error) {
          console.error(
            '[ADMIN_START_REAL_GAME] 이전 게임 데이터 삭제 중 오류:',
            error
          );
        }
      }

      console.log(
        '[ADMIN_START_REAL_GAME] 실제 게임 시작 처리 중...'
      );

      // 게임 고유 ID 생성 및 저장
      const newGameId = createGameId();
      gameState.gameId = newGameId;
      dbHelpers.createGame(newGameId, false);
      console.log(
        `[ADMIN_START_REAL_GAME] 새 게임 ID 생성: ${newGameId}`
      );

      gameState.isPracticeMode = false;
      gameState.isGameStarted = true;
      gameState.isGameEnded = false; // 게임 종료 상태 해제
      gameState.isWaitingMode = false;
      gameState.currentRound = 0;
      // 실제 게임용 시나리오 설정
      gameState.scenarios = initialScenarios;
      gameSettings.totalRounds = gameState.scenarios.length;
      // 실제 게임 모드에서도 플레이어 직접 거래 활성화 (라운드 0부터 거래 가능)
      gameState.allowPlayerTrading = true;
      // 게임 종료 화면 숨김 상태도 리셋하기 위해 명시적으로 isGameEnded를 false로 설정
      // 가격 초기화 (실제 게임용 주식)
      STOCKS.forEach((stock) => {
        gameState.stockPrices[stock.id] = [stock.basePrice];
      });
      // 연습 모드용 주식 가격 초기화 (혹시 모를 경우를 대비)
      PRACTICE_STOCKS.forEach((stock) => {
        gameState.stockPrices[stock.id] = [stock.basePrice];
      });
      // 0라운드에서는 뉴스를 표시하지 않음 (1라운드부터 뉴스 표시)
      gameState.currentNews = '';
      gameState.currentNewsBriefing = [];

      // 연습 모드 플레이어를 실제 게임 모드로 전환
      // practicePlayersData의 플레이어를 playersData로 이동
      const playersToMove = Array.from(
        practicePlayersData.entries()
      );
      playersToMove.forEach(([socketId, playerData]) => {
        // 플레이어 데이터 초기화
        playerData.cash = INITIAL_CASH;
        playerData.bonusPoints = 0;
        playerData.totalAsset = INITIAL_CASH;
        playerData.transactions = [];
        playerData.hints = [];
        STOCKS.forEach((stock) => {
          playerData.stocks[stock.id] = 0;
        });
        PRACTICE_STOCKS.forEach((stock) => {
          playerData.stocks[stock.id] = 0;
        });

        // 데이터베이스에서 실제 게임 모드로 플레이어 생성/업데이트
        try {
          resetPlayerDbForNewGame(
            socketId,
            playerData,
            false
          );
        } catch (error) {
          console.error(
            `[실제 게임 시작] 연습 모드 플레이어 전환 오류: ${playerData.nickname}`,
            error
          );
        }

        // practicePlayersData에서 제거하고 playersData로 이동
        practicePlayersData.delete(socketId);
        playersData.set(socketId, playerData);

        // connectedPlayers에 추가 (연결된 플레이어로 표시)
        // socket이 존재하면 무조건 추가
        if (io.sockets.sockets.has(socketId)) {
          connectedPlayers.add(socketId);
        }

        // 플레이어에게 초기화된 데이터 전송
        const playerSocket =
          io.sockets.sockets.get(socketId);
        if (playerSocket) {
          playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
            cash: playerData.cash,
            stocks: playerData.stocks,
            bonusPoints: 0,
            totalAsset: playerData.totalAsset,
          });
          playerSocket.emit('PLAYER_HINTS_UPDATE', []);
        }
      });

      playersData.forEach((playerData, socketId) => {
        // 메모리 데이터 초기화
        playerData.cash = INITIAL_CASH;
        playerData.bonusPoints = 0;
        playerData.totalAsset = INITIAL_CASH;
        playerData.transactions = [];
        playerData.hints = [];
        // 모든 주식 수량 0으로 초기화
        STOCKS.forEach((stock) => {
          playerData.stocks[stock.id] = 0;
        });
        // 연습 모드용 주식도 초기화 (혹시 모를 경우를 대비)
        PRACTICE_STOCKS.forEach((stock) => {
          playerData.stocks[stock.id] = 0;
        });

        // 데이터베이스 데이터도 초기화
        try {
          resetPlayerDbForNewGame(
            socketId,
            playerData,
            gameState.isPracticeMode
          );
        } catch (error) {
          console.error(
            `[실제 게임 시작] 플레이어 데이터 초기화 오류: ${playerData.nickname}`,
            error
          );
        }

        // 플레이어에게 초기화된 포트폴리오 전송
        const playerSocket =
          io.sockets.sockets.get(socketId);
        if (playerSocket) {
          // connectedPlayers에 추가 (연결된 플레이어로 표시)
          if (!connectedPlayers.has(socketId)) {
            connectedPlayers.add(socketId);
          }
          playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
            cash: playerData.cash,
            stocks: playerData.stocks,
            bonusPoints: 0,
            totalAsset: playerData.totalAsset,
          });
          // 힌트도 초기화된 상태로 전송
          playerSocket.emit('PLAYER_HINTS_UPDATE', []);
        }
      });

      // 게임 시작 시 모든 접속 중인 플레이어를 connectedPlayers에 추가
      // (playersData에 없는 플레이어도 포함)
      io.sockets.sockets.forEach((socket) => {
        if (socket.nickname && !adminSockets.has(socket)) {
          const socketId = socket.id;
          if (!connectedPlayers.has(socketId)) {
            connectedPlayers.add(socketId);
            console.log(
              `[ADMIN_START_REAL_GAME] 접속 중인 플레이어를 connectedPlayers에 추가: ${socket.nickname} (${socketId})`
            );
          }
        }
      });

      // 라운드 0에서 무료 힌트 자동 지급 (initialScenarios[0]의 freeHint 사용)
      // 플레이어 데이터 초기화 이후에 실행
      if (
        initialScenarios[0] &&
        initialScenarios[0].freeHint
      ) {
        playersData.forEach((playerData, socketId) => {
          if (!playerData.hints) {
            playerData.hints = [];
          }
          const freeHint = {
            difficulty: '무료',
            content: initialScenarios[0].freeHint,
            receivedAt: new Date().toISOString(),
            price: 0,
            round: 0,
          };
          playerData.hints.push(freeHint);

          // 데이터베이스에 저장
          if (playerData.dbId) {
            try {
              const currentGameId =
                gameState.gameId || 'legacy';
              dbHelpers.saveHint(
                currentGameId,
                playerData.dbId,
                '무료',
                initialScenarios[0].freeHint,
                0,
                0,
                false // isPractice = false
              );
            } catch (error) {
              console.error(
                `[실제 게임 시작] 무료 힌트 저장 오류 ${playerData.nickname}:`,
                error
              );
            }
          }

          // 플레이어에게 힌트 업데이트 전송
          const playerSocket =
            io.sockets.sockets.get(socketId);
          if (playerSocket) {
            playerSocket.emit(
              'PLAYER_HINTS_UPDATE',
              playerData.hints
            );
          }
        });
        console.log(
          `[ADMIN_START_REAL_GAME] 라운드 0에서 무료 힌트 지급 완료`
        );
      }

      // 라운드 타이머 시작
      startRoundTimer();
      // 게임 재시작 이벤트 전송 (게임 종료 화면 해제) - broadcastGameState 전에 전송
      io.emit('GAME_RESTART');

      // 모든 연결된 플레이어에게 게임 상태 업데이트 직접 전송
      connectedPlayers.forEach((socketId) => {
        const playerSocket =
          io.sockets.sockets.get(socketId);
        if (playerSocket) {
          playerSocket.emit('GAME_STATE_UPDATE', {
            currentRound: gameState.currentRound,
            stockPrices: getCurrentPrices(),
            currentNews: gameState.currentNews,
            currentNewsBriefing:
              gameState.currentNewsBriefing,
            isGameStarted: gameState.isGameStarted,
            isGameEnded: false,
            isPracticeMode: gameState.isPracticeMode,
            isWaitingMode: gameState.isWaitingMode,
            priceHistory: gameState.stockPrices,
            countdown: gameState.countdown,
            roundTimer: gameState.roundTimer,
            allowPlayerTrading:
              gameState.allowPlayerTrading,
          });
        }
      });

      // 게임 상태 브로드캐스트 (isGameEnded = false 포함)
      broadcastGameState();

      // 플레이어 리스트 브로드캐스트 (throttle 우회하여 강제 전송)
      lastPlayerListBroadcastTime = 0; // throttle 리셋하여 강제 실행
      broadcastPlayerList();
      persistGameState({ force: true });

      console.log(
        `[ADMIN_START_REAL_GAME] 실제 게임 시작 완료, isGameStarted: ${gameState.isGameStarted}, isWaitingMode: ${gameState.isWaitingMode}, connectedPlayers: ${connectedPlayers.size}명, playersData: ${playersData.size}명`
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
        const newGameId = createGameId();
        gameState.gameId = newGameId;
        dbHelpers.createGame(newGameId, false);
        console.log(
          `[ADMIN_START_GAME] 새 게임 ID 생성: ${newGameId}`
        );

        gameState.isPracticeMode = false;
        gameState.isGameStarted = true;
        gameState.isGameEnded = false; // 게임 종료 상태 해제
        gameState.isWaitingMode = false;
        gameState.currentRound = 0;
        gameState.scenarios = initialScenarios;
        gameSettings.totalRounds =
          gameState.scenarios.length;
        gameState.allowPlayerTrading = true;
        // 게임 종료 화면 숨김 상태도 리셋하기 위해 명시적으로 isGameEnded를 false로 설정
        // 가격 초기화
        STOCKS.forEach((stock) => {
          gameState.stockPrices[stock.id] = [
            stock.basePrice,
          ];
        });
        // 0라운드에서는 뉴스를 표시하지 않음 (1라운드부터 뉴스 표시)
        gameState.currentNews = '';
        gameState.currentNewsBriefing = [];

        // 실제 게임 플레이어 데이터 초기화 (자본금, 주식, 보너스 포인트 모두 초기화)
        // 연습 모드 플레이어 데이터도 함께 초기화 (이전 게임 기록 제거)
        practicePlayersData.forEach(
          (playerData, socketId) => {
            playerData.cash = INITIAL_CASH;
            playerData.bonusPoints = 0;
            playerData.totalAsset = INITIAL_CASH;
            playerData.transactions = [];
            playerData.hints = [];
            STOCKS.forEach((stock) => {
              playerData.stocks[stock.id] = 0;
            });
            PRACTICE_STOCKS.forEach((stock) => {
              playerData.stocks[stock.id] = 0;
            });
            // 데이터베이스도 초기화
            try {
              resetPlayerDbForNewGame(
                socketId,
                playerData,
                true
              );
            } catch (error) {
              console.error(
                `[ADMIN_START_GAME] 연습 모드 플레이어 데이터 초기화 오류: ${playerData.nickname}`,
                error
              );
            }
            // 플레이어에게 초기화된 데이터 전송
            const playerSocket =
              io.sockets.sockets.get(socketId);
            if (playerSocket) {
              playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
                cash: playerData.cash,
                stocks: playerData.stocks,
                bonusPoints: 0,
                totalAsset: playerData.totalAsset,
              });
              playerSocket.emit('PLAYER_HINTS_UPDATE', []);
            }
          }
        );

        playersData.forEach((playerData, socketId) => {
          // 메모리 데이터 초기화
          playerData.cash = INITIAL_CASH;
          playerData.bonusPoints = 0;
          playerData.totalAsset = INITIAL_CASH;
          playerData.transactions = [];
          playerData.hints = [];
          // 모든 주식 수량 0으로 초기화
          STOCKS.forEach((stock) => {
            playerData.stocks[stock.id] = 0;
          });
          // 연습 모드용 주식도 초기화 (혹시 모를 경우를 대비)
          PRACTICE_STOCKS.forEach((stock) => {
            playerData.stocks[stock.id] = 0;
          });

          // 데이터베이스 데이터도 초기화
          try {
            resetPlayerDbForNewGame(
              socketId,
              playerData,
              gameState.isPracticeMode
            );
          } catch (error) {
            console.error(
              `[ADMIN_START_GAME] 플레이어 데이터 초기화 오류: ${playerData.nickname}`,
              error
            );
          }

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
            // 힌트도 초기화된 상태로 전송
            playerSocket.emit('PLAYER_HINTS_UPDATE', []);
          }
        });

        // 라운드 타이머 시작
        startRoundTimer();
        // 게임 재시작 이벤트 전송 (게임 종료 화면 해제) - broadcastGameState 전에 전송
        io.emit('GAME_RESTART');
        // 게임 상태 브로드캐스트 (isGameEnded = false 포함)
        broadcastGameState();
        broadcastPlayerList();
        persistGameState({ force: true });
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
        persistGameState();

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

            // 라운드 전환 거래 로그에 기록
            const adminId = adminAuthMap.get(socket.id);
            const roundAdvanceLog = {
              type: 'ROUND_ADVANCE',
              timestamp: new Date().toISOString(),
              round: gameState.currentRound,
              adminId: adminId || '알 수 없음',
              message: `라운드 ${
                gameState.currentRound + 1
              }로 전환`,
            };

            transactionLogs.push(roundAdvanceLog);

            // 모든 관리자에게 거래 로그 전송
            adminSockets.forEach((adminSocket) => {
              adminSocket.emit(
                'TRANSACTION_LOG_UPDATE',
                roundAdvanceLog
              );
            });

            console.log(
              `라운드 ${
                gameState.currentRound + 1
              } 시작 (관리자: ${adminId || '알 수 없음'})`
            );
          } else if (gameState.isLastRound) {
            // 마지막 라운드: 뉴스를 먼저 보여주고, 게임 종료 처리는 나중에
            stopRoundTimer();
            broadcastGameState();
            console.log(
              `마지막 라운드 뉴스 표시 (라운드 ${
                gameState.currentRound + 1
              })`
            );
          } else {
            // 일반 게임 종료 (마지막 라운드가 아닌 경우)
            stopRoundTimer();
            handleGameEnd();
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

      // 연습 모드에서는 라운드 0에는 뉴스가 없음
      if (gameState.isPracticeMode) {
        if (gameState.currentRound === 0) {
          gameState.currentNews = '';
          gameState.currentNewsBriefing = [];
        } else {
          // 연습 모드: 라운드 1 → scenarios[0], 라운드 2 → scenarios[1], 라운드 3 → scenarios[2]
          const scenarioIndex = gameState.currentRound - 1;
          if (
            scenarioIndex >= 0 &&
            scenarioIndex < gameState.scenarios.length
          ) {
            const scenario =
              gameState.scenarios[scenarioIndex];
            gameState.currentNews = scenario.headline || '';
            gameState.currentNewsBriefing =
              scenario.newsBriefing || [];
          } else {
            gameState.currentNews = '';
            gameState.currentNewsBriefing = [];
          }
        }
      } else {
        // 실제 게임 모드: 라운드 1 → scenarios[0], 라운드 2 → scenarios[1], ...
        if (gameState.currentRound === 0) {
          gameState.currentNews = '';
          gameState.currentNewsBriefing = [];
        } else {
          // 실제 모드: 라운드 1 → scenarios[0], 라운드 2 → scenarios[1], ...
          const scenarioIndex = gameState.currentRound - 1;
          if (
            scenarioIndex >= 0 &&
            scenarioIndex < gameState.scenarios.length
          ) {
            const scenario =
              gameState.scenarios[scenarioIndex];
            gameState.currentNews = scenario.headline || '';
            gameState.currentNewsBriefing =
              scenario.newsBriefing || [];
          } else {
            gameState.currentNews = '';
            gameState.currentNewsBriefing = [];
          }
        }
      }

      // 이전 라운드로 이동 시 타이머 리셋
      startRoundTimer();
      broadcastGameState();
      console.log(
        `라운드 ${
          gameState.currentRound + 1
        }로 이동 (isPracticeMode: ${
          gameState.isPracticeMode
        }, currentNews: ${gameState.currentNews})`
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

      // 라운드 타이머 정리
      stopRoundTimer();

      // 게임 상태 초기화
      gameState.isGameStarted = false;
      gameState.isGameEnded = true;
      gameState.isWaitingMode = true;
      gameState.countdown = null;
      gameState.currentRound = 0;
      gameState.allowPlayerTrading = false;

      // 가격 초기화
      STOCKS.forEach((stock) => {
        gameState.stockPrices[stock.id] = [stock.basePrice];
      });
      gameState.currentNews = '';
      gameState.currentNewsBriefing = [];

      dbHelpers.markGameEnded(gameState.gameId);
      persistGameState({ force: true });

      // 플레이어 데이터 초기화 (다음 게임을 위해)
      const dataMap = gameState.isPracticeMode
        ? practicePlayersData
        : playersData;

      dataMap.forEach((playerData, socketId) => {
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
      });

      broadcastGameState();
      io.emit('GAME_END', {
        message:
          '관리자에 의해 게임이 종료되었습니다. 대기 모드로 전환됩니다.',
      });
      console.log(
        '관리자에 의해 게임 종료 (플레이어 데이터 초기화 완료)'
      );
    }
  });

  // 플레이어: 마지막 라운드 뉴스 확인 후 게임 종료 요청
  socket.on('PLAYER_REQUEST_END_GAME', () => {
    if (gameState.isLastRound && !gameState.isGameEnded) {
      stopRoundTimer();
      handleGameEnd();
      console.log(
        `[PLAYER_REQUEST_END_GAME] 플레이어가 게임 종료 요청: ${socket.id}`
      );
    }
  });

  // 관리자: 특정 플레이어 투자 차단 시작 (미니게임 진행 중)
  socket.on('ADMIN_BLOCK_TRADING_FOR_PLAYER', (data) => {
    if (adminSockets.has(socket)) {
      const { socketId, rewardAmount } = data;
      if (!socketId) {
        socket.emit('ADMIN_ERROR', {
          message: '플레이어를 선택해주세요.',
        });
        return;
      }

      // 플레이어 데이터 확인
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

      // 플레이어별 차단 상태 설정
      playerTradingBlocked.set(socketId, {
        isBlocked: true,
        rewardAmount: rewardAmount || null,
      });

      const adminId =
        adminAuthMap.get(socket.id) || '알 수 없음';
      console.log(
        `[ADMIN_BLOCK_TRADING_FOR_PLAYER] ${adminId}: ${
          playerData.nickname
        } 투자 차단 시작 (보상: ${rewardAmount || '미정'})`
      );

      // 해당 플레이어에게만 상태 업데이트 전송
      const playerSocket = io.sockets.sockets.get(socketId);
      if (playerSocket) {
        playerSocket.emit('PLAYER_TRADING_BLOCKED', {
          isBlocked: true,
          rewardAmount: rewardAmount || null,
        });
      }

      // 모든 관리자에게 성공 메시지 전송
      adminSockets.forEach((adminSocket) => {
        adminSocket.emit('ADMIN_SUCCESS', {
          message: `${playerData.nickname}님의 투자가 차단되었습니다. 미니게임에 집중할 수 있습니다.`,
        });
      });
    }
  });

  // 관리자: 특정 플레이어 투자 차단 해제 및 보상 지급
  socket.on('ADMIN_UNBLOCK_TRADING_FOR_PLAYER', (data) => {
    if (adminSockets.has(socket)) {
      const { socketId, success: isSuccess } = data;
      if (!socketId) {
        socket.emit('ADMIN_ERROR', {
          message: '플레이어를 선택해주세요.',
        });
        return;
      }

      // 플레이어 데이터 확인
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

      const blockedInfo =
        playerTradingBlocked.get(socketId);
      const rewardAmount = blockedInfo?.rewardAmount || 0;

      // 미니게임 성공 시 보상 지급
      if (isSuccess && rewardAmount > 0) {
        const currentGameId = gameState.gameId || 'legacy';
        const totalAsset = calculatePlayerTotalAsset(
          socketId,
          gameState.isPracticeMode
        );

        playerData.cash += rewardAmount;
        playerData.bonusPoints += rewardAmount;
        const newTotalAsset = totalAsset + rewardAmount;
        playerData.totalAsset = newTotalAsset;

        // DB 업데이트
        try {
          dbHelpers.updatePlayerCashById(
            playerData.dbId,
            playerData.cash,
            newTotalAsset,
            gameState.isPracticeMode
          );

          // 거래 로그 저장
          dbHelpers.saveTransaction(
            currentGameId,
            playerData.dbId,
            playerData.nickname,
            'POINTS',
            null,
            null,
            null,
            null,
            null,
            rewardAmount,
            null,
            null,
            gameState.currentRound,
            adminAuthMap.get(socket.id) || null,
            gameState.isPracticeMode
          );
        } catch (error) {
          console.error(
            `[ADMIN_UNBLOCK_TRADING_FOR_PLAYER] 보상 지급 중 오류: ${playerData.nickname}`,
            error
          );
        }

        // 플레이어에게 포트폴리오 업데이트 전송
        const playerSocket =
          io.sockets.sockets.get(socketId);
        if (playerSocket) {
          playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
            cash: playerData.cash,
            stocks: playerData.stocks,
            bonusPoints: playerData.bonusPoints,
            totalAsset: playerData.totalAsset,
          });

          // 미니게임 성공 알림 전송
          playerSocket.emit('MINIGAME_SUCCESS', {
            rewardAmount: rewardAmount,
            message: `미니게임 성공! ₩${rewardAmount.toLocaleString(
              'ko-KR'
            )} 보상을 받았습니다!`,
          });

          // 거래 내역 자동 업데이트
          try {
            const dbTransactions =
              dbHelpers.getTransactionsByPlayerId(
                currentGameId,
                playerData.dbId,
                gameState.isPracticeMode
              );

            // 데이터베이스 형식을 클라이언트 형식으로 변환
            const transactions = dbTransactions.map(
              (t) => ({
                type: t.type,
                stockId: t.stockId,
                stockName:
                  STOCKS.find((s) => s.id === t.stockId)
                    ?.name || t.stockId,
                quantity: t.quantity,
                price: t.price,
                totalCost: t.totalCost,
                totalRevenue: t.totalRevenue,
                points: t.points,
                difficulty: t.difficulty,
                hintPrice: t.hintPrice,
                round: t.round,
                timestamp: t.timestamp,
                adminId: t.adminId,
              })
            );

            playerSocket.emit(
              'PLAYER_TRANSACTIONS_UPDATE',
              transactions
            );
          } catch (error) {
            console.error(
              `[ADMIN_UNBLOCK_TRADING_FOR_PLAYER] 거래 내역 업데이트 중 오류: ${playerData.nickname}`,
              error
            );
          }
        }

        console.log(
          `[ADMIN_UNBLOCK_TRADING_FOR_PLAYER] ${
            playerData.nickname
          } 미니게임 성공! 보상 ₩${rewardAmount.toLocaleString(
            'ko-KR'
          )} 지급`
        );
      }

      // 차단 해제
      playerTradingBlocked.delete(socketId);

      const adminId =
        adminAuthMap.get(socket.id) || '알 수 없음';
      console.log(
        `[ADMIN_UNBLOCK_TRADING_FOR_PLAYER] ${adminId}: ${playerData.nickname} 투자 차단 해제 (성공: ${isSuccess})`
      );

      // 해당 플레이어에게 상태 업데이트 전송
      const playerSocket = io.sockets.sockets.get(socketId);
      if (playerSocket) {
        playerSocket.emit('PLAYER_TRADING_BLOCKED', {
          isBlocked: false,
          rewardAmount: null,
        });
      }

      // 모든 관리자에게 성공 메시지 전송
      adminSockets.forEach((adminSocket) => {
        adminSocket.emit('ADMIN_SUCCESS', {
          message: `${
            playerData.nickname
          }님의 투자 차단이 해제되었습니다.${
            isSuccess && rewardAmount > 0
              ? ` 보상 ₩${rewardAmount.toLocaleString(
                  'ko-KR'
                )} 지급 완료.`
              : ''
          }`,
        });
      });

      // 플레이어 리스트 업데이트
      broadcastPlayerList();
    }
  });

  // 관리자: 투자 차단 시작 (미니게임 진행 중) - 전체 차단 (하위 호환성)
  socket.on('ADMIN_BLOCK_TRADING', () => {
    if (adminSockets.has(socket)) {
      gameState.isTradingBlocked = true;
      const adminId =
        adminAuthMap.get(socket.id) || '알 수 없음';
      console.log(
        `[ADMIN_BLOCK_TRADING] ${adminId}: 투자 차단 시작 (미니게임 진행 중)`
      );
      // 모든 클라이언트에게 상태 업데이트 전송
      io.emit('GAME_STATE_UPDATE', {
        currentRound: gameState.currentRound,
        stockPrices: getCurrentPrices(),
        currentNews: gameState.currentNews,
        currentNewsBriefing: gameState.currentNewsBriefing,
        isGameStarted: gameState.isGameStarted,
        isGameEnded: gameState.isGameEnded,
        isPracticeMode: gameState.isPracticeMode,
        isWaitingMode: gameState.isWaitingMode,
        priceHistory: gameState.stockPrices,
        connectedPlayers: connectedPlayers.size,
        countdown: gameState.countdown,
        roundTimer: gameState.roundTimer,
        allowPlayerTrading: gameState.allowPlayerTrading,
        isTradingBlocked: gameState.isTradingBlocked,
      });
      persistGameState({ force: true });
      // 모든 관리자에게 성공 메시지 전송
      adminSockets.forEach((adminSocket) => {
        adminSocket.emit('ADMIN_SUCCESS', {
          message:
            '투자 차단이 시작되었습니다. 플레이어들은 미니게임에 집중할 수 있습니다.',
        });
      });
    }
  });

  // 관리자: 투자 차단 해제 (미니게임 종료)
  socket.on('ADMIN_UNBLOCK_TRADING', () => {
    if (adminSockets.has(socket)) {
      gameState.isTradingBlocked = false;
      const adminId =
        adminAuthMap.get(socket.id) || '알 수 없음';
      console.log(
        `[ADMIN_UNBLOCK_TRADING] ${adminId}: 투자 차단 해제 (미니게임 종료)`
      );
      // 모든 클라이언트에게 상태 업데이트 전송
      io.emit('GAME_STATE_UPDATE', {
        currentRound: gameState.currentRound,
        stockPrices: getCurrentPrices(),
        currentNews: gameState.currentNews,
        currentNewsBriefing: gameState.currentNewsBriefing,
        isGameStarted: gameState.isGameStarted,
        isGameEnded: gameState.isGameEnded,
        isPracticeMode: gameState.isPracticeMode,
        isWaitingMode: gameState.isWaitingMode,
        priceHistory: gameState.stockPrices,
        connectedPlayers: connectedPlayers.size,
        countdown: gameState.countdown,
        roundTimer: gameState.roundTimer,
        allowPlayerTrading: gameState.allowPlayerTrading,
        isTradingBlocked: gameState.isTradingBlocked,
      });
      persistGameState({ force: true });
      // 모든 관리자에게 성공 메시지 전송
      adminSockets.forEach((adminSocket) => {
        adminSocket.emit('ADMIN_SUCCESS', {
          message:
            '투자 차단이 해제되었습니다. 플레이어들은 다시 투자할 수 있습니다.',
        });
      });
    }
  });

  // 관리자: 전광판 메시지 브로드캐스트
  socket.on('ADMIN_BROADCAST_MESSAGE', (data) => {
    if (adminSockets.has(socket)) {
      const { message } = data;
      const adminId =
        adminAuthMap.get(socket.id) || '알 수 없음';
      console.log(`[전광판 메시지] ${adminId}: ${message}`);
      // 모든 클라이언트에게 메시지 전송
      io.emit('DISPLAY_MESSAGE', {
        message,
        adminId,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // 관리자: 전광판 메시지 종료
  socket.on('ADMIN_CLOSE_MESSAGE', () => {
    if (adminSockets.has(socket)) {
      const adminId =
        adminAuthMap.get(socket.id) || '알 수 없음';
      console.log(`[전광판 메시지 종료] ${adminId}`);
      // 모든 클라이언트에게 메시지 종료 신호 전송
      io.emit('CLOSE_DISPLAY_MESSAGE');
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

  // 관리자: 라운드별 찌라시 저장
  socket.on('ADMIN_SAVE_ROUND_RUMOR', (data) => {
    if (adminSockets.has(socket)) {
      const { round, rumor } = data;
      const currentGameId = gameState.gameId || 'legacy';
      try {
        dbHelpers.saveRoundRumor(
          currentGameId,
          round,
          rumor
        );
        socket.emit('ROUND_RUMOR_SAVED', { round, rumor });
        console.log(
          `[ADMIN_SAVE_ROUND_RUMOR] 라운드 ${round} 찌라시 저장 완료`
        );
      } catch (error) {
        console.error(
          '[ADMIN_SAVE_ROUND_RUMOR] 찌라시 저장 오류:',
          error
        );
        socket.emit('ADMIN_ERROR', {
          message: '찌라시 저장 중 오류가 발생했습니다.',
        });
      }
    }
  });

  // 관리자: 라운드별 힌트 저장
  socket.on('ADMIN_SAVE_ROUND_HINTS', (data) => {
    if (adminSockets.has(socket)) {
      const { round, hints } = data;
      const currentGameId = gameState.gameId || 'legacy';
      try {
        dbHelpers.saveRoundHints(
          currentGameId,
          round,
          hints
        );
        socket.emit('ROUND_HINTS_SAVED', { round, hints });
        console.log(
          `[ADMIN_SAVE_ROUND_HINTS] 라운드 ${round} 힌트 ${hints.length}개 저장 완료`
        );
      } catch (error) {
        console.error(
          '[ADMIN_SAVE_ROUND_HINTS] 힌트 저장 오류:',
          error
        );
        socket.emit('ADMIN_ERROR', {
          message: '힌트 저장 중 오류가 발생했습니다.',
        });
      }
    }
  });

  // 관리자: 라운드별 찌라시와 힌트 요청
  socket.on('ADMIN_REQUEST_ROUND_SCENARIOS', () => {
    if (adminSockets.has(socket)) {
      const currentGameId = gameState.gameId || 'legacy';
      try {
        const rumors =
          dbHelpers.getAllRoundRumors(currentGameId);
        const hints =
          dbHelpers.getAllRoundHints(currentGameId);

        // 라운드별로 그룹화
        const roundRumors = {};
        const roundHints = {};

        rumors.forEach((r) => {
          roundRumors[r.round] = r.rumor;
        });

        hints.forEach((h) => {
          if (!roundHints[h.round]) {
            roundHints[h.round] = [];
          }
          roundHints[h.round].push(h.hint_content);
        });

        socket.emit('ROUND_SCENARIOS_UPDATE', {
          roundRumors,
          roundHints,
        });
        console.log(
          `[ADMIN_REQUEST_ROUND_SCENARIOS] 라운드별 찌라시와 힌트 전송 완료`
        );
      } catch (error) {
        console.error(
          '[ADMIN_REQUEST_ROUND_SCENARIOS] 요청 오류:',
          error
        );
        socket.emit('ADMIN_ERROR', {
          message:
            '라운드별 찌라시와 힌트를 불러오는 중 오류가 발생했습니다.',
        });
      }
    }
  });

  // 관리자: 찌라시 전송 (게릴라 방식)
  socket.on('ADMIN_BROADCAST_RUMOR', (data) => {
    if (!adminSockets.has(socket)) return;
    const { round, rumor } = data;
    const adminId =
      adminAuthMap.get(socket.id) || '알 수 없음';

    console.log(
      `[ADMIN_BROADCAST_RUMOR] ${adminId}: 라운드 ${
        round + 1
      } 찌라시 전송`
    );

    // 모든 플레이어에게 찌라시 전송
    io.emit('PLAYER_RUMOR_UPDATE', {
      round: round + 1,
      rumor: rumor,
      timestamp: new Date().toISOString(),
    });

    socket.emit('ADMIN_ACTION_SUCCESS', {
      message: `라운드 ${
        round + 1
      }의 찌라시가 모든 플레이어에게 전송되었습니다.`,
    });
  });

  // 관리자: 랜덤 힌트 전송
  socket.on('ADMIN_BROADCAST_RANDOM_HINTS', (data) => {
    if (!adminSockets.has(socket)) return;
    const { round, hints } = data;
    const adminId =
      adminAuthMap.get(socket.id) || '알 수 없음';

    if (!hints || hints.length === 0) {
      socket.emit('ADMIN_ERROR', {
        message: '전송할 힌트가 없습니다.',
      });
      return;
    }

    console.log(
      `[ADMIN_BROADCAST_RANDOM_HINTS] ${adminId}: 라운드 ${
        round + 1
      } 랜덤 힌트 전송`
    );

    const dataMap = gameState.isPracticeMode
      ? practicePlayersData
      : playersData;
    const currentGameId = gameState.gameId || 'legacy';

    console.log(
      `[ADMIN_BROADCAST_RANDOM_HINTS] 플레이어 수: ${dataMap.size}, 힌트 수: ${hints.length}`
    );

    let successCount = 0;
    let failCount = 0;

    // 각 플레이어에게 랜덤 힌트 전송
    dataMap.forEach((playerData, socketId) => {
      try {
        // 랜덤 힌트 선택
        const randomHint =
          hints[Math.floor(Math.random() * hints.length)];

        console.log(
          `[ADMIN_BROADCAST_RANDOM_HINTS] ${
            playerData.nickname
          }에게 힌트 전송: ${randomHint.substring(
            0,
            30
          )}...`
        );

        // 힌트 부여
        const hint = {
          difficulty: '랜덤',
          content: randomHint,
          receivedAt: new Date().toISOString(),
          price: 0,
          round: round,
        };

        if (!playerData.hints) {
          playerData.hints = [];
        }
        playerData.hints.push(hint);

        // 데이터베이스에 힌트 저장
        if (playerData.dbId) {
          try {
            dbHelpers.saveHint(
              currentGameId,
              playerData.dbId,
              '랜덤',
              randomHint,
              0,
              round,
              gameState.isPracticeMode
            );
          } catch (error) {
            console.error(
              `[랜덤 힌트 저장 오류] ${playerData.nickname}:`,
              error
            );
          }
        }

        // 플레이어에게 힌트 업데이트 전송
        const playerSocket =
          io.sockets.sockets.get(socketId);
        if (playerSocket) {
          playerSocket.emit(
            'PLAYER_HINTS_UPDATE',
            playerData.hints
          );
          playerSocket.emit('PLAYER_RUMOR_UPDATE', {
            round: round + 1,
            rumor: randomHint,
            timestamp: new Date().toISOString(),
          });
          successCount++;
          console.log(
            `[ADMIN_BROADCAST_RANDOM_HINTS] ${playerData.nickname}에게 힌트 전송 완료`
          );
        } else {
          failCount++;
          console.warn(
            `[ADMIN_BROADCAST_RANDOM_HINTS] ${playerData.nickname}의 소켓을 찾을 수 없음 (socketId: ${socketId})`
          );
        }
      } catch (error) {
        failCount++;
        console.error(
          `[ADMIN_BROADCAST_RANDOM_HINTS] ${playerData.nickname}에게 힌트 전송 중 오류:`,
          error
        );
      }
    });

    console.log(
      `[ADMIN_BROADCAST_RANDOM_HINTS] 전송 완료 - 성공: ${successCount}명, 실패: ${failCount}명`
    );

    socket.emit('ADMIN_ACTION_SUCCESS', {
      message: `라운드 ${
        round + 1
      }의 랜덤 힌트가 모든 플레이어에게 전송되었습니다.`,
    });
  });

  // 플레이어: 주식 매수
  socket.on('PLAYER_BUY_STOCK', (data) => {
    // 미니게임 진행 중 투자가 차단되어 있으면 거부
    if (gameState.isTradingBlocked) {
      socket.emit('TRANSACTION_ERROR', {
        message:
          '현재 미니게임이 진행 중입니다. 미니게임이 끝날 때까지 투자를 할 수 없습니다.',
      });
      return;
    }
    // 플레이어 직접 거래가 비활성화되어 있으면 거부
    if (!gameState.allowPlayerTrading) {
      socket.emit('TRANSACTION_ERROR', {
        message:
          '현재 온라인 거래가 비활성화되어 있습니다. 관리자에게 문의하세요.',
      });
      return;
    }

    const { stockId, quantity } = data;
    const dataMap = gameState.isPracticeMode
      ? practicePlayersData
      : playersData;
    let playerData = dataMap.get(socket.id);

    // 플레이어 데이터를 찾지 못한 경우, 다른 맵에서도 확인
    if (!playerData) {
      const otherDataMap = gameState.isPracticeMode
        ? playersData
        : practicePlayersData;
      playerData = otherDataMap.get(socket.id);

      // 다른 맵에서 찾았으면 올바른 맵으로 이동
      if (playerData) {
        console.log(
          `[PLAYER_BUY_STOCK] 플레이어 데이터를 다른 맵에서 발견, 올바른 맵으로 이동: ${playerData.nickname}, isPracticeMode: ${gameState.isPracticeMode}`
        );
        otherDataMap.delete(socket.id);
        dataMap.set(socket.id, playerData);
      }
    }

    if (!playerData) {
      console.error(
        `[PLAYER_BUY_STOCK] 플레이어 데이터를 찾을 수 없음 - socket.id: ${socket.id}, isPracticeMode: ${gameState.isPracticeMode}, practicePlayersData.size: ${practicePlayersData.size}, playersData.size: ${playersData.size}`
      );
      socket.emit('TRANSACTION_ERROR', {
        message: '플레이어 데이터를 찾을 수 없습니다.',
      });
      return;
    }

    const currentPrices = getCurrentPrices();
    const price = currentPrices[stockId];

    console.log(
      `[PLAYER_BUY_STOCK] 연습 모드: ${gameState.isPracticeMode}, stockId: ${stockId}, currentPrices:`,
      currentPrices
    );
    console.log(
      `[PLAYER_BUY_STOCK] price: ${price}, quantity: ${quantity}`
    );

    // 가격이 없으면 거래 실패
    if (
      price === undefined ||
      price === null ||
      isNaN(price) ||
      price <= 0
    ) {
      console.error(
        `[PLAYER_BUY_STOCK] 가격 오류 - stockId: ${stockId}, price: ${price}, currentPrices:`,
        currentPrices
      );
      socket.emit('TRANSACTION_ERROR', {
        message: `주식 가격을 찾을 수 없습니다. (종목: ${stockId}, 가격: ${price})`,
      });
      return;
    }

    const totalCost = price * quantity;

    if (isNaN(totalCost)) {
      console.error(
        `[PLAYER_BUY_STOCK] totalCost 계산 오류 - price: ${price}, quantity: ${quantity}`
      );
      socket.emit('TRANSACTION_ERROR', {
        message: `거래 금액 계산 오류가 발생했습니다.`,
      });
      return;
    }

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
      try {
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
        const currentGameId = gameState.gameId || 'legacy';
        dbHelpers.savePlayerStock(
          currentGameId,
          playerData.dbId,
          stockId,
          playerData.stocks[stockId],
          gameState.isPracticeMode
        );
        dbHelpers.saveTransaction(
          currentGameId,
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
      } catch (error) {
        console.error(
          `[PLAYER_BUY_STOCK] 데이터베이스 저장 오류: ${playerData.nickname}`,
          error
        );
      }
    } else {
      console.warn(
        `[PLAYER_BUY_STOCK] playerData.dbId가 없어서 거래 로그를 저장할 수 없습니다: ${playerData.nickname}`
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

    // 체결 알림 전송 (매수)
    const stock = gameState.isPracticeMode
      ? PRACTICE_STOCKS.find((s) => s.id === stockId)
      : STOCKS.find((s) => s.id === stockId);
    const stockName = stock ? stock.name : stockId;

    // 매수 시에는 평균 매수가 계산 (이미 보유한 주식이 있는 경우)
    let averagePrice = price;
    if (
      playerData.transactions &&
      playerData.transactions.length > 0
    ) {
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
    }

    socket.emit('TRADE_EXECUTED', {
      type: 'BUY',
      stockName: stockName,
      quantity: quantity,
      averagePrice: averagePrice,
    });

    // 관리자에게 플레이어 리스트 업데이트
    broadcastPlayerList();
    // 순위 업데이트를 위해 게임 상태 브로드캐스트
    broadcastGameState();
    const mode = gameState.isPracticeMode
      ? '[연습]'
      : '[실제]';
    console.log(
      `${mode} ${
        playerData.nickname
      } 매수: ${stockId} ${quantity}주 (${
        price ? price.toLocaleString('ko-KR') : 'NaN'
      }원, 총 ${
        totalCost
          ? totalCost.toLocaleString('ko-KR')
          : 'NaN'
      }원)`
    );
  });

  // 플레이어: 거래 내역 요청
  socket.on('PLAYER_REQUEST_TRANSACTIONS', () => {
    const dataMap = gameState.isPracticeMode
      ? practicePlayersData
      : playersData;
    const playerData = dataMap.get(socket.id);

    if (!playerData || !playerData.dbId) {
      socket.emit('PLAYER_TRANSACTIONS_UPDATE', []);
      return;
    }

    try {
      // 데이터베이스에서 플레이어의 거래 내역 가져오기
      const currentGameId = gameState.gameId || 'legacy';
      const dbTransactions =
        dbHelpers.getTransactionsByPlayerId(
          currentGameId,
          playerData.dbId,
          gameState.isPracticeMode
        );

      // 데이터베이스 형식을 클라이언트 형식으로 변환
      const transactions = dbTransactions.map((t) => ({
        type: t.type,
        stockId: t.stockId,
        stockName:
          STOCKS.find((s) => s.id === t.stockId)?.name ||
          t.stockId,
        quantity: t.quantity,
        price: t.price,
        totalCost: t.totalCost,
        totalRevenue: t.totalRevenue,
        points: t.points,
        difficulty: t.difficulty,
        hintPrice: t.hintPrice,
        round: t.round,
        timestamp: t.timestamp,
        adminId: t.adminId,
      }));

      socket.emit(
        'PLAYER_TRANSACTIONS_UPDATE',
        transactions
      );
    } catch (error) {
      console.error(
        `[PLAYER_REQUEST_TRANSACTIONS] 오류: ${playerData.nickname}`,
        error
      );
      socket.emit('PLAYER_TRANSACTIONS_UPDATE', []);
    }
  });

  // 플레이어: 주식 매도
  socket.on('PLAYER_SELL_STOCK', (data) => {
    // 개별 플레이어 투자 차단 확인
    const playerBlocked = playerTradingBlocked.get(
      socket.id
    );
    if (playerBlocked && playerBlocked.isBlocked) {
      socket.emit('TRANSACTION_ERROR', {
        message:
          '현재 미니게임이 진행 중입니다. 미니게임이 끝날 때까지 투자를 할 수 없습니다.',
      });
      return;
    }
    // 전체 투자 차단 확인 (하위 호환성)
    if (gameState.isTradingBlocked) {
      socket.emit('TRANSACTION_ERROR', {
        message:
          '현재 미니게임이 진행 중입니다. 미니게임이 끝날 때까지 투자를 할 수 없습니다.',
      });
      return;
    }
    // 플레이어 직접 거래가 비활성화되어 있으면 거부
    if (!gameState.allowPlayerTrading) {
      socket.emit('TRANSACTION_ERROR', {
        message:
          '현재 온라인 거래가 비활성화되어 있습니다. 관리자에게 문의하세요.',
      });
      return;
    }

    const { stockId, quantity } = data;
    const dataMap = gameState.isPracticeMode
      ? practicePlayersData
      : playersData;
    let playerData = dataMap.get(socket.id);

    // 플레이어 데이터를 찾지 못한 경우, 다른 맵에서도 확인
    if (!playerData) {
      const otherDataMap = gameState.isPracticeMode
        ? playersData
        : practicePlayersData;
      playerData = otherDataMap.get(socket.id);

      // 다른 맵에서 찾았으면 올바른 맵으로 이동
      if (playerData) {
        console.log(
          `[PLAYER_SELL_STOCK] 플레이어 데이터를 다른 맵에서 발견, 올바른 맵으로 이동: ${playerData.nickname}, isPracticeMode: ${gameState.isPracticeMode}`
        );
        otherDataMap.delete(socket.id);
        dataMap.set(socket.id, playerData);
      }
    }

    if (!playerData) {
      console.error(
        `[PLAYER_SELL_STOCK] 플레이어 데이터를 찾을 수 없음 - socket.id: ${socket.id}, isPracticeMode: ${gameState.isPracticeMode}, practicePlayersData.size: ${practicePlayersData.size}, playersData.size: ${playersData.size}`
      );
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
      try {
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
        const currentGameId = gameState.gameId || 'legacy';
        dbHelpers.savePlayerStock(
          currentGameId,
          playerData.dbId,
          stockId,
          playerData.stocks[stockId],
          gameState.isPracticeMode
        );
        dbHelpers.saveTransaction(
          currentGameId,
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
          null, // 플레이어 직접 거래는 adminId 없음
          gameState.isPracticeMode
        );
      } catch (error) {
        console.error(
          `[PLAYER_SELL_STOCK] 데이터베이스 저장 오류: ${playerData.nickname}`,
          error
        );
      }
    } else {
      console.warn(
        `[PLAYER_SELL_STOCK] playerData.dbId가 없어서 거래 로그를 저장할 수 없습니다: ${playerData.nickname}`
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

    // 체결 알림 전송 (매도)
    const stock = gameState.isPracticeMode
      ? PRACTICE_STOCKS.find((s) => s.id === stockId)
      : STOCKS.find((s) => s.id === stockId);
    const stockName = stock ? stock.name : stockId;

    socket.emit('TRADE_EXECUTED', {
      type: 'SELL',
      stockName: stockName,
      quantity: quantity,
      averagePrice: price, // 매도 시에는 현재 매도 가격 사용
    });

    // 관리자에게 플레이어 리스트 업데이트
    broadcastPlayerList();
    // 순위 업데이트를 위해 게임 상태 브로드캐스트
    broadcastGameState();
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
        try {
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
          const currentGameId =
            gameState.gameId || 'legacy';
          dbHelpers.savePlayerStock(
            currentGameId,
            playerData.dbId,
            stockId,
            playerData.stocks[stockId],
            gameState.isPracticeMode
          );
          dbHelpers.saveTransaction(
            currentGameId,
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
        } catch (error) {
          console.error(
            `[ADMIN_EXECUTE_TRADE BUY] 데이터베이스 저장 오류: ${playerData.nickname}`,
            error
          );
        }
      } else {
        console.warn(
          `[ADMIN_EXECUTE_TRADE BUY] playerData.dbId가 없어서 거래 로그를 저장할 수 없습니다: ${playerData.nickname}`
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
        try {
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
          const currentGameId =
            gameState.gameId || 'legacy';
          dbHelpers.savePlayerStock(
            currentGameId,
            playerData.dbId,
            stockId,
            playerData.stocks[stockId],
            gameState.isPracticeMode
          );
          dbHelpers.saveTransaction(
            currentGameId,
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
        } catch (error) {
          console.error(
            `[ADMIN_EXECUTE_TRADE SELL] 데이터베이스 저장 오류: ${playerData.nickname}`,
            error
          );
        }
      } else {
        console.warn(
          `[ADMIN_EXECUTE_TRADE SELL] playerData.dbId가 없어서 거래 로그를 저장할 수 없습니다: ${playerData.nickname}`
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
      try {
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
        const currentGameId = gameState.gameId || 'legacy';
        dbHelpers.saveTransaction(
          currentGameId,
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
      } catch (error) {
        console.error(
          `[ADMIN_ADD_POINTS] 데이터베이스 저장 오류: ${playerData.nickname}`,
          error
        );
      }
    } else {
      console.warn(
        `[ADMIN_ADD_POINTS] playerData.dbId가 없어서 거래 로그를 저장할 수 없습니다: ${playerData.nickname}`
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

  // 관리자: 모든 플레이어에게 포인트 추가
  socket.on('ADMIN_ADD_POINTS_TO_ALL', (data) => {
    if (!adminSockets.has(socket)) return;

    // 게임이 시작되지 않았으면 포인트 지급 불가
    if (!gameState.isGameStarted) {
      socket.emit('ADMIN_ERROR', {
        message:
          '게임이 시작되지 않았습니다. 게임을 시작한 후 포인트를 지급할 수 있습니다.',
      });
      return;
    }

    const { points, source } = data; // source: 'minigame' 또는 undefined
    const dataMap = gameState.isPracticeMode
      ? practicePlayersData
      : playersData;
    const adminId = adminAuthMap.get(socket.id) || null;
    const transactionType =
      source === 'minigame'
        ? 'MINIGAME_REWARD'
        : 'BONUS_POINTS';

    let successCount = 0;
    let failCount = 0;

    // 모든 플레이어에게 포인트 추가
    dataMap.forEach((playerData, socketId) => {
      try {
        // 포인트를 cash에 직접 추가
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
          dbHelpers.saveTransaction(
            currentGameId,
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

        // 거래 로그 생성
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
        transactionLogs.push(bonusTransaction);

        // 플레이어에게 업데이트 전송
        const playerSocket =
          io.sockets.sockets.get(socketId);
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
          playerSocket.emit('BONUS_POINTS_ADDED', {
            points: points,
            totalBonusPoints: playerData.bonusPoints,
            source: source,
            round: gameState.currentRound,
          });
        }

        successCount++;
      } catch (error) {
        console.error(
          `[ADMIN_ADD_POINTS_TO_ALL] 오류: ${playerData.nickname}`,
          error
        );
        failCount++;
      }
    });

    // 모든 관리자에게 거래 로그 전송
    adminSockets.forEach((adminSocket) => {
      adminSocket.emit(
        'TRANSACTION_LOGS_INIT',
        transactionLogs
      );
    });

    // 관리자에게 플레이어 리스트 업데이트
    broadcastPlayerList();
    // 순위 업데이트를 위해 게임 상태 브로드캐스트
    broadcastGameState();
    const mode = gameState.isPracticeMode
      ? '[연습]'
      : '[실제]';
    console.log(
      `${mode} 모든 플레이어에게 ${points}포인트 추가 완료 (성공: ${successCount}명, 실패: ${failCount}명)`
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
        `[${difficulty}] 힌트 내용이 아직 없습니다.`,
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
      try {
        const currentGameId = gameState.gameId || 'legacy';
        dbHelpers.saveHint(
          currentGameId,
          playerData.dbId,
          difficulty,
          hintContent ||
            `[${difficulty}] 힌트 내용이 아직 없습니다.`,
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
          currentGameId,
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
      } catch (error) {
        console.error(
          `[ADMIN_GRANT_HINT] 데이터베이스 저장 오류: ${playerData.nickname}`,
          error
        );
      }
    } else {
      console.warn(
        `[ADMIN_GRANT_HINT] playerData.dbId가 없어서 거래 로그를 저장할 수 없습니다: ${playerData.nickname}`
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
      `${mode} ${playerData.nickname}에게 ${difficulty} 힌트 부여 (₩${priceNum})`
    );
  });

  // 관리자: 모든 플레이어에게 힌트 부여
  socket.on('ADMIN_GRANT_HINT_TO_ALL', (data) => {
    if (!adminSockets.has(socket)) return;

    // 게임이 시작되지 않았으면 힌트 부여 불가
    if (!gameState.isGameStarted) {
      socket.emit('ADMIN_ERROR', {
        message:
          '게임이 시작되지 않았습니다. 게임을 시작한 후 힌트를 부여할 수 있습니다.',
      });
      return;
    }

    const { difficulty, price, hintContent } = data;
    const dataMap = gameState.isPracticeMode
      ? practicePlayersData
      : playersData;
    const adminId = adminAuthMap.get(socket.id) || null;

    const priceNum = parseInt(price);
    if (isNaN(priceNum) || priceNum < 0) {
      socket.emit('ADMIN_ERROR', {
        message: '올바른 금액을 입력해주세요.',
      });
      return;
    }

    let successCount = 0;
    let failCount = 0;
    let insufficientCashCount = 0;

    // 모든 플레이어에게 힌트 부여
    dataMap.forEach((playerData, socketId) => {
      try {
        // priceNum이 0이면 포인트 차감 없이 힌트 지급
        if (priceNum > 0) {
          const totalCash =
            playerData.cash + (playerData.bonusPoints || 0);

          // 현금이 부족한 플레이어는 스킵
          if (totalCash < priceNum) {
            insufficientCashCount++;
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
              const remaining =
                priceNum - playerData.bonusPoints;
              playerData.bonusPoints = 0;
              playerData.cash -= remaining;
            }
          }
        }

        // 힌트 부여
        const hint = {
          difficulty: difficulty,
          content:
            hintContent ||
            `[${difficulty}] 힌트 내용이 아직 없습니다.`,
          receivedAt: new Date().toISOString(),
          price: priceNum,
          round: gameState.currentRound,
        };

        if (!playerData.hints) {
          playerData.hints = [];
        }
        playerData.hints.push(hint);

        // 데이터베이스에 힌트 저장
        if (playerData.dbId) {
          const currentGameId =
            gameState.gameId || 'legacy';
          dbHelpers.saveHint(
            currentGameId,
            playerData.dbId,
            difficulty,
            hintContent ||
              `[${difficulty}] 힌트 내용이 아직 없습니다.`,
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
          dbHelpers.saveTransaction(
            currentGameId,
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
        transactionLogs.push(hintTransaction);

        // 플레이어에게 업데이트 전송
        const playerSocket =
          io.sockets.sockets.get(socketId);
        if (playerSocket) {
          const totalAsset = calculatePlayerTotalAsset(
            socketId,
            gameState.isPracticeMode
          );
          playerData.totalAsset = totalAsset;
          playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
            cash: playerData.cash,
            stocks: playerData.stocks,
            bonusPoints: playerData.bonusPoints || 0,
            totalAsset: totalAsset,
          });
          playerSocket.emit(
            'PLAYER_HINTS_UPDATE',
            playerData.hints || []
          );
        }

        successCount++;
      } catch (error) {
        console.error(
          `[ADMIN_GRANT_HINT_TO_ALL] 오류: ${playerData.nickname}`,
          error
        );
        failCount++;
      }
    });

    // 모든 관리자에게 거래 로그 전송
    adminSockets.forEach((adminSocket) => {
      adminSocket.emit(
        'TRANSACTION_LOGS_INIT',
        transactionLogs
      );
    });

    // 관리자에게 플레이어 리스트 업데이트
    broadcastPlayerList();
    const mode = gameState.isPracticeMode
      ? '[연습]'
      : '[실제]';
    console.log(
      `${mode} 모든 플레이어에게 ${difficulty} 힌트 부여 완료 (성공: ${successCount}명, 실패: ${failCount}명, 현금 부족: ${insufficientCashCount}명)`
    );
  });

  // 관리자: 플레이어 리스트 요청
  socket.on('ADMIN_REQUEST_PLAYER_LIST', () => {
    if (adminSockets.has(socket)) {
      broadcastPlayerList();
    }
  });

  // 관리자: 플레이어 직접 거래 활성화/비활성화 토글
  socket.on('ADMIN_TOGGLE_PLAYER_TRADING', () => {
    if (!adminSockets.has(socket)) return;

    gameState.allowPlayerTrading =
      !gameState.allowPlayerTrading;
    broadcastGameState();

    const adminId =
      adminAuthMap.get(socket.id) || '알 수 없음';
    const status = gameState.allowPlayerTrading
      ? '활성화'
      : '비활성화';
    console.log(
      `[온라인 거래 ${status}] ${adminId}에 의해 플레이어 직접 거래가 ${status}되었습니다.`
    );

    socket.emit('ADMIN_ACTION_SUCCESS', {
      message: `플레이어 직접 거래가 ${status}되었습니다.`,
    });
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
    const isPractice = gameState.isPracticeMode;

    let playerData = dataMap.get(socketId);
    let playerDbId = null;
    let playerNickname = null;

    // 오프라인 플레이어인 경우 (socketId가 'offline_'으로 시작)
    if (socketId && socketId.startsWith('offline_')) {
      const dbId = parseInt(
        socketId.replace('offline_', '')
      );
      if (!isNaN(dbId)) {
        const dbPlayer = dbHelpers.getPlayerById(dbId);
        if (
          dbPlayer &&
          dbPlayer.is_practice === (isPractice ? 1 : 0)
        ) {
          playerDbId = dbId;
          playerNickname = dbPlayer.nickname;
          console.log(
            '[서버] 오프라인 플레이어 찾음:',
            playerNickname,
            'dbId:',
            playerDbId
          );
        } else {
          console.log(
            '[서버] 오프라인 플레이어를 데이터베이스에서 찾을 수 없음:',
            dbId
          );
          socket.emit('ADMIN_ERROR', {
            message: '플레이어를 찾을 수 없습니다.',
          });
          return;
        }
      } else {
        console.log(
          '[서버] 잘못된 오프라인 플레이어 ID:',
          socketId
        );
        socket.emit('ADMIN_ERROR', {
          message: '플레이어를 찾을 수 없습니다.',
        });
        return;
      }
    } else if (playerData) {
      // 온라인 플레이어인 경우
      playerDbId = playerData.dbId;
      playerNickname = playerData.nickname;
      console.log(
        '[서버] 온라인 플레이어 데이터 찾음:',
        playerNickname,
        'dbId:',
        playerDbId
      );

      // 플레이어 소켓이 있으면 연결 끊기
      const playerSocket = io.sockets.sockets.get(socketId);
      if (playerSocket) {
        playerSocket.emit('ADMIN_DELETE', {
          message: '관리자에 의해 계정이 삭제되었습니다.',
        });
        playerSocket.disconnect();
      }

      // 메모리에서 데이터 정리
      connectedPlayers.delete(socketId);
      dataMap.delete(socketId);
    } else {
      // 메모리에 없으면 데이터베이스에서 socket_id로 찾기 (오프라인 플레이어)
      console.log(
        '[서버] 메모리에 없음, 데이터베이스에서 socket_id로 검색:',
        socketId
      );
      const dbPlayer = dbHelpers.getPlayer(
        socketId,
        isPractice
      );
      if (dbPlayer) {
        playerDbId = dbPlayer.id;
        playerNickname = dbPlayer.nickname;
        console.log(
          '[서버] 데이터베이스에서 플레이어 찾음:',
          playerNickname,
          'dbId:',
          playerDbId
        );
      } else {
        console.log(
          '[서버] 플레이어 데이터를 찾을 수 없음:',
          socketId
        );
        socket.emit('ADMIN_ERROR', {
          message: '플레이어를 찾을 수 없습니다.',
        });
        return;
      }
    }

    // 데이터베이스에서 완전 삭제 (재로그인 불가)
    if (playerDbId) {
      try {
        dbHelpers.deletePlayer(playerDbId, isPractice);
        console.log(
          `플레이어 데이터 완전 삭제: ${playerNickname} (ID: ${playerDbId}) - 재로그인 불가`
        );
      } catch (error) {
        console.error(
          `플레이어 삭제 중 오류 발생: ${playerNickname} (ID: ${playerDbId})`,
          error
        );
        socket.emit('ADMIN_ERROR', {
          message: '플레이어 삭제 중 오류가 발생했습니다.',
        });
        return;
      }
    }

    console.log(
      `플레이어 삭제 완료: ${playerNickname}, 남은 플레이어: ${dataMap.size}명`
    );

    // 관리자에게 플레이어 리스트 업데이트 (즉시)
    if (adminSockets.size > 0) {
      adminSockets.forEach((adminSocket) => {
        adminSocket.emit(
          'PLAYER_COUNT_UPDATE',
          connectedPlayers.size
        );
      });
      // 즉시 리스트 업데이트 (삭제된 플레이어는 데이터베이스에서 제외됨)
      broadcastPlayerList();
    }

    // 삭제 성공 메시지 전송
    socket.emit('ADMIN_ACTION_SUCCESS', {
      message: `${playerNickname}님의 데이터가 삭제되었습니다.`,
    });

    const mode = isPractice ? '[연습]' : '[실제]';
    console.log(
      `${mode} 플레이어 삭제 완료: ${playerNickname}`
    );
  });

  // 관리자: 모든 플레이어 삭제
  socket.on('ADMIN_DELETE_ALL_PLAYERS', (data) => {
    console.log(
      '[서버] ADMIN_DELETE_ALL_PLAYERS 이벤트 수신:',
      data
    );
    if (!adminSockets.has(socket)) {
      console.log(
        '[서버] 관리자가 아닌 소켓에서 모든 플레이어 삭제 요청'
      );
      return;
    }

    const { isPractice = false } = data || {};
    console.log(
      `[서버] 모든 플레이어 삭제 시작 (모드: ${
        isPractice ? '연습' : '실제'
      })`
    );

    try {
      // 데이터베이스에서 모든 플레이어 삭제
      // gameId를 null로 전달하면 모든 게임의 플레이어 삭제
      const currentGameId = gameState.gameId || null;
      const deletedCount = dbHelpers.deleteAllPlayers(
        currentGameId,
        isPractice
      );
      console.log(
        `[서버] 데이터베이스에서 ${deletedCount}명의 플레이어 삭제 완료`
      );

      // 메모리에서도 모든 플레이어 데이터 제거
      const dataMap = isPractice
        ? practicePlayersData
        : playersData;
      const connectedPlayersMap = isPractice
        ? practiceConnectedPlayers
        : connectedPlayers;

      // 모든 연결된 플레이어 강제 연결 해제
      connectedPlayersMap.forEach(
        (playerSocket, socketId) => {
          if (playerSocket) {
            playerSocket.emit('FORCE_LOGOUT', {
              message:
                '관리자에 의해 모든 플레이어 데이터가 삭제되었습니다.',
            });
            playerSocket.disconnect();
          }
        }
      );

      // 메모리 데이터 초기화
      dataMap.clear();
      connectedPlayersMap.clear();

      // 관리자에게 플레이어 리스트 업데이트
      if (adminSockets.size > 0) {
        adminSockets.forEach((adminSocket) => {
          adminSocket.emit(
            'PLAYER_COUNT_UPDATE',
            connectedPlayers.size
          );
        });
        broadcastPlayerList();
      }

      const mode = isPractice ? '[연습]' : '[실제]';
      console.log(
        `${mode} 모든 플레이어 삭제 완료: ${deletedCount}명`
      );

      socket.emit('ADMIN_ACTION_SUCCESS', {
        message: `${deletedCount}명의 플레이어 데이터가 모두 삭제되었습니다.`,
      });
    } catch (error) {
      console.error(
        '모든 플레이어 삭제 중 오류 발생:',
        error
      );
      socket.emit('ADMIN_ERROR', {
        message: '플레이어 삭제 중 오류가 발생했습니다.',
      });
    }
  });

  // 관리자: 모든 거래로그 삭제
  socket.on('ADMIN_CLEAR_ALL_TRANSACTIONS', (data) => {
    console.log(
      '[서버] ADMIN_CLEAR_ALL_TRANSACTIONS 이벤트 수신:',
      data
    );
    if (!adminSockets.has(socket)) {
      console.log(
        '[서버] 관리자가 아닌 소켓에서 거래로그 삭제 요청'
      );
      return;
    }

    const { isPractice = false } = data || {};
    console.log(
      `[서버] 모든 거래로그 삭제 시작 (모드: ${
        isPractice ? '연습' : '실제'
      })`
    );

    try {
      // 데이터베이스에서 모든 거래 내역 삭제
      // gameId를 null로 전달하면 모든 게임의 거래 내역 삭제
      const currentGameId = gameState.gameId || null;
      const deletedCount = dbHelpers.clearAllTransactions(
        currentGameId,
        isPractice
      );
      console.log(
        `[서버] 데이터베이스에서 ${deletedCount}개의 거래 내역 삭제 완료`
      );

      // 메모리의 거래로그도 초기화 (isPractice 모드에 맞게 필터링)
      transactionLogs.length = 0;
      console.log(
        '[서버] 메모리의 거래로그 배열 초기화 완료'
      );

      // 관리자에게 거래로그 리스트 업데이트 (빈 배열 전송)
      if (adminSockets.size > 0) {
        adminSockets.forEach((adminSocket) => {
          adminSocket.emit('TRANSACTION_LOGS_INIT', []);
          adminSocket.emit('TRANSACTION_LOGS_UPDATE', []);
        });
      }

      const mode = isPractice ? '[연습]' : '[실제]';
      console.log(
        `${mode} 모든 거래로그 삭제 완료: ${deletedCount}개`
      );

      socket.emit('ADMIN_ACTION_SUCCESS', {
        message: `${deletedCount}개의 거래 내역이 모두 삭제되었습니다.`,
      });
    } catch (error) {
      console.error(
        '모든 거래로그 삭제 중 오류 발생:',
        error
      );
      socket.emit('ADMIN_ERROR', {
        message: '거래로그 삭제 중 오류가 발생했습니다.',
      });
    }
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

      // 모든 클라이언트에게 게임 상태 업데이트 (DisplayBoard용 playerCount 포함)
      broadcastGameState();

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
