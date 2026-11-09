/* Trip360 Clipper Studio: Creator handles and Admin tabs.
   Saving uses window.claude (when opened as a Claude artifact). On the website it shows a
   'saving isn't available' notice until it is connected to the site's own database. */
/* ---------- Creator handles + Admin tabs ----------
   handles/<userId>   name + channels per platform; everyone reads, each creator writes their own
   contacts/<userId>  email or WhatsApp; the creator and admins read it
   review/<userId>    status + notes; admins only */
(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const APP_LINK = 'https://apps.apple.com/app/trip360-drive-tracker/id6805200692';
const PLATFORMS = [
  { id: 'tiktok', name: 'TikTok', url: (h) => 'https://www.tiktok.com/@' + h },
  { id: 'instagram', name: 'Instagram', url: (h) => 'https://www.instagram.com/' + h },
  { id: 'youtube', name: 'YouTube', url: (h) => (h.indexOf('/') >= 0 ? 'https://www.youtube.com/' + h : 'https://www.youtube.com/@' + h) },
  { id: 'facebook', name: 'Facebook', url: (h) => 'https://www.facebook.com/' + h },
  { id: 'x', name: 'X', url: (h) => 'https://x.com/' + h },
  { id: 'snapchat', name: 'Snapchat', url: (h) => 'https://www.snapchat.com/add/' + h },
  { id: 'threads', name: 'Threads', url: (h) => 'https://www.threads.net/@' + h },
];
const STATUSES = [['pending', 'Pending'], ['approved', 'Approved'], ['paused', 'Paused'], ['rejected', 'Rejected']];

/* ----- helpers ----- */
function normHandle(v) {
  let s = String(v || '').trim();
  if (!s) return '';
  if (/^https?:/i.test(s) || /[/.][a-z]{2,}\//i.test(s)) {
    const segs = s.replace(/^https?:\/\//i, '').split(/[?#]/)[0].split('/').slice(1).filter(Boolean);
    if (!segs.length) return '';
    if (segs[0] === 'add' && segs[1]) s = segs[1];
    else if (['channel', 'c', 'user'].indexOf(segs[0]) >= 0 && segs[1]) s = segs[0] + '/' + segs[1];
    else s = segs[0];
  }
  s = s.replace(/^@+/, '').replace(/\s+/g, '');
  return /^[A-Za-z0-9._\-/]{1,80}$/.test(s) ? s : '';
}
const looksLikeLink = (s) => /^https?:\/\//i.test(s) || /^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(s);
function safeUrl(u) {
  let s = String(u || '').trim(); if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { const x = new URL(s); return (x.protocol === 'https:' || x.protocol === 'http:') && x.hostname.indexOf('.') > 0 ? x.href : ''; } catch (e) { return ''; }
}
function parseFollowers(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, '');
  if (!s) return null;
  const m = s.match(/^(\d+(?:\.\d+)?)([km])?$/); if (!m) return NaN;
  return Math.round(parseFloat(m[1]) * (m[2] === 'm' ? 1e6 : m[2] === 'k' ? 1e3 : 1));
}
const compact = (n) => (n == null || !isFinite(n) ? '' : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K' : String(n));
const showHandle = (h) => (!h ? '' : String(h).indexOf('/') >= 0 ? String(h) : '@' + h);
const fmtDay = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
/* Older entries stored a plain handle string per platform; read both shapes. */
function chans(d) {
  const out = {}; const src = (d && (d.channels || d.handles)) || {};
  PLATFORMS.forEach((p) => { const v = src[p.id]; if (!v) return; out[p.id] = typeof v === 'string' ? { handle: v } : v; });
  return out;
}
const linkOf = (p, c) => safeUrl(c.link) || (c.handle ? p.url(c.handle) : '');
const totalFollowers = (d) => { const cs = chans(d); let t = 0, any = false; PLATFORMS.forEach((p) => { const f = cs[p.id] && cs[p.id].followers; if (typeof f === 'number' && isFinite(f)) { t += f; any = true; } }); return any ? t : null; };
const searchText = (d, extra) => [d.name, extra || ''].concat(PLATFORMS.map((p) => { const c = chans(d)[p.id]; return c ? [c.handle, c.channel].join(' ') : ''; })).join(' ').toLowerCase();

const H = { db: null, me: null, isAdmin: false, canWrite: null, readOnly: false, state: 'connecting', list: [], loaded: false, slow: false,
  contacts: {}, reviews: {}, plat: 'all', q: '', aStatus: 'all', aq: '', dirty: false, busy: false };

/* ----- tabs ----- */
const TABS = ['clips', 'handles', 'admin'];
function showTab(which, push) {
  if (which === 'admin' && !H.isAdmin) which = 'handles';
  const panel = { clips: 'viewClips', handles: 'viewHandles', admin: 'viewAdmin' };
  TABS.forEach((t) => { $(panel[t]).hidden = t !== which; $('tab-' + t).setAttribute('aria-selected', String(t === which)); });
  if (push) { try { history.replaceState(null, '', which === 'clips' ? location.pathname + location.search : '#' + which); } catch (e) { /* ignore */ } }
  if (which === 'clips') window.dispatchEvent(new Event('resize')); // lets the clip preview resize after being hidden
}
TABS.forEach((t) => $('tab-' + t).addEventListener('click', () => showTab(t, true)));
document.querySelector('.tabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const vis = TABS.filter((t) => !$('tab-' + t).hidden); const i = vis.findIndex((t) => $('tab-' + t) === document.activeElement); if (i < 0) return;
  const n = vis[(i + (e.key === 'ArrowRight' ? 1 : vis.length - 1)) % vis.length]; $('tab-' + n).focus(); showTab(n, true);
});
const hashTab = () => (location.hash === '#handles' ? 'handles' : location.hash === '#admin' ? 'admin' : 'clips');
window.addEventListener('hashchange', () => { if (location.hash === '#handles' || location.hash === '#admin') showTab(hashTab(), false); });
showTab(hashTab(), false);

/* ----- creator form ----- */
$('hPlatformFields').innerHTML = PLATFORMS.map((p) => `<details class="plat" id="pl-${p.id}">
  <summary><span class="pname">${esc(p.name)}</span><span class="psum" id="ps-${p.id}">Not added</span></summary>
  <div class="fields">
    <div class="field"><label for="h-${p.id}-handle">Handle</label><div class="at"><input id="h-${p.id}-handle" maxlength="160" autocapitalize="off" spellcheck="false" placeholder="handle"></div></div>
    <div class="field"><label for="h-${p.id}-channel">Channel name</label><input id="h-${p.id}-channel" maxlength="100" placeholder="As it shows on ${esc(p.name)}"></div>
    <div class="field"><label for="h-${p.id}-link">Channel link</label><input id="h-${p.id}-link" type="url" inputmode="url" maxlength="300" autocapitalize="off" spellcheck="false" placeholder="Filled in from your handle"></div>
    <div class="field"><label for="h-${p.id}-followers">Followers</label><input id="h-${p.id}-followers" inputmode="decimal" maxlength="14" placeholder="For example: 12.5k"></div>
  </div></details>`).join('');
$('appLink').textContent = APP_LINK;
const mine = () => (H.me ? H.list.find((d) => d.id === H.me) : null);
const canSave = () => H.state === 'ready' && !!H.me && !H.readOnly && H.canWrite !== false;
function setStatus(id, msg, kind) { const s = $(id); s.textContent = msg; s.className = 'status' + (kind ? ' ' + kind : ''); }
function platSummary(p) {
  const h = $('h-' + p.id + '-handle').value.trim(), ch = $('h-' + p.id + '-channel').value.trim(), f = parseFollowers($('h-' + p.id + '-followers').value), l = $('h-' + p.id + '-link').value.trim();
  const parts = [ch, h ? showHandle(normHandle(h) || h.replace(/^@+/, '')) : '', f != null && isFinite(f) ? compact(f) + ' followers' : ''].filter(Boolean);
  $('ps-' + p.id).textContent = parts.length ? parts.join(' · ') : l ? 'Link added' : 'Not added';
  $('ps-' + p.id).classList.toggle('on', !!(parts.length || l));
  const lk = $('h-' + p.id + '-link'); const hh = normHandle(h); lk.placeholder = hh ? p.url(hh) : 'Filled in from your handle';
}
function fillForm() {
  if (H.dirty) return; // never overwrite what someone is typing
  const m = mine(); const cs = chans(m);
  $('h-name').value = m ? m.name || '' : '';
  $('h-contact').value = (H.me && H.contacts[H.me] && H.contacts[H.me].contact) || '';
  PLATFORMS.forEach((p) => {
    const c = cs[p.id] || {};
    $('h-' + p.id + '-handle').value = c.handle || ''; $('h-' + p.id + '-channel').value = c.channel || '';
    $('h-' + p.id + '-link').value = c.link || ''; $('h-' + p.id + '-followers').value = typeof c.followers === 'number' ? String(c.followers) : '';
    platSummary(p);
    if (cs[p.id] && !$('pl-' + p.id).dataset.touched) $('pl-' + p.id).open = true;
  });
}
function renderForm() {
  const m = mine(); const ok = canSave();
  $('hFormTitle').textContent = m ? 'Your channels' : 'Add your channels';
  $('hSave').textContent = m ? 'Save changes' : 'Save my channels';
  $('hRemove').hidden = !(m && ok);
  $('hForm').querySelectorAll('input').forEach((el) => { el.disabled = !ok; });
  $('hSave').disabled = !ok || H.busy;
  let note = '';
  if (H.state === 'none') note = '<div class="notice"><b>Saving isn’t available here.</b> Open Clipper Studio from Claude while signed in to add your channels.</div>';
  else if (H.state === 'ready' && !H.me) note = '<div class="notice"><b>Sign in to add your channels.</b> They are saved under your Claude account.</div>';
  else if (H.state === 'ready' && (H.readOnly || H.canWrite === false)) note = '<div class="notice"><b>View only.</b> Ask the Trip360 team for Contributor access to add your channels.</div>';
  $('hNotice').innerHTML = note;
  fillForm();
}
function chanChips(d, only) {
  const cs = chans(d);
  const html = PLATFORMS.filter((p) => cs[p.id] && (!only || only === 'all' || only === p.id)).map((p) => {
    const c = cs[p.id]; const href = linkOf(p, c);
    const label = [c.channel, showHandle(c.handle)].filter(Boolean).join(' · ') || 'Channel';
    const inner = `<b>${esc(p.name)}</b><span>${esc(label)}</span>${typeof c.followers === 'number' ? `<em>${esc(compact(c.followers))}</em>` : ''}`;
    return href ? `<a class="plink" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : `<span class="plink">${inner}</span>`;
  }).join('');
  return html || '<span class="status">No channels</span>';
}
function renderList() {
  const counts = PLATFORMS.map((p) => ({ p, n: H.list.filter((d) => chans(d)[p.id]).length })).filter((c) => c.n > 0).sort((a, b) => b.n - a.n);
  const reach = H.list.reduce((a, d) => a + (totalFollowers(d) || 0), 0);
  $('hStats').innerHTML = `<div class="stat"><div class="k">Creators</div><div class="v">${H.list.length}</div></div><div class="stat"><div class="k">Total followers</div><div class="v">${reach ? esc(compact(reach)) : '0'}</div></div>` +
    counts.slice(0, 3).map((c) => `<div class="stat"><div class="k">On ${esc(c.p.name)}</div><div class="v">${c.n}</div></div>`).join('');
  $('hChips').innerHTML = [{ id: 'all', name: 'All' }].concat(PLATFORMS).map((p) => `<button type="button" class="chipf" data-plat="${p.id}" aria-pressed="${H.plat === p.id}">${esc(p.name)}</button>`).join('');
  if (H.state === 'none') { $('hList').innerHTML = '<div class="empty"><strong>The channel list isn’t available here.</strong>Open Clipper Studio from Claude while signed in to see it.</div>'; return; }
  if (!H.loaded) { $('hList').innerHTML = `<p class="status${H.slow ? ' warn' : ''}">${H.slow ? 'Still loading. Check your connection.' : 'Loading channels…'}</p>`; return; }
  const q = H.q.trim().toLowerCase();
  let rows = H.list.slice().sort((a, b) => (a.id === H.me ? -1 : b.id === H.me ? 1 : String(a.name || '').localeCompare(String(b.name || ''))));
  if (H.plat !== 'all') rows = rows.filter((d) => chans(d)[H.plat]);
  if (q) rows = rows.filter((d) => searchText(d).indexOf(q) >= 0);
  if (!rows.length) { $('hList').innerHTML = H.list.length ? '<div class="empty"><strong>No creators match.</strong>Try another platform or search.</div>' : '<div class="empty"><strong>No channels yet.</strong>Be the first: add yours above.</div>'; return; }
  $('hList').innerHTML = `<ul class="people">${rows.map((d) => { const t = totalFollowers(d); return `<li class="person${d.id === H.me ? ' me' : ''}"><div class="person-top"><span class="person-name">${esc(d.name || 'No name given')}${d.id === H.me ? '<span class="you">YOU</span>' : ''}</span><span class="person-meta">${t != null ? esc(compact(t)) + ' followers' : esc(d.updatedAt ? fmtDay(d.updatedAt) : '')}</span></div>
    <div class="plinks">${chanChips(d, H.plat)}</div></li>`; }).join('')}</ul>`;
}

/* ----- admin ----- */
const statusOf = (id) => (H.reviews[id] && H.reviews[id].status) || 'pending';
function renderAdmin() {
  $('tab-admin').hidden = !H.isAdmin;
  if (!H.isAdmin) { if (!$('viewAdmin').hidden) showTab('handles', true); return; }
  const by = {}; STATUSES.forEach((s) => { by[s[0]] = H.list.filter((d) => statusOf(d.id) === s[0]).length; });
  const reach = H.list.reduce((a, d) => a + (totalFollowers(d) || 0), 0);
  const withContact = H.list.filter((d) => H.contacts[d.id] && H.contacts[d.id].contact).length;
  $('aStats').innerHTML = [['Creators', H.list.length], ['Total followers', reach ? compact(reach) : '0'], ['Pending review', by.pending], ['Approved', by.approved], ['With contact', withContact]]
    .map((s) => `<div class="stat"><div class="k">${esc(s[0])}</div><div class="v">${esc(s[1])}</div></div>`).join('');
  $('aChips').innerHTML = [['all', 'All']].concat(STATUSES).map((s) => `<button type="button" class="chipf" data-astatus="${s[0]}" aria-pressed="${H.aStatus === s[0]}">${esc(s[1])}${s[0] !== 'all' ? ' ' + (by[s[0]] || 0) : ''}</button>`).join('');
  if (!H.loaded) { $('aList').innerHTML = '<p class="status">Loading creators…</p>'; return; }
  const q = H.aq.trim().toLowerCase();
  let rows = H.list.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  if (H.aStatus !== 'all') rows = rows.filter((d) => statusOf(d.id) === H.aStatus);
  if (q) rows = rows.filter((d) => searchText(d, H.contacts[d.id] && H.contacts[d.id].contact).indexOf(q) >= 0);
  if (!rows.length) { $('aList').innerHTML = H.list.length ? '<div class="empty"><strong>No creators match.</strong>Try another status or search.</div>' : '<div class="empty"><strong>No creators yet.</strong>Share Clipper Studio with creators. Their channels show up here as soon as they save them.</div>'; return; }
  // Keep notes someone is typing: only redraw cards that aren't being edited.
  const editing = document.activeElement && document.activeElement.closest && document.activeElement.closest('.acard');
  const keepId = editing ? editing.getAttribute('data-id') : null;
  const keep = keepId ? { notes: editing.querySelector('textarea').value, status: editing.querySelector('select').value, sel: [editing.querySelector('textarea').selectionStart, editing.querySelector('textarea').selectionEnd], focusNotes: document.activeElement.tagName === 'TEXTAREA' } : null;
  $('aList').innerHTML = rows.map((d) => {
    const cs = chans(d); const rv = H.reviews[d.id] || {}; const st = statusOf(d.id); const t = totalFollowers(d);
    const contact = (H.contacts[d.id] && H.contacts[d.id].contact) || '';
    const prow = PLATFORMS.filter((p) => cs[p.id]).map((p) => { const c = cs[p.id]; const href = linkOf(p, c); return `<tr><th scope="row">${esc(p.name)}</th><td>${esc(c.channel || '')}</td><td>${esc(showHandle(c.handle))}</td><td class="n">${typeof c.followers === 'number' ? esc(c.followers.toLocaleString('en-US')) : ''}</td><td>${href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">Open</a>` : ''}</td></tr>`; }).join('');
    return `<article class="acard" data-id="${esc(d.id)}">
      <div class="acard-top"><div><div class="person-name">${esc(d.name || 'No name given')}</div>
        <div class="person-meta">${contact ? esc(contact) : 'No contact given'} · ${t != null ? esc(t.toLocaleString('en-US')) + ' followers' : 'No follower counts'} · updated ${esc(d.updatedAt ? fmtDay(d.updatedAt) : '')}</div></div>
        <span class="st st-${esc(st)}">${esc((STATUSES.find((s) => s[0] === st) || STATUSES[0])[1])}</span></div>
      <div class="atbl"><table><thead><tr><th scope="col">Platform</th><th scope="col">Channel name</th><th scope="col">Handle</th><th scope="col" class="n">Followers</th><th scope="col">Link</th></tr></thead><tbody>${prow || '<tr><td colspan="5">No channels</td></tr>'}</tbody></table></div>
      <div class="arev">
        <div class="field"><label for="as-${esc(d.id)}">Review status</label><select id="as-${esc(d.id)}">${STATUSES.map((s) => `<option value="${s[0]}"${s[0] === st ? ' selected' : ''}>${s[1]}</option>`).join('')}</select></div>
        <div class="field wide"><label for="an-${esc(d.id)}">Private notes</label><textarea id="an-${esc(d.id)}" rows="2" maxlength="2000" placeholder="Only admins see these notes">${esc(rv.notes || '')}</textarea></div>
      </div>
      <div class="h-actions"><button type="button" class="btn small primary" data-asave="${esc(d.id)}">Save review</button><button type="button" class="btn small danger" data-arm="${esc(d.id)}">Remove creator</button><span class="status" id="ast-${esc(d.id)}" aria-live="polite"></span></div>
    </article>`;
  }).join('');
  if (keep) {
    const card = $('aList').querySelector(`.acard[data-id="${CSS.escape(keepId)}"]`);
    if (card) { const ta = card.querySelector('textarea'); ta.value = keep.notes; card.querySelector('select').value = keep.status; if (keep.focusNotes) { ta.focus(); try { ta.setSelectionRange(keep.sel[0], keep.sel[1]); } catch (e) { /* ignore */ } } else card.querySelector('select').focus(); }
  }
}
function renderAll() { renderForm(); renderList(); renderAdmin(); }

/* ----- writes ----- */
async function write(fn) {
  for (let i = 0; i < 2; i++) {
    try { await fn(H.db); return true; } catch (e) {
      const code = e && e.code;
      if (code === 'unavailable' && i === 0) { await new Promise((r) => setTimeout(r, 400 + Math.random() * 600)); continue; }
      if (code === 'invalid_argument' && H.canWrite !== true) { H.readOnly = true; renderAll(); return 'Your access doesn’t allow saving. Ask the Trip360 team for Contributor access.'; }
      if (code === 'quota_exceeded') return 'Storage is full. Remove old entries first.';
      if (code === 'revoked') { H.state = 'none'; renderAll(); return 'Access ended. Reload the page.'; }
      return 'That didn’t save. Check your connection and try again.';
    }
  }
  return 'That didn’t save. Try again.';
}
$('hPlatformFields').addEventListener('toggle', (e) => { if (e.target.classList && e.target.classList.contains('plat')) e.target.dataset.touched = '1'; }, true);
$('hForm').addEventListener('input', (e) => {
  H.dirty = true; setStatus('hStatus', 'Unsaved changes');
  const p = PLATFORMS.find((x) => e.target.id && e.target.id.indexOf('h-' + x.id + '-') === 0); if (p) platSummary(p);
});
$('hForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!canSave() || H.busy) return;
  const name = $('h-name').value.trim();
  if (!name) { setStatus('hStatus', 'Enter your name so the team knows whose channels these are.', 'warn'); $('h-name').focus(); return; }
  const channels = {}; const probs = [];
  PLATFORMS.forEach((p) => {
    const rawH = $('h-' + p.id + '-handle').value.trim(), ch = $('h-' + p.id + '-channel').value.trim(), rawL = $('h-' + p.id + '-link').value.trim(), rawF = $('h-' + p.id + '-followers').value;
    if (!rawH && !ch && !rawL && !String(rawF).trim()) return;
    let handle = rawH ? normHandle(rawH) : '';
    if (rawH && !handle) { probs.push(`the ${p.name} handle`); return; }
    let link = '';
    if (rawL) { link = safeUrl(rawL); if (!link) { probs.push(`the ${p.name} link`); return; } if (!handle) handle = normHandle(link); }
    const f = parseFollowers(rawF); if (f != null && !isFinite(f)) { probs.push(`the ${p.name} followers (use a number like 12500 or 12.5k)`); return; }
    if (!handle && !link) { probs.push(`${p.name}: add a handle or a link`); return; }
    const c = {}; if (handle) c.handle = handle; if (ch) c.channel = ch; if (link) c.link = link; if (f != null) c.followers = f;
    channels[p.id] = c;
  });
  if (probs.length) { setStatus('hStatus', 'Check ' + probs.join(', ') + '.', 'warn'); return; }
  if (!Object.keys(channels).length) { setStatus('hStatus', 'Add at least one channel.', 'warn'); return; }
  const m = mine(); const now = new Date().toISOString();
  const contact = $('h-contact').value.trim(); const had = H.contacts[H.me] && H.contacts[H.me].contact;
  H.busy = true; renderForm(); setStatus('hStatus', 'Saving…');
  let res = await write((db) => db.doc('handles/' + H.me).set({ name, channels, updatedAt: now, createdAt: (m && m.createdAt) || now }));
  if (res === true && (contact || had) && contact !== (had || '')) res = await write((db) => (contact ? db.doc('contacts/' + H.me).set({ contact, updatedAt: now }) : db.doc('contacts/' + H.me).delete()));
  H.busy = false;
  if (res === true) { if (contact) H.contacts[H.me] = { contact, updatedAt: now }; else delete H.contacts[H.me]; H.dirty = false; renderAll(); setStatus('hStatus', 'Saved. The Trip360 team can see your channels now.', 'ok'); }
  else { renderForm(); setStatus('hStatus', res, 'warn'); }
});
$('hRemove').addEventListener('click', async () => {
  if (!canSave() || !mine()) return;
  const b = $('hRemove');
  if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Click again to remove'; setTimeout(() => { b.dataset.confirm = ''; b.textContent = 'Remove my channels'; }, 4000); return; }
  b.dataset.confirm = ''; b.textContent = 'Remove my channels';
  let res = await write((db) => db.doc('handles/' + H.me).delete());
  if (res === true && H.contacts[H.me]) res = await write((db) => db.doc('contacts/' + H.me).delete());
  if (res === true) { delete H.contacts[H.me]; H.dirty = false; renderAll(); setStatus('hStatus', 'Your channels were removed.', 'ok'); } else setStatus('hStatus', res, 'warn');
});
$('hChips').addEventListener('click', (e) => { const b = e.target.closest('[data-plat]'); if (!b) return; H.plat = b.getAttribute('data-plat'); renderList(); });
let qt = 0; $('hSearch').addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => { H.q = $('hSearch').value; renderList(); }, 150); });
$('aChips').addEventListener('click', (e) => { const b = e.target.closest('[data-astatus]'); if (!b) return; H.aStatus = b.getAttribute('data-astatus'); renderAdmin(); });
let aqt = 0; $('aSearch').addEventListener('input', () => { clearTimeout(aqt); aqt = setTimeout(() => { H.aq = $('aSearch').value; renderAdmin(); }, 150); });
$('aList').addEventListener('click', async (e) => {
  const sv = e.target.closest('[data-asave]');
  if (sv) {
    const id = sv.getAttribute('data-asave'); const card = sv.closest('.acard');
    const status = card.querySelector('select').value; const notes = card.querySelector('textarea').value.trim();
    sv.disabled = true; setStatus('ast-' + id, 'Saving…');
    const res = await write((db) => db.doc('review/' + id).set({ status, notes, updatedAt: new Date().toISOString() }));
    sv.disabled = false;
    if (res === true) { const el = $('ast-' + id); if (el) setStatus('ast-' + id, 'Saved.', 'ok'); } else setStatus('ast-' + id, res, 'warn');
    return;
  }
  const rm = e.target.closest('[data-arm]');
  if (rm) {
    const id = rm.getAttribute('data-arm');
    if (rm.dataset.confirm !== '1') { rm.dataset.confirm = '1'; rm.textContent = 'Click again to remove'; setStatus('ast-' + id, 'Removes their channels, contact and review for everyone.', 'warn'); return; }
    rm.disabled = true;
    let res = await write((db) => db.doc('handles/' + id).delete());
    if (res === true && H.contacts[id]) res = await write((db) => db.doc('contacts/' + id).delete());
    if (res === true && H.reviews[id]) res = await write((db) => db.doc('review/' + id).delete());
    if (res !== true) { rm.disabled = false; setStatus('ast-' + id, res, 'warn'); } else setStatus('aStatus', 'Creator removed.', 'ok');
  }
});
$('copyApp').addEventListener('click', () => {
  const fallback = () => { const r = document.createRange(); r.selectNodeContents($('appLink')); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); setStatus('appStatus', 'Selected. Press copy on your keyboard.'); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(APP_LINK).then(() => setStatus('appStatus', 'Copied.', 'ok'), fallback); else fallback();
});
async function saveCsv(name, rows, statusId) {
  const cell = (v) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const text = rows.map((r) => r.map(cell).join(',')).join('\n');
  let dl = null; try { dl = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({ filename: name, data: new Blob([text], { type: 'text/csv' }) }); setStatus(statusId, 'Saved ' + name + '.', 'ok'); return; }
    catch (e) { if (e && e.code === 'declined') { setStatus(statusId, 'Download cancelled.', 'warn'); return; } }
  }
  try { const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); setStatus(statusId, 'Saving ' + name + '.', 'ok'); }
  catch (e) { setStatus(statusId, 'Downloads aren’t available in this view.', 'warn'); }
}
$('aExport').addEventListener('click', () => {
  const head = ['Name', 'Contact', 'Status', 'Notes', 'Total followers'];
  PLATFORMS.forEach((p) => head.push(p.name + ' handle', p.name + ' channel name', p.name + ' link', p.name + ' followers'));
  head.push('Updated');
  const rows = [head].concat(H.list.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))).map((d) => {
    const cs = chans(d); const rv = H.reviews[d.id] || {};
    const r = [d.name || '', (H.contacts[d.id] && H.contacts[d.id].contact) || '', (STATUSES.find((s) => s[0] === statusOf(d.id)) || STATUSES[0])[1], rv.notes || '', totalFollowers(d) == null ? '' : totalFollowers(d)];
    PLATFORMS.forEach((p) => { const c = cs[p.id]; r.push(c ? showHandle(c.handle) : '', c ? c.channel || '' : '', c ? linkOf(p, c) : '', c && typeof c.followers === 'number' ? c.followers : ''); });
    r.push(d.updatedAt ? String(d.updatedAt).slice(0, 10) : '');
    return r;
  }));
  saveCsv('trip360-creators-admin.csv', rows, 'aStatus');
});

/* ----- data ----- */
renderAll();
(async () => {
  const c = window.claude;
  if (!c || typeof c.use !== 'function') { H.state = 'none'; renderAll(); return; }
  const safe = (p) => Promise.resolve(p).catch(() => null);
  const [db, user] = await Promise.all([safe(c.use('db')), safe(c.use('user'))]);
  if (!db) { H.state = 'none'; renderAll(); return; }
  H.db = db; H.state = 'ready';
  if (user) {
    try { H.me = await user.id(); } catch (e) { H.me = null; }
    try { H.canWrite = await user.can('data.write'); } catch (e) { H.canWrite = null; }
    try { H.isAdmin = !!(await user.canEdit()); } catch (e) { H.isAdmin = false; }
  }
  const timer = setTimeout(() => { if (!H.loaded) { H.slow = true; renderList(); } }, 10000);
  const onErr = (e) => { clearTimeout(timer); if (e && e.code === 'revoked') H.state = 'none'; H.loaded = true; renderAll(); };
  db.collection('handles').onSnapshot((snap) => {
    H.list = snap.docs.map((d) => Object.assign({}, d.data(), { id: d.id }));
    H.loaded = true; H.slow = false; clearTimeout(timer); renderAll();
  }, onErr);
  const toMap = (snap) => { const m = {}; snap.docs.forEach((d) => { m[d.id] = Object.assign({}, d.data()); }); return m; };
  if (H.isAdmin) {
    db.collection('contacts').onSnapshot((snap) => { H.contacts = toMap(snap); renderAll(); }, () => {});
    db.collection('review').onSnapshot((snap) => { H.reviews = toMap(snap); renderAdmin(); }, () => {});
  } else if (H.me) {
    db.doc('contacts/' + H.me).onSnapshot((snap) => { if (snap.exists) H.contacts[H.me] = Object.assign({}, snap.data()); else delete H.contacts[H.me]; renderForm(); }, () => {});
  }
  renderAll();
  if (location.hash === '#admin') showTab('admin', false);
})();
})();
