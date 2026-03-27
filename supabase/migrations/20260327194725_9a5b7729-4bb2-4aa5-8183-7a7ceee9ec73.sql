-- Allow admins to update excel_uploads (needed to update stats after import)
CREATE POLICY "Admins can update uploads"
  ON public.excel_uploads FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'SUPER_ADMIN'::app_role) OR has_role(auth.uid(), 'SUPER_ADMIN_DEV'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role))
  WITH CHECK (has_role(auth.uid(), 'SUPER_ADMIN'::app_role) OR has_role(auth.uid(), 'SUPER_ADMIN_DEV'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role));