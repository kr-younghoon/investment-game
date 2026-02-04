import { IdempotencyService } from '../services/IdempotencyService.js';

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

console.log('\n=== IdempotencyService 테스트 ===\n');

// 1. 기본 동작
console.log('[1] 기본 저장/조회');
{
  const svc = new IdempotencyService(5000);
  svc.storeResult('req-1', { success: true, amount: 100 });
  const cached = svc.getProcessedResult('req-1');
  assert(cached !== null, '캐시된 결과가 존재해야 함');
  assert(cached.success === true, 'success === true');
  assert(cached.amount === 100, 'amount === 100');
  svc.destroy();
}

// 2. 존재하지 않는 키
console.log('[2] 존재하지 않는 키 조회');
{
  const svc = new IdempotencyService(5000);
  const cached = svc.getProcessedResult('no-exist');
  assert(cached === null, '존재하지 않는 키는 null 반환');
  svc.destroy();
}

// 3. null/undefined requestId 무시
console.log('[3] null/undefined requestId 처리');
{
  const svc = new IdempotencyService(5000);
  svc.storeResult(null, { x: 1 });
  svc.storeResult(undefined, { x: 2 });
  assert(svc.getProcessedResult(null) === null, 'null requestId → null 반환');
  assert(svc.getProcessedResult(undefined) === null, 'undefined requestId → null 반환');
  svc.destroy();
}

// 4. TTL 만료
console.log('[4] TTL 만료 테스트');
{
  const svc = new IdempotencyService(50); // 50ms TTL
  svc.storeResult('req-ttl', { ok: true });
  assert(svc.getProcessedResult('req-ttl') !== null, '즉시 조회 시 존재');
  await new Promise(r => setTimeout(r, 100));
  assert(svc.getProcessedResult('req-ttl') === null, 'TTL 만료 후 null');
  svc.destroy();
}

// 5. 결과 덮어쓰기
console.log('[5] 같은 키 덮어쓰기');
{
  const svc = new IdempotencyService(5000);
  svc.storeResult('req-ow', { v: 1 });
  svc.storeResult('req-ow', { v: 2 });
  const cached = svc.getProcessedResult('req-ow');
  assert(cached.v === 2, '최신 값으로 덮어씀');
  svc.destroy();
}

// 6. destroy 후 조회 불가
console.log('[6] destroy 후 캐시 비워짐');
{
  const svc = new IdempotencyService(5000);
  svc.storeResult('req-d', { v: 1 });
  svc.destroy();
  assert(svc.getProcessedResult('req-d') === null, 'destroy 후 null');
}

console.log(`\n결과: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
