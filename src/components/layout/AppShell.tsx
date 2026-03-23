import { Outlet } from "react-router-dom";
import { Topbar } from "./Topbar";
import { AppSidebar } from "./Sidebar";
import { ChatPanel } from "./ChatPanel";
import { useAppStore } from "@/store/app.store";
import { cn } from "@/lib/utils";

export function AppShell() {
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed, chatOpen, setChatOpen } = useAppStore();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <div className="flex flex-1 overflow-hidden relative">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "hidden lg:flex h-full flex-col border-r border-border shrink-0 bg-[hsl(var(--bg-surface))] transition-all duration-200",
            sidebarCollapsed ? "w-[60px]" : "w-[var(--sidebar-width)]"
          )}
        >
          <AppSidebar collapsed={sidebarCollapsed} />
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <>
            <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
            <aside className="fixed inset-y-0 left-0 w-[260px] z-50 flex flex-col border-r border-border bg-[hsl(var(--bg-surface))] lg:hidden">
              <AppSidebar onClose={() => setSidebarOpen(false)} />
            </aside>
          </>
        )}

        {/* Main area: topbar + content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
            <Outlet />
          </main>
        </div>

        {/* Desktop chat panel */}
        <aside className="hidden xl:flex w-[var(--chat-width)] h-full flex-col border-l border-border shrink-0 bg-[hsl(var(--bg-surface))]">
          <ChatPanel />
        </aside>

        {/* Mobile chat overlay */}
        {chatOpen && (
          <>
            <div className="fixed inset-0 bg-black/60 z-40 xl:hidden" onClick={() => setChatOpen(false)} />
            <aside className="fixed inset-y-0 right-0 w-[340px] max-w-[90vw] z-50 flex flex-col border-l border-border bg-[hsl(var(--bg-surface))] xl:hidden">
              <ChatPanel onClose={() => setChatOpen(false)} />
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
