-- ============================================================
-- ChronosWork — Schema: Anuncios y Noticias
-- Tabla anuncios + RLS + Storage bucket
-- Multi-tenant: admins (super_admin, coordinator) pueden CRUD,
-- empleados pueden SELECT (ver anuncios activos).
-- ============================================================

CREATE TABLE IF NOT EXISTS anuncios (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  titulo       VARCHAR(200) NOT NULL,
  contenido    TEXT NOT NULL,
  tipo         VARCHAR(20) NOT NULL DEFAULT 'TEXTO' CHECK (tipo IN ('TEXTO', 'IMAGEN', 'VIDEO', 'LINK')),
  media_url    TEXT,
  video_url    TEXT,
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin    DATE,
  prioridad   VARCHAR(10) NOT NULL DEFAULT 'MEDIA' CHECK (prioridad IN ('ALTA', 'MEDIA', 'BAJA')),
  activo       BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT anuncios_check_fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_anuncios_tenant_activo ON anuncios(tenant_id, activo);

ALTER TABLE anuncios ENABLE ROW LEVEL SECURITY;

-- SELECT: todos los usuarios del tenant pueden ver anuncios
DROP POLICY IF EXISTS "anuncios_select" ON anuncios;
CREATE POLICY "anuncios_select" ON anuncios
  FOR SELECT USING (
    tenant_id = auth_tenant_id()
    OR is_platform_admin()
  );

-- INSERT: solo admins operativos (super_admin, coordinator)
DROP POLICY IF EXISTS "anuncios_insert" ON anuncios;
CREATE POLICY "anuncios_insert" ON anuncios
  FOR INSERT WITH CHECK (
    tenant_id = auth_tenant_id() AND is_operational_admin()
  );

-- UPDATE: solo admins operativos
DROP POLICY IF EXISTS "anuncios_update" ON anuncios;
CREATE POLICY "anuncios_update" ON anuncios
  FOR UPDATE USING (
    tenant_id = auth_tenant_id() AND is_operational_admin()
  );

-- DELETE: solo admins operativos
DROP POLICY IF EXISTS "anuncios_delete" ON anuncios;
CREATE POLICY "anuncios_delete" ON anuncios
  FOR DELETE USING (
    tenant_id = auth_tenant_id() AND is_operational_admin()
  );

-- Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION set_anuncios_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_anuncios_updated_at ON anuncios;
CREATE TRIGGER trg_anuncios_updated_at
  BEFORE UPDATE ON anuncios
  FOR EACH ROW
  EXECUTE FUNCTION set_anuncios_updated_at();

-- ============================================================
-- Storage bucket: anuncios (lectura pública, escritura autenticada)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'anuncios',
  'anuncios',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lectura pública (cualquiera, incluso anónimo)
DROP POLICY IF EXISTS "anuncios_storage_read" ON storage.objects;
CREATE POLICY "anuncios_storage_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'anuncios');

-- Escritura: solo usuarios autenticados
DROP POLICY IF EXISTS "anuncios_storage_insert" ON storage.objects;
CREATE POLICY "anuncios_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'anuncios' AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "anuncios_storage_update" ON storage.objects;
CREATE POLICY "anuncios_storage_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'anuncios' AND auth.role() = 'authenticated'
  );
