"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getClients } from "../lib/appwrite";
import { Query, Models } from "appwrite";

type Stats = {
  users: number;
  orders: number;
  rooms: number;
  services: number;
  revenue: number;
  minimartOrders: number;
  attendanceRecords: number;
};

export default function Home() {
  const [stats, setStats] = useState<Stats>({
    users: 0,
    orders: 0,
    rooms: 0,
    services: 0,
    revenue: 0,
    minimartOrders: 0,
    attendanceRecords: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clientBundle = useMemo(() => {
    try {
      return getClients();
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, []);

  const fetchStats = async () => {
    if (!clientBundle) return;
    setLoading(true);
    try {
      const { databases, databaseId, COLLECTIONS } = clientBundle;

      const [users, orders, rooms, services, attendance] = await Promise.all([
        databases.listDocuments(databaseId, COLLECTIONS.USERS, [Query.limit(1)]),
        databases.listDocuments(databaseId, COLLECTIONS.ORDERS, [Query.limit(1000)]),
        databases.listDocuments(databaseId, COLLECTIONS.ROOMS, [Query.limit(1)]),
        databases.listDocuments(databaseId, COLLECTIONS.SERVICES, [Query.limit(1)]),
        databases.listDocuments(databaseId, COLLECTIONS.STAFF_ATTENDANCE, [Query.limit(1)]),
      ]);

      let revenue = 0;
      let minimartCount = 0;
      orders.documents.forEach((order: any) => {
        if (order.totalAmount) revenue += order.totalAmount;
        if (order.orderType === "Mini Mart") minimartCount++;
      });

      setStats({
        users: users.total,
        orders: orders.total,
        rooms: rooms.total,
        services: services.total,
        revenue,
        minimartOrders: minimartCount,
        attendanceRecords: attendance.total,
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [clientBundle]);

  const downloadCSV = async (collectionKey: keyof typeof clientBundle.COLLECTIONS, filename: string) => {
    if (!clientBundle) return;
    try {
      const { databases, databaseId, COLLECTIONS } = clientBundle;
      const res = await databases.listDocuments(databaseId, COLLECTIONS[collectionKey], [Query.limit(1000)]);
      
      if (res.documents.length === 0) {
        alert("No data to export");
        return;
      }

      const headers = Object.keys(res.documents[0]).filter(k => !k.startsWith("$"));
      const csvRows = [
        headers.join(","),
        ...res.documents.map(doc => 
          headers.map(header => {
            const val = (doc as any)[header];
            return typeof val === "object" ? `"${JSON.stringify(val).replace(/"/g, '""')}"` : `"${val}"`;
          }).join(",")
        )
      ];

      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.setAttribute("hidden", "");
      a.setAttribute("href", url);
      a.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e: any) {
      alert("Export failed: " + e.message);
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Loading dashboard stats...</div>;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {error && <p style={{ color: "red", background: "#fee2e2", padding: 12, borderRadius: 8 }}>{error}</p>}
      
      {/* Stats Grid */}
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        <StatCard title="Total Revenue" value={`₦${stats.revenue.toLocaleString()}`} color="#10B981" />
        <StatCard title="Total Users" value={stats.users} color="#3B82F6" />
        <StatCard title="Total Orders" value={stats.orders} color="#F59E0B" />
        <StatCard title="Minimart Orders" value={stats.minimartOrders} color="#8B5CF6" />
        <StatCard title="Active Rooms" value={stats.rooms} color="#EF4444" />
        <StatCard title="Total Services" value={stats.services} color="#6366F1" />
      </div>

      {/* Export Section */}
      {/* <div style={{ background: "#fff", padding: 24, borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
        <h3 style={{ margin: "0 0 20px" }}>Data Export (CSV)</h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <ExportButton label="Export Services" onClick={() => downloadCSV("SERVICES", "hotel_services")} />
          <ExportButton label="Export Orders" onClick={() => downloadCSV("ORDERS", "all_orders")} />
          <ExportButton label="Export Attendance" onClick={() => downloadCSV("STAFF_ATTENDANCE", "staff_attendance")} />
          <ExportButton label="Export Users" onClick={() => downloadCSV("USERS", "user_registry")} />
          <ExportButton label="Export Rooms" onClick={() => downloadCSV("ROOMS", "room_inventory")} />
        </div>
      </div> */}
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: string | number; color: string }) {
  return (
    <div style={{ 
      background: "#fff", 
      padding: 24, 
      borderRadius: 16, 
      boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
      borderLeft: `6px solid ${color}`
    }}>
      <p style={{ margin: "0 0 8px", color: "#666", fontSize: 14, fontWeight: 500 }}>{title}</p>
      <h3 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "#1E1E1E" }}>{value}</h3>
    </div>
  );
}

function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      style={{
        padding: "10px 18px",
        borderRadius: 8,
        border: "1px solid #e5e5e5",
        background: "#fff",
        color: "#1E1E1E",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s",
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = "#f9fafb")}
      onMouseOut={(e) => (e.currentTarget.style.background = "#fff")}
    >
      {label}
    </button>
  );
}

