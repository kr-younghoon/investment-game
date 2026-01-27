import { STOCKS, PRACTICE_STOCKS } from '../../src/data/initialScenarios.js';

/**
 * Player Handler - 플레이어 참가/상태 관련 핸들러
 */
export function registerPlayerHandlers(socket, io, services) {
  const { stateManager, playerService, broadcastService, dbHelpers } = services;

  // 플레이어 상태 요청
  socket.on('PLAYER_REQUEST_STATE', () => {
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
  });

  // 플레이어 참가
  socket.on('PLAYER_JOIN', (data, callback) => {
    const { nickname } = data;
    const gameState = stateManager.getGameState();

    // 닉네임 유효성 검사
    if (!nickname || nickname.trim().length === 0) {
      if (callback) {
        callback({ success: false, message: '닉네임을 입력해주세요.' });
      }
      return;
    }

    if (nickname.length > 20) {
      if (callback) {
        callback({ success: false, message: '닉네임은 20자 이내로 입력해주세요.' });
      }
      return;
    }

    const trimmedNickname = nickname.trim();

    // 중복 닉네임 확인
    const duplicateCheck = playerService.isNicknameDuplicate(trimmedNickname, socket.id);
    if (duplicateCheck.isDuplicate) {
      // 재접속 시도: 기존 플레이어 데이터 확인
      const currentGameId = gameState.gameId || 'legacy';
      const existingPlayer = dbHelpers.getPlayerByNickname(
        currentGameId,
        trimmedNickname,
        gameState.isPracticeMode
      );

      if (existingPlayer) {
        // 기존 플레이어 복원
        const playerData = playerService.createOrUpdatePlayer(
          socket.id,
          trimmedNickname,
          gameState.isPracticeMode
        );

        stateManager.addConnectedPlayer(socket.id);

        // 포트폴리오 전송
        const currentPrices = broadcastService.getCurrentPrices();
        const totalAsset = broadcastService.calculatePlayerTotalAsset(
          socket.id,
          gameState.isPracticeMode
        );

        socket.emit('PLAYER_PORTFOLIO_UPDATE', {
          cash: playerData.cash,
          stocks: playerData.stocks,
          bonusPoints: 0,
          totalAsset,
        });

        socket.emit('PLAYER_HINTS_UPDATE', playerData.hints || []);

        if (callback) {
          callback({
            success: true,
            nickname: trimmedNickname,
            isReconnect: true,
          });
        }

        broadcastService.broadcastPlayerCount();
        broadcastService.broadcastPlayerList();
        broadcastService.broadcastGameState();

        console.log(`[PLAYER_JOIN] 플레이어 재접속: ${trimmedNickname}`);
        return;
      }

      if (callback) {
        callback({
          success: false,
          message: '이미 사용 중인 닉네임입니다.',
        });
      }
      return;
    }

    // 새 플레이어 생성
    const playerData = playerService.createOrUpdatePlayer(
      socket.id,
      trimmedNickname,
      gameState.isPracticeMode
    );

    // 게임 상태 전송
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

    // 포트폴리오 전송
    socket.emit('PLAYER_PORTFOLIO_UPDATE', {
      cash: playerData.cash,
      stocks: playerData.stocks,
      bonusPoints: 0,
      totalAsset: playerData.totalAsset,
    });

    socket.emit('PLAYER_HINTS_UPDATE', playerData.hints || []);

    if (callback) {
      callback({
        success: true,
        nickname: trimmedNickname,
        isReconnect: false,
      });
    }

    broadcastService.broadcastPlayerCount();
    broadcastService.broadcastPlayerList();
    broadcastService.broadcastGameState();

    console.log(`[PLAYER_JOIN] 새 플레이어 참가: ${trimmedNickname}`);
  });

  // 게임 종료 요청 (플레이어)
  socket.on('PLAYER_REQUEST_END_GAME', () => {
    // 플레이어의 게임 종료 요청은 무시하거나 로그만 남김
    console.log(`[PLAYER_REQUEST_END_GAME] 플레이어 요청 무시: ${socket.id}`);
  });
}

export default registerPlayerHandlers;
