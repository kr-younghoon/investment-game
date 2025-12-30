import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 데이터베이스 파일 경로
const dbPath = join(__dirname, 'game_data.db');

// 데이터베이스 연결
const db = new Database(dbPath);

// 테이블 생성
db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    socket_id TEXT UNIQUE NOT NULL,
    nickname TEXT NOT NULL,
    cash REAL DEFAULT 10000,
    bonus_points REAL DEFAULT 0,
    total_asset REAL DEFAULT 10000,
    is_practice BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS player_stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    stock_id TEXT NOT NULL,
    quantity INTEGER DEFAULT 0,
    is_practice BOOLEAN DEFAULT 0,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE(player_id, stock_id, is_practice)
  );

  CREATE TABLE IF NOT EXISTS player_hints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    difficulty TEXT NOT NULL,
    content TEXT,
    price REAL NOT NULL,
    round INTEGER NOT NULL,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_practice BOOLEAN DEFAULT 0,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    FOREIGN KEY (admin_id) REFERENCES admins(id)
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_id TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_players_socket ON players(socket_id);
  CREATE INDEX IF NOT EXISTS idx_players_nickname ON players(nickname);
  CREATE INDEX IF NOT EXISTS idx_transactions_player ON transactions(player_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
  CREATE INDEX IF NOT EXISTS idx_hints_player ON player_hints(player_id);
  CREATE INDEX IF NOT EXISTS idx_admins_id ON admins(admin_id);
`);

// 기존 테이블에 admin_id 컬럼 추가 (마이그레이션)
try {
  db.exec(`
    ALTER TABLE transactions ADD COLUMN admin_id INTEGER;
  `);
  console.log('transactions 테이블에 admin_id 컬럼 추가 완료');
} catch (error) {
  // 컬럼이 이미 존재하는 경우 무시
  if (!error.message.includes('duplicate column name')) {
    console.error('admin_id 컬럼 추가 중 오류:', error.message);
  }
}

// admin_id에 대한 인덱스 추가 (이미 존재하면 무시)
try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_transactions_admin ON transactions(admin_id);
  `);
} catch (error) {
  // 인덱스가 이미 존재하는 경우 무시
  if (!error.message.includes('already exists')) {
    console.error('admin_id 인덱스 생성 중 오류:', error.message);
  }
}

// 기본 운영자 계정 생성
const defaultAdminId = '이영훈';
const defaultPassword = '01087596957';
const checkDefaultAdmin = db.prepare('SELECT * FROM admins WHERE admin_id = ?');
const insertDefaultAdmin = db.prepare(`
  INSERT OR IGNORE INTO admins (admin_id, password)
  VALUES (?, ?)
`);

const existingAdmin = checkDefaultAdmin.get(defaultAdminId);
if (!existingAdmin) {
  insertDefaultAdmin.run(defaultAdminId, defaultPassword);
  console.log('기본 운영자 계정 생성 완료:', defaultAdminId);
}

// Prepared statements
const stmts = {
  // Players
  getPlayerBySocketId: db.prepare('SELECT * FROM players WHERE socket_id = ? AND is_practice = ?'),
  getPlayerByNickname: db.prepare('SELECT * FROM players WHERE nickname = ? AND is_practice = ?'),
  getPlayerById: db.prepare('SELECT * FROM players WHERE id = ?'),
  insertPlayer: db.prepare(`
    INSERT OR IGNORE INTO players (socket_id, nickname, cash, bonus_points, total_asset, is_practice)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  updatePlayerSocketId: db.prepare(`
    UPDATE players SET socket_id = ?, updated_at = CURRENT_TIMESTAMP WHERE nickname = ? AND is_practice = ?
  `),
  // 다른 플레이어의 socket_id를 임시 값으로 변경 (UNIQUE 제약조건 회피)
  clearPlayerSocketId: db.prepare(`
    UPDATE players SET socket_id = ?, updated_at = CURRENT_TIMESTAMP 
    WHERE socket_id = ? AND is_practice = ? AND id != ?
  `),
  updatePlayerCash: db.prepare('UPDATE players SET cash = ?, total_asset = ?, updated_at = CURRENT_TIMESTAMP WHERE socket_id = ? AND is_practice = ?'),
  updatePlayerCashById: db.prepare('UPDATE players SET cash = ?, total_asset = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND is_practice = ?'),
  updatePlayerAsset: db.prepare('UPDATE players SET total_asset = ?, updated_at = CURRENT_TIMESTAMP WHERE socket_id = ? AND is_practice = ?'),
  deletePlayer: db.prepare('DELETE FROM players WHERE id = ? AND is_practice = ?'),
  
  // Stocks
  getPlayerStocks: db.prepare('SELECT * FROM player_stocks WHERE player_id = ? AND is_practice = ?'),
  upsertPlayerStock: db.prepare(`
    INSERT INTO player_stocks (player_id, stock_id, quantity, is_practice)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(player_id, stock_id, is_practice) DO UPDATE SET
      quantity = excluded.quantity
  `),
  deletePlayerStocks: db.prepare('DELETE FROM player_stocks WHERE player_id = ? AND is_practice = ?'),
  
  // Hints
  getPlayerHints: db.prepare('SELECT * FROM player_hints WHERE player_id = ? AND is_practice = ? ORDER BY received_at DESC'),
  insertHint: db.prepare(`
    INSERT INTO player_hints (player_id, difficulty, content, price, round, is_practice)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  
  // Transactions
  insertTransaction: db.prepare(`
    INSERT INTO transactions (player_id, nickname, type, stock_id, quantity, price, total_cost, total_revenue, points, difficulty, hint_price, round, admin_id, is_practice)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getTransactions: db.prepare('SELECT * FROM transactions WHERE is_practice = ? ORDER BY timestamp DESC LIMIT ?'),
  getAllTransactions: db.prepare('SELECT * FROM transactions WHERE is_practice = ? ORDER BY timestamp DESC'),
  
  // Admins
  getAdminById: db.prepare('SELECT * FROM admins WHERE admin_id = ?'),
  getAllAdmins: db.prepare('SELECT id, admin_id, created_at, updated_at FROM admins ORDER BY created_at DESC'),
  insertAdmin: db.prepare('INSERT INTO admins (admin_id, password) VALUES (?, ?)'),
  updateAdminPassword: db.prepare('UPDATE admins SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  deleteAdmin: db.prepare('DELETE FROM admins WHERE id = ?'),
};

// Helper functions
export const dbHelpers = {
  // Player operations
  getPlayer(socketId, isPractice) {
    return stmts.getPlayerBySocketId.get(socketId, isPractice ? 1 : 0);
  },
  
  getPlayerByNickname(nickname, isPractice) {
    return stmts.getPlayerByNickname.get(nickname, isPractice ? 1 : 0);
  },
  
  savePlayer(socketId, nickname, cash, bonusPoints, totalAsset, isPractice) {
    // 먼저 플레이어가 있는지 확인
    let player = stmts.getPlayerByNickname.get(nickname, isPractice ? 1 : 0);
    
    if (player) {
      // 기존 플레이어의 socket_id 업데이트
      // 먼저 이 socket_id가 다른 플레이어에게 할당되어 있는지 확인하고 해제
      const existingPlayerWithSocket = stmts.getPlayerBySocketId.get(socketId, isPractice ? 1 : 0);
      if (existingPlayerWithSocket && existingPlayerWithSocket.id !== player.id) {
        // 다른 플레이어가 이 socket_id를 사용 중이면 임시 값으로 변경
        // 임시 값: 'temp_' + timestamp + '_' + 기존 플레이어 ID
        const tempSocketId = `temp_${Date.now()}_${existingPlayerWithSocket.id}`;
        stmts.clearPlayerSocketId.run(tempSocketId, socketId, isPractice ? 1 : 0, player.id);
      }
      // 기존 플레이어의 socket_id 업데이트
      stmts.updatePlayerSocketId.run(socketId, nickname, isPractice ? 1 : 0);
      const updatedPlayer = stmts.getPlayerByNickname.get(nickname, isPractice ? 1 : 0);
      // 기존 플레이어임을 표시하기 위해 isNew 플래그 추가
      return { ...updatedPlayer, _isNew: false };
    } else {
      // 새 플레이어 생성 전에 이 socket_id가 이미 사용 중인지 확인
      const existingPlayerWithSocket = stmts.getPlayerBySocketId.get(socketId, isPractice ? 1 : 0);
      if (existingPlayerWithSocket) {
        // 이미 이 socket_id를 사용하는 플레이어가 있으면 임시 값으로 변경
        const tempSocketId = `temp_${Date.now()}_${existingPlayerWithSocket.id}`;
        stmts.clearPlayerSocketId.run(tempSocketId, socketId, isPractice ? 1 : 0, -1); // -1은 모든 ID와 매칭되지 않도록
      }
      // 새 플레이어 생성
      const result = stmts.insertPlayer.run(
        socketId,
        nickname,
        cash,
        bonusPoints,
        totalAsset,
        isPractice ? 1 : 0
      );
      // 새로 생성된 플레이어를 socketId로 가져오기
      const newPlayer = stmts.getPlayerBySocketId.get(socketId, isPractice ? 1 : 0);
      // 새 플레이어임을 표시하기 위해 isNew 플래그 추가
      return { ...newPlayer, _isNew: true };
    }
  },
  
  updatePlayerCash(socketId, cash, totalAsset, isPractice) {
    stmts.updatePlayerCash.run(cash, totalAsset, socketId, isPractice ? 1 : 0);
  },
  
  updatePlayerCashById(playerId, cash, totalAsset, isPractice) {
    stmts.updatePlayerCashById.run(cash, totalAsset, playerId, isPractice ? 1 : 0);
  },
  
  updatePlayerAsset(socketId, totalAsset, isPractice) {
    stmts.updatePlayerAsset.run(totalAsset, socketId, isPractice ? 1 : 0);
  },
  
  // Stock operations
  getPlayerStocks(playerId, isPractice) {
    return stmts.getPlayerStocks.all(playerId, isPractice ? 1 : 0);
  },
  
  savePlayerStock(playerId, stockId, quantity, isPractice) {
    stmts.upsertPlayerStock.run(playerId, stockId, quantity, isPractice ? 1 : 0);
  },
  
  clearPlayerStocks(playerId, isPractice) {
    stmts.deletePlayerStocks.run(playerId, isPractice ? 1 : 0);
  },
  
  deletePlayer(playerId, isPractice) {
    // CASCADE로 인해 관련된 player_stocks, player_hints, transactions도 자동 삭제됨
    stmts.deletePlayer.run(playerId, isPractice ? 1 : 0);
  },
  
  // Hint operations
  getPlayerHints(playerId, isPractice) {
    return stmts.getPlayerHints.all(playerId, isPractice ? 1 : 0);
  },
  
  saveHint(playerId, difficulty, content, price, round, isPractice) {
    const result = stmts.insertHint.run(
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
  saveTransaction(playerId, nickname, type, stockId, quantity, price, totalCost, totalRevenue, points, difficulty, hintPrice, round, adminId, isPractice) {
    stmts.insertTransaction.run(
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
  },
  
  getTransactions(limit, isPractice) {
    return stmts.getTransactions.all(isPractice ? 1 : 0, limit || 1000);
  },
  
  getAllTransactions(isPractice) {
    const dbTransactions = stmts.getAllTransactions.all(isPractice ? 1 : 0);
    // 데이터베이스 형식을 메모리 형식으로 변환
    return dbTransactions.map(t => ({
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
};

// 데이터베이스 종료 함수
export const closeDb = () => {
  db.close();
};

export default db;

