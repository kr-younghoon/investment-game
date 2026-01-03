# 🚀 게임 개선 제안서

## 📊 현재 상태 분석

### ✅ 잘 구현된 부분
- 실시간 Socket.io 통신
- SQLite 데이터베이스 영구 저장
- 관리자 역할 기반 접근 제어
- 라운드 타이머 동기화
- 힌트 시스템
- 거래 로그 추적

### 🔍 개선 가능한 영역

---

## 1. 🔒 보안 강화

### 현재 문제점
- CORS가 `origin: '*'`로 설정되어 모든 도메인 허용
- 비밀번호가 평문 해시로 저장 (bcrypt 미사용)
- 입력값 검증이 일부만 구현됨
- SQL Injection 방지 (prepared statements는 사용 중이지만 추가 검증 필요)

### 개선 방안
```javascript
// 1. CORS 환경 변수화
cors: {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
}

// 2. 비밀번호 해싱 강화 (bcrypt 사용)
import bcrypt from 'bcrypt';
const passwordHash = await bcrypt.hash(password, 10);

// 3. 입력값 검증 강화
- 닉네임: 특수문자, 공백 제한
- 수량: 음수, 소수점 방지
- 금액: 범위 제한
```

**우선순위**: 🔴 높음

---

## 2. 📈 성능 최적화

### 현재 문제점
- 서버 재시작 시 메모리 데이터 손실 (게임 상태, 연결 정보)
- 대량의 거래 로그가 메모리에만 저장
- 클라이언트에서 불필요한 리렌더링 발생 가능
- 데이터베이스 쿼리 최적화 여지

### 개선 방안
```javascript
// 1. 게임 상태 DB 저장
CREATE TABLE game_sessions (
  id INTEGER PRIMARY KEY,
  current_round INTEGER,
  is_started BOOLEAN,
  is_practice BOOLEAN,
  round_timer INTEGER,
  updated_at DATETIME
);

// 2. 거래 로그 페이지네이션
const getTransactions = (page = 1, limit = 50) => {
  return db.prepare(`
    SELECT * FROM transactions 
    ORDER BY timestamp DESC 
    LIMIT ? OFFSET ?
  `).all(limit, (page - 1) * limit);
};

// 3. React.memo, useMemo 활용
const StockCard = React.memo(({ stock, priceHistory }) => {
  // ...
});
```

**우선순위**: 🟡 중간

---

## 3. 🛡️ 에러 처리 및 복구

### 현재 문제점
- 일부 에러가 콘솔에만 출력됨
- 네트워크 끊김 시 자동 복구 로직 부족
- 데이터베이스 트랜잭션 롤백 미구현
- 서버 크래시 시 데이터 손실 가능

### 개선 방안
```javascript
// 1. 전역 에러 핸들러
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // 데이터베이스 백업
  backupDatabase();
  process.exit(1);
});

// 2. 트랜잭션 롤백
const transaction = db.transaction((playerId, stockId, quantity) => {
  try {
    // 거래 실행
  } catch (error) {
    transaction.rollback();
    throw error;
  }
});

// 3. 자동 재연결 로직 강화
socket.on('disconnect', () => {
  // 재연결 시도
  setTimeout(() => socket.connect(), 1000);
});
```

**우선순위**: 🔴 높음

---

## 4. 📱 사용자 경험 (UX) 개선

### 현재 문제점
- 로딩 상태 표시 부족
- 에러 메시지가 기술적임
- 모바일 반응형 최적화 부족
- 접근성 (a11y) 고려 부족

### 개선 방안
```javascript
// 1. 로딩 스켈레톤 UI
const LoadingSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
  </div>
);

// 2. 친화적인 에러 메시지
const errorMessages = {
  'INSUFFICIENT_CASH': '현금이 부족합니다. 다른 주식을 매도하거나 관리자에게 문의하세요.',
  'STOCK_NOT_FOUND': '주식을 찾을 수 없습니다. 새로고침 후 다시 시도해주세요.',
};

// 3. 키보드 네비게이션
<button 
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
  aria-label="거래 실행"
>
```

**우선순위**: 🟡 중간

---

## 5. 🗄️ 데이터 관리 및 백업

### 현재 문제점
- 자동 백업 시스템 없음
- 데이터베이스 마이그레이션 관리 부족
- 게임 상태 복구 기능 없음
- 데이터 내보내기/가져오기 기능 없음

### 개선 방안
```javascript
// 1. 자동 백업 스케줄러
import cron from 'node-cron';

cron.schedule('0 */6 * * *', () => {
  // 6시간마다 백업
  backupDatabase();
});

// 2. 데이터 내보내기 API
app.get('/api/export', (req, res) => {
  const data = {
    players: dbHelpers.getAllPlayers(),
    transactions: dbHelpers.getAllTransactions(),
    gameState: getCurrentGameState(),
  };
  res.json(data);
});

// 3. 게임 상태 저장/복구
const saveGameState = () => {
  dbHelpers.saveGameSession(gameState);
};

const restoreGameState = () => {
  const saved = dbHelpers.getLatestGameSession();
  if (saved) {
    Object.assign(gameState, saved);
  }
};
```

**우선순위**: 🟡 중간

---

## 6. 📊 분석 및 통계 기능

### 현재 문제점
- 플레이어 행동 분석 없음
- 거래 패턴 분석 없음
- 게임 진행 통계 부족
- 실시간 대시보드 부족

### 개선 방안
```javascript
// 1. 거래 패턴 분석
const analyzeTradingPatterns = (playerId) => {
  const trades = dbHelpers.getPlayerTransactions(playerId);
  return {
    mostTradedStock: getMostTradedStock(trades),
    averageHoldTime: calculateAverageHoldTime(trades),
    winRate: calculateWinRate(trades),
  };
};

// 2. 실시간 통계 대시보드
const stats = {
  totalTrades: transactionLogs.length,
  averageAsset: calculateAverageAsset(),
  mostVolatileStock: getMostVolatileStock(),
  topPerformer: getTopPerformer(),
};

// 3. 히트맵 (라운드별 주식 성과)
const generateHeatmap = () => {
  // 각 라운드별 주식 가격 변동률 시각화
};
```

**우선순위**: 🟢 낮음

---

## 7. 🎮 게임플레이 개선

### 현재 문제점
- 힌트 시스템이 단순함 (난이도만 구분)
- 라운드 타이머가 고정 (15분)
- 게임 난이도 조절 불가
- 특별 이벤트/보너스 라운드 없음

### 개선 방안
```javascript
// 1. 동적 타이머 설정
const roundTimer = gameSettings.roundDuration || 900; // 기본 15분

// 2. 힌트 시스템 개선
- 힌트 카테고리 (가격 예측, 뉴스 분석, 시장 동향)
- 힌트 효과 지속 시간
- 힌트 조합 보너스

// 3. 특별 이벤트
const specialEvents = [
  { round: 6, type: 'DOUBLE_PROFIT', description: '모든 수익 2배' },
  { round: 9, type: 'MARKET_CRASH', description: '시장 급락' },
];
```

**우선순위**: 🟢 낮음

---

## 8. 🧪 테스트 및 품질 관리

### 현재 문제점
- 단위 테스트 없음
- 통합 테스트 없음
- E2E 테스트 없음
- 코드 커버리지 측정 없음

### 개선 방안
```javascript
// 1. Jest 단위 테스트
describe('calculateNextRoundPrices', () => {
  it('should calculate prices correctly', () => {
    const result = calculateNextRoundPrices();
    expect(result).toBe(true);
  });
});

// 2. Playwright E2E 테스트
test('플레이어 로그인 및 거래', async ({ page }) => {
  await page.goto('/player');
  await page.fill('input[name="nickname"]', '테스트유저');
  await page.click('button[type="submit"]');
  // ...
});
```

**우선순위**: 🟡 중간

---

## 9. 📝 문서화 및 유지보수성

### 현재 문제점
- API 문서 없음
- 코드 주석 부족
- 아키텍처 다이어그램 없음
- 변경 이력 관리 부족

### 개선 방안
```javascript
// 1. JSDoc 주석
/**
 * 플레이어의 총 자산을 계산합니다.
 * @param {string} socketId - 플레이어 소켓 ID
 * @param {boolean} isPractice - 연습 모드 여부
 * @returns {number} 총 자산 금액
 */
function calculatePlayerTotalAsset(socketId, isPractice) {
  // ...
}

// 2. API 문서 (Swagger/OpenAPI)
// 3. 아키텍처 문서 작성
```

**우선순위**: 🟢 낮음

---

## 10. 🔧 개발자 경험 (DX) 개선

### 현재 문제점
- 환경 변수 관리 부족
- 로깅 시스템 단순 (console.log만 사용)
- 디버깅 도구 부족
- 개발 환경 설정 복잡

### 개선 방안
```javascript
// 1. 구조화된 로깅 (Winston)
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// 2. 환경 변수 관리 (.env)
// .env.example 파일 생성
// dotenv 사용

// 3. 개발 도구
- React DevTools
- Redux DevTools (상태 관리 추가 시)
- Socket.io Debug 모드
```

**우선순위**: 🟡 중간

---

## 📋 우선순위별 추천 개선 사항

### 🔴 즉시 개선 (보안/안정성)
1. **CORS 설정 환경 변수화**
2. **비밀번호 해싱 강화 (bcrypt)**
3. **에러 처리 및 복구 로직**
4. **게임 상태 DB 저장**

### 🟡 단기 개선 (1-2주)
5. **데이터 백업 시스템**
6. **로딩 상태 및 UX 개선**
7. **로깅 시스템 개선**
8. **입력값 검증 강화**

### 🟢 중장기 개선 (1개월+)
9. **분석 및 통계 기능**
10. **테스트 코드 작성**
11. **게임플레이 개선**
12. **문서화**

---

## 💡 추가 제안

### 실용적인 개선
- **QR 코드로 빠른 접속**: 플레이어 페이지 URL을 QR 코드로 생성
- **음성 알림**: 중요한 이벤트 시 음성 알림 (옵션)
- **다크/라이트 모드**: 사용자 선호도 설정
- **다국어 지원**: 영어, 일본어 등 추가

### 기술적 개선
- **상태 관리 라이브러리**: Redux/Zustand 도입 고려
- **타입 안정성**: TypeScript 마이그레이션
- **컴포넌트 라이브러리**: 재사용 가능한 컴포넌트 체계화
- **성능 모니터링**: Web Vitals 측정

---

## 🎯 결론

현재 게임은 **기본 기능이 잘 구현**되어 있으나, **보안**, **안정성**, **사용자 경험** 측면에서 개선 여지가 많습니다.

**가장 우선적으로 개선해야 할 부분**:
1. 보안 강화 (CORS, 비밀번호 해싱)
2. 에러 처리 및 복구
3. 게임 상태 영구 저장

이 세 가지를 개선하면 게임의 안정성과 신뢰성이 크게 향상됩니다.


