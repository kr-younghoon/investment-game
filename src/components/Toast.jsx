import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  Info,
  AlertCircle,
  X,
} from 'lucide-react';

const toastTypes = {
  success: {
    icon: CheckCircle,
    iconColor: 'text-emerald-500',
    accentColor: 'text-emerald-500',
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-500',
    accentColor: 'text-blue-500',
  },
  warning: {
    icon: AlertCircle,
    iconColor: 'text-amber-500',
    accentColor: 'text-amber-500',
  },
  error: {
    icon: AlertCircle,
    iconColor: 'text-rose-500',
    accentColor: 'text-rose-500',
  },
};

export default function Toast({ toasts, onRemove }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 sm:gap-3 max-w-[calc(100%-2rem)] sm:max-w-md w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast, index) => {
          const type =
            toastTypes[toast.type] || toastTypes.info;
          const Icon = type.icon;

          return (
            <motion.div
              key={toast.id}
              initial={{
                opacity: 0,
                y: -100,
                scale: 0.8,
                filter: 'blur(10px)',
              }}
              animate={{
                opacity: 1,
                y: 0,
                scale: 1,
                filter: 'blur(0px)',
              }}
              exit={{
                opacity: 0,
                y: -50,
                scale: 0.9,
                filter: 'blur(5px)',
              }}
              transition={{
                opacity: {
                  type: 'spring',
                  damping: 20,
                  stiffness: 300,
                  mass: 0.8,
                },
                y: {
                  type: 'spring',
                  damping: 20,
                  stiffness: 300,
                  mass: 0.8,
                },
                scale: {
                  type: 'spring',
                  damping: 20,
                  stiffness: 300,
                  mass: 0.8,
                },
                filter: {
                  type: 'tween',
                  duration: 0.3,
                  ease: 'easeOut',
                },
              }}
              style={{
                y: index * 10, // 여러 토스트가 있을 때 약간의 오프셋
              }}
              className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden pointer-events-auto"
            >
              {/* 리퀴드 글래스 배경 효과 */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/20 to-white/10"></div>

              {/* 반짝이는 효과 */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{
                  x: ['-100%', '200%'],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />

              {/* 좌측 액센트 라인 */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${type.accentColor} opacity-60`}
              ></div>

              <div className="relative flex items-start gap-3 sm:gap-4">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    delay: 0.1,
                    type: 'spring',
                    stiffness: 200,
                  }}
                  className="flex-shrink-0"
                >
                  <Icon
                    className={`w-6 h-6 sm:w-7 sm:h-7 ${type.iconColor}`}
                  />
                </motion.div>
                <div className="flex-1 min-w-0">
                  {toast.title && (
                    <motion.div
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 }}
                      className="font-bold text-base sm:text-lg md:text-xl mb-1 sm:mb-1.5 text-gray-800"
                    >
                      {toast.title}
                    </motion.div>
                  )}
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-sm sm:text-base text-gray-700 leading-relaxed"
                  >
                    {toast.message}
                  </motion.div>
                </div>
                <motion.button
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 }}
                  onClick={() => onRemove(toast.id)}
                  className="flex-shrink-0 p-1.5 sm:p-2 text-gray-500 hover:text-gray-700 hover:bg-white/50 hover:scale-110 active:scale-95 transition-all rounded-lg"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </motion.button>
              </div>

              {/* 진행 바 (자동 닫힘) */}
              {toast.duration && (
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{
                    duration: toast.duration / 1000,
                    ease: 'linear',
                  }}
                  className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r ${type.accentColor} opacity-60 rounded-b-xl sm:rounded-b-2xl`}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
