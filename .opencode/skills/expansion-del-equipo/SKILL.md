---
name: expansion-del-equipo
description: Usa esta skill (solo el Orquestador) cuando una petición del usuario pertenezca a un dominio especializado que el equipo actual (analista, arquitecto, disenador, qa-tester, auditor, investigador, vigilante) no cubre bien — por ejemplo desarrollo de videojuegos, testing de videojuegos, procesamiento de audio/video, machine learning, blockchain, hardware/IoT, etc. En vez de forzar al equipo genérico a improvisar en un dominio que no domina, crea un nuevo agente especializado, permanente, disponible para este y futuros proyectos.
---

# Expansión dinámica del equipo

El equipo base (`analista`, `arquitecto`, `disenador`, `qa-tester`, `auditor`, `investigador`, `vigilante`) está pensado para desarrollo de software general (web, apps). Cuando una petición cae en un dominio especializado con sus propias mejores prácticas — diseño de videojuegos, balance de mecánicas, testing específico de videojuegos, procesamiento de señal, ML, etc. — un agente genérico "actuando de arquitecto" da resultados mediocres porque le falta el marco de conocimiento específico del dominio. La solución no es forzar al equipo existente: es crear un especialista nuevo, una sola vez, que quede disponible para siempre.

## Cuándo se activa

- El usuario pide algo que pertenece claramente a un dominio con expertise propia y distinta de desarrollo web/app general (ej. "crea un juego de plataformas", "haz testing de balance de este juego", "procesa este audio", "entrena un modelo simple").
- Ya intentaste resolverlo con `arquitecto`/`qa-tester` genéricos y el resultado se siente genérico o le faltan consideraciones propias del dominio (ej. un juego sin pensar en game feel, hitboxes, frame data, balance).

## Procedimiento

1. **Verifica que no exista ya un agente para ese dominio.** Revisa la carpeta `agent/` (vía `list_dir`) y el bloque `"agent"` de `opencode.json` — si ya hay uno con propósito similar, úsalo en vez de crear un duplicado.
2. **Define el nuevo agente**:
   - Nombre corto, descriptivo, en `kebab-case` (ej. `game-developer`, `game-tester`, `audio-engineer`).
   - Redacta su prompt (system prompt) en un archivo `agent/<nombre>.md`, siguiendo el mismo estilo que los agentes existentes: identidad breve, luego una lista numerada de directrices concretas y accionables — no genéricas. Estas directrices deben reflejar mejores prácticas REALES del dominio (ej. para `game-developer`: game loop, delta time, input buffering, colisiones, game feel; para `game-tester`: balance, exploits, softlocks, frame-perfect issues).
   - Haz referencia a las skills del equipo que le apliquen (`systematic-debugging`, `verification-before-completion`, `evaluacion-de-enfoques`, `analisis-de-impacto`, etc.) igual que hacen los demás agentes — el especialista nuevo no debe perder la disciplina del equipo, solo sumar expertise de dominio.
3. **Regístralo en `opencode.json`**, dentro del bloque `"agent"`, con la misma estructura que los demás:
   ```jsonc
   "nombre-del-agente": {
     "description": "Descripción breve de cuándo invocarlo",
     "mode": "subagent",
     "prompt": "{file:./agent/nombre-del-agente.md}",
     "temperature": 0.2, // ajusta según si necesita más creatividad o más precisión
     "permission": {
       "edit": "allow", // o "deny" si es de solo análisis/testing
       "bash": "ask"
     }
   }
   ```
   No le pongas un `"model"` fijo — debe heredar el modelo activo del usuario, igual que el resto del equipo, para respetar la restricción de solo usar modelos gratuitos.
4. **Anuncia al usuario, en una línea clara, que creaste un agente nuevo**:
   ```
   🧩 Este proyecto necesita expertise en desarrollo de videojuegos que el equipo actual no cubre bien.
   Creé un nuevo especialista permanente: @game-developer. Quedará disponible también para tus próximos proyectos.
   ```
5. **Úsalo de inmediato** para la tarea actual — no lo crees y sigas con el equipo genérico.
6. **Actualiza también la sección "Tu equipo" de tu propio prompt** (`agent/orquestador.md`) agregando una línea para el nuevo agente, para que quede documentado y disponible en el listado desde la próxima sesión.
7. **No crees agentes de más.** Esta skill es para dominios genuinamente distintos con su propio cuerpo de mejores prácticas — no crees un agente nuevo para cada feature o variación menor. Ante la duda, prefiere usar al equipo existente.

## Señales de que te saltaste esta skill

- Le pediste a `arquitecto` que "actúe como" un experto en un dominio muy distinto en vez de crear un agente real para eso, y el resultado careció de las mejores prácticas específicas del dominio.
- Creaste un agente nuevo pero no lo registraste en `opencode.json`, por lo que no quedó disponible para usarse.
- Creaste un agente duplicado para algo que ya cubría otro agente existente.
