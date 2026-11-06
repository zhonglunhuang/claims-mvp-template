// 畫面的路由：一個網址一個頁面（frontend/src/pages/），外框是 AppShell。
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth';
import { AppShell } from './components/AppShell';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            <Route path="login" element={<Login />} />
            {/* 需要登入的頁面放在 RequireLogin（components/RequireLogin.tsx）底下，沒登入會導到 /login：
                <Route element={<RequireLogin />}>
                  <Route path="claims" element={<ClaimList />} />
                </Route> */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
