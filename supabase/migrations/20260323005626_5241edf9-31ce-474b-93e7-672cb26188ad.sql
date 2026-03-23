
-- Create llm_providers table
CREATE TABLE public.llm_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  base_url text NOT NULL DEFAULT '',
  api_key_encrypted text NOT NULL DEFAULT '',
  models text[] NOT NULL DEFAULT '{}',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.llm_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only super admin dev can manage providers" ON public.llm_providers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'SUPER_ADMIN_DEV'))
  WITH CHECK (has_role(auth.uid(), 'SUPER_ADMIN_DEV'));

CREATE POLICY "Admins can view providers" ON public.llm_providers
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'SUPER_ADMIN') OR has_role(auth.uid(), 'SUPER_ADMIN_DEV'));

-- Create agent_skills table
CREATE TABLE public.agent_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  system_prompt text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  provider_id uuid REFERENCES public.llm_providers(id) ON DELETE SET NULL,
  model text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only super admin dev can manage skills" ON public.agent_skills
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'SUPER_ADMIN_DEV'))
  WITH CHECK (has_role(auth.uid(), 'SUPER_ADMIN_DEV'));

CREATE POLICY "Admins can view skills" ON public.agent_skills
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'SUPER_ADMIN') OR has_role(auth.uid(), 'SUPER_ADMIN_DEV'));
