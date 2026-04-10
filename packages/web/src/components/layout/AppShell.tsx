import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { useAuthStore } from "@/stores/auth.store";
import { Navigate } from "@tanstack/react-router";

export function AppShell() {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" />;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
