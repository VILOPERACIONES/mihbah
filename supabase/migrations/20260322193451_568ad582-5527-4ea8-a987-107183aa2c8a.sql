-- Create enum types
CREATE TYPE public.app_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'VIEWER');
CREATE TYPE public.tipo_mov AS ENUM ('INGRESO', 'SALIDA', 'INTERNO', 'PRESTAMO');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT '',
  empresas TEXT[] NOT NULL DEFAULT ARRAY['*']::TEXT[],
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'VIEWER',
  UNIQUE(user_id, role)
);

-- Create movimientos table
CREATE TABLE public.movimientos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa TEXT NOT NULL,
  anio INT NOT NULL,
  mes INT NOT NULL,
  fecha TIMESTAMP WITH TIME ZONE NOT NULL,
  tipo tipo_mov NOT NULL,
  categoria TEXT,
  grupo TEXT,
  nombre TEXT,
  concepto TEXT NOT NULL,
  monto DECIMAL(15,2) NOT NULL,
  cuenta TEXT,
  proyecto TEXT,
  comentario TEXT,
  fuente TEXT NOT NULL DEFAULT 'MANUAL',
  upload_id UUID,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create excel_uploads table
CREATE TABLE public.excel_uploads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre_archivo TEXT NOT NULL,
  total_filas INT NOT NULL DEFAULT 0,
  filas_importadas INT NOT NULL DEFAULT 0,
  filas_error INT NOT NULL DEFAULT 0,
  errores_detalle JSONB,
  subido_por_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create conversaciones table
CREATE TABLE public.conversaciones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa TEXT,
  mensajes JSONB NOT NULL DEFAULT '[]'::JSONB,
  tokens INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key for movimientos -> excel_uploads
ALTER TABLE public.movimientos ADD CONSTRAINT fk_movimientos_upload
  FOREIGN KEY (upload_id) REFERENCES public.excel_uploads(id);

-- Create indexes
CREATE INDEX idx_movimientos_empresa_fecha ON public.movimientos(empresa, fecha);
CREATE INDEX idx_movimientos_empresa_anio_mes ON public.movimientos(empresa, anio, mes);
CREATE INDEX idx_movimientos_empresa_tipo ON public.movimientos(empresa, tipo);
CREATE INDEX idx_movimientos_empresa_categoria ON public.movimientos(empresa, categoria);
CREATE INDEX idx_movimientos_proyecto ON public.movimientos(proyecto);
CREATE INDEX idx_conversaciones_user ON public.conversaciones(user_id);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.excel_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversaciones ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check empresa access
CREATE OR REPLACE FUNCTION public.can_access_empresa(_user_id UUID, _empresa TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
    AND (empresas @> ARRAY['*']::TEXT[] OR empresas @> ARRAY[_empresa]::TEXT[])
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'SUPER_ADMIN'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Super admins can insert profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN'));

-- User roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'SUPER_ADMIN'));

CREATE POLICY "Super admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'SUPER_ADMIN'));

-- Movimientos policies
CREATE POLICY "Users can view movimientos for their empresas" ON public.movimientos
  FOR SELECT TO authenticated
  USING (public.can_access_empresa(auth.uid(), empresa));

CREATE POLICY "Admins can insert movimientos" ON public.movimientos
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'SUPER_ADMIN') OR public.has_role(auth.uid(), 'ADMIN'))
    AND public.can_access_empresa(auth.uid(), empresa)
  );

CREATE POLICY "Admins can update movimientos" ON public.movimientos
  FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'SUPER_ADMIN') OR public.has_role(auth.uid(), 'ADMIN'))
    AND public.can_access_empresa(auth.uid(), empresa)
  );

CREATE POLICY "Super admins can delete movimientos" ON public.movimientos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'SUPER_ADMIN'));

-- Excel uploads policies
CREATE POLICY "Users can view uploads" ON public.excel_uploads
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert uploads" ON public.excel_uploads
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'SUPER_ADMIN') OR public.has_role(auth.uid(), 'ADMIN'));

-- Conversaciones policies
CREATE POLICY "Users can view own conversaciones" ON public.conversaciones
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversaciones" ON public.conversaciones
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversaciones" ON public.conversaciones
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_movimientos_updated_at BEFORE UPDATE ON public.movimientos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversaciones_updated_at BEFORE UPDATE ON public.conversaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nombre)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'VIEWER');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;