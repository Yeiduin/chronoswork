---
name: verification-before-completion
description: Usa esta skill SIEMPRE antes de decirle al usuario o a otro agente que una tarea, feature o fix está "lista", "terminada" o "funcionando". Aplica a cualquier cambio de código, no solo a features grandes.
---

# Verificación antes de dar por completada una tarea

Un modelo sin razonamiento frontier tiende a asumir que el código "debería funcionar" solo porque la lógica se ve correcta. Esta skill existe para bloquear esa suposición.

## Regla dura

**Nunca digas "listo", "completado" o "debería funcionar" sin haber ejecutado evidencia real.** Ver el código y creer que compila no es verificación. Ejecutar el comando y ver la salida sí lo es.

## Procedimiento obligatorio

1. **Identifica el comando de verificación real del proyecto** antes de tocar código: build, test, lint, typecheck. Si no existe uno, créalo o pregunta cuál usar — no lo inventes.
2. **Ejecuta el cambio de extremo a extremo**, no solo la parte que tocaste:
   - Si agregaste un endpoint → llámalo con una petición real (`curl`, script de prueba), no asumas el contrato.
   - Si arreglaste un bug → reproduce el bug original primero, confirma que ya no ocurre, y corre el resto de la suite para descartar regresiones.
   - Si tocaste UI → describe qué deberías ver renderizado y, si hay forma de comprobarlo (build sin errores, snapshot, captura), hazlo.
3. **Lee la salida completa del comando**, no solo el código de salida. Un `exit 0` con warnings de tipo o un test "skipped" silencioso no es una verificación válida.
4. **Si algo falla, no lo escondas ni lo relativices.** Repórtalo tal cual y corrígelo antes de continuar. No pases al siguiente paso con un fallo pendiente "para después".
5. **Solo después de ver evidencia real**, comunica el resultado, y sé específico sobre qué se verificó (ej. "corrí `npm test`, 42/42 pasan" en vez de "los tests deberían pasar").

## Señales de que te estás saltando esta skill

- Escribes "esto debería resolver el problema" sin haber corrido nada.
- Terminas una tarea justo después de escribir el código, sin un paso de ejecución intermedio.
- Ignoras un warning porque "no debería afectar".
- Le pasas el trabajo a otro agente (ej. de @arquitecto a @qa-tester) sin haber corrido ni siquiera un build local.

Si detectas cualquiera de estas señales en tu propio flujo, detente y ejecuta el comando de verificación antes de seguir.
