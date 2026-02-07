import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import AdminPage from './pages/AdminPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import PlayerPage from './pages/PlayerPage';
import DisplayBoardPage from './pages/DisplayBoardPage';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PlayerPage />} />
          <Route
            path="/admin/login"
            element={<AdminLoginPage />}
          />
          <Route
            path="/admin"
            element={<AdminPage />}
          />
          <Route
            path="/display"
            element={<DisplayBoardPage />}
          />
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
