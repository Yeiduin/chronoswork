
CREATE OR REPLACE FUNCTION register_new_company(
  p_user_id UUID,
  p_razon_social TEXT,
  p_nit TEXT,
  p_direccion TEXT,
  p_telefono TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  INSERT INTO tenants (razon_social, nit, direccion, telefono, plan)
  VALUES (p_razon_social, p_nit, p_direccion, p_telefono, 'start')
  RETURNING id INTO v_tenant_id;

  INSERT INTO tenant_users (user_id, tenant_id, rol)
  VALUES (p_user_id, v_tenant_id, 'super_admin');

  RETURN jsonb_build_object('tenant_id', v_tenant_id, 'success', true);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'NIT_DUPLICADO: El NIT ya esta registrado.';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'ERROR_REGISTRO: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION register_new_company TO anon, authenticated;
