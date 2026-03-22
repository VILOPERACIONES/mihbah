
CREATE OR REPLACE FUNCTION public.get_latest_month()
RETURNS TABLE(anio int, mes int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT anio, mes 
  FROM movimientos 
  WHERE activo = true AND tipo = 'INGRESO'
  GROUP BY anio, mes
  ORDER BY anio DESC, mes DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_available_periods()
RETURNS TABLE(anio int, mes int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT anio, mes
  FROM movimientos
  WHERE activo = true
  GROUP BY anio, mes
  HAVING COUNT(*) > 0
  ORDER BY anio DESC, mes DESC;
$$;
