/**
 * RewardService - 포인트/보너스 관리
 */
export class RewardService {
  constructor(stateManager, dbHelpers, broadcastService) {
    this.state = stateManager;
    this.db = dbHelpers;
    this.broadcast = broadcastService;
  }

  /**
   * 플레이어에게 포인트 추가
   */
  addPoints(socketId, points, source = 'BONUS', isPractice = false) {
    const gameState = this.state.getGameState();
    const playerData = this.state.getPlayerData(socketId, isPractice);

    if (!playerData) {
      return { success: false, error: '플레이어를 찾을 수 없습니다.' };
    }

    // bonusPoints가 있으면 cash에 통합
    if (playerData.bonusPoints && playerData.bonusPoints > 0) {
      playerData.cash += playerData.bonusPoints;
      playerData.bonusPoints = 0;
    }

    // 포인트를 cash에 직접 추가
    playerData.cash += points;

    // 총 자산 재계산
    const totalAsset = this.broadcast.calculatePlayerTotalAsset(socketId, isPractice);
    playerData.totalAsset = totalAsset;

    // 거래 기록 추가
    const transaction = {
      type: source,
      stockId: null,
      quantity: 0,
      price: 0,
      totalCost: 0,
      points: points,
      round: gameState.currentRound,
      timestamp: new Date().toISOString(),
      nickname: playerData.nickname,
    };

    if (!playerData.transactions) {
      playerData.transactions = [];
    }
    playerData.transactions.push(transaction);

    // DB 저장
    if (playerData.dbId) {
      try {
        this.db.updatePlayerCashById(
          playerData.dbId,
          playerData.cash,
          totalAsset,
          isPractice
        );

        this.db.saveTransaction(
          gameState.gameId || 'legacy',
          playerData.dbId,
          playerData.nickname,
          source,
          null,
          0,
          0,
          0,
          0,
          points,
          null,
          null,
          gameState.currentRound,
          null,
          isPractice
        );
      } catch (error) {
        console.error('[RewardService] DB 저장 오류:', error);
      }
    }

    return {
      success: true,
      playerData: {
        cash: playerData.cash,
        totalAsset: playerData.totalAsset,
      },
      transaction,
    };
  }

  /**
   * 모든 플레이어에게 포인트 추가
   */
  addPointsToAll(points, source = 'BONUS', isPractice = false) {
    const dataMap = this.state.getPlayersData(isPractice);
    const connectedPlayers = this.state.getConnectedPlayers();
    const results = [];

    dataMap.forEach((playerData, socketId) => {
      if (connectedPlayers.has(socketId)) {
        const result = this.addPoints(socketId, points, source, isPractice);
        results.push({ socketId, nickname: playerData.nickname, ...result });
      }
    });

    return results;
  }

  /**
   * 미니게임 보상 지급 (거래 차단 해제 시)
   */
  grantMinigameReward(socketId, isPractice = false) {
    const blockedInfo = this.state.getPlayerTradingBlocked(socketId);

    if (!blockedInfo || !blockedInfo.isBlocked) {
      return { success: false, error: '차단된 플레이어가 아닙니다.' };
    }

    const rewardAmount = blockedInfo.rewardAmount || 0;

    if (rewardAmount > 0) {
      const result = this.addPoints(socketId, rewardAmount, 'MINIGAME_REWARD', isPractice);
      if (result.success) {
        this.state.deletePlayerTradingBlocked(socketId);
        return {
          success: true,
          rewardAmount,
          ...result,
        };
      }
      return result;
    }

    // 보상 없이 차단만 해제
    this.state.deletePlayerTradingBlocked(socketId);
    return { success: true, rewardAmount: 0 };
  }
}

export default RewardService;
