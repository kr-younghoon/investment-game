import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useSocketSync } from '../../hooks/useSocketSync';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/Toast';
import { LogIn } from 'lucide-react';

export default function AdminLoginPage() {
  const { connected, adminActions } = useSocketSync(true);
  const { toasts, removeToast, success, error } = useToast();
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  // 인증 성공 시 역할 선택 페이지로 이동
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/admin');
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = () => {
    if (!adminId.trim() || !password.trim()) {
      error('로그인 실패', 'ID와 비밀번호를 입력해주세요.', 3000);
      return;
    }

    if (adminActions) {
      adminActions.authenticate(
        { adminId: adminId.trim(), password: password.trim() },
        () => {
          // 인증 정보를 localStorage에 저장 (재연결 시 사용)
          localStorage.setItem('admin_auth_id', adminId.trim());
          localStorage.setItem('admin_auth_password', password.trim());
          success('로그인 성공', '관리자 페이지에 접속했습니다.', 2000);
          setIsAuthenticated(true);
        },
        (errorMessage) => {
          error('로그인 실패', errorMessage || 'ID 또는 비밀번호가 올바르지 않습니다.', 3000);
        }
      );
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-8 flex items-center justify-center relative">
      {/* 배경 효과 */}
      <div className="fixed inset-0 bg-white -z-10"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="card-modern p-8 sm:p-10">
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-4"
            >
              <LogIn className="w-10 h-10 text-white" />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-2xl sm:text-3xl font-black mb-2 text-gray-900"
            >
              관리자 로그인
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-gray-600 text-sm"
            >
              운영자 계정으로 로그인해주세요
            </motion.p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                운영자 ID
              </label>
              <input
                type="text"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="운영자 ID를 입력하세요"
                className="input-modern w-full"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="비밀번호를 입력하세요"
                className="input-modern w-full"
              />
            </div>

            <button
              onClick={handleLogin}
              disabled={!connected || !adminId.trim() || !password.trim()}
              className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-all ${
                connected && adminId.trim() && password.trim()
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {connected ? '로그인' : '연결 중...'}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Toast 알림 */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

