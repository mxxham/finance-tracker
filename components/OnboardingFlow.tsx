'use client';
import { useState, useEffect, useRef } from 'react';
import { useSettings } from '@/lib/SettingsContext';
import { CURRENCIES } from '@/lib/currencies';
import { showToast } from '@/components/Toast';

interface Props {
  onComplete: () => void;
  userName?: string;
}

type Step = 'welcome' | 'tour' | 'currency' | 'income' | 'payday' | 'theme' | 'seed' | 'finish';
const STEPS: Step[] = ['welcome', 'tour', 'currency', 'income', 'payday', 'theme', 'seed', 'finish'];

const THEMES = [
  { id: 'midnight', label: 'Midnight', colors: ['#5b6ef5', '#7c3aed', '#0a0a0f'] },
  { id: 'ember',    label: 'Ember',    colors: ['#f59e0b', '#ef4444', '#0f0a04'] },
  { id: 'forest',   label: 'Forest',   colors: ['#22c55e', '#10b981', '#061208'] },
  { id: 'rose',     label: 'Rose',     colors: ['#f43f5e', '#ec4899', '#0f0509'] },
  { id: 'arctic',   label: 'Arctic',   colors: ['#38bdf8', '#818cf8', '#040d14'] },
  { id: 'neon',     label: 'Neon',     colors: ['#a3e635', '#22d3ee', '#050d05'] },
  { id: 'aurora',   label: 'Aurora',   colors: ['#a78bfa', '#34d399', '#06040f'] },
  { id: 'solar',    label: 'Solar',    colors: ['#fb923c', '#fbbf24', '#0f0800'] },
];

const PAYDAY_OPTIONS = [1, 5, 10, 15, 20, 25, 28];

const TOUR_SLIDES = [
  {
    icon: '📊',
    title: 'Track everything',
    desc: 'Log income and expenses in seconds. The dashboard gives you a real-time picture of your finances.',
    color: '#5b6ef5',
    feature: ['Income & expense tracking', 'Monthly & yearly views', 'Category breakdowns'],
  },
  {
    icon: '🎯',
    title: 'Budget smarter',
    desc: "Set budgets for every category. We'll warn you when you're getting close and show a safe daily spend.",
    color: '#22c55e',
    feature: ['Per-category budgets', 'Safe daily spend calculator', 'Forecast to month-end'],
  },
  {
    icon: '💰',
    title: 'Save with goals',
    desc: 'Create savings goals with deadlines. We calculate exactly how much to save per month.',
    color: '#f59e0b',
    feature: ['Goal progress tracking', 'Monthly contribution plan', 'Deadline countdowns'],
  },
  {
    icon: '🔄',
    title: 'Automate recurring',
    desc: 'Set up salary, rent, subscriptions. Auto-post them on due date so you never miss a transaction.',
    color: '#ec4899',
    feature: ['Auto-post on due date', 'Skip or post manually', 'Overdue alerts'],
  },
  {
    icon: '📈',
    title: 'Analytics & insights',
    desc: 'See spending trends, daily burn rate, weekday patterns and category breakdowns over time.',
    color: '#38bdf8',
    feature: ['6-month trend charts', 'Weekday spending patterns', 'Category month-over-month'],
  },
];

export default function OnboardingFlow({ onComplete, userName }: Props) {
  const { updateSettings } = useSettings();
  const [step, setStep] = useState<Step>('welcome');
  const [slideDir, setSlideDir] = useState<'forward' | 'back'>('forward');
  const [animating, setAnimating] = useState(false);

  // Form state
  const [tourSlide, setTourSlide]     = useState(0);
  const [currency, setCurrency]       = useState('IDR');
  const [currencySearch, setCurrencySearch] = useState('');
  const [income, setIncome]           = useState('');
  const [payday, setPayday]           = useState(25);
  const [selectedTheme, setTheme]     = useState('midnight');
  const [seedData, setSeedData]       = useState(true);
  const [saving, setSaving]           = useState(false);

  // Animated number for income preview
  const [incomePreview, setIncomePreview] = useState(0);
  const incomeNum = Number(income) || 0;
  useEffect(() => {
    const diff = incomeNum - incomePreview;
    if (diff === 0) return;
    const step = Math.ceil(Math.abs(diff) / 12);
    const t = setTimeout(() => setIncomePreview(p => {
      if (diff > 0) return Math.min(p + step, incomeNum);
      return Math.max(p - step, incomeNum);
    }), 30);
    return () => clearTimeout(t);
  }, [incomeNum, incomePreview]);

  const goTo = (next: Step, dir: 'forward' | 'back' = 'forward') => {
    if (animating) return;
    setAnimating(true);
    setSlideDir(dir);
    setTimeout(() => {
      setStep(next);
      setAnimating(false);
    }, 220);
  };

  const next = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) goTo(STEPS[idx + 1], 'forward');
  };
  const back = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) goTo(STEPS[idx - 1], 'back');
  };

  const handleThemePreview = async (id: string) => {
    setTheme(id);
    // Preview theme instantly
    try { await updateSettings({ theme: id }); } catch {}
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await updateSettings({ currency, payday, theme: selectedTheme });
      const token = typeof window !== 'undefined' ? localStorage.getItem('ft_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch('/api/onboarding', {
        method: 'POST',
        headers,
        body: JSON.stringify({ monthly_income: seedData ? incomeNum : 0, currency, payday }),
      });
      showToast('Welcome to FinTrack! 🎉');
      onComplete();
    } catch {
      showToast('Setup failed — please try again', 'error');
    } finally {
      setSaving(false);
    }
  };

  const stepIdx = STEPS.indexOf(step);
  const pct = Math.round((stepIdx / (STEPS.length - 1)) * 100);

  const filteredCurrencies = CURRENCIES.filter(c =>
    c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
    c.name.toLowerCase().includes(currencySearch.toLowerCase())
  );

  const slideStyle: React.CSSProperties = {
    animation: animating
      ? `${slideDir === 'forward' ? 'slideOutLeft' : 'slideOutRight'} 0.22s ease forwards`
      : `${slideDir === 'forward' ? 'slideInRight' : 'slideInLeft'} 0.22s ease both`,
  };

  return (
    <>
      <style>{`
        @keyframes slideOutLeft  { to { opacity:0; transform: translateX(-40px); } }
        @keyframes slideOutRight { to { opacity:0; transform: translateX(40px); } }
        @keyframes ob-in-right   { from { opacity:0; transform: translateX(48px); } to { opacity:1; transform:none; } }
        @keyframes ob-in-left    { from { opacity:0; transform: translateX(-48px); } to { opacity:1; transform:none; } }
        @keyframes ob-float      { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes ob-pop        { 0%{transform:scale(0.85);opacity:0} 60%{transform:scale(1.06)} 100%{transform:scale(1);opacity:1} }
        @keyframes ob-shimmer    { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes ob-pulse-dot  { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.4);opacity:0.6} }
        .ob-slide-forward { animation: ob-in-right 0.25s cubic-bezier(0.25,0.46,0.45,0.94) both; }
        .ob-slide-back    { animation: ob-in-left  0.25s cubic-bezier(0.25,0.46,0.45,0.94) both; }
        .ob-icon-float    { animation: ob-float 3s ease-in-out infinite; display:inline-block; }
        .ob-pop           { animation: ob-pop  0.4s cubic-bezier(0.34,1.56,0.64,1) both; }
        .ob-currency-btn  { transition: all 0.15s ease; }
        .ob-currency-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
        .ob-theme-swatch  { transition: all 0.2s ease; cursor: pointer; }
        .ob-theme-swatch:hover { transform: scale(1.08); }
        .ob-next-btn      { transition: all 0.15s ease; }
        .ob-next-btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
        .ob-next-btn:active { transform: scale(0.97); }
        .ob-feature-item  { animation: ob-in-right 0.3s ease both; }
        .ob-shimmer-bar {
          background: linear-gradient(90deg, var(--surface-3) 25%, var(--border-2) 50%, var(--surface-3) 75%);
          background-size: 200% 100%;
          animation: ob-shimmer 1.5s infinite;
        }
      `}</style>

      {/* Overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, animation: 'fadeIn 0.3s ease both',
      }}>
        <div style={{
          width: '100%', maxWidth: 520,
          background: 'var(--surface)', border: '1px solid var(--border-2)',
          borderRadius: 24, overflow: 'hidden',
          boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05)',
          animation: 'scaleIn 0.3s cubic-bezier(0.34,1.2,0.64,1) both',
          maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        }}>

          {/* Progress bar */}
          <div style={{ height: 3, background: 'var(--surface-3)', flexShrink: 0 }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, var(--accent), var(--purple))',
              width: `${pct}%`,
              transition: 'width 0.5s cubic-bezier(0.34,1.2,0.64,1)',
              boxShadow: '0 0 8px var(--accent-glow-2)',
            }} />
          </div>

          {/* Step counter */}
          {step !== 'welcome' && step !== 'finish' && (
            <div style={{ padding: '14px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {STEPS.filter(s => s !== 'welcome' && s !== 'finish').map((s, i) => (
                  <div key={s} style={{
                    width: s === step ? 20 : 6, height: 6, borderRadius: 3,
                    background: STEPS.indexOf(s) <= stepIdx ? 'var(--accent)' : 'var(--surface-3)',
                    transition: 'all 0.3s ease',
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                Step {stepIdx} of {STEPS.length - 2}
              </span>
            </div>
          )}

          {/* Content */}
          <div
            key={step}
            className={slideDir === 'forward' ? 'ob-slide-forward' : 'ob-slide-back'}
            style={{ padding: '24px 28px 28px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}
          >

            {/* ── WELCOME ──────────────────────────────────────────── */}
            {step === 'welcome' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center', paddingTop: 8 }}>
                <div className="ob-icon-float" style={{ fontSize: 72, filter: 'drop-shadow(0 8px 24px rgba(91,110,245,0.5))' }}>
                  💎
                </div>
                <div>
                  <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.05em', marginBottom: 8, background: 'linear-gradient(135deg, var(--accent), var(--purple))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Welcome to FinTrack{userName ? `, ${userName.split(' ')[0]}` : ''}
                  </h1>
                  <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 360 }}>
                    Your personal finance command center. We'll get you set up in under 2 minutes — currency, income, theme, and a tour of every feature.
                  </p>
                </div>

                {/* Feature pills */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {['📊 Analytics', '🎯 Budgets', '💰 Savings', '🔄 Recurring', '📸 Scan receipts'].map((f, i) => (
                    <div key={f} className="ob-pop" style={{
                      padding: '6px 12px', borderRadius: 20,
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                      fontSize: 12, fontWeight: 600, color: 'var(--text-soft)',
                      animationDelay: `${i * 0.08}s`,
                    }}>{f}</div>
                  ))}
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, width: '100%' }}>
                  {[['🔒', 'Private', 'Data stays yours'], ['⚡', 'Fast', 'Instant updates'], ['🎨', '20 themes', 'Full customization']].map(([icon, title, sub]) => (
                    <div key={title} style={{ padding: '12px 10px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-soft)' }}>{title}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>
                    </div>
                  ))}
                </div>

                <button className="ob-next-btn" onClick={next} style={{
                  width: '100%', padding: '15px', borderRadius: 14, fontSize: 15, fontWeight: 800,
                  background: 'linear-gradient(135deg, var(--accent), var(--purple))',
                  color: 'white', border: 'none',
                  boxShadow: '0 8px 24px var(--accent-glow-2)',
                  letterSpacing: '-0.01em',
                }}>
                  Let's get started →
                </button>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -8 }}>Takes less than 2 minutes</p>
              </div>
            )}

            {/* ── TOUR ──────────────────────────────────────────────── */}
            {step === 'tour' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                    Feature Tour · {tourSlide + 1} / {TOUR_SLIDES.length}
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>What can FinTrack do?</h2>
                </div>

                {/* Slide */}
                <div key={tourSlide} style={{
                  padding: '24px 20px', borderRadius: 16,
                  background: `linear-gradient(135deg, ${TOUR_SLIDES[tourSlide].color}18, var(--surface-2))`,
                  border: `1.5px solid ${TOUR_SLIDES[tourSlide].color}30`,
                  animation: 'ob-in-right 0.25s ease both',
                }}>
                  <div style={{ fontSize: 48, marginBottom: 12, display: 'block', animation: 'ob-pop 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                    {TOUR_SLIDES[tourSlide].icon}
                  </div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6, color: TOUR_SLIDES[tourSlide].color }}>
                    {TOUR_SLIDES[tourSlide].title}
                  </h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 14 }}>
                    {TOUR_SLIDES[tourSlide].desc}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {TOUR_SLIDES[tourSlide].feature.map((f, i) => (
                      <div key={f} className="ob-feature-item" style={{ display: 'flex', alignItems: 'center', gap: 8, animationDelay: `${i * 0.07 + 0.1}s` }}>
                        <div style={{ width: 18, height: 18, borderRadius: 9, background: TOUR_SLIDES[tourSlide].color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 10, color: 'white', fontWeight: 800 }}>✓</span>
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-soft)' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Slide dots */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  {TOUR_SLIDES.map((_, i) => (
                    <button key={i} onClick={() => setTourSlide(i)} style={{
                      width: i === tourSlide ? 24 : 8, height: 8, borderRadius: 4,
                      background: i === tourSlide ? TOUR_SLIDES[i].color : 'var(--surface-3)',
                      border: 'none', cursor: 'pointer', padding: 0,
                      transition: 'all 0.3s ease',
                    }} />
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => tourSlide > 0 ? setTourSlide(t => t - 1) : back()} style={{ flex: 1, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>← Back</button>
                  {tourSlide < TOUR_SLIDES.length - 1 ? (
                    <button className="ob-next-btn" onClick={() => setTourSlide(t => t + 1)} style={{ flex: 2, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: TOUR_SLIDES[tourSlide].color, color: 'white', border: 'none' }}>
                      Next feature →
                    </button>
                  ) : (
                    <button className="ob-next-btn" onClick={next} style={{ flex: 2, padding: '11px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg, var(--accent), var(--purple))', color: 'white', border: 'none', boxShadow: '0 4px 16px var(--accent-glow-2)' }}>
                      Set up my account →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── CURRENCY ─────────────────────────────────────────── */}
            {step === 'currency' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 40, marginBottom: 8 }} className="ob-pop">💱</div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Choose your currency</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>All amounts and charts will use this currency. You can change it later in Settings.</p>
                </div>
                <input
                  value={currencySearch}
                  onChange={e => setCurrencySearch(e.target.value)}
                  placeholder="Search currencies…"
                  style={{ fontSize: 13 }}
                  autoFocus
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, maxHeight: 240, overflowY: 'auto', paddingRight: 2 }}>
                  {filteredCurrencies.map(c => (
                    <button key={c.code} className="ob-currency-btn" onClick={() => setCurrency(c.code)} style={{
                      padding: '10px 12px', borderRadius: 10,
                      border: `1.5px solid ${currency === c.code ? 'var(--accent)' : 'var(--border)'}`,
                      background: currency === c.code ? 'var(--accent-glow)' : 'var(--surface-2)',
                      display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                    }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: currency === c.code ? 'var(--accent)' : 'var(--text-muted)', minWidth: 24 }}>{c.symbol}</span>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: currency === c.code ? 'var(--accent)' : 'var(--text)' }}>{c.code}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                      </div>
                      {currency === c.code && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 14, flexShrink: 0 }}>✓</span>}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={back} style={{ flex: 1, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>← Back</button>
                  <button className="ob-next-btn" onClick={next} style={{ flex: 2, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg, var(--accent), var(--purple))', color: 'white', border: 'none', boxShadow: '0 4px 16px var(--accent-glow-2)' }}>
                    Use {currency} →
                  </button>
                </div>
              </div>
            )}

            {/* ── INCOME ───────────────────────────────────────────── */}
            {step === 'income' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 40, marginBottom: 8 }} className="ob-pop">💵</div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Monthly income</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Used to calculate savings rates, budget ratios and spending alerts. Completely private.</p>
                </div>
                <input
                  type="number"
                  value={income}
                  onChange={e => setIncome(e.target.value)}
                  placeholder="0"
                  autoFocus
                  style={{ fontSize: 28, fontWeight: 900, fontFamily: 'var(--font-mono)', letterSpacing: '-0.04em' }}
                />

                {/* Live preview */}
                {incomeNum > 0 && (
                  <div className="ob-pop" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                    {[
                      { label: '50% needs', val: incomePreview * 0.5, color: '#f87171' },
                      { label: '30% wants', val: incomePreview * 0.3, color: '#fbbf24' },
                      { label: '20% savings', val: incomePreview * 0.2, color: '#4ade80' },
                    ].map(item => (
                      <div key={item.label} style={{ padding: '10px 8px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', textAlign: 'center' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{item.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-mono)', color: item.color }}>
                          {Math.round(item.val).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {incomeNum > 0 && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: -4 }}>Based on the 50/30/20 budgeting rule</p>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={back} style={{ flex: 1, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>← Back</button>
                  <button className="ob-next-btn" onClick={next} style={{ flex: 2, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg, var(--accent), var(--purple))', color: 'white', border: 'none', boxShadow: '0 4px 16px var(--accent-glow-2)' }}>
                    {incomeNum > 0 ? 'Continue →' : 'Skip for now →'}
                  </button>
                </div>
              </div>
            )}

            {/* ── PAYDAY ───────────────────────────────────────────── */}
            {step === 'payday' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 40, marginBottom: 8 }} className="ob-pop">📅</div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>When do you get paid?</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>We use your payday to calculate safe daily spend and show countdowns in the budget page.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {PAYDAY_OPTIONS.map(d => (
                    <button key={d} onClick={() => setPayday(d)} style={{
                      padding: '16px 8px', borderRadius: 12,
                      border: `2px solid ${payday === d ? 'var(--accent)' : 'var(--border)'}`,
                      background: payday === d ? 'var(--accent-glow)' : 'var(--surface-2)',
                      color: payday === d ? 'var(--accent)' : 'var(--text-soft)',
                      fontWeight: 800, fontSize: 20, fontFamily: 'var(--font-mono)',
                      transition: 'all 0.15s ease',
                      boxShadow: payday === d ? '0 4px 12px var(--accent-glow-2)' : 'none',
                    }}>
                      {d}
                    </button>
                  ))}
                </div>
                <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                  📅 You get paid on the <strong style={{ color: 'var(--accent)' }}>{payday}{['th','st','nd','rd'][[11,12,13].includes(payday) ? 0 : Math.min(payday % 10, 3)] || 'th'}</strong> of each month
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={back} style={{ flex: 1, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>← Back</button>
                  <button className="ob-next-btn" onClick={next} style={{ flex: 2, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg, var(--accent), var(--purple))', color: 'white', border: 'none', boxShadow: '0 4px 16px var(--accent-glow-2)' }}>Continue →</button>
                </div>
              </div>
            )}

            {/* ── THEME ────────────────────────────────────────────── */}
            {step === 'theme' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 40, marginBottom: 8 }} className="ob-pop">🎨</div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Pick your theme</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Live preview — tap any theme to apply it instantly. Change anytime in Settings.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                  {THEMES.map(th => (
                    <button key={th.id} className="ob-theme-swatch" onClick={() => handleThemePreview(th.id)} style={{
                      padding: '14px 10px', borderRadius: 12,
                      border: `2px solid ${selectedTheme === th.id ? 'white' : 'transparent'}`,
                      background: th.colors[2],
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      boxShadow: selectedTheme === th.id ? `0 0 0 3px ${th.colors[0]}, 0 8px 24px rgba(0,0,0,0.5)` : '0 2px 8px rgba(0,0,0,0.3)',
                    }}>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {th.colors.slice(0, 2).map((c, i) => (
                          <div key={i} style={{ width: 14, height: 14, borderRadius: 7, background: c }} />
                        ))}
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.04em' }}>{th.label}</span>
                      {selectedTheme === th.id && (
                        <div style={{ width: 16, height: 16, borderRadius: 8, background: th.colors[0], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 9, color: 'white', fontWeight: 800 }}>✓</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={back} style={{ flex: 1, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>← Back</button>
                  <button className="ob-next-btn" onClick={next} style={{ flex: 2, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg, var(--accent), var(--purple))', color: 'white', border: 'none', boxShadow: '0 4px 16px var(--accent-glow-2)' }}>
                    Love it, continue →
                  </button>
                </div>
              </div>
            )}

            {/* ── SEED DATA ────────────────────────────────────────── */}
            {step === 'seed' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontSize: 40, marginBottom: 8 }} className="ob-pop">✨</div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Start with sample data?</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    We'll populate your dashboard with realistic transactions{incomeNum > 0 ? ` based on your ${incomeNum.toLocaleString()} income` : ''} so every chart and card has real data from day one.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { val: true,  icon: '🚀', label: 'Yes — populate my dashboard', sub: 'Adds salary, rent, food, transport & more. Delete any time.', accent: true },
                    { val: false, icon: '🗒️', label: 'No — start completely fresh', sub: 'Blank slate. Add your own transactions from scratch.', accent: false },
                  ].map(opt => (
                    <button key={String(opt.val)} onClick={() => setSeedData(opt.val)} style={{
                      padding: '16px 16px', borderRadius: 14,
                      border: `2px solid ${seedData === opt.val ? 'var(--accent)' : 'var(--border)'}`,
                      background: seedData === opt.val ? 'var(--accent-glow)' : 'var(--surface-2)',
                      display: 'flex', alignItems: 'flex-start', gap: 14, textAlign: 'left',
                      boxShadow: seedData === opt.val ? '0 4px 16px var(--accent-glow-2)' : 'none',
                      transition: 'all 0.2s ease',
                    }}>
                      <span style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>{opt.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: seedData === opt.val ? 'var(--accent)' : 'var(--text)', marginBottom: 4 }}>{opt.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{opt.sub}</div>
                      </div>
                      {seedData === opt.val && <span style={{ color: 'var(--accent)', fontSize: 18, flexShrink: 0 }}>✓</span>}
                    </button>
                  ))}
                </div>

                {seedData && incomeNum > 0 && (
                  <div className="ob-pop" style={{ padding: '12px 14px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-soft)', marginBottom: 6 }}>Sample transactions we'll create:</div>
                    {[
                      ['Monthly Salary', Math.round(incomeNum), 'income'],
                      ['Monthly Rent', Math.round(incomeNum * 0.3), 'expense'],
                      ['Groceries', Math.round(incomeNum * 0.12), 'expense'],
                      ['Transport', Math.round(incomeNum * 0.06), 'expense'],
                      ['Bills & Utilities', Math.round(incomeNum * 0.05), 'expense'],
                    ].map(([desc, amt, type]) => (
                      <div key={String(desc)} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                        <span>{desc}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: type === 'income' ? 'var(--green)' : 'var(--red)' }}>
                          {type === 'income' ? '+' : '-'}{Number(amt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={back} style={{ flex: 1, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>← Back</button>
                  <button className="ob-next-btn" onClick={next} style={{ flex: 2, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg, var(--accent), var(--purple))', color: 'white', border: 'none', boxShadow: '0 4px 16px var(--accent-glow-2)' }}>
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* ── FINISH ───────────────────────────────────────────── */}
            {step === 'finish' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 72, animation: 'ob-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>🎉</div>
                <div>
                  <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 8 }}>You're all set!</h2>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                    Your FinTrack is configured. Here are some quick tips to get the most out of it:
                  </p>
                </div>

                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { icon: '💸', tip: 'Add a transaction', desc: 'Tap + in the Transactions page or use the quick-add button on the dashboard', color: '#5b6ef5' },
                    { icon: '🎯', tip: 'Create a budget', desc: 'Go to Budgets → add categories like Food, Transport, Entertainment', color: '#22c55e' },
                    { icon: '💰', tip: 'Set a savings goal', desc: 'Go to Savings → set a target amount and deadline', color: '#f59e0b' },
                    { icon: '📸', tip: 'Scan a receipt', desc: 'Use the Scan tab to auto-detect amounts from photos', color: '#ec4899' },
                  ].map((item, i) => (
                    <div key={item.tip} className="ob-feature-item" style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '12px 14px', borderRadius: 12,
                      background: 'var(--surface-2)', border: '1px solid var(--border)',
                      textAlign: 'left', animationDelay: `${i * 0.08}s`,
                    }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: item.color + '20', border: `1px solid ${item.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                        {item.icon}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{item.tip}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  className="ob-next-btn"
                  onClick={handleFinish}
                  disabled={saving}
                  style={{
                    width: '100%', padding: '16px', borderRadius: 14, fontSize: 15, fontWeight: 800,
                    background: saving ? 'var(--surface-3)' : 'linear-gradient(135deg, var(--accent), var(--purple))',
                    color: saving ? 'var(--text-muted)' : 'white', border: 'none',
                    boxShadow: saving ? 'none' : '0 8px 24px var(--accent-glow-2)',
                    letterSpacing: '-0.01em', cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  {saving ? (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                      Setting up your account…
                    </span>
                  ) : 'Go to my dashboard →'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
