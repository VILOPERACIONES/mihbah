
-- Table for default module access per role
CREATE TABLE public.role_module_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  module text NOT NULL,
  allowed boolean NOT NULL DEFAULT true,
  UNIQUE(role, module)
);

ALTER TABLE public.role_module_access ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage role module access
CREATE POLICY "Super admins can manage role_module_access"
  ON public.role_module_access FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN'::app_role) OR public.has_role(auth.uid(), 'SUPER_ADMIN_DEV'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN'::app_role) OR public.has_role(auth.uid(), 'SUPER_ADMIN_DEV'::app_role));

-- All authenticated users can read (to know their own access)
CREATE POLICY "Authenticated users can read role_module_access"
  ON public.role_module_access FOR SELECT
  TO authenticated
  USING (true);

-- Add per-user module overrides to profiles (jsonb: {"dashboard": false, "reportes": true})
ALTER TABLE public.profiles ADD COLUMN modulos_override jsonb DEFAULT NULL;

-- Seed default access for all roles and modules
-- SUPER_ADMIN_DEV and SUPER_ADMIN get all modules
-- ADMIN gets all except admin
-- VIEWER gets dashboard, movimientos, flujo, cuentas, reportes (no admin, no proyectos by default)
INSERT INTO public.role_module_access (role, module, allowed) VALUES
  ('SUPER_ADMIN_DEV', 'dashboard', true),
  ('SUPER_ADMIN_DEV', 'movimientos', true),
  ('SUPER_ADMIN_DEV', 'flujo', true),
  ('SUPER_ADMIN_DEV', 'proyectos', true),
  ('SUPER_ADMIN_DEV', 'cuentas', true),
  ('SUPER_ADMIN_DEV', 'reportes', true),
  ('SUPER_ADMIN_DEV', 'admin', true),
  ('SUPER_ADMIN', 'dashboard', true),
  ('SUPER_ADMIN', 'movimientos', true),
  ('SUPER_ADMIN', 'flujo', true),
  ('SUPER_ADMIN', 'proyectos', true),
  ('SUPER_ADMIN', 'cuentas', true),
  ('SUPER_ADMIN', 'reportes', true),
  ('SUPER_ADMIN', 'admin', true),
  ('ADMIN', 'dashboard', true),
  ('ADMIN', 'movimientos', true),
  ('ADMIN', 'flujo', true),
  ('ADMIN', 'proyectos', true),
  ('ADMIN', 'cuentas', true),
  ('ADMIN', 'reportes', true),
  ('ADMIN', 'admin', true),
  ('VIEWER', 'dashboard', true),
  ('VIEWER', 'movimientos', true),
  ('VIEWER', 'flujo', true),
  ('VIEWER', 'proyectos', false),
  ('VIEWER', 'cuentas', true),
  ('VIEWER', 'reportes', true),
  ('VIEWER', 'admin', false);
