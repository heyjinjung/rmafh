import { useEffect, useState } from 'react';

const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:18000';

export default function Home() {
  const [health, setHealth] = useState('checking...');
  const [error, setError] = useState('');

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${apiBase}/health`);
        if (!res.ok) {
          throw new Error(`status ${res.status}`);
        }
        const data = await res.json();
        setHealth(data.status);
      } catch (err) {
        setError(err.message);
        setHealth('unreachable');
      }
    };
    check();
  }, []);

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <h1 style={styles.title}>Vault v2.0</h1>
        <p style={styles.subtitle}>Frontend placeholder (Next.js)</p>
        <div style={styles.health}>
          <span>API health:</span>
          <strong style={{ color: health === 'ok' ? '#0b8a56' : '#b34700' }}>{health}</strong>
        </div>
        {error && <p style={styles.error}>Error: {error}</p>}
        <p style={styles.helper}>API base: {apiBase}</p>
      </div>
    </main>
  );
}

const styles = {
  main: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0b8a56 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#e2e8f0',
    fontFamily: 'Arial, sans-serif',
    padding: '24px',
  },
  card: {
    background: 'rgba(15, 23, 42, 0.9)',
    border: '1px solid rgba(148, 163, 184, 0.2)',
    borderRadius: '12px',
    padding: '24px',
    maxWidth: '420px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
  },
  title: { margin: '0 0 8px', fontSize: '28px' },
  subtitle: { margin: '0 0 16px', color: '#94a3b8' },
  health: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '8px',
    fontSize: '16px'
  },
  helper: { color: '#cbd5e1', fontSize: '12px', marginTop: '8px' },
  error: { color: '#fca5a5', fontSize: '12px' },
};
