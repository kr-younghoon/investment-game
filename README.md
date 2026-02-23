# Investment Game

실시간 멀티플레이어 주식 투자 시뮬레이션 게임. 관리자가 시나리오와 라운드를 제어하고, 참가자들이 주식을 매매하며 최종 자산을 경쟁합니다. 60명 이상 동시 접속을 지원합니다.

## 기술 스택

- **Frontend**: React 18, Vite, Tailwind CSS, Recharts, Framer Motion
- **Backend**: Express, Socket.io
- **DB**: SQLite (better-sqlite3, WAL 모드)
- **통신**: Socket.io 실시간 이벤트 (REST 없음)

## 화면 구성

| 경로 | 설명 |
|------|------|
| `/` 또는 `/player` | 플레이어 화면 — 주식 매매, 포트폴리오, 랭킹 |
| `/admin` | 관리자 대시보드 — 게임 제어, 시나리오 편집, 플레이어 관리 |
| `/display` | 4K 전광판 — 실시간 차트, 시세 티커, 순위 |

## 시작하기

### 설치

```bash
npm install
```

### 환경 변수 설정

```bash
cp .env.example .env
```

| 변수 | 설명 |
|------|------|
| `PORT` | 서버 포트 (기본값: 3001) |
| `ADMIN_ID` | 관리자 아이디 |
| `ADMIN_PASSWORD` | 관리자 비밀번호 |
| `CORS_ORIGINS` | 허용 CORS 출처 |
| `NODE_ENV` | `development` / `production` |

### 실행

```bash
# 프론트엔드 + 백엔드 동시 실행
npm run dev:all

# 개별 실행
npm run server   # 백엔드 (Express + Socket.io, :3001)
npm run dev      # 프론트엔드 (Vite, :5173)
```

### 빌드

```bash
npm run build
```

## 게임 진행 방식

1. 관리자가 `/admin`에서 종목과 라운드별 뉴스·변동률을 설정하고 게임을 시작합니다.
2. 참가자들은 `/player`에서 닉네임으로 입장 후 주식을 매수/매도합니다.
3. 관리자가 라운드를 진행할 때마다 주가가 변동되고 뉴스가 공개됩니다.
4. 모든 라운드가 끝나면 최종 자산 기준 순위가 결정됩니다.
5. `/display`에서 실시간 시세와 순위를 4K 화면에 표출합니다.

## 프로젝트 구조

```
├── server.js                  # Express 서버 진입점
├── services/                  # 비즈니스 로직 서비스 레이어
│   ├── index.js               # createServices(io) — DI 진입점
│   ├── GameStateService.js    # 게임 흐름, 라운드 진행, 가격 계산
│   ├── BroadcastService.js    # Socket.io 브로드캐스트 (스로틀링)
│   ├── PlayerService.js       # 플레이어 등록, 포트폴리오
│   ├── TradingService.js      # 매매 검증 및 실행
│   └── ...
├── socket/handlers/           # Socket.io 이벤트 핸들러 (도메인별)
├── state/StateManager.js      # 인메모리 상태 + DB 영속성
├── shared/
│   ├── socketProtocol.js      # 이벤트 상수 및 상태 헬퍼 (공유)
│   └── getActiveStocks.js     # 커스텀/연습/실제 종목 해석 (공유)
├── src/
│   ├── pages/
│   │   ├── PlayerPage.jsx
│   │   ├── DisplayBoardPage.jsx
│   │   └── admin/
│   ├── hooks/useSocketSync.js # 모든 Socket.io 상태·액션 중앙 훅
│   └── data/initialScenarios.js
├── db.js                      # SQLite 초기화 및 헬퍼
└── tests/                     # Node.js 내장 assert 기반 테스트
```

## 테스트

```bash
node tests/services.test.js
node tests/stateManager.test.js
node tests/handlers.test.js
node tests/socketProtocol.test.js
node tests/idempotency.test.js
node tests/dbScenarios.test.js
node tests/providerHintPools.test.js
```

## DB 점검

```bash
npm run check-db
```

## 라이선스

MIT
