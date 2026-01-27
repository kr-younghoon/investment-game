import {
  PROVIDER_HINT_POOLS,
  PROVIDER_HINT_PRICES,
} from '../src/data/providerHintPools.js';

/**
 * HintService - 힌트 관리
 */
export class HintService {
  constructor(stateManager, dbHelpers) {
    this.state = stateManager;
    this.db = dbHelpers;
  }

  /**
   * Provider 힌트 직렬화
   */
  serializeProviderHint(provider, content, price) {
    return JSON.stringify({
      provider,
      content,
      price,
    });
  }

  /**
   * Provider 힌트 파싱
   */
  parseProviderHint(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && typeof parsed.content === 'string') {
          return {
            provider: parsed.provider || null,
            content: parsed.content,
            price: parsed.price !== undefined && parsed.price !== null
              ? Number(parsed.price)
              : null,
          };
        }
      } catch (_) {
        // fallthrough
      }
    }

    // 구버전 호환: 문자열을 content로 취급
    return { provider: null, content: trimmed, price: null };
  }

  /**
   * Provider별 힌트 풀 가져오기
   */
  getProviderHintPool(gameId, displayRound, provider) {
    // DB에서 먼저 확인
    try {
      const rows = this.db.getRoundHints(gameId, displayRound) || [];
      const parsed = rows
        .map((r) => this.parseProviderHint(r.hint_content))
        .filter(Boolean);
      const matches = parsed
        .filter((h) => h.provider === provider)
        .map((h) => h.content)
        .filter((c) => typeof c === 'string' && c.trim().length > 0);

      if (matches.length > 0) return matches;
    } catch (_) {
      // ignore
    }

    // 기본 제공 풀로 fallback
    const fromDefault = PROVIDER_HINT_POOLS?.[provider]?.[displayRound];
    if (Array.isArray(fromDefault)) {
      return fromDefault.filter((c) => typeof c === 'string' && c.trim().length > 0);
    }

    return [];
  }

  /**
   * 게임 시작 시 Provider 힌트 풀 초기화
   */
  seedProviderHintPoolsForGame(gameId) {
    const rounds = new Set();

    Object.keys(PROVIDER_HINT_POOLS || {}).forEach((provider) => {
      const byRound = PROVIDER_HINT_POOLS[provider] || {};
      Object.keys(byRound).forEach((r) => rounds.add(Number(r)));
    });

    rounds.forEach((round) => {
      const entries = [];

      Object.keys(PROVIDER_HINT_POOLS || {}).forEach((provider) => {
        const price = PROVIDER_HINT_PRICES?.[provider] ?? 0;
        const pool = PROVIDER_HINT_POOLS?.[provider]?.[round];

        if (!Array.isArray(pool)) return;

        pool.forEach((content) => {
          if (typeof content !== 'string' || !content.trim()) return;
          entries.push(this.serializeProviderHint(provider, content.trim(), price));
        });
      });

      if (entries.length > 0) {
        try {
          this.db.saveRoundHints(gameId, round, entries);
        } catch (e) {
          console.error('[seedProviderHintPoolsForGame] 오류:', e);
        }
      }
    });
  }

  /**
   * 플레이어에게 힌트 부여
   */
  grantHint(socketId, difficulty, content, price, round, isPractice = false) {
    const gameState = this.state.getGameState();
    const playerData = this.state.getPlayerData(socketId, isPractice);

    if (!playerData) {
      return { success: false, error: '플레이어를 찾을 수 없습니다.' };
    }

    const hint = {
      difficulty,
      content,
      price,
      round,
      receivedAt: new Date().toISOString(),
    };

    // 메모리에 추가
    if (!playerData.hints) {
      playerData.hints = [];
    }
    playerData.hints.push(hint);

    // DB 저장
    if (playerData.dbId) {
      try {
        this.db.saveHint(
          gameState.gameId || 'legacy',
          playerData.dbId,
          difficulty,
          content,
          price,
          round,
          isPractice
        );
      } catch (error) {
        console.error('[HintService] 힌트 저장 오류:', error);
      }
    }

    return { success: true, hint };
  }

  /**
   * 모든 플레이어에게 힌트 부여
   */
  grantHintToAll(difficulty, content, price, round, isPractice = false) {
    const dataMap = this.state.getPlayersData(isPractice);
    const connectedPlayers = this.state.getConnectedPlayers();
    const results = [];

    dataMap.forEach((playerData, socketId) => {
      if (connectedPlayers.has(socketId)) {
        const result = this.grantHint(socketId, difficulty, content, price, round, isPractice);
        results.push({ socketId, ...result });
      }
    });

    return results;
  }

  /**
   * 라운드 루머 저장
   */
  saveRoundRumor(gameId, round, rumor) {
    try {
      this.db.saveRoundRumor(gameId, round, rumor);
      return { success: true };
    } catch (error) {
      console.error('[HintService] 루머 저장 오류:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 라운드 힌트 저장
   */
  saveRoundHints(gameId, round, hints) {
    try {
      this.db.saveRoundHints(gameId, round, hints);
      return { success: true };
    } catch (error) {
      console.error('[HintService] 힌트 저장 오류:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 라운드 힌트 가져오기
   */
  getRoundHints(gameId, round) {
    try {
      return this.db.getRoundHints(gameId, round) || [];
    } catch (error) {
      console.error('[HintService] 힌트 조회 오류:', error);
      return [];
    }
  }

  /**
   * 랜덤 힌트 선택
   */
  getRandomHints(pool, count = 3) {
    if (!Array.isArray(pool) || pool.length === 0) return [];

    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, pool.length));
  }
}

export default HintService;
