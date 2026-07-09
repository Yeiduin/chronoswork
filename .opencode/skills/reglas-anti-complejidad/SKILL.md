---
name: reglas-anti-complejidad
description: Aplica estas reglas SIEMPRE que escribas o modifiques lógica con condicionales, funciones largas, o manejo de estado. No es una skill que se "invoque" puntualmente — es un estándar de cómo escribir código para que la lógica sea más difícil de romper, tanto por el modelo como en revisiones futuras.
---

# Reglas anti-complejidad

La mayoría de los bugs de lógica no vienen de un modelo "poco inteligente" — vienen de código innecesariamente enredado donde hasta un experto se perdería. Estas reglas reducen la superficie donde un error de lógica se puede esconder, sin depender de qué tan potente sea el modelo.

## Reglas

**1. Guard clauses en vez de anidar.** Sal temprano de la función para los casos inválidos/simples, en vez de anidar todo el cuerpo dentro de un `if`.
```js
// Evitar
function procesar(usuario) {
  if (usuario) {
    if (usuario.activo) {
      if (usuario.permisos.length > 0) {
        // lógica real, enterrada 3 niveles adentro
      }
    }
  }
}

// Preferir
function procesar(usuario) {
  if (!usuario) return;
  if (!usuario.activo) return;
  if (usuario.permisos.length === 0) return;
  // lógica real, al nivel superior, fácil de leer y de verificar
}
```

**2. Funciones cortas, de una sola responsabilidad.** Si una función hace más de una cosa (validar Y calcular Y guardar), sepárala. Una función larga es más difícil de razonar y más fácil de romper al modificarla.

**3. Nada de números o strings "mágicos" sueltos en la lógica.** Si un valor tiene significado (un límite, un estado, un rol), dale nombre:
```js
// Evitar
if (intentos > 3) { ... }

// Preferir
const MAX_INTENTOS_LOGIN = 3;
if (intentos > MAX_INTENTOS_LOGIN) { ... }
```
Esto no es solo estilo — un número mágico repetido en varios lugares es una fuente típica de bugs cuando cambia en un lugar y se olvida en otro (ver skill `analisis-de-impacto`).

**4. Una sola fuente de verdad para cada dato de estado.** No dupliques el mismo dato en dos variables/estados distintos que puedan desincronizarse (ej. guardar `estaLogueado` como boolean aparte cuando ya se puede derivar de `usuario !== null`). Cada dato debe tener un único lugar de origen; todo lo demás se deriva de ahí.

**5. Evita condiciones booleanas complejas sin nombre.** Si una condición combina 3+ variables con `&&`/`||`, extráela a una variable o función con nombre descriptivo:
```js
// Evitar
if (usuario.rol === 'empleado' && !usuario.activo && fechaActual > usuario.fechaExpiracion) { ... }

// Preferir
const accesoExpirado = usuario.rol === 'empleado' && !usuario.activo && fechaActual > usuario.fechaExpiracion;
if (accesoExpirado) { ... }
```
Nombrar la condición obliga a pensar qué significa realmente, lo cual expone errores de lógica que quedan invisibles cuando todo es una sola línea densa.

**6. Errores nunca en silencio.** Ningún `catch` vacío o que solo haga `console.log` sin manejar la situación. Si un error no se puede resolver ahí, propágalo o informa explícitamente — un error silenciado es un bug que aparecerá después sin dejar rastro de su causa.

## Cuándo se refuerza más

Estas reglas importan especialmente en: lógica de permisos/roles, cálculos de negocio (precios, descuentos, fechas), máquinas de estado, y cualquier código que ya haya tenido un bug reportado antes — el código enredado tiende a generar más bugs en el mismo lugar, no menos.

## Señales de que te saltaste estas reglas

- Escribiste una función con más de 3 niveles de anidación.
- Repetiste el mismo número/string "mágico" en más de un lugar del código.
- Dos variables de estado distintas representan, en el fondo, el mismo dato.
- Un `catch` no hace nada visible ante un error.
