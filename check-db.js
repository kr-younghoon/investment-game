import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'game_data.db');

const db = new Database(dbPath);

console.log('='.repeat(60));
console.log('📊 게임 데이터베이스 확인');
console.log('='.repeat(60));

// 플레이어 목록
console.log('\n👥 플레이어 목록:');
const players = db.prepare('SELECT * FROM players ORDER BY created_at DESC').all();
if (players.length === 0) {
  console.log('  플레이어가 없습니다.');
} else {
  players.forEach((player, index) => {
    console.log(`\n  [${index + 1}] ${player.nickname}`);
    console.log(`      ID: ${player.id}`);
    console.log(`      Socket ID: ${player.socket_id}`);
    console.log(`      현금: ₩${player.cash.toLocaleString('ko-KR')}`);
    console.log(`      총 자산: ₩${player.total_asset.toLocaleString('ko-KR')}`);
    console.log(`      모드: ${player.is_practice ? '연습' : '실제'}`);
    console.log(`      생성일: ${player.created_at}`);
    console.log(`      수정일: ${player.updated_at}`);
  });
}

// 플레이어별 주식 보유량
console.log('\n📈 플레이어 주식 보유량:');
const stocks = db.prepare(`
  SELECT ps.*, p.nickname 
  FROM player_stocks ps
  JOIN players p ON ps.player_id = p.id
  WHERE ps.quantity > 0
  ORDER BY p.nickname, ps.stock_id
`).all();
if (stocks.length === 0) {
  console.log('  보유 주식이 없습니다.');
} else {
  stocks.forEach(stock => {
    console.log(`  ${stock.nickname}: ${stock.stock_id} ${stock.quantity}주`);
  });
}

// 플레이어별 힌트
console.log('\n💡 플레이어 힌트:');
const hints = db.prepare(`
  SELECT ph.*, p.nickname 
  FROM player_hints ph
  JOIN players p ON ph.player_id = p.id
  ORDER BY p.nickname, ph.received_at DESC
`).all();
if (hints.length === 0) {
  console.log('  힌트가 없습니다.');
} else {
  const hintsByPlayer = {};
  hints.forEach(hint => {
    if (!hintsByPlayer[hint.nickname]) {
      hintsByPlayer[hint.nickname] = [];
    }
    hintsByPlayer[hint.nickname].push(hint);
  });
  
  Object.entries(hintsByPlayer).forEach(([nickname, playerHints]) => {
    console.log(`\n  ${nickname} (${playerHints.length}개):`);
    playerHints.forEach(hint => {
      console.log(`    - ${hint.difficulty}급 (라운드 ${hint.round + 1}): ₩${hint.price.toLocaleString('ko-KR')}`);
      if (hint.content) {
        console.log(`      내용: ${hint.content.substring(0, 50)}${hint.content.length > 50 ? '...' : ''}`);
      }
    });
  });
}

// 거래 로그 통계
console.log('\n📋 거래 로그 통계:');
const transactionStats = db.prepare(`
  SELECT 
    type,
    COUNT(*) as count,
    SUM(CASE WHEN total_cost IS NOT NULL THEN total_cost ELSE 0 END) as total_buy,
    SUM(CASE WHEN total_revenue IS NOT NULL THEN total_revenue ELSE 0 END) as total_sell
  FROM transactions
  GROUP BY type
`).all();
transactionStats.forEach(stat => {
  console.log(`  ${stat.type}: ${stat.count}건`);
  if (stat.total_buy > 0) {
    console.log(`    총 매수액: ₩${stat.total_buy.toLocaleString('ko-KR')}`);
  }
  if (stat.total_sell > 0) {
    console.log(`    총 매도액: ₩${stat.total_sell.toLocaleString('ko-KR')}`);
  }
});

// 최근 거래 로그 (최근 10개)
console.log('\n📝 최근 거래 로그 (최근 10개):');
const recentTransactions = db.prepare(`
  SELECT * FROM transactions 
  ORDER BY timestamp DESC 
  LIMIT 10
`).all();
if (recentTransactions.length === 0) {
  console.log('  거래 로그가 없습니다.');
} else {
  recentTransactions.forEach((tx, index) => {
    const time = new Date(tx.timestamp).toLocaleString('ko-KR');
    console.log(`\n  [${index + 1}] ${time} - ${tx.nickname}`);
    console.log(`      유형: ${tx.type}`);
    if (tx.stock_id) {
      console.log(`      주식: ${tx.stock_id}, 수량: ${tx.quantity}주, 가격: ₩${tx.price?.toFixed(2) || 0}`);
    }
    if (tx.total_cost) {
      console.log(`      매수액: ₩${tx.total_cost.toLocaleString('ko-KR')}`);
    }
    if (tx.total_revenue) {
      console.log(`      매도액: ₩${tx.total_revenue.toLocaleString('ko-KR')}`);
    }
    if (tx.points) {
      console.log(`      포인트: +${tx.points.toLocaleString('ko-KR')}`);
    }
    if (tx.difficulty) {
      console.log(`      힌트: ${tx.difficulty}급, 가격: ₩${tx.hint_price?.toLocaleString('ko-KR') || 0}`);
    }
    console.log(`      라운드: ${tx.round + 1}`);
  });
}

console.log('\n' + '='.repeat(60));
db.close();

