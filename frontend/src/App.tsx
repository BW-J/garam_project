import React, { Suspense, useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import PrivateRoute from './routes/PrivateRoute';
import { ProgressSpinner } from 'primereact/progressspinner';
import { useAuthStore, useAuthActions, useAuthIsLoading } from './store/authStore';
import api from './api/axios';
import 'primereact/resources/primereact.min.css';
import 'primereact/resources/themes/lara-light-cyan/theme.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';
import './scss/layout_fixed.scss';
import './scss/custom.scss';
import './scss/custom-sidebar.scss';

import { PrimeReactProvider } from 'primereact/api';
import { useSessionTimeout } from './hooks/useSessionTimeout';
import ForcePasswordChangeModal from './views/profile/ForcePasswordChangeModal';
import { PasswordStatus } from './common/constants/password-status';

// Containers
const DefaultLayout = React.lazy(() => import('./layout/DefaultLayout'));

// Pages
const Login = React.lazy(() => import('./views/pages/login/Login'));
// const Register = React.lazy(() => import('./views/pages/register/Register'));
const Page404 = React.lazy(() => import('./views/pages/error/Page404'));
// const Page500 = React.lazy(() => import('./views/pages/error/Page500'));

const SessionWatcher = () => {
  useSessionTimeout();
  return null; // 화면에 아무것도 렌더링하지 않음
};

const App = () => {
  // --- Silent Refresh 로직 ---
  const { login, logout, setLoading } = useAuthActions();
  const isLoading = useAuthIsLoading();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const userId = useAuthStore((state) => state.user?.userId);
  const passwordStatus = useAuthStore((state) => state.passwordStatus);

  useEffect(() => {
    const initializeAuth = async () => {
      const currentToken = useAuthStore.getState().accessToken;

      if (currentToken) {
        setLoading(false);
        return;
      }

      try {
        console.log('Attempting to fetch session info...');
        const { data: sessionData } = await api.get('/auth/session-info');
        if (sessionData && sessionData.user && sessionData.authorizedMenu) {
          const currentToken = useAuthStore.getState().accessToken;
          login(sessionData.user, currentToken!, sessionData.authorizedMenu);
          console.log('Session restored successfully.');
        } else {
          console.log('Failed to restore session: Invalid session data received.');
          logout();
        }
      } catch (error: any) {
        console.log('Failed to restore session:', error.message);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []); // 의존성 배열 추가
  // --- Silent Refresh 로직 ---
  useEffect(() => {
    const nav = performance.getEntriesByType('navigation') as any[];
    const isReload = nav?.[0]?.type === 'reload';

    if (isReload) {
      window.location.hash = '#/';
    }
  }, []);

  if (isLoading) {
    return (
      <div className="pt-3 text-center d-flex justify-content-center align-items-center min-vh-100">
        <ProgressSpinner style={{ width: '50px', height: '50px' }} strokeWidth="8" />
      </div>
    );
  }

  return (
    <PrimeReactProvider>
      <HashRouter>
        <SessionWatcher />
        {isLoggedIn && passwordStatus !== PasswordStatus.OK ? (
          <ForcePasswordChangeModal key={userId} />
        ) : (
          <Suspense
            fallback={
              <div className="pt-3 text-center">
                <ProgressSpinner style={{ width: '50px', height: '50px' }} strokeWidth="8" />
              </div>
            }
          >
            <Routes>
              {/* 공개 페이지 */}
              <Route path="/login" element={<Login />} />
              {/* <Route path="/register" element={<Register />} /> */}
              <Route path="/404" element={<Page404 />} />
              {/* <Route path="/500" element={<Page500 />} /> */}
              {/* 보호된 페이지 */}
              <Route element={<PrivateRoute />}>
                <Route path="*" element={<DefaultLayout />} />
              </Route>
            </Routes>
          </Suspense>
        )}
      </HashRouter>
    </PrimeReactProvider>
  );
};

export default App;
