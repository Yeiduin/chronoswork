---
name: systematic-debugging
description: Usa esta skill cuando un error persista después del primer intento de arreglo, cuando la causa no sea obvia, o antes de escalar a @investigador o @vigilante. Evita el patrón de "cambiar código al azar hasta que funcione".
---

# Depuración sistemática

Con modelos que no son frontier, el riesgo más alto no es no saber la respuesta — es reemplazar código funcional por adivinanzas sucesivas hasta corromper el estado del proyecto. Esta skill fuerza un protocolo en vez de intentos aleatorios.

## Regla dura

**Nunca hagas un segundo cambio de código para el mismo error sin antes haber confirmado la causa raíz.** Un intento de "a ver si esto lo arregla" está permitido una sola vez. El segundo intento debe basarse en evidencia, no en otra hipótesis más.

## Procedimiento

1. **Reproduce el error de forma confiable** antes de tocar nada. Si no puedes reproducirlo consistentemente, tu prioridad es lograr reproducirlo, no arreglarlo.
2. **Lee el mensaje de error completo**, incluyendo el stack trace entero, no solo la última línea. La causa suele estar más arriba de donde apunta el cursor.
3. **Aísla la variable**: ¿el error ocurre con datos mínimos? ¿ocurre en un archivo/función aislada? Reduce el caso hasta el mínimo reproducible antes de teorizar.
4. **Formula UNA hipótesis concreta** de causa raíz, basada en lo que leíste, no en lo primero que se te ocurra. Escríbela explícitamente antes de cambiar código: "creo que el error es X porque Y".
5. **Verifica la hipótesis con la menor cantidad de cambios posible** (un log, un breakpoint, una aserción) antes de escribir el fix definitivo.
6. **Aplica el fix mínimo** que ataque la causa raíz confirmada, no un cambio amplio "por si acaso".
7. **Corre la skill `verification-before-completion`** para confirmar que el fix realmente resuelve el problema y no rompe nada más.

## Cuándo escalar (no sigas solo)

- Si tras completar el ciclo de una hipótesis el error persiste con la MISMA causa raíz descartada dos veces → detente y pide a @investigador que busque en documentación oficial o issues conocidos. No formules una tercera hipótesis a ciegas.
- Si el error involucra un proceso colgado, un puerto ocupado, o un servidor que no libera la terminal → esto no es debugging de lógica, es un problema de proceso. Delega a @vigilante inmediatamente.

## Señales de que te saltaste esta skill

- Cambiaste 3+ archivos "a ver cuál es" sin haber confirmado dónde está el problema.
- Agregaste un `try/catch` para silenciar el error en vez de entender por qué ocurre.
- Repetiste el mismo comando que falló sin cambiar nada, esperando un resultado distinto.
