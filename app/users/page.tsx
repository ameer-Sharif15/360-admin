"use client";

import { ID, Query, type Models } from "../../lib/appwrite";
import { useEffect, useMemo, useState } from "react";
import { getClients } from "../../lib/appwrite";
import LoaderButton from "../../components/LoaderButton";
import {
  Search,
  X,
  User as UserIcon,
  Mail,
  Shield,
  MapPin,
  RefreshCw,
  Filter,
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit,
} from "lucide-react";

type User = {
  $id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  supportType?: "reception" | "services" | "kitchen";
  branchAssignedId?: string;
  preferredBranchId?: string;
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

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<Partial<User>>({});
  const [createForm, setCreateForm] = useState<
    Partial<User & { password: string }>
  >({
    role: "user",
    username: "",
    displayName: "",
    email: "",
    password: "",
    location: "",
  });
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");

  const clientBundle = useMemo(() => {
    try {
      return getClients();
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, []);

  const fetchUsers = async () => {
    if (!clientBundle) return;
    setLoading(true);
    setError(null);
    try {
      const res = await clientBundle.databases.listDocuments<
        User & Models.Document
      >(clientBundle.databaseId, COLLECTION, [
        Query.limit(100),
      ]);
      setUsers(res.documents);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setForm({
      displayName: user.displayName,
      role: user.role,
      supportType: user.supportType,
      location: user.location,
    });
  };

  const handleSave = async () => {
    if (!clientBundle || !editingUser) return;
    setSavingUser(true);
    setError(null);
    try {
      await clientBundle.databases.updateDocument(
        clientBundle.databaseId,
        COLLECTION,
        editingUser.$id,
        {
          displayName: form.displayName,
          role: form.role,
          supportType: form.supportType || undefined,
          location: form.location || undefined,
        },
      );
      setEditingUser(null);
      setForm({});
      await fetchUsers();
      setSuccess("User updated successfully!");
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingUser(false);
    }
  };

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
    if (createForm.role === "support" && !createForm.supportType) {
      setError("Support Type is required for support users");
      return;
    }
    if ((createForm.password?.length || 0) < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }
    setCreatingUser(true);
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
          role: createForm.role || "user",
          supportType:
            createForm.role === "support" ? createForm.supportType : undefined,
          location: createForm.location,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create user");
      }

      setSuccess(
        `User "${createForm.displayName}" created successfully! They can now log in with email: ${createForm.email}`,
      );
      setCreateForm({
        role: "user",
        username: "",
        displayName: "",
        email: "",
        password: "",
        location: "",
      });
      setShowCreateForm(false);
      await fetchUsers();
      setTimeout(() => setSuccess(null), 5000);
    } catch (e: any) {
      setError(e.message || "Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case "admin":
      case "super_admin":
        return "#3B82F6";
      case "support":
        return "#10B981";
      case "manager":
      case "management":
        return "#8B5CF6";
      case "seller":
        return "#EA580C";
      default:
        return "#6B7280";
    }
  };

  // Extract unique locations for location filter
  const uniqueLocations = useMemo(() => {
    const locs = new Set<string>();
    users.forEach((u) => {
      if (u.location && u.location.trim()) {
        locs.add(u.location.trim());
      }
    });
    return Array.from(locs).sort();
  }, [users]);

  // Role count metrics
  const roleCounts = useMemo(() => {
    const counts = { all: users.length, user: 0, support: 0, admin: 0, manager: 0, seller: 0 };
    users.forEach((u) => {
      const r = (u.role || "user").toLowerCase();
      if (r === "admin" || r === "super_admin") counts.admin++;
      else if (r === "support") counts.support++;
      else if (r === "manager" || r === "management") counts.manager++;
      else if (r === "seller") counts.seller++;
      else counts.user++;
    });
    return counts;
  }, [users]);

  // ─── Filtered Users via Search & Chips ───────────────────────────────────────
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Role filter
      if (selectedRole !== "all") {
        const r = (u.role || "user").toLowerCase();
        if (selectedRole === "admin" && r !== "admin" && r !== "super_admin") return false;
        if (selectedRole === "support" && r !== "support") return false;
        if (selectedRole === "manager" && r !== "manager" && r !== "management") return false;
        if (selectedRole === "seller" && r !== "seller") return false;
        if (selectedRole === "user" && (r === "admin" || r === "super_admin" || r === "support" || r === "manager" || r === "management" || r === "seller")) return false;
      }

      // Location filter
      if (selectedLocation !== "all") {
        if (!u.location || u.location.toLowerCase() !== selectedLocation.toLowerCase()) {
          return false;
        }
      }

      // Keyword Search (name, email, username, phone, id, role, supportType, location, or related keywords)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (u.displayName || "").toLowerCase().includes(q);
        const matchEmail = (u.email || "").toLowerCase().includes(q);
        const matchUser = (u.username || "").toLowerCase().includes(q);
        const matchId = (u.$id || "").toLowerCase().includes(q);
        const matchRole = (u.role || "").toLowerCase().includes(q);
        const matchSupport = (u.supportType || "").toLowerCase().includes(q);
        const matchLocation = (u.location || "").toLowerCase().includes(q);
        return matchName || matchEmail || matchUser || matchId || matchRole || matchSupport || matchLocation;
      }

      return true;
    });
  }, [users, searchQuery, selectedRole, selectedLocation]);

  const hasActiveFilters = searchQuery.trim().length > 0 || selectedRole !== "all" || selectedLocation !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedRole("all");
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
            <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>Users Management</h2>
            <p style={{ margin: 0, color: "#64748B", fontSize: 13 }}>
              Total Registered: <strong>{users.length} Users</strong> · Search and manage system accounts
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={fetchUsers}
              style={{ ...smallButtonStyle, padding: "9px 14px", background: "#F1F5F9" }}
              title="Refresh list"
            >
              <RefreshCw size={13} /> Refresh
            </button>
            <button
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setEditingUser(null);
                setForm({});
              }}
              style={buttonStyle}
            >
              {showCreateForm ? "Cancel" : "+ Create User"}
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

        {/* ── Create User Form ── */}
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
            <h3 style={{ margin: 0, fontSize: 16 }}>Create New User Account</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <input
                placeholder="Username (required)"
                value={createForm.username || ""}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, username: e.target.value }))
                }
                style={inputStyle}
              />
              <input
                placeholder="Display Name (required)"
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <select
                value={createForm.role || "user"}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, role: e.target.value }))
                }
                style={inputStyle}
              >
                <option value="user">User (Customer)</option>
                <option value="support">Support</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
              <input
                placeholder="Location / Branch (e.g. Keffi, Abuja)"
                value={createForm.location || ""}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, location: e.target.value }))
                }
                style={inputStyle}
              />
            </div>
            {createForm.role === "support" && (
              <select
                value={createForm.supportType || ""}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    supportType: e.target.value as any,
                  }))
                }
                style={inputStyle}
              >
                <option value="">Select Support Department *</option>
                <option value="reception">Reception (Rooms & Orders)</option>
                <option value="kitchen">Kitchen (Food & Minimart)</option>
                <option value="services">Services Support</option>
              </select>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <LoaderButton onClick={handleCreate} loading={creatingUser} variant="primary">
                {creatingUser ? "Creating User..." : "Register User"}
              </LoaderButton>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                style={secondaryButtonStyle}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Edit User Form ── */}
        {editingUser && (
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
              Edit User: {editingUser.displayName} (@{editingUser.username})
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <input
                placeholder="Display Name"
                value={form.displayName || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, displayName: e.target.value }))
                }
                style={inputStyle}
              />
              <select
                value={form.role || editingUser.role}
                onChange={(e) =>
                  setForm((f) => ({ ...f, role: e.target.value }))
                }
                style={inputStyle}
              >
                <option value="user">User</option>
                <option value="support">Support</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
                <option value="seller">Seller</option>
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <input
                placeholder="Location / Branch"
                value={form.location || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, location: e.target.value }))
                }
                style={inputStyle}
              />
              {(form.role === "support" || editingUser.role === "support") && (
                <select
                  value={form.supportType || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      supportType: e.target.value as any,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="">Select Support Type</option>
                  <option value="reception">Reception (Rooms & Food)</option>
                  <option value="kitchen">Kitchen (Food & Mini Mart)</option>
                  <option value="services">Services</option>
                </select>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <LoaderButton onClick={handleSave} loading={savingUser} variant="primary">
                {savingUser ? "Saving Changes..." : "Save Changes"}
              </LoaderButton>
              <button
                onClick={() => {
                  setEditingUser(null);
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

      {/* ── Search & Filter Panel ── */}
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
        {/* Search input bar */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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
              placeholder="Search user by name, email, username, location, role, or ID keyword..."
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

          {/* Location filter dropdown if locations exist */}
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
        </div>

        {/* Role Filter Chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "flex", alignItems: "center", gap: 4 }}>
            <Filter size={12} /> Filter:
          </span>
          {[
            { id: "all", label: "All Users", count: roleCounts.all },
            { id: "user", label: "Customers", count: roleCounts.user },
            { id: "support", label: "Support", count: roleCounts.support },
            { id: "admin", label: "Admins", count: roleCounts.admin },
            { id: "manager", label: "Managers", count: roleCounts.manager },
            { id: "seller", label: "Sellers", count: roleCounts.seller },
          ].map((pill) => {
            const isActive = selectedRole === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => setSelectedRole(pill.id)}
                style={{
                  border: "none",
                  padding: "5px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  background: isActive ? "#0F172A" : "#F1F5F9",
                  color: isActive ? "#fff" : "#475569",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>{pill.label}</span>
                <span
                  style={{
                    fontSize: 10.5,
                    padding: "1px 6px",
                    borderRadius: 999,
                    background: isActive ? "rgba(255,255,255,0.25)" : "#E2E8F0",
                    color: isActive ? "#fff" : "#64748B",
                  }}
                >
                  {pill.count}
                </span>
              </button>
            );
          })}

          <div style={{ marginLeft: "auto", fontSize: 12, color: "#64748B", fontWeight: 600 }}>
            Showing <strong>{filteredUsers.length}</strong> of {users.length} users
          </div>
        </div>
      </div>

      {/* ── Users Directory List ── */}
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
            User Accounts ({filteredUsers.length})
          </h3>
          {hasActiveFilters && (
            <span style={{ fontSize: 12, color: "#2563EB", fontWeight: 600 }}>
              Filtered results
            </span>
          )}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: "#64748B" }}>
            Loading users...
          </div>
        )}

        {!loading && filteredUsers.length === 0 && (
          <div style={{ textAlign: "center", padding: 48, color: "#94A3B8" }}>
            <UserIcon size={38} color="#CBD5E1" style={{ margin: "0 auto 12px" }} />
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#475569" }}>
              No users matching your search
            </p>
            <p style={{ margin: "6px 0 16px", fontSize: 13, color: "#94A3B8" }}>
              {searchQuery ? `No results found for "${searchQuery}".` : "No users in this role category."}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} style={{ ...buttonStyle, padding: "8px 16px", margin: "0 auto" }}>
                Clear Search Filter
              </button>
            )}
          </div>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          {filteredUsers.map((user) => {
            const roleColor = getRoleColor(user.role);
            return (
              <div
                key={user.$id}
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
                {/* Left: Avatar & Info */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: roleColor + "18",
                      border: `2px solid ${roleColor}`,
                      color: roleColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                  >
                    {(user.displayName || user.username || "U").slice(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 14, color: "#0F172A" }}>{user.displayName}</strong>
                      <span
                        style={{
                          background: roleColor + "20",
                          color: roleColor,
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          textTransform: "capitalize",
                        }}
                      >
                        {user.role}
                      </span>
                      {user.supportType && (
                        <span
                          style={{
                            background: "#DCFCE7",
                            color: "#15803D",
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "capitalize",
                          }}
                        >
                          {user.supportType}
                        </span>
                      )}
                      {user.location && (
                        <span
                          style={{
                            background: "#F1F5F9",
                            color: "#475569",
                            padding: "2px 7px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <MapPin size={10} color="#64748B" /> {user.location}
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
                      <span style={{ color: "#64748B", fontSize: 12 }}>@{user.username}</span>
                      <span style={{ color: "#94A3B8", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <Mail size={11} /> {user.email}
                      </span>
                      <span style={{ color: "#CBD5E1", fontSize: 11, fontFamily: "monospace" }}>
                        ID: {user.$id.slice(0, 10)}...
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={() => handleEdit(user)}
                    style={{ ...smallButtonStyle, background: "#EFF6FF", color: "#1D4ED8" }}
                  >
                    <Edit size={12} /> Edit
                  </button>
                  <LoaderButton
                    variant="danger"
                    size="sm"
                    loading={deletingId === user.$id}
                    onClick={async () => {
                      if (!confirm(`Are you sure you want to delete ${user.displayName}?`)) return;
                      setDeletingId(user.$id);
                      try {
                        await clientBundle.databases.deleteDocument(
                          clientBundle.databaseId,
                          COLLECTION,
                          user.$id,
                        );
                        await fetchUsers();
                        setSuccess(`User ${user.displayName} deleted successfully.`);
                        setTimeout(() => setSuccess(null), 4000);
                      } catch (e: any) {
                        setError(e.message);
                      } finally {
                        setDeletingId(null);
                      }
                    }}
                  >
                    <Trash2 size={12} />
                  </LoaderButton>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
