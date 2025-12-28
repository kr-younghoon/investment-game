import { useMemo } from 'react';
import AdminPage from './pages/AdminPage';
import PlayerPage from './pages/PlayerPage';

function App() {
  // URL 경로에 따라 페이지 결정
  // 플레이어 페이지가 메인(/), 관리자 페이지는 /admin
  const isAdmin = useMemo(() => {
    const path = window.location.pathname;
    return path.includes('/admin');
  }, []);

  return isAdmin ? <AdminPage /> : <PlayerPage />;
}

export default App;


