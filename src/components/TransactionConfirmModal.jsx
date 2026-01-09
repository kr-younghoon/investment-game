import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

export default function TransactionConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  type, // 'buy' or 'sell'
  stockName,
  quantity,
  price,
  totalAmount,
  currentCash,
  currentQuantity,
}) {
  if (!isOpen) return null;

  const isBuy = type === 'buy';
  const canAfford = isBuy ? totalAmount <= currentCash : true;
  const hasEnough = isBuy ? true : quantity <= currentQuantity;

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

            <div className="text-center mb-6">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                isBuy ? 'bg-green-100' : 'bg-red-100'
              }`}>
                <AlertTriangle className={`w-8 h-8 ${isBuy ? 'text-green-600' : 'text-red-600'}`} />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">
                {isBuy ? '매수 확인' : '매도 확인'}
              </h2>
              <p className="text-sm sm:text-base text-gray-600">
                거래를 진행하시겠습니까?
              </p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">주식명</span>
                <span className="font-semibold text-gray-900">{stockName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">거래 유형</span>
                <span className={`font-semibold ${isBuy ? 'text-green-600' : 'text-red-600'}`}>
                  {isBuy ? '매수' : '매도'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">수량</span>
                <span className="font-semibold text-gray-900">{quantity}주</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">단가</span>
                <span className="font-semibold text-gray-900">₩{price % 1 === 0 ? price.toLocaleString('ko-KR') : price.toFixed(2).replace(/\.0+$/, '')}</span>
              </div>
              <div className="border-t border-gray-200 pt-3 mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-gray-900">
                    {isBuy ? '필요 금액' : '예상 수익'}
                  </span>
                  <span className={`text-lg font-bold ${isBuy ? 'text-green-600' : 'text-red-600'}`}>
                    ₩{totalAmount.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
              {isBuy && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-xs text-gray-500">거래 후 현금</span>
                  <span className={`text-sm font-semibold ${
                    (currentCash - totalAmount) < 0 ? 'text-red-600' : 'text-gray-900'
                  }`}>
                    ₩{(currentCash - totalAmount).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                  </span>
                </div>
              )}
              {!isBuy && (
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-xs text-gray-500">거래 후 보유</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {currentQuantity - quantity}주
                  </span>
                </div>
              )}
            </div>

            {!canAfford && isBuy && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 font-semibold">
                  ⚠️ 현금이 부족합니다.
                </p>
              </div>
            )}

            {!hasEnough && !isBuy && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 font-semibold">
                  ⚠️ 보유 주식이 부족합니다.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (canAfford && hasEnough) {
                    onConfirm();
                    onClose();
                  }
                }}
                disabled={!canAfford || !hasEnough}
                className={`flex-1 px-4 py-3 font-semibold rounded-xl transition-all ${
                  isBuy
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white'
                    : 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white'
                } disabled:from-gray-300 disabled:to-gray-400 disabled:text-gray-600 disabled:cursor-not-allowed`}
              >
                확인
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

