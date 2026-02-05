import { STOCKS, PRACTICE_STOCKS } from '../src/data/initialScenarios.js';

/**
 * 현재 게임에서 사용 중인 주식 목록 반환
 * customStocks가 있으면 커스텀 주식, 없으면 기본/연습 주식 사용
 *
 * @param {object} gameState - 게임 상태 객체 (customStocks, isPracticeMode 포함)
 * @param {boolean} [isPractice] - 연습 모드 여부 (명시적으로 전달 시 gameState.isPracticeMode보다 우선)
 * @returns {Array} 주식 목록
 */
export function getActiveStocks(gameState, isPractice) {
  if (gameState.customStocks && gameState.customStocks.length > 0) {
    return gameState.customStocks;
  }
  const practice = isPractice !== undefined ? isPractice : gameState.isPracticeMode;
  return practice ? PRACTICE_STOCKS : STOCKS;
}
