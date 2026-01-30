"use client";

import { ID, Query, type Models } from "appwrite";
import { useEffect, useMemo, useState } from "react";
import { getClients } from "../../lib/appwrite";

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

export default function SellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(false);
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

  const handleEdit = (seller: Seller) => {
    setEditingSeller(seller);
    setForm({
      displayName: seller.displayName,
      location: seller.location,
    });
  };

  const handleSave = async () => {
    if (!clientBundle || !editingSeller) return;
    setLoading(true);
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
          role: "support",
          supportType: "seller",
          location: createForm.location || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create seller");
      }

      setSuccess(
        `Seller "${createForm.displayName}" created successfully! They can now log in with email: ${createForm.email}`,
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
      setLoading(false);
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
          <h2 style={{ marginTop: 0 }}>Sellers Management</h2>
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
            <h3>Create New Seller</h3>
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
            <input
              placeholder="Location (optional, e.g., Abuja, Lagos)"
              value={createForm.location || ""}
              onChange={(e) =>
                setCreateForm((f) => ({ ...f, location: e.target.value }))
              }
              style={inputStyle}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleCreate}
                disabled={loading}
                style={buttonStyle}
              >
                {loading ? "Creating..." : "Create Seller"}
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateForm({
                    role: "support",
                    supportType: "seller",
                    username: "",
                    displayName: "",
                    email: "",
                    password: "",
                    location: "",
                  });
                }}
                style={secondaryButtonStyle}
              >
                Cancel
              </button>
            </div>
            <p style={{ fontSize: 12, color: "#666", margin: 0 }}>
              Note: This creates an Appwrite account and seller profile. The
              seller can log in immediately with the provided password and
              change it later.
            </p>
          </div>
        )}
        {editingSeller && (
          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            <h3>Edit Seller: {editingSeller.displayName}</h3>
            <input
              placeholder="Display Name"
              value={form.displayName || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, displayName: e.target.value }))
              }
              style={inputStyle}
            />
            <input
              placeholder="Location (optional)"
              value={form.location || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, location: e.target.value }))
              }
              style={inputStyle}
            />
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

      <div
        style={{
          background: "#fff",
          padding: 16,
          borderRadius: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
        }}
      >
        <h3 style={{ marginTop: 0 }}>All Sellers</h3>
        {loading && <p>Loading...</p>}
        {!loading && sellers.length === 0 && <p>No sellers found.</p>}
        <div style={{ display: "grid", gap: 12 }}>
          {sellers.map((seller) => (
            <div
              key={seller.$id}
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
                  <strong>{seller.displayName}</strong>
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
                    seller
                  </span>
                  {seller.location && (
                    <span
                      style={{
                        background: "#3B82F620",
                        color: "#3B82F6",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {seller.location}
                    </span>
                  )}
                </div>
                <div style={{ color: "#666", fontSize: 13 }}>
                  @{seller.username}
                </div>
                <div style={{ color: "#999", fontSize: 12 }}>
                  {seller.email}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => handleEdit(seller)}
                  style={smallButtonStyle}
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    if (
                      !confirm(
                        `Are you sure you want to delete ${seller.displayName}?`,
                      )
                    )
                      return;
                    setLoading(true);
                    try {
                      await clientBundle.databases.deleteDocument(
                        clientBundle.databaseId,
                        COLLECTION,
                        seller.$id,
                      );
                      await fetchSellers();
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
