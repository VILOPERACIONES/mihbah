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

    const { mensaje, empresaFiltro, history } = await req.json();

    const empFilter =
      empresaFiltro && empresaFiltro !== "TODAS" ? empresaFiltro : null;

    // ── Load default LLM provider from DB ──
    const { data: defaultProvider } = await sb
      .from("llm_providers")
      .select("*")
      .eq("is_default", true)
      .limit(1)
      .single();

    // Fallback: if no default, try any provider
    let provider = defaultProvider;
    if (!provider) {
      const { data: anyProvider } = await sb
        .from("llm_providers")
        .select("*")
        .limit(1)
        .single();
      provider = anyProvider;
    }

    // Determine API config
    let apiUrl: string;
    let apiKey: string;
    let model: string;
    let authHeaders: Record<string, string>;

    if (provider && provider.base_url && provider.api_key_encrypted) {
      // Use configured provider
      const baseUrl = provider.base_url.replace(/\/+$/, "");
      apiUrl = `${baseUrl}/chat/completions`;
      apiKey = provider.api_key_encrypted;
      model = provider.models?.[0] ?? "claude-sonnet-4-20250514";

      // Detect provider type for correct auth headers
      const isAnthropic = baseUrl.includes("anthropic");
      if (isAnthropic) {
        // Anthropic Messages API
        apiUrl = `${baseUrl}/messages`;
        authHeaders = {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        };
      } else {
        // OpenAI-compatible
        authHeaders = {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        };
      }
    } else {
      // Fallback to Lovable AI Gateway
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("No hay proveedor LLM configurado ni LOVABLE_API_KEY disponible");
      apiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = LOVABLE_API_KEY;
      model = "google/gemini-2.5-flash";
      authHeaders = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      };
    }

    // ── Load skills from DB ──
    const { data: skillsData } = await sb
      .from("agent_skills")
      .select("*")
      .eq("enabled", true)
      .order("created_at");

    const enabledSkills = skillsData ?? [];

    const skillPrompts = enabledSkills
      .map((s: any) => `### Skill: ${s.name}\n${s.system_prompt}`)
      .filter(Boolean)
      .join("\n\n---\n\n");

    // ── Gather financial context in parallel ──
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const [kpisRes, latestRes, flujoRes, topCatRes, alertsRes, empresasRes] =
      await Promise.all([
        sb.rpc("get_kpis_mes", {
          _anio: currentYear,
          _mes: currentMonth,
          ...(empFilter ? { _empresa: empFilter } : {}),
        }),
        sb.rpc("get_latest_month"),
        sb.rpc("get_flujo_mensual", {
          _anio_desde: currentYear - 1,
          ...(empFilter ? { _empresa: empFilter } : {}),
        }),
        sb.rpc("get_top_categorias", {
          _anio: currentYear,
          _mes: currentMonth,
          _limite: 10,
          ...(empFilter ? { _empresa: empFilter } : {}),
        }),
        sb
          .from("movimientos")
          .select("fecha, tipo, monto, concepto, empresa, categoria, cuenta")
          .eq("activo", true)
          .order("fecha", { ascending: false })
          .limit(30),
        sb
          .from("movimientos")
          .select("empresa")
          .eq("activo", true)
          .then((r) => {
            const set = new Set(
              (r.data ?? []).map((m: { empresa: string }) => m.empresa)
            );
            return { data: [...set] };
          }),
      ]);

    const latestMonth = latestRes.data?.[0];
    let kpisLatest = kpisRes.data;
    if (
      latestMonth &&
      (latestMonth.anio !== currentYear || latestMonth.mes !== currentMonth)
    ) {
      const { data } = await sb.rpc("get_kpis_mes", {
        _anio: latestMonth.anio,
        _mes: latestMonth.mes,
        ...(empFilter ? { _empresa: empFilter } : {}),
      });
      kpisLatest = data;
    }

    // ── Build alerts ──
    const recentMovs = alertsRes.data ?? [];
    const alerts: string[] = [];

    const avgMonto =
      recentMovs.reduce(
        (s: number, m: { monto: number }) => s + Math.abs(m.monto),
        0
      ) / (recentMovs.length || 1);
    const largeOnes = recentMovs.filter(
      (m: { monto: number }) => Math.abs(m.monto) > avgMonto * 3
    );
    for (const m of largeOnes.slice(0, 3)) {
      alerts.push(
        `Movimiento inusual: ${(m as any).concepto} por $${Math.abs(m.monto).toLocaleString()} en ${(m as any).empresa}`
      );
    }

    const kpi = kpisLatest as Record<string, number> | null;
    if (kpi) {
      const balance = (kpi.ingresos ?? 0) - (kpi.salidas ?? 0);
      if (balance < 0) {
        alerts.push(
          `Balance negativo del mes: -$${Math.abs(balance).toLocaleString()}`
        );
      }
      if (kpi.salidas > 0 && kpi.ingresos > 0) {
        const ratio = kpi.salidas / kpi.ingresos;
        if (ratio > 0.9) {
          alerts.push(
            `Las salidas representan ${(ratio * 100).toFixed(0)}% de los ingresos`
          );
        }
      }
    }

    const mesesNombre = [
      "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ];

    const periodoLabel = latestMonth
      ? `${mesesNombre[latestMonth.mes]} ${latestMonth.anio}`
      : `${mesesNombre[currentMonth]} ${currentYear}`;

    // ── System prompt with real data + skills ──
    const basePrompt = `Eres Jade AI, el asistente financiero inteligente de la plataforma Jade.
Tu tono es directo, ejecutivo, claro y en español mexicano.
Tienes acceso COMPLETO a los datos financieros reales de la empresa.

## CONTEXTO FINANCIERO ACTUAL (${periodoLabel})
Empresa filtrada: ${empFilter ?? "TODAS (grupo completo)"}
Empresas disponibles: ${JSON.stringify(empresasRes.data)}

### KPIs del periodo con datos más reciente (${periodoLabel}):
${JSON.stringify(kpisLatest, null, 2)}

### Flujo de caja mensual (últimos 12+ meses):
${JSON.stringify(flujoRes.data, null, 2)}

### Top categorías de gasto:
${JSON.stringify(topCatRes.data, null, 2)}

### Últimos movimientos relevantes:
${JSON.stringify(recentMovs.slice(0, 15), null, 2)}

### Alertas detectadas:
${alerts.length > 0 ? alerts.join("\n") : "Sin alertas críticas."}

## INSTRUCCIONES:
- Responde siempre con datos reales, nunca inventes cifras.
- Formatea montos en MXN con separador de miles: $1,234,567.89
- Si te preguntan algo que no está en los datos, dilo claramente.
- Ofrece insights proactivos: tendencias, riesgos, comparaciones mes a mes.
- Si el usuario pregunta sobre alertas, reporta las detectadas arriba.
- Sé conciso pero completo. Usa listas y bullets para claridad.`;

    const fullSystemPrompt = skillPrompts
      ? `${basePrompt}\n\n## SKILLS ACTIVOS:\n${skillPrompts}`
      : basePrompt;

    // ── Build messages array ──
    const messagesArr: { role: string; content: string }[] = [];

    if (history && Array.isArray(history)) {
      for (const msg of history) {
        messagesArr.push({ role: msg.role, content: msg.content });
      }
    }
    messagesArr.push({ role: "user", content: mensaje });

    // ── Detect if Anthropic ──
    const isAnthropic = apiUrl.includes("anthropic") || apiUrl.includes("/messages");

    let aiResponse: Response;

    if (isAnthropic) {
      // Anthropic Messages API format
      aiResponse = await fetch(apiUrl, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          system: fullSystemPrompt,
          messages: messagesArr.map((m) => ({
            role: m.role === "system" ? "user" : m.role,
            content: m.content,
          })),
          stream: true,
        }),
      });
    } else {
      // OpenAI-compatible format
      const aiMessages = [
        { role: "system", content: fullSystemPrompt },
        ...messagesArr,
      ];

      aiResponse = await fetch(apiUrl, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({
          model,
          messages: aiMessages,
          stream: true,
        }),
      });
    }

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Límite de solicitudes excedido. Intenta en unos segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos agotados. Contacta al administrador." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errText = await aiResponse.text();
      console.error("AI provider error:", status, errText);
      return new Response(
        JSON.stringify({ error: `Error del proveedor de IA (${status}): ${errText.slice(0, 200)}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For Anthropic, we need to transform the SSE stream to OpenAI format
    if (isAnthropic) {
      const reader = aiResponse.body!.getReader();
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();

      const stream = new ReadableStream({
        async start(controller) {
          let buffer = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });

              let newlineIndex: number;
              while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
                let line = buffer.slice(0, newlineIndex);
                buffer = buffer.slice(newlineIndex + 1);
                if (line.endsWith("\r")) line = line.slice(0, -1);
                if (!line.startsWith("data: ")) continue;

                const jsonStr = line.slice(6).trim();
                if (jsonStr === "[DONE]") {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  continue;
                }

                try {
                  const event = JSON.parse(jsonStr);

                  // Anthropic content_block_delta → OpenAI delta format
                  if (event.type === "content_block_delta" && event.delta?.text) {
                    const openaiChunk = {
                      choices: [{ delta: { content: event.delta.text } }],
                    };
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`)
                    );
                  } else if (event.type === "message_stop") {
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  }
                } catch {}
              }
            }
          } catch (err) {
            console.error("Stream transform error:", err);
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
      });
    }

    // OpenAI-compatible: pass through directly
    return new Response(aiResponse.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
