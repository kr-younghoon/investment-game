// providerHintPools 데이터 무결성 테스트
import { PROVIDER_HINT_PRICES, PROVIDER_HINT_POOLS } from '../src/data/providerHintPools.js';

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

console.log('\n=== providerHintPools 데이터 무결성 테스트 ===\n');

// 1. PROVIDER_HINT_PRICES 확인
console.log('[1] PROVIDER_HINT_PRICES 구조');
{
  assert(typeof PROVIDER_HINT_PRICES === 'object', '객체');
  const providers = Object.keys(PROVIDER_HINT_PRICES);
  assert(providers.length === 3, '3개 제공자');
  assert(providers.includes('조은별 힌트'), '조은별 힌트 존재');
  assert(providers.includes('김민철 힌트'), '김민철 힌트 존재');
  assert(providers.includes('이영훈 힌트'), '이영훈 힌트 존재');
  providers.forEach(p => {
    assert(typeof PROVIDER_HINT_PRICES[p] === 'number', `${p}: 숫자 가격`);
    assert(PROVIDER_HINT_PRICES[p] > 0, `${p}: 양수 가격 (${PROVIDER_HINT_PRICES[p]})`);
  });
}

// 2. PROVIDER_HINT_POOLS 구조
console.log('[2] PROVIDER_HINT_POOLS 구조');
{
  assert(typeof PROVIDER_HINT_POOLS === 'object', '객체');
  const providers = Object.keys(PROVIDER_HINT_POOLS);
  assert(providers.length === 3, '3개 제공자');

  providers.forEach(provider => {
    const pool = PROVIDER_HINT_POOLS[provider];
    assert(typeof pool === 'object', `${provider}: 라운드 맵 객체`);

    Object.entries(pool).forEach(([round, hints]) => {
      const roundNum = parseInt(round);
      assert(!isNaN(roundNum), `${provider} 라운드 ${round}: 숫자 키`);
      assert(roundNum >= 2, `${provider} 라운드 ${round}: 2 이상`);
      assert(Array.isArray(hints), `${provider} 라운드 ${round}: 배열`);
      assert(hints.length > 0, `${provider} 라운드 ${round}: 1개 이상 힌트`);
      hints.forEach((hint, i) => {
        assert(typeof hint === 'string', `${provider} 라운드 ${round} [${i}]: 문자열`);
        assert(hint.length > 0, `${provider} 라운드 ${round} [${i}]: 비어있지 않음`);
      });
    });
  });
}

// 3. PRICES의 키와 POOLS의 키가 일치하는지
console.log('[3] PRICES ↔ POOLS 제공자 키 일치');
{
  const priceProviders = new Set(Object.keys(PROVIDER_HINT_PRICES));
  const poolProviders = new Set(Object.keys(PROVIDER_HINT_POOLS));
  priceProviders.forEach(p => {
    assert(poolProviders.has(p), `${p}: POOLS에도 존재`);
  });
  poolProviders.forEach(p => {
    assert(priceProviders.has(p), `${p}: PRICES에도 존재`);
  });
}

console.log(`\n결과: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
