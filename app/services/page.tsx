"use client";

import { useEffect, useMemo, useState } from "react";
import { ID, Query } from "appwrite";
import { getClients } from "../../lib/appwrite";
import { uploadToCloudinary } from "../../lib/cloudinary";

type Service = {
  $id: string;
  name: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  branchId: string;
};

const COLLECTION = "services";

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Service>>({ branchId: "" }); // branchId kept for backward compatibility, set to empty string
  const [file, setFile] = useState<File | null>(null);

  const clientBundle = useMemo(() => {
    try {
      return getClients();
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, []);

  const fetchServices = async () => {
    if (!clientBundle) return;
    setLoading(true);
    setError(null);
    try {
      const res = await clientBundle.databases.listDocuments<Service>(
        clientBundle.databaseId,
        COLLECTION,
        [] // No branchId filtering - single branch system
      );
      setServices(res.documents);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (!clientBundle) return;
    if (!form.name) {
      setError("Name is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let imageUrl = form.imageUrl;
      if (file) {
        imageUrl = await uploadToCloudinary(file, "services");
      }

      await clientBundle.databases.createDocument(clientBundle.databaseId, COLLECTION, ID.unique(), {
        name: form.name,
        description: form.description || "",
        icon: form.icon || "",
        imageUrl: imageUrl || "",
        branchId: "", // Single branch system - empty string
      });
      setForm({ branchId: "" });
      setFile(null);
      await fetchServices();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!clientBundle) return;
    setLoading(true);
    setError(null);
    try {
      await clientBundle.databases.deleteDocument(clientBundle.databaseId, COLLECTION, id);
      await fetchServices();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ background: "#fff", padding: 16, borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
        <h2 style={{ marginTop: 0 }}>Create / Update Service</h2>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <div style={{ display: "grid", gap: 12 }}>
          <input
            placeholder="Name"
            value={form.name || ""}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            style={inputStyle}
          />
          <textarea
            placeholder="Description"
            value={form.description || ""}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            style={inputStyle}
          />
          <input
            placeholder="Icon (Ionicons name optional)"
            value={form.icon || ""}
            onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            style={inputStyle}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            style={inputStyle}
          />
          <button onClick={handleSubmit} disabled={loading} style={buttonStyle}>
            {loading ? "Saving..." : "Save Service"}
          </button>
        </div>
      </div>

      <div style={{ background: "#fff", padding: 16, borderRadius: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
        <h3 style={{ marginTop: 0 }}>Services</h3>
        {loading && <p>Loading...</p>}
        {!loading && services.length === 0 && <p>No services found.</p>}
        <div style={{ display: "grid", gap: 12 }}>
          {services.map((svc) => (
            <div
              key={svc.$id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: 12,
                borderRadius: 10,
                border: "1px solid #eee",
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                {svc.imageUrl ? (
                  <img src={svc.imageUrl} alt={svc.name} style={{ width: 60, height: 40, objectFit: "cover", borderRadius: 8 }} />
                ) : (
                  <div style={{ width: 60, height: 40, background: "#f3f3f3", borderRadius: 8 }} />
                )}
                <div>
                  <strong>{svc.name}</strong>
                  <div style={{ color: "#666", fontSize: 13 }}>{svc.description}</div>
                </div>
              </div>
              <button onClick={() => handleDelete(svc.$id)} style={dangerButtonStyle}>
                Delete
              </button>
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
  padding: "12px 16px",
  borderRadius: 10,
  border: "none",
  background: "#ff7f50",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const dangerButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "#f43f5e",
};

