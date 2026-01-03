import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useSocketSync } from '../hooks/useSocketSync';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';
import HintShopPage from './admin/HintShopPage';
import StockExchangePage from './admin/StockExchangePage';
import DeveloperPage from './admin/DeveloperPage';
import MiniGamePage from './admin/MiniGamePage';

export default function AdminPage() {
  const {
    gameState,
    connected,
    playerCount,
    playerList,
    transactionLogs,
    adminActions,
    setAdminErrorCallback,
    setRoundTimerEndCallback,
    setAdminsListCallback,
    setAdminSuccessCallback,
    socket,
  } = useSocketSync(true);
  const { toasts, removeToast, success } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const hasAuthenticatedRef = useRef(false);

  // 소켓 재연결 시 자동 재인증 및 플레이어 리스트 요청
  useEffect(() => {
    if (connected && adminActions) {
      const savedAdminId =
        localStorage.getItem('admin_auth_id');
      const savedPassword = localStorage.getItem(
        'admin_auth_password'
      );

      if (savedAdminId && savedPassword) {
        if (!hasAuthenticatedRef.current) {
          hasAuthenticatedRef.current = true;
          // 자동 재인증
          adminActions.authenticate(
            {
              adminId: savedAdminId,
              password: savedPassword,
            },
            () => {
              console.log('[AdminPage] 자동 재인증 성공');
              // 인증 성공 후 게임 상태 및 플레이어 리스트 요청
              if (adminActions && adminActions.requestState) {
                adminActions.requestState();
              }
              if (adminActions && adminActions.requestPlayerList) {
                adminActions.requestPlayerList();
              }
            },
            () => {
              // 재인증 실패 시 로그인 페이지로 이동
              localStorage.removeItem('admin_auth_id');
              localStorage.removeItem('admin_auth_password');
              navigate('/admin/login');
            }
          );
        } else {
          // 이미 인증된 상태에서도 플레이어 리스트 요청 (페이지 새로고침 등)
          if (adminActions && adminActions.requestPlayerList) {
            adminActions.requestPlayerList();
          }
          if (adminActions && adminActions.requestState) {
            adminActions.requestState();
          }
        }
      } else {
        // 저장된 인증 정보가 없으면 로그인 페이지로 이동
        navigate('/admin/login');
      }
    }
  }, [connected, adminActions, navigate]);

  // 현재 경로에 따라 해당 페이지 렌더링
  const renderPage = () => {
    const path = location.pathname;

    if (path === '/admin/hint') {
      return (
        <HintShopPage
          gameState={gameState}
          playerList={playerList}
          transactionLogs={transactionLogs}
          adminActions={adminActions}
          setAdminErrorCallback={setAdminErrorCallback}
        />
      );
    } else if (path === '/admin/stock') {
      return (
        <StockExchangePage
          gameState={gameState}
          transactionLogs={transactionLogs}
          playerList={playerList}
          adminActions={adminActions}
          setAdminErrorCallback={setAdminErrorCallback}
        />
      );
    } else if (path === '/admin/developer') {
      return (
        <DeveloperPage
          gameState={gameState}
          connected={connected}
          playerCount={playerCount}
          playerList={playerList}
          transactionLogs={transactionLogs}
          adminActions={adminActions}
          setRoundTimerEndCallback={
            setRoundTimerEndCallback
          }
          setAdminsListCallback={setAdminsListCallback}
          setAdminSuccessCallback={setAdminSuccessCallback}
        />
      );
    } else if (path === '/admin/minigame') {
      return (
        <MiniGamePage
          gameState={gameState}
          playerList={playerList}
          adminActions={adminActions}
          setAdminErrorCallback={setAdminErrorCallback}
        />
      );
    }

    return null;
  };

  return (
    <div className="relative">
      {/* 뒤로가기 버튼 */}
      <button
        onClick={() => navigate('/admin')}
        className="fixed top-4 left-4 z-50 px-4 py-2 bg-white/80 backdrop-blur-xl border border-gray-200 rounded-lg shadow-lg hover:bg-white transition-all flex items-center gap-2 text-sm font-semibold text-gray-700"
      >
        <ArrowLeft className="w-4 h-4" />
        역할 선택
      </button>

      {renderPage()}

      {/* Toast 알림 */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
