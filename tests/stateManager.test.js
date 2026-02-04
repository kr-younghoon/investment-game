// StateManager 핵심 로직 테스트
import { stateManager } from '../state/StateManager.js';

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

console.log('\n=== StateManager 테스트 ===\n');

// 1. 초기 상태
console.log('[1] 초기 게임 상태');
{
  const gs = stateManager.getGameState();
  assert(typeof gs === 'object', 'gameState는 객체');
  assert(typeof gs.currentRound === 'number', 'currentRound은 숫자');
  assert(typeof gs.isGameStarted === 'boolean', 'isGameStarted은 boolean');
  assert(typeof gs.stockPrices === 'object', 'stockPrices은 객체');
}

// 2. updateGameState
console.log('[2] updateGameState');
{
  const before = stateManager.getGameState().currentRound;
  stateManager.updateGameState({ currentRound: 99 });
  const after = stateManager.getGameState().currentRound;
  assert(after === 99, 'currentRound 업데이트 됨');
  stateManager.updateGameState({ currentRound: before }); // 복원
}

// 3. customStocks 지원
console.log('[3] customStocks 지원');
{
  stateManager.updateGameState({ customStocks: [{ id: 'test', name: '테스트', basePrice: 10000 }] });
  const gs = stateManager.getGameState();
  assert(Array.isArray(gs.customStocks), 'customStocks 배열');
  assert(gs.customStocks.length === 1, 'customStocks 1개');
  assert(gs.customStocks[0].id === 'test', 'customStocks id 확인');
  stateManager.updateGameState({ customStocks: null }); // 복원
}

// 4. getStateToPersist
console.log('[4] getStateToPersist에 customStocks 포함');
{
  stateManager.updateGameState({ customStocks: [{ id: 'x', name: 'X', basePrice: 5000 }] });
  const state = stateManager.getStateToPersist();
  assert(state.customStocks !== undefined, 'persist state에 customStocks 포함');
  assert(state.scenarios !== undefined, 'persist state에 scenarios 포함');
  stateManager.updateGameState({ customStocks: null }); // 복원
}

// 5. 플레이어 데이터 CRUD
console.log('[5] 플레이어 데이터 CRUD');
{
  const testData = { nickname: 'test', cash: 1000000, stocks: {}, bonusPoints: 0, totalAsset: 1000000 };
  stateManager.setPlayerData('test-socket-1', testData, false);
  stateManager.addConnectedPlayer('test-socket-1');

  const retrieved = stateManager.getPlayerData('test-socket-1', false);
  assert(retrieved !== undefined, '플레이어 데이터 조회 성공');
  assert(retrieved.nickname === 'test', '닉네임 확인');

  stateManager.deletePlayerData('test-socket-1', false);
  stateManager.removeConnectedPlayer('test-socket-1');
  const deleted = stateManager.getPlayerData('test-socket-1', false);
  assert(deleted === undefined, '삭제 후 조회 시 undefined');
}

// 6. resetForNewGame
console.log('[6] resetForNewGame');
{
  stateManager.updateGameState({ currentRound: 5, isGameStarted: true });
  stateManager.resetForNewGame(false);
  const gs = stateManager.getGameState();
  assert(gs.currentRound === 0, '리셋 후 currentRound === 0');
  assert(gs.isGameStarted === false, '리셋 후 isGameStarted === false');
  assert(gs.customStocks === null, '리셋 후 customStocks === null');
}

// 7. 게임 설정
console.log('[7] 게임 설정');
{
  stateManager.setGameSettings({ totalRounds: 7 });
  const settings = stateManager.getGameSettings();
  assert(settings.totalRounds === 7, 'totalRounds 업데이트');
}

// 8. 플레이어 거래 차단
console.log('[8] 플레이어 거래 차단');
{
  const testData2 = { nickname: 'blocked', cash: 1000000, stocks: {}, bonusPoints: 0, totalAsset: 1000000 };
  stateManager.setPlayerData('test-socket-b', testData2, false);
  stateManager.setPlayerTradingBlocked('test-socket-b', {
    isBlocked: true,
    rewardAmount: 50000,
    message: '미니게임 진행 중',
  });
  const blocked = stateManager.getPlayerTradingBlocked('test-socket-b');
  assert(blocked.isBlocked === true, '차단 상태 확인');
  assert(blocked.rewardAmount === 50000, '보상 금액 확인');
  assert(blocked.message === '미니게임 진행 중', '차단 메시지 확인');
  stateManager.deletePlayerData('test-socket-b', false);
}

console.log(`\n결과: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
