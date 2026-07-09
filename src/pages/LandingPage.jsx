import { Link, useNavigate } from 'react-router-dom';
import { useAuth, getRoleRedirect } from '../context/AuthContext';
import {
  MdSchedule, MdCalculate, MdPeople, MdSecurity,
  MdCloud, MdTrendingUp, MdCheckCircle, MdArrowForward,
  MdBusiness, MdBarChart, MdAutoAwesome, MdGavel,
} from 'react-icons/md';
import './LandingPage.css';

export default function LandingPage() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();

  // Info del CTA según rol del usuario autenticado
  const authCta = user
    ? { label: getRoleRedirect(userRole).startsWith('/dashboard') ? 'Ir al Dashboard'
            : getRoleRedirect(userRole).startsWith('/saas-dashboard') ? 'Ir al Panel SaaS'
            : getRoleRedirect(userRole).startsWith('/mi-perfil') ? 'Ir a Mi Perfil'
            : 'Ir al Inicio',
        to: getRoleRedirect(userRole) }
    : null;

  return (
    <div className="landing">
      {/* ── Navbar ──────────────────────────────────────────────── */}
      <nav className="landing-nav">
        <Link to="/landing" className="landing-nav__brand" style={{ textDecoration: 'none' }}>
          <span className="landing-nav__logo">⏱️</span>
          <span className="landing-nav__name">ChronosWork</span>
        </Link>
        <div className="landing-nav__links">
          <a href="#features">Funcionalidades</a>
          <a href="#compliance">Cumplimiento</a>
          <a href="#how-it-works">Cómo funciona</a>
          <a href="#pricing">Planes</a>
          {user ? (
            <button className="cw-btn cw-btn--primary cw-btn--sm" onClick={() => navigate(authCta.to)}>
              {authCta.label}
            </button>
          ) : (
            <>
              <Link to="/login" className="landing-nav__login">Iniciar Sesión</Link>
              <Link to="/register" className="cw-btn cw-btn--primary cw-btn--sm">Comenzar Gratis</Link>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="landing-hero__orb landing-hero__orb--1" />
        <div className="landing-hero__orb landing-hero__orb--2" />
        <div className="landing-hero__content">
          <div className="landing-hero__badge">
            <MdAutoAwesome size={18} />
            <span>Cumplimiento CST Colombia automático</span>
          </div>
          <h1 className="landing-hero__title">
            Programa turnos,<br />
            <span className="landing-hero__gradient">sin calcular horas extra</span>
          </h1>
          <p className="landing-hero__subtitle">
            ChronosWork automatiza la programación de turnos y prenómina de tu empresa, 
            garantizando el 100% de cumplimiento con la legislación laboral colombiana 
            (Ley 2101/2021 + Ley 2466/2025).
          </p>
          <div className="landing-hero__cta">
            {user ? (
              <button className="cw-btn cw-btn--primary cw-btn--lg" onClick={() => navigate(authCta.to)}>
                {authCta.label} <MdArrowForward size={20} />
              </button>
            ) : (
              <>
                <Link to="/register" className="cw-btn cw-btn--primary cw-btn--lg">
                  Comenzar Gratis <MdArrowForward size={20} />
                </Link>
                <Link to="/login" className="cw-btn cw-btn--secondary cw-btn--lg">
                  Iniciar Sesión
                </Link>
              </>
            )}
          </div>
          <div className="landing-hero__stats">
            <div className="landing-hero__stat">
              <span className="landing-hero__stat-value">12</span>
              <span className="landing-hero__stat-label">Conceptos Legales Automatizados</span>
            </div>
            <div className="landing-hero__stat">
              <span className="landing-hero__stat-value">42h</span>
              <span className="landing-hero__stat-label">Jornada Máxima Legal</span>
            </div>
            <div className="landing-hero__stat">
              <span className="landing-hero__stat-value">24/7</span>
              <span className="landing-hero__stat-label">Operación Continua</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────── */}
      <section id="features" className="landing-features">
        <h2 className="landing-section__title">
          Todo lo que necesitas para <span className="landing-hero__gradient">gestionar turnos</span>
        </h2>
        <p className="landing-section__desc">
          Una plataforma completa que reemplaza tus hojas de cálculo por un sistema inteligente 
          que conoce la ley colombiana mejor que tu contador.
        </p>
        <div className="landing-features__grid">
          {/* Feature 1 */}
          <div className="landing-feature-card">
            <div className="landing-feature-card__icon" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>
              <MdSchedule size={28} />
            </div>
            <h3>Programación Inteligente</h3>
            <p>
              Algoritmo v4.1 que asigna turnos automáticamente respetando jornadas diurnas, 
              nocturnas, mixtas y patrones rotativos. Soporta operación 24/7 con personal 
              nocturno dedicado.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="landing-feature-card">
            <div className="landing-feature-card__icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#8b5cf6' }}>
              <MdCalculate size={28} />
            </div>
            <h3>Prenómina Automática</h3>
            <p>
              Calcula automáticamente 12 conceptos de nómina: horas ordinarias, nocturnas, 
              dominicales, extras y recargos según CST. Exporta a CSV para tu software de nómina.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="landing-feature-card">
            <div className="landing-feature-card__icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
              <MdPeople size={28} />
            </div>
            <h3>Gestión de Personal</h3>
            <p>
              Administra empleados con +60 campos laborales: contratos, jornadas, seguridad social, 
              ausencias, y más. Importación masiva desde Excel en un clic.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="landing-feature-card">
            <div className="landing-feature-card__icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
              <MdBusiness size={28} />
            </div>
            <h3>Multi-Área & Multi-Tenant</h3>
            <p>
              Organiza tu empresa por áreas con configuraciones independientes: retail, call center, 
              hotelería, salud. Arquitectura multi-tenant para grupos empresariales.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="landing-feature-card">
            <div className="landing-feature-card__icon" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>
              <MdBarChart size={28} />
            </div>
            <h3>Dashboard en Tiempo Real</h3>
            <p>
              Visualiza KPIs, cobertura por hora, déficit de personal y tendencias. 
              Alertas automáticas cuando hay días sin cobertura o excesos de jornada.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="landing-feature-card">
            <div className="landing-feature-card__icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
              <MdAutoAwesome size={28} />
            </div>
            <h3>Auto-Asignación 24/7</h3>
            <p>
              Edge Functions en Supabase que ejecutan el algoritmo de asignación en el servidor. 
              Balanceo automático de carga entre empleados con priorización por demanda.
            </p>
          </div>
        </div>
      </section>

      {/* ── Compliance ────────────────────────────────────────────── */}
      <section id="compliance" className="landing-compliance">
        <div className="landing-compliance__inner">
          <h2 className="landing-section__title">
            Cumplimiento legal <span className="landing-hero__gradient">garantizado</span>
          </h2>
          <p className="landing-section__desc">
            ChronosWork incorpora el Código Sustantivo del Trabajo colombiano en su motor de cálculo, 
            asegurando que cada turno programado cumpla con la legislación vigente.
          </p>
          <div className="landing-compliance__grid">
            <div className="landing-compliance__card">
              <MdGavel size={32} color="#3b82f6" />
              <h3>Jornada Máxima</h3>
              <p>42 horas semanales según Ley 2101 de 2021. El algoritmo nunca programa turnos que excedan este límite.</p>
            </div>
            <div className="landing-compliance__card">
              <MdGavel size={32} color="#10b981" />
              <h3>Horas Extra</h3>
              <p>Máximo 2 horas extra diarias y 12 semanales. Marcadas y calculadas automáticamente con sus recargos.</p>
            </div>
            <div className="landing-compliance__card">
              <MdGavel size={32} color="#8b5cf6" />
              <h3>Recargo Nocturno</h3>
              <p>+35% automático para horas entre 19:00 y 06:00 según CST. El motor clasifica cada turno correctamente.</p>
            </div>
            <div className="landing-compliance__card">
              <MdGavel size={32} color="#f59e0b" />
              <h3>Recargo Dominical</h3>
              <p>+80% (Ene-Jun 2026) y +90% (Jul-Dic 2026) según Ley 2466/2025. Cálculo automático por semestre.</p>
            </div>
            <div className="landing-compliance__card">
              <MdGavel size={32} color="#ef4444" />
              <h3>Descanso Obligatorio</h3>
              <p>Mínimo 12 horas entre jornadas. El sistema bloquea automáticamente turnos que violen esta regla.</p>
            </div>
            <div className="landing-compliance__card">
              <MdGavel size={32} color="#6366f1" />
              <h3>Ley 2466/2025</h3>
              <p>Reforma laboral incorporada: prohibición de fraccionamiento de contratos, recargos actualizados.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it Works ──────────────────────────────────────────── */}
      <section id="how-it-works" className="landing-how">
        <h2 className="landing-section__title">
          De Excel a <span className="landing-hero__gradient">automatización total</span> en 3 pasos
        </h2>
        <div className="landing-how__steps">
          <div className="landing-how__step">
            <div className="landing-how__step-number">1</div>
            <div className="landing-how__step-line" />
            <h3>Registra tu empresa</h3>
            <p>Crea tu cuenta gratis en 2 minutos. Sin tarjeta de crédito. Solo necesitas razón social y NIT.</p>
          </div>
          <div className="landing-how__step">
            <div className="landing-how__step-number">2</div>
            <div className="landing-how__step-line" />
            <h3>Importa tus empleados</h3>
            <p>Sube tu plantilla de Excel con todos tus trabajadores. O regístralos uno a uno. +60 campos laborales soportados.</p>
          </div>
          <div className="landing-how__step">
            <div className="landing-how__step-number">3</div>
            <div className="landing-how__step-line" />
            <h3>Programa y calcula</h3>
            <p>Define tus áreas y turnos, ejecuta el algoritmo de auto-asignación, y obtén tu prenómina lista para pagar.</p>
          </div>
        </div>
      </section>

      {/* ── Pricing ───────────────────────────────────────────────── */}
      <section id="pricing" className="landing-pricing">
        <h2 className="landing-section__title">
          Planes <span className="landing-hero__gradient">simples y transparentes</span>
        </h2>
        <p className="landing-section__desc">
          Sin costos ocultos. Empieza gratis y escala cuando tu empresa crezca.
        </p>
        <div className="landing-pricing__grid">
          {/* Free */}
          <div className="landing-pricing__card">
            <div className="landing-pricing__header">
              <h3>Start</h3>
              <div className="landing-pricing__price">
                <span className="landing-pricing__currency">$</span>
                <span className="landing-pricing__amount">0</span>
                <span className="landing-pricing__period">/mes</span>
              </div>
              <p>Para pequeñas empresas que están empezando</p>
            </div>
            <ul className="landing-pricing__features">
              <li><MdCheckCircle size={16} color="#10b981" /> Hasta 20 empleados</li>
              <li><MdCheckCircle size={16} color="#10b981" /> 1 área de trabajo</li>
              <li><MdCheckCircle size={16} color="#10b981" /> Programación manual de turnos</li>
              <li><MdCheckCircle size={16} color="#10b981" /> Cálculo de prenómina básico</li>
              <li><MdCheckCircle size={16} color="#10b981" /> Exportación CSV</li>
              <li><MdCheckCircle size={16} color="#10b981" /> Cumplimiento CST automático</li>
            </ul>
            <Link to="/register" className="cw-btn cw-btn--secondary landing-pricing__btn">
              Comenzar Gratis
            </Link>
          </div>

          {/* Pro */}
          <div className="landing-pricing__card landing-pricing__card--featured">
            <div className="landing-pricing__badge">Más Popular</div>
            <div className="landing-pricing__header">
              <h3>Pro</h3>
              <div className="landing-pricing__price">
                <span className="landing-pricing__currency">$</span>
                <span className="landing-pricing__amount">79.900</span>
                <span className="landing-pricing__period">/mes</span>
              </div>
              <p>Para empresas con operación 24/7 y múltiples áreas</p>
            </div>
            <ul className="landing-pricing__features">
              <li><MdCheckCircle size={16} color="#10b981" /> Hasta 200 empleados</li>
              <li><MdCheckCircle size={16} color="#10b981" /> Múltiples áreas de trabajo</li>
              <li><MdCheckCircle size={16} color="#10b981" /> Auto-asignación inteligente 24/7</li>
              <li><MdCheckCircle size={16} color="#10b981" /> Prenómina avanzada (12 conceptos)</li>
              <li><MdCheckCircle size={16} color="#10b981" /> Importación masiva Excel</li>
              <li><MdCheckCircle size={16} color="#10b981" /> Curvas de demanda por hora</li>
              <li><MdCheckCircle size={16} color="#10b981" /> Dashboard con KPIs y tendencias</li>
              <li><MdCheckCircle size={16} color="#10b981" /> Alertas de cobertura</li>
            </ul>
            <Link to="/register" className="cw-btn cw-btn--primary landing-pricing__btn">
              Comenzar Prueba Gratis
            </Link>
          </div>

          {/* Enterprise */}
          <div className="landing-pricing__card">
            <div className="landing-pricing__header">
              <h3>Enterprise</h3>
              <div className="landing-pricing__price">
                <span className="landing-pricing__currency">$</span>
                <span className="landing-pricing__amount">199.900</span>
                <span className="landing-pricing__period">/mes</span>
              </div>
              <p>Para grupos empresariales multi-tenant</p>
            </div>
            <ul className="landing-pricing__features">
              <li><MdCheckCircle size={16} color="#10b981" /> Empleados ilimitados</li>
              <li><MdCheckCircle size={16} color="#10b981" /> Áreas ilimitadas</li>
              <li><MdCheckCircle size={16} color="#10b981" /> Multi-tenant (múltiples empresas)</li>
              <li><MdCheckCircle size={16} color="#10b981" /> SaaS Admin Dashboard</li>
              <li><MdCheckCircle size={16} color="#10b981" /> Edge Functions dedicadas</li>
              <li><MdCheckCircle size={16} color="#10b981" /> Soporte prioritario</li>
              <li><MdCheckCircle size={16} color="#10b981" /> Personalización de catálogos</li>
              <li><MdCheckCircle size={16} color="#10b981" /> API de integración</li>
            </ul>
            <Link to="/register" className="cw-btn cw-btn--secondary landing-pricing__btn">
              Contactar Ventas
            </Link>
          </div>
        </div>
      </section>

      {/* ── CTA Final ─────────────────────────────────────────────── */}
      <section className="landing-cta">
        <div className="landing-cta__orb" />
        <h2>¿Listo para dejar de calcular horas extra a mano?</h2>
        <p>
          Únete a las empresas colombianas que ya confían en ChronosWork para su gestión de turnos 
          y prenómina con cumplimiento CST automático.
        </p>
        {user ? (
          <button className="cw-btn cw-btn--primary cw-btn--lg" onClick={() => navigate('/dashboard')}>
            Ir al Dashboard <MdArrowForward size={20} />
          </button>
        ) : (
          <Link to="/register" className="cw-btn cw-btn--primary cw-btn--lg">
            Crear Cuenta Gratis <MdArrowForward size={20} />
          </Link>
        )}
        <p className="landing-cta__note">Sin tarjeta de crédito · Plan Start gratuito para siempre</p>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-footer__inner">
          <div className="landing-footer__brand">
            <span className="landing-footer__logo">⏱️</span>
            <span className="landing-footer__name">ChronosWork</span>
            <p>Gestión inteligente de turnos y prenómina con cumplimiento CST Colombia.</p>
          </div>
          <div className="landing-footer__links">
            <div className="landing-footer__col">
              <h4>Producto</h4>
              <a href="#features">Funcionalidades</a>
              <a href="#pricing">Planes</a>
              <a href="#compliance">Cumplimiento Legal</a>
              <Link to="/register">Registrarse</Link>
            </div>
            <div className="landing-footer__col">
              <h4>Legislación</h4>
              <span>Ley 2101 de 2021</span>
              <span>Ley 2466 de 2025</span>
              <span>CST Colombia</span>
              <span>Resolución Mintrabajo</span>
            </div>
            <div className="landing-footer__col">
              <h4>Contacto</h4>
              <span>Colombia, Bogotá D.C.</span>
              <span>Proyecto SENA</span>
              <span>Ingeniería de Software</span>
              <span>Yeiduin Romero Muñoz</span>
            </div>
          </div>
        </div>
        <div className="landing-footer__bottom">
          <span>© 2026 ChronosWork. Todos los derechos reservados.</span>
          <span>CST Colombia · Ley 2101/2021 · Ley 2466/2025</span>
        </div>
      </footer>
    </div>
  );
}
