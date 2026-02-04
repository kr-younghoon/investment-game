import { STOCKS, PRACTICE_STOCKS } from '../../src/data/initialScenarios.js';

// 현재 게임에서 사용 중인 주식 목록 가져오기
function getActiveStocks(stateManager, isPractice) {
  const gs = stateManager.getGameState();
  if (gs.customStocks && gs.customStocks.length > 0) return gs.customStocks;
  return isPractice ? PRACTICE_STOCKS : STOCKS;
}

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

  // 플레이어 참가 (원본과 동일한 시그니처: nickname 문자열)
  socket.on('PLAYER_JOIN', (nickname) => {
    const gameState = stateManager.getGameState();
    const isPractice = gameState.isPracticeMode;

    // 닉네임 유효성 검사
    if (!nickname || typeof nickname !== 'string') {
      socket.emit('NICKNAME_ERROR', { message: '닉네임을 입력해주세요.' });
      return;
    }

    const trimmedNickname = nickname.trim();
    if (trimmedNickname.length === 0) {
      socket.emit('NICKNAME_ERROR', { message: '닉네임을 입력해주세요.' });
      return;
    }

    if (trimmedNickname.length > 20) {
      socket.emit('NICKNAME_ERROR', { message: '닉네임은 20자 이하여야 합니다.' });
      return;
    }

    // 닉네임 중복 체크
    const duplicateCheck = playerService.isNicknameDuplicate(trimmedNickname, socket.id);
    if (duplicateCheck.isDuplicate) {
      // 기존 연결된 플레이어 찾기
      const allPlayersData = new Map([
        ...stateManager.playersData,
        ...stateManager.practicePlayersData,
      ]);

      let existingSocketId = null;
      for (const [existingSocketIdKey, playerData] of allPlayersData.entries()) {
        if (playerData.nickname === trimmedNickname) {
          const existingSocket = io.sockets.sockets.get(existingSocketIdKey);
          if (existingSocket && existingSocket.connected) {
            existingSocketId = existingSocketIdKey;
            break;
          }
        }
      }

      if (existingSocketId) {
        // 기존 연결 끊기
        const existingSocket = io.sockets.sockets.get(existingSocketId);
        if (existingSocket) {
          console.log(`기존 연결 끊기: ${trimmedNickname} (socket: ${existingSocketId})`);
          existingSocket.emit('NICKNAME_DUPLICATE_KICK', {
            message: '다른 곳에서 같은 닉네임으로 접속했습니다. 연결이 끊어집니다.',
          });
          // 기존 플레이어 데이터 정리
          stateManager.removeConnectedPlayer(existingSocketId);
          stateManager.deletePlayerData(existingSocketId, isPractice);
          existingSocket.disconnect();
        }
      }
    }

    const currentGameId = gameState.gameId || 'legacy';

    let playerData;
    const INITIAL_CASH = stateManager.INITIAL_CASH;

    try {
      // 재접속 시 기존 플레이어 찾기
      const existingPlayer = dbHelpers.getPlayerByNickname(currentGameId, trimmedNickname, isPractice);

      if (existingPlayer) {
        // 기존 플레이어 복원
        const savedPlayer = dbHelpers.savePlayer(
          currentGameId,
          socket.id,
          trimmedNickname,
          existingPlayer.cash,
          existingPlayer.bonus_points || 0,
          existingPlayer.total_asset,
          isPractice
        );

        if (!savedPlayer || !savedPlayer.id) {
          throw new Error('플레이어 데이터 저장 실패');
        }

        // 주식 정보 가져오기
        const dbStocks = dbHelpers.getPlayerStocks(currentGameId, savedPlayer.id, isPractice) || [];
        const stocks = {};
        const stockList = getActiveStocks(stateManager, isPractice);
        stockList.forEach((stock) => {
          const dbStock = dbStocks.find((s) => s.stock_id === stock.id);
          stocks[stock.id] = dbStock ? dbStock.quantity : 0;
        });

        // 힌트 정보 가져오기
        const dbHints = dbHelpers.getPlayerHints(currentGameId, savedPlayer.id, isPractice) || [];
        const hints = dbHints.map((hint) => ({
          difficulty: hint.difficulty,
          content: hint.content,
          receivedAt: hint.received_at,
          price: hint.price,
          round: hint.round,
        }));

        // 거래 내역 가져오기
        const dbTransactions = dbHelpers.getTransactionsByPlayerId(currentGameId, savedPlayer.id, isPractice) || [];
        const transactions = dbTransactions.map((t) => ({
          type: t.type,
          stockId: t.stockId,
          quantity: t.quantity,
          price: t.price,
          totalCost: t.totalCost,
          totalRevenue: t.totalRevenue,
          timestamp: t.timestamp,
          round: t.round,
        }));

        playerData = {
          nickname: trimmedNickname,
          cash: existingPlayer.cash,
          stocks,
          bonusPoints: existingPlayer.bonus_points || 0,
          totalAsset: existingPlayer.total_asset,
          transactions,
          hints,
          dbId: savedPlayer.id,
        };

        console.log(`[PLAYER_JOIN] 플레이어 재접속: ${trimmedNickname} (cash: ${playerData.cash})`);
      } else {
        // 새 플레이어 생성
        const savedPlayer = dbHelpers.savePlayer(
          currentGameId,
          socket.id,
          trimmedNickname,
          INITIAL_CASH,
          0,
          INITIAL_CASH,
          isPractice
        );

        if (!savedPlayer || !savedPlayer.id) {
          throw new Error('플레이어 데이터 저장 실패');
        }

        const stocks = {};
        const stockList = getActiveStocks(stateManager, isPractice);
        stockList.forEach((stock) => {
          stocks[stock.id] = 0;
        });

        playerData = {
          nickname: trimmedNickname,
          cash: INITIAL_CASH,
          stocks,
          bonusPoints: 0,
          totalAsset: INITIAL_CASH,
          transactions: [],
          hints: [],
          dbId: savedPlayer.id,
        };

        console.log(`[PLAYER_JOIN] 새 플레이어 참가: ${trimmedNickname}`);
      }
    } catch (error) {
      console.error(`[PLAYER_JOIN] 오류 발생: ${error.message}`);
      socket.emit('NICKNAME_ERROR', { message: '서버 오류가 발생했습니다. 다시 시도해주세요.' });
      return;
    }

    // 메모리에 저장
    stateManager.setPlayerData(socket.id, playerData, isPractice);
    stateManager.addConnectedPlayer(socket.id);

    // bonusPoints를 cash에 통합
    if (playerData.bonusPoints && playerData.bonusPoints > 0) {
      playerData.cash += playerData.bonusPoints;
      playerData.bonusPoints = 0;

      // DB에도 반영하여 재접속 시 중복 적용 방지
      if (playerData.dbId) {
        try {
          dbHelpers.updatePlayerCashById(
            playerData.dbId,
            playerData.cash,
            playerData.totalAsset || playerData.cash,
            isPractice
          );
        } catch (e) {
          console.error('[PLAYER_JOIN] bonusPoints DB 동기화 오류:', e);
        }
      }
    }

    // 총 자산 계산
    const totalAsset = broadcastService.calculatePlayerTotalAsset(socket.id, isPractice);
    playerData.totalAsset = totalAsset;

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

    // 힌트 전송
    socket.emit('PLAYER_HINTS_UPDATE', playerData.hints || []);

    // 닉네임 확인 이벤트 전송
    socket.emit('NICKNAME_CONFIRMED', trimmedNickname);

    // 플레이어 수 및 리스트 업데이트
    broadcastService.broadcastPlayerCount();
    broadcastService.broadcastPlayerList();
    broadcastService.broadcastGameState();
  });

  // 게임 종료 요청 (플레이어)
  socket.on('PLAYER_REQUEST_END_GAME', () => {
    console.log(`[PLAYER_REQUEST_END_GAME] 플레이어 요청 무시: ${socket.id}`);
  });
}

export default registerPlayerHandlers;
