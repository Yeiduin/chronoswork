import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  MdDashboard, MdPeople, MdEventBusy, MdCalendarMonth,
  MdCalculate, MdSettings, MdLogout, MdSchedule, MdDomain,
} from 'react-icons/md';

const navItems = [
  {
    section: 'Principal',
    links: [
      { to: '/dashboard', icon: <MdDashboard />, label: 'Dashboard' },
    ],
  },
  {
    section: 'Gestión de Personal',
    links: [
      { to: '/empleados', icon: <MdPeople />, label: 'Empleados' },
      { to: '/novedades', icon: <MdEventBusy />, label: 'Novedades' },
    ],
  },
  {
    section: 'Operaciones',
    links: [
      { to: '/areas',        icon: <MdDomain />,        label: 'Áreas y Turnos' },
      { to: '/programacion', icon: <MdCalendarMonth />, label: 'Programación' },
      { to: '/prenomina',    icon: <MdCalculate />,     label: 'Prenómina' },
    ],
  },
  {
    section: 'Administración',
    links: [
      { to: '/configuracion', icon: <MdSettings />, label: 'Configuración' },
    ],
  },
];

export default function Sidebar() {
  const { user, tenant, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = user?.email?.slice(0, 2).toUpperCase() || 'CW';

  return (
    <aside className="cw-sidebar">
      {/* Header */}
      <div className="cw-sidebar__header">
        <div className="cw-sidebar__logo">⏱️</div>
        <div className="cw-sidebar__brand-text">ChronosWork</div>
      </div>

      {/* Navigation */}
      <nav className="cw-sidebar__nav">
        {navItems.map((section) => (
          <div key={section.section}>
            <div className="cw-sidebar__section-label">{section.section}</div>
            {section.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `cw-sidebar__link ${isActive ? 'active' : ''}`
                }
              >
                <span className="cw-sidebar__icon">{link.icon}</span>
                {link.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="cw-sidebar__footer">
        {tenant && (
          <div className="cw-sidebar__plan-badge">
            <MdSchedule />
            <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>
              Plan {tenant.plan || 'Start'}
            </span>
            <span style={{ marginLeft: 'auto', opacity: 0.7 }}>
              {tenant.razon_social?.slice(0, 12) || ''}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem' }}>
          <div
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 700, color: 'white', flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Administrador</div>
          </div>
          <button
            className="cw-btn cw-btn--icon cw-btn--danger"
            onClick={handleSignOut}
            title="Cerrar sesión"
            style={{ flexShrink: 0 }}
          >
            <MdLogout />
          </button>
        </div>
      </div>
    </aside>
  );
}
