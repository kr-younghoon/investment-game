import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';

const StockCard = React.memo(function StockCard({
  stock,
  price,
  changePercent,
  priceHistory,
  onClick, // 클릭 핸들러 추가
  disabled, // 클릭 비활성화 여부
}) {
  // null/undefined 체크 및 기본값 설정
  const safePrice = price != null && !isNaN(price) ? price : 0;
  const safeChangePercent = changePercent != null && !isNaN(changePercent) ? changePercent : 0;
  const safePriceHistory = Array.isArray(priceHistory) ? priceHistory : [];

  const isPositive = safeChangePercent >= 0;
  const colorClass = isPositive
    ? 'text-neon-red'
    : 'text-neon-blue';
  const bgGlow = isPositive ? 'glow-red' : 'glow-blue';

  // 스파크라인 데이터 준비
  const chartData = safePriceHistory.map((p, idx) => ({
    value: p != null && !isNaN(p) ? p : 0,
    index: idx,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={disabled ? undefined : onClick}
      className={`card-modern p-3 sm:p-4 md:p-6 ${
        disabled ? '' : 'card-modern-hover cursor-pointer'
      } ${
        isPositive
          ? 'border-red-500/30'
          : 'border-blue-500/30'
      }`}
    >
      <div className="flex items-center justify-between mb-3 sm:mb-4 md:mb-5">
        <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
          {stock.name}
        </h3>
        <div
          className={`p-1.5 sm:p-2 rounded-lg ${
            isPositive ? 'bg-red-100' : 'bg-blue-100'
          }`}
        >
          {isPositive ? (
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
          ) : (
            <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
          )}
        </div>
      </div>

      <div className="mb-3 sm:mb-4 md:mb-5">
        <div
          className={`text-xl sm:text-2xl md:text-3xl font-black ${colorClass} mb-1 sm:mb-2`}
        >
          ₩
          {safePrice % 1 === 0
            ? safePrice.toLocaleString('ko-KR')
            : safePrice.toFixed(2).replace(/\.0+$/, '')}
        </div>
        <div
          className={`inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-xs sm:text-sm font-semibold ${
            isPositive
              ? 'bg-red-100 text-red-700'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          {isPositive ? '+' : ''}
          {safeChangePercent % 1 === 0
            ? safeChangePercent.toLocaleString('ko-KR')
            : safeChangePercent.toFixed(2).replace(/\.0+$/, '')}
          %
        </div>
      </div>

      <div className="h-16 sm:h-20 rounded-lg bg-gray-50 p-1.5 sm:p-2 border border-gray-200">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={isPositive ? '#ef4444' : '#3b82f6'}
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
});

export default StockCard;