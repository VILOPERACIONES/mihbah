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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Auth - get user from token
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    const { mensaje, empresaFiltro, conversacionId, history } = await req.json();

    // Determine empresa filter for queries
    const empFilter =
      empresaFiltro && empresaFiltro !== "TODAS" ? empresaFiltro : null;

    // ── Gather financial context in parallel ──
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const [kpisRes, latestRes, flujoRes, topCatRes, alertsRes, empresasRes] =
      await Promise.all([
        // KPIs for latest month with data
        sb.rpc("get_kpis_mes", {
          _anio: currentYear,
          _mes: currentMonth,
          ...(empFilter ? { _empresa: empFilter } : {}),
        }),
        // Latest month with data
        sb.rpc("get_latest_month"),
        // Cash flow last 12 months
        sb.rpc("get_flujo_mensual", {
          _anio_desde: currentYear - 1,
          ...(empFilter ? { _empresa: empFilter } : {}),
        }),
        // Top expense categories
        sb.rpc("get_top_categorias", {
          _anio: currentYear,
          _mes: currentMonth,
          _limite: 10,
          ...(empFilter ? { _empresa: empFilter } : {}),
        }),
        // Recent large movements for alerts
        sb
          .from("movimientos")
          .select("fecha, tipo, monto, concepto, empresa, categoria, cuenta")
          .eq("activo", true)
          .order("fecha", { ascending: false })
          .limit(30)
          .then((r) => r),
        // Available empresas
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

    // If latest month differs from current, also get KPIs for that month
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

    // Check for large single transactions
    const avgMonto =
      recentMovs.reduce(
        (s: number, m: { monto: number }) => s + Math.abs(m.monto),
        0
      ) / (recentMovs.length || 1);
    const largeOnes = recentMovs.filter(
      (m: { monto: number; concepto: string; empresa: string }) =>
        Math.abs(m.monto) > avgMonto * 3
    );
    for (const m of largeOnes.slice(0, 3)) {
      alerts.push(
        `⚠️ Movimiento inusual: ${m.concepto} por $${Math.abs(m.monto).toLocaleString()} en ${m.empresa}`
      );
    }

    // Check balance (ingresos vs salidas)
    const kpi = kpisLatest as Record<string, number> | null;
    if (kpi) {
      const balance = (kpi.ingresos ?? 0) - (kpi.salidas ?? 0);
      if (balance < 0) {
        alerts.push(
          `🔴 Balance negativo del mes: -$${Math.abs(balance).toLocaleString()}`
        );
      }
      if (kpi.salidas > 0 && kpi.ingresos > 0) {
        const ratio = kpi.salidas / kpi.ingresos;
        if (ratio > 0.9) {
          alerts.push(
            `🟡 Las salidas representan ${(ratio * 100).toFixed(0)}% de los ingresos`
          );
        }
      }
    }

    const mesesNombre = [
      "",
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];

    const periodoLabel = latestMonth
      ? `${mesesNombre[latestMonth.mes]} ${latestMonth.anio}`
      : `${mesesNombre[currentMonth]} ${currentYear}`;

    // ── System prompt with real data ──
    const systemPrompt = `Eres Jade AI, el CFO virtual inteligente de la plataforma financiera Jade.
Tu tono es directo, ejecutivo, claro y en español mexicano. Usas emojis financieros cuando ayudan.
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
- Sé conciso pero completo. Usa listas y bullets para claridad.
- Si preguntan sobre un periodo o empresa diferente al filtro actual, indica que cambien el filtro en la interfaz.`;

    // ── Build messages array ──
    const aiMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history if provided
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        aiMessages.push({ role: msg.role, content: msg.content });
      }
    }

    aiMessages.push({ role: "user", content: mensaje });

    // ── Call Lovable AI Gateway with streaming ──
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: aiMessages,
          stream: true,
        }),
      }
    );

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
      console.error("AI gateway error:", status, errText);
      throw new Error(`AI gateway error: ${status}`);
    }

    // Stream the response through
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
