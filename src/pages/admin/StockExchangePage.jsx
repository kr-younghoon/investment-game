import { useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/Toast';
import {
  STOCKS,
  PRACTICE_STOCKS,
  initialScenarios,
} from '../../data/initialScenarios';

export default function StockExchangePage({
  gameState,
  transactionLogs,
  playerList,
  adminActions,
  setAdminErrorCallback,
  playerCount,
}) {
  const { toasts, removeToast, success, error } =
    useToast();
  const [selectedPlayerId, setSelectedPlayerId] =
    useState('');
  const [selectedStockId, setSelectedStockId] =
    useState('');
  const [tradeType, setTradeType] = useState('BUY'); // 'BUY' or 'SELL'
  const [quantity, setQuantity] = useState('');

  // 현재 주식 목록 (연습 모드 여부에 따라)
  const currentStocks = gameState.isPracticeMode
    ? PRACTICE_STOCKS
    : STOCKS;

  // 현재 주식 가격 가져오기
  const getCurrentPrice = (stockId) => {
    if (
      !gameState.stockPrices ||
      !gameState.stockPrices[stockId]
    ) {
      return null;
    }
    return gameState.stockPrices[stockId];
  };

  // 최대 라운드 계산
  const maxRounds = gameState.isPracticeMode
    ? 4
    : initialScenarios.length + 1;

  // 선택된 플레이어 정보
  const selectedPlayer = playerList.find(
    (p) => p.socketId === selectedPlayerId
  );

  // 선택된 플레이어의 보유 주식 수
  const getPlayerStockQuantity = (stockId) => {
    if (!selectedPlayer || !selectedPlayer.stocks) {
      return 0;
    }
    return selectedPlayer.stocks[stockId] || 0;
  };

  // 거래 실행
  const handleExecuteTrade = () => {
    if (!selectedPlayerId) {
      error('오류', '플레이어를 선택해주세요.', 3000);
      return;
    }

    if (!selectedStockId) {
      error('오류', '주식을 선택해주세요.', 3000);
      return;
    }

    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      error('오류', '올바른 수량을 입력해주세요.', 3000);
      return;
    }

    const currentPrice = getCurrentPrice(selectedStockId);
    if (!currentPrice) {
      error(
        '오류',
        '주식 가격을 가져올 수 없습니다.',
        3000
      );
      return;
    }

    // 매도 시 보유 주식 수 확인
    if (tradeType === 'SELL') {
      const ownedQuantity =
        getPlayerStockQuantity(selectedStockId);
      if (ownedQuantity < qty) {
        error(
          '오류',
          `보유 주식 수가 부족합니다. (보유: ${ownedQuantity}주)`,
          3000
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

      const stock = currentStocks.find(
        (s) => s.id === selectedStockId
      );
      const stockName = stock
        ? stock.name
        : selectedStockId;
      const totalCost = currentPrice * qty;

      success(
        '거래 요청',
        `${
          selectedPlayer?.nickname || '플레이어'
        }님의 ${stockName} ${qty}주 ${
          tradeType === 'BUY' ? '매수' : '매도'
        } 요청이 전송되었습니다.`,
        3000
      );

      // 입력 필드 초기화
      setQuantity('');
    }
  };

  return (
    <div className="p-2 sm:p-4 pb-20 sm:pb-24 relative">

      {/* 거래 폼 */}
      <div className="card-modern p-4 sm:p-6 mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
          플레이어 대신 거래 실행
        </h2>

        <div className="space-y-4">
          {/* 플레이어 선택 */}
          <div>
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
              {playerList
                .filter((p) => p.isOnline === true)
                .map((player) => (
                  <option
                    key={player.socketId}
                    value={player.socketId}
                  >
                    {player.nickname} (₩
                    {player.totalAsset?.toLocaleString(
                      'ko-KR',
                      {
                        maximumFractionDigits: 0,
                      }
                    ) || 0}
                    )
                  </option>
                ))}
            </select>
          </div>

          {/* 거래 유형 선택 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              거래 유형
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setTradeType('BUY')}
                className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all ${
                  tradeType === 'BUY'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <ArrowUp className="w-4 h-4 inline-block mr-1" />
                매수
              </button>
              <button
                onClick={() => setTradeType('SELL')}
                className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-all ${
                  tradeType === 'SELL'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <ArrowDown className="w-4 h-4 inline-block mr-1" />
                매도
              </button>
            </div>
          </div>

          {/* 주식 선택 */}
          <div>
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
              <option value="">주식을 선택하세요</option>
              {currentStocks.map((stock) => {
                const price = getCurrentPrice(stock.id);
                const ownedQuantity =
                  getPlayerStockQuantity(stock.id);
                return (
                  <option key={stock.id} value={stock.id}>
                    {stock.name}
                    {price !== null
                      ? ` (₩${price.toLocaleString(
                          'ko-KR'
                        )})`
                      : ''}
                    {tradeType === 'SELL' &&
                    ownedQuantity > 0
                      ? ` - 보유: ${ownedQuantity}주`
                      : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* 수량 입력 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              수량
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="수량을 입력하세요"
              min="1"
              className="input-modern w-full"
            />
            {selectedStockId &&
              getCurrentPrice(selectedStockId) &&
              quantity && (
                <div className="mt-2 text-sm text-gray-600">
                  예상 금액:{' '}
                  <span className="font-bold text-purple-600">
                    ₩
                    {(
                      getCurrentPrice(selectedStockId) *
                      parseInt(quantity || 0)
                    ).toLocaleString('ko-KR', {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
              )}
          </div>

          {/* 거래 실행 버튼 */}
          <button
            onClick={handleExecuteTrade}
            disabled={
              !selectedPlayerId ||
              !selectedStockId ||
              !quantity ||
              parseInt(quantity) <= 0
            }
            className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-all ${
              selectedPlayerId &&
              selectedStockId &&
              quantity &&
              parseInt(quantity) > 0
                ? tradeType === 'BUY'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                  : 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            {tradeType === 'BUY'
              ? '매수 실행'
              : '매도 실행'}
          </button>
        </div>
      </div>

      {/* 선택된 플레이어 정보 */}
      {selectedPlayer && (
        <div className="card-modern p-4 sm:p-6 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">
            {selectedPlayer.nickname}님의 포트폴리오
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-gray-600">
                보유 현금
              </div>
              <div className="text-xl font-bold text-purple-600">
                ₩
                {selectedPlayer.cash?.toLocaleString(
                  'ko-KR',
                  {
                    maximumFractionDigits: 0,
                  }
                ) || 0}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">
                총 자산
              </div>
              <div className="text-xl font-bold text-green-600">
                ₩
                {selectedPlayer.totalAsset?.toLocaleString(
                  'ko-KR',
                  {
                    maximumFractionDigits: 0,
                  }
                ) || 0}
              </div>
            </div>
          </div>
          {selectedPlayer.stocks &&
            Object.keys(selectedPlayer.stocks).length >
              0 && (
              <div className="mt-4">
                <div className="text-sm font-semibold text-gray-700 mb-2">
                  보유 주식
                </div>
                <div className="space-y-2">
                  {Object.entries(selectedPlayer.stocks)
                    .filter(([_, qty]) => qty > 0)
                    .map(([stockId, qty]) => {
                      const stock = currentStocks.find(
                        (s) => s.id === stockId
                      );
                      const price =
                        getCurrentPrice(stockId);
                      return (
                        <div
                          key={stockId}
                          className="flex justify-between items-center p-2 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <div className="font-semibold text-gray-900">
                              {stock ? stock.name : stockId}
                            </div>
                            <div className="text-sm text-gray-600">
                              {qty}주
                            </div>
                          </div>
                          {price !== null && (
                            <div className="text-right">
                              <div className="font-semibold text-gray-900">
                                ₩
                                {price.toLocaleString(
                                  'ko-KR'
                                )}
                              </div>
                              <div className="text-sm text-gray-600">
                                총{' '}
                                {(
                                  price * qty
                                ).toLocaleString('ko-KR')}
                                원
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
        </div>
      )}

      {/* Toast 알림 */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
