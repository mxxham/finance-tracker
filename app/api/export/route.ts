import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

function esc(val: string | number | null): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function fmt(n: number, currency = 'IDR'): string {
  try { return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n); }
  catch { return n.toLocaleString(); }
}

function bar(pct: number, color: string, bg = '#f3f4f6'): string {
  const w = Math.min(100, Math.max(0, pct));
  return `<div style="background:${bg};border-radius:4px;height:8px;overflow:hidden;width:100%"><div style="background:${color};height:100%;width:${w}%;border-radius:4px;transition:width 0.3s"></div></div>`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryToken = searchParams.get('token');
    let req2 = req;
    if (queryToken && !req.headers.get('authorization')) {
      const h = new Headers(req.headers);
      h.set('authorization', `Bearer ${queryToken}`);
      req2 = new NextRequest(req.url, { headers: h });
    }
    const user = requireAuth(req2);

    const format = searchParams.get('format') ?? 'csv';
    const month  = searchParams.get('month');
    const year   = searchParams.get('year');
    const type   = searchParams.get('type');
    const currency = searchParams.get('currency') ?? 'IDR';

    // ── Build transaction query ──────────────────────────────────────────
    let where = 'WHERE t.user_id = $1';
    const p: (string | number)[] = [user.userId];
    if (month && year) {
      p.push(Number(month), Number(year));
      where += ` AND EXTRACT(MONTH FROM t.date)=$${p.length-1} AND EXTRACT(YEAR FROM t.date)=$${p.length}`;
    }
    if (type) { p.push(type); where += ` AND t.type=$${p.length}`; }

    const [txRows, budgetRows, catRows] = await Promise.all([
      query(
        `SELECT t.date, t.type, t.amount, t.description, c.name as category, c.color as cat_color
         FROM transactions t LEFT JOIN categories c ON t.category_id=c.id
         ${where} ORDER BY t.date DESC, t.id DESC`,
        p
      ),
      month && year ? query(
        `SELECT b.amount, b.month, b.year, c.name as category_name, c.color as category_color,
          COALESCE((SELECT SUM(t.amount) FROM transactions t
            WHERE t.category_id=b.category_id AND t.user_id=b.user_id
            AND EXTRACT(MONTH FROM t.date)=b.month AND EXTRACT(YEAR FROM t.date)=b.year
            AND t.type='expense'),0) as spent
         FROM budgets b JOIN categories c ON b.category_id=c.id
         WHERE b.user_id=$1 AND b.month=$2 AND b.year=$3`,
        [user.userId, Number(month), Number(year)]
      ) : Promise.resolve({ rows: [] }),
      query(
        `SELECT c.name, c.color,
          COALESCE(SUM(CASE WHEN t.type='expense' THEN t.amount ELSE 0 END),0) as spent,
          COUNT(t.id) as count
         FROM categories c
         LEFT JOIN transactions t ON t.category_id=c.id AND t.user_id=$1
           ${month && year ? 'AND EXTRACT(MONTH FROM t.date)=$2 AND EXTRACT(YEAR FROM t.date)=$3' : ''}
         WHERE c.user_id=$1
         GROUP BY c.id, c.name, c.color
         ORDER BY spent DESC LIMIT 8`,
        month && year ? [user.userId, Number(month), Number(year)] : [user.userId]
      ),
    ]);

    const txs     = txRows.rows;
    const budgets = budgetRows.rows;
    const cats    = catRows.rows;

    const totalIncome  = txs.filter(r => r.type==='income').reduce((s,r) => s+Number(r.amount), 0);
    const totalExpense = txs.filter(r => r.type==='expense').reduce((s,r) => s+Number(r.amount), 0);
    const net          = totalIncome - totalExpense;
    const savingsRate  = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100) : 0;
    const periodLabel  = month && year
      ? `${new Date(Number(year), Number(month)-1).toLocaleString('en',{month:'long'})} ${year}`
      : 'All Time';

    // ── CSV ──────────────────────────────────────────────────────────────
    if (format === 'csv') {
      const lines = [
        ['Date','Type','Amount','Description','Category'].join(','),
        ...txs.map(r => [
          esc(r.date?.toISOString?.()?.slice(0,10) ?? r.date),
          esc(r.type), esc(r.amount), esc(r.description), esc(r.category ?? 'Uncategorized'),
        ].join(',')),
      ];
      const fname = `fintrack-${month ? `${year}-${String(month).padStart(2,'0')}` : 'all'}.csv`;
      return new NextResponse(lines.join('\n'), {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${fname}"` },
      });
    }

    // ── PDF (rich HTML) ───────────────────────────────────────────────────
    if (format === 'pdf') {
      // Group by category for donut-like table
      const byCat: Record<string, { amt: number; count: number; color: string }> = {};
      txs.filter(r => r.type === 'expense').forEach(r => {
        const k = r.category ?? 'Uncategorized';
        if (!byCat[k]) byCat[k] = { amt: 0, count: 0, color: r.cat_color ?? '#6366f1' };
        byCat[k].amt   += Number(r.amount);
        byCat[k].count += 1;
      });
      const catList = Object.entries(byCat).sort((a,b) => b[1].amt - a[1].amt);
      const maxCat  = catList[0]?.[1].amt ?? 1;

      // Group by day for mini sparkline
      const byDay: Record<string, number> = {};
      txs.filter(r => r.type==='expense').forEach(r => {
        const d = r.date?.toISOString?.()?.slice(0,10) ?? String(r.date);
        byDay[d] = (byDay[d] ?? 0) + Number(r.amount);
      });
      const dayEntries = Object.entries(byDay).sort(([a],[b]) => a.localeCompare(b));
      const maxDay = Math.max(...dayEntries.map(([,v]) => v), 1);
      const sparkBars = dayEntries.map(([d,v]) => {
        const h = Math.max(4, Math.round((v / maxDay) * 48));
        return `<div title="${d}: ${fmt(v, currency)}" style="flex:1;min-width:3px;height:${h}px;background:${v === maxDay ? '#f87171' : '#6366f140'};border-radius:2px 2px 0 0;align-self:flex-end"></div>`;
      }).join('');

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>FinTrack Report — ${periodLabel}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  body { font-family: 'Inter', system-ui, sans-serif; background: #f8fafc; color: #0f172a; font-size: 13px; line-height: 1.5; }
  @page { margin: 12mm 14mm; size: A4; }
  @media print {
    body { background: white; }
    .no-print { display: none !important; }
    .page-break { page-break-before: always; }
    section { page-break-inside: avoid; }
  }

  /* ── Layout ── */
  .page { max-width: 860px; margin: 0 auto; padding: 32px 24px; }

  /* ── Header ── */
  .header { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%); border-radius: 16px; padding: 28px 32px; color: white; margin-bottom: 24px; position: relative; overflow: hidden; }
  .header::before { content: ''; position: absolute; top: -40px; right: -40px; width: 200px; height: 200px; border-radius: 50%; background: rgba(255,255,255,0.04); }
  .header::after  { content: ''; position: absolute; bottom: -60px; right: 60px; width: 140px; height: 140px; border-radius: 50%; background: rgba(255,255,255,0.03); }
  .header-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
  .logo { display: flex; align-items: center; gap: 10px; }
  .logo-mark { width: 36px; height: 36px; border-radius: 9px; background: rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: center; font-size: 18px; }
  .logo-name { font-size: 20px; font-weight: 900; letter-spacing: -0.04em; }
  .period-badge { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); border-radius: 20px; padding: 4px 14px; font-size: 12px; font-weight: 600; white-space: nowrap; }
  .header-title { font-size: 28px; font-weight: 900; letter-spacing: -0.05em; margin-bottom: 4px; }
  .header-sub { font-size: 13px; color: rgba(255,255,255,0.6); }
  .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 20px; }
  .kpi { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; padding: 12px 14px; }
  .kpi-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(255,255,255,0.55); margin-bottom: 4px; }
  .kpi-value { font-size: 18px; font-weight: 800; font-family: 'Courier New', monospace; letter-spacing: -0.03em; }
  .kpi-sub { font-size: 10px; color: rgba(255,255,255,0.4); margin-top: 2px; }

  /* ── Section ── */
  .section { background: white; border-radius: 14px; border: 1px solid #e2e8f0; padding: 20px 22px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
  .section-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; margin-bottom: 14px; display: flex; align-items: center; gap: 6px; }
  .section-title::before { content: ''; display: inline-block; width: 3px; height: 14px; border-radius: 2px; background: #6366f1; }

  /* ── Stat row ── */
  .stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
  .stat-card { border-radius: 10px; padding: 14px 16px; border: 1px solid; }
  .stat-income  { background: #f0fdf4; border-color: #bbf7d0; }
  .stat-expense { background: #fff1f2; border-color: #fecdd3; }
  .stat-net     { background: #f0f9ff; border-color: #bae6fd; }
  .stat-savings { background: #fefce8; border-color: #fde68a; }
  .stat-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
  .stat-value { font-size: 20px; font-weight: 800; font-family: 'Courier New', monospace; margin-top: 4px; }
  .stat-income  .stat-value { color: #16a34a; }
  .stat-expense .stat-value { color: #dc2626; }
  .stat-net     .stat-value { color: ${net >= 0 ? '#0369a1' : '#dc2626'}; }
  .stat-savings .stat-value { color: #b45309; }
  .stat-sub { font-size: 10px; color: #94a3b8; margin-top: 2px; }

  /* ── Sparkline ── */
  .sparkline { display: flex; align-items: flex-end; gap: 2px; height: 52px; padding: 4px 0 0; }

  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead tr { border-bottom: 2px solid #e2e8f0; }
  th { padding: 8px 10px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; }
  td { padding: 9px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #f8fafc; }
  .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; }
  .badge-income  { background: #dcfce7; color: #15803d; }
  .badge-expense { background: #fee2e2; color: #b91c1c; }
  .cat-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
  .amt-income  { color: #16a34a; font-weight: 700; font-family: 'Courier New', monospace; }
  .amt-expense { color: #dc2626; font-weight: 700; font-family: 'Courier New', monospace; }
  .text-muted { color: #94a3b8; }
  .text-right { text-align: right; }
  .striped tr:nth-child(even) td { background: #f8fafc; }

  /* ── Budget bars ── */
  .budget-row { display: grid; grid-template-columns: 160px 1fr 80px 80px; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
  .budget-row:last-child { border-bottom: none; }
  .budget-name { font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; overflow: hidden; }
  .budget-name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .budget-bar-wrap { position: relative; }
  .budget-bar-bg { background: #f1f5f9; border-radius: 4px; height: 8px; overflow: hidden; }
  .budget-bar-fill { height: 100%; border-radius: 4px; }
  .budget-pct { font-size: 10px; font-weight: 700; text-align: right; }

  /* ── Category breakdown ── */
  .cat-breakdown-row { display: grid; grid-template-columns: 140px 1fr 90px 48px; align-items: center; gap: 10px; padding: 7px 0; border-bottom: 1px solid #f1f5f9; }
  .cat-breakdown-row:last-child { border-bottom: none; }

  /* ── Footer ── */
  .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #94a3b8; padding: 12px; border-top: 1px solid #e2e8f0; }

  /* ── Print button ── */
  .print-btn { position: fixed; bottom: 24px; right: 24px; background: #6366f1; color: white; border: none; border-radius: 12px; padding: 12px 24px; font-size: 14px; font-weight: 700; cursor: pointer; box-shadow: 0 8px 24px rgba(99,102,241,0.4); display: flex; align-items: center; gap: 8px; font-family: inherit; z-index: 100; }
  .print-btn:hover { background: #4f46e5; transform: translateY(-1px); }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-top">
      <div class="logo">
        <div class="logo-mark">💎</div>
        <div class="logo-name">FinTrack</div>
      </div>
      <div class="period-badge">${periodLabel}</div>
    </div>
    <div class="header-title">Financial Report</div>
    <div class="header-sub">Generated ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})} · ${txs.length} transactions</div>
    <div class="kpi-row">
      <div class="kpi"><div class="kpi-label">Total Income</div><div class="kpi-value" style="color:#4ade80">+${fmt(totalIncome,currency)}</div><div class="kpi-sub">${txs.filter(r=>r.type==='income').length} transactions</div></div>
      <div class="kpi"><div class="kpi-label">Total Expenses</div><div class="kpi-value" style="color:#f87171">−${fmt(totalExpense,currency)}</div><div class="kpi-sub">${txs.filter(r=>r.type==='expense').length} transactions</div></div>
      <div class="kpi"><div class="kpi-label">Net Balance</div><div class="kpi-value" style="color:${net>=0?'#4ade80':'#f87171'}">${net>=0?'+':''}${fmt(net,currency)}</div><div class="kpi-sub">${net>=0?'surplus':'deficit'}</div></div>
      <div class="kpi"><div class="kpi-label">Savings Rate</div><div class="kpi-value" style="color:${savingsRate>=20?'#4ade80':'#fbbf24'}">${savingsRate.toFixed(1)}%</div><div class="kpi-sub">of income saved</div></div>
    </div>
  </div>

  <!-- Daily Spending Chart -->
  ${dayEntries.length > 0 ? `
  <div class="section">
    <div class="section-title">Daily Spending — ${periodLabel}</div>
    <div style="display:flex;align-items:flex-end;gap:1px;height:60px;padding:4px 0 0;overflow:hidden">
      ${dayEntries.map(([d,v]) => {
        const h = Math.max(4, Math.round((v/maxDay)*52));
        const over = v === maxDay;
        return `<div title="${d}: ${fmt(v,currency)}" style="flex:1;min-width:2px;height:${h}px;background:${over?'#f87171':'#6366f1'};opacity:${over?1:0.55};border-radius:2px 2px 0 0;align-self:flex-end"></div>`;
      }).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;color:#94a3b8">
      <span>${dayEntries[0]?.[0] ?? ''}</span>
      <span style="color:#f87171;font-weight:700">Peak: ${fmt(maxDay,currency)}</span>
      <span>${dayEntries[dayEntries.length-1]?.[0] ?? ''}</span>
    </div>
  </div>` : ''}

  <!-- Category Breakdown -->
  ${catList.length > 0 ? `
  <div class="section">
    <div class="section-title">Spending by Category</div>
    ${catList.map(([name,{amt,count,color}]) => {
      const pct = totalExpense > 0 ? (amt/totalExpense*100) : 0;
      const barPct = (amt/maxCat)*100;
      const overBudget = budgets.find(b => b.category_name === name && Number(b.spent) > Number(b.amount));
      return `<div class="cat-breakdown-row">
        <div class="budget-name"><span class="cat-dot" style="background:${color}"></span><span>${name}</span>${overBudget ? '<span style="color:#dc2626;font-size:9px;font-weight:700;margin-left:4px">OVER</span>' : ''}</div>
        <div class="budget-bar-wrap"><div class="budget-bar-bg"><div class="budget-bar-fill" style="width:${barPct}%;background:${color}"></div></div></div>
        <div style="text-align:right;font-family:'Courier New',monospace;font-weight:700;font-size:12px;color:#0f172a">${fmt(amt,currency)}</div>
        <div style="text-align:right;font-size:11px;color:#94a3b8">${pct.toFixed(1)}%</div>
      </div>`;
    }).join('')}
  </div>` : ''}

  <!-- Budget Status -->
  ${budgets.length > 0 ? `
  <div class="section">
    <div class="section-title">Budget Status — ${periodLabel}</div>
    ${budgets.map(b => {
      const pct = Number(b.amount) > 0 ? (Number(b.spent)/Number(b.amount)*100) : 0;
      const over = pct > 100;
      const color = over ? '#ef4444' : pct > 80 ? '#f59e0b' : '#22c55e';
      return `<div class="budget-row">
        <div class="budget-name"><span class="cat-dot" style="background:${b.category_color}"></span><span>${b.category_name}</span></div>
        <div class="budget-bar-wrap"><div class="budget-bar-bg"><div class="budget-bar-fill" style="width:${Math.min(100,pct)}%;background:${color}"></div></div></div>
        <div style="text-align:right;font-size:11px;color:#64748b">${fmt(Number(b.spent),currency)} / ${fmt(Number(b.amount),currency)}</div>
        <div class="budget-pct" style="color:${color}">${pct.toFixed(0)}%${over?' 🔴':''}</div>
      </div>`;
    }).join('')}
  </div>` : ''}

  <!-- Transaction Table -->
  <div class="section">
    <div class="section-title">All Transactions (${txs.length})</div>
    <table class="striped">
      <thead>
        <tr>
          <th style="width:90px">Date</th>
          <th style="width:70px">Type</th>
          <th>Description</th>
          <th style="width:120px">Category</th>
          <th class="text-right" style="width:110px">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${txs.map(r => {
          const d = r.date?.toISOString?.()?.slice(0,10) ?? String(r.date);
          const isInc = r.type === 'income';
          return `<tr>
            <td class="text-muted">${d}</td>
            <td><span class="badge ${isInc?'badge-income':'badge-expense'}">${isInc?'↑ Income':'↓ Expense'}</span></td>
            <td style="font-weight:500">${r.description ?? ''}</td>
            <td><span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#64748b"><span class="cat-dot" style="background:${r.cat_color??'#6366f1'}"></span>${r.category ?? 'Uncategorized'}</span></td>
            <td class="text-right ${isInc?'amt-income':'amt-expense'}">${isInc?'+':'−'}${fmt(Number(r.amount),currency)}</td>
          </tr>`;
        }).join('')}
      </tbody>
      <tfoot>
        <tr style="border-top:2px solid #e2e8f0;background:#f8fafc">
          <td colspan="4" style="padding:10px;font-weight:700;font-size:12px">Totals</td>
          <td class="text-right" style="padding:10px">
            <div class="amt-income">+${fmt(totalIncome,currency)}</div>
            <div class="amt-expense">−${fmt(totalExpense,currency)}</div>
            <div style="font-weight:800;color:${net>=0?'#16a34a':'#dc2626'};border-top:1px solid #e2e8f0;padding-top:4px;margin-top:4px">${net>=0?'+':''}${fmt(net,currency)}</div>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>

  <div class="footer">
    FinTrack Personal Finance · ${periodLabel} · ${txs.length} transactions · Generated ${new Date().toISOString().slice(0,10)}
  </div>
</div>

<button class="print-btn no-print" onclick="window.print()">
  🖨️ Print / Save PDF
</button>
<script>
  // Auto-trigger print dialog after fonts load
  document.fonts?.ready?.then(() => setTimeout(() => window.print(), 600));
</script>
</body>
</html>`;

      const fname = `fintrack-${month?`${year}-${String(month).padStart(2,'0')}`:'all'}.html`;
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': `inline; filename="${fname}"` },
      });
    }

    return NextResponse.json({ error: 'Use ?format=csv or ?format=pdf' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 });
  }
}
