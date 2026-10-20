"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getClients, Query, type Models } from "../../lib/appwrite";
import { API_BASE_URL } from "../../lib/api";
import LoaderButton from "../../components/LoaderButton";
import {
  RefreshCw,
  Search,
  Package,
  User,
  Mail,
  Phone,
  Hash,
  MapPin,
  Building2,
  BedDouble,
  Check,
  X,
  Play,
  Trash2,
  FileText,
  ShoppingCart,
  MessageSquare,
  AlertCircle,
  Zap,
  Calendar,
  Clock,
  Eye,
  UtensilsCrossed,
  Store,
  Compass,
  CheckCircle2,
  XCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type OrderItem = {
  name?: string;
  title?: string;
  itemName?: string;
  quantity?: number;
  qty?: number;
  price?: number;
  unitPrice?: number;
  category?: string;
  description?: string;
  notes?: string;
  instructions?: string;
  specialInstructions?: string;
  options?: any;
  [key: string]: any;
};

type Order = {
  $id: string;
  _id?: string;
  $createdAt?: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  user?: any;
  branchId?: string;
  branchName?: string;
  branch?: any;
  orderType: string;
  items: any[];
  checkInDate?: string;
  checkOutDate?: string;
  numberOfDays?: number;
  totalAmount: number;
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
  createdAt?: string;
  notes?: string;
  roomNumber?: string;
  location?: string;
  chatSummary?: string;
  deliveryAddress?: string;
  orderDetails?: any;
};

type ChatMessage = {
  _id: string;
  content: string;
  sender?: { name?: string; role?: string; displayName?: string };
  createdAt?: string;
};

const COLLECTION = "orders";

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  pending:     { color: "#D97706", bg: "#FEF3C7", label: "Pending", icon: <Clock size={12} /> },
  confirmed:   { color: "#059669", bg: "#D1FAE5", label: "Confirmed", icon: <CheckCircle2 size={12} /> },
  in_progress: { color: "#2563EB", bg: "#DBEAFE", label: "In Progress", icon: <Play size={12} /> },
  completed:   { color: "#059669", bg: "#D1FAE5", label: "Completed", icon: <CheckCircle2 size={12} /> },
  cancelled:   { color: "#DC2626", bg: "#FEE2E2", label: "Cancelled", icon: <XCircle size={12} /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { color: "#6B7280", bg: "#F3F4F6", label: status, icon: <AlertCircle size={12} /> };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      padding: "4px 10px", borderRadius: 999,
      fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
      display: "inline-flex", alignItems: "center", gap: 5,
    }}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function getServiceTypeBadge(orderType?: string) {
  const t = (orderType || "general").toLowerCase();
  if (t.includes("kitchen") || t.includes("food") || t.includes("restaurant") || t.includes("dining") || t.includes("dish") || t.includes("meal")) {
    return { label: "Kitchen / Food", icon: <UtensilsCrossed size={13} />, bg: "#FEF3C7", color: "#B45309" };
  }
  if (t.includes("room") || t.includes("stay") || t.includes("hotel") || t.includes("booking") || t.includes("lodge")) {
    return { label: "Room Booking", icon: <BedDouble size={13} />, bg: "#EFF6FF", color: "#1D4ED8" };
  }
  if (t.includes("mart") || t.includes("minimart") || t.includes("store") || t.includes("shop") || t.includes("grocer")) {
    return { label: "Minimart Store", icon: <Store size={13} />, bg: "#ECFDF5", color: "#047857" };
  }
  if (t.includes("activity") || t.includes("tour") || t.includes("sport") || t.includes("event") || t.includes("experience")) {
    return { label: "Activity / Tour", icon: <Compass size={13} />, bg: "#FAF5FF", color: "#6B21A8" };
  }
  return { label: orderType || "General Order", icon: <Package size={13} />, bg: "#F3F4F6", color: "#374151" };
}

function getCustomerInfo(order: Order) {
  const u = typeof order.user === "object" && order.user !== null ? order.user : null;
  const od = order.orderDetails || {};

  const name =
    order.userName ||
    u?.displayName ||
    u?.name ||
    u?.username ||
    od.customerName ||
    od.name ||
    od.guestName ||
    od.fullName ||
    "Guest Customer";

  const email =
    order.userEmail ||
    u?.email ||
    od.customerEmail ||
    od.email ||
    od.guestEmail ||
    "No email provided";

  const phone =
    order.userPhone ||
    u?.phone ||
    od.customerPhone ||
    od.phone ||
    od.phoneNumber ||
    od.guestPhone ||
    "No phone provided";

  const userId =
    order.userId ||
    u?._id ||
    u?.id ||
    (typeof order.user === "string" ? order.user : null);

  return { name, email, phone, userId };
}

function getOrderServiceInfo(order: Order) {
  const od = order.orderDetails || {};
  const orderType = order.orderType || od.orderType || od.category || "General Order";
  const roomNumber = order.roomNumber || od.roomNumber || od.room || od.roomName;
  const location = order.location || od.location || od.table || od.tableNumber || od.diningArea || od.deliverySpot;
  const branchName = order.branchName || (typeof order.branch === "object" ? order.branch?.name : null) || od.branchName;
  const checkInDate = order.checkInDate || od.checkInDate || od.checkIn;
  const checkOutDate = order.checkOutDate || od.checkOutDate || od.checkOut;
  const numberOfDays = order.numberOfDays || od.numberOfDays || od.days || od.nights;
  const deliveryAddress = order.deliveryAddress || od.deliveryAddress || od.address;
  const notes = order.notes || od.notes || od.specialInstructions || od.instruction;

  const t = orderType.toLowerCase();
  const isKitchen = t.includes("kitchen") || t.includes("food") || t.includes("restaurant") || t.includes("dining") || t.includes("meal") || t.includes("dish");
  const isRoom = t.includes("room") || t.includes("stay") || t.includes("hotel") || t.includes("booking") || t.includes("lodge") || !!roomNumber;
  const isMart = t.includes("mart") || t.includes("minimart") || t.includes("store") || t.includes("shop");
  const isActivity = t.includes("activity") || t.includes("tour") || t.includes("sport") || t.includes("gym") || t.includes("event");

  return {
    orderType,
    roomNumber,
    location,
    branchName,
    checkInDate,
    checkOutDate,
    numberOfDays,
    deliveryAddress,
    notes,
    isKitchen,
    isRoom,
    isMart,
    isActivity,
  };
}

function normalizeOrderItem(it: any, index: number): OrderItem {
  if (typeof it === "string") {
    return { name: it, quantity: 1, price: 0 };
  }
  const name = it.name || it.title || it.itemName || it.label || it.foodName || `Item #${index + 1}`;
  const quantity = Number(it.quantity ?? it.qty ?? it.count ?? 1);
  const price = Number(it.price ?? it.unitPrice ?? it.amount ?? it.cost ?? 0);
  const category = it.category || it.type || it.section || undefined;
  const description = it.description || it.instructions || it.notes || it.specialInstructions || it.customization || undefined;

  return {
    ...it,
    name,
    quantity: isNaN(quantity) || quantity <= 0 ? 1 : quantity,
    price: isNaN(price) ? 0 : price,
    category,
    description,
  };
}

function parseOrderItems(order: Order): OrderItem[] {
  if (!order) return [];

  const candidates = [
    order.items,
    order.orderDetails?.items,
    order.orderDetails?.cart,
    order.orderDetails?.menuItems,
    order.orderDetails?.foodItems,
    (order as any).cart,
  ];

  for (const raw of candidates) {
    if (!raw) continue;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map((it, idx) => normalizeOrderItem(it, idx));
    }
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((it, idx) => normalizeOrderItem(it, idx));
        } else if (parsed && typeof parsed === "object") {
          return [normalizeOrderItem(parsed, 0)];
        }
      } catch {
        if (raw.trim().length > 0) {
          return [{ name: raw.trim(), quantity: 1, price: order.totalAmount || 0 }];
        }
      }
    }
    if (typeof raw === "object" && Object.keys(raw).length > 0) {
      return [normalizeOrderItem(raw, 0)];
    }
  }

  // Fallback for Room Booking if no explicit items array exists
  const svc = getOrderServiceInfo(order);
  if (svc.isRoom) {
    const roomTitle = svc.roomNumber ? `Room ${svc.roomNumber}` : (order.orderDetails?.roomName || "Room Reservation");
    const days = svc.numberOfDays || 1;
    return [{
      name: roomTitle,
      category: "Room Booking",
      quantity: days,
      price: days > 0 ? Math.round((order.totalAmount || 0) / days) : (order.totalAmount || 0),
      description: svc.checkInDate ? `Check-in: ${new Date(svc.checkInDate).toLocaleDateString()}` : undefined,
    }];
  }

  // Fallback for Service or Activity
  if (order.orderType && order.totalAmount) {
    return [{
      name: order.orderType,
      category: "Service / Booking",
      quantity: 1,
      price: order.totalAmount,
    }];
  }

  return [];
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OrdersPage() {
  const [orders, setOrders]               = useState<Order[]>([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [statusFilter, setStatusFilter]   = useState("all");
  const [typeFilter, setTypeFilter]       = useState("all");
  const [searchQuery, setSearchQuery]     = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [chatMessages, setChatMessages]   = useState<ChatMessage[]>([]);
  const [loadingChat, setLoadingChat]     = useState(false);
  const [updatingId, setUpdatingId]       = useState<string | null>(null);
  const [deletingId, setDeletingId]       = useState<string | null>(null);

  const clientBundle = useMemo(() => {
    try { return getClients(); }
    catch (e: any) { setError(e.message); return null; }
  }, []);

  const fetchOrders = async () => {
    if (!clientBundle) return;
    setLoading(true); setError(null);
    try {
      const queries: any[] = [Query.orderDesc("$createdAt")];
      if (statusFilter !== "all") queries.push(Query.equal("status", statusFilter));
      const res = await clientBundle.databases.listDocuments<Order & Models.Document>(
        clientBundle.databaseId, COLLECTION, queries
      );
      setOrders(res.documents);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchOrders(); }, [statusFilter, clientBundle]);

  // Fetch chat summary for selected order
  const fetchOrderChat = async (order: Order) => {
    const cust = getCustomerInfo(order);
    if (!cust.userId && !order.userId) return;
    setLoadingChat(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/chats/order/${order.$id}/messages`, {
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        setChatMessages(Array.isArray(data) ? data.slice(0, 25) : data.messages?.slice(0, 25) || []);
      } else {
        setChatMessages([]);
      }
    } catch { setChatMessages([]); }
    finally { setLoadingChat(false); }
  };

  const openOrderDetail = async (order: Order) => {
    setSelectedOrder(order);
    setChatMessages([]);
    fetchOrderChat(order);

    // Fresh live database fetch from MongoDB for this specific order
    if (clientBundle) {
      setLoadingDetails(true);
      try {
        const fresh = await clientBundle.databases.getDocument<Order & Models.Document>(
          clientBundle.databaseId,
          COLLECTION,
          order.$id
        );
        if (fresh) {
          setSelectedOrder(fresh);
        }
      } catch (err) {
        console.warn("Could not refetch single order details:", err);
      } finally {
        setLoadingDetails(false);
      }
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: Order["status"]) => {
    if (!clientBundle) return;
    setUpdatingId(orderId);
    try {
      await clientBundle.databases.updateDocument(
        clientBundle.databaseId, COLLECTION, orderId, { status: newStatus }
      );
      await fetchOrders();
      if (selectedOrder?.$id === orderId) {
        setSelectedOrder((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (e: any) { setError(e.message); }
    finally { setUpdatingId(null); }
  };

  const handleDelete = async (orderId: string) => {
    if (!confirm("Delete this order permanently from the database?")) return;
    if (!clientBundle) return;
    setDeletingId(orderId);
    try {
      await clientBundle.databases.deleteDocument(clientBundle.databaseId, COLLECTION, orderId);
      if (selectedOrder?.$id === orderId) setSelectedOrder(null);
      await fetchOrders();
    } catch (e: any) { setError(e.message); }
    finally { setDeletingId(null); }
  };

  // Search + type filter (client-side)
  const q = searchQuery.toLowerCase().trim();
  const orderTypes = [...new Set(orders.map((o) => o.orderType).filter(Boolean))];
  const filteredOrders = orders.filter((o) => {
    const matchType = typeFilter === "all" || o.orderType === typeFilter;
    if (!q) return matchType;
    const cust = getCustomerInfo(o);
    const haystack = [
      o.$id, cust.name, cust.email, cust.phone, o.orderType,
      o.roomNumber, o.location, o.branchName, o.deliveryAddress,
      o.status, o.totalAmount?.toString(),
    ].join(" ").toLowerCase();
    return matchType && haystack.includes(q);
  });

  const totalRevenue = orders.filter((o) => o.status === "completed").reduce((a, o) => a + (o.totalAmount || 0), 0);



  return (
    <>
      <style>{`
        @keyframes ordSpin { to { transform: rotate(360deg); } }
        @keyframes ordSlide { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        .ord-card { animation: ordSlide 0.25s ease; }
        .ord-detail-panel { animation: ordSlide 0.2s ease; }

        .orders-layout {
          display: grid;
          gap: 20px;
        }
        .orders-list-grid {
          display: grid;
          gap: 14px;
        }
        @media (min-width: 1024px) {
          .orders-layout {
            grid-template-columns: 1fr 440px;
            align-items: start;
          }
        }
        @media (max-width: 640px) {
          .ord-header-row { flex-direction: column !important; align-items: stretch !important; }
          .ord-filters { flex-direction: column !important; gap: 8px !important; }
          .ord-stat-row { grid-template-columns: 1fr 1fr !important; }
          .ord-detail-info-grid { grid-template-columns: 1fr !important; }
          .ord-item-row { flex-direction: column !important; align-items: flex-start !important; gap: 6px !important; }
          .ord-action-row { flex-wrap: wrap !important; }
        }
      `}</style>

      <div style={{ display: "grid", gap: 20, maxWidth: 1440, margin: "0 auto" }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="ord-header-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800, color: "#111827" }}>Orders Management</h2>
            <p style={{ margin: 0, color: "#6B7280", fontSize: 14 }}>
              {filteredOrders.length} of {orders.length} orders · ₦{totalRevenue.toLocaleString()} revenue (completed)
            </p>
          </div>
          <button
            onClick={fetchOrders}
            disabled={loading}
            style={{ ...btnStyle, background: "#F3F4F6", color: "#374151", display: "flex", alignItems: "center", gap: 8 }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} style={{ animation: loading ? "ordSpin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>

        {/* ── Stats Row ──────────────────────────────────────────────────── */}
        <div className="ord-stat-row" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
          {(["all","pending","confirmed","in_progress","completed"] as const).map((s) => {
            const count = s === "all" ? orders.length : orders.filter((o) => o.status === s).length;
            const cfg = s === "all" ? { color: "#374151", bg: "#F9FAFB" } : STATUS_CONFIG[s];
            return (
              <div key={s} onClick={() => setStatusFilter(s)} style={{
                padding: "14px 12px", borderRadius: 12, cursor: "pointer",
                background: statusFilter === s ? (s === "all" ? "#111827" : cfg.bg) : "#fff",
                border: `2px solid ${statusFilter === s ? (s === "all" ? "#111827" : cfg.color) : "#E5E7EB"}`,
                transition: "all 0.2s",
                boxShadow: statusFilter === s ? "0 4px 12px rgba(0,0,0,0.1)" : "none",
              }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: statusFilter === s ? (s === "all" ? "#fff" : cfg.color) : "#111" }}>{count}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: statusFilter === s ? (s === "all" ? "rgba(255,255,255,0.85)" : cfg.color) : "#6B7280", textTransform: "capitalize", marginTop: 2 }}>
                  {s.replace("_", " ")}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Alert ──────────────────────────────────────────────────────── */}
        {error && (
          <div style={{ color: "#991B1B", background: "#FEF2F2", border: "1px solid #FECACA", padding: "12px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={18} color="#DC2626" />
            {error}
          </div>
        )}

        {/* ── Search & Filter Bar ─────────────────────────────────────────── */}
        <div style={{ background: "#fff", padding: "16px 20px", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 240, position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", display: "flex", alignItems: "center" }}>
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search by Order ID, customer name, phone, email, room, type…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ ...inputStyle, paddingLeft: 38, width: "100%", boxSizing: "border-box" }}
            />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ ...inputStyle, minWidth: 140 }}>
            <option value="all">All Service Types</option>
            {orderTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {(searchQuery || typeFilter !== "all" || statusFilter !== "all") && (
            <button onClick={() => { setSearchQuery(""); setTypeFilter("all"); setStatusFilter("all"); }}
              style={{ ...btnStyle, background: "#F3F4F6", color: "#374151", padding: "10px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <X size={14} /> Clear
            </button>
          )}
          <span style={{ fontSize: 13, color: "#888", whiteSpace: "nowrap" }}>{filteredOrders.length} result{filteredOrders.length !== 1 ? "s" : ""}</span>
        </div>

        {/* ── Main layout: list + detail panel ────────────────────────────── */}
        <div className="orders-layout">

          {/* Orders List */}
          <div>
            {loading && orders.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <RefreshCw size={32} color="#ff7f50" style={{ animation: "ordSpin 1s linear infinite" }} />
                <div style={{ color: "#888", fontSize: 15 }}>Loading orders from database…</div>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "#9CA3AF", background: "#fff", borderRadius: 16 }}>
                <Package size={48} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                <div style={{ fontWeight: 600 }}>No orders match your search criteria</div>
              </div>
            ) : (
              <div className="orders-list-grid">
                {filteredOrders.map((order) => {
                  const isSelected = selectedOrder?.$id === order.$id;
                  const cust = getCustomerInfo(order);
                  const svc = getServiceTypeBadge(order.orderType);
                  const orderItems = parseOrderItems(order);

                  return (
                    <div
                      key={order.$id}
                      className="ord-card"
                      onClick={() => openOrderDetail(order)}
                      style={{
                        background: "#fff",
                        borderRadius: 14,
                        border: `2px solid ${isSelected ? "#ff7f50" : "#F3F4F6"}`,
                        padding: "16px 18px",
                        cursor: "pointer",
                        boxShadow: isSelected ? "0 4px 20px rgba(255,127,80,0.18)" : "0 2px 8px rgba(0,0,0,0.04)",
                        transition: "all 0.2s",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
                            <span style={{ fontWeight: 800, fontSize: 14, color: "#111827" }}>#{order.$id.slice(-8).toUpperCase()}</span>
                            <StatusBadge status={order.status} />
                            <span style={{
                              fontSize: 11, background: svc.bg, color: svc.color,
                              padding: "2px 8px", borderRadius: 999, fontWeight: 700,
                              display: "inline-flex", alignItems: "center", gap: 4,
                            }}>
                              {svc.icon}
                              {svc.label}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#1F2937", marginBottom: 3 }}>
                            <User size={14} color="#6B7280" />
                            <span>{cust.name}</span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#6B7280" }}>
                            {cust.phone && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Phone size={12} color="#9CA3AF" /> {cust.phone}
                              </span>
                            )}
                            {cust.email && (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Mail size={12} color="#9CA3AF" /> {cust.email}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 17, fontWeight: 900, color: "#1A365D" }}>₦{(order.totalAmount || 0).toLocaleString()}</div>
                          <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
                            {order.createdAt || order.$createdAt
                              ? new Date(order.createdAt || order.$createdAt || "").toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })
                              : "—"}
                          </div>
                        </div>
                      </div>

                      {/* Location / Room banner */}
                      {(order.roomNumber || order.location || order.branchName || order.deliveryAddress) && (
                        <div style={{ fontSize: 12, color: "#4B5563", background: "#F9FAFB", padding: "6px 10px", borderRadius: 8, display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                          {order.roomNumber && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                              <BedDouble size={13} color="#2563EB" /> Room {order.roomNumber}
                            </span>
                          )}
                          {order.location && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <MapPin size={13} color="#EF4444" /> {order.location}
                            </span>
                          )}
                          {order.branchName && (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Building2 size={13} color="#6B7280" /> {order.branchName}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Brief Item Preview (e.g. Rice, Drinks etc) */}
                      {orderItems.length > 0 && (
                        <div style={{ fontSize: 12, color: "#4B5563", marginBottom: 10 }}>
                          <span style={{ fontWeight: 600, color: "#374151" }}>Ordered: </span>
                          {orderItems.slice(0, 3).map((it, idx) => (
                            <span key={idx} style={{ background: "#F3F4F6", padding: "2px 6px", borderRadius: 4, marginRight: 6, fontSize: 11 }}>
                              {it.name || it.title || "Item"} {it.quantity || it.qty ? `×${it.quantity || it.qty}` : ""}
                            </span>
                          ))}
                          {orderItems.length > 3 && (
                            <span style={{ color: "#9CA3AF", fontSize: 11 }}>+{orderItems.length - 3} more</span>
                          )}
                        </div>
                      )}

                      {/* Quick action row */}
                      <div className="ord-action-row" style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                        {order.status === "pending" && (
                          <>
                            <LoaderButton
                              size="sm"
                              variant="success"
                              loading={updatingId === order.$id}
                              onClick={() => handleStatusUpdate(order.$id, "confirmed")}
                            >
                              <Check size={13} /> Confirm
                            </LoaderButton>
                            <LoaderButton
                              size="sm"
                              variant="danger"
                              loading={updatingId === order.$id}
                              onClick={() => handleStatusUpdate(order.$id, "cancelled")}
                            >
                              <X size={13} /> Cancel
                            </LoaderButton>
                          </>
                        )}
                        {order.status === "confirmed" && (
                          <LoaderButton
                            size="sm"
                            variant="primary"
                            loading={updatingId === order.$id}
                            onClick={() => handleStatusUpdate(order.$id, "in_progress")}
                          >
                            <Play size={13} /> Start
                          </LoaderButton>
                        )}
                        {order.status === "in_progress" && (
                          <LoaderButton
                            size="sm"
                            variant="success"
                            loading={updatingId === order.$id}
                            onClick={() => handleStatusUpdate(order.$id, "completed")}
                          >
                            <Check size={13} /> Complete
                          </LoaderButton>
                        )}
                        <button
                          onClick={() => openOrderDetail(order)}
                          style={{
                            padding: "6px 12px", borderRadius: 8, border: "1px solid #E5E7EB",
                            background: "#fff", color: "#374151", fontSize: 12, fontWeight: 600,
                            display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer",
                          }}
                        >
                          <Eye size={13} /> Details
                        </button>
                        <LoaderButton
                          size="sm"
                          variant="danger"
                          loading={deletingId === order.$id}
                          onClick={() => handleDelete(order.$id)}
                        >
                          <Trash2 size={13} /> {deletingId === order.$id ? "Deleting..." : "Delete"}
                        </LoaderButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Detail Panel ──────────────────────────────────────────────── */}
          {selectedOrder && (
            <div className="ord-detail-panel" style={{
              background: "#fff", borderRadius: 16,
              boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
              border: "1px solid #E5E7EB",
              overflow: "hidden",
              position: "sticky", top: 20,
            }}>
              {/* Detail header */}
              <div style={{ background: "linear-gradient(135deg,#1A365D,#2563EB)", padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", color: "#fff" }}>
                <div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 800, letterSpacing: 1, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                    ORDER DETAILS & DATABASE RECORD
                    {loadingDetails && <RefreshCw size={11} style={{ animation: "ordSpin 1s linear infinite" }} />}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>#{selectedOrder.$id.slice(-8).toUpperCase()}</div>
                  <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <StatusBadge status={selectedOrder.status} />
                    {(() => {
                      const svc = getServiceTypeBadge(selectedOrder.orderType);
                      return (
                        <span style={{
                          fontSize: 11, background: "rgba(255,255,255,0.2)", color: "#fff",
                          padding: "3px 8px", borderRadius: 999, fontWeight: 700,
                          display: "inline-flex", alignItems: "center", gap: 4,
                        }}>
                          {svc.icon}
                          {svc.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  style={{ background: "rgba(255,255,255,0.18)", border: "none", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: "18px 20px", display: "grid", gap: 16, maxHeight: "80vh", overflowY: "auto" }}>

                {/* Customer Info (Real database fields) */}
                {(() => {
                  const cust = getCustomerInfo(selectedOrder);
                  return (
                    <Section title="Customer Information" icon={<User size={14} color="#1A365D" />}>
                      <div className="ord-detail-info-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <InfoRow label="Full Name" value={cust.name} icon={<User size={12} color="#6B7280" />} />
                        <InfoRow label="Email Address" value={cust.email} icon={<Mail size={12} color="#6B7280" />} />
                        <InfoRow label="Phone Number" value={cust.phone} icon={<Phone size={12} color="#6B7280" />} />
                        <InfoRow label="Customer ID" value={cust.userId ? cust.userId.slice(0, 12) + "…" : "N/A"} icon={<Hash size={12} color="#6B7280" />} mono />
                      </div>
                    </Section>
                  );
                })()}

                {/* Service & Order Classification — built from live DB data */}
                {(() => {
                  const svc = getOrderServiceInfo(selectedOrder);
                  const svcBadge = getServiceTypeBadge(svc.orderType);
                  return (
                    <Section title="Service & Booking Details" icon={<Building2 size={14} color="#1A365D" />}>
                      {/* Service Type Banner */}
                      <div style={{
                        background: svcBadge.bg, borderRadius: 10, padding: "10px 14px",
                        display: "flex", alignItems: "center", gap: 10, marginBottom: 12,
                        border: `1.5px solid ${svcBadge.color}22`,
                      }}>
                        <span style={{ color: svcBadge.color }}>{svcBadge.icon}</span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14, color: svcBadge.color }}>{svc.orderType}</div>
                          <div style={{ fontSize: 11, color: "#6B7280", marginTop: 1 }}>Service Classification</div>
                        </div>
                        <div style={{ marginLeft: "auto", textAlign: "right" }}>
                          <div style={{ fontWeight: 900, fontSize: 18, color: "#1A365D" }}>₦{(selectedOrder.totalAmount || 0).toLocaleString()}</div>
                          <div style={{ fontSize: 11, color: "#6B7280" }}>Total Amount</div>
                        </div>
                      </div>

                      <div className="ord-detail-info-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {svc.roomNumber && <InfoRow label="Room Number" value={svc.roomNumber} icon={<BedDouble size={12} color="#2563EB" />} />}
                        {svc.location && <InfoRow label="Location / Table" value={svc.location} icon={<MapPin size={12} color="#EF4444" />} />}
                        {svc.branchName && <InfoRow label="Branch" value={svc.branchName} icon={<Building2 size={12} color="#6B7280" />} />}
                        {svc.checkInDate && (
                          <InfoRow label="Check-In Date" value={new Date(svc.checkInDate).toLocaleDateString("en-NG", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })} icon={<Calendar size={12} color="#059669" />} />
                        )}
                        {svc.checkOutDate && (
                          <InfoRow label="Check-Out Date" value={new Date(svc.checkOutDate).toLocaleDateString("en-NG", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })} icon={<Calendar size={12} color="#DC2626" />} />
                        )}
                        {svc.numberOfDays !== undefined && svc.numberOfDays !== null && (
                          <InfoRow label="Duration" value={`${svc.numberOfDays} Day${Number(svc.numberOfDays) !== 1 ? "s" : ""}`} icon={<Clock size={12} color="#6B7280" />} />
                        )}
                        {svc.deliveryAddress && <InfoRow label="Delivery Address" value={svc.deliveryAddress} icon={<MapPin size={12} color="#7C3AED" />} />}
                        <InfoRow
                          label="Date Placed"
                          value={new Date(selectedOrder.createdAt || selectedOrder.$createdAt || "").toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                          icon={<Calendar size={12} color="#6B7280" />}
                        />
                      </div>

                      {svc.notes && (
                        <div style={{ marginTop: 10, padding: "10px 14px", background: "#FFFBEB", borderRadius: 8, fontSize: 13, color: "#92400E", display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <FileText size={16} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }} />
                          <div><strong>Special Instructions / Note:</strong> {svc.notes}</div>
                        </div>
                      )}
                    </Section>
                  );
                })()}

                {/* Full Ordered Items Breakdown — Kitchen / Minimart / Room / Activity */}
                {(() => {
                  const items = parseOrderItems(selectedOrder);
                  const svc = getOrderServiceInfo(selectedOrder);
                  const svcBadge = getServiceTypeBadge(svc.orderType);

                  if (items.length === 0) return null;

                  const sectionTitle = svc.isKitchen
                    ? "Kitchen / Food Order Items"
                    : svc.isMart
                    ? "Minimart Cart Items"
                    : svc.isRoom
                    ? "Room Booking Details"
                    : svc.isActivity
                    ? "Activity Booking Items"
                    : "Ordered Items Breakdown";

                  return (
                    <Section title={sectionTitle} icon={<ShoppingCart size={14} color="#1A365D" />}>
                      <div style={{ display: "grid", gap: 8 }}>
                        {items.map((item, i) => {
                          const itName = item.name || `Item #${i + 1}`;
                          const itQty = Number(item.quantity ?? 1);
                          const itPrice = Number(item.price ?? 0);
                          const itSubtotal = itQty * itPrice;
                          const itDesc = item.description;

                          return (
                            <div key={i} className="ord-item-row" style={{
                              display: "flex", justifyContent: "space-between", alignItems: "flex-start",
                              padding: "12px 14px", background: "#F9FAFB", borderRadius: 10,
                              border: `1px solid ${svcBadge.bg === "#F3F4F6" ? "#E5E7EB" : svcBadge.bg}`,
                              gap: 12,
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                                  <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{itName}</div>
                                  {item.category && (
                                    <span style={{
                                      fontSize: 11, background: svcBadge.bg, color: svcBadge.color,
                                      padding: "1px 8px", borderRadius: 999, fontWeight: 700,
                                    }}>
                                      {item.category}
                                    </span>
                                  )}
                                </div>
                                {itDesc && (
                                  <div style={{ fontSize: 12, color: "#6B7280", fontStyle: "italic", display: "flex", alignItems: "flex-start", gap: 4 }}>
                                    <FileText size={11} style={{ flexShrink: 0, marginTop: 2 }} />
                                    {itDesc}
                                  </div>
                                )}
                              </div>
                              <div style={{ textAlign: "right", flexShrink: 0 }}>
                                <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 2 }}>
                                  {itQty} {itQty === 1 ? "unit" : "units"} × ₦{itPrice.toLocaleString()}
                                </div>
                                <div style={{ fontWeight: 900, fontSize: 15, color: "#1A365D" }}>
                                  ₦{itSubtotal.toLocaleString()}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Order Total */}
                      <div style={{
                        marginTop: 12, padding: "14px 16px",
                        background: "linear-gradient(135deg, #1A365D11, #2563EB11)",
                        borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center",
                        border: "1.5px solid #DBEAFE",
                      }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "#1E40AF", fontSize: 13 }}>Order Total</div>
                          <div style={{ fontSize: 11, color: "#6B7280" }}>{items.length} item{items.length !== 1 ? "s" : ""} ordered</div>
                        </div>
                        <span style={{ fontWeight: 900, fontSize: 20, color: "#1A365D" }}>₦{(selectedOrder.totalAmount || 0).toLocaleString()}</span>
                      </div>
                    </Section>
                  );
                })()}

                {/* Status Update Controls */}
                <Section title="Update Order Status" icon={<Zap size={14} color="#1A365D" />}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {selectedOrder.status === "pending" && (
                      <>
                        <LoaderButton
                          variant="success"
                          loading={updatingId === selectedOrder.$id}
                          onClick={() => handleStatusUpdate(selectedOrder.$id, "confirmed")}
                        >
                          <Check size={14} /> Confirm Order
                        </LoaderButton>
                        <LoaderButton
                          variant="danger"
                          loading={updatingId === selectedOrder.$id}
                          onClick={() => handleStatusUpdate(selectedOrder.$id, "cancelled")}
                        >
                          <X size={14} /> Cancel Order
                        </LoaderButton>
                      </>
                    )}
                    {selectedOrder.status === "confirmed" && (
                      <LoaderButton
                        variant="primary"
                        loading={updatingId === selectedOrder.$id}
                        onClick={() => handleStatusUpdate(selectedOrder.$id, "in_progress")}
                      >
                        <Play size={14} /> Mark In Progress
                      </LoaderButton>
                    )}
                    {selectedOrder.status === "in_progress" && (
                      <LoaderButton
                        variant="success"
                        loading={updatingId === selectedOrder.$id}
                        onClick={() => handleStatusUpdate(selectedOrder.$id, "completed")}
                      >
                        <Check size={14} /> Mark Completed
                      </LoaderButton>
                    )}
                    {["completed", "cancelled"].includes(selectedOrder.status) && (
                      <div style={{ fontSize: 13, color: "#6B7280", padding: "6px 0", fontStyle: "italic" }}>
                        Order is finalized as {selectedOrder.status}.
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px dashed #E5E7EB", display: "flex", justifyContent: "flex-end" }}>
                    <LoaderButton
                      variant="danger"
                      loading={deletingId === selectedOrder.$id}
                      onClick={() => handleDelete(selectedOrder.$id)}
                    >
                      <Trash2 size={14} /> {deletingId === selectedOrder.$id ? "Deleting..." : "Delete Order"}
                    </LoaderButton>
                  </div>
                </Section>

                {/* Chat Summary */}
                <Section title="Order Chat Messages" icon={<MessageSquare size={14} color="#1A365D" />}>
                  {loadingChat ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 12, color: "#888" }}>
                      <RefreshCw size={14} style={{ animation: "ordSpin 1s linear infinite" }} /> Loading messages from chat…
                    </div>
                  ) : chatMessages.length === 0 ? (
                    <div style={{ fontSize: 13, color: "#9CA3AF", fontStyle: "italic", padding: "8px 0" }}>
                      No chat messages logged for this order.
                    </div>
                  ) : (
                    <div style={{ display: "grid", gap: 8, maxHeight: 260, overflowY: "auto" }}>
                      {chatMessages.map((msg, i) => (
                        <div key={msg._id || i} style={{
                          padding: "8px 12px", borderRadius: 10,
                          background: msg.sender?.role === "staff" ? "#EFF6FF" : "#F9FAFB",
                          borderLeft: `3px solid ${msg.sender?.role === "staff" ? "#3B82F6" : "#E5E7EB"}`,
                        }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: msg.sender?.role === "staff" ? "#2563EB" : "#374151", marginBottom: 2 }}>
                            {msg.sender?.displayName || msg.sender?.name || "Customer"} {msg.sender?.role ? `(${msg.sender.role})` : ""}
                          </div>
                          <div style={{ fontSize: 13, color: "#1F2937", lineHeight: 1.4 }}>{msg.content}</div>
                          {msg.createdAt && (
                            <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 3 }}>
                              {new Date(msg.createdAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Helper Components ─────────────────────────────────────────────────────────
function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 12, fontWeight: 800, color: "#4B5563", letterSpacing: 0.5,
        marginBottom: 10, textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6,
      }}>
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value, mono, highlight, icon }: { label: string; value: string; mono?: boolean; highlight?: boolean; icon?: React.ReactNode }) {
  return (
    <div style={{ padding: "8px 10px", background: "#F9FAFB", borderRadius: 8, border: "1px solid #F3F4F6" }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "#9CA3AF", letterSpacing: 0.5,
        textTransform: "uppercase", marginBottom: 2, display: "flex", alignItems: "center", gap: 4,
      }}>
        {icon}
        {label}
      </div>
      <div style={{
        fontSize: 13, fontWeight: highlight ? 800 : 600,
        color: highlight ? "#1A365D" : "#111827",
        fontFamily: mono ? "monospace" : undefined,
        wordBreak: "break-word",
      }}>
        {value}
      </div>
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  padding: "10px 14px", borderRadius: 10,
  border: "1.5px solid #E5E7EB", fontSize: 14,
  outline: "none", background: "#FAFAFA",
};

const btnStyle: React.CSSProperties = {
  padding: "10px 18px", borderRadius: 10, border: "none",
  background: "#ff7f50", color: "#fff", fontWeight: 700,
  cursor: "pointer", fontSize: 14,
};