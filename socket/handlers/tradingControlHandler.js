/**
 * Trading Control Handler - 거래 차단/허용 관련 핸들러
 */
export function registerTradingControlHandlers(socket, io, services) {
  const { stateManager, broadcastService, rewardService } = services;

  // 개별 플레이어 거래 차단
  socket.on('ADMIN_BLOCK_TRADING_FOR_PLAYER', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { socketId, rewardAmount, message } = data;
    const gameState = stateManager.getGameState();
    const playerData = stateManager.getPlayerData(socketId, gameState.isPracticeMode);

    if (!playerData) {
      console.log(`[ADMIN_BLOCK_TRADING_FOR_PLAYER] 플레이어를 찾을 수 없음: ${socketId}`);
      return;
    }

    stateManager.setPlayerTradingBlocked(socketId, {
      isBlocked: true,
      rewardAmount: rewardAmount || null,
      message: message || null,
    });

    // 플레이어에게 알림
    const playerSocket = io.sockets.sockets.get(socketId);
    if (playerSocket) {
      playerSocket.emit('PLAYER_TRADING_BLOCKED', {
        isBlocked: true,
        rewardAmount: rewardAmount || null,
        message: message || '미니게임이 시작되었습니다. 투자가 일시 중단됩니다.',
      });
    }

    console.log(`[ADMIN_BLOCK_TRADING_FOR_PLAYER] 거래 차단: ${playerData.nickname}`);
  });

  // 개별 플레이어 거래 차단 해제
  socket.on('ADMIN_UNBLOCK_TRADING_FOR_PLAYER', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { socketId, grantReward } = data;
    const gameState = stateManager.getGameState();
    const playerData = stateManager.getPlayerData(socketId, gameState.isPracticeMode);

    if (!playerData) {
      console.log(`[ADMIN_UNBLOCK_TRADING_FOR_PLAYER] 플레이어를 찾을 수 없음: ${socketId}`);
      return;
    }

    const blockedInfo = stateManager.getPlayerTradingBlocked(socketId);

    if (grantReward && blockedInfo?.rewardAmount) {
      // 보상 지급
      const result = rewardService.grantMinigameReward(socketId, gameState.isPracticeMode);
      if (result.success) {
        console.log(
          `[ADMIN_UNBLOCK_TRADING_FOR_PLAYER] 보상 지급: ${playerData.nickname} - ${result.rewardAmount}원`
        );
      }
    } else {
      stateManager.deletePlayerTradingBlocked(socketId);
    }

    // 플레이어에게 알림
    const playerSocket = io.sockets.sockets.get(socketId);
    if (playerSocket) {
      playerSocket.emit('PLAYER_TRADING_BLOCKED', {
        isBlocked: false,
        message: '미니게임이 종료되었습니다. 투자를 재개할 수 있습니다.',
      });

      // 포트폴리오 업데이트
      broadcastService.emitPortfolioUpdate(socketId, playerData, gameState.isPracticeMode);
    }

    broadcastService.broadcastGameState();
    broadcastService.broadcastPlayerList();

    console.log(`[ADMIN_UNBLOCK_TRADING_FOR_PLAYER] 거래 차단 해제: ${playerData.nickname}`);
  });

  // 플레이어 미니게임 완료 신호
  socket.on('PLAYER_MINIGAME_COMPLETE', () => {
    const blockedInfo = stateManager.getPlayerTradingBlocked(socket.id);
    if (!blockedInfo?.isBlocked) return;

    const gameState = stateManager.getGameState();
    const playerData = stateManager.getPlayerData(socket.id, gameState.isPracticeMode);
    const nickname = playerData?.nickname || 'Unknown';

    // 모든 관리자에게 알림 (adminSockets는 socket 객체 Set)
    stateManager.getAdminSockets().forEach((adminSocket) => {
      adminSocket.emit('PLAYER_MINIGAME_COMPLETE_NOTIFICATION', {
        socketId: socket.id,
        nickname,
        timestamp: new Date().toISOString(),
      });
    });

    console.log(`[PLAYER_MINIGAME_COMPLETE] ${nickname} 미니게임 완료 신호`);
  });

  // 전역 거래 차단
  socket.on('ADMIN_BLOCK_TRADING', () => {
    if (!stateManager.isAdmin(socket)) return;

    stateManager.updateGameState({ isTradingBlocked: true });

    io.emit('TRADING_BLOCKED', {
      isBlocked: true,
      message: '미니게임이 시작되었습니다. 모든 투자가 일시 중단됩니다.',
    });

    broadcastService.broadcastGameState();
    console.log('[ADMIN_BLOCK_TRADING] 전역 거래 차단');
  });

  // 전역 거래 차단 해제
  socket.on('ADMIN_UNBLOCK_TRADING', () => {
    if (!stateManager.isAdmin(socket)) return;

    stateManager.updateGameState({ isTradingBlocked: false });

    io.emit('TRADING_BLOCKED', {
      isBlocked: false,
      message: '미니게임이 종료되었습니다. 투자를 재개할 수 있습니다.',
    });

    broadcastService.broadcastGameState();
    console.log('[ADMIN_UNBLOCK_TRADING] 전역 거래 차단 해제');
  });

  // 플레이어 직접 거래 허용 토글
  socket.on('ADMIN_TOGGLE_PLAYER_TRADING', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const gameState = stateManager.getGameState();
    // data가 있으면 allow 값 사용, 없으면 현재 상태 토글
    const allow = data?.allow !== undefined ? !!data.allow : !gameState.allowPlayerTrading;
    stateManager.updateGameState({ allowPlayerTrading: allow });

    broadcastService.broadcastGameState();
    console.log(`[ADMIN_TOGGLE_PLAYER_TRADING] 플레이어 직접 거래: ${allow ? '허용' : '비허용'}`);
  });
}

export default registerTradingControlHandlers;
