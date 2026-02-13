"use client";

import { ID, Query, type Models } from "appwrite";
import { useEffect, useMemo, useState } from "react";
import { getClients } from "../../lib/appwrite";
import { uploadToCloudinary } from "../../lib/cloudinary";

type StaffMember = {
  $id: string;
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  employeeId?: string;
  description?: string;
  photoUrl?: string; // URL of the uploaded photo
  active: boolean;
};

const COLLECTION_KEY = "STAFF_MEMBERS";

export default function StaffsPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<StaffMember>>({ active: true });
  const [showCardModal, setShowCardModal] = useState(false);
  const [previewMembers, setPreviewMembers] = useState<StaffMember[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Image Upload State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const clientBundle = useMemo(() => {
    try {
      return getClients();
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, []);

  const fetchStaff = async () => {
    if (!clientBundle) return;
    setLoading(true);
    try {
      const res = await clientBundle.databases.listDocuments<
        StaffMember & Models.Document
      >(clientBundle.databaseId, clientBundle.COLLECTIONS[COLLECTION_KEY], [
        Query.orderDesc("$createdAt"),
      ]);
      setStaff(res.documents);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [clientBundle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientBundle) return;
    setLoading(true);
    try {
      let finalPhotoUrl = form.photoUrl;

      // Upload image if selected
      if (imageFile) {
        setUploadingImage(true);
        try {
          finalPhotoUrl = await uploadToCloudinary(imageFile, "staff_photos");
        } catch (uploadError: any) {
          console.error("Image upload failed:", uploadError);
          setError("Failed to upload image: " + uploadError.message);
          setUploadingImage(false);
          setLoading(false);
          return; // Stop submission on upload failure
        }
        setUploadingImage(false);
      }

      const { databases, databaseId, COLLECTIONS } = clientBundle;
      const dataToSave = { ...form, photoUrl: finalPhotoUrl };

      if (editingId) {
        await databases.updateDocument(
          databaseId,
          COLLECTIONS[COLLECTION_KEY],
          editingId,
          dataToSave,
        );
      } else {
        await databases.createDocument(
          databaseId,
          COLLECTIONS[COLLECTION_KEY],
          ID.unique(),
          dataToSave,
        );
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ active: true });
      setImageFile(null); // Reset image file
      await fetchStaff();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (member: StaffMember) => {
    setEditingId(member.$id);
    setForm(member);
    setImageFile(null); // Reset image file when editing new member
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this staff member?")) return;
    if (!clientBundle) return;
    setLoading(true);
    try {
      const { databases, databaseId, COLLECTIONS } = clientBundle;
      await databases.deleteDocument(
        databaseId,
        COLLECTIONS[COLLECTION_KEY],
        id,
      );
      await fetchStaff();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setShowForm(!showForm);
    setEditingId(null);
    setForm({ active: true });
    setImageFile(null);
  };

  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkGenerate = () => {
    const selectedMembers = staff.filter((s) => selectedIds.has(s.$id));
    setPreviewMembers(selectedMembers);
    setShowCardModal(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(staff.map((s) => s.$id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 style={{ margin: 0 }}>Staff Directory</h2>
        <div style={{ display: "flex", gap: 12 }}>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkGenerate}
              style={{ ...buttonStyle, background: "#3B82F6" }}
            >
              Generate IDs ({selectedIds.size})
            </button>
          )}
          <button onClick={handleCreateNew} style={buttonStyle}>
            {showForm ? "Cancel" : "+ Add Staff"}
          </button>
        </div>
      </div>

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

      {showForm && (
        <form onSubmit={handleSubmit} style={cardStyle}>
          <h3>{editingId ? "Edit Staff Member" : "Add New Staff Member"}</h3>
          <div
            style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}
          >
            <label style={labelStyle}>
              Full Name *
              <input
                placeholder="Ex: John Doe"
                required
                value={form.name || ""}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Email
              <input
                placeholder="Ex: john@example.com"
                type="email"
                value={form.email || ""}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Phone Number
              <input
                placeholder="Ex: 08012345678"
                value={form.phone || ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Employee ID
              <input
                placeholder="Ex: EMP-001"
                value={form.employeeId || ""}
                onChange={(e) =>
                  setForm({ ...form, employeeId: e.target.value })
                }
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Department
              <input
                placeholder="Ex: IT"
                value={form.department || ""}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value })
                }
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Position / Rank
              <input
                placeholder="Ex: Software Engineer"
                value={form.position || ""}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                style={inputStyle}
              />
            </label>

            <label style={{ ...labelStyle, gridColumn: "span 2" }}>
              Staff Photo
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Image Preview */}
                {(imageFile || form.photoUrl) && (
                  <div
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 8,
                      overflow: "hidden",
                      border: "1px solid #ccc",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={
                        imageFile
                          ? URL.createObjectURL(imageFile)
                          : form.photoUrl
                      }
                      alt="Preview"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setImageFile(e.target.files[0]);
                    }
                  }}
                  style={inputStyle}
                />
              </div>
            </label>

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
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active Member
            </label>
          </div>
          <label style={{ ...labelStyle, marginTop: 16 }}>
            Staff Description
            <textarea
              placeholder="Additional details about the staff member..."
              value={form.description || ""}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              style={{
                ...inputStyle,
                minHeight: 80,
              }}
            />
          </label>
          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button
              type="submit"
              disabled={loading || uploadingImage}
              style={buttonStyle}
            >
              {loading || uploadingImage
                ? "Saving..."
                : editingId
                  ? "Update Staff"
                  : "Create Staff"}
            </button>
          </div>
        </form>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          <input
            type="checkbox"
            onChange={(e) => handleSelectAll(e.target.checked)}
            checked={staff.length > 0 && selectedIds.size === staff.length}
          />
          Select All
        </label>
        <span style={{ fontSize: 14, color: "#666" }}>
          {selectedIds.size} selected
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        }}
      >
        {staff.map((member) => (
          <div key={member.$id} style={{ ...cardStyle, position: "relative" }}>
            <div
              style={{
                position: "absolute",
                top: 16,
                left: 16,
                zIndex: 10,
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(member.$id)}
                onChange={() => toggleSelection(member.$id)}
                style={{ width: 18, height: 18, cursor: "pointer" }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "start",
                paddingLeft: 30, // Make space for checkbox
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: 18 }}>{member.name}</h4>
                <p style={{ margin: "4px 0", fontSize: 14, color: "#666" }}>
                  {member.position} • {member.department}
                </p>
              </div>
              <span
                style={{
                  background: member.active ? "#D1FAE5" : "#F3F4F6",
                  color: member.active ? "#10B981" : "#6B7280",
                  padding: "2px 8px",
                  borderRadius: 99,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                {member.active ? "Active" : "Inactive"}
              </span>
            </div>

            <div style={{ margin: "16px 0", fontSize: 13, color: "#444" }}>
              <div>📧 {member.email || "No email"}</div>
              <div>📞 {member.phone || "No phone"}</div>
              <div>🆔 {member.employeeId || "No ID"}</div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
              <button
                onClick={() => {
                  setPreviewMembers([member]);
                  setShowCardModal(true);
                }}
                style={{
                  ...smallButtonStyle,
                  background: "#EFF6FF",
                  color: "#1D4ED8",
                }}
              >
                Generate Card
              </button>
              <button
                onClick={() => handleEdit(member)}
                style={smallButtonStyle}
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(member.$id)}
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
        {staff.length === 0 && !loading && <p>No staff members found.</p>}
      </div>

      {showCardModal && previewMembers.length > 0 && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <h3 style={{ margin: 0 }}>
                Staff ID Cards ({previewMembers.length})
              </h3>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    ...buttonStyle,
                    padding: "8px 16px",
                    background: "#333",
                  }}
                >
                  Print
                </button>
                <button
                  onClick={() => {
                    setShowCardModal(false);
                    setPreviewMembers([]);
                  }}
                  style={{
                    ...buttonStyle,
                    padding: "8px 16px",
                    background: "#EF4444",
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            <div
              className="print-area"
              style={{
                display: "flex",
                gap: 40,
                flexWrap: "wrap",
                justifyContent: "center",
                // For printing, we might want page breaks or specific grid
              }}
            >
              {previewMembers.map((member) => (
                <div
                  key={member.$id}
                  style={{
                    display: "flex",
                    gap: 20,
                    marginBottom: 40,
                    pageBreakInside: "avoid", // Prevent splitting card across pages
                  }}
                >
                  {/* Front of Card */}
                  <div style={idCardStyle}>
                    <div style={idCardHeaderStyle}>
                      {/* Logo Placeholder */}
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          background: "#fff",
                          margin: "0 auto 5px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src="/logo.png"
                          alt="Logo"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                          }}
                        />
                      </div>
                      <h4
                        style={{
                          margin: 0,
                          fontSize: 13,
                          fontWeight: 900,
                          letterSpacing: 0.5,
                          lineHeight: 1.1,
                        }}
                      >
                        360 DEGREE GLOBAL ESTATE LTD.
                      </h4>
                      <div
                        style={{
                          fontSize: 7,
                          fontWeight: 600,
                          marginTop: 2,
                          lineHeight: 1.1,
                          opacity: 0.9,
                        }}
                      >
                        ADDRESS: NSUK 2nd Gate, Behind Princess Sarah Hotel
                        <br />
                        Keffi, Nasarawa State.
                        <br />
                        TEL: 08038923692, 08136661966
                        <br />
                        WEBSITE: www.360degreeglobal.org
                        <br />
                        EMAIL: info@360degreeglobal.org
                      </div>
                    </div>

                    <div
                      style={{
                        position: "relative",
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        padding: "4px 0",
                      }}
                    >
                      {/* Side Text */}
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 10,
                          bottom: 10,
                          width: 24,
                          background: "#ff7f50", // Orange accent
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderTopRightRadius: 8,
                          borderBottomRightRadius: 8,
                        }}
                      >
                        <span
                          style={{
                            writingMode: "vertical-rl",
                            transform: "rotate(180deg)",
                            color: "#fff",
                            fontWeight: 800,
                            fontSize: 11,
                            letterSpacing: 1.5,
                          }}
                        >
                          STAFF IDENTITY CARD
                        </span>
                      </div>

                      {/* Photo Frame */}
                      <div
                        style={{
                          width: 100,
                          height: 110,
                          background: "#fff",
                          border: "3px solid #ff7f50",
                          borderRadius: 12,
                          overflow: "hidden",
                          marginBottom: 4,
                          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        }}
                      >
                        {member.photoUrl ? (
                          <img
                            src={member.photoUrl}
                            alt="Staff"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              background: "#eee",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 40,
                            }}
                          >
                            👤
                          </div>
                        )}
                      </div>

                      <div
                        style={{
                          textAlign: "center",
                          width: "100%",
                          paddingLeft: 24,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 9,
                            color: "#cf1322",
                            fontWeight: 800,
                          }}
                        >
                          NAME:
                        </div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 900,
                            color: "#1a365d",
                            textTransform: "uppercase",
                            marginBottom: 2,
                            lineHeight: 1.1,
                          }}
                        >
                          {member.name}
                        </div>

                        <div
                          style={{
                            fontSize: 9,
                            color: "#cf1322",
                            fontWeight: 800,
                          }}
                        >
                          RANK:{" "}
                          <span style={{ color: "#1a365d" }}>
                            {member.position || "STAFF"}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: 9,
                            color: "#cf1322",
                            fontWeight: 800,
                          }}
                        >
                          ID NO:{" "}
                          <span style={{ color: "#1a365d" }}>
                            {member.employeeId || "N/A"}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: 9,
                            color: "#cf1322",
                            fontWeight: 800,
                          }}
                        >
                          PHONE:{" "}
                          <span style={{ color: "#1a365d" }}>
                            {member.phone || "N/A"}
                          </span>
                        </div>

                        <div
                          style={{
                            fontSize: 9,
                            color: "#cf1322",
                            fontWeight: 800,
                            wordBreak: "break-all",
                            lineHeight: 1,
                          }}
                        >
                          EMAIL:{" "}
                          <span style={{ color: "#1a365d" }}>
                            {member.email || "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Accents */}
                    <div style={{ height: 10, display: "flex" }}>
                      <div style={{ flex: 1, background: "#1a365d" }}></div>
                      <div style={{ width: 20, background: "#ff7f50" }}></div>
                      <div style={{ flex: 1, background: "#1a365d" }}></div>
                    </div>
                  </div>

                  {/* Back of Card */}
                  <div style={idCardStyle}>
                    <div
                      style={{
                        padding: 20,
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        height: "100%",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: 10,
                            fontStyle: "italic",
                            fontWeight: 600,
                            color: "#1a365d",
                            marginBottom: 10,
                          }}
                        >
                          This is to certify that the holder whose Name,
                          Photograph and Signature appears on the front is a
                          staff of
                        </div>
                        <h4
                          style={{
                            margin: "0 0 10px",
                            fontSize: 14,
                            fontWeight: 900,
                            color: "#1a365d",
                          }}
                        >
                          360 DEGREE
                          <br />
                          GLOBAL ESTATE LTD.
                        </h4>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          margin: "10px 0",
                        }}
                      >
                        {/* QR Code */}
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${member.$id}`}
                          alt="QR Code"
                          style={{
                            width: 80,
                            height: 80,
                            border: "1px solid #eee",
                          }}
                        />
                      </div>

                      <div>
                        <div
                          style={{
                            fontSize: 9,
                            fontStyle: "italic",
                            color: "#1a365d",
                            marginBottom: 20,
                          }}
                        >
                          If found, Please return to the above address or to the
                          nearest Police Station.
                        </div>

                        <div
                          style={{
                            width: 120,
                            borderBottom: "1px solid #1a365d",
                            margin: "0 auto 4px",
                          }}
                        ></div>
                        <div
                          style={{
                            fontSize: 8,
                            fontWeight: 700,
                            color: "#1a365d",
                          }}
                        >
                          Authorised Signature
                        </div>

                        {/* Barcode Mockup */}
                        <div
                          style={{
                            marginTop: 10,
                            height: 20,
                            background:
                              "repeating-linear-gradient(90deg, #000, #000 1px, #fff 1px, #fff 2px)",
                            width: "80%",
                            margin: "10px auto 0",
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <style jsx global>{`
              @media print {
                body * {
                  visibility: hidden;
                }
                .print-area,
                .print-area * {
                  visibility: visible;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .print-area {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  display: flex;
                  gap: 20px;
                }
              }
            `}</style>
          </div>
        </div>
      )}
    </div>
  );
}

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  padding: 24,
  borderRadius: 16,
  width: "90%",
  maxWidth: 800,
  maxHeight: "90vh",
  overflowY: "auto",
  boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
};

const idCardStyle: React.CSSProperties = {
  width: 240, // Reduced scale for screen (standard ID ratio approx 86x54mm)
  height: 380, // Portrait orientation
  backgroundColor: "#fff",
  borderRadius: 12,
  overflow: "hidden",
  boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  border: "1px solid #eee",
};

const idCardHeaderStyle: React.CSSProperties = {
  backgroundColor: "#1a365d", // Dark blue
  color: "#fff",
  padding: "12px 8px",
  textAlign: "center",
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  padding: 24,
  borderRadius: 16,
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  display: "flex",
  flexDirection: "column",
};

const inputStyle: React.CSSProperties = {
  padding: "12px",
  borderRadius: 8,
  border: "1px solid #e5e5e5",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
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
  padding: "6px 12px",
  borderRadius: 6,
  border: "none",
  background: "#f3f4f6",
  color: "#1E1E1E",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  fontSize: 14,
  fontWeight: 600,
  color: "#374151",
};
