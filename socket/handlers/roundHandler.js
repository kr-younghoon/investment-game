/**
 * Round Handler - 라운드 관리 관련 핸들러
 */
export function registerRoundHandlers(socket, io, services) {
  const { stateManager, gameStateService, broadcastService, dbHelpers } = services;

  // 다음 라운드 진행
  socket.on('ADMIN_NEXT_ROUND', () => {
    if (!stateManager.isAdmin(socket)) return;

    const gameState = stateManager.getGameState();

    if (!gameState.isGameStarted || gameState.isWaitingMode) {
      socket.emit('ROUND_ERROR', { message: '게임이 시작되지 않았습니다.' });
      return;
    }

    // 라운드 진행 전 모든 타이머 정리 (상호배제)
    stateManager.clearCountdownInterval();
    stateManager.clearRoundTimerInterval();

    // 카운트다운 시작 (3초)
    stateManager.updateGameState({ countdown: 3 });
    io.emit('ROUND_COUNTDOWN', { countdown: 3 });

    const countdownInterval = setInterval(() => {
      const gs = stateManager.getGameState();
      if (gs.countdown === null || gs.countdown <= 0) {
        stateManager.clearCountdownInterval();
        stateManager.updateGameState({ countdown: null });

        // 다음 라운드 가격 계산
        const hasNextRound = gameStateService.calculateNextRoundPrices();

        if (!hasNextRound) {
          // 마지막 라운드 뉴스 표시 후 게임 종료
          broadcastService.broadcastGameState();
          console.log('[ADMIN_NEXT_ROUND] 마지막 라운드 - 게임 종료 대기');

          // 잠시 후 게임 종료
          setTimeout(() => {
            gameStateService.handleGameEnd();
          }, 5000);
          return;
        }

        // 모든 플레이어 총 자산 업데이트
        const dataMap = stateManager.getPlayersData(gs.isPracticeMode);
        dataMap.forEach((playerData, socketId) => {
          const totalAsset = broadcastService.calculatePlayerTotalAsset(
            socketId,
            gs.isPracticeMode
          );
          playerData.totalAsset = totalAsset;

          if (playerData.dbId) {
            try {
              dbHelpers.updatePlayerCashById(
                playerData.dbId,
                playerData.cash,
                totalAsset,
                gs.isPracticeMode
              );
            } catch (error) {
              console.error('[ADMIN_NEXT_ROUND] 플레이어 자산 업데이트 오류:', error);
            }
          }
        });

        // 라운드 타이머 시작
        gameStateService.startRoundTimer();

        // 라운드 진행 로그 기록
        const currentGameId = gs.gameId || 'legacy';
        try {
          dbHelpers.saveTransaction(
            currentGameId,
            null,
            'SYSTEM',
            'ROUND_ADVANCE',
            null,
            0,
            0,
            0,
            0,
            0,
            null,
            null,
            stateManager.getGameState().currentRound,
            null,
            gs.isPracticeMode
          );
        } catch (error) {
          console.error('[ADMIN_NEXT_ROUND] 라운드 진행 로그 저장 오류:', error);
        }

        broadcastService.broadcastGameState();
        broadcastService.broadcastPlayerList();
        broadcastService.persistGameState({ force: true });

        console.log(
          `[ADMIN_NEXT_ROUND] 라운드 ${stateManager.getGameState().currentRound} 시작`
        );
        return;
      }

      stateManager.updateGameState({ countdown: gs.countdown - 1 });
      io.emit('ROUND_COUNTDOWN', { countdown: stateManager.getGameState().countdown });
    }, 1000);

    stateManager.setCountdownInterval(countdownInterval);
  });

  // 이전 라운드로 이동
  socket.on('ADMIN_PREVIOUS_ROUND', () => {
    if (!stateManager.isAdmin(socket)) return;

    const gameState = stateManager.getGameState();

    if (!gameState.isGameStarted) {
      socket.emit('ROUND_ERROR', { message: '게임이 시작되지 않았습니다.' });
      return;
    }

    if (gameState.currentRound <= 0) {
      socket.emit('ROUND_ERROR', { message: '더 이상 이전 라운드로 이동할 수 없습니다.' });
      return;
    }

    // 이전 라운드로 이동
    const prevRound = gameState.currentRound - 1;
    const scenarios = gameState.scenarios;

    // 시나리오 인덱스: 라운드 1부터 시나리오가 시작됨
    const scenarioIndex = prevRound - 1;

    const scenario = scenarioIndex >= 0 && scenarioIndex < scenarios.length
      ? scenarios[scenarioIndex]
      : null;

    stateManager.updateGameState({
      currentRound: prevRound,
      currentNews: scenario?.headline || '',
      currentNewsBriefing: scenario?.newsBriefing || [],
      isLastRound: false,
    });

    // 라운드 타이머 재시작
    gameStateService.startRoundTimer();

    broadcastService.broadcastGameState();
    broadcastService.broadcastPlayerList();
    broadcastService.persistGameState({ force: true });

    console.log(`[ADMIN_PREVIOUS_ROUND] 라운드 ${prevRound}로 이동`);
  });
}

export default registerRoundHandlers;
