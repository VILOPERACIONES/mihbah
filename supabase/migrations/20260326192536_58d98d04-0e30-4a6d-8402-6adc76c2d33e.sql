
CREATE OR REPLACE FUNCTION public.get_cuentas_resumen(_empresa text DEFAULT NULL::text)
RETURNS TABLE(cuenta text, saldo numeric, count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    m.cuenta,
    SUM(m.monto) as saldo,
    COUNT(*) as count
  FROM movimientos m
  WHERE m.activo = true
    AND m.cuenta IS NOT NULL
    AND m.cuenta != ''
    AND (_empresa IS NULL OR m.empresa = _empresa)
  GROUP BY m.cuenta
  ORDER BY SUM(m.monto) DESC;
$$;
