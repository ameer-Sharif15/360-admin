"use client";

import React from "react";
import "./globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Inter, system-ui, -apple-system, sans-serif", background: "#F7F7F7" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
          <header style={{ marginBottom: 24 }}>
            <h1 style={{ margin: 0, color: "#1E1E1E" }}>360 Live Admin</h1>
            <p style={{ margin: 0, color: "#555" }}>Manage services, rooms, and content</p>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}

