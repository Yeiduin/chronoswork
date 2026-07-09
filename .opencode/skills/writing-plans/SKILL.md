---
name: writing-plans
description: Usa esta skill antes de implementar cualquier feature no trivial (más de un archivo o más de ~30 minutos de trabajo estimado). Especialmente útil para @arquitecto antes de escribir código, y para @orquestador al delegar trabajo grande.
---

# Escribir el plan antes de codear

Un modelo más débil que un frontier tiende a perder coherencia en tareas largas: empieza bien y hacia la mitad improvisa decisiones que contradicen las del inicio. Descomponer el trabajo en pasos pequeños y verificables antes de escribir código reduce ese drift.

## Regla dura

**No empieces a escribir código de una feature de varios archivos sin un plan escrito primero.** El plan no tiene que ser largo, pero tiene que existir y ser explícito.

## Procedimiento

1. **Confirma el objetivo en una frase.** Si no puedes resumir qué debe lograr la feature en una oración, no está lo suficientemente clara para empezar — vuelve a @analista o pregunta al usuario.
2. **Lista los pasos en unidades pequeñas** (idealmente cada una completable y verificable en pocos minutos, no "implementar todo el módulo de auth" como un solo paso). Cada paso debe:
   - Tocar la menor cantidad de archivos posible.
   - Tener un criterio de éxito verificable (un test que pasa, un endpoint que responde, un build limpio).
3. **Ordena los pasos por dependencia real**, no por lo que sea más interesante de hacer primero. Lo que otros pasos necesitan va antes.
4. **Marca explícitamente los puntos de verificación** entre pasos: después de cuáles pasos debes correr tests/build antes de seguir (usa la skill `verification-before-completion` ahí).
5. **Si el plan mode de OpenCode está disponible, preséntalo antes de pasar a modo build.** Deja que el plan sea revisado antes de tocar archivos reales.
6. **Ejecuta un paso a la vez.** No adelantes trabajo de pasos posteriores "ya que estás ahí" — eso es lo que produce el drift de coherencia.
7. Si a mitad de ejecución descubres que el plan estaba mal, **detente y reescribe el plan restante** en vez de seguir improvisando sobre la marcha.

## Formato mínimo de un plan

```
Objetivo: <una frase>
Pasos:
1. [ ] <paso> — verificar con: <comando/criterio>
2. [ ] <paso> — verificar con: <comando/criterio>
...
```

## Señales de que te saltaste esta skill

- Empezaste a escribir código antes de tener claro el orden de los pasos.
- El plan cambió tres veces a mitad de la implementación sin que lo hayas reescrito explícitamente.
- Un paso "pequeño" terminó tocando 8 archivos porque en realidad eran varias tareas mezcladas.
