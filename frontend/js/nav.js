/**
 * Shared role-aware navigation bar renderer.
 */
window.setupNav = function(activePage, user) {
  const navUsername = document.getElementById('nav-username');
  const navRole = document.getElementById('nav-role');
  if (navUsername && user) {
    navUsername.textContent = user.username;
  }
  if (navRole && user) {
    navRole.textContent = `(${user.role})`;
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await window.API.logout();
      window.location.href = '/';
    });
  }

  const navLinksContainer = document.getElementById('nav-links');
  if (!navLinksContainer || !user) return;

  const role = user.role;

  const links = [
    { id: 'overview', title: 'Dashboard', href: 'overview.html', roles: ['operator', 'supervisor', 'quality_engineer', 'maintenance_engineer', 'administrator', 'auditor'] },
    { id: 'events', title: 'Events', href: 'events.html', roles: ['operator', 'supervisor', 'quality_engineer', 'maintenance_engineer', 'administrator', 'auditor'] },
    { id: 'reports', title: 'Reports', href: 'reports.html', roles: ['operator', 'supervisor', 'quality_engineer', 'administrator', 'auditor'] },
    { id: 'maintenance', title: 'Maintenance', href: 'maintenance.html', roles: ['maintenance_engineer', 'administrator', 'quality_engineer'] },
    { id: 'config', title: 'Config', href: 'config.html', roles: ['administrator', 'supervisor', 'maintenance_engineer', 'auditor'] },
    { id: 'alerts', title: 'Alerts', href: 'alerts.html', roles: ['operator', 'supervisor', 'quality_engineer', 'maintenance_engineer', 'administrator', 'auditor'] },
    { id: 'admin', title: 'Admin', href: 'admin.html', roles: ['administrator'] }
  ];

  navLinksContainer.innerHTML = '';
  links.forEach(l => {
    if (l.roles.includes(role)) {
      const a = document.createElement('a');
      a.href = l.href;
      a.textContent = l.title;
      a.className = `nav-link ${activePage === l.id ? 'active' : ''}`;
      navLinksContainer.appendChild(a);
    }
  });
};
