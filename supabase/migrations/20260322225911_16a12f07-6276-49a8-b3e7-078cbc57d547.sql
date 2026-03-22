
-- Function to get the latest month with data
CREATE OR REPLACE FUNCTION public.get_latest_month()
RETURNS TABLE(anio int, mes int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT anio, mes 
  FROM movimientos 
  WHERE activo = true
  GROUP BY anio, mes
  ORDER BY anio DESC, mes DESC
  LIMIT 1;
$$;

-- Function to get KPIs for a specific month, optionally filtered by empresa
CREATE OR REPLACE FUNCTION public.get_kpis_mes(_anio int, _mes int, _empresa text DEFAULT NULL)
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'ingresos', COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto ELSE 0 END), 0),
    'salidas', COALESCE(SUM(CASE WHEN tipo = 'SALIDA' THEN ABS(monto) ELSE 0 END), 0),
    'internos', COALESCE(SUM(CASE WHEN tipo = 'INTERNO' THEN monto ELSE 0 END), 0),
    'prestamos', COALESCE(SUM(CASE WHEN tipo = 'PRESTAMO' THEN monto ELSE 0 END), 0),
    'conteo_ingresos', COUNT(*) FILTER (WHERE tipo = 'INGRESO'),
    'conteo_salidas', COUNT(*) FILTER (WHERE tipo = 'SALIDA')
  )
  FROM movimientos
  WHERE activo = true
    AND anio = _anio
    AND mes = _mes
    AND (_empresa IS NULL OR empresa = _empresa);
$$;

-- Function to get monthly flow data (aggregated server-side, no row limit)
CREATE OR REPLACE FUNCTION public.get_flujo_mensual(_anio_desde int, _empresa text DEFAULT NULL)
RETURNS TABLE(periodo text, ingresos numeric, salidas numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    anio::text || '-' || LPAD(mes::text, 2, '0') as periodo,
    COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN monto ELSE 0 END), 0) as ingresos,
    COALESCE(SUM(CASE WHEN tipo = 'SALIDA' THEN ABS(monto) ELSE 0 END), 0) as salidas
  FROM movimientos
  WHERE activo = true
    AND anio >= _anio_desde
    AND (_empresa IS NULL OR empresa = _empresa)
  GROUP BY anio, mes
  ORDER BY anio, mes;
$$;

-- Function to get top expense categories for a month
CREATE OR REPLACE FUNCTION public.get_top_categorias(_anio int, _mes int, _limite int DEFAULT 8, _empresa text DEFAULT NULL)
RETURNS TABLE(categoria text, total numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    COALESCE(categoria, 'Sin categoría') as categoria,
    SUM(ABS(monto)) as total
  FROM movimientos
  WHERE activo = true
    AND anio = _anio
    AND mes = _mes
    AND tipo = 'SALIDA'
    AND categoria IS NOT NULL
    AND (_empresa IS NULL OR empresa = _empresa)
  GROUP BY categoria
  ORDER BY total DESC
  LIMIT _limite;
$$;
