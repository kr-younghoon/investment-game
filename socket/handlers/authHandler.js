/**
 * Auth Handler - 관리자 인증 관련 핸들러
 */
export function registerAuthHandlers(socket, io, services) {
  const { stateManager, adminService, broadcastService, dbHelpers } = services;

  // 관리자 로그아웃
  socket.on('ADMIN_LOGOUT', () => {
    if (stateManager.isAdmin(socket)) {
      const adminId = stateManager.getAdminId(socket.id);
      stateManager.removeAdminSocket(socket);
      console.log(`[ADMIN_LOGOUT] 관리자 로그아웃: ${adminId}`);

      // 다른 관리자들에게 목록 업데이트
      broadcastService.broadcastPlayerList();

      // 로그아웃 성공 이벤트 emit (클라이언트가 이 이벤트를 기다림)
      socket.emit('ADMIN_LOGOUT_SUCCESS', { message: '로그아웃되었습니다.' });
    }
  });

  // 관리자 인증
  socket.on('ADMIN_AUTH', (data, callback) => {
    const { adminId, password } = data;

    const result = adminService.authenticate(adminId, password);

    if (!result.success) {
      // 인증 실패 이벤트 emit (클라이언트가 이 이벤트를 기다림)
      socket.emit('ADMIN_AUTH_ERROR', { message: result.error });
      if (callback) {
        callback({ success: false, message: result.error });
      }
      return;
    }

    // 관리자 소켓 등록
    stateManager.addAdminSocket(socket);
    stateManager.setAdminAuth(socket.id, adminId);

    console.log(`[ADMIN_AUTH] 관리자 인증 성공: ${adminId}`);

    // 게임 상태 및 설정 전송
    const gameState = stateManager.getGameState();
    const gameSettings = stateManager.getGameSettings();
    const currentPrices = broadcastService.getCurrentPrices();

    socket.emit('GAME_STATE_UPDATE', {
      currentRound: gameState.currentRound,
      stockPrices: currentPrices,
      currentNews: gameState.currentNews,
      currentNewsBriefing: gameState.currentNewsBriefing,
      isGameStarted: gameState.isGameStarted,
      isGameEnded: gameState.isGameEnded,
      isPracticeMode: gameState.isPracticeMode,
      isWaitingMode: gameState.isWaitingMode,
      priceHistory: gameState.stockPrices,
      countdown: gameState.countdown,
      roundTimer: gameState.roundTimer,
      playerCount: stateManager.getConnectedPlayers().size,
      allowPlayerTrading: gameState.allowPlayerTrading,
      isTradingBlocked: gameState.isTradingBlocked,
      isLastRound: gameState.isLastRound,
    });

    socket.emit('GAME_SETTINGS_UPDATE', gameSettings);
    socket.emit('PLAYER_COUNT_UPDATE', stateManager.getConnectedPlayers().size);

    // 거래 로그 전송
    const currentGameId = gameState.gameId || 'legacy';
    try {
      const dbTransactions = dbHelpers.getAllTransactions(
        currentGameId,
        gameState.isPracticeMode
      );
      socket.emit('TRANSACTION_LOGS_INIT', dbTransactions);
    } catch (error) {
      console.error('[ADMIN_AUTH] 거래 로그 조회 오류:', error);
      socket.emit('TRANSACTION_LOGS_INIT', []);
    }

    // 플레이어 리스트 브로드캐스트
    broadcastService.broadcastPlayerList();

    // 인증 성공 이벤트 emit (클라이언트가 이 이벤트를 기다림)
    console.log(`[ADMIN_AUTH] ADMIN_AUTH_SUCCESS 이벤트 전송: ${socket.id}`);
    socket.emit('ADMIN_AUTH_SUCCESS');

    if (callback) {
      callback({ success: true, adminId });
    }
  });

  // 관리자 상태 요청
  socket.on('ADMIN_REQUEST_STATE', () => {
    if (!stateManager.isAdmin(socket)) return;

    const gameState = stateManager.getGameState();
    const currentPrices = broadcastService.getCurrentPrices();

    socket.emit('GAME_STATE_UPDATE', {
      currentRound: gameState.currentRound,
      stockPrices: currentPrices,
      currentNews: gameState.currentNews,
      currentNewsBriefing: gameState.currentNewsBriefing,
      isGameStarted: gameState.isGameStarted,
      isGameEnded: gameState.isGameEnded,
      isPracticeMode: gameState.isPracticeMode,
      isWaitingMode: gameState.isWaitingMode,
      priceHistory: gameState.stockPrices,
      countdown: gameState.countdown,
      roundTimer: gameState.roundTimer,
      playerCount: stateManager.getConnectedPlayers().size,
      allowPlayerTrading: gameState.allowPlayerTrading,
      isTradingBlocked: gameState.isTradingBlocked,
      isLastRound: gameState.isLastRound,
    });

    broadcastService.broadcastPlayerList();
  });
}

export default registerAuthHandlers;
