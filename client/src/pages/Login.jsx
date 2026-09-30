import React, { useState } from 'react';
import Brand from '../components/Brand.jsx';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api.js';

export default function Login({ onLogin, onLoadingChange }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    onLoadingChange?.(true);
    try {
      const data = await api.post('/auth/login', { username, password });
      setToken(data.token);
      onLogin(data.user);
      navigate(data.user.role === 'resident' ? '/resident' : '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      onLoadingChange?.(false);
    }
  }

  return (
    <div className="auth-shell login-shell">
      <div className="login-layout">
        <section className="login-story">
          <Brand className="login-logo" />
          <div className="eyebrow">A place to belong</div>
          <h1>Student living.<br /><span>Simply connected.</span></h1>
          <p>Your home, your community, and the everyday details — all in one place.</p>
          <div className="login-features"><span>Resident care</span><span>Seamless visits</span><span>Smarter operations</span></div>
          <div className="login-story-footer">NEW NANA <span>HOSTEL</span></div>
        </section>
      <form className="auth-card" onSubmit={submit}>
        <div className="eyebrow">Your New Nana Hostel workspace</div>
        <h2 className="auth-title">Welcome back.</h2>
        <p className="auth-sub">Sign in to manage your day at New Nana Hostel.</p>

        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            className="input"
            id="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin or guard"
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            className="input"
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        {error && (
          <div className="toast error" style={{ marginBottom: 14, position: 'static' }}>
            {error}
          </div>
        )}

        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <div style={{ marginTop: 18, fontSize: 11, color: 'var(--text-faint)', textAlign: 'center' }}>
          Demo logins — admin/admin123 · guard/guard123 · john/resident123
        </div>
      </form>
      </div>
    </div>
  );
}
