export const EVENTS = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  CONNECT_ERROR: 'connect_error',
  RECONNECT: 'reconnect',
  RECONNECT_ATTEMPT: 'reconnect_attempt',
  RECONNECT_FAILED: 'reconnect_failed',
  GAME_STATE_UPDATE: 'GAME_STATE_UPDATE',
  ROUND_TIMER_UPDATE: 'ROUND_TIMER_UPDATE',
  ROUND_TIMER_END: 'ROUND_TIMER_END',
  ROUND_COUNTDOWN: 'ROUND_COUNTDOWN',
  DISPLAY_MESSAGE: 'DISPLAY_MESSAGE',
  CLOSE_DISPLAY_MESSAGE: 'CLOSE_DISPLAY_MESSAGE',
  GAME_END: 'GAME_END',
  GAME_RESTART: 'GAME_RESTART',
  PLAYER_REQUEST_STATE: 'PLAYER_REQUEST_STATE',
  PLAYER_JOIN: 'PLAYER_JOIN',
  PLAYER_BUY_STOCK: 'PLAYER_BUY_STOCK',
  PLAYER_SELL_STOCK: 'PLAYER_SELL_STOCK',
  PLAYER_REQUEST_TRANSACTIONS: 'PLAYER_REQUEST_TRANSACTIONS',
  PLAYER_PORTFOLIO_UPDATE: 'PLAYER_PORTFOLIO_UPDATE',
  PLAYER_HINTS_UPDATE: 'PLAYER_HINTS_UPDATE',
  PLAYER_TRADING_BLOCKED: 'PLAYER_TRADING_BLOCKED',
  MINIGAME_SUCCESS: 'MINIGAME_SUCCESS',
  PLAYER_RUMOR_UPDATE: 'PLAYER_RUMOR_UPDATE',
  PLAYER_TRANSACTIONS_UPDATE: 'PLAYER_TRANSACTIONS_UPDATE',
  BONUS_POINTS_ADDED: 'BONUS_POINTS_ADDED',
  TRANSACTION_ERROR: 'TRANSACTION_ERROR',
  TRADE_EXECUTED: 'TRADE_EXECUTED',
  PLAYER_RANK_UPDATE: 'PLAYER_RANK_UPDATE',
  PLAYER_RANK_LIST_UPDATE: 'PLAYER_RANK_LIST_UPDATE',
  NICKNAME_ERROR: 'NICKNAME_ERROR',
  NICKNAME_DUPLICATE_KICK: 'NICKNAME_DUPLICATE_KICK',
  ADMIN_KICK: 'ADMIN_KICK',
  ADMIN_DELETE: 'ADMIN_DELETE',
  ADMIN_AUTH: 'ADMIN_AUTH',
  ADMIN_AUTH_SUCCESS: 'ADMIN_AUTH_SUCCESS',
  ADMIN_AUTH_ERROR: 'ADMIN_AUTH_ERROR',
  ADMIN_LOGOUT: 'ADMIN_LOGOUT',
  ADMIN_LOGOUT_SUCCESS: 'ADMIN_LOGOUT_SUCCESS',
  ADMIN_LOGOUT_ERROR: 'ADMIN_LOGOUT_ERROR',
  ADMIN_REQUEST_STATE: 'ADMIN_REQUEST_STATE',
  ADMIN_START_GAME: 'ADMIN_START_GAME',
  ADMIN_START_PRACTICE: 'ADMIN_START_PRACTICE',
  ADMIN_START_REAL_GAME: 'ADMIN_START_REAL_GAME',
  ADMIN_NEXT_ROUND: 'ADMIN_NEXT_ROUND',
  ADMIN_PREVIOUS_ROUND: 'ADMIN_PREVIOUS_ROUND',
  ADMIN_END_GAME: 'ADMIN_END_GAME',
  ADMIN_UPDATE_SCENARIO: 'ADMIN_UPDATE_SCENARIO',
  ADMIN_ADD_POINTS: 'ADMIN_ADD_POINTS',
  ADMIN_ADD_POINTS_TO_ALL: 'ADMIN_ADD_POINTS_TO_ALL',
  ADMIN_REQUEST_PLAYER_LIST: 'ADMIN_REQUEST_PLAYER_LIST',
  ADMIN_UPDATE_GAME_SETTINGS: 'ADMIN_UPDATE_GAME_SETTINGS',
  ADMIN_REQUEST_GAME_SETTINGS: 'ADMIN_REQUEST_GAME_SETTINGS',
  ADMIN_GRANT_HINT: 'ADMIN_GRANT_HINT',
  ADMIN_GRANT_HINT_TO_ALL: 'ADMIN_GRANT_HINT_TO_ALL',
  ADMIN_EXECUTE_TRADE: 'ADMIN_EXECUTE_TRADE',
  ADMIN_KICK_PLAYER: 'ADMIN_KICK_PLAYER',
  ADMIN_DELETE_PLAYER: 'ADMIN_DELETE_PLAYER',
  ADMIN_DELETE_ALL_PLAYERS: 'ADMIN_DELETE_ALL_PLAYERS',
  ADMIN_CLEAR_ALL_TRANSACTIONS: 'ADMIN_CLEAR_ALL_TRANSACTIONS',
  ADMIN_BLOCK_TRADING: 'ADMIN_BLOCK_TRADING',
  ADMIN_UNBLOCK_TRADING: 'ADMIN_UNBLOCK_TRADING',
  ADMIN_BLOCK_TRADING_FOR_PLAYER: 'ADMIN_BLOCK_TRADING_FOR_PLAYER',
  ADMIN_UNBLOCK_TRADING_FOR_PLAYER: 'ADMIN_UNBLOCK_TRADING_FOR_PLAYER',
  ADMIN_GET_ADMINS: 'ADMIN_GET_ADMINS',
  ADMIN_CREATE_ADMIN: 'ADMIN_CREATE_ADMIN',
  ADMIN_UPDATE_ADMIN_PASSWORD: 'ADMIN_UPDATE_ADMIN_PASSWORD',
  ADMIN_DELETE_ADMIN: 'ADMIN_DELETE_ADMIN',
  ADMIN_BROADCAST_MESSAGE: 'ADMIN_BROADCAST_MESSAGE',
  ADMIN_CLOSE_MESSAGE: 'ADMIN_CLOSE_MESSAGE',
  ADMIN_TOGGLE_PLAYER_TRADING: 'ADMIN_TOGGLE_PLAYER_TRADING',
  ADMIN_SAVE_ROUND_RUMOR: 'ADMIN_SAVE_ROUND_RUMOR',
  ADMIN_SAVE_ROUND_HINTS: 'ADMIN_SAVE_ROUND_HINTS',
  ADMIN_REQUEST_ROUND_SCENARIOS: 'ADMIN_REQUEST_ROUND_SCENARIOS',
  ADMIN_BROADCAST_RUMOR: 'ADMIN_BROADCAST_RUMOR',
  ADMIN_BROADCAST_RANDOM_HINTS: 'ADMIN_BROADCAST_RANDOM_HINTS',
  ADMIN_SAVE_PROVIDER_ROUND_HINTS: 'ADMIN_SAVE_PROVIDER_ROUND_HINTS',
  HINT_BROADCAST_ERROR: 'HINT_BROADCAST_ERROR',
  HINT_GRANT_ERROR: 'HINT_GRANT_ERROR',
  // 시나리오 관리
  ADMIN_GET_SCENARIOS: 'ADMIN_GET_SCENARIOS',
  ADMIN_SAVE_SCENARIO: 'ADMIN_SAVE_SCENARIO',
  ADMIN_DELETE_SCENARIO: 'ADMIN_DELETE_SCENARIO',
  ADMIN_START_GAME_WITH_SCENARIO: 'ADMIN_START_GAME_WITH_SCENARIO',
  SCENARIOS_LIST_UPDATE: 'SCENARIOS_LIST_UPDATE',
  SCENARIO_SAVED: 'SCENARIO_SAVED',
  SCENARIO_DELETED: 'SCENARIO_DELETED',
  PLAYER_COUNT_UPDATE: 'PLAYER_COUNT_UPDATE',
  PLAYER_LIST_UPDATE: 'PLAYER_LIST_UPDATE',
  TRANSACTION_LOG_UPDATE: 'TRANSACTION_LOG_UPDATE',
  TRANSACTION_LOGS_INIT: 'TRANSACTION_LOGS_INIT',
  GAME_SETTINGS_UPDATE: 'GAME_SETTINGS_UPDATE',
  ADMIN_ERROR: 'ADMIN_ERROR',
  ADMIN_ACTION_SUCCESS: 'ADMIN_ACTION_SUCCESS',
  ADMINS_LIST_UPDATE: 'ADMINS_LIST_UPDATE',
};

export const DEFAULT_GAME_STATE = {
  currentRound: 0,
  stockPrices: {},
  currentNews: '',
  currentNewsBriefing: [],
  isGameStarted: false,
  isPracticeMode: false,
  isWaitingMode: true,
  isGameEnded: false,
  priceHistory: {},
  portfolio: null,
  countdown: null,
  roundTimer: null,
  allowPlayerTrading: false,
  isTradingBlocked: false,
  isPlayerTradingBlocked: false,
  blockedRewardAmount: null,
  isLastRound: false,
  customStocks: null,
  totalRounds: 12,
};

export const DEFAULT_GAME_SETTINGS = {
  initialCash: 3000000,
  totalRounds: 12,
};

const GAME_STATE_KEYS = [
  'currentRound',
  'stockPrices',
  'currentNews',
  'currentNewsBriefing',
  'isGameStarted',
  'isPracticeMode',
  'isWaitingMode',
  'isGameEnded',
  'priceHistory',
  'countdown',
  'roundTimer',
  'allowPlayerTrading',
  'isTradingBlocked',
  'isLastRound',
  'customStocks',
  'totalRounds',
];

export function applyGameStateUpdate(previous, patch) {
  const next = { ...previous };
  if (!patch || typeof patch !== 'object') {
    return next;
  }

  if (Number.isInteger(patch.currentRound)) {
    next.currentRound = patch.currentRound;
  }
  if (patch.stockPrices && typeof patch.stockPrices === 'object') {
    next.stockPrices = patch.stockPrices;
  }
  if (typeof patch.currentNews === 'string') {
    next.currentNews = patch.currentNews;
  }
  if (Array.isArray(patch.currentNewsBriefing)) {
    next.currentNewsBriefing = patch.currentNewsBriefing;
  }
  if (typeof patch.isGameStarted === 'boolean') {
    next.isGameStarted = patch.isGameStarted;
  }
  if (typeof patch.isPracticeMode === 'boolean') {
    next.isPracticeMode = patch.isPracticeMode;
  }
  if (typeof patch.isWaitingMode === 'boolean') {
    next.isWaitingMode = patch.isWaitingMode;
  }
  if (typeof patch.isGameEnded === 'boolean') {
    next.isGameEnded = patch.isGameEnded;
  }
  if (patch.priceHistory && typeof patch.priceHistory === 'object') {
    next.priceHistory = patch.priceHistory;
  }
  if (patch.countdown !== undefined) {
    next.countdown = patch.countdown;
  }
  if (patch.roundTimer !== undefined) {
    next.roundTimer = patch.roundTimer;
  }
  if (typeof patch.allowPlayerTrading === 'boolean') {
    next.allowPlayerTrading = patch.allowPlayerTrading;
  }
  if (typeof patch.isTradingBlocked === 'boolean') {
    next.isTradingBlocked = patch.isTradingBlocked;
  }
  if (typeof patch.isLastRound === 'boolean') {
    next.isLastRound = patch.isLastRound;
  }
  if (typeof patch.isPlayerTradingBlocked === 'boolean') {
    next.isPlayerTradingBlocked = patch.isPlayerTradingBlocked;
  }
  if (patch.blockedRewardAmount !== undefined) {
    next.blockedRewardAmount = patch.blockedRewardAmount;
  }
  if (patch.customStocks !== undefined) {
    next.customStocks = patch.customStocks;
  }
  if (Number.isInteger(patch.totalRounds) && patch.totalRounds > 0) {
    next.totalRounds = patch.totalRounds;
  }

  return next;
}

export function createGameStatePayload(source) {
  const payload = {};
  if (!source || typeof source !== 'object') {
    return payload;
  }
  GAME_STATE_KEYS.forEach((key) => {
    if (source[key] !== undefined) {
      payload[key] = source[key];
    }
  });
  if (Array.isArray(source.rankList)) {
    payload.rankList = source.rankList;
  }
  if (typeof source.playerCount === 'number') {
    payload.playerCount = source.playerCount;
  }
  return payload;
}

export function normalizePlayerListPayload(payload) {
  if (Array.isArray(payload)) {
    return { players: payload, connectedAdmins: [] };
  }
  if (payload && typeof payload === 'object') {
    return {
      players: Array.isArray(payload.players) ? payload.players : [],
      connectedAdmins: Array.isArray(payload.connectedAdmins)
        ? payload.connectedAdmins
        : [],
    };
  }
  return { players: [], connectedAdmins: [] };
}
