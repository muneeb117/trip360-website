// Trip360 admin panel (admin.trip360.site). Plain ES module, no build step.
// Reads the admin API (docs/analytics-spec.md §5):
//   GET {API_BASE}/admin/<section>?days=N   with headers x-admin-key + apikey
// `?demo=1` swaps the API for the bundled sample JSON in /admin/demo/.

import { API_BASE, PUBLISHABLE_KEY } from './config.js';

// ---------------------------------------------------------------- constants

const STORE_KEY = 'trip360.admin.key';
const STORE_DAYS = 'trip360.admin.days';

const RANGES = [
  { days: 1, label: '1D', long: 'Last 24 hours' },
  { days: 7, label: '7D', long: 'Last 7 days' },
  { days: 30, label: '30D', long: 'Last 30 days' },
  { days: 90, label: '90D', long: 'Last 90 days' },
  { days: 365, label: '1Y', long: 'Last 12 months' },
];

const ICON = {
  overview: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  usage: '<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
  funnel: '<path d="M3 4h18l-7 8.5V19l-4 2v-8.5z"/>',
  purchases: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6.5 15h4"/>',
  invites: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M18 8v6M15 11h6"/>',
  issues: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  versions: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  paywall: '<path d="M9.5 3h5M10.5 3v5.5L5 18.5A1.8 1.8 0 0 0 6.6 21h10.8a1.8 1.8 0 0 0 1.6-2.5L13.5 8.5V3"/><path d="M7.5 15h9"/>',
  users: '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L16 16"/>',
  creators: '<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5"/>',
  autodrive: '<path d="M5 16l1.6-5.2A2 2 0 0 1 8.5 9.4h7a2 2 0 0 1 1.9 1.4L19 16"/><rect x="3.5" y="16" width="17" height="4" rx="1.5"/><path d="M12 2.5v3M8.5 3.5l1.2 2M15.5 3.5l-1.2 2"/>',
};

const SECTIONS = [
  { id: 'overview', label: 'Overview', api: 'overview', sub: 'Users, drives, money and health' },
  { id: 'usage', label: 'Usage', api: 'usage', sub: 'Which screens and features people use' },
  { id: 'funnel', label: 'Funnel', api: 'funnel', sub: 'From install to purchase' },
  { id: 'purchases', label: 'Purchases', api: 'purchases', sub: 'Revenue, plans and why people buy' },
  { id: 'paywall', label: 'Paywall test', api: 'paywall_test', sub: 'Hard paywall with a store trial against the free week' },
  { id: 'autodrive', label: 'Auto-drive', api: 'auto_start', sub: 'Whose drives start by themselves, and what stops the rest' },
  { id: 'invites', label: 'Invites & friends', api: 'referrals', sub: 'Invite codes, friends and clubs' },
  { id: 'issues', label: 'Issues', api: 'issues', sub: 'Errors and crashes the app reported' },
  { id: 'versions', label: 'Versions', api: 'versions', sub: 'Adoption and stability by version' },
  { id: 'users', label: 'Users', api: null, sub: 'Find a driver by username or user id' },
  { id: 'creators', label: 'Creators', api: null, sub: 'Clipper Studio logins for UGC creators' },
];

// Chart series colours (lime is the brand slot; the rest validated for CVD).
const C = { s1: '#b2f227', s2: '#3987e5', s3: '#d95926', s4: '#9085e9', grid: '#1b1b1f', axis: '#2e2e33', tick: '#76767e' };

const LABELS = {
  drive: 'Drive', ranks: 'Ranks', play: 'Play', you: 'You', recap: 'Recap', all_drives: 'All drives',
  replay: '3D replay', paywall: 'Paywall', reel_editor: 'Reel editor', settings: 'Settings', friends: 'Friends',
  achievements: 'Achievements', vehicle_customiser: 'Vehicle customiser', notifications: 'Notifications',
  clubs: 'Clubs', onboarding: 'Onboarding',
  playMap: 'Play map', reels: 'Reels', fullHistory: 'Full history', detailedStats: 'Detailed stats',
  proBadge: 'Pro badge', proLiveries: 'Pro liveries', supportsDevelopment: 'Supports development',
  you_tab: 'You tab', free_pro_card: 'Free Pro card',
  weekly: 'Weekly', annual: 'Annual', yearly: 'Yearly', annual_winback: 'Annual (win-back)',
  ios: 'iOS', android: 'Android',
};

// ---------------------------------------------------------------- dom

const $ = (sel, root = document) => root.querySelector(sel);
const el = {
  boot: $('#boot'),
  gate: $('#gate'),
  gateForm: $('#gate-form'),
  gateKey: $('#gate-key'),
  gateError: $('#gate-error'),
  gateSubmit: $('#gate-submit'),
  shell: $('#shell'),
  sidebar: $('#sidebar'),
  sideNav: $('#side-nav'),
  scrim: $('#scrim'),
  navOpen: $('#nav-open'),
  navClose: $('#nav-close'),
  demoPill: $('#demo-pill'),
  signOut: $('#sign-out'),
  title: $('#page-title'),
  sub: $('#page-sub'),
  range: $('#range'),
  refresh: $('#refresh'),
  view: $('#view'),
  drawer: $('#drawer'),
  drawerScrim: $('#drawer-scrim'),
  drawerId: $('#drawer-id'),
  drawerBody: $('#drawer-body'),
  drawerClose: $('#drawer-close'),
  toast: $('#toast'),
};

// ---------------------------------------------------------------- state

const params = new URLSearchParams(window.location.search);
const state = {
  demo: params.get('demo') === '1' || params.get('demo') === 'true',
  key: null,
  days: 30,
  section: 'overview',
  userId: null,
  charts: [],
  ctrl: null,
  drawerCtrl: null,
  lastFocus: null,
  searchTimer: null,
};

// ---------------------------------------------------------------- storage

function store(key, value) {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private mode or blocked storage: the panel still works for this tab */
  }
}
function load(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- formatting

const nf = new Intl.NumberFormat('en-GB');
const cf = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 });

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);
const fmt = (n) => (isNum(n) ? nf.format(Math.round(n)) : '—');
const fmtDec = (n, d = 1) => (isNum(n) ? n.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
const compact = (n) => (!isNum(n) ? '—' : Math.abs(n) >= 100000 ? cf.format(n) : fmt(n));
function usd(n, { whole = false } = {}) {
  if (!isNum(n)) return '—';
  const big = whole || Math.abs(n) >= 10000;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: big ? 0 : 2, maximumFractionDigits: big ? 0 : 2 }).format(n);
}
function pct(n) {
  if (!isNum(n)) return '—';
  return `${n.toLocaleString('en-GB', { maximumFractionDigits: n < 10 ? 1 : 0, minimumFractionDigits: 0 })}%`;
}
const ratio = (a, b) => (isNum(a) && isNum(b) && b > 0 ? (a / b) * 100 : null);
const sum = (rows, key) => (rows || []).reduce((t, r) => t + (isNum(r?.[key]) ? r[key] : 0), 0);

function parseDate(value) {
  if (!value) return null;
  const s = String(value);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
function dayLabel(value) {
  const d = parseDate(value);
  return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) : esc(value);
}
function dateTime(value) {
  const d = parseDate(value);
  if (!d) return '—';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric', hour: '2-digit', minute: '2-digit' });
}
function rel(value) {
  const d = parseDate(value);
  if (!d) return '—';
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 0) {
    const f = -s;
    if (f < 3600) return `in ${Math.max(1, Math.round(f / 60))} min`;
    if (f < 86400 * 2) return `in ${Math.round(f / 3600)} h`;
    return `in ${Math.round(f / 86400)} d`;
  }
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)} d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function flag(cc) {
  if (!cc || !/^[A-Za-z]{2}$/.test(cc)) return '';
  const up = cc.toUpperCase();
  return String.fromCodePoint(...[...up].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
function human(key) {
  if (key == null || key === '') return '—';
  if (LABELS[key]) return LABELS[key];
  const words = String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
function initials(name) {
  const s = String(name || '?').replace(/[^A-Za-z0-9]/g, '');
  return esc(s.slice(0, 2) || '?');
}
function semverCmp(a, b) {
  const pa = String(a.app_version || '').split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b.app_version || '').split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pb[i] || 0) - (pa[i] || 0);
    if (d) return d;
  }
  return (parseInt(b.build, 10) || 0) - (parseInt(a.build, 10) || 0);
}
const rangeInfo = () => RANGES.find((r) => r.days === state.days) || RANGES[2];

// ---------------------------------------------------------------- api

class ApiError extends Error {
  constructor(status, message, { config = false } = {}) {
    super(message);
    this.status = status;
    this.config = config;
  }
}

async function api(path, signal, { method = 'GET', body: payload } = {}) {
  if (state.demo) return demoApi(path, signal, { method, body: payload });
  let res;
  try {
    res = await fetch(`${API_BASE}/admin/${path}`, {
      method,
      headers: {
        'x-admin-key': state.key || '',
        apikey: PUBLISHABLE_KEY,
        Accept: 'application/json',
        ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'Could not reach the admin API.');
  }
  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (res.status === 401 || res.status === 403) {
    const msg = String(body?.message || body?.msg || body?.error?.message || body?.error || '');
    // Supabase's own gateway answers 401 for a bad publishable key; that is a
    // config problem, not a wrong admin key.
    if (/api ?key|apikey|jwt/i.test(msg) && !/admin/i.test(msg)) {
      throw new ApiError(res.status, `The API rejected the publishable key (${msg}). Check admin/config.js.`, { config: true });
    }
    throw new ApiError(401, 'That key was not accepted.');
  }
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || body?.error || res.statusText || 'Request failed';
    throw new ApiError(res.status, typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  if (body == null) throw new ApiError(res.status, 'The API answered with something that is not JSON.');
  return body;
}

const demoCache = new Map();
async function demoJson(file, signal) {
  if (!demoCache.has(file)) {
    demoCache.set(
      file,
      fetch(`/admin/demo/${file}`, { signal }).then((r) => {
        if (!r.ok) throw new ApiError(r.status, `Sample file ${file} is missing.`);
        return r.json();
      }),
    );
  }
  try {
    return structuredClone(await demoCache.get(file));
  } catch (err) {
    demoCache.delete(file);
    throw err;
  }
}

// The sample files were generated "as of" this moment; shift every timestamp
// so relative times ("2 h ago") and the last series day line up with today.
const DEMO_NOW = Date.parse('2026-10-16T21:40:00Z');
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
function shiftDemo(value) {
  const ms = Date.now() - DEMO_NOW;
  const dayMs = Math.round(ms / 864e5) * 864e5;
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    if (typeof v === 'string' && ISO_TIME.test(v)) return new Date(Date.parse(v) + ms).toISOString();
    if (typeof v === 'string' && ISO_DAY.test(v)) return new Date(Date.parse(`${v}T00:00:00Z`) + dayMs).toISOString().slice(0, 10);
    return v;
  };
  return walk(value);
}

async function demoApi(path, signal, opts) {
  return shiftDemo(await demoApiRaw(path, signal, opts));
}

// Sample creators for `?demo=1`. Nothing here is saved anywhere.
const DEMO_CREATORS = [
  { user_id: '5f1c2a9e-0d41-4c5b-9b9e-2f7a1c3d4e01', name: 'Ayesha · TikTok', email: 'ayesha@example.com', created_at: '2026-10-12T10:05:00Z', last_seen_at: '2026-10-16T18:20:00Z', disabled_at: null },
  { user_id: '8b3d4f6a-7c21-4e9a-a1b2-3c4d5e6f7a02', name: 'Hamza · Reels', email: 'hamza@example.com', created_at: '2026-10-14T09:00:00Z', last_seen_at: null, disabled_at: null },
  { user_id: 'c2e4a6b8-9d01-4f23-8a45-6b7c8d9e0f03', name: 'Old clipper', email: 'clips@example.com', created_at: '2026-10-02T15:30:00Z', last_seen_at: '2026-10-05T11:00:00Z', disabled_at: '2026-10-09T08:00:00Z' },
];

function demoCreators(p, { method = 'GET', body } = {}) {
  if (method === 'GET' && p === 'creators') return { creators: DEMO_CREATORS };
  const sample = { password: 'sample-only-not-saved' };
  if (p === 'creators') {
    return { ...sample, creator: { user_id: crypto.randomUUID(), name: body?.name || null, email: body?.email || '', created_at: new Date(DEMO_NOW).toISOString(), last_seen_at: null, disabled_at: null } };
  }
  const [, id, act] = p.split('/');
  const c = DEMO_CREATORS.find((x) => x.user_id === id);
  if (!c) throw new ApiError(404, 'not_found');
  if (act === 'password') return { ...sample, creator: c };
  return { creator: { ...c, disabled_at: act === 'disable' ? new Date(DEMO_NOW).toISOString() : null } };
}

async function demoApiRaw(path, signal, opts) {
  await new Promise((resolve) => setTimeout(resolve, 260));
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const [p, qs] = path.split('?');
  const q = new URLSearchParams(qs || '');
  if (p === 'creators' || p.startsWith('creators/')) return demoCreators(p, opts);
  if (p === 'users') {
    const { users } = await demoJson('users.json', signal);
    const term = (q.get('q') || '').trim().toLowerCase();
    return { users: term ? users.filter((u) => u.username.toLowerCase().startsWith(term) || u.user_id.toLowerCase().startsWith(term)) : users };
  }
  if (p.startsWith('user/')) {
    const id = decodeURIComponent(p.slice(5));
    const [{ users }, detail] = await Promise.all([demoJson('users.json', signal), demoJson('user.json', signal)]);
    const u = users.find((x) => x.user_id === id);
    if (!u) throw new ApiError(404, 'No user with that id.');
    if (u.username !== detail.profile.username) {
      Object.assign(detail.profile, { user_id: u.user_id, username: u.username, display_name: null, country_code: u.country_code, created_at: u.created_at, friend_code: u.user_id.replace(/[^a-z2-9]/gi, '').slice(0, 8).toUpperCase() });
      detail.drives = u.drives;
      detail.distance_km = Math.round(u.drives * 17.4 * 10) / 10;
      detail.entitlement = u.plan === 'pro'
        ? { is_pro: true, plan: 'weekly', product_id: 'trip360.pro.weekly', source: 'store', period_type: 'NORMAL', expires_at: new Date(DEMO_NOW + 4 * 864e5).toISOString(), will_renew: true }
        : u.plan === 'trial'
          ? { is_pro: true, plan: 'trial', source: 'welcome_trial', period_type: 'TRIAL', expires_at: u.trial_until, will_renew: false }
          : null;
      if (u.plan !== 'pro') detail.purchases = [];
      detail.referrals = { code: detail.profile.friend_code, shared: Math.round(u.drives / 30), joined: Math.round(u.drives / 70), drove: Math.round(u.drives / 90), rewards_earned: Math.round(u.drives / 90), reward_days: Math.round(u.drives / 90) * 7, redeemed_code: null };
    }
    detail.last_seen = u.last_seen;
    return detail;
  }
  const days = RANGES.some((r) => r.days === Number(q.get('days'))) ? Number(q.get('days')) : 30;
  return demoJson(`${days}/${p}.json`, signal);
}

// ---------------------------------------------------------------- charts

function setupCharts() {
  const Chart = window.Chart;
  if (!Chart) return;
  Chart.defaults.font.family = 'Poppins, ui-sans-serif, system-ui, sans-serif';
  Chart.defaults.font.size = 11;
  Chart.defaults.color = C.tick;
  Chart.defaults.borderColor = C.grid;
  Chart.defaults.animation.duration = 450;
  Chart.defaults.plugins.legend.display = false;
  Object.assign(Chart.defaults.plugins.tooltip, {
    backgroundColor: '#1e1e22',
    borderColor: '#2e2e33',
    borderWidth: 1,
    titleColor: '#f7f7f2',
    bodyColor: '#c7c7c2',
    padding: 10,
    cornerRadius: 10,
    boxWidth: 8,
    boxHeight: 8,
    boxPadding: 4,
    usePointStyle: true,
    titleFont: { weight: '600' },
  });
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function makeChart(id, { type = 'bar', labels, series, stacked = false, format = fmt }) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  if (!labels.length) {
    canvas.parentElement.innerHTML = '<div class="chart-fallback">No data in this range yet.</div>';
    return;
  }
  const Chart = window.Chart;
  if (!Chart) {
    canvas.parentElement.innerHTML = '<div class="chart-fallback">Charts could not load. The numbers are in the table.</div>';
    return;
  }
  const dense = labels.length > 120;
  const kind = type === 'bar' && dense ? 'line' : type;
  const datasets = series.map((s) => (kind === 'line'
    ? {
      label: s.label,
      data: s.data,
      borderColor: s.color,
      borderWidth: 2,
      pointRadius: labels.length === 1 ? 3 : 0,
      pointHoverRadius: 4,
      pointHoverBorderWidth: 2,
      pointHoverBorderColor: '#111113',
      pointBackgroundColor: s.color,
      tension: 0.3,
      fill: series.length === 1 || s.fill ? 'origin' : false,
      backgroundColor: (ctx) => {
        const area = ctx.chart.chartArea;
        if (!area) return 'transparent';
        const g = ctx.chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
        g.addColorStop(0, hexA(s.color, 0.2));
        g.addColorStop(1, hexA(s.color, 0));
        return g;
      },
    }
    : {
      label: s.label,
      data: s.data,
      backgroundColor: s.color,
      hoverBackgroundColor: s.color,
      borderRadius: 4,
      borderSkipped: 'start',
      borderColor: '#111113',
      borderWidth: stacked ? { top: 2 } : 0,
      maxBarThickness: 26,
      categoryPercentage: 0.82,
      barPercentage: 0.92,
    }));
  const chart = new Chart(canvas, {
    type: kind,
    data: { labels: labels.map(dayLabel), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 6, right: 4 } },
      scales: {
        x: {
          stacked,
          grid: { display: false },
          border: { color: C.axis },
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 7, padding: 6 },
        },
        y: {
          stacked,
          beginAtZero: true,
          grid: { color: C.grid },
          border: { display: false },
          ticks: { maxTicksLimit: 5, padding: 8, callback: (v) => format(v, true) },
        },
      },
      plugins: {
        tooltip: {
          callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${format(ctx.parsed.y)}` },
        },
      },
    },
  });
  state.charts.push(chart);
}

function destroyCharts() {
  state.charts.forEach((c) => c.destroy());
  state.charts = [];
}

const usdAxis = (v, axis) => (axis ? `$${compact(v)}` : usd(v));
const intAxis = (v, axis) => (axis ? compact(v) : fmt(v));

// ---------------------------------------------------------------- html helpers

function tile(label, value, sub = '', { accent = false, spark = null, unit = '' } = {}) {
  const sp = Array.isArray(spark) && spark.length > 2 && spark.some((v) => v > 0);
  return `<div class="tile${accent ? ' accent' : ''}${sp ? ' has-spark' : ''}">
    <div class="t-label">${esc(label)}</div>
    <div class="t-value">${value}${unit ? `<small>${esc(unit)}</small>` : ''}</div>
    ${sub ? `<div class="t-sub">${sub}</div>` : ''}
    ${sp ? sparkSvg(spark) : ''}
  </div>`;
}

function sparkSvg(vals) {
  const w = 76;
  const h = 26;
  const max = Math.max(...vals.map((v) => (isNum(v) ? v : 0)), 1);
  const pts = vals.map((v, i) => [(i / (vals.length - 1)) * w, h - 2 - ((isNum(v) ? v : 0) / max) * (h - 5)]);
  const line = `M${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L')}`;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path class="area" d="${line} L${w} ${h} L0 ${h} Z"/><path d="${line}"/></svg>`;
}

function card(title, body, { hint = '', legend = null, flush = false, id = '' } = {}) {
  const lg = legend ? `<div class="legend">${legend.map((l) => `<span><i style="background:${l.color}"></i>${esc(l.label)}</span>`).join('')}</div>` : '';
  return `<section class="card"${id ? ` id="${id}"` : ''}>
    <div class="card-head"><h2>${esc(title)}</h2>${lg || (hint ? `<span class="hint">${hint}</span>` : '')}</div>
    <div class="card-body${flush ? ' flush' : ''}">${body}</div>
  </section>`;
}

function chartBox(id, { small = false, label = '' } = {}) {
  return `<div class="chart${small ? ' sm' : ''}"><canvas id="${id}" role="img" aria-label="${esc(label)}"></canvas></div>`;
}

function seriesTable(series, cols) {
  if (!series?.length) return '';
  const rows = [...series].reverse().map((r) => `<tr><td>${dayLabel(r.day)}</td>${cols.map((c) => `<td class="n">${(c.format || fmt)(r[c.key])}</td>`).join('')}</tr>`).join('');
  return `<details class="tbl-toggle"><summary class="note">Show as table</summary>
    <div class="table-wrap"><table><thead><tr><th>Day</th>${cols.map((c) => `<th class="n">${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
  </details>`;
}

function barCell(value, max, label = fmt(value), color = '') {
  const w = max > 0 && isNum(value) ? Math.max(1.5, (value / max) * 100) : 0;
  return `<div class="bar-cell"><span class="bar"><i style="width:${w.toFixed(1)}%${color ? `;background:${color}` : ''}"></i></span><span class="v">${label}</span></div>`;
}

function emptyInline(text = 'Nothing in this range yet.') {
  return `<div class="empty-inline">${esc(text)}</div>`;
}

function stateBlock(kind, title, text, actions = '') {
  const icon = kind === 'error'
    ? '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5v.01"/>'
    : '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12h7"/>';
  return `<div class="state ${kind}"><span class="s-ico"><svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg></span>
    <h2>${esc(title)}</h2><p>${text}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
}

function planBadge(plan, trialUntil) {
  const p = String(plan || 'free').toLowerCase();
  if (p === 'pro' || p === 'paid' || p === 'weekly' || p === 'annual' || p === 'yearly' || p === 'lifetime') return `<span class="badge pro">PRO${p !== 'pro' && p !== 'paid' ? ` · ${esc(human(p))}` : ''}</span>`;
  // The server stores every free Pro the same way, `referral_trial`: the free
  // week each new account gets plus any days earned from invites (D-159).
  if (p === 'trial' || p === 'referral_trial') {
    const end = parseDate(trialUntil);
    const left = end ? Math.ceil((end.getTime() - Date.now()) / 864e5) : null;
    return `<span class="badge trial">Free trial${left != null ? ` · ${left > 0 ? `${left} d left` : 'ended'}` : ''}</span>`;
  }
  return `<span class="badge">${esc(human(p))}</span>`;
}

function who(userId, username, { sub = true } = {}) {
  return `<span class="who"><span class="avatar" aria-hidden="true">${initials(username)}</span><span><span class="name">${esc(username || 'unknown')}</span>${sub && userId ? `<br><span class="id">${esc(String(userId).slice(0, 8))}…</span>` : ''}</span></span>`;
}

function userRowAttrs(userId) {
  return userId ? ` class="clickable" tabindex="0" data-user="${esc(userId)}"` : '';
}

function skeleton(id) {
  const tiles = id === 'versions' ? 3 : id === 'funnel' ? 4 : 6;
  return `<div class="tiles">${'<div class="skel tile-sk"></div>'.repeat(tiles)}</div><div class="skel card-sk"></div>${id === 'overview' ? '<div class="grid-2"><div class="skel card-sk"></div><div class="skel card-sk"></div></div>' : ''}`;
}

// ---------------------------------------------------------------- pages

const PAGES = {};

PAGES.overview = {
  html(d) {
    const s = d.series || [];
    const spark = (k) => s.slice(-30).map((r) => r[k]);
    const perDay = (n) => (isNum(n) && d.range_days ? fmtDec(n / d.range_days, n / d.range_days < 10 ? 1 : 0) : '—');
    return `
      <p class="group-label">Audience</p>
      <div class="tiles">
        ${tile('Total users', fmt(d.users_total), `<b>+${fmt(d.users_new)}</b> new in range`, { accent: true, spark: spark('new_users') })}
        ${tile('Active today', fmt(d.dau_today), 'Daily active users', { spark: spark('active_users') })}
        ${tile('Weekly active', fmt(d.wau), `<b>${pct(ratio(d.dau_today, d.wau))}</b> DAU / WAU`)}
        ${tile('Monthly active', fmt(d.mau), `<b>${pct(ratio(d.dau_today, d.mau))}</b> DAU / MAU`)}
      </div>
      <p class="group-label">Driving &amp; growth</p>
      <div class="tiles">
        ${tile('Drives', fmt(d.drives), `<b>${perDay(d.drives)}</b> a day`, { spark: spark('drives') })}
        ${tile('Distance', compact(d.distance_km), `<b>${fmtDec(d.drives ? d.distance_km / d.drives : null)}</b> km per drive`, { unit: 'km' })}
        ${tile('Invites shared', fmt(d.invites_shared))}
        ${tile('Referrals redeemed', fmt(d.referrals_redeemed), `<b>${pct(ratio(d.referrals_redeemed, d.invites_shared))}</b> of shared`)}
      </div>
      <p class="group-label">Revenue</p>
      <div class="tiles">
        ${tile('Active trials', fmt(d.active_trials), 'Free Pro right now')}
        ${tile('Paying (est.)', fmt(d.paying_estimate), 'Active subscriptions')}
        ${tile('Paywall views', fmt(d.paywall_views), `<b>${perDay(d.paywall_views)}</b> a day`, { spark: spark('paywall_views') })}
        ${tile('Purchases', fmt(d.purchases), `<b>${pct(d.conversion_pct)}</b> of paywall views`, { accent: true, spark: spark('purchases') })}
      </div>
      <p class="group-label">Health</p>
      <div class="tiles one-row" style="--cols:2">
        ${tile('Errors', fmt(d.errors), `<b>${perDay(d.errors)}</b> a day`, { spark: spark('errors') })}
        ${tile('Crashes', fmt(d.crashes), `<b>${perDay(d.crashes)}</b> a day`)}
      </div>
      ${card('Active and new users', `${chartBox('c-users', { label: 'Daily active and new users' })}${seriesTable(s, [
        { key: 'active_users', label: 'Active' }, { key: 'new_users', label: 'New' }, { key: 'drives', label: 'Drives' },
        { key: 'paywall_views', label: 'Paywall' }, { key: 'purchases', label: 'Purchases' }, { key: 'errors', label: 'Errors' },
      ])}`, { legend: [{ label: 'Active users', color: C.s1 }, { label: 'New users', color: C.s2 }] })}
      <div class="grid-2">
        ${card('Drives per day', chartBox('c-drives', { small: true, label: 'Drives per day' }))}
        ${card('Paywall views per day', chartBox('c-paywall', { small: true, label: 'Paywall views per day' }))}
        ${card('Purchases per day', chartBox('c-purch', { small: true, label: 'Purchases per day' }))}
        ${card('Errors per day', chartBox('c-errors', { small: true, label: 'Errors per day' }))}
      </div>`;
  },
  after(d) {
    const s = d.series || [];
    const labels = s.map((r) => r.day);
    const col = (k) => s.map((r) => r[k] ?? 0);
    makeChart('c-users', { type: 'line', labels, series: [{ label: 'Active users', data: col('active_users'), color: C.s1, fill: true }, { label: 'New users', data: col('new_users'), color: C.s2 }], format: intAxis });
    makeChart('c-drives', { labels, series: [{ label: 'Drives', data: col('drives'), color: C.s1 }], format: intAxis });
    makeChart('c-paywall', { labels, series: [{ label: 'Paywall views', data: col('paywall_views'), color: C.s1 }], format: intAxis });
    makeChart('c-purch', { labels, series: [{ label: 'Purchases', data: col('purchases'), color: C.s1 }], format: intAxis });
    makeChart('c-errors', { labels, series: [{ label: 'Errors', data: col('errors'), color: C.s3 }], format: intAxis });
  },
};

PAGES.usage = {
  html(d) {
    const screens = [...(d.screens || [])].sort((a, b) => (b.views || 0) - (a.views || 0));
    const features = [...(d.features || [])].sort((a, b) => (b.count || 0) - (a.count || 0));
    const platforms = [...(d.platforms || [])].sort((a, b) => (b.users || 0) - (a.users || 0));
    const versions = [...(d.versions || [])].sort(semverCmp);
    const maxV = Math.max(0, ...screens.map((r) => r.views || 0));
    const maxF = Math.max(0, ...features.map((r) => r.count || 0));
    const platTotal = sum(platforms, 'users');
    const verTotal = sum(versions, 'users');
    const top = screens[0];
    const screenTable = screens.length
      ? `<div class="table-wrap"><table><thead><tr><th>Screen</th><th>Views</th><th class="n">Users</th><th class="n">Per user</th></tr></thead><tbody>
        ${screens.map((r) => `<tr><td><strong>${esc(human(r.screen))}</strong><br><span class="code-name">${esc(r.screen)}</span></td><td>${barCell(r.views, maxV)}</td><td class="n">${fmt(r.users)}</td><td class="n">${fmtDec(r.avg_per_user)}</td></tr>`).join('')}
        </tbody></table></div>`
      : emptyInline('No screen views in this range.');
    const featureTable = features.length
      ? `<div class="table-wrap"><table><thead><tr><th>Event</th><th>Count</th><th class="n">Users</th></tr></thead><tbody>
        ${features.map((r) => `<tr><td><strong>${esc(human(r.name))}</strong><br><span class="code-name">${esc(r.name)}</span></td><td>${barCell(r.count, maxF)}</td><td class="n">${fmt(r.users)}</td></tr>`).join('')}
        </tbody></table></div>`
      : emptyInline('No feature events in this range.');
    const shareRows = (rows, key, total, lab) => (rows.length
      ? `<div class="table-wrap"><table><thead><tr><th>${lab}</th><th>Users</th><th class="n">Share</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td><strong>${esc(key === 'platform' ? human(r[key]) : r[key])}</strong></td><td>${barCell(r.users, Math.max(...rows.map((x) => x.users || 0)))}</td><td class="n">${pct(ratio(r.users, total))}</td></tr>`).join('')}
        </tbody></table></div>`
      : emptyInline());
    return `
      <div class="tiles">
        ${tile('Screen views', fmt(sum(screens, 'views')), `${fmt(screens.length)} screens`, { accent: true })}
        ${tile('Most viewed', top ? esc(human(top.screen)) : '—', top ? `<b>${fmt(top.views)}</b> views` : '')}
        ${tile('Feature events', fmt(sum(features, 'count')), `${fmt(features.length)} kinds`)}
        ${tile('Users on iOS', pct(ratio(platforms.find((p) => p.platform === 'ios')?.users, platTotal)), `of ${fmt(platTotal)} users`)}
      </div>
      <div class="grid-3-2">
        ${card('Screens', screenTable, { flush: true, hint: 'screen_view events' })}
        ${card('Features', featureTable, { flush: true, hint: 'by event name' })}
      </div>
      <div class="grid-2">
        ${card('Platforms', shareRows(platforms, 'platform', platTotal, 'Platform'), { flush: true })}
        ${card('App versions', shareRows(versions, 'app_version', verTotal, 'Version'), { flush: true, hint: 'users seen on each' })}
      </div>`;
  },
};

function funnelRows(steps, { topLabel = 'of first step' } = {}) {
  if (!steps.length) return emptyInline();
  const top = steps[0].users || 0;
  let worst = -1;
  let worstConv = Infinity;
  steps.forEach((s, i) => {
    if (!i) return;
    const c = ratio(s.users, steps[i - 1].users);
    if (c != null && c < worstConv) {
      worstConv = c;
      worst = i;
    }
  });
  return `<div class="funnel">${steps.map((s, i) => {
    const w = top ? Math.max(0.6, ((s.users || 0) / top) * 100) : 0;
    const inside = w >= 18;
    const prev = i ? steps[i - 1].users : null;
    const drop = i
      ? `<div class="f-drop${i === worst ? ' worst' : ''}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.5v9M2.5 7l3.5 3.5L9.5 7"/></svg><b>${pct(ratio(s.users, prev))}</b> continue · ${fmt((prev || 0) - (s.users || 0))} drop off${i === worst ? ' · biggest drop' : ''}</div>`
      : '';
    return `${drop}<div class="f-step">
      <div class="f-label">${esc(s.label || human(s.key))}${s.key ? `<small>${esc(s.key)}</small>` : ''}</div>
      <div class="f-track"><div class="f-fill" style="width:${w.toFixed(2)}%"></div><div class="f-in${inside ? '' : ' out'}" style="${inside ? '' : `left:calc(${w.toFixed(2)}% + 10px)`}">${fmt(s.users)}</div></div>
      <div class="f-pct"><b>${i ? pct(ratio(s.users, top)) : '100%'}</b><span>${esc(topLabel)}</span></div>
    </div>`;
  }).join('')}</div>`;
}

PAGES.funnel = {
  html(d) {
    const steps = d.steps || [];
    const by = Object.fromEntries(steps.map((s) => [s.key, s.users]));
    const first = steps[0]?.users;
    const last = steps[steps.length - 1]?.users;
    return `
      <div class="tiles">
        ${tile('Installs', fmt(by.installed ?? first), 'Distinct installs', { accent: true })}
        ${tile('Signed up', fmt(by.signed_up), `<b>${pct(ratio(by.signed_up, by.installed ?? first))}</b> of installs`)}
        ${tile('First drive', fmt(by.first_drive), `<b>${pct(ratio(by.first_drive, by.signed_up))}</b> of sign-ups`)}
        ${tile('Purchased', fmt(by.purchased ?? last), `<b>${pct(ratio(by.purchased ?? last, by.installed ?? first))}</b> of installs`)}
      </div>
      ${card('Install to purchase', funnelRows(steps, { topLabel: 'of installs' }), { hint: 'each person counted once per step' })}
      <p class="note">Installs are distinct install IDs that sent <span class="code-name">app_opened</span> in the range. Later steps count the same people reaching each step.</p>`;
  },
};

PAGES.purchases = {
  html(d) {
    const s = d.series || [];
    const plans = d.by_plan || [];
    const sources = [...(d.by_source || [])].sort((a, b) => (b.purchases || 0) - (a.purchases || 0));
    const recent = d.recent || [];
    const totalPurch = plans.length ? sum(plans, 'purchases') : sum(s, 'purchases');
    const maxConv = Math.max(0, ...sources.map((r) => r.conversion_pct || 0));
    const plansTable = plans.length
      ? `<div class="table-wrap"><table><thead><tr><th>Plan</th><th class="n">Purchases</th><th class="n">Revenue</th><th class="n">Share</th></tr></thead><tbody>
        ${plans.map((p) => `<tr><td><strong>${esc(human(p.plan))}</strong></td><td class="n">${fmt(p.purchases)}</td><td class="n">${usd(p.revenue_usd)}</td><td class="n">${pct(ratio(p.revenue_usd, d.revenue_usd))}</td></tr>`).join('')}
        </tbody></table></div>`
      : emptyInline('No purchases in this range.');
    const sourcesTable = sources.length
      ? `<div class="table-wrap"><table><thead><tr><th>Paywall opened from</th><th class="n">Paywall views</th><th class="n">Purchases</th><th>Conversion</th></tr></thead><tbody>
        ${sources.map((r) => `<tr><td><strong>${esc(human(r.source))}</strong><br><span class="code-name">${esc(r.source)}</span></td><td class="n">${fmt(r.paywall_views)}</td><td class="n">${fmt(r.purchases)}</td><td>${barCell(r.conversion_pct, maxConv, pct(r.conversion_pct))}</td></tr>`).join('')}
        </tbody></table></div>`
      : emptyInline('No paywall views in this range.');
    const typeBadge = (t) => {
      const u = String(t || '').toUpperCase();
      const cls = /CANCEL|EXPIR|REFUND|BILLING/.test(u) ? (u.includes('BILLING') ? 'warn' : 'bad') : /INITIAL|RENEW|UNCANCEL|NON_RENEWING/.test(u) ? 'good' : '';
      return `<span class="badge ${cls}">${esc(human(u.toLowerCase()))}</span>`;
    };
    const recentTable = recent.length
      ? `<div class="table-wrap"><table><thead><tr><th>When</th><th>Event</th><th>Product</th><th class="n">Price</th><th>Driver</th></tr></thead><tbody>
        ${recent.map((r) => `<tr${userRowAttrs(r.user_id)}><td title="${esc(dateTime(r.at))}">${rel(r.at)}</td><td>${typeBadge(r.type)}</td><td class="mono">${esc(r.product_id || '—')}</td><td class="n">${r.price_usd == null ? '—' : usd(r.price_usd)}</td><td>${r.user_id || r.username ? who(r.user_id, r.username, { sub: false }) : '—'}</td></tr>`).join('')}
        </tbody></table></div>`
      : emptyInline('No store events yet.');
    return `
      <div class="tiles" style="--cols:3">
        ${tile('Revenue', usd(d.revenue_usd, { whole: d.revenue_usd >= 1000 }), 'Production, before store fees', { accent: true, spark: s.slice(-30).map((r) => r.revenue_usd) })}
        ${tile('Purchases', fmt(totalPurch), `<b>${usd(totalPurch ? d.revenue_usd / totalPurch : null)}</b> per purchase`)}
        ${tile('Trials started', fmt(d.trials_started))}
        ${tile('Trial conversions', fmt(d.trial_conversions), `<b>${pct(ratio(d.trial_conversions, d.trials_started))}</b> of trials`)}
        ${tile('Cancellations', fmt(d.cancellations))}
        ${tile('Refunds', fmt(d.refunds))}
      </div>
      ${card('Revenue per day', `${chartBox('c-rev', { label: 'Revenue per day in US dollars' })}${seriesTable(s, [{ key: 'purchases', label: 'Purchases' }, { key: 'revenue_usd', label: 'Revenue', format: usd }])}`)}
      <div class="grid-2">
        ${card('Purchases per day', chartBox('c-pday', { small: true, label: 'Purchases per day' }))}
        ${card('By plan', plansTable, { flush: true })}
      </div>
      ${card('Why people buy', sourcesTable, { flush: true, hint: 'where the paywall was opened' })}
      ${card('Recent store events', recentTable, { flush: true, hint: 'RevenueCat, production' })}`;
  },
  after(d) {
    const s = d.series || [];
    const labels = s.map((r) => r.day);
    makeChart('c-rev', { labels, series: [{ label: 'Revenue', data: s.map((r) => r.revenue_usd ?? 0), color: C.s1 }], format: usdAxis });
    makeChart('c-pday', { labels, series: [{ label: 'Purchases', data: s.map((r) => r.purchases ?? 0), color: C.s1 }], format: intAxis });
  },
};

PAGES.invites = {
  html(d) {
    const s = d.series || [];
    const inviters = [...(d.top_inviters || [])].sort((a, b) => (b.joined || 0) - (a.joined || 0));
    const maxJ = Math.max(0, ...inviters.map((r) => r.joined || 0));
    const table = inviters.length
      ? `<div class="table-wrap"><table><thead><tr><th>Driver</th><th>Friends joined</th><th class="n">Drove</th><th class="n">Drove %</th></tr></thead><tbody>
        ${inviters.map((r) => `<tr${userRowAttrs(r.user_id)}><td>${who(r.user_id, r.username)}</td><td>${barCell(r.joined, maxJ)}</td><td class="n">${fmt(r.drove)}</td><td class="n">${pct(ratio(r.drove, r.joined))}</td></tr>`).join('')}
        </tbody></table></div>`
      : emptyInline('Nobody has joined with a code in this range.');
    const steps = [
      { key: 'codes_shared', label: 'Codes shared', users: d.codes_shared },
      { key: 'redeemed', label: 'Redeemed', users: d.redeemed },
      { key: 'friends_drove', label: 'Friend drove', users: d.friends_drove },
    ];
    return `
      <p class="group-label">Invites</p>
      <div class="tiles">
        ${tile('Codes shared', fmt(d.codes_shared), '', { accent: true, spark: s.slice(-30).map((r) => r.shared) })}
        ${tile('Redeemed', fmt(d.redeemed), `<b>${pct(ratio(d.redeemed, d.codes_shared))}</b> of shared`)}
        ${tile('Friends who drove', fmt(d.friends_drove), `<b>${pct(ratio(d.friends_drove, d.redeemed))}</b> of redeemed`)}
        ${tile('Rewards earned', fmt(d.rewards_earned), `<b>${fmt(isNum(d.rewards_earned) ? d.rewards_earned * 7 : null)}</b> days of Pro`)}
      </div>
      <p class="group-label">Friends &amp; clubs</p>
      <div class="tiles" style="--cols:3">
        ${tile('Friend requests', fmt(d.friend_requests))}
        ${tile('Friends added', fmt(d.friends_added))}
        ${tile('Clubs joined', fmt(d.clubs_joined))}
      </div>
      <div class="grid-3-2">
        ${card('Shared and redeemed', `${chartBox('c-ref', { label: 'Invites shared and redeemed per day' })}${seriesTable(s, [{ key: 'shared', label: 'Shared' }, { key: 'redeemed', label: 'Redeemed' }])}`, { legend: [{ label: 'Shared', color: C.s1 }, { label: 'Redeemed', color: C.s2 }] })}
        ${card('Invite funnel', funnelRows(steps, { topLabel: 'of shared' }))}
      </div>
      ${card('Top inviters', table, { flush: true, hint: 'click a driver for details' })}`;
  },
  after(d) {
    const s = d.series || [];
    makeChart('c-ref', { type: 'line', labels: s.map((r) => r.day), series: [{ label: 'Shared', data: s.map((r) => r.shared ?? 0), color: C.s1 }, { label: 'Redeemed', data: s.map((r) => r.redeemed ?? 0), color: C.s2 }], format: intAxis });
  },
};

PAGES.issues = {
  html(d) {
    const s = d.series || [];
    const top = [...(d.top || [])].sort((a, b) => (b.count || 0) - (a.count || 0));
    const list = top.length
      ? `<div class="issues">${top.map((r) => {
        const crash = r.kind === 'crash';
        const badge = crash
          ? '<span class="badge bad"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3L3 9"/></svg>Crash</span>'
          : '<span class="badge warn"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2.5v4.5M6 9.5v.01"/></svg>Error</span>';
        const versions = (r.versions || []).slice(0, 5).map((v) => `<span class="badge">${esc(v)}</span>`).join('');
        return `<details class="issue"><summary>
          <div class="i-top">${badge}<span class="i-tag">${esc(r.tag || '—')}</span></div>
          <div class="i-count"><b>${fmt(r.count)}</b><span>${fmt(r.users)} users</span></div>
          <div class="i-msg" title="${esc(r.message)}">${esc(r.message || '(no message)')}</div>
          <div class="i-meta"><span>Last ${rel(r.last_seen)}</span><span>First ${rel(r.first_seen)}</span>${versions ? `<span class="chips">${versions}</span>` : ''}</div>
        </summary>
        <div class="i-more"><span>Fingerprint <code>${esc(r.fingerprint || '—')}</code></span><span>First seen ${esc(dateTime(r.first_seen))} · last seen ${esc(dateTime(r.last_seen))}</span>${(r.versions || []).length > 5 ? `<span>Versions: ${esc(r.versions.join(', '))}</span>` : ''}</div>
        </details>`;
      }).join('')}</div>`
      : emptyInline('No errors or crashes in this range.');
    return `
      <div class="tiles">
        ${tile('Errors', fmt(d.errors), '', { spark: s.slice(-30).map((r) => r.errors) })}
        ${tile('Crashes', fmt(d.crashes), `<b>${pct(ratio(d.crashes, (d.errors || 0) + (d.crashes || 0)))}</b> of reports`)}
        ${tile('Affected users', fmt(d.affected_users), '', { accent: true })}
        ${tile('Distinct issues', fmt(top.length), 'Grouped by fingerprint')}
      </div>
      ${card('Errors and crashes per day', `${chartBox('c-iss', { label: 'Errors and crashes per day' })}${seriesTable(s, [{ key: 'errors', label: 'Errors' }, { key: 'crashes', label: 'Crashes' }])}`, { legend: [{ label: 'Errors', color: C.s3 }, { label: 'Crashes', color: C.s4 }] })}
      ${card('Top issues', list, { flush: true, hint: 'tap one for the fingerprint' })}`;
  },
  after(d) {
    const s = d.series || [];
    makeChart('c-iss', { labels: s.map((r) => r.day), stacked: true, series: [{ label: 'Errors', data: s.map((r) => r.errors ?? 0), color: C.s3 }, { label: 'Crashes', data: s.map((r) => r.crashes ?? 0), color: C.s4 }], format: intAxis });
  },
};

PAGES.versions = {
  html(d) {
    const rows = [...(d.versions || [])].sort(semverCmp);
    const total = sum(rows, 'users');
    const maxU = Math.max(0, ...rows.map((r) => r.users || 0));
    const latest = rows[0];
    const worst = [...rows].filter((r) => (r.users || 0) >= 20).sort((a, b) => (b.errors / b.users) - (a.errors / a.users))[0];
    const table = rows.length
      ? `<div class="table-wrap"><table><thead><tr><th>Version</th><th>Users</th><th class="n">Share</th><th class="n">Errors</th><th class="n">Crashes</th><th class="n" title="Errors per user">Err / user</th><th class="n" title="Crashes per 100 users">Crash / 100</th></tr></thead><tbody>
        ${rows.map((r, i) => `<tr><td><strong>${esc(r.app_version)}</strong> <span class="code-name">(${esc(r.build ?? '—')})</span>${i === 0 ? ' <span class="badge trial">Latest</span>' : ''}</td><td>${barCell(r.users, maxU)}</td><td class="n">${pct(ratio(r.users, total))}</td><td class="n">${fmt(r.errors)}</td><td class="n">${fmt(r.crashes)}</td><td class="n">${r.users ? fmtDec(r.errors / r.users, 2) : '—'}</td><td class="n">${r.users ? fmtDec((r.crashes / r.users) * 100, 1) : '—'}</td></tr>`).join('')}
        </tbody></table></div>`
      : emptyInline('No versions reported in this range.');
    return `
      <div class="tiles" style="--cols:3">
        ${tile('Latest version', latest ? esc(latest.app_version) : '—', latest ? `<b>${pct(ratio(latest.users, total))}</b> of users · build ${esc(latest.build ?? '—')}` : '', { accent: true })}
        ${tile('Versions in use', fmt(rows.length), `${fmt(total)} users seen`)}
        ${tile('Most errors per user', worst ? esc(worst.app_version) : '—', worst ? `<b>${fmtDec(worst.errors / worst.users, 2)}</b> errors per user` : '')}
      </div>
      ${card('Versions', table, { flush: true })}`;
  },
};

// D-166: group A (hard paywall, 7-day trial through the App Store) beside group
// B (a week of Pro with no card, then the Free plan). Money per new account is
// the headline: a group can sell more trials and still earn less.
const PAYWALL_GROUPS = [
  { variant: 'hard_trial', name: 'A', sub: 'Hard paywall, store trial' },
  { variant: 'free_week', name: 'B', sub: 'Free week, no card' },
];

// How sure a lead is, two-sided, from a z score: 0.5 is a coin toss, 0.95 the
// usual bar. Normal approximation (Abramowitz–Stegun erf), fine at the sample
// sizes the verdict waits for.
function confidenceOf(z) {
  if (!isNum(z)) return null;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return erf;
}

// Accounts per group before the panel calls a winner.
const PAYWALL_DECIDE_AT = 300;

// The verdict: who earns more per new account, how sure that is (Welch's test
// on money per account; a two-proportion test on paying accounts beside it),
// whether there are enough accounts to decide, and whether the leader pays
// for it in drivers who stop using the app.
function paywallVerdict(a, b) {
  const nA = a.accounts || 0;
  const nB = b.accounts || 0;
  if (!nA || !nB) return { state: 'waiting' };
  const stats = (g, n) => {
    const mean = (g.revenue_usd || 0) / n;
    const variance = n > 1 ? Math.max(0, ((g.revenue_sq_usd || 0) - n * mean * mean) / (n - 1)) : 0;
    return { mean, variance };
  };
  const sA = stats(a, nA);
  const sB = stats(b, nB);
  const lead = sA.mean === sB.mean ? null : sA.mean > sB.mean ? 'A' : 'B';
  const se = Math.sqrt(sA.variance / nA + sB.variance / nB);
  const moneySure = lead == null ? 0 : se > 0 ? confidenceOf((sA.mean - sB.mean) / se) : 1;
  const pA = (a.paying || 0) / nA;
  const pB = (b.paying || 0) / nB;
  const pooled = ((a.paying || 0) + (b.paying || 0)) / (nA + nB);
  const seP = Math.sqrt(pooled * (1 - pooled) * (1 / nA + 1 / nB));
  const payingSure = pA === pB ? 0 : seP > 0 ? confidenceOf((pA - pB) / seP) : 1;
  const [win, other, winStats, otherStats] = lead === 'A' ? [a, b, sA, sB] : [b, a, sB, sA];
  const lift = lead && otherStats.mean > 0 ? (winStats.mean - otherStats.mean) / otherStats.mean : null;
  const enough = Math.min(nA, nB) >= PAYWALL_DECIDE_AT;
  const sure = moneySure >= 0.95;
  const warnings = [];
  if (lead && isNum(win.retention_7d_pct) && isNum(other.retention_7d_pct) && win.retention_7d_pct + 10 <= other.retention_7d_pct) {
    warnings.push(`Fewer of group ${lead} are still using the app after a week (${pct(win.retention_7d_pct)} against ${pct(other.retention_7d_pct)}): more money, emptier boards and map.`);
  }
  if (lead && win.accounts && other.accounts && ratio(win.friends_joined, win.accounts) + 5 <= ratio(other.friends_joined, other.accounts)) {
    warnings.push(`Group ${lead} brings in fewer friends (${fmt(win.friends_joined)} against ${fmt(other.friends_joined)}).`);
  }
  return {
    state: !lead ? 'tied' : enough && sure ? 'winner' : sure ? 'clear-early' : 'unclear',
    lead, nA, nB, enough, lift, moneySure, payingSure,
    payingLead: pA === pB ? null : pA > pB ? 'A' : 'B',
    meanA: sA.mean, meanB: sB.mean, warnings,
  };
}

function paywallVerdictCard(v) {
  if (v.state === 'waiting') {
    return card('Who is winning', `<p class="verdict-line">Waiting for new accounts in both groups. They join once they sign up on app 1.0.35 or later.</p>`);
  }
  const sure = (c) => `<b>${c >= 0.995 ? 'over 99%' : pct(Math.round(c * 100))}</b> sure`;
  const money = `${usd(v.meanA)} (A) against ${usd(v.meanB)} (B) per new account`;
  const lift = isNum(v.lift) ? ` (${v.lift >= 0 ? '+' : ''}${pct(Math.round(v.lift * 100))})` : '';
  const headline = {
    winner: `<span class="verdict-badge win">Winner</span> <b>Group ${v.lead}</b> earns more: ${money}${lift}, ${sure(v.moneySure)}.`,
    'clear-early': `<span class="verdict-badge lead">Ahead</span> <b>Group ${v.lead}</b> earns more: ${money}${lift}, ${sure(v.moneySure)}. The gap is clear, but wait for ${fmt(PAYWALL_DECIDE_AT)} accounts in each group before deciding.`,
    unclear: `<span class="verdict-badge">No clear winner yet</span> Group ${v.lead} is ahead: ${money}${lift}, but only ${sure(v.moneySure)} — it could still be chance.`,
    tied: `<span class="verdict-badge">Level</span> Both groups earn the same per new account so far (${usd(v.meanA)}).`,
  }[v.state];
  const progress = (n) => Math.min(100, Math.round((n / PAYWALL_DECIDE_AT) * 100));
  const bars = [['A', v.nA], ['B', v.nB]].map(([g, n]) => `<div class="verdict-progress"><span>${g}</span><div class="bar"><i style="width:${progress(n)}%"></i></div><span class="cell-sub">${fmt(n)} / ${fmt(PAYWALL_DECIDE_AT)}</span></div>`).join('');
  const paying = v.payingLead
    ? `<p class="verdict-sub">Paying accounts: group ${v.payingLead} converts better, ${sure(v.payingSure)}.</p>`
    : '';
  const warn = v.warnings.map((w) => `<p class="verdict-warn">${esc(w)}</p>`).join('');
  return card('Who is winning', `<p class="verdict-line">${headline}</p>${paying}${warn}<div class="verdict-bars">${bars}</div>`, {
    hint: `Decided on money per new account. "Sure" is the chance the lead is real rather than luck; 95% is the usual bar.`,
  });
}

PAGES.paywall = {
  html(d) {
    const byVariant = Object.fromEntries((d.groups || []).map((g) => [g.variant, g]));
    const [a, b] = PAYWALL_GROUPS.map((g) => byVariant[g.variant] || {});
    const accounts = (a.accounts || 0) + (b.accounts || 0);
    const status = d.running
      ? `Running since <b>${esc(dayLabel(d.started_at))}</b> · ${pct((d.hard_trial_share ?? 0.5) * 100)} of new accounts get the hard paywall`
      : 'Not running: new accounts all get the free week';
    const perAccount = (g) => (isNum(g.revenue_per_account_usd) ? usd(g.revenue_per_account_usd) : '—');
    const verdict = paywallVerdict(a, b);
    const leader = isNum(a.revenue_per_account_usd) && isNum(b.revenue_per_account_usd) && a.accounts && b.accounts
      ? (a.revenue_per_account_usd === b.revenue_per_account_usd ? null : a.revenue_per_account_usd > b.revenue_per_account_usd ? 'A' : 'B')
      : null;

    // One row per figure; `better` says which way is good, so the leading
    // group's cell is marked.
    const rows = [
      ['New accounts', (g) => fmt(g.accounts), null],
      ['Money per new account', perAccount, (g) => g.revenue_per_account_usd, true],
      ['Revenue', (g) => usd(g.revenue_usd), (g) => g.revenue_usd],
      ['Paying accounts', (g) => `${fmt(g.paying)} <span class="cell-sub">${pct(g.conversion_pct)}</span>`, (g) => g.conversion_pct],
      ['Started a store trial', (g) => fmt(g.trials_started), (g) => ratio(g.trials_started, g.accounts)],
      ['Drove at least once', (g) => `${fmt(g.drove)} <span class="cell-sub">${pct(ratio(g.drove, g.accounts))}</span>`, (g) => ratio(g.drove, g.accounts)],
      ['Still using it after a week', (g) => (g.week_old ? `${pct(g.retention_7d_pct)} <span class="cell-sub">of ${fmt(g.week_old)}</span>` : '—'), (g) => g.retention_7d_pct],
      ['Paywall views per account', (g) => (g.accounts ? fmtDec(g.paywall_views / g.accounts, 1) : '—'), null],
      ['Friends who joined', (g) => fmt(g.friends_joined), (g) => ratio(g.friends_joined, g.accounts)],
    ];
    const mark = (pick, mine, other) => {
      if (!pick) return '';
      const x = pick(mine);
      const y = pick(other);
      return isNum(x) && isNum(y) && x > y && mine.accounts && other.accounts ? ' class="n lead"' : ' class="n"';
    };
    const table = accounts
      ? `<div class="table-wrap"><table class="ab"><thead><tr><th></th>${PAYWALL_GROUPS.map((g) => `<th class="n group-head">${esc(g.name)}<span class="th-sub">${esc(g.sub)}</span></th>`).join('')}</tr></thead><tbody>
        ${rows.map(([label, show, pick, headline]) => `<tr${headline ? ' class="headline"' : ''}><td>${esc(label)}</td><td${mark(pick, a, b) || ' class="n"'}>${show(a)}</td><td${mark(pick, b, a) || ' class="n"'}>${show(b)}</td></tr>`).join('')}
        </tbody></table></div>`
      : emptyInline(d.running ? 'No new accounts have joined the test in this range yet.' : 'The test has not started. New accounts join once it runs and they use app 1.0.35 or later.');

    return `
      <div class="tiles" style="--cols:3">
        ${tile('Test', d.running ? 'Running' : 'Off', status, { accent: !!d.running })}
        ${tile('New accounts in the test', fmt(accounts), `A <b>${fmt(a.accounts)}</b> · B <b>${fmt(b.accounts)}</b>`)}
        ${tile('Winning on money per account', verdict.state === 'winner' ? `Group ${verdict.lead}` : leader ? `Group ${leader}?` : '—', verdict.state === 'winner' ? `A ${perAccount(a)} · B ${perAccount(b)}` : leader ? `Not decided yet · A ${perAccount(a)} · B ${perAccount(b)}` : 'Needs accounts in both groups', { accent: verdict.state === 'winner' })}
      </div>
      ${paywallVerdictCard(verdict)}
      ${card('Side by side', table, { flush: true, hint: 'Store money and trials are real App Store purchases only (no sandbox). Green marks the better group on each line.' })}`;
  },
};

// What each auto_start_status means to the owner, in the order a phone moves
// through them. `missing` names the permission a waiting phone still needs.
const AUTO_STATUS = [
  { key: 'monitoring', label: 'Working', sub: 'Watching for drives', color: C.s1 },
  { key: 'passenger_paused', label: 'Paused', sub: 'Passenger mode on', color: C.s4 },
  { key: 'permission_denied', label: 'Waiting for a permission', sub: 'Switched on, but the phone has not allowed it', color: C.s3 },
  { key: 'disabled', label: 'Switched off', sub: 'Turned off in the app', color: C.axis },
  { key: 'unavailable', label: 'Not possible', sub: 'The device cannot detect driving', color: C.tick },
  { key: 'failed', label: 'Failed to start', sub: 'Detection could not be started', color: C.tick },
];
const AUTO_MISSING = {
  location_always: 'Location set to "Always"',
  location: 'Location access',
  precise_location: 'Precise Location',
  motion: 'Motion & Fitness',
  unknown: 'Not reported',
};

PAGES.autodrive = {
  html(d) {
    const status = d.status || {};
    const reported = d.reported_accounts || 0;
    const working = status.monitoring || 0;
    const waiting = status.permission_denied || 0;
    const drives = (d.drives_auto || 0) + (d.drives_manual || 0);
    const statusRows = AUTO_STATUS.filter((s) => status[s.key]);
    const others = Object.keys(status).filter((k) => !AUTO_STATUS.some((s) => s.key === k));
    const maxS = Math.max(0, ...Object.values(status));
    const statusTable = reported
      ? `<div class="table-wrap"><table><thead><tr><th>State</th><th>Accounts</th><th class="n">Share</th></tr></thead><tbody>
        ${statusRows.map((s) => `<tr><td><strong>${esc(s.label)}</strong><br><span class="cell-sub">${esc(s.sub)}</span></td><td>${barCell(status[s.key], maxS, fmt(status[s.key]), s.color)}</td><td class="n">${pct(ratio(status[s.key], reported))}</td></tr>`).join('')}
        ${others.map((k) => `<tr><td><strong>${esc(human(k))}</strong></td><td>${barCell(status[k], maxS)}</td><td class="n">${pct(ratio(status[k], reported))}</td></tr>`).join('')}
        </tbody></table></div>`
      : emptyInline('No phone has reported yet. Phones report from app 1.0.36.');
    const missing = Object.entries(d.missing || {}).sort((a, b) => b[1] - a[1]);
    const maxM = Math.max(0, ...missing.map(([, n]) => n));
    const missingTable = missing.length
      ? `<div class="table-wrap"><table><thead><tr><th>Still needs</th><th>Accounts</th></tr></thead><tbody>
        ${missing.map(([k, n]) => `<tr><td><strong>${esc(AUTO_MISSING[k] || human(k))}</strong></td><td>${barCell(n, maxM, fmt(n), C.s3)}</td></tr>`).join('')}
        </tbody></table></div>`
      : emptyInline(reported ? 'Nobody is waiting for a permission.' : 'Shown once phones on 1.0.36 report.');
    return `
      <div class="tiles">
        ${tile('Auto-started drives', pct(ratio(d.drives_auto, drives)), `<b>${fmt(d.drives_auto)}</b> of ${fmt(drives)} drives`, { accent: true })}
        ${tile('Drivers it works for', fmt(d.auto_drivers), `of ${fmt(d.drivers)} drivers · <b>${fmt(d.manual_only_drivers)}</b> by hand only`)}
        ${tile('Working on phones', reported ? pct(ratio(working, reported)) : '—', reported ? `<b>${fmt(working)}</b> of ${fmt(reported)} phones on 1.0.36+` : 'From app 1.0.36')}
        ${tile('Waiting for permission', reported ? fmt(waiting) : '—', reported ? 'switched on, but not allowed yet' : 'From app 1.0.36')}
      </div>
      ${card('Drives per day, by how they started', chartBox('c-auto', { label: 'Auto-started and manual drives per day' }), { legend: [{ label: 'Started by itself', color: C.s1 }, { label: 'Started by hand', color: C.s2 }], hint: 'drive_started events, every app version' })}
      <div class="grid-2">
        ${card('Auto-drive on each phone', statusTable, { flush: true, hint: 'latest report per account' })}
        ${card('What the waiting phones still need', missingTable, { flush: true, hint: 'iPhone asks for these in Settings → Trip360' })}
      </div>`;
  },
  after(d) {
    const s = d.daily || [];
    makeChart('c-auto', {
      labels: s.map((r) => r.day),
      stacked: true,
      series: [
        { label: 'Started by itself', data: s.map((r) => r.auto ?? 0), color: C.s1 },
        { label: 'Started by hand', data: s.map((r) => r.manual ?? 0), color: C.s2 },
      ],
      format: intAxis,
    });
  },
};

// ---------------------------------------------------------------- users page

function renderUsers() {
  const q = new URLSearchParams(window.location.hash.split('?')[1] || '').get('q') || '';
  el.view.innerHTML = `
    <section class="card"><div class="card-body">
      <form class="search" id="user-search" role="search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L16 16"/></svg>
        <input id="user-q" type="search" placeholder="Username or user id" value="${esc(q)}" autocomplete="off" spellcheck="false" autocapitalize="off" aria-label="Search users">
        <button class="btn btn-lime" type="submit">Search</button>
      </form>
      <p class="note" style="margin:10px 0 0">Matches the start of a username, or a full user id.</p>
    </div></section>
    <div id="user-results"></div>`;
  const input = $('#user-q');
  $('#user-search').addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(state.searchTimer);
    searchUsers(input.value);
  });
  input.addEventListener('input', () => {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(() => searchUsers(input.value), 320);
  });
  searchUsers(q, { initial: true });
  if (window.matchMedia('(pointer: fine)').matches) input.focus();
}

async function searchUsers(raw, { initial = false } = {}) {
  const q = raw.trim();
  const box = $('#user-results');
  if (!box) return;
  // keep the query in the URL without re-rendering the page
  const base = `#/users${q ? `?q=${encodeURIComponent(q)}` : ''}`;
  const user = state.userId ? `${q ? '&' : '?'}user=${encodeURIComponent(state.userId)}` : '';
  if (window.location.hash !== base + user) history.replaceState(null, '', base + user);
  state.ctrl?.abort();
  const ctrl = new AbortController();
  state.ctrl = ctrl;
  box.innerHTML = '<div class="skel card-sk"></div>';
  try {
    const d = await api(`users?q=${encodeURIComponent(q)}`, ctrl.signal);
    if (ctrl.signal.aborted) return;
    const users = d.users || [];
    if (!users.length) {
      box.innerHTML = card('Results', stateBlock('empty', q ? 'No drivers found' : 'Search for a driver', q ? `Nothing matches “${esc(q)}”. Usernames match from the start.` : 'Type a username or paste a user id.'));
      return;
    }
    box.innerHTML = card(q ? `Results for “${q}”` : 'Newest sign-ups', `<div class="table-wrap"><table><thead><tr><th>Driver</th><th>Country</th><th>Plan</th><th class="n">Drives</th><th>Joined</th><th>Last seen</th></tr></thead><tbody>
      ${users.map((u) => `<tr${userRowAttrs(u.user_id)}><td>${who(u.user_id, u.username)}</td><td>${flag(u.country_code)} ${esc(u.country_code || '—')}</td><td>${planBadge(u.plan, u.trial_until)}</td><td class="n">${fmt(u.drives)}</td><td title="${esc(dateTime(u.created_at))}">${esc(dayLabel(u.created_at))}</td><td title="${esc(dateTime(u.last_seen))}">${rel(u.last_seen)}</td></tr>`).join('')}
      </tbody></table></div>`, { flush: true, hint: `${fmt(users.length)} shown` });
  } catch (err) {
    if (err.name === 'AbortError') return;
    if (initial && !q && err.status !== 401 && !err.config) {
      box.innerHTML = card('Results', stateBlock('empty', 'Search for a driver', 'Type a username or paste a user id.'));
      return;
    }
    showError(err, box, () => searchUsers(raw));
  }
}

// ---------------------------------------------------------------- creators page (D-175)

// Where creators sign in. They see Clipper Studio there and nothing else: no
// numbers, and never this panel or its key.
const STUDIO_URL = 'https://trip360.site/studio';

const CREATOR_ERRORS = {
  bad_email: 'That email does not look right.',
  bad_name: 'Keep the name under 80 characters.',
  email_taken: 'That email already has a Trip360 login. Use another email for the studio.',
  not_found: 'That creator is no longer there. Refresh the list.',
  not_configured: 'The admin API is missing a setting. See the deploy notes.',
};

function creatorError(err) {
  return CREATOR_ERRORS[err.message] || `Could not save (${err.status || 'no connection'}). Try again.`;
}

function renderCreators() {
  el.view.innerHTML = `
    ${card('Add a creator', `<form class="creator-add" id="creator-add" novalidate>
        <label class="field"><span>Name</span><input id="creator-name" type="text" maxlength="80" autocomplete="off" placeholder="Ayesha · TikTok"></label>
        <label class="field"><span>Email</span><input id="creator-email" type="email" maxlength="200" autocomplete="off" spellcheck="false" autocapitalize="off" required></label>
        <button class="btn btn-lime" id="creator-submit" type="submit">Create login</button>
      </form>
      <p class="gate-error" id="creator-error" role="alert" hidden></p>
      <p class="note">Each creator gets their own email and password and signs in at <a href="${STUDIO_URL}" target="_blank" rel="noopener noreferrer">trip360.site/studio</a>. They see only Clipper Studio, never this panel or any numbers. The password is made for you and shown once.</p>`)}
    <div id="creator-login"></div>
    <div id="creator-list"><div class="skel card-sk"></div></div>`;

  const form = $('#creator-add');
  const submit = $('#creator-submit');
  const errBox = $('#creator-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#creator-name').value.trim();
    const email = $('#creator-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errBox.textContent = 'Enter the creator’s email.';
      errBox.hidden = false;
      return;
    }
    submit.disabled = true;
    errBox.hidden = true;
    try {
      const d = await api('creators', undefined, { method: 'POST', body: { name, email } });
      form.reset();
      showCreatorLogin(d.creator, d.password);
      loadCreators();
    } catch (err) {
      if (err.status === 401 && !err.config) {
        showError(err, el.view, () => renderView());
        return;
      }
      errBox.textContent = creatorError(err);
      errBox.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
  loadCreators();
}

function showCreatorLogin(creator, password, { reset = false } = {}) {
  const box = $('#creator-login');
  if (!box || !creator || !password) return;
  const name = creator.name || 'there';
  const message = `Hi ${name}, here is your Trip360 Clipper Studio login.\n\n${STUDIO_URL}\nEmail: ${creator.email}\nPassword: ${password}\n\nPlease keep it to yourself.`;
  box.innerHTML = card(reset ? 'New password' : 'Login created', `
    <dl class="kv"><dt>Sign in at</dt><dd>${esc(STUDIO_URL)}</dd><dt>Email</dt><dd>${esc(creator.email)}</dd><dt>Password</dt><dd class="mono">${esc(password)}</dd></dl>
    <p class="note">The password is shown only now. Copy the message and send it to ${esc(creator.name || 'the creator')}. If it gets lost, make a new password.</p>
    <div class="row-actions">
      <button class="btn btn-lime btn-sm" id="copy-login" type="button">Copy message</button>
      <button class="btn btn-ghost btn-sm" id="hide-login" type="button">Done</button>
    </div>`);
  $('#copy-login').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast('Copied. Paste it into WhatsApp or email.');
    } catch {
      toast('Copy did not work. Select the details by hand.');
    }
  });
  $('#hide-login').addEventListener('click', () => { box.innerHTML = ''; });
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function loadCreators() {
  const box = $('#creator-list');
  if (!box) return;
  state.ctrl?.abort();
  const ctrl = new AbortController();
  state.ctrl = ctrl;
  try {
    const d = await api('creators', ctrl.signal);
    if (ctrl.signal.aborted) return;
    const list = d.creators || [];
    if (!list.length) {
      box.innerHTML = card('Creators', stateBlock('empty', 'No creators yet', 'Add one above. Each creator gets their own email and password.'));
      return;
    }
    box.innerHTML = card('Creators', `<div class="table-wrap"><table><thead><tr><th>Creator</th><th>Added</th><th>Last in the studio</th><th>Status</th><th class="n">Actions</th></tr></thead><tbody>
      ${list.map((c) => `<tr>
        <td><span class="who"><span class="avatar" aria-hidden="true">${initials(c.name || c.email)}</span><span><span class="name">${esc(c.name || c.email)}</span><br><span class="id">${esc(c.email)}</span></span></span></td>
        <td title="${esc(dateTime(c.created_at))}">${esc(dayLabel(c.created_at))}</td>
        <td title="${esc(dateTime(c.last_seen_at))}">${c.last_seen_at ? rel(c.last_seen_at) : 'Not yet'}</td>
        <td>${c.disabled_at ? '<span class="badge warn">Switched off</span>' : '<span class="badge good">Active</span>'}</td>
        <td class="n"><div class="row-actions end">
          <button class="btn btn-ghost btn-sm" type="button" data-act="password" data-id="${esc(c.user_id)}">New password</button>
          <button class="btn btn-ghost btn-sm" type="button" data-act="${c.disabled_at ? 'enable' : 'disable'}" data-id="${esc(c.user_id)}">${c.disabled_at ? 'Switch on' : 'Switch off'}</button>
        </div></td>
      </tr>`).join('')}
      </tbody></table></div>`, { flush: true, hint: `${fmt(list.length)} creator${list.length === 1 ? '' : 's'}` });
    box.querySelectorAll('button[data-act]').forEach((b) => {
      b.addEventListener('click', () => creatorAction(b, list.find((c) => c.user_id === b.dataset.id)));
    });
  } catch (err) {
    if (err.name === 'AbortError') return;
    showError(err, box, () => loadCreators());
  }
}

async function creatorAction(button, creator) {
  if (!creator) return;
  const act = button.dataset.act;
  const name = creator.name || creator.email;
  const ask = {
    password: `Make a new password for ${name}? Their old password stops working.`,
    disable: `Switch off ${name}? They are signed out of the studio and cannot sign in until you switch them on again.`,
  }[act];
  if (ask && !window.confirm(ask)) return;
  button.disabled = true;
  try {
    const d = await api(`creators/${encodeURIComponent(creator.user_id)}/${act}`, undefined, { method: 'POST', body: {} });
    if (act === 'password') showCreatorLogin(d.creator || creator, d.password, { reset: true });
    else toast(act === 'disable' ? `${name} is switched off.` : `${name} is switched on.`);
    loadCreators();
  } catch (err) {
    if (err.status === 401 && !err.config) {
      showError(err, el.view, () => renderView());
      return;
    }
    toast(creatorError(err));
    button.disabled = false;
  }
}

// ---------------------------------------------------------------- drawer

async function openDrawer(id) {
  if (!el.drawer.hidden && state.drawerOpenFor === id) return;
  state.drawerOpenFor = id;
  if (el.drawer.hidden) state.lastFocus = document.activeElement;
  el.drawer.hidden = false;
  el.drawerScrim.hidden = false;
  document.body.classList.add('no-scroll');
  el.drawerId.innerHTML = `<span class="avatar">…</span><div><h2 id="drawer-title">Loading…</h2><div class="id-line">${esc(id)}</div></div>`;
  el.drawerBody.innerHTML = '<div class="tiles"><div class="skel tile-sk"></div><div class="skel tile-sk"></div><div class="skel tile-sk"></div></div><div class="skel card-sk"></div>';
  el.drawerClose.focus();
  state.drawerCtrl?.abort();
  const ctrl = new AbortController();
  state.drawerCtrl = ctrl;
  try {
    const d = await api(`user/${encodeURIComponent(id)}`, ctrl.signal);
    if (ctrl.signal.aborted) return;
    renderDrawer(d, id);
  } catch (err) {
    if (err.name === 'AbortError') return;
    el.drawerId.innerHTML = `<span class="avatar">?</span><div><h2 id="drawer-title">Driver</h2><div class="id-line">${esc(id)}</div></div>`;
    showError(err, el.drawerBody, () => {
      state.drawerOpenFor = null;
      openDrawer(id);
    });
  }
}

function kvValue(key, v) {
  if (v == null || v === '') return '<span class="note">—</span>';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return /usd|price|revenue/.test(key) ? usd(v) : /km/.test(key) ? `${fmtDec(v)} km` : fmt(v);
  if (typeof v === 'object') return `<code class="mono">${esc(JSON.stringify(v))}</code>`;
  const s = String(v);
  if (/(_at|_until|_seen|^at)$/.test(key) && parseDate(s)) {
    const r = rel(s);
    return `${esc(dateTime(s))}${/ago|^in /.test(r) ? ` <span class="note">· ${esc(r)}</span>` : ''}`;
  }
  if (key === 'country_code') return `${flag(s)} ${esc(s)}`;
  if (/(_id|code)$/.test(key)) return `<span class="mono">${esc(s)}</span>`;
  return esc(s);
}

function kvList(obj, skip = []) {
  const entries = Object.entries(obj || {}).filter(([k]) => !skip.includes(k));
  if (!entries.length) return emptyInline('Nothing recorded.');
  return `<dl class="kv">${entries.map(([k, v]) => `<dt>${esc(human(k))}</dt><dd>${kvValue(k, v)}</dd>`).join('')}</dl>`;
}

function renderDrawer(d, id) {
  const p = d.profile || {};
  const name = p.username || 'Driver';
  const uid = p.user_id || id;
  el.drawerId.innerHTML = `<span class="avatar" aria-hidden="true">${initials(name)}</span>
    <div style="min-width:0"><h2 id="drawer-title">${esc(name)}</h2>
    <div class="id-line"><span>${esc(uid)}</span><button type="button" data-copy="${esc(uid)}">Copy</button></div></div>`;
  const ent = d.entitlement;
  let entHtml;
  if (ent == null || ent === false) entHtml = `<p class="note">No active entitlement: free plan.</p>`;
  else if (typeof ent === 'string' || typeof ent === 'boolean') entHtml = `<p>${planBadge(String(ent), d.entitlement_expires_at)}</p>`;
  else entHtml = kvList(ent);
  const purchases = Array.isArray(d.purchases) ? d.purchases : [];
  const purchHtml = purchases.length
    ? `<div class="card"><div class="table-wrap"><table><thead><tr><th>When</th><th>Event</th><th>Product</th><th class="n">Price</th></tr></thead><tbody>
      ${purchases.map((r) => `<tr><td title="${esc(dateTime(r.at || r.occurred_at))}">${esc(dayLabel(r.at || r.occurred_at))}</td><td>${esc(human(String(r.type || '').toLowerCase()))}${r.period_type ? ` <span class="note">${esc(String(r.period_type).toLowerCase())}</span>` : ''}</td><td class="mono">${esc(r.product_id || '—')}</td><td class="n">${r.price_usd == null ? '—' : usd(r.price_usd)}</td></tr>`).join('')}
      </tbody></table></div></div>`
    : '<p class="note">No purchases.</p>';
  const events = Array.isArray(d.recent_events) ? d.recent_events : [];
  const evHtml = events.length
    ? `<ol class="timeline">${events.map((e) => `<li><time datetime="${esc(e.at)}" title="${esc(dateTime(e.at))}">${esc(rel(e.at))}</time><span class="ev">${esc(e.name)}</span><span class="sc">${esc(e.screen || '')}</span></li>`).join('')}</ol>`
    : '<p class="note">No events yet (or this driver turned off usage data).</p>';
  const ref = d.referrals;
  el.drawerBody.innerHTML = `
    <div class="tiles">
      ${tile('Drives', fmt(d.drives))}
      ${tile('Distance', isNum(d.distance_km) ? compact(d.distance_km) : '—', '', { unit: isNum(d.distance_km) ? 'km' : '' })}
      ${tile('Last seen', esc(rel(d.last_seen)))}
    </div>
    <section><h3>Entitlement</h3>${entHtml}</section>
    <section><h3>Profile</h3>${kvList(p, ['username', 'user_id'])}</section>
    <section><h3>Purchases</h3>${purchHtml}</section>
    <section><h3>Invites</h3>${ref && typeof ref === 'object' ? kvList(ref) : '<p class="note">No invite activity.</p>'}</section>
    <section><h3>Recent events <span class="note">(${fmt(events.length)})</span></h3>${evHtml}</section>`;
}

function closeDrawer() {
  state.drawerCtrl?.abort();
  state.drawerOpenFor = null;
  el.drawer.hidden = true;
  el.drawerScrim.hidden = true;
  if (el.sidebar.classList.contains('open') === false) document.body.classList.remove('no-scroll');
  if (state.lastFocus && document.contains(state.lastFocus)) state.lastFocus.focus();
}

function requestCloseDrawer() {
  const [path, qs] = window.location.hash.split('?');
  const q = new URLSearchParams(qs || '');
  q.delete('user');
  const rest = q.toString();
  window.location.hash = `${path || '#/overview'}${rest ? `?${rest}` : ''}`;
}

// ---------------------------------------------------------------- errors

function showError(err, container, retry) {
  if (err.status === 401 && !err.config) {
    signOut({ message: 'That key was not accepted. Sign in again.' });
    return;
  }
  let title = 'Something went wrong';
  let text = esc(err.message || 'Unknown error');
  if (err.config) {
    title = 'Publishable key rejected';
  } else if (err.status === 0) {
    title = 'Can’t reach the admin API';
    text = 'Check your connection. If it keeps happening, the <span class="code-name">admin</span> function may not be deployed yet, or its CORS settings may not allow the <span class="code-name">x-admin-key</span> header.';
  } else if (err.status === 404) {
    title = 'Not found (404)';
    text = `${esc(err.message)}. If every page says this, the <span class="code-name">admin</span> function is not deployed yet.`;
  } else if (err.status >= 500) {
    title = `The admin API failed (${err.status})`;
  } else if (err.status === 422 || err.status === 400) {
    title = `The API refused the request (${err.status})`;
  }
  const id = `retry-${Math.random().toString(36).slice(2, 8)}`;
  container.innerHTML = `<section class="card">${stateBlock('error', title, text, `<button class="btn btn-lime btn-sm" id="${id}" type="button">Try again</button>${state.demo ? '' : '<a class="btn btn-ghost btn-sm" href="?demo=1">View sample data</a>'}`)}</section>`;
  $(`#${id}`)?.addEventListener('click', retry);
}

// ---------------------------------------------------------------- routing & render

function parseHash() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const id = (path || 'overview').split('/')[0];
  const section = SECTIONS.some((s) => s.id === id) ? id : 'overview';
  const q = new URLSearchParams(qs || '');
  return { section, user: q.get('user') };
}

function renderChrome() {
  const sec = SECTIONS.find((s) => s.id === state.section);
  el.sideNav.querySelectorAll('a').forEach((a) => {
    if (a.dataset.section === state.section) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  el.title.textContent = sec.label;
  el.sub.textContent = `${sec.sub}${sec.api ? ` · ${rangeInfo().long}` : ''}${state.demo ? ' · sample data' : ''}`;
  el.range.classList.toggle('is-disabled', !sec.api);
  el.range.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.days) === state.days)));
  document.title = `${sec.label} · Trip360 Admin`;
}

async function renderView() {
  const sec = SECTIONS.find((s) => s.id === state.section);
  renderChrome();
  destroyCharts();
  state.ctrl?.abort();
  if (!sec.api) {
    // A stats page still loading when this one opened leaves no one to stop
    // the refresh spinner: its own finally sees a newer controller.
    el.refresh.classList.remove('spin');
    if (sec.id === 'creators') renderCreators();
    else renderUsers();
    return;
  }
  const ctrl = new AbortController();
  state.ctrl = ctrl;
  el.view.innerHTML = skeleton(sec.id);
  el.refresh.classList.add('spin');
  try {
    const data = await api(`${sec.api}?days=${state.days}`, ctrl.signal);
    if (ctrl.signal.aborted) return;
    const page = PAGES[sec.id];
    el.view.innerHTML = page.html(data);
    page.after?.(data);
  } catch (err) {
    if (err.name === 'AbortError') return;
    showError(err, el.view, () => renderView());
  } finally {
    if (state.ctrl === ctrl) el.refresh.classList.remove('spin');
  }
}

function onRoute() {
  const { section, user } = parseHash();
  const changed = section !== state.section || !state.rendered;
  state.section = section;
  state.userId = user;
  if (changed) {
    state.rendered = true;
    renderView();
    el.view.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  if (user) openDrawer(user);
  else if (!el.drawer.hidden) closeDrawer();
}

function go(section) {
  window.location.hash = `#/${section}`;
}

function openUser(id) {
  const [path, qs] = window.location.hash.split('?');
  const q = new URLSearchParams(qs || '');
  q.set('user', id);
  window.location.hash = `${path || `#/${state.section}`}?${q.toString()}`;
}

// ---------------------------------------------------------------- shell, gate

function buildChrome() {
  el.sideNav.innerHTML = SECTIONS.map((s) => `<a href="#/${s.id}" data-section="${s.id}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON[s.id]}</svg>${esc(s.label)}</a>`).join('');
  el.range.innerHTML = RANGES.map((r) => `<button type="button" data-days="${r.days}" aria-pressed="false" title="${esc(r.long)}">${r.label}</button>`).join('');
}

function toggleNav(open) {
  el.sidebar.classList.toggle('open', open);
  el.scrim.hidden = !open;
  el.navOpen.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('no-scroll', open || !el.drawer.hidden);
  if (open) el.sideNav.querySelector('a[aria-current]')?.focus();
}

function showShell() {
  el.boot.hidden = true;
  el.gate.hidden = true;
  el.shell.hidden = false;
  el.demoPill.hidden = !state.demo;
  el.signOut.lastChild.textContent = state.demo ? ' Leave demo' : ' Sign out';
  state.rendered = false;
  if (!window.location.hash) history.replaceState(null, '', '#/overview');
  onRoute();
}

function showGate(message = '') {
  el.boot.hidden = true;
  el.shell.hidden = true;
  el.gate.hidden = false;
  closeDrawer();
  el.gateError.hidden = !message;
  el.gateError.textContent = message;
  el.gateSubmit.disabled = false;
  el.gateSubmit.textContent = 'Sign in';
  el.gateKey.value = '';
  el.gateKey.focus();
  document.title = 'Sign in · Trip360 Admin';
}

function signOut({ message = '' } = {}) {
  state.ctrl?.abort();
  destroyCharts();
  store(STORE_KEY, null);
  state.key = null;
  if (state.demo) {
    window.location.href = window.location.pathname;
    return;
  }
  showGate(message);
}

async function onGateSubmit(e) {
  e.preventDefault();
  const key = el.gateKey.value.trim();
  if (!key) {
    el.gateError.hidden = false;
    el.gateError.textContent = 'Enter the admin key.';
    el.gateKey.focus();
    return;
  }
  el.gateSubmit.disabled = true;
  el.gateSubmit.textContent = 'Checking…';
  el.gateError.hidden = true;
  state.key = key;
  try {
    await api('overview?days=1');
    store(STORE_KEY, key);
    el.gateKey.value = '';
    showShell();
  } catch (err) {
    state.key = null;
    el.gateSubmit.disabled = false;
    el.gateSubmit.textContent = 'Sign in';
    el.gateError.hidden = false;
    el.gateError.textContent = err.status === 401 && !err.config
      ? 'That key was not accepted.'
      : err.status === 0
        ? 'Could not reach the admin API. Check your connection, or that the admin function is deployed.'
        : err.message || 'Sign-in failed.';
    el.gateKey.select();
  }
}

function toast(text) {
  el.toast.textContent = text;
  el.toast.hidden = false;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => { el.toast.hidden = true; }, 1800);
}

function bindEvents() {
  el.gateForm.addEventListener('submit', onGateSubmit);
  el.signOut.addEventListener('click', () => signOut());
  el.refresh.addEventListener('click', () => {
    if (state.section === 'users') searchUsers($('#user-q')?.value || '');
    else if (state.section === 'creators') loadCreators();
    else renderView();
  });
  el.range.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-days]');
    if (!b) return;
    const days = Number(b.dataset.days);
    if (days === state.days) return;
    state.days = days;
    store(STORE_DAYS, String(days));
    renderView();
  });
  el.navOpen.addEventListener('click', () => toggleNav(true));
  el.navClose.addEventListener('click', () => toggleNav(false));
  el.scrim.addEventListener('click', () => toggleNav(false));
  el.sideNav.addEventListener('click', (e) => {
    if (e.target.closest('a')) toggleNav(false);
  });
  el.drawerClose.addEventListener('click', requestCloseDrawer);
  el.drawerScrim.addEventListener('click', requestCloseDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!el.drawer.hidden) requestCloseDrawer();
      else if (el.sidebar.classList.contains('open')) toggleNav(false);
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('tr[data-user]')) {
      e.preventDefault();
      openUser(e.target.dataset.user);
    }
  });
  document.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-user]');
    if (row && !e.target.closest('a, button')) {
      openUser(row.dataset.user);
      return;
    }
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      try {
        await navigator.clipboard.writeText(copy.dataset.copy);
        toast('User id copied');
      } catch {
        toast('Could not copy');
      }
    }
  });
  window.addEventListener('hashchange', () => {
    if (!el.shell.hidden) onRoute();
  });
}

// ---------------------------------------------------------------- boot

function boot() {
  buildChrome();
  bindEvents();
  setupCharts();
  const savedDays = Number(load(STORE_DAYS));
  if (RANGES.some((r) => r.days === savedDays)) state.days = savedDays;
  if (state.demo) {
    showShell();
    return;
  }
  state.key = load(STORE_KEY);
  if (state.key) showShell();
  else showGate();
}

boot();
