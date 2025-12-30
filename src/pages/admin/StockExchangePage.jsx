import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/Toast';
import { STOCKS } from '../../data/initialScenarios';

export default function StockExchangePage({
  gameState,
  transactionLogs,
  playerList,
  adminActions,
  setAdminErrorCallback,
}) {
  const { toasts, removeToast, success, error } =
    useToast();

  // 관리자 에러 콜백 설정
  useEffect(() => {
    if (setAdminErrorCallback) {
      setAdminErrorCallback((errorMessage) => {
        error('오류', errorMessage, 3000);
      });
    }
  }, [setAdminErrorCallback, error]);
  const [activeTab, setActiveTab] = useState('trade'); // 'trade' or 'logs'
  const [selectedPlayerId, setSelectedPlayerId] =
    useState('');
  const [selectedStockId, setSelectedStockId] =
    useState('');
  const [tradeType, setTradeType] = useState('BUY'); // 'BUY' or 'SELL'
  const [quantity, setQuantity] = useState('');

  // 주식 거래 로그만 필터링 (매수/매도)
  const stockLogs = transactionLogs.filter(
    (log) => log.type === 'BUY' || log.type === 'SELL'
  );

  // 주식 이름 가져오기
  const getStockName = (stockId) => {
    const stock = STOCKS.find((s) => s.id === stockId);
    return stock ? stock.name : stockId;
  };

  // 현재 가격 가져오기
  const getCurrentPrice = (stockId) => {
    return (
      gameState.stockPrices[stockId]?.[
        gameState.currentRound
      ] ||
      STOCKS.find((s) => s.id === stockId)?.basePrice ||
      0
    );
  };

  // 선택된 플레이어 정보
  const selectedPlayer = playerList.find(
    (p) => p.socketId === selectedPlayerId
  );

  // 선택된 주식 정보
  const selectedStock = STOCKS.find(
    (s) => s.id === selectedStockId
  );

  // 최대 매수 가능 수량 계산
  const calculateMaxBuyable = () => {
    if (!selectedPlayer || !selectedStockId) return 0;
    const price = getCurrentPrice(selectedStockId);
    if (price === 0) return 0;
    return Math.floor(selectedPlayer.cash / price);
  };

  // 보유 주식 수량
  const getHeldQuantity = () => {
    if (!selectedPlayer || !selectedStockId) return 0;
    return selectedPlayer.stocks?.[selectedStockId] || 0;
  };

  // 거래 실행
  const handleExecuteTrade = () => {
    if (!gameState.isGameStarted) {
      error(
        '오류',
        '게임이 시작되지 않았습니다. 게임을 시작한 후 거래를 실행할 수 있습니다.',
        3000
      );
      return;
    }

    if (!selectedPlayerId) {
      error('오류', '플레이어를 선택해주세요.', 2000);
      return;
    }

    if (!selectedStockId) {
      error('오류', '주식을 선택해주세요.', 2000);
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      error('오류', '올바른 수량을 입력해주세요.', 2000);
      return;
    }

    if (tradeType === 'BUY') {
      const maxBuyable = calculateMaxBuyable();
      if (qty > maxBuyable) {
        error(
          '오류',
          `최대 ${maxBuyable}주까지 매수 가능합니다.`,
          2000
        );
        return;
      }
    } else {
      const heldQty = getHeldQuantity();
      if (qty > heldQty) {
        error(
          '오류',
          `보유 주식이 부족합니다. (보유: ${heldQty}주)`,
          2000
        );
        return;
      }
    }

    if (adminActions && adminActions.executeTrade) {
      adminActions.executeTrade(
        selectedPlayerId,
        tradeType,
        selectedStockId,
        qty
      );
      const stockName = getStockName(selectedStockId);
      const action = tradeType === 'BUY' ? '매수' : '매도';
      success(
        '거래 실행',
        `${selectedPlayer?.nickname}님의 ${stockName} ${qty}주 ${action}를 실행했습니다.`,
        3000
      );
      setQuantity('');
    } else {
      error(
        '오류',
        '거래 실행 기능을 사용할 수 없습니다.',
        2000
      );
    }
  };

  // 예상 금액 계산
  const calculateEstimatedAmount = () => {
    if (!selectedStockId || !quantity) return 0;
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) return 0;
    const price = getCurrentPrice(selectedStockId);
    return price * qty;
  };

  return (
    <div className="min-h-screen p-2 sm:p-4 pb-20 sm:pb-24 relative">
      {/* 배경 효과 */}
      <div className="fixed inset-0 bg-white -z-10"></div>

      {/* 헤더 */}
      <div className="text-center mb-6 sm:mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl sm:text-2xl md:text-3xl font-black mb-3 text-gray-900"
        >
          📈 주식 거래소
        </motion.h1>
        <div className="text-sm sm:text-base text-gray-600">
          라운드 {gameState.currentRound + 1}
        </div>
      </div>

      {/* 탭 메뉴 */}
      <div className="flex gap-2 mb-6 sm:mb-8 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('trade')}
          className={`px-4 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all border-b-2 ${
            activeTab === 'trade'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-2" />
          거래 실행
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-4 py-2 sm:py-3 text-sm sm:text-base font-semibold transition-all border-b-2 ${
            activeTab === 'logs'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 inline-block mr-2" />
          거래 로그 ({stockLogs.length})
        </button>
      </div>

      {/* 탭 내용 */}
      <AnimatePresence mode="wait">
        {/* 거래 실행 탭 */}
        {activeTab === 'trade' && (
          <motion.div
            key="trade"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="card-modern p-3 sm:p-4 mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">
                거래 실행
              </h2>

              {/* 플레이어 선택 */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  플레이어 선택
                </label>
                <select
                  value={selectedPlayerId}
                  onChange={(e) =>
                    setSelectedPlayerId(e.target.value)
                  }
                  className="input-modern w-full"
                >
                  <option value="">
                    플레이어를 선택하세요
                  </option>
                  {playerList.map((player) => (
                    <option
                      key={player.socketId}
                      value={player.socketId}
                    >
                      {player.nickname} (현금: ₩
                      {player.cash.toLocaleString('ko-KR')},
                      총 자산: ₩
                      {player.totalAsset?.toLocaleString(
                        'ko-KR'
                      ) || 0}
                      )
                    </option>
                  ))}
                </select>
                {selectedPlayer && (
                  <div className="mt-2 text-xs text-gray-600">
                    <div>
                      현금: ₩
                      {selectedPlayer.cash.toLocaleString(
                        'ko-KR'
                      )}
                    </div>
                    <div>
                      총 자산: ₩
                      {selectedPlayer.totalAsset?.toLocaleString(
                        'ko-KR'
                      ) || 0}
                    </div>
                  </div>
                )}
              </div>

              {/* 거래 유형 선택 */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  거래 유형
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTradeType('BUY')}
                    className={`flex-1 px-4 py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                      tradeType === 'BUY'
                        ? 'bg-green-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <TrendingUp className="w-5 h-5" />
                    매수
                  </button>
                  <button
                    onClick={() => setTradeType('SELL')}
                    className={`flex-1 px-4 py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                      tradeType === 'SELL'
                        ? 'bg-red-500 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <TrendingDown className="w-5 h-5" />
                    매도
                  </button>
                </div>
              </div>

              {/* 주식 선택 */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  주식 선택
                </label>
                <select
                  value={selectedStockId}
                  onChange={(e) =>
                    setSelectedStockId(e.target.value)
                  }
                  className="input-modern w-full"
                >
                  <option value="">
                    주식을 선택하세요
                  </option>
                  {STOCKS.map((stock) => {
                    const price = getCurrentPrice(stock.id);
                    return (
                      <option
                        key={stock.id}
                        value={stock.id}
                      >
                        {stock.name} (₩{price.toFixed(2)})
                      </option>
                    );
                  })}
                </select>
                {selectedStock && selectedPlayer && (
                  <div className="mt-2 text-xs text-gray-600">
                    <div>
                      현재가: ₩
                      {getCurrentPrice(
                        selectedStockId
                      ).toFixed(2)}
                    </div>
                    {tradeType === 'BUY' && (
                      <div>
                        최대 매수 가능:{' '}
                        {calculateMaxBuyable()}주
                      </div>
                    )}
                    {tradeType === 'SELL' && (
                      <div>
                        보유 주식: {getHeldQuantity()}주
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 수량 입력 */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  수량
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(e.target.value)
                  }
                  min="1"
                  step="1"
                  placeholder="수량을 입력하세요"
                  className="input-modern w-full"
                />
                {quantity && selectedStockId && (
                  <div className="mt-2 text-xs text-gray-600">
                    예상 금액: ₩
                    {calculateEstimatedAmount().toLocaleString(
                      'ko-KR',
                      { maximumFractionDigits: 0 }
                    )}
                  </div>
                )}
              </div>

              {/* 게임 시작 안내 */}
              {!gameState.isGameStarted && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-yellow-800">
                    ⚠️ 게임이 시작되지 않았습니다. 게임을
                    시작한 후 거래를 실행할 수 있습니다.
                  </p>
                </div>
              )}

              {/* 거래 실행 버튼 */}
              <button
                onClick={handleExecuteTrade}
                disabled={
                  !gameState.isGameStarted ||
                  !selectedPlayerId ||
                  !selectedStockId ||
                  !quantity
                }
                className={`w-full px-4 py-3 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                  tradeType === 'BUY'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-300 disabled:to-gray-400 text-white'
                    : 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 disabled:from-gray-300 disabled:to-gray-400 text-white'
                }`}
              >
                {tradeType === 'BUY' ? (
                  <>
                    <TrendingUp className="w-5 h-5" />
                    매수 실행
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-5 h-5" />
                    매도 실행
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* 거래 로그 탭 */}
        {activeTab === 'logs' && (
          <motion.div
            key="logs"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="card-modern p-3 sm:p-4 mb-6 sm:mb-8"
          >
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">
              거래 로그 ({stockLogs.length}건)
            </h2>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full min-w-[600px] sm:min-w-0">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b-2 border-gray-300">
                    <th className="text-left py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      시간
                    </th>
                    <th className="text-left py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      플레이어
                    </th>
                    <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      유형
                    </th>
                    <th className="text-left py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      주식
                    </th>
                    <th className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      수량
                    </th>
                    <th className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      가격
                    </th>
                    <th className="text-right py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      금액
                    </th>
                    <th className="text-center py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-600">
                      라운드
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stockLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan="8"
                        className="py-8 text-center text-gray-500 text-sm"
                      >
                        아직 거래 로그가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    [...stockLogs]
                      .reverse()
                      .map((log, index) => {
                        const date = new Date(
                          log.timestamp
                        );
                        const timeStr = `${date
                          .getHours()
                          .toString()
                          .padStart(2, '0')}:${date
                          .getMinutes()
                          .toString()
                          .padStart(2, '0')}:${date
                          .getSeconds()
                          .toString()
                          .padStart(2, '0')}`;
                        const isBuy = log.type === 'BUY';
                        const amount = isBuy
                          ? log.totalCost
                          : log.totalRevenue;

                        return (
                          <tr
                            key={index}
                            className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            <td className="py-2 px-2 sm:px-4 text-xs text-gray-600">
                              {timeStr}
                            </td>
                            <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm font-semibold text-gray-900">
                              {log.nickname}
                            </td>
                            <td className="py-2 px-2 sm:px-4 text-center">
                              <div
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                                  isBuy
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {isBuy ? (
                                  <TrendingUp className="w-3 h-3" />
                                ) : (
                                  <TrendingDown className="w-3 h-3" />
                                )}
                                {isBuy ? '매수' : '매도'}
                              </div>
                            </td>
                            <td className="py-2 px-2 sm:px-4 text-xs sm:text-sm text-gray-900">
                              {getStockName(log.stockId)}
                            </td>
                            <td className="py-2 px-2 sm:px-4 text-right text-xs sm:text-sm text-gray-700">
                              {log.quantity}주
                            </td>
                            <td className="py-2 px-2 sm:px-4 text-right text-xs sm:text-sm text-gray-700">
                              ₩{log.price.toFixed(2)}
                            </td>
                            <td
                              className={`py-2 px-2 sm:px-4 text-right text-xs sm:text-sm font-bold ${
                                isBuy
                                  ? 'text-green-600'
                                  : 'text-red-600'
                              }`}
                            >
                              {isBuy ? '-' : '+'}₩
                              {amount.toLocaleString(
                                'ko-KR',
                                { maximumFractionDigits: 0 }
                              )}
                            </td>
                            <td className="py-2 px-2 sm:px-4 text-center text-xs text-gray-600">
                              {log.round + 1}
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast 알림 */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
