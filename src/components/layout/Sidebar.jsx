import { NavLink, useNavigate, Link } from 'react-router-dom';
import { useAuth, ROLE_SAAS_ADMIN, ROLE_SUPER_ADMIN, ROLE_COORDINATOR } from '../../context/AuthContext';
import {
  MdDashboard, MdPeople, MdEventBusy, MdCalendarMonth,
  MdCalculate, MdSettings, MdLogout, MdSchedule, MdDomain,
  MdAdminPanelSettings, MdBusiness,
} from 'react-icons/md';

// ── Configuración de navegación por rol ──────────────────────────────────────

const NAV_SAAS_ADMIN = [
  {
    section: 'Plataforma',
    links: [
      { to: '/saas-dashboard', icon: <MdAdminPanelSettings />, label: 'Panel SaaS' },
    ],
  },
];

const NAV_SUPER_ADMIN = [
  {
    section: 'Principal',
    links: [
      { to: '/dashboard', icon: <MdDashboard />, label: 'Dashboard' },
    ],
  },
  {
    section: 'Gestión de Personal',
    links: [
      { to: '/empleados',  icon: <MdPeople />,     label: 'Empleados' },
      { to: '/novedades',  icon: <MdEventBusy />,  label: 'Novedades' },
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

const NAV_COORDINATOR = [
  {
    section: 'Principal',
    links: [
      { to: '/dashboard', icon: <MdDashboard />, label: 'Dashboard' },
    ],
  },
  {
    section: 'Gestión de Personal',
    links: [
      { to: '/empleados', icon: <MdPeople />,    label: 'Empleados' },
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
];

function getNavItems(role) {
  switch (role) {
    case ROLE_SAAS_ADMIN:  return NAV_SAAS_ADMIN;
    case ROLE_SUPER_ADMIN: return NAV_SUPER_ADMIN;
    case ROLE_COORDINATOR: return NAV_COORDINATOR;
    default:               return NAV_COORDINATOR;
  }
}

function getRoleLabel(role) {
  switch (role) {
    case ROLE_SAAS_ADMIN:  return 'SaaS Admin';
    case ROLE_SUPER_ADMIN: return 'Administrador';
    case ROLE_COORDINATOR: return 'Coordinador';
    default:               return 'Usuario';
  }
}

// ── Sidebar component ─────────────────────────────────────────────────────────
export default function Sidebar() {
  const { user, tenant, userRole, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = getNavItems(userRole);
  const initials = user?.email?.slice(0, 2).toUpperCase() || 'CW';
  const isSaasAdmin = userRole === ROLE_SAAS_ADMIN;

  return (
    <aside className="cw-sidebar">
      {/* Header */}
      <Link to="/landing" className="cw-sidebar__header" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="cw-sidebar__logo">⏱️</div>
        <div className="cw-sidebar__brand-text">ChronosWork</div>
      </Link>

      {/* Badge de rol */}
      <div style={{
        margin: '0 0.75rem 0.75rem',
        padding: '0.35rem 0.75rem',
        borderRadius: 8,
        background: isSaasAdmin
          ? 'linear-gradient(135deg, rgba(79,70,229,0.12), rgba(124,58,237,0.08))'
          : 'var(--bg-glass)',
        border: isSaasAdmin ? '1px solid rgba(79,70,229,0.25)' : '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: '0.5rem',
      }}>
        {isSaasAdmin ? (
          <MdAdminPanelSettings style={{ color: 'var(--cw-accent)', fontSize: '1rem' }} />
        ) : (
          <MdBusiness style={{ color: 'var(--text-muted)', fontSize: '1rem' }} />
        )}
        <span style={{
          fontSize: '0.72rem', fontWeight: 700,
          color: isSaasAdmin ? 'var(--cw-accent)' : 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.04em',
        }}>
          {getRoleLabel(userRole)}
        </span>
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
        {tenant && !isSaasAdmin && (
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
              background: isSaasAdmin
                ? 'linear-gradient(135deg, var(--cw-accent), var(--cw-purple))'
                : 'linear-gradient(135deg, var(--cw-accent), var(--cw-purple))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 700, color: 'white', flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{
              fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {user?.email}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
              {getRoleLabel(userRole)}
            </div>
          </div>
          <button
            className="cw-btn cw-btn--icon cw-btn--danger"
            onClick={handleSignOut}
            title="Cerrar sesión"
            id="btn-sidebar-logout"
            style={{ flexShrink: 0 }}
          >
            <MdLogout />
          </button>
        </div>
      </div>
    </aside>
  );
}
