import { Outlet } from "react-router-dom";
import { Topbar } from "./Topbar";
import { AppSidebar } from "./Sidebar";
import { ChatPanel } from "./ChatPanel";

export function AppShell() {
  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <Topbar />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto p-6" style={{ background: "hsl(var(--bg-base))" }}>
          <Outlet />
        </main>
        <ChatPanel />
      </div>
    </div>
  );
}
