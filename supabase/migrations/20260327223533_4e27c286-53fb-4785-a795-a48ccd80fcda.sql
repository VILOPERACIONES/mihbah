
INSERT INTO public.role_module_access (role, module, allowed) VALUES
  ('SUPER_ADMIN_DEV', 'cargas', true),
  ('SUPER_ADMIN', 'cargas', false),
  ('ADMIN', 'cargas', false),
  ('VIEWER', 'cargas', false)
ON CONFLICT (role, module) DO UPDATE SET allowed = EXCLUDED.allowed;
