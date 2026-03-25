import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { base_url, api_key } = await req.json();

    if (!base_url || !api_key) {
      return new Response(
        JSON.stringify({ error: "Se requiere base_url y api_key" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize base_url: remove trailing slash
    const normalizedUrl = base_url.replace(/\/+$/, "");

    const response = await fetch(`${normalizedUrl}/models`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${api_key}`,
        "x-api-key": api_key, // Anthropic uses this header
        "anthropic-version": "2023-06-01", // Required for Anthropic
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Provider API error [${response.status}]:`, errorText);
      return new Response(
        JSON.stringify({
          error: `Error del proveedor (${response.status})`,
          details: errorText,
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Normalize response — different providers return different formats
    let models: string[] = [];

    if (data.data && Array.isArray(data.data)) {
      // OpenAI-compatible format: { data: [{ id: "model-name" }] }
      models = data.data.map((m: any) => m.id).filter(Boolean).sort();
    } else if (Array.isArray(data)) {
      // Some providers return a plain array
      models = data.map((m: any) => (typeof m === "string" ? m : m.id || m.name)).filter(Boolean).sort();
    }

    return new Response(JSON.stringify({ models }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("list-models error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
