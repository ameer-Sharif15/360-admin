"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getClients, ID, Query, type Models } from "../../lib/appwrite";
import LoaderButton from "../../components/LoaderButton";
import {
  Search,
  X,
  ShoppingBag,
  Store,
  Mail,
  MapPin,
  RefreshCw,
  Filter,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit,
  User as UserIcon,
} from "lucide-react";

type Seller = {
  $id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  supportType?: "seller";
  location?: string;
};

const COLLECTION = "users";

const inputStyle: React.CSSProperties = {
  padding: "12px",
  borderRadius: 8,
  border: "1px solid #e5e5e5",
  fontSize: 14,
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 10,
  border: "none",
  background: "#ff7f50",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 13,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const secondaryButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#6B7280",
};

const smallButtonStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 8,
  border: "none",
  background: "#f3f4f6",
  color: "#1E1E1E",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
};

export default function SellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [form, setForm] = useState<Partial<Seller>>({});
  const [createForm, setCreateForm] = useState<
    Partial<Seller & { password: string }>
  >({
    role: "support",
    supportType: "seller",
    username: "",
    displayName: "",
    email: "",
    password: "",
    location: "",
  });
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");

  const clientBundle = useMemo(() => {
    try {
      return getClients();
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, []);

  const fetchSellers = async () => {
    if (!clientBundle) return;
    setLoading(true);
    setError(null);
    try {
      const res = await clientBundle.databases.listDocuments<
        Seller & Models.Document
      >(clientBundle.databaseId, COLLECTION, [
        Query.equal("role", "support"),
        Query.equal("supportType", "seller"),
        Query.limit(100),
      ]);
      setSellers(res.documents);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSellers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async () => {
    if (
      !createForm.username ||
      !createForm.displayName ||
      !createForm.email ||
      !createForm.password
    ) {
      setError("Username, Display Name, Email, and Password are required");
      return;
    }
    if ((createForm.password?.length || 0) < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: createForm.username,
          displayName: createForm.displayName,
          email: createForm.email,
          password: createForm.password,
          role: "support",
          supportType: "seller",
          location: createForm.location,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create seller");
      }

      setSuccess(
        `Seller "${createForm.displayName}" created successfully! They can log in with: ${createForm.email}`,
      );
      setCreateForm({
        role: "support",
        supportType: "seller",
        username: "",
        displayName: "",
        email: "",
        password: "",
        location: "",
      });
      setShowCreateForm(false);
      await fetchSellers();
      setTimeout(() => setSuccess(null), 5000);
    } catch (e: any) {
      setError(e.message || "Failed to create seller");
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = (seller: Seller) => {
    setEditingSeller(seller);
    setForm({
      displayName: seller.displayName,
      location: seller.location,
    });
  };

  const handleSave = async () => {
    if (!clientBundle || !editingSeller) return;
    setSaving(true);
    setError(null);
    try {
      await clientBundle.databases.updateDocument(
        clientBundle.databaseId,
        COLLECTION,
        editingSeller.$id,
        {
          displayName: form.displayName,
          location: form.location || undefined,
        },
      );
      setEditingSeller(null);
      setForm({});
      await fetchSellers();
      setSuccess("Seller updated successfully!");
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (seller: Seller) => {
    if (!confirm(`Are you sure you want to delete seller "${seller.displayName}"?`))
      return;
    if (!clientBundle) return;
    setDeletingId(seller.$id);
    try {
      await clientBundle.databases.deleteDocument(
        clientBundle.databaseId,
        COLLECTION,
        seller.$id,
      );
      await fetchSellers();
      setSuccess(`Seller ${seller.displayName} deleted successfully.`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  // Extract unique locations for filter
  const uniqueLocations = useMemo(() => {
    const locs = new Set<string>();
    sellers.forEach((s) => {
      if (s.location && s.location.trim()) {
        locs.add(s.location.trim());
      }
    });
    return Array.from(locs).sort();
  }, [sellers]);

  // ─── Filtered Sellers via Search & Location ─────────────────────────────────
  const filteredSellers = useMemo(() => {
    return sellers.filter((s) => {
      // Location filter
      if (selectedLocation !== "all") {
        if (!s.location || s.location.toLowerCase() !== selectedLocation.toLowerCase()) {
          return false;
        }
      }

      // Keyword Search (name, email, username, id, location, or related keyword)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (s.displayName || "").toLowerCase().includes(q);
        const matchEmail = (s.email || "").toLowerCase().includes(q);
        const matchUser = (s.username || "").toLowerCase().includes(q);
        const matchId = (s.$id || "").toLowerCase().includes(q);
        const matchLocation = (s.location || "").toLowerCase().includes(q);
        const matchRole = (s.role || "").toLowerCase().includes(q);
        const matchSupport = (s.supportType || "").toLowerCase().includes(q);
        return matchName || matchEmail || matchUser || matchId || matchLocation || matchRole || matchSupport;
      }

      return true;
    });
  }, [sellers, searchQuery, selectedLocation]);

  const hasActiveFilters = searchQuery.trim().length > 0 || selectedLocation !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedLocation("all");
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* ── Top Header & Actions ── */}
      <div
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 14,
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
              <Store size={22} color="#FF7F50" />
              Sellers Management
            </h2>
            <p style={{ margin: 0, color: "#64748B", fontSize: 13 }}>
              Total Merchants: <strong>{sellers.length} Sellers</strong> · Search by name, store, email, or location
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={fetchSellers}
              style={{ ...smallButtonStyle, padding: "9px 14px", background: "#F1F5F9" }}
              title="Refresh list"
            >
              <RefreshCw size={13} /> Refresh
            </button>
            <button
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setEditingSeller(null);
                setForm({});
              }}
              style={buttonStyle}
            >
              {showCreateForm ? "Cancel" : "+ Create Seller"}
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              color: "#991B1B",
              padding: "10px 14px",
              background: "#FEE2E2",
              border: "1px solid #FECACA",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <AlertCircle size={16} /> {error}
          </div>
        )}
        {success && (
          <div
            style={{
              color: "#065F46",
              padding: "10px 14px",
              background: "#D1FAE5",
              border: "1px solid #A7F3D0",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        {/* ── Create Seller Form ── */}
        {showCreateForm && (
          <div
            style={{
              display: "grid",
              gap: 12,
              marginTop: 16,
              padding: 18,
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: 12,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16 }}>Create New Seller Account</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <input
                placeholder="Username (required, e.g. bakerystore)"
                value={createForm.username || ""}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, username: e.target.value }))
                }
                style={inputStyle}
              />
              <input
                placeholder="Store / Display Name (required, e.g. 360 Bakery)"
                value={createForm.displayName || ""}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, displayName: e.target.value }))
                }
                style={inputStyle}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <input
                type="email"
                placeholder="Email Address (required)"
                value={createForm.email || ""}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, email: e.target.value }))
                }
                style={inputStyle}
              />
              <input
                type="password"
                placeholder="Password (min 8 characters)"
                value={createForm.password || ""}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, password: e.target.value }))
                }
                style={inputStyle}
              />
            </div>
            <input
              placeholder="Store Location / City (optional, e.g. Keffi, Abuja, Lagos)"
              value={createForm.location || ""}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, location: e.target.value }))
              }
              style={inputStyle}
            />
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <LoaderButton onClick={handleCreate} loading={creating} variant="primary">
                {creating ? "Creating Seller..." : "Register Seller"}
              </LoaderButton>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                style={secondaryButtonStyle}
              >
                Cancel
              </button>
            </div>
            <p style={{ fontSize: 12, color: "#64748B", margin: 0 }}>
              Note: This creates an official seller account with portal access. The merchant can immediately log in and manage their inventory.
            </p>
          </div>
        )}

        {/* ── Edit Seller Form ── */}
        {editingSeller && (
          <div
            style={{
              display: "grid",
              gap: 12,
              marginTop: 16,
              padding: 18,
              background: "#EFF6FF",
              border: "1px solid #BFDBFE",
              borderRadius: 12,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, color: "#1E3A8A" }}>
              Edit Seller: {editingSeller.displayName} (@{editingSeller.username})
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <input
                placeholder="Display / Store Name"
                value={form.displayName || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, displayName: e.target.value }))
                }
                style={inputStyle}
              />
              <input
                placeholder="Location (e.g. Keffi, Abuja)"
                value={form.location || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, location: e.target.value }))
                }
                style={inputStyle}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <LoaderButton onClick={handleSave} loading={saving} variant="primary">
                {saving ? "Saving Changes..." : "Save Changes"}
              </LoaderButton>
              <button
                onClick={() => {
                  setEditingSeller(null);
                  setForm({});
                }}
                style={secondaryButtonStyle}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Search & Filter Controls ── */}
      <div
        style={{
          background: "#fff",
          padding: 16,
          borderRadius: 14,
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
          display: "grid",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {/* Search Input */}
          <div
            style={{
              flex: 1,
              minWidth: 260,
              position: "relative",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Search
              size={17}
              color="#94A3B8"
              style={{ position: "absolute", left: 14, pointerEvents: "none" }}
            />
            <input
              type="text"
              placeholder="Search seller by store name, email, username, location, or ID keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "11px 36px 11px 40px",
                borderRadius: 10,
                border: "1.5px solid #CBD5E1",
                fontSize: 13.5,
                outline: "none",
                background: "#F8FAFC",
                boxSizing: "border-box",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: 12,
                  background: "none",
                  border: "none",
                  color: "#94A3B8",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Location filter dropdown */}
          {uniqueLocations.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <MapPin size={14} color="#64748B" />
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                style={{
                  padding: "9px 12px",
                  borderRadius: 8,
                  border: "1px solid #CBD5E1",
                  fontSize: 12.5,
                  fontWeight: 600,
                  background: "#fff",
                  color: "#334155",
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                <option value="all">All Locations</option>
                {uniqueLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          )}

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              style={{
                ...smallButtonStyle,
                background: "#FEE2E2",
                color: "#DC2626",
                padding: "9px 14px",
              }}
            >
              <X size={13} /> Reset Filter
            </button>
          )}

          <div style={{ marginLeft: "auto", fontSize: 12, color: "#64748B", fontWeight: 600 }}>
            Showing <strong>{filteredSellers.length}</strong> of {sellers.length} sellers
          </div>
        </div>
      </div>

      {/* ── Sellers Directory List ── */}
      <div
        style={{
          background: "#fff",
          padding: 20,
          borderRadius: 14,
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
            Registered Sellers ({filteredSellers.length})
          </h3>
          {hasActiveFilters && (
            <span style={{ fontSize: 12, color: "#10B981", fontWeight: 600 }}>
              Search filtered
            </span>
          )}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: "#64748B" }}>
            Loading sellers...
          </div>
        )}

        {!loading && filteredSellers.length === 0 && (
          <div style={{ textAlign: "center", padding: 48, color: "#94A3B8" }}>
            <Store size={38} color="#CBD5E1" style={{ margin: "0 auto 12px" }} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#475569" }}>
              No sellers matching your search
            </p>
            <p style={{ margin: "6px 0 16px", fontSize: 13, color: "#94A3B8" }}>
              {searchQuery ? `No results found for "${searchQuery}".` : "No registered sellers available."}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} style={{ ...buttonStyle, padding: "8px 16px", margin: "0 auto" }}>
                Clear Search Filter
              </button>
            )}
          </div>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          {filteredSellers.map((seller) => (
            <div
              key={seller.$id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid #E2E8F0",
                background: "#FAFBFD",
                transition: "background 0.15s",
              }}
            >
              {/* Left: Store Icon & Info */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "#ECFDF5",
                    border: "2px solid #10B981",
                    color: "#059669",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  <Store size={20} color="#059669" />
                </div>

                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 14, color: "#0F172A" }}>{seller.displayName}</strong>
                    <span
                      style={{
                        background: "#D1FAE5",
                        color: "#047857",
                        padding: "2px 8px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "capitalize",
                      }}
                    >
                      Seller / Merchant
                    </span>
                    {seller.location && (
                      <span
                        style={{
                          background: "#EFF6FF",
                          color: "#1E40AF",
                          padding: "2px 7px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <MapPin size={10} color="#3B82F6" /> {seller.location}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
                    <span style={{ color: "#64748B", fontSize: 12 }}>@{seller.username}</span>
                    <span style={{ color: "#94A3B8", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 3 }}>
                      <Mail size={11} /> {seller.email}
                    </span>
                    <span style={{ color: "#CBD5E1", fontSize: 11, fontFamily: "monospace" }}>
                      ID: {seller.$id.slice(0, 10)}...
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  onClick={() => handleEdit(seller)}
                  style={{ ...smallButtonStyle, background: "#EFF6FF", color: "#1D4ED8" }}
                >
                  <Edit size={12} /> Edit
                </button>
                <LoaderButton
                  variant="danger"
                  size="sm"
                  loading={deletingId === seller.$id}
                  onClick={() => handleDelete(seller)}
                >
                  <Trash2 size={12} />
                </LoaderButton>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
