/**
 * Disconnect Handler - 연결 종료 처리
 */
export function registerDisconnectHandlers(socket, io, services) {
  const { stateManager, broadcastService } = services;

  socket.on('disconnect', () => {
    const totalConnections = io.sockets.sockets.size;
    console.log(`클라이언트 연결 종료: ${socket.id} (남은 연결: ${totalConnections}개)`);

    // 전광판 소켓 제거
    stateManager.removeDisplaySocket(socket);

    // 관리자 소켓 제거
    if (stateManager.isAdmin(socket)) {
      const adminId = stateManager.getAdminId(socket.id);
      stateManager.removeAdminSocket(socket);
      console.log(`[disconnect] 관리자 연결 종료: ${adminId}`);

      // 다른 관리자들에게 목록 업데이트
      broadcastService.broadcastPlayerList();
    }

    // 플레이어 연결 종료 처리
    if (stateManager.getConnectedPlayers().has(socket.id)) {
      stateManager.removeConnectedPlayer(socket.id);

      // 플레이어 투자 차단 상태 정리 (메모리 누수 방지)
      stateManager.deletePlayerTradingBlocked(socket.id);

      // 플레이어 수 업데이트
      broadcastService.broadcastPlayerCount();
      broadcastService.broadcastPlayerList();
      broadcastService.broadcastGameState();

      console.log(`[disconnect] 플레이어 연결 종료: ${socket.id}`);
    }
  });
}

export default registerDisconnectHandlers;
