import { stateManager } from '../state/StateManager.js';
import { dbHelpers } from '../db.js';
import { BroadcastService } from './BroadcastService.js';
import { GameStateService } from './GameStateService.js';
import { PlayerService } from './PlayerService.js';
import { TradingService } from './TradingService.js';
import { TransactionService } from './TransactionService.js';
import { HintService } from './HintService.js';
import { RewardService } from './RewardService.js';
import { AdminService } from './AdminService.js';
import { IdempotencyService } from './IdempotencyService.js';

/**
 * 모든 서비스를 초기화하고 의존성을 주입합니다.
 * @param {Object} io - Socket.io 서버 인스턴스
 * @returns {Object} 모든 서비스 인스턴스
 */
export function createServices(io) {
  // BroadcastService 먼저 생성 (다른 서비스에서 사용)
  const broadcastService = new BroadcastService(stateManager, dbHelpers, io);

  // 나머지 서비스 생성
  const gameStateService = new GameStateService(stateManager, dbHelpers, broadcastService);
  gameStateService.setIo(io);

  const playerService = new PlayerService(stateManager, dbHelpers);
  const tradingService = new TradingService(stateManager, dbHelpers, broadcastService);
  const transactionService = new TransactionService(stateManager, dbHelpers);
  const hintService = new HintService(stateManager, dbHelpers);
  const rewardService = new RewardService(stateManager, dbHelpers, broadcastService);
  const adminService = new AdminService(dbHelpers);
  const idempotencyService = new IdempotencyService();

  return {
    stateManager,
    broadcastService,
    gameStateService,
    playerService,
    tradingService,
    transactionService,
    hintService,
    rewardService,
    adminService,
    idempotencyService,
    // dbHelpers도 필요한 경우 접근 가능하도록
    dbHelpers,
  };
}

// 개별 서비스 export (필요한 경우 직접 import 가능)
export {
  BroadcastService,
  GameStateService,
  PlayerService,
  TradingService,
  TransactionService,
  HintService,
  RewardService,
  AdminService,
  IdempotencyService,
};

export { stateManager };
export default createServices;
