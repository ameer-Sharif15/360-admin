"use client";

import { Query, type Models } from "appwrite";
import { useEffect, useMemo, useState } from "react";
import { getClients } from "../../lib/appwrite";

type Order = {
  $id: string;
  userId: string;
  branchId: string;
  orderType: string;
  items: any[];
  checkInDate: string;
  numberOfDays: number;
  totalAmount: number;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  createdAt: string;
};

const COLLECTION = "orders";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const clientBundle = useMemo(() => {
    try {
      return getClients();
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, []);

  const fetchOrders = async () => {
    if (!clientBundle) return;
    setLoading(true);
    setError(null);
    try {
      const queries: string[] = [];
      if (statusFilter !== "all") {
        queries.push(Query.equal("status", statusFilter));
      }
      queries.push(Query.orderDesc("$createdAt"));
      const res = await clientBundle.databases.listDocuments<
        Order & Models.Document
      >(clientBundle.databaseId, COLLECTION, queries);
      setOrders(res.documents);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const handleStatusUpdate = async (
    orderId: string,
    newStatus: Order["status"],
  ) => {
    if (!clientBundle) return;
    setLoading(true);
    setError(null);
    try {
      await clientBundle.databases.updateDocument(
        clientBundle.databaseId,
        COLLECTION,
        orderId,
        {
          status: newStatus,
        },
      );
      await fetchOrders();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#FF7F50";
      case "confirmed":
        return "#10B981";
      case "in_progress":
        return "#3B82F6";
      case "completed":
        return "#10B981";
      case "cancelled":
        return "#EF4444";
      default:
        return "#6B7280";
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          background: "#fff",
          padding: 16,
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Orders Management</h2>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <div style={{ marginBottom: 16 }}>
          <label style={{ marginRight: 8 }}>Filter by Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={inputStyle}
          >
            <option value="all">All Orders</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          padding: 16,
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Orders ({orders.length})</h3>
        {loading && <p>Loading...</p>}
        {!loading && orders.length === 0 && <p>No orders found.</p>}
        <div style={{ display: "grid", gap: 12 }}>
          {orders.map((order) => (
            <div
              key={order.$id}
              style={{
                padding: 16,
                borderRadius: 10,
                border: "1px solid #eee",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <div>
                  <strong>Order #{order.$id.slice(0, 8)}</strong>
                  <div style={{ color: "#666", fontSize: 13, marginTop: 4 }}>
                    Type: {order.orderType} • Days: {order.numberOfDays} •
                    Amount: ₦{order.totalAmount}
                  </div>
                  <div style={{ color: "#999", fontSize: 12, marginTop: 4 }}>
                    Check-in: {new Date(order.checkInDate).toLocaleDateString()}
                  </div>
                  <div style={{ color: "#999", fontSize: 12 }}>
                    Created: {new Date(order.createdAt || "").toLocaleString()}
                  </div>
                </div>
                <div>
                  <span
                    style={{
                      background: getStatusColor(order.status) + "20",
                      color: getStatusColor(order.status),
                      padding: "4px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {order.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {order.status === "pending" && (
                  <>
                    <button
                      onClick={() => handleStatusUpdate(order.$id, "confirmed")}
                      disabled={loading}
                      style={{ ...buttonStyle, background: "#10B981" }}
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(order.$id, "cancelled")}
                      disabled={loading}
                      style={{ ...buttonStyle, background: "#EF4444" }}
                    >
                      Cancel
                    </button>
                  </>
                )}
                {order.status === "confirmed" && (
                  <button
                    onClick={() => handleStatusUpdate(order.$id, "in_progress")}
                    disabled={loading}
                    style={{ ...buttonStyle, background: "#3B82F6" }}
                  >
                    Mark In Progress
                  </button>
                )}
                {order.status === "in_progress" && (
                  <button
                    onClick={() => handleStatusUpdate(order.$id, "completed")}
                    disabled={loading}
                    style={{ ...buttonStyle, background: "#10B981" }}
                  >
                    Mark Completed
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (!confirm(`Are you sure you want to delete this order?`))
                      return;
                    setLoading(true);
                    try {
                      await clientBundle.databases.deleteDocument(
                        clientBundle.databaseId,
                        COLLECTION,
                        order.$id,
                      );
                      await fetchOrders();
                    } catch (e: any) {
                      setError(e.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  style={{
                    ...buttonStyle,
                    background: "#fee2e2",
                    color: "#EF4444",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "12px",
  borderRadius: 8,
  border: "1px solid #e5e5e5",
  fontSize: 14,
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 14,
};
