/**
 * Display Handler - 전광판(디스플레이) 관련 핸들러
 */
export function registerDisplayHandlers(socket, io, services) {
  const { stateManager, broadcastService, dbHelpers } = services;

  // 전광판 등록
  socket.on('DISPLAY_REGISTER', () => {
    stateManager.addDisplaySocket(socket);

    const gameState = stateManager.getGameState();
    const currentGameId = gameState.gameId || 'legacy';

    try {
      const dbTransactions = dbHelpers.getAllTransactions(
        currentGameId,
        gameState.isPracticeMode
      );
      socket.emit('TRANSACTION_LOGS_INIT', dbTransactions);
    } catch (error) {
      console.error('[DISPLAY_REGISTER] 거래 로그 조회 오류:', error);
      socket.emit('TRANSACTION_LOGS_INIT', []);
    }

    console.log(`[DISPLAY_REGISTER] 전광판 등록: ${socket.id}`);
  });
}

export default registerDisplayHandlers;
