// 서비스 레이어 통합 테스트 (GameStateService, BroadcastService, PlayerService, TradingService)
import { Server } from 'socket.io';
import { createServer } from 'http';
import { createServices } from '../services/index.js';

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

// 테스트용 io 생성 (실제 listen 하지 않음)
const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: '*' } });

const services = createServices(io);
const {
  stateManager,
  gameStateService,
  broadcastService,
  playerService,
  tradingService,
  idempotencyService,
} = services;

console.log('\n=== 서비스 레이어 통합 테스트 ===\n');

// 1. getActiveStocks
console.log('[1] GameStateService.getActiveStocks 기본값');
{
  stateManager.updateGameState({ customStocks: null, isPracticeMode: false });
  const stocks = gameStateService.getActiveStocks();
  assert(Array.isArray(stocks), '기본 주식 배열 반환');
  assert(stocks.length > 0, '기본 주식 1개 이상');
}

console.log('[2] GameStateService.getActiveStocks 커스텀');
{
  const custom = [{ id: 'c1', name: '커스텀1', basePrice: 10000 }];
  stateManager.updateGameState({ customStocks: custom });
  const stocks = gameStateService.getActiveStocks();
  assert(stocks.length === 1, '커스텀 주식 1개');
  assert(stocks[0].id === 'c1', 'id === c1');
  stateManager.updateGameState({ customStocks: null }); // 복원
}

// 2. getDisplayRoundNumber
console.log('[3] getDisplayRoundNumber');
{
  stateManager.updateGameState({ currentRound: 3 });
  const display = gameStateService.getDisplayRoundNumber();
  assert(display === 4, 'currentRound 3 → 표시 라운드 4');
  stateManager.updateGameState({ currentRound: 0 }); // 복원
}

// 3. BroadcastService.getActiveStocks
console.log('[4] BroadcastService.getActiveStocks');
{
  stateManager.updateGameState({ customStocks: [{ id: 'b1', name: 'B1', basePrice: 5000 }] });
  const stocks = broadcastService.getActiveStocks();
  assert(stocks.length === 1, '커스텀 주식 반환');
  assert(stocks[0].id === 'b1', 'id === b1');
  stateManager.updateGameState({ customStocks: null }); // 복원
}

// 4. BroadcastService.getCurrentPrices
console.log('[5] BroadcastService.getCurrentPrices');
{
  stateManager.resetForNewGame(false);
  const prices = broadcastService.getCurrentPrices();
  assert(typeof prices === 'object', '가격 객체 반환');
  const priceKeys = Object.keys(prices);
  assert(priceKeys.length > 0, '1개 이상 주식 가격 존재');
  priceKeys.forEach(key => {
    assert(typeof prices[key] === 'number', `${key}: 숫자 가격`);
    assert(prices[key] > 0, `${key}: 양수 가격`);
  });
}

// 5. BroadcastService.calculatePlayerTotalAsset
console.log('[6] calculatePlayerTotalAsset 순수 함수 (side effect 없음)');
{
  stateManager.resetForNewGame(false);
  const testPlayer = {
    nickname: 'pure-test',
    cash: 1000000,
    stocks: {},
    bonusPoints: 50000,
    totalAsset: 1050000,
    transactions: [],
    hints: [],
  };
  stateManager.setPlayerData('pure-sock-1', testPlayer, false);

  const total = broadcastService.calculatePlayerTotalAsset('pure-sock-1', false);
  assert(total > 0, '총자산 양수');

  // bonusPoints가 변경되지 않았는지 확인 (순수 함수)
  const afterPlayer = stateManager.getPlayerData('pure-sock-1', false);
  assert(afterPlayer.bonusPoints === 50000, 'bonusPoints 변경 없음 (순수 함수)');
  assert(afterPlayer.cash === 1000000, 'cash 변경 없음 (순수 함수)');

  stateManager.deletePlayerData('pure-sock-1', false);
}

// 6. PlayerService.getActiveStocks
console.log('[7] PlayerService.getActiveStocks');
{
  stateManager.updateGameState({ customStocks: [{ id: 'ps1', name: 'PS1', basePrice: 7777 }] });
  const stocks = playerService.getActiveStocks(false);
  assert(stocks[0].id === 'ps1', '커스텀 주식 반환');
  stateManager.updateGameState({ customStocks: null }); // 복원
}

// 7. PlayerService.isNicknameDuplicate
console.log('[8] PlayerService.isNicknameDuplicate');
{
  stateManager.setPlayerData('dup-sock-1', { nickname: '중복테스트', cash: 100, stocks: {}, bonusPoints: 0, totalAsset: 100, transactions: [], hints: [] }, false);
  stateManager.addConnectedPlayer('dup-sock-1');

  const result1 = playerService.isNicknameDuplicate('중복테스트', 'dup-sock-2');
  assert(result1.isDuplicate === true, '다른 소켓에서 동일 닉네임 → 중복');

  const result2 = playerService.isNicknameDuplicate('중복테스트', 'dup-sock-1');
  assert(result2.isDuplicate === false, '같은 소켓 → 중복 아님');

  const result3 = playerService.isNicknameDuplicate('없는닉네임', 'dup-sock-2');
  assert(result3.isDuplicate === false, '존재하지 않는 닉네임 → 중복 아님');

  stateManager.deletePlayerData('dup-sock-1', false);
  stateManager.removeConnectedPlayer('dup-sock-1');
}

// 8. TradingService._getStockById 커스텀 주식
console.log('[9] TradingService._getStockById 커스텀 주식');
{
  stateManager.updateGameState({ customStocks: [{ id: 'ts1', name: 'TS1', basePrice: 10000 }] });
  const stock = tradingService._getStockById('ts1', false);
  assert(stock !== undefined, '커스텀 주식 조회 성공');
  assert(stock.name === 'TS1', '이름 일치');
  stateManager.updateGameState({ customStocks: null }); // 복원
}

// 9. IdempotencyService 인스턴스
console.log('[10] IdempotencyService 인스턴스 생성 확인');
{
  assert(idempotencyService !== undefined, 'idempotencyService 존재');
  assert(typeof idempotencyService.storeResult === 'function', 'storeResult 함수');
  assert(typeof idempotencyService.getProcessedResult === 'function', 'getProcessedResult 함수');
}

// 10. startGameWithScenario
console.log('[11] startGameWithScenario 기본 동작');
{
  const customStocks = [
    { id: 'sc1', name: '시나리오주식1', basePrice: 50000 },
    { id: 'sc2', name: '시나리오주식2', basePrice: 30000 },
  ];
  const customRounds = [
    { month: '1~2월', headline: '테스트 헤드라인', volatility: { sc1: 10, sc2: -5 }, newsBriefing: [] },
  ];

  const newGameId = gameStateService.startGameWithScenario(customStocks, customRounds, false, false);
  assert(newGameId !== undefined && newGameId !== null, '새 gameId 반환');

  const gs = stateManager.getGameState();
  assert(gs.isGameStarted === true, '게임 시작됨');
  assert(gs.customStocks.length === 2, '커스텀 주식 2개');
  assert(gs.scenarios.length === 1, '시나리오 1개');
  assert(gs.stockPrices['sc1'] !== undefined, 'sc1 가격 초기화');
  assert(gs.stockPrices['sc2'] !== undefined, 'sc2 가격 초기화');
  assert(gs.stockPrices['sc1'][0] === 50000, 'sc1 초기가 50000');
  assert(gs.stockPrices['sc2'][0] === 30000, 'sc2 초기가 30000');

  // 총 라운드 수 확인 (시나리오 수 + 1)
  const settings = stateManager.getGameSettings();
  assert(settings.totalRounds === 2, 'totalRounds === 2 (1 시나리오 + 1)');

  // 정리
  stateManager.resetForNewGame(false);
}

// Cleanup
idempotencyService.destroy();
io.close();
httpServer.close();

console.log(`\n결과: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
