"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { apiFetch } from "./api";

interface User {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  display_name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  sendVerificationCode: (email: string, password: string, displayName: string, country: string) => Promise<void>;
  verifyAndRegister: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiFetch<User>("/auth/me");
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    await refreshUser();
  };

  const sendVerificationCode = async (email: string, password: string, displayName: string, country: string) => {
    await apiFetch("/auth/register/send-code", {
      method: "POST",
      body: JSON.stringify({ email, password, display_name: displayName, country }),
    });
  };

  const verifyAndRegister = async (email: string, code: string) => {
    await apiFetch("/auth/register/verify", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
    await refreshUser();
  };

  const logout = async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, sendVerificationCode, verifyAndRegister, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
