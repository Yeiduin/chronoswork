# ChronosWork 🕐

**Plataforma SaaS Multi-tenant de Gestión de Turnos y Prenómina**  
*Cumplimiento automático del CST Colombia — Ley 2101 de 2021 + Ley 2466 de 2025*

---

## 🚀 Inicio Rápido

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
Renombra `.env.example` a `.env` y completa:
```
VITE_SUPABASE_URL=<tu-url-supabase>
VITE_SUPABASE_ANON_KEY=<tu-anon-key>
```

### 3. Configurar Supabase
Abre el **SQL Editor** en tu proyecto de Supabase y ejecuta:
```
supabase/schema.sql
```

### 4. Ejecutar en desarrollo
```bash
npm run dev
```

### 5. Ejecutar tests
```bash
npm test          # Tests unitarios (Vitest) + tests de integración
npm run test:unit # Solo tests unitarios (Vitest)
npm run test:watch # Tests en modo watch
```

---

## 🏗️ Arquitectura

```
Frontend (React + Vite)  →  Supabase (PostgreSQL + Auth)
         ↕                          ↕
    Motor CST 2026           Row Level Security (RLS)
    (laborEngine.js)         (Multi-tenant isolation)
    Algoritmo Turnos
    (generateAutomaticShifts.js)
```

### Stack
| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + Vite 8 |
| Estilos | CSS Custom Design System (variables + tokens) |
| Backend/BaaS | Supabase (PostgreSQL + Auth JWT + Edge Functions) |
| Seguridad | Row Level Security (RLS) |
| Motor Cálculo | JavaScript nativo (cliente) |
| Tests | Vitest (unitarios) + Node (integración) |
| Deploy | Vercel / Netlify |

---

## 📋 Módulos del Sistema

| Módulo | Ruta | Descripción |
|--------|------|-------------|
| Login | `/login` | Autenticación JWT corporativa |
| Registro | `/register` | Registro multi-paso de empresa |
| Dashboard | `/dashboard` | Panel de métricas operativas |
| Empleados | `/empleados` | CRUD de personal + valores hora |
| Novedades | `/novedades` | Vacaciones, incapacidades, licencias |
| Programación | `/programacion` | Rejilla visual de turnos mensual |
| Prenómina | `/prenomina` | Liquidación automática CST 2026 |
| Configuración | `/configuracion` | Info empresa y plan SaaS |
| Portal Empleado | `/mi-perfil` | Vista de empleado (turnos, nomina) |
| SaaS Admin | `/saas-dashboard` | Gestión multi-empresa (solo admins) |

---

## ⚖️ Motor Legal CST Colombia 2026

Implementado en `src/core/laborEngine.js`:

| Concepto | Código | Recargo |
|----------|--------|---------|
| Hora Ordinaria Nocturna | HON | +35% |
| Hora Ord. Dominical Ene-Jun | HOD_A | +80% |
| Hora Ord. Dominical Jul-Dic | HOD_B | +90% |
| H. Comp. Dom+Noct Ene-Jun | HCDN_A | +115% |
| H. Comp. Dom+Noct Jul-Dic | HCDN_B | +125% |
| Hora Extra Diurna | HED | +25% |
| Hora Extra Nocturna | HEN | +75% |
| HE Diurna Dom Ene-Jun | HEDD_A | +105% |
| HE Diurna Dom Jul-Dic | HEDD_B | +115% |
| HE Nocturna Dom Ene-Jun | HEND_A | +155% |
| HE Nocturna Dom Jul-Dic | HEND_B | +165% |

**Límites legales (Ley 2101/2021):**
- Jornada ordinaria máxima: **42 horas semanales**
- Horas extra máximas: **2 diarias / 12 semanales**
- Banda diurna: **06:00 — 19:00**
- Banda nocturna: **19:00 — 06:00**

---

## 🔐 Seguridad Multi-tenant

- Cada empresa tiene un `tenant_id` único (UUID)
- Todas las tablas tienen **Row Level Security (RLS)** activado
- Roles: `super_admin` (dueño empresa), `coordinator` (programador), `empleado` (colaborador), `saas_admin` (admin plataforma)
- Ninguna consulta puede acceder a datos de otra empresa

---

## 📁 Estructura del Proyecto

```
chronoswork/
├── src/
│   ├── config/          # Supabase client, logger, constantes, catálogos
│   ├── core/            # Motor CST, algoritmo turnos, utils fechas, validators
│   ├── context/         # AuthContext global (multi-role)
│   ├── hooks/           # createCrudHook factory + useEmployees, useShifts, etc.
│   ├── components/      # UI: layout, modals, skeletons, scheduling grid
│   └── pages/           # Páginas (cada una se carga bajo demanda con lazy)
├── supabase/
│   ├── schema.sql       # DDL completo + RLS + Triggers
│   └── functions/       # Edge Functions (auto-assign, provision-employee)
├── test/                # Tests de integración (Node) & debug
├── docs/                # Documentación técnica
├── vitest.config.js     # Configuración Vitest (tests unitarios)
└── vite.config.js       # Build con code-splitting por ruta
```

### Features técnicas clave

| Feature | Descripción |
|---------|-------------|
| **Code Splitting** | `React.lazy()` — cada página carga solo cuando se navega a ella |
| **CRUD Genérico** | `createCrudHook.js` — fábrica de hooks con caché, soft-delete, guards |
| **Algoritmo Turnos v4.1** | Cobertura 24/7, headcount, descansos parametrizables |
| **Prenómina automática** | Clasificación minuto a minuto por concepto legal |
| **Retry en red** | `withRetry()` — reintentos exponenciales para queries Supabase |
| **Logger centralizado** | `error/warn/debug` solo en dev, `info` siempre visible |
| **Design System** | Variables CSS, 3800+ líneas de tokens, responsivo |
| **Portal Empleado** | Vista independiente con perfil, turnos y nómina |

---

## 🧪 Tests

```bash
npm test              # Suite completa: Vitest (unit) + Node (integración)
npm run test:unit     # Solo tests unitarios Vitest (52 tests actualmente)
npm run test:watch    # Modo watch para desarrollo
```

Los tests unitarios cubren:
- **dateUtils.js** (28 tests): toISODay, formatFecha, getLocalISOString, getSemana, getDiasMes, estaEnRango, diferenciaHoras, etc.
- **validators.js** (24 tests): validarCedula, validarNIT, validarValorHora, validarEmail, validarPassword, formatCOP, etc.

---

## 👤 Autor

**Yeiduin Romero Muñoz**  
Consultor Principal — AI-Driven Solo Development  
Proyecto SENA — Ingeniería de Software

---

*ChronosWork SaaS — Confidencial Corporativo*
