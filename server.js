import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import { initializeSocket } from './socket/index.js';
import { createServices } from './services/index.js';
import { closeDb } from './db.js';

// Express 앱 설정
const app = express();
const httpServer = createServer(app);

// CORS 허용 origin 설정 (환경변수 또는 기본값)
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3001', 'http://127.0.0.1:5173'];

// Socket.io 서버 설정
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // origin이 없으면 (같은 origin 요청) 허용
      if (!origin) return callback(null, true);
      // 허용된 origin 또는 개발 환경에서 허용
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      callback(new Error('CORS policy violation'));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
});

// Express 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.static('dist'));

// 서비스 초기화 (의존성 주입)
const services = createServices(io);

// 저장된 게임 상태 복원
services.gameStateService.restoreState();

// Socket.io 핸들러 초기화
initializeSocket(io, services);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n서버 종료 중...');
  services.idempotencyService?.destroy();
  closeDb();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n서버 종료 중...');
  services.idempotencyService?.destroy();
  closeDb();
  process.exit(0);
});

// 네트워크 인터페이스에서 IP 주소 가져오기
function getLocalIP() {
  const networkInterfaces = os.networkInterfaces();

  for (const interfaceName of Object.keys(networkInterfaces)) {
    const addresses = networkInterfaces[interfaceName];
    for (const address of addresses) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }

  return 'localhost';
}

// 서버 시작
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIP();

  console.log('='.repeat(50));
  console.log('MZ 투자 서바이벌 서버가 실행되었습니다!');
  console.log('='.repeat(50));
  console.log(`로컬 주소: http://localhost:${PORT}`);
  console.log(`네트워크 주소: http://${localIP}:${PORT}`);
  console.log('='.repeat(50));
  console.log('');
  console.log('리팩토링된 모듈 구조:');
  console.log('  - state/StateManager.js: 중앙 상태 관리');
  console.log('  - services/: 비즈니스 로직');
  console.log('  - socket/handlers/: 소켓 이벤트 핸들러');
  console.log('');
});

export { io, services };
