# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MZ Investment Survival (mz-investment-survival) — a real-time multiplayer stock investment simulation game supporting 60+ concurrent players. Built with React 18 frontend + Express/Socket.io backend + SQLite persistence.

**Language**: Korean UI, Korean comments throughout codebase. ES Modules (`"type": "module"`) for both client and server.

## Commands

```bash
# Development (runs both server:3001 and vite:5173 concurrently)
npm run dev:all

# Frontend only (Vite dev server, port 5173)
npm run dev

# Backend only (Express + Socket.io, port 3001)
npm run server

# Production build
npm run build

# Run a single test file
node tests/services.test.js

# Run all tests (no test runner configured — run each file individually)
node tests/services.test.js
node tests/stateManager.test.js
node tests/handlers.test.js
node tests/socketProtocol.test.js
node tests/idempotency.test.js
node tests/dbScenarios.test.js
node tests/providerHintPools.test.js

# Database integrity check
npm run check-db
```

Tests use Node.js built-in `assert` — no test framework. Output: `✓` pass / `✗` fail.

## Architecture

### Client-Server Communication

```
React (Vite :5173) ←→ Socket.io ←→ Express (:3001) ←→ Services ←→ StateManager ←→ SQLite
```

Vite proxies `/socket.io` to the backend. All game state flows through Socket.io events (not REST). The socket event constants are defined in `shared/socketProtocol.js` (`EVENTS` object, SCREAMING_SNAKE_CASE).

### Three Client Views

- `/` or `/player` — Player interface (stocks, portfolio, ranking)
- `/admin` — Admin dashboard (game control, scenario editor, player management)
- `/display` — 4K broadcast display (charts, ticker, rankings)

### Backend: Service-Oriented with Dependency Injection

`services/index.js` exports `createServices(io)` which wires up all services:

- **StateManager** (`state/StateManager.js`) — single source of truth, in-memory state + DB persistence, manages socket room sets (adminSockets, displaySockets)
- **BroadcastService** — Socket.io emission with throttling to prevent network flooding
- **GameStateService** — game flow, round progression, price calculations (`price = prevPrice × (1 + volatility%)`)
- **PlayerService** — player registration, portfolio management
- **TradingService** — trade validation/execution, idempotency via `IdempotencyService`
- **HintService** / **RewardService** / **AdminService** / **TransactionService** — domain-specific logic

### Backend: Socket Handlers

`socket/handlers/` contains 18 handler files, one per domain (auth, game, trade, round, scenario, hint, reward, etc.). Registered in `socket/handlers/index.js`.

### Frontend: Key Abstractions

- **`useSocketSync`** (`src/hooks/useSocketSync.js`) — central hook managing all Socket.io state and actions. Returns `{ gameState, connected, playerActions, adminActions, socket }`. Used by all three page views.
- **`shared/getActiveStocks.js`** — shared between client and server, resolves custom vs default stock lists
- **`shared/socketProtocol.js`** — shared event constants and state update helpers (`applyGameStateUpdate`, `createGameStatePayload`)

### Database

SQLite via `better-sqlite3` (synchronous) with WAL mode. Tables: `games`, `players`, `player_stocks`, `player_hints`, `transactions`, `admin_accounts`. Setup and helpers in `db.js`.

### Game Data

- `src/data/initialScenarios.js` — stock definitions (10 stocks), 12 monthly scenarios with per-stock volatility, news headlines, hints
- `src/data/providerHintPools.js` — hint content pools by category

### Environment Variables

See `.env.example`: `PORT`, `ADMIN_ID`, `ADMIN_PASSWORD`, `CORS_ORIGINS`, `NODE_ENV`.
