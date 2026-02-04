/**
 * Scenario Handler - 시나리오 관리 핸들러
 */
export function registerScenarioHandlers(socket, io, services) {
  const { stateManager, dbHelpers } = services;

  // 시나리오 목록 조회
  socket.on('ADMIN_GET_SCENARIOS', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { type } = data;
    const scenarios = dbHelpers.getAllScenarios(type);

    // 각 시나리오의 상세 정보도 포함
    const scenariosWithDetails = scenarios.map((s) => {
      const full = dbHelpers.getScenarioById(s.id);
      return full || s;
    });

    socket.emit('SCENARIOS_LIST_UPDATE', { scenarios: scenariosWithDetails });
  });

  // 시나리오 저장
  socket.on('ADMIN_SAVE_SCENARIO', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { id, name, type, stocks, rounds } = data;

    try {
      const scenarioId = dbHelpers.saveScenario(id, name, type, stocks, rounds);
      console.log(`[ADMIN_SAVE_SCENARIO] 시나리오 저장 완료: ${name} (ID: ${scenarioId})`);
      socket.emit('SCENARIO_SAVED', { success: true, id: scenarioId });
    } catch (error) {
      console.error('[ADMIN_SAVE_SCENARIO] 오류:', error);
      socket.emit('SCENARIO_SAVED', { success: false, error: error.message });
    }
  });

  // 시나리오 삭제
  socket.on('ADMIN_DELETE_SCENARIO', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { id } = data;

    try {
      dbHelpers.deleteScenario(id);
      console.log(`[ADMIN_DELETE_SCENARIO] 시나리오 삭제 완료: ${id}`);
      socket.emit('SCENARIO_DELETED', { success: true });
    } catch (error) {
      console.error('[ADMIN_DELETE_SCENARIO] 오류:', error);
      socket.emit('SCENARIO_DELETED', { success: false, error: error.message });
    }
  });

  // 커스텀 시나리오로 게임 시작
  socket.on('ADMIN_START_GAME_WITH_SCENARIO', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { stocks, rounds, isPractice, shouldDelete } = data;

    console.log(`[ADMIN_START_GAME_WITH_SCENARIO] 게임 시작: isPractice=${isPractice}, shouldDelete=${shouldDelete}`);

    // 게임 상태 서비스에서 커스텀 시나리오로 게임 시작
    const { gameStateService, hintService } = services;
    if (gameStateService && gameStateService.startGameWithScenario) {
      const newGameId = gameStateService.startGameWithScenario(stocks, rounds, isPractice, shouldDelete);

      // Provider 힌트 풀 초기화
      if (hintService && newGameId) {
        hintService.seedProviderHintPoolsForGame(newGameId);
      }
    } else {
      console.error('[ADMIN_START_GAME_WITH_SCENARIO] gameStateService.startGameWithScenario 함수가 없습니다');
      socket.emit('ADMIN_ERROR', { message: '게임 시작 기능을 사용할 수 없습니다.' });
    }
  });
}

export default registerScenarioHandlers;
