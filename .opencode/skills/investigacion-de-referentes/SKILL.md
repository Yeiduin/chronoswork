---
name: investigacion-de-referentes
description: Usa esta skill cuando el usuario pida crear algo de alcance amplio o creativo sin especificar el detalle suficiente (ej. "crea un juego de Bomberman", "crea una red social", "crea un e-commerce", "hazme un juego tipo Mario"). Antes de definir requerimientos o empezar a construir basándote solo en el conocimiento genérico del modelo, investiga referentes reales — los mejores ejemplos históricos y actuales de esa categoría — y usa lo mejor de ellos como base concreta para proponer la idea.
---

# Investigar referentes antes de proponer una idea

Cuando el usuario no sabe exactamente qué quiere (o lo pide de forma amplia, "hazme un Bomberman"), la peor respuesta posible es que el modelo invente una versión mediocre desde su conocimiento genérico interno, que puede estar incompleto o desactualizado. La mejor respuesta es investigar qué hizo geniales a los mejores ejemplos reales de esa categoría — históricos y actuales — y partir de ahí para proponer algo concreto y bien fundamentado, no una versión genérica de relleno.

## Cuándo se activa

- La petición nombra una categoría o género conocido sin especificar mecánicas/features concretas (ej. "un Bomberman", "una red social", "un clon de Mario", "un juego tipo Clash Royale", "un e-commerce como Amazon pero simple").
- El usuario dice explícitamente que no tiene claro qué quiere, o pide "lo mejor" / "algo genial" / "algo que se vea profesional" sin más especificación.
- NO aplica si el usuario ya dio especificaciones concretas y detalladas — en ese caso no hace falta investigar referentes, solo construir lo pedido (puedes usar `evaluacion-de-enfoques` si hay decisiones técnicas de por medio).

## Procedimiento

1. **Antes de preguntar detalles al usuario o de armar el plan**, delega a `@investigador` (o usa `search_web`/`read_url_content` directamente si eres tú el orquestador) para investigar:
   - Los ejemplos históricos más aclamados/icónicos de esa categoría (ej. para Bomberman: los títulos de la saga más queridos por la crítica y los jugadores).
   - Los ejemplos actuales/modernos más exitosos o mejor valorados de esa misma categoría.
   - Qué características, mecánicas, decisiones de diseño o patrones de UX hicieron destacar a esos referentes específicamente — no una lista genérica de features, sino lo que los distingue de la competencia mediocre.
2. **Sintetiza los hallazgos en una propuesta concreta**, citando de qué referentes sale cada idea:
   ```
   🔍 Investigué referentes de [categoría] antes de proponer el enfoque:
   - De [referente histórico A]: [qué idea/mecánica concreta se rescata]
   - De [referente moderno B]: [qué idea/mecánica concreta se rescata]
   - De [referente C]: [qué se evita — un problema conocido de ese referente]

   💡 Propuesta: combinar [X, Y, Z] para este proyecto.
   ```
3. **Presenta esta síntesis al usuario como parte de la Fase 0 (percepción)**, antes de pasar a requerimientos técnicos. Pregunta si quiere ajustar el enfoque, priorizar unas ideas sobre otras, o si prefiere simplificar.
4. **Solo después de que el usuario apruebe (o ajuste) la propuesta**, pasa a `@analista` para convertirla en requerimientos técnicos concretos, y de ahí al flujo normal (arquitectura, diseño, implementación).
5. **No inventes fuentes.** Si la investigación web no arroja información clara sobre algún referente, dilo explícitamente en vez de presentar una suposición como si fuera un hallazgo real.

## Ejemplo aplicado

Petición: "crea un juego de Bomberman".
Sin esta skill: se construye una versión genérica con un jugador, bombas y un mapa de bloques, basada solo en la idea general del modelo sobre "qué es Bomberman".
Con esta skill: se investiga qué hizo destacar a los Bomberman más queridos (multijugador caótico, power-ups específicos, diseño de niveles que fuerza decisiones rápidas) y a versiones modernas del género (mejoras de accesibilidad, netcode, progresión), y la propuesta final combina eso — no una versión de memoria aproximada del juego.

## Señales de que te saltaste esta skill

- Empezaste a implementar un juego/producto de una categoría conocida sin buscar referentes reales primero.
- La propuesta presentada al usuario es genérica ("tendrá niveles, power-ups y enemigos") en vez de concreta y fundamentada en ejemplos reales.
- El usuario tuvo que corregir el enfoque porque el resultado no se parecía a lo mejor de la categoría, sino a una versión aproximada y genérica.
