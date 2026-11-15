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
  Eye,
  Edit3,
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
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  const [selectedBank, setSelectedBank] = useState("");
  const [customBankName, setCustomBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [salary, setSalary] = useState("");

  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [passportPreview, setPassportPreview] = useState<string | null>(null);

  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [currentDocTitle, setCurrentDocTitle] = useState("");
  const [currentDocFile, setCurrentDocFile] = useState<File | null>(null);

  // Review Modal & Submission states
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [confirmedAccuracy, setConfirmedAccuracy] = useState(true);
  const [loading, setLoading] = useState(false);
  const [uploadProgressText, setUploadProgressText] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submissionRef, setSubmissionRef] = useState("");

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

  // Open Review Dialog
  const handleOpenReview = (e: React.FormEvent) => {
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
    if (!selectedBank) {
      setErrorMsg("Please select your bank name.");
      return;
    }
    if (!accountNumber || accountNumber.length < 10) {
      setErrorMsg("Please enter a valid 10-digit bank account number.");
      return;
    }
    if (!accountName.trim()) {
      setErrorMsg("Account Holder Name is required.");
      return;
    }

    setShowReviewModal(true);
  };

  // Final Submit
  const handleFinalSubmit = async () => {
    setErrorMsg("");
    setShowReviewModal(false);

    const finalBankName =
      selectedBank === "Other / Microfinance Bank" ? customBankName.trim() : selectedBank;

    try {
      setLoading(true);

      let uploadedPhotoUrl = "";
      if (passportFile) {
        setUploadProgressText("Uploading passport photograph...");
        uploadedPhotoUrl = await uploadToCloudinary(passportFile, "staff_passports");
      }

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

      setUploadProgressText("Saving your profile and official records...");
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

  const finalBankDisplayName =
    selectedBank === "Other / Microfinance Bank" ? customBankName || "Other MFB" : selectedBank;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9; }
        .sf-root { min-height: 100vh; background-color: #0b1120; color: #f1f5f9; display: flex; flex-direction: column; justify-content: space-between; }
        .sf-header { border-bottom: 2px solid #ff7f50; background: #0f172a; position: sticky; top: 0; z-index: 50; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .sf-header-inner { max-width: 800px; margin: 0 auto; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; }
        .sf-brand { display: flex; align-items: center; gap: 14px; }
        .sf-logo-img { height: 44px; width: auto; object-fit: contain; }
        .sf-brand-title { font-size: 14px; font-weight: 800; color: #ffffff; letter-spacing: 0.05em; }
        .sf-brand-sub { font-size: 11px; color: #ff7f50; font-weight: 700; letter-spacing: 0.03em; }
        .sf-badge-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: #cbd5e1; background: #1e293b; padding: 6px 14px; border-radius: 999px; border: 1px solid #334155; }
        
        .sf-container { max-width: 800px; width: 100%; margin: 0 auto; padding: 28px 18px 48px; }
        .sf-card { background: #111c34; border: 1px solid #1e293b; border-radius: 18px; padding: 24px; margin-bottom: 24px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25); }
        .sf-notice-card { background: linear-gradient(180deg, #162447 0%, #0f1a35 100%); border: 1.5px solid rgba(255, 127, 80, 0.4); border-radius: 18px; padding: 24px 26px; margin-bottom: 24px; box-shadow: 0 10px 35px rgba(0, 0, 0, 0.35); }
        
        .sf-section-header { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 15px; color: #ff7f50; border-bottom: 1px solid #1e293b; padding-bottom: 12px; margin-bottom: 20px; }
        .sf-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .sf-col-span-2 { grid-column: 1 / -1; }
        
        .sf-label { display: block; font-size: 11.5px; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
        .sf-input, .sf-select { width: 100%; padding: 12px 14px; background: #070d19; border: 1.5px solid #233554; border-radius: 10px; color: #ffffff; font-size: 13.5px; outline: none; transition: all 0.2s; font-family: inherit; }
        .sf-input:focus, .sf-select:focus { border-color: #ff7f50; box-shadow: 0 0 0 3px rgba(255, 127, 80, 0.2); background: #0a1324; }
        .sf-input::placeholder { color: #64748b; }
        .sf-input-hint { font-size: 11px; color: #94a3b8; margin-top: 4px; }
        
        .sf-passport-wrap { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
        .sf-passport-box { width: 140px; height: 175px; border-radius: 14px; border: 2px dashed #ff7f50; background: #070d19; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; position: relative; flex-shrink: 0; }
        .sf-passport-img { width: 100%; height: 100%; object-fit: cover; }
        .sf-passport-overlay { position: absolute; inset: 0; background: rgba(11, 17, 32, 0.85); display: flex; align-items: center; justify-content: center; color: #f87171; font-size: 11.5px; font-weight: 700; opacity: 0; transition: opacity 0.2s; border: none; cursor: pointer; }
        .sf-passport-box:hover .sf-passport-overlay { opacity: 1; }
        
        .sf-doc-box { background: #070d19; border: 1px solid #1e293b; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
        .sf-doc-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #070d19; border: 1px solid #1e293b; border-radius: 10px; margin-bottom: 8px; font-size: 12.5px; }
        
        .sf-btn-add { background: #1e293b; color: #ff7f50; border: 1px solid rgba(255, 127, 80, 0.4); padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
        .sf-btn-add:hover { background: #28374d; }
        .sf-btn-add:disabled { opacity: 0.4; cursor: not-allowed; }
        
        .sf-btn-submit { width: 100%; padding: 16px 24px; border-radius: 14px; background: linear-gradient(135deg, #ff7f50 0%, #ea580c 100%); color: #ffffff; font-size: 15px; font-weight: 900; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 8px 25px rgba(255, 127, 80, 0.3); transition: all 0.2s; letter-spacing: 0.02em; }
        .sf-btn-submit:hover { background: linear-gradient(135deg, #f97316 0%, #c2410c 100%); transform: translateY(-1px); }
        .sf-btn-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        
        .sf-btn-secondary { padding: 12px 20px; border-radius: 10px; background: #1e293b; color: #cbd5e1; font-size: 13px; font-weight: 700; border: 1px solid #334155; cursor: pointer; }
        .sf-btn-secondary:hover { background: #334155; }
        
        .sf-alert-error { background: rgba(127, 29, 29, 0.35); border: 1px solid #ef4444; color: #fca5a5; padding: 14px 16px; border-radius: 12px; font-size: 13px; margin-bottom: 20px; display: flex; align-items: flex-start; gap: 10px; }
        .sf-callout { background: rgba(255, 127, 80, 0.1); border: 1px solid rgba(255, 127, 80, 0.3); color: #fed7aa; padding: 12px 14px; border-radius: 10px; font-size: 12px; line-height: 1.5; margin-bottom: 16px; }
        
        /* Modal Styles */
        .sf-modal-overlay { position: fixed; inset: 0; background: rgba(11, 17, 32, 0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .sf-modal-content { background: #111c34; border: 1.5px solid #ff7f50; border-radius: 20px; width: 100%; max-width: 680px; max-height: 90vh; overflow-y: auto; padding: 28px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
        .sf-review-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1e293b; font-size: 13px; }
        .sf-review-row:last-child { border-bottom: none; }
        .sf-review-label { color: #94a3b8; }
        .sf-review-value { color: #ffffff; font-weight: 700; text-align: right; }
        
        .sf-footer { border-top: 1px solid #1e293b; background: #070d19; padding: 22px 16px; text-align: center; font-size: 12px; color: #64748b; }
        
        @media (max-width: 640px) {
          .sf-grid-2 { grid-template-columns: 1fr; }
          .sf-passport-wrap { flex-direction: column; align-items: flex-start; }
          .sf-container { padding: 18px 12px 40px; }
          .sf-card, .sf-notice-card { padding: 18px 16px; }
          .sf-modal-content { padding: 20px 16px; }
        }
      `}</style>

      <div className="sf-root">
        {/* Brand Header with Official Company Logo */}
        <header className="sf-header">
          <div className="sf-header-inner">
            <div className="sf-brand">
              <img
                src="/logo.png"
                alt="360 Degree Global Logo"
                className="sf-logo-img"
              />
              <div>
                <div className="sf-brand-title">360 DEGREE GLOBAL ESTATE LTD.</div>
                <div className="sf-brand-sub">OFFICIAL STAFF PORTAL & DIGITAL RECORDS</div>
              </div>
            </div>
            <div className="sf-badge-pill">
              <Lock size={12} color="#ff7f50" />
              <span>Official Submission</span>
            </div>
          </div>
        </header>

        {submitted ? (
          <main className="sf-container" style={{ display: "flex", alignItems: "center", minHeight: "75vh" }}>
            <div className="sf-card" style={{ textAlign: "center", padding: "40px 28px", border: "1.5px solid #ff7f50" }}>
              <div style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(255, 127, 80, 0.15)", border: "1.5px solid #ff7f50", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "#ff7f50" }}>
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
                  <span style={{ fontFamily: "monospace", color: "#ff7f50", fontWeight: 700 }}>{submissionRef}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, color: "#94a3b8" }}>
                  <span>Status:</span>
                  <span style={{ color: "#ff7f50", fontWeight: 600 }}>Pending IT Verification</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
                  <span>Department:</span>
                  <span style={{ color: "#ffffff" }}>{department || "General Operations"}</span>
                </div>
              </div>

              <div className="sf-callout" style={{ textAlign: "left", maxWidth: 500, margin: "0 auto 28px" }}>
                📌 <strong>Next Step:</strong> The IT Department will verify your passport framing and bank account
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
          <main className="sf-container">
            <div className="sf-notice-card">
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#ff7f50", fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
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
                  <Calendar size={14} color="#ff7f50" />
                  <span>Submission Deadline: <strong style={{ color: "#ffffff" }}>Monday, 26th October 2026</strong></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Building2 size={14} color="#ff7f50" />
                  <span>Office of the General Manager</span>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="sf-alert-error">
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleOpenReview}>
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
                        <div style={{ fontSize: 9.5, color: "#ff7f50" }}>White Background</div>
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
                          <FileText size={16} color="#ff7f50" style={{ flexShrink: 0 }} />
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

              {/* Review & Submit Trigger */}
              <div style={{ paddingTop: 8 }}>
                <button type="submit" disabled={loading} className="sf-btn-submit">
                  <span>Review & Verify Information</span>
                  <ArrowRight size={18} />
                </button>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, color: "#94a3b8", marginTop: 14 }}>
                  <ShieldCheck size={15} color="#ff7f50" />
                  <span>You will review all details before final submission.</span>
                </div>
              </div>
            </form>
          </main>
        )}

        {/* REVIEW SUMMARY MODAL */}
        {showReviewModal && (
          <div className="sf-modal-overlay">
            <div className="sf-modal-content">
              <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "1.5px solid #ff7f50", paddingBottom: 14, marginBottom: 20 }}>
                <Eye size={22} color="#ff7f50" />
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#ffffff" }}>
                    Review Your Information
                  </h3>
                  <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
                    Please verify all your details and documents carefully before final submission.
                  </p>
                </div>
              </div>

              {/* Passport Photo Preview in Modal */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, background: "#070d19", padding: 14, borderRadius: 12, border: "1px solid #1e293b", marginBottom: 16 }}>
                {passportPreview && (
                  <img
                    src={passportPreview}
                    alt="Passport"
                    style={{ width: 64, height: 80, objectFit: "cover", borderRadius: 8, border: "2px solid #ff7f50" }}
                  />
                )}
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#ffffff" }}>{name}</div>
                  <div style={{ fontSize: 12, color: "#ff7f50", fontWeight: 700 }}>
                    {position} · {department || "General"}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    Passport: White background confirmed
                  </div>
                </div>
              </div>

              {/* Personal Details Table */}
              <div style={{ background: "#070d19", borderRadius: 12, padding: "10px 16px", border: "1px solid #1e293b", marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#ff7f50", textTransform: "uppercase", marginBottom: 6 }}>
                  Personal Information
                </div>
                <div className="sf-review-row">
                  <span className="sf-review-label">Phone:</span>
                  <span className="sf-review-value">{phone}</span>
                </div>
                <div className="sf-review-row">
                  <span className="sf-review-label">Email:</span>
                  <span className="sf-review-value">{email || "—"}</span>
                </div>
                <div className="sf-review-row">
                  <span className="sf-review-label">Employee ID:</span>
                  <span className="sf-review-value">{employeeId || "To be assigned"}</span>
                </div>
              </div>

              {/* Bank & Salary Table */}
              <div style={{ background: "#070d19", borderRadius: 12, padding: "10px 16px", border: "1px solid #1e293b", marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#ff7f50", textTransform: "uppercase", marginBottom: 6 }}>
                  Banking & Payroll
                </div>
                <div className="sf-review-row">
                  <span className="sf-review-label">Bank Name:</span>
                  <span className="sf-review-value">{finalBankDisplayName}</span>
                </div>
                <div className="sf-review-row">
                  <span className="sf-review-label">Account Number:</span>
                  <span className="sf-review-value" style={{ fontFamily: "monospace" }}>{accountNumber}</span>
                </div>
                <div className="sf-review-row">
                  <span className="sf-review-label">Account Name:</span>
                  <span className="sf-review-value">{accountName}</span>
                </div>
                <div className="sf-review-row">
                  <span className="sf-review-label">Monthly Salary:</span>
                  <span className="sf-review-value" style={{ color: "#34d399" }}>₦{salary || "0"}</span>
                </div>
              </div>

              {/* Documents List */}
              <div style={{ background: "#070d19", borderRadius: 12, padding: "10px 16px", border: "1px solid #1e293b", marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#ff7f50", textTransform: "uppercase", marginBottom: 6 }}>
                  Attached Documents ({documents.length})
                </div>
                {documents.length > 0 ? (
                  documents.map((d, i) => (
                    <div key={i} className="sf-review-row">
                      <span className="sf-review-label">{d.title}:</span>
                      <span className="sf-review-value" style={{ fontSize: 11.5 }}>{d.file.name}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>No extra documents attached</div>
                )}
              </div>

              {/* Accuracy Check */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 22, fontSize: 12.5, color: "#cbd5e1" }}>
                <input
                  type="checkbox"
                  checked={confirmedAccuracy}
                  onChange={(e) => setConfirmedAccuracy(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: "#ff7f50" }}
                />
                <span>I confirm that all information and soft copies provided above are accurate and official.</span>
              </label>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="sf-btn-secondary"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  <Edit3 size={14} /> Edit Information
                </button>

                <button
                  type="button"
                  disabled={!confirmedAccuracy || loading}
                  onClick={handleFinalSubmit}
                  className="sf-btn-submit"
                  style={{ width: "auto", padding: "12px 24px", fontSize: 14 }}
                >
                  <CheckCircle2 size={16} /> Confirm & Submit Official Records
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="sf-footer">
          <div>© 2026 360 Degree Global Estate Ltd. All Rights Reserved.</div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>IT Department & Staff Digital Records Portal</div>
        </footer>
      </div>
    </>
  );
}
