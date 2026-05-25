'use client';
import { useState, useRef, useCallback, DragEvent, ChangeEvent, useEffect } from 'react';
import { api } from '@/lib/api';
import { parseOCRText, matchCategory, ParsedTransaction } from '@/lib/parser';
import { showToast } from '@/components/Toast';
import { translateCategory } from '@/lib/categories';
import { sendLocalNotification } from '@/lib/notifications';


interface Category { id: number; name: string; color: string; type: string; }
type ScanStatus = 'idle' | 'loading_ocr' | 'ocr_running' | 'parsing' | 'done' | 'error';

function fmt(n: number) { return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n); }
function merchantName(desc: string) { return desc.trim().match(/(?:at|@)\s*([^\-|,|–|:]+)/i)?.[1]?.trim() || desc.split(/[-–|:|@]/)[0].trim() || desc; }
function normalizeMerchantKey(desc: string) { return merchantName(desc).toLowerCase().replace(/\s+/g, ' ').trim(); }

const CONFIDENCE_COLORS: Record<string, string> = { high: '#22d47a', medium: '#f5a623', low: '#f05252' };
const APPS = ['Livin by Mandiri','BCA Mobile','BRImo','GoPay','OVO','DANA','ShopeePay','QRIS'];

const CAMERA_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

const GALLERY_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
);

const UPLOAD_ICON = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
    <path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>
  </svg>
);

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
  const [isMobile, setIsMobile] = useState(false);

  const fileRef   = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
    const check = () => setIsMobile(window.innerWidth < 768 || /Mobi|Android/i.test(navigator.userAgent));
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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

  // Request notification permission silently before scanning so the prompt
  // appears at a natural moment (user just pressed "Start Scan") rather than
  // after they've already saved transactions.
  const ensureNotifPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const runScan = async () => {
    if (!imageDataUrl) return;
    setStatus('loading_ocr'); setProgress(5); setProgressLabel('Loading OCR engine…'); setError('');
    // Ask for notification permission now — feels natural ("scan is starting")
    ensureNotifPermission();
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
        if (!vendorCategoryMap.has(key)) vendorCategoryMap.set(key, e.category_id);
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
      const savedTxs = editedTxs;
      await Promise.all(savedTxs.map(tx => api.createTransaction({ amount: tx.amount, type: tx.type, description: tx.description, date: tx.date, category_id: tx.category_id })));
      setSaved(true);
      showToast(`${savedTxs.length} transactions saved!`);

      // Fire a notification summarising what was just saved.
      // Prefer SW showNotification (works when app is backgrounded on mobile),
      // fall back to basic Notification API if SW isn't available.
      try {
        const total = savedTxs.reduce((s, tx) => s + tx.amount, 0);
        const expenseCount = savedTxs.filter(tx => tx.type === 'expense').length;
        const incomeCount  = savedTxs.filter(tx => tx.type === 'income').length;

        // Build a compact per-transaction summary (up to 3 lines)
        const lines = savedTxs.slice(0, 3).map(tx => {
          const arrow    = tx.type === 'income' ? '↑' : '↓';
          const merchant = merchantName(tx.description) || tx.category_hint || 'Unknown';
          return `${arrow} ${merchant}  ${fmt(tx.amount)}`;
        });
        if (savedTxs.length > 3) lines.push(`…and ${savedTxs.length - 3} more`);

        const typeLabel = incomeCount && expenseCount
          ? `${expenseCount} expense${expenseCount > 1 ? 's' : ''}, ${incomeCount} income`
          : expenseCount
            ? `${expenseCount} expense${expenseCount > 1 ? 's' : ''}`
            : `${incomeCount} income`;

        const title = `✅ ${savedTxs.length} transaction${savedTxs.length > 1 ? 's' : ''} saved  ·  ${fmt(total)}`;
        const body  = lines.join('\n') + (savedTxs.length > 1 ? `\n${typeLabel}` : '');

        const notifOptions = {
          body,
          icon:  '/icon-192.png',
          badge: '/icon-72.png',
          tag:   'ft-scan-result',
          data:  { url: '/dashboard/transactions' },
          ...({ vibrate: [200, 100, 200] } as object),
          ...({ renotify: true } as object),
        };

        // Try service-worker notification first (most reliable on mobile)
        let sent = false;
        if ('serviceWorker' in navigator) {
          try {
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification(title, notifOptions);
            sent = true;
          } catch { /* fall through */ }
        }
        // Basic Notification API fallback (desktop / when SW not available)
        if (!sent) {
          sendLocalNotification(title, body, { tag: 'ft-scan-result', data: { url: '/dashboard/transactions' } });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[Scan][Notification] failed:', e);
      }


    } catch { showToast('Failed to save transactions', 'error'); }
    finally { setSaving(false); }
  };

  const reset = () => {
    setImageDataUrl(null); setStatus('idle'); setEditedTxs([]); setDuplicates([]);
    setOcrText(''); setError(''); setSaved(false); setProgress(0);
    // Reset file inputs so the same file can be re-selected
    if (fileRef.current)   fileRef.current.value = '';
    if (cameraRef.current) cameraRef.current.value = '';
  };
  const isScanning = ['loading_ocr','ocr_running','parsing'].includes(status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 960 }}>

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.2, marginBottom: 4 }}>Scan Transactions</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 560, lineHeight: 1.55 }}>
          {isMobile
            ? 'Take a photo of your bank app or upload a screenshot. Local OCR — nothing is sent to any server.'
            : 'Upload a screenshot from any Indonesian banking app. Local OCR reads and categorizes transactions — nothing is sent to any server.'}
        </p>
      </div>

      {/* App badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {APPS.map(app => (
          <span key={app} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 500 }}>{app}</span>
        ))}
        <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99, background: 'var(--accent-glow)', border: '1px solid var(--accent-glow-2)', color: 'var(--accent-2)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
          100% local
        </span>
      </div>

      {/* ── Upload Zone ── */}
      {!imageDataUrl ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* MOBILE: Camera button — shown first, big and prominent */}
          {isMobile && (
            <button
              onClick={() => cameraRef.current?.click()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                width: '100%', padding: '20px 16px',
                borderRadius: 16, border: '2px solid var(--accent)',
                background: 'var(--accent-glow)', color: 'var(--accent-2)',
                fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em',
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-glow)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-glow)'; }}
            >
              {CAMERA_ICON}
              Take a photo
            </button>
          )}

          {/* Gallery / drag-drop zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            style={{
              position: 'relative', borderRadius: 16, cursor: 'pointer',
              border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border-2)'}`,
              background: dragging ? 'var(--accent-glow)' : 'var(--surface)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 14,
              padding: isMobile ? '28px 20px' : '64px 40px',
              transition: 'all 0.2s ease',
            }}
          >
            {!isMobile && (
              <div style={{ position: 'absolute', inset: 0, borderRadius: 14, opacity: 0.02, backgroundImage: 'linear-gradient(var(--accent) 1px,transparent 1px),linear-gradient(90deg,var(--accent) 1px,transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />
            )}
            <div style={{
              width: isMobile ? 40 : 52, height: isMobile ? 40 : 52,
              borderRadius: 13, background: 'var(--surface-2)',
              border: '1px solid var(--border-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
            }}>
              {isMobile ? GALLERY_ICON : UPLOAD_ICON}
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: isMobile ? 14 : 15, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>
                {isMobile ? 'Choose from gallery' : 'Drop your screenshot here'}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {isMobile ? 'JPG, PNG, WEBP' : 'or click to browse · JPG, PNG, WEBP'}
              </p>
            </div>
          </div>

          {/* Mobile: divider hint */}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
          )}

          {/* Hidden inputs */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

      ) : (
        /* ── After image selected: preview + controls ── */
        <div className="scan-layout" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* On desktop: side-by-side. On mobile: stacked (scan-layout CSS handles this) */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 3fr', gap: 14 }}>

            {/* Screenshot preview */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Screenshot</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {/* Mobile: re-shoot button */}
                  {isMobile && (
                    <button
                      onClick={() => { reset(); setTimeout(() => cameraRef.current?.click(), 50); }}
                      style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, background: 'var(--accent-glow)', color: 'var(--accent-2)', border: '1px solid var(--accent-glow-2)', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600 }}
                    >
                      {CAMERA_ICON && <span style={{ display: 'flex', alignItems: 'center' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg></span>}
                      Retake
                    </button>
                  )}
                  <button
                    onClick={reset}
                    style={{ fontSize: 11, padding: '5px 10px', borderRadius: 7, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                  >
                    {isMobile ? 'Gallery' : 'Change'}
                  </button>
                </div>
              </div>
              <div style={{ padding: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageDataUrl}
                  alt="preview"
                  style={{ width: '100%', borderRadius: 10, objectFit: 'contain', maxHeight: isMobile ? 280 : 520 }}
                />
              </div>
            </div>

            {/* Right / bottom panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Idle — Ready to scan */}
              {status === 'idle' && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: isMobile ? '20px 16px' : 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 13, background: 'var(--accent-glow)', border: '1px solid var(--accent-glow-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 5 }}>Ready to scan</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {isMobile
                        ? 'OCR will extract transaction data from your photo'
                        : 'Tesseract OCR will read and extract transaction data from your screenshot'}
                    </p>
                  </div>
                  <button
                    onClick={runScan}
                    style={{ padding: '12px 36px', borderRadius: 11, fontWeight: 700, fontSize: 14, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 20px var(--accent-glow-2)', letterSpacing: '-0.01em', width: isMobile ? '100%' : 'auto' }}
                  >
                    Start Scan
                  </button>
                </div>
              )}

              {/* Scanning progress */}
              {isScanning && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: isMobile ? '16px' : 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
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

              {/* Done banner */}
              {status === 'done' && (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>
                      {editedTxs.length === 0 ? 'No transactions found' : `${editedTxs.length} transaction${editedTxs.length > 1 ? 's' : ''} detected`}
                    </p>
                    {sourceApp && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Source: {sourceApp}</p>}
                    {notes && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{notes}</p>}
                  </div>
                  <button onClick={runScan} style={{ fontSize: 11, padding: '6px 12px', borderRadius: 8, background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>Scan Again</button>
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{ padding: '12px 16px', borderRadius: 10, background: 'var(--red-muted)', border: '1px solid rgba(240,82,82,0.25)', color: 'var(--red)', fontSize: 13 }}>
                  {error}
                </div>
              )}

              {/* Duplicates */}
              {duplicates.length > 0 && (
                <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--amber-muted)', border: '1px solid rgba(245,166,35,0.25)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>Duplicates Filtered</span>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(245,166,35,0.2)', color: 'var(--amber)', fontWeight: 700 }}>{duplicates.length} removed</span>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Matched existing entries (same merchant + amount + date):</p>
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

              {/* Raw OCR toggle */}
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
        </div>
      )}

      {/* ── Editable transactions ── */}
      {editedTxs.length > 0 && !saved && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em' }}>Review & Edit</h2>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Verify each transaction before saving</p>
            </div>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              style={{ padding: '10px 22px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--green)', color: 'white', border: 'none', opacity: saving ? 0.6 : 1, boxShadow: '0 4px 16px rgba(34,212,122,0.3)', whiteSpace: 'nowrap' }}
            >
              {saving ? 'Saving…' : `Save All (${editedTxs.length})`}
            </button>
          </div>
          <div>
            {editedTxs.map((tx, i) => (
              <div key={i} style={{ padding: isMobile ? '14px 14px' : '16px 22px', borderBottom: i < editedTxs.length-1 ? '1px solid var(--border)' : 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: CONFIDENCE_COLORS[tx.confidence], flexShrink: 0 }} />
                  <input
                    value={tx.description}
                    onChange={e => updateTx(i,'description',e.target.value)}
                    style={{ flex: 1, fontSize: 13, fontWeight: 600, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', borderRadius: 0, padding: '2px 0', color: 'var(--text)', minWidth: 0 }}
                  />
                  <span style={{ fontSize: 10, fontWeight: 700, color: CONFIDENCE_COLORS[tx.confidence], textTransform: 'uppercase', flexShrink: 0 }}>{tx.confidence}</span>
                  <button onClick={() => removeTx(i)} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'var(--red-muted)', color: 'var(--red)', border: '1px solid rgba(240,82,82,0.2)', fontWeight: 600, flexShrink: 0 }}>✕</button>
                </div>
                {/* On mobile: stack fields 2+2, on desktop: single row */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'auto 1fr 1fr 1fr', gap: 8 }}>
                  <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 8, padding: 3, border: '1px solid var(--border)', gap: 3, gridColumn: isMobile ? '1 / -1' : 'auto' }}>
                    {(['expense','income'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => { updateTx(i,'type',t); const c = matchCategory(tx.description); updateTx(i,'category_id', (categories.find(c2 => c2.name===c.category && c2.type===t) || categories.find(c2 => c2.type===t && c2.name==='Other'))?.id ?? null); }}
                        style={{ flex: 1, padding: '6px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: tx.type===t ? (t==='income'?'var(--green)':'var(--red)') : 'transparent', color: tx.type===t?'white':'var(--text-muted)', border: 'none', whiteSpace: 'nowrap' }}
                      >
                        {t === 'income' ? '↑ Income' : '↓ Expense'}
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

      {/* ── Success state ── */}
      {saved && (
        <div style={{ background: 'var(--surface)', border: '1px solid rgba(34,212,122,0.25)', borderRadius: 14, padding: isMobile ? '36px 20px' : '48px 40px', textAlign: 'center' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--green-muted)', border: '1px solid rgba(34,212,122,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--green)', margin: '0 auto 20px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.04em', color: 'var(--green)', marginBottom: 8 }}>Saved successfully!</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>{editedTxs.length} transactions added to your financial history</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={reset} style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'white', border: 'none', boxShadow: '0 4px 16px var(--accent-glow-2)' }}>Scan Again</button>
            <a href="/dashboard/transactions" style={{ padding: '10px 24px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>View Transactions →</a>
          </div>
        </div>
      )}

      {/* ── Tips ── */}
      {!imageDataUrl && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 10 }}>
          {[
            {
              color: 'var(--accent)',
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>,
              title: isMobile ? 'Camera tips' : 'Screenshot tips',
              desc: isMobile
                ? 'Hold steady and ensure amounts are fully in frame. Good lighting helps — avoid glare on the screen.'
                : 'Use the transactions history page. Ensure amounts are clearly visible. Avoid blurry or cropped images.',
            },
            {
              color: 'var(--green)',
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
              title: 'Fully private',
              desc: 'Tesseract.js runs directly in your browser. Your photos are never uploaded to any server.',
            },
            {
              color: 'var(--amber)',
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
              title: 'Always editable',
              desc: 'After scanning, correct categories, amounts, or dates before saving. View raw OCR text if needed.',
            },
          ].map(tip => (
            <div key={tip.title} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: isMobile ? '14px 16px' : 18, display: 'flex', gap: isMobile ? 12 : 0, flexDirection: isMobile ? 'row' : 'column', alignItems: isMobile ? 'flex-start' : 'flex-start' }}>
              <div style={{ color: tip.color, flexShrink: 0, marginBottom: isMobile ? 0 : 10 }}>{tip.icon}</div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>{tip.title}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55 }}>{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}