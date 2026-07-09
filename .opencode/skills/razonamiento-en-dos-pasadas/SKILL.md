---
name: razonamiento-en-dos-pasadas
description: Úsala antes de entregar CUALQUIER respuesta, plan, pieza de código o decisión no trivial al usuario o a otro agente. Genera un borrador, luego critícalo tú mismo desde una postura escéptica, y solo entonces entrega la versión final. No es opcional para decisiones con impacto — es el paso que más eleva la calidad de un modelo, sin importar qué tan potente sea.
---

# Razonamiento en dos pasadas (borrador → autocrítica → versión final)

## Por qué existe esta skill

Un modelo, potente o no, tiende a entregar su PRIMERA idea razonable como si fuera la definitiva. La primera idea suele ser correcta en el caso general y débil en los bordes. La diferencia entre una respuesta mediocre y una excelente casi nunca está en generar la idea inicial — está en revisarla con ojo crítico antes de entregarla. Esta skill obliga a ese segundo paso explícitamente, en vez de dejarlo a que "se te ocurra".

Esta skill aplica a CUALQUIER modelo detrás del agente, sea local o de frontera — es una técnica de proceso, no de conocimiento.

## Cuándo se activa

- Antes de entregar una respuesta final al usuario sobre algo con más de una forma válida de resolverse.
- Antes de que @arquitecto o @disenador den una pieza de código no trivial por terminada.
- Antes de que @analista entregue una recomendación de stack o de requerimientos.
- Antes de que el Orquestador presente un plan de acción de varias tareas.
- NO hace falta para respuestas triviales, de una sola forma correcta (un typo, una pregunta de sí/no sobre un hecho verificable).

## Procedimiento obligatorio

### Pasada 1 — Borrador
Genera tu respuesta/solución/plan normalmente, como lo harías de forma natural.

### Pasada 2 — Autocrítica (cambia de postura explícitamente)
Adopta mentalmente el rol de un revisor escéptico que NO escribió el borrador y cuyo trabajo es encontrarle fallas reales. Pregúntate, en este orden:

1. **¿Qué parte del borrador asumí sin verificar?** (un comportamiento de librería, una intención del usuario, un caso que "seguramente" no pasa).
2. **¿Qué caso de entrada específico rompería esto?** No te quedes en "podría haber edge cases" — nombra uno concreto (ej. "si la lista viene vacía", "si dos requests llegan al mismo tiempo", "si el usuario no tiene el rol esperado").
3. **¿Hay una forma más simple de lograr lo mismo?** Si el borrador tiene más pasos, capas o abstracciones de las necesarias, es una señal de sobre-ingeniería, no de rigor.
4. **¿Responde exactamente lo que se pidió, o algo adyacente/más cómodo de responder?** Es común derivar hacia una versión ligeramente distinta del problema porque es más fácil de resolver.
5. **Si esto fuera a producción mañana, ¿qué es lo primero que se rompería?**

### Pasada 3 — Versión final
Con lo que encontraste en la pasada 2, corrige el borrador. Si la autocrítica no encontró nada real (no inventes problemas para cumplir el trámite — ver regla dura abajo), entrega el borrador tal cual, pero habiendo hecho el ejercicio real.

## Regla dura: no fabricar autocrítica de relleno

Si tras el ejercicio genuino no encuentras fallas reales, di explícitamente que el borrador pasó la autocrítica sin cambios — no inventes una objeción débil solo para simular que hiciste el paso. Fabricar críticas irrelevantes es tan inútil como no criticar nada: entrena el hábito equivocado de "ruido que parece rigor".

## Diferencia con otras skills del equipo

- `evaluacion-de-enfoques` compara 2-3 caminos de implementación DISTINTOS antes de elegir uno. Esta skill critica UN borrador ya elegido para pulirlo, no compara alternativas completas.
- `checklist-casos-limite` es una lista fija (nulos, vacíos, duplicados...) aplicada a funciones que procesan datos. Esta skill es un ejercicio de escepticismo general, aplicable también a planes, textos y decisiones no relacionadas con procesamiento de datos.
- El agente `@critico-adversarial` hace este mismo tipo de ejercicio pero como un segundo agente independiente, para decisiones grandes (arquitectura, alcance de una feature completa). Esta skill es la versión que cualquier agente aplica sobre su propio trabajo, para decisiones de tamaño medio que no ameritan invocar a otro agente.
