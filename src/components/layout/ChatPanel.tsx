import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/app.store";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Send, Bot, X, Paperclip, FileSpreadsheet, Table2, BarChart3, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import ReactMarkdown from "react-markdown";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ── Types ──
interface ExcelData {
  fileName: string;
  headers: string[];
  rows: Record<string, unknown>[];
  summary: string; // text summary for AI context
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  ts: number;
  excelData?: ExcelData;
  showChart?: boolean;
}

const QUICK_QUESTIONS = [
  "¿Cómo estamos este mes?",
  "Top egresos y alertas",
  "Comparar ingresos vs salidas",
  "¿Cuáles son las alertas principales?",
  "Resumen ejecutivo del periodo",
];

// ── Excel parser ──
function parseExcelFile(file: File): Promise<ExcelData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

        if (json.length === 0) {
          reject(new Error("El archivo Excel está vacío"));
          return;
        }

        const headers = Object.keys(json[0]);
        const rows = json.slice(0, 500); // limit to 500 rows for display

        // Build summary for AI
        const numericCols = headers.filter((h) =>
          rows.some((r) => typeof r[h] === "number" && !isNaN(r[h] as number))
        );

        let summary = `Archivo: ${file.name}\n`;
        summary += `Filas: ${json.length} | Columnas: ${headers.length}\n`;
        summary += `Columnas: ${headers.join(", ")}\n\n`;

        if (numericCols.length > 0) {
          summary += "Resumen numérico:\n";
          for (const col of numericCols.slice(0, 10)) {
            const values = json
              .map((r) => Number(r[col]))
              .filter((v) => !isNaN(v));
            if (values.length === 0) continue;
            const sum = values.reduce((a, b) => a + b, 0);
            const avg = sum / values.length;
            const min = Math.min(...values);
            const max = Math.max(...values);
            summary += `  ${col}: Total=${sum.toLocaleString()}, Promedio=${avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}, Min=${min.toLocaleString()}, Max=${max.toLocaleString()}\n`;
          }
        }

        // Sample first 5 rows
        summary += "\nPrimeras 5 filas:\n";
        summary += JSON.stringify(json.slice(0, 5), null, 2);

        resolve({ fileName: file.name, headers, rows, summary });
      } catch {
        reject(new Error("No se pudo leer el archivo Excel"));
      }
    };
    reader.onerror = () => reject(new Error("Error al leer archivo"));
    reader.readAsArrayBuffer(file);
  });
}

// ── Inline Data Table ──
function DataTable({ data }: { data: ExcelData }) {
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const totalPages = Math.ceil(data.rows.length / pageSize);
  const pageRows = data.rows.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="mt-2 rounded-lg border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-card border-b border-border">
        <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">{data.fileName}</span>
        <span className="text-xs text-muted-foreground ml-auto">{data.rows.length} filas</span>
      </div>
      <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-card/50">
              {data.headers.slice(0, 8).map((h) => (
                <th key={h} className="text-left px-2 py-1.5 font-medium text-muted-foreground whitespace-nowrap border-b border-border">
                  {h}
                </th>
              ))}
              {data.headers.length > 8 && (
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground border-b border-border">
                  +{data.headers.length - 8} más
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-card/30">
                {data.headers.slice(0, 8).map((h) => (
                  <td key={h} className="px-2 py-1 whitespace-nowrap max-w-[150px] truncate">
                    {String(row[h] ?? "")}
                  </td>
                ))}
                {data.headers.length > 8 && <td className="px-2 py-1 text-muted-foreground">…</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-card border-t border-border">
          <Button variant="ghost" size="sm" className="h-6 text-xs" disabled={page === 0} onClick={() => setPage(page - 1)}>
            ← Anterior
          </Button>
          <span className="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
            Siguiente →
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Inline Chart ──
function DataChart({ data }: { data: ExcelData }) {
  // Find first string col and first numeric col for auto chart
  const stringCol = data.headers.find((h) =>
    data.rows.some((r) => typeof r[h] === "string" && (r[h] as string).length > 0)
  );
  const numericCols = data.headers.filter((h) =>
    data.rows.some((r) => typeof r[h] === "number" && !isNaN(r[h] as number))
  );

  if (!stringCol || numericCols.length === 0) {
    return (
      <div className="mt-2 p-3 rounded-lg border border-border bg-card text-xs text-muted-foreground text-center">
        No se encontraron datos numéricos para graficar
      </div>
    );
  }

  // Aggregate: group by stringCol, sum first numeric col
  const numCol = numericCols[0];
  const grouped = new Map<string, number>();
  for (const row of data.rows) {
    const key = String(row[stringCol] ?? "").slice(0, 30);
    if (!key) continue;
    grouped.set(key, (grouped.get(key) ?? 0) + Number(row[numCol] ?? 0));
  }

  const chartData = Array.from(grouped.entries())
    .map(([name, value]) => ({ name, value: Math.abs(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  return (
    <div className="mt-2 rounded-lg border border-border overflow-hidden p-3 bg-card">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">{numCol} por {stringCol}</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 80, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1A1A1A" />
          <XAxis type="number" tick={{ fill: "#888", fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
          <YAxis type="category" dataKey="name" tick={{ fill: "#888", fontSize: 10 }} width={75} />
          <Tooltip
            contentStyle={{ background: "#0A0A0A", border: "1px solid #1A1A1A", borderRadius: 8, fontSize: 11 }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, numCol]}
          />
          <Bar dataKey="value" fill="#22C55E" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main ChatPanel ──
export function ChatPanel({ onClose }: { onClose?: () => void }) {
  const { empresaActiva } = useAppStore();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingFile, setPendingFile] = useState<ExcelData | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevEmpresa = useRef(empresaActiva);

  useEffect(() => {
    if (prevEmpresa.current !== empresaActiva) {
      setMessages([]);
      setPendingFile(null);
      prevEmpresa.current = empresaActiva;
    }
  }, [empresaActiva]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ── Persist to DB ──
  const conversacionIdRef = useRef<string | null>(null);

  const persistConversation = useCallback(async (msgs: ChatMessage[]) => {
    if (!user) return;
    const mensajes = msgs.map((m) => ({
      role: m.role,
      content: m.content,
      ts: m.ts,
      ...(m.excelData ? { excelFile: m.excelData.fileName } : {}),
    }));

    try {
      if (conversacionIdRef.current) {
        await supabase
          .from("conversaciones")
          .update({ mensajes: mensajes as any, updated_at: new Date().toISOString() } as any)
          .eq("id", conversacionIdRef.current);
      } else {
        const { data } = await supabase
          .from("conversaciones")
          .insert({
            user_id: user.id,
            mensajes: mensajes as any,
            empresa: empresaActiva,
            tokens: 0,
          } as any)
          .select("id")
          .single();
        if (data) conversacionIdRef.current = data.id;
      }
    } catch {}
  }, [user, empresaActiva]);

  // ── Handle file ──
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const data = await parseExcelFile(file);
      setPendingFile(data);

      // Auto-send a message with the file
      const texto = `Analiza este archivo Excel: ${file.name}`;
      await enviarMensajeConExcel(texto, data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error al procesar archivo";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ ${errorMsg}`, ts: Date.now() },
      ]);
    }
  }

  async function enviarMensajeConExcel(texto: string, excelData: ExcelData) {
    if (isStreaming) return;
    setIsStreaming(true);

    const userMsg: ChatMessage = {
      role: "user",
      content: texto,
      ts: Date.now(),
      excelData,
    };
    setMessages((prev) => [...prev, userMsg]);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    // Add excel summary as context in the message
    const enrichedText = `${texto}\n\n--- DATOS DEL EXCEL ---\n${excelData.summary}`;

    await streamResponse(enrichedText, history, (finalMsgs) => {
      // After response, add a message showing the data
      const withViz: ChatMessage = {
        role: "assistant",
        content: "",
        ts: Date.now(),
        excelData,
        showChart: true,
      };
      setMessages((prev) => [...prev, withViz]);
      setPendingFile(null);
    });
  }

  async function enviarMensaje(texto: string) {
    if (!texto.trim() || isStreaming) return;
    setInput("");
    setIsStreaming(true);

    const userMsg: ChatMessage = { role: "user", content: texto, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    await streamResponse(texto, history);
  }

  async function streamResponse(
    texto: string,
    history: { role: string; content: string }[],
    onComplete?: (msgs: ChatMessage[]) => void
  ) {
    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.excelData) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar, ts: Date.now() }];
      });
    };

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          mensaje: texto,
          empresaFiltro: empresaActiva,
          history,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(errData.error || `Error ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      if (buffer.trim()) {
        for (let raw of buffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {}
        }
      }

      if (!assistantSoFar) {
        upsertAssistant("No pude generar una respuesta. Intenta de nuevo.");
      }

      // Persist after complete
      setMessages((prev) => {
        persistConversation(prev);
        onComplete?.(prev);
        return prev;
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error al conectar con el asistente.";
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && !last.excelData) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: `⚠️ ${errorMsg}` } : m));
        }
        return [...prev, { role: "assistant", content: `⚠️ ${errorMsg}`, ts: Date.now() }];
      });
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="h-[var(--topbar-height)] flex items-center px-4 gap-2 border-b border-border shrink-0">
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        <Bot className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm text-foreground">Jade AI</span>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground bg-card px-2 py-0.5 rounded">
          {empresaActiva}
        </span>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); conversacionIdRef.current = null; setPendingFile(null); }}
            className="text-muted-foreground hover:text-foreground"
            title="Nueva conversación"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        {onClose && (
          <button onClick={onClose} className="xl:hidden ml-2 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Bot className="h-10 w-10 text-primary/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Hola {user?.nombre?.split(" ")[0] ?? ""}! Soy tu CFO virtual.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Tengo acceso a todos los datos financieros de {empresaActiva === "TODAS" ? "el grupo" : empresaActiva}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-2">
              KPIs · Flujo de caja · Alertas · Sube un Excel
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            {/* Excel data visualization message */}
            {msg.excelData && msg.role === "assistant" && msg.showChart ? (
              <div className="mr-auto max-w-[95%]">
                <DataTable data={msg.excelData} />
                <DataChart data={msg.excelData} />
              </div>
            ) : msg.excelData && msg.role === "user" ? (
              <div className="ml-auto max-w-[90%]">
                <div className="rounded-xl px-3 py-2 text-sm bg-primary text-primary-foreground">
                  <div className="flex items-center gap-2 mb-1">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span className="font-medium">{msg.excelData.fileName}</span>
                  </div>
                  <p className="text-xs opacity-80">
                    {msg.excelData.rows.length} filas • {msg.excelData.headers.length} columnas
                  </p>
                  {msg.content && <p className="mt-1">{msg.content}</p>}
                </div>
              </div>
            ) : (
              <div
                className={cn(
                  "max-w-[90%] rounded-xl px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground whitespace-pre-wrap"
                    : "mr-auto bg-card text-foreground border border-border"
                )}
              >
                {msg.content ? (
                  msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_li]:my-0.5 [&_ul]:my-1 [&_ol]:my-1 [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-xs [&_strong]:text-primary [&_code]:text-primary/80 [&_code]:bg-primary/10 [&_code]:px-1 [&_code]:rounded">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )
                ) : (
                  <div className="flex items-center gap-1">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="h-1.5 w-1.5 bg-primary rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Questions */}
      {messages.length === 0 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-muted-foreground mb-2">Preguntas rápidas:</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => enviarMensaje(q)}
                className="text-xs px-2.5 py-1 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pending file indicator */}
      {pendingFile && (
        <div className="px-4 pb-1">
          <div className="flex items-center gap-2 px-2 py-1 rounded bg-primary/10 border border-primary/20 text-xs">
            <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
            <span className="truncate flex-1">{pendingFile.fileName}</span>
            <button onClick={() => setPendingFile(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFileSelect}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviarMensaje(input);
          }}
          className="flex gap-2"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            disabled={isStreaming}
            onClick={() => fileInputRef.current?.click()}
            title="Subir Excel"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta o sube un Excel..."
            disabled={isStreaming}
            className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button type="submit" size="icon" disabled={isStreaming || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </>
  );
}
