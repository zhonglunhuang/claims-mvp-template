// 測試帳號快速登入：列出資料庫裡在職的帳號，點一下就用那個人的身分登入，不用密碼。
// 只在開發環境與 Staging 開啟；正式環境的後端會關閉這個功能。
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';

interface TestUser {
  id: number;
  name: string;
  email: string;
}

function describeError(err: unknown): string {
  if (err instanceof ApiError && err.status === 404) return '這個環境沒有開放測試帳號快速登入。';
  if (err instanceof ApiError) return err.message;
  return '發生錯誤，請稍後再試。';
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers] = useState<TestUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<TestUser[]>('/api/auth/test-users')
      .then((list) => {
        if (!cancelled) setUsers(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(describeError(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onPick(user: TestUser) {
    setPending(user.email);
    setError(null);
    try {
      await login(user.email);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== '/login' ? from : '/', { replace: true });
    } catch (err) {
      setError(describeError(err));
      setPending(null);
    }
  }

  return (
    <section>
      <h1>測試帳號快速登入</h1>
      <p className="hint">只在開發環境與 Staging 開啟。點一個人，就用他的身分登入，不用密碼。</p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {users === null && !error && <p className="hint">載入帳號中…</p>}
      {users !== null && users.length === 0 && <p>還沒有任何帳號（Day 10 的 T1 會建立六個測試帳號）</p>}
      {users !== null && users.length > 0 && (
        <ul className="user-list">
          {users.map((user) => (
            <li key={user.id}>
              <button type="button" onClick={() => onPick(user)} disabled={pending !== null}>
                <span>{pending === user.email ? '登入中…' : user.name}</span>
                <span className="email">{user.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
