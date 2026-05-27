'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSettings } from '@/lib/SettingsContext';
import { CURRENCIES } from '@/lib/currencies';
import { showToast } from '@/components/Toast';

interface Props { onComplete: () => void; userName?: string; }

type Step = 'welcome' | 'tour' | 'currency' | 'income' | 'payday' | 'theme' | 'budgets' | 'finish';
const STEPS: Step[] = ['welcome', 'tour', 'currency', 'income', 'payday', 'theme', 'budgets', 'finish'];

const THEMES = [
  { id: 'midnight', label: 'Midnight', a: '#5b6ef5', b: '#7c3aed', bg: '#0a0a0f' },
  { id: 'ember',    label: 'Ember',    a: '#f59e0b', b: '#ef4444', bg: '#0f0a04' },
  { id: 'forest',   label: 'Forest',   a: '#22c55e', b: '#10b981', bg: '#061208' },
  { id: 'rose',     label: 'Rose',     a: '#f43f5e', b: '#ec4899', bg: '#0f0509' },
  { id: 'arctic',   label: 'Arctic',   a: '#38bdf8', b: '#818cf8', bg: '#040d14' },
  { id: 'neon',     label: 'Neon',     a: '#a3e635', b: '#22d3ee', bg: '#050d05' },
  { id: 'aurora',   label: 'Aurora',   a: '#a78bfa', b: '#34d399', bg: '#06040f' },
  { id: 'solar',    label: 'Solar',    a: '#fb923c', b: '#fbbf24', bg: '#0f0800' },
];

const PAYDAY_OPTIONS = [1, 5, 10, 15, 20, 25, 28];

interface BudgetItem { category: string; color: string; amount: string; enabled: boolean; }

const DEFAULT_BUDGETS: BudgetItem[] = [
  { category: 'Food & Drink',          color: '#f97316', amount: '', enabled: true  },
  { category: 'Transport & Rideshare', color: '#3b82f6', amount: '', enabled: true  },
  { category: 'Shopping',              color: '#a855f7', amount: '', enabled: false },
  { category: 'Entertainment',         color: '#ec4899', amount: '', enabled: false },
  { category: 'Bills & Utilities',     color: '#eab308', amount: '', enabled: true  },
  { category: 'Rent & Housing',        color: '#06b6d4', amount: '', enabled: false },
  { category: 'Health',                color: '#ef4444', amount: '', enabled: false },
  { category: 'Phone & Internet',      color: '#14b8a6', amount: '', enabled: false },
];

const TOUR_SLIDES = [
  {
    title: 'Your financial command center',
    desc: 'The dashboard shows your balance, spending trends, and budget health — all updating in real time.',
    color: '#5b6ef5',
    features: ['Live balance and net worth', 'Monthly income vs expenses', 'Budget health overview'],
    visual: () => (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {([['Balance', '12,400,000', '#4ade80'], ['Expenses', '4,200,000', '#f87171'], ['Saved', '2,100,000', '#818cf8'], ['Net', '+8,200,000', '#fbbf24']] as const).map(([l, v, c]) => (
          <div key={l} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{l}</div>
            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace', color: c }}>{v}</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Log every transaction fast',
    desc: 'Tap the + Add button in Transactions to add income or expenses. Assign a category, date, and amount in seconds.',
    color: '#22c55e',
    features: ['Tap  + Add Transaction  to start', 'Pick a category with one tap', 'Export to CSV or PDF anytime'],
    visual: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {([['Salary', '+5,000,000', '#4ade80', 'Jun 1'], ['Groceries', '-450,000', '#f87171', 'Jun 3'], ['Transport', '-85,000', '#f87171', 'Jun 5']] as const).map(([d, a, c, dt]) => (
          <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: c, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{d}</span>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{dt}</span>
            <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: c }}>{a}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '9px', borderRadius: 10, border: '2px dashed rgba(34,197,94,0.5)', marginTop: 2 }}>
          <div style={{ width: 20, height: 20, borderRadius: 10, background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'white', fontSize: 15, lineHeight: 1 }}>+</div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>Tap here to add a transaction</span>
        </div>
      </div>
    ),
  },
  {
    title: 'Stay on track with budgets',
    desc: 'Set a spending limit per category. FinTrack shows your safe daily spend and warns before you overspend.',
    color: '#f59e0b',
    features: ['Go to  Budgets  tab to create limits', 'Safe daily spend auto-calculated', 'Red alert when nearing the limit'],
    visual: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {([['Food & Drink', 72, '#f97316'], ['Transport', 45, '#3b82f6'], ['Entertainment', 91, '#ec4899']] as const).map(([cat, pct, col]) => (
          <div key={cat}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
              <span>{cat}</span>
              <span style={{ color: pct > 80 ? '#f87171' : 'rgba(255,255,255,0.45)' }}>{pct}%{pct > 80 ? ' !' : ''}</span>
            </div>
            <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.08)' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 4, background: pct > 80 ? '#ef4444' : col }} />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: 'Build goals that actually happen',
    desc: 'Set a savings target and deadline. FinTrack calculates the exact monthly contribution to hit it on time.',
    color: '#8b5cf6',
    features: ['Go to  Savings  tab to create a goal', 'Set a target amount and deadline', 'Track progress in real time'],
    visual: () => (
      <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(139,92,246,0.15)', border: '1.5px solid rgba(139,92,246,0.3)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 10 }}>New iPhone — Target: 15,000,000</div>
        <div style={{ height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.1)', marginBottom: 8, overflow: 'hidden' }}>
          <div style={{ width: '43%', height: '100%', borderRadius: 5, background: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
          <span>Saved: 6,450,000</span>
          <span style={{ color: '#a78bfa', fontWeight: 700 }}>43%</span>
        </div>
        <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(139,92,246,0.2)', fontSize: 11, color: '#a78bfa', fontWeight: 600, textAlign: 'center' }}>
          Save 1,425,000/month to reach goal by Dec 2025
        </div>
      </div>
    ),
  },
  {
    title: 'Automate your recurring bills',
    desc: 'Set up salary, rent, and subscriptions once. They auto-post on the due date — no manual entry needed.',
    color: '#ec4899',
    features: ['Go to  Recurring  tab to set up', 'Toggle  Auto-post  for hands-free tracking', 'Get alerts for overdue items'],
    visual: () => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {([['Monthly Salary', '+5,000,000', '#4ade80', 'Every 25th', true], ['Rent', '-2,000,000', '#f87171', 'Every 1st', true], ['Spotify', '-54,000', '#f87171', 'Every 15th', false]] as const).map(([d, a, c, freq, auto]) => (
          <div key={d} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: c, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{d}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{freq}</div>
            </div>
            {auto && <div style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: 'rgba(99,102,241,0.3)', color: '#818cf8' }}>AUTO</div>}
            <span style={{ fontSize: 12, fontWeight: 800, fontFamily: 'monospace', color: c }}>{a}</span>
          </div>
        ))}
      </div>
    ),
  },
];

function Counter({ target }: { target: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) { setVal(0); return; }
    let raf: number;
    const start = performance.now();
    const dur = 500;
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <>{val.toLocaleString()}</>;
}

function formatAmt(raw: string) { const d = raw.replace(/[^0-9]/g, ''); return d ? Number(d).toLocaleString('en-US') : ''; }
function parseAmt(s: string) { return s.replace(/[^0-9]/g, ''); }

const Ico = ({ d, size = 20, color = 'currentColor' }: { d: string; size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICO = {
  check:    'M20 6L9 17l-5-5',
  arrow:    'M5 12h14M12 5l7 7-7 7',
  back:     'M19 12H5M12 19l-7-7 7-7',
  search:   'M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z',
  wallet:   'M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5M16 12a2 2 0 100 4 2 2 0 000-4z',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  palette:  'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8z',
  dollar:   'M12 1v22M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6',
  clock:    'M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2',
  lock:     'M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4',
  zap:      'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  spin:     'M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83',
  plus:     'M12 5v14M5 12h14',
};

export default function OnboardingFlow({ onComplete, userName }: Props) {
  const { updateSettings } = useSettings();
  const [step, setStep]     = useState<Step>('welcome');
  const [dir, setDir]       = useState<'f'|'b'>('f');
  const [currency, setCurrency]   = useState('IDR');
  const [search, setSearch]       = useState('');
  const [income, setIncome]       = useState('');
  const [payday, setPayday]       = useState(25);
  const [theme, setTheme]         = useState('midnight');
  const [budgets, setBudgets]     = useState<BudgetItem[]>(DEFAULT_BUDGETS);
  const [tourIdx, setTourIdx]     = useState(0);
  const [tourDir, setTourDir]     = useState<'f'|'b'>('f');
  const [saving, setSaving]       = useState(false);

  const incomeNum  = Number(parseAmt(income)) || 0;
  const totalBudget = budgets.filter(b => b.enabled).reduce((s, b) => s + Number(parseAmt(b.amount) || 0), 0);
  const currSym    = CURRENCIES.find(c => c.code === currency)?.symbol ?? currency;

  const navigate = useCallback((next: Step, d: 'f'|'b') => {
    setDir(d); setTimeout(() => setStep(next), 10);
  }, []);
  const next = () => { const i = STEPS.indexOf(step); if (i < STEPS.length - 1) navigate(STEPS[i+1], 'f'); };
  const back = () => { const i = STEPS.indexOf(step); if (i > 0) navigate(STEPS[i-1], 'b'); };

  const handleTheme = async (id: string) => { setTheme(id); try { await updateSettings({ theme: id }); } catch {} };

  const updateBudget = (i: number, field: 'amount'|'enabled', val: string|boolean) =>
    setBudgets(prev => prev.map((b, j) => j === i ? { ...b, [field]: val } : b));

  const handleFinish = async () => {
    setSaving(true);
    try {
      await updateSettings({ currency, payday, theme });
      const token = localStorage.getItem('ft_token');
      const h: Record<string,string> = { 'Content-Type': 'application/json' };
      if (token) h['Authorization'] = `Bearer ${token}`;
      await fetch('/api/onboarding', { method: 'POST', headers: h, body: JSON.stringify({ monthly_income: incomeNum, currency, payday }) });
      // Save budgets
      const today = new Date();
      for (const b of budgets.filter(b => b.enabled && parseAmt(b.amount))) {
        await fetch('/api/budgets', { method: 'POST', headers: h, body: JSON.stringify({
          category_name: b.category, amount: Number(parseAmt(b.amount)),
          month: today.getMonth()+1, year: today.getFullYear(), repeat_monthly: true,
        })}).catch(() => {});
      }
      showToast('Welcome to FinTrack!');
      onComplete();
    } catch { showToast('Setup failed — try again', 'error'); }
    finally { setSaving(false); }
  };

  const stepIdx = STEPS.indexOf(step);
  const pct = Math.round((stepIdx / (STEPS.length - 1)) * 100);
  const filtered = CURRENCIES.filter(c =>
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 28);

  const ordinal = (n: number) => n + (['th','st','nd','rd'][[11,12,13].includes(n) ? 0 : Math.min(n%10,3)] ?? 'th');
  const activeTheme = THEMES.find(t => t.id === theme)!;
  const slide = TOUR_SLIDES[tourIdx];

  const PriBtn = ({ onClick, children, disabled=false }: { onClick:()=>void; children:React.ReactNode; disabled?:boolean }) => (
    <button onClick={onClick} disabled={disabled} className="ob-btn" style={{
      flex:2, padding:'13px 20px', borderRadius:12, fontSize:13, fontWeight:700,
      background: disabled ? 'var(--surface-3)' : 'linear-gradient(135deg, var(--accent), var(--purple))',
      color: disabled ? 'var(--text-muted)' : 'white', border:'none',
      boxShadow: disabled ? 'none' : '0 4px 20px var(--accent-glow-2)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', gap:6,
    }}>{children}</button>
  );
  const SecBtn = ({ onClick, children }: { onClick:()=>void; children:React.ReactNode }) => (
    <button onClick={onClick} className="ob-btn" style={{
      flex:1, padding:'13px 16px', borderRadius:12, fontSize:13, fontWeight:600,
      background:'var(--surface-2)', color:'var(--text-muted)',
      border:'1px solid var(--border-2)', cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', gap:6,
    }}>{children}</button>
  );

  return (
    <>
      <style>{`
        @keyframes ob-f   { from{opacity:0;transform:translateX(36px) scale(0.97)} to{opacity:1;transform:none} }
        @keyframes ob-b   { from{opacity:0;transform:translateX(-36px) scale(0.97)} to{opacity:1;transform:none} }
        @keyframes ob-up  { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
        @keyframes ob-pop { 0%{transform:scale(0.78);opacity:0} 65%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
        @keyframes ob-flt { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-9px)} }
        @keyframes ob-glo { 0%,100%{box-shadow:0 0 0 0 var(--accent-glow-2)} 50%{box-shadow:0 0 0 10px transparent} }
        @keyframes ob-spn { to{transform:rotate(360deg)} }
        @keyframes ob-prg { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes ob-dot { 0%,100%{transform:scale(1)} 50%{transform:scale(1.5)} }
        .ob-f   { animation: ob-f   0.3s cubic-bezier(0.22,1,0.36,1) both }
        .ob-b   { animation: ob-b   0.3s cubic-bezier(0.22,1,0.36,1) both }
        .ob-up  { animation: ob-up  0.35s ease both }
        .ob-pop { animation: ob-pop 0.5s cubic-bezier(0.34,1.4,0.64,1) both }
        .ob-flt { animation: ob-flt 3.2s ease-in-out infinite }
        .ob-glo { animation: ob-glo 2.8s ease infinite }
        .ob-spn { animation: ob-spn 0.9s linear infinite; display:inline-block }
        .ob-btn { transition: all 0.14s ease }
        .ob-btn:hover:not(:disabled) { transform:translateY(-1px); filter:brightness(1.09) }
        .ob-btn:active:not(:disabled) { transform:scale(0.97) }
        .ob-card { transition: all 0.18s ease }
        .ob-card:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,0.25) }
        .ob-theme { transition: all 0.2s cubic-bezier(0.34,1.2,0.64,1); cursor:pointer }
        .ob-theme:hover { transform:scale(1.07) translateY(-2px) }
        .ob-toggle { transition:background 0.2s ease; cursor:pointer }
        .ob-knob { transition:left 0.22s cubic-bezier(0.34,1.35,0.64,1) }
        .ob-dot { transition:all 0.3s cubic-bezier(0.34,1.2,0.64,1) }
        .ob-scroll::-webkit-scrollbar{width:3px}
        .ob-scroll::-webkit-scrollbar-thumb{background:var(--border-2);border-radius:2px}
        input.ob-in:focus{outline:none;box-shadow:0 0 0 3px var(--accent-glow-2);border-color:var(--accent)}
      `}</style>

      <div style={{
        position:'fixed', inset:0, zIndex:300,
        background:'rgba(0,0,0,0.94)', backdropFilter:'blur(18px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:16,
        animation:'fadeIn 0.3s ease both',
      }}>
        <div style={{
          width:'100%', maxWidth:540,
          background:'var(--surface)', border:'1px solid var(--border-2)',
          borderRadius:24, overflow:'hidden',
          boxShadow:'0 48px 120px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.07)',
          animation:'scaleIn 0.35s cubic-bezier(0.34,1.1,0.64,1) both',
          display:'flex', flexDirection:'column', maxHeight:'94vh',
        }}>

          {/* Progress */}
          <div style={{ height:3, background:'var(--surface-3)', flexShrink:0, position:'relative', overflow:'hidden' }}>
            <div style={{
              position:'absolute', top:0, left:0, height:'100%', width:`${pct}%`,
              background:'linear-gradient(90deg, var(--accent), var(--purple))',
              boxShadow:'0 0 10px var(--accent-glow-2)',
              transition:'width 0.55s cubic-bezier(0.34,1.1,0.64,1)',
            }} />
          </div>

          {/* Step dots */}
          {step !== 'welcome' && step !== 'finish' && (
            <div style={{ padding:'14px 24px 0', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div style={{ display:'flex', gap:5 }}>
                {STEPS.filter(s => s !== 'welcome' && s !== 'finish').map(s => {
                  const si = STEPS.indexOf(s); const active = s === step; const done = si < stepIdx;
                  return <div key={s} className="ob-dot" style={{ width:active?22:6, height:6, borderRadius:3, background: active||done?'var(--accent)':'var(--surface-3)', opacity:done?0.45:1 }} />;
                })}
              </div>
              <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:600 }}>{stepIdx} / {STEPS.length-2}</span>
            </div>
          )}

          {/* Content */}
          <div key={step} className={dir==='f'?'ob-f':'ob-b'} style={{
            flex:1, overflowY:'auto', padding:'24px 26px 28px',
            display:'flex', flexDirection:'column', gap:18,
          }}>

            {/* WELCOME */}
            {step === 'welcome' && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:22, textAlign:'center', paddingTop:8 }}>
                <div className="ob-flt" style={{ position:'relative' }}>
                  <div className="ob-glo" style={{
                    width:88, height:88, borderRadius:22,
                    background:'linear-gradient(135deg, var(--accent), var(--purple))',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:'0 0 0 16px var(--accent-glow)',
                  }}>
                    <svg width="46" height="46" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
                      <path d="M48 20L70 34L70 58Q70 76 48 84Q26 76 26 58L26 34Z" fill="white" opacity="0.15"/>
                      <polyline points="31,62 41,45 51,53 65,32" fill="none" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="65" cy="32" r="5.5" fill="white"/>
                    </svg>
                  </div>
                </div>

                <div>
                  <h1 style={{
                    fontSize:30, fontWeight:900, letterSpacing:'-0.05em', marginBottom:10, lineHeight:1.1,
                    background:'linear-gradient(135deg, var(--accent) 0%, var(--purple) 100%)',
                    WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
                  }}>
                    {userName ? `Welcome, ${userName.split('@')[0]}` : 'Welcome to FinTrack'}
                  </h1>
                  <p style={{ fontSize:14, color:'var(--text-muted)', lineHeight:1.75, maxWidth:380, margin:'0 auto' }}>
                    Your personal finance command center. Takes about 2 minutes to set up.
                  </p>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, width:'100%' }}>
                  {[
                    { d:ICO.wallet,   title:'Track everything',   sub:'Income, expenses, transfers',   color:'#5b6ef5', delay:0    },
                    { d:ICO.zap,      title:'Smart budgets',       sub:'Never overspend again',          color:'#f59e0b', delay:0.07 },
                    { d:ICO.lock,     title:'Fully private',       sub:'Your data stays with you',       color:'#22c55e', delay:0.14 },
                    { d:ICO.palette,  title:'20 themes',           sub:'Fully customizable look',        color:'#ec4899', delay:0.21 },
                  ].map(f => (
                    <div key={f.title} className="ob-up" style={{
                      padding:'14px', borderRadius:14, textAlign:'left',
                      background:'var(--surface-2)', border:'1px solid var(--border)',
                      animationDelay:`${f.delay}s`,
                    }}>
                      <div style={{ width:32, height:32, borderRadius:9, background:f.color+'1a', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8 }}>
                        <Ico d={f.d} size={16} color={f.color} />
                      </div>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', marginBottom:2 }}>{f.title}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>{f.sub}</div>
                    </div>
                  ))}
                </div>

                <button className="ob-btn ob-glo" onClick={next} style={{
                  width:'100%', padding:'16px', borderRadius:14, fontSize:15, fontWeight:800,
                  background:'linear-gradient(135deg, var(--accent), var(--purple))',
                  color:'white', border:'none', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                }}>
                  Get started <Ico d={ICO.arrow} size={16} color="white" />
                </button>
                <p style={{ fontSize:11, color:'var(--text-muted)', marginTop:-6 }}>Takes less than 2 minutes · 7 quick steps</p>
              </div>
            )}

            {/* TOUR */}
            {step === 'tour' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>
                    Feature tour · {tourIdx+1} of {TOUR_SLIDES.length}
                  </div>
                  <h2 style={{ fontSize:20, fontWeight:800, letterSpacing:'-0.03em', margin:0 }}>What can FinTrack do?</h2>
                </div>

                <div key={tourIdx} className={tourDir==='f'?'ob-f':'ob-b'} style={{
                  borderRadius:16, overflow:'hidden',
                  border:`1.5px solid ${slide.color}35`,
                  background:`linear-gradient(160deg, ${slide.color}12 0%, var(--surface-2) 55%)`,
                }}>
                  <div style={{ padding:'16px 18px 12px', borderBottom:`1px solid ${slide.color}18` }}>
                    <h3 style={{ fontSize:15, fontWeight:800, color:slide.color, marginBottom:5 }}>{slide.title}</h3>
                    <p style={{ fontSize:12, color:'var(--text-muted)', lineHeight:1.6, margin:0 }}>{slide.desc}</p>
                  </div>
                  <div style={{ padding:'13px 18px' }}>{slide.visual()}</div>
                  <div style={{ padding:'2px 18px 16px', display:'flex', flexDirection:'column', gap:7 }}>
                    {slide.features.map((f, i) => (
                      <div key={f} className="ob-up" style={{ display:'flex', alignItems:'center', gap:8, animationDelay:`${i*0.07+0.08}s` }}>
                        <div style={{ width:17, height:17, borderRadius:9, background:slide.color, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <Ico d={ICO.check} size={9} color="white" />
                        </div>
                        <span style={{ fontSize:12, fontWeight:i===0?700:500, color:i===0?'var(--text)':'var(--text-muted)' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display:'flex', gap:5, justifyContent:'center' }}>
                  {TOUR_SLIDES.map((_, i) => (
                    <button key={i} onClick={() => { setTourDir(i>tourIdx?'f':'b'); setTimeout(()=>setTourIdx(i),10); }} style={{
                      width:i===tourIdx?22:7, height:7, borderRadius:4, padding:0,
                      background:i===tourIdx?slide.color:'var(--surface-3)',
                      border:'none', cursor:'pointer',
                      transition:'all 0.3s cubic-bezier(0.34,1.2,0.64,1)',
                    }} />
                  ))}
                </div>

                <div style={{ display:'flex', gap:10 }}>
                  <SecBtn onClick={tourIdx>0 ? ()=>{setTourDir('b');setTimeout(()=>setTourIdx(i=>i-1),10)} : back}>
                    <Ico d={ICO.back} size={13}/> Back
                  </SecBtn>
                  {tourIdx < TOUR_SLIDES.length-1 ? (
                    <PriBtn onClick={()=>{setTourDir('f');setTimeout(()=>setTourIdx(i=>i+1),10)}}>
                      Next <Ico d={ICO.arrow} size={13} color="white"/>
                    </PriBtn>
                  ) : (
                    <PriBtn onClick={next}>Set up account <Ico d={ICO.arrow} size={13} color="white"/></PriBtn>
                  )}
                </div>
              </div>
            )}

            {/* CURRENCY */}
            {step === 'currency' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div>
                  <div className="ob-pop" style={{ width:48, height:48, borderRadius:14, background:'linear-gradient(135deg, var(--accent), var(--purple))', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12, boxShadow:'0 8px 24px var(--accent-glow-2)' }}>
                    <Ico d={ICO.dollar} size={24} color="white"/>
                  </div>
                  <h2 style={{ fontSize:20, fontWeight:800, letterSpacing:'-0.03em', marginBottom:4 }}>Choose your currency</h2>
                  <p style={{ fontSize:13, color:'var(--text-muted)' }}>All amounts will use this currency. Change anytime in Settings.</p>
                </div>
                <div style={{ position:'relative' }}>
                  <div style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', opacity:0.4, pointerEvents:'none' }}>
                    <Ico d={ICO.search} size={15}/>
                  </div>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search currencies…" autoFocus className="ob-in"
                    style={{ paddingLeft:36, fontSize:13, width:'100%' }}/>
                </div>
                <div className="ob-scroll" style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:7, maxHeight:252, overflowY:'auto', paddingRight:2 }}>
                  {filtered.map(c => {
                    const act = currency===c.code;
                    return (
                      <button key={c.code} className="ob-card" onClick={()=>setCurrency(c.code)} style={{
                        padding:'10px 12px', borderRadius:11, cursor:'pointer',
                        border:`1.5px solid ${act?'var(--accent)':'var(--border)'}`,
                        background:act?'var(--accent-glow)':'var(--surface-2)',
                        display:'flex', alignItems:'center', gap:9, textAlign:'left',
                        boxShadow:act?'0 2px 12px var(--accent-glow-2)':'none',
                      }}>
                        <span style={{ fontSize:17, fontWeight:800, color:act?'var(--accent)':'var(--text-muted)', minWidth:22, textAlign:'center' }}>{c.symbol}</span>
                        <div style={{ overflow:'hidden', flex:1 }}>
                          <div style={{ fontSize:12, fontWeight:700, color:act?'var(--accent)':'var(--text)' }}>{c.code}</div>
                          <div style={{ fontSize:10, color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</div>
                        </div>
                        {act && <Ico d={ICO.check} size={13} color="var(--accent)"/>}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <SecBtn onClick={back}><Ico d={ICO.back} size={13}/> Back</SecBtn>
                  <PriBtn onClick={next}>Use {currency} <Ico d={ICO.arrow} size={13} color="white"/></PriBtn>
                </div>
              </div>
            )}

            {/* INCOME */}
            {step === 'income' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div>
                  <div className="ob-pop" style={{ width:48, height:48, borderRadius:14, background:'linear-gradient(135deg,#22c55e,#10b981)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12, boxShadow:'0 8px 24px rgba(34,197,94,0.3)' }}>
                    <Ico d={ICO.wallet} size={24} color="white"/>
                  </div>
                  <h2 style={{ fontSize:20, fontWeight:800, letterSpacing:'-0.03em', marginBottom:4 }}>Monthly income</h2>
                  <p style={{ fontSize:13, color:'var(--text-muted)' }}>Used to calculate savings rates and spending alerts. Stored privately on your account.</p>
                </div>
                <div style={{ position:'relative' }}>
                  <span style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', fontSize:20, fontWeight:700, color:'var(--text-muted)', fontFamily:'var(--font-mono)', pointerEvents:'none' }}>{currSym}</span>
                  <input type="text" inputMode="numeric" value={formatAmt(income)} onChange={e=>setIncome(parseAmt(e.target.value))}
                    placeholder="0" autoFocus className="ob-in"
                    style={{ fontSize:28, fontWeight:900, fontFamily:'var(--font-mono)', letterSpacing:'-0.04em', paddingLeft:52, width:'100%' }}/>
                </div>
                {incomeNum > 0 && (
                  <div className="ob-pop" style={{ padding:'14px', borderRadius:14, background:'var(--surface-2)', border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>50/30/20 budget preview</div>
                    {[
                      { label:'Needs (50%)',   pct:0.5,  color:'#f87171', desc:'Rent, food, transport'     },
                      { label:'Wants (30%)',   pct:0.3,  color:'#fbbf24', desc:'Entertainment, dining out' },
                      { label:'Savings (20%)', pct:0.2,  color:'#4ade80', desc:'Goals, investments'        },
                    ].map(item => (
                      <div key={item.label} style={{ marginBottom:10 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, alignItems:'baseline' }}>
                          <div>
                            <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>{item.label}</span>
                            <span style={{ fontSize:10, color:'var(--text-muted)', marginLeft:6 }}>{item.desc}</span>
                          </div>
                          <span style={{ fontSize:13, fontWeight:800, fontFamily:'var(--font-mono)', color:item.color }}>
                            <Counter target={Math.round(incomeNum*item.pct)}/>
                          </span>
                        </div>
                        <div style={{ height:5, borderRadius:3, background:'var(--surface-3)', overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${item.pct*100}%`, borderRadius:3, background:item.color }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display:'flex', gap:10 }}>
                  <SecBtn onClick={back}><Ico d={ICO.back} size={13}/> Back</SecBtn>
                  <PriBtn onClick={next}>{incomeNum>0?'Continue':'Skip for now'} <Ico d={ICO.arrow} size={13} color="white"/></PriBtn>
                </div>
              </div>
            )}

            {/* PAYDAY */}
            {step === 'payday' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div>
                  <div className="ob-pop" style={{ width:48, height:48, borderRadius:14, background:'linear-gradient(135deg,#f59e0b,#ef4444)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12, boxShadow:'0 8px 24px rgba(245,158,11,0.3)' }}>
                    <Ico d={ICO.calendar} size={24} color="white"/>
                  </div>
                  <h2 style={{ fontSize:20, fontWeight:800, letterSpacing:'-0.03em', marginBottom:4 }}>When do you get paid?</h2>
                  <p style={{ fontSize:13, color:'var(--text-muted)' }}>Used to calculate your safe daily spend and budget countdowns.</p>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                  {PAYDAY_OPTIONS.map(d => {
                    const act = payday===d;
                    return (
                      <button key={d} onClick={()=>setPayday(d)} style={{
                        padding:'16px 8px', borderRadius:12, cursor:'pointer',
                        border:`2px solid ${act?'var(--accent)':'var(--border)'}`,
                        background:act?'var(--accent-glow)':'var(--surface-2)',
                        color:act?'var(--accent)':'var(--text-soft)',
                        fontWeight:800, fontSize:20, fontFamily:'var(--font-mono)',
                        boxShadow:act?'0 4px 16px var(--accent-glow-2)':'none',
                        transform:act?'scale(1.06)':'scale(1)',
                        transition:'all 0.2s cubic-bezier(0.34,1.2,0.64,1)',
                      }}>{d}</button>
                    );
                  })}
                </div>
                <div style={{ padding:'13px 16px', borderRadius:12, background:'var(--surface-2)', border:'1px solid var(--border)', fontSize:13, color:'var(--text)', textAlign:'center', fontWeight:500 }}>
                  You get paid on the <strong style={{ color:'var(--accent)' }}>{ordinal(payday)}</strong> of each month
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <SecBtn onClick={back}><Ico d={ICO.back} size={13}/> Back</SecBtn>
                  <PriBtn onClick={next}>Continue <Ico d={ICO.arrow} size={13} color="white"/></PriBtn>
                </div>
              </div>
            )}

            {/* THEME */}
            {step === 'theme' && (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div>
                  <div className="ob-pop" style={{ width:48, height:48, borderRadius:14, background:`linear-gradient(135deg,${activeTheme.a},${activeTheme.b})`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12, boxShadow:'0 8px 24px var(--accent-glow-2)', transition:'background 0.3s ease' }}>
                    <Ico d={ICO.palette} size={22} color="white"/>
                  </div>
                  <h2 style={{ fontSize:20, fontWeight:800, letterSpacing:'-0.03em', marginBottom:4 }}>Pick your theme</h2>
                  <p style={{ fontSize:13, color:'var(--text-muted)' }}>
                    Tap any swatch — it applies <strong style={{ color:'var(--accent)' }}>live right now</strong>. Change anytime in Settings.
                  </p>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
                  {THEMES.map(th => {
                    const act = theme===th.id;
                    return (
                      <button key={th.id} className="ob-theme" onClick={()=>handleTheme(th.id)} style={{
                        padding:'14px 8px', borderRadius:13, cursor:'pointer',
                        border:`2px solid ${act?'rgba(255,255,255,0.55)':'transparent'}`,
                        background:th.bg,
                        display:'flex', flexDirection:'column', alignItems:'center', gap:7,
                        boxShadow:act?`0 0 0 3px ${th.a},0 12px 28px rgba(0,0,0,0.6)`:'0 2px 8px rgba(0,0,0,0.35)',
                      }}>
                        <div style={{ display:'flex', gap:4 }}>
                          <div style={{ width:14, height:14, borderRadius:7, background:th.a }}/>
                          <div style={{ width:14, height:14, borderRadius:7, background:th.b }}/>
                        </div>
                        <span style={{ fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.7)', letterSpacing:'0.05em', textTransform:'uppercase' }}>{th.label}</span>
                        {act && <div style={{ width:16, height:16, borderRadius:8, background:th.a, display:'flex', alignItems:'center', justifyContent:'center' }}><Ico d={ICO.check} size={9} color="white"/></div>}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <SecBtn onClick={back}><Ico d={ICO.back} size={13}/> Back</SecBtn>
                  <PriBtn onClick={next}>Looks great <Ico d={ICO.arrow} size={13} color="white"/></PriBtn>
                </div>
              </div>
            )}

            {/* BUDGETS */}
            {step === 'budgets' && (
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <div className="ob-pop" style={{ width:48, height:48, borderRadius:14, background:'linear-gradient(135deg,#8b5cf6,#6366f1)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:12, boxShadow:'0 8px 24px rgba(139,92,246,0.3)' }}>
                    <Ico d={ICO.clock} size={24} color="white"/>
                  </div>
                  <h2 style={{ fontSize:20, fontWeight:800, letterSpacing:'-0.03em', marginBottom:4 }}>Set your monthly budgets</h2>
                  <p style={{ fontSize:13, color:'var(--text-muted)' }}>
                    Toggle the categories you want to track and enter your own spending limits. These repeat every month automatically.
                  </p>
                </div>

                {incomeNum > 0 && (
                  <div style={{ padding:'9px 14px', borderRadius:10, background:'var(--surface-2)', border:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12 }}>
                    <span style={{ color:'var(--text-muted)' }}>Your monthly income</span>
                    <span style={{ fontFamily:'var(--font-mono)', fontWeight:800, color:'var(--accent)' }}>{currSym}{incomeNum.toLocaleString()}</span>
                  </div>
                )}

                <div className="ob-scroll" style={{ display:'flex', flexDirection:'column', gap:7, maxHeight:300, overflowY:'auto', paddingRight:2 }}>
                  {budgets.map((b, i) => (
                    <div key={b.category} style={{
                      display:'flex', alignItems:'center', gap:10,
                      padding:'10px 12px', borderRadius:12,
                      background:b.enabled?'var(--surface-2)':'var(--surface)',
                      border:`1.5px solid ${b.enabled?b.color+'45':'var(--border)'}`,
                      opacity:b.enabled?1:0.5,
                      transition:'all 0.2s ease',
                    }}>
                      {/* Toggle */}
                      <div className="ob-toggle" onClick={()=>updateBudget(i,'enabled',!b.enabled)} style={{
                        width:36, height:20, borderRadius:10, flexShrink:0, position:'relative',
                        background:b.enabled?b.color:'var(--surface-3)',
                        border:`1px solid ${b.enabled?b.color:'var(--border-2)'}`,
                      }}>
                        <div className="ob-knob" style={{ position:'absolute', top:2, left:b.enabled?16:2, width:14, height:14, borderRadius:7, background:'white', boxShadow:'0 1px 4px rgba(0,0,0,0.25)' }}/>
                      </div>
                      {/* Label */}
                      <div style={{ display:'flex', alignItems:'center', gap:7, flex:1, minWidth:0 }}>
                        <div style={{ width:9, height:9, borderRadius:5, background:b.color, flexShrink:0 }}/>
                        <span style={{ fontSize:12, fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.category}</span>
                      </div>
                      {/* Amount */}
                      {b.enabled && (
                        <input type="text" inputMode="numeric" value={formatAmt(b.amount)} onChange={e=>updateBudget(i,'amount',parseAmt(e.target.value))}
                          placeholder="Amount" className="ob-in" style={{
                            fontSize:12, fontFamily:'var(--font-mono)', fontWeight:700,
                            padding:'5px 8px', borderRadius:8, width:120, textAlign:'right', flexShrink:0,
                            border:`1px solid ${b.amount?b.color+'60':'var(--border)'}`,
                            background:b.amount?b.color+'10':'var(--surface)',
                            color:b.amount?b.color:'var(--text-muted)',
                          }}/>
                      )}
                    </div>
                  ))}
                </div>

                {totalBudget > 0 && (
                  <div className="ob-up" style={{
                    padding:'10px 14px', borderRadius:10,
                    background:totalBudget>incomeNum&&incomeNum>0?'rgba(239,68,68,0.08)':'var(--surface-2)',
                    border:`1px solid ${totalBudget>incomeNum&&incomeNum>0?'rgba(239,68,68,0.3)':'var(--border)'}`,
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                  }}>
                    <span style={{ fontSize:13, fontWeight:700, color:totalBudget>incomeNum&&incomeNum>0?'var(--red)':'var(--text)' }}>
                      {totalBudget>incomeNum&&incomeNum>0?'Exceeds your income!':'Total budgeted'}
                    </span>
                    <span style={{ fontSize:15, fontWeight:900, fontFamily:'var(--font-mono)', color:totalBudget>incomeNum&&incomeNum>0?'var(--red)':'var(--accent)' }}>
                      {currSym}{totalBudget.toLocaleString()}
                    </span>
                  </div>
                )}

                <div style={{ display:'flex', gap:10 }}>
                  <SecBtn onClick={back}><Ico d={ICO.back} size={13}/> Back</SecBtn>
                  <PriBtn onClick={next}>{budgets.some(b=>b.enabled&&b.amount)?'Save & continue':'Skip for now'} <Ico d={ICO.arrow} size={13} color="white"/></PriBtn>
                </div>
              </div>
            )}

            {/* FINISH */}
            {step === 'finish' && (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:22, textAlign:'center' }}>
                <div className="ob-pop" style={{
                  width:88, height:88, borderRadius:44,
                  background:'linear-gradient(135deg, var(--accent), var(--purple))',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 0 0 20px var(--accent-glow), 0 24px 48px var(--accent-glow-2)',
                }}>
                  <Ico d={ICO.check} size={42} color="white"/>
                </div>

                <div>
                  <h2 style={{ fontSize:26, fontWeight:900, letterSpacing:'-0.05em', marginBottom:8 }}>You're all set!</h2>
                  <p style={{ fontSize:13, color:'var(--text-muted)', lineHeight:1.7 }}>Your FinTrack is configured and ready. Here's where to start:</p>
                </div>

                <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:8 }}>
                  {[
                    { color:'#5b6ef5', d:ICO.plus,     action:'Tap  +  in Transactions',   desc:'to log your first income or expense — takes 10 seconds' },
                    { color:'#22c55e', d:ICO.wallet,   action:'Open the Budgets tab',        desc:'to see your spending limits and safe daily spend' },
                    { color:'#f59e0b', d:ICO.zap,      action:'Open the Savings tab',        desc:'to create a goal and start working toward it' },
                    { color:'#ec4899', d:ICO.calendar, action:'Open the Recurring tab',      desc:'to automate salary, rent, and subscriptions' },
                  ].map((item, i) => (
                    <div key={item.action} className="ob-up" style={{
                      display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:13,
                      background:'var(--surface-2)', border:'1px solid var(--border)', textAlign:'left',
                      animationDelay:`${i*0.07}s`,
                    }}>
                      <div style={{ width:36, height:36, borderRadius:10, background:item.color+'18', border:`1px solid ${item.color}28`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <Ico d={item.d} size={16} color={item.color}/>
                      </div>
                      <div>
                        <div style={{ fontSize:13, fontWeight:800, color:item.color, marginBottom:2 }}>{item.action}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="ob-btn ob-glo" onClick={handleFinish} disabled={saving} style={{
                  width:'100%', padding:'16px', borderRadius:14, fontSize:15, fontWeight:800,
                  background:saving?'var(--surface-3)':'linear-gradient(135deg, var(--accent), var(--purple))',
                  color:saving?'var(--text-muted)':'white', border:'none',
                  boxShadow:saving?'none':'0 8px 28px var(--accent-glow-2)',
                  cursor:saving?'not-allowed':'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                }}>
                  {saving
                    ? <><span className="ob-spn"><Ico d={ICO.spin} size={15} color="currentColor"/></span>Setting up your account…</>
                    : <>Go to dashboard <Ico d={ICO.arrow} size={15} color="white"/></>}
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
