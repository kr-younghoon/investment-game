import {
  EVENTS,
  DEFAULT_GAME_STATE,
  DEFAULT_GAME_SETTINGS,
  applyGameStateUpdate,
  createGameStatePayload,
  normalizePlayerListPayload,
} from '../shared/socketProtocol.js';

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

console.log('\n=== socketProtocol 테스트 ===\n');

// 1. EVENTS 상수 존재 확인
console.log('[1] EVENTS 상수 존재 확인');
{
  const requiredEvents = [
    'GAME_STATE_UPDATE', 'PLAYER_JOIN', 'PLAYER_BUY_STOCK', 'PLAYER_SELL_STOCK',
    'ADMIN_AUTH', 'ADMIN_START_GAME_WITH_SCENARIO', 'SCENARIOS_LIST_UPDATE',
    'SCENARIO_SAVED', 'SCENARIO_DELETED', 'NICKNAME_ERROR', 'NICKNAME_DUPLICATE_KICK',
    'HINT_BROADCAST_ERROR', 'HINT_GRANT_ERROR', 'ADMIN_SAVE_PROVIDER_ROUND_HINTS',
  ];
  requiredEvents.forEach(evt => {
    assert(typeof EVENTS[evt] === 'string', `EVENTS.${evt} 존재`);
  });
}

// 2. DEFAULT_GAME_STATE
console.log('[2] DEFAULT_GAME_STATE 기본값 확인');
{
  assert(DEFAULT_GAME_STATE.currentRound === 0, 'currentRound === 0');
  assert(DEFAULT_GAME_STATE.isGameStarted === false, 'isGameStarted === false');
  assert(DEFAULT_GAME_STATE.customStocks === null, 'customStocks === null');
  assert(typeof DEFAULT_GAME_STATE.stockPrices === 'object', 'stockPrices is object');
}

// 3. DEFAULT_GAME_SETTINGS
console.log('[3] DEFAULT_GAME_SETTINGS 기본값 확인');
{
  assert(DEFAULT_GAME_SETTINGS.initialCash === 3000000, 'initialCash === 3000000');
  assert(DEFAULT_GAME_SETTINGS.totalRounds === 12, 'totalRounds === 12');
}

// 4. applyGameStateUpdate
console.log('[4] applyGameStateUpdate 부분 업데이트');
{
  const base = { ...DEFAULT_GAME_STATE };
  const updated = applyGameStateUpdate(base, { currentRound: 3, isGameStarted: true });
  assert(updated.currentRound === 3, 'currentRound 업데이트');
  assert(updated.isGameStarted === true, 'isGameStarted 업데이트');
  assert(updated.isPracticeMode === false, '나머지 필드 유지');
  // 원본 불변 확인
  assert(base.currentRound === 0, '원본 불변');
}

console.log('[5] applyGameStateUpdate null/undefined 안전성');
{
  const base = { ...DEFAULT_GAME_STATE };
  const updated = applyGameStateUpdate(base, null);
  assert(updated.currentRound === 0, 'null 패치 시 원본 유지');
  const updated2 = applyGameStateUpdate(base, undefined);
  assert(updated2.currentRound === 0, 'undefined 패치 시 원본 유지');
}

console.log('[6] applyGameStateUpdate customStocks 적용');
{
  const base = { ...DEFAULT_GAME_STATE };
  const stocks = [{ id: 'a', name: 'A주식', basePrice: 50000 }];
  const updated = applyGameStateUpdate(base, { customStocks: stocks });
  assert(Array.isArray(updated.customStocks), 'customStocks 배열');
  assert(updated.customStocks.length === 1, 'customStocks 1개');
  assert(updated.customStocks[0].id === 'a', 'customStocks id === a');
}

// 5. createGameStatePayload
console.log('[7] createGameStatePayload 필드 필터링');
{
  const source = {
    currentRound: 5,
    stockPrices: { a: [100] },
    isGameStarted: true,
    customStocks: [{ id: 'x' }],
    somethingExtra: 'should not appear',
    rankList: [{ nickname: 'test', totalAsset: 100 }],
  };
  const payload = createGameStatePayload(source);
  assert(payload.currentRound === 5, 'currentRound 포함');
  assert(payload.customStocks !== undefined, 'customStocks 포함');
  assert(payload.somethingExtra === undefined, 'extra 필드 제외');
  assert(Array.isArray(payload.rankList), 'rankList 포함');
}

console.log('[8] createGameStatePayload null 안전성');
{
  const payload = createGameStatePayload(null);
  assert(typeof payload === 'object', 'null → 빈 객체');
  assert(Object.keys(payload).length === 0, '키 없음');
}

// 6. normalizePlayerListPayload
console.log('[9] normalizePlayerListPayload 배열 입력');
{
  const result = normalizePlayerListPayload([{ name: 'p1' }]);
  assert(Array.isArray(result.players), 'players 배열');
  assert(result.players.length === 1, 'players 1명');
  assert(Array.isArray(result.connectedAdmins), 'connectedAdmins 배열');
}

console.log('[10] normalizePlayerListPayload 객체 입력');
{
  const result = normalizePlayerListPayload({
    players: [{ name: 'p1' }],
    connectedAdmins: ['admin1'],
  });
  assert(result.players.length === 1, 'players 1명');
  assert(result.connectedAdmins.length === 1, 'connectedAdmins 1명');
}

console.log('[11] normalizePlayerListPayload null 입력');
{
  const result = normalizePlayerListPayload(null);
  assert(result.players.length === 0, 'null → 빈 players');
  assert(result.connectedAdmins.length === 0, 'null → 빈 connectedAdmins');
}

console.log(`\n결과: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
