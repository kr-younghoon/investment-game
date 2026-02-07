import { PROVIDER_HINT_PRICES } from '../../src/data/providerHintPools.js';

/**
 * Hint Handler - 힌트/루머 관련 핸들러
 */
export function registerHintHandlers(socket, io, services) {
  const { stateManager, hintService, broadcastService, gameStateService } = services;

  // 라운드 루머 저장
  socket.on('ADMIN_SAVE_ROUND_RUMOR', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { round, rumor } = data;
    const gameState = stateManager.getGameState();
    const currentGameId = gameState.gameId || 'legacy';

    const result = hintService.saveRoundRumor(currentGameId, round, rumor);

    if (result.success) {
      console.log(`[ADMIN_SAVE_ROUND_RUMOR] 라운드 ${round} 루머 저장`);
    }
  });

  // 라운드 힌트 저장
  socket.on('ADMIN_SAVE_ROUND_HINTS', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { round, hints } = data;
    const gameState = stateManager.getGameState();
    const currentGameId = gameState.gameId || 'legacy';

    const result = hintService.saveRoundHints(currentGameId, round, hints);

    if (result.success) {
      console.log(`[ADMIN_SAVE_ROUND_HINTS] 라운드 ${round} 힌트 저장: ${hints.length}개`);
    }
  });

  // Provider별 라운드 힌트 저장
  socket.on('ADMIN_SAVE_PROVIDER_ROUND_HINTS', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { round, provider, hints } = data;
    const gameState = stateManager.getGameState();
    const currentGameId = gameState.gameId || 'legacy';

    // Provider 힌트 직렬화 (가격 유효성 검증)
    const rawPrice = PROVIDER_HINT_PRICES?.[provider] ?? 0;
    const price = typeof rawPrice === 'number' && rawPrice >= 0 ? rawPrice : 0;
    const serializedHints = hints.map((content) =>
      hintService.serializeProviderHint(provider, content, price)
    );

    // 기존 힌트에 추가
    const existingHints = hintService.getRoundHints(currentGameId, round);
    const existingContent = existingHints.map((h) => h.hint_content);
    const allHints = [...existingContent, ...serializedHints];

    const result = hintService.saveRoundHints(currentGameId, round, allHints);

    if (result.success) {
      console.log(
        `[ADMIN_SAVE_PROVIDER_ROUND_HINTS] 라운드 ${round} ${provider} 힌트 저장: ${hints.length}개`
      );
    }
  });

  // 루머 브로드캐스트
  socket.on('ADMIN_BROADCAST_RUMOR', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { rumor } = data;
    const gameState = stateManager.getGameState();

    // 현재 라운드의 루머 또는 커스텀 루머 사용
    let rumorToSend = rumor;
    if (!rumorToSend) {
      const scenarioIndex = gameState.currentRound > 0 ? gameState.currentRound - 1 : 0;
      rumorToSend = gameState.scenarios[scenarioIndex]?.rumor || '';
    }

    io.emit('PLAYER_RUMOR_UPDATE', { rumor: rumorToSend });
    console.log(`[ADMIN_BROADCAST_RUMOR] 루머 브로드캐스트`);
  });

  // 랜덤 힌트 브로드캐스트
  socket.on('ADMIN_BROADCAST_RANDOM_HINTS', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { provider, count = 3 } = data;
    const gameState = stateManager.getGameState();
    const currentGameId = gameState.gameId || 'legacy';
    const displayRound = gameStateService.getDisplayRoundNumber();

    // Provider 힌트 풀 가져오기
    const hintPool = hintService.getProviderHintPool(currentGameId, displayRound, provider);

    if (hintPool.length === 0) {
      socket.emit('HINT_BROADCAST_ERROR', {
        message: `${provider}의 라운드 ${displayRound} 힌트가 없습니다.`,
      });
      return;
    }

    // count 값 검증 (1 이상, 힌트풀 크기 이하)
    const validCount = Math.max(1, Math.min(
      Number.isInteger(count) ? count : 3,
      hintPool.length
    ));

    // 랜덤 힌트 선택
    const selectedHints = hintService.getRandomHints(hintPool, validCount);

    // 모든 플레이어에게 힌트 전송
    const connectedPlayers = stateManager.getConnectedPlayers();
    const price = PROVIDER_HINT_PRICES?.[provider] ?? 0;

    connectedPlayers.forEach((socketId) => {
      selectedHints.forEach((content) => {
        hintService.grantHint(
          socketId,
          provider,
          content,
          price,
          gameState.currentRound,
          gameState.isPracticeMode
        );
      });

      const playerSocket = io.sockets.sockets.get(socketId);
      if (playerSocket) {
        const playerData = stateManager.getPlayerData(socketId, gameState.isPracticeMode);
        playerSocket.emit('PLAYER_HINTS_UPDATE', playerData?.hints || []);
      }
    });

    console.log(
      `[ADMIN_BROADCAST_RANDOM_HINTS] ${provider} 힌트 ${selectedHints.length}개 브로드캐스트`
    );
  });

  // 개별 플레이어에게 힌트 부여
  socket.on('ADMIN_GRANT_HINT', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { socketId, difficulty, hintContent: content, price } = data;
    const gameState = stateManager.getGameState();
    const currentGameId = gameState.gameId || 'legacy';
    const displayRound = gameStateService.getDisplayRoundNumber();

    // content가 null이면 해당 provider의 힌트 풀에서 랜덤 선택
    let hintContent = content;
    if (!hintContent) {
      const hintPool = hintService.getProviderHintPool(currentGameId, displayRound, difficulty);
      if (hintPool.length === 0) {
        socket.emit('HINT_GRANT_ERROR', {
          message: `${difficulty}의 라운드 ${displayRound} 힌트가 없습니다.`,
        });
        return;
      }
      const randomHints = hintService.getRandomHints(hintPool, 1);
      hintContent = randomHints[0];
    }

    const result = hintService.grantHint(
      socketId,
      difficulty,
      hintContent,
      price,
      gameState.currentRound,
      gameState.isPracticeMode
    );

    if (!result.success) {
      socket.emit('HINT_GRANT_ERROR', { message: result.error });
      return;
    }

    // 플레이어에게 힌트 업데이트 전송
    const playerSocket = io.sockets.sockets.get(socketId);
    if (playerSocket) {
      const playerData = stateManager.getPlayerData(socketId, gameState.isPracticeMode);
      playerSocket.emit('PLAYER_HINTS_UPDATE', playerData?.hints || []);
    }

    console.log(`[ADMIN_GRANT_HINT] 힌트 부여: ${socketId} (${difficulty}: ${hintContent})`);
  });

  // 모든 플레이어에게 힌트 부여
  socket.on('ADMIN_GRANT_HINT_TO_ALL', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { difficulty, hintContent: content, price } = data;
    const gameState = stateManager.getGameState();

    const results = hintService.grantHintToAll(
      difficulty,
      content,
      price,
      gameState.currentRound,
      gameState.isPracticeMode
    );

    // 각 플레이어에게 힌트 업데이트 전송
    results.forEach(({ socketId, success }) => {
      if (success) {
        const playerSocket = io.sockets.sockets.get(socketId);
        if (playerSocket) {
          const playerData = stateManager.getPlayerData(socketId, gameState.isPracticeMode);
          playerSocket.emit('PLAYER_HINTS_UPDATE', playerData?.hints || []);
        }
      }
    });

    console.log(`[ADMIN_GRANT_HINT_TO_ALL] 전체 힌트 부여: ${results.length}명`);
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

export default registerHintHandlers;
