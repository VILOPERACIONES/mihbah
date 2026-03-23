
-- Allow SUPER_ADMIN_DEV to update any profile (not just own)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Admins can update profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'SUPER_ADMIN'::app_role) OR has_role(auth.uid(), 'SUPER_ADMIN_DEV'::app_role))
  WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'SUPER_ADMIN'::app_role) OR has_role(auth.uid(), 'SUPER_ADMIN_DEV'::app_role));
