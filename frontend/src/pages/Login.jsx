import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const { refreshUser } = useAuth();

  const handleLogin = async () => {
  if (!username || !password) {
    setError('Please enter both username and password');
    return;
  }
  setLoading(true);
  setError('');
  try {
    await login(username, password);
    refreshUser();
    navigate('/');
  } catch (err) {
    // FR01, NFR15: show the server's message only for a locked account
    // (worded in CustomTokenObtainPairSerializer); every other failure
    // keeps the generic message.
    const detail = err?.response?.data?.detail;
    if (typeof detail === 'string' && detail.startsWith('This account is locked')) {
      setError(detail);
    } else {
      setError('Invalid username or password. Please try again.');
    }
  } finally {
    setLoading(false);
  }
};

  // Allow login with Enter key
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoRow}>
          <div style={styles.logoIcon}>📡</div>
          <div>
            <div style={styles.logoText}>EarlySense</div>
            <div style={styles.logoSub}>Sol Plaatje University · CSIT</div>
          </div>
        </div>

        <h1 style={styles.title}>Welcome back</h1>
        <p style={styles.subtitle}>
          Sign in to the AI-Driven Learner Retention System
        </p>

        {/* Error message */}
        {error && <div style={styles.error}>{error}</div>}

        {/* Username */}
        <label style={styles.label}>USERNAME</label>
        <input
          style={styles.input}
          type="text"
          placeholder="Enter your username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {/* Password */}
        <label style={styles.label}>PASSWORD</label>
        <input
          style={styles.input}
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        {/* Login Button */}
        <button
          style={{
            ...styles.btn,
            opacity: loading ? 0.7 : 1,
          }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign In to EarlySense'}
        </button>

        <div style={styles.hint}>
          Access is restricted to authorised staff only.
          Contact your System Administrator to create an account.
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#0f1923',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Arial, sans-serif',
  },
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
    padding: '48px 44px',
    width: '400px',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '28px',
  },
  logoIcon: {
    width: '44px',
    height: '44px',
    background: 'linear-gradient(135deg,#dc2626,#991b1b)',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
  },
  logoText: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#fff',
  },
  logoSub: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.4)',
    marginTop: '2px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#fff',
    margin: '0 0 6px 0',
  },
  subtitle: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.45)',
    marginBottom: '24px',
  },
  error: {
    background: 'rgba(220,38,38,0.15)',
    border: '1px solid rgba(220,38,38,0.4)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#fca5a5',
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: '0.8px',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    padding: '12px 16px',
    fontSize: '14px',
    color: '#fff',
    outline: 'none',
    marginBottom: '16px',
    boxSizing: 'border-box',
  },
  btn: {
    width: '100%',
    background: 'linear-gradient(135deg,#dc2626,#b91c1c)',
    border: 'none',
    borderRadius: '10px',
    padding: '14px',
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#fff',
    cursor: 'pointer',
    marginTop: '4px',
  },
  hint: {
    textAlign: 'center',
    marginTop: '20px',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.3)',
    lineHeight: '1.5',
  },
};