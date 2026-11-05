// Invite landing: trip360.site/referral/CODE and /invite/CODE (rewritten to
// invite.html by vercel.json). Locally, where rewrites don't run, use
// /invite.html?code=CODE. Anything that is not a Trip360 code shows the plain page.

const CODE_RE = /^[A-HJ-NP-Z2-9]{6,12}$/;

function readCode() {
  const match = window.location.pathname.match(/^\/(?:referral|invite)\/([^/?#]+)\/?$/i);
  let raw = match ? match[1] : new URLSearchParams(window.location.search).get('code') || '';
  try {
    raw = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const code = raw.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

function legacyCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  area.remove();
  return ok;
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // permission denied or no user activation: try the old way
    }
  }
  if (!legacyCopy(text)) throw new Error('copy failed');
}

function selectCode(node) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

const code = readCode();

if (code) {
  document.getElementById('with-code').hidden = false;
  document.getElementById('no-code').hidden = true;
  document.getElementById('code').textContent = code;
  document.title = `You’re invited to Trip360 · code ${code}`;

  const open = document.getElementById('open-app');
  open.href = `trip360://referral/${code}`;
  open.hidden = false;

  const button = document.getElementById('copy');
  const status = document.getElementById('copy-status');
  const defaultStatus = status.textContent;
  let timer;
  button.addEventListener('click', async () => {
    try {
      await copyText(code);
      button.textContent = 'Copied';
      button.dataset.copied = 'true';
      status.textContent = `Copied ${code}. Paste it when Trip360 asks “Got an invite code?”.`;
    } catch {
      selectCode(document.getElementById('code'));
      status.textContent = `Couldn’t copy automatically. The code is selected: ${code}.`;
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      button.textContent = 'Copy code';
      delete button.dataset.copied;
      status.textContent = defaultStatus;
    }, 2400);
  });
} else {
  document.title = 'Trip360 · Every drive counts.';
}
