-- ============================================================
-- ChronosWork — Migración 007: Headcount objetivo por día + hora inicio
-- Ejecutar en Supabase SQL Editor
-- ============================================================
-- Permite a la empresa decir, por área, CUÁNTAS personas quiere
-- programar por día (mínimo/piso y máximo/objetivo) y a qué hora
-- arranca el primer turno diurno. El algoritmo v5 usa la curva de
-- demanda como FORMA para repartir ese headcount entre las horas.
-- ============================================================

ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS min_empleados_dia  INT,
  ADD COLUMN IF NOT EXISTS max_empleados_dia  INT,
  ADD COLUMN IF NOT EXISTS hora_inicio_dia    TIME DEFAULT '04:00',
  ADD COLUMN IF NOT EXISTS hora_fin_dia       TIME DEFAULT '22:00';

COMMENT ON COLUMN areas.min_empleados_dia IS
  'Mínimo de personas DISTINTAS a programar en el día (incluye noche).
   Es un PISO: si no se alcanza con la capacidad disponible, el día se deja
   sin cubrir (vacío completo) y se avisa, en vez de dejar huecos parciales.
   NULL = sin piso (el algoritmo cubre lo que pueda).';

COMMENT ON COLUMN areas.max_empleados_dia IS
  'Máximo de personas DISTINTAS a programar en el día (incluye noche).
   Funciona como TECHO y como OBJETIVO de headcount: el algoritmo intenta
   llegar a este número repartiéndolo según la curva de demanda (más gente
   en picos, menos en valles) y nunca lo supera.
   NULL = sin techo (usa la curva absoluta como antes).';

COMMENT ON COLUMN areas.hora_inicio_dia IS
  'Hora a la que puede empezar el primer turno diurno. Default 04:00.
   El algoritmo no coloca turnos diurnos antes de esta hora.';

COMMENT ON COLUMN areas.hora_fin_dia IS
  'Hora a la que debe TERMINAR como máximo el último turno diurno (cierre de
   oficina). Default 22:00. En áreas de oficina (ej. 08:00-18:00) ningún turno
   diurno se extiende más allá de esta hora. En áreas 24/7 se ignora (la noche
   manda la cobertura nocturna).';

-- Backfill suave: a las áreas 24/7 sin objetivo, dejarlo NULL (curva absoluta).
-- hora_inicio_dia / hora_fin_dia toman su default para filas existentes.
UPDATE areas
SET hora_inicio_dia = COALESCE(hora_inicio_dia, '04:00'),
    hora_fin_dia    = COALESCE(hora_fin_dia, '22:00');
