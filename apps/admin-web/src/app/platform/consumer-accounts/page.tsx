'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdminApiClient,
  ApiRequestError,
  ForbiddenError,
  SessionExpiredError,
} from '../../auth-client';
import { OpsShell } from '../../ops-shell';

type AssignedAccount = { id: string; username: string; updatedAt: string };

const USERNAME_PATTERN = /^[A-Za-z0-9_]{4,20}$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/;

function generatePassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = letters + digits;
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (value) => all[value % all.length]);
  chars[0] = letters[bytes[0] % letters.length];
  chars[1] = digits[bytes[1] % digits.length];
  return chars.join('');
}

export default function ConsumerAccountsPage() {
  const client = useMemo(
    () =>
      new AdminApiClient(
        process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api',
      ),
    [],
  );
  const [accounts, setAccounts] = useState<AssignedAccount[]>([]);
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [issued, setIssued] = useState<{
    username: string;
    password: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleError = useCallback((cause: unknown) => {
    if (cause instanceof SessionExpiredError) {
      window.location.replace('/login');
      return;
    }
    setError(
      cause instanceof ForbiddenError
        ? '仅平台管理员可分配客户账号'
        : cause instanceof ApiRequestError
          ? cause.message
          : '服务暂时不可用，请稍后重试',
    );
  }, []);

  const load = useCallback(async () => {
    try {
      setAccounts(await client.listConsumerAccounts());
    } catch (cause) {
      handleError(cause);
    }
  }, [client, handleError]);

  useEffect(() => {
    const session = client.readSession();
    if (!session || session.actor.kind !== 'platform-admin') {
      window.location.replace('/login');
      return;
    }
    void (async () => {
      await Promise.resolve();
      await load();
    })();
  }, [client, load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setIssued(null);
    if (!/^1\d{10}$/.test(phone)) {
      setError('请输入客户的 11 位手机号');
      return;
    }
    if (!USERNAME_PATTERN.test(username)) {
      setError('账号需 4-20 位，只能包含字母、数字和下划线');
      return;
    }
    if (!PASSWORD_PATTERN.test(password)) {
      setError('密码需 8-64 位，且同时包含字母和数字');
      return;
    }
    setLoading(true);
    try {
      const result = await client.assignConsumerAccount({
        phone,
        username,
        password,
      });
      setIssued({ username: result.username, password });
      setPhone('');
      setUsername('');
      setPassword('');
      await load();
    } catch (cause) {
      handleError(cause);
    } finally {
      setLoading(false);
    }
  }

  return (
    <OpsShell
      active="consumer-accounts"
      displayName="平台管理员"
      roleLabel="平台治理"
      isPlatformAdmin
      onLogout={() => {
        void client.logout().finally(() => window.location.replace('/login'));
      }}
    >
      <header className="ops-page-head">
        <div>
          <p>平台治理</p>
          <h1>客户账号</h1>
        </div>
      </header>
      <p className="ops-login-hint">
        为官网客户统一分配账号和密码。按手机号关联到同一客户：客户用手机号验证码或账号密码登录，进入的是同一个账号。对已有账号的手机号再次提交，会改成新的账号名和密码。
      </p>

      {error && (
        <div className="ops-login-error" role="alert">
          {error}
        </div>
      )}
      {issued && (
        <div className="ops-login-hint" role="status">
          已分配：账号 <b>{issued.username}</b>，初始密码{' '}
          <b>{issued.password}</b>
          。请通过安全渠道告知客户，此密码离开本页后不会再显示。
        </div>
      )}

      <form className="ops-form" onSubmit={submit}>
        <label>
          客户手机号
          <input
            type="tel"
            inputMode="numeric"
            maxLength={11}
            placeholder="11 位手机号"
            value={phone}
            onChange={(event) =>
              setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))
            }
          />
        </label>
        <label>
          账号
          <input
            placeholder="4-20 位字母/数字/下划线"
            value={username}
            autoComplete="off"
            onChange={(event) => setUsername(event.target.value.trim())}
          />
        </label>
        <label>
          初始密码
          <span className="ops-otp-line">
            <input
              placeholder="8-64 位，含字母和数字"
              value={password}
              autoComplete="new-password"
              onChange={(event) => setPassword(event.target.value)}
            />
            <button
              type="button"
              className="ops-otp-button"
              onClick={() => setPassword(generatePassword())}
            >
              随机生成
            </button>
          </span>
        </label>
        <button className="ops-primary" disabled={loading}>
          {loading ? '提交中…' : '分配账号'}
        </button>
      </form>

      <h2>已分配账号（{accounts.length}）</h2>
      {accounts.length === 0 ? (
        <p className="ops-login-hint">暂无已分配的客户账号。</p>
      ) : (
        <table className="ops-table">
          <thead>
            <tr>
              <th>账号</th>
              <th>最近更新</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.username}</td>
                <td>{new Date(account.updatedAt).toLocaleString('zh-CN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </OpsShell>
  );
}
