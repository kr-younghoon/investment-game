import { getActiveStocks } from '../shared/getActiveStocks.js';

/**
 * TradingService - 매매 로직 및 유효성 검사
 */
export class TradingService {
  constructor(stateManager, dbHelpers, broadcastService) {
    this.state = stateManager;
    this.db = dbHelpers;
    this.broadcast = broadcastService;
  }

  /**
   * 거래 가능 여부 검증
   */
  validateTrading(socketId) {
    const gameState = this.state.getGameState();

    // 전역 거래 차단 확인
    if (gameState.isTradingBlocked) {
      return {
        allowed: false,
        message: '현재 미니게임이 진행 중입니다. 미니게임이 끝날 때까지 투자를 할 수 없습니다.',
      };
    }

    // 플레이어 직접 거래 허용 여부
    if (!gameState.allowPlayerTrading) {
      return {
        allowed: false,
        message: '현재 온라인 거래가 비활성화되어 있습니다. 관리자에게 문의하세요.',
      };
    }

    // 개별 플레이어 차단 확인
    const playerBlocked = this.state.getPlayerTradingBlocked(socketId);
    if (playerBlocked?.isBlocked) {
      return {
        allowed: false,
        message: '현재 미니게임이 진행 중입니다.',
      };
    }

    // 게임 시작 여부
    if (!gameState.isGameStarted) {
      return {
        allowed: false,
        message: '게임이 아직 시작되지 않았습니다.',
      };
    }

    return { allowed: true };
  }

  /**
   * 주식 매수 실행
   */
  executeBuy(socketId, stockId, quantity) {
    const gameState = this.state.getGameState();
    const isPractice = gameState.isPracticeMode;
    const playerData = this.state.getPlayerData(socketId, isPractice);

    if (!playerData) {
      return { success: false, error: '플레이어 데이터를 찾을 수 없습니다.' };
    }

    const currentPrices = this.broadcast.getCurrentPrices();
    const price = currentPrices[stockId];

    // 가격 유효성 검사
    if (price === undefined || price === null || isNaN(price) || price <= 0) {
      return { success: false, error: `주식 가격을 찾을 수 없습니다. (종목: ${stockId})` };
    }

    const totalCost = price * quantity;

    // 현금 확인
    if (playerData.cash < totalCost) {
      return { success: false, error: '현금이 부족합니다.' };
    }

    // 스냅샷 (롤백용)
    const prevCash = playerData.cash;
    const prevStockQty = playerData.stocks[stockId] || 0;
    const prevTotalAsset = playerData.totalAsset;
    const prevTransactionsLength = (playerData.transactions || []).length;

    // 거래 실행
    playerData.cash -= totalCost;
    playerData.stocks[stockId] = prevStockQty + quantity;

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

    if (!playerData.transactions) {
      playerData.transactions = [];
    }
    playerData.transactions.push(transaction);

    // 총 자산 계산
    const totalAsset = this.broadcast.calculatePlayerTotalAsset(socketId, isPractice);
    playerData.totalAsset = totalAsset;

    // DB 저장 (실패 시 롤백)
    try {
      this._persistTransaction(playerData, stockId, transaction, isPractice);
    } catch (err) {
      // 롤백
      playerData.cash = prevCash;
      playerData.stocks[stockId] = prevStockQty;
      playerData.totalAsset = prevTotalAsset;
      playerData.transactions = playerData.transactions.slice(0, prevTransactionsLength);
      console.error('[TradingService] 매수 DB 저장 실패, 롤백:', err);
      return { success: false, error: 'DB 저장 실패. 거래가 취소되었습니다.' };
    }

    // 평균 매수가 계산
    const averagePrice = this.calculateAverageBuyPrice(playerData, stockId);
    const stock = this._getStockById(stockId, isPractice);

    return {
      success: true,
      transaction,
      portfolio: {
        cash: playerData.cash,
        stocks: playerData.stocks,
        bonusPoints: 0,
        totalAsset,
      },
      tradeInfo: {
        type: 'BUY',
        stockName: stock?.name || stockId,
        quantity,
        averagePrice,
      },
    };
  }

  /**
   * 주식 매도 실행
   */
  executeSell(socketId, stockId, quantity) {
    const gameState = this.state.getGameState();
    const isPractice = gameState.isPracticeMode;
    const playerData = this.state.getPlayerData(socketId, isPractice);

    if (!playerData) {
      return { success: false, error: '플레이어 데이터를 찾을 수 없습니다.' };
    }

    const currentPrices = this.broadcast.getCurrentPrices();
    const price = currentPrices[stockId];

    // 가격 유효성 검사
    if (price === undefined || price === null || isNaN(price) || price <= 0) {
      return { success: false, error: `주식 가격을 찾을 수 없습니다. (종목: ${stockId})` };
    }

    // 보유 수량 확인
    const currentQty = playerData.stocks[stockId] || 0;
    if (currentQty < quantity) {
      return { success: false, error: '보유 수량이 부족합니다.' };
    }

    const totalRevenue = price * quantity;

    // 스냅샷 (롤백용)
    const prevCash = playerData.cash;
    const prevStockQty = currentQty;
    const prevTotalAsset = playerData.totalAsset;
    const prevTransactionsLength = (playerData.transactions || []).length;

    // 거래 실행
    playerData.cash += totalRevenue;
    playerData.stocks[stockId] = currentQty - quantity;

    // 거래 기록
    const transaction = {
      type: 'SELL',
      stockId,
      quantity,
      price,
      totalCost: totalRevenue,
      totalRevenue,
      round: gameState.currentRound,
      timestamp: new Date().toISOString(),
      nickname: playerData.nickname,
    };

    if (!playerData.transactions) {
      playerData.transactions = [];
    }
    playerData.transactions.push(transaction);

    // 총 자산 계산
    const totalAsset = this.broadcast.calculatePlayerTotalAsset(socketId, isPractice);
    playerData.totalAsset = totalAsset;

    // DB 저장 (실패 시 롤백)
    try {
      this._persistTransaction(playerData, stockId, transaction, isPractice, totalRevenue);
    } catch (err) {
      // 롤백
      playerData.cash = prevCash;
      playerData.stocks[stockId] = prevStockQty;
      playerData.totalAsset = prevTotalAsset;
      playerData.transactions = playerData.transactions.slice(0, prevTransactionsLength);
      console.error('[TradingService] 매도 DB 저장 실패, 롤백:', err);
      return { success: false, error: 'DB 저장 실패. 거래가 취소되었습니다.' };
    }

    const stock = this._getStockById(stockId, isPractice);

    return {
      success: true,
      transaction,
      portfolio: {
        cash: playerData.cash,
        stocks: playerData.stocks,
        bonusPoints: 0,
        totalAsset,
      },
      tradeInfo: {
        type: 'SELL',
        stockName: stock?.name || stockId,
        quantity,
        price,
      },
    };
  }

  /**
   * 관리자 거래 실행 (플레이어 대신)
   */
  executeAdminTrade(targetSocketId, stockId, quantity, tradeType, adminId) {
    const gameState = this.state.getGameState();
    const isPractice = gameState.isPracticeMode;
    const playerData = this.state.getPlayerData(targetSocketId, isPractice);

    if (!playerData) {
      return { success: false, error: '플레이어 데이터를 찾을 수 없습니다.' };
    }

    const currentPrices = this.broadcast.getCurrentPrices();
    const price = currentPrices[stockId];

    if (price === undefined || price === null || isNaN(price) || price <= 0) {
      return { success: false, error: `주식 가격을 찾을 수 없습니다.` };
    }

    if (tradeType === 'BUY') {
      const totalCost = price * quantity;
      if (playerData.cash < totalCost) {
        return { success: false, error: '플레이어 현금이 부족합니다.' };
      }

      playerData.cash -= totalCost;
      playerData.stocks[stockId] = (playerData.stocks[stockId] || 0) + quantity;

      const transaction = {
        type: 'BUY',
        stockId,
        quantity,
        price,
        totalCost,
        round: gameState.currentRound,
        timestamp: new Date().toISOString(),
        nickname: playerData.nickname,
        adminId,
      };

      playerData.transactions.push(transaction);
      const totalAsset = this.broadcast.calculatePlayerTotalAsset(targetSocketId, isPractice);
      playerData.totalAsset = totalAsset;

      this._persistAdminTransaction(playerData, stockId, transaction, isPractice, adminId);

      const averagePrice = this.calculateAverageBuyPrice(playerData, stockId);

      return {
        success: true,
        transaction,
        portfolio: {
          cash: playerData.cash,
          stocks: playerData.stocks,
          bonusPoints: 0,
          totalAsset,
        },
        averagePrice,
      };
    } else {
      // SELL
      const currentQty = playerData.stocks[stockId] || 0;
      if (currentQty < quantity) {
        return { success: false, error: '플레이어 보유 수량이 부족합니다.' };
      }

      const totalRevenue = price * quantity;
      playerData.cash += totalRevenue;
      playerData.stocks[stockId] = currentQty - quantity;

      const transaction = {
        type: 'SELL',
        stockId,
        quantity,
        price,
        totalCost: totalRevenue,
        totalRevenue,
        round: gameState.currentRound,
        timestamp: new Date().toISOString(),
        nickname: playerData.nickname,
        adminId,
      };

      playerData.transactions.push(transaction);
      const totalAsset = this.broadcast.calculatePlayerTotalAsset(targetSocketId, isPractice);
      playerData.totalAsset = totalAsset;

      this._persistAdminTransaction(playerData, stockId, transaction, isPractice, adminId, totalRevenue);

      return {
        success: true,
        transaction,
        portfolio: {
          cash: playerData.cash,
          stocks: playerData.stocks,
          bonusPoints: 0,
          totalAsset,
        },
      };
    }
  }

  /**
   * 평균 매수가 계산
   */
  calculateAverageBuyPrice(playerData, stockId) {
    const buyTransactions = (playerData.transactions || []).filter(
      (t) => t.type === 'BUY' && t.stockId === stockId
    );

    if (buyTransactions.length === 0) return 0;

    let totalCost = 0;
    let totalQuantity = 0;

    buyTransactions.forEach((t) => {
      totalCost += t.totalCost || t.price * t.quantity;
      totalQuantity += t.quantity;
    });

    return totalQuantity > 0 ? totalCost / totalQuantity : 0;
  }

  /**
   * 거래 DB 저장
   */
  _persistTransaction(playerData, stockId, transaction, isPractice, totalRevenue = 0) {
    if (!playerData.dbId) return;

    const gameState = this.state.getGameState();
    const currentGameId = gameState.gameId || 'legacy';

    try {
      // 현금 업데이트
      this.db.updatePlayerCashById(
        playerData.dbId,
        playerData.cash,
        playerData.totalAsset,
        isPractice
      );

      // 주식 수량 업데이트
      this.db.savePlayerStock(
        currentGameId,
        playerData.dbId,
        stockId,
        playerData.stocks[stockId],
        isPractice
      );

      // 거래 내역 저장
      this.db.saveTransaction(
        currentGameId,
        playerData.dbId,
        playerData.nickname,
        transaction.type,
        stockId,
        transaction.quantity,
        transaction.price,
        transaction.totalCost || 0,
        totalRevenue,
        0,
        null,
        null,
        transaction.round,
        null,
        isPractice
      );
    } catch (error) {
      console.error('[TradingService] DB 저장 오류:', error);
      throw error;
    }
  }

  /**
   * 관리자 거래 DB 저장
   */
  _persistAdminTransaction(playerData, stockId, transaction, isPractice, adminId, totalRevenue = 0) {
    if (!playerData.dbId) return;

    const gameState = this.state.getGameState();
    const currentGameId = gameState.gameId || 'legacy';

    try {
      this.db.updatePlayerCashById(
        playerData.dbId,
        playerData.cash,
        playerData.totalAsset,
        isPractice
      );

      this.db.savePlayerStock(
        currentGameId,
        playerData.dbId,
        stockId,
        playerData.stocks[stockId],
        isPractice
      );

      this.db.saveTransaction(
        currentGameId,
        playerData.dbId,
        playerData.nickname,
        transaction.type,
        stockId,
        transaction.quantity,
        transaction.price,
        transaction.totalCost || 0,
        totalRevenue,
        0,
        null,
        null,
        transaction.round,
        adminId,
        isPractice
      );
    } catch (error) {
      console.error('[TradingService] 관리자 거래 DB 저장 오류:', error);
    }
  }

  /**
   * 종목 ID로 주식 정보 가져오기
   */
  _getStockById(stockId, isPractice) {
    return getActiveStocks(this.state.getGameState(), isPractice).find((s) => s.id === stockId);
  }
}

export default TradingService;
