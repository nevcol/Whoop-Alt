import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard', icon: '▤', end: true },
  { to: '/invoices', label: 'Invoices', icon: '🧾', end: false },
  { to: '/estimates', label: 'Estimates', icon: '📄', end: false },
  { to: '/clients', label: 'Clients', icon: '👥', end: false },
  { to: '/settings', label: 'Settings', icon: '⚙', end: false },
];

export function Layout() {
  return (
    <div className="shell">
      <aside className="sidebar no-print">
        <div className="brand">
          <span className="brand-mark">L</span>
          Ledgerly
        </div>
        <nav className="nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <span className="nav-ico">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          Ledgerly · Invoicing &amp; clients
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
