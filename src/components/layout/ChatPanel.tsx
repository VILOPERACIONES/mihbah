import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store/app.store";
import { useAuth } from "@/hooks/useAuth";
import { Send, Bot, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

const QUICK_QUESTIONS = [
  "¿Cómo estamos este mes?",
  "Top egresos y alertas",
  "Comparar ingresos vs salidas",
  "¿Cuáles son las alertas principales?",
  "Resumen ejecutivo del periodo",
];

export function ChatPanel({ onClose }: { onClose?: () => void }) {
  const { empresaActiva } = useAppStore();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevEmpresa = useRef(empresaActiva);

  useEffect(() => {
    if (prevEmpresa.current !== empresaActiva) {
      setMessages([]);
      prevEmpresa.current = empresaActiva;
    }
  }, [empresaActiva]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function enviarMensaje(texto: string) {
    if (!texto.trim() || isStreaming) return;
    setInput("");
    setIsStreaming(true);

    const userMsg: ChatMessage = { role: "user", content: texto, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);

    // Build history from existing messages (exclude the new one)
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
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

      // Flush remaining buffer
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

      // If no content was received, show fallback
      if (!assistantSoFar) {
        upsertAssistant("No pude generar una respuesta. Intenta de nuevo.");
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Error al conectar con el asistente.";
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
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
            <p className="text-xs text-primary/60 mt-2">
              📊 KPIs • 📈 Flujo de caja • ⚠️ Alertas • 💰 Movimientos
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[90%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
              msg.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "mr-auto bg-card text-foreground border border-border"
            )}
          >
            {msg.content || (
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

      {/* Input */}
      <div className="p-3 border-t border-border shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviarMensaje(input);
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta sobre finanzas..."
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
