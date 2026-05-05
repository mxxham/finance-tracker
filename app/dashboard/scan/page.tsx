'use client';
import { useState, useRef, useCallback, DragEvent, ChangeEvent, useEffect } from 'react';
import { api } from '@/lib/api';
import { parseOCRText, matchCategory, ParsedTransaction } from '@/lib/parser';

interface Category { id: number; name: string; color: string; type: string; }

type ScanStatus =
  | 'idle'
  | 'loading_ocr'
  | 'ocr_running'
  | 'parsing'
  | 'done'
  | 'error';

function fmt(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
  }).format(n);
}

function merchantName(description: string): string {
  // Normalize merchant names by removing common prefixes/suffixes, numbers, and extra spaces
  return description
    .toLowerCase()
    // Remove common banking prefixes/suffixes
    .replace(/^(transfer|payment|purchase|debit|credit|from|to|atm|online|mobile|web)\s+/i, '')
    .replace(/\s+(transfer|payment|purchase|debit|credit|from|to|atm|online|mobile|web)$/i, '')
    // Remove transaction codes, reference numbers, etc.
    .replace(/\b\d{4,}\b/g, '') // Remove sequences of 4+ digits
    .replace(/[#*]\w+/g, '') // Remove codes like #ABC123
    .replace(/\b(ref|trx|txn|id)\s*\d*\b/gi, '') // Remove reference/transaction IDs
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim();
}

const CONFIDENCE_COLOR = {
  high: '#22c55e',
  medium: '#f59e0b',
  low: '#ef4444',
};

export default function ScanPage() {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
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
  const [filteredTxs, setFilteredTxs] = useState<(ParsedTransaction & { category_id: number | null })[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getCategories().then(setCategories).catch(() => {});
  }, []);

  const matchCategoryId = useCallback(
    (hint: string, type: 'income' | 'expense'): number | null => {
      const cat = categories.find(
        c => c.name === hint && c.type === type
      ) || categories.find(
        c => c.type === type && c.name === 'Other'
      );
      return cat?.id ?? null;
    },
    [categories]
  );

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('File Must Be Image Type (JPG, PNG, WEBP)');
      return;
    }
    setError('');
    setSaved(false);
    setTransactions([]);
    setEditedTxs([]);
    setOcrText('');
    setStatus('idle');
    const reader = new FileReader();
    reader.onload = e => {
      setImageDataUrl(e.target?.result as string);
      setStatus('idle');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const runScan = async () => {
    if (!imageDataUrl) return;
    setStatus('loading_ocr');
    setProgress(5);
    setProgressLabel('Loading MCR Machine...');
    setError('');

    try {
      // Dynamically import Tesseract only on client
      const { createWorker } = await import('tesseract.js');

      setStatus('ocr_running');
      setProgressLabel('Initializing Tesseract...');
      setProgress(15);

      const worker = await createWorker(['ind', 'eng'], 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(15 + m.progress * 70);
            setProgress(pct);
            setProgressLabel(`Reading text... ${Math.round(m.progress * 100)}%`);
          } else if (m.status.includes('load')) {
            setProgressLabel(`Loading language model...`);
          }
        },
      });

      setProgressLabel('Analyzing image...');
      const result = await worker.recognize(imageDataUrl);
      await worker.terminate();

      const raw = result.data.text;
      setOcrText(raw);

      setStatus('parsing');
      setProgress(90);
      setProgressLabel('Identifying transactions...');

      // Small delay so UI updates
      await new Promise(r => setTimeout(r, 300));

      const parsed = parseOCRText(raw);
      setSourceApp(parsed.source_app);
      setNotes(parsed.notes);
      setTransactions(parsed.transactions);

      // Check for duplicates - get ALL transactions to ensure comprehensive checking
      setProgressLabel('Checking for duplicates...');
      const existingTxs = await api.getTransactions({
        limit: '10000', // Get many more transactions to check against
      });

      const duplicates: ParsedTransaction[] = [];
      const uniqueTxs = parsed.transactions.filter(tx => {
        const isDuplicate = existingTxs.some((existing: any) => {
          // Normalize descriptions for comparison
          const txMerchant = merchantName(tx.description);
          const existingMerchant = merchantName(existing.description);

          // Check merchant match (exact or very similar)
          const merchantMatch = txMerchant === existingMerchant ||
            txMerchant.includes(existingMerchant) ||
            existingMerchant.includes(txMerchant);

          // Amount match with percentage tolerance (2% or max 1000 difference)
          const amountDiff = Math.abs(tx.amount - existing.amount);
          const amountTolerance = Math.max(tx.amount * 0.02, 1000); // 2% or 1000 max
          const amountMatch = amountDiff <= amountTolerance;

          // Type match (income vs expense)
          const typeMatch = tx.type === existing.type;

          // Debug logging for troubleshooting
          if (merchantMatch && amountMatch && typeMatch) {
            console.log('Duplicate found:', {
              scanned: { desc: tx.description, amount: tx.amount, date: tx.date },
              existing: { desc: existing.description, amount: existing.amount, date: existing.date }
            });
          }

          return merchantMatch && amountMatch && typeMatch;
        });

        if (isDuplicate) {
          duplicates.push(tx);
          return false;
        }
        return true;
      });

      setDuplicates(duplicates);

      // Attach real category_id from user's categories
      const withIds = uniqueTxs.map(tx => ({
        ...tx,
        category_id: matchCategoryId(tx.category_hint, tx.type),
      }));
      setEditedTxs(withIds);
      setFilteredTxs(withIds);

      setProgress(100);
      setStatus('done');
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to run OCR');
      setStatus('error');
    }
  };

  const updateTx = (i: number, field: string, value: string | number | null) => {
    setEditedTxs(prev =>
      prev.map((tx, idx) => idx === i ? { ...tx, [field]: value } : tx)
    );
  };

  const removeTx = (i: number) => setEditedTxs(prev => prev.filter((_, idx) => idx !== i));

  const handleSaveAll = async () => {
    if (!editedTxs.length) return;
    setSaving(true);
    try {
      await Promise.all(
        editedTxs.map(tx =>
          api.createTransaction({
            amount: tx.amount,
            type: tx.type,
            description: tx.description,
            date: tx.date,
            category_id: tx.category_id,
          })
        )
      );
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save transactions');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setImageDataUrl(null);
    setStatus('idle');
    setTransactions([]);
    setEditedTxs([]);
    setFilteredTxs([]);
    setDuplicates([]);
    setOcrText('');
    setError('');
    setSaved(false);
    setProgress(0);
  };

  const isScanning = status === 'loading_ocr' || status === 'ocr_running' || status === 'parsing';

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Scan Transactions</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Upload a screenshot of Livin by Mandiri, QRIS, or another bank app — local OCR will read and categorize transactions automatically, without an external API.
</p>


      </div>

      {/* App badges */}
      <div className="flex flex-wrap gap-2">
        {['Livin by Mandiri', 'BCA Mobile', 'BRImo', 'GoPay', 'OVO', 'DANA', 'ShopeePay', 'QRIS'].map(app => (
          <span key={app} className="text-xs px-3 py-1 rounded-full"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {app}
          </span>
        ))}
      </div>

      {/* Upload Zone */}
      {!imageDataUrl ? (
        <div
          onClick={() => fileRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          className="relative rounded-2xl cursor-pointer transition-all flex flex-col items-center justify-center gap-5 py-24"
          style={{
            border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
            background: dragging ? '#6366f108' : 'var(--surface)',
          }}
        >
          <div className="absolute inset-0 rounded-2xl opacity-[0.025]" style={{
            backgroundImage: 'linear-gradient(var(--accent) 1px,transparent 1px),linear-gradient(90deg,var(--accent) 1px,transparent 1px)',
            backgroundSize: '32px 32px',
          }} />
          <div className="relative z-10 flex flex-col items-center gap-4 text-center">
            <div className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Upload</div>
            <div>
              <p className="font-semibold text-lg">Drag & drop screenshot here</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>or click to select file · JPG, PNG, WEBP</p>
            </div>
            <div className="flex items-center gap-2 text-xs px-4 py-2 rounded-full"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              Processed locally in the browser — not sent to any server
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-6">
          {/* Screenshot preview */}
          <div className="col-span-2 rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-sm font-semibold">Screenshot</span>
              <button onClick={reset} className="text-xs px-2 py-1 rounded-md"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                Change
              </button>
            </div>
            <div className="p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageDataUrl} alt="preview" className="w-full rounded-xl object-contain max-h-[520px]" />
            </div>
          </div>

          {/* Right panel */}
          <div className="col-span-3 space-y-4">
            {/* Scan button / progress */}
            {status === 'idle' && (
              <div className="rounded-xl p-6 flex flex-col items-center gap-4 text-center"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div>
                  <p className="font-semibold">Ready for Analysis</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    Tesseract OCR will read the text from the screenshot and detect transactions
                  </p>
                </div>
                <button onClick={runScan}
                  className="px-8 py-3 rounded-xl font-bold text-white text-sm"
                  style={{ background: 'var(--accent)' }}>
                  Start Scan
                </button>
              </div>
            )}

            {isScanning && (
              <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full border-2 border-current animate-spin" />
                  <div>
                    <p className="font-semibold text-sm">Analyzing...</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{progressLabel}</p>
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%`, background: 'var(--accent)' }} />
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {progress}% — OCR is running in your browser, no data is sent outside
                </p>
              </div>
            )}

            {status === 'done' && (
              <div className="rounded-xl px-5 py-4 flex items-center justify-between"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div>
                  <p className="font-semibold text-sm">
                    {editedTxs.length === 0 ? 'No transactions found' : `${editedTxs.length} transactions detected`}
                  </p>
                  {sourceApp && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Source: {sourceApp}</p>}
                  {notes && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{notes}</p>}
                </div>
                <button onClick={runScan} className="text-xs px-3 py-1.5 rounded-lg ml-4 flex-shrink-0"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  Scan Again
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-xl px-4 py-3 text-sm"
                style={{ background: '#ef444415', border: '1px solid #ef444430', color: 'var(--red)' }}>
                Error: {error}
              </div>
            )}

            {/* Duplicates filtered out */}
            {duplicates.length > 0 && (
              <div className="rounded-xl px-4 py-3"
                style={{ background: '#f59e0b15', border: '1px solid #f59e0b30' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold" style={{ color: '#f59e0b' }}>⚠️ Duplicates Filtered</span>
                  <span className="text-xs px-2 py-1 rounded" style={{ background: '#f59e0b20', color: '#f59e0b' }}>
                    {duplicates.length} transaction{duplicates.length > 1 ? 's' : ''} removed
                  </span>
                </div>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  These transactions matched existing ones in your database (same merchant, similar amount, same type):
                </p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {duplicates.map((tx, i) => (
                    <div key={i} className="text-xs flex items-center justify-between py-1 px-2 rounded"
                      style={{ background: 'var(--surface-2)' }}>
                      <div className="flex-1">
                        <span className="font-medium">{merchantName(tx.description)}</span>
                        <span className="ml-2 text-gray-500">({tx.description})</span>
                      </div>
                      <span className="font-mono ml-2">{fmt(tx.amount)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  💡 Tip: Recurring purchases at the same vendor are now allowed on different dates.
                </p>
              </div>
            )}

            {/* OCR Raw text toggle */}
            {ocrText && (
              <div>
                <button onClick={() => setShowRawText(v => !v)}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                  {showRawText ? 'Hide raw OCR text' : 'Show raw OCR text'}
                </button>
                {showRawText && (
                  <pre className="mt-2 text-xs p-3 rounded-xl overflow-auto max-h-40 font-mono"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)', whiteSpace: 'pre-wrap' }}>
                    {ocrText}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editable transaction review */}
      {editedTxs.length > 0 && !saved && (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <h2 className="font-bold">Check & Edit Transactions</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                Correct any errors, then save all at once
              </p>
            </div>
            <button onClick={handleSaveAll} disabled={saving}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
              style={{ background: '#22c55e' }}>
              {saving ? 'Saving...' : `Save All (${editedTxs.length})`}
            </button>
          </div>

          <div>
            {editedTxs.map((tx, i) => (
              <div key={i} className="px-6 py-4 space-y-3"
                style={{ borderBottom: i < editedTxs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                {/* Row 1: description + confidence + remove */}
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: CONFIDENCE_COLOR[tx.confidence] }} />
                  <input value={tx.description}
                    onChange={e => updateTx(i, 'description', e.target.value)}
                    className="flex-1 text-sm font-medium"
                    style={{ background: 'transparent', border: 'none', padding: 0, borderRadius: 0, borderBottom: '1px solid var(--border)' }}
                  />
                  <span className="text-xs flex-shrink-0" style={{ color: CONFIDENCE_COLOR[tx.confidence] }}>
                    {tx.confidence}
                  </span>
                  <button onClick={() => removeTx(i)} style={{ color: 'var(--red)', flexShrink: 0 }}>Remove</button>
                </div>

                {/* Row 2: type toggle | amount | category | date */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="flex gap-1">
                    {(['expense', 'income'] as const).map(t => (
                      <button key={t} onClick={() => {
                        updateTx(i, 'type', t);
                        // Re-match category when type changes
                        const newCat = matchCategory(tx.description);
                        const matched = categories.find(c => c.name === newCat.category && c.type === t)
                          || categories.find(c => c.type === t && c.name === 'Other');
                        updateTx(i, 'category_id', matched?.id ?? null);
                      }}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold"
                        style={{
                          background: tx.type === t ? (t === 'income' ? '#22c55e' : '#ef4444') : 'var(--surface-2)',
                          color: tx.type === t ? 'white' : 'var(--text-muted)',
                        }}>
                        {t === 'income' ? '↑ Income' : '↓ Expense'}
                      </button>
                    ))}
                  </div>

                  <input type="number" value={tx.amount}
                    onChange={e => updateTx(i, 'amount', Number(e.target.value))}
                    className="text-sm font-mono" style={{ padding: '6px 10px' }}
                  />

                  <select value={tx.category_id ?? ''}
                    onChange={e => updateTx(i, 'category_id', e.target.value ? Number(e.target.value) : null)}
                    className="text-sm" style={{ padding: '6px 10px' }}>
                    <option value="">No category</option>
                    {categories.filter(c => c.type === tx.type).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <input type="date" value={tx.date}
                    onChange={e => updateTx(i, 'date', e.target.value)}
                    className="text-sm" style={{ padding: '6px 10px' }}
                  />
                </div>

                {/* Row 3: summary pill */}
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full font-mono font-semibold"
                    style={{ background: tx.type === 'income' ? '#22c55e20' : '#ef444420', color: tx.type === 'income' ? 'var(--green)' : 'var(--red)' }}>
                    {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                  </span>
                  {tx.category_id && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      → {categories.find(c => c.id === tx.category_id)?.name}
                    </span>
                  )}
                  {tx.raw_merchant && (
                    <span className="text-xs ml-auto font-mono" style={{ color: 'var(--text-muted)' }}>
                      OCR: &quot;{tx.raw_merchant}&quot;
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success */}
      {saved && (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid #22c55e40' }}>
          <div className="text-sm mb-4 uppercase tracking-wide" style={{ color: 'var(--green)' }}>Success</div>
          <h2 className="font-bold text-xl" style={{ color: 'var(--green)' }}>Successfully Saved!</h2>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            {editedTxs.length} transactions added to your financial history
          </p>
          <div className="flex gap-3 justify-center mt-6">
            <button onClick={reset} className="px-6 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: 'var(--accent)' }}>
              Scan Again
            </button>
            <a href="/dashboard/transactions"
              className="px-6 py-2.5 rounded-xl text-sm font-semibold inline-block"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}>
              View Transactions
            </a>
          </div>
        </div>
      )}

      {/* Tips */}
      {!imageDataUrl && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { title: 'Best Screenshot Tips', desc: 'Use the transactions history page. Ensure the amount is clearly visible. Avoid cropped or blurry screenshots.' },
            { title: 'Local OCR — 100% Private', desc: 'Using Tesseract.js that runs directly in your browser. Screenshots are never sent to any server.' },
            { title: 'Always Editable', desc: 'After scanning, you can correct the category, amount, or date before saving. OCR results can be viewed in "raw text".' },
          ].map(tip => (
            <div key={tip.title} className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Tip</div>
              <p className="text-sm font-semibold">{tip.title}</p>
              <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{tip.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
