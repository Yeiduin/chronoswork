---
name: checklist-casos-limite
description: Usa esta skill antes de dar por terminada cualquier función, endpoint o componente que procese datos (entradas de usuario, respuestas de API, listas, cálculos). Es un checklist fijo de casos límite a revisar — no depende de que "se te ocurran", es una lista que se marca siempre igual.
---

# Checklist de casos límite

Los bugs más comunes en código "que funciona" no vienen de sintaxis mal escrita — vienen de casos que nadie consideró: la lista vacía, el valor negativo, la segunda vez que se ejecuta algo que solo se probó una vez. Esta skill convierte esa revisión en un checklist mecánico, para que no dependa de la creatividad del modelo en el momento.

## Regla dura

**Antes de marcar una función/endpoint/componente como terminado, repasa este checklist explícitamente.** No hace falta que todos los puntos apliquen siempre — pero hay que descartarlos conscientemente, no saltárselos.

## El checklist

**Datos de entrada:**
- [ ] ¿Qué pasa si el valor es `null` o `undefined`?
- [ ] ¿Qué pasa si es una cadena vacía `""` o un array vacío `[]`?
- [ ] ¿Qué pasa si es `0`, negativo, o un número decimal donde se esperaba entero?
- [ ] ¿Qué pasa si el tipo no es el esperado (llega un string donde se esperaba number)?
- [ ] ¿Qué pasa si el valor es extremadamente grande (overflow, listas de miles de elementos)?

**Colecciones y bucles:**
- [ ] ¿El bucle/función maneja una colección con 0 elementos?
- [ ] ¿Maneja UN solo elemento (no solo el caso de "varios")?
- [ ] ¿Hay elementos duplicados en la colección? ¿Debería importar?
- [ ] ¿El índice puede salirse de rango (off-by-one, último elemento, primer elemento)?

**Estado y repetición:**
- [ ] ¿Qué pasa si esta acción se ejecuta dos veces seguidas (doble clic, reintento)?
- [ ] ¿Qué pasa la PRIMERA vez que corre (sin datos previos, sin sesión, sin caché)?
- [ ] Si es asíncrono: ¿qué pasa si dos llamadas se solapan (race condition)?

**Permisos y roles** (cruza con `analisis-de-requisitos-implicitos` si aplica):
- [ ] ¿Este código asume un rol/permiso específico sin verificarlo?
- [ ] ¿Qué pasa si el usuario no tiene el permiso esperado?

**Errores y red:**
- [ ] Si depende de una API/red, ¿qué pasa si falla, tarda, o devuelve un error 4xx/5xx?
- [ ] ¿El error se maneja explícitamente, o queda un `catch` vacío / silencioso?

## Procedimiento

1. Al terminar una función/endpoint/componente no trivial, repasa el checklist de arriba mentalmente (o escrito, si la lógica es compleja).
2. Para cada punto que aplique a este caso, decide explícitamente: ¿está manejado? ¿Hace falta un caso adicional en el código?
3. Si un caso relevante no está manejado, corrígelo ANTES de reportar la tarea como terminada — no lo dejes para que el usuario lo descubra usando la app.
4. Si decides que un caso no aplica (ej. "esta función nunca recibe null porque ya se valida antes"), está bien descartarlo — pero de forma consciente, no por omisión.

## Señales de que te saltaste esta skill

- El usuario reportó un bug que corresponde exactamente a uno de los puntos del checklist (lista vacía, doble clic, valor negativo).
- Diste una función por terminada sin haber considerado qué pasa con datos vacíos/nulos.
- Un `catch` en el código no hace nada visible (ni loguea, ni informa, ni recupera el estado).
