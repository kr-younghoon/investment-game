import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 데이터베이스 파일 경로
const dbPath = join(__dirname, 'game_data.db');

// 데이터베이스 연결
const db = new Database(dbPath);

// WAL 모드 활성화 (동시 읽기 성능 향상, 50명 이상 유저 대응)
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL'); // 성능과 안정성 균형
db.pragma('cache_size = -64000'); // 64MB 캐시 (기본값보다 증가)
db.pragma('temp_store = MEMORY'); // 임시 테이블을 메모리에 저장

// 기존 테이블에 컬럼 추가 (마이그레이션) - CREATE TABLE 이전에 실행
const migrations = [
  {
    table: 'transactions',
    column: 'admin_id',
    type: 'INTEGER',
  },
  {
    table: 'players',
    column: 'game_id',
    type: 'TEXT',
    defaultValue: "'legacy'",
  },
  {
    table: 'player_stocks',
    column: 'game_id',
    type: 'TEXT',
    defaultValue: "'legacy'",
  },
  {
    table: 'player_hints',
    column: 'game_id',
    type: 'TEXT',
    defaultValue: "'legacy'",
  },
  {
    table: 'transactions',
    column: 'game_id',
    type: 'TEXT',
    defaultValue: "'legacy'",
  },
];

migrations.forEach(
  ({ table, column, type, defaultValue }) => {
    try {
      // 테이블이 존재하는지 확인
      const tableInfo = db
        .prepare(`PRAGMA table_info(${table})`)
        .all();
      const columnExists = tableInfo.some(
        (col) => col.name === column
      );

      if (!columnExists) {
        if (defaultValue) {
          db.exec(`
            ALTER TABLE ${table} ADD COLUMN ${column} ${type} DEFAULT ${defaultValue};
          `);
        } else {
          db.exec(`
            ALTER TABLE ${table} ADD COLUMN ${column} ${type};
          `);
        }
        console.log(
          `[마이그레이션] ${table} 테이블에 ${column} 컬럼 추가 완료`
        );
      }
    } catch (error) {
      // 테이블이 존재하지 않는 경우 무시 (CREATE TABLE에서 생성됨)
      // 또는 컬럼이 이미 존재하는 경우 무시
      if (
        error.message.includes('no such table') ||
        error.message.includes('duplicate column name')
      ) {
        // 정상적인 경우이므로 무시
      } else {
        console.error(
          `[마이그레이션] ${table} 테이블에 ${column} 컬럼 추가 중 오류:`,
          error.message
        );
      }
    }
  }
);

// 테이블 생성
db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT UNIQUE NOT NULL,
    is_practice BOOLEAN DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS game_state (
    game_id TEXT PRIMARY KEY,
    state_json TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(game_id)
  );

  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    socket_id TEXT NOT NULL,
    nickname TEXT NOT NULL,
    cash REAL DEFAULT 3000000,
    bonus_points REAL DEFAULT 0,
    total_asset REAL DEFAULT 3000000,
    is_practice BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(game_id),
    UNIQUE(game_id, socket_id, is_practice)
  );

  CREATE TABLE IF NOT EXISTS player_stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    player_id INTEGER NOT NULL,
    stock_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 0,
    is_practice BOOLEAN DEFAULT 0,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(game_id),
    UNIQUE(game_id, player_id, stock_id, is_practice)
  );

  CREATE TABLE IF NOT EXISTS player_hints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    player_id INTEGER NOT NULL,
    difficulty TEXT NOT NULL,
    content TEXT,
    price REAL NOT NULL,
    round INTEGER NOT NULL,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_practice BOOLEAN DEFAULT 0,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (game_id) REFERENCES games(game_id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    player_id INTEGER,
    nickname TEXT NOT NULL,
    type TEXT NOT NULL,
    stock_id TEXT,
    quantity INTEGER,
    price REAL,
    total_cost REAL,
    total_revenue REAL,
    points REAL,
    difficulty TEXT,
    hint_price REAL,
    round INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    admin_id INTEGER,
    is_practice BOOLEAN DEFAULT 0,
    FOREIGN KEY (admin_id) REFERENCES admins(id),
    FOREIGN KEY (game_id) REFERENCES games(game_id)
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS round_rumors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    rumor TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(game_id),
    UNIQUE(game_id, round)
  );

  CREATE TABLE IF NOT EXISTS round_hints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    hint_index INTEGER NOT NULL,
    hint_content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(game_id),
    UNIQUE(game_id, round, hint_index)
  );

  CREATE INDEX IF NOT EXISTS idx_games_game_id ON games(game_id);
  CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id);
  CREATE INDEX IF NOT EXISTS idx_players_socket ON players(socket_id);
  CREATE INDEX IF NOT EXISTS idx_players_nickname ON players(nickname);
  CREATE INDEX IF NOT EXISTS idx_player_stocks_game_id ON player_stocks(game_id);
  CREATE INDEX IF NOT EXISTS idx_player_hints_game_id ON player_hints(game_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_game_id ON transactions(game_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_player ON transactions(player_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
  CREATE INDEX IF NOT EXISTS idx_hints_player ON player_hints(player_id);
  CREATE INDEX IF NOT EXISTS idx_admins_id ON admins(admin_id);
  CREATE INDEX IF NOT EXISTS idx_game_state_updated ON game_state(updated_at);
`);

// admin_id에 대한 인덱스 추가 (이미 존재하면 무시)
try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_admin ON transactions(admin_id);
  CREATE INDEX IF NOT EXISTS idx_round_rumors_game_round ON round_rumors(game_id, round);
  CREATE INDEX IF NOT EXISTS idx_round_hints_game_round ON round_hints(game_id, round);
  `);

  // 시나리오 테이블 생성
  db.exec(`
    CREATE TABLE IF NOT EXISTS scenarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_scenarios_type ON scenarios(type);
  `);
} catch (error) {
  // 인덱스가 이미 존재하는 경우 무시
  if (!error.message.includes('already exists')) {
    console.error('인덱스 생성 중 오류:', error.message);
  }
}

// 기본 운영자 계정 생성
const defaultAdminId = '이영훈';
const defaultPassword = '01087596957';
const checkDefaultAdmin = db.prepare(
  'SELECT * FROM admins WHERE admin_id = ?'
);
const insertDefaultAdmin = db.prepare(`
  INSERT OR IGNORE INTO admins (admin_id, password)
  VALUES (?, ?)
`);

const existingAdmin = checkDefaultAdmin.get(defaultAdminId);
if (!existingAdmin) {
  insertDefaultAdmin.run(defaultAdminId, defaultPassword);
  console.log(
    '기본 운영자 계정 생성 완료:',
    defaultAdminId
  );
}

// 게임 ID 생성 및 관리 함수
export const createGameId = () => {
  return randomUUID();
};

// Prepared statements
const stmts = {
  // Games
  insertGame: db.prepare(`
    INSERT INTO games (game_id, is_practice)
    VALUES (?, ?)
  `),
  getGameById: db.prepare(`
    SELECT * FROM games WHERE game_id = ?
  `),
  endGame: db.prepare(`
    UPDATE games SET ended_at = CURRENT_TIMESTAMP WHERE game_id = ?
  `),

  // Game State
  upsertGameState: db.prepare(`
    INSERT INTO game_state (game_id, state_json)
    VALUES (?, ?)
    ON CONFLICT(game_id) DO UPDATE SET
      state_json = excluded.state_json,
      updated_at = CURRENT_TIMESTAMP
  `),
  getGameStateById: db.prepare(`
    SELECT game_id, state_json, updated_at FROM game_state WHERE game_id = ?
  `),
  getLatestGameState: db.prepare(`
    SELECT game_id, state_json, updated_at FROM game_state
    ORDER BY updated_at DESC
    LIMIT 1
  `),

  // Players
  getPlayerBySocketId: db.prepare(
    'SELECT * FROM players WHERE game_id = ? AND socket_id = ? AND is_practice = ?'
  ),
  getPlayerByNickname: db.prepare(
    'SELECT * FROM players WHERE game_id = ? AND nickname = ? AND is_practice = ?'
  ),
  getPlayerById: db.prepare(
    'SELECT * FROM players WHERE id = ?'
  ),
  getAllPlayers: db.prepare(
    'SELECT * FROM players WHERE game_id = ? AND is_practice = ? ORDER BY nickname'
  ),
  insertPlayer: db.prepare(`
    INSERT OR IGNORE INTO players (game_id, socket_id, nickname, cash, bonus_points, total_asset, is_practice)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  updatePlayerSocketId: db.prepare(`
    UPDATE players SET socket_id = ?, updated_at = CURRENT_TIMESTAMP WHERE game_id = ? AND nickname = ? AND is_practice = ?
  `),
  // 다른 플레이어의 socket_id를 임시 값으로 변경 (UNIQUE 제약조건 회피)
  clearPlayerSocketId: db.prepare(`
    UPDATE players SET socket_id = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE game_id = ? AND socket_id = ? AND is_practice = ? AND id != ?
  `),
  updatePlayerCash: db.prepare(
    'UPDATE players SET cash = ?, total_asset = ?, updated_at = CURRENT_TIMESTAMP WHERE game_id = ? AND socket_id = ? AND is_practice = ?'
  ),
  updatePlayerCashById: db.prepare(
    'UPDATE players SET cash = ?, total_asset = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_practice = ?'
  ),
  updatePlayerAsset: db.prepare(
    'UPDATE players SET total_asset = ?, updated_at = CURRENT_TIMESTAMP WHERE game_id = ? AND socket_id = ? AND is_practice = ?'
  ),
  deletePlayer: db.prepare(
    'DELETE FROM players WHERE id = ? AND is_practice = ?'
  ),

  // Stocks
  getPlayerStocks: db.prepare(
    'SELECT * FROM player_stocks WHERE game_id = ? AND player_id = ? AND is_practice = ?'
  ),
  getPlayerStock: db.prepare(
    'SELECT * FROM player_stocks WHERE game_id = ? AND player_id = ? AND stock_id = ? AND is_practice = ?'
  ),
  insertPlayerStock: db.prepare(`
    INSERT INTO player_stocks (game_id, player_id, stock_id, quantity, is_practice)
    VALUES (?, ?, ?, ?, ?)
  `),
  updatePlayerStock: db.prepare(`
    UPDATE player_stocks SET quantity = ? 
    WHERE game_id = ? AND player_id = ? AND stock_id = ? AND is_practice = ?
  `),
  deletePlayerStocks: db.prepare(
    'DELETE FROM player_stocks WHERE game_id = ? AND player_id = ? AND is_practice = ?'
  ),
  deletePlayerHints: db.prepare(
    'DELETE FROM player_hints WHERE game_id = ? AND player_id = ? AND is_practice = ?'
  ),

  // Hints
  getPlayerHints: db.prepare(
    'SELECT * FROM player_hints WHERE game_id = ? AND player_id = ? AND is_practice = ? ORDER BY received_at DESC'
  ),
  insertHint: db.prepare(`
    INSERT INTO player_hints (game_id, player_id, difficulty, content, price, round, is_practice)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),

  // Transactions
  insertTransaction: db.prepare(`
    INSERT INTO transactions (game_id, player_id, nickname, type, stock_id, quantity, price, total_cost, total_revenue, points, difficulty, hint_price, round, admin_id, is_practice)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getTransactions: db.prepare(
    'SELECT * FROM transactions WHERE game_id = ? AND is_practice = ? ORDER BY timestamp DESC LIMIT ?'
  ),
  getAllTransactions: db.prepare(
    'SELECT * FROM transactions WHERE game_id = ? AND is_practice = ? ORDER BY timestamp DESC'
  ),
  getTransactionsByPlayerId: db.prepare(
    'SELECT * FROM transactions WHERE game_id = ? AND player_id = ? AND is_practice = ? ORDER BY timestamp ASC'
  ),
  // 배치 쿼리: 모든 플레이어의 주식 정보를 한 번에 가져오기 (50명 이상 대응)
  getAllPlayerStocks: db.prepare(
    'SELECT * FROM player_stocks WHERE game_id = ? AND is_practice = ?'
  ),
  // 배치 쿼리: 모든 플레이어의 힌트 정보를 한 번에 가져오기
  getAllPlayerHints: db.prepare(
    'SELECT * FROM player_hints WHERE game_id = ? AND is_practice = ? ORDER BY player_id, received_at DESC'
  ),
  // 배치 쿼리: 모든 플레이어의 거래 내역을 한 번에 가져오기
  getAllPlayerTransactions: db.prepare(
    'SELECT * FROM transactions WHERE game_id = ? AND is_practice = ? ORDER BY player_id, timestamp ASC'
  ),
  // 모든 거래 내역 삭제 (특정 게임)
  deleteAllTransactions: db.prepare(
    'DELETE FROM transactions WHERE game_id = ? AND is_practice = ?'
  ),
  // 모든 거래 내역 삭제 (모든 게임)
  deleteAllTransactionsAllGames: db.prepare(
    'DELETE FROM transactions WHERE is_practice = ?'
  ),

  // Admins
  getAdminById: db.prepare(
    'SELECT * FROM admins WHERE admin_id = ?'
  ),
  getAllAdmins: db.prepare(
    'SELECT id, admin_id, created_at, updated_at FROM admins ORDER BY created_at DESC'
  ),
  insertAdmin: db.prepare(
    'INSERT INTO admins (admin_id, password) VALUES (?, ?)'
  ),
  updateAdminPassword: db.prepare(
    'UPDATE admins SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ),
  deleteAdmin: db.prepare(
    'DELETE FROM admins WHERE id = ?'
  ),

  // Round Rumors
  getRoundRumor: db.prepare(
    'SELECT * FROM round_rumors WHERE game_id = ? AND round = ?'
  ),
  getAllRoundRumors: db.prepare(
    'SELECT * FROM round_rumors WHERE game_id = ? ORDER BY round'
  ),
  insertRoundRumor: db.prepare(`
    INSERT OR REPLACE INTO round_rumors (game_id, round, rumor)
    VALUES (?, ?, ?)
  `),
  deleteRoundRumor: db.prepare(
    'DELETE FROM round_rumors WHERE game_id = ? AND round = ?'
  ),

  // Round Hints
  getRoundHints: db.prepare(
    'SELECT * FROM round_hints WHERE game_id = ? AND round = ? ORDER BY hint_index'
  ),
  getAllRoundHints: db.prepare(
    'SELECT * FROM round_hints WHERE game_id = ? ORDER BY round, hint_index'
  ),
  insertRoundHint: db.prepare(`
    INSERT INTO round_hints (game_id, round, hint_index, hint_content)
    VALUES (?, ?, ?, ?)
  `),
  deleteRoundHints: db.prepare(
    'DELETE FROM round_hints WHERE game_id = ? AND round = ?'
  ),

  // Scenarios
  getAllScenarios: db.prepare(
    'SELECT id, name, type, created_at, updated_at FROM scenarios WHERE type = ? ORDER BY updated_at DESC'
  ),
  getScenarioById: db.prepare(
    'SELECT * FROM scenarios WHERE id = ?'
  ),
  insertScenario: db.prepare(`
    INSERT INTO scenarios (name, type, data_json)
    VALUES (?, ?, ?)
  `),
  updateScenario: db.prepare(`
    UPDATE scenarios SET name = ?, data_json = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `),
  deleteScenario: db.prepare(
    'DELETE FROM scenarios WHERE id = ?'
  ),
};

// Helper functions
export const dbHelpers = {
  // Game operations
  createGame(gameId, isPractice) {
    try {
      stmts.insertGame.run(gameId, isPractice ? 1 : 0);
      return { gameId, isPractice };
    } catch (error) {
      console.error('[dbHelpers] 게임 생성 오류:', error);
      throw error;
    }
  },

  getGame(gameId) {
    return stmts.getGameById.get(gameId);
  },

  markGameEnded(gameId) {
    if (!gameId) {
      return;
    }
    stmts.endGame.run(gameId);
  },

  saveGameState(gameId, state) {
    if (!gameId || !state) {
      return;
    }
    try {
      const serialized = JSON.stringify(state);
      stmts.upsertGameState.run(gameId, serialized);
    } catch (error) {
      console.error(
        '[dbHelpers] 게임 상태 저장 오류:',
        error
      );
      throw error;
    }
  },

  getGameState(gameId) {
    if (!gameId) {
      return null;
    }
    const row = stmts.getGameStateById.get(gameId);
    if (!row) {
      return null;
    }
    try {
      return {
        gameId: row.game_id,
        updatedAt: row.updated_at,
        state: JSON.parse(row.state_json),
      };
    } catch (error) {
      console.error(
        '[dbHelpers] 게임 상태 파싱 오류:',
        error
      );
      return null;
    }
  },

  getLatestGameState() {
    const row = stmts.getLatestGameState.get();
    if (!row) {
      return null;
    }
    try {
      return {
        gameId: row.game_id,
        updatedAt: row.updated_at,
        state: JSON.parse(row.state_json),
      };
    } catch (error) {
      console.error(
        '[dbHelpers] 최신 게임 상태 파싱 오류:',
        error
      );
      return null;
    }
  },

  // Player operations
  getPlayer(gameId, socketId, isPractice) {
    return stmts.getPlayerBySocketId.get(
      gameId,
      socketId,
      isPractice ? 1 : 0
    );
  },

  getPlayerByNickname(gameId, nickname, isPractice) {
    return stmts.getPlayerByNickname.get(
      gameId,
      nickname,
      isPractice ? 1 : 0
    );
  },

  getPlayerById(playerId) {
    return stmts.getPlayerById.get(playerId);
  },

  getAllPlayers(gameId, isPractice) {
    return stmts.getAllPlayers.all(
      gameId,
      isPractice ? 1 : 0
    );
  },

  getTransactionsByPlayerId(gameId, playerId, isPractice) {
    const dbTransactions =
      stmts.getTransactionsByPlayerId.all(
        gameId,
        playerId,
        isPractice ? 1 : 0
      );
    // 데이터베이스 형식을 메모리 형식으로 변환
    return dbTransactions.map((t) => ({
      type: t.type,
      stockId: t.stock_id,
      quantity: t.quantity,
      price: t.price,
      totalCost: t.total_cost,
      totalRevenue: t.total_revenue,
      points: t.points,
      difficulty: t.difficulty,
      hintPrice: t.hint_price,
      round: t.round,
      timestamp: t.timestamp,
      adminId: t.admin_id,
    }));
  },

  // 배치 쿼리 헬퍼 함수 (50명 이상 대응: N+1 쿼리 문제 해결)
  getAllPlayerStocks(gameId, isPractice) {
    return stmts.getAllPlayerStocks.all(
      gameId,
      isPractice ? 1 : 0
    );
  },

  getAllPlayerHints(gameId, isPractice) {
    return stmts.getAllPlayerHints.all(
      gameId,
      isPractice ? 1 : 0
    );
  },

  getAllPlayerTransactions(gameId, isPractice) {
    const dbTransactions =
      stmts.getAllPlayerTransactions.all(
        gameId,
        isPractice ? 1 : 0
      );
    // 데이터베이스 형식을 메모리 형식으로 변환
    return dbTransactions.map((t) => ({
      type: t.type,
      stockId: t.stock_id,
      quantity: t.quantity,
      price: t.price,
      totalCost: t.total_cost,
      totalRevenue: t.total_revenue,
      points: t.points,
      difficulty: t.difficulty,
      hintPrice: t.hint_price,
      round: t.round,
      timestamp: t.timestamp,
      adminId: t.admin_id,
      playerId: t.player_id, // playerId 추가 (그룹화에 필요)
    }));
  },

  savePlayer(
    gameId,
    socketId,
    nickname,
    cash,
    bonusPoints,
    totalAsset,
    isPractice
  ) {
    // 먼저 플레이어가 있는지 확인
    let player = stmts.getPlayerByNickname.get(
      gameId,
      nickname,
      isPractice ? 1 : 0
    );

    if (player) {
      // 기존 플레이어의 socket_id 업데이트
      // 먼저 이 socket_id가 다른 플레이어에게 할당되어 있는지 확인하고 해제
      const existingPlayerWithSocket =
        stmts.getPlayerBySocketId.get(
          gameId,
          socketId,
          isPractice ? 1 : 0
        );
      if (
        existingPlayerWithSocket &&
        existingPlayerWithSocket.id !== player.id
      ) {
        // 다른 플레이어가 이 socket_id를 사용 중이면 임시 값으로 변경
        // 임시 값: 'temp_' + timestamp + '_' + 기존 플레이어 ID
        const tempSocketId = `temp_${Date.now()}_${
          existingPlayerWithSocket.id
        }`;
        stmts.clearPlayerSocketId.run(
          tempSocketId,
          gameId,
          socketId,
          isPractice ? 1 : 0,
          player.id
        );
      }
      // 기존 플레이어의 socket_id 업데이트
      stmts.updatePlayerSocketId.run(
        socketId,
        gameId,
        nickname,
        isPractice ? 1 : 0
      );
      const updatedPlayer = stmts.getPlayerByNickname.get(
        gameId,
        nickname,
        isPractice ? 1 : 0
      );
      // 기존 플레이어임을 표시하기 위해 isNew 플래그 추가
      return { ...updatedPlayer, _isNew: false };
    } else {
      // 새 플레이어 생성 전에 이 socket_id가 이미 사용 중인지 확인
      const existingPlayerWithSocket =
        stmts.getPlayerBySocketId.get(
          gameId,
          socketId,
          isPractice ? 1 : 0
        );
      if (existingPlayerWithSocket) {
        // 이미 이 socket_id를 사용하는 플레이어가 있으면 임시 값으로 변경
        const tempSocketId = `temp_${Date.now()}_${
          existingPlayerWithSocket.id
        }`;
        stmts.clearPlayerSocketId.run(
          tempSocketId,
          gameId,
          socketId,
          isPractice ? 1 : 0,
          -1
        ); // -1은 모든 ID와 매칭되지 않도록
      }
      // 새 플레이어 생성
      const result = stmts.insertPlayer.run(
        gameId,
        socketId,
        nickname,
        cash,
        bonusPoints,
        totalAsset,
        isPractice ? 1 : 0
      );
      // 새로 생성된 플레이어를 socketId로 가져오기
      const newPlayer = stmts.getPlayerBySocketId.get(
        gameId,
        socketId,
        isPractice ? 1 : 0
      );
      // 새 플레이어임을 표시하기 위해 isNew 플래그 추가
      return { ...newPlayer, _isNew: true };
    }
  },

  updatePlayerCash(
    gameId,
    socketId,
    cash,
    totalAsset,
    isPractice
  ) {
    stmts.updatePlayerCash.run(
      cash,
      totalAsset,
      gameId,
      socketId,
      isPractice ? 1 : 0
    );
  },

  updatePlayerCashById(
    playerId,
    cash,
    totalAsset,
    isPractice
  ) {
    stmts.updatePlayerCashById.run(
      cash,
      totalAsset,
      playerId,
      isPractice ? 1 : 0
    );
  },

  updatePlayerAsset(
    gameId,
    socketId,
    totalAsset,
    isPractice
  ) {
    stmts.updatePlayerAsset.run(
      totalAsset,
      gameId,
      socketId,
      isPractice ? 1 : 0
    );
  },

  // Stock operations
  getPlayerStocks(gameId, playerId, isPractice) {
    return stmts.getPlayerStocks.all(
      gameId,
      playerId,
      isPractice ? 1 : 0
    );
  },

  savePlayerStock(
    gameId,
    playerId,
    stockId,
    quantity,
    isPractice
  ) {
    // 기존 레코드 확인
    const existing = stmts.getPlayerStock.get(
      gameId,
      playerId,
      stockId,
      isPractice ? 1 : 0
    );

    if (existing) {
      // 업데이트
      stmts.updatePlayerStock.run(
        quantity,
        gameId,
        playerId,
        stockId,
        isPractice ? 1 : 0
      );
    } else {
      // 삽입
      stmts.insertPlayerStock.run(
        gameId,
        playerId,
        stockId,
        quantity,
        isPractice ? 1 : 0
      );
    }
  },

  clearPlayerStocks(gameId, playerId, isPractice) {
    stmts.deletePlayerStocks.run(
      gameId,
      playerId,
      isPractice ? 1 : 0
    );
  },

  clearPlayerHints(gameId, playerId, isPractice) {
    stmts.deletePlayerHints.run(
      gameId,
      playerId,
      isPractice ? 1 : 0
    );
  },

  deletePlayer(playerId, isPractice) {
    // CASCADE로 인해 관련된 player_stocks, player_hints, transactions도 자동 삭제됨
    stmts.deletePlayer.run(playerId, isPractice ? 1 : 0);
  },

  deleteAllPlayers(gameId, isPractice) {
    console.log(
      `[dbHelpers] deleteAllPlayers 호출 (gameId: ${gameId}, isPractice: ${isPractice})`
    );
    // 모든 플레이어 삭제 (CASCADE로 인해 관련된 데이터도 자동 삭제됨)
    // gameId가 null이면 모든 게임의 플레이어를 삭제
    let allPlayers;
    if (gameId === null) {
      // 모든 게임의 플레이어 가져오기
      const getAllPlayersAllGames = db.prepare(
        'SELECT * FROM players WHERE is_practice = ? ORDER BY nickname'
      );
      allPlayers = getAllPlayersAllGames.all(
        isPractice ? 1 : 0
      );
    } else {
      // 특정 게임의 플레이어만 가져오기
      allPlayers = stmts.getAllPlayers.all(
        gameId,
        isPractice ? 1 : 0
      );
    }
    console.log(
      `[dbHelpers] 삭제할 플레이어 수: ${allPlayers.length}명`
    );
    const playerIds = allPlayers.map((p) => p.id);

    // 각 플레이어의 주식, 힌트, 거래 내역은 CASCADE로 자동 삭제되지만
    // 명시적으로 삭제하는 것이 더 안전할 수 있음
    // 하지만 CASCADE가 설정되어 있다면 DELETE FROM players만으로도 충분
    // 여기서는 각 플레이어를 개별 삭제하여 CASCADE가 작동하도록 함
    playerIds.forEach((playerId) => {
      try {
        stmts.deletePlayer.run(
          playerId,
          isPractice ? 1 : 0
        );
      } catch (error) {
        console.error(
          `[dbHelpers] 플레이어 삭제 중 오류 (ID: ${playerId}):`,
          error
        );
      }
    });

    console.log(
      `[dbHelpers] deleteAllPlayers 완료: ${playerIds.length}명 삭제됨`
    );
    return playerIds.length; // 삭제된 플레이어 수 반환
  },

  clearAllTransactions(gameId, isPractice) {
    console.log(
      `[dbHelpers] clearAllTransactions 호출 (gameId: ${gameId}, isPractice: ${isPractice})`
    );
    try {
      let result;
      if (gameId === null) {
        // 모든 게임의 거래 내역 삭제
        result = stmts.deleteAllTransactionsAllGames.run(
          isPractice ? 1 : 0
        );
      } else {
        // 특정 게임의 거래 내역만 삭제
        result = stmts.deleteAllTransactions.run(
          gameId,
          isPractice ? 1 : 0
        );
      }
      const deletedCount = result.changes;
      console.log(
        `[dbHelpers] clearAllTransactions 완료: ${deletedCount}개의 거래 내역 삭제됨`
      );
      return deletedCount;
    } catch (error) {
      console.error(
        '[dbHelpers] clearAllTransactions 오류:',
        error
      );
      throw error;
    }
  },

  // Hint operations
  getPlayerHints(gameId, playerId, isPractice) {
    return stmts.getPlayerHints.all(
      gameId,
      playerId,
      isPractice ? 1 : 0
    );
  },

  saveHint(
    gameId,
    playerId,
    difficulty,
    content,
    price,
    round,
    isPractice
  ) {
    const result = stmts.insertHint.run(
      gameId,
      playerId,
      difficulty,
      content,
      price,
      round,
      isPractice ? 1 : 0
    );
    return result.lastInsertRowid;
  },

  // Transaction operations
  saveTransaction(
    gameId,
    playerId,
    nickname,
    type,
    stockId,
    quantity,
    price,
    totalCost,
    totalRevenue,
    points,
    difficulty,
    hintPrice,
    round,
    adminId,
    isPractice
  ) {
    try {
      stmts.insertTransaction.run(
        gameId,
        playerId,
        nickname,
        type,
        stockId,
        quantity,
        price,
        totalCost,
        totalRevenue,
        points,
        difficulty,
        hintPrice,
        round,
        adminId || null,
        isPractice ? 1 : 0
      );
    } catch (error) {
      console.error(
        '[saveTransaction] 오류:',
        error.message
      );
      console.error('[saveTransaction] 파라미터:', {
        playerId,
        nickname,
        type,
        stockId,
        quantity,
        price,
        totalCost,
        totalRevenue,
        points,
        difficulty,
        hintPrice,
        round,
        adminId,
        isPractice,
      });
      throw error;
    }
  },

  getTransactions(gameId, limit, isPractice) {
    return stmts.getTransactions.all(
      gameId,
      isPractice ? 1 : 0,
      limit || 1000
    );
  },

  getAllTransactions(gameId, isPractice) {
    const dbTransactions = stmts.getAllTransactions.all(
      gameId,
      isPractice ? 1 : 0
    );
    // 데이터베이스 형식을 메모리 형식으로 변환
    return dbTransactions.map((t) => ({
      type: t.type,
      stockId: t.stock_id,
      quantity: t.quantity,
      price: t.price,
      totalCost: t.total_cost,
      totalRevenue: t.total_revenue,
      points: t.points,
      difficulty: t.difficulty,
      hintPrice: t.hint_price,
      round: t.round,
      timestamp: t.timestamp,
      nickname: t.nickname,
      adminId: t.admin_id || null, // 운영자 ID 추가
    }));
  },

  // Admin operations
  getAdmin(adminId) {
    return stmts.getAdminById.get(adminId);
  },

  getAllAdmins() {
    return stmts.getAllAdmins.all();
  },

  createAdmin(adminId, password) {
    const result = stmts.insertAdmin.run(adminId, password);
    return result.lastInsertRowid;
  },

  updateAdminPassword(adminId, newPassword) {
    // adminId는 숫자 ID를 의미 (admin.id)
    stmts.updateAdminPassword.run(newPassword, adminId);
  },

  deleteAdmin(adminId) {
    stmts.deleteAdmin.run(adminId);
  },

  // Round Rumors
  getRoundRumor(gameId, round) {
    return stmts.getRoundRumor.get(gameId, round);
  },

  getAllRoundRumors(gameId) {
    const results = stmts.getAllRoundRumors.all(gameId);
    return results.map((r) => ({
      round: r.round,
      rumor: r.rumor,
    }));
  },

  saveRoundRumor(gameId, round, rumor) {
    try {
      stmts.insertRoundRumor.run(gameId, round, rumor);
      return { gameId, round, rumor };
    } catch (error) {
      console.error(
        '[dbHelpers] 라운드 찌라시 저장 오류:',
        error
      );
      throw error;
    }
  },

  deleteRoundRumor(gameId, round) {
    try {
      stmts.deleteRoundRumor.run(gameId, round);
    } catch (error) {
      console.error(
        '[dbHelpers] 라운드 찌라시 삭제 오류:',
        error
      );
      throw error;
    }
  },

  // Round Hints
  getRoundHints(gameId, round) {
    return stmts.getRoundHints.all(gameId, round);
  },

  getAllRoundHints(gameId) {
    const results = stmts.getAllRoundHints.all(gameId);
    return results.map((h) => ({
      round: h.round,
      hint_content: h.hint_content,
    }));
  },

  saveRoundHints(gameId, round, hints) {
    try {
      // 기존 힌트 삭제
      stmts.deleteRoundHints.run(gameId, round);
      // 새 힌트 저장
      hints.forEach((hint, index) => {
        if (hint.trim()) {
          stmts.insertRoundHint.run(
            gameId,
            round,
            index,
            hint.trim()
          );
        }
      });
      return { gameId, round, hints };
    } catch (error) {
      console.error(
        '[dbHelpers] 라운드 힌트 저장 오류:',
        error
      );
      throw error;
    }
  },

  deleteRoundHints(gameId, round) {
    try {
      stmts.deleteRoundHints.run(gameId, round);
    } catch (error) {
      console.error(
        '[dbHelpers] 라운드 힌트 삭제 오류:',
        error
      );
      throw error;
    }
  },

  // Scenarios
  getAllScenarios(type) {
    const results = stmts.getAllScenarios.all(type);
    return results.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));
  },

  getScenarioById(id) {
    const row = stmts.getScenarioById.get(id);
    if (!row) return null;
    try {
      const data = JSON.parse(row.data_json);
      return {
        id: row.id,
        name: row.name,
        type: row.type,
        stocks: data.stocks || [],
        rounds: data.rounds || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      console.error('[dbHelpers] 시나리오 파싱 오류:', error);
      return null;
    }
  },

  saveScenario(id, name, type, stocks, rounds) {
    try {
      const dataJson = JSON.stringify({ stocks, rounds });
      if (id) {
        // 업데이트
        stmts.updateScenario.run(name, dataJson, id);
        return id;
      } else {
        // 새로 생성
        const result = stmts.insertScenario.run(name, type, dataJson);
        return result.lastInsertRowid;
      }
    } catch (error) {
      console.error('[dbHelpers] 시나리오 저장 오류:', error);
      throw error;
    }
  },

  deleteScenario(id) {
    try {
      stmts.deleteScenario.run(id);
    } catch (error) {
      console.error('[dbHelpers] 시나리오 삭제 오류:', error);
      throw error;
    }
  },
};

// 데이터베이스 종료 함수
export const closeDb = () => {
  db.close();
};

export default db;
