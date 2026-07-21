// Account page: register + login, then bounce to the game.
const $ = id => document.getElementById(id);

function showTab(which) {
  const login = which === 'login';
  $('tabLogin').classList.toggle('on', login);
  $('tabRegister').classList.toggle('on', !login);
  $('tabLogin').setAttribute('aria-selected', String(login));
  $('tabRegister').setAttribute('aria-selected', String(!login));
  $('loginForm').classList.toggle('on', login);
  $('registerForm').classList.toggle('on', !login);
}
$('tabLogin').addEventListener('click', () => showTab('login'));
$('tabRegister').addEventListener('click', () => showTab('register'));

// deep link: account.html#signup opens the register tab
if (location.hash === '#signup') showTab('register');

function setMsg(el, text, kind) {
  el.textContent = text || '';
  el.className = 'msg' + (kind ? ' ' + kind : '');
}

async function post(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let data = {};
  try { data = await r.json(); } catch {}
  return { ok: r.ok, status: r.status, data };
}

// If already logged in, offer to jump straight into the game.
fetch('/api/me').then(r => r.ok ? r.json() : null).then(u => {
  if (u && u.username) {
    setMsg($('li_msg'), 'Already logged in as ' + u.username + '. Redirecting…', 'ok');
    setTimeout(() => location.href = './index.html', 900);
  }
}).catch(() => {});

// LOGIN
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('.primary');
  const username = $('li_user').value.trim();
  const password = $('li_pass').value;
  if (!username || !password) { setMsg($('li_msg'), 'Enter your username and password.', 'err'); return; }
  btn.disabled = true; setMsg($('li_msg'), 'Logging in…');
  const { ok, data } = await post('/api/login', { username, password });
  btn.disabled = false;
  if (!ok) { setMsg($('li_msg'), data.error || 'Could not log in.', 'err'); return; }
  setMsg($('li_msg'), 'Welcome back, ' + data.username + '!', 'ok');
  setTimeout(() => location.href = './index.html', 700);
});

// REGISTER
$('registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('.primary');
  const payload = {
    username: $('rg_user').value.trim(),
    email: $('rg_email').value.trim(),
    password: $('rg_pass').value,
    confirm: $('rg_confirm').value,
    acceptedTerms: $('rg_terms').checked,
    acceptedPrivacy: $('rg_privacy').checked
  };
  if (payload.password !== payload.confirm) { setMsg($('rg_msg'), 'The two passwords do not match.', 'err'); return; }
  if (!payload.acceptedTerms || !payload.acceptedPrivacy) { setMsg($('rg_msg'), 'Please accept the Terms and Privacy agreement.', 'err'); return; }
  btn.disabled = true; setMsg($('rg_msg'), 'Creating your account…');
  const { ok, data } = await post('/api/register', payload);
  btn.disabled = false;
  if (!ok) { setMsg($('rg_msg'), data.error || 'Could not create the account.', 'err'); return; }
  setMsg($('rg_msg'), 'Account created! Taking you to the game…', 'ok');
  setTimeout(() => location.href = './index.html', 800);
});

// Enable the Google buttons only when the server says OAuth is configured.
fetch('/api/google', { method: 'HEAD' }).then(r => {
  if (r.status === 503) return; // not set up yet — leave them as "coming soon"
  document.querySelectorAll('.google').forEach(btn => {
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
    btn.style.cursor = 'pointer';
    const soon = btn.querySelector('.soon');
    if (soon) soon.remove();
    btn.addEventListener('click', () => { location.href = '/api/google'; });
  });
}).catch(() => {});

// Simple in-page policy popups (kept short and honest).
$('openTerms').addEventListener('click', e => {
  e.preventDefault();
  alert('Skyseed Isles — Terms & Conditions\n\n'
    + '• This is a free game for children. Play nicely.\n'
    + '• We store only what the game needs: your username, email, a securely hashed password, and your in-game progress.\n'
    + '• No ads, no purchases, no selling of data.\n'
    + '• A parent should set up and supervise children’s accounts.');
});
$('openPrivacy').addEventListener('click', e => {
  e.preventDefault();
  alert('Skyseed Isles — Privacy agreement\n\n'
    + '• Your password is stored only as a one-way hash — nobody can read it back.\n'
    + '• Your email is used only to recover the account.\n'
    + '• Game progress (sparks, buddies, builds) is saved so it follows you between devices.\n'
    + '• You can ask to delete an account and its data at any time.');
});
