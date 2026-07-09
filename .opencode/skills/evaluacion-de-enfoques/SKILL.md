---
name: evaluacion-de-enfoques
description: Usa esta skill antes de tomar cualquier decisión de implementación o diseño no trivial que tenga más de una forma razonable de resolverse (elegir estructura de datos, patrón de arquitectura, librería, enfoque de UI, estrategia de estado, etc.). No es para depurar errores — para eso usa systematic-debugging. Esta skill es para decisiones donde no hay "error", solo caminos distintos con distintos trade-offs.
---

# Evaluar varios enfoques antes de decidir

Un modelo débil tiende a implementar la PRIMERA solución que se le ocurre, sin considerar si hay una mejor. Esto produce código que "funciona" pero que quedó atado a la primera idea, no a la mejor idea disponible. Esta skill fuerza comparar antes de comprometerse.

## Regla dura

**Para cualquier decisión de diseño/implementación no trivial, no actúes sobre la primera idea.** Genera al menos 2, idealmente 3, enfoques viables, compáralos brevemente, y elige explícitamente el mejor antes de escribir código.

## Cuándo aplica (ejemplos)

- Elegir cómo estructurar el estado de una app (Context API vs. store dedicado vs. props drilling controlado).
- Elegir una librería o servicio gratuito entre varias opciones viables.
- Decidir el enfoque de una feature (ej. paginación en frontend vs. en backend, validación en cliente vs. servidor vs. ambos).
- Refactorizar una parte del código que puede reorganizarse de más de una forma razonable.
- Diseñar el layout/flujo de una interfaz cuando hay más de un patrón UX válido.

## Cuándo NO aplica

- Bugs con causa raíz concreta → usa `systematic-debugging`.
- Tareas triviales de una sola forma obvia de hacerse (ej. renombrar una variable, corregir un typo).

## Procedimiento

1. **Genera 2-3 enfoques concretos y viables** para resolver el problema. No enfoques de relleno solo para cumplir el número — deben ser opciones reales que alguien consideraría.
2. **Para cada uno, evalúa brevemente** (2-4 líneas por enfoque, no un ensayo):
   - Complejidad de implementación.
   - Mantenibilidad a futuro.
   - Rendimiento, si es relevante.
   - Costo — recuerda la restricción del equipo de usar únicamente herramientas/servicios gratuitos.
   - Riesgo de romper algo existente.
3. **Elige explícitamente uno y justifica en 1-2 líneas** por qué es mejor que los otros dos en este contexto específico. No dejes la elección implícita.
4. **Si dos enfoques quedan muy parejos**, prefiere el más simple de mantener (menos dependencias, menos "magia") sobre el más elegante en abstracto.
5. **Documenta brevemente la decisión** en el plan o en un comentario de commit/PR si aplica, para que quede trazable por qué se eligió ese camino y no otro.
6. Procede a implementar solo el enfoque elegido — no dejes código de los enfoques descartados a medio escribir en el proyecto.

## Formato mínimo

```
Decisión: <qué hay que resolver>
Opción A: <enfoque> — pros: ... / contras: ...
Opción B: <enfoque> — pros: ... / contras: ...
Opción C: <enfoque> — pros: ... / contras: ...
Elegido: <A/B/C> porque <razón concreta en 1-2 líneas>
```

## Señales de que te saltaste esta skill

- Empezaste a escribir código de la primera idea sin haber considerado alternativas.
- No puedes explicar por qué elegiste este enfoque y no otro si el usuario pregunta.
- Añadiste una librería o servicio sin comparar con al menos una alternativa gratuita.
