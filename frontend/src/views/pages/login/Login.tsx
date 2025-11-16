import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from 'src/api/axios';
import { JSEncrypt } from 'jsencrypt';
import { useAuthStore, useAuthActions } from 'src/store/authStore';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Password } from 'primereact/password';
import { Message } from 'primereact/message';
import { classNames } from 'primereact/utils';
import { PasswordStatus } from 'src/common/constants/password-status';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuthActions();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const passwordStatus = useAuthStore((state) => state.passwordStatus);

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [publicKey, setPublicKey] = useState<string | null>(null);

  useEffect(() => {
    if (isLoggedIn && passwordStatus === PasswordStatus.OK) {
      navigate('/dashboard', { replace: true }); // replace: true로 뒤로가기 막기
    }
  }, [isLoggedIn, navigate, passwordStatus]);

  useEffect(() => {
    const fetchPublicKey = async () => {
      try {
        const { data } = await api.get('/auth/public-key');
        setPublicKey(data.publicKey);
      } catch (err) {
        console.error('Failed to fetch public key:', err);
        setError('로그인 설정을 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    };
    if (!isLoggedIn) fetchPublicKey();
  }, [isLoggedIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!loginId || !password) {
      setError('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }
    if (!publicKey) {
      setError('로그인에 실패했습니다. 페이지를 새로고침 해주세요.');
      return;
    }

    setLoading(true);
    try {
      const encrypt = new JSEncrypt();
      encrypt.setPublicKey(publicKey);
      const encryptedPassword = encrypt.encrypt(password);
      if (!encryptedPassword) throw new Error('Password encryption failed.');

      const { data } = await api.post('/auth/login', { loginId, password: encryptedPassword });
      login(data.user, data.accessToken, data.authorizedMenu);
    } catch (err: any) {
      const backendMessage = err.response?.data?.message;
      setError(
        backendMessage && typeof backendMessage === 'string'
          ? backendMessage
          : '로그인 실패. 아이디 또는 비밀번호를 확인해주세요.',
      );
    } finally {
      setLoading(false);
    }
  };

  const containerClassName = classNames(
    'surface-ground flex align-items-center justify-content-center min-h-screen min-w-screen overflow-hidden',
  );

  return (
    <div className={containerClassName}>
      <div className="surface-card border-round shadow-1 p-6 w-30rem md:w-36rem">
        <div className="text-left mb-5">
          <h2 className="text-3xl font-semibold mb-1 text-900">Login</h2>
          <p className="text-600 m-0">Sign in to your account</p>
        </div>

        {error && <Message severity="error" text={error} className="mb-3 w-full" />}

        <form onSubmit={handleSubmit}>
          <div className="field mb-4">
            <span className="p-input-icon-left w-full">
              <InputText
                id="loginId"
                type="text"
                placeholder="Username"
                className="w-full"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                required
              />
            </span>
          </div>

          <div className="field mb-4">
            <span className="p-input-icon-left w-full">
              <Password
                inputId="password"
                placeholder="Password"
                className="w-full"
                inputClassName="w-full"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                feedback={false}
                toggleMask
                required
              />
            </span>
          </div>

          <Button
            label={loading ? '로그인 중...' : 'Login'}
            type="submit"
            className="w-full border-round-sm"
            style={{ background: 'var(--primary-color)', borderColor: 'var(--primary-color)' }}
            disabled={loading || !publicKey}
            icon={loading ? 'pi pi-spin pi-spinner' : undefined}
          />
        </form>
      </div>
    </div>
  );
};

export default Login;
