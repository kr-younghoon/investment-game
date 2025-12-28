import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';

export default function StockCard({
  stock,
  price,
  changePercent,
  priceHistory,
}) {
  const isPositive = changePercent >= 0;
  const colorClass = isPositive
    ? 'text-neon-red'
    : 'text-neon-blue';
  const bgGlow = isPositive ? 'glow-red' : 'glow-blue';

  // 스파크라인 데이터 준비
  const chartData = priceHistory.map((p, idx) => ({
    value: p,
    index: idx,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card-modern p-3 sm:p-4 md:p-6 card-modern-hover ${
        isPositive ? 'border-red-500/30' : 'border-blue-500/30'
      }`}
    >
      <div className="flex items-center justify-between mb-3 sm:mb-4 md:mb-5">
        <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">{stock.name}</h3>
        <div className={`p-1.5 sm:p-2 rounded-lg ${isPositive ? 'bg-red-100' : 'bg-blue-100'}`}>
          {isPositive ? (
            <TrendingUp className={`w-4 h-4 sm:w-5 sm:h-5 ${isPositive ? 'text-red-600' : 'text-blue-600'}`} />
          ) : (
            <TrendingDown className={`w-4 h-4 sm:w-5 sm:h-5 ${isPositive ? 'text-red-600' : 'text-blue-600'}`} />
          )}
        </div>
      </div>

      <div className="mb-3 sm:mb-4 md:mb-5">
        <div className={`text-xl sm:text-2xl md:text-3xl font-black ${colorClass} mb-1 sm:mb-2`}>
          ₩{price.toFixed(2)}
        </div>
        <div className={`inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg text-xs sm:text-sm font-semibold ${
          isPositive ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
        }`}>
          {isPositive ? '+' : ''}
          {changePercent.toFixed(2)}%
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
}

