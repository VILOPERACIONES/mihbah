
-- Tabla para cuentas por cobrar y por pagar
CREATE TABLE public.cuentas_pendientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('COBRAR', 'PAGAR')),
  descripcion TEXT NOT NULL DEFAULT '',
  monto NUMERIC NOT NULL,
  fecha_emision TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fecha_vencimiento TIMESTAMP WITH TIME ZONE,
  pagado BOOLEAN NOT NULL DEFAULT false,
  fecha_pago TIMESTAMP WITH TIME ZONE,
  referencia TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cuentas_pendientes ENABLE ROW LEVEL SECURITY;

-- RLS: users can view based on empresa access
CREATE POLICY "Users can view cuentas for their empresas"
  ON public.cuentas_pendientes FOR SELECT TO authenticated
  USING (can_access_empresa(auth.uid(), empresa));

-- RLS: admins can insert
CREATE POLICY "Admins can insert cuentas"
  ON public.cuentas_pendientes FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'SUPER_ADMIN') OR has_role(auth.uid(), 'SUPER_ADMIN_DEV') OR has_role(auth.uid(), 'ADMIN'))
    AND can_access_empresa(auth.uid(), empresa)
  );

-- RLS: admins can update
CREATE POLICY "Admins can update cuentas"
  ON public.cuentas_pendientes FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(), 'SUPER_ADMIN') OR has_role(auth.uid(), 'SUPER_ADMIN_DEV') OR has_role(auth.uid(), 'ADMIN'))
    AND can_access_empresa(auth.uid(), empresa)
  );

-- RLS: super admins can delete
CREATE POLICY "Super admins can delete cuentas"
  ON public.cuentas_pendientes FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'SUPER_ADMIN') OR has_role(auth.uid(), 'SUPER_ADMIN_DEV'));

-- Updated_at trigger
CREATE TRIGGER update_cuentas_pendientes_updated_at
  BEFORE UPDATE ON public.cuentas_pendientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RPC: Get totals for CxC and CxP
CREATE OR REPLACE FUNCTION public.get_cuentas_pendientes_totales(
  _empresa TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'cxc', COALESCE(SUM(CASE WHEN tipo = 'COBRAR' AND pagado = false THEN monto ELSE 0 END), 0),
    'cxp', COALESCE(SUM(CASE WHEN tipo = 'PAGAR' AND pagado = false THEN monto ELSE 0 END), 0),
    'cxc_vencidas', COALESCE(SUM(CASE WHEN tipo = 'COBRAR' AND pagado = false AND fecha_vencimiento < now() THEN monto ELSE 0 END), 0),
    'cxp_vencidas', COALESCE(SUM(CASE WHEN tipo = 'PAGAR' AND pagado = false AND fecha_vencimiento < now() THEN monto ELSE 0 END), 0),
    'conteo_cxc', COUNT(*) FILTER (WHERE tipo = 'COBRAR' AND pagado = false),
    'conteo_cxp', COUNT(*) FILTER (WHERE tipo = 'PAGAR' AND pagado = false)
  )
  FROM cuentas_pendientes
  WHERE (_empresa IS NULL OR empresa = _empresa);
$$;
