---
name: busqueda-exhaustiva
description: Usa esta skill SIEMPRE que busques un archivo, carpeta o recurso en el sistema del usuario y la ruta obvia/primer intento no lo encuentre. Aplica antes de decirle al usuario "no lo encontré". También aplica cuando se necesita confirmar si algo (una API, una versión, una librería) sigue vigente y la primera búsqueda no fue concluyente.
---

# Búsqueda exhaustiva antes de rendirse

Un modelo débil tiende a probar UNA ruta obvia, no encontrar nada, y reportar "no existe" de inmediato. Eso no es información real: es pereza de búsqueda disfrazada de resultado. Esta skill existe para bloquear ese patrón.

## Regla dura

**Nunca reportes "no encontrado", "no existe" o "no tengo esa información" tras un solo intento.** Antes de decir eso, tienes que haber agotado las alternativas razonables de esta skill.

## Procedimiento — Archivos y carpetas en el sistema del usuario

Este entorno es **Windows**. El error más común es asumir una sola ubicación cuando en realidad existen varias posibles, sobre todo por OneDrive:

1. **Prueba la ruta obvia primero** (ej. `C:\Users\<usuario>\Desktop`).
2. **Si no aparece, prueba las variantes con OneDrive**, que es la causa más frecuente de "no encontrado" falso:
   - `C:\Users\<usuario>\OneDrive\Desktop`
   - `C:\Users\<usuario>\OneDrive - Personal\Desktop`
   - `C:\Users\<usuario>\OneDrive - <NombreEmpresa>\Desktop`
   - Lo mismo aplica a `Documents`, `Downloads`, `Pictures`.
3. **Si sigues sin encontrarlo, no seas literal con el nombre**: haz `list_dir` (o `Get-ChildItem`) en `C:\Users\<usuario>\` completo para ver qué carpetas existen realmente, en vez de asumir una estructura estándar que puede no aplicar en esta máquina.
4. **Si el usuario mencionó un nombre de archivo aproximado**, usa búsqueda por patrón (`grep_search`, `Get-ChildItem -Recurse -Filter`) en la carpeta más probable antes de descartarlo, en vez de exigir coincidencia exacta.
5. **Solo después de agotar los pasos 1-4**, informa que no se encontró y pregunta al usuario la ruta exacta — nunca como primera respuesta.

## Procedimiento — Información / documentación que no aparece a la primera

1. Si una búsqueda web no da resultado claro, reformula la consulta con términos distintos (no repitas la misma query esperando algo diferente).
2. Prueba al menos una fuente alternativa (documentación oficial vs. GitHub Issues vs. changelog) antes de concluir que "no hay información".
3. Si el tema podría haber cambiado recientemente (versión, API, política), dilo explícitamente en vez de responder con seguridad desde conocimiento potencialmente desactualizado.

## Señales de que te saltaste esta skill

- Dijiste "no encontré el archivo" habiendo probado una sola ruta.
- Asumiste que el Escritorio, Documentos o Descargas están en la ubicación "estándar" sin verificarlo en esta máquina específica.
- Reportaste "no hay información" tras una sola búsqueda web con una sola formulación de la consulta.
