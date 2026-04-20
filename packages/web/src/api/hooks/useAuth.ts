import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth.store";

interface LoginResponse {
  token: string;
  user: { id: number; email: string; fullName: string; role: string };
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api.post<LoginResponse>("/auth/login", data),
    onSuccess: (res) => {
      // Vor dem Setzen des neuen Users: Cache komplett leeren, sonst haelt
      // TanStack Query Daten (inkl. /me + Rechte) vom vorherigen User.
      qc.clear();
      setAuth(res.token, res.user as any);
    },
  });
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      clearAuth();
      qc.clear();
    },
  });
}
