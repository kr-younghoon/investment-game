import {
  STOCKS,
  initialScenarios,
  PRACTICE_STOCKS,
  practiceScenarios,
} from '../../src/data/initialScenarios.js';
import { createGameId } from '../../db.js';

/**
 * Game Handler - 게임 시작/종료 관련 핸들러
 */
export function registerGameHandlers(socket, io, services) {
  const { stateManager, gameStateService, playerService, hintService, broadcastService, dbHelpers } = services;

  // 연습 게임 시작
  socket.on('ADMIN_START_PRACTICE', (data = {}) => {
    if (!stateManager.isAdmin(socket)) return;

    const { shouldDeleteOldData = false } = data;
    const gameState = stateManager.getGameState();

    console.log('[ADMIN_START_PRACTICE] 연습 게임 시작');

    // 새 게임 ID 생성
    const newGameId = createGameId();
    dbHelpers.createGame(newGameId, true);

    // 이전 데이터 삭제 옵션
    if (shouldDeleteOldData) {
      playerService.deleteAllPlayers(true, {
        gameId: null,
        shouldClearTransactions: true,
      });
    }

    // 게임 상태 초기화
    stateManager.resetForNewGame(true);
    stateManager.updateGameState({
      gameId: newGameId,
      isPracticeMode: true,
      isGameStarted: true,
      isWaitingMode: false,
      scenarios: practiceScenarios,
    });

    // 게임 설정 업데이트
    stateManager.setGameSettings({
      totalRounds: practiceScenarios.length + 1,
    });

    // 주식 가격 초기화
    const stockPrices = {};
    PRACTICE_STOCKS.forEach((stock) => {
      stockPrices[stock.id] = [stock.basePrice];
    });
    stateManager.updateGameState({ stockPrices });

    // 이전 연습 데이터 초기화 (stale 데이터 방지)
    stateManager.practicePlayersData.clear();

    // 기존 플레이어 데이터 마이그레이션 (실제 -> 연습)
    const realPlayersData = stateManager.playersData;
    const practicePlayersData = stateManager.practicePlayersData;
    const connectedPlayers = stateManager.getConnectedPlayers();
    const INITIAL_CASH = stateManager.INITIAL_CASH;

    realPlayersData.forEach((playerData, socketId) => {
      if (connectedPlayers.has(socketId)) {
        // 플레이어 데이터 초기화
        const newPlayerData = {
          nickname: playerData.nickname,
          cash: INITIAL_CASH,
          stocks: {},
          bonusPoints: 0,
          totalAsset: INITIAL_CASH,
          transactions: [],
          hints: [],
          dbId: null,
        };

        PRACTICE_STOCKS.forEach((stock) => {
          newPlayerData.stocks[stock.id] = 0;
        });

        // DB 저장
        try {
          const savedPlayer = dbHelpers.savePlayer(
            newGameId,
            socketId,
            newPlayerData.nickname,
            INITIAL_CASH,
            0,
            INITIAL_CASH,
            true
          );
          newPlayerData.dbId = savedPlayer?.id || null;
        } catch (error) {
          console.error(`[ADMIN_START_PRACTICE] 플레이어 저장 오류: ${error.message}`);
          newPlayerData.dbId = null;
        }

        practicePlayersData.set(socketId, newPlayerData);

        // 플레이어에게 포트폴리오 전송
        const playerSocket = io.sockets.sockets.get(socketId);
        if (playerSocket) {
          playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
            cash: INITIAL_CASH,
            stocks: newPlayerData.stocks,
            bonusPoints: 0,
            totalAsset: INITIAL_CASH,
          });
        }
      }
    });

    // Provider 힌트 풀 초기화
    hintService.seedProviderHintPoolsForGame(newGameId);

    broadcastService.broadcastGameState();
    broadcastService.broadcastPlayerList();
    broadcastService.persistGameState({ force: true });

    io.emit('GAME_RESTART', { isPracticeMode: true });
    console.log(`[ADMIN_START_PRACTICE] 연습 게임 시작 완료 (gameId: ${newGameId})`);
  });

  // 실제 게임 시작
  socket.on('ADMIN_START_REAL_GAME', (data = {}) => {
    if (!stateManager.isAdmin(socket)) return;

    const { shouldDeleteOldData = false } = data;

    console.log('[ADMIN_START_REAL_GAME] 실제 게임 시작');

    // 새 게임 ID 생성
    const newGameId = createGameId();
    dbHelpers.createGame(newGameId, false);

    // 이전 데이터 삭제 옵션
    if (shouldDeleteOldData) {
      playerService.deleteAllPlayers(false, {
        gameId: null,
        shouldClearTransactions: true,
      });
    }

    // 게임 상태 초기화
    stateManager.resetForNewGame(false);
    stateManager.updateGameState({
      gameId: newGameId,
      isPracticeMode: false,
      isGameStarted: true,
      isWaitingMode: false,
      scenarios: initialScenarios,
    });

    // 게임 설정 업데이트
    stateManager.setGameSettings({
      totalRounds: initialScenarios.length + 1,
    });

    // 주식 가격 초기화
    const stockPrices = {};
    STOCKS.forEach((stock) => {
      stockPrices[stock.id] = [stock.basePrice];
    });
    stateManager.updateGameState({ stockPrices });

    // 연습 모드 데이터 정리 (모드 전환 시 stale 데이터 방지)
    stateManager.practicePlayersData.clear();

    // 기존 플레이어 데이터 초기화
    const playersData = stateManager.playersData;
    const connectedPlayers = stateManager.getConnectedPlayers();
    const INITIAL_CASH = stateManager.INITIAL_CASH;

    connectedPlayers.forEach((socketId) => {
      const playerData = playersData.get(socketId);
      if (playerData) {
        // 플레이어 데이터 초기화
        playerData.cash = INITIAL_CASH;
        playerData.bonusPoints = 0;
        playerData.totalAsset = INITIAL_CASH;
        playerData.transactions = [];
        playerData.hints = [];

        // 이전 주식 데이터 완전 초기화 후 새 주식으로 교체
        playerData.stocks = {};
        STOCKS.forEach((stock) => {
          playerData.stocks[stock.id] = 0;
        });

        // DB 저장
        playerService.resetPlayerDbForNewGame(socketId, playerData, false);

        // 플레이어에게 포트폴리오 전송
        const playerSocket = io.sockets.sockets.get(socketId);
        if (playerSocket) {
          playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
            cash: INITIAL_CASH,
            stocks: playerData.stocks,
            bonusPoints: 0,
            totalAsset: INITIAL_CASH,
          });
        }
      }
    });

    // Provider 힌트 풀 초기화
    hintService.seedProviderHintPoolsForGame(newGameId);

    broadcastService.broadcastGameState();
    broadcastService.broadcastPlayerList();
    broadcastService.persistGameState({ force: true });

    io.emit('GAME_RESTART', { isPracticeMode: false });
    console.log(`[ADMIN_START_REAL_GAME] 실제 게임 시작 완료 (gameId: ${newGameId})`);
  });

  // 일반 게임 시작 (레거시 지원)
  socket.on('ADMIN_START_GAME', (data = {}) => {
    if (!stateManager.isAdmin(socket)) return;

    const { isPractice = false } = data;

    if (isPractice) {
      socket.emit('ADMIN_START_PRACTICE', data);
    } else {
      socket.emit('ADMIN_START_REAL_GAME', data);
    }
  });

  // 게임 종료
  socket.on('ADMIN_END_GAME', () => {
    if (!stateManager.isAdmin(socket)) return;

    const gameState = stateManager.getGameState();
    if (!gameState.isGameStarted && gameState.isWaitingMode) {
      socket.emit('GAME_ERROR', { message: '게임이 아직 시작되지 않았습니다.' });
      return;
    }

    console.log('[ADMIN_END_GAME] 게임 종료 요청');
    gameStateService.handleGameEnd();
  });
}

export default registerGameHandlers;
