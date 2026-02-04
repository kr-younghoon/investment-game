import { registerDisplayHandlers } from './displayHandler.js';
import { registerDisconnectHandlers } from './disconnectHandler.js';
import { registerMessageHandlers } from './messageHandler.js';
import { registerAuthHandlers } from './authHandler.js';
import { registerConfigHandlers } from './configHandler.js';
import { registerAdminMgmtHandlers } from './adminMgmtHandler.js';
import { registerTradingControlHandlers } from './tradingControlHandler.js';
import { registerTradeHandlers } from './tradeHandler.js';
import { registerPlayerHandlers } from './playerHandler.js';
import { registerGameHandlers } from './gameHandler.js';
import { registerRoundHandlers } from './roundHandler.js';
import { registerHintHandlers } from './hintHandler.js';
import { registerRewardHandlers } from './rewardHandler.js';
import { registerPlayerMgmtHandlers } from './playerMgmtHandler.js';
import { registerTransactionMgmtHandlers } from './transactionMgmtHandler.js';
import { registerScenarioHandlers } from './scenarioHandler.js';

/**
 * 모든 소켓 핸들러를 등록합니다.
 * @param {Object} socket - 소켓 인스턴스
 * @param {Object} io - Socket.io 서버 인스턴스
 * @param {Object} services - 서비스 인스턴스들
 */
export function registerAllHandlers(socket, io, services) {
  // 디스플레이 핸들러
  registerDisplayHandlers(socket, io, services);

  // 연결 종료 핸들러
  registerDisconnectHandlers(socket, io, services);

  // 메시지 핸들러
  registerMessageHandlers(socket, io, services);

  // 인증 핸들러
  registerAuthHandlers(socket, io, services);

  // 설정 핸들러
  registerConfigHandlers(socket, io, services);

  // 관리자 계정 관리 핸들러
  registerAdminMgmtHandlers(socket, io, services);

  // 거래 제어 핸들러
  registerTradingControlHandlers(socket, io, services);

  // 거래 핸들러
  registerTradeHandlers(socket, io, services);

  // 플레이어 핸들러
  registerPlayerHandlers(socket, io, services);

  // 게임 핸들러
  registerGameHandlers(socket, io, services);

  // 라운드 핸들러
  registerRoundHandlers(socket, io, services);

  // 힌트 핸들러
  registerHintHandlers(socket, io, services);

  // 보상 핸들러
  registerRewardHandlers(socket, io, services);

  // 플레이어 관리 핸들러
  registerPlayerMgmtHandlers(socket, io, services);

  // 거래 내역 관리 핸들러
  registerTransactionMgmtHandlers(socket, io, services);

  // 시나리오 핸들러
  registerScenarioHandlers(socket, io, services);
}

export {
  registerDisplayHandlers,
  registerDisconnectHandlers,
  registerMessageHandlers,
  registerAuthHandlers,
  registerConfigHandlers,
  registerAdminMgmtHandlers,
  registerTradingControlHandlers,
  registerTradeHandlers,
  registerPlayerHandlers,
  registerGameHandlers,
  registerRoundHandlers,
  registerHintHandlers,
  registerRewardHandlers,
  registerPlayerMgmtHandlers,
  registerTransactionMgmtHandlers,
  registerScenarioHandlers,
};

export default registerAllHandlers;
