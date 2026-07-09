---
name: trazabilidad-de-estado-compartido
description: Usa esta skill ANTES de modificar cualquier variable de estado (state, contexto global, store, variable de sesión) que pueda ser leída o escrita desde más de un lugar del proyecto. Es la versión enfocada en bugs de sincronización/estado de la skill `analisis-de-impacto` — mientras esa busca TODOS los usos de un elemento, esta se enfoca específicamente en el flujo de lectura/escritura de un dato de estado.
---

# Trazabilidad de estado compartido

Los bugs más difíciles de rastrear en apps con estado (React, Vue, cualquier SPA) no son errores de sintaxis — son casos donde un dato se actualiza en un lugar pero otro lugar del código sigue asumiendo el valor viejo, o donde dos partes del código escriben el mismo dato de formas inconsistentes. Esto pasa constantemente cuando se modifica estado sin haber mapeado antes quién más depende de él.

## Regla dura

**Antes de modificar cómo se lee, escribe o calcula un dato de estado compartido, identifica explícitamente TODOS los lugares que lo leen y TODOS los que lo escriben.** No asumas que tu cambio en un componente no afecta a otro que consume el mismo estado.

## Procedimiento

1. **Identifica el dato de estado exacto** que vas a modificar (nombre de la variable, la clave en el store/contexto, el campo en la sesión).
2. **Busca todos los lugares que lo LEEN** (dónde se consume ese valor: componentes, hooks, funciones que lo reciben como parámetro derivado).
3. **Busca todos los lugares que lo ESCRIBEN** (dónde se actualiza/setea ese valor — puede haber más de un lugar, lo cual ya es una señal de riesgo en sí misma).
4. **Si hay más de un lugar que escribe el mismo dato**, evalúa si deberían consolidarse en una sola fuente de verdad (ver `reglas-anti-complejidad`, regla de fuente única) en vez de mantener varios puntos de escritura que pueden desincronizarse.
5. **Antes de aplicar el cambio**, pregúntate: si actualizo este valor aquí, ¿los otros lugares que lo leen van a recibir el valor actualizado de inmediato, o pueden quedarse con una versión vieja (por ejemplo, por un valor cacheado, un cierre/closure obsoleto, o un componente que no se re-renderiza)?
6. **Aplica el cambio de forma consistente en todos los lugares relevantes** en la misma tarea — no dejes un lugar leyendo el dato de la forma vieja y otro de la forma nueva.
7. **Verifica después del cambio** navegando mentalmente (o probando si es posible) los distintos flujos que tocan ese estado: ¿todos ven el mismo valor en el mismo momento?

## Ejemplo del tipo de bug que previene

Un valor de "usuario autenticado" que se guarda tanto en un contexto global como en una variable local de un componente. Se actualiza el contexto al cerrar sesión, pero el componente sigue mostrando la variable local vieja porque nadie sincronizó ambas — el usuario ve su nombre en el header después de haber cerrado sesión.

## Señales de que te saltaste esta skill

- Modificaste dónde se actualiza un dato de estado sin revisar quién más lo lee.
- Un componente muestra un valor "viejo" después de que otro componente lo actualizó.
- El mismo dato se guarda en más de una variable/estado que puede desincronizarse.
