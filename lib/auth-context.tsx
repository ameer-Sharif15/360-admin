"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getClients } from "./appwrite";
import { Models } from "appwrite";

type AuthContextType = {
  user: Models.User<Models.Preferences> | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { account } = getClients();
      const currentUser = await account.get();
      setUser(currentUser);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      // Only allow specific admin emails
      const allowedEmails = [
        "modibboakheem@gmail.com",
        "hafeezabubakar15@gmail.com",
      ];
      if (!allowedEmails.includes(email)) {
        throw new Error("Unauthorized: Only admin can access this dashboard");
      }

      const { account } = getClients();

      // Check if session exists and delete it
      try {
        await account.deleteSession("current");
      } catch (error) {
        // No session to delete or error deleting, ignore
      }

      // Create email session (correct method name)
      await account.createEmailSession(email, password);

      // Get user details
      const currentUser = await account.get();

      // Double-check email matches
      if (!allowedEmails.includes(currentUser.email)) {
        await account.deleteSession("current");
        throw new Error("Unauthorized: Only admin can access this dashboard");
      }

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
