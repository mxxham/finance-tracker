'use client';
import { useState, FormEvent, useEffect, useRef } from 'react';
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
  const orbARef = useRef<HTMLDivElement>(null);
  const orbBRef = useRef<HTMLDivElement>(null);
  const gridRef  = useRef<HTMLDivElement>(null);

  useEffect(() => { if (user) router.push('/dashboard'); }, [user, router]);

  // Parallax grid + orb on mouse move
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const cx = e.clientX / window.innerWidth  - 0.5;
      const cy = e.clientY / window.innerHeight - 0.5;
      if (gridRef.current) {
        gridRef.current.style.transform = `translate(${cx * -8}px, ${cy * -6}px)`;
      }
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

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

  const addRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'ripple-dot';
    dot.style.left = `${e.clientX - rect.left - 5}px`;
    dot.style.top  = `${e.clientY - rect.top  - 5}px`;
    btn.appendChild(dot);
    setTimeout(() => dot.remove(), 650);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: 'var(--bg)', position: 'relative', overflow: 'hidden',
    }}>
      {/* Floating ambient orbs */}
      <div ref={orbARef} className="landing-orb" style={{
        position: 'absolute', top: '15%', left: '25%', width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(91,110,245,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
        animation: 'floatA 10s ease-in-out infinite',
      }} />
      <div ref={orbBRef} className="landing-orb" style={{
        position: 'absolute', bottom: '8%', right: '15%', width: 480, height: 480,
        background: 'radial-gradient(circle, rgba(167,139,250,0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
        animation: 'floatB 14s ease-in-out infinite',
      }} />
      <div className="landing-orb" style={{
        position: 'absolute', top: '55%', left: '55%', width: 300, height: 300,
        background: 'radial-gradient(circle, rgba(34,212,122,0.03) 0%, transparent 70%)',
        pointerEvents: 'none',
        animation: 'floatA 18s ease-in-out infinite reverse',
      }} />

      {/* Parallax grid */}
      <div ref={gridRef} className="landing-grid" style={{
        position: 'absolute', inset: '-20px', opacity: 0.028,
        backgroundImage: 'linear-gradient(var(--border-2) 1px, transparent 1px), linear-gradient(90deg, var(--border-2) 1px, transparent 1px)',
        backgroundSize: '48px 48px', pointerEvents: 'none',
        transition: 'transform 0.12s ease',
        willChange: 'transform',
      }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative', zIndex: 10, animation: 'fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36, animation: 'fadeUp 0.4s ease both' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 52, height: 52, borderRadius: 15, background: 'var(--accent)',
            fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 16,
            animation: 'pulse-calm 4s ease infinite',
            boxShadow: '0 0 40px rgba(91,110,245,0.35)',
          }}>F</div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.04em', marginBottom: 6 }}>FinTrack</div>
          <div className="animate-fadeIn" style={{ fontSize: 13, color: 'var(--text-muted)', letterSpacing: '-0.01em', animationDelay: '0.15s' }}>
            {mode === 'login' ? 'Welcome back' : 'Start tracking your finances'}
          </div>
        </div>

        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 20, padding: 28,
          boxShadow: '0 24px 80px rgba(0,0,0,0.55)',
          animation: 'flipIn 0.42s cubic-bezier(0.22,1,0.36,1) both',
          animationDelay: '0.05s',
        }}>
          {/* Mode Toggle */}
          <div style={{
            display: 'flex', background: 'var(--surface-2)', borderRadius: 10,
            padding: 4, marginBottom: 24, border: '1px solid var(--border)', position: 'relative',
          }}>
            {/* Sliding pill */}
            <div style={{
              position: 'absolute', top: 4, bottom: 4,
              width: 'calc(50% - 4px)',
              left: mode === 'login' ? 4 : 'calc(50%)',
              borderRadius: 7, background: 'var(--accent)',
              boxShadow: '0 2px 10px rgba(91,110,245,0.35)',
              transition: 'left 0.28s cubic-bezier(0.34,1.1,0.64,1)',
              pointerEvents: 'none',
            }} />
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError(''); }} style={{
                flex: 1, padding: '8px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                background: 'transparent',
                color: mode === m ? 'white' : 'var(--text-muted)',
                border: 'none', letterSpacing: '-0.01em', position: 'relative', zIndex: 1,
                transition: 'color 0.2s ease',
              }}>{m === 'login' ? 'Sign In' : 'Sign Up'}</button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'register' && (
              <div className="animate-slideInUp" style={{ animationDuration: '0.28s' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 6, letterSpacing: '-0.01em' }}>Full Name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" required />
              </div>
            )}
            <div className="animate-fadeIn stagger-1">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 6, letterSpacing: '-0.01em' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="animate-fadeIn stagger-2">
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-soft)', marginBottom: 6, letterSpacing: '-0.01em' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={{ paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPw(v => !v)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, padding: 4,
                }}>{showPw ? 'hide' : 'show'}</button>
              </div>
            </div>

            {error && (
              <div className="animate-shake" style={{
                padding: '10px 14px', borderRadius: 9, fontSize: 13,
                background: 'var(--red-muted)', color: 'var(--red)',
                border: '1px solid rgba(240,82,82,0.25)', letterSpacing: '-0.01em',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              onClick={!loading ? addRipple : undefined}
              className="btn-ripple animate-fadeIn stagger-3"
              style={{
                width: '100%', padding: '12px', borderRadius: 11, fontSize: 14, fontWeight: 700,
                color: 'white', background: loading ? 'var(--surface-3)' : 'var(--accent)',
                border: 'none', marginTop: 4, letterSpacing: '-0.02em',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(91,110,245,0.3)',
                transition: 'all 0.2s ease',
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Please wait…
                </span>
              ) : mode === 'login' ? 'Sign In →' : 'Create Account →'}
            </button>
          </form>
        </div>

        <p className="animate-fadeIn stagger-4" style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-muted)' }}>
          Your data is stored locally and privately.
        </p>
      </div>
    </div>
  );
}