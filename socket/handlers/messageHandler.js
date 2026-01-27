/**
 * Message Handler - 메시지 브로드캐스트 관련 핸들러
 */
export function registerMessageHandlers(socket, io, services) {
  const { stateManager } = services;

  // 메시지 브로드캐스트
  socket.on('ADMIN_BROADCAST_MESSAGE', (data) => {
    if (!stateManager.isAdmin(socket)) return;

    const { message } = data;
    io.emit('DISPLAY_MESSAGE', { message });
    console.log(`[ADMIN_BROADCAST_MESSAGE] 메시지 브로드캐스트: ${message}`);
  });

  // 메시지 닫기
  socket.on('ADMIN_CLOSE_MESSAGE', () => {
    if (!stateManager.isAdmin(socket)) return;

    io.emit('CLOSE_DISPLAY_MESSAGE');
    console.log('[ADMIN_CLOSE_MESSAGE] 메시지 닫기');
  });
}

export default registerMessageHandlers;
