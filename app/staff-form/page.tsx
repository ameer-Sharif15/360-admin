"use client";

import React, { useState } from "react";
import { uploadToCloudinary } from "../../lib/cloudinary";
import { API_BASE_URL } from "../../lib/api";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  CreditCard,
  Building2,
  Trash2,
  Plus,
  ShieldCheck,
  Calendar,
  Lock,
  ArrowRight,
  Info,
} from "lucide-react";

interface UploadedDoc {
  title: string;
  file: File;
  fileUrl?: string;
  fileType?: string;
}

const NIGERIAN_BANKS = [
  "Access Bank",
  "Citibank Nigeria",
  "Ecobank Nigeria",
  "Fidelity Bank",
  "First Bank of Nigeria",
  "First City Monument Bank (FCMB)",
  "Globus Bank",
  "Guaranty Trust Bank (GTBank)",
  "Heritage Bank",
  "Jaiz Bank",
  "Keystone Bank",
  "Kuda Bank",
  "Moniepoint MFB",
  "OPay",
  "Optimus Bank",
  "Palmpay",
  "Parallex Bank",
  "Polaris Bank",
  "PremiumTrust Bank",
  "Providus Bank",
  "Signature Bank",
  "Stanbic IBTC Bank",
  "Standard Chartered Bank",
  "Sterling Bank",
  "SunTrust Bank",
  "TAJBank",
  "Titan Trust Bank",
  "Union Bank of Nigeria",
  "United Bank for Africa (UBA)",
  "Unity Bank",
  "Wema Bank",
  "Zenith Bank",
  "Other / Microfinance Bank",
];

const DEPARTMENTS = [
  "Management",
  "IT & Systems",
  "Front Desk & Reception",
  "Food & Beverage / Kitchen",
  "Minimart & Retail",
  "Gym & Fitness",
  "Housekeeping & Laundry",
  "Security & Surveillance",
  "Maintenance & Facility",
  "Logistics & Transport",
  "Accounts & Finance",
  "General Operations",
];

export default function StaffFormPage() {
  // Form fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  // Bank & Payroll
  const [selectedBank, setSelectedBank] = useState("");
  const [customBankName, setCustomBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [salary, setSalary] = useState("");

  // Passport Photo
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [passportPreview, setPassportPreview] = useState<string | null>(null);

  // Additional Documents
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [currentDocTitle, setCurrentDocTitle] = useState("");
  const [currentDocFile, setCurrentDocFile] = useState<File | null>(null);

  // Submission States
  const [loading, setLoading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submissionRef, setSubmissionRef] = useState("");

  // Passport photo selection handler
  const handlePassportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith("image/")) {
        setErrorMsg("Please select a valid image file (JPG or PNG) for the passport photo.");
        return;
      }
      setPassportFile(file);
      setPassportPreview(URL.createObjectURL(file));
      setErrorMsg("");
    }
  };

  // Add document to list
  const handleAddDocument = () => {
    if (!currentDocFile) {
      setErrorMsg("Please choose a file to attach.");
      return;
    }
    const defaultTitle = currentDocTitle.trim() || currentDocFile.name;
    setDocuments((prev) => [
      ...prev,
      {
        title: defaultTitle,
        file: currentDocFile,
        fileType: currentDocFile.type || "document",
      },
    ]);
    setCurrentDocTitle("");
    setCurrentDocFile(null);
    setErrorMsg("");
  };

  const handleRemoveDoc = (idx: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== idx));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim()) {
      setErrorMsg("Full Name is required.");
      return;
    }
    if (!phone.trim()) {
      setErrorMsg("Phone number is required.");
      return;
    }
    if (!passportFile && !passportPreview) {
      setErrorMsg("Please upload your recent passport photograph with a plain white background.");
      return;
    }

    const finalBankName =
      selectedBank === "Other / Microfinance Bank" ? customBankName.trim() : selectedBank;

    if (accountNumber && accountNumber.length < 10) {
      setErrorMsg("Please enter a valid 10-digit bank account number.");
      return;
    }

    try {
      setLoading(true);

      // 1. Upload Passport Photo
      let uploadedPhotoUrl = "";
      if (passportFile) {
        setUploadProgressText("Uploading passport photograph...");
        uploadedPhotoUrl = await uploadToCloudinary(passportFile, "staff_passports");
      }

      // 2. Upload Supporting Documents
      const uploadedDocsPayload: Array<{ title: string; fileUrl: string; fileType: string }> = [];
      if (documents.length > 0) {
        for (let i = 0; i < documents.length; i++) {
          const doc = documents[i];
          setUploadProgressText(`Uploading document ${i + 1} of ${documents.length}: "${doc.title}"...`);
          const fileUrl = await uploadToCloudinary(doc.file, "staff_documents");
          uploadedDocsPayload.push({
            title: doc.title,
            fileUrl,
            fileType: doc.fileType || "application/pdf",
          });
        }
      }

      // 3. Submit data to backend
      setUploadProgressText("Saving your profile and records...");
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        department: department || "General Operations",
        position: position.trim() || "Staff",
        employeeId: employeeId.trim(),
        photoUrl: uploadedPhotoUrl,
        bankName: finalBankName,
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
        salary: Number(salary.replace(/[^0-9.]/g, "")) || 0,
        documents: uploadedDocsPayload,
      };

      const res = await fetch(`${API_BASE_URL}/api/staff-submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to submit form. Please check your network and try again.");
      }

      setSubmissionRef(data.submissionId || "SUB-" + Math.floor(100000 + Math.random() * 900000));
      setSubmitted(true);
    } catch (err: any) {
      console.error("Submission failed:", err);
      setErrorMsg(err.message || "Failed to submit. Please check your connection and try again.");
    } finally {
      setLoading(false);
      setUploadProgressText("");
    }
  };

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9; }
        .sf-root { min-height: 100vh; background-color: #0b1120; color: #f1f5f9; display: flex; flex-direction: column; justify-content: space-between; }
        .sf-header { border-bottom: 1px solid rgba(51, 65, 85, 0.7); background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(12px); position: sticky; top: 0; z-index: 50; }
        .sf-header-inner { max-width: 760px; margin: 0 auto; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; }
        .sf-brand { display: flex; align-items: center; gap: 12px; }
        .sf-logo-box { width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); display: flex; align-items: center; justify-content: center; font-weight: 900; color: #0f172a; font-size: 18px; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.25); }
        .sf-brand-title { font-size: 13px; font-weight: 800; color: #ffffff; letter-spacing: 0.05em; }
        .sf-brand-sub { font-size: 11px; color: #f59e0b; font-weight: 600; letter-spacing: 0.03em; }
        .sf-badge-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: #94a3b8; background: #1e293b; padding: 5px 12px; border-radius: 999px; border: 1px solid #334155; }
        
        .sf-container { max-width: 760px; width: 100%; margin: 0 auto; padding: 28px 18px 48px; }
        .sf-card { background: #111c34; border: 1px solid #1e293b; border-radius: 18px; padding: 24px; margin-bottom: 24px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25); }
        .sf-notice-card { background: linear-gradient(180deg, #132247 0%, #0f1a35 100%); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 18px; padding: 24px 26px; margin-bottom: 24px; box-shadow: 0 10px 35px rgba(0, 0, 0, 0.3); }
        
        .sf-section-header { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 15px; color: #fbbf24; border-bottom: 1px solid #1e293b; padding-bottom: 12px; margin-bottom: 20px; }
        .sf-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .sf-col-span-2 { grid-column: 1 / -1; }
        
        .sf-label { display: block; font-size: 11.5px; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
        .sf-input, .sf-select, .sf-textarea { width: 100%; padding: 12px 14px; background: #070d19; border: 1.5px solid #233554; border-radius: 10px; color: #ffffff; font-size: 13.5px; outline: none; transition: all 0.2s; font-family: inherit; }
        .sf-input:focus, .sf-select:focus, .sf-textarea:focus { border-color: #f59e0b; box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15); background: #0a1324; }
        .sf-input::placeholder { color: #64748b; }
        .sf-input-hint { font-size: 11px; color: #94a3b8; margin-top: 4px; }
        
        .sf-passport-wrap { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
        .sf-passport-box { width: 140px; height: 175px; border-radius: 14px; border: 2px dashed #334155; background: #070d19; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; position: relative; flex-shrink: 0; }
        .sf-passport-img { width: 100%; height: 100%; object-fit: cover; }
        .sf-passport-overlay { position: absolute; inset: 0; background: rgba(11, 17, 32, 0.85); display: flex; align-items: center; justify-content: center; color: #f87171; font-size: 11.5px; font-weight: 700; opacity: 0; transition: opacity 0.2s; border: none; cursor: pointer; }
        .sf-passport-box:hover .sf-passport-overlay { opacity: 1; }
        
        .sf-doc-box { background: #070d19; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
        .sf-doc-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #070d19; border: 1px solid #1e293b; border-radius: 10px; margin-bottom: 8px; font-size: 12.5px; }
        
        .sf-btn-add { background: #1e293b; color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s; }
        .sf-btn-add:hover { background: #28374d; }
        .sf-btn-add:disabled { opacity: 0.4; cursor: not-allowed; }
        
        .sf-btn-submit { width: 100%; padding: 16px 24px; border-radius: 14px; background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); color: #0b1120; font-size: 15px; font-weight: 900; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 8px 25px rgba(245, 158, 11, 0.25); transition: all 0.2s; letter-spacing: 0.02em; }
        .sf-btn-submit:hover { background: linear-gradient(135deg, #f59e0b 0%, #b45309 100%); transform: translateY(-1px); }
        .sf-btn-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        
        .sf-alert-error { background: rgba(127, 29, 29, 0.35); border: 1px solid #ef4444; color: #fca5a5; padding: 14px 16px; border-radius: 12px; font-size: 13px; margin-bottom: 20px; display: flex; align-items: flex-start; gap: 10px; }
        .sf-callout { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25); color: #fde68a; padding: 12px 14px; border-radius: 10px; font-size: 12px; line-height: 1.5; margin-bottom: 16px; }
        
        .sf-footer { border-top: 1px solid #1e293b; background: #070d19; padding: 22px 16px; text-align: center; font-size: 12px; color: #64748b; }
        
        @media (max-width: 640px) {
          .sf-grid-2 { grid-template-columns: 1fr; }
          .sf-passport-wrap { flex-direction: column; align-items: flex-start; }
          .sf-container { padding: 18px 12px 40px; }
          .sf-card, .sf-notice-card { padding: 18px 16px; }
        }
      `}</style>

      <div className="sf-root">
        {/* Brand Header */}
        <header className="sf-header">
          <div className="sf-header-inner">
            <div className="sf-brand">
              <div className="sf-logo-box">360</div>
              <div>
                <div className="sf-brand-title">360 DEGREE GLOBAL</div>
                <div className="sf-brand-sub">STAFF PORTAL & DIGITAL RECORDS</div>
              </div>
            </div>
            <div className="sf-badge-pill">
              <Lock size={12} color="#fbbf24" />
              <span>Official Record Submission</span>
            </div>
          </div>
        </header>

        {/* Success Screen */}
        {submitted ? (
          <main className="sf-container" style={{ display: "flex", alignItems: "center", minHeight: "75vh" }}>
            <div className="sf-card" style={{ textAlign: "center", padding: "40px 28px", border: "1.5px solid rgba(245, 158, 11, 0.4)" }}>
              <div style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(245, 158, 11, 0.15)", border: "1.5px solid #fbbf24", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "#fbbf24" }}>
                <CheckCircle2 size={36} />
              </div>

              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 999, background: "rgba(16, 185, 129, 0.15)", color: "#34d399", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", marginBottom: 12 }}>
                <ShieldCheck size={14} /> Submission Successfully Received
              </div>

              <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 10px", color: "#ffffff" }}>
                Thank You, {name}!
              </h1>

              <p style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.6, maxWidth: 520, margin: "0 auto 24px" }}>
                Your staff profile update, passport photograph, bank account details, and soft-copy documents have been
                securely received by the <strong>IT Department & Office of the General Manager</strong>.
              </p>

              <div style={{ background: "#070d19", border: "1px solid #1e293b", borderRadius: 12, padding: "14px 18px", maxWidth: 440, margin: "0 auto 24px", textAlign: "left", fontSize: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#94a3b8" }}>
                  <span>Reference ID:</span>
                  <span style={{ fontFamily: "monospace", color: "#fbbf24", fontWeight: 700 }}>{submissionRef}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#94a3b8" }}>
                  <span>Status:</span>
                  <span style={{ color: "#fbbf24", fontWeight: 600 }}>Pending IT Verification</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
                  <span>Department:</span>
                  <span style={{ color: "#ffffff" }}>{department || "General Operations"}</span>
                </div>
              </div>

              <div className="sf-callout" style={{ textAlign: "left", maxWidth: 500, margin: "0 auto 28px" }}>
                📌 <strong>What Happens Next:</strong> The IT Department will verify your passport framing and bank account
                details against official payroll records. Once approved, your digital staff ID and profile records will update automatically.
              </div>

              <button
                onClick={() => {
                  setSubmitted(false);
                  setName("");
                  setPhone("");
                  setEmail("");
                  setDepartment("");
                  setPosition("");
                  setEmployeeId("");
                  setSelectedBank("");
                  setCustomBankName("");
                  setAccountNumber("");
                  setAccountName("");
                  setSalary("");
                  setPassportFile(null);
                  setPassportPreview(null);
                  setDocuments([]);
                }}
                className="sf-btn-submit"
                style={{ maxWidth: 320, margin: "0 auto" }}
              >
                Submit Another Record
              </button>
            </div>
          </main>
        ) : (
          /* Form Content */
          <main className="sf-container">
            {/* Memo Notice Card */}
            <div className="sf-notice-card">
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#fbbf24", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                <Info size={14} /> Official Staff Notice
              </div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: "#ffffff", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
                Staff Profile & Document Update
              </h1>
              <p style={{ color: "#cbd5e1", fontSize: 13.5, lineHeight: 1.6, margin: "0 0 16px" }}>
                All staff members are kindly requested to provide their up-to-date digital profile information,
                passport photograph with a plain white background, and bank payment details for accurate payroll records.
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, paddingTop: 14, borderTop: "1px solid rgba(51, 65, 85, 0.7)", fontSize: 12, color: "#94a3b8" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Calendar size={14} color="#fbbf24" />
                  <span>Submission Deadline: <strong style={{ color: "#ffffff" }}>Monday, 26th October 2026</strong></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Building2 size={14} color="#fbbf24" />
                  <span>Office of the General Manager</span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="sf-alert-error">
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* SECTION 1: Personal Info */}
              <div className="sf-card">
                <div className="sf-section-header">
                  <User size={16} />
                  <span>1. Staff Personal Information</span>
                </div>

                <div className="sf-grid-2">
                  <div className="sf-col-span-2">
                    <label className="sf-label">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. John Emmanuel Adebayo"
                      className="sf-input"
                    />
                  </div>

                  <div>
                    <label className="sf-label">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 0801 234 5678"
                      className="sf-input"
                    />
                  </div>

                  <div>
                    <label className="sf-label">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. staff@360degree.com"
                      className="sf-input"
                    />
                  </div>

                  <div>
                    <label className="sf-label">Department *</label>
                    <select
                      required
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="sf-select"
                    >
                      <option value="">Select your department...</option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="sf-label">Rank / Position *</label>
                    <input
                      type="text"
                      required
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="e.g. Supervisor, Chef, Cashier, Receptionist"
                      className="sf-input"
                    />
                  </div>

                  <div className="sf-col-span-2">
                    <label className="sf-label">Staff / Employee ID (Optional)</label>
                    <input
                      type="text"
                      value={employeeId}
                      onChange={(e) => setEmployeeId(e.target.value)}
                      placeholder="e.g. 360-EMP-1024 or leave empty if not yet assigned"
                      className="sf-input"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Passport Photo */}
              <div className="sf-card">
                <div className="sf-section-header">
                  <Upload size={16} />
                  <span>2. Recent Passport Photograph</span>
                </div>

                <div className="sf-callout">
                  📌 <strong>Notice Requirement:</strong> Provide a clear, recent passport photograph with a{" "}
                  <strong>plain white background</strong>, properly positioned with sufficient space above the head and
                  below the shoulders. This image is used for your digital staff ID and verified payroll profile.
                </div>

                <div className="sf-passport-wrap">
                  <div className="sf-passport-box">
                    {passportPreview ? (
                      <>
                        <img src={passportPreview} alt="Passport Preview" className="sf-passport-img" />
                        <button
                          type="button"
                          onClick={() => {
                            setPassportFile(null);
                            setPassportPreview(null);
                          }}
                          className="sf-passport-overlay"
                        >
                          <Trash2 size={14} style={{ marginRight: 4 }} /> Change
                        </button>
                      </>
                    ) : (
                      <div style={{ textAlign: "center", color: "#64748b", padding: 12 }}>
                        <User size={34} style={{ margin: "0 auto 4px", color: "#475569" }} />
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>No Photo</div>
                        <div style={{ fontSize: 9.5, color: "#f59e0b" }}>White Background</div>
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 240 }}>
                    <label className="sf-label">Select Passport File (JPG, PNG) *</label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePassportChange}
                      className="sf-input"
                      style={{ padding: "8px 10px", cursor: "pointer" }}
                    />
                    <div className="sf-input-hint">
                      Maximum size: 10MB. Must have sharp clarity, good front-facing lighting, and plain white background.
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Bank Account & Payroll */}
              <div className="sf-card">
                <div className="sf-section-header">
                  <CreditCard size={16} />
                  <span>3. Bank Account & Payroll Details</span>
                </div>

                <div className="sf-callout">
                  📌 <strong>Payroll Accuracy:</strong> Please ensure your bank account name matches your official staff
                  records to prevent salary payment delays.
                </div>

                <div className="sf-grid-2">
                  <div>
                    <label className="sf-label">Bank Name *</label>
                    <select
                      required
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                      className="sf-select"
                    >
                      <option value="">Select your bank...</option>
                      {NIGERIAN_BANKS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>

                    {selectedBank === "Other / Microfinance Bank" && (
                      <input
                        type="text"
                        required
                        placeholder="Type Bank / MFB Name"
                        value={customBankName}
                        onChange={(e) => setCustomBankName(e.target.value)}
                        className="sf-input"
                        style={{ marginTop: 10 }}
                      />
                    )}
                  </div>

                  <div>
                    <label className="sf-label">Account Number (10 Digits) *</label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="e.g. 0123456789"
                      className="sf-input"
                      style={{ fontFamily: "monospace", letterSpacing: "0.08em" }}
                    />
                  </div>

                  <div>
                    <label className="sf-label">Account Holder Name *</label>
                    <input
                      type="text"
                      required
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="e.g. John Emmanuel Adebayo"
                      className="sf-input"
                    />
                  </div>

                  <div>
                    <label className="sf-label">Current Monthly Salary (₦ NGN) *</label>
                    <input
                      type="text"
                      required
                      value={salary}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        setSalary(raw ? Number(raw).toLocaleString() : "");
                      }}
                      placeholder="e.g. 150,000"
                      className="sf-input"
                      style={{ fontFamily: "monospace", color: "#34d399", fontWeight: 700 }}
                    />
                    <div className="sf-input-hint">How much was your agreed monthly salary? (For HR payroll audit)</div>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Relevant Staff Documents Upload */}
              <div className="sf-card">
                <div className="sf-section-header">
                  <FileText size={16} />
                  <span>4. Relevant Staff Documents (NIN, Certificates, CV, etc.)</span>
                </div>

                <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.5, margin: "0 0 14px" }}>
                  Please attach soft copies of all your relevant credentials (NIN Slip, Voter&apos;s Card, Degree/Diploma
                  Certificates, Employment Letter, CV/Resume). You can add multiple files.
                </p>

                <div className="sf-doc-box">
                  <div className="sf-grid-2" style={{ marginBottom: 12 }}>
                    <div>
                      <label className="sf-label">Document Title / Type</label>
                      <input
                        type="text"
                        value={currentDocTitle}
                        onChange={(e) => setCurrentDocTitle(e.target.value)}
                        placeholder="e.g. NIN Slip, B.Sc Degree, CV"
                        className="sf-input"
                      />
                    </div>

                    <div>
                      <label className="sf-label">Select File (PDF, Images, DOCX)</label>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setCurrentDocFile(e.target.files[0]);
                          }
                        }}
                        className="sf-input"
                        style={{ padding: "8px 10px", cursor: "pointer" }}
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddDocument}
                    disabled={!currentDocFile}
                    className="sf-btn-add"
                  >
                    <Plus size={14} /> Add Document to List
                  </button>
                </div>

                {documents.length > 0 ? (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8 }}>
                      Attached Documents ({documents.length}):
                    </div>
                    {documents.map((doc, idx) => (
                      <div key={idx} className="sf-doc-item">
                        <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                          <FileText size={16} color="#fbbf24" style={{ flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 700, color: "#ffffff" }}>{doc.title}</div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>
                              {doc.file.name} ({(doc.file.size / 1024).toFixed(1)} KB)
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveDoc(idx)}
                          style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: 6 }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "16px", color: "#64748b", fontSize: 12.5, border: "1px dashed #233554", borderRadius: 10 }}>
                    No extra documents attached yet. Click &quot;Add Document to List&quot; above to attach your NIN slip or certificates.
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div style={{ paddingTop: 8 }}>
                <button type="submit" disabled={loading} className="sf-btn-submit">
                  {loading ? (
                    <span>{uploadProgressText || "Submitting Staff Profile..."}</span>
                  ) : (
                    <>
                      <span>Submit Profile & Documents</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, color: "#94a3b8", marginTop: 14 }}>
                  <ShieldCheck size={15} color="#fbbf24" />
                  <span>Your data is stored securely and directly accessible by authorized IT & Admin personnel only.</span>
                </div>
              </div>
            </form>
          </main>
        )}

        {/* Footer */}
        <footer className="sf-footer">
          <div>© 2026 360 Degree Global Estate Ltd. All Rights Reserved.</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>IT Department & Staff Digital Records Portal</div>
        </footer>
      </div>
    </>
  );
}
