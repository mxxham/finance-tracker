'use client';
import { useState, FormEvent, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, user } = useAuth();
  const router = useRouter();

  useEffect(() => { if (user) router.push('/dashboard'); }, [user, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') await login(email, password);
      else await register(name, email, password);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: 'var(--bg)', position: 'relative', overflow: 'hidden',
    }}>
      {/* Background ambient glows */}
      <div style={{
        position: 'absolute', top: '20%', left: '30%', width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(91,110,245,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '20%', width: 400, height: 400,
        background: 'radial-gradient(circle, rgba(167,139,250,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Grid pattern */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.025,
        backgroundImage: 'linear-gradient(var(--border-2) 1px, transparent 1px), linear-gradient(90deg, var(--border-2) 1px, transparent 1px)',
        backgroundSize: '48px 48px', pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 10, animation: 'fadeUp 0.4s ease both' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48, borderRadius: 14, background: 'var(--accent)',
            fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 16,
            boxShadow: '0 0 32px rgba(91,110,245,0.35)',
          }}>F</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.04em', marginBottom: 6 }}>FinTrack</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', letterSpacing: '-0.01em' }}>
            {mode === 'login' ? 'Welcome back' : 'Start tracking your finances'}
          </div>
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 20, padding: 28, boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}>
          {/* Mode Toggle */}
          <div style={{
            display: 'flex', background: 'var(--surface-2)', borderRadius: 10, padding: 4, marginBottom: 24,
            border: '1px solid var(--border)',
          }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }} style={{
                flex: 1, padding: '8px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                background: mode === m ? 'var(--accent)' : 'transparent',
                color: mode === m ? 'white' : 'var(--text-muted)',
                border: 'none', letterSpacing: '-0.01em',
                boxShadow: mode === m ? '0 2px 8px rgba(91,110,245,0.3)' : 'none',
                transition: 'all 0.2s ease',
              }}>{m === 'login' ? 'Sign In' : 'Sign Up'}</button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'register' && (
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 6, letterSpacing: '-0.01em' }}>Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required />
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 6, letterSpacing: '-0.01em' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 6, letterSpacing: '-0.01em' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12,
                  padding: 4, cursor: 'pointer',
                }}>{showPw ? 'hide' : 'show'}</button>
              </div>
            </div>

            {error && (
              <div style={{
                padding: '10px 14px', borderRadius: 9, fontSize: 13,
                background: 'var(--red-muted)', color: 'var(--red)',
                border: '1px solid rgba(240,82,82,0.25)', letterSpacing: '-0.01em',
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '12px', borderRadius: 11, fontSize: 14, fontWeight: 700,
              color: 'white', background: loading ? 'var(--surface-3)' : 'var(--accent)',
              border: 'none', marginTop: 4, letterSpacing: '-0.02em',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(91,110,245,0.3)',
              transition: 'all 0.2s ease',
              transform: loading ? 'none' : undefined,
            }}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Please wait…
                </span>
              ) : mode === 'login' ? 'Sign In →' : 'Create Account →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
          Your data is stored locally and privately.
        </p>
      </div>
    </div>
  );
}
