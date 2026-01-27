import { STOCKS, PRACTICE_STOCKS } from '../src/data/initialScenarios.js';

/**
 * GameStateService - 게임 상태 관리 및 가격 계산
 */
export class GameStateService {
  constructor(stateManager, dbHelpers, broadcastService) {
    this.state = stateManager;
    this.db = dbHelpers;
    this.broadcast = broadcastService;
    this.io = null;
  }

  setIo(io) {
    this.io = io;
  }

  /**
   * UI 표기 기준 라운드 번호 반환
   */
  getDisplayRoundNumber() {
    return (this.state.getGameState().currentRound ?? 0) + 1;
  }

  /**
   * 다음 라운드 가격 계산
   */
  calculateNextRoundPrices() {
    const gameState = this.state.getGameState();
    const scenarios = gameState.scenarios;
    const maxRounds = gameState.isPracticeMode
      ? scenarios.length + 1
      : scenarios.length + 1;

    const nextRound = gameState.currentRound + 1;
    const isLastRound = nextRound >= maxRounds;

    if (isLastRound) {
      const lastRoundIndex = scenarios.length - 1;
      const lastScenario = scenarios[lastRoundIndex];
      if (lastScenario && lastScenario.headline) {
        this.state.updateGameState({
          currentNews: lastScenario.headline,
          currentNewsBriefing: lastScenario.newsBriefing || [],
          isLastRound: true,
          currentRound: nextRound,
        });
        console.log(
          `[calculateNextRoundPrices] 마지막 라운드 뉴스 설정 - currentRound: ${nextRound}`
        );
      }
      return false;
    }

    this.state.updateGameState({ isLastRound: false });

    let scenarioIndex;
    if (gameState.isPracticeMode) {
      if (nextRound === 1) {
        this.state.updateGameState({
          currentRound: nextRound,
          currentNews: '',
          currentNewsBriefing: [],
        });
        return true;
      }
      scenarioIndex = nextRound - 2;
    } else {
      if (nextRound === 1) {
        STOCKS.forEach((stock) => {
          const currentPrice =
            gameState.stockPrices[stock.id]?.[gameState.currentRound] || stock.basePrice;
          if (!gameState.stockPrices[stock.id]) {
            gameState.stockPrices[stock.id] = [];
          }
          gameState.stockPrices[stock.id][nextRound] = currentPrice;
        });
        this.state.updateGameState({
          currentRound: nextRound,
          currentNews: '',
          currentNewsBriefing: [],
        });
        return true;
      }
      scenarioIndex = nextRound - 2;
    }

    const scenario =
      scenarioIndex >= 0 && scenarioIndex < scenarios.length
        ? scenarios[scenarioIndex]
        : null;

    if (!scenario) {
      console.error(
        `[calculateNextRoundPrices] 시나리오를 찾을 수 없음 - nextRound: ${nextRound}`
      );
      this.state.updateGameState({
        currentRound: nextRound,
        currentNews: '',
        currentNewsBriefing: [],
      });
      return true;
    }

    // 가격 계산
    const stockList = gameState.isPracticeMode ? PRACTICE_STOCKS : STOCKS;
    stockList.forEach((stock) => {
      const currentPrice =
        gameState.stockPrices[stock.id]?.[gameState.currentRound] || stock.basePrice;
      const changeRate = scenario.volatility[stock.id] / 100;
      const newPrice = currentPrice * (1 + changeRate);

      if (!gameState.stockPrices[stock.id]) {
        gameState.stockPrices[stock.id] = [];
      }
      gameState.stockPrices[stock.id][nextRound] = newPrice;
    });

    // 뉴스 설정
    if (nextRound > 0 && scenario && scenario.headline) {
      this.state.updateGameState({
        currentRound: nextRound,
        currentNews: scenario.headline,
        currentNewsBriefing: scenario.newsBriefing || [],
      });
    } else {
      this.state.updateGameState({
        currentRound: nextRound,
        currentNews: '',
        currentNewsBriefing: [],
      });
    }

    return true;
  }

  /**
   * 게임 종료 처리
   */
  handleGameEnd() {
    const gameState = this.state.getGameState();
    const dataMap = this.state.getPlayersData(gameState.isPracticeMode);
    const currentPrices = this.broadcast.getCurrentPrices();
    const stocksToSell = gameState.isPracticeMode ? PRACTICE_STOCKS : STOCKS;

    // 모든 주식 자동 매도
    dataMap.forEach((playerData, socketId) => {
      stocksToSell.forEach((stock) => {
        const qty = playerData.stocks[stock.id] || 0;
        if (qty > 0) {
          const price = currentPrices[stock.id] || stock.basePrice;
          const totalValue = qty * price;

          playerData.cash += totalValue;

          const sellTransaction = {
            type: 'SELL',
            stockId: stock.id,
            stockName: stock.name,
            quantity: qty,
            price: price,
            totalCost: totalValue,
            timestamp: new Date().toISOString(),
            round: gameState.currentRound,
            isAutoSell: true,
          };

          if (!playerData.transactions) {
            playerData.transactions = [];
          }
          playerData.transactions.push(sellTransaction);
          playerData.stocks[stock.id] = 0;

          // DB 업데이트
          if (playerData.dbId) {
            try {
              const newTotalAsset = this.broadcast.calculatePlayerTotalAsset(
                socketId,
                gameState.isPracticeMode
              );
              this.db.updatePlayerCashById(
                playerData.dbId,
                playerData.cash,
                newTotalAsset,
                gameState.isPracticeMode
              );
              this.db.savePlayerStock(
                gameState.gameId || 'legacy',
                playerData.dbId,
                stock.id,
                0,
                gameState.isPracticeMode
              );
              this.db.saveTransaction(
                gameState.gameId || 'legacy',
                playerData.dbId,
                playerData.nickname,
                'SELL',
                stock.id,
                qty,
                price,
                totalValue,
                0,
                0,
                null,
                null,
                gameState.currentRound,
                null,
                gameState.isPracticeMode
              );
            } catch (error) {
              console.error(`[게임 종료] 자동 매도 DB 오류: ${playerData.nickname}`, error);
            }
          }
        }
      });

      playerData.totalAsset = this.broadcast.calculatePlayerTotalAsset(
        socketId,
        gameState.isPracticeMode
      );

      // 포트폴리오 업데이트 전송
      if (this.io) {
        const playerSocket = this.io.sockets.sockets.get(socketId);
        if (playerSocket) {
          playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', {
            cash: playerData.cash,
            stocks: playerData.stocks,
            bonusPoints: 0,
            totalAsset: playerData.totalAsset,
          });
        }
      }
    });

    // 게임 상태 업데이트
    this.state.updateGameState({
      isGameEnded: true,
      isGameStarted: false,
      isWaitingMode: true,
      allowPlayerTrading: false,
      isLastRound: false,
    });

    this.db.markGameEnded(gameState.gameId);
    this.broadcast.persistGameState({ force: true });
    this.broadcast.broadcastGameState();

    if (this.io) {
      this.io.emit('GAME_END', { message: '게임이 종료되었습니다.' });
    }

    // 거래 내역 삭제
    try {
      const deletedCount = this.db.clearAllTransactions(
        gameState.gameId || 'legacy',
        gameState.isPracticeMode
      );
      console.log(`[게임 종료] 거래 내역 삭제: ${deletedCount}개`);
      this.state.clearTransactionLogs();

      this.state.getAdminSockets().forEach((adminSocket) => {
        adminSocket.emit('TRANSACTION_LOGS_INIT', []);
        adminSocket.emit('TRANSACTION_LOGS_UPDATE', []);
      });
    } catch (error) {
      console.error('[게임 종료] 거래 내역 삭제 오류:', error);
    }
  }

  /**
   * 라운드 타이머 시작
   */
  startRoundTimer() {
    this.state.clearRoundTimerInterval();

    const gameState = this.state.getGameState();
    const roundTimeMinutes = gameState.isPracticeMode ? 5 : 15;
    const roundTimeSeconds = roundTimeMinutes * 60;

    this.state.updateGameState({ roundTimer: roundTimeSeconds });

    const interval = setInterval(() => {
      const gs = this.state.getGameState();
      if (gs.roundTimer === null || gs.roundTimer <= 0) {
        this.state.clearRoundTimerInterval();
        this.state.updateGameState({ roundTimer: 0 });
        return;
      }

      this.state.updateGameState({ roundTimer: gs.roundTimer - 1 });

      if (this.io) {
        this.io.emit('ROUND_TIMER_UPDATE', {
          roundTimer: this.state.getGameState().roundTimer,
        });
      }
      this.broadcast.persistGameState();

      if (this.state.getGameState().roundTimer === 0) {
        const timeMessage = gs.isPracticeMode
          ? '5분이 종료되었습니다.'
          : '15분이 종료되었습니다.';
        this.state.getAdminSockets().forEach((adminSocket) => {
          adminSocket.emit('ROUND_TIMER_END', { message: timeMessage });
        });
      }
    }, 1000);

    this.state.setRoundTimerInterval(interval);
  }

  /**
   * 라운드 타이머 중지
   */
  stopRoundTimer() {
    this.state.clearRoundTimerInterval();
    this.state.updateGameState({ roundTimer: null });
  }

  /**
   * 저장된 게임 상태 복원
   */
  restoreState() {
    const resumeOnRestart = process.env.RESUME_ON_RESTART === 'true';
    const savedGameState = this.db.getLatestGameState();

    if (this.state.applySavedState(savedGameState, resumeOnRestart)) {
      console.log(
        `[초기화] 저장된 게임 상태 복원 완료 (gameId: ${this.state.getGameState().gameId})`
      );
      return true;
    }
    return false;
  }
}

export default GameStateService;
