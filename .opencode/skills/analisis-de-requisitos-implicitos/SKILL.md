---
name: analisis-de-requisitos-implicitos
description: Usa esta skill ANTES de implementar cualquier componente, botón, ruta, vista o funcionalidad que pueda comportarse o verse distinto según el tipo de usuario, rol, plan o estado de la aplicación. Evita construir una única versión "genérica" cuando el proyecto tiene lógica de roles/permisos/estados que la afecta. Aplica incluso si el usuario no mencionó los roles explícitamente en su pedido.
---

# Análisis de requisitos implícitos

Cuando el usuario pide "agrega un botón que haga X", casi nunca está pidiendo literalmente solo eso — está asumiendo que quien lo construye va a tener en cuenta el resto del sistema en el que ese botón vive. Un modelo débil toma el pedido de forma literal y construye la versión más simple posible, ignorando que la app ya tiene roles, permisos o estados que afectan si ese elemento debería existir, verse igual, o comportarse igual para todos.

## Caso de referencia (para que quede claro el patrón, no solo la teoría)

Pedido: "agrega un botón que redirija al dashboard".
Implementación ingenua: un botón "Ir al dashboard" en todas partes.
Problema real: la app tiene roles `empleado`, `empresario` y `admin SaaS`. El rol `empleado` no tiene dashboard. El botón aparece igual para todos y rompe la experiencia de un rol entero.
Esto se pudo evitar ANTES de escribir código, no después de que el usuario lo reportara.

## Regla dura

**Antes de implementar cualquier elemento de UI, ruta o lógica, pregúntate explícitamente: ¿esto se comporta o se ve igual para TODOS los roles/estados/tipos de usuario de esta aplicación, o depende de quién esté viendo?** Si hay duda razonable de que dependa del contexto, no lo trates como si no dependiera.

## Procedimiento

1. **Identifica si el proyecto tiene un modelo de roles/permisos/estados.** Antes de tocar código, busca:
   - El `AGENTS.md` del proyecto (si documenta roles, tipos de cuenta, planes, permisos — úsalo como fuente de verdad).
   - En el código: contextos de autenticación, enums de roles, middlewares de permisos, componentes que ya hacen render condicional por rol (`if (user.role === ...)`, `<ProtectedRoute>`, etc.).
2. **Si el proyecto SÍ tiene roles/estados relevantes para lo que vas a construir**, enumera explícitamente cada uno y qué debería pasar en cada uno para ESE elemento específico, antes de escribir una sola línea. No asumas que el comportamiento pedido aplica igual a todos.
3. **Si no tienes certeza de qué debe pasar en algún rol/estado**, pregunta al usuario antes de implementar — no asumas un comportamiento por defecto y sigas de largo. Una pregunta corta ahora es mejor que una corrección después.
4. **Implementa la lógica diferenciada desde el inicio** (ej. render condicional, rutas protegidas por rol), no como parche posterior tras que el usuario lo señale.
5. **Antes de marcar la tarea como terminada** (ligado a `verification-before-completion`), repasa mentalmente el elemento construido para cada rol/estado relevante del proyecto: ¿tiene sentido lo que ve o puede hacer cada uno? ¿Hay algún rol para el que esto no debería existir o debería verse distinto?
6. **Si el proyecto no tiene un `AGENTS.md` propio que documente sus roles, tipos de cuenta o dominio de negocio**, dilo explícitamente al usuario y sugiere crear uno — es la forma más efectiva de que este tipo de error deje de repetirse, porque documenta el dominio una sola vez en vez de tener que inferirlo cada vez.

## Señales de que te saltaste esta skill

- Implementaste un botón, ruta o vista sin revisar si el proyecto tiene roles o permisos que la afecten.
- El usuario tuvo que decirte "esto no debería aparecer/funcionar así para el rol X" después de que dijiste que ya habías terminado.
- Asumiste un comportamiento único "para todos los usuarios" en una app que claramente tiene más de un tipo de cuenta.
