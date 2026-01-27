import { registerAllHandlers } from './handlers/index.js';

/**
 * Socket.io 서버를 초기화하고 핸들러를 등록합니다.
 * @param {Object} io - Socket.io 서버 인스턴스
 * @param {Object} services - 서비스 인스턴스들
 */
export function initializeSocket(io, services) {
  io.on('connection', (socket) => {
    const totalConnections = io.sockets.sockets.size;
    console.log(`클라이언트 연결: ${socket.id} (총 ${totalConnections}개 연결)`);

    // 모든 핸들러 등록
    registerAllHandlers(socket, io, services);
  });

  console.log('[Socket] Socket.io 핸들러 초기화 완료');
}

export default initializeSocket;
