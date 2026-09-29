import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api.js';

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api.post('/auth/login', { username, password });
      setToken(data.token);
      onLogin(data.user);
      navigate(data.user.role === 'resident' ? '/resident' : '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <div className="auth-mark">V</div>
          <div>
            <div className="auth-title">Hostel Gate</div>
            <div className="auth-sub">Resident verification &amp; operations console</div>
          </div>
        </div>

        <div className="field">
          <label>Username</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin or guard"
            autoFocus
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            className="input"
            type="password"
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
  );
}
