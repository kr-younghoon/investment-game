import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useSocketSync } from '../../hooks/useSocketSync';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/Toast';
import { LogOut } from 'lucide-react';

export default function AdminRoleSelection() {
  const { connected, adminActions } = useSocketSync(true);
  const { toasts, removeToast, success, info } = useToast();
  const navigate = useNavigate();
  const isLoggingOutRef = useRef(false);

  const handleLogout = () => {
    // 중복 클릭 방지
    if (isLoggingOutRef.current) {
      console.log(
        '[AdminRoleSelection] 이미 로그아웃 진행 중'
      );
      return;
    }

    console.log('[AdminRoleSelection] 로그아웃 버튼 클릭');
    console.log(
      '[AdminRoleSelection] adminActions:',
      adminActions
    );

    isLoggingOutRef.current = true;

    if (adminActions && adminActions.logout) {
      console.log('[AdminRoleSelection] logout 함수 호출');
      adminActions.logout(
        (data) => {
          console.log(
            '[AdminRoleSelection] 로그아웃 성공:',
            data
          );
          isLoggingOutRef.current = false;
          // localStorage에서 인증 정보 제거
          localStorage.removeItem('admin_auth_id');
          localStorage.removeItem('admin_auth_password');
          success('로그아웃', '로그아웃되었습니다.', 2000);
          setTimeout(() => {
            navigate('/admin/login');
          }, 500);
        },
        (error) => {
          console.error(
            '[AdminRoleSelection] 로그아웃 오류:',
            error
          );
          isLoggingOutRef.current = false;
          // 오류가 발생해도 로그아웃 처리
          localStorage.removeItem('admin_auth_id');
          localStorage.removeItem('admin_auth_password');
          info('로그아웃', '로그아웃되었습니다.', 2000);
          setTimeout(() => {
            navigate('/admin/login');
          }, 500);
        }
      );
    } else {
      console.warn(
        '[AdminRoleSelection] adminActions 또는 logout 함수가 없음, 직접 로그아웃 처리'
      );
      isLoggingOutRef.current = false;
      // adminActions가 없으면 직접 처리
      localStorage.removeItem('admin_auth_id');
      localStorage.removeItem('admin_auth_password');
      success('로그아웃', '로그아웃되었습니다.', 2000);
      setTimeout(() => {
        navigate('/admin/login');
      }, 500);
    }
  };

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

      {/* 로그아웃 버튼 */}
      <button
        onClick={handleLogout}
        className="fixed top-4 right-4 z-50 px-4 py-2 bg-white/80 backdrop-blur-xl border border-gray-200 rounded-lg shadow-lg hover:bg-white transition-all flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-red-600"
      >
        <LogOut className="w-4 h-4" />
        로그아웃
      </button>

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
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
                  힌트 상점
                </h2>
                <p className="text-sm text-gray-600">
                  힌트 부여 및 로그 관리
                </p>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-gray-500">
              유저에게 힌트를 부여하고 힌트 구매 로그를
              확인할 수 있습니다.
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
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
                  주식 거래소
                </h2>
                <p className="text-sm text-gray-600">
                  유저 대신 거래 실행
                </p>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-gray-500">
              유저를 선택하여 대신 주식 매수/매도를 실행할
              수 있습니다.
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
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
                  개발 책임자
                </h2>
                <p className="text-sm text-gray-600">
                  전체 관리 기능
                </p>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-gray-500">
              게임 진행, 플레이어 관리, 데이터베이스, 설정
              등 모든 기능을 사용할 수 있습니다.
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
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
                  미니게임방
                </h2>
                <p className="text-sm text-gray-600">
                  미니게임으로 보상 지급
                </p>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-gray-500">
              미니게임을 통해 유저에게 돈을 지급할 수
              있습니다.
            </div>
          </motion.button>

          {/* 찌라시 & 힌트 설정 */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
            onClick={() => navigate('/admin/scenario')}
            className="card-modern p-6 sm:p-8 hover:scale-105 transition-transform cursor-pointer text-left group"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white text-3xl sm:text-4xl group-hover:scale-110 transition-transform">
                📰
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
                  찌라시 & 힌트 설정
                </h2>
                <p className="text-sm text-gray-600">
                  라운드별 찌라시 및 힌트 관리
                </p>
              </div>
            </div>
            <div className="text-xs sm:text-sm text-gray-500">
              각 라운드마다 찌라시와 랜덤 힌트를 설정할 수
              있습니다.
            </div>
          </motion.button>
        </div>
      </motion.div>

      {/* Toast 알림 */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
