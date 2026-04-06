function injectShell(activePage = '') {
  const nav = [
    { id: 'dashboard', icon: '◈', label: 'Dashboard',       href: '/dashboard.html', section: 'Overview' },
    { id: 'pos',       icon: '⊞', label: 'POS / Cashier',   href: '/pos.html' },
    { id: 'sales',     icon: '◑', label: 'Sales History',   href: '/sales.html' },
    { id: 'products',  icon: '◻', label: 'Products',        href: '/products.html',  section: 'Catalog' },
    { id: 'inventory', icon: '⊟', label: 'Inventory',       href: '/inventory.html' },
    { id: 'orders',    icon: '◫', label: 'Purchase Orders', href: '/orders.html',    adminOnly: true },
    { id: 'customers', icon: '◯', label: 'Customers',       href: '/customers.html', section: 'Customers' },
    { id: 'loyalty',   icon: '⭐', label: 'Loyalty Points',  href: '/loyalty.html' },
    { id: 'coupons',   icon: '⊕', label: 'Coupons',         href: '/coupons.html',   adminOnly: true },
    { id: 'expenses',  icon: '💸', label: 'Expenses',        href: '/expenses.html',  section: 'Finance' },
    { id: 'reports',   icon: '◇', label: 'Reports',         href: '/reports.html',   adminOnly: true },
    { id: 'closing',   icon: '◐', label: 'Closing Report',  href: '/closing.html',   adminOnly: true },
    { id: 'audit',     icon: '🔍', label: 'Audit Log',       href: '/audit.html',     adminOnly: true, section: 'Admin' },
    { id: 'users',     icon: '◎', label: 'Users',           href: '/users.html',     adminOnly: true },
    { id: 'settings',  icon: '⚙', label: 'Settings',        href: '/settings.html',  adminOnly: true },
  ];

  const user = Auth.getUser();
  const isAdminOrManager = user && (user.role === 'admin' || user.role === 'manager');

  let navHTML = '';
  let lastSection = null;
  nav
    .filter(item => !item.adminOnly || isAdminOrManager)
    .forEach(item => {
      // if (item.section && item.section !== lastSection) {
      //   navHTML += `<div class="nav-section">${item.section}</div>`;
      //   lastSection = item.section;
      // }
      navHTML += `
        <a href="${item.href}" class="${item.id === activePage ? 'active' : ''}" title="${item.label}">
          <span class="icon">${item.icon}</span>
          <span class="label">${item.label}</span>
        </a>`;
    });

  // Inject the style block
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    /* ── Fixed topbar ───────────────────────────────── */
    .app-shell { display: block; }

    .topbar {
      position: fixed;
      top: 0; left: 0; right: 0;
      height: var(--topbar-h);
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      padding: 0 20px 0 calc(var(--sidebar-collapsed) + 16px);
      gap: 12px;
      z-index: 100;
      box-shadow: var(--shadow-xs);
    }

    /* ── Collapsible sidebar ─────────────────────────── */
    :root {
      --sidebar-collapsed: 52px;
      --sidebar-expanded:  232px;
    }

    .sidebar {
      position: fixed;
      top: var(--topbar-h);
      left: 0;
      bottom: 0;
      width: var(--sidebar-collapsed);
      background: var(--surface);
      border-right: 1px solid var(--border);
      overflow: hidden;
      overflow-y: auto;
      z-index: 90;
      transition: width 0.22s cubic-bezier(0.4,0,0.2,1),
                  box-shadow 0.22s ease;
      display: flex;
      flex-direction: column;
      padding: 10px 0;
      gap: 0;
    }

    /* Expand on hover */
    .sidebar:hover {
      width: var(--sidebar-expanded);
      box-shadow: 4px 0 24px rgba(15,21,35,0.08);
    }

    /* Nav section labels — hidden when collapsed */
    .sidebar .nav-section {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--text-light);
      padding: 12px 14px 4px;
      white-space: nowrap;
      overflow: hidden;
      opacity: 0;
      height: 0;
      padding-top: 0;
      padding-bottom: 0;
      transition: opacity 0.15s, height 0.15s, padding 0.15s;
    }

    .sidebar:hover .nav-section {
      opacity: 1;
      height: 28px;
      padding: 12px 14px 4px;
    }

    /* Nav links */
    .sidebar nav a {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 14px;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      border-radius: 0;
      transition: background 0.12s, color 0.12s;
      white-space: nowrap;
      overflow: hidden;
      position: relative;
    }

    .sidebar nav a:hover {
      color: var(--text);
      background: var(--surface2);
    }

    .sidebar nav a.active {
      color: var(--accent);
      background: var(--accent-s);
      font-weight: 600;
    }

    /* Active indicator bar */
    .sidebar nav a.active::before {
      content: '';
      position: absolute;
      left: 0; top: 4px; bottom: 4px;
      width: 3px;
      background: var(--accent);
      border-radius: 0 3px 3px 0;
    }

    .sidebar nav a .icon {
      font-size: 16px;
      width: 24px;
      text-align: center;
      flex-shrink: 0;
    }

    .sidebar nav a .label {
      opacity: 0;
      transition: opacity 0.15s 0.05s;
      pointer-events: none;
    }

    .sidebar:hover nav a .label {
      opacity: 1;
    }

    /* Tooltip on collapsed state */
    .sidebar:not(:hover) nav a::after {
      content: attr(title);
      position: absolute;
      left: calc(var(--sidebar-collapsed) + 8px);
      top: 50%;
      transform: translateY(-50%);
      background: var(--text);
      color: var(--surface);
      padding: 4px 10px;
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.1s;
      box-shadow: var(--shadow-sm);
    }
    .sidebar:not(:hover) nav a:hover::after {
      opacity: 1;
    }

    /* ── Main content ────────────────────────────────── */
    .main-content {
      margin-left: var(--sidebar-collapsed);
      margin-top: var(--topbar-h);
      padding: 24px 28px;
      min-height: calc(100vh - var(--topbar-h));
      overflow-y: auto;
      background: var(--bg);
    }

    /* ── Scrollbar ───────────────────────────────────── */
    .sidebar::-webkit-scrollbar { width: 3px; }
    .sidebar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

    /* ── Mobile: hamburger stays, sidebar becomes drawer */
    @media (max-width: 768px) {
      .topbar {
        padding-left: 14px;
      }

      .sidebar {
        width: 0;
        border-right: none;
        box-shadow: none;
      }
      .sidebar.open {
        width: var(--sidebar-expanded);
        box-shadow: 4px 0 32px rgba(15,21,35,0.15);
      }
      /* On mobile, show labels always when open */
      .sidebar.open nav a .label { opacity: 1; }
      .sidebar.open .nav-section  { opacity: 1; height: 28px; padding: 12px 14px 4px; }
      /* No hover expand on mobile */
      .sidebar:not(.open):hover { width: 0; box-shadow: none; }

      .main-content {
        margin-left: 0;
      }
    }
  `;
  document.head.appendChild(styleEl);

  // Build shell HTML — no grid, just fixed elements
  const shell = document.createElement('div');
  shell.className = 'app-shell';
  shell.innerHTML = `
    <header class="topbar">
      <button class="menu-toggle" id="menu-toggle" aria-label="Menu">☰</button>
      <div class="logo">⬡ POS System</div>
      <div style="flex:1"></div>
      <div class="user-badge">
        <span id="topbar-name" style="font-weight:600;color:var(--text)">—</span>
        <span class="role-tag" id="topbar-role">—</span>
      </div>
      <button class="btn btn-ghost btn-sm" id="logout-btn">Sign out</button>
    </header>

    <aside class="sidebar" id="app-sidebar">
      <nav>${navHTML}</nav>
    </aside>


    
  `;

  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebar-overlay';

  document.body.appendChild(shell);
  document.body.appendChild(overlay);

  // Move page content into main
  const pageWrap = document.getElementById('page-wrap');
  const main     = document.getElementById('main-content');
  if (pageWrap) {
    while (pageWrap.firstChild) main.appendChild(pageWrap.firstChild);
    pageWrap.remove();
  }

  initTopbar();
  initMobileMenu();
}

function initMobileMenu() {
  const toggle  = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!toggle || !sidebar || !overlay) return;

  const open  = () => {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  };
  const close = () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
  };

  toggle.addEventListener('click', () => {
    sidebar.classList.contains('open') ? close() : open();
  });
  overlay.addEventListener('click', close);
  sidebar.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => { if (window.innerWidth <= 768) close(); })
  );
}