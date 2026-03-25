import { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/app.store";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Send, Bot, X, Paperclip, FileSpreadsheet, Table2, BarChart3,
  Trash2, Plus, MessageSquare, ChevronLeft, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ── Types ──
interface ExcelData {
  fileName: string;
  headers: string[];
  rows: Record<string, unknown>[];
  summary: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  ts: number;
  excelData?: ExcelData;
  showChart?: boolean;
}

interface ConversationRow {
  id: string;
  created_at: string;
  updated_at: string;
  empresa: string | null;
  mensajes: any;
}

const QUICK_QUESTIONS = [
  "Como estamos este mes?",
  "Top egresos y alertas",
  "Comparar ingresos vs salidas",
  "Cuales son las alertas principales?",
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

        if (json.length === 0) { reject(new Error("El archivo Excel esta vacio")); return; }

        const headers = Object.keys(json[0]);
        const rows = json.slice(0, 500);

        const numericCols = headers.filter((h) =>
          rows.some((r) => typeof r[h] === "number" && !isNaN(r[h] as number))
        );

        let summary = `Archivo: ${file.name}\nFilas: ${json.length} | Columnas: ${headers.length}\nColumnas: ${headers.join(", ")}\n\n`;

        if (numericCols.length > 0) {
          summary += "Resumen numerico:\n";
          for (const col of numericCols.slice(0, 10)) {
            const values = json.map((r) => Number(r[col])).filter((v) => !isNaN(v));
            if (values.length === 0) continue;
            const sum = values.reduce((a, b) => a + b, 0);
            const avg = sum / values.length;
            summary += `  ${col}: Total=${sum.toLocaleString()}, Promedio=${avg.toLocaleString(undefined, { maximumFractionDigits: 2 })}, Min=${Math.min(...values).toLocaleString()}, Max=${Math.max(...values).toLocaleString()}\n`;
          }
        }

        summary += "\nPrimeras 5 filas:\n" + JSON.stringify(json.slice(0, 5), null, 2);
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
                <th key={h} className="text-left px-2 py-1.5 font-medium text-muted-foreground whitespace-nowrap border-b border-border">{h}</th>
              ))}
              {data.headers.length > 8 && (
                <th className="text-left px-2 py-1.5 font-medium text-muted-foreground border-b border-border">+{data.headers.length - 8} mas</th>
              )}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} className="border-b border-border/50 hover:bg-card/30">
                {data.headers.slice(0, 8).map((h) => (
                  <td key={h} className="px-2 py-1 whitespace-nowrap max-w-[150px] truncate">{String(row[h] ?? "")}</td>
                ))}
                {data.headers.length > 8 && <td className="px-2 py-1 text-muted-foreground">...</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-card border-t border-border">
          <Button variant="ghost" size="sm" className="h-6 text-xs" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
          <span className="text-xs text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>Siguiente</Button>
        </div>
      )}
    </div>
  );
}

// ── Inline Chart ──
function DataChart({ data }: { data: ExcelData }) {
  const stringCol = data.headers.find((h) =>
    data.rows.some((r) => typeof r[h] === "string" && (r[h] as string).length > 0)
  );
  const numericCols = data.headers.filter((h) =>
    data.rows.some((r) => typeof r[h] === "number" && !isNaN(r[h] as number))
  );

  if (!stringCol || numericCols.length === 0) {
    return <div className="mt-2 p-3 rounded-lg border border-border bg-card text-xs text-muted-foreground text-center">No se encontraron datos numericos para graficar</div>;
  }

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
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
          <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} width={75} />
          <Tooltip
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
            formatter={(value: number) => [`$${value.toLocaleString()}`, numCol]}
          />
          <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Markdown components for rich rendering ──
const markdownComponents = {
  table: ({ children, ...props }: any) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-xs border-collapse" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }: any) => (
    <thead className="bg-card" {...props}>{children}</thead>
  ),
  th: ({ children, ...props }: any) => (
    <th className="text-left px-3 py-2 font-semibold text-foreground border-b border-border whitespace-nowrap" {...props}>{children}</th>
  ),
  td: ({ children, ...props }: any) => (
    <td className="px-3 py-1.5 border-b border-border/50 text-foreground" {...props}>{children}</td>
  ),
  tr: ({ children, ...props }: any) => (
    <tr className="hover:bg-card/50 transition-colors" {...props}>{children}</tr>
  ),
  code: ({ children, className, ...props }: any) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <div className="my-2 rounded-lg overflow-hidden border border-border">
          <div className="bg-card px-3 py-1 text-[10px] text-muted-foreground border-b border-border font-mono">
            {className?.replace("language-", "") || "code"}
          </div>
          <pre className="bg-card/50 p-3 overflow-x-auto">
            <code className="text-xs font-mono text-foreground" {...props}>{children}</code>
          </pre>
        </div>
      );
    }
    return <code className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>;
  },
  pre: ({ children }: any) => <>{children}</>,
  ul: ({ children, ...props }: any) => (
    <ul className="my-1.5 ml-4 list-disc space-y-0.5 marker:text-primary/60" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: any) => (
    <ol className="my-1.5 ml-4 list-decimal space-y-0.5 marker:text-primary/60" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: any) => (
    <li className="text-sm leading-relaxed" {...props}>{children}</li>
  ),
  h1: ({ children, ...props }: any) => (
    <h1 className="text-base font-bold mt-3 mb-1.5 text-foreground" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: any) => (
    <h2 className="text-sm font-bold mt-2.5 mb-1 text-foreground" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: any) => (
    <h3 className="text-sm font-semibold mt-2 mb-1 text-foreground" {...props}>{children}</h3>
  ),
  p: ({ children, ...props }: any) => (
    <p className="my-1 text-sm leading-relaxed" {...props}>{children}</p>
  ),
  strong: ({ children, ...props }: any) => (
    <strong className="font-semibold text-primary" {...props}>{children}</strong>
  ),
  blockquote: ({ children, ...props }: any) => (
    <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground italic" {...props}>{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-border" />,
};

// ── Conversation list sidebar ──
function ConversationList({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: ConversationRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <Button onClick={onNew} variant="outline" size="sm" className="w-full gap-2 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Nueva conversacion
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">Sin conversaciones</p>
        )}
        {conversations.map((c) => {
          const msgs = Array.isArray(c.mensajes) ? c.mensajes : [];
          const firstUser = msgs.find((m: any) => m.role === "user");
          const preview = firstUser?.content?.slice(0, 60) || "Conversacion sin mensajes";
          const date = new Date(c.updated_at);
          const isActive = c.id === activeId;

          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                "w-full text-left px-3 py-2.5 border-b border-border/50 transition-colors group",
                isActive ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-card"
              )}
            >
              <div className="flex items-start gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate">{preview}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock className="h-2.5 w-2.5 text-muted-foreground/50" />
                    <span className="text-[10px] text-muted-foreground/60">
                      {date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                    </span>
                    {c.empresa && (
                      <span className="text-[10px] text-muted-foreground/40 truncate">
                        {c.empresa}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </button>
          );
        })}
      </div>
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
  const [chatConfig, setChatConfig] = useState<{ provider: string; model: string; skills: string[] } | null>(null);
  const [showConversations, setShowConversations] = useState(false);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevEmpresa = useRef(empresaActiva);

  // Fetch active LLM config
  useEffect(() => {
    async function loadConfig() {
      try {
        const [{ data: provData }, { data: skillsData }] = await Promise.all([
          supabase.from("llm_providers").select("name, models").eq("is_default", true).limit(1).single(),
          supabase.from("agent_skills").select("name").eq("enabled", true).order("created_at"),
        ]);
        setChatConfig({
          provider: provData?.name ?? "Lovable AI",
          model: provData?.models?.[0] ?? "gemini-2.5-flash",
          skills: (skillsData ?? []).map((s: any) => s.name),
        });
      } catch {}
    }
    loadConfig();
  }, []);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("conversaciones")
      .select("id, created_at, updated_at, empresa, mensajes")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (data) setConversations(data as ConversationRow[]);
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // When empresa changes, inject a system-like note but DON'T clear the conversation
  useEffect(() => {
    if (prevEmpresa.current !== empresaActiva && messages.length > 0) {
      const note: ChatMessage = {
        role: "assistant",
        content: `--- Contexto cambiado a **${empresaActiva === "TODAS" ? "todas las empresas" : empresaActiva}**. Las siguientes respuestas se basaran en los datos de esta empresa. ---`,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, note]);
    }
    prevEmpresa.current = empresaActiva;
  }, [empresaActiva]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // ── Persist to DB ──
  const persistConversation = useCallback(async (msgs: ChatMessage[]) => {
    if (!user) return;
    const mensajes = msgs.map((m) => ({
      role: m.role,
      content: m.content,
      ts: m.ts,
      ...(m.excelData ? { excelFile: m.excelData.fileName } : {}),
    }));

    try {
      if (activeConvId) {
        await supabase
          .from("conversaciones")
          .update({ mensajes: mensajes as any, updated_at: new Date().toISOString(), empresa: empresaActiva } as any)
          .eq("id", activeConvId);
      } else {
        const { data } = await supabase
          .from("conversaciones")
          .insert({ user_id: user.id, mensajes: mensajes as any, empresa: empresaActiva, tokens: 0 } as any)
          .select("id")
          .single();
        if (data) {
          setActiveConvId(data.id);
        }
      }
      loadConversations();
    } catch {}
  }, [user, empresaActiva, activeConvId, loadConversations]);

  // Load a conversation
  function loadConversation(id: string) {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    const msgs = Array.isArray(conv.mensajes) ? conv.mensajes : [];
    setMessages(
      msgs.map((m: any) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
        ts: m.ts || Date.now(),
      }))
    );
    setActiveConvId(id);
    setShowConversations(false);
    setPendingFile(null);
  }

  function startNewConversation() {
    setMessages([]);
    setActiveConvId(null);
    setPendingFile(null);
    setShowConversations(false);
  }

  async function deleteConversation(id: string) {
    await supabase.from("conversaciones").delete().eq("id", id);
    if (activeConvId === id) {
      setMessages([]);
      setActiveConvId(null);
    }
    loadConversations();
  }

  // ── Handle file ──
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const data = await parseExcelFile(file);
      setPendingFile(data);
      const texto = `Analiza este archivo Excel: ${file.name}`;
      await enviarMensajeConExcel(texto, data);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error al procesar archivo";
      setMessages((prev) => [...prev, { role: "assistant", content: errorMsg, ts: Date.now() }]);
    }
  }

  async function enviarMensajeConExcel(texto: string, excelData: ExcelData) {
    if (isStreaming) return;
    setIsStreaming(true);
    const userMsg: ChatMessage = { role: "user", content: texto, ts: Date.now(), excelData };
    setMessages((prev) => [...prev, userMsg]);
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const enrichedText = `${texto}\n\n--- DATOS DEL EXCEL ---\n${excelData.summary}`;
    await streamResponse(enrichedText, history, () => {
      const withViz: ChatMessage = { role: "assistant", content: "", ts: Date.now(), excelData, showChart: true };
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
        body: JSON.stringify({ mensaje: texto, empresaFiltro: empresaActiva, history }),
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
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: errorMsg } : m));
        }
        return [...prev, { role: "assistant", content: errorMsg, ts: Date.now() }];
      });
    } finally {
      setIsStreaming(false);
    }
  }

  // ── Render ──
  return (
    <>
      {/* Conversations sidebar overlay */}
      {showConversations && (
        <div className="absolute inset-0 z-20 flex bg-background">
          <div className="w-full flex flex-col">
            <div className="h-[var(--topbar-height)] flex items-center px-4 gap-2 border-b border-border shrink-0">
              <button onClick={() => setShowConversations(false)} className="text-muted-foreground hover:text-foreground">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-semibold text-sm">Conversaciones</span>
            </div>
            <ConversationList
              conversations={conversations}
              activeId={activeConvId}
              onSelect={loadConversation}
              onNew={startNewConversation}
              onDelete={deleteConversation}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-border shrink-0">
        <div className="h-[var(--topbar-height)] flex items-center px-4 gap-2">
          <button
            onClick={() => { loadConversations(); setShowConversations(true); }}
            className="text-muted-foreground hover:text-foreground"
            title="Conversaciones"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          <Bot className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm text-foreground">Jade AI</span>
          <div className="flex-1" />
          <span className="text-[9px] text-muted-foreground/40" title={chatConfig ? `${chatConfig.provider} / ${chatConfig.model}` : ""}>
            {chatConfig?.provider ? `via ${chatConfig.provider}` : ""}
          </span>
          <span className="text-xs text-muted-foreground bg-card px-2 py-0.5 rounded">
            {empresaActiva}
          </span>
          <button
            onClick={startNewConversation}
            className="text-muted-foreground hover:text-foreground"
            title="Nueva conversacion"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {onClose && (
            <button onClick={onClose} className="xl:hidden ml-1 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
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
              KPIs -- Flujo de caja -- Alertas -- Sube un Excel
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
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
                  <p className="text-xs opacity-80">{msg.excelData.rows.length} filas -- {msg.excelData.headers.length} columnas</p>
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
                    <div className="max-w-none">
                      <ReactMarkdown components={markdownComponents}>{msg.content}</ReactMarkdown>
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
          <p className="text-xs text-muted-foreground mb-2">Preguntas rapidas:</p>
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
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
        <form
          onSubmit={(e) => { e.preventDefault(); enviarMensaje(input); }}
          className="flex gap-2"
        >
          <Button type="button" variant="ghost" size="icon" className="shrink-0" disabled={isStreaming} onClick={() => fileInputRef.current?.click()} title="Subir Excel">
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
