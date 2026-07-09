---
name: pseudocodigo-antes-de-codigo-complejo
description: Usa esta skill ANTES de escribir código real para cualquier lógica no trivial — condicionales anidados con más de 2 niveles, algoritmos, máquinas de estado, cálculos con varias variables, funciones que combinan varias reglas de negocio. NO aplica a código simple y directo (un CRUD básico, un componente de solo presentación).
---

# Pseudocódigo antes de código complejo

Un modelo débil tiende a traducir el problema directamente a código, sin pasar primero por una etapa de pensar los pasos en texto plano. El resultado es que los errores de lógica (un caso no contemplado, un orden de condiciones equivocado) quedan enterrados dentro de sintaxis, donde son mucho más difíciles de detectar — tanto para el modelo como para quien revisa después.

## Regla dura

**Para cualquier lógica no trivial, escribe primero los pasos en texto plano o pseudocódigo, verifica que cubren todos los casos relevantes, y SOLO ENTONCES tradúcelo a código real.** No hagas esto como comentario decorativo después de escribir el código — hazlo antes, como borrador de trabajo.

## Cuándo aplica

- Condicionales con más de 2 niveles de anidación o más de 3 ramas.
- Algoritmos (ordenar, buscar, calcular algo con varios pasos).
- Máquinas de estado (un pedido que pasa por varios estados, un flujo de checkout).
- Funciones que combinan varias reglas de negocio a la vez (ej. calcular un precio con descuentos, impuestos y restricciones por rol).
- Cualquier lógica donde ya te equivocaste una vez en esta sesión.

## Cuándo NO aplica

- CRUD básico sin reglas de negocio complejas.
- Componentes de solo presentación (renderizar datos sin lógica condicional relevante).
- Cambios triviales (renombrar, mover código sin alterar su lógica).

## Procedimiento

1. **Escribe los pasos en texto plano o pseudocódigo simple**, en el orden en que deben ejecutarse:
   ```
   1. Si el usuario no está autenticado -> redirigir a login
   2. Si el usuario es rol "empleado" -> mostrar vista limitada, SIN dashboard
   3. Si el usuario es rol "empresario" -> mostrar dashboard con métricas de su empresa
   4. Si el usuario es rol "admin" -> mostrar panel completo de la plataforma
   ```
2. **Revisa el pseudocódigo contra el checklist de casos límite** (skill `checklist-casos-limite`) antes de traducirlo — es mucho más barato corregir un paso mal pensado en texto plano que corregirlo ya escrito en código.
3. **Verifica el orden de las condiciones**: en cadenas de `if/else if`, el orden importa — una condición más general puesta antes de una más específica puede "atrapar" casos que no debería. Confirma que cada rama solo captura lo que le corresponde.
4. **Solo después de validar el pseudocódigo, tradúcelo a código real**, manteniendo la misma estructura de pasos.
5. Si el pseudocódigo reveló un caso ambiguo (¿qué pasa si el usuario no tiene rol asignado?), resuélvelo explícitamente en el pseudocódigo o pregunta al usuario — no lo dejes para "ya se verá" al escribir el código.

## Señales de que te saltaste esta skill

- Escribiste directamente el código de una lógica con varias ramas sin haber pensado los casos en texto plano primero.
- Encontraste un caso no contemplado DESPUÉS de escribir el código, que se habría visto obvio en pseudocódigo.
- El orden de tus condiciones `if/else if` hace que un caso específico nunca se alcance porque uno más general lo captura antes.
