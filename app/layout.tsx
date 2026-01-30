"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "../lib/auth-context";
import "./globals.css";

const navLinks = [
  { name: "Dashboard", href: "/" },
  { name: "Users", href: "/users" },
  { name: "Staffs", href: "/staffs" },
  { name: "Sellers", href: "/sellers" },
  { name: "Attendance", href: "/attendance" },
  { name: "Orders", href: "/orders" },
  { name: "Minimart", href: "/minimart" },
  { name: "Services", href: "/services" },
  { name: "Rooms", href: "/rooms" },
  { name: "Activities", href: "/activities" },
];

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user && pathname !== "/login") {
      router.push("/login");
    }
  }, [user, loading, pathname, router]);

  // Show login page without layout
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Show loading state
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              border: "4px solid #f3f3f3",
              borderTop: "4px solid #FF7F50",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          <p style={{ color: "#666" }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!user) {
    return null;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 260,
          background: "#1E1E1E",
          color: "#fff",
          display: "flex",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 100,
        }}
      >
        <div style={{ padding: "24px", borderBottom: "1px solid #333" }}>
          <h1
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "-0.5px",
            }}
          >
            360 Live Admin
          </h1>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: "#999",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Control Center
          </p>
        </div>

        <nav style={{ flex: 1, padding: "16px 0", overflowY: "auto" }}>
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: "block",
                  padding: "12px 24px",
                  textDecoration: "none",
                  color: isActive ? "#fff" : "#999",
                  background: isActive ? "#ff7f50" : "transparent",
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  transition: "all 0.2s ease",
                  borderLeft: isActive
                    ? "4px solid #fff"
                    : "4px solid transparent",
                }}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>

        <div
          style={{
            padding: "24px",
            borderTop: "1px solid #333",
            fontSize: 12,
            color: "#666",
          }}
        >
          v1.2.0 • Build 2026
        </div>
      </aside>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          marginLeft: 260,
          padding: "40px",
          minHeight: "100vh",
        }}
      >
        <header
          style={{
            marginBottom: 32,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
              {navLinks.find((l) => l.href === pathname)?.name || "Management"}
            </h2>
            <p style={{ margin: "4px 0 0", color: "#666" }}>
              Overview and management for{" "}
              {navLinks.find((l) => l.href === pathname)?.name.toLowerCase() ||
                "the system"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 14, color: "#666" }}>{user.email}</span>
            <button
              onClick={logout}
              style={{
                padding: "10px 20px",
                background: "#DC2626",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) =>
                (e.currentTarget.style.background = "#B91C1C")
              }
              onMouseOut={(e) => (e.currentTarget.style.background = "#DC2626")}
            >
              Logout
            </button>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          background: "#F7F7F7",
          color: "#1E1E1E",
        }}
      >
        <AuthProvider>
          <ProtectedLayout>{children}</ProtectedLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
