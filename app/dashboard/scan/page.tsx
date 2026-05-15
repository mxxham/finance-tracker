'use client';
import { useState, useRef, useCallback, DragEvent, ChangeEvent, useEffect } from 'react';
import { api } from '@/lib/api';
import { parseOCRText, matchCategory, ParsedTransaction } from '@/lib/parser';
import { showToast } from '@/components/Toast';
import { translateCategory } from '@/lib/categories';

interface Category { id: number; name: string; color: string; type: string; }
type ScanStatus = 'idle' | 'loading_ocr' | 'ocr_running' | 'parsing' | 'done' | 'error';

function fmt(n: number) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n); }
function merchantName(desc: string) { return desc.trim().match(/(?:at|@)\s*([^\-|,|–|:]+)/i)?.[1]?.trim() || desc.split(/[-–|:|@]/)[0].trim() || desc; }
function normalizeMerchantKey(desc: string) { return merchantName(desc).toLowerCase().replace(/\s+/g, ' ').trim(); }

const CONFIDENCE_COLORS: Record<string, string> = { high: '#22d47a', medium: '#f5a623', low: '#f05252' };
const APPS = ['Livin by Mandiri','BCA Mobile','BRImo','GoPay','OVO','DANA','ShopeePay','QRIS'];

export default function ScanPage() {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [editedTxs, setEditedTxs] = useState<(ParsedTransaction & { category_id: number | null })[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sourceApp, setSourceApp] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  const [duplicates, setDuplicates] = useState<ParsedTransaction[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { api.getCategories().then(setCategories).catch(() => {}); }, []);

  const matchCategoryId = useCallback((hint: string, type: 'income' | 'expense'): number | null => {
    return (categories.find(c => c.name === hint && c.type === type) || categories.find(c => c.type === type && c.name === 'Other'))?.id ?? null;
  }, [categories]);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) { setError('File must be an image (JPG, PNG, WEBP)'); return; }
    setError(''); setSaved(false); setEditedTxs([]); setOcrText(''); setStatus('idle');
    const reader = new FileReader();
    reader.onload = e => { setImageDataUrl(e.target?.result as string); };
    reader.readAsDataURL(file);
  };
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => { if (e.target.files?.[0]) processFile(e.target.files[0]); };
  const handleDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files?.[0]) processFile(e.dataTransfer.files[0]); };

  const runScan = async () => {
    if (!imageDataUrl) return;
    setStatus('loading_ocr'); setProgress(5); setProgressLabel('Loading OCR engine…'); setError('');
    try {
      const { createWorker } = await import('tesseract.js');
      setStatus('ocr_running'); setProgressLabel('Initializing…'); setProgress(15);
      const worker = await createWorker(['ind','eng'], 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') { setProgress(Math.round(15+m.progress*70)); setProgressLabel(`Reading text… ${Math.round(m.progress*100)}%`); }
          else if (m.status.includes('load')) setProgressLabel('Loading language model…');
        },
      });
      setProgressLabel('Analyzing image…');
      const result = await worker.recognize(imageDataUrl);
      await worker.terminate();
      const raw = result.data.text;
      setOcrText(raw);
      setStatus('parsing'); setProgress(90); setProgressLabel('Identifying transactions…');
      await new Promise(r => setTimeout(r, 300));
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const parsed = parseOCRText(raw);
      const olderTxs = parsed.transactions.filter(tx => tx.date !== today);
      setSourceApp(parsed.source_app);
      setNotes(parsed.notes + (olderTxs.length ? ` ${olderTxs.length} older transaction(s) from before today were skipped.` : ''));
      setProgressLabel('Checking for duplicates…');
      const existingTxs = await api.getTransactions({ limit: '10000' });
      const vendorCategoryMap = new Map<string, number>();
      for (const e of existingTxs as Array<{ description: string; category_id: number | null; type: 'income' | 'expense' }>) {
        if (!e.category_id) continue;
        const key = `${e.type}|${normalizeMerchantKey(e.description)}`;
        if (!vendorCategoryMap.has(key)) {
          vendorCategoryMap.set(key, e.category_id);
        }
      }
      const dups: ParsedTransaction[] = [];
      const todayTxs = parsed.transactions.filter(tx => tx.date === today);
      const unique = todayTxs.filter(tx => {
        const isDup = existingTxs.some((e: { description: string; amount: number; type: string; date: string | null }) => {
          const m1 = normalizeMerchantKey(tx.description);
          const m2 = normalizeMerchantKey(e.description);
          const merchantMatch = m1 === m2 || m1.includes(m2) || m2.includes(m1);
          const amountMatch = Math.abs(tx.amount - e.amount) <= Math.max(tx.amount * 0.02, 1000);
          const existingDate = (e as { date_str?: string; date?: string }).date_str || (typeof e.date === 'string' ? e.date.slice(0, 10) : '');
          const dateMatch = tx.date === existingDate;
          return merchantMatch && amountMatch && tx.type === e.type && dateMatch;
        });
        if (isDup) { dups.push(tx); return false; }
        return true;
      });
      setDuplicates(dups);
      setEditedTxs(unique.map(tx => {
        const vendorKey = `${tx.type}|${normalizeMerchantKey(tx.description)}`;
        const categoryId = vendorCategoryMap.get(vendorKey) ?? matchCategoryId(tx.category_hint, tx.type);
        return { ...tx, category_id: categoryId };
      }));
      setProgress(100); setStatus('done');
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed to run OCR'); setStatus('error'); }
  };

  const updateTx = (i: number, field: string, value: string | number | null) => setEditedTxs(prev => prev.map((tx, idx) => idx === i ? { ...tx, [field]: value } : tx));
  const removeTx = (i: number) => setEditedTxs(prev => prev.filter((_, idx) => idx !== i));

  const handleSaveAll = async () => {
    if (!editedTxs.length) return;
    setSaving(true);
    try {
      await Promise.all(editedTxs.map(tx => api.createTransaction({ amount: tx.amount, type: tx.type, description: tx.description, date: tx.date, category_id: tx.category_id })));
      setSaved(true); showToast(`${editedTxs.length} transactions saved!`);
    } catch { showToast('Failed to save transactions', 'error'); }
    finally { setSaving(false); }
  };

  const reset = () => { setImageDataUrl(null); setStatus('idle'); setEditedTxs([]); setDuplicates([]); setOcrText(''); setError(''); setSaved(false); setProgress(0); };
  const isScanning = ['loading_ocr','ocr_running','parsing'].includes(status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 960 }}>
      <div>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.2, marginBottom: 4 }}>Scan Transactions</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 600 }}>
          Upload a screenshot from any Indonesian banking app. Local OCR reads and categorizes transactions — nothing is sent to any server.
        </p>
      </div>

      {/* App badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {APPS.map(app => (
          <span key={app} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 500 }}>{app}</span>
        ))}
        <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99, background: 'var(--accent-glow)', border: '1px solid rgba(91,110,245,0.25)', color: 'var(--accent-2)', fontWeight: 600, display:'inline-flex', alignItems:'center', gap:4 }}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>100% local</span>
      </div>

      {/* Upload or Preview */}
      {!imageDataUrl ? (
        <div onClick={() => fileRef.current?.click()} onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          style={{
            position: 'relative', borderRadius: 16, cursor: 'pointer',
            border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border-2)'}`,
            background: dragging ? 'var(--accent-glow)' : 'var(--surface)',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 16, padding: '80px 40px',
            transition: 'all 0.2s ease',
          }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 14, opacity: 0.02, backgroundImage: 'linear-gradient(var(--accent) 1px,transparent 1px),linear-gradient(90deg,var(--accent) 1px,transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>↑</div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 5 }}>Drop your screenshot here</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>or click to browse · JPG, PNG, WEBP</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>
      ) : (
        <div className="grid-scan">
          {/* Screenshot Preview */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Screenshot</span>
              <button onClick={reset} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Change</button>
            </div>
            <div style={{ padding: 12 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageDataUrl} alt="preview" style={{ width: '100%', borderRadius: 10, objectFit: 'contain', maxHeight: 520 }} />
            </div>
          </div>

          {/* Right panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {status === 'idle' && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 13, background: 'var(--accent-glow)', border: '1px solid rgba(91,110,245,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg></div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 5 }}>Ready to scan</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Tesseract OCR will read and extract transaction data from your screenshot</p>
                </div>
                <button onClick={runScan} style={{ padding: '11px 32px', borderRadius: 11, fontWeight: 700, fontSize: 14, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 20px rgba(91,110,245,0.35)', letterSpacing: '-0.01em' }}>
                  Start Scan
                </button>
              </div>
            )}

            {isScanning && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 28, height: 28, border: '2.5px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>Analyzing image…</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{progressLabel}</p>
                  </div>
                </div>
                <div style={{ height: 5, borderRadius: 99, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 99, background: 'linear-gradient(90deg, var(--accent), var(--purple))', width: `${progress}%`, transition: 'width 0.4s ease' }} />
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{progress}% · Processing locally in your browser</p>
              </div>
            )}

            {status === 'done' && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>
                    {editedTxs.length === 0 ? 'No transactions found' : `${editedTxs.length} transactions detected`}
                  </p>
                  {sourceApp && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Source: {sourceApp}</p>}
                  {notes && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{notes}</p>}
                </div>
                <button onClick={runScan} style={{ fontSize: 11, padding: '6px 12px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>Scan Again</button>
              </div>
            )}

            {error && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--red-muted)', border: '1px solid rgba(240,82,82,0.25)', color: 'var(--red)', fontSize: 13 }}>
                {error}
              </div>
            )}

            {duplicates.length > 0 && (
              <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--amber-muted)', border: '1px solid rgba(245,166,35,0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>Duplicates Filtered</span>
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(245,166,35,0.2)', color: 'var(--amber)', fontWeight: 700 }}>{duplicates.length} removed</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>These matched existing entries (same merchant + amount + type + date):</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
                  {duplicates.map((tx, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '5px 8px', borderRadius: 6, background: 'var(--surface-2)' }}>
                      <span style={{ fontWeight: 500 }}>{merchantName(tx.description)}</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{fmt(tx.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ocrText && (
              <div>
                <button onClick={() => setShowRawText(v => !v)} style={{ fontSize: 11, padding: '6px 12px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  {showRawText ? 'Hide' : 'Show'} raw OCR text
                </button>
                {showRawText && (
                  <pre style={{ marginTop: 8, fontSize: 11, padding: 12, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-muted)', overflow: 'auto', maxHeight: 140, fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {ocrText}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editable transactions */}
      {editedTxs.length > 0 && !saved && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em' }}>Review & Edit</h2>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Verify each transaction before saving</p>
            </div>
            <button onClick={handleSaveAll} disabled={saving} style={{ padding: '10px 22px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--green)', color: 'white', border: 'none', opacity: saving ? 0.6 : 1, boxShadow: '0 4px 16px rgba(34,212,122,0.3)' }}>
              {saving ? 'Saving…' : `Save All (${editedTxs.length})`}
            </button>
          </div>
          <div>
            {editedTxs.map((tx, i) => (
              <div key={i} style={{ padding: '16px 22px', borderBottom: i < editedTxs.length-1 ? '1px solid var(--border)' : 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: CONFIDENCE_COLORS[tx.confidence], flexShrink: 0 }} />
                  <input value={tx.description} onChange={e => updateTx(i,'description',e.target.value)}
                    style={{ flex: 1, fontSize: 13, fontWeight: 600, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', borderRadius: 0, padding: '2px 0', color: 'var(--text)' }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: CONFIDENCE_COLORS[tx.confidence], textTransform: 'uppercase' }}>{tx.confidence}</span>
                  <button onClick={() => removeTx(i)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'var(--red-muted)', color: 'var(--red)', border: '1px solid rgba(240,82,82,0.2)', fontWeight: 600 }}>Remove</button>
                </div>
                <div className="scan-tx-grid" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 8 }}>
                  <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 3, border: '1px solid var(--border)', gap: 3 }}>
                    {(['expense','income'] as const).map(t => (
                      <button key={t} onClick={() => { updateTx(i,'type',t); const c = matchCategory(tx.description); updateTx(i,'category_id', (categories.find(c2 => c2.name===c.category && c2.type===t) || categories.find(c2 => c2.type===t && c2.name==='Other'))?.id ?? null); }} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: tx.type===t ? (t==='income'?'var(--green)':'var(--red)') : 'transparent', color: tx.type===t?'white':'var(--text-muted)', border: 'none', whiteSpace: 'nowrap' }}>
                        {t === 'income' ? '↑ In' : '↓ Out'}
                      </button>
                    ))}
                  </div>
                  <input type="number" value={tx.amount} onChange={e => updateTx(i,'amount',Number(e.target.value))} style={{ fontSize: 13, fontFamily: 'var(--font-mono)', padding: '7px 10px' }} />
                  <select value={tx.category_id ?? ''} onChange={e => updateTx(i,'category_id',e.target.value ? Number(e.target.value) : null)} style={{ fontSize: 12, padding: '7px 10px' }}>
                    <option value="">No category</option>
                    {categories.filter(c => c.type===tx.type).map(c => <option key={c.id} value={c.id}>{translateCategory(c.name)}</option>)}
                  </select>
                  <input type="date" value={tx.date} onChange={e => updateTx(i,'date',e.target.value)} style={{ fontSize: 12, padding: '7px 10px' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, fontFamily: 'var(--font-mono)', fontWeight: 700, background: tx.type==='income'?'var(--green-muted)':'var(--red-muted)', color: tx.type==='income'?'var(--green)':'var(--red)' }}>
                    {tx.type==='income'?'+':'−'}{fmt(tx.amount)}
                  </span>
                  {tx.category_id && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>→ {translateCategory(categories.find(c=>c.id===tx.category_id)?.name||'')}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success */}
      {saved && (
        <div style={{ background: 'var(--surface)', border: '1px solid rgba(34,212,122,0.25)', borderRadius: 14, padding: '48px 40px', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--green-muted)', border: '1px solid rgba(34,212,122,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)', margin: '0 auto 20px' }}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--green)', marginBottom: 8 }}>Saved successfully!</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>{editedTxs.length} transactions added to your financial history</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={reset} style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px rgba(91,110,245,0.3)' }}>Scan Again</button>
            <a href="/dashboard/transactions" style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>View Transactions →</a>
          </div>
        </div>
      )}

      {/* Tips */}
      {!imageDataUrl && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {[
            { icon: 'screenshot', title: 'Best Screenshot Tips', desc: 'Use the transactions history page. Ensure amounts are clearly visible. Avoid blurry or cropped images.' },
            { icon: 'lock', title: 'Fully Private', desc: 'Tesseract.js runs directly in your browser. Screenshots are never uploaded to any server.' },
            { icon: 'edit', title: 'Always Editable', desc: 'After scanning, correct categories, amounts, or dates before saving. View raw OCR text if needed.' },
          ].map(tip => (
            <div key={tip.title} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
              {tip.icon === 'screenshot' && <div style={{ marginBottom: 10, color: 'var(--accent)' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/></svg></div>}{tip.icon === 'lock' && <div style={{ marginBottom: 10, color: 'var(--green)' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg></div>}{tip.icon === 'edit' && <div style={{ marginBottom: 10, color: 'var(--amber)' }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>}
              <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>{tip.title}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>{tip.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}