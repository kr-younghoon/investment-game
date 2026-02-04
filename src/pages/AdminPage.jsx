import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LogOut,
  Lightbulb,
  TrendingUp,
  Gamepad2,
  Newspaper,
  Settings,
  Users,
  Clock,
} from 'lucide-react';
import { useSocketSync } from '../hooks/useSocketSync';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';
import HintShopPage from './admin/HintShopPage';
import StockExchangePage from './admin/StockExchangePage';
import DeveloperPage from './admin/DeveloperPage';
import MiniGamePage from './admin/MiniGamePage';
import ScenarioPage from './admin/ScenarioPage';

const TABS = [
  { id: 'developer', label: '게임 진행', icon: Settings, color: 'blue' },
  { id: 'hint', label: '힌트 상점', icon: Lightbulb, color: 'purple' },
  { id: 'stock', label: '주식 거래소', icon: TrendingUp, color: 'green' },
  { id: 'minigame', label: '미니게임방', icon: Gamepad2, color: 'yellow' },
  { id: 'scenario', label: '찌라시 설정', icon: Newspaper, color: 'pink' },
];

export default function AdminPage() {
  const {
    gameState,
    connected,
    playerCount,
    playerList,
    connectedAdmins,
    transactionLogs,
    adminActions,
    setAdminErrorCallback,
    setRoundTimerEndCallback,
    setAdminsListCallback,
    setAdminSuccessCallback,
    setHintErrorCallback,
    setMinigameCompleteCallback,
    socket,
  } = useSocketSync(true);
  const { toasts, removeToast, success, info } = useToast();
  const navigate = useNavigate();
  const isLoggingOutRef = useRef(false);
  const [activeTab, setActiveTab] = useState('developer');

  const handleLogout = () => {
    if (isLoggingOutRef.current) {
      return;
    }

    isLoggingOutRef.current = true;

    if (adminActions && adminActions.logout) {
      adminActions.logout(
        () => {
          isLoggingOutRef.current = false;
          localStorage.removeItem('admin_auth_id');
          localStorage.removeItem('admin_auth_password');
          success('로그아웃', '로그아웃되었습니다.', 2000);
          setTimeout(() => {
            navigate('/admin/login');
          }, 500);
        },
        () => {
          isLoggingOutRef.current = false;
          localStorage.removeItem('admin_auth_id');
          localStorage.removeItem('admin_auth_password');
          info('로그아웃', '로그아웃되었습니다.', 2000);
          setTimeout(() => {
            navigate('/admin/login');
          }, 500);
        }
      );
    } else {
      isLoggingOutRef.current = false;
      localStorage.removeItem('admin_auth_id');
      localStorage.removeItem('admin_auth_password');
      success('로그아웃', '로그아웃되었습니다.', 2000);
      setTimeout(() => {
        navigate('/admin/login');
      }, 500);
    }
  };

  const hasAuthenticatedRef = useRef(false);
  const hasRequestedDataRef = useRef(false);

  // 소켓 재연결 시 자동 재인증 및 플레이어 리스트 요청
  useEffect(() => {
    if (connected && adminActions) {
      const savedAdminId = localStorage.getItem('admin_auth_id');
      const savedPassword = localStorage.getItem('admin_auth_password');

      if (savedAdminId && savedPassword) {
        if (!hasAuthenticatedRef.current) {
          hasAuthenticatedRef.current = true;
          hasRequestedDataRef.current = false;
          adminActions.authenticate(
            {
              adminId: savedAdminId,
              password: savedPassword,
            },
            () => {
              if (!hasRequestedDataRef.current) {
                hasRequestedDataRef.current = true;
                if (adminActions && adminActions.requestState) {
                  adminActions.requestState();
                }
                if (adminActions && adminActions.requestPlayerList) {
                  adminActions.requestPlayerList();
                }
              }
            },
            () => {
              localStorage.removeItem('admin_auth_id');
              localStorage.removeItem('admin_auth_password');
              navigate('/admin/login');
            }
          );
        }
      } else {
        navigate('/admin/login');
      }
    }
  }, [connected, adminActions, navigate]);

  // 현재 탭에 따라 해당 페이지 렌더링
  const renderPage = () => {
    const commonProps = {
      gameState,
      playerList,
      adminActions,
      setAdminErrorCallback,
      playerCount,
    };

    switch (activeTab) {
      case 'hint':
        return (
          <HintShopPage
            {...commonProps}
            transactionLogs={transactionLogs}
            setHintErrorCallback={setHintErrorCallback}
          />
        );
      case 'stock':
        return (
          <StockExchangePage
            {...commonProps}
            transactionLogs={transactionLogs}
          />
        );
      case 'developer':
        return (
          <DeveloperPage
            {...commonProps}
            connected={connected}
            connectedAdmins={connectedAdmins}
            transactionLogs={transactionLogs}
            setRoundTimerEndCallback={setRoundTimerEndCallback}
            setAdminsListCallback={setAdminsListCallback}
            setAdminSuccessCallback={setAdminSuccessCallback}
            socket={socket}
          />
        );
      case 'minigame':
        return (
          <MiniGamePage
            {...commonProps}
            setMinigameCompleteCallback={setMinigameCompleteCallback}
          />
        );
      case 'scenario':
        return <ScenarioPage {...commonProps} socket={socket} />;
      default:
        return null;
    }
  };

  const getTabColorClasses = (tab, isActive) => {
    const colors = {
      blue: isActive
        ? 'bg-blue-500 text-white border-blue-500'
        : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50',
      purple: isActive
        ? 'bg-purple-500 text-white border-purple-500'
        : 'bg-white text-purple-600 border-purple-200 hover:bg-purple-50',
      green: isActive
        ? 'bg-green-500 text-white border-green-500'
        : 'bg-white text-green-600 border-green-200 hover:bg-green-50',
      yellow: isActive
        ? 'bg-yellow-500 text-white border-yellow-500'
        : 'bg-white text-yellow-600 border-yellow-200 hover:bg-yellow-50',
      pink: isActive
        ? 'bg-pink-500 text-white border-pink-500'
        : 'bg-white text-pink-600 border-pink-200 hover:bg-pink-50',
    };
    return colors[tab.color] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단 헤더 - 고정 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-gray-200 shadow-sm">
        <div className="px-2 sm:px-4 py-2 sm:py-3">
          {/* 상단 정보 바 */}
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <h1 className="text-base sm:text-lg font-bold text-gray-900">
              관리자 대시보드
            </h1>
            <div className="flex items-center gap-2 sm:gap-3">
              {/* 게임 상태 */}
              {gameState.isGameStarted ? (
                <div className="flex items-center gap-1 sm:gap-2">
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-300">
                    R{gameState.currentRound + 1}
                    {gameState.isPracticeMode && ' (연습)'}
                  </span>
                  {gameState.roundTimer !== null && !gameState.isWaitingMode && (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                        gameState.roundTimer <= 60
                          ? 'bg-red-100 text-red-700 border border-red-300'
                          : gameState.roundTimer <= 300
                          ? 'bg-yellow-100 text-yellow-700 border border-yellow-300'
                          : 'bg-blue-100 text-blue-700 border border-blue-300'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      {Math.floor(gameState.roundTimer / 60)}:
                      {String(gameState.roundTimer % 60).padStart(2, '0')}
                    </span>
                  )}
                </div>
              ) : (
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-300">
                  게임 대기중
                </span>
              )}
              {/* 접속자 수 */}
              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-300 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {playerCount || 0}명
              </span>
              {/* 로그아웃 버튼 */}
              <button
                onClick={handleLogout}
                className="px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-semibold text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all flex items-center gap-1"
              >
                <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </div>
          </div>

          {/* 탭 메뉴 */}
          <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  whileTap={{ scale: 0.95 }}
                  className={`flex-shrink-0 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold border transition-all flex items-center gap-1.5 ${getTabColorClasses(
                    tab,
                    isActive
                  )}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 메인 콘텐츠 - 상단 헤더 높이만큼 패딩 */}
      <div className="pt-[100px] sm:pt-[110px]">{renderPage()}</div>

      {/* Toast 알림 */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
