import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Loader2 } from 'lucide-react';
import { login } from '../utils/authService';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setError(result.error || 'Login failed. Please try again.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <img src="/logo.png" alt="Logo" style={styles.logo} onError={(e) => e.target.style.display='none'} />
          <h1 style={styles.title}>Admin Portal</h1>
          <p style={styles.subtitle}>Sign in to manage inventory</p>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputGroup}>
            <User size={18} style={styles.icon} />
            <input
              type="text"
              placeholder="Username"
              style={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div style={styles.inputGroup}>
            <Lock size={18} style={styles.icon} />
            <input
              type="password"
              placeholder="Password"
              style={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button type="submit" style={{...styles.button, opacity: loading ? 0.7 : 1}} disabled={loading}>
            {loading
              ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} /> Verifying...</>
              : 'Secure Login'
            }
          </button>
        </form>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-main)',
    padding: '20px',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    background: 'var(--bg-card)',
    padding: '40px',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border-color)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  logo: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    marginBottom: '16px',
    objectFit: 'cover',
  },
  title: {
    fontSize: '1.8rem',
    color: 'var(--text-main)',
    fontWeight: 800,
  },
  subtitle: {
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    marginTop: '4px',
  },
  error: {
    background: '#fee2e2',
    color: '#ef4444',
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    marginBottom: '20px',
    fontSize: '0.9rem',
    textAlign: 'center',
    fontWeight: 600,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputGroup: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  icon: {
    position: 'absolute',
    left: '14px',
    color: 'var(--text-muted)',
  },
  input: {
    width: '100%',
    padding: '12px 14px 12px 40px',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    background: '#f8fafc',
    color: 'var(--text-main)',
    fontSize: '1rem',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  button: {
    background: 'var(--neon-green-dark)',
    color: '#fff',
    border: 'none',
    padding: '14px',
    borderRadius: 'var(--radius-md)',
    fontSize: '1rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginTop: '10px',
    transition: 'opacity 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  }
};
