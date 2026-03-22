import { Hono } from "https://deno.land/x/hono@v4.4.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const app = new Hono();

app.options('/*', (c) => new Response(null, { headers: corsHeaders }));

app.post('/', async (c) => {
  try {
    const { email, password, nombre, rol, empresas } = await c.req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create user via admin API
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { nombre },
      }),
    });

    const userData = await createRes.json();
    if (!createRes.ok) {
      return c.json({ error: userData.msg || 'Failed to create user' }, 400);
    }

    const userId = userData.id;

    // Update profile
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.49.4");
    const supabase = createClient(supabaseUrl, serviceKey);

    await supabase.from('profiles').update({
      nombre: nombre || email,
      empresas: empresas || ['*'],
    }).eq('user_id', userId);

    // Set role
    await supabase.from('user_roles').update({
      role: rol || 'VIEWER',
    }).eq('user_id', userId);

    return c.json({ success: true, userId }, 200, corsHeaders);
  } catch (error) {
    return c.json({ error: String(error) }, 500, corsHeaders);
  }
});

Deno.serve(app.fetch);
