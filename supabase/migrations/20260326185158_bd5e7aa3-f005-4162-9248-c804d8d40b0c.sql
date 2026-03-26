CREATE OR REPLACE FUNCTION public.get_proyectos_resumen(
  _empresa text DEFAULT NULL::text
)
RETURNS TABLE(proyecto text, empresa text, registros bigint, flujo numeric, fecha_min text, fecha_max text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    m.proyecto,
    m.empresa,
    COUNT(*) as registros,
    SUM(m.monto) as flujo,
    TO_CHAR(MIN(m.fecha), 'Mon YYYY') as fecha_min,
    TO_CHAR(MAX(m.fecha), 'Mon YYYY') as fecha_max
  FROM movimientos m
  WHERE m.activo = true
    AND m.proyecto IS NOT NULL
    AND m.proyecto != ''
    AND (_empresa IS NULL OR m.empresa = _empresa)
  GROUP BY m.proyecto, m.empresa
  ORDER BY COUNT(*) DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_cxc_cxp_dashboard(
  _empresa text DEFAULT NULL::text
)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'cxc', COALESCE(SUM(CASE WHEN tipo = 'INGRESO' AND categoria = 'CLIENTES' THEN monto ELSE 0 END), 0),
    'cxp', COALESCE(SUM(CASE WHEN tipo = 'SALIDA' AND categoria IN ('OBLIGACIONES', 'FILIALES') THEN ABS(monto) ELSE 0 END), 0)
  )
  FROM movimientos
  WHERE activo = true
    AND (_empresa IS NULL OR empresa = _empresa);
$$;