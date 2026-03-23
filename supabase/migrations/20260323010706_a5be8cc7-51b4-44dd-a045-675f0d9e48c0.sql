
-- Fix profiles RLS to include SUPER_ADMIN_DEV
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
CREATE POLICY "Super admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'SUPER_ADMIN'::app_role) OR has_role(auth.uid(), 'SUPER_ADMIN_DEV'::app_role));

DROP POLICY IF EXISTS "Super admins can insert profiles" ON public.profiles;
CREATE POLICY "Super admins can insert profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'SUPER_ADMIN'::app_role) OR has_role(auth.uid(), 'SUPER_ADMIN_DEV'::app_role));

-- Fix user_roles RLS to include SUPER_ADMIN_DEV
DROP POLICY IF EXISTS "Super admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Super admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'SUPER_ADMIN'::app_role) OR has_role(auth.uid(), 'SUPER_ADMIN_DEV'::app_role) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Super admins can manage roles" ON public.user_roles;
CREATE POLICY "Super admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'SUPER_ADMIN'::app_role) OR has_role(auth.uid(), 'SUPER_ADMIN_DEV'::app_role))
  WITH CHECK (has_role(auth.uid(), 'SUPER_ADMIN'::app_role) OR has_role(auth.uid(), 'SUPER_ADMIN_DEV'::app_role));

-- Also add SUPER_ADMIN_DEV to excel_uploads insert policy
DROP POLICY IF EXISTS "Admins can insert uploads" ON public.excel_uploads;
CREATE POLICY "Admins can insert uploads" ON public.excel_uploads
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'SUPER_ADMIN'::app_role) OR has_role(auth.uid(), 'SUPER_ADMIN_DEV'::app_role) OR has_role(auth.uid(), 'ADMIN'::app_role));

-- Add unique constraint on profiles.user_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
  END IF;
END$$;

-- Add unique constraint on user_roles (user_id, role) if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_role_key') THEN
    ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END$$;
