// DB 시나리오 CRUD 테스트
import { dbHelpers } from '../db.js';

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

console.log('\n=== DB 시나리오 CRUD 테스트 ===\n');

// 1. 시나리오 저장 (새로 생성)
console.log('[1] 시나리오 생성');
let scenarioId;
{
  const stocks = [
    { id: 'ts', name: '태산 파운드리', basePrice: 143600 },
    { id: 'hm', name: '하이퍼 메모리', basePrice: 48500 },
  ];
  const rounds = [
    { round: 0, month: '1~2월', headline: '테스트 뉴스', volatility: { ts: 5, hm: -3 }, newsBriefing: [] },
    { round: 1, month: '3~4월', headline: '두번째 뉴스', volatility: { ts: -2, hm: 8 }, newsBriefing: [] },
  ];
  scenarioId = dbHelpers.saveScenario(null, '테스트 시나리오', 'real', stocks, rounds);
  assert(typeof scenarioId === 'number' || typeof scenarioId === 'bigint', '시나리오 ID 반환됨');
  assert(scenarioId > 0, '시나리오 ID > 0');
}

// 2. 시나리오 조회
console.log('[2] 시나리오 조회');
{
  const scenario = dbHelpers.getScenarioById(Number(scenarioId));
  assert(scenario !== null, '시나리오 조회 성공');
  assert(scenario.name === '테스트 시나리오', '이름 일치');
  assert(scenario.type === 'real', '타입 일치');
  assert(Array.isArray(scenario.stocks), 'stocks 배열');
  assert(scenario.stocks.length === 2, 'stocks 2개');
  assert(Array.isArray(scenario.rounds), 'rounds 배열');
  assert(scenario.rounds.length === 2, 'rounds 2개');
  assert(scenario.rounds[0].headline === '테스트 뉴스', '라운드 데이터 확인');
}

// 3. 시나리오 목록 조회
console.log('[3] 시나리오 목록 조회');
{
  const list = dbHelpers.getAllScenarios('real');
  assert(Array.isArray(list), '목록 배열');
  const found = list.find(s => Number(s.id) === Number(scenarioId));
  assert(found !== undefined, '생성한 시나리오가 목록에 존재');
  assert(found.name === '테스트 시나리오', '목록에서 이름 일치');
}

// 4. 시나리오 업데이트
console.log('[4] 시나리오 업데이트');
{
  const updatedId = dbHelpers.saveScenario(
    Number(scenarioId),
    '수정된 시나리오',
    'real',
    [{ id: 'ts', name: '태산', basePrice: 150000 }],
    [{ round: 0, month: '1~2월', headline: '수정된 뉴스', volatility: { ts: 10 }, newsBriefing: [] }]
  );
  assert(Number(updatedId) === Number(scenarioId), '업데이트 시 동일 ID 반환');
  const updated = dbHelpers.getScenarioById(Number(scenarioId));
  assert(updated.name === '수정된 시나리오', '이름 수정 확인');
  assert(updated.stocks.length === 1, 'stocks 1개로 수정');
  assert(updated.rounds[0].headline === '수정된 뉴스', '라운드 수정 확인');
}

// 5. 시나리오 삭제
console.log('[5] 시나리오 삭제');
{
  dbHelpers.deleteScenario(Number(scenarioId));
  const deleted = dbHelpers.getScenarioById(Number(scenarioId));
  assert(deleted === null, '삭제 후 조회 시 null');
}

// 6. 존재하지 않는 시나리오 조회
console.log('[6] 존재하지 않는 시나리오 조회');
{
  const notFound = dbHelpers.getScenarioById(999999);
  assert(notFound === null, '존재하지 않는 ID → null');
}

// 7. practice 타입 분리
console.log('[7] practice 타입 분리');
{
  const pid = dbHelpers.saveScenario(null, '연습 시나리오', 'practice', [], []);
  const realList = dbHelpers.getAllScenarios('real');
  const practiceList = dbHelpers.getAllScenarios('practice');
  assert(!realList.find(s => Number(s.id) === Number(pid)), 'real 목록에 practice 시나리오 없음');
  assert(practiceList.find(s => Number(s.id) === Number(pid)) !== undefined, 'practice 목록에 존재');
  dbHelpers.deleteScenario(Number(pid)); // 정리
}

console.log(`\n결과: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
