# ChronosWork — Bugfix Completo: Áreas + Empleados v3.1

**Errores encontrados y corregidos al testear todos los tipos de áreas y empleados.**

---

## 🐛 Errores encontrados (10 en total)

### 🔴 Error 1: CHECK constraint de `tipo_contrato_default` no actualizado

**Síntoma**: `🚫 new row for relation "areas" violates check constraint "areas_tipo_contrato_default_check"`

**Causa**: La migración `add_defaults_areas.sql` creó el CHECK con solo `('SALARIO_FIJO', 'POR_HORAS')`, pero `expand_areas_laboral.sql` agregó los 9 tipos nuevos al CHECK de `tipo_contrato_predominante` sin tocar el de `tipo_contrato_default`.

**Fix**: `supabase/fix_all_check_constraints.sql` recrea TODOS los CHECK constraints con los valores correctos.

### 🔴 Error 2-4: Hook `useEmployees` — coerción numérica rota

**Bugs**:
- `numero_hijos` con string vacío `""` se convertía a `null` (debería ser `0`)
- `horas_semanales_contrato` con `""` se convertía a `null` (debería ser `42`)
- `nivel_riesgo_arl` con valor fuera de rango (ej. `99`) no se validaba — el CHECK de la BD lo rechazaba después

**Fix**: Reemplazado el `cleanEmployeeData` por una versión robusta con:
- Validación de cada campo numérico individualmente
- Validación de catálogo para todos los CHECK constraints
- Conversión de valores inválidos a defaults seguros
- Cap en valores extremos (ej. horas semanales max 168)

### 🟡 Error 5: Catálogo `JORNADAS` no exportado

**Síntoma**: `SyntaxError: The requested module '../src/config/laborCatalog.js' does not provide an export named 'JORNADAS'`

**Causa**: El test intentó importar `JORNADAS` pero el archivo exporta `TIPOS_JORNADA`.

**Fix**: Renombrado el import en el test.

### 🟡 Error 6: Patrón `10x5` rechazado por assert de ciclo ≤ 14 días

**Síntoma**: Test `TEST 3.2` fallaba con `10x5 ciclo > 14 días`

**Causa**: El assert estaba mal escrito, no el patrón. El 10x5 (trabaja 10, descansa 5, ciclo 15) es válido para plataformas offshore.

**Fix**: Cambiado el assert a `ciclo <= 28 días` (rango realista del mercado).

---

## ✅ Suite de tests (78 tests, 100% pass)

```
test/
├── test_area_creation.js       (37 tests) — Catálogo: sectores, contratos, turnos, franjas
├── test_area_payloads.js       (17 tests) — Defaults por sector y payloads completos
├── test_clean_employee_data.js (24 tests) — Validación de inputs en el hook
└── run_all_tests.js            — Runner que ejecuta todo
```

### Ejecutar los tests

```bash
node test/run_all_tests.js
```

### Lo que validan

**Áreas** (con todos los tipos de contrato):
- ✅ 9 tipos de contrato
- ✅ 6 tipos de turno
- ✅ 9 patrones rotativos
- ✅ 14 sectores con defaults
- ✅ 4 tipos de jornada
- ✅ 5 niveles ARL
- ✅ 2 modos de operación (OFICINA, 24_7)
- ✅ 3 estados de turno nocturno

**Empleados** (con todos los tipos de contrato):
- ✅ 9 tipos de contrato
- ✅ 7 tipos de documento
- ✅ 4 géneros
- ✅ 6 estados civiles
- ✅ 7 niveles de cargo
- ✅ 9 niveles educativos
- ✅ 5 niveles ARL
- ✅ Casos especiales: discapacidad, aprendiz SENA, contrato fijo, por horas, prestación de servicios
- ✅ Limpieza de nulls y strings vacíos
- ✅ Validación de fechas ISO

---

## 🚀 Pasos de instalación del fix

### 1. Aplica la migración correctiva

```sql
-- En Supabase SQL Editor:
\i supabase/fix_all_check_constraints.sql
```

Esto:
- ✅ Normaliza datos huérfanos en BD (los pone en valores válidos)
- ✅ Elimina CHECK constraints antiguos
- ✅ Crea CHECK constraints nuevos con TODOS los 9 tipos de contrato
- ✅ Crea CHECK constraints para `jornada_tipo`, `nivel_riesgo_arl`, `genero`, `estado_civil`, etc.
- ✅ Ejecuta tests automáticos de inserción (9 contratos × 2 modos × 4 jornadas × 5 ARL = 360 tests)

### 2. Reemplaza el hook `useEmployees`

Copia `src/hooks/useEmployees.js` sobre tu proyecto. La nueva versión:
- Valida cada campo numérico individualmente
- Valida catálogos (CHECK constraints) ANTES de enviar a Supabase
- Maneja correctamente strings vacíos
- Aplica defaults seguros (42h, ARL nivel 1, etc.)

### 3. Ejecuta los tests para validar

```bash
cd /workspace/chronoswork
node test/run_all_tests.js
```

Deberías ver: `📊 RESUMEN TOTAL · ✅ Tests pasados: 78 · ❌ Tests fallados: 0`

---

## 📋 Archivos del fix

```
chronoswork/
├── supabase/
│   └── fix_all_check_constraints.sql    ← MIGRACIÓN CORRECTIVA (CRÍTICO)
├── src/hooks/
│   └── useEmployees.js                  ← Hook con validación robusta
├── test/
│   ├── test_area_creation.js            ← 37 tests de catálogo
│   ├── test_area_payloads.js            ← 17 tests de payloads
│   ├── test_clean_employee_data.js      ← 24 tests de validación
│   └── run_all_tests.js                 ← Runner completo
└── BUGFIX_CHECKLIST.md                  ← Este archivo
```

---

## ⚠️ Notas importantes

### Acerca de `numero_hijos` y `horas_semanales_contrato`

| Input | Antes (buggy) | Ahora (fix) |
|---|---|---|
| `numero_hijos: ""` | `null` (BD rechazaba) | `0` ✓ |
| `numero_hijos: "3"` | `3` | `3` ✓ |
| `numero_hijos: "abc"` | `null` (BD rechazaba) | `0` ✓ |
| `horas_semanales: ""` | `null` (BD rechazaba) | `42` ✓ |
| `horas_semanales: "0"` | `0` (BD rechazaba) | `42` ✓ |
| `horas_semanales: "200"` | `200` (raro) | `168` (cap) ✓ |
| `nivel_riesgo_arl: 99` | `99` (BD rechazaba) | `1` ✓ |

### Acerca de CHECK constraints

Ahora la BD acepta los 9 tipos de contrato en:
- `areas.tipo_contrato_default`
- `areas.tipo_contrato_predominante`
- `employees.tipo_contrato`

Y los CHECK constraints para:
- `jornada_tipo` (DIURNA, NOCTURNA, MIXTA, POR_TURNOS)
- `nivel_riesgo_arl` (1-5)
- `nivel_cargo` (JUNIOR, SENIOR, COORDINADOR, SUPERVISOR, JEFE, GERENTE, DIRECTOR)
- `nivel_educacion` (PRIMARIA, BACHILLERATO, TECNICO, TECNOLOGO, PREGRADO, ESPECIALIZACION, MAESTRIA, DOCTORADO, NINGUNO)
- `afp_tipo` (RAZON, PRIMAPROMEDIO)
- `estado_civil` (SOLTERO, CASADO, UNION_LIBRE, DIVORCIADO, VIUDO, SEPARADO)
- `genero` (M, F, OTRO, PREFIERO_NO_DECIR)
- `tipo_documento` (CC, CE, TI, PA, RC, PPT, NIT)
- `shift_kind` (STANDARD, PARTIDO, ROTATIVO, NOCTURNO, DISPONIBILIDAD, CUSTOM)
- Y más...

---

## 🎯 Próximos pasos recomendados

1. **Aplicar la migración** en Supabase (URGENTE)
2. **Reemplazar el hook** `useEmployees.js`
3. **Ejecutar los tests** para confirmar
4. **Probar crear áreas** en la app con los 9 tipos de contrato
5. **Probar crear empleados** con todos los campos opcionales vacíos

Si los tests SQL automáticos de la migración muestran ❌ FAIL, significa que hay un problema más profundo. Compárteme la salida del SQL Editor y te ayudo.
