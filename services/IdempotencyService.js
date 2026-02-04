/**
 * IdempotencyService - 거래 중복 방지 서비스
 * requestId 기반으로 중복 요청을 감지하고 캐시된 결과를 반환합니다.
 */
export class IdempotencyService {
  constructor(ttlMs = 60000) {
    this.ttlMs = ttlMs;
    this.cache = new Map(); // Map<requestId, { result, timestamp }>
    this._cleanupInterval = setInterval(() => this._cleanup(), 30000);
  }

  getProcessedResult(requestId) {
    if (!requestId) return null;
    const entry = this.cache.get(requestId);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(requestId);
      return null;
    }
    return entry.result;
  }

  storeResult(requestId, result) {
    if (!requestId) return;
    this.cache.set(requestId, { result, timestamp: Date.now() });
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }

  destroy() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
      this._cleanupInterval = null;
    }
    this.cache.clear();
  }
}

export default IdempotencyService;
