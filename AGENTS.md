# Contexto global — Super Agentes (OpenCode)

Este archivo se carga como contexto para todos los agentes, sin importar cuál esté activo. Contiene información del entorno y estándares que no dependen de qué agente específico esté trabajando.

## Entorno del usuario

- **Sistema operativo**: Windows, terminal PowerShell.
- **OneDrive activo**: las carpetas de usuario (Escritorio, Documentos, Descargas) pueden estar redirigidas a rutas dentro de OneDrive (ej. `C:\Users\<usuario>\OneDrive\Desktop`) en vez de la ruta local estándar. Nunca asumas una sola ubicación posible — usa la skill `busqueda-exhaustiva` en cuanto una ruta obvia no dé resultado.
- **Modelos configurados**: puede haber modelos locales vía Ollama (capacidad modesta) o modelos en la nube conectados por el usuario. No asumas de antemano qué tan potente es el modelo detrás de un agente — las skills del equipo (`writing-plans`, `verification-before-completion`, `systematic-debugging`, `evaluacion-de-enfoques`, `busqueda-exhaustiva`) existen precisamente para no depender de esa potencia.

## Estándares transversales (aplican a todos los agentes)

1. **Nunca reportes algo como encontrado/terminado/resuelto sin evidencia real.** Ver el código y "creer" que funciona no cuenta — hay que ejecutar y comprobar.
2. **Nunca te rindas en una búsqueda (de archivo, de información, o de causa de un error) tras un solo intento.** Agota alternativas razonables primero.
3. **Ante una decisión de implementación con más de un camino válido, compara antes de elegir.** No implementes la primera idea sin considerar alternativas.
4. **Antes de construir cualquier botón, ruta o vista, verifica si el proyecto tiene roles, permisos o tipos de cuenta que la afecten.** No asumas que un elemento se comporta igual para todos los usuarios de la app solo porque el pedido no mencionó los roles explícitamente. Usa la skill `analisis-de-requisitos-implicitos`.
5. **Antes de modificar cualquier componente, función, estilo o tipo, busca TODAS sus referencias en el proyecto primero.** No edites solo el archivo que el usuario mencionó — si ese elemento se usa en otras pantallas, roles o flujos, esos lugares también deben quedar consistentes en la misma tarea. Usa la skill `analisis-de-impacto`.
6. **Restricción de presupuesto**: todo el stack, librerías y servicios deben ser gratuitos (open source, self-hosted, o free tier real sin tarjeta oculta), salvo que el usuario indique explícitamente lo contrario.
7. **Comunicación con el usuario siempre en español**, clara y sin jerga innecesaria.
8. **Antes de escribir código de lógica no trivial, piénsala en texto plano primero.** Usa `pseudocodigo-antes-de-codigo-complejo` para condicionales de varias ramas, algoritmos o máquinas de estado — no traduzcas el problema directo a sintaxis.
9. **Antes de dar por terminada una función que procesa datos, repasa el checklist fijo de casos límite** (`checklist-casos-limite`): nulos, vacíos, negativos, duplicados, doble ejecución, errores de red. No dependas de que "se te ocurra" — es una lista a marcar siempre.
10. **Escribe código simple por diseño**: guard clauses en vez de anidar, funciones cortas de una sola responsabilidad, nada de números mágicos, una sola fuente de verdad por cada dato, ningún error en silencio (`reglas-anti-complejidad`).
11. **Corre el linter/type-checker del proyecto después de cada edición**, no solo al terminar la feature completa — atrapa errores de tipos apenas ocurren.
12. **Antes de entregar cualquier respuesta, plan o código no trivial, aplica un segundo pase de autocrítica escéptica** (`razonamiento-en-dos-pasadas`): genera tu borrador, luego busca activamente qué asumiste sin verificar, qué caso concreto lo rompería, y si hay una forma más simple — recién entonces entrega la versión final. Esto aplica sin importar qué tan potente sea el modelo detrás del agente; es la técnica individual con mayor impacto en la calidad del resultado.
13. **Antes de declarar cualquier tarea como terminada, releé el pedido original palabra por palabra** (`verificacion-de-instrucciones-explicitas`), no un resumen mental de él, y confirma requisito por requisito que la entrega los cubre — con especial atención a condiciones tipo "solo si"/"excepto cuando" y a correcciones que el usuario haya dado a mitad de camino.
14. **Para decisiones de arquitectura, alcance o diseño que no sean triviales, pasan por `@critico-adversarial` antes de implementar.** Es más barato encontrar un supuesto equivocado o un caso límite no contemplado en el plan que después de haber programado sobre él.

## Revisión de lógica como paso propio

Además del Auditor (seguridad/rendimiento/estilo) y QA Tester (comportamiento desde la perspectiva del usuario), el equipo tiene a **@revisor-logico**, enfocado únicamente en correctitud lógica interna (condicionales, bucles, cálculos, estado). Se invoca después de escribir lógica no trivial y antes de dar una feature por terminada — no reemplaza a los otros dos, los complementa.

## Cuándo escalar entre agentes

- Error persistente tras 2 intentos con la misma causa → `@investigador`.
- Proceso colgado, comando bash sin retornar, puerto ocupado, servidor que no libera terminal → `@vigilante` inmediatamente, no reintentar a ciegas.
- Duda de requerimientos o alcance no resuelta por el equipo → devolver la pregunta al usuario en vez de asumir.

## Documentación de dominio por proyecto

Este `AGENTS.md` es GLOBAL — aplica a todos tus proyectos por igual. Cada proyecto individual debería tener SU PROPIO `AGENTS.md` en su raíz, documentando su dominio específico (roles, entidades, convenciones). El orquestador lo genera automáticamente la primera vez que trabaja en cada proyecto (ver skill `auto-documentacion-de-dominio`), así que no tienes que crearlo tú a mano — pero puedes editarlo libremente si algo quedó mal detectado o incompleto.
