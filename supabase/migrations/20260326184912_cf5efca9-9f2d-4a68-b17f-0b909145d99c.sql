CREATE OR REPLACE FUNCTION public.get_flujo_caja_mensual(
  _anio_desde integer,
  _anio_hasta integer,
  _empresa text DEFAULT NULL::text
)
RETURNS TABLE(anio integer, mes integer, neto numeric, ingresos numeric, salidas numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    m.anio,
    m.mes,
    SUM(m.monto) as neto,
    COALESCE(SUM(CASE WHEN m.monto > 0 THEN m.monto ELSE 0 END), 0) as ingresos,
    COALESCE(SUM(CASE WHEN m.monto < 0 THEN ABS(m.monto) ELSE 0 END), 0) as salidas
  FROM movimientos m
  WHERE m.activo = true
    AND m.anio >= _anio_desde
    AND m.anio <= _anio_hasta
    AND (_empresa IS NULL OR m.empresa = _empresa)
  GROUP BY m.anio, m.mes
  ORDER BY m.anio, m.mes;
$$;