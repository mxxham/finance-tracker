// ─── Types ───────────────────────────────────────────────────────────────────

export interface ParsedTransaction {
  amount: number;
  type: 'income' | 'expense';
  description: string;
  date: string;
  raw_merchant: string;
  category_hint: string;
  confidence: 'high' | 'medium' | 'low';
  source_app: string;
}

// ─── Category keyword mapping (Indonesian context) ───────────────────────────

const CATEGORY_RULES: { keywords: string[]; category: string; type: 'income' | 'expense' }[] = [
  // Income
  { keywords: ['gaji', 'salary', 'payroll', 'thr', 'bonus', 'rapel'], category: 'Salary', type: 'income' },
  { keywords: ['freelance', 'honor', 'honorarium', 'jasa'], category: 'Freelance', type: 'income' },
  { keywords: ['transfer masuk', 'terima', 'received', 'kredit', 'cr ', 'dana masuk', 'top up'], category: 'Incoming Transfer', type: 'income' },
  { keywords: ['dividen', 'bunga', 'investasi masuk', 'return'], category: 'Business', type: 'income' },

  // Food & Drink
  { keywords: ['mcdonald', 'mcdonalds', 'kfc', 'burger king', 'pizza hut', 'domino', 'jco', 'dunkin', 'starbucks', 'kopi', 'cafe', 'coffee', 'resto', 'restaurant', 'warung', 'makan', 'bakso', 'mie', 'nasi', 'ayam', 'soto', 'geprek', 'padang', 'warteg', 'kantin', 'food', 'eat', 'grab food', 'gofood', 'shopeefood', 'shopeepay food', 'ojol food'], category: 'Food & Drink', type: 'expense' },
  
  // Transport
  { keywords: ['grab', 'gojek', 'goride', 'gocar', 'grabcar', 'grabike', 'ojol', 'ojek', 'taxi', 'taksi', 'maxim', 'indriver', 'pertamina', 'shell', 'spbu', 'bbm', 'bensin', 'toll', 'tol', 'parkir', 'parking', 'busway', 'transjakarta', 'commuter', 'krl', 'mrt', 'lrt', 'kereta', 'bis ', 'bus '], category: 'Transport & Rideshare', type: 'expense' },

  // Shopping
  { keywords: ['indomaret', 'alfamart', 'alfamidi', 'lawson', 'circle k', 'supermarket', 'hypermart', 'carrefour', 'transmart', 'lottemart', 'giant', 'hero ', 'tokopedia', 'shopee', 'lazada', 'bukalapak', 'blibli', 'tiktok shop', 'zalora', 'uniqlo', 'h&m', 'zara', 'beli ', 'pembelian', 'purchase'], category: 'Shopping', type: 'expense' },

  // QRIS & E-Wallet
  { keywords: ['qris', 'gopay', 'ovo', 'dana', 'linkaja', 'shopeepay', 'spay', 'e-wallet', 'ewallet', 'dompet digital', 'bayar qr', 'scan qr', 'qr payment'], category: 'QRIS & E-Wallet', type: 'expense' },

  // Bills & Utilities
  { keywords: ['pln', 'listrik', 'pdam', 'air ', 'gas ', 'pgn', 'internet', 'wifi', 'firstmedia', 'indihome', 'telkom', 'speedy', 'bpjs', 'asuransi', 'insurance', 'iuran', 'cicilan', 'tagihan', 'bill', 'utility'], category: 'Bills & Utilities', type: 'expense' },

  // Phone/Data
  { keywords: ['telkomsel', 'xl', 'indosat', 'im3', 'tri ', '3 ', 'smartfren', 'pulsa', 'paket data', 'data plan', 'voucher'], category: 'Phone & Internet', type: 'expense' },

  // Entertainment
  { keywords: ['netflix', 'spotify', 'disney', 'vidio', 'youtube', 'bioskop', 'cinema', 'cgv', 'cinepolis', 'xxi', 'game', 'steam', 'playstation', 'hiburan', 'karaoke', 'hotel', 'airbnb', 'traveloka', 'tiket.com', 'booking'], category: 'Entertainment', type: 'expense' },

  // Health
  { keywords: ['apotek', 'apotik', 'farmasi', 'kimia farma', 'guardian', 'watson', 'rumah sakit', 'rs ', 'klinik', 'dokter', 'obat', 'kesehatan', 'health', 'medical', 'laboratorium'], category: 'Health', type: 'expense' },

  // Rent & Housing
  { keywords: ['kost', 'kos ', 'sewa', 'rent', 'kontrakan', 'apartemen', 'apartment', 'rumah', 'indekos', 'ipl ', 'maintenance'], category: 'Rent & Housing', type: 'expense' },

  // Education
  { keywords: ['spp', 'ukt', 'sekolah', 'kuliah', 'universitas', 'kampus', 'kursus', 'les ', 'bimbel', 'ruangguru', 'zenius', 'coursera', 'udemy', 'pendidikan'], category: 'Education', type: 'expense' },

  // Savings/Investment
  { keywords: ['tabungan', 'deposito', 'reksa dana', 'saham', 'bibit', 'bareksa', 'stockbit', 'ajaib', 'pluang', 'investasi', 'nabung'], category: 'Savings & Investment', type: 'expense' },
];

// ─── Date parsing ─────────────────────────────────────────────────────────────

const MONTHS_ID: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', may: '05',
  jun: '06', jul: '07', agu: '08', aug: '08', sep: '09', okt: '10',
  oct: '10', nov: '11', des: '12', dec: '12',
};

function parseDate(text: string): string {
  const today = new Date().toISOString().split('T')[0];

  // DD Mon YYYY or DD Mon YY  (e.g. "05 Mei 2026", "5 Jan 26")
  const m1 = text.match(/(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{2,4})/);
  if (m1) {
    const day = m1[1].padStart(2, '0');
    const mon = MONTHS_ID[m1[2].toLowerCase().slice(0, 3)];
    const yr = m1[3].length === 2 ? '20' + m1[3] : m1[3];
    if (mon) return `${yr}-${mon}-${day}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const m2 = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/);
  if (m2) {
    const yr = m2[3].length === 2 ? '20' + m2[3] : m2[3];
    return `${yr}-${m2[2]}-${m2[1]}`;
  }

  // YYYY-MM-DD (ISO)
  const m3 = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m3) return `${m3[1]}-${m3[2]}-${m3[3]}`;

  return today;
}

// ─── Amount parsing ───────────────────────────────────────────────────────────

// Reference/transaction codes from Livin: 12-digit numeric strings like 605053615800
// We must NOT parse these as amounts.
function isRefNumber(text: string): boolean {
  // Pure digit strings with 9+ digits are almost certainly ref codes, not amounts
  return /^\d{9,}$/.test(text.trim());
}

const MAX_IDR = 999_999_999; // 999 juta — sane upper bound for personal transactions

function parseAmount(text: string): number | null {
  const trimmed = text.trim();

  // Skip reference number lines entirely
  if (isRefNumber(trimmed)) return null;

  // Priority 1: explicit "Rp" or "IDR" prefix — most reliable
  const rpMatch = trimmed.match(/(?:Rp\.?|IDR)\s*([\d.,]+)/i);
  if (rpMatch) {
    const num = normalizeIDR(rpMatch[1]);
    if (num !== null && num >= 100 && num <= MAX_IDR) return num;
  }

  // Priority 2: formatted thousand-separated number (e.g. "1.500.000" or "50,000")
  // Must have at least one separator group to distinguish from ref numbers
  const fmtMatch = trimmed.match(/\b(\d{1,3}(?:[.,]\d{3})+)\b/);
  if (fmtMatch) {
    const num = normalizeIDR(fmtMatch[1]);
    if (num !== null && num >= 100 && num <= MAX_IDR) return num;
  }

  // Priority 3: bare number — only if the line also contains a currency keyword nearby
  // (avoids grabbing reference codes on standalone lines)
  if (/(?:Rp|IDR|bayar|harga|nominal|jumlah|total)/i.test(trimmed)) {
    const bareMatch = trimmed.match(/\b(\d{3,9})\b/);
    if (bareMatch) {
      const num = parseInt(bareMatch[1], 10);
      if (!isNaN(num) && num >= 100 && num <= MAX_IDR) return num;
    }
  }

  return null;
}

function normalizeIDR(raw: string): number | null {
  raw = raw.replace(/\s/g, '');
  let cleaned: string;

  if (/^\d+\.\d{3}(\.\d{3})*$/.test(raw)) {
    // Indonesian dot-thousands: 1.500.000  → 1500000
    cleaned = raw.replace(/\./g, '');
  } else if (/^\d+,\d{3}(,\d{3})*$/.test(raw)) {
    // Comma-thousands: 1,500,000 → 1500000
    cleaned = raw.replace(/,/g, '');
  } else if (/^\d+[.,]\d{2}$/.test(raw)) {
    // Decimal cents: 50000.00 or 50000,00 → 50000
    cleaned = raw.replace(/[.,]\d{2}$/, '');
  } else {
    // Plain number
    cleaned = raw.replace(/[.,]/g, '');
  }

  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

// ─── Detect transaction type from context words ───────────────────────────────

function detectType(line: string): 'income' | 'expense' | null {
  const lower = line.toLowerCase();
  const incomeWords = ['masuk', 'kredit', 'cr ', 'diterima', 'terima', 'top.?up', 'topup', 'deposit', 'refund', 'kembali', 'cashback'];
  const expenseWords = ['keluar', 'debet', 'db ', 'bayar', 'beli', 'transfer ke', 'kirim', 'tarik', 'pembayaran', 'pembelian', 'debit'];
  if (incomeWords.some(w => lower.match(new RegExp(w)))) return 'income';
  if (expenseWords.some(w => lower.match(new RegExp(w)))) return 'expense';
  return null;
}

// ─── Category matcher ─────────────────────────────────────────────────────────

export function matchCategory(text: string): { category: string; type: 'income' | 'expense' } {
  const lower = text.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      return { category: rule.category, type: rule.type };
    }
  }
  return { category: 'Other', type: 'expense' };
}

// ─── Detect source app ────────────────────────────────────────────────────────

function detectSourceApp(fullText: string): string {
  const lower = fullText.toLowerCase();
  if (lower.includes('livin') || lower.includes('mandiri')) return 'Livin by Mandiri';
  if (lower.includes('mybca') || lower.includes('bca mobile') || lower.includes('klik bca')) return 'BCA Mobile';
  if (lower.includes('brimo') || lower.includes('bri mobile')) return 'BRImo';
  if (lower.includes('bni mobile') || lower.includes('bni ')) return 'BNI Mobile';
  if (lower.includes('gopay')) return 'GoPay';
  if (lower.includes('ovo')) return 'OVO';
  if (lower.includes('dana')) return 'DANA';
  if (lower.includes('shopeepay') || lower.includes('spay')) return 'ShopeePay';
  if (lower.includes('linkaja')) return 'LinkAja';
  if (lower.includes('qris')) return 'QRIS';
  return 'Bank/E-Wallet';
}

// ─── Line classifier ─────────────────────────────────────────────────────────

function isDateLine(line: string): boolean {
  return /\d{1,2}\s+[A-Za-z]{3,}\s+\d{2,4}/.test(line) ||
         /\d{2}[\/\-]\d{2}[\/\-]\d{2,4}/.test(line);
}

function isMerchantLine(line: string): boolean {
  if (isRefNumber(line)) return false;
  if (parseAmount(line) !== null) return false;
  if (isDateLine(line)) return false;
  // Skip UI boilerplate lines
  if (/^(pembayaran|payment|transfer|qr bayar|qris tap|no\.|ref\.|status|berhasil|sukses|selesai|detail|lihat|riwayat|e-statement|transaksi|loading|0:0)/i.test(line)) return false;
  // A merchant is text-heavy, not just numbers
  const hasLetters = /[A-Za-z]{3,}/.test(line);
  return hasLetters && line.length >= 3 && line.length <= 80;
}

// ─── Livin by Mandiri specific block parser ───────────────────────────────────
// Livin layout per transaction:
//   [icon] QR Bayar - Rp 5.000
//   Pembayaran QR
//   ke Toko Kelontong Hana
//   605053615800          ← ref number (12 digits)

function parseLivinBlocks(lines: string[], today: string, source_app: string): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  // Find "QR Bayar", "QRIS Tap", "Transfer", "Tarik Tunai" header lines
  const blockHeaderRe = /(?:QR Bayar|QRIS Tap|Transfer|Tarik Tunai|Top.?Up|Pembelian|Pembayaran)/i;

  let currentDate = today;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track the running date context
    if (isDateLine(line) && !parseAmount(line)) {
      const d = parseDate(line);
      if (d !== today) currentDate = d;
      continue;
    }

    // Detect a transaction header line that also contains an amount
    const amountOnHeader = parseAmount(line);
    const isHeader = blockHeaderRe.test(line) || amountOnHeader !== null;
    if (!isHeader || amountOnHeader === null) continue;

    // Grab the next 4 lines as context (merchant, ref, etc.)
    const contextLines = lines.slice(i, Math.min(lines.length, i + 5));
    const contextText = contextLines.join(' ');

    // Skip pure ref-number lines when scanning for merchant
    let merchant = '';
    // "ke <merchant>" pattern specific to Livin
    for (const cl of contextLines) {
      const keMatch = cl.match(/^ke\s+(.+)/i);
      if (keMatch && keMatch[1].trim().length > 2) {
        merchant = keMatch[1].trim();
        break;
      }
    }
    // Fallback: first good merchant-looking line after header
    if (!merchant) {
      for (const cl of contextLines.slice(1)) {
        if (isMerchantLine(cl)) {
          merchant = cl
            .replace(/^(ke|dari|kepada)\s+/i, '')
            .trim();
          break;
        }
      }
    }

    const cat = matchCategory(contextText + ' ' + merchant);
    const txType = detectType(contextText) || cat.type;

    const confidence: 'high' | 'medium' | 'low' =
      merchant ? 'high' : 'medium';

    results.push({
      amount: amountOnHeader,
      type: txType,
      description: merchant || line.replace(/Rp[\s\d.,]+/i, '').trim() || cat.category,
      date: currentDate,
      raw_merchant: merchant,
      category_hint: cat.category,
      confidence,
      source_app,
    });
  }
  return results;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseOCRText(rawText: string): {
  transactions: ParsedTransaction[];
  source_app: string;
  notes: string;
} {
  const source_app = detectSourceApp(rawText);
  const today = new Date().toISOString().split('T')[0];

  // Clean up OCR noise: remove pure-digit reference lines before general parsing
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .filter(l => !isRefNumber(l)); // drop 9+ digit ref codes entirely

  // ── Try Livin-specific parser first ──────────────────────────────────────
  const livinTxs = parseLivinBlocks(lines, today, source_app);
  if (livinTxs.length > 0) {
    return {
      transactions: livinTxs,
      source_app,
      notes: `${livinTxs.length} transactions detected from ${source_app}`,
    };
  }

  // ── Generic fallback: scan every line for amounts ─────────────────────────
  const transactions: ParsedTransaction[] = [];
  const amountLineIndices: number[] = [];
  lines.forEach((line, i) => {
    if (parseAmount(line) !== null) amountLineIndices.push(i);
  });

  if (amountLineIndices.length === 0) {
    return {
      transactions: [],
      source_app,
      notes: 'No transactions detected. Try a clearer screenshot or make sure the amount with "Rp" is visible.',
    };
  }

  // Group adjacent amount lines into blocks
  const groupedIndices: number[][] = [];
  let current: number[] = [amountLineIndices[0]];
  for (let i = 1; i < amountLineIndices.length; i++) {
    if (amountLineIndices[i] - amountLineIndices[i - 1] <= 3) {
      current.push(amountLineIndices[i]);
    } else {
      groupedIndices.push(current);
      current = [amountLineIndices[i]];
    }
  }
  groupedIndices.push(current);

  let runningDate = today;

  for (const group of groupedIndices) {
    const centerIdx = group[0];
    const contextStart = Math.max(0, centerIdx - 4);
    const contextEnd = Math.min(lines.length - 1, group[group.length - 1] + 4);
    const contextLines = lines.slice(contextStart, contextEnd + 1);
    const contextText = contextLines.join(' ');

    // Update running date if a date line appears before this block
    for (const cl of contextLines) {
      if (isDateLine(cl)) {
        const d = parseDate(cl);
        if (d !== today) runningDate = d;
      }
    }

    // Pick best amount in group
    let amount = 0;
    for (const idx of group) {
      const a = parseAmount(lines[idx]);
      if (a && a > amount) amount = a;
    }
    if (!amount || amount < 100) continue;

    const cat = matchCategory(contextText);
    const txType = detectType(contextText) || cat.type;

    let merchant = '';
    for (const cl of contextLines) {
      if (isMerchantLine(cl)) {
        merchant = cl.replace(/^(ke|dari|kepada)\s+/i, '').trim();
        break;
      }
    }

    const confidence: 'high' | 'medium' | 'low' =
      merchant && runningDate !== today ? 'high'
        : merchant || runningDate !== today ? 'medium' : 'low';

    transactions.push({
      amount,
      type: txType,
      description: merchant || `${cat.category}`,
      date: runningDate,
      raw_merchant: merchant,
      category_hint: cat.category,
      confidence,
      source_app,
    });
  }

  return {
    transactions,
    source_app,
    notes: transactions.length === 0
      ? 'Tidak ada transaksi terdeteksi. Pastikan screenshot memuat nominal "Rp" yang jelas.'
      : `${transactions.length} transaksi terdeteksi dari ${source_app}`,
  };
}