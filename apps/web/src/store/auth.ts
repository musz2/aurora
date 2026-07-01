import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthUser } from "@aurora/shared";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** True once the initial session check (/auth/me) has completed. Not persisted. */
  bootstrapped: boolean;
  setAuth: (data: { user: AuthUser; accessToken: string; refreshToken: string }) => void;
  setUser: (user: AuthUser) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setBootstrapped: (v: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      bootstrapped: false,
      setAuth: ({ user, accessToken, refreshToken }) =>
        set({ user, accessToken, refreshToken, bootstrapped: true }),
      setUser: (user) => set({ user }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setBootstrapped: (v) => set({ bootstrapped: v }),
      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, bootstrapped: true }),
    }),
    {
      name: "aurora-auth",
      // Persist only credentials — the session check must re-run each load.
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
      }),
    }
  )
);
