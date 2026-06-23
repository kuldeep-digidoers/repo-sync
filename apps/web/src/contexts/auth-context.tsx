import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UserProfile } from "@repo-sync/shared";
import { api } from "../lib/api-client";

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isInitialized, setIsInitialized] = useState(false);

  const {
    data: user,
    isLoading: isQueryLoading,
    error,
  } = useQuery<UserProfile>({
    queryKey: ["auth", "me"],
    queryFn: () => api.getMe(),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  useEffect(() => {
    if (!isQueryLoading) {
      setIsInitialized(true);
    }
  }, [isQueryLoading]);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await api.login({ email, password });
      queryClient.setQueryData(["auth", "me"], response.user);
    },
    [queryClient]
  );

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      const response = await api.signup({ name, email, password });
      queryClient.setQueryData(["auth", "me"], response.user);
    },
    [queryClient]
  );

  const logout = useCallback(async () => {
    await api.logout();
    queryClient.setQueryData(["auth", "me"], null);
    queryClient.clear();
  }, [queryClient]);

  const value: AuthContextValue = {
    user: error ? null : user ?? null,
    isLoading: !isInitialized,
    isAuthenticated: !!user && !error,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
