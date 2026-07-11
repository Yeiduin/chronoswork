-- ============================================================
-- ChronosWork — Migración: Soporte documental para Novedades
-- Agrega columna a tabla absences, crea bucket y políticas RLS
-- ============================================================

-- 1. Agregar columna soporte_url a absences
ALTER TABLE absences
  ADD COLUMN IF NOT EXISTS soporte_url TEXT;

COMMENT ON COLUMN absences.soporte_url IS 
  'URL o path del documento soporte adjunto (PDF, imagen) subido al Storage';

-- 2. Crear bucket para documentos (si no existe)
-- Se requiere extensión uuid-ossp (ya existente en Chronoswork)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos_soporte', 
  'documentos_soporte', 
  true, -- Público para poder generar URLs de visualización (los nombres son UUIDs no adivinables)
  5242880, -- 5MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 3. (Omitido) En Supabase Cloud, storage.objects ya tiene RLS habilitado por defecto.
-- No es necesario (ni posible desde el dashboard) hacer ALTER TABLE storage.objects.

-- 4. Políticas RLS para storage.objects
-- Nota: En Supabase Storage, bucket_id es el id del bucket.
-- RLS para lectura: empleados ven los suyos, admins ven todos los de su tenant.
-- Para simplificar (dado que los paths llevarán el tenant_id), permitiremos lectura a autenticados 
-- y restringiremos por path o confiaremos en los permisos de la tabla absences que proveen la URL.
-- Política recomendada: Los usuarios autenticados del sistema pueden leer/descargar si tienen el path.

DROP POLICY IF EXISTS "Empleados_insertar_soportes" ON storage.objects;
CREATE POLICY "Empleados_insertar_soportes" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documentos_soporte' 
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Usuarios_ver_soportes" ON storage.objects;
CREATE POLICY "Usuarios_ver_soportes" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documentos_soporte'
    AND auth.role() = 'authenticated'
  );
