import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@honeybill/shared";

interface AuthState {
  token: string | null;
  user: Omit<User, "passwordHash"> | null;
  setAuth: (token: string, user: Omit<User, "passwordHash">) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    { name: "honeybill-auth" }
  )
);
