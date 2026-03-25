import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Load default provider
    const { data: defaultProvider } = await sb
      .from("llm_providers")
      .select("name, models, is_default")
      .eq("is_default", true)
      .limit(1)
      .single();

    let provider = defaultProvider;
    if (!provider) {
      const { data: anyProvider } = await sb
        .from("llm_providers")
        .select("name, models, is_default")
        .limit(1)
        .single();
      provider = anyProvider;
    }

    // Load enabled skills
    const { data: skillsData } = await sb
      .from("agent_skills")
      .select("name, enabled")
      .eq("enabled", true)
      .order("created_at");

    const providerName = provider?.name ?? "Lovable AI";
    const model = provider?.models?.[0] ?? "gemini-2.5-flash";
    const skills = (skillsData ?? []).map((s: any) => s.name);

    return new Response(
      JSON.stringify({ provider: providerName, model, skills }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("chat-config error:", e);
    return new Response(
      JSON.stringify({ provider: "Desconocido", model: "N/A", skills: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
