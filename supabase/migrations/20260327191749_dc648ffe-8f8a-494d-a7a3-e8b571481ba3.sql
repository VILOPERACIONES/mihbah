-- Allow SUPER_ADMIN_DEV to also delete movimientos
DROP POLICY IF EXISTS "Super admins can delete movimientos" ON public.movimientos;
CREATE POLICY "Super admins can delete movimientos"
  ON public.movimientos FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'SUPER_ADMIN'::app_role) OR has_role(auth.uid(), 'SUPER_ADMIN_DEV'::app_role));

-- Allow deleting excel_uploads
CREATE POLICY "Super admins can delete uploads"
  ON public.excel_uploads FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'SUPER_ADMIN'::app_role) OR has_role(auth.uid(), 'SUPER_ADMIN_DEV'::app_role));

-- Create a function to wipe all financial data
CREATE OR REPLACE FUNCTION public.wipe_financial_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'SUPER_ADMIN_DEV'::app_role) THEN
    RAISE EXCEPTION 'Only SUPER_ADMIN_DEV can wipe data';
  END IF;
  DELETE FROM movimientos;
  DELETE FROM excel_uploads;
END;
$$;