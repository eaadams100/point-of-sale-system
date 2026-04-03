// Injects the app shell (topbar + sidebar) into the page.
// Call: injectShell('pos') to highlight that nav item.
function injectShell(activePage = '') {
  const nav = [
    { id: 'dashboard', icon: '◈', label: 'Dashboard',      href: '/dashboard.html' },
    { id: 'pos',       icon: '⊞', label: 'POS / Cashier',  href: '/pos.html' },
    { id: 'sales',     icon: '◑', label: 'Sales History',  href: '/sales.html' },
    { id: 'products',  icon: '◻', label: 'Products',       href: '/products.html' },
    { id: 'inventory', icon: '⊟', label: 'Inventory',      href: '/inventory.html' },
    { id: 'customers', icon: '◯', label: 'Customers',      href: '/customers.html' },
    { id: 'coupons',   icon: '⊕', label: 'Coupons',        href: '/coupons.html',  adminOnly: true },
    { id: 'reports',   icon: '◇', label: 'Reports',        href: '/reports.html' },
    { id: 'closing',   icon: '◐', label: 'Closing Report', href: '/closing.html',  adminOnly: true },
    { id: 'users',     icon: '◎', label: 'Users',          href: '/users.html',    adminOnly: true },
  ];

  const user = Auth.getUser();

  const navHTML = nav
    .filter(item => !item.adminOnly || (user && (user.role === 'admin' || user.role === 'manager')))
    .map(item => `
      <a href="${item.href}" class="${item.id === activePage ? 'active' : ''}">
        <span class="icon">${item.icon}</span>${item.label}
      </a>
    `).join('');

  const shell = document.createElement('div');
  shell.className = 'app-shell';
  shell.innerHTML = `
    <header class="topbar">
      <div class="logo">⬡ POS System</div>
      <div class="user-badge">
        <span id="topbar-name">—</span>
        <span class="role-tag" id="topbar-role">—</span>
      </div>
      <button class="btn btn-ghost btn-sm" id="logout-btn">Logout</button>
    </header>
    <aside class="sidebar">
      <nav>${navHTML}</nav>
    </aside>
    <main class="main-content" id="main-content"></main>
  `;

  const existingChildren = [...document.body.childNodes];
  document.body.appendChild(shell);
  const main = document.getElementById('main-content');
  existingChildren.forEach(node => main.appendChild(node));

  initTopbar();
}