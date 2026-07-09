# ChronosWork v4.0 — Upgrade del Algoritmo de Asignación de Turnos

## 🎯 Problema que resuelve

El algoritmo v3.1 fallaba para call centers 24/7 y operaciones con demanda variable + noche dedicada:

1. ❌ **No había forma de asignar empleados dedicados a la noche** (22:00-06:00) — el sistema repartía 1/3 del equipo aleatoriamente.
2. ❌ **No usaba la curva de demanda** del área (WFM) para garantizar cobertura.
3. ❌ **Los turnos diurnos excedían las 22:00** sin marcar como nocturnos (cruzaban 19:00 sin HON).
4. ❌ **No soportaba múltiples turnos por día** — un día con pico de 7 personas solo recibía 1 turno.
5. ❌ **No había control granular** sobre la estrategia de asignación (cobertura vs balanceo).

## ✅ Solución v4.0

### 1. Nueva clasificación de empleados

```sql
ALTER TABLE employees
  ADD COLUMN jornada_preferida VARCHAR(20) DEFAULT 'CUALQUIERA',  -- DIURNA | NOCTURNA | MIXTA | CUALQUIERA
  ADD COLUMN solo_diurno BOOLEAN DEFAULT false,
  ADD COLUMN solo_nocturno BOOLEAN DEFAULT false,
  ADD COLUMN horas_max_diarias DECIMAL(4,1),
  ADD COLUMN horas_nocturnas_max_semana INT,
  ADD COLUMN horas_max_semana INT,
  ADD COLUMN permite_partido BOOLEAN DEFAULT false;
```

El algoritmo clasifica cada empleado como:
- **NIGHT_ONLY**: solo recibe turnos que tocan 19:00-06:00
- **DAY_ONLY**: nunca recibe turnos que tocan 19:00-06:00
- **MIXED**: puede recibir ambos
- **ANY**: el sistema decide según déficit

### 2. Nuevos parámetros del área

```sql
ALTER TABLE areas
  ADD COLUMN estrategia_asignacion VARCHAR(20) DEFAULT 'COVERAGE_FIRST',  -- COVERAGE_FIRST | BALANCED | EMPLOYEE_PREF
  ADD COLUMN min_empleados_noche INT DEFAULT 1,
  ADD COLUMN permite_dia_cubrir_noche BOOLEAN DEFAULT false,
  ADD COLUMN noche_solo_empleados_dedicados BOOLEAN DEFAULT true,
  ADD COLUMN slots_por_hora INT DEFAULT 4,           -- 1 | 2 | 4 (granularidad del algoritmo)
  ADD COLUMN snap_turnos_minutos INT DEFAULT 15,     -- 5 | 10 | 15 | 30 | 60
  ADD COLUMN balancear_carga BOOLEAN DEFAULT true,
  ADD COLUMN rotar_slots_entre_asesores BOOLEAN DEFAULT false,
  ADD COLUMN permitir_horas_extras BOOLEAN DEFAULT false,
  ADD COLUMN permitir_turno_partido BOOLEAN DEFAULT false,
  ADD COLUMN min_horas_turno_override DECIMAL(4,1),
  ADD COLUMN max_horas_turno_override DECIMAL(4,1);
```

Nuevo modo de operación:
- `OFICINA`: lunes a viernes, jornada diurna
- `24_7`: cobertura continua, turnos rotativos
- `24_7_NIGHT_SPLIT`: 24/7 con jornada nocturna dedicada (CASO CALL CENTER) 🌙

### 3. Algoritmo reescrito en 5 fases

#### FASE 0 — Asignar descansos
Para cada empleado, asigna descansos semanales priorizando los días de MENOR demanda y respetando:
- `dias_descanso_fijos` (override individual)
- Patrón rotativo del área (`5x2`, `6x1`, `7x7`, etc.)
- Distribución equitativa (offset por empleado para que no todos descansen el mismo día)

#### FASE 1 — Garantizar cobertura NOCTURNA (24/7)
Para cada día del rango:
- Calcula el déficit de la franja 22:00-06:00
- Elige `max(min_empleados_noche, déficit)` empleados del pool nocturno
- Orden de prioridad: `NIGHT_ONLY` > `MIXED` > `ANY` (si `permite_dia_cubrir_noche`)
- Crea turnos `22:00 → 06:00` (siguiente día) de 8h
- Verifica que el empleado no exceda 42h/sem ni 8h/día

#### FASE 2 — Cobertura DIURNA (slots 04:00-22:00)
Para cada día, en orden de mayor déficit:
- Busca el mejor `start_slot` (04:00-22:00, snap configurable)
- Calcula el score = déficit cubierto - penalización por sobrecobertura
- BONUS: si los slots extremos (4-7 AM, 18-22 PM) están vacíos, premia empezar turnos allí
- Filtra candidatos: `DAY_ONLY + MIXED + ANY` (excluye `NIGHT_ONLY` para el día)
- Verifica: no cruza 22:00, respeta 42h/sem, 9h/día, 9h entre jornadas
- **Saturación por día**: hasta 20 turnos por día para cubrir picos

#### FASE 3 — Refill con templates (PARTIDO, ROTATIVO, etc.)
Si hay templates preconfigurados (Mañana 7-15, Tarde 13-21, etc.):
- Calcula déficit en el rango de cada template
- Asigna al empleado con menos horas

#### FASE 4 — Balanceo de carga semanal
- Detecta empleados con más horas que la media + tolerancia
- Advierte para reasignación manual

#### FASE 5 — Validaciones y warnings
- Detecta déficit residual por día
- Detecta empleados sin turnos asignados

## 📊 Validación con el caso real del usuario

El test `test/test_callcenter_24_7.test.js` reproduce el escenario del call center 24/7:

```
✅ 5 NIGHT_ONLY clasificados correctamente
✅ 35 DAY_ONLY clasificados correctamente
✅ 7/7 días con cobertura 22:00-06:00
✅ 0 diurnos asignados a la noche
✅ 0 turnos DAY_ONLY cruzan 19:00
✅ 0 turnos < 4h o > 9h
✅ 0 empleados sobre 42h/sem
✅ 4 horarios de inicio distintos (06:00, 06:45, 09:00, 22:00)
```

## 🚀 Cómo aplicar

### 1. Ejecutar las migraciones SQL

En Supabase SQL Editor, ejecutar en orden:

```sql
-- 1. Nuevos campos en employees
\i supabase/expand_employees_jornada_v4.sql

-- 2. Nuevos campos en areas
\i supabase/expand_areas_estrategia_v4.sql
```

### 2. El código JS ya está actualizado

- ✅ `src/core/generateAutomaticShifts.js` — Algoritmo v4.0 (reescrito)
- ✅ `src/hooks/useShifts.js` — Pasa los nuevos parámetros
- ✅ `src/components/AreaForm.jsx` — UI con estrategia, min_noche, etc.
- ✅ `src/components/EmployeeForm.jsx` — UI con jornada preferida

### 3. Correr el test

```bash
cd /workspace/extracted/chronoswork-main
node test/test_callcenter_24_7.test.js
```

## 💡 Casos de uso soportados

| Empresa | Modo recomendado | Estrategia | Notas |
|---------|------------------|------------|-------|
| Call center 24/7 (tuyo) | `24_7_NIGHT_SPLIT` | `COVERAGE_FIRST` | 3-5 nocturnos + 30+ diurnos, configurar demanda WFM |
| Call center con igual día/noche | `24_7` | `COVERAGE_FIRST` | Todos rotan, demanda WFM por hora |
| Oficina 8x5 | `OFICINA` | `BALANCED` | Templates fijos (Mañana 7-15, Tarde 13-21) |
| Hospital / Salud 24/7 | `24_7` | `EMPLOYEE_PREF` | Respetar especialidades, demanda WFM |
| Restaurante | `OFICINA` o `24_7` | `BALANCED` | Slots de comida |
| Seguridad privada | `24_7` | `COVERAGE_FIRST` | Mínimo 1 por turno, demanda 24h |
| Retail | `OFICINA` (8x5) o `24_7` | `BALANCED` | Picos en hora de almuerzo y tarde |

## 🔧 Parámetros clave explicados

### `min_empleados_noche` (default 1)
Cuántas personas mínimas deben cubrir la franja 22:00-06:00 **simultáneamente** cada día.
- Call center con poco volumen nocturno: 1
- Call center grande con 24/7: 2-3
- Hospital: 2-4

### `noche_solo_empleados_dedicados` (default true)
Si `true`, SOLO empleados con `solo_nocturno=true` o `jornada_preferida=NOCTURNA/MIXTA` pueden ser asignados a la noche. **Recomendado true** para no quemar al personal diurno.

### `permite_dia_cubrir_noche` (default false)
Si `true`, empleados diurnos pueden cubrir la noche en emergencias (ej: alguien se enfermó).

### `estrategia` (default COVERAGE_FIRST)
- `COVERAGE_FIRST`: el algoritmo prioriza llenar la demanda configurada. **Ideal 24/7.**
- `BALANCED`: prioriza igualar las horas entre todos. **Ideal oficinas.**
- `EMPLOYEE_PREF`: prioriza respetar las preferencias del empleado.

### `slots_por_hora` (default 4)
Granularidad del cálculo de cobertura:
- 4 = 15 minutos (más preciso, más lento)
- 2 = 30 minutos
- 1 = 1 hora (más rápido, menos preciso)

### `snap_turnos_minutos` (default 15)
Cada cuántos minutos los turnos pueden empezar:
- 15 = 15 min (estándar, recomendado)
- 30 = 30 min (más simple)
- 60 = 1 hora (call centers tradicionales)

## ⚠️ Limitaciones conocidas

1. **Demanda diurna alta vs pool limitado**: si la demanda requiere 10 personas simultáneas pero solo hay 35 empleados, el déficit no se puede cubrir. El algoritmo lo detecta y avisa.

2. **Descansos no se reasignan**: si la configuración cambia, los descansos ya asignados se mantienen hasta regenerar.

3. **Patrones rotativos complejos**: solo soportamos los patrones predefinidos en `PATRONES_ROTATIVOS`. Para patrones personalizados, agregarlos al catálogo.

## 🐛 Debug

Si el algoritmo no asigna turnos:

1. Verificar que el área tenga `modo_operacion` correcto.
2. Verificar que los empleados tengan `jornada_preferida` o `solo_nocturno`/`solo_diurno` configurados.
3. Si la demanda es muy alta, agregar más empleados o reducir `required_staff` en `area_demand_slots`.
4. Revisar el array `warnings` que devuelve la función.

```javascript
import { generateAutomaticShifts } from './src/core/generateAutomaticShifts.js';
const { shifts, warnings } = generateAutomaticShifts({...});
console.log('Turnos:', shifts.length);
console.log('Warnings:', warnings);
```
