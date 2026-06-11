-- Actualización para agregar group_id a los slots de demanda WFM
-- Ejecutar en: Supabase SQL Editor

ALTER TABLE area_demand_slots ADD COLUMN IF NOT EXISTS group_id UUID;

-- Para los registros existentes (si los hay), asignamos su propio ID como group_id
UPDATE area_demand_slots SET group_id = id WHERE group_id IS NULL;

-- Hacer que la columna sea obligatoria a partir de ahora
ALTER TABLE area_demand_slots ALTER COLUMN group_id SET NOT NULL;
