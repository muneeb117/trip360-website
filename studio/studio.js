// Trip360 Clipper Studio (trip360.site/studio). Plain script, no build step.
// Loaded by auth.js only after a signed-in creator account is confirmed.
// Templates live in TEMPLATES: each has fields (the form) and draw() (canvas).
(() => {
'use strict';

/* ---------- constants ---------- */
const FONT_NUM = '"Barlow Condensed", "Arial Narrow", sans-serif';
const FONT_UI = '"Archivo", Arial, sans-serif';
const FONT_TAG = '"Outfit", "Archivo", Arial, sans-serif';
const FONT_POP = '"Poppins", "Archivo", Arial, sans-serif';
function durOf(tp, v) { return typeof tp.dur === 'function' ? tp.dur(v || {}) : (tp.dur || 0); }
const C = { lime: '#D4FE2B', limeTag: '#C9F227', chalk: '#FEFEF6', cream: '#FBF7F1', label: '#A3A2A4', muted: '#8F8E86', faint: '#6F6E64', panel: '#10110C', line: '#26271F', road: '#23241C', bg: '#080806', ink: '#0B0C05' };
const GREEN = '#00B140';
const FORMATS = {
  '9x16': { W: 1080, H: 1920, box: [240, 1560], label: '9:16', cls: 'r916' },
  '4x5': { W: 1080, H: 1350, box: [60, 1290], label: '4:5', cls: 'r45' },
  '1x1': { W: 1080, H: 1080, box: [50, 1030], label: '1:1', cls: 'r11' },
};
const BG_LABELS = { dark: 'Dark', transparent: 'Clear', green: 'Green screen' };
const APP_LINK = 'https://apps.apple.com/app/trip360-drive-tracker/id6805200692';
const TAGLINES = ['Every km. Tracked.', 'Every drive counts.', "Your car forgets. Trip360 doesn't.", 'Your city. Your territory.', 'DRIVE. TRACK. RANK.', 'OWN THE MAP.', 'Claim every road.', 'Your drives. Ranked.', 'TOP THE LEADERBOARD.', 'Built for drivers.'];
const TIERS = { Bronze: '#D08C4F', Silver: '#CDD2D8', Gold: '#F2C94C', Platinum: '#BDF1F7' };

/* ---------- images & fonts ---------- */
const LOGO_SRC = '/studio/assets/logo.png';
const MARK_SRC = '/studio/assets/mark.png';
const IMG = { logo: new Image(), mark: new Image() };
document.getElementById('hdrLogo').src = LOGO_SRC;
IMG.logo.src = LOGO_SRC;
IMG.mark.src = MARK_SRC;
const ready = (img) => img.complete && img.naturalWidth > 0;

/* ---------- math helpers ---------- */
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const eo = (x) => 1 - Math.pow(1 - x, 3);
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eob = (x) => { const c1 = 1.70158, c3 = c1 + 1; return x <= 0 ? 0 : 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const num = (v, d = 0) => { const n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : d; };

/* ---------- formatting ---------- */
function fmtDist(v) { const n = Math.max(0, num(v)); if (n >= 100) return Math.round(n).toLocaleString('en-US'); return (Math.round(n * 10) / 10).toString(); }
function distUnit(u) { return u === 'mi' ? 'mi' : 'km'; }
function speedUnit(u) { return u === 'mi' ? 'mph' : 'km/h'; }
function timeSegs(h, m) { h = Math.max(0, Math.floor(num(h))); m = Math.max(0, Math.floor(num(m))); if (m >= 60) { h += Math.floor(m / 60); m = m % 60; } return h > 0 ? [[String(h), 'h'], [String(m), 'm']] : [[String(m), 'm']]; }

/* ---------- drawing helpers ---------- */
function font(ctx, w, s, f) { ctx.font = `${w} ${s}px ${f}`; }
function spacedW(ctx, text, sp) { let w = 0; for (const ch of text) w += ctx.measureText(ch).width + sp; return Math.max(0, w - sp); }
function spaced(ctx, text, x, y, sp, align = 'center') {
  const w = spacedW(ctx, text, sp);
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.textAlign = 'left';
  for (const ch of text) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + sp; }
}
function fit(ctx, text, w, size, fam, maxW, spEm = 0) {
  let s = size;
  for (; s > 12; s -= 2) { font(ctx, w, s, fam); const tw = spEm ? spacedW(ctx, text, spEm * s) : ctx.measureText(text).width; if (tw <= maxW) break; }
  return s;
}
function nuW(ctx, segs, s) {
  let w = 0;
  segs.forEach((g, i) => {
    font(ctx, 800, s, FONT_NUM); w += ctx.measureText(g[0]).width;
    if (g[1]) { font(ctx, 700, s * 0.4, FONT_NUM); w += s * 0.06 + ctx.measureText(g[1]).width; }
    if (i < segs.length - 1) w += s * 0.2;
  });
  return w;
}
function numUnit(ctx, segs, x, y, size, o = {}) {
  const align = o.align || 'center', color = o.color || C.cream, unitColor = o.unitColor || color, maxW = o.maxW || Infinity;
  let s = size; while (nuW(ctx, segs, s) > maxW && s > 20) s -= 3;
  const w = nuW(ctx, segs, s);
  let cx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  segs.forEach((g, i) => {
    font(ctx, 800, s, FONT_NUM); ctx.fillStyle = color; ctx.fillText(g[0], cx, y); cx += ctx.measureText(g[0]).width;
    if (g[1]) { cx += s * 0.06; font(ctx, 700, s * 0.4, FONT_NUM); ctx.fillStyle = unitColor; ctx.fillText(g[1], cx, y); cx += ctx.measureText(g[1]).width; }
    if (i < segs.length - 1) cx += s * 0.2;
  });
  return s;
}
function text(ctx, str, x, y, o = {}) {
  const w = o.weight || 400, s = o.size || 32, fam = o.font || FONT_UI;
  const size = o.maxW ? fit(ctx, str, w, s, fam, o.maxW, o.spacing || 0) : s;
  font(ctx, w, size, fam); ctx.fillStyle = o.color || C.chalk; ctx.textBaseline = 'alphabetic';
  if (o.spacing) spaced(ctx, str, x, y, o.spacing * size, o.align || 'center');
  else { ctx.textAlign = o.align || 'center'; ctx.fillText(str, x, y); }
  return size;
}
function eyebrow(ctx, str, y, a = 1) { ctx.globalAlpha = a; text(ctx, str.toUpperCase(), 540, y, { weight: 700, size: 28, color: C.lime, spacing: 0.2, maxW: 900 }); ctx.globalAlpha = 1; }
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function logo(ctx, cx, y, h, a = 1, scale = 1) {
  if (!ready(IMG.logo)) return;
  const w = (h * IMG.logo.naturalWidth) / IMG.logo.naturalHeight;
  ctx.save(); ctx.globalAlpha *= a;
  ctx.translate(cx, y + h / 2); ctx.scale(scale, scale);
  ctx.drawImage(IMG.logo, -w / 2, -h / 2, w, h); ctx.restore();
}
function footer(ctx, y, a = 1) { ctx.globalAlpha = a; text(ctx, 'Tracked with Trip360', 540, y, { weight: 500, size: 28, color: C.faint }); ctx.globalAlpha = 1; }

/* ---------- map & route ---------- */
function drawMap(ctx, x, y, w, h, seed) {
  ctx.save(); rr(ctx, x, y, w, h, 28); ctx.fillStyle = '#0D0E0A'; ctx.fill(); ctx.clip();
  const r = rng(seed ^ 0x9e3779b9);
  for (let i = 0; i < 9; i++) {
    const vertical = r() > 0.5;
    ctx.beginPath();
    if (vertical) { const a = x + r() * w, b = x + r() * w; ctx.moveTo(a, y - 10); ctx.lineTo(b, y + h + 10); }
    else { const a = y + r() * h, b = y + r() * h; ctx.moveTo(x - 10, a); ctx.lineTo(x + w + 10, b); }
    ctx.lineWidth = 5 + r() * 9; ctx.strokeStyle = '#181913'; ctx.stroke();
  }
  ctx.restore();
  rr(ctx, x, y, w, h, 28); ctx.lineWidth = 2; ctx.strokeStyle = C.line; ctx.stroke();
}
function makeRoute(seed, x, y, w, h) {
  const r = rng(seed); const N = 6; const P = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N; let px = x + w * (0.12 + 0.76 * t); let py = y + h * (0.82 - 0.64 * t);
    if (i > 0 && i < N) { px += (r() - 0.5) * w * 0.16; py += (r() - 0.5) * h * 0.34; }
    P.push([px, py]);
  }
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || P[i + 1];
    for (let s = 0; s < 20; s++) {
      const t = s / 20, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(P[P.length - 1]);
  const L = [0]; for (let i = 1; i < out.length; i++) L.push(L[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]));
  return { pts: out, len: L };
}
function routePath(ctx, R, frac) {
  const target = frac * R.len[R.len.length - 1];
  ctx.beginPath(); ctx.moveTo(R.pts[0][0], R.pts[0][1]);
  let end = R.pts[0];
  for (let i = 1; i < R.pts.length; i++) {
    if (R.len[i] <= target) { ctx.lineTo(R.pts[i][0], R.pts[i][1]); end = R.pts[i]; }
    else { const k = (target - R.len[i - 1]) / (R.len[i] - R.len[i - 1] || 1); end = [R.pts[i - 1][0] + (R.pts[i][0] - R.pts[i - 1][0]) * k, R.pts[i - 1][1] + (R.pts[i][1] - R.pts[i - 1][1]) * k]; ctx.lineTo(end[0], end[1]); break; }
  }
  return end;
}
function drawRoute(ctx, R, frac, t) {
  if (frac <= 0) return;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  routePath(ctx, R, frac); ctx.lineWidth = 26; ctx.strokeStyle = C.road; ctx.stroke();
  const end = routePath(ctx, R, frac); ctx.setLineDash([16, 13]); ctx.lineWidth = 5; ctx.lineCap = 'butt'; ctx.strokeStyle = C.lime; ctx.stroke(); ctx.setLineDash([]);
  const s = R.pts[0];
  ctx.beginPath(); ctx.arc(s[0], s[1], 13, 0, Math.PI * 2); ctx.fillStyle = C.bg; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = C.chalk; ctx.stroke();
  if (frac >= 1) {
    const e = R.pts[R.pts.length - 1]; const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.beginPath(); ctx.arc(e[0], e[1], 28 + pulse * 10, 0, Math.PI * 2); ctx.fillStyle = 'rgba(212,254,43,0.18)'; ctx.fill();
    ctx.beginPath(); ctx.arc(e[0], e[1], 14, 0, Math.PI * 2); ctx.fillStyle = C.lime; ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(end[0], end[1], 10, 0, Math.PI * 2); ctx.fillStyle = C.lime; ctx.fill();
  }
}
function placeLabel(ctx, str, p, below, a) {
  if (!str) return; ctx.globalAlpha = a;
  const x = Math.max(150, Math.min(930, p[0]));
  text(ctx, str, x, below ? p[1] + 58 : p[1] - 36, { weight: 600, size: 30, color: C.chalk, maxW: 360 });
  ctx.globalAlpha = 1;
}

/* ---------- backgrounds ---------- */
function drawBg(ctx, W, H, mode) {
  if (mode === 'transparent') return;
  if (mode === 'green') { ctx.fillStyle = GREEN; ctx.fillRect(0, 0, W, H); return; }
  ctx.fillStyle = '#010100'; ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * 0.44, 0, W / 2, H * 0.44, Math.max(W, H) * 0.62);
  g.addColorStop(0, '#161B06'); g.addColorStop(0.45, '#0A0C04'); g.addColorStop(1, '#010100');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

/* ---------- templates ---------- */
const unitsField = { id: 'units', label: 'Units', type: 'select', options: [['km', 'km and km/h'], ['mi', 'miles and mph']], def: 'km' };
const TEMPLATES = [
  {
    id: 'drive-summary', name: 'Drive summary', kind: 'Image', video: false, h: 1230, bgs: ['dark', 'transparent'],
    title: 'One drive, all the numbers', desc: 'A clean summary card with the route, distance, drive time and average speed. Great as a cover image or the last frame of a drive edit.',
    fields: [
      { id: 'from', label: 'From', def: 'London' }, { id: 'to', label: 'To', def: 'Edinburgh' },
      { id: 'dist', label: 'Distance', type: 'number', def: '663' }, { id: 'avg', label: 'Average speed', type: 'number', def: '92' },
      { id: 'hrs', label: 'Drive time: hours', type: 'number', def: '7' }, { id: 'min', label: 'Drive time: minutes', type: 'number', def: '12' },
      { id: 'date', label: 'Date', def: 'Sat 12 Oct 2026' }, { id: 'car', label: 'Car or bike', def: 'BMW M3 Touring' }, unitsField,
    ],
    draw(ctx, t, v) {
      logo(ctx, 540, 0, 84);
      eyebrow(ctx, 'Drive summary', 165);
      drawMap(ctx, 90, 205, 900, 470, hashStr(v.from + '>' + v.to));
      const R = makeRoute(hashStr(v.from + '>' + v.to), 90, 205, 900, 470);
      drawRoute(ctx, R, 1, t);
      placeLabel(ctx, v.from, R.pts[0], true, 1); placeLabel(ctx, v.to, R.pts[R.pts.length - 1], true, 1);
      text(ctx, `${v.from || 'Start'} → ${v.to || 'Finish'}`, 540, 765, { weight: 700, size: 50, maxW: 900 });
      ctx.fillStyle = C.line; ctx.fillRect(389, 820, 2, 150); ctx.fillRect(689, 820, 2, 150);
      text(ctx, 'Distance', 240, 852, { size: 32, color: C.label }); numUnit(ctx, [[fmtDist(v.dist), distUnit(v.units)]], 240, 955, 104, { maxW: 280 });
      text(ctx, 'Drive time', 540, 852, { size: 32, color: C.label }); numUnit(ctx, timeSegs(v.hrs, v.min), 540, 955, 104, { maxW: 280 });
      text(ctx, 'Avg speed', 840, 852, { size: 32, color: C.label }); numUnit(ctx, [[String(Math.round(num(v.avg))), speedUnit(v.units)]], 840, 955, 104, { maxW: 280 });
      const meta = [v.date, v.car].filter(Boolean).join('   ·   ');
      if (meta) text(ctx, meta, 540, 1065, { size: 32, color: C.muted, maxW: 900 });
      footer(ctx, 1190);
    },
  },
  {
    id: 'stat-overlay', name: 'Stat overlay', kind: 'Clear PNG', video: false, h: 1000, bgs: ['transparent', 'dark', 'green'],
    title: 'Big stats to lay over your footage', desc: 'Three stacked stats with the logo underneath, on a clear background. Drop the PNG on top of your driving clip in CapCut or Premiere.',
    fields: [
      { id: 'dist', label: 'Distance', type: 'number', def: '18' }, { id: 'avg', label: 'Average speed', type: 'number', def: '32' },
      { id: 'hrs', label: 'Drive time: hours', type: 'number', def: '0' }, { id: 'min', label: 'Drive time: minutes', type: 'number', def: '34' },
      { id: 'labels', label: 'Show labels', type: 'select', options: [['no', 'No, numbers only'], ['yes', 'Yes, label each stat']], def: 'no' }, unitsField,
    ],
    draw(ctx, t, v, F) {
      const sh = (b) => { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = b * F.k; ctx.shadowOffsetY = 4 * F.k; };
      sh(30);
      const rows = [
        ['Distance', [[fmtDist(v.dist), distUnit(v.units)]]],
        ['Drive time', timeSegs(v.hrs, v.min)],
        ['Avg speed', [[String(Math.round(num(v.avg))), speedUnit(v.units)]]],
      ];
      const showL = v.labels === 'yes';
      rows.forEach((r, i) => {
        const base = (showL ? 250 : 200) + i * (showL ? 290 : 270);
        if (showL) text(ctx, r[0], 540, base - 150, { weight: 500, size: 46, color: '#E4E3DA' });
        numUnit(ctx, r[1], 540, base, 190, { color: C.chalk, maxW: 940 });
      });
      sh(18); logo(ctx, 540, 912, 78);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    },
  },
  {
    id: 'speedometer', name: 'Speedometer', kind: 'Animated video', video: true, h: 790, bgs: ['dark', 'green'],
    dur: (v) => ({ slow: 11, normal: 6.5, quick: 4 })[v.pace] || 11,
    title: 'Count up to your speed',
    desc: 'The Trip360 speed card: the number counts up from 0 and settles on your speed, like your original meter video. It shows average speed by default. Turn on the Track day tag only for circuit footage.',
    fields: [
      { id: 'speed', label: 'Speed', type: 'number', def: '96' },
      { id: 'unit', label: 'Unit', type: 'select', options: [['KM/H', 'KM/H'], ['MPH', 'MPH'], ['KM', 'KM (like the original)']], def: 'KM/H' },
      { id: 'label', label: 'Label above the number', def: 'Avg speed' },
      { id: 'pace', label: 'Count speed', type: 'select', options: [['slow', 'Slow, 11 seconds'], ['normal', 'Normal, 6.5 seconds'], ['quick', 'Quick, 4 seconds']], def: 'slow' },
      { id: 'track', label: 'Track day tag', type: 'select', options: [['no', 'Off'], ['yes', 'On, for circuit footage only']], def: 'no', wide: true },
    ],
    bg(ctx, W, H) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#040C00'); g.addColorStop(1, '#020800'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); },
    draw(ctx, t, v) {
      const k = 1080 / 906;
      const countT = durOf(this, v) * 0.745;
      const x0 = clamp01(t / countT), p = x0 * x0 * (3 - 2 * x0);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      font(ctx, 700, 62.5 * k, FONT_POP);
      const w1 = ctx.measureText('Trip').width, w2 = ctx.measureText('360').width;
      let x = 540 - (w1 + w2) / 2;
      ctx.fillStyle = '#F2F8EE'; ctx.fillText('Trip', x, 121 * k);
      ctx.fillStyle = '#C0E42D'; ctx.fillText('360', x + w1, 121 * k);
      rr(ctx, 96 * k, 218 * k, 714 * k, 304 * k, 24 * k); ctx.fillStyle = '#060B05'; ctx.fill();
      ctx.lineWidth = 2 * k; ctx.strokeStyle = '#3A4037'; ctx.stroke();
      text(ctx, v.label || 'Speed', 540, 293 * k, { weight: 500, size: 32.3 * k, font: FONT_POP, color: '#A0A7A0', maxW: 640 * k });
      const target = Math.max(0, Math.round(num(v.speed)));
      const nStr = Math.round(target * p).toLocaleString('en-US'), uStr = ' ' + (v.unit || 'KM/H');
      let s = 77.7 * k; font(ctx, 700, s, FONT_POP);
      while (ctx.measureText(nStr + uStr).width > 660 * k && s > 30) { s -= 2; font(ctx, 700, s, FONT_POP); }
      const wn = ctx.measureText(nStr).width, wu = ctx.measureText(uStr).width;
      x = 540 - (wn + wu) / 2; ctx.textAlign = 'left';
      ctx.fillStyle = '#F1F6EF'; ctx.fillText(nStr, x, 402 * k);
      ctx.fillStyle = '#C0E42D'; ctx.fillText(uStr, x + wn, 402 * k);
      if (v.track === 'yes') {
        const a = eob(seg(t, countT, countT + 0.5));
        if (a > 0) {
          ctx.save(); ctx.translate(540, 700); ctx.scale(a, a);
          rr(ctx, -150, -34, 300, 68, 34); ctx.fillStyle = '#C0E42D'; ctx.fill();
          text(ctx, 'TRACK DAY', 0, 12, { weight: 800, size: 30, color: C.ink, spacing: 0.14 });
          ctx.restore();
        }
      }
    },
  },
  {
    id: 'route-reveal', name: 'Route reveal', kind: 'Animated video', video: true, dur: 8, h: 1230, bgs: ['dark', 'green'],
    title: 'Watch the route draw itself', desc: 'The route draws across the map while the distance counts up, then the drive time and average speed land. About 8 seconds.',
    fields: [
      { id: 'from', label: 'From', def: 'Los Angeles' }, { id: 'to', label: 'To', def: 'Las Vegas' },
      { id: 'dist', label: 'Distance', type: 'number', def: '435' }, { id: 'avg', label: 'Average speed', type: 'number', def: '96' },
      { id: 'hrs', label: 'Drive time: hours', type: 'number', def: '4' }, { id: 'min', label: 'Drive time: minutes', type: 'number', def: '31' }, unitsField,
    ],
    draw(ctx, t, v) {
      const a1 = eo(seg(t, 0, 0.6));
      logo(ctx, 540, 0, 80, a1); eyebrow(ctx, 'Route', 150, a1);
      const p = eio(seg(t, 0.6, 4.6));
      const d = Math.max(0, num(v.dist)) * p;
      ctx.globalAlpha = a1; numUnit(ctx, [[fmtDist(d), distUnit(v.units)]], 540, 330, 170, { color: C.chalk, maxW: 900 }); ctx.globalAlpha = 1;
      const seed = hashStr(v.from + '>' + v.to);
      ctx.globalAlpha = a1; drawMap(ctx, 90, 380, 900, 560, seed); ctx.globalAlpha = 1;
      const R = makeRoute(seed, 90, 380, 900, 560);
      drawRoute(ctx, R, p, t);
      placeLabel(ctx, v.from, R.pts[0], true, eo(seg(t, 0.6, 1.1)));
      placeLabel(ctx, v.to, R.pts[R.pts.length - 1], true, eo(seg(t, 4.4, 4.9)));
      const a2 = eo(seg(t, 4.6, 5.2));
      ctx.save(); ctx.globalAlpha = a2; ctx.translate(0, (1 - a2) * 24);
      text(ctx, `${v.from || 'Start'} → ${v.to || 'Finish'}`, 540, 1030, { weight: 700, size: 48, maxW: 900 }); ctx.restore();
      const a3 = eo(seg(t, 5.2, 5.9));
      ctx.save(); ctx.globalAlpha = a3; ctx.translate(0, (1 - a3) * 24);
      text(ctx, 'Drive time', 330, 1110, { size: 32, color: C.label }); numUnit(ctx, timeSegs(v.hrs, v.min), 330, 1208, 96, { maxW: 380 });
      text(ctx, 'Avg speed', 750, 1110, { size: 32, color: C.label }); numUnit(ctx, [[String(Math.round(num(v.avg))), speedUnit(v.units)]], 750, 1208, 96, { maxW: 380 });
      ctx.restore();
    },
  },
  {
    id: 'king-of-the-area', name: 'King of the Area', kind: 'Animated video', video: true, dur: 7, h: 1330, bgs: ['dark', 'green'],
    title: 'Claim your territory', desc: 'Map squares light up as you claim them, the count ticks up, then the King of the Area badge pops. About 7 seconds.',
    fields: [
      { id: 'area', label: 'Area name', def: 'Shoreditch, London' }, { id: 'squares', label: 'Squares claimed', type: 'number', def: '128' },
      { id: 'badge', label: 'Badge text', def: 'King of the Area', wide: true },
    ],
    draw(ctx, t, v) {
      const a1 = eo(seg(t, 0, 0.6));
      logo(ctx, 540, 0, 80, a1); eyebrow(ctx, 'Territory', 150, a1);
      const sq = Math.max(0, Math.round(num(v.squares)));
      const p = eo(seg(t, 0.8, 4.2));
      ctx.globalAlpha = a1;
      numUnit(ctx, [[Math.round(sq * p).toLocaleString('en-US'), '']], 540, 318, 160, { color: C.chalk, maxW: 800 });
      text(ctx, 'squares claimed', 540, 370, { size: 34, color: C.label });
      ctx.globalAlpha = 1;
      const x0 = 180, y0 = 410, cell = 72, n = 10;
      ctx.save(); ctx.globalAlpha = a1;
      rr(ctx, x0 - 14, y0 - 14, cell * n + 22, cell * n + 22, 26); ctx.fillStyle = '#0D0E0A'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.line; ctx.stroke();
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { rr(ctx, x0 + i * cell, y0 + j * cell, cell - 6, cell - 6, 8); ctx.fillStyle = '#15160F'; ctx.fill(); }
      ctx.restore();
      const r = rng(hashStr(v.area || 'area'));
      const cx = 3.5 + r() * 2, cy = 3.5 + r() * 2;
      const cells = [];
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cells.push({ i, j, d: Math.hypot(i - cx, j - cy) + r() * 2.2 });
      cells.sort((a, b) => a.d - b.d);
      const k = Math.max(6, Math.min(72, Math.round(Math.sqrt(sq) * 5)));
      for (let m = 0; m < k; m++) {
        const c = cells[m]; const ti = 0.8 + 3.2 * (m / k); const q = eo(seg(t, ti, ti + 0.35));
        if (q <= 0) continue;
        const sz = (cell - 6) * (0.55 + 0.45 * q), off = ((cell - 6) - sz) / 2;
        ctx.globalAlpha = 0.25 + 0.65 * q; rr(ctx, x0 + c.i * cell + off, y0 + c.j * cell + off, sz, sz, 8); ctx.fillStyle = C.lime; ctx.fill();
      }
      ctx.globalAlpha = 1;
      const a2 = eo(seg(t, 4.0, 4.5));
      ctx.globalAlpha = a2; text(ctx, v.area || '', 540, 1200, { weight: 700, size: 46, maxW: 900 }); ctx.globalAlpha = 1;
      const b = eob(seg(t, 4.3, 4.9));
      if (b > 0) {
        ctx.save(); ctx.translate(540, 1272); ctx.scale(b, b);
        const label = (v.badge || 'King of the Area').toUpperCase();
        font(ctx, 800, 38, FONT_UI); const tw = Math.min(760, spacedW(ctx, label, 3.5));
        const w = tw + 150; rr(ctx, -w / 2, -46, w, 92, 46); ctx.fillStyle = C.lime; ctx.fill();
        const ix = -w / 2 + 52; ctx.beginPath();
        ctx.moveTo(ix - 24, 14); ctx.lineTo(ix - 28, -16); ctx.lineTo(ix - 12, -2); ctx.lineTo(ix, -22); ctx.lineTo(ix + 12, -2); ctx.lineTo(ix + 28, -16); ctx.lineTo(ix + 24, 14); ctx.closePath();
        ctx.fillStyle = C.ink; ctx.fill();
        text(ctx, label, 25, 14, { weight: 800, size: 38, color: C.ink, spacing: 0.09, maxW: 760 });
        ctx.restore();
      }
    },
  },
  {
    id: 'leaderboard', name: 'Leaderboard', kind: 'Animated video', video: true, dur: 8, h: 1180, bgs: ['dark', 'green'],
    title: 'Climb the leaderboard', desc: 'Rows slide in and the distances count up, with your row highlighted. Trip360 ranks drivers by distance. About 8 seconds.',
    fields: [
      { id: 'period', label: 'Period', type: 'select', options: [['This week', 'This week'], ['This month', 'This month'], ['All time', 'All time']], def: 'This week' },
      { id: 'country', label: 'Country or group', def: 'United Kingdom' },
      { id: 'rows', label: 'Drivers (one per line: name, distance)', type: 'textarea', wide: true, def: '@alex.drives, 1248\n@you, 1102\n@mia_on_the_road, 986\n@k.tracks, 875\n@nightshift_sam, 790', hint: 'Up to 5 lines. Use real names from the leaderboard or ask permission.' },
      { id: 'you', label: 'Highlight row', type: 'select', options: [['1', 'Row 1'], ['2', 'Row 2'], ['3', 'Row 3'], ['4', 'Row 4'], ['5', 'Row 5'], ['0', 'None']], def: '2' }, unitsField,
    ],
    draw(ctx, t, v) {
      const a1 = eo(seg(t, 0, 0.6));
      logo(ctx, 540, 0, 80, a1); eyebrow(ctx, 'Leaderboard', 150, a1);
      ctx.globalAlpha = a1; text(ctx, [v.period, v.country].filter(Boolean).join('  ·  '), 540, 218, { weight: 700, size: 44, maxW: 900 }); ctx.globalAlpha = 1;
      const rows = String(v.rows || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 5).map((l) => { const i = l.lastIndexOf(','); return i > 0 ? [l.slice(0, i).trim(), num(l.slice(i + 1))] : [l, 0]; });
      const you = parseInt(v.you, 10) || 0;
      rows.forEach((r, i) => {
        const ti = 0.6 + i * 0.35; const p = eo(seg(t, ti, ti + 0.5)); if (p <= 0) return;
        const y = 270 + i * 148, x = 90 + (1 - p) * 120, w = 900, h = 128, me = you === i + 1;
        ctx.globalAlpha = p;
        rr(ctx, x, y, w, h, 24); ctx.fillStyle = me ? 'rgba(212,254,43,0.10)' : '#11120D'; ctx.fill();
        ctx.lineWidth = me ? 3 : 2; ctx.strokeStyle = me ? C.lime : C.line; ctx.stroke();
        numUnit(ctx, [[String(i + 1), '']], x + 62, y + 86, 66, { color: me || i === 0 ? C.lime : C.chalk });
        const nameSize = fit(ctx, r[0], 600, 40, FONT_UI, 420);
        font(ctx, 600, nameSize, FONT_UI); ctx.fillStyle = C.chalk; ctx.textAlign = 'left'; ctx.fillText(r[0], x + 128, y + 78);
        if (me) {
          const nw = ctx.measureText(r[0]).width; rr(ctx, x + 146 + nw, y + 46, 84, 42, 21); ctx.fillStyle = C.lime; ctx.fill();
          text(ctx, 'YOU', x + 188 + nw, y + 76, { weight: 800, size: 22, color: C.ink, spacing: 0.1 });
        }
        const c = eo(seg(t, ti + 0.2, ti + 1.4));
        numUnit(ctx, [[fmtDist(r[1] * c), distUnit(v.units)]], x + w - 40, y + 88, 66, { align: 'right', color: C.cream, maxW: 260 });
        ctx.globalAlpha = 1;
      });
      const a2 = eo(seg(t, 2.6, 3.2));
      ctx.globalAlpha = a2; text(ctx, 'Ranked by distance driven', 540, 1065, { size: 32, color: C.muted }); ctx.globalAlpha = 1;
      footer(ctx, 1140, a2);
    },
  },
  {
    id: 'achievement', name: 'Achievement unlocked', kind: 'Animated video', video: true, dur: 6, h: 1100, bgs: ['dark', 'green'],
    title: 'Show off an achievement', desc: 'The badge ring fills in the tier colour, the badge pops and the achievement name lands. Trip360 has 15 achievements in Bronze, Silver, Gold and Platinum. About 6 seconds.',
    fields: [
      { id: 'name', label: 'Achievement name', def: 'Night Owl' }, { id: 'tier', label: 'Tier', type: 'select', options: Object.keys(TIERS).map((k) => [k, k]), def: 'Gold' },
      { id: 'desc', label: 'What it is for', def: 'Finish a drive after midnight', wide: true },
      { id: 'have', label: 'Achievements unlocked', type: 'number', def: '7' }, { id: 'total', label: 'Out of', type: 'number', def: '15' },
    ],
    draw(ctx, t, v) {
      const a1 = eo(seg(t, 0, 0.6)); const col = TIERS[v.tier] || TIERS.Gold;
      logo(ctx, 540, 0, 80, a1); eyebrow(ctx, 'Achievement unlocked', 150, a1);
      const cx = 540, cy = 470, R = 225, segs = 36, sweep = 270 * Math.PI / 180, start = 135 * Math.PI / 180;
      const rp = eo(seg(t, 0.4, 2.0));
      ctx.globalAlpha = a1; ctx.lineWidth = 34; ctx.lineCap = 'butt';
      for (let j = 0; j < segs; j++) {
        const a0 = start + (j / segs) * sweep, a = a0 + (sweep / segs) * 0.72;
        ctx.beginPath(); ctx.arc(cx, cy, R, a0, a); ctx.strokeStyle = j / segs < rp ? col : '#22231B'; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(cx, cy, 170, 0, Math.PI * 2); ctx.fillStyle = '#0F100C'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = C.line; ctx.stroke();
      ctx.globalAlpha = 1;
      const b = eob(seg(t, 1.8, 2.4));
      if (b > 0 && ready(IMG.mark)) {
        ctx.save(); ctx.translate(cx, cy - 25); ctx.scale(b, b);
        const mh = 180, mw = mh * IMG.mark.naturalWidth / IMG.mark.naturalHeight; ctx.drawImage(IMG.mark, -mw / 2, -mh / 2, mw, mh); ctx.restore();
        ctx.globalAlpha = clamp01(b); text(ctx, String(v.tier || '').toUpperCase(), cx, cy + 112, { weight: 700, size: 40, color: col, spacing: 0.18 }); ctx.globalAlpha = 1;
      }
      const a2 = eo(seg(t, 2.2, 2.8));
      ctx.save(); ctx.globalAlpha = a2; ctx.translate(0, (1 - a2) * 26);
      text(ctx, v.name || '', 540, 830, { weight: 700, size: 96, font: FONT_TAG, maxW: 920 }); ctx.restore();
      const a3 = eo(seg(t, 2.5, 3.0));
      ctx.globalAlpha = a3; text(ctx, v.desc || '', 540, 900, { size: 38, color: C.muted, maxW: 900 }); ctx.globalAlpha = 1;
      const have = Math.max(0, num(v.have)), total = Math.max(1, num(v.total, 15));
      const pb = eo(seg(t, 2.8, 3.8));
      ctx.globalAlpha = a3; rr(ctx, 240, 965, 600, 16, 8); ctx.fillStyle = '#22231B'; ctx.fill();
      const fw = 600 * Math.min(1, have / total) * pb; if (fw > 0) { rr(ctx, 240, 965, Math.max(16, fw), 16, 8); ctx.fillStyle = C.lime; ctx.fill(); }
      text(ctx, `${Math.round(have)} of ${Math.round(total)} achievements`, 540, 1045, { weight: 500, size: 32, color: C.muted }); ctx.globalAlpha = 1;
    },
  },
  {
    id: 'end-card', name: 'End card', kind: 'Animated video', video: true, dur: 4.5, full: true, bgs: ['dark', 'green'],
    title: 'Finish every video on this', desc: 'The Trip360 logo, a thin divider and one tagline, animated in. Put it on the last 2 to 3 seconds of every edit.',
    fields: [
      { id: 'tagline', label: 'Tagline', type: 'select', options: TAGLINES.map((x) => [x, x]).concat([['custom', 'Custom (type below)']]), def: 'Every km. Tracked.', wide: true },
      { id: 'custom', label: 'Custom tagline', def: '', wide: true, hint: 'Only used when Tagline is set to Custom. Keep it short.' },
      { id: 'style', label: 'Tagline style', type: 'select', options: [['white', 'White'], ['lime', 'Lime'], ['caps', 'Lime spaced capitals'], ['bold', 'White bold']], def: 'white' },
    ],
    draw(ctx, t, v, F) {
      const { W, H } = F;
      const lw = W * (H / W > 1.6 ? 0.62 : H / W > 1.1 ? 0.56 : 0.52);
      const k = lw / 645;
      const lh = lw * (ready(IMG.logo) ? IMG.logo.naturalHeight / IMG.logo.naturalWidth : 0.264);
      const lcy = H * 0.42;
      const la = eo(seg(t, 0, 0.6));
      logo(ctx, W / 2, lcy - lh / 2, lh, la, 0.96 + 0.04 * la);
      const dy = lcy + lh / 2 + 77 * k, dp = eo(seg(t, 0.5, 0.9)), dw = 140 * k * dp;
      if (dw > 0) { ctx.fillStyle = '#3A3A3A'; ctx.fillRect(W / 2 - dw / 2, dy, dw, Math.max(2, 3 * k)); }
      let tag = v.tagline === 'custom' ? (v.custom || '') : v.tagline;
      const st = v.style;
      if (st === 'caps') tag = tag.toUpperCase();
      const ta = eo(seg(t, 0.9, 1.4));
      ctx.save(); ctx.globalAlpha = ta; ctx.translate(0, (1 - ta) * 14 * k);
      const base = dy + 132 * k;
      const opts = st === 'caps' ? { weight: 600, size: 58 * k, color: C.limeTag, spacing: 0.18 }
        : st === 'bold' ? { weight: 700, size: 87 * k, color: '#FFFFFF' }
        : st === 'lime' ? { weight: 400, size: 81 * k, color: C.limeTag }
        : { weight: 400, size: 81 * k, color: '#FFFFFF' };
      text(ctx, tag, W / 2, base, Object.assign({ font: FONT_TAG, maxW: W * 0.88 }, opts));
      ctx.restore();
    },
  },
  {
    id: 'download-cta', name: 'Download CTA', kind: 'Image', video: false, h: 1000, bgs: ['dark', 'transparent'],
    title: 'Tell viewers where to get the app', desc: 'A call to action card that sends viewers to the App Store. Use it as the last frame or a pinned comment image.',
    fields: [
      { id: 'head', label: 'Headline', def: 'Your car forgets every drive.', wide: true },
      { id: 'sub', label: 'Second line (lime)', def: "Trip360 doesn't.", wide: true },
      { id: 'btn', label: 'Button text', def: 'Download on the App Store' },
      { id: 'small', label: 'Small text', def: 'Search "Trip360" on the App Store' },
    ],
    draw(ctx, t, v) {
      logo(ctx, 540, 0, 84);
      font(ctx, 700, 96, FONT_TAG);
      const words = String(v.head || '').split(/\s+/).filter(Boolean); const lines = []; let cur = '';
      words.forEach((w) => { const tryL = cur ? cur + ' ' + w : w; if (ctx.measureText(tryL).width > 900 && cur) { lines.push(cur); cur = w; } else cur = tryL; });
      if (cur) lines.push(cur);
      let y = 300;
      lines.slice(0, 3).forEach((l) => { text(ctx, l, 540, y, { weight: 700, size: 96, font: FONT_TAG, maxW: 940 }); y += 106; });
      if (v.sub) { text(ctx, v.sub, 540, y + 6, { weight: 600, size: 72, font: FONT_TAG, color: C.limeTag, maxW: 900 }); y += 78; }
      const by = y + 70;
      rr(ctx, 170, by, 740, 112, 56); ctx.fillStyle = C.lime; ctx.fill();
      text(ctx, v.btn || '', 540, by + 72, { weight: 700, size: 42, color: C.ink, maxW: 640 });
      if (v.small) text(ctx, v.small, 540, by + 190, { size: 32, color: C.muted, maxW: 900 });
    },
  },
];

/* ---------- state ---------- */
const KEY = 't360-clipper-studio-v1';
let state = { tpl: TEMPLATES[0].id, fmt: '9x16', bg: {}, vals: {} };
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && typeof s === 'object') state = Object.assign(state, s); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
const tplById = (id) => TEMPLATES.find((x) => x.id === id) || TEMPLATES[0];
const defaults = (tp) => Object.fromEntries(tp.fields.map((f) => [f.id, f.def]));
const vals = (tp) => Object.assign(defaults(tp), state.vals[tp.id] || {});
const bgOf = (tp) => (tp.bgs.includes(state.bg[tp.id]) ? state.bg[tp.id] : tp.bgs[0]);
{ const h = (location.hash || '').slice(1); if (TEMPLATES.some((x) => x.id === h)) state.tpl = h; }

/* ---------- render ---------- */
function render(ctx, tp, v, fmtKey, bgMode, t, ps) {
  const F = FORMATS[fmtKey];
  ctx.setTransform(ps, 0, 0, ps, 0, 0);
  ctx.clearRect(0, 0, F.W, F.H);
  if (bgMode === 'dark' && tp.bg) tp.bg(ctx, F.W, F.H); else drawBg(ctx, F.W, F.H, bgMode);
  if (tp.full) { tp.draw(ctx, t, v, { W: F.W, H: F.H, k: ps }); return; }
  const top = F.box[0], bh = F.box[1] - F.box[0];
  const s = Math.min(1, bh / tp.h, F.W / 1080);
  const tx = (F.W - 1080 * s) / 2, ty = top + (bh - tp.h * s) / 2;
  ctx.setTransform(ps * s, 0, 0, ps * s, ps * tx, ps * ty);
  tp.draw(ctx, t, v, { W: F.W, H: F.H, k: ps * s });
  ctx.setTransform(ps, 0, 0, ps, 0, 0);
}

/* ---------- preview ---------- */
const pv = document.getElementById('preview');
const pctx = pv.getContext('2d');
let pScale = 0.5, playStart = performance.now(), raf = 0, recording = false;
const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function sizePreview() {
  const tp = tplById(state.tpl), F = FORMATS[state.fmt];
  pv.className = F.cls + (bgOf(tp) === 'transparent' ? ' checker' : '');
  const cssW = Math.max(200, pv.getBoundingClientRect().width || 340);
  pScale = Math.max(0.3, Math.min(1, (cssW * (window.devicePixelRatio || 1)) / F.W));
  pv.width = Math.round(F.W * pScale); pv.height = Math.round(F.H * pScale);
}
function frame(now) {
  const tp = tplById(state.tpl);
  const total = durOf(tp, vals(tp)) + 1.2;
  let t = tp.video ? ((now - playStart) / 1000) % total : 99;
  if (tp.video && reduce && !manualPlay) t = 99;
  render(pctx, tp, vals(tp), state.fmt, bgOf(tp), t, pScale);
  if (tp.video && !(reduce && !manualPlay)) raf = requestAnimationFrame(frame); else raf = 0;
}
let manualPlay = false;
function redraw(restart) {
  if (restart) playStart = performance.now();
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  raf = requestAnimationFrame(frame);
}

/* ---------- UI build ---------- */
const $ = (id) => document.getElementById(id);
function buildList() {
  const ul = $('tplList'); ul.textContent = '';
  TEMPLATES.forEach((tp) => {
    const li = document.createElement('li');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tpl'; b.setAttribute('aria-pressed', String(tp.id === state.tpl));
    const n = document.createElement('span'); n.textContent = tp.name;
    const k = document.createElement('span'); k.className = 'kind' + (tp.video ? ' video' : ''); k.textContent = tp.kind;
    b.append(n, k); b.addEventListener('click', () => selectTpl(tp.id, true));
    li.append(b); ul.append(li);
  });
}
function buildSegs() {
  const tp = tplById(state.tpl);
  const fs = $('fmtSeg'); fs.textContent = '';
  Object.entries(FORMATS).forEach(([k, f]) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = f.label; b.setAttribute('aria-pressed', String(k === state.fmt));
    b.addEventListener('click', () => { state.fmt = k; save(); buildSegs(); sizePreview(); redraw(true); });
    fs.append(b);
  });
  const bs = $('bgSeg'); bs.textContent = '';
  tp.bgs.forEach((k) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = BG_LABELS[k]; b.setAttribute('aria-pressed', String(k === bgOf(tp)));
    b.addEventListener('click', () => { state.bg[tp.id] = k; save(); buildSegs(); sizePreview(); redraw(false); });
    bs.append(b);
  });
  bs.hidden = tp.bgs.length < 2;
}
function buildForm() {
  const tp = tplById(state.tpl), v = vals(tp), box = $('fields'); box.textContent = '';
  tp.fields.forEach((f) => {
    const wrap = document.createElement('div'); wrap.className = 'field' + (f.wide ? ' wide' : '');
    const id = `f-${tp.id}-${f.id}`;
    const lab = document.createElement('label'); lab.htmlFor = id; lab.textContent = f.label;
    let el;
    if (f.type === 'select') { el = document.createElement('select'); f.options.forEach(([val, txt]) => { const o = document.createElement('option'); o.value = val; o.textContent = txt; el.append(o); }); }
    else if (f.type === 'textarea') { el = document.createElement('textarea'); el.rows = 6; }
    else { el = document.createElement('input'); el.type = 'text'; if (f.type === 'number') el.inputMode = 'decimal'; }
    el.id = id; el.value = v[f.id] ?? '';
    el.addEventListener('input', () => { state.vals[tp.id] = Object.assign({}, state.vals[tp.id], { [f.id]: el.value }); save(); if (!tplById(state.tpl).video || !raf) redraw(false); });
    wrap.append(lab, el);
    if (f.hint) { const h = document.createElement('span'); h.className = 'hint'; h.textContent = f.hint; wrap.append(h); }
    box.append(wrap);
  });
  $('formTitle').textContent = 'Edit ' + tp.name.toLowerCase();
}
function buildHeader() {
  const tp = tplById(state.tpl);
  $('edEyebrow').textContent = tp.name + ' · ' + tp.kind;
  $('edTitle').textContent = tp.title;
  $('edDesc').textContent = tp.desc;
  $('dlMain').textContent = tp.video ? 'Download video' : 'Download PNG';
  $('dlStill').hidden = !tp.video;
  $('replay').hidden = !tp.video;
  $('dlMain').disabled = tp.video && !canRecord;
  if (tp.video && !canRecord) setStatus('This browser cannot record video. You can still download the last frame as a PNG.', 'warn');
}
function selectTpl(id, fromClick) {
  state.tpl = id; save();
  try { history.replaceState(null, '', '#' + id); } catch (e) { location.hash = id; }
  manualPlay = false;
  setStatus(''); buildList(); buildSegs(); buildForm(); buildHeader();
  sizePreview(); redraw(true);
  if (fromClick && window.matchMedia('(max-width: 979px)').matches) $('edTitle').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

/* ---------- status ---------- */
function setStatus(msg, kind) { const s = $('status'); s.textContent = msg; s.className = 'status' + (kind ? ' ' + kind : ''); }

/* ---------- saving files ---------- */
let dl = null;
if (window.claude && typeof window.claude.use === 'function') { window.claude.use('downloads').then((d) => { dl = d; }).catch(() => { dl = null; }); }
async function saveFile(name, blob) {
  if (dl) {
    try { await dl.save({ filename: name, data: blob }); setStatus('Saved ' + name + '.', 'ok'); }
    catch (e) {
      const code = e && e.code;
      if (code === 'declined') setStatus('Download cancelled.', 'warn');
      else if (code === 'rate_limited') setStatus('Another download is waiting for your answer. Try again in a moment.', 'warn');
      else if (code === 'too_large') setStatus('That file is too large to save here. Try a shorter clip or a smaller size.', 'warn');
      else setStatus('Downloads are not available in this view. Open the page in a browser tab and try again.', 'warn');
    }
    return;
  }
  try {
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setStatus('Saving ' + name + '. If nothing downloads, open this page in Chrome or Safari.', 'ok');
  } catch (e) { setStatus('Downloads are not available in this view.', 'warn'); }
}
const fileBase = () => { const tp = tplById(state.tpl); return `trip360-${tp.id}-${state.fmt}`; };
async function fontsReady() { try { await Promise.all([document.fonts.load(`800 100px ${FONT_NUM}`), document.fonts.load(`700 100px ${FONT_NUM}`), document.fonts.load(`400 40px ${FONT_UI}`), document.fonts.load(`700 40px ${FONT_UI}`), document.fonts.load(`400 40px ${FONT_TAG}`), document.fonts.load(`700 40px ${FONT_TAG}`), document.fonts.load(`600 40px ${FONT_TAG}`), document.fonts.load(`700 40px ${FONT_POP}`), document.fonts.load(`500 40px ${FONT_POP}`)]); } catch (e) {} }
async function exportPNG(t) {
  await fontsReady();
  const tp = tplById(state.tpl), F = FORMATS[state.fmt], c = document.createElement('canvas'); c.width = F.W; c.height = F.H;
  render(c.getContext('2d'), tp, vals(tp), state.fmt, bgOf(tp), t, 1);
  const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
  if (!blob) { setStatus('Could not create the image. Try again.', 'warn'); return; }
  await saveFile(fileBase() + (tp.video ? '-still' : '') + '.png', blob);
}

/* ---------- recording ---------- */
const MIME = (() => {
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return null;
  const list = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return list.find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || null;
})();
const canRecord = !!MIME;
async function recordVideo() {
  if (recording || !MIME) return;
  await fontsReady();
  const tp = tplById(state.tpl), F = FORMATS[state.fmt], v = vals(tp), bg = bgOf(tp);
  const c = $('rec'); c.width = F.W; c.height = F.H; const ctx = c.getContext('2d');
  const dur = durOf(tp, v) + 0.3;
  render(ctx, tp, v, state.fmt, bg, 0, 1);
  const stream = c.captureStream(30);
  let rec;
  try { rec = new MediaRecorder(stream, { mimeType: MIME, videoBitsPerSecond: 12000000 }); }
  catch (e) { setStatus('This browser could not start recording.', 'warn'); return; }
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  recording = true; setBusy(true);
  $('progWrap').hidden = false; $('prog').style.width = '0%';
  setStatus('Recording. Keep this tab open, it takes about ' + Math.ceil(dur) + ' seconds.');
  const done = new Promise((res) => { rec.onstop = res; });
  rec.start(250);
  const t0 = performance.now();
  await new Promise((resolve) => {
    const step = () => {
      const t = (performance.now() - t0) / 1000;
      render(ctx, tp, v, state.fmt, bg, Math.min(t, dur), 1);
      $('prog').style.width = Math.min(100, (t / dur) * 100) + '%';
      if (t < dur) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
  setTimeout(() => { try { rec.stop(); } catch (e) {} }, 120);
  await done;
  stream.getTracks().forEach((tr) => tr.stop());
  recording = false; setBusy(false); $('progWrap').hidden = true;
  const type = MIME.split(';')[0]; const ext = type === 'video/mp4' ? 'mp4' : 'webm';
  const blob = new Blob(chunks, { type });
  if (!blob.size) { setStatus('The recording came out empty. Try again with this tab in front.', 'warn'); return; }
  await saveFile(fileBase() + '.' + ext, blob);
  if (ext === 'webm') setStatus($('status').textContent + ' This browser saves WebM. CapCut and TikTok accept it, or use Chrome or Safari for MP4.', $('status').className.includes('warn') ? 'warn' : 'ok');
}
function setBusy(b) { ['dlMain', 'dlStill', 'reset', 'replay'].forEach((id) => { $(id).disabled = b; }); document.querySelectorAll('.tpl').forEach((x) => { x.disabled = b; }); }

/* ---------- caption ---------- */
const DEFAULT_CAPTION = `Every drive, on the record. Track yours with Trip360.\nDownload: ${APP_LINK}\n#Trip360 #cars #roadtrip #drivetracker`;
$('caption').value = (() => { try { return localStorage.getItem(KEY + '-cap') || DEFAULT_CAPTION; } catch (e) { return DEFAULT_CAPTION; } })();
$('caption').addEventListener('input', () => { try { localStorage.setItem(KEY + '-cap', $('caption').value); } catch (e) {} });
$('copyCap').addEventListener('click', () => {
  const ta = $('caption'), st = $('capStatus');
  const fallback = () => { ta.focus(); ta.select(); st.textContent = 'Selected. Press copy on your keyboard.'; };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(() => { st.textContent = 'Copied.'; st.className = 'status ok'; }, fallback);
  else fallback();
});

/* ---------- events ---------- */
$('form').addEventListener('submit', (e) => e.preventDefault());
$('reset').addEventListener('click', () => { const tp = tplById(state.tpl); delete state.vals[tp.id]; save(); buildForm(); redraw(true); setStatus('Back to the example values.'); });
$('replay').addEventListener('click', () => { manualPlay = true; redraw(true); });
$('dlMain').addEventListener('click', () => { const tp = tplById(state.tpl); if (tp.video) recordVideo(); else exportPNG(99); });
$('dlStill').addEventListener('click', () => exportPNG(99));
let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { sizePreview(); redraw(false); }, 150); });
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== state.tpl && TEMPLATES.some((x) => x.id === h)) selectTpl(h, false); });
IMG.logo.onload = IMG.mark.onload = () => redraw(false);

/* ---------- start ---------- */
buildList(); buildSegs(); buildForm(); buildHeader(); sizePreview(); redraw(true);
fontsReady().then(() => redraw(false));
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => redraw(false));
})();
