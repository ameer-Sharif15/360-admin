"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./globals.css";

const navLinks = [
  { name: "Dashboard", href: "/" },
  { name: "Users", href: "/users" },
  { name: "Staffs", href: "/staffs" },
  { name: "Attendance", href: "/attendance" },
  { name: "Orders", href: "/orders" },
  { name: "Minimart", href: "/minimart" },
  { name: "Services", href: "/services" },
  { name: "Rooms", href: "/rooms" },
  { name: "Activities", href: "/activities" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Inter, system-ui, -apple-system, sans-serif", background: "#F7F7F7", color: "#1E1E1E" }}>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          {/* Sidebar */}
          <aside style={{
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
          }}>
            <div style={{ padding: "24px", borderBottom: "1px solid #333" }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px" }}>360 Live Admin</h1>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#999", textTransform: "uppercase", letterSpacing: "1px" }}>Control Center</p>
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
                      borderLeft: isActive ? "4px solid #fff" : "4px solid transparent",
                    }}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>

            <div style={{ padding: "24px", borderTop: "1px solid #333", fontSize: 12, color: "#666" }}>
              v1.2.0 • Build 2026
            </div>
          </aside>

          {/* Main Content */}
          <main style={{ 
            flex: 1, 
            marginLeft: 260, 
            padding: "40px",
            minHeight: "100vh",
          }}>
            <header style={{ marginBottom: 32, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
                  {navLinks.find(l => l.href === pathname)?.name || "Management"}
                </h2>
                <p style={{ margin: "4px 0 0", color: "#666" }}>Overview and management for {navLinks.find(l => l.href === pathname)?.name.toLowerCase() || "the system"}</p>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {/* Could add user profile/logout here */}
              </div>
            </header>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

