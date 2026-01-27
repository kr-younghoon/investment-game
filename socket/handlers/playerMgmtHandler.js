/**
 * Player Management Handler - 플레이어 관리 핸들러
 */
export function registerPlayerMgmtHandlers(socket, io, services) {
  const { stateManager, playerService, broadcastService, dbHelpers } = services;

  // 플레이어 리스트 요청
  socket.on('ADMIN_REQUEST_PLAYER_LIST', () => {
    if (!stateManager.isAdmin(socket)) return;

    broadcastService.broadcastPlayerList();
  });

  // 플레이어 강제 퇴장 (연결 끊기만, DB 유지)
  socket.on('ADMIN_KICK_PLAYER', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { socketId } = data;
    const gameState = stateManager.getGameState();
    const playerData = stateManager.getPlayerData(socketId, gameState.isPracticeMode);

    if (!playerData) {
      socket.emit('PLAYER_KICK_ERROR', { message: '플레이어를 찾을 수 없습니다.' });
      return;
    }

    const nickname = playerData.nickname;

    // 플레이어 소켓 연결 끊기
    const playerSocket = io.sockets.sockets.get(socketId);
    if (playerSocket) {
      playerSocket.emit('FORCE_DISCONNECT', { message: '관리자에 의해 퇴장되었습니다.' });
      playerSocket.disconnect(true);
    }

    // 연결된 플레이어 목록에서 제거
    stateManager.removeConnectedPlayer(socketId);

    broadcastService.broadcastPlayerCount();
    broadcastService.broadcastPlayerList();

    console.log(`[ADMIN_KICK_PLAYER] 플레이어 강제 퇴장: ${nickname}`);
  });

  // 플레이어 삭제 (DB + 메모리)
  socket.on('ADMIN_DELETE_PLAYER', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { socketId, dbId } = data;
    const gameState = stateManager.getGameState();

    // 오프라인 플레이어인 경우 (socketId가 offline_로 시작)
    if (socketId && socketId.startsWith('offline_') && dbId) {
      try {
        dbHelpers.deletePlayer(dbId, gameState.isPracticeMode);
        console.log(`[ADMIN_DELETE_PLAYER] 오프라인 플레이어 삭제: dbId=${dbId}`);

        broadcastService.broadcastPlayerList();
        return;
      } catch (error) {
        console.error('[ADMIN_DELETE_PLAYER] 오프라인 플레이어 삭제 오류:', error);
        socket.emit('PLAYER_DELETE_ERROR', { message: '플레이어 삭제 중 오류가 발생했습니다.' });
        return;
      }
    }

    // 온라인 플레이어인 경우
    const playerData = stateManager.getPlayerData(socketId, gameState.isPracticeMode);

    if (!playerData) {
      socket.emit('PLAYER_DELETE_ERROR', { message: '플레이어를 찾을 수 없습니다.' });
      return;
    }

    const nickname = playerData.nickname;

    // 플레이어 소켓 연결 끊기
    const playerSocket = io.sockets.sockets.get(socketId);
    if (playerSocket) {
      playerSocket.emit('FORCE_DISCONNECT', { message: '관리자에 의해 삭제되었습니다.' });
      playerSocket.disconnect(true);
    }

    // 메모리 및 DB에서 삭제
    playerService.deletePlayer(socketId, gameState.isPracticeMode);

    broadcastService.broadcastPlayerCount();
    broadcastService.broadcastPlayerList();

    console.log(`[ADMIN_DELETE_PLAYER] 플레이어 삭제: ${nickname}`);
  });

  // 모든 플레이어 삭제
  socket.on('ADMIN_DELETE_ALL_PLAYERS', (data = {}) => {
    if (!stateManager.isAdmin(socket)) return;

    const { shouldClearTransactions = false } = data;
    const gameState = stateManager.getGameState();

    // 모든 플레이어 소켓 연결 끊기
    const connectedPlayers = Array.from(stateManager.getConnectedPlayers());
    connectedPlayers.forEach((socketId) => {
      const playerSocket = io.sockets.sockets.get(socketId);
      if (playerSocket) {
        playerSocket.emit('FORCE_DISCONNECT', { message: '관리자에 의해 모든 플레이어가 삭제되었습니다.' });
        playerSocket.disconnect(true);
      }
    });

    // 플레이어 데이터 삭제
    playerService.deleteAllPlayers(gameState.isPracticeMode, {
      gameId: gameState.gameId,
      shouldClearTransactions,
    });

    if (shouldClearTransactions) {
      stateManager.clearTransactionLogs();

      // 관리자에게 거래 로그 초기화 알림
      stateManager.getAdminSockets().forEach((adminSocket) => {
        adminSocket.emit('TRANSACTION_LOGS_INIT', []);
      });
    }

    broadcastService.broadcastPlayerCount();
    broadcastService.broadcastPlayerList();

    console.log(
      `[ADMIN_DELETE_ALL_PLAYERS] 모든 플레이어 삭제 (거래내역 삭제: ${shouldClearTransactions})`
    );
  });
}

export default registerPlayerMgmtHandlers;
