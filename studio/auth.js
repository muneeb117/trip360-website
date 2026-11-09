// Clipper Studio sign-in (D-175). Plain ES module, no build step.
//
// A creator signs in with the email and password the owner made for them in
// the admin panel (Creators). These logins are not Trip360 accounts: the
// database keeps them apart (`studio_creators`), so a creator never shows up
// in the app or its numbers. `studio_sign_in` answers a session token, kept in
// this browser; `studio_session` checks it on every visit, and only then is
// the studio script loaded. A creator the owner switches off loses every
// session, so the next visit shows this screen again.
//
// The studio holds no Trip360 data: this decides who can use it, it does not
// guard secrets. Stats stay behind the admin key, which creators never get.

import { PUBLISHABLE_KEY, SUPABASE_URL } from './config.js';

const STORE = 'trip360.studio.token';
const $ = (id) => document.getElementById(id);

const readToken = () => {
  try { return localStorage.getItem(STORE); } catch (e) { return null; }
};
const writeToken = (token) => {
  try {
    if (token) localStorage.setItem(STORE, token);
    else localStorage.removeItem(STORE);
  } catch (e) { /* private mode: the session lasts as long as the tab */ }
};

const MESSAGES = {
  wrong_password: 'That email and password do not match. Check them and try again.',
  disabled: 'Your studio access is switched off. Ask your Trip360 contact.',
  offline: 'Could not reach Trip360. Check your connection and try again.',
  failed: 'Something went wrong. Try again in a moment.',
};

class StudioError extends Error {
  constructor(code) { super(MESSAGES[code] || MESSAGES.failed); this.code = code; }
}

// The studio_* database functions, called with the publishable key only.
async function rpc(name, args) {
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(args),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch (e) {
    throw new StudioError('offline');
  }
  if (!res.ok) throw new StudioError('failed');
  return res.json().catch(() => null);
}

function show(view) {
  $('boot').hidden = view !== 'boot';
  $('gate').hidden = view !== 'gate';
  $('studio').hidden = view !== 'studio';
}

let studioLoaded = false;
function openStudio(creator) {
  $('who').textContent = creator.name || creator.email || '';
  show('studio');
  if (studioLoaded) return;
  studioLoaded = true;
  // Loaded only now, so it measures a visible page and never runs for a
  // visitor who is not signed in.
  const script = document.createElement('script');
  script.src = '/studio/studio.js';
  document.body.append(script);
}

function gate(message = '') {
  $('gateError').textContent = message;
  $('gateSubmit').disabled = false;
  show('gate');
}

$('gateForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = $('gateEmail').value.trim();
  const password = $('gatePassword').value;
  if (!email || !password) { gate('Enter your email and password.'); return; }
  $('gateSubmit').disabled = true;
  $('gateError').textContent = '';
  try {
    const answer = await rpc('studio_sign_in', { p_email: email, p_password: password });
    if (!answer || !answer.token) throw new StudioError((answer && answer.error) || 'failed');
    writeToken(answer.token);
    $('gatePassword').value = '';
    openStudio(answer);
  } catch (e) {
    gate(e instanceof StudioError ? e.message : MESSAGES.failed);
  }
});

$('signOut').addEventListener('click', async () => {
  const token = readToken();
  writeToken(null);
  if (token) { try { await rpc('studio_sign_out', { p_token: token }); } catch (e) { /* signed out here either way */ } }
  // A fresh page: the studio script goes with it.
  location.reload();
});

(async () => {
  const token = readToken();
  if (!token) { gate(); return; }
  try {
    const creator = await rpc('studio_session', { p_token: token });
    if (creator) { openStudio(creator); return; }
    // Expired, signed out elsewhere, or switched off.
    writeToken(null);
    gate();
  } catch (e) {
    // Offline: keep the token for the next try.
    gate(e instanceof StudioError ? e.message : MESSAGES.failed);
  }
})();
