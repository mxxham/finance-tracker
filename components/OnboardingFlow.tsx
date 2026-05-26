'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { showToast } from '@/components/Toast';
import { CURRENCIES } from '@/lib/currencies';
import { useSettings } from '@/lib/SettingsContext';

interface Props {
  onComplete: () => void;
  userName?: string;
}

const STEPS = ['welcome', 'income', 'currency', 'payday', 'seed', 'done'] as const;
type Step = typeof STEPS[number];

const PAYDAY_OPTIONS = [1, 5, 10, 15, 20, 25, 28];

const OVERLAY: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 100,
  background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 20,
  animation: 'fadeIn 0.25s ease both',
};

const CARD: React.CSSProperties = {
  width: '100%', maxWidth: 480,
  background: 'var(--surface)',
  border: '1px solid var(--border-2)',
  borderRadius: 20,
  padding: '32px 28px',
  boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
  animation: 'scaleIn 0.25s cubic-bezier(0.34,1.2,0.64,1) both',
  display: 'flex', flexDirection: 'column', gap: 24,
};

function ProgressBar({ step }: { step: Step }) {
  const idx = STEPS.indexOf(step);
  const pct = Math.round((idx / (STEPS.length - 1)) * 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Setup {idx + 1} of {STEPS.length}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pct}%</span>
      </div>
      <div style={{ height: 4, borderRadius: 2, background: 'var(--surface-3)' }}>
        <div style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, var(--accent), var(--purple))', width: `${pct}%`, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

export default function OnboardingFlow({ onComplete, userName }: Props) {
  const { updateSettings } = useSettings();
  const [step, setStep] = useState<Step>('welcome');
  const [income, setIncome] = useState('');
  const [currency, setCurrency] = useState('IDR');
  const [payday, setPayday] = useState(25);
  const [seedData, setSeedData] = useState(true);
  const [saving, setSaving] = useState(false);

  const next = () => {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      // Update settings
      await updateSettings({ currency, payday });

      // Seed data if requested
      const token = typeof window !== 'undefined' ? localStorage.getItem('ft_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      await fetch('/api/onboarding', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          monthly_income: seedData ? Number(income) : 0,
          currency,
          payday,
        }),
      });

      showToast('Welcome to FinTrack! 🎉');
      onComplete();
    } catch {
      showToast('Setup failed — please try again', 'error');
    } finally {
      setSaving(false);
    }
  };

  const LABEL: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'block',
  };

  return (
    <div style={OVERLAY}>
      <div style={CARD}>
        <ProgressBar step={step} />

        {/* WELCOME */}
        {step === 'welcome' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 52 }}>👋</div>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 6 }}>
                Welcome{userName ? `, ${userName.split(' ')[0]}` : ''}!
              </h2>
              <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Let's set up FinTrack in 60 seconds. We'll configure your currency, income, and optionally seed your dashboard with sample data so it doesn't look empty.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', padding: '14px 16px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              {['Set your currency & payday', 'Enter your monthly income', 'Get sample data to explore'].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <span style={{ color: 'var(--accent)', fontSize: 16 }}>✓</span>
                  <span style={{ color: 'var(--text-soft)' }}>{item}</span>
                </div>
              ))}
            </div>
            <button onClick={next} style={{ padding: '13px', borderRadius: 12, fontSize: 14, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 20px var(--accent-glow-2)' }}>
              Let's get started →
            </button>
          </div>
        )}

        {/* INCOME */}
        {step === 'income' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>What's your monthly income?</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Used to calculate budget ratios and savings rates. You can change this any time.</p>
            </div>
            <div>
              <label style={LABEL}>Monthly Income</label>
              <input
                type="number"
                value={income}
                onChange={e => setIncome(e.target.value)}
                placeholder="e.g. 5000000"
                autoFocus
                style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('welcome')} style={{ flex: 1, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>← Back</button>
              <button onClick={next} style={{ flex: 2, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px var(--accent-glow-2)' }}>
                {income ? 'Continue →' : 'Skip for now →'}
              </button>
            </div>
          </div>
        )}

        {/* CURRENCY */}
        {step === 'currency' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Choose your currency</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>All amounts will be formatted using this currency.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
              {CURRENCIES.slice(0, 20).map(c => (
                <button key={c.code} onClick={() => setCurrency(c.code)} style={{
                  padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${currency === c.code ? 'var(--accent)' : 'var(--border)'}`,
                  background: currency === c.code ? 'var(--accent-glow)' : 'var(--surface-2)',
                  color: currency === c.code ? 'var(--accent)' : 'var(--text-soft)',
                  fontWeight: currency === c.code ? 700 : 500, fontSize: 12, textAlign: 'left',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 16 }}>{c.symbol}</span>
                  <span>{c.code}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('income')} style={{ flex: 1, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>← Back</button>
              <button onClick={next} style={{ flex: 2, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px var(--accent-glow-2)' }}>Continue →</button>
            </div>
          </div>
        )}

        {/* PAYDAY */}
        {step === 'payday' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>When do you get paid?</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Used to calculate your safe daily spend and budget countdowns.</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {PAYDAY_OPTIONS.map(d => (
                <button key={d} onClick={() => setPayday(d)} style={{
                  padding: '14px 8px', borderRadius: 10, border: `1.5px solid ${payday === d ? 'var(--accent)' : 'var(--border)'}`,
                  background: payday === d ? 'var(--accent-glow)' : 'var(--surface-2)',
                  color: payday === d ? 'var(--accent)' : 'var(--text-soft)',
                  fontWeight: payday === d ? 800 : 500, fontSize: 16, fontFamily: 'var(--font-mono)',
                }}>
                  {d}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>Day {payday} of each month</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('currency')} style={{ flex: 1, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>← Back</button>
              <button onClick={next} style={{ flex: 2, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px var(--accent-glow-2)' }}>Continue →</button>
            </div>
          </div>
        )}

        {/* SEED DATA */}
        {step === 'seed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 4 }}>Add sample data?</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                We'll populate your dashboard with realistic transactions based on your income so you can explore all features. You can delete them any time.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { val: true, label: 'Yes, add sample data', sub: 'See charts, budgets and analytics in action', icon: '✨' },
                { val: false, label: 'No, start fresh', sub: 'Empty dashboard — add your own data', icon: '🗒️' },
              ].map(opt => (
                <button key={String(opt.val)} onClick={() => setSeedData(opt.val)} style={{
                  padding: '14px 16px', borderRadius: 12, border: `1.5px solid ${seedData === opt.val ? 'var(--accent)' : 'var(--border)'}`,
                  background: seedData === opt.val ? 'var(--accent-glow)' : 'var(--surface-2)',
                  display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                }}>
                  <span style={{ fontSize: 24 }}>{opt.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: seedData === opt.val ? 'var(--accent)' : 'var(--text)' }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{opt.sub}</div>
                  </div>
                  {seedData === opt.val && <span style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 16 }}>✓</span>}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('payday')} style={{ flex: 1, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>← Back</button>
              <button onClick={next} style={{ flex: 2, padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px var(--accent-glow-2)' }}>Continue →</button>
            </div>
          </div>
        )}

        {/* DONE */}
        {step === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 56 }}>🎉</div>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.04em', marginBottom: 6 }}>You're all set!</h2>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Your dashboard is ready. Here are a few things to try first:
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left' }}>
              {[
                { icon: '💸', text: 'Add your first transaction in the Transactions tab' },
                { icon: '🎯', text: 'Create a savings goal in the Savings tab' },
                { icon: '🔄', text: 'Set up recurring bills in the Recurring tab' },
                { icon: '📊', text: 'Check Analytics to see your spending patterns' },
              ].map(item => (
                <div key={item.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-soft)' }}>{item.text}</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleFinish}
              disabled={saving}
              style={{ padding: '14px', borderRadius: 12, fontSize: 14, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 20px var(--accent-glow-2)', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Setting up…' : 'Go to Dashboard →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
