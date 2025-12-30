import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useSocketSync } from '../../hooks/useSocketSync';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/Toast';

export default function AdminRoleSelection() {
  const { connected, adminActions } = useSocketSync(true);
  const { toasts, removeToast } = useToast();
  const navigate = useNavigate();

  // 인증 확인: 인증되지 않았으면 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (connected && adminActions) {
      // 게임 상태 요청 (인증되지 않으면 서버에서 응답 없음)
      adminActions.requestState();
    }
  }, [connected, adminActions]);

  return (
    <div className="min-h-screen p-4 sm:p-8 flex items-center justify-center relative">
      {/* 배경 효과 */}
      <div className="fixed inset-0 bg-white -z-10"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl"
      >
        <div className="text-center mb-8">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 text-gray-900"
          >
            관리자 페이지
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-gray-600 text-sm sm:text-base"
          >
            역할을 선택해주세요
          </motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {/* 힌트 상점 */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => navigate('/admin/hint')}
            className="card-modern p-6 sm:p-8 hover:scale-105 transition-transform cursor-pointer text-left group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-3xl sm:text-4xl group-hover:scale-110 transition-transform">
                💡
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">힌트 상점</h2>
                <p className="text-sm text-gray-600">힌트 부여 및 로그 관리</p>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-gray-500">
              유저에게 힌트를 부여하고 힌트 구매 로그를 확인할 수 있습니다.
            </div>
          </motion.button>

          {/* 주식 거래소 */}
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            onClick={() => navigate('/admin/stock')}
            className="card-modern p-6 sm:p-8 hover:scale-105 transition-transform cursor-pointer text-left group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-white text-3xl sm:text-4xl group-hover:scale-110 transition-transform">
                📈
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">주식 거래소</h2>
                <p className="text-sm text-gray-600">유저 대신 거래 실행</p>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-gray-500">
              유저를 선택하여 대신 주식 매수/매도를 실행할 수 있습니다.
            </div>
          </motion.button>

          {/* 개발 책임자 */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            onClick={() => navigate('/admin/developer')}
            className="card-modern p-6 sm:p-8 hover:scale-105 transition-transform cursor-pointer text-left group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-3xl sm:text-4xl group-hover:scale-110 transition-transform">
                👨‍💻
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">개발 책임자</h2>
                <p className="text-sm text-gray-600">전체 관리 기능</p>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-gray-500">
              게임 진행, 플레이어 관리, 데이터베이스, 설정 등 모든 기능을 사용할 수 있습니다.
            </div>
          </motion.button>

          {/* 미니게임방 */}
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            onClick={() => navigate('/admin/minigame')}
            className="card-modern p-6 sm:p-8 hover:scale-105 transition-transform cursor-pointer text-left group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-white text-3xl sm:text-4xl group-hover:scale-110 transition-transform">
                🎮
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">미니게임방</h2>
                <p className="text-sm text-gray-600">미니게임으로 보상 지급</p>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-gray-500">
              미니게임을 통해 유저에게 돈을 지급할 수 있습니다.
            </div>
          </motion.button>
        </div>
      </motion.div>

      {/* Toast 알림 */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

