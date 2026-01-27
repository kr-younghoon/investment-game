/**
 * Reward Handler - 포인트/보너스 관련 핸들러
 */
export function registerRewardHandlers(socket, io, services) {
  const { stateManager, rewardService, broadcastService } = services;

  // 개별 플레이어에게 포인트 추가
  socket.on('ADMIN_ADD_POINTS', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { socketId, points, source = 'BONUS' } = data;
    const gameState = stateManager.getGameState();

    if (!points || points <= 0) {
      socket.emit('POINTS_ERROR', { message: '포인트를 확인해주세요.' });
      return;
    }

    const result = rewardService.addPoints(socketId, points, source, gameState.isPracticeMode);

    if (!result.success) {
      socket.emit('POINTS_ERROR', { message: result.error });
      return;
    }

    // 플레이어에게 포트폴리오 업데이트 전송
    const playerSocket = io.sockets.sockets.get(socketId);
    if (playerSocket) {
      const playerData = stateManager.getPlayerData(socketId, gameState.isPracticeMode);
      broadcastService.emitPortfolioUpdate(socketId, playerData, gameState.isPracticeMode);

      playerSocket.emit('BONUS_POINTS_ADDED', {
        points,
        source,
        message: `${points.toLocaleString()}원이 추가되었습니다.`,
      });
    }

    broadcastService.broadcastPlayerList();
    broadcastService.broadcastGameState();

    console.log(`[ADMIN_ADD_POINTS] 포인트 추가: ${socketId} - ${points}원 (${source})`);
  });

  // 모든 플레이어에게 포인트 추가
  socket.on('ADMIN_ADD_POINTS_TO_ALL', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { points, source = 'BONUS' } = data;
    const gameState = stateManager.getGameState();

    if (!points || points <= 0) {
      socket.emit('POINTS_ERROR', { message: '포인트를 확인해주세요.' });
      return;
    }

    const results = rewardService.addPointsToAll(points, source, gameState.isPracticeMode);

    // 각 플레이어에게 포트폴리오 업데이트 전송
    results.forEach(({ socketId, success, nickname }) => {
      if (success) {
        const playerSocket = io.sockets.sockets.get(socketId);
        if (playerSocket) {
          const playerData = stateManager.getPlayerData(socketId, gameState.isPracticeMode);
          broadcastService.emitPortfolioUpdate(socketId, playerData, gameState.isPracticeMode);

          playerSocket.emit('BONUS_POINTS_ADDED', {
            points,
            source,
            message: `${points.toLocaleString()}원이 추가되었습니다.`,
          });
        }
      }
    });

    broadcastService.broadcastPlayerList();
    broadcastService.broadcastGameState();

    const successCount = results.filter((r) => r.success).length;
    console.log(`[ADMIN_ADD_POINTS_TO_ALL] 전체 포인트 추가: ${successCount}명 - ${points}원`);
  });

  // 미니게임 성공 알림 (플레이어 → 서버)
  socket.on('MINIGAME_SUCCESS', (data) => {
    const gameState = stateManager.getGameState();
    const blockedInfo = stateManager.getPlayerTradingBlocked(socket.id);

    if (!blockedInfo || !blockedInfo.isBlocked) {
      return;
    }

    // 관리자에게 미니게임 성공 알림
    stateManager.getAdminSockets().forEach((adminSocket) => {
      const playerData = stateManager.getPlayerData(socket.id, gameState.isPracticeMode);
      adminSocket.emit('MINIGAME_SUCCESS_NOTIFICATION', {
        socketId: socket.id,
        nickname: playerData?.nickname || '알 수 없음',
        rewardAmount: blockedInfo.rewardAmount,
      });
    });

    console.log(`[MINIGAME_SUCCESS] 미니게임 성공: ${socket.id}`);
  });
}

export default registerRewardHandlers;
