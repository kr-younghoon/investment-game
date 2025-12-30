import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import AdminPage from './pages/AdminPage';
import AdminRoleSelection from './pages/admin/AdminRoleSelection';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import PlayerPage from './pages/PlayerPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PlayerPage />} />
        <Route
          path="/admin/login"
          element={<AdminLoginPage />}
        />
        <Route
          path="/admin"
          element={<AdminRoleSelection />}
        />
        <Route path="/admin/hint" element={<AdminPage />} />
        <Route
          path="/admin/stock"
          element={<AdminPage />}
        />
        <Route
          path="/admin/developer"
          element={<AdminPage />}
        />
        <Route
          path="/admin/minigame"
          element={<AdminPage />}
        />
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
