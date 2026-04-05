// ── Token management ──────────────────────────
const Auth = {
  getToken: () => localStorage.getItem('pos_token'),
  getUser:  () => JSON.parse(localStorage.getItem('pos_user') || 'null'),
  set: (token, user) => {
    localStorage.setItem('pos_token', token);
    localStorage.setItem('pos_user', JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
  },
  isLoggedIn: () => !!localStorage.getItem('pos_token'),
  hasRole: (...roles) => {
    const user = Auth.getUser();
    return user && roles.includes(user.role);
  }
};

// ── API fetch wrapper ─────────────────────────
const api = {
  _base: '/api',

  async request(method, path, body = null) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    const token = Auth.getToken();
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(this._base + path, opts);
    const data = await res.json();

    if (res.status === 401 || res.status === 403) {
      Auth.clear();
      window.location.href = '/index.html';
      return;
    }
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },

  get:    (path)        => api.request('GET',    path),
  post:   (path, body)  => api.request('POST',   path, body),
  put:    (path, body)  => api.request('PUT',    path, body),
  delete: (path)        => api.request('DELETE', path),
};

// ── Toast notifications ───────────────────────
function toast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Format helpers ────────────────────────────
const fmt = {
  currency: (n) => {
    const symbol = window._posSettings?.store_currency || 'GHS';
    return `${symbol} ${parseFloat(n || 0).toFixed(2)}`;
  },
  date:     (d) => new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }),
  datetime: (d) => new Date(d).toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }),
};

// Load settings into window._posSettings once on page load (best-effort)
(async () => {
  try {
    if (Auth.isLoggedIn()) {
      window._posSettings = await api.get('/settings');
    }
  } catch(_) {}
})();

// ── Guard: redirect to login if not authenticated ──
function requireAuth() {
  if (!Auth.isLoggedIn()) {
    window.location.href = '/index.html';
  }
}

// ── Guard: redirect if role not allowed ──
function requireRole(...roles) {
  requireAuth();
  if (!Auth.hasRole(...roles)) {
    toast('Access denied for your role.', 'error');
    window.location.href = '/dashboard.html';
  }
}

// ── Populate topbar with user info ────────────
function initTopbar() {
  const user = Auth.getUser();
  if (!user) return;
  const nameEl = document.getElementById('topbar-name');
  const roleEl = document.getElementById('topbar-role');
  if (nameEl) nameEl.textContent = user.full_name || user.username;
  if (roleEl) roleEl.textContent = user.role;

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', async () => {
    try { await api.post('/auth/logout', {}); } catch(_) {}
    Auth.clear();
    window.location.href = '/index.html';
  });

  // Highlight active nav link
  const links = document.querySelectorAll('.sidebar nav a');
  links.forEach(a => {
    if (a.href === window.location.href) a.classList.add('active');
  });
}