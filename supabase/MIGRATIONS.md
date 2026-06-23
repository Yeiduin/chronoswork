# ChronosWork — Migraciones de Base de Datos

## Orden de aplicación

Ejecuta estos archivos en orden numérico desde el SQL Editor de Supabase:

| # | Archivo | Descripción |
|---|---|---|
| 001 | `001_schema_core.sql` | Schema base: tenants, auth, employees, shifts, RLS |
| 002 | `002_areas_base.sql` | Áreas y configuración laboral básica |
| 003 | `003_employees_expand.sql` | Expansión de empleados (campos laborales completos) |
| 004 | `004_areas_expand.sql` | Estrategia v4, night split, headcount, break policy |
| 005 | `005_shift_templates.sql` | Plantillas de turno y franjas horarias |
| 006 | `006_festivos.sql` | Tabla y función de festivos colombianos dinámicos |
| 007 | `007_constraints_fix.sql` | Corrección de CHECK constraints (consolidado) |

## Notas

- **NO** uses los archivos `.sql` sueltos en `supabase/` — son históricos.
- Las migraciones están diseñadas para ser idempotentes (`IF NOT EXISTS`, `IF EXISTS`).
- Si tienes la BD en producción, aplica una por una y verifica.
