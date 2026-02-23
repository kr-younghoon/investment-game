import {
  STOCKS,
  initialScenarios,
  PRACTICE_STOCKS,
  practiceScenarios,
} from '../src/data/initialScenarios.js';

/**
 * StateManager - 모든 게임 상태를 중앙에서 관리하는 클래스
 */
class StateManager {
  constructor() {
    // 게임 상태
    this.gameState = {
      currentRound: 0,
      stockPrices: {},
      currentNews: '',
      currentNewsBriefing: [],
      isGameStarted: false,
      isGameEnded: false,
      isPracticeMode: false,
      isWaitingMode: true,
      scenarios: initialScenarios,
      countdown: null,
      roundTimer: null,
      allowPlayerTrading: false,
      isTradingBlocked: false,
      isLastRound: false,
      gameId: null,
    };

    // 게임 설정
    this.INITIAL_CASH = 3000000;
    this.gameSettings = {
      initialCash: this.INITIAL_CASH,
      totalRounds: initialScenarios.length,
    };

    // 플레이어 데이터
    this.playersData = new Map();
    this.practicePlayersData = new Map();
    this.connectedPlayers = new Set();
    this.practiceConnectedPlayers = new Set();

    // 관리자 데이터
    this.adminSockets = new Set();
    this.adminAuthMap = new Map();

    // 디스플레이 소켓
    this.displaySockets = new Set();

    // 플레이어별 투자 차단 상태
    this.playerTradingBlocked = new Map();

    // 거래 로그 (메모리 제한: 최대 1000개)
    this.transactionLogs = [];
    this.MAX_TRANSACTION_LOGS = 1000;

    // 타이머 인터벌
    this.countdownInterval = null;
    this.roundTimerInterval = null;

    // 브로드캐스트 쓰로틀링
    this.lastBroadcastTime = 0;
    this.lastPlayerListBroadcastTime = 0;
    this.lastStatePersistTime = 0;

    // 상수
    this.BROADCAST_THROTTLE_MS = 100;
    this.PLAYER_LIST_BROADCAST_THROTTLE_MS = 200;
    this.STATE_PERSIST_THROTTLE_MS = 1000;

    // 초기 가격 설정
    this._initializeStockPrices();
  }

  _initializeStockPrices() {
    STOCKS.forEach((stock) => {
      this.gameState.stockPrices[stock.id] = [stock.basePrice];
    });
    PRACTICE_STOCKS.forEach((stock) => {
      this.gameState.stockPrices[stock.id] = [stock.basePrice];
    });
  }

  // ============= Getters =============

  getGameState() {
    return this.gameState;
  }

  getGameSettings() {
    return this.gameSettings;
  }

  getPlayersData(isPractice = false) {
    return isPractice ? this.practicePlayersData : this.playersData;
  }

  getPlayerData(socketId, isPractice = false) {
    const dataMap = this.getPlayersData(isPractice);
    return dataMap.get(socketId);
  }

  getConnectedPlayers() {
    return this.connectedPlayers;
  }

  getAdminSockets() {
    return this.adminSockets;
  }

  getDisplaySockets() {
    return this.displaySockets;
  }

  getTransactionLogs() {
    return this.transactionLogs;
  }

  getPlayerTradingBlocked(socketId) {
    return this.playerTradingBlocked.get(socketId);
  }

  isAdmin(socket) {
    return this.adminSockets.has(socket);
  }

  getAdminId(socketId) {
    return this.adminAuthMap.get(socketId);
  }

  // ============= Setters =============

  updateGameState(updates) {
    Object.assign(this.gameState, updates);
  }

  setGameSettings(settings) {
    Object.assign(this.gameSettings, settings);
    if (settings.initialCash !== undefined) {
      this.INITIAL_CASH = settings.initialCash;
    }
  }

  setPlayerData(socketId, playerData, isPractice = false) {
    const dataMap = this.getPlayersData(isPractice);
    dataMap.set(socketId, playerData);
  }

  deletePlayerData(socketId, isPractice = false) {
    const dataMap = this.getPlayersData(isPractice);
    dataMap.delete(socketId);
  }

  addConnectedPlayer(socketId) {
    this.connectedPlayers.add(socketId);
  }

  removeConnectedPlayer(socketId) {
    this.connectedPlayers.delete(socketId);
  }

  addAdminSocket(socket) {
    this.adminSockets.add(socket);
  }

  removeAdminSocket(socket) {
    this.adminSockets.delete(socket);
    this.adminAuthMap.delete(socket.id);
  }

  setAdminAuth(socketId, adminId) {
    this.adminAuthMap.set(socketId, adminId);
  }

  addDisplaySocket(socket) {
    this.displaySockets.add(socket);
  }

  removeDisplaySocket(socket) {
    this.displaySockets.delete(socket);
  }

  setPlayerTradingBlocked(socketId, value) {
    this.playerTradingBlocked.set(socketId, value);
  }

  deletePlayerTradingBlocked(socketId) {
    this.playerTradingBlocked.delete(socketId);
  }

  addTransactionLog(log) {
    this.transactionLogs.push(log);
    // 메모리 제한: 최대 개수 초과 시 오래된 로그 제거
    if (this.transactionLogs.length > this.MAX_TRANSACTION_LOGS) {
      this.transactionLogs.shift();
    }
  }

  clearTransactionLogs() {
    this.transactionLogs.length = 0;
  }

  // ============= 타이머 관리 =============

  setCountdownInterval(interval) {
    this.countdownInterval = interval;
  }

  clearCountdownInterval() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  setRoundTimerInterval(interval) {
    this.roundTimerInterval = interval;
  }

  clearRoundTimerInterval() {
    if (this.roundTimerInterval) {
      clearInterval(this.roundTimerInterval);
      this.roundTimerInterval = null;
    }
  }

  // ============= 쓰로틀링 체크 =============

  canBroadcast() {
    const now = Date.now();
    if (now - this.lastBroadcastTime < this.BROADCAST_THROTTLE_MS) {
      return false;
    }
    this.lastBroadcastTime = now;
    return true;
  }

  canBroadcastPlayerList() {
    const now = Date.now();
    if (
      this.lastPlayerListBroadcastTime > 0 &&
      now - this.lastPlayerListBroadcastTime < this.PLAYER_LIST_BROADCAST_THROTTLE_MS
    ) {
      return false;
    }
    this.lastPlayerListBroadcastTime = now;
    return true;
  }

  canPersistState(force = false) {
    if (!this.gameState.gameId) {
      return false;
    }
    const now = Date.now();
    if (!force && now - this.lastStatePersistTime < this.STATE_PERSIST_THROTTLE_MS) {
      return false;
    }
    this.lastStatePersistTime = now;
    return true;
  }

  // ============= 상태 초기화 =============

  resetGameState(isPractice = false) {
    this.gameState.currentRound = 0;
    this.gameState.currentNews = '';
    this.gameState.currentNewsBriefing = [];
    this.gameState.isGameStarted = false;
    this.gameState.isGameEnded = false;
    this.gameState.isPracticeMode = isPractice;
    this.gameState.isWaitingMode = true;
    this.gameState.countdown = null;
    this.gameState.roundTimer = null;
    this.gameState.allowPlayerTrading = false;
    this.gameState.isTradingBlocked = false;
    this.gameState.isLastRound = false;
    this.gameState.scenarios = isPractice ? practiceScenarios : initialScenarios;
    this.gameState.customStocks = null;

    // 주가 완전 초기화 (이전 게임의 주식 ID 잔존 방지)
    this.gameState.stockPrices = {};
    this._initializeStockPrices();
  }

  resetForNewGame(isPractice = false) {
    this.resetGameState(isPractice);

    // 플레이어 투자 차단 상태 초기화
    this.playerTradingBlocked.clear();

    // 거래 로그 초기화
    this.transactionLogs.length = 0;

    // 타이머 초기화
    this.clearCountdownInterval();
    this.clearRoundTimerInterval();
  }

  // ============= 상태 저장/복원용 =============

  getStateToPersist() {
    return {
      gameId: this.gameState.gameId,
      currentRound: this.gameState.currentRound,
      stockPrices: this.gameState.stockPrices,
      currentNews: this.gameState.currentNews,
      currentNewsBriefing: this.gameState.currentNewsBriefing,
      isGameStarted: this.gameState.isGameStarted,
      isGameEnded: this.gameState.isGameEnded,
      isPracticeMode: this.gameState.isPracticeMode,
      isWaitingMode: this.gameState.isWaitingMode,
      countdown: this.gameState.countdown,
      roundTimer: this.gameState.roundTimer,
      allowPlayerTrading: this.gameState.allowPlayerTrading,
      isTradingBlocked: this.gameState.isTradingBlocked,
      isLastRound: this.gameState.isLastRound,
      customStocks: this.gameState.customStocks || null,
      scenarios: this.gameState.scenarios || null,
    };
  }

  applySavedState(saved, resumeOnRestart = false) {
    if (!saved || !saved.state || typeof saved.state !== 'object') {
      return false;
    }
    const state = saved.state;

    if (state.gameId || saved.gameId) {
      this.gameState.gameId = state.gameId || saved.gameId;
    }
    if (Number.isInteger(state.currentRound)) {
      this.gameState.currentRound = state.currentRound;
    }
    if (state.stockPrices && typeof state.stockPrices === 'object') {
      this.gameState.stockPrices = state.stockPrices;
    }
    if (typeof state.currentNews === 'string') {
      this.gameState.currentNews = state.currentNews;
    }
    if (Array.isArray(state.currentNewsBriefing)) {
      this.gameState.currentNewsBriefing = state.currentNewsBriefing;
    }
    if (state.isGameStarted !== undefined) {
      this.gameState.isGameStarted = Boolean(state.isGameStarted);
    }
    if (state.isGameEnded !== undefined) {
      this.gameState.isGameEnded = Boolean(state.isGameEnded);
    }
    if (state.isPracticeMode !== undefined) {
      this.gameState.isPracticeMode = Boolean(state.isPracticeMode);
    }
    if (state.isWaitingMode !== undefined) {
      this.gameState.isWaitingMode = Boolean(state.isWaitingMode);
    }
    if (state.countdown !== undefined) {
      this.gameState.countdown = state.countdown;
    }
    if (state.roundTimer !== undefined) {
      this.gameState.roundTimer = state.roundTimer;
    }
    if (state.allowPlayerTrading !== undefined) {
      this.gameState.allowPlayerTrading = Boolean(state.allowPlayerTrading);
    }
    if (state.isTradingBlocked !== undefined) {
      this.gameState.isTradingBlocked = Boolean(state.isTradingBlocked);
    }
    if (state.isLastRound !== undefined) {
      this.gameState.isLastRound = Boolean(state.isLastRound);
    }

    // 커스텀 주식 복원
    if (Array.isArray(state.customStocks) && state.customStocks.length > 0) {
      this.gameState.customStocks = state.customStocks;
    } else {
      this.gameState.customStocks = null;
    }

    // 시나리오 설정 (저장된 커스텀 시나리오 우선, 없으면 기본값)
    if (Array.isArray(state.scenarios) && state.scenarios.length > 0) {
      this.gameState.scenarios = state.scenarios;
    } else {
      this.gameState.scenarios = this.gameState.isPracticeMode
        ? practiceScenarios
        : initialScenarios;
    }

    // totalRounds 업데이트
    this.gameSettings.totalRounds = this.gameState.scenarios.length;

    // 재시작 시 자동 재개 설정
    if (!resumeOnRestart) {
      this.gameState.isGameStarted = false;
      this.gameState.isGameEnded = false;
      this.gameState.isWaitingMode = true;
      this.gameState.currentRound = 0;
      this.gameState.currentNews = '';
      this.gameState.currentNewsBriefing = [];
      this.gameState.countdown = null;
      this.gameState.roundTimer = null;
      this.gameState.allowPlayerTrading = false;
      this.gameState.isTradingBlocked = false;
      this.gameState.isLastRound = false;
      this.gameState.gameId = null;
    }

    this._normalizeStockPriceHistory(STOCKS);
    this._normalizeStockPriceHistory(PRACTICE_STOCKS);
    if (this.gameState.customStocks) {
      this._normalizeStockPriceHistory(this.gameState.customStocks);
    }
    return true;
  }

  _normalizeStockPriceHistory(stockList) {
    stockList.forEach((stock) => {
      const history = this.gameState.stockPrices[stock.id];
      if (!Array.isArray(history) || history.length === 0) {
        this.gameState.stockPrices[stock.id] = [stock.basePrice];
        return;
      }
      if (
        history[0] === undefined ||
        history[0] === null ||
        Number.isNaN(history[0])
      ) {
        this.gameState.stockPrices[stock.id][0] = stock.basePrice;
      }
    });
  }
}

// 싱글톤 인스턴스 export
export const stateManager = new StateManager();
export default stateManager;
