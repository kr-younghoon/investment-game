import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function TradeModal({
  isOpen,
  onClose,
  stock,
  price,
  quantity, // 보유 수량
  maxBuyable, // 최대 매수 가능 수량
  currentCash,
  onBuy,
  onSell,
}) {
  const [tradeType, setTradeType] = useState('buy'); // 'buy' or 'sell'
  const [tradeQuantity, setTradeQuantity] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTradeQuantity('');
      setError('');
      setTradeType('buy');
    }
  }, [isOpen]);

  const handleQuantityChange = (value) => {
    setError('');
    if (value === '') {
      setTradeQuantity('');
      return;
    }
    const num = parseInt(value);
    if (isNaN(num) || num <= 0) {
      setError('유효한 수량을 입력하세요');
      return;
    }
    if (tradeType === 'buy' && num > maxBuyable) {
      setError(`최대 ${maxBuyable}주만 매수 가능합니다`);
      setTradeQuantity(maxBuyable.toString());
      return;
    }
    if (tradeType === 'sell' && num > quantity) {
      setError(`보유 수량은 ${quantity}주입니다`);
      setTradeQuantity(quantity.toString());
      return;
    }
    setTradeQuantity(value);
  };

  const handleMax = () => {
    if (tradeType === 'buy') {
      setTradeQuantity(maxBuyable.toString());
    } else {
      setTradeQuantity(quantity.toString());
    }
    setError('');
  };

  const handleConfirm = () => {
    const qty = parseInt(tradeQuantity);
    if (!tradeQuantity || qty <= 0) {
      setError('수량을 입력하세요');
      return;
    }
    if (tradeType === 'buy') {
      if (qty > maxBuyable) {
        setError(`최대 ${maxBuyable}주만 매수 가능합니다`);
        return;
      }
      if (currentCash < totalAmount) {
        setError(`현금이 부족합니다. 필요 금액: ₩${totalAmount.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`);
        return;
      }
      if (maxBuyable === 0) {
        setError('매수할 수 있는 현금이 없습니다');
        return;
      }
    } else {
      if (quantity === 0) {
        setError('보유한 주식이 없습니다');
        return;
      }
      if (qty > quantity) {
        setError(`보유 수량은 ${quantity}주입니다`);
        return;
      }
    }
    if (tradeType === 'buy') {
      onBuy(qty);
    } else {
      onSell(qty);
    }
    onClose();
  };

  const totalAmount = tradeQuantity ? price * parseInt(tradeQuantity) : 0;
  const afterCash = tradeType === 'buy' ? currentCash - totalAmount : currentCash + totalAmount;
  const canAfford = tradeType === 'buy' ? totalAmount <= currentCash : true;
  const hasEnough = tradeType === 'sell' ? parseInt(tradeQuantity) <= quantity : true;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="card-modern p-4 sm:p-6 md:p-8 max-w-md w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 text-gray-600 hover:text-gray-900 transition-colors p-1.5 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{stock.name}</h2>
              <div className="text-sm text-gray-600">현재가: ₩{price.toFixed(2)}</div>
              {quantity > 0 && (
                <div className="text-sm text-gray-600">보유: {quantity}주</div>
              )}
            </div>

            {/* 매수/매도 선택 */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => {
                  setTradeType('buy');
                  setTradeQuantity('');
                  setError('');
                }}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                  tradeType === 'buy'
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <TrendingUp className="w-4 h-4 inline mr-2" />
                매수
              </button>
              <button
                onClick={() => {
                  setTradeType('sell');
                  setTradeQuantity('');
                  setError('');
                }}
                disabled={quantity === 0}
                className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
                  tradeType === 'sell'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <TrendingDown className="w-4 h-4 inline mr-2" />
                매도
              </button>
            </div>

            {/* 수량 입력 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {tradeType === 'buy' ? '매수 수량' : '매도 수량'}
                <span className="text-gray-500 ml-2">
                  ({tradeType === 'buy' ? `최대 ${maxBuyable}주` : `보유 ${quantity}주`})
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={tradeQuantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  placeholder="수량 입력"
                  min="1"
                  max={tradeType === 'buy' ? maxBuyable : quantity}
                  step="1"
                  className="flex-1 input-modern text-base py-3"
                  disabled={tradeType === 'sell' && quantity === 0}
                />
                <button
                  onClick={handleMax}
                  disabled={tradeType === 'buy' ? maxBuyable === 0 : quantity === 0}
                  className={`px-4 py-3 font-semibold rounded-lg transition-all ${
                    tradeType === 'buy'
                      ? 'bg-green-100 hover:bg-green-200 text-green-700'
                      : 'bg-red-100 hover:bg-red-200 text-red-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  전체
                </button>
              </div>
              {error && (
                <div className="mt-2 text-sm text-red-600">{error}</div>
              )}
            </div>

            {/* 거래 정보 */}
            {tradeQuantity && parseInt(tradeQuantity) > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className={`mb-4 rounded-lg p-4 border ${
                  tradeType === 'buy' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">현재 현금</span>
                    <span className="font-semibold text-gray-900">
                      ₩{currentCash.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={tradeType === 'buy' ? 'text-green-600' : 'text-red-600'}>
                      {tradeType === 'buy' ? '필요 금액' : '예상 수익'}
                    </span>
                    <span className={`font-semibold ${tradeType === 'buy' ? 'text-green-700' : 'text-red-700'}`}>
                      ₩{totalAmount.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200">
                    <span className="font-semibold text-gray-900">거래 후 현금</span>
                    <span className={`font-bold ${
                      afterCash < 0 ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      ₩{afterCash.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                      {afterCash < 0 && <span className="ml-1">⚠️</span>}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 확인 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
              >
                취소
              </button>
              <button
                onClick={handleConfirm}
                disabled={!tradeQuantity || parseInt(tradeQuantity) <= 0 || !canAfford || !hasEnough || (tradeType === 'sell' && quantity === 0)}
                className={`flex-1 px-4 py-3 font-semibold rounded-xl transition-all ${
                  tradeType === 'buy'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                    : 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white'
                } disabled:from-gray-300 disabled:to-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed`}
              >
                {tradeType === 'buy' ? '매수' : '매도'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

