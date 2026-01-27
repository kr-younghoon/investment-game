/**
 * Transaction Management Handler - 거래 내역 관리 핸들러
 */
export function registerTransactionMgmtHandlers(socket, io, services) {
  const { stateManager, transactionService, broadcastService } = services;

  // 모든 거래 내역 삭제
  socket.on('ADMIN_CLEAR_ALL_TRANSACTIONS', (data = {}) => {
    if (!stateManager.isAdmin(socket)) return;

    const { gameId = null } = data;
    const gameState = stateManager.getGameState();
    const targetGameId = gameId || gameState.gameId;

    try {
      const deletedCount = transactionService.clearAllTransactions(
        targetGameId,
        gameState.isPracticeMode
      );

      // 관리자에게 거래 로그 초기화 알림
      stateManager.getAdminSockets().forEach((adminSocket) => {
        adminSocket.emit('TRANSACTION_LOGS_INIT', []);
        adminSocket.emit('TRANSACTION_LOGS_UPDATE', []);
      });

      // 디스플레이에도 알림
      stateManager.getDisplaySockets().forEach((displaySocket) => {
        displaySocket.emit('TRANSACTION_LOGS_INIT', []);
      });

      console.log(`[ADMIN_CLEAR_ALL_TRANSACTIONS] 거래 내역 삭제: ${deletedCount}개`);
    } catch (error) {
      console.error('[ADMIN_CLEAR_ALL_TRANSACTIONS] 오류:', error);
      socket.emit('TRANSACTION_CLEAR_ERROR', {
        message: '거래 내역 삭제 중 오류가 발생했습니다.',
      });
    }
  });
}

export default registerTransactionMgmtHandlers;
