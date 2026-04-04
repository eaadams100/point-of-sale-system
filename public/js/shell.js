function injectShell(activePage = '') {
  const nav = [
    { id: 'dashboard', icon: '◈', label: 'Dashboard',       href: '/dashboard.html' },
    { id: 'pos',       icon: '⊞', label: 'POS / Cashier',   href: '/pos.html' },
    { id: 'sales',     icon: '◑', label: 'Sales History',   href: '/sales.html' },
    { id: 'products',  icon: '◻', label: 'Products',        href: '/products.html' },
    { id: 'inventory', icon: '⊟', label: 'Inventory',       href: '/inventory.html' },
    { id: 'customers', icon: '◯', label: 'Customers',       href: '/customers.html' },
    { id: 'loyalty',   icon: '⭐', label: 'Loyalty Points',  href: '/loyalty.html' },
    { id: 'orders',    icon: '◫', label: 'Purchase Orders', href: '/orders.html',   adminOnly: true },
    { id: 'coupons',   icon: '⊕', label: 'Coupons',         href: '/coupons.html',  adminOnly: true },
    { id: 'reports',   icon: '◇', label: 'Reports',         href: '/reports.html',  adminOnly: true },
    { id: 'closing',   icon: '◐', label: 'Closing Report',  href: '/closing.html',  adminOnly: true },
    { id: 'users',     icon: '◎', label: 'Users',           href: '/users.html',    adminOnly: true },
    { id: 'settings',  icon: '⚙', label: 'Settings',        href: '/settings.html', adminOnly: true },
  ];

  const user = Auth.getUser();

  const navHTML = nav
    .filter(item => !item.adminOnly || (user && (user.role === 'admin' || user.role === 'manager')))
    .map(item => `
      <a href="${item.href}" class="${item.id === activePage ? 'active' : ''}">
        <span class="icon">${item.icon}</span>${item.label}
      </a>
    `).join('');

  // Build the grid shell — only 3 direct children: topbar, sidebar, main
  // The overlay is position:fixed so it is NOT a grid child
  const shell = document.createElement('div');
  shell.className = 'app-shell';
  shell.innerHTML = `
    <header class="topbar">
      <button class="menu-toggle" id="menu-toggle" aria-label="Open menu">☰</button>
      <div class="logo">⬡ POS System</div>
      <div class="user-badge">
        <span id="topbar-name">—</span>
        <span class="role-tag" id="topbar-role">—</span>
      </div>
      <button class="btn btn-ghost btn-sm" id="logout-btn">Logout</button>
    </header>
    <aside class="sidebar" id="app-sidebar">
      <nav>${navHTML}</nav>
    </aside>
    <main class="main-content" id="main-content"></main>
  `;

  // Overlay is appended to body, NOT inside the grid
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebar-overlay';

  const existingChildren = [...document.body.childNodes];
  document.body.appendChild(shell);
  document.body.appendChild(overlay); // outside .app-shell
  const main = document.getElementById('main-content');
  existingChildren.forEach(node => main.appendChild(node));

  initTopbar();
  initMobileMenu();
}

function initMobileMenu() {
  const toggle  = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!toggle || !sidebar || !overlay) return;

  function openMenu() {
    sidebar.classList.add('open');
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
  }
  function closeMenu() {
    sidebar.classList.remove('open');
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
  }

  toggle.addEventListener('click', openMenu);
  overlay.addEventListener('click', closeMenu);

  sidebar.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => {
      if (window.innerWidth <= 768) closeMenu();
    })
  );
}
