import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Info, AlertCircle, X } from 'lucide-react';

const toastTypes = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-100',
    borderColor: 'border-green-400',
    textColor: 'text-green-700',
    iconColor: 'text-green-600',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-100',
    borderColor: 'border-blue-400',
    textColor: 'text-blue-700',
    iconColor: 'text-blue-600',
  },
  warning: {
    icon: AlertCircle,
    bgColor: 'bg-yellow-100',
    borderColor: 'border-yellow-400',
    textColor: 'text-yellow-700',
    iconColor: 'text-yellow-600',
  },
};

export default function Toast({ toasts, onRemove }) {
  return (
    <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-[100] flex flex-col gap-2 sm:gap-3 max-w-[calc(100%-1rem)] sm:max-w-md w-full">
      <AnimatePresence>
        {toasts.map((toast) => {
          const type = toastTypes[toast.type] || toastTypes.info;
          const Icon = type.icon;

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 300, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 300, scale: 0.8 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={`${type.bgColor} ${type.borderColor} border-2 rounded-lg sm:rounded-xl p-3 sm:p-4 shadow-2xl backdrop-blur-sm relative overflow-hidden`}
            >
              {/* 배경 그라데이션 효과 */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
              
              <div className="relative flex items-start gap-2 sm:gap-3">
                <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${type.iconColor} flex-shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  {toast.title && (
                    <div className={`font-bold text-sm sm:text-base md:text-lg mb-0.5 sm:mb-1 ${type.textColor}`}>
                      {toast.title}
                    </div>
                  )}
                  <div className={`text-xs sm:text-sm ${type.textColor}`}>
                    {toast.message}
                  </div>
                </div>
                <button
                  onClick={() => onRemove(toast.id)}
                  className={`flex-shrink-0 p-0.5 sm:p-1 ${type.iconColor} hover:opacity-70 transition-opacity rounded`}
                >
                  <X className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>
              </div>

              {/* 진행 바 (자동 닫힘) */}
              {toast.duration && (
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: toast.duration / 1000, ease: 'linear' }}
                  className="absolute bottom-0 left-0 h-1 bg-current opacity-30"
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

