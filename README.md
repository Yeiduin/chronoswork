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

---

## 🏗️ Arquitectura

```
Frontend (React + Vite)  →  Supabase (PostgreSQL + Auth)
         ↕                          ↕
    Motor CST 2026           Row Level Security (RLS)
    (laborEngine.js)         (Multi-tenant isolation)
```

### Stack
| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + Vite 8 |
| Estilos | CSS Custom Design System + Bootstrap 5 |
| Backend/BaaS | Supabase (PostgreSQL + Auth JWT) |
| Seguridad | Row Level Security (RLS) |
| Motor Cálculo | JavaScript nativo (cliente) |
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
- El JWT de Supabase Auth porta el `tenant_id` en sus metadatos
- Ninguna consulta puede acceder a datos de otra empresa

---

## 📁 Estructura del Proyecto

```
chronoswork/
├── src/
│   ├── config/          # Supabase client + constantes
│   ├── core/            # Motor CST, utils fechas, validators
│   ├── context/         # AuthContext global
│   ├── hooks/           # useEmployees, useShifts, useAbsences
│   ├── components/      # Layout (Sidebar, ProtectedRoute)
│   └── pages/           # Todas las páginas
├── supabase/
│   └── schema.sql       # DDL + RLS + Triggers
└── .env                 # Variables de entorno
```

---

## 👤 Autor

**Yeiduin Romero Muñoz**  
Consultor Principal — AI-Driven Solo Development  
Proyecto SENA — Ingeniería de Software

---

*ChronosWork SaaS — Confidencial Corporativo*
