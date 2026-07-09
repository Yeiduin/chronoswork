---
name: analisis-de-impacto
description: Usa esta skill ANTES de modificar, renombrar, mover o cambiar el comportamiento de cualquier componente, función, endpoint, estilo, tipo o constante que pueda estar usado en más de un lugar del proyecto. El objetivo es encontrar TODO lo relacionado con el cambio antes de tocar código, para no dejar usos rotos, inconsistentes o desactualizados en otras partes del proyecto que el usuario tenga que reportar después.
---

# Análisis de impacto antes de modificar

El error más caro que comete un modelo al programar no es escribir código incorrecto — es escribir código CORRECTO pero incompleto: arregla el lugar donde se le pidió, y no toca (ni revisa) los otros lugares del proyecto que dependen de lo mismo. El usuario termina haciendo de QA manual, encontrando uno por uno los sitios que quedaron desactualizados.

## Caso de referencia

Pedido: "cambia este botón". El botón (o el componente/lógica que lo contiene) resulta estar usado por los 3 tipos de cuenta de la app. Si solo se ajusta pensando en un tipo de cuenta, los otros dos quedan con un comportamiento que nadie revisó — y el usuario tiene que descubrirlo probando manualmente y reportarlo.

## Regla dura

**Antes de modificar cualquier cosa que pueda estar referenciada en más de un lugar, busca TODAS las referencias en el proyecto primero.** No edites basándote solo en el archivo que el usuario mencionó — ese archivo es el punto de entrada, no necesariamente el único lugar afectado.

## Procedimiento

1. **Identifica qué estás por modificar de forma precisa**: nombre del componente, función, hook, endpoint, clase CSS, constante, tipo/interfaz, columna de base de datos, etc.
2. **Busca TODAS las referencias en el proyecto** antes de tocar nada, usando búsqueda de texto/regex (`grep_search`, `Get-ChildItem -Recurse | Select-String`) sobre el nombre exacto y variantes razonables (import, uso en JSX, referencias en tests, referencias en otros componentes que lo envuelven).
3. **Construye una lista explícita de todo lo afectado** antes de editar, por ejemplo:
   ```
   🔍 Análisis de impacto — modificar <ElementoX>
   Usado en:
   - src/pages/EmployeeDashboard.jsx (rol empleado)
   - src/pages/BusinessDashboard.jsx (rol empresario)
   - src/components/shared/Sidebar.jsx (compartido por todos los roles)
   - src/tests/ElementoX.test.jsx
   ```
4. **Para cada lugar encontrado, decide explícitamente si el cambio aplica igual, aplica distinto, o no aplica.** No asumas que "arreglar uno" implica que los demás quedan bien solos. Si el proyecto tiene roles/permisos, cruza esto con la skill `analisis-de-requisitos-implicitos`.
5. **Aplica el cambio de forma consistente en TODOS los lugares que correspondan en la misma tarea**, no solo en el archivo original de la petición. Si decides que un lugar no debe cambiar, dilo explícitamente (no lo ignores en silencio).
6. **Si hay ambigüedad sobre si un uso relacionado debería cambiar también**, pregunta al usuario en vez de adivinar o de omitirlo silenciosamente.
7. **Al terminar, haz un barrido final de verificación**: vuelve a buscar el nombre/patrón original para confirmar que no quedaron referencias huérfanas, props desactualizadas, imports rotos, o estilos/clases que ya no existen pero siguen siendo usados en algún archivo.
8. **Repórtale al usuario, en el resumen final, todos los lugares que tocaste** (no solo el que pidió) — así confirma que el impacto real quedó cubierto.

## Cuándo aplica con más fuerza

- Componentes compartidos (sidebars, headers, botones reutilizables, layouts).
- Funciones/hooks usados por más de una pantalla o flujo.
- Endpoints de API consumidos desde más de un lugar del frontend.
- Tipos/interfaces usados en múltiples componentes.
- Cambios de nombre, de firma de función, o de estructura de datos.

## Señales de que te saltaste esta skill

- Modificaste un componente sin buscar antes dónde más se usa.
- El usuario te dice "cambiaste eso pero te olvidaste que [otra persona/rol/pantalla] también lo usa" — si esto pasa, es evidencia directa de que esta skill no se aplicó.
- Terminaste una tarea sin mencionar en el resumen todos los archivos relacionados que revisaste o tocaste.
