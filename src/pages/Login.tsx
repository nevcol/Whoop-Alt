import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Button, useToast } from '../components/ui';
import { useSettings } from '../lib/store';

export function Login() {
  const { login } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) {
      toast('Enter a password', 'err');
      return;
    }
    setLoading(true);
    try {
      await login(password);
    } catch (err: any) {
      toast(err.message, 'err');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">L</div>
          <h1>Ledgerly</h1>
          <p className="muted">{settings?.business_name}</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="inp"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              disabled={loading}
              autoFocus
            />
          </div>
          <Button
            variant="primary"
            type="submit"
            disabled={loading}
            style={{ width: '100%' }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
