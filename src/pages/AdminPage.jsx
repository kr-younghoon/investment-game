import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useSocketSync } from '../hooks/useSocketSync';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';
import HintShopPage from './admin/HintShopPage';
import StockExchangePage from './admin/StockExchangePage';
import DeveloperPage from './admin/DeveloperPage';
import MiniGamePage from './admin/MiniGamePage';
import ScenarioPage from './admin/ScenarioPage';

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
    socket,
  } = useSocketSync(true);
  const { toasts, removeToast, success, info } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const isLoggingOutRef = useRef(false);

  const handleLogout = () => {
    // 중복 클릭 방지
    if (isLoggingOutRef.current) {
      console.log('[AdminPage] 이미 로그아웃 진행 중');
      return;
    }

    console.log('[AdminPage] 로그아웃 버튼 클릭');
    console.log('[AdminPage] adminActions:', adminActions);

    isLoggingOutRef.current = true;

    if (adminActions && adminActions.logout) {
      console.log('[AdminPage] logout 함수 호출');
      adminActions.logout(
        (data) => {
          console.log('[AdminPage] 로그아웃 성공:', data);
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
            '[AdminPage] 로그아웃 오류:',
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
        '[AdminPage] adminActions 또는 logout 함수가 없음, 직접 로그아웃 처리'
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

  const hasAuthenticatedRef = useRef(false);
  const hasRequestedDataRef = useRef(false);

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
          hasRequestedDataRef.current = false;
          // 자동 재인증
          adminActions.authenticate(
            {
              adminId: savedAdminId,
              password: savedPassword,
            },
            () => {
              // 인증 성공 후 한 번만 게임 상태 및 플레이어 리스트 요청
              if (!hasRequestedDataRef.current) {
                hasRequestedDataRef.current = true;
                if (
                  adminActions &&
                  adminActions.requestState
                ) {
                  adminActions.requestState();
                }
                if (
                  adminActions &&
                  adminActions.requestPlayerList
                ) {
                  adminActions.requestPlayerList();
                }
              }
            },
            () => {
              // 재인증 실패 시 로그인 페이지로 이동
              localStorage.removeItem('admin_auth_id');
              localStorage.removeItem(
                'admin_auth_password'
              );
              navigate('/admin/login');
            }
          );
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
          playerCount={playerCount}
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
          playerCount={playerCount}
        />
      );
    } else if (path === '/admin/developer') {
      return (
        <DeveloperPage
          gameState={gameState}
          connected={connected}
          playerCount={playerCount}
          playerList={playerList}
          connectedAdmins={connectedAdmins}
          transactionLogs={transactionLogs}
          adminActions={adminActions}
          setRoundTimerEndCallback={
            setRoundTimerEndCallback
          }
          setAdminsListCallback={setAdminsListCallback}
          setAdminSuccessCallback={setAdminSuccessCallback}
          socket={socket}
          setAdminErrorCallback={setAdminErrorCallback}
        />
      );
    } else if (path === '/admin/minigame') {
      return (
        <MiniGamePage
          gameState={gameState}
          playerList={playerList}
          adminActions={adminActions}
          setAdminErrorCallback={setAdminErrorCallback}
          playerCount={playerCount}
        />
      );
    } else if (path === '/admin/scenario') {
      return (
        <ScenarioPage
          gameState={gameState}
          adminActions={adminActions}
          setAdminErrorCallback={setAdminErrorCallback}
          playerCount={playerCount}
          socket={socket}
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

      {/* 로그아웃 버튼 */}
      <button
        onClick={handleLogout}
        className="fixed top-4 right-4 z-50 px-4 py-2 bg-white/80 backdrop-blur-xl border border-gray-200 rounded-lg shadow-lg hover:bg-white transition-all flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-red-600"
      >
        <LogOut className="w-4 h-4" />
        로그아웃
      </button>

      {renderPage()}

      {/* Toast 알림 */}
      <Toast toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
