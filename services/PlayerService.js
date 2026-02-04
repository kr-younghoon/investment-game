import { STOCKS, PRACTICE_STOCKS } from '../src/data/initialScenarios.js';

/**
 * PlayerService - 플레이어 데이터 관리
 */
export class PlayerService {
  constructor(stateManager, dbHelpers) {
    this.state = stateManager;
    this.db = dbHelpers;
  }

  /**
   * 현재 게임에서 사용 중인 주식 목록 반환
   */
  getActiveStocks(isPractice) {
    const gameState = this.state.getGameState();
    if (gameState.customStocks && gameState.customStocks.length > 0) {
      return gameState.customStocks;
    }
    if (isPractice !== undefined) {
      return isPractice ? PRACTICE_STOCKS : STOCKS;
    }
    return gameState.isPracticeMode ? PRACTICE_STOCKS : STOCKS;
  }

  /**
   * 닉네임 중복 확인
   */
  isNicknameDuplicate(nickname, excludeSocketId = null) {
    const gameState = this.state.getGameState();

    // 실제 게임 플레이어 데이터에서 확인
    for (const [socketId, data] of this.state.playersData.entries()) {
      if (socketId !== excludeSocketId && data.nickname === nickname) {
        return { isDuplicate: true, mode: 'real' };
      }
    }

    // 연습 모드 플레이어 데이터에서 확인
    for (const [socketId, data] of this.state.practicePlayersData.entries()) {
      if (socketId !== excludeSocketId && data.nickname === nickname) {
        return { isDuplicate: true, mode: 'practice' };
      }
    }

    return { isDuplicate: false };
  }

  /**
   * 플레이어 생성/업데이트
   */
  createOrUpdatePlayer(socketId, nickname, isPractice = false) {
    const gameState = this.state.getGameState();
    const INITIAL_CASH = this.state.INITIAL_CASH;
    const currentGameId = gameState.gameId || 'legacy';

    // 기존 플레이어 확인 (DB에서)
    const existingPlayer = this.db.getPlayerByNickname(currentGameId, nickname, isPractice);

    let playerData;
    if (existingPlayer) {
      // 기존 플레이어 복원
      playerData = this._restorePlayerFromDb(existingPlayer, socketId, isPractice);
    } else {
      // 새 플레이어 생성
      playerData = {
        nickname,
        cash: INITIAL_CASH,
        stocks: {},
        bonusPoints: 0,
        totalAsset: INITIAL_CASH,
        transactions: [],
        hints: [],
        dbId: null,
      };

      // 주식 초기화
      this.getActiveStocks(isPractice).forEach((stock) => {
        playerData.stocks[stock.id] = 0;
      });

      // DB 저장
      const savedPlayer = this.db.savePlayer(
        currentGameId,
        socketId,
        nickname,
        INITIAL_CASH,
        0,
        INITIAL_CASH,
        isPractice
      );
      playerData.dbId = savedPlayer.id;
    }

    // 메모리에 저장
    this.state.setPlayerData(socketId, playerData, isPractice);
    this.state.addConnectedPlayer(socketId);

    return playerData;
  }

  /**
   * DB에서 플레이어 복원
   */
  _restorePlayerFromDb(dbPlayer, socketId, isPractice) {
    const gameState = this.state.getGameState();
    const currentGameId = gameState.gameId || 'legacy';

    // 주식 정보 가져오기
    const dbStocks = this.db.getPlayerStocks(currentGameId, dbPlayer.id, isPractice);
    const stocks = {};
    this.getActiveStocks(isPractice).forEach((stock) => {
      const dbStock = dbStocks.find((s) => s.stock_id === stock.id);
      stocks[stock.id] = dbStock ? dbStock.quantity : 0;
    });

    // 힌트 정보 가져오기
    const dbHints = this.db.getPlayerHints(currentGameId, dbPlayer.id, isPractice);
    const hints = dbHints.map((hint) => ({
      difficulty: hint.difficulty,
      content: hint.content,
      receivedAt: hint.received_at,
      price: hint.price,
      round: hint.round,
    }));

    // 거래 내역 가져오기
    const dbTransactions = this.db.getTransactionsByPlayerId(currentGameId, dbPlayer.id, isPractice);
    const transactions = dbTransactions.map((t) => ({
      type: t.type,
      stockId: t.stockId,
      quantity: t.quantity,
      price: t.price,
      totalCost: t.totalCost,
      totalRevenue: t.totalRevenue,
      timestamp: t.timestamp,
      round: t.round,
    }));

    return {
      nickname: dbPlayer.nickname,
      cash: dbPlayer.cash,
      stocks,
      bonusPoints: dbPlayer.bonus_points || 0,
      totalAsset: dbPlayer.total_asset,
      transactions,
      hints,
      dbId: dbPlayer.id,
    };
  }

  /**
   * 새 게임을 위한 플레이어 DB 초기화
   */
  resetPlayerDbForNewGame(socketId, playerData, isPractice) {
    const gameState = this.state.getGameState();
    const INITIAL_CASH = this.state.INITIAL_CASH;
    const currentGameId = gameState.gameId || 'legacy';

    const savedPlayer = this.db.savePlayer(
      currentGameId,
      socketId,
      playerData.nickname,
      INITIAL_CASH,
      0,
      INITIAL_CASH,
      isPractice
    );

    playerData.dbId = savedPlayer.id;

    this.db.updatePlayerCashById(playerData.dbId, INITIAL_CASH, INITIAL_CASH, isPractice);

    // 주식 초기화 (커스텀 주식 + 기본 주식 모두 초기화)
    const allStockIds = new Set();
    this.getActiveStocks(isPractice).forEach((stock) => allStockIds.add(stock.id));
    STOCKS.forEach((stock) => allStockIds.add(stock.id));
    PRACTICE_STOCKS.forEach((stock) => allStockIds.add(stock.id));
    allStockIds.forEach((stockId) => {
      this.db.savePlayerStock(currentGameId, playerData.dbId, stockId, 0, isPractice);
    });

    // 힌트 초기화
    this.db.clearPlayerHints(currentGameId, playerData.dbId, isPractice);
  }

  /**
   * 플레이어 삭제 (DB + 메모리)
   */
  deletePlayer(socketId, isPractice = false) {
    const playerData = this.state.getPlayerData(socketId, isPractice);
    if (playerData && playerData.dbId) {
      this.db.deletePlayer(playerData.dbId, isPractice);
    }
    this.state.deletePlayerData(socketId, isPractice);
    this.state.removeConnectedPlayer(socketId);
  }

  /**
   * 모든 플레이어 삭제
   */
  deleteAllPlayers(isPractice = false, options = {}) {
    const gameState = this.state.getGameState();
    const currentGameId = options.gameId || gameState.gameId || null;

    // DB에서 삭제
    this.db.deleteAllPlayers(currentGameId, isPractice);

    if (options.shouldClearTransactions) {
      this.db.clearAllTransactions(currentGameId, isPractice);
    }

    // 메모리에서 삭제
    const dataMap = this.state.getPlayersData(isPractice);
    dataMap.clear();

    // 연결된 플레이어 목록도 정리
    if (!isPractice) {
      this.state.connectedPlayers.clear();
    } else {
      this.state.practiceConnectedPlayers.clear();
    }
  }

  /**
   * 플레이어 현금 업데이트
   */
  updatePlayerCash(socketId, cash, totalAsset, isPractice = false) {
    const playerData = this.state.getPlayerData(socketId, isPractice);
    if (!playerData) return false;

    playerData.cash = cash;
    playerData.totalAsset = totalAsset;

    if (playerData.dbId) {
      this.db.updatePlayerCashById(playerData.dbId, cash, totalAsset, isPractice);
    }

    return true;
  }

  /**
   * 플레이어 주식 업데이트
   */
  updatePlayerStock(socketId, stockId, quantity, isPractice = false) {
    const playerData = this.state.getPlayerData(socketId, isPractice);
    if (!playerData) return false;

    const gameState = this.state.getGameState();
    playerData.stocks[stockId] = quantity;

    if (playerData.dbId) {
      this.db.savePlayerStock(
        gameState.gameId || 'legacy',
        playerData.dbId,
        stockId,
        quantity,
        isPractice
      );
    }

    return true;
  }

  /**
   * 플레이어 거래 추가
   */
  addTransaction(socketId, transaction, isPractice = false) {
    const playerData = this.state.getPlayerData(socketId, isPractice);
    if (!playerData) return false;

    if (!playerData.transactions) {
      playerData.transactions = [];
    }
    playerData.transactions.push(transaction);

    return true;
  }

  /**
   * 플레이어 힌트 추가
   */
  addHint(socketId, hint, isPractice = false) {
    const playerData = this.state.getPlayerData(socketId, isPractice);
    if (!playerData) return false;

    if (!playerData.hints) {
      playerData.hints = [];
    }
    playerData.hints.push(hint);

    // DB 저장
    const gameState = this.state.getGameState();
    if (playerData.dbId) {
      this.db.saveHint(
        gameState.gameId || 'legacy',
        playerData.dbId,
        hint.difficulty,
        hint.content,
        hint.price,
        hint.round,
        isPractice
      );
    }

    return true;
  }

  /**
   * socketId로 플레이어 찾기 (두 모드 모두 확인)
   */
  findPlayerBySocketId(socketId) {
    // 현재 모드 먼저 확인
    const gameState = this.state.getGameState();
    let playerData = this.state.getPlayerData(socketId, gameState.isPracticeMode);

    if (playerData) {
      return { playerData, isPractice: gameState.isPracticeMode };
    }

    // 다른 모드 확인
    playerData = this.state.getPlayerData(socketId, !gameState.isPracticeMode);
    if (playerData) {
      return { playerData, isPractice: !gameState.isPracticeMode };
    }

    return null;
  }
}

export default PlayerService;
