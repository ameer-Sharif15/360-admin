"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getClients, ID, Query, type Models } from "../../lib/appwrite";
import { uploadToCloudinary } from "../../lib/cloudinary";

export type StaffDocument = {
  title: string;
  fileUrl: string;
  fileType?: string;
  uploadedAt?: string;
};

export type StaffMember = {
  $id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  employeeId?: string;
  description?: string;
  photoUrl?: string;
  signatureUrl?: string;
  active: boolean;
  // Salary & Banking
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  basicSalary?: number;
  allowances?: number;
  deductions?: number;
  netSalary?: number;
  // Layout customization
  idCardLayout?: {
    photoX?: number;
    photoY?: number;
    photoScale?: number;
    signatureX?: number;
    signatureY?: number;
    signatureScale?: number;
  };
  // Documents
  documents?: StaffDocument[];
};

const COLLECTION_KEY = "STAFF_MEMBERS";

export default function StaffsPage() {
  const [activeTab, setActiveTab] = useState<"directory" | "salary" | "documents">("directory");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<StaffMember>>({
    active: true,
    basicSalary: 0,
    allowances: 0,
    deductions: 0,
    netSalary: 0,
  });

  // Photo & Signature Upload State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Document Vault State
  const [selectedStaffForDocs, setSelectedStaffForDocs] = useState<StaffMember | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Card Modal & Selection State
  const [showCardModal, setShowCardModal] = useState(false);
  const [previewMembers, setPreviewMembers] = useState<StaffMember[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Interactive Card Customizer Coordinates (Global or Per-Card default)
  const [cardLayout, setCardLayout] = useState({
    photoX: 0,
    photoY: 0,
    photoScale: 100,
    signatureX: 0,
    signatureY: 0,
    signatureScale: 100,
  });

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
      if (selectedStaffForDocs) {
        const updated = res.documents.find((s) => s.$id === selectedStaffForDocs.$id);
        if (updated) setSelectedStaffForDocs(updated);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [clientBundle]);

  // Recalculate Net Salary automatically
  const handleSalaryChange = (field: "basicSalary" | "allowances" | "deductions", val: number) => {
    const updated = {
      ...form,
      [field]: val,
    };
    const basic = Number(field === "basicSalary" ? val : updated.basicSalary) || 0;
    const allow = Number(field === "allowances" ? val : updated.allowances) || 0;
    const deduct = Number(field === "deductions" ? val : updated.deductions) || 0;
    updated.netSalary = Math.max(0, basic + allow - deduct);
    setForm(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientBundle) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      let finalPhotoUrl = form.photoUrl || "";
      let finalSignatureUrl = form.signatureUrl || "";

      // Upload Photo if new file selected
      if (imageFile) {
        setUploadingImage(true);
        try {
          finalPhotoUrl = await uploadToCloudinary(imageFile, "staff_photos");
        } catch (uploadError: any) {
          setError("Failed to upload photo: " + uploadError.message);
          setLoading(false);
          setUploadingImage(false);
          return;
        }
        setUploadingImage(false);
      }

      // Upload Signature if new file selected
      if (signatureFile) {
        try {
          finalSignatureUrl = await uploadToCloudinary(signatureFile, "staff_signatures");
        } catch (uploadError: any) {
          setError("Failed to upload signature: " + uploadError.message);
          setLoading(false);
          return;
        }
      }

      const { databases, databaseId, COLLECTIONS } = clientBundle;
      const dataToSave: any = {
        ...form,
        role: form.role || "staff",
        photoUrl: finalPhotoUrl,
        signatureUrl: finalSignatureUrl,
        basicSalary: Number(form.basicSalary) || 0,
        allowances: Number(form.allowances) || 0,
        deductions: Number(form.deductions) || 0,
        netSalary: Number(form.netSalary) || 0,
        idCardLayout: cardLayout,
      };

      if (editingId) {
        await databases.updateDocument(
          databaseId,
          COLLECTIONS[COLLECTION_KEY],
          editingId,
          dataToSave
        );
        setSuccessMsg("Staff member updated successfully!");
      } else {
        await databases.createDocument(
          databaseId,
          COLLECTIONS[COLLECTION_KEY],
          ID.unique(),
          dataToSave
        );
        setSuccessMsg("New staff member created successfully!");
      }

      setShowForm(false);
      setEditingId(null);
      setForm({ active: true, basicSalary: 0, allowances: 0, deductions: 0, netSalary: 0 });
      setImageFile(null);
      setSignatureFile(null);
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
    if (member.idCardLayout) {
      setCardLayout({
        photoX: member.idCardLayout.photoX || 0,
        photoY: member.idCardLayout.photoY || 0,
        photoScale: member.idCardLayout.photoScale || 100,
        signatureX: member.idCardLayout.signatureX || 0,
        signatureY: member.idCardLayout.signatureY || 0,
        signatureScale: member.idCardLayout.signatureScale || 100,
      });
    }
    setImageFile(null);
    setSignatureFile(null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this staff member?")) return;
    if (!clientBundle) return;
    setLoading(true);
    try {
      const { databases, databaseId, COLLECTIONS } = clientBundle;
      await databases.deleteDocument(databaseId, COLLECTIONS[COLLECTION_KEY], id);
      await fetchStaff();
      setSuccessMsg("Staff member deleted successfully");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
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

  const handleSingleGenerate = (member: StaffMember) => {
    setPreviewMembers([member]);
    if (member.idCardLayout) {
      setCardLayout({
        photoX: member.idCardLayout.photoX || 0,
        photoY: member.idCardLayout.photoY || 0,
        photoScale: member.idCardLayout.photoScale || 100,
        signatureX: member.idCardLayout.signatureX || 0,
        signatureY: member.idCardLayout.signatureY || 0,
        signatureScale: member.idCardLayout.signatureScale || 100,
      });
    }
    setShowCardModal(true);
  };

  // CSV Export for Salary & Bank Payroll Schedule
  const downloadPayrollCSV = () => {
    const headers = [
      "Staff Name",
      "Employee ID",
      "Department",
      "Position",
      "Bank Name",
      "Account Number",
      "Account Name",
      "Basic Salary (NGN)",
      "Allowances (NGN)",
      "Deductions (NGN)",
      "Net Salary (NGN)",
    ];

    const rows = staff.map((s) => [
      `"${s.name || ""}"`,
      `"${s.employeeId || ""}"`,
      `"${s.department || ""}"`,
      `"${s.position || ""}"`,
      `"${s.bankName || ""}"`,
      `"${s.accountNumber ? `\t${s.accountNumber}` : ""}"`,
      `"${s.accountName || s.name || ""}"`,
      s.basicSalary || 0,
      s.allowances || 0,
      s.deductions || 0,
      s.netSalary || (Number(s.basicSalary || 0) + Number(s.allowances || 0) - Number(s.deductions || 0)),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `360_Staff_Payroll_Schedule_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Document Vault Upload
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffForDocs || !docFile || !docTitle) {
      alert("Please select staff, provide a document title, and choose a file");
      return;
    }
    if (!clientBundle) return;
    setUploadingDoc(true);
    try {
      const fileUrl = await uploadToCloudinary(docFile, "staff_documents");
      const newDoc: StaffDocument = {
        title: docTitle,
        fileUrl,
        fileType: docFile.type || "file",
        uploadedAt: new Date().toISOString(),
      };

      const existingDocs = selectedStaffForDocs.documents || [];
      const updatedDocs = [...existingDocs, newDoc];

      const { databases, databaseId, COLLECTIONS } = clientBundle;
      await databases.updateDocument(
        databaseId,
        COLLECTIONS[COLLECTION_KEY],
        selectedStaffForDocs.$id,
        { documents: updatedDocs }
      );

      setDocTitle("");
      setDocFile(null);
      setSuccessMsg(`Document "${docTitle}" uploaded successfully!`);
      await fetchStaff();
    } catch (err: any) {
      setError("Failed to upload document: " + err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (docIndex: number) => {
    if (!selectedStaffForDocs || !clientBundle) return;
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      const existingDocs = [...(selectedStaffForDocs.documents || [])];
      existingDocs.splice(docIndex, 1);
      const { databases, databaseId, COLLECTIONS } = clientBundle;
      await databases.updateDocument(
        databaseId,
        COLLECTIONS[COLLECTION_KEY],
        selectedStaffForDocs.$id,
        { documents: existingDocs }
      );
      setSuccessMsg("Document removed successfully!");
      await fetchStaff();
    } catch (err: any) {
      setError("Failed to delete document: " + err.message);
    }
  };

  return (
    <div style={{ display: "grid", gap: 24 }}>
      {/* Top Header & Tab Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 6px", fontSize: 24, fontWeight: 800 }}>Staff Management</h2>
          <p style={{ margin: 0, color: "#666", fontSize: 14 }}>
            ID Cards, Staff Verification, Attendance, Payroll & Documents
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {selectedIds.size > 0 && activeTab === "directory" && (
            <button onClick={handleBulkGenerate} style={{ ...buttonStyle, background: "#3B82F6" }}>
              🪪 Generate Selected IDs ({selectedIds.size})
            </button>
          )}

          {activeTab === "salary" && (
            <button onClick={downloadPayrollCSV} style={{ ...buttonStyle, background: "#10B981" }}>
              📥 Download Payroll CSV
            </button>
          )}

          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setForm({ active: true, basicSalary: 0, allowances: 0, deductions: 0, netSalary: 0 });
              setImageFile(null);
              setSignatureFile(null);
            }}
            style={buttonStyle}
          >
            {showForm ? "Cancel" : "+ Add Staff Member"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "2px solid #E5E7EB",
          gap: 24,
          fontSize: 15,
          fontWeight: 700,
        }}
      >
        <button
          onClick={() => setActiveTab("directory")}
          style={{
            padding: "12px 0",
            background: "none",
            border: "none",
            borderBottom: activeTab === "directory" ? "3px solid #ff7f50" : "none",
            color: activeTab === "directory" ? "#ff7f50" : "#6B7280",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          👥 Staff Directory & ID Cards
        </button>
        <button
          onClick={() => setActiveTab("salary")}
          style={{
            padding: "12px 0",
            background: "none",
            border: "none",
            borderBottom: activeTab === "salary" ? "3px solid #ff7f50" : "none",
            color: activeTab === "salary" ? "#ff7f50" : "#6B7280",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          💰 Salary & Account Store (CRUD)
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          style={{
            padding: "12px 0",
            background: "none",
            border: "none",
            borderBottom: activeTab === "documents" ? "3px solid #ff7f50" : "none",
            color: activeTab === "documents" ? "#ff7f50" : "#6B7280",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          📁 Staff Document Records
        </button>
      </div>

      {/* Alert Messages */}
      {error && (
        <p style={{ color: "red", background: "#fee2e2", padding: 12, borderRadius: 8, margin: 0 }}>
          ⚠️ {error}
        </p>
      )}
      {successMsg && (
        <p style={{ color: "#065F46", background: "#D1FAE5", padding: 12, borderRadius: 8, margin: 0 }}>
          ✅ {successMsg}
        </p>
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={cardStyle}>
          <h3 style={{ margin: "0 0 20px" }}>{editingId ? "Edit Staff Profile & Details" : "Register New Staff Member"}</h3>

          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}>
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
              Staff / Employee ID
              <input
                placeholder="Ex: 360-STF-014"
                value={form.employeeId || ""}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Email Address
              <input
                placeholder="Ex: john@360degreeglobal.org"
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
              Department
              <input
                placeholder="Ex: Security, Front Desk, Kitchen, Management"
                value={form.department || ""}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                style={inputStyle}
              />
            </label>

            <label style={labelStyle}>
              Rank / Position
              <input
                placeholder="Ex: Senior Supervisor, Receptionist"
                value={form.position || ""}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                style={inputStyle}
              />
            </label>

            {/* Passport Photo Upload */}
            <div style={{ gridColumn: "span 2", background: "#F9FAFB", padding: 16, borderRadius: 12 }}>
              <label style={{ ...labelStyle, marginBottom: 8 }}>Staff Passport Photograph</label>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                {form.photoUrl && !imageFile && (
                  <img
                    src={form.photoUrl}
                    alt="Current Photo"
                    style={{ width: 60, height: 70, objectFit: "cover", borderRadius: 8, border: "2px solid #ff7f50" }}
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files ? e.target.files[0] : null)}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Authorized / Staff Signature Upload */}
            <div style={{ gridColumn: "span 2", background: "#F9FAFB", padding: 16, borderRadius: 12 }}>
              <label style={{ ...labelStyle, marginBottom: 8 }}>Staff / Authorized Signature Image</label>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                {form.signatureUrl && !signatureFile && (
                  <img
                    src={form.signatureUrl}
                    alt="Current Signature"
                    style={{ height: 40, objectFit: "contain", background: "#fff", padding: 4, borderRadius: 4, border: "1px solid #ccc" }}
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSignatureFile(e.target.files ? e.target.files[0] : null)}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Salary & Bank Section */}
            <div style={{ gridColumn: "span 2", borderTop: "1px solid #E5E7EB", paddingTop: 16, marginTop: 8 }}>
              <h4 style={{ margin: "0 0 16px", color: "#1F2937", fontSize: 16 }}>💰 Banking & Salary Information</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <label style={labelStyle}>
                  Bank Name
                  <input
                    placeholder="Ex: Zenith Bank, GTBank"
                    value={form.bankName || ""}
                    onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                    style={inputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  Account Number
                  <input
                    placeholder="Ex: 0123456789"
                    value={form.accountNumber || ""}
                    onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                    style={inputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  Account Name
                  <input
                    placeholder="Ex: John Doe"
                    value={form.accountName || ""}
                    onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                    style={inputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  Basic Salary (₦)
                  <input
                    type="number"
                    min="0"
                    placeholder="50000"
                    value={form.basicSalary || ""}
                    onChange={(e) => handleSalaryChange("basicSalary", Number(e.target.value))}
                    style={inputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  Allowances (₦)
                  <input
                    type="number"
                    min="0"
                    placeholder="10000"
                    value={form.allowances || ""}
                    onChange={(e) => handleSalaryChange("allowances", Number(e.target.value))}
                    style={inputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  Deductions (₦)
                  <input
                    type="number"
                    min="0"
                    placeholder="2000"
                    value={form.deductions || ""}
                    onChange={(e) => handleSalaryChange("deductions", Number(e.target.value))}
                    style={inputStyle}
                  />
                </label>
              </div>

              <div style={{ marginTop: 14, padding: 12, background: "#EFF6FF", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: "#1E40AF" }}>Calculated Net Salary:</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: "#1E3A8A" }}>
                  ₦{(form.netSalary || 0).toLocaleString()}
                </span>
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, gridColumn: "span 2", marginTop: 8 }}>
              <input
                type="checkbox"
                checked={form.active ?? true}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              <span style={{ fontSize: 14, fontWeight: 600 }}>Active Staff Member</span>
            </label>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
            <button type="submit" disabled={loading || uploadingImage} style={buttonStyle}>
              {loading || uploadingImage ? "Saving..." : editingId ? "Save Changes" : "Create Staff Profile"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              style={{ ...buttonStyle, background: "#9CA3AF" }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* VIEW 1: STAFF DIRECTORY & ID CARDS */}
      {activeTab === "directory" && (
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <span style={{ fontSize: 14, color: "#666" }}>Total Staff: {staff.length}</span>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={staff.length > 0 && selectedIds.size === staff.length}
                onChange={(e) => {
                  if (e.target.checked) setSelectedIds(new Set(staff.map((s) => s.$id)));
                  else setSelectedIds(new Set());
                }}
              />
              Select All for ID Printing
            </label>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #f3f4f6" }}>
                  <th style={{ padding: "12px 8px" }}></th>
                  <th style={{ padding: 12 }}>Photo</th>
                  <th style={{ padding: 12 }}>Staff Details</th>
                  <th style={{ padding: 12 }}>Department & Rank</th>
                  <th style={{ padding: 12 }}>Status</th>
                  <th style={{ padding: 12, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr key={member.$id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 8px" }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(member.$id)}
                        onChange={() => toggleSelection(member.$id)}
                      />
                    </td>
                    <td style={{ padding: 12 }}>
                      <div
                        style={{
                          width: 44,
                          height: 48,
                          borderRadius: 6,
                          background: "#eee",
                          overflow: "hidden",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {member.photoUrl ? (
                          <img src={member.photoUrl} alt={member.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          "👤"
                        )}
                      </div>
                    </td>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 700, color: "#111" }}>{member.name}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>ID: {member.employeeId || "N/A"}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>{member.phone || member.email || "No contact"}</div>
                    </td>
                    <td style={{ padding: 12 }}>
                      <div style={{ fontWeight: 600 }}>{member.department || "General"}</div>
                      <div style={{ fontSize: 12, color: "#666" }}>{member.position || "Staff"}</div>
                    </td>
                    <td style={{ padding: 12 }}>
                      <span
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 700,
                          background: member.active ? "#DCFCE7" : "#FEE2E2",
                          color: member.active ? "#15803D" : "#B91C1C",
                        }}
                      >
                        {member.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: 12, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => handleSingleGenerate(member)}
                          style={{ ...smallButtonStyle, background: "#EFF6FF", color: "#1D4ED8" }}
                          title="Generate & Customize ID Card"
                        >
                          🪪 Print ID
                        </button>
                        <button onClick={() => handleEdit(member)} style={smallButtonStyle}>
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDelete(member.$id)}
                          style={{ ...smallButtonStyle, background: "#fee2e2", color: "#dc2626" }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: SALARY & BANKING STORE (CRUD) */}
      {activeTab === "salary" && (
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: "0 0 4px" }}>Staff Salary & Banking Store</h3>
              <p style={{ margin: 0, fontSize: 13, color: "#666" }}>
                Manage account numbers, bank details, basic pay, allowances, and export payroll
              </p>
            </div>
            <button onClick={downloadPayrollCSV} style={{ ...buttonStyle, background: "#10B981" }}>
              📥 Download Bank Payroll (CSV)
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E5E7EB", background: "#F9FAFB" }}>
                  <th style={{ padding: 12 }}>Staff Name</th>
                  <th style={{ padding: 12 }}>Bank Name</th>
                  <th style={{ padding: 12 }}>Account Number</th>
                  <th style={{ padding: 12 }}>Account Name</th>
                  <th style={{ padding: 12, textAlign: "right" }}>Basic (₦)</th>
                  <th style={{ padding: 12, textAlign: "right" }}>Allowances</th>
                  <th style={{ padding: 12, textAlign: "right" }}>Deductions</th>
                  <th style={{ padding: 12, textAlign: "right" }}>Net Salary (₦)</th>
                  <th style={{ padding: 12, textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => {
                  const net = s.netSalary || (Number(s.basicSalary || 0) + Number(s.allowances || 0) - Number(s.deductions || 0));
                  return (
                    <tr key={s.$id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: 12 }}>
                        <strong>{s.name}</strong>
                        <div style={{ fontSize: 12, color: "#666" }}>{s.employeeId || s.position || "Staff"}</div>
                      </td>
                      <td style={{ padding: 12 }}>{s.bankName || <span style={{ color: "#999" }}>Not set</span>}</td>
                      <td style={{ padding: 12, fontFamily: "monospace", fontWeight: 600 }}>
                        {s.accountNumber || <span style={{ color: "#999" }}>Not set</span>}
                      </td>
                      <td style={{ padding: 12 }}>{s.accountName || s.name}</td>
                      <td style={{ padding: 12, textAlign: "right" }}>{(s.basicSalary || 0).toLocaleString()}</td>
                      <td style={{ padding: 12, textAlign: "right", color: "#059669" }}>+{(s.allowances || 0).toLocaleString()}</td>
                      <td style={{ padding: 12, textAlign: "right", color: "#DC2626" }}>-{(s.deductions || 0).toLocaleString()}</td>
                      <td style={{ padding: 12, textAlign: "right", fontWeight: 800, color: "#1E3A8A" }}>
                        ₦{net.toLocaleString()}
                      </td>
                      <td style={{ padding: 12, textAlign: "center" }}>
                        <button onClick={() => handleEdit(s)} style={smallButtonStyle}>
                          ✏️ Update
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 3: STAFF DOCUMENT VAULT */}
      {activeTab === "documents" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24 }}>
          {/* Staff Selector */}
          <div style={cardStyle}>
            <h4 style={{ margin: "0 0 12px" }}>Select Staff Member</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "60vh", overflowY: "auto" }}>
              {staff.map((s) => (
                <div
                  key={s.$id}
                  onClick={() => setSelectedStaffForDocs(s)}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    cursor: "pointer",
                    background: selectedStaffForDocs?.$id === s.$id ? "#EFF6FF" : "#F9FAFB",
                    border: selectedStaffForDocs?.$id === s.$id ? "2px solid #3B82F6" : "1px solid #E5E7EB",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {s.department || "General"} • {s.employeeId || "No ID"}
                  </div>
                  <div style={{ fontSize: 11, color: "#3B82F6", marginTop: 4 }}>
                    {(s.documents || []).length} Document(s) attached
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Document Management Area */}
          <div style={cardStyle}>
            {selectedStaffForDocs ? (
              <div>
                <h3 style={{ margin: "0 0 8px" }}>Documents for {selectedStaffForDocs.name}</h3>
                <p style={{ margin: "0 0 20px", color: "#666", fontSize: 13 }}>
                  Store employment letters, CV, government ID cards, guarantor forms, and certificates.
                </p>

                {/* Upload Form */}
                <form
                  onSubmit={handleUploadDocument}
                  style={{
                    background: "#F3F4F6",
                    padding: 16,
                    borderRadius: 12,
                    marginBottom: 24,
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: 14 }}>+ Attach New Document</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <input
                      placeholder="Document Title (e.g., Guarantor Letter, Contract)"
                      required
                      value={docTitle}
                      onChange={(e) => setDocTitle(e.target.value)}
                      style={inputStyle}
                    />
                    <input
                      type="file"
                      required
                      onChange={(e) => setDocFile(e.target.files ? e.target.files[0] : null)}
                      style={inputStyle}
                    />
                  </div>
                  <button type="submit" disabled={uploadingDoc} style={{ ...buttonStyle, alignSelf: "flex-start", padding: "8px 16px" }}>
                    {uploadingDoc ? "Uploading..." : "Upload Document"}
                  </button>
                </form>

                {/* Document List */}
                <h4 style={{ margin: "0 0 12px" }}>Saved Records ({(selectedStaffForDocs.documents || []).length})</h4>
                {(!selectedStaffForDocs.documents || selectedStaffForDocs.documents.length === 0) ? (
                  <p style={{ color: "#9CA3AF", fontStyle: "italic" }}>No documents uploaded yet for this staff member.</p>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {selectedStaffForDocs.documents.map((doc, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: 12,
                          background: "#fff",
                          border: "1px solid #E5E7EB",
                          borderRadius: 8,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>📄 {doc.title}</div>
                          <div style={{ fontSize: 11, color: "#6B7280" }}>
                            Uploaded: {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : "Recorded"}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              ...smallButtonStyle,
                              textDecoration: "none",
                              background: "#EFF6FF",
                              color: "#2563EB",
                            }}
                          >
                            👁️ View / Download
                          </a>
                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(idx)}
                            style={{ ...smallButtonStyle, background: "#FEE2E2", color: "#DC2626" }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>
                Select a staff member from the left list to view or upload their documents.
              </div>
            )}
          </div>
        </div>
      )}

      {/* INTERACTIVE ID CARD BUILDER & PRINT MODAL */}
      {showCardModal && previewMembers.length > 0 && (
        <div style={modalOverlayStyle}>
          <div style={modalContentStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
                borderBottom: "1px solid #E5E7EB",
                paddingBottom: 16,
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 4px" }}>
                  Staff ID Cards Preview ({previewMembers.length})
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "#666" }}>
                  Features 2 QR Codes (Front: Attendance, Back: Verification) with Drag / Position controls.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => window.print()}
                  style={{ ...buttonStyle, padding: "8px 20px", background: "#1F2937" }}
                >
                  🖨️ Print ID Cards
                </button>
                <button
                  onClick={() => {
                    setShowCardModal(false);
                    setPreviewMembers([]);
                  }}
                  style={{ ...buttonStyle, padding: "8px 16px", background: "#EF4444" }}
                >
                  Close
                </button>
              </div>
            </div>

            {/* DRAG / POSITION ADJUSTER CONTROLS */}
            <div
              className="no-print"
              style={{
                background: "#F8FAFC",
                border: "1px solid #CBD5E1",
                borderRadius: 12,
                padding: 16,
                marginBottom: 24,
              }}
            >
              <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}>
                🎛️ ID Card Element Positioning (Admin Drag / Select Fine-Tuning)
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Photo Offset Controls */}
                <div style={{ background: "#fff", padding: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#ff7f50" }}>
                    Passport Photo Position
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: 12 }}>
                    <label>
                      Horiz (X): {cardLayout.photoX}px
                      <input
                        type="range"
                        min="-40"
                        max="40"
                        value={cardLayout.photoX}
                        onChange={(e) => setCardLayout({ ...cardLayout, photoX: Number(e.target.value) })}
                        style={{ width: "100%" }}
                      />
                    </label>
                    <label>
                      Vert (Y): {cardLayout.photoY}px
                      <input
                        type="range"
                        min="-30"
                        max="30"
                        value={cardLayout.photoY}
                        onChange={(e) => setCardLayout({ ...cardLayout, photoY: Number(e.target.value) })}
                        style={{ width: "100%" }}
                      />
                    </label>
                    <label>
                      Size: {cardLayout.photoScale}%
                      <input
                        type="range"
                        min="70"
                        max="180"
                        value={cardLayout.photoScale}
                        onChange={(e) => setCardLayout({ ...cardLayout, photoScale: Number(e.target.value) })}
                        style={{ width: "100%" }}
                      />
                    </label>
                  </div>
                </div>

                {/* Signature Offset Controls */}
                <div style={{ background: "#fff", padding: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "#1E3A8A" }}>
                    Signature Position
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, fontSize: 12 }}>
                    <label>
                      Horiz (X): {cardLayout.signatureX}px
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        value={cardLayout.signatureX}
                        onChange={(e) => setCardLayout({ ...cardLayout, signatureX: Number(e.target.value) })}
                        style={{ width: "100%" }}
                      />
                    </label>
                    <label>
                      Vert (Y): {cardLayout.signatureY}px
                      <input
                        type="range"
                        min="-30"
                        max="30"
                        value={cardLayout.signatureY}
                        onChange={(e) => setCardLayout({ ...cardLayout, signatureY: Number(e.target.value) })}
                        style={{ width: "100%" }}
                      />
                    </label>
                    <label>
                      Size: {cardLayout.signatureScale}%
                      <input
                        type="range"
                        min="70"
                        max="140"
                        value={cardLayout.signatureScale}
                        onChange={(e) => setCardLayout({ ...cardLayout, signatureScale: Number(e.target.value) })}
                        style={{ width: "100%" }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* PRINT AREA WITH FRONT & BACK OF CARDS */}
            <div
              className="print-area"
              style={{
                display: "flex",
                gap: 40,
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {previewMembers.map((member) => {
                // Dynamic URLs for QR codes:
                // QR 1: Public Verification
                const verifyUrl = `https://three60-backend-a17m.onrender.com/api/staff/${member.$id}/verify`;
                // QR 2: Attendance Resolver
                const attendanceUrl = `https://three60-backend-a17m.onrender.com/api/staff/${member.$id}/attend`;

                return (
                  <div
                    key={member.$id}
                    style={{
                      display: "flex",
                      gap: 20,
                      marginBottom: 40,
                      pageBreakInside: "avoid",
                    }}
                  >
                    {/* FRONT OF ID CARD */}
                    <div style={idCardStyle}>
                      {/* Header */}
                      <div style={idCardHeaderStyle}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: "50%",
                            background: "#fff",
                            margin: "0 auto 4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                          }}
                        >
                          <img
                            src="/logo.png"
                            alt="Logo"
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                            onError={(e: any) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        </div>
                        <h4 style={{ margin: 0, fontSize: 12, fontWeight: 900, letterSpacing: 0.5, lineHeight: 1.1 }}>
                          360 DEGREE GLOBAL ESTATE LTD.
                        </h4>
                        <div style={{ fontSize: 7, fontWeight: 600, marginTop: 2, lineHeight: 1.1, opacity: 0.9 }}>
                          NSUK 2nd Gate, Behind Princess Sarah Hotel, Keffi
                          <br />
                          TEL: 08038923692, 08136661966
                        </div>
                      </div>

                      {/* Front Body */}
                      <div
                        style={{
                          position: "relative",
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          padding: "6px 0",
                        }}
                      >
                        {/* Side Ribbon */}
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 10,
                            bottom: 10,
                            width: 22,
                            background: "#ff7f50",
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
                              fontSize: 10,
                              letterSpacing: 1.5,
                            }}
                          >
                            STAFF IDENTITY CARD
                          </span>
                        </div>

                        {/* Fixed Photo Frame with Inner Zoom/Pan */}
                        <div
                          style={{
                            width: 94,
                            height: 106,
                            background: "#fff",
                            border: "3px solid #ff7f50",
                            borderRadius: 12,
                            overflow: "hidden",
                            marginBottom: 4,
                            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
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
                                transform: `translate(${cardLayout.photoX}px, ${cardLayout.photoY}px) scale(${cardLayout.photoScale / 100})`,
                                transformOrigin: "center center",
                                transition: "transform 0.1s ease",
                              }}
                            />
                          ) : (
                            <div style={{ width: "100%", height: "100%", background: "#eee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>
                              👤
                            </div>
                          )}
                        </div>

                        {/* Staff Details */}
                        <div style={{ textAlign: "center", width: "100%", paddingLeft: 22 }}>
                          <div style={{ fontSize: 8, color: "#cf1322", fontWeight: 800 }}>NAME:</div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 900,
                              color: "#1a365d",
                              textTransform: "uppercase",
                              marginBottom: 2,
                              lineHeight: 1.1,
                            }}
                          >
                            {member.name}
                          </div>

                          <div style={{ fontSize: 8, color: "#cf1322", fontWeight: 800 }}>
                            RANK: <span style={{ color: "#1a365d" }}>{member.position || "STAFF"}</span>
                          </div>

                          <div style={{ fontSize: 8, color: "#cf1322", fontWeight: 800 }}>
                            ID NO: <span style={{ color: "#1a365d" }}>{member.employeeId || member.$id.substring(0, 8)}</span>
                          </div>

                          <div style={{ fontSize: 8, color: "#cf1322", fontWeight: 800 }}>
                            DEPT: <span style={{ color: "#1a365d" }}>{member.department || "General"}</span>
                          </div>

                          <div style={{ fontSize: 8, color: "#cf1322", fontWeight: 800 }}>
                            PHONE: <span style={{ color: "#1a365d" }}>{member.phone || "N/A"}</span>
                          </div>

                          {/* Attendance QR Code (Front, below phone, unlabeled) */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                              marginTop: 4,
                            }}
                          >
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(attendanceUrl)}`}
                              alt="Attendance QR"
                              style={{
                                width: 46,
                                height: 46,
                                borderRadius: 4,
                                background: "#fff",
                                border: "1px solid #CBD5E1",
                                padding: 2,
                                display: "block",
                              }}
                            />
                          </div>
                        </div>

                        {/* Draggable / Positionable Signature */}
                        <div
                          style={{
                            marginTop: "auto",
                            marginBottom: 2,
                            paddingLeft: 22,
                            textAlign: "center",
                            transform: `translate(${cardLayout.signatureX}px, ${cardLayout.signatureY}px)`,
                          }}
                        >
                          {member.signatureUrl ? (
                            <img
                              src={member.signatureUrl}
                              alt="Signature"
                              style={{
                                height: (20 * cardLayout.signatureScale) / 100,
                                objectFit: "contain",
                                display: "block",
                                margin: "0 auto",
                              }}
                            />
                          ) : (
                            <div style={{ height: 14 }}></div>
                          )}
                          <div style={{ width: 100, borderBottom: "1px solid #1a365d", margin: "0 auto" }}></div>
                          <span style={{ fontSize: 7, fontWeight: 700, color: "#1a365d" }}>Cardholder Signature</span>
                        </div>
                      </div>

                      {/* Bottom Accent */}
                      <div style={{ height: 8, display: "flex" }}>
                        <div style={{ flex: 1, background: "#1a365d" }}></div>
                        <div style={{ width: 16, background: "#ff7f50" }}></div>
                        <div style={{ flex: 1, background: "#1a365d" }}></div>
                      </div>
                    </div>

                    {/* BACK OF ID CARD (SINGLE VERIFY QR CODE) */}
                    <div style={idCardStyle}>
                      <div
                        style={{
                          padding: "16px 14px",
                          textAlign: "center",
                          display: "flex",
                          flexDirection: "column",
                          height: "100%",
                          justifyContent: "space-between",
                          boxSizing: "border-box",
                        }}
                      >
                        {/* Header text */}
                        <div>
                          <div style={{ fontSize: 8, fontStyle: "italic", fontWeight: 700, color: "#1a365d", marginBottom: 2 }}>
                            This certifies that the holder whose photograph and details appear on this card is an authorized staff of:
                          </div>
                          <h4 style={{ margin: 0, fontSize: 12, fontWeight: 900, color: "#1a365d" }}>
                            360 DEGREE GLOBAL ESTATE LTD.
                          </h4>
                        </div>

                        {/* SINGLE VERIFICATION QR CODE (UNLABELED) */}
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            margin: "12px 0",
                          }}
                        >
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(verifyUrl)}`}
                            alt="Staff Verification QR"
                            style={{
                              width: 84,
                              height: 84,
                              border: "1px solid #CBD5E1",
                              borderRadius: 6,
                              background: "#fff",
                              padding: 4,
                            }}
                          />
                        </div>

                        {/* Security notice & authorized signature */}
                        <div>
                          <div style={{ fontSize: 7, fontStyle: "italic", color: "#1a365d", marginBottom: 8, lineHeight: 1.2 }}>
                            Property of 360 Degree Global Estate Ltd. If found, please return to the company office or the nearest Police Station.
                          </div>

                          <div style={{ width: 110, borderBottom: "1px solid #1a365d", margin: "0 auto 3px" }}></div>
                          <div style={{ fontSize: 7, fontWeight: 800, color: "#1a365d" }}>
                            Managing Director Signature
                          </div>

                          {/* Barcode Mockup */}
                          <div
                            style={{
                              marginTop: 8,
                              height: 16,
                              background: "repeating-linear-gradient(90deg, #000, #000 1px, #fff 1px, #fff 2px)",
                              width: "75%",
                              margin: "8px auto 0",
                            }}
                          ></div>
                          <div style={{ fontSize: 6, letterSpacing: 2, color: "#333", marginTop: 2 }}>
                            *{member.$id.substring(0, 10).toUpperCase()}*
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <style jsx global>{`
              @media print {
                body * {
                  visibility: hidden;
                }
                .no-print {
                  display: none !important;
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
                  justify-content: flex-start;
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
  backgroundColor: "rgba(0,0,0,0.6)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
  backdropFilter: "blur(4px)",
};

const modalContentStyle: React.CSSProperties = {
  backgroundColor: "#fff",
  padding: 24,
  borderRadius: 20,
  width: "92%",
  maxWidth: 900,
  maxHeight: "92vh",
  overflowY: "auto",
  boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
};

const idCardStyle: React.CSSProperties = {
  width: 240,
  height: 380,
  backgroundColor: "#fff",
  borderRadius: 12,
  overflow: "hidden",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  border: "1px solid #eee",
};

const idCardHeaderStyle: React.CSSProperties = {
  backgroundColor: "#1a365d",
  color: "#fff",
  padding: "10px 8px",
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
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #e5e5e5",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 20px",
  borderRadius: 10,
  border: "none",
  background: "#ff7f50",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
  transition: "background 0.2s",
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
  fontSize: 13,
  fontWeight: 600,
  color: "#374151",
};
