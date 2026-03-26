DROP POLICY "Admins can insert movimientos" ON public.movimientos;
CREATE POLICY "Admins can insert movimientos" ON public.movimientos
FOR INSERT TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'SUPER_ADMIN'::app_role) 
   OR has_role(auth.uid(), 'SUPER_ADMIN_DEV'::app_role) 
   OR has_role(auth.uid(), 'ADMIN'::app_role)) 
  AND can_access_empresa(auth.uid(), empresa)
);