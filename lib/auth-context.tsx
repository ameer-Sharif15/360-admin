"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClients } from "./appwrite";

export interface AdminUser {
  $id?: string;
  _id?: string;
  email: string;
  name?: string;
  displayName?: string;
  role?: string;
}

type AuthContextType = {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      if (typeof window !== "undefined" && !localStorage.getItem("admin_jwt")) {
        setUser(null);
        setLoading(false);
        return;
      }
      const { account } = getClients();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Auth verification timeout")), 6000)
      );
      const currentUser = await Promise.race([account.get(), timeoutPromise]);
      setUser(currentUser as AdminUser);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const allowedEmails = [
        "modibboakheem@gmail.com",
        "hafeezabubakar15@gmail.com",
        "director@360.com",
        "admin@360.com",
        "admin@gmail.com",
        "services@gmail.com",
        "reception@gmail.com",
        "kitchen@gmail.com",
      ];
      if (!allowedEmails.includes(email.toLowerCase())) {
        throw new Error("Unauthorized: Only admin and management can access this dashboard");
      }

      const { account } = getClients();

      // Clear any previous token
      await account.deleteSession("current");

      // Login via Express backend
      await account.createEmailSession(email, password);

      // Verify user
      const currentUser = await account.get();
      setUser(currentUser);

      router.push("/");
    } catch (error: any) {
      throw new Error(error.message || "Login failed");
    }
  };

  const logout = async () => {
    try {
      const { account } = getClients();
      await account.deleteSession("current");
      setUser(null);
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
