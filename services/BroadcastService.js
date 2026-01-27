import { STOCKS, PRACTICE_STOCKS } from '../src/data/initialScenarios.js';

/**
 * BroadcastService - 게임 상태 브로드캐스트 담당
 */
export class BroadcastService {
  constructor(stateManager, dbHelpers, io) {
    this.state = stateManager;
    this.db = dbHelpers;
    this.io = io;
  }

  /**
   * 거래 로그 업데이트 브로드캐스트 (관리자/디스플레이에만)
   */
  emitTransactionLogUpdate(transaction) {
    this.state.getAdminSockets().forEach((adminSocket) => {
      adminSocket.emit('TRANSACTION_LOG_UPDATE', transaction);
    });
    this.state.getDisplaySockets().forEach((displaySocket) => {
      displaySocket.emit('TRANSACTION_LOG_UPDATE', transaction);
    });
  }

  /**
   * 현재 가격 가져오기
   */
  getCurrentPrices() {
    const gameState = this.state.getGameState();
    const prices = {};
    const stockList = gameState.isPracticeMode ? PRACTICE_STOCKS : STOCKS;

    stockList.forEach((stock) => {
      if (
        gameState.stockPrices[stock.id] !== undefined &&
        gameState.stockPrices[stock.id] !== null
      ) {
        if (Array.isArray(gameState.stockPrices[stock.id])) {
          if (gameState.stockPrices[stock.id].length > gameState.currentRound) {
            prices[stock.id] = gameState.stockPrices[stock.id][gameState.currentRound];
          } else {
            const lastIndex = gameState.stockPrices[stock.id].length - 1;
            if (lastIndex >= 0) {
              prices[stock.id] = gameState.stockPrices[stock.id][lastIndex];
            } else {
              prices[stock.id] = stock.basePrice;
            }
          }
        } else {
          prices[stock.id] = gameState.stockPrices[stock.id];
        }
      } else {
        prices[stock.id] = stock.basePrice;
      }

      // 최종 검증
      if (
        prices[stock.id] === undefined ||
        prices[stock.id] === null ||
        isNaN(prices[stock.id])
      ) {
        prices[stock.id] = stock.basePrice;
      }
    });

    return prices;
  }

  /**
   * 플레이어 총 자산 계산
   */
  calculatePlayerTotalAsset(socketId, isPractice = false) {
    const playerData = this.state.getPlayerData(socketId, isPractice);
    if (!playerData) return 0;

    // bonusPoints가 있으면 cash에 통합
    if (playerData.bonusPoints && playerData.bonusPoints > 0) {
      playerData.cash += playerData.bonusPoints;
      playerData.bonusPoints = 0;
    }

    let total = playerData.cash;
    const currentPrices = this.getCurrentPrices();
    const stockList = isPractice ? PRACTICE_STOCKS : STOCKS;

    stockList.forEach((stock) => {
      const qty = playerData.stocks[stock.id] || 0;
      const price = currentPrices[stock.id] || stock.basePrice;
      total += qty * price;
    });

    return total;
  }

  /**
   * 게임 상태 브로드캐스트
   */
  broadcastGameState() {
    if (!this.state.canBroadcast()) {
      return;
    }

    const gameState = this.state.getGameState();
    const dataMap = this.state.getPlayersData(gameState.isPracticeMode);
    const connectedPlayers = this.state.getConnectedPlayers();

    // 닉네임별로 그룹화하여 중복 제거
    const nicknameMap = new Map();

    dataMap.forEach((playerData, socketId) => {
      const isOnline = connectedPlayers.has(socketId);
      const existing = nicknameMap.get(playerData.nickname);
      const totalAsset = this.calculatePlayerTotalAsset(socketId, gameState.isPracticeMode);

      if (!existing) {
        nicknameMap.set(playerData.nickname, {
          socketId,
          nickname: playerData.nickname,
          totalAsset,
          isOnline,
        });
      } else if (isOnline && !existing.isOnline) {
        nicknameMap.set(playerData.nickname, {
          socketId,
          nickname: playerData.nickname,
          totalAsset,
          isOnline,
        });
      } else if (isOnline === existing.isOnline && totalAsset > existing.totalAsset) {
        nicknameMap.set(playerData.nickname, {
          socketId,
          nickname: playerData.nickname,
          totalAsset,
          isOnline,
        });
      }
    });

    // 온라인 플레이어만 필터링
    const allPlayers = Array.from(nicknameMap.values()).filter((p) => p.isOnline === true);

    // 순위 계산
    if (allPlayers.length > 0) {
      allPlayers.sort((a, b) => b.totalAsset - a.totalAsset);
      allPlayers.forEach((player, index) => {
        player.rank = index + 1;
      });
    }

    // 순위 리스트 생성
    const rankList = allPlayers.map((p) => ({
      rank: p.rank,
      nickname: p.nickname,
      totalAsset: p.totalAsset,
    }));

    const stateToSend = {
      currentRound: gameState.currentRound,
      stockPrices: this.getCurrentPrices(),
      currentNews: gameState.currentNews,
      currentNewsBriefing: gameState.currentNewsBriefing,
      isGameStarted: gameState.isGameStarted,
      isGameEnded: gameState.isGameEnded,
      isPracticeMode: gameState.isPracticeMode,
      isWaitingMode: gameState.isWaitingMode,
      priceHistory: gameState.stockPrices,
      countdown: gameState.countdown,
      roundTimer: gameState.roundTimer,
      rankList: rankList,
      playerCount: connectedPlayers.size,
      allowPlayerTrading: gameState.allowPlayerTrading,
      isTradingBlocked: gameState.isTradingBlocked,
      isLastRound: gameState.isLastRound,
    };

    this.io.emit('GAME_STATE_UPDATE', stateToSend);
    this.persistGameState();

    // 모든 플레이어에게 포트폴리오 업데이트
    dataMap.forEach((playerData, socketId) => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        if (playerData.bonusPoints && playerData.bonusPoints > 0) {
          playerData.cash += playerData.bonusPoints;
          playerData.bonusPoints = 0;
        }
        const totalAsset = this.calculatePlayerTotalAsset(socketId, gameState.isPracticeMode);
        playerData.totalAsset = totalAsset;

        // 매수 평균가 계산
        const averageBuyPrices = {};
        STOCKS.forEach((stock) => {
          const quantity = playerData.stocks[stock.id] || 0;
          if (quantity > 0) {
            const buyTransactions = playerData.transactions.filter(
              (t) => t.type === 'BUY' && t.stockId === stock.id
            );
            if (buyTransactions.length > 0) {
              let totalBuyCost = 0;
              let totalBuyQuantity = 0;
              buyTransactions.forEach((t) => {
                totalBuyCost += t.totalCost || t.price * t.quantity;
                totalBuyQuantity += t.quantity;
              });
              if (totalBuyQuantity > 0) {
                averageBuyPrices[stock.id] = totalBuyCost / totalBuyQuantity;
              }
            }
          }
        });

        socket.emit('PLAYER_PORTFOLIO_UPDATE', {
          cash: playerData.cash,
          stocks: playerData.stocks,
          bonusPoints: 0,
          totalAsset: totalAsset,
          averageBuyPrices: averageBuyPrices,
        });

        socket.emit('PLAYER_HINTS_UPDATE', playerData.hints || []);

        // 순위 정보 업데이트
        const playerRankInfo = allPlayers.find((p) => p.socketId === socketId);
        if (playerRankInfo) {
          socket.emit('PLAYER_RANK_UPDATE', {
            rank: playerRankInfo.rank,
            totalPlayers: allPlayers.length,
            totalAsset: playerRankInfo.totalAsset,
          });
          const rankListWithMe = allPlayers.map((p) => ({
            rank: p.rank,
            nickname: p.nickname,
            totalAsset: p.totalAsset,
            isMe: p.socketId === socketId,
          }));
          socket.emit('PLAYER_RANK_LIST_UPDATE', rankListWithMe);
        }
      }
    });
  }

  /**
   * 플레이어 리스트 브로드캐스트 (관리자용)
   */
  broadcastPlayerList() {
    if (this.state.getAdminSockets().size === 0) {
      return;
    }

    if (!this.state.canBroadcastPlayerList()) {
      return;
    }

    const gameState = this.state.getGameState();
    const dataMap = this.state.getPlayersData(gameState.isPracticeMode);
    const isPractice = gameState.isPracticeMode;
    const connectedPlayers = this.state.getConnectedPlayers();

    // 닉네임별로 그룹화
    const nicknameMap = new Map();

    // 메모리의 온라인 플레이어
    Array.from(dataMap.entries()).forEach(([socketId, data]) => {
      const isOnline = connectedPlayers.has(socketId);
      const existing = nicknameMap.get(data.nickname);

      if (!existing || (isOnline && !existing.isOnline)) {
        const totalAsset = this.calculatePlayerTotalAsset(socketId, isPractice);
        const lastTransaction =
          data.transactions.length > 0
            ? data.transactions[data.transactions.length - 1]
            : null;

        nicknameMap.set(data.nickname, {
          socketId,
          nickname: data.nickname,
          cash: data.cash,
          bonusPoints: data.bonusPoints,
          stocks: data.stocks,
          totalAsset: totalAsset,
          transactionCount: data.transactions.length,
          isOnline: isOnline,
          lastTransactionRound: lastTransaction ? lastTransaction.round : null,
          hints: data.hints || [],
        });
      }
    });

    // 데이터베이스에서 오프라인 플레이어 추가
    try {
      const currentGameId = gameState.gameId || 'legacy';
      const allDbPlayers = this.db.getAllPlayers(currentGameId, isPractice);
      const currentPrices = this.getCurrentPrices();
      const allDbStocks = this.db.getAllPlayerStocks(currentGameId, isPractice);
      const allDbHints = this.db.getAllPlayerHints(currentGameId, isPractice);
      const allDbTransactions = this.db.getAllPlayerTransactions(currentGameId, isPractice);

      // playerId별로 그룹화
      const stocksByPlayerId = new Map();
      allDbStocks.forEach((stock) => {
        if (!stocksByPlayerId.has(stock.player_id)) {
          stocksByPlayerId.set(stock.player_id, []);
        }
        stocksByPlayerId.get(stock.player_id).push(stock);
      });

      const hintsByPlayerId = new Map();
      allDbHints.forEach((hint) => {
        if (!hintsByPlayerId.has(hint.player_id)) {
          hintsByPlayerId.set(hint.player_id, []);
        }
        hintsByPlayerId.get(hint.player_id).push(hint);
      });

      const transactionsByPlayerId = new Map();
      allDbTransactions.forEach((t) => {
        if (!transactionsByPlayerId.has(t.playerId)) {
          transactionsByPlayerId.set(t.playerId, []);
        }
        transactionsByPlayerId.get(t.playerId).push(t);
      });

      const INITIAL_CASH = this.state.INITIAL_CASH;

      allDbPlayers.forEach((dbPlayer) => {
        if (nicknameMap.has(dbPlayer.nickname)) {
          return;
        }

        const dbStocks = stocksByPlayerId.get(dbPlayer.id) || [];
        const dbHints = hintsByPlayerId.get(dbPlayer.id) || [];
        const playerTransactions = transactionsByPlayerId.get(dbPlayer.id) || [];

        const stocks = {};
        STOCKS.forEach((stock) => {
          const dbStock = dbStocks.find((s) => s.stock_id === stock.id);
          stocks[stock.id] = dbStock ? dbStock.quantity : 0;
        });

        let calculatedCash = INITIAL_CASH;
        playerTransactions.forEach((t) => {
          if (t.type === 'BUY') {
            calculatedCash -= t.totalCost || t.price * t.quantity;
          } else if (t.type === 'SELL') {
            calculatedCash += t.totalRevenue || t.price * t.quantity;
          } else if (t.type === 'HINT_PURCHASE') {
            calculatedCash -= t.hintPrice || 0;
          } else if (t.type === 'MINIGAME_REWARD') {
            calculatedCash += t.points || 0;
          }
        });

        let totalAsset = calculatedCash;
        STOCKS.forEach((stock) => {
          const qty = stocks[stock.id] || 0;
          const price = currentPrices[stock.id] || stock.basePrice;
          totalAsset += qty * price;
        });

        const hints = dbHints.map((hint) => ({
          difficulty: hint.difficulty,
          content: hint.content,
          receivedAt: hint.received_at,
          price: hint.price,
          round: hint.round,
        }));

        const lastTransaction =
          playerTransactions.length > 0
            ? playerTransactions[playerTransactions.length - 1]
            : null;

        nicknameMap.set(dbPlayer.nickname, {
          socketId: `offline_${dbPlayer.id}`,
          nickname: dbPlayer.nickname,
          cash: calculatedCash,
          bonusPoints: 0,
          stocks: stocks,
          totalAsset: totalAsset,
          transactionCount: playerTransactions.length,
          isOnline: false,
          lastTransactionRound: lastTransaction ? lastTransaction.round : null,
          hints: hints,
          dbId: dbPlayer.id,
        });
      });
    } catch (error) {
      console.error('[broadcastPlayerList] 데이터베이스 오류:', error);
    }

    // 순위 계산
    const playerList = Array.from(nicknameMap.values());
    playerList.sort((a, b) => b.totalAsset - a.totalAsset);
    playerList.forEach((player, index) => {
      player.rank = index + 1;
    });

    // 접속 중인 운영자 목록
    const connectedAdmins = Array.from(this.state.getAdminSockets()).map((adminSocket) => {
      const adminId = this.state.getAdminId(adminSocket.id) || '알 수 없음';
      return {
        socketId: adminSocket.id,
        adminId: adminId,
      };
    });

    // 모든 관리자에게 전송
    this.state.getAdminSockets().forEach((adminSocket) => {
      adminSocket.emit('PLAYER_LIST_UPDATE', {
        players: playerList,
        connectedAdmins: connectedAdmins,
      });
    });

    // 온라인 플레이어에게 순위 전송
    const onlinePlayers = playerList.filter((p) => p.isOnline === true);
    onlinePlayers.sort((a, b) => b.totalAsset - a.totalAsset);
    onlinePlayers.forEach((player, index) => {
      player.rank = index + 1;
    });

    onlinePlayers.forEach((player) => {
      const socket = this.io.sockets.sockets.get(player.socketId);
      if (socket) {
        socket.emit('PLAYER_RANK_UPDATE', {
          rank: player.rank,
          totalPlayers: onlinePlayers.length,
          totalAsset: player.totalAsset,
        });
        const onlineRankList = onlinePlayers.map((p) => ({
          rank: p.rank,
          nickname: p.nickname,
          totalAsset: p.totalAsset,
          isMe: p.socketId === player.socketId,
        }));
        socket.emit('PLAYER_RANK_LIST_UPDATE', onlineRankList);
      }
    });
  }

  /**
   * 게임 상태 저장
   */
  persistGameState(options = {}) {
    if (!this.state.canPersistState(options.force)) {
      return;
    }

    try {
      const stateToPersist = this.state.getStateToPersist();
      this.db.saveGameState(this.state.getGameState().gameId, stateToPersist);
    } catch (error) {
      console.error('[persistGameState] 오류:', error);
    }
  }

  /**
   * 플레이어 수 브로드캐스트
   */
  broadcastPlayerCount() {
    const count = this.state.getConnectedPlayers().size;
    this.io.emit('PLAYER_COUNT_UPDATE', count);
    this.state.getAdminSockets().forEach((adminSocket) => {
      adminSocket.emit('PLAYER_COUNT_UPDATE', count);
    });
  }

  /**
   * 특정 소켓에 포트폴리오 업데이트 전송
   */
  emitPortfolioUpdate(socketId, playerData, isPractice = false) {
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return;

    const totalAsset = this.calculatePlayerTotalAsset(socketId, isPractice);
    playerData.totalAsset = totalAsset;

    // 매수 평균가 계산
    const averageBuyPrices = {};
    const stockList = isPractice ? PRACTICE_STOCKS : STOCKS;

    stockList.forEach((stock) => {
      const quantity = playerData.stocks[stock.id] || 0;
      if (quantity > 0) {
        const buyTransactions = (playerData.transactions || []).filter(
          (t) => t.type === 'BUY' && t.stockId === stock.id
        );
        if (buyTransactions.length > 0) {
          let totalBuyCost = 0;
          let totalBuyQuantity = 0;
          buyTransactions.forEach((t) => {
            totalBuyCost += t.totalCost || t.price * t.quantity;
            totalBuyQuantity += t.quantity;
          });
          if (totalBuyQuantity > 0) {
            averageBuyPrices[stock.id] = totalBuyCost / totalBuyQuantity;
          }
        }
      }
    });

    socket.emit('PLAYER_PORTFOLIO_UPDATE', {
      cash: playerData.cash,
      stocks: playerData.stocks,
      bonusPoints: 0,
      totalAsset: totalAsset,
      averageBuyPrices: averageBuyPrices,
    });
  }
}

export default BroadcastService;
