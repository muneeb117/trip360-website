/* Trip360 admin: Marketing portal (expenses, creator payments, budgets).
   Data goes through window.T360MarketingStore, set up in admin-marketing-store.js. */
(function () {
  'use strict';

  /* ================= constants ================= */
  const VIEWS = [
    { id: 'overview', label: 'Overview', icon: 'M4 15a8 8 0 1 1 16 0M12 15l4-5M4 19h16' },
    { id: 'expenses', label: 'Marketing expenses', icon: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3' },
    { id: 'creators', label: 'Creator payments', icon: 'M4 7h11v10H4zM15 10l5-3v10l-5-3' },
    { id: 'setup', label: 'Budget & channels', icon: 'M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4' },
  ];
  const BUILTIN = [
    { id: 'creators', name: 'Creators & influencers', short: 'Creators', slot: 2 },
    { id: 'meta', name: 'Facebook & Meta Ads', short: 'Meta Ads', slot: 1 },
    { id: 'apple', name: 'Apple Search Ads', short: 'Apple Ads', slot: 3 },
    { id: 'organic', name: 'Organic marketing', short: 'Organic', slot: 4 },
    { id: 'other', name: 'Other ad platforms', short: 'Other ads', slot: 5 },
  ];
  const UNASSIGNED = { id: 'unassigned', name: 'Uncategorized ads', short: 'Uncategorized', slot: 0 };
  const PERIODS = [
    ['this-month', 'This month'], ['last-7', 'Last 7 days'], ['last-30', 'Last 30 days'],
    ['last-month', 'Last month'], ['this-year', 'This year'], ['all', 'All time'],
  ];
  const DATA_TYPES = { manual: 'Manual', estimated: 'Estimated', tracked: 'Tracked' };

  /* ================= state ================= */
  const S = {
    expenses: [], creators: [], channels: [], settings: {},
    loaded: {}, db: null, downloads: null, dbState: 'connecting', canWrite: null, readOnly: false,
    view: 'overview', period: 'this-month', gran: 'day', ui: { sort: {}, expFilter: 'all', expSearch: '' },
  };
  try { const p = localStorage.getItem('t360-period'); if (p && PERIODS.some((x) => x[0] === p)) S.period = p; } catch (e) { /* storage unavailable */ }

  /* ================= helpers ================= */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const div = (a, b) => (b > 0 ? a / b : null);
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseISO = (s) => { const p = String(s || '').split('-').map(Number); return new Date(p[0] || 1970, (p[1] || 1) - 1, p[2] || 1); };
  const addDays = (s, n) => { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); };
  const today = () => iso(new Date());
  const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
  const weekStart = (s) => { const d = parseISO(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return iso(d); };
  const monthStart = (s) => s.slice(0, 7) + '-01';
  const monthEnd = (s) => { const d = parseISO(s); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
  const fmtDate = (s) => (validDate(s) ? parseISO(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
  const fmtShort = (s) => (validDate(s) ? parseISO(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
  const money = (n, cents) => {
    if (n == null || !Number.isFinite(n)) return 'n/a';
    const c = cents || (Math.abs(n) < 100 && n % 1 !== 0);
    return (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: c ? 2 : 0, maximumFractionDigits: c ? 2 : 0 });
  };
  const unit = (n) => (n == null ? 'n/a' : money(n, true));
  const int = (n) => (n == null || !Number.isFinite(n) ? 'n/a' : Math.round(n).toLocaleString('en-US'));
  const pct = (n) => (n == null || !Number.isFinite(n) ? 'n/a' : (n * 100).toFixed(n < 0.1 ? 2 : 1).replace(/\.0$/, '') + '%');
  const naSpan = (s) => (s === 'n/a' ? '<span class="na">n/a</span>' : esc(s));
  const isConf = (r) => r.dataType !== 'estimated';
  const dtBadge = (t) => { const k = t === 'estimated' ? 'estimated' : 'manual'; return `<span class="dt dt-${k}">${DATA_TYPES[k]}</span>`; };
  const icon = (d, w) => `<svg viewBox="0 0 24 24" width="${w || 16}" height="${w || 16}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const I = { plus: 'M12 5v14M5 12h14', edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4', trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13', tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01', down: 'M12 4v12M6 11l6 6 6-6M5 20h14', check: 'M5 12l5 5 9-10' };

  function channels() {
    const custom = S.channels.slice().sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((c, i) => ({ id: c.id, name: c.name || 'Untitled channel', short: c.name || 'Untitled', slot: i < 3 ? 6 + i : 0, custom: true }));
    return BUILTIN.concat(custom, [UNASSIGNED]);
  }
  const chan = (id) => channels().find((c) => c.id === id) || { id: id, name: 'Removed channel', short: 'Removed', slot: 0 };
  const chOf = (e) => e.channel || 'unassigned';
  const creatorName = (id) => { const c = S.creators.find((x) => x.id === id); return c ? c.name : ''; };

  function periodRange(p) {
    const t = today(); const d = parseISO(t); const y = d.getFullYear(); const m = d.getMonth();
    switch (p) {
      case 'last-7': return [addDays(t, -6), t];
      case 'last-30': return [addDays(t, -29), t];
      case 'last-month': return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
      case 'this-year': return [y + '-01-01', y + '-12-31'];
      case 'all': return ['0000-01-01', '9999-12-31'];
      default: return [monthStart(t), monthEnd(t)];
    }
  }
  const periodLabel = () => { if (S.period === 'all') return 'All time'; const r = periodRange(S.period); return fmtShort(r[0]) + ' to ' + fmtDate(r[1]); };
  const periodPhrase = () => ({ 'this-month': 'this month', 'last-7': 'in the last 7 days', 'last-30': 'in the last 30 days', 'last-month': 'last month', 'this-year': 'this year', all: 'in total' }[S.period]);
  const inP = (s) => { const r = periodRange(S.period); return validDate(s) && s >= r[0] && s <= r[1]; };

  /* ---------- aggregations ---------- */
  const expensesP = () => S.expenses.filter((e) => inP(e.date));
  const sum = (list, f) => list.reduce((a, x) => a + f(x), 0);
  const confSpend = (list) => sum(list.filter(isConf), (e) => num(e.amount));
  const estSpend = (list) => sum(list.filter((e) => !isConf(e)), (e) => num(e.amount));
  function spendByChannel(list) {
    const m = {};
    list.forEach((e) => { if (!isConf(e)) return; const k = chOf(e); m[k] = (m[k] || 0) + num(e.amount); });
    return m;
  }
  function creatorStats() {
    const ex = expensesP().filter(isConf); const t = today();
    return S.creators.map((c) => {
      const paidP = sum(ex.filter((e) => e.creatorId === c.id), (e) => num(e.amount));
      const paidAll = sum(S.expenses.filter((e) => isConf(e) && e.creatorId === c.id), (e) => num(e.amount));
      const perDay = num(c.videosPerDay); const days = num(c.dealDays); const delivered = num(c.videosDelivered);
      const committed = perDay > 0 && days > 0 ? perDay * days : null;
      const pending = committed == null ? null : Math.max(0, committed - delivered);
      let expected = null;
      if (committed != null && validDate(c.startDate) && c.startDate <= t) expected = Math.min(committed, perDay * Math.min(days, daysBetween(c.startDate, t) + 1));
      const payment = num(c.payment);
      return { c: c, name: c.name, paidP: paidP, paidAll: paidAll, perDay: perDay, committed: committed, pending: pending, expected: expected, delivered: delivered,
        costPerVideo: committed ? div(payment, committed) : null, costPerDelivered: div(paidAll, delivered) };
    });
  }

  /* ---------- tables ---------- */
  function sortRows(id, rows, cols, def) {
    const st = S.ui.sort[id] || def || {};
    const col = cols.find((c) => c.key === st.key);
    if (!col) return rows;
    const val = col.sort || ((r) => r[col.key]);
    const dir = st.dir === 'asc' ? 1 : -1;
    return rows.slice().sort((a, b) => {
      const x = val(a); const y = val(b);
      if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir;
    });
  }
  function table(id, cols, rows, opts) {
    const o = opts || {};
    const st = S.ui.sort[id] || o.def || {};
    const sorted = sortRows(id, rows, cols, o.def);
    const headRow = cols.map((c) => {
      const cls = c.n ? ' class="n"' : '';
      if (c.nosort) return `<th${cls} scope="col">${esc(c.label)}</th>`;
      const s = st.key === c.key ? ` aria-sort="${st.dir === 'asc' ? 'ascending' : 'descending'}"` : '';
      return `<th${cls}${s} scope="col"><button type="button" data-act="sort" data-table="${id}" data-key="${c.key}">${esc(c.label)}</button></th>`;
    }).join('');
    const body = sorted.map((r) => `<tr${o.rowCls ? ' class="' + o.rowCls(r) + '"' : ''}>${cols.map((c) => {
      const html = c.html ? c.html(r) : naSpan(c.fmt ? c.fmt(r[c.key], r) : String(r[c.key] == null ? '' : r[c.key]));
      return `<td${c.n ? ' class="n"' : c.cls ? ' class="' + c.cls + '"' : ''}>${html}</td>`;
    }).join('')}</tr>`).join('');
    const foot = o.total ? `<tr class="total">${cols.map((c, i) => `<td${c.n ? ' class="n"' : ''}>${i === 0 ? 'Total' : (c.total ? naSpan(c.total()) : '')}</td>`).join('')}</tr>` : '';
    return `<div class="tbl-wrap"><table><thead><tr>${headRow}</tr></thead><tbody>${body}${foot}</tbody></table></div>`;
  }

  /* ---------- small renderers ---------- */
  const canEdit = () => S.dbState === 'ready' && !S.readOnly && S.canWrite !== false;
  function hbars(rows, fmt, emptyText) {
    const list = rows.filter((r) => r.value > 0);
    if (!list.length) return `<p class="note">${esc(emptyText || 'Nothing recorded for this period yet.')}</p>`;
    const max = Math.max.apply(null, list.map((r) => r.value)) || 1;
    return `<div class="hbars">${list.map((r) => `<div class="hb-row"><span class="hb-label"><i class="sw" style="background:var(--s${r.slot})"></i><span title="${esc(r.label)}">${esc(r.label)}</span></span><span class="hb-track"><span class="hb-fill" style="width:${Math.max(1, (r.value / max) * 100).toFixed(1)}%;background:var(--s${r.slot})"></span></span><span class="hb-val">${esc(fmt(r.value))}</span></div>`).join('')}</div>`;
  }
  function kpi(k, v, s, slot) {
    const na = v === 'n/a';
    return `<div class="kpi"><div class="k">${slot != null ? `<i class="sw" style="background:var(--s${slot})"></i>` : ''}${esc(k)}</div><div class="v${na ? ' na' : ''}">${esc(v)}</div>${s ? `<div class="s">${s}</div>` : ''}</div>`;
  }
  const head = (title, desc, actions) => `<div class="view-head"><div><h1>${esc(title)}</h1>${desc ? `<p>${desc}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
  const btn = (label, act, attrs, cls) => `<button type="button" class="btn ${cls || ''}" data-act="${act}" ${attrs || ''}${canEdit() || /export|nav|sort|gran|filter/.test(act) ? '' : ' disabled'}>${label}</button>`;
  const empty = (title, text, action) => `<div class="empty"><b>${esc(title)}</b><span>${text}</span>${action || ''}</div>`;

  function gaugeSVG(used, budget) {
    const ratio = budget > 0 ? used / budget : 0;
    const clamped = Math.max(0, Math.min(1.1, ratio));
    const start = 210; const sweep = 240; const cx = 100; const cy = 100; const R = 78;
    const pt = (deg, r) => { const a = (deg * Math.PI) / 180; return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; };
    const segs = 24; let arcs = '';
    for (let i = 0; i < segs; i++) {
      const a0 = start - (sweep * i) / segs - 1.2; const a1 = start - (sweep * (i + 1)) / segs + 1.2;
      const p0 = pt(a0, R); const p1 = pt(a1, R);
      const frac = (i + 1) / segs; const lit = frac <= Math.min(clamped, 1) + 1e-9 || (i === 0 && ratio > 0);
      const col = !lit ? 'var(--line-2)' : ratio > 1 && frac > 0.9 ? 'var(--bad)' : 'var(--lime)';
      arcs += `<path d="M${p0[0].toFixed(2)} ${p0[1].toFixed(2)} A${R} ${R} 0 0 1 ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}" stroke="${col}" stroke-width="12" fill="none"/>`;
    }
    const tip = pt(start - sweep * Math.min(clamped, 1.04), R - 20);
    const label = budget > 0 ? Math.round(ratio * 100) + '%' : 'No budget';
    return `<svg viewBox="0 0 200 158" role="img" aria-label="Budget used: ${esc(label)}">${arcs}
      <line x1="${cx}" y1="${cy}" x2="${tip[0].toFixed(2)}" y2="${tip[1].toFixed(2)}" stroke="var(--fg)" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${cx}" cy="${cy}" r="6" fill="var(--fg)"/>
      <text x="${cx}" y="${cy + 36}" text-anchor="middle" font-family="Poppins, Inter, sans-serif" font-weight="700" font-size="${budget > 0 ? 26 : 17}" fill="var(--fg)">${esc(label)}</text>
      <text x="${cx}" y="${cy + 50}" text-anchor="middle" font-size="10.5" fill="var(--fg-3)">${budget > 0 ? 'of monthly budget used' : 'set one under Budget'}</text></svg>`;
  }

  /* ================= views ================= */
  const RENDER = {};

  RENDER.overview = function () {
    const exP = expensesP(); const total = confSpend(exP); const est = estSpend(exP);
    const sp = spendByChannel(exP); const t = today(); const confAll = S.expenses.filter(isConf);
    const between = (a, b) => sum(confAll.filter((e) => e.date >= a && e.date <= b), (e) => num(e.amount));
    const dayS = between(t, t); const ws = weekStart(t); const weekS = between(ws, addDays(ws, 6)); const monthS = between(monthStart(t), monthEnd(t));
    const budget = num(S.settings.monthlyBudget); const unassigned = sp.unassigned || 0;
    const chans = channels().filter((c) => c.id !== 'unassigned' || unassigned > 0);
    let takeaway;
    if (!S.expenses.length) takeaway = 'No marketing spend recorded yet. Add your first expense to see where your money goes.';
    else if (total <= 0) takeaway = `No confirmed spend ${periodPhrase()}. Pick another period at the top to see earlier spending.`;
    else {
      const named = Object.keys(sp).filter((k) => k !== 'unassigned' && sp[k] > 0).sort((a, b) => sp[b] - sp[a]);
      takeaway = `${money(total)} spent ${periodPhrase()}.` + (named.length ? ` ${esc(chan(named[0]).short)} is the largest channel at ${money(sp[named[0]])}.` : '') +
        (unassigned > 0 ? ` ${money(unassigned)} in ad spend still needs a channel.` : '');
    }
    const uncats = S.expenses.filter((e) => chOf(e) === 'unassigned');
    const banner = uncats.length ? `<div class="banner warn"><span class="grow"><b>${money(sum(uncats, (e) => num(e.amount)))} in ad spend has no channel yet.</b> Assign it to Meta, Apple or another platform when you know where it went.</span>${btn(icon(I.tag) + 'Categorize', 'categorize', `data-id="${esc(uncats[0].id)}"`, 'sm')}</div>` : '';
    const cs = creatorStats().filter((x) => x.paidP > 0).sort((a, b) => b.paidP - a.paidP);
    const sug = attention();
    return head('Overview', takeaway, btn(icon(I.plus) + 'Add expense', 'add-expense', '', 'primary')) + banner +
      `<div class="hero">
        <div class="hero-main">
          <div><div class="hero-label">Total marketing spend, ${esc(periodLabel())}</div>
          <div class="hero-total">${money(total)}</div>
          <div class="hero-sub">${S.expenses.length} ${S.expenses.length === 1 ? 'expense' : 'expenses'} recorded in all${est > 0 ? ` · ${money(est)} more is estimated and not counted` : ''}</div></div>
          <div class="cadence">
            <div><div class="k">Today</div><div class="v">${money(dayS)}</div></div>
            <div><div class="k">This week</div><div class="v">${money(weekS)}</div></div>
            <div><div class="k">This month</div><div class="v">${money(monthS)}</div></div>
          </div>
        </div>
        <div class="gauge-card">
          <div class="g-title">Monthly budget</div>
          ${gaugeSVG(monthS, budget)}
          <div class="g-line">${budget > 0 ? (monthS <= budget ? `<b>${money(budget - monthS)}</b> left of ${money(budget)}` : `<b style="color:var(--bad)">${money(monthS - budget)} over</b> a ${money(budget)} budget`) : `<button type="button" class="linkish" data-act="nav" data-view="setup">Set a monthly budget</button> to see what's left`}</div>
        </div>
      </div>
      <div class="section-label">Spend by channel</div>
      <div class="kpis">${chans.map((c) => kpi(c.short, money(sp[c.id] || 0), total > 0 ? pct((sp[c.id] || 0) / total) + ' of spend' : 'No spend yet', c.slot)).join('')}</div>
      <div class="grid">
        <div class="card"><div class="card-head"><div><h2>Where every dollar goes</h2><p class="note">${esc(periodLabel())}. Confirmed spend only.</p></div>${btn('All expenses', 'nav', 'data-view="expenses"', 'sm ghost')}</div>${breakdown(exP, sp, total)}</div>
        <div class="card"><div class="card-head"><div><h2>Spend over time</h2><p class="note">${granNote()}</p></div>
          <div class="seg" role="group" aria-label="Group spend by">${['day', 'week', 'month'].map((g) => `<button type="button" data-act="gran" data-g="${g}" aria-pressed="${S.gran === g}">${g === 'day' ? 'Daily' : g === 'week' ? 'Weekly' : 'Monthly'}</button>`).join('')}</div></div>
          <div class="chart-box" id="spend-chart"></div></div>
      </div>
      <div class="grid">
        <div class="card"><div class="card-head"><div><h2>Creator payments</h2><p class="note">${esc(periodLabel())}</p></div>${btn('All creators', 'nav', 'data-view="creators"', 'sm ghost')}</div>
          ${hbars(cs.map((x) => ({ label: x.name, value: x.paidP, slot: 2 })), money, 'No creator payments in this period.')}</div>
        <div class="card"><h2>Needs attention</h2>
          ${sug.length ? `<ul class="sugg">${sug.map((s) => `<li class="${s.tone}"><i></i><span>${s.text}</span></li>`).join('')}</ul>` : '<p class="note">Nothing needs attention right now.</p>'}</div>
      </div>`;
  };

  function breakdown(exP, sp, total) {
    if (total <= 0) return empty('No confirmed spend in this period', 'Expenses you add will be broken down here by channel.', btn(icon(I.plus) + 'Add expense', 'add-expense', '', 'sm'));
    const ids = Object.keys(sp).filter((k) => sp[k] > 0).sort((a, b) => sp[b] - sp[a]);
    const bar = `<div class="stack" role="img" aria-label="Share of spend by channel">${ids.map((id) => `<span style="flex:${sp[id]};background:var(--s${chan(id).slot})" title="${esc(chan(id).short)}: ${money(sp[id])}"></span>`).join('')}</div>
      <div class="stack-legend">${ids.map((id) => `<span><i class="sw" style="background:var(--s${chan(id).slot})"></i>${esc(chan(id).short)} ${pct(sp[id] / total)}</span>`).join('')}</div>`;
    let rows = '';
    ids.forEach((id) => {
      const items = exP.filter((e) => isConf(e) && chOf(e) === id).sort((a, b) => num(b.amount) - num(a.amount));
      rows += `<tr class="group"><td><span style="display:inline-flex;gap:8px;align-items:center"><i class="sw" style="background:var(--s${chan(id).slot})"></i>${esc(chan(id).name)}</span></td><td class="n">${pct(sp[id] / total)}</td><td class="n">${money(sp[id])}</td></tr>`;
      items.slice(0, 5).forEach((e) => {
        rows += `<tr><td>${esc(e.label || 'Untitled')}<span class="sub">${esc(e.details || '')}${e.details ? ' · ' : ''}${esc(fmtShort(e.date))}</span></td><td class="n">${pct(num(e.amount) / total)}</td><td class="n">${money(num(e.amount))}</td></tr>`;
      });
      if (items.length > 5) rows += `<tr><td colspan="3"><button type="button" class="linkish" data-act="filter-chan" data-c="${esc(id)}">${items.length - 5} more in ${esc(chan(id).short)}</button></td></tr>`;
    });
    return bar + `<div class="tbl-wrap"><table><thead><tr><th scope="col">Channel and activity</th><th class="n" scope="col">Share</th><th class="n" scope="col">Amount</th></tr></thead><tbody>${rows}<tr class="total"><td>Total</td><td class="n">100%</td><td class="n">${money(total)}</td></tr></tbody></table></div>`;
  }

  const granNote = () => (S.gran === 'day' ? 'Last 30 days, by day' : S.gran === 'week' ? 'Last 12 weeks, by week starting Monday' : 'Last 12 months, by month');
  function spendSeries() {
    const t = today(); const b = [];
    if (S.gran === 'day') for (let i = 29; i >= 0; i--) { const d = addDays(t, -i); b.push({ s: d, e: d, label: fmtShort(d) }); }
    else if (S.gran === 'week') { const ws = weekStart(t); for (let i = 11; i >= 0; i--) { const s = addDays(ws, -7 * i); b.push({ s: s, e: addDays(s, 6), label: fmtShort(s) }); } }
    else { const d = parseISO(t); for (let i = 11; i >= 0; i--) { const m = new Date(d.getFullYear(), d.getMonth() - i, 1); const s = iso(m); b.push({ s: s, e: monthEnd(s), label: m.toLocaleDateString('en-US', { month: 'short' }) + (m.getMonth() === 0 || i === 11 ? ' ' + String(m.getFullYear()).slice(2) : '') }); } }
    const conf = S.expenses.filter(isConf);
    return b.map((x) => Object.assign(x, { value: sum(conf.filter((e) => e.date >= x.s && e.date <= x.e), (e) => num(e.amount)) }));
  }
  function niceMax(v) { if (v <= 0) return 100; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
  function drawSpendChart() {
    const box = document.getElementById('spend-chart'); if (!box) return;
    const data = spendSeries(); const W = Math.max(280, box.clientWidth || 560); const H = 230;
    const max = niceMax(Math.max.apply(null, data.map((d) => d.value))); const ticks = [0, max / 2, max];
    const mL = Math.max.apply(null, ticks.map((v) => money(v).length)) * 7.4 + 12; const mR = 6; const mT = 10; const mB = 26;
    const iw = W - mL - mR; const ih = H - mT - mB; const bw = iw / data.length; const barW = Math.min(32, Math.max(3, bw * 0.68));
    const y = (v) => mT + ih - (v / max) * ih; const every = Math.max(1, Math.ceil((data.length * 48) / iw));
    let g = '';
    ticks.forEach((v) => { g += `<line x1="${mL}" x2="${W - mR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="var(--line)" stroke-width="1"/><text x="${mL - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" font-size="11.5" fill="var(--fg-3)">${money(v)}</text>`; });
    data.forEach((d, i) => {
      const x = mL + i * bw + (bw - barW) / 2; const h = (d.value / max) * ih;
      if (d.value > 0) g += `<rect x="${x.toFixed(1)}" y="${(mT + ih - h).toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(1, h).toFixed(1)}" rx="${Math.min(4, barW / 2).toFixed(1)}" fill="var(--bar)"/>`;
      if (i % every === 0) g += `<text x="${(mL + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="11.5" fill="var(--fg-3)">${esc(d.label)}</text>`;
      g += `<rect class="hit" data-i="${i}" x="${(mL + i * bw).toFixed(1)}" y="${mT}" width="${bw.toFixed(1)}" height="${ih}" fill="transparent"/>`;
    });
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="Marketing spend, ${esc(granNote().toLowerCase())}">${g}</svg><div class="tip" hidden></div>`;
    const tip = box.querySelector('.tip');
    box.querySelectorAll('rect.hit').forEach((r) => {
      r.addEventListener('mouseenter', () => {
        const d = data[Number(r.getAttribute('data-i'))];
        tip.innerHTML = `<div class="t1">${esc(S.gran === 'day' ? fmtDate(d.s) : fmtShort(d.s) + ' to ' + fmtDate(d.e))}</div><div class="t2">${money(d.value)}</div>`;
        tip.hidden = false;
        const bx = Number(r.getAttribute('x')) + Number(r.getAttribute('width')) / 2;
        tip.style.left = Math.min(Math.max(0, (bx / W) * box.clientWidth - tip.offsetWidth / 2), box.clientWidth - tip.offsetWidth) + 'px'; tip.style.top = '0px';
      });
      r.addEventListener('mouseleave', () => { tip.hidden = true; });
    });
  }

  RENDER.expenses = function () {
    const exP = expensesP(); const sp = spendByChannel(exP); const total = confSpend(exP); const est = estSpend(exP);
    const f = S.ui.expFilter; const q = S.ui.expSearch.trim().toLowerCase();
    let rows = exP.filter((e) => f === 'all' || chOf(e) === f);
    if (q) rows = rows.filter((e) => [e.label, e.details, chan(chOf(e)).name, creatorName(e.creatorId)].join(' ').toLowerCase().indexOf(q) >= 0);
    const chips = [{ id: 'all', short: 'All', slot: null }].concat(channels().filter((c) => exP.some((e) => chOf(e) === c.id)));
    const cols = [
      { key: 'date', label: 'Date', html: (e) => esc(fmtDate(e.date)) },
      { key: 'label', label: 'Activity', html: (e) => `<b style="font-weight:600">${esc(e.label || 'Untitled')}</b>${e.details ? `<span class="sub">${esc(e.details)}</span>` : ''}` },
      { key: 'channel', label: 'Channel', sort: (e) => chan(chOf(e)).short, html: (e) => `<span class="chip"><i class="sw" style="background:var(--s${chan(chOf(e)).slot})"></i>${esc(chan(chOf(e)).short)}</span>` },
      { key: 'creator', label: 'Creator', sort: (e) => creatorName(e.creatorId), html: (e) => esc(creatorName(e.creatorId)) },
      { key: 'dataType', label: 'Label', html: (e) => dtBadge(e.dataType) },
      { key: 'amount', label: 'Amount', n: true, sort: (e) => num(e.amount), html: (e) => money(num(e.amount)) },
      { key: 'act', label: '', nosort: true, cls: 'actions', html: (e) => (canEdit() ? `${chOf(e) === 'unassigned' ? `<button type="button" class="btn sm" data-act="categorize" data-id="${esc(e.id)}">${icon(I.tag)}Categorize</button> ` : ''}<button type="button" class="btn sm ghost" data-act="edit-expense" data-id="${esc(e.id)}" aria-label="Edit ${esc(e.label)}">${icon(I.edit)}</button>` : '') },
    ];
    return head('Marketing expenses', `Every marketing cost in one ledger. ${esc(periodLabel())}: <b>${money(total)}</b> confirmed${est > 0 ? `, plus ${money(est)} estimated and not counted` : ''}.`,
      btn(icon(I.down) + 'Export CSV', 'export', 'data-what="expenses"', 'ghost') + btn(icon(I.plus) + 'Add expense', 'add-expense', '', 'primary')) +
      `<div class="kpis">${channels().filter((c) => c.id !== 'unassigned' || (sp.unassigned || 0) > 0).map((c) => kpi(c.short, money(sp[c.id] || 0), total > 0 ? pct((sp[c.id] || 0) / total) + ' of spend' : '', c.slot)).join('')}</div>
      <div class="card">
        <div class="toolbar">
          ${chips.map((c) => `<button type="button" class="fchip" data-act="filter-chan" data-c="${esc(c.id)}" aria-pressed="${f === c.id}">${c.slot != null ? `<i class="sw" style="background:var(--s${c.slot})"></i>` : ''}${esc(c.short)}</button>`).join('')}
          <input type="search" id="exp-search" placeholder="Search activity or creator" aria-label="Search expenses" value="${esc(S.ui.expSearch)}">
        </div>
        ${rows.length ? table('expenses', cols, rows, { def: { key: 'date', dir: 'desc' }, rowCls: (e) => (isConf(e) ? '' : 'est-row') }) + `<p class="note">${rows.length} ${rows.length === 1 ? 'expense' : 'expenses'} shown · ${money(confSpend(rows))} confirmed</p>`
        : S.expenses.length ? empty('No expenses match', 'Try another channel, search term or period.') : empty('No expenses yet', 'Add what you pay creators, ad platforms and other marketing so the portal can total it.', btn(icon(I.plus) + 'Add expense', 'add-expense', '', 'primary'))}
      </div>`;
  };

  RENDER.creators = function () {
    const cs = creatorStats(); const totalPaid = sum(cs, (x) => x.paidP);
    const active = cs.filter((x) => (x.c.status || 'active') === 'active');
    const perDay = sum(active, (x) => x.perDay); const delivered = sum(cs, (x) => x.delivered);
    const known = cs.filter((x) => x.pending != null); const pending = sum(known, (x) => x.pending);
    const cards = cs.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))).map((x) => {
      const c = x.c; const status = c.status || 'active';
      const prog = x.committed ? Math.min(100, (x.delivered / x.committed) * 100) : null;
      const behind = x.expected != null && x.delivered < x.expected ? x.expected - x.delivered : 0;
      return `<article class="cr">
        <div class="cr-top"><div><div class="cr-name">${esc(c.name)}</div><div class="cr-handle">${esc([c.platform && c.platform !== 'Other' ? c.platform : '', c.handle].filter(Boolean).join(' · ') || 'Content creator')}</div></div>
          <span class="chip ${status === 'active' ? 'good' : status === 'paused' ? 'warn' : ''}">${esc(status[0].toUpperCase() + status.slice(1))}</span></div>
        <div><div class="cr-deal">${money(num(c.payment))} for ${int(x.perDay)} ${x.perDay === 1 ? 'video' : 'videos'} a day</div>
          <div class="note">${num(c.dealDays) > 0 ? `${int(num(c.dealDays))}-day deal${validDate(c.startDate) ? ' from ' + esc(fmtDate(c.startDate)) : ''} · ${int(x.committed)} videos in total` : `<button type="button" class="linkish" data-act="edit-creator" data-id="${esc(c.id)}">Add the deal length</button> to track pending videos and cost per video`}</div></div>
        <div class="cr-stats">
          <div><div class="k">Delivered</div><div class="v">${int(x.delivered)}</div></div>
          <div><div class="k">Pending</div><div class="v">${x.pending == null ? '<span class="na">n/a</span>' : int(x.pending)}</div></div>
          <div><div class="k">Cost per video</div><div class="v">${x.costPerVideo == null ? '<span class="na">n/a</span>' : unit(x.costPerVideo)}</div></div>
          <div><div class="k">Paid this period</div><div class="v">${money(x.paidP)}</div></div>
          <div><div class="k">Paid in total</div><div class="v">${money(x.paidAll)}</div></div>
          <div><div class="k">Per delivered video</div><div class="v">${x.costPerDelivered == null ? '<span class="na">n/a</span>' : unit(x.costPerDelivered)}</div></div>
        </div>
        ${prog != null ? `<div><div class="progress" role="img" aria-label="${Math.round(prog)}% of videos delivered"><span style="width:${prog.toFixed(1)}%"></span></div><div class="note" style="margin-top:6px">${Math.round(prog)}% delivered${behind > 0 ? ` · <span style="color:var(--warn);font-weight:600">${int(behind)} behind schedule</span>` : ''}</div></div>` : ''}
        ${canEdit() ? `<div class="cr-foot">
          <button type="button" class="btn sm" data-act="log-videos" data-id="${esc(c.id)}" data-n="1">${icon(I.plus)}1 video</button>
          ${x.perDay > 1 ? `<button type="button" class="btn sm" data-act="log-videos" data-id="${esc(c.id)}" data-n="${x.perDay}">${icon(I.plus)}${int(x.perDay)} (a day's worth)</button>` : ''}
          <button type="button" class="btn sm" data-act="pay-creator" data-id="${esc(c.id)}">Record payment</button>
          <button type="button" class="btn sm ghost" data-act="edit-creator" data-id="${esc(c.id)}" aria-label="Edit ${esc(c.name)}">${icon(I.edit)}</button>
        </div>` : ''}
      </article>`;
    }).join('');
    const cols = [
      { key: 'name', label: 'Creator' },
      { key: 'paidP', label: 'Paid (period)', n: true, fmt: (v) => money(v), total: () => money(totalPaid) },
      { key: 'paidAll', label: 'Paid in total', n: true, fmt: (v) => money(v), total: () => money(sum(cs, (x) => x.paidAll)) },
      { key: 'perDay', label: 'Videos a day', n: true, fmt: (v) => int(v) },
      { key: 'committed', label: 'Videos agreed', n: true, fmt: (v) => int(v) },
      { key: 'delivered', label: 'Delivered', n: true, fmt: (v) => int(v), total: () => int(delivered) },
      { key: 'pending', label: 'Pending', n: true, fmt: (v) => int(v), total: () => (known.length ? int(pending) : 'n/a') },
      { key: 'costPerVideo', label: 'Cost per video', n: true, fmt: (v) => unit(v) },
      { key: 'costPerDelivered', label: 'Per delivered video', n: true, fmt: (v) => unit(v) },
    ];
    return head('Creator payments', 'What each creator is paid, what they owe in videos, and what each video costs. Payments live in the expense ledger, so nothing is counted twice.',
      btn(icon(I.down) + 'Export CSV', 'export', 'data-what="creators"', 'ghost') + btn(icon(I.plus) + 'Add creator', 'add-creator', '', 'primary')) +
      `<div class="kpis">
        ${kpi('Creator payments', money(totalPaid), esc(periodLabel()), 2)}
        ${kpi('Active creators', int(active.length), `${int(cs.length)} in total`)}
        ${kpi('Videos per day', int(perDay), 'Across active creators')}
        ${kpi('Videos delivered', int(delivered), known.length ? `${int(pending)} still pending` : 'Add deal lengths to see pending')}
        ${kpi('Average cost per video', unit(div(sum(known, (x) => num(x.c.payment)), sum(known, (x) => x.committed))), known.length ? 'Deals with a set length' : 'Needs deal lengths')}
      </div>
      ${cs.length ? `<div class="creators">${cards}</div>
        <div class="card"><div class="card-head"><div><h2>All creators</h2><p class="note">${esc(periodLabel())}. Sort any column.</p></div></div>${table('creators', cols, cs, { def: { key: 'paidP', dir: 'desc' }, total: true })}</div>`
      : empty('No creators yet', 'Add each creator with their payment and daily video commitment.', btn(icon(I.plus) + 'Add creator', 'add-creator', '', 'primary'))}`;
  };

  function attention() {
    const out = []; const sp = spendByChannel(expensesP()); const t = today();
    if ((sp.unassigned || 0) > 0) out.push({ tone: 'warn', text: `Categorize the <b>${money(sp.unassigned)}</b> of uncategorized ad spend so each channel's total is right.` });
    const budget = num(S.settings.monthlyBudget); const ms = monthStart(t); const me = monthEnd(t);
    const monthList = S.expenses.filter((e) => isConf(e) && e.date >= ms && e.date <= me);
    const monthS = sum(monthList, (e) => num(e.amount));
    if (budget > 0) {
      const elapsed = (daysBetween(ms, t) + 1) / (daysBetween(ms, me) + 1);
      if (monthS > budget) out.push({ tone: 'bad', text: `This month's spend is <b>${money(monthS - budget)}</b> over the ${money(budget)} budget.` });
      else if (monthS / budget > elapsed + 0.15) out.push({ tone: 'warn', text: `${pct(monthS / budget)} of the monthly budget is used with ${pct(elapsed)} of the month gone.` });
    } else out.push({ tone: 'info', text: 'Set a monthly budget to see how much is left and whether spending is on pace.' });
    const cb = S.settings.channelBudgets || {}; const msp = spendByChannel(monthList);
    Object.keys(cb).forEach((k) => { if (num(cb[k]) > 0 && (msp[k] || 0) > num(cb[k])) out.push({ tone: 'bad', text: `${esc(chan(k).short)} is ${money((msp[k] || 0) - num(cb[k]))} over its ${money(num(cb[k]))} monthly budget.` }); });
    creatorStats().forEach((x) => {
      if ((x.c.status || 'active') !== 'active') return;
      if (x.expected != null && x.delivered < x.expected) out.push({ tone: 'warn', text: `${esc(x.c.name)} is ${int(x.expected - x.delivered)} ${x.expected - x.delivered === 1 ? 'video' : 'videos'} behind schedule.` });
      if (!num(x.c.dealDays)) out.push({ tone: 'info', text: `Add the deal length for ${esc(x.c.name)} to track pending videos and cost per video.` });
    });
    return out;
  }

  RENDER.setup = function () {
    const budgets = S.settings.channelBudgets || {}; const chs = channels().filter((c) => c.id !== 'unassigned'); const ed = canEdit();
    return head('Budget & channels', 'Set how much you plan to spend each month, and the channels your spending is grouped into.') +
      `<div class="card"><div class="card-head"><div><h2>Monthly budgets</h2><p class="note">The total drives the gauge on the overview. Channel budgets flag a channel that goes over.</p></div></div>
        <div class="form-grid">
          <div class="field"><label for="b-total">Total monthly budget</label><div class="money"><input type="number" min="0" step="1" id="b-total" value="${num(S.settings.monthlyBudget) || ''}" placeholder="Not set" ${ed ? '' : 'disabled'}></div></div>
          ${chs.map((c) => `<div class="field"><label for="b-${esc(c.id)}">${esc(c.name)}</label><div class="money"><input type="number" min="0" step="1" id="b-${esc(c.id)}" data-budget="${esc(c.id)}" value="${num(budgets[c.id]) || ''}" placeholder="Not set" ${ed ? '' : 'disabled'}></div></div>`).join('')}
        </div>
        <div>${btn(icon(I.check) + 'Save budgets', 'save-budget', '', 'primary')}</div></div>
      <div class="card"><div class="card-head"><div><h2>Marketing channels</h2><p class="note">The five standard channels are always here. Add your own for new platforms, such as TikTok Ads or Google Ads.</p></div></div>
        <div class="tbl-wrap"><table><thead><tr><th scope="col">Channel</th><th scope="col">Type</th><th class="n" scope="col">Expenses</th><th></th></tr></thead><tbody>
        ${chs.map((c) => { const n = S.expenses.filter((e) => e.channel === c.id).length; return `<tr><td><span style="display:inline-flex;gap:8px;align-items:center"><i class="sw" style="background:var(--s${c.slot})"></i>${esc(c.name)}</span></td><td>${c.custom ? 'Added by you' : 'Standard'}</td><td class="n">${n}</td><td class="actions">${c.custom && ed ? `<button type="button" class="btn sm ghost" data-act="rename-channel" data-id="${esc(c.id)}">Rename</button>${n ? '' : ` <button type="button" class="btn sm ghost danger" data-act="del-channel" data-id="${esc(c.id)}">Remove</button>`}` : ''}</td></tr>`; }).join('')}
        </tbody></table></div>
        <div>${btn(icon(I.plus) + 'Add channel', 'add-channel')}</div></div>`;
  };

  /* ================= rendering ================= */
  let queued = false;
  function render() { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; renderNow(); }); }
  function renderNow() {
    const host = document.getElementById('view');
    const active = document.activeElement; const aid = active && active.id && host.contains(active) ? active.id : null;
    const caret = aid && typeof active.selectionStart === 'number' ? active.selectionStart : null;
    const v = VIEWS.find((x) => x.id === S.view) || VIEWS[0];
    let html;
    try { html = RENDER[v.id](); } catch (err) { html = head(v.label, 'This section could not be drawn. Reload the page to try again.'); console.error(err); }
    host.innerHTML = banners() + html;
    document.getElementById('crumb').textContent = v.label;
    document.querySelectorAll('.nav-btn').forEach((b) => b.setAttribute('aria-current', b.getAttribute('data-view') === v.id ? 'page' : 'false'));
    document.getElementById('quick-add').disabled = !canEdit();
    syncChip();
    if (v.id === 'overview') drawSpendChart();
    if (aid) { const el = document.getElementById(aid); if (el) { el.focus(); if (caret != null && el.setSelectionRange) try { el.setSelectionRange(caret, caret); } catch (e) { /* not a text field */ } } }
  }
  function banners() {
    if (S.dbState === 'none') return `<div class="banner warn"><span class="grow"><b>Saving isn't available.</b> This browser is blocking storage, so changes can't be kept. Reload the page or try another browser.</span></div>`;
    if (S.storeMode === 'memory') return `<div class="banner warn"><span class="grow"><b>Changes last until you close this tab.</b> This browser is blocking storage. Allow site data for trip360.site to keep your entries.</span></div>`;
    if (S.storeMode === 'local') return `<div class="banner info"><span class="grow"><b>Saved in this browser only.</b> Entries stay on this computer and are not shared with other admins yet. Export a CSV to back them up.</span></div>`;
    if (S.readOnly || S.canWrite === false) return `<div class="banner info"><span class="grow"><b>View only.</b> You can look around, but only people with edit access can add or change data.</span></div>`;
    return '';
  }
  function syncChip() {
    const chip = document.getElementById('sync-chip'); const label = chip.querySelector('span');
    chip.className = 'status-chip';
    if (S.dbState === 'connecting') label.textContent = 'Connecting';
    else if (S.dbState === 'none') { chip.classList.add('warn'); label.textContent = 'Not saving'; }
    else if (S.loaded.expenses && S.loaded.creators) { chip.classList.add('ok'); label.textContent = !canEdit() ? 'View only' : S.storeMode === 'local' ? 'Saved in this browser' : S.storeMode === 'memory' ? 'Not kept after closing' : 'Saved and synced'; }
    else label.textContent = 'Loading data';
  }

  /* ================= toast & modal ================= */
  let toastTimer;
  function toast(msg) {
    const host = document.getElementById('toast-host');
    host.innerHTML = `<div class="toast" role="status">${esc(msg)}</div>`;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { host.innerHTML = ''; }, 3200);
  }
  let modalState = null;
  function closeModal() { document.getElementById('modal-host').innerHTML = ''; const back = modalState && modalState.back; modalState = null; if (back && document.contains(back)) back.focus(); }
  function openModal(opts) {
    modalState = Object.assign({ back: document.activeElement }, opts);
    document.getElementById('modal-host').innerHTML = `<div class="modal-root" data-modal-bg>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header><div><h2 id="modal-title">${esc(opts.title)}</h2>${opts.sub ? `<p>${esc(opts.sub)}</p>` : ''}</div><button type="button" class="btn ghost sm" data-modal-close aria-label="Close">${icon('M6 6l12 12M18 6L6 18')}</button></header>
        <form class="body" id="modal-form" novalidate>${opts.body}<div class="form-err" id="form-err" hidden></div></form>
        <footer>${opts.danger ? `<button type="button" class="btn ghost danger left" data-modal-danger>${esc(opts.danger)}</button>` : ''}<button type="button" class="btn ghost" data-modal-close>Cancel</button><button type="submit" form="modal-form" class="btn ${opts.destructive ? 'danger' : 'primary'}" id="modal-submit">${esc(opts.submit || 'Save')}</button></footer>
      </div></div>`;
    const form = document.getElementById('modal-form');
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const err = document.getElementById('form-err'); err.hidden = true;
      const sb = document.getElementById('modal-submit'); sb.disabled = true;
      try { const res = await opts.onSubmit(form); if (res === true) closeModal(); else if (typeof res === 'string') { err.textContent = res; err.hidden = false; } }
      finally { const s2 = document.getElementById('modal-submit'); if (s2) s2.disabled = false; }
    });
    if (opts.onChange) { form.addEventListener('change', () => opts.onChange(form)); opts.onChange(form); }
    if (opts.onInput) { form.addEventListener('input', () => opts.onInput(form)); opts.onInput(form); }
    const first = form.querySelector('input:not([disabled]), select, textarea'); if (first) first.focus();
  }
  function field(f, val) {
    const id = 'f-' + f.name; const v = val == null ? (f.def == null ? '' : f.def) : val;
    const wrap = (inner) => `<div class="field${f.full ? ' full' : ''}${f.type === 'checkbox' ? ' check' : ''}" data-field="${f.name}">${inner}${f.help ? `<span class="help">${f.help}</span>` : ''}</div>`;
    if (f.type === 'checkbox') return wrap(`<input type="checkbox" id="${id}" name="${f.name}" ${v ? 'checked' : ''}><label for="${id}">${esc(f.label)}</label>`);
    const lab = `<label for="${id}">${esc(f.label)}${f.required ? '' : ' <span style="font-weight:400;color:var(--fg-3)">(optional)</span>'}</label>`;
    if (f.type === 'select') return wrap(lab + `<select id="${id}" name="${f.name}">${f.options.map((o) => `<option value="${esc(o[0])}"${String(o[0]) === String(v) ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`);
    if (f.type === 'textarea') return wrap(lab + `<textarea id="${id}" name="${f.name}">${esc(v)}</textarea>`);
    if (f.type === 'money') return wrap(lab + `<div class="money"><input type="number" inputmode="decimal" min="0" step="0.01" id="${id}" name="${f.name}" value="${esc(v)}"></div>`);
    if (f.type === 'int') return wrap(lab + `<input type="number" inputmode="numeric" min="0" step="1" id="${id}" name="${f.name}" value="${esc(v)}">`);
    if (f.type === 'date') return wrap(lab + `<input type="date" id="${id}" name="${f.name}" value="${esc(v)}" min="2000-01-01" max="2099-12-31">`);
    return wrap(lab + `<input type="text" id="${id}" name="${f.name}" value="${esc(v)}" maxlength="${f.max || 140}"${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}>`);
  }
  const fval = (form, name) => { const el = form.elements[name]; if (!el) return undefined; return el.type === 'checkbox' ? el.checked : el.value; };
  const showField = (form, name, on) => { const el = form.querySelector(`[data-field="${name}"]`); if (el) el.hidden = !on; };
  const nowISO = () => new Date().toISOString();
  const strip = (o) => { const b = Object.assign({}, o); delete b.id; return b; };

  /* ================= writes ================= */
  async function write(fn, okMsg) {
    if (!canEdit()) { toast(S.dbState === 'none' ? "Saving isn't available in this view." : 'You have view-only access.'); return false; }
    for (let attempt = 0; attempt < 2; attempt++) {
      try { await fn(S.db); if (okMsg) toast(okMsg); return true; } catch (e) {
        const code = e && e.code;
        if (code === 'unavailable' && attempt === 0) { await new Promise((r) => setTimeout(r, 400 + Math.random() * 600)); continue; }
        if (code === 'invalid_argument' && S.canWrite !== true) { S.readOnly = true; render(); toast('You can view this portal, but your access does not allow changes.'); }
        else if (code === 'quota_exceeded') toast('Storage is full. Remove old entries before adding new ones.');
        else if (code === 'revoked') { S.dbState = 'none'; render(); toast('Access to saved data ended. Reload to reconnect.'); }
        else toast('That did not save. Check your connection and try again.');
        console.error(e); return false;
      }
    }
    return false;
  }

  function confirmDelete(kind, name, run, extra) {
    openModal({ title: `Delete this ${kind}?`, submit: 'Delete', destructive: true,
      body: `<p style="margin:0">“${esc(name || 'Untitled')}” will be removed for everyone who uses this portal. ${extra || ''}This can't be undone.</p>`,
      onSubmit: async () => ((await run()) ? true : 'Not deleted. Try again.') });
  }

  function expenseForm(existing, preset) {
    const e = existing || Object.assign({ date: today(), channel: 'creators', dataType: 'manual' }, preset || {});
    const fields = [
      { name: 'label', label: 'Activity', type: 'text', required: true, placeholder: 'For example: Erica Drive videos', full: true },
      { name: 'amount', label: 'Amount (USD)', type: 'money', required: true },
      { name: 'date', label: 'Date paid', type: 'date', required: true },
      { name: 'channel', label: 'Channel', type: 'select', options: channels().map((c) => [c.id, c.name]), required: true },
      { name: 'creatorId', label: 'Creator', type: 'select', options: [['', 'Not linked to a creator']].concat(S.creators.map((c) => [c.id, c.name])) },
      { name: 'details', label: 'Details or deliverables', type: 'text', placeholder: 'For example: 2 videos per day', full: true },
      { name: 'dataType', label: 'Label', type: 'select', options: [['manual', 'Manual: a real payment'], ['estimated', 'Estimated: planned, not counted in totals']], required: true, full: true },
    ];
    openModal({
      title: existing ? 'Edit expense' : 'Add expense', sub: existing ? '' : 'Money spent on marketing. Every total updates as soon as you save.',
      body: `<div class="form-grid">${fields.map((f) => field(f, e[f.name])).join('')}</div>`, submit: existing ? 'Save changes' : 'Add expense', danger: existing ? 'Delete' : null,
      onChange: (form) => showField(form, 'creatorId', fval(form, 'channel') === 'creators'),
      onSubmit: async (form) => {
        const label = String(fval(form, 'label') || '').trim(); const amount = Number(fval(form, 'amount')); const date = fval(form, 'date');
        if (!label) return 'Give the expense a name.';
        if (fval(form, 'amount') === '' || !Number.isFinite(amount) || amount < 0) return 'Enter an amount of $0 or more.';
        if (!validDate(date)) return 'Pick the date it was paid.';
        const ch = fval(form, 'channel');
        const doc = { label: label, amount: Math.round(amount * 100) / 100, date: date, channel: ch, details: String(fval(form, 'details') || '').trim(),
          creatorId: ch === 'creators' ? fval(form, 'creatorId') || null : null, dataType: fval(form, 'dataType') === 'estimated' ? 'estimated' : 'manual', updatedAt: nowISO() };
        const ok = await write(async (db) => {
          if (existing) await db.doc('expenses/' + existing.id).set(Object.assign(strip(existing), doc));
          else await db.collection('expenses').add(Object.assign(doc, { createdAt: nowISO() }));
        }, existing ? 'Expense updated' : 'Expense added');
        return ok ? true : 'Not saved yet. Try again.';
      },
      onDanger: existing ? () => confirmDelete('expense', existing.label, () => write((db) => db.doc('expenses/' + existing.id).delete(), 'Expense deleted')) : null,
    });
  }

  function categorizeForm(e) {
    const amount = num(e.amount); const opts = channels().filter((c) => c.id !== 'unassigned');
    const line = (ch, amt) => `<div class="split-row"><select name="sc" aria-label="Channel">${opts.map((c) => `<option value="${esc(c.id)}"${c.id === ch ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select><div class="money"><input type="number" name="sa" min="0" step="0.01" value="${amt}" aria-label="Amount"></div><button type="button" class="btn sm ghost" data-split-del aria-label="Remove line">${icon(I.trash)}</button></div>`;
    openModal({
      title: 'Categorize ad spend', sub: `${e.label}: ${money(amount, true)} on ${fmtDate(e.date)}. Split it across channels if it covered more than one.`,
      body: `<div id="split-lines">${line('meta', amount)}</div><button type="button" class="btn sm" data-split-add>${icon(I.plus)}Add a line</button><div class="split-sum" id="split-sum"></div>`,
      submit: 'Save categories',
      onInput: (form) => {
        const total = Array.from(form.querySelectorAll('[name=sa]')).reduce((a, i) => a + num(i.value), 0);
        const left = Math.round((amount - total) * 100) / 100;
        document.getElementById('split-sum').innerHTML = left === 0 ? `<span style="color:var(--good)">All ${money(amount, true)} assigned.</span>` : `<span style="color:var(--warn)">${money(Math.abs(left), true)} ${left > 0 ? 'still to assign' : 'more than the original amount'}.</span>`;
      },
      onSubmit: async (form) => {
        const chs = Array.from(form.querySelectorAll('[name=sc]')).map((s) => s.value);
        const amts = Array.from(form.querySelectorAll('[name=sa]')).map((i) => Math.round(num(i.value) * 100) / 100);
        const lines = chs.map((c, i) => ({ c: c, a: amts[i] })).filter((l) => l.a > 0);
        if (!lines.length) return 'Add at least one channel with an amount.';
        const total = Math.round(lines.reduce((a, l) => a + l.a, 0) * 100) / 100;
        if (Math.abs(total - amount) > 0.001) return `The lines add up to ${money(total, true)}, but the expense is ${money(amount, true)}.`;
        const ok = await write(async (db) => {
          const base = strip(e);
          await db.doc('expenses/' + e.id).set(Object.assign({}, base, { channel: lines[0].c, amount: lines[0].a, updatedAt: nowISO() }));
          for (let i = 1; i < lines.length; i++) await db.collection('expenses').add(Object.assign({}, base, { channel: lines[i].c, amount: lines[i].a, details: (e.details ? e.details + ' · ' : '') + 'Split from ' + money(amount, true), createdAt: nowISO(), updatedAt: nowISO() }));
        }, 'Spend categorized');
        return ok ? true : 'Not saved yet. Try again.';
      },
    });
  }

  function creatorForm(existing) {
    const c = existing || { platform: 'TikTok', status: 'active', startDate: today(), videosDelivered: 0 };
    const fields = [
      { name: 'name', label: 'Creator name', type: 'text', required: true, full: true },
      { name: 'platform', label: 'Platform', type: 'select', options: [['TikTok', 'TikTok'], ['Instagram', 'Instagram'], ['YouTube', 'YouTube'], ['Facebook', 'Facebook'], ['Other', 'Other or not set']], required: true },
      { name: 'handle', label: 'Handle', type: 'text', placeholder: '@handle' },
      { name: 'payment', label: 'Payment amount (USD)', type: 'money', required: true },
      { name: 'videosPerDay', label: 'Videos per day', type: 'int', required: true },
      { name: 'startDate', label: 'Start date', type: 'date' },
      { name: 'dealDays', label: 'Deal length in days', type: 'int', help: 'How many days the payment covers. Used for pending videos and cost per video.' },
      { name: 'videosDelivered', label: 'Videos delivered so far', type: 'int', required: true },
      { name: 'status', label: 'Status', type: 'select', options: [['active', 'Active'], ['paused', 'Paused'], ['ended', 'Ended']], required: true },
      { name: 'notes', label: 'Notes', type: 'textarea', full: true },
    ];
    if (!existing) fields.push({ name: 'recordPayment', label: 'Also add this payment to Marketing Expenses', type: 'checkbox', full: true });
    openModal({
      title: existing ? 'Edit creator' : 'Add creator', sub: existing ? 'Payments are recorded separately in Marketing Expenses.' : 'A creator or influencer making videos for Trip360.',
      body: `<div class="form-grid">${fields.map((f) => field(f, f.name === 'recordPayment' ? true : c[f.name])).join('')}</div>`,
      submit: existing ? 'Save changes' : 'Add creator', danger: existing ? 'Delete' : null,
      onSubmit: async (form) => {
        const name = String(fval(form, 'name') || '').trim(); if (!name) return 'Enter the creator name.';
        const payment = Number(fval(form, 'payment')); if (fval(form, 'payment') === '' || !Number.isFinite(payment) || payment < 0) return 'Enter the payment amount.';
        const doc = { name: name, platform: fval(form, 'platform'), handle: String(fval(form, 'handle') || '').trim(), payment: Math.round(payment * 100) / 100,
          videosPerDay: Math.max(0, Math.round(num(fval(form, 'videosPerDay')))), startDate: validDate(fval(form, 'startDate')) ? fval(form, 'startDate') : '',
          dealDays: Math.max(0, Math.round(num(fval(form, 'dealDays')))), videosDelivered: Math.max(0, Math.round(num(fval(form, 'videosDelivered')))),
          status: fval(form, 'status'), notes: String(fval(form, 'notes') || '').trim(), updatedAt: nowISO() };
        const rec = !existing && fval(form, 'recordPayment');
        const ok = await write(async (db) => {
          if (existing) { await db.doc('creators/' + existing.id).set(Object.assign(strip(existing), doc)); return; }
          const ref = db.collection('creators').doc(); await ref.set(Object.assign(doc, { createdAt: nowISO() }));
          if (rec && payment > 0) await db.collection('expenses').add({ label: name, amount: doc.payment, date: doc.startDate || today(), channel: 'creators', creatorId: ref.id,
            details: doc.videosPerDay ? doc.videosPerDay + (doc.videosPerDay === 1 ? ' video' : ' videos') + ' per day' : '', dataType: 'manual', createdAt: nowISO(), updatedAt: nowISO() });
        }, existing ? 'Creator updated' : 'Creator added');
        return ok ? true : 'Not saved yet. Try again.';
      },
      onDanger: existing ? () => confirmDelete('creator', existing.name, () => write((db) => db.doc('creators/' + existing.id).delete(), 'Creator deleted'), 'Their payments stay in Marketing Expenses. ') : null,
    });
  }

  function channelForm(existing) {
    openModal({
      title: existing ? 'Rename channel' : 'Add channel', sub: 'A new marketing channel, such as TikTok Ads or Google Ads. It appears in expenses, totals and budgets.',
      body: `<div class="form-grid">${field({ name: 'name', label: 'Channel name', type: 'text', required: true, full: true, max: 40 }, existing ? existing.name : '')}</div>`,
      submit: existing ? 'Rename' : 'Add channel',
      onSubmit: async (form) => {
        const name = String(fval(form, 'name') || '').trim(); if (!name) return 'Enter a name.';
        if (channels().some((c) => c.name.toLowerCase() === name.toLowerCase() && (!existing || c.id !== existing.id))) return 'A channel with that name already exists.';
        const ok = await write(async (db) => {
          if (existing) await db.doc('channels/' + existing.id).set({ name: name, updatedAt: nowISO() });
          else await db.collection('channels').add({ name: name, createdAt: nowISO() });
        }, existing ? 'Channel renamed' : 'Channel added');
        return ok ? true : 'Not saved yet. Try again.';
      },
    });
  }

  /* ---------- export ---------- */
  const csv = (rows) => rows.map((r) => r.map((v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');
  async function exportCSV(what) {
    let rows; let name;
    if (what === 'creators') {
      name = 'trip360-creators.csv';
      rows = [['Creator', 'Platform', 'Handle', 'Payment', 'Videos per day', 'Start date', 'Deal length (days)', 'Videos agreed', 'Delivered', 'Pending', 'Cost per video', 'Paid this period', 'Paid in total', 'Status']]
        .concat(creatorStats().map((x) => [x.c.name, x.c.platform || '', x.c.handle || '', num(x.c.payment), x.perDay, x.c.startDate || '', num(x.c.dealDays) || '', x.committed == null ? '' : x.committed, x.delivered, x.pending == null ? '' : x.pending, x.costPerVideo == null ? '' : x.costPerVideo.toFixed(2), x.paidP, x.paidAll, x.c.status || 'active']));
    } else {
      name = 'trip360-expenses.csv';
      rows = [['Date', 'Activity', 'Channel', 'Creator', 'Details', 'Amount', 'Label']]
        .concat(expensesP().slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map((e) => [e.date, e.label, chan(chOf(e)).name, creatorName(e.creatorId), e.details || '', num(e.amount), e.dataType === 'estimated' ? 'Estimated' : 'Manual']));
    }
    const text = csv(rows);
    if (S.downloads) {
      try { await S.downloads.save({ filename: name, data: text }); toast('Saved ' + name); return; } catch (e) {
        if (e && e.code === 'declined') return;
        if (e && e.code === 'rate_limited') { toast('A save is already waiting for your answer.'); return; }
      }
    }
    if (!S.downloads) {
      try {
        const url = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000); toast('Downloaded ' + name); return;
      } catch (e) { /* fall back to copy */ }
    }
    openModal({ title: 'Copy this CSV', sub: 'Downloads are blocked here. Select the text, copy it and paste it into a spreadsheet.', body: `<textarea id="copy-area" style="width:100%;min-height:220px" readonly>${esc(text)}</textarea>`, submit: 'Done', onSubmit: async () => true });
    const ta = document.getElementById('copy-area'); if (ta) ta.select();
  }

  async function saveBudgets() {
    const per = {};
    document.querySelectorAll('[data-budget]').forEach((i) => { const v = num(i.value); if (v > 0) per[i.getAttribute('data-budget')] = v; });
    await write((db) => db.doc('settings/main').set(Object.assign({}, S.settings, { monthlyBudget: num(document.getElementById('b-total').value), channelBudgets: per, updatedAt: nowISO() })), 'Budgets saved');
  }

  /* ================= events ================= */
  document.addEventListener('click', (ev) => {
    const mh = document.getElementById('modal-host');
    if (mh.contains(ev.target)) {
      if (ev.target.closest('[data-modal-close]') || ev.target.hasAttribute('data-modal-bg')) { closeModal(); return; }
      if (ev.target.closest('[data-modal-danger]') && modalState && modalState.onDanger) { const fn = modalState.onDanger; closeModal(); fn(); return; }
      const form = document.getElementById('modal-form');
      if (ev.target.closest('[data-split-add]')) {
        const host = document.getElementById('split-lines'); const clone = host.querySelector('.split-row').cloneNode(true);
        clone.querySelector('input').value = ''; clone.querySelector('select').value = 'apple'; host.appendChild(clone);
        if (modalState.onInput) modalState.onInput(form); return;
      }
      const del = ev.target.closest('[data-split-del]');
      if (del) { const host = document.getElementById('split-lines'); if (host.children.length > 1) del.closest('.split-row').remove(); if (modalState.onInput) modalState.onInput(form); }
      return;
    }
    const t = ev.target.closest('[data-act]'); if (!t || t.disabled) return;
    const act = t.getAttribute('data-act'); const id = t.getAttribute('data-id');
    const find = (list) => list.find((x) => x.id === id);
    switch (act) {
      case 'nav': go(t.getAttribute('data-view')); break;
      case 'quick-add': quickAdd(); break;
      case 'add-expense': expenseForm(null); break;
      case 'edit-expense': { const e = find(S.expenses); if (e) expenseForm(e); break; }
      case 'categorize': { const e = find(S.expenses); if (e) categorizeForm(e); break; }
      case 'add-creator': creatorForm(null); break;
      case 'edit-creator': { const c = find(S.creators); if (c) creatorForm(c); break; }
      case 'pay-creator': { const c = find(S.creators); if (c) expenseForm(null, { channel: 'creators', creatorId: c.id, label: c.name, amount: num(c.payment) || '', details: num(c.videosPerDay) ? c.videosPerDay + ' videos per day' : '' }); break; }
      case 'log-videos': {
        const c = find(S.creators); if (!c) break; const n = Math.max(1, num(t.getAttribute('data-n')));
        write((db) => db.doc('creators/' + c.id).set(Object.assign(strip(c), { videosDelivered: num(c.videosDelivered) + n, updatedAt: nowISO() })), `Logged ${n} ${n === 1 ? 'video' : 'videos'} for ${c.name}`);
        break;
      }
      case 'sort': { const tb = t.getAttribute('data-table'); const key = t.getAttribute('data-key'); const cur = S.ui.sort[tb] || {}; S.ui.sort[tb] = { key: key, dir: cur.key === key && cur.dir === 'desc' ? 'asc' : 'desc' }; render(); break; }
      case 'gran': S.gran = t.getAttribute('data-g'); render(); break;
      case 'filter-chan': S.ui.expFilter = t.getAttribute('data-c'); if (S.view !== 'expenses') go('expenses'); else render(); break;
      case 'export': exportCSV(t.getAttribute('data-what')); break;
      case 'save-budget': saveBudgets(); break;
      case 'add-channel': channelForm(null); break;
      case 'rename-channel': { const c = find(S.channels); if (c) channelForm(c); break; }
      case 'del-channel': { const c = find(S.channels); if (c) confirmDelete('channel', c.name, () => write((db) => db.doc('channels/' + c.id).delete(), 'Channel removed')); break; }
      default: break;
    }
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && modalState) closeModal(); });
  let searchTimer;
  document.addEventListener('input', (ev) => { if (ev.target.id === 'exp-search') { S.ui.expSearch = ev.target.value; clearTimeout(searchTimer); searchTimer = setTimeout(render, 160); } });

  function quickAdd() {
    openModal({
      title: 'What do you want to add?', submit: 'Continue',
      body: `<div class="form-grid">${field({ name: 'what', label: 'Choose one', type: 'select', required: true, full: true, options: [['expense', 'A marketing expense'], ['creator', 'A creator'], ['channel', 'A new marketing channel']] }, S.view === 'creators' ? 'creator' : 'expense')}</div>`,
      onSubmit: async (form) => {
        const w = fval(form, 'what'); closeModal();
        setTimeout(() => { if (w === 'creator') creatorForm(null); else if (w === 'channel') channelForm(null); else expenseForm(null); }, 0);
        return false;
      },
    });
  }

  function go(id) {
    if (!VIEWS.some((v) => v.id === id)) id = 'overview';
    S.view = id;
    if (location.hash.slice(1) !== id) { try { history.replaceState(null, '', '#' + id); } catch (e) { location.hash = id; } }
    render(); window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== S.view && VIEWS.some((v) => v.id === h)) { S.view = h; render(); } });
  let rTimer; let rw = 0;
  window.addEventListener('resize', () => { clearTimeout(rTimer); rTimer = setTimeout(() => { if (window.innerWidth !== rw) { rw = window.innerWidth; if (S.view === 'overview') drawSpendChart(); } }, 150); });

  /* ================= boot ================= */
  document.getElementById('nav-list').innerHTML = VIEWS.map((v) => `<li><button type="button" class="nav-btn" data-act="nav" data-view="${v.id}">${icon(v.icon, 18)}<span>${esc(v.label)}</span></button></li>`).join('');
  const ps = document.getElementById('period-select');
  ps.innerHTML = PERIODS.map((p) => `<option value="${p[0]}"${p[0] === S.period ? ' selected' : ''}>${p[1]}</option>`).join('');
  ps.addEventListener('change', () => { S.period = ps.value; try { localStorage.setItem('t360-period', S.period); } catch (e) { /* storage unavailable */ } render(); });
  const h0 = location.hash.slice(1); if (VIEWS.some((v) => v.id === h0)) S.view = h0;
  render();

  async function boot() {
    const c = window.claude;
    const site = window.T360MarketingStore || null;
    let db = null; let user = null;
    if (c && typeof c.use === 'function') {
      const safe = (p) => Promise.resolve(p).catch(() => null);
      const res = await Promise.all([safe(c.use('db')), safe(c.use('user')), safe(c.use('downloads'))]);
      db = res[0]; user = res[1]; S.downloads = res[2];
    }
    if (!db && site) { db = site; S.storeMode = site.mode || 'local'; }
    if (!db) { S.dbState = 'none'; render(); return; }
    S.db = db; S.dbState = 'ready';
    if (user && typeof user.can === 'function') { try { S.canWrite = await user.can('data.write'); } catch (e) { S.canWrite = null; } }
    const onErr = (name) => (e) => { console.error(name, e); if (e && e.code === 'revoked') { S.dbState = 'none'; render(); } };
    ['expenses', 'creators', 'channels'].forEach((name) => {
      db.collection(name).onSnapshot((snap) => { S[name] = snap.docs.map((d) => Object.assign({}, d.data(), { id: d.id })); S.loaded[name] = true; render(); }, onErr(name));
    });
    db.doc('settings/main').onSnapshot((snap) => { S.settings = snap.exists ? Object.assign({}, snap.data()) : {}; S.loaded.settings = true; render(); }, onErr('settings'));
    render();
  }
  boot();
})();
