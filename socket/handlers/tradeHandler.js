import { STOCKS, PRACTICE_STOCKS } from '../../src/data/initialScenarios.js';

/**
 * Trade Handler - 매매 관련 핸들러
 */
export function registerTradeHandlers(socket, io, services) {
  const { stateManager, tradingService, transactionService, broadcastService } = services;

  // 플레이어 주식 매수
  socket.on('PLAYER_BUY_STOCK', (data) => {
    const gameState = stateManager.getGameState();

    // 거래 가능 여부 검증
    const validation = tradingService.validateTrading(socket.id);
    if (!validation.allowed) {
      socket.emit('TRANSACTION_ERROR', { message: validation.message });
      return;
    }

    const { stockId, quantity } = data;

    // 수량 검증
    if (!quantity || quantity <= 0) {
      socket.emit('TRANSACTION_ERROR', { message: '수량을 확인해주세요.' });
      return;
    }

    // 매수 실행
    const result = tradingService.executeBuy(socket.id, stockId, quantity);

    if (!result.success) {
      socket.emit('TRANSACTION_ERROR', { message: result.error });
      return;
    }

    // 거래 성공
    socket.emit('PLAYER_PORTFOLIO_UPDATE', result.portfolio);
    socket.emit('TRADE_EXECUTED', result.tradeInfo);

    // 거래 로그 브로드캐스트
    const logTransaction = transactionService.formatTransactionForDisplay(result.transaction);
    broadcastService.emitTransactionLogUpdate(logTransaction);

    // 게임 상태 및 플레이어 리스트 업데이트
    broadcastService.broadcastPlayerList();
    broadcastService.broadcastGameState();

    const stock = (gameState.isPracticeMode ? PRACTICE_STOCKS : STOCKS).find(
      (s) => s.id === stockId
    );
    console.log(
      `[PLAYER_BUY_STOCK] ${result.transaction.nickname} - ${stock?.name || stockId} ${quantity}주 매수`
    );
  });

  // 플레이어 주식 매도
  socket.on('PLAYER_SELL_STOCK', (data) => {
    const gameState = stateManager.getGameState();

    // 거래 가능 여부 검증
    const validation = tradingService.validateTrading(socket.id);
    if (!validation.allowed) {
      socket.emit('TRANSACTION_ERROR', { message: validation.message });
      return;
    }

    const { stockId, quantity } = data;

    // 수량 검증
    if (!quantity || quantity <= 0) {
      socket.emit('TRANSACTION_ERROR', { message: '수량을 확인해주세요.' });
      return;
    }

    // 매도 실행
    const result = tradingService.executeSell(socket.id, stockId, quantity);

    if (!result.success) {
      socket.emit('TRANSACTION_ERROR', { message: result.error });
      return;
    }

    // 거래 성공
    socket.emit('PLAYER_PORTFOLIO_UPDATE', result.portfolio);
    socket.emit('TRADE_EXECUTED', result.tradeInfo);

    // 거래 로그 브로드캐스트
    const logTransaction = transactionService.formatTransactionForDisplay(result.transaction);
    broadcastService.emitTransactionLogUpdate(logTransaction);

    // 게임 상태 및 플레이어 리스트 업데이트
    broadcastService.broadcastPlayerList();
    broadcastService.broadcastGameState();

    const stock = (gameState.isPracticeMode ? PRACTICE_STOCKS : STOCKS).find(
      (s) => s.id === stockId
    );
    console.log(
      `[PLAYER_SELL_STOCK] ${result.transaction.nickname} - ${stock?.name || stockId} ${quantity}주 매도`
    );
  });

  // 관리자 대신 거래 실행
  socket.on('ADMIN_EXECUTE_TRADE', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { socketId, stockId, quantity, type } = data;
    const adminId = stateManager.getAdminId(socket.id);
    const gameState = stateManager.getGameState();

    // 수량 검증
    if (!quantity || quantity <= 0) {
      socket.emit('ADMIN_TRADE_ERROR', { message: '수량을 확인해주세요.' });
      return;
    }

    // 거래 실행
    const result = tradingService.executeAdminTrade(socketId, stockId, quantity, type, adminId);

    if (!result.success) {
      socket.emit('ADMIN_TRADE_ERROR', { message: result.error });
      return;
    }

    // 플레이어에게 포트폴리오 업데이트 전송
    const playerSocket = io.sockets.sockets.get(socketId);
    if (playerSocket) {
      playerSocket.emit('PLAYER_PORTFOLIO_UPDATE', result.portfolio);

      const stock = (gameState.isPracticeMode ? PRACTICE_STOCKS : STOCKS).find(
        (s) => s.id === stockId
      );
      playerSocket.emit('TRADE_EXECUTED', {
        type,
        stockName: stock?.name || stockId,
        quantity,
        averagePrice: result.averagePrice,
      });
    }

    // 거래 로그 브로드캐스트
    const logTransaction = transactionService.formatTransactionForDisplay(result.transaction);
    broadcastService.emitTransactionLogUpdate(logTransaction);

    // 관리자에게 성공 알림
    socket.emit('ADMIN_TRADE_SUCCESS', {
      message: `${result.transaction.nickname} - ${type} 완료`,
    });

    // 게임 상태 및 플레이어 리스트 업데이트
    broadcastService.broadcastPlayerList();
    broadcastService.broadcastGameState();

    console.log(
      `[ADMIN_EXECUTE_TRADE] ${adminId} -> ${result.transaction.nickname} - ${type} ${quantity}주`
    );
  });

  // 플레이어 거래 내역 요청
  socket.on('PLAYER_REQUEST_TRANSACTIONS', () => {
    const transactions = transactionService.getPlayerTransactions(socket.id);
    socket.emit('PLAYER_TRANSACTIONS_UPDATE', transactions);
  });
}

export default registerTradeHandlers;
