/**
 * TransactionService - 거래 로그 관리
 */
export class TransactionService {
  constructor(stateManager, dbHelpers) {
    this.state = stateManager;
    this.db = dbHelpers;
  }

  /**
   * 거래 기록 추가
   */
  recordTransaction(transaction) {
    this.state.addTransactionLog(transaction);
    return transaction;
  }

  /**
   * 플레이어 거래 내역 조회
   */
  getPlayerTransactions(socketId) {
    const gameState = this.state.getGameState();
    const playerData = this.state.getPlayerData(socketId, gameState.isPracticeMode);

    if (!playerData || !playerData.dbId) {
      return playerData?.transactions || [];
    }

    try {
      const dbTransactions = this.db.getTransactionsByPlayerId(
        gameState.gameId || 'legacy',
        playerData.dbId,
        gameState.isPracticeMode
      );

      return dbTransactions.map((t) => ({
        type: t.type,
        stockId: t.stockId,
        stockName: t.stockName || t.stockId,
        quantity: t.quantity,
        price: t.price,
        totalCost: t.totalCost,
        totalRevenue: t.totalRevenue,
        timestamp: t.timestamp,
        round: t.round,
      }));
    } catch (error) {
      console.error('[TransactionService] 거래 내역 조회 오류:', error);
      return playerData?.transactions || [];
    }
  }

  /**
   * 모든 거래 내역 조회
   */
  getAllTransactions(gameId = null, isPractice = false) {
    const gameState = this.state.getGameState();
    const currentGameId = gameId || gameState.gameId || 'legacy';

    try {
      return this.db.getAllTransactions(currentGameId, isPractice);
    } catch (error) {
      console.error('[TransactionService] 전체 거래 내역 조회 오류:', error);
      return [];
    }
  }

  /**
   * 모든 거래 내역 삭제
   */
  clearAllTransactions(gameId = null, isPractice = false) {
    const gameState = this.state.getGameState();
    const currentGameId = gameId || gameState.gameId || null;

    try {
      const deletedCount = this.db.clearAllTransactions(currentGameId, isPractice);
      this.state.clearTransactionLogs();
      return deletedCount;
    } catch (error) {
      console.error('[TransactionService] 거래 내역 삭제 오류:', error);
      throw error;
    }
  }

  /**
   * 거래 로그 형식화 (디스플레이용)
   */
  formatTransactionForDisplay(transaction, playerData = null) {
    return {
      type: transaction.type,
      nickname: playerData?.nickname || transaction.nickname || '알 수 없음',
      stockId: transaction.stockId,
      stockName: transaction.stockName || transaction.stockId,
      quantity: transaction.quantity,
      price: transaction.price,
      totalCost: transaction.totalCost,
      totalRevenue: transaction.totalRevenue,
      round: transaction.round,
      timestamp: transaction.timestamp || new Date().toISOString(),
      adminId: transaction.adminId,
    };
  }
}

export default TransactionService;
