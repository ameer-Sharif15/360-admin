"use client";

import { ID, type Models } from "appwrite";
import { useEffect, useMemo, useState } from "react";
import { getClients } from "../../lib/appwrite";
import { uploadToCloudinary } from "../../lib/cloudinary";

type Room = {
  $id: string;
  name: string;
  description?: string;
  price: number;
  capacity?: number;
  quantity: number; // Added quantity
  amenities?: string[];
  images?: string[];
  branchId: string;
  available?: boolean;
};

const COLLECTION = "rooms";

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Room>>({
    branchId: "",
    price: 0,
    capacity: 1,
    quantity: 1, // Added quantity default
    amenities: [],
    available: true,
    images: [],
  });
  const [files, setFiles] = useState<FileList | null>(null);

  const clientBundle = useMemo(() => {
    try {
      return getClients();
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, []);

  const fetchRooms = async () => {
    if (!clientBundle) return;
    setLoading(true);
    setError(null);
    try {
      const res = await clientBundle.databases.listDocuments<
        Room & Models.Document
      >(clientBundle.databaseId, COLLECTION, []);
      setRooms(res.documents);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [clientBundle]);

  const handleSubmit = async () => {
    if (!clientBundle) return;
    if (!form.name || form.price === undefined) {
      setError("Name and Price are required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let imageUrls = [...(form.images || [])];
      if (files && files.length > 0) {
        const uploads = Array.from(files).map((f) =>
          uploadToCloudinary(f, "room_images"),
        );
        const newUrls = await Promise.all(uploads);
        imageUrls = [...imageUrls, ...newUrls];
      }

      const roomData = {
        name: form.name,
        description: form.description || "",
        price: Number(form.price) || 0,
        capacity: Number(form.capacity) || 1,
        quantity: Number(form.quantity) || 1, // Added quantity to payload
        amenities: form.amenities || [],
        images: imageUrls,
        branchId: "",
        available: form.available ?? true,
      };

      if (editingId) {
        await clientBundle.databases.updateDocument(
          clientBundle.databaseId,
          COLLECTION,
          editingId,
          roomData,
        );
      } else {
        await clientBundle.databases.createDocument(
          clientBundle.databaseId,
          COLLECTION,
          ID.unique(),
          roomData,
        );
      }

      resetForm();
      await fetchRooms();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      branchId: "",
      price: 0,
      capacity: 1,
      quantity: 1,
      amenities: [],
      available: true,
      images: [],
    });
    setFiles(null);
    setEditingId(null);
  };

  const handleEdit = (room: Room) => {
    setEditingId(room.$id);
    setForm({ ...room, images: room.images || [] });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRemoveImage = (index: number) => {
    setForm((f) => ({
      ...f,
      images: (f.images || []).filter((_, i) => i !== index),
    }));
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this room?")) return;
    if (!clientBundle) return;
    setLoading(true);
    setError(null);
    try {
      await clientBundle.databases.deleteDocument(
        clientBundle.databaseId,
        COLLECTION,
        id,
      );
      await fetchRooms();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div
        style={{
          background: "#fff",
          padding: 24,
          borderRadius: 16,
          boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          {editingId ? "Edit Room" : "Create Room"}
        </h2>
        {error && (
          <p
            style={{
              color: "red",
              background: "#fee2e2",
              padding: 12,
              borderRadius: 8,
            }}
          >
            {error}
          </p>
        )}
        <div
          style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}
        >
          <div>
            <label style={labelStyle}>Room Name</label>
            <input
              placeholder="Ex: Deluxe Suit"
              value={form.name || ""}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Price (₦)</label>
            <input
              type="number"
              placeholder="0"
              value={form.price ?? 0}
              onChange={(e) =>
                setForm((f) => ({ ...f, price: Number(e.target.value) }))
              }
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Capacity (Persons)</label>
            <input
              type="number"
              placeholder="1"
              value={form.capacity ?? 1}
              onChange={(e) =>
                setForm((f) => ({ ...f, capacity: Number(e.target.value) }))
              }
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Quantity (Total Rooms)</label>
            <input
              type="number"
              placeholder="1"
              value={form.quantity ?? 1}
              onChange={(e) =>
                setForm((f) => ({ ...f, quantity: Number(e.target.value) }))
              }
              style={inputStyle}
            />
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label style={labelStyle}>Amenities</label>
            <input
              placeholder="Wifi, AC, TV (comma separated)"
              value={(form.amenities || []).join(", ")}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  amenities: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              style={inputStyle}
            />
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label style={labelStyle}>Description</label>
            <textarea
              placeholder="Enter room details..."
              value={form.description || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              style={{ ...inputStyle, minHeight: 80 }}
            />
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label style={labelStyle}>Room Images Management</label>

            {/* Image Previews */}
            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 16,
              }}
            >
              {form.images?.map((url, idx) => (
                <div
                  key={idx}
                  style={{ position: "relative", width: 100, height: 75 }}
                >
                  <img
                    src={url}
                    alt="Room"
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      borderRadius: 8,
                    }}
                  />
                  <button
                    onClick={() => handleRemoveImage(idx)}
                    style={{
                      position: "absolute",
                      top: -8,
                      right: -8,
                      background: "#EF4444",
                      color: "#fff",
                      border: "none",
                      borderRadius: "50%",
                      width: 24,
                      height: 24,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFiles(e.target.files)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.available}
                  onChange={(e) =>
                    setForm({ ...form, available: e.target.checked })
                  }
                />
                Available for Booking
              </label>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
          <button onClick={handleSubmit} disabled={loading} style={buttonStyle}>
            {loading ? "Saving..." : editingId ? "Update Room" : "Save Room"}
          </button>
          {editingId && (
            <button
              onClick={resetForm}
              style={{ ...buttonStyle, background: "#6B7280" }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
        }}
      >
        {rooms.map((room) => (
          <div
            key={room.$id}
            style={{
              background: "#fff",
              padding: 20,
              borderRadius: 16,
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ display: "flex", gap: 16 }}>
              {room.images?.[0] ? (
                <img
                  src={room.images[0]}
                  alt={room.name}
                  style={{
                    width: 100,
                    height: 75,
                    objectFit: "cover",
                    borderRadius: 8,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 100,
                    height: 75,
                    background: "#f3f3f3",
                    borderRadius: 8,
                  }}
                />
              )}
              <div style={{ flex: 1 }}>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <h4 style={{ margin: 0 }}>{room.name}</h4>
                  <span
                    style={{ fontSize: 16, fontWeight: 700, color: "#ff7f50" }}
                  >
                    ₦{room.price.toLocaleString()}
                  </span>
                </div>
                <p style={{ margin: "4px 0", fontSize: 12, color: "#666" }}>
                  Capacity: {room.capacity} | Qty: {room.quantity || 1}
                </p>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 4,
                    marginTop: 4,
                  }}
                >
                  {room.amenities?.slice(0, 3).map((a) => (
                    <span
                      key={a}
                      style={{
                        fontSize: 10,
                        background: "#f3f4f6",
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => handleEdit(room)} style={smallButtonStyle}>
                Edit
              </button>
              <button
                onClick={() => handleDelete(room.$id)}
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
        {rooms.length === 0 && !loading && <p>No rooms found.</p>}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
  marginBottom: 6,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  padding: "12px",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  transition: "border-color 0.2s",
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 24px",
  borderRadius: 10,
  border: "none",
  background: "#ff7f50",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const smallButtonStyle: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 8,
  border: "none",
  background: "#f3f4f6",
  color: "#1E1E1E",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
