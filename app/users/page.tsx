"use client";

import { ID, Query, type Models } from "appwrite";
import { useEffect, useMemo, useState } from "react";
import { getClients } from "../../lib/appwrite";

type User = {
  $id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  supportType?: "reception" | "services" | "kitchen";
  branchAssignedId?: string;
  preferredBranchId?: string;
};

const COLLECTION = "users";

const inputStyle: React.CSSProperties = {
  padding: "12px",
  borderRadius: 8,
  border: "1px solid #e5e5e5",
  fontSize: 14,
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 10,
  border: "none",
  background: "#ff7f50",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
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
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
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
  });
  const [showCreateForm, setShowCreateForm] = useState(false);

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
      >(clientBundle.databaseId, COLLECTION, []);
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
    });
  };

  const handleSave = async () => {
    if (!clientBundle || !editingUser) return;
    setLoading(true);
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
        },
      );
      setEditingUser(null);
      setForm({});
      await fetchUsers();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
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
    setLoading(true);
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
      });
      setShowCreateForm(false);
      await fetchUsers();
      setTimeout(() => setSuccess(null), 5000);
    } catch (e: any) {
      setError(e.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
      case "super_admin":
        return "#3B82F6";
      case "support":
        return "#10B981";
      case "manager":
        return "#8B5CF6";
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Users Management</h2>
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
        {error && (
          <p
            style={{
              color: "red",
              padding: "8px",
              background: "#FEE2E2",
              borderRadius: 6,
              marginBottom: 8,
            }}
          >
            {error}
          </p>
        )}
        {success && (
          <p
            style={{
              color: "#10B981",
              padding: "8px",
              background: "#D1FAE5",
              borderRadius: 6,
              marginBottom: 8,
            }}
          >
            {success}
          </p>
        )}
        {showCreateForm && (
          <div
            style={{
              display: "grid",
              gap: 12,
              marginTop: 16,
              padding: 16,
              background: "#F9FAFB",
              borderRadius: 8,
            }}
          >
            <h3>Create New User</h3>
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
            <input
              type="email"
              placeholder="Email (required)"
              value={createForm.email || ""}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, email: e.target.value }))
              }
              style={inputStyle}
            />
            <input
              type="password"
              placeholder="Password (required, min 8 characters)"
              value={createForm.password || ""}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, password: e.target.value }))
              }
              style={inputStyle}
            />
            <select
              value={createForm.role || "user"}
              onChange={(e) =>
                setCreateForm((f) => ({
                  ...f,
                  role: e.target.value,
                  supportType: undefined,
                }))
              }
              style={inputStyle}
            >
              <option value="user">User</option>
              <option value="manager">Manager</option>
              <option value="support">Support</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
            {createForm.role === "support" && (
              <select
                value={createForm.supportType || ""}
                onChange={(e) =>
                  setCreateForm((f) => ({
                    ...f,
                    supportType: e.target.value as
                      | "reception"
                      | "services"
                      | "kitchen"
                      | undefined,
                  }))
                }
                style={inputStyle}
              >
                <option value="">Select Support Type (required)</option>
                <option value="reception">Reception (Rooms & Food)</option>
                <option value="kitchen">Kitchen (Food & Mini Mart)</option>
                <option value="services">Services</option>
              </select>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleCreate}
                disabled={loading}
                style={buttonStyle}
              >
                {loading ? "Creating..." : "Create User"}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateForm({
                    role: "user",
                    username: "",
                    displayName: "",
                    email: "",
                    password: "",
                  });
                }}
                style={secondaryButtonStyle}
              >
                Cancel
              </button>
            </div>
            <p style={{ fontSize: 12, color: "#666", margin: 0 }}>
              Note: This creates an Appwrite account and user profile. The user
              can log in immediately with the provided password and change it
              later.
            </p>
          </div>
        )}
        {editingUser && (
          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            <h3>Edit User: {editingUser.displayName}</h3>
            <input
              placeholder="Display Name"
              value={form.displayName || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, displayName: e.target.value }))
              }
              style={inputStyle}
            />
            <select
              value={form.role || ""}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              style={inputStyle}
            >
              <option value="user">User</option>
              <option value="manager">Manager</option>
              <option value="support">Support</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
            {form.role === "support" && (
              <select
                value={form.supportType || ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    supportType: e.target.value as
                      | "reception"
                      | "services"
                      | "kitchen"
                      | undefined,
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
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleSave}
                disabled={loading}
                style={buttonStyle}
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
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

      <div
        style={{
          background: "#fff",
          padding: 16,
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        }}
      >
        <h3 style={{ marginTop: 0 }}>All Users</h3>
        {loading && <p>Loading...</p>}
        {!loading && users.length === 0 && <p>No users found.</p>}
        <div style={{ display: "grid", gap: 12 }}>
          {users.map((user) => (
            <div
              key={user.$id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 12,
                borderRadius: 10,
                border: "1px solid #eee",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <strong>{user.displayName}</strong>
                  <span
                    style={{
                      background: getRoleColor(user.role) + "20",
                      color: getRoleColor(user.role),
                      padding: "2px 8px",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {user.role}
                  </span>
                  {user.supportType && (
                    <span
                      style={{
                        background: "#10B98120",
                        color: "#10B981",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {user.supportType}
                    </span>
                  )}
                </div>
                <div style={{ color: "#666", fontSize: 13 }}>
                  @{user.username}
                </div>
                <div style={{ color: "#999", fontSize: 12 }}>{user.email}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => handleEdit(user)}
                  style={smallButtonStyle}
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    if (
                      !confirm(
                        `Are you sure you want to delete ${user.displayName}?`,
                      )
                    )
                      return;
                    setLoading(true);
                    try {
                      await clientBundle.databases.deleteDocument(
                        clientBundle.databaseId,
                        COLLECTION,
                        user.$id,
                      );
                      await fetchUsers();
                    } catch (e: any) {
                      setError(e.message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  style={{
                    ...smallButtonStyle,
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
