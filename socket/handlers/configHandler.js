/**
 * Config Handler - 게임 설정 관련 핸들러
 */
export function registerConfigHandlers(socket, io, services) {
  const { stateManager, broadcastService } = services;

  // 게임 설정 업데이트
  socket.on('ADMIN_UPDATE_GAME_SETTINGS', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { initialCash, totalRounds } = data;
    const gameSettings = stateManager.getGameSettings();

    if (initialCash !== undefined && initialCash > 0) {
      gameSettings.initialCash = initialCash;
      stateManager.INITIAL_CASH = initialCash;
    }

    if (totalRounds !== undefined && totalRounds > 0) {
      gameSettings.totalRounds = totalRounds;
    }

    stateManager.setGameSettings(gameSettings);

    // 모든 관리자에게 업데이트 전송
    stateManager.getAdminSockets().forEach((adminSocket) => {
      adminSocket.emit('GAME_SETTINGS_UPDATE', gameSettings);
    });

    console.log(`[ADMIN_UPDATE_GAME_SETTINGS] 게임 설정 업데이트:`, gameSettings);
  });

  // 게임 설정 요청
  socket.on('ADMIN_REQUEST_GAME_SETTINGS', () => {
    if (!stateManager.isAdmin(socket)) return;

    socket.emit('GAME_SETTINGS_UPDATE', stateManager.getGameSettings());
  });

  // 시나리오 업데이트
  socket.on('ADMIN_UPDATE_SCENARIO', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { roundIndex, scenario } = data;
    const gameState = stateManager.getGameState();

    if (
      roundIndex >= 0 &&
      roundIndex < gameState.scenarios.length &&
      scenario
    ) {
      try {
        const parsedScenario = typeof scenario === 'string'
          ? JSON.parse(scenario)
          : scenario;

        gameState.scenarios[roundIndex] = {
          ...gameState.scenarios[roundIndex],
          ...parsedScenario,
        };

        console.log(`[ADMIN_UPDATE_SCENARIO] 시나리오 업데이트 - 라운드 ${roundIndex}`);

        // 모든 관리자에게 업데이트 알림
        stateManager.getAdminSockets().forEach((adminSocket) => {
          adminSocket.emit('SCENARIO_UPDATE', {
            roundIndex,
            scenario: gameState.scenarios[roundIndex],
          });
        });
      } catch (error) {
        console.error('[ADMIN_UPDATE_SCENARIO] 시나리오 파싱 오류:', error);
        socket.emit('SCENARIO_UPDATE_ERROR', {
          message: '시나리오 파싱 중 오류가 발생했습니다.',
        });
      }
    }
  });

  // 라운드 시나리오 요청
  socket.on('ADMIN_REQUEST_ROUND_SCENARIOS', () => {
    if (!stateManager.isAdmin(socket)) return;

    const gameState = stateManager.getGameState();
    socket.emit('ROUND_SCENARIOS_UPDATE', {
      scenarios: gameState.scenarios,
      isPracticeMode: gameState.isPracticeMode,
    });
  });
}

export default registerConfigHandlers;
