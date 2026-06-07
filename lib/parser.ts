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
  { keywords: ['transfer masuk', 'terima', 'received', 'kredit', 'cr ', 'dana masuk', 'top up', 'topup'], category: 'Incoming Transfer', type: 'income' },
  { keywords: ['dividen', 'bunga', 'investasi masuk', 'return'], category: 'Business', type: 'income' },

  // Food & Drink
  { keywords: ['mcdonald', 'mcdonalds', 'kfc', 'burger king', 'pizza hut', 'domino', 'jco', 'dunkin', 'starbucks', 'kopi', 'cafe', 'coffee', 'resto', 'restaurant', 'warung', 'makan', 'bakso', 'mie', 'nasi', 'ayam', 'soto', 'geprek', 'padang', 'warteg', 'kantin', 'food', 'eat', 'grab food', 'gofood', 'shopeefood', 'shopeepay food', 'ojol food', 'rm ', 'rumah makan', 'fajar', 'wartes', 'depot'], category: 'Food & Drink', type: 'expense' },

  // Transport
  { keywords: ['grab', 'gojek', 'goride', 'gocar', 'grabcar', 'grabike', 'ojol', 'ojek', 'taxi', 'taksi', 'maxim', 'indriver', 'pertamina', 'shell', 'spbu', 'bbm', 'bensin', 'toll', 'tol', 'parkir', 'parking', 'busway', 'transjakarta', 'commuter', 'krl', 'mrt', 'lrt', 'kereta', 'bis ', 'bus '], category: 'Transport & Rideshare', type: 'expense' },

  // Shopping
  { keywords: ['indomaret', 'alfamart', 'alfamidi', 'lawson', 'circle k', 'supermarket', 'hypermart', 'carrefour', 'transmart', 'lottemart', 'giant', 'hero ', 'tokopedia', 'shopee', 'lazada', 'bukalapak', 'blibli', 'tiktok shop', 'zalora', 'uniqlo', 'h&m', 'zara', 'beli ', 'pembelian', 'purchase'], category: 'Shopping', type: 'expense' },

  // QRIS & E-Wallet
  { keywords: ['qris', 'gopay', 'ovo', 'dana', 'linkaja', 'shopeepay', 'spay', 'e-wallet', 'ewallet', 'dompet digital', 'bayar qr', 'scan qr', 'qr payment', 'pembayaran qris'], category: 'QRIS & E-Wallet', type: 'expense' },

  // Bills & Utilities
  { keywords: ['pln', 'listrik', 'pdam', 'air ', 'gas ', 'pgn', 'internet', 'wifi', 'firstmedia', 'indihome', 'telkom', 'speedy', 'bpjs', 'asuransi', 'insurance', 'iuran', 'cicilan', 'tagihan', 'bill', 'utility', 'biaya admin', 'biaya transfer', 'bi-fast', 'bifast'], category: 'Bills & Utilities', type: 'expense' },

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

  // Bank transfer (detected as Outgoing Transfer by default)
  { keywords: ['seabank', 'mandiri', 'bca', 'bri', 'bni', 'cimb', 'danamon', 'permata', 'ocbc', 'btpn', 'maybank', 'panin', 'jago', 'jenius', 'allo', 'neo'], category: 'Outgoing Transfer', type: 'expense' },

  // Savings/Investment
  { keywords: ['tabungan', 'deposito', 'reksa dana', 'saham', 'bibit', 'bareksa', 'stockbit', 'ajaib', 'pluang', 'investasi', 'nabung'], category: 'Savings & Investment', type: 'expense' },
];

// ─── Date parsing ─────────────────────────────────────────────────────────────

const MONTHS_ID: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', mei: '05', may: '05',
  jun: '06', jul: '07', agu: '08', aug: '08', sep: '09', okt: '10',
  oct: '10', nov: '11', des: '12', dec: '12',
};

function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(text: string): string {
  const today = localToday();

  // DD Mon YYYY or DD Mon YY  (e.g. "05 Mei 2026", "5 Jan 26", "07 Juni 2026")
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

function isRefNumber(text: string): boolean {
  return /^\d{9,}$/.test(text.trim());
}

const MAX_IDR = 999_999_999;

function parseAmount(text: string): number | null {
  const trimmed = text.trim();
  if (isRefNumber(trimmed)) return null;

  // Handle leading minus for debit: -Rp300.000
  const negative = trimmed.startsWith('-');
  const cleaned = negative ? trimmed.slice(1) : trimmed;

  // Priority 1: explicit "Rp" or "IDR" prefix
  const rpMatch = cleaned.match(/(?:Rp\.?|IDR)\s*([\d.,]+)/i);
  if (rpMatch) {
    const num = normalizeIDR(rpMatch[1]);
    if (num !== null && num >= 100 && num <= MAX_IDR) return num;
  }

  // Priority 2: formatted thousand-separated number
  const fmtMatch = cleaned.match(/\b(\d{1,3}(?:[.,]\d{3})+)\b/);
  if (fmtMatch) {
    const num = normalizeIDR(fmtMatch[1]);
    if (num !== null && num >= 100 && num <= MAX_IDR) return num;
  }

  // Priority 3: bare number with currency keyword nearby
  if (/(?:Rp|IDR|bayar|harga|nominal|jumlah|total)/i.test(cleaned)) {
    const bareMatch = cleaned.match(/\b(\d{3,9})\b/);
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
    cleaned = raw.replace(/\./g, '');
  } else if (/^\d+,\d{3}(,\d{3})*$/.test(raw)) {
    cleaned = raw.replace(/,/g, '');
  } else if (/^\d+[.,]\d{2}$/.test(raw)) {
    cleaned = raw.replace(/[.,]\d{2}$/, '');
  } else {
    cleaned = raw.replace(/[.,]/g, '');
  }

  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

// ─── Detect transaction type ──────────────────────────────────────────────────

function detectType(line: string): 'income' | 'expense' | null {
  const lower = line.toLowerCase();
  const incomeWords = ['masuk', 'kredit', 'cr ', 'diterima', 'terima', 'top.?up', 'topup', 'deposit', 'refund', 'kembali', 'cashback'];
  const expenseWords = ['keluar', 'debet', 'db ', 'bayar', 'beli', 'transfer ke', 'kirim', 'tarik', 'pembayaran', 'pembelian', 'debit', 'biaya'];
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
  if (lower.includes('wondr') || lower.includes('semua transaksi') || lower.includes('lihat e-statement')) return 'Wondr by BNI';
  if (lower.includes('livin') || lower.includes('mandiri')) return 'Livin by Mandiri';
  if (lower.includes('mybca') || lower.includes('bca mobile') || lower.includes('klik bca')) return 'BCA Mobile';
  if (lower.includes('brimo') || lower.includes('bri mobile')) return 'BRImo';
  if (lower.includes('bni mobile')) return 'BNI Mobile';
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
  if (/^(pembayaran|payment|transfer|qr bayar|qris tap|no\.|ref\.|status|berhasil|sukses|selesai|detail|lihat|riwayat|e-statement|loading|0:0|semua transaksi|lihat e-statement)/i.test(line)) return false;
  const hasLetters = /[A-Za-z]{3,}/.test(line);
  return hasLetters && line.length >= 3 && line.length <= 80;
}

// ─── Wondr by BNI parser ──────────────────────────────────────────────────────
// Wondr layout:
//   07 Juni 2026          ← date header (bold)
//   Transfer   -Rp300.000 ← type + amount on same line
//   SEABANK - SYARIF NASRUDIN  ← merchant detail on next line
//   Biaya      -Rp2.500
//   TRANSFER BI-FAST
//
// Key characteristics:
//   - Amounts always have leading minus: -Rp300.000
//   - Transaction type label is on the SAME line as the amount
//   - Merchant/detail is on the NEXT line
//   - Date headers like "07 Juni 2026" appear before groups of transactions

function parseWondrBlocks(lines: string[], today: string): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];

  // Wondr transaction type labels
  const WONDR_TYPES = /^(Transfer|Biaya|Pembayaran QRIS|Pembayaran|Tarik Tunai|Top Up|Setor Tunai|Penerimaan|Bunga)/i;

  let currentDate = today;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Track date headers
    if (isDateLine(line) && !parseAmount(line)) {
      const d = parseDate(line);
      if (d) currentDate = d;
      continue;
    }

    // A Wondr transaction line: has a type label AND an amount on the same line
    const amount = parseAmount(line);
    if (amount === null) continue;
    if (!WONDR_TYPES.test(line)) continue;

    // Determine if this is a debit (leading minus) or credit
    const isDebit = /^-Rp|-Rp/i.test(line) || line.includes('-Rp') || line.trim().startsWith('-');
    const typeFromSign: 'income' | 'expense' = isDebit ? 'expense' : 'income';

    // Extract transaction type label for description fallback
    const typeMatch = line.match(WONDR_TYPES);
    const typeLabel = typeMatch ? typeMatch[1] : 'Transaksi';

    // The merchant/detail line is usually the very next non-empty line
    let merchant = '';
    let merchantRaw = '';
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      // Only use it if it looks like a merchant (not another transaction or date)
      if (
        nextLine.length > 0 &&
        !isDateLine(nextLine) &&
        !WONDR_TYPES.test(nextLine) &&
        parseAmount(nextLine) === null &&
        !isRefNumber(nextLine)
      ) {
        merchantRaw = nextLine;
        merchant = cleanWondrMerchant(nextLine, typeLabel);
        i++; // consume merchant line
      }
    }

    // Match category against the merchant + type label
    const contextText = `${typeLabel} ${merchantRaw}`.toLowerCase();
    const cat = matchCategory(contextText);

    // For transfers, use the bank name if detectable
    let finalDescription = merchant || typeLabel;
    let finalType: 'income' | 'expense' = typeFromSign;

    // Biaya (fee) is always expense
    if (/biaya/i.test(typeLabel)) {
      finalType = 'expense';
      finalDescription = merchantRaw || 'Bank Fee';
    }

    // Penerimaan / Setor / Top Up = income
    if (/penerimaan|setor|top.?up/i.test(typeLabel)) {
      finalType = 'income';
    }

    const confidence: 'high' | 'medium' | 'low' =
      merchant && currentDate !== today ? 'high'
      : merchant || currentDate !== today ? 'medium' : 'low';

    results.push({
      amount,
      type: finalType,
      description: finalDescription,
      date: currentDate,
      raw_merchant: merchantRaw,
      category_hint: cat.category,
      confidence,
      source_app: 'Wondr by BNI',
    });
  }

  return results;
}

function cleanWondrMerchant(raw: string, typeLabel: string): string {
  let m = raw.trim();

  // "QRIS <MERCHANT> - <LOCATION>" → "<MERCHANT> (<LOCATION>)"
  const qrisMatch = m.match(/^QRIS\s+(.+?)\s*-\s*(.+)$/i);
  if (qrisMatch) {
    return `${toTitleCase(qrisMatch[1])} (${toTitleCase(qrisMatch[2])})`;
  }

  // "SEABANK - SYARIF NASRUDIN" / "BCA - JANLY WONG SAPUTRA" → "to Syarif Nasrudin (SeaBank)"
  const bankTransferMatch = m.match(/^([A-Z\s]+?)\s*-\s*(.+)$/);
  if (bankTransferMatch && /transfer/i.test(typeLabel)) {
    const bank = toTitleCase(bankTransferMatch[1].trim());
    const name = toTitleCase(bankTransferMatch[2].trim());
    return `${name} via ${bank}`;
  }

  // "TRANSFER BI-FAST" type detail lines — use as-is but title case
  if (/transfer bi.?fast|bi.?fast/i.test(m)) return 'BI-FAST Fee';

  return toTitleCase(m);
}

function toTitleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Livin by Mandiri parser ──────────────────────────────────────────────────

function parseLivinBlocks(lines: string[], today: string, source_app: string): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  const blockHeaderRe = /(?:QR Bayar|QRIS Tap|Transfer|Tarik Tunai|Top.?Up|Pembelian|Pembayaran)/i;

  let currentDate = today;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isDateLine(line) && !parseAmount(line)) {
      const d = parseDate(line);
      if (d !== today) currentDate = d;
      continue;
    }

    const amountOnHeader = parseAmount(line);
    const isHeader = blockHeaderRe.test(line) || amountOnHeader !== null;
    if (!isHeader || amountOnHeader === null) continue;

    const contextLines = lines.slice(i, Math.min(lines.length, i + 5));
    const contextText = contextLines.join(' ');

    let merchant = '';
    for (const cl of contextLines) {
      const keMatch = cl.match(/^ke\s+(.+)/i);
      if (keMatch && keMatch[1].trim().length > 2) { merchant = keMatch[1].trim(); break; }
    }
    if (!merchant) {
      for (const cl of contextLines.slice(1)) {
        if (isMerchantLine(cl)) { merchant = cl.replace(/^(ke|dari|kepada)\s+/i, '').trim(); break; }
      }
    }

    const cat = matchCategory(contextText + ' ' + merchant);
    const txType = detectType(contextText) || cat.type;

    results.push({
      amount: amountOnHeader,
      type: txType,
      description: merchant || line.replace(/Rp[\s\d.,]+/i, '').trim() || cat.category,
      date: currentDate,
      raw_merchant: merchant,
      category_hint: cat.category,
      confidence: merchant ? 'high' : 'medium',
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
  const today = localToday();

  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .filter(l => !isRefNumber(l));

  // ── Wondr by BNI ─────────────────────────────────────────────────────────
  if (source_app === 'Wondr by BNI') {
    const wondrTxs = parseWondrBlocks(lines, today);
    return {
      transactions: wondrTxs,
      source_app,
      notes: wondrTxs.length > 0
        ? `${wondrTxs.length} transaksi terdeteksi dari Wondr by BNI`
        : 'Tidak ada transaksi terdeteksi. Pastikan screenshot menampilkan daftar transaksi Wondr.',
    };
  }

  // ── Livin by Mandiri ─────────────────────────────────────────────────────
  const livinTxs = parseLivinBlocks(lines, today, source_app);
  if (livinTxs.length > 0) {
    return {
      transactions: livinTxs,
      source_app,
      notes: `${livinTxs.length} transactions detected from ${source_app}`,
    };
  }

  // ── Generic fallback ─────────────────────────────────────────────────────
  const transactions: ParsedTransaction[] = [];
  const amountLineIndices: number[] = [];
  lines.forEach((line, i) => { if (parseAmount(line) !== null) amountLineIndices.push(i); });

  if (amountLineIndices.length === 0) {
    return {
      transactions: [],
      source_app,
      notes: 'No transactions detected. Try a clearer screenshot with visible "Rp" amounts.',
    };
  }

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

    for (const cl of contextLines) {
      if (isDateLine(cl)) {
        const d = parseDate(cl);
        if (d !== today) runningDate = d;
      }
    }

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
