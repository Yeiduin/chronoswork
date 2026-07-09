---
name: auto-documentacion-de-dominio
description: Usa esta skill al comenzar a trabajar en un proyecto (primera tarea de la sesión, o primera vez que se toca ese proyecto) para detectar automáticamente si existe un AGENTS.md local, y si no existe o está incompleto, escanear el código y generarlo/actualizarlo documentando roles, permisos, entidades y convenciones del proyecto. El objetivo es que el dominio del proyecto se documente UNA VEZ y quede disponible para todas las tareas futuras, en vez de tener que redescubrirlo cada vez.
---

# Auto-documentación de dominio del proyecto

Un `AGENTS.md` global (el que vive en la configuración de OpenCode) puede darte reglas de comportamiento, pero **no puede saber de antemano los roles, permisos o entidades específicas de cada proyecto que el usuario desarrolle** — eso cambia de proyecto a proyecto. Esta skill hace que ESE conocimiento se descubra y se guarde una sola vez, automáticamente, en la raíz de cada proyecto.

## Cuándo se activa

- Es la primera tarea que haces en un proyecto/carpeta en la que no has trabajado antes en esta sesión.
- El usuario pide implementar algo (feature, bug, componente) y no existe un `AGENTS.md` en la raíz del proyecto actual (distinto del global de OpenCode).
- Detectas que el `AGENTS.md` del proyecto existe pero claramente quedó desactualizado (ej. el código tiene un rol o entidad que no está documentado ahí).

## Procedimiento

1. **Verifica si existe `AGENTS.md` en la raíz del proyecto actual.** Si existe y parece completo y actualizado, úsalo como fuente de verdad y no repitas este proceso.
2. **Si no existe, o está vacío/incompleto**, escanea el proyecto buscando señales de dominio de negocio:
   - Roles y permisos: busca enums, tipos o constantes como `role`, `Role`, `UserType`, `permissions`, archivos de middleware de autenticación/autorización, rutas protegidas (`<ProtectedRoute>`, decoradores de permisos, guards).
   - Entidades principales: modelos de base de datos, schemas (Prisma, SQL migrations, Mongoose), tipos/interfaces de las entidades centrales del negocio.
   - Planes o tiers si el proyecto es SaaS (free/pro/enterprise, límites por plan).
   - Convenciones de estructura: dónde viven componentes, rutas, servicios, hooks.
3. **Si la información es clara en el código**, redacta el `AGENTS.md` del proyecto con esta estructura mínima:
   ```markdown
   # AGENTS.md — [nombre del proyecto]

   ## Roles del sistema
   - **rol_1**: qué puede hacer, qué NO puede hacer/ver.
   - **rol_2**: ...

   ## Entidades principales
   - **Entidad**: descripción breve, campos clave.

   ## Comandos del proyecto (OBLIGATORIO detectarlos, aunque no haya roles/entidades claras)
   - Lint: `<comando exacto, ej. npm run lint>`
   - Type-check: `<comando exacto, ej. npm run check-types o tsc --noEmit>`
   - Tests: `<comando exacto, ej. npm test>`
   - Build: `<comando exacto, ej. npm run build>`
   Si el proyecto no tiene alguno de estos configurado, dilo explícitamente ("sin type-check configurado") en vez de omitirlo en silencio — así se sabe que hay que revisar manualmente en vez de asumir que se corrió una verificación que no existe.

   ## Convenciones detectadas
   - Estructura de carpetas, patrones de nombres, stack usado.

   ## Notas
   - Cualquier ambigüedad detectada que el usuario debería confirmar.
   ```
4. **Si la información NO es clara** (proyecto muy nuevo, sin roles definidos aún, o ambigüedad real), NO inventes la estructura de negocio. Pregunta directamente al usuario: "Voy a documentar el dominio de este proyecto para no tener que volver a preguntarte esto — ¿qué roles/tipos de cuenta existen y qué puede hacer cada uno?". Guarda su respuesta en el archivo.
5. **Nunca sobreescribas un `AGENTS.md` existente sin avisar.** Si ya existe, léelo primero y compleméntalo/actualízalo — no lo reemplaces entero.
6. **Avisa al usuario que creaste o actualizaste el archivo**, en una línea, sin hacer de esto una tarea larga: "📄 Detecté que no había un AGENTS.md de este proyecto — lo generé documentando los roles y entidades que encontré en el código. Revísalo cuando puedas: `AGENTS.md`."
7. **En sesiones futuras**, si al trabajar notas que el código introdujo un rol, entidad o convención nueva que no está en el `AGENTS.md`, actualízalo en el momento — no dejes que se desincronice del código real.

## Relación con otras skills

Esta skill es la que ALIMENTA a `analisis-de-requisitos-implicitos`: una vez que el dominio está documentado aquí, esa otra skill ya no tiene que inferir los roles buscando en el código cada vez — los lee directo del `AGENTS.md` del proyecto.

## Señales de que te saltaste esta skill

- Empezaste a implementar features en un proyecto sin verificar si existe un `AGENTS.md` local.
- Inventaste una estructura de roles/permisos sin buscar evidencia en el código ni preguntar al usuario.
- El proyecto evolucionó (nuevo rol, nueva entidad) y el `AGENTS.md` se quedó desactualizado sin que lo notaras.
