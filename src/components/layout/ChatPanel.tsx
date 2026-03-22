import { useState, useRef, useEffect } from "react";
import { useAppStore } from "@/store/app.store";
import { useAuth } from "@/hooks/useAuth";
import { Send, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

const QUICK_QUESTIONS = [
  "¿Cómo estamos este mes?",
  "Top egresos",
  "Comparar empresas",
  "Flujo reciente",
];

export function ChatPanel() {
  const { empresaActiva } = useAppStore();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevEmpresa = useRef(empresaActiva);

  useEffect(() => {
    if (prevEmpresa.current !== empresaActiva) {
      setMessages([]);
      setConversacionId(null);
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
    const assistantMsg: ChatMessage = { role: "assistant", content: "", ts: Date.now() };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${(await (await import("@/integrations/supabase/client")).supabase.auth.getSession()).data.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          mensaje: texto,
          empresaFiltro: empresaActiva,
          conversacionId,
        }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;
          try {
            const data = JSON.parse(raw);
            if (data.text) {
              setMessages((prev) => {
                const msgs = [...prev];
                msgs[msgs.length - 1] = {
                  ...msgs[msgs.length - 1],
                  content: msgs[msgs.length - 1].content + data.text,
                };
                return msgs;
              });
            }
            if (data.conversacionId) setConversacionId(data.conversacionId);
          } catch {}
        }
      }
    } catch (err) {
      setMessages((prev) => {
        const msgs = [...prev];
        msgs[msgs.length - 1] = {
          ...msgs[msgs.length - 1],
          content: "Error al conectar con el asistente. Intenta de nuevo.",
        };
        return msgs;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <aside
      className="w-[var(--chat-width)] h-full flex flex-col border-l border-border"
      style={{ background: "hsl(var(--bg-surface))" }}
    >
      {/* Header */}
      <div className="h-[var(--topbar-height)] flex items-center px-4 gap-2 border-b border-border shrink-0">
        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <Bot className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">Jade AI</span>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground bg-card px-2 py-0.5 rounded">
          {empresaActiva}
        </span>
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
              Pregúntame sobre las finanzas de {empresaActiva === "TODAS" ? "el grupo" : empresaActiva}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[90%] rounded-xl px-3 py-2 text-sm",
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
      <div className="p-3 border-t border-border">
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
            placeholder="Pregunta algo..."
            disabled={isStreaming}
            className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button type="submit" size="icon" disabled={isStreaming || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </aside>
  );
}
