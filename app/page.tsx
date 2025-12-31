"use client";

import Link from "next/link";
import React from "react";

const cards = [
  { title: "Users", href: "/users", desc: "Manage users, roles, and support types" },
  { title: "Orders", href: "/orders", desc: "View and manage all orders" },
  { title: "Services", href: "/services", desc: "Create, update, delete hotel services" },
  { title: "Rooms", href: "/rooms", desc: "Manage rooms and pricing" },
  { title: "Gallery", href: "/gallery", desc: "Upload and organize images" },
  { title: "Menu Items", href: "/menu", desc: "Manage food & beverage items" },
  { title: "Activities & Events", href: "/activities", desc: "Activities, events, schedules" },
];

export default function Home() {
  return (
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
      {cards.map((card) => (
        <Link key={card.href} href={card.href} style={{ textDecoration: "none" }}>
          <div
            style={{
              background: "#fff",
              padding: 16,
              borderRadius: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              height: "100%",
            }}
          >
            <h3 style={{ margin: "0 0 8px", color: "#1E1E1E" }}>{card.title}</h3>
            <p style={{ margin: 0, color: "#555", fontSize: 14 }}>{card.desc}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

