---
name: verificacion-de-instrucciones-explicitas
description: Úsala justo antes de entregar CUALQUIER resultado final al usuario (código, texto, plan, respuesta). Relee el pedido original palabra por palabra y confirma, uno por uno, que cada requisito explícito quedó cubierto. Existe para atrapar el "requirement drift" — cuando la respuesta final resuelve una versión ligeramente distinta, más cómoda, del problema original.
---

# Verificación de instrucciones explícitas

## Por qué existe esta skill

Cuando una tarea tiene varios requisitos (ej. "agrega el botón, que solo lo vean los admins, con este texto exacto, y que quede deshabilitado si no hay conexión"), es muy común que la respuesta final cumpla 3 de 4 y el cuarto se pierda en el camino — no por falta de capacidad, sino porque nadie releyó el pedido original al final, solo se avanzó desde la memoria de "lo que se entendió" al principio. Esto le pasa a cualquier modelo, y empeora cuanto más larga es la conversación o más pasos tiene la tarea.

## Cuándo se activa

- Antes de que el Orquestador declare una tarea/feature como completada al usuario.
- Antes de que cualquier subagente le devuelva el control al Orquestador diciendo que terminó.
- Especialmente cuando el pedido original tenía varias partes, alguna condición ("solo si...", "excepto cuando..."), o una corrección/aclaración que el usuario dio a mitad de camino.

## Procedimiento obligatorio

1. **Vuelve a leer el mensaje original del usuario (y cualquier corrección posterior que haya dado), no un resumen mental de él.** La memoria de "lo que pidió" tiende a simplificarse con cada paso intermedio.

2. **Extrae cada requisito explícito como un ítem verificable independiente.** Ejemplo, del pedido de arriba:
   - ⬜ Botón agregado
   - ⬜ Visible solo para rol admin
   - ⬜ Texto exacto: "..."
   - ⬜ Deshabilitado sin conexión

3. **Marca cada ítem contra el resultado real, uno por uno — no en bloque.** Para cada uno, responde con evidencia concreta, no con una impresión general:
   - ✅ Cumplido — cómo se verificó
   - ⚠️ Cumplido parcialmente — qué falta exactamente
   - ❌ No cumplido — por qué se omitió

4. **Si algún requisito quedó en ⚠️ o ❌, no lo reportes como "terminado".** Complétalo o repórtalo explícitamente como pendiente — nunca lo escondas dentro de un resumen genérico tipo "todo listo".

5. **Presta atención especial a las condiciones ("solo si", "excepto", "a menos que").** Son las que más se pierden, porque describen el caso que NO es el flujo principal, y el flujo principal es lo que naturalmente se prioriza al construir.

6. **Si el usuario corrigió o amplió el pedido a mitad de la tarea, ese mensaje pesa tanto como el original.** No entregues basándote solo en el pedido inicial si hubo una corrección posterior que no quedó reflejada.

## Formato de salida

```
📋 Verificación de instrucciones — [tarea]

✅ [requisito 1] — verificado con: [evidencia]
✅ [requisito 2] — verificado con: [evidencia]
⚠️ [requisito 3] — falta: [qué exactamente]

Estado: [LISTO PARA ENTREGAR / PENDIENTE — ver ⚠️/❌ arriba]
```

## Diferencia con otras skills del equipo

- `verification-before-completion` verifica que el código FUNCIONE (build, tests, ejecución real). Esta skill verifica que el ALCANCE sea el correcto — se puede tener código que funciona perfectamente pero que resuelve solo la mitad de lo pedido. Ambas son necesarias y complementarias, no una reemplaza a la otra.
- `checklist-casos-limite` cubre casos técnicos genéricos (nulos, vacíos, dobles ejecuciones). Esta skill cubre los requisitos ESPECÍFICOS que el usuario pidió en esta tarea en particular, no una lista genérica.
