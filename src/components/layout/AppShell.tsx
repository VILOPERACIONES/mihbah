import { Outlet } from "react-router-dom";
import { Topbar } from "./Topbar";
import { AppSidebar } from "./Sidebar";
import { ChatPanel } from "./ChatPanel";
import { useAppStore } from "@/store/app.store";

export function AppShell() {
  const { sidebarOpen, setSidebarOpen, chatOpen, setChatOpen } = useAppStore();

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <Topbar />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar — desktop: fixed, mobile: overlay */}
        <aside className="hidden lg:flex w-[var(--sidebar-width)] h-full flex-col border-r border-border shrink-0 bg-[hsl(var(--bg-surface))]">
          <AppSidebar onClose={() => setSidebarOpen(false)} />
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

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-background">
          <Outlet />
        </main>

        {/* Chat panel — desktop: fixed, mobile: overlay */}
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
