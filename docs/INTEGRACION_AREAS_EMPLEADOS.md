# ChronosWork — Integración Áreas + Empleados v3 (con importación masiva)

Paquete completo para gestionar áreas, empleados, contratos colombianos,
seguridad social, franjas horarias, y auto-asignación de turnos con
importación masiva desde Excel/CSV.

---

## 📦 Archivos del paquete

```
chronoswork/
├── src/
│   ├── config/
│   │   └── laborCatalog.js                  ← Catálogo laboral CO
│   ├── core/
│   │   └── generateAutomaticShifts.js       ← Algoritmo de turnos v3
│   ├── hooks/
│   │   ├── useAreas.js                      ← Acepta todos los campos
│   │   └── useEmployees.js                  ← Limpia + valida datos
│   ├── components/
│   │   ├── AreaForm.jsx                     ← Wizard 3 pasos
│   │   ├── EmployeeForm.jsx                 ← Wizard 8 pasos
│   │   ├── BulkImportAreasModal.jsx         ← Importar áreas masivamente
│   │   └── BulkImportModal.jsx              ← Importar empleados masivamente
│   └── pages/
│       ├── AreasPage.jsx                    ← Página de Áreas (integrada)
│       └── EmployeesPage.jsx                ← Página de Empleados (integrada)
└── supabase/
    ├── expand_areas_laboral.sql             ← +30 campos a areas
    ├── expand_employees_laboral.sql         ← +60 campos a employees
    └── expand_shift_templates.sql           ← +15 campos a shift_templates
```

---

## 🚀 Pasos de instalación

### 1) Aplica las migraciones SQL en Supabase

Ve al **SQL Editor** y corre **en este orden**:

```sql
\i supabase/expand_areas_laboral.sql
\i supabase/expand_employees_laboral.sql
\i supabase/expand_shift_templates.sql
```

Las migraciones son **idempotentes** (usan `IF NOT EXISTS`).

### 2) Reemplaza los archivos

Copia cada archivo del paquete sobre tu proyecto:

| Origen | Destino |
|---|---|
| `src/config/laborCatalog.js` | `chronoswork/src/config/laborCatalog.js` |
| `src/core/generateAutomaticShifts.js` | `chronoswork/src/core/generateAutomaticShifts.js` |
| `src/hooks/useAreas.js` | `chronoswork/src/hooks/useAreas.js` |
| `src/hooks/useEmployees.js` | `chronoswork/src/hooks/useEmployees.js` |
| `src/components/AreaForm.jsx` | `chronoswork/src/components/AreaForm.jsx` |
| `src/components/EmployeeForm.jsx` | `chronoswork/src/components/EmployeeForm.jsx` |
| `src/components/BulkImportAreasModal.jsx` | `chronoswork/src/components/BulkImportAreasModal.jsx` |
| `src/components/BulkImportModal.jsx` | `chronoswork/src/components/BulkImportModal.jsx` |
| `src/pages/AreasPage.jsx` | `chronoswork/src/pages/AreasPage.jsx` |
| `src/pages/EmployeesPage.jsx` | `chronoswork/src/pages/EmployeesPage.jsx` |

Las páginas **ya están integradas** con los nuevos componentes.

### 3) Verifica que los modales de importación masiva funcionan

1. Ve a la página **Áreas** → Click en **"📥 Importar Excel"** → Descarga la plantilla
2. Llena algunas filas → Sube el archivo → Revisa → Importa
3. Repite para **Empleados**

---

## 🎯 Funcionalidad completa

### Wizard de creación de áreas (3 pasos)

1. **Identidad**: sector, nombre (con sugerencias), código interno, color
2. **Jornada y Salario**: modo (oficina/24-7), tipo jornada CST, patrón rotativo, duración, HE máx, contrato, salario, ARL
3. **Extras y operación**: turno nocturno 24/7, dotación, EPP, break, notas

→ Al guardar, se crean **franjas horarias típicas del sector** automáticamente.

### Wizard de creación de empleados (8 pasos)

1. Identidad (CC, nombre, fecha nac, género, estado civil, hijos, discapacidad)
2. Contacto y emergencia
3. Contrato (área, cargo, **9 tipos de contrato**, fechas, jornada)
4. Salario (con flag "Especial" para salario personalizado)
5. Seguridad social (EPS, AFP, ARL, Caja, cesantías)
6. Datos bancarios
7. Académico (SENA aprendiz, licencia de conducción)
8. Datos fiscales (DIAN)

### Importación masiva

#### Áreas

Plantilla con **24 columnas** y validaciones de catálogo:

| Obligatoria | Columna | Descripción |
|---|---|---|
| ✦ | `nombre` | Nombre del área |
| ✦ | `valor_hora_default` | Salario base por hora COP |
|  | `sector` | RETAIL, SALUD, HOTELERIA, INDUSTRIA, etc. |
|  | `modo_operacion` | OFICINA / 24_7 |
|  | `jornada_tipo` | DIURNA, NOCTURNA, MIXTA, POR_TURNOS |
|  | `patron_rotativo` | 5x2, 6x1, 7x7, 14x14, etc. |
|  | `dias_trabajo` | L-V, L-S, L-D o L,M,X,J,V |
|  | `dias_descanso` | 1 o 2 |
|  | `tipo_contrato` | INDEFINIDO, TERMINO_FIJO, OBRA_LABOR, etc. |
|  | `nivel_arl` | 1-5 |
|  | `requiere_dotacion`, `requiere_epp` | Si/No |
|  | `paga_auxilio` | Si/No |
|  | ... | (más columnas opcionales) |

→ Al importar, **se crean las franjas típicas del sector** automáticamente.

#### Empleados

Plantilla con **35 columnas**:

| Obligatoria | Columna | Descripción |
|---|---|---|
| ✦ | `cedula` | 5-12 dígitos numéricos |
| ✦ | `nombre` | Nombre completo |
| ✦ | `cargo` | Cargo u ocupación |
| ✦ | `area` | **Debe existir** en la plataforma |
|  | `tipo_contrato` | INDEFINIDO, TERMINO_FIJO, OBRA_LABOR, POR_HORAS, etc. |
|  | `tipo_doc` | CC, CE, TI, PA, PPT, NIT |
|  | `valor_hora`, `salario_mensual` | Si vacío, usa el del área |
|  | `eps`, `afp`, `arl`, `caja`, `cesantias` | Nombres de las entidades |
|  | `nivel_arl` | 1-5 |
|  | `banco`, `tipo_cuenta`, `n°_cuenta` | Datos bancarios |
|  | `nivel_educacion` | PRIMARIA, BACHILLERATO, TECNICO, etc. |
|  | ... | (más columnas opcionales) |

### Auto-asignación de turnos

El algoritmo soporta los **6 tipos de turno** del mercado colombiano:

| Tipo | Uso | Ejemplo |
|---|---|---|
| STANDARD | Turno corrido | 6:00-14:00 |
| PARTIDO | Con hora de almuerzo | 7-12 + 14-18 |
| ROTATIVO | Sistema rota entre turnos | Patrón 5x2, 6x1, 7x7 |
| NOCTURNO | Predominantemente nocturno (HON automático) | 22:00-06:00 |
| DISPONIBILIDAD | Guardia on-call | Recargo por disponibilidad |
| CUSTOM | Definido por el usuario | Libre |

### Patrones rotativos soportados

2x1, 3x2, 4x3, **5x2 (L-V)**, 6x1, **7x7 (mineras)**, 10x5, **14x14 (salud)**, Personalizado

---

## 📊 Cobertura de campos

### Áreas (30+ nuevos)
- Identidad: `codigo_area`, `sector`, `sub_sector`, `centro_costo`
- Jornada: `jornada_tipo`, `duracion_jornada_horas`, `patron_rotativo`, `jornada_partida`, `he_max_*`
- Contrato: `tipo_contrato_predominante`, `dias_descanso_*`
- Salario/ARL: `paga_auxilio_transporte`, `nivel_riesgo_arl`, `tarifa_arl_por_mil`
- Dotación/EPP: `requiere_dotacion`, `dotacion_periodicidad_meses`, `requiere_epp`, `descripcion_epp`
- Ubicación: `sede_id`, `direccion`, `ciudad`, `departamento`
- Prestaciones: `incluye_prima_servicios`, `bono_extra_legal`, `bono_monto_fijo_mensual`
- Presupuesto: `presupuesto_mensual`, `alerta_sobrecosto_porcentaje`

### Empleados (60+ nuevos)
- Personales: `tipo_documento`, `lugar_expedicion`, `fecha_nacimiento`, `genero`, `estado_civil`, `contacto_emergencia_*`, `numero_hijos`, `tiene_discapacidad`
- Contractuales: `fecha_ingreso`, `fecha_fin_contrato`, `periodo_prueba_hasta`, `cargo_codigo`, `nivel_cargo`, `reporta_a`, `es_jefe`
- Salariales: `salario_mensual`, `auxiliar_areas_ids`, `bono_rodamiento`, `bonificacion_fija`
- Seguridad social: `eps_*`, `afp_*`, `arl_*`, `caja_*`, `fondo_cesantias`
- Bancarios: `banco_nombre`, `tipo_cuenta`, `numero_cuenta`, `titular_cuenta`
- Académicos: `nivel_educacion`, `sena_aprendiz`, `etapa_productiva`
- Fiscales: `responsable_iva`, `declarante_renta`, `numero_dependientes`
- Jornada: `horas_semanales_contrato`, `dias_descanso_fijos`, `duracion_jornada_horas`

---

## ⚖️ Cumplimiento legal incluido

- ✅ Ley 2101/2021 — 42h semanales
- ✅ Ley 2466/2025 — Vacaciones 15 días (18 desde 2027)
- ✅ CST art. 47 — Contrato por horas (4h mín.)
- ✅ CST art. 230 — Dotación cada 4 meses
- ✅ Decreto 1295/94 — Niveles ARL I-V
- ✅ Ley 1882/2018 — Aprendices SENA
- ✅ Sentencia C-201/24 — Límite 3 meses a prestación de servicios
- ✅ Ley 1618/13 — Estabilidad laboral reforzada

---

## 🧪 Ejemplo de uso

### Crear 3 áreas con 5 empleados cada una en 2 minutos

1. **Áreas → "Importar Excel" → Descarga plantilla**
2. Llena 3 filas:
   ```
   nombre        | sector   | valor_hora | tipo_contrato
   Cajas         | RETAIL   | 12500      | INDEFINIDO
   Vigilancia    | SEGURIDAD| 12000      | INDEFINIDO
   Cocina        | RESTAURANTE| 13000   | INDEFINIDO
   ```
3. Sube el archivo → Verás 3 áreas listas, con franjas típicas ya creadas.

4. **Empleados → "Importar Excel" → Descarga plantilla**
5. Llena 15 filas (5 por área). Las celdas dropdown te guían.
6. Sube el archivo → 15 empleados creados y asignados automáticamente al área.

7. **Programación → "Auto-asignar"** → Cubre toda la demanda del mes.

---

## 🆘 Soporte

Si tienes dudas con la instalación, escríbeme. También puedo:
- Crear más plantillas de Excel (por sector)
- Agregar más validaciones de nómina
- Crear la página de Prenómina con todos los conceptos colombianos
