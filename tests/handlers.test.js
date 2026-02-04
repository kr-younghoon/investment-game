// 소켓 핸들러 import 및 등록 테스트
import { Server } from 'socket.io';
import { createServer } from 'http';
import { createServices } from '../services/index.js';
import { registerAllHandlers } from '../socket/handlers/index.js';

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

console.log('\n=== 소켓 핸들러 등록 테스트 ===\n');

// 1. 모든 핸들러 import
console.log('[1] 개별 핸들러 import 확인');
{
  const handlers = await Promise.all([
    import('../socket/handlers/authHandler.js'),
    import('../socket/handlers/gameHandler.js'),
    import('../socket/handlers/hintHandler.js'),
    import('../socket/handlers/playerHandler.js'),
    import('../socket/handlers/roundHandler.js'),
    import('../socket/handlers/tradeHandler.js'),
    import('../socket/handlers/tradingControlHandler.js'),
    import('../socket/handlers/scenarioHandler.js'),
  ]);
  const names = [
    'registerAuthHandlers',
    'registerGameHandlers',
    'registerHintHandlers',
    'registerPlayerHandlers',
    'registerRoundHandlers',
    'registerTradeHandlers',
    'registerTradingControlHandlers',
    'registerScenarioHandlers',
  ];
  handlers.forEach((mod, i) => {
    assert(typeof mod[names[i]] === 'function', `${names[i]} 함수 존재`);
  });
}

// 2. registerAllHandlers 통합 등록 테스트
console.log('[2] registerAllHandlers 통합 등록');
{
  const httpServer = createServer();
  const io = new Server(httpServer, { cors: { origin: '*' } });
  const services = createServices(io);

  let registeredCount = 0;
  let error = null;

  // 가짜 소켓 객체
  const fakeSocket = {
    id: 'test-socket-handler',
    _events: {},
    on(event, handler) {
      this._events[event] = handler;
      registeredCount++;
    },
    emit() {},
    join() {},
    leave() {},
  };

  try {
    registerAllHandlers(fakeSocket, io, services);
  } catch (e) {
    error = e;
  }

  assert(error === null, '에러 없이 핸들러 등록 완료');
  assert(registeredCount > 0, `${registeredCount}개 이벤트 핸들러 등록됨`);

  // 주요 이벤트가 등록되었는지 확인
  const requiredEvents = [
    'PLAYER_JOIN',
    'PLAYER_BUY_STOCK',
    'PLAYER_SELL_STOCK',
    'ADMIN_AUTH',
    'ADMIN_LOGOUT',
    'ADMIN_START_GAME',
    'ADMIN_START_PRACTICE',
    'ADMIN_NEXT_ROUND',
    'ADMIN_END_GAME',
    'ADMIN_GRANT_HINT',
    'ADMIN_GRANT_HINT_TO_ALL',
    'ADMIN_EXECUTE_TRADE',
    'ADMIN_BLOCK_TRADING',
    'ADMIN_UNBLOCK_TRADING',
    'ADMIN_BLOCK_TRADING_FOR_PLAYER',
    'ADMIN_UNBLOCK_TRADING_FOR_PLAYER',
    'ADMIN_TOGGLE_PLAYER_TRADING',
    'ADMIN_GET_SCENARIOS',
    'ADMIN_SAVE_SCENARIO',
    'ADMIN_DELETE_SCENARIO',
    'ADMIN_START_GAME_WITH_SCENARIO',
    'PLAYER_MINIGAME_COMPLETE',
    'ADMIN_SAVE_PROVIDER_ROUND_HINTS',
  ];

  requiredEvents.forEach(evt => {
    assert(typeof fakeSocket._events[evt] === 'function', `이벤트 '${evt}' 등록됨`);
  });

  io.close();
  httpServer.close();
}

// 3. shared/socketProtocol 이벤트 이름 ↔ 핸들러 정합성
console.log('[3] socketProtocol EVENTS ↔ 핸들러 정합성');
{
  const { EVENTS } = await import('../shared/socketProtocol.js');

  // socketProtocol에 정의된 주요 클라이언트→서버 이벤트들이 핸들러에 등록되어 있는지 확인
  const clientToServerEvents = [
    'PLAYER_JOIN',
    'PLAYER_BUY_STOCK',
    'PLAYER_SELL_STOCK',
    'PLAYER_REQUEST_STATE',
    'ADMIN_AUTH',
    'ADMIN_LOGOUT',
    'ADMIN_START_GAME',
    'ADMIN_NEXT_ROUND',
    'ADMIN_END_GAME',
    'ADMIN_GRANT_HINT',
    'ADMIN_EXECUTE_TRADE',
    'ADMIN_GET_SCENARIOS',
    'ADMIN_SAVE_SCENARIO',
    'ADMIN_DELETE_SCENARIO',
    'ADMIN_START_GAME_WITH_SCENARIO',
  ];

  clientToServerEvents.forEach(evt => {
    assert(EVENTS[evt] === evt, `EVENTS.${evt} === '${evt}' (이벤트명 일치)`);
  });
}

console.log(`\n결과: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
