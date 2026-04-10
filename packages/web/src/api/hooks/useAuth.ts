import { useMutation } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth.store";

interface LoginResponse {
  token: string;
  user: { id: number; email: string; fullName: string; role: string };
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api.post<LoginResponse>("/auth/login", data),
    onSuccess: (res) => setAuth(res.token, res.user as any),
  });
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  return useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: clearAuth,
  });
}
