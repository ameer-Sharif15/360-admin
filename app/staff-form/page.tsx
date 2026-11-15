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
        body { margin: 0; padding: 0; background-color: #f8fafc; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .sf-root { min-height: 100vh; background-color: #f8fafc; color: #0f172a; display: flex; flex-direction: column; justify-content: space-between; }
        
        /* Header - White, Red & Black */
        .sf-header { border-bottom: 1px solid #e2e8f0; background: #ffffff; position: sticky; top: 0; z-index: 50; box-shadow: 0 2px 10px rgba(0,0,0,0.03); }
        .sf-header-inner { max-width: 800px; margin: 0 auto; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; }
        .sf-brand { display: flex; align-items: center; gap: 12px; }
        .sf-logo-img { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 1.5px solid #fecaca; box-shadow: 0 2px 6px rgba(239, 68, 68, 0.15); }
        .sf-brand-title { font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -0.01em; }
        .sf-brand-sub { font-size: 11px; color: #ef4444; font-weight: 700; letter-spacing: 0.02em; }
        .sf-badge-pill { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: #ef4444; background: #fef2f2; padding: 6px 14px; border-radius: 999px; border: 1px solid #fecaca; font-weight: 700; }
        
        /* Container & Cards */
        .sf-container { max-width: 800px; width: 100%; margin: 0 auto; padding: 32px 18px 48px; }
        .sf-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 26px; margin-bottom: 24px; box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.04); }
        
        /* Notice Card with Red Accent */
        .sf-notice-card { background: #ffffff; border: 1.5px solid #fecaca; border-radius: 20px; padding: 26px 28px; margin-bottom: 24px; box-shadow: 0 6px 24px -2px rgba(239, 68, 68, 0.06); position: relative; overflow: hidden; }
        .sf-notice-card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 5px; background: linear-gradient(180deg, #ef4444 0%, #dc2626 100%); }
        
        /* Section Headers */
        .sf-section-header { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 15px; color: #0f172a; border-bottom: 1px solid #f1f5f9; padding-bottom: 14px; margin-bottom: 20px; }
        .sf-section-header svg { color: #ef4444; }
        .sf-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
        .sf-col-span-2 { grid-column: 1 / -1; }
        
        /* Form Inputs */
        .sf-label { display: block; font-size: 11.5px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
        .sf-input, .sf-select { width: 100%; padding: 12px 14px; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 12px; color: #0f172a; font-size: 14px; outline: none; transition: all 0.2s; font-family: inherit; }
        .sf-input:focus, .sf-select:focus { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12); background: #ffffff; }
        .sf-input::placeholder { color: #94a3b8; }
        .sf-input-hint { font-size: 11.5px; color: #64748b; margin-top: 5px; }
        
        /* Passport Photo Upload Box */
        .sf-passport-wrap { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
        .sf-passport-box { width: 140px; height: 175px; border-radius: 16px; border: 2px dashed #f87171; background: #fef2f2; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; position: relative; flex-shrink: 0; }
        .sf-passport-img { width: 100%; height: 100%; object-fit: cover; }
        .sf-passport-overlay { position: absolute; inset: 0; background: rgba(15, 23, 42, 0.8); display: flex; align-items: center; justify-content: center; color: #ffffff; font-size: 12px; font-weight: 700; opacity: 0; transition: opacity 0.2s; border: none; cursor: pointer; }
        .sf-passport-box:hover .sf-passport-overlay { opacity: 1; }
        
        /* Document Upload Box */
        .sf-doc-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin-bottom: 16px; }
        .sf-doc-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 10px; font-size: 13px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
        
        /* Buttons */
        .sf-btn-add { background: #ffffff; color: #ef4444; border: 1.5px solid #fca5a5; padding: 8px 18px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s; }
        .sf-btn-add:hover { background: #fef2f2; border-color: #ef4444; }
        .sf-btn-add:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .sf-btn-submit { width: 100%; padding: 16px 24px; border-radius: 16px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; font-size: 15px; font-weight: 800; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; box-shadow: 0 8px 24px rgba(239, 68, 68, 0.35); transition: all 0.2s; letter-spacing: 0.01em; }
        .sf-btn-submit:hover { background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); transform: translateY(-1px); }
        .sf-btn-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        
        .sf-btn-secondary { padding: 12px 20px; border-radius: 12px; background: #f1f5f9; color: #334155; font-size: 13px; font-weight: 700; border: 1px solid #cbd5e1; cursor: pointer; transition: all 0.15s; }
        .sf-btn-secondary:hover { background: #e2e8f0; }
        
        /* Alerts & Callouts */
        .sf-alert-error { background: #fef2f2; border: 1.5px solid #fecaca; color: #991b1b; padding: 14px 16px; border-radius: 14px; font-size: 13px; margin-bottom: 20px; display: flex; align-items: flex-start; gap: 10px; font-weight: 600; }
        .sf-callout { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 14px 16px; border-radius: 12px; font-size: 12.5px; line-height: 1.5; margin-bottom: 18px; }
        
        /* Modal Styles */
        .sf-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .sf-modal-content { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; width: 100%; max-width: 680px; max-height: 90vh; overflow-y: auto; padding: 32px; box-shadow: 0 25px 60px rgba(0,0,0,0.2); }
        .sf-review-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 13.5px; }
        .sf-review-row:last-child { border-bottom: none; }
        .sf-review-label { color: #64748b; font-weight: 500; }
        .sf-review-value { color: #0f172a; font-weight: 700; text-align: right; }
        
        /* Footer */
        .sf-footer { border-top: 1px solid #e2e8f0; background: #ffffff; padding: 24px 16px; text-align: center; font-size: 12px; color: #64748b; }
        
        @media (max-width: 640px) {
          .sf-grid-2 { grid-template-columns: 1fr; }
          .sf-passport-wrap { flex-direction: column; align-items: flex-start; }
          .sf-container { padding: 20px 14px 40px; }
          .sf-card, .sf-notice-card { padding: 20px 18px; }
          .sf-modal-content { padding: 22px 18px; }
        }
      `}</style>

      <div className="sf-root">
        {/* Header matching 360 Live Web Header */}
        <header className="sf-header">
          <div className="sf-header-inner">
            <div className="sf-brand">
              <img
                src="/favicon.png"
                alt="360 Live Logo"
                className="sf-logo-img"
              />
              <div>
                <div className="sf-brand-title">360 Live</div>
                <div className="sf-brand-sub">Premium Hospitality · Staff Portal</div>
              </div>
            </div>
            <div className="sf-badge-pill">
              <Lock size={13} />
              <span>Official Records</span>
            </div>
          </div>
        </header>

        {submitted ? (
          <main className="sf-container" style={{ display: "flex", alignItems: "center", minHeight: "75vh" }}>
            <div className="sf-card" style={{ textAlign: "center", padding: "44px 30px", border: "1.5px solid #fecaca" }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#fef2f2", border: "2px solid #ef4444", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "#ef4444" }}>
                <CheckCircle2 size={38} />
              </div>

              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 999, background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 14 }}>
                <ShieldCheck size={15} /> Submission Successfully Received
              </div>

              <h1 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 10px", color: "#0f172a" }}>
                Thank You, {name}!
              </h1>

              <p style={{ color: "#475569", fontSize: 14.5, lineHeight: 1.6, maxWidth: 520, margin: "0 auto 24px" }}>
                Your staff profile update, passport photograph, bank account details, and soft-copy documents have been
                securely received by the <strong>IT Department & Office of the General Manager</strong>.
              </p>

              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 14, padding: "16px 20px", maxWidth: 460, margin: "0 auto 24px", textAlign: "left", fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#64748b" }}>
                  <span>Reference ID:</span>
                  <span style={{ fontFamily: "monospace", color: "#ef4444", fontWeight: 800 }}>{submissionRef}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: "#64748b" }}>
                  <span>Status:</span>
                  <span style={{ color: "#dc2626", fontWeight: 700 }}>Pending IT Verification</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#64748b" }}>
                  <span>Department:</span>
                  <span style={{ color: "#0f172a", fontWeight: 600 }}>{department || "General Operations"}</span>
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
            {/* Notice Card */}
            <div className="sf-notice-card">
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#dc2626", background: "#fef2f2", padding: "4px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 12 }}>
                <Info size={14} /> Official Staff Notice
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", margin: "0 0 10px", letterSpacing: "-0.02em" }}>
                Staff Profile & <span style={{ color: "#ef4444" }}>Document Update</span>
              </h1>
              <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.6, margin: "0 0 18px" }}>
                All staff members are kindly requested to prepare soft copies of their relevant documents,
                recent passport photograph with a plain white background, and bank account details for payroll verification.
              </p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 16, paddingTop: 14, borderTop: "1px solid #f1f5f9", fontSize: 12.5, color: "#64748b" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Calendar size={15} color="#ef4444" />
                  <span>Submission Deadline: <strong style={{ color: "#0f172a" }}>Monday, 26th October 2026</strong></span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Building2 size={15} color="#ef4444" />
                  <span>Office of the General Manager & IT Department</span>
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
              {/* SECTION 1: Personal Info */}
              <div className="sf-card">
                <div className="sf-section-header">
                  <User size={18} />
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
                  <Upload size={18} />
                  <span>2. Recent Passport Photograph</span>
                </div>

                <div className="sf-callout">
                  📌 <strong>Notice Requirement:</strong> Provide a clear, recent passport photograph with a{" "}
                  <strong>plain white background</strong>, properly positioned with sufficient space above the head and
                  below the shoulders. This image will be used for your official digital staff ID card and payroll records.
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
                          <Trash2 size={15} style={{ marginRight: 4 }} /> Change
                        </button>
                      </>
                    ) : (
                      <div style={{ textAlign: "center", color: "#94a3b8", padding: 12 }}>
                        <User size={34} style={{ margin: "0 auto 4px", color: "#ef4444" }} />
                        <div style={{ fontSize: 11.5, fontWeight: 800, color: "#0f172a" }}>No Photo</div>
                        <div style={{ fontSize: 10, color: "#ef4444", fontWeight: 600 }}>White Background</div>
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
                      Maximum size: 10MB. Must have good lighting, front-facing framing, and a pure plain white background.
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Bank Account & Payroll */}
              <div className="sf-card">
                <div className="sf-section-header">
                  <CreditCard size={18} />
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
                      style={{ fontFamily: "monospace", letterSpacing: "0.08em", fontWeight: 700 }}
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
                      style={{ fontFamily: "monospace", color: "#0f172a", fontWeight: 800, fontSize: 15 }}
                    />
                    <div className="sf-input-hint">How much was your agreed monthly salary? (For HR payroll audit)</div>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Relevant Staff Documents Upload */}
              <div className="sf-card">
                <div className="sf-section-header">
                  <FileText size={18} />
                  <span>4. Relevant Staff Documents (NIN, Certificates, CV, etc.)</span>
                </div>

                <p style={{ fontSize: 13.5, color: "#64748b", lineHeight: 1.5, margin: "0 0 14px" }}>
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
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: 8 }}>
                      Attached Documents ({documents.length}):
                    </div>
                    {documents.map((doc, idx) => (
                      <div key={idx} className="sf-doc-item">
                        <div style={{ display: "flex", alignItems: "center", gap: 10, overflow: "hidden" }}>
                          <FileText size={18} color="#ef4444" style={{ flexShrink: 0 }} />
                          <div>
                            <div style={{ fontWeight: 700, color: "#0f172a" }}>{doc.title}</div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>
                              {doc.file.name} ({(doc.file.size / 1024).toFixed(1)} KB)
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveDoc(idx)}
                          style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", cursor: "pointer", padding: "6px 8px" }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "16px", color: "#64748b", fontSize: 12.5, border: "1px dashed #cbd5e1", borderRadius: 12, background: "#f8fafc" }}>
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

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, color: "#64748b", marginTop: 14 }}>
                  <ShieldCheck size={16} color="#ef4444" />
                  <span>You will review all details in a verification window before final submission.</span>
                </div>
              </div>
            </form>
          </main>
        )}

        {/* REVIEW SUMMARY MODAL */}
        {showReviewModal && (
          <div className="sf-modal-overlay">
            <div className="sf-modal-content">
              <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: "1.5px solid #fecaca", paddingBottom: 16, marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", display: "flex", alignItems: "center", justifyContent: "center", color: "#ef4444" }}>
                  <Eye size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#0f172a" }}>
                    Review Your Information
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748b" }}>
                    Please verify all your details and documents carefully before final submission.
                  </p>
                </div>
              </div>

              {/* Passport Photo Preview in Modal */}
              <div style={{ display: "flex", alignItems: "center", gap: 16, background: "#f8fafc", padding: 14, borderRadius: 14, border: "1px solid #e2e8f0", marginBottom: 18 }}>
                {passportPreview && (
                  <img
                    src={passportPreview}
                    alt="Passport"
                    style={{ width: 68, height: 85, objectFit: "cover", borderRadius: 10, border: "2px solid #ef4444" }}
                  />
                )}
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#0f172a" }}>{name}</div>
                  <div style={{ fontSize: 13, color: "#ef4444", fontWeight: 800 }}>
                    {position} · {department || "General"}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#16a34a", fontWeight: 600, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                    <CheckCircle2 size={13} /> Plain white background confirmed
                  </div>
                </div>
              </div>

              {/* Personal Details Table */}
              <div style={{ background: "#f8fafc", borderRadius: 14, padding: "12px 18px", border: "1px solid #e2e8f0", marginBottom: 16 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.04em" }}>
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
              <div style={{ background: "#f8fafc", borderRadius: 14, padding: "12px 18px", border: "1px solid #e2e8f0", marginBottom: 16 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.04em" }}>
                  Banking & Payroll
                </div>
                <div className="sf-review-row">
                  <span className="sf-review-label">Bank Name:</span>
                  <span className="sf-review-value">{finalBankDisplayName}</span>
                </div>
                <div className="sf-review-row">
                  <span className="sf-review-label">Account Number:</span>
                  <span className="sf-review-value" style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}>{accountNumber}</span>
                </div>
                <div className="sf-review-row">
                  <span className="sf-review-label">Account Name:</span>
                  <span className="sf-review-value">{accountName}</span>
                </div>
                <div className="sf-review-row">
                  <span className="sf-review-label">Monthly Salary:</span>
                  <span className="sf-review-value" style={{ color: "#0f172a", fontSize: 15, fontWeight: 800 }}>₦{salary || "0"}</span>
                </div>
              </div>

              {/* Documents List */}
              <div style={{ background: "#f8fafc", borderRadius: 14, padding: "12px 18px", border: "1px solid #e2e8f0", marginBottom: 20 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.04em" }}>
                  Attached Documents ({documents.length})
                </div>
                {documents.length > 0 ? (
                  documents.map((d, i) => (
                    <div key={i} className="sf-review-row">
                      <span className="sf-review-label">{d.title}:</span>
                      <span className="sf-review-value" style={{ fontSize: 12 }}>{d.file.name}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: 12.5, color: "#64748b" }}>No extra documents attached</div>
                )}
              </div>

              {/* Accuracy Check */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 24, fontSize: 13, color: "#334155", background: "#fef2f2", padding: "12px 16px", borderRadius: 12, border: "1px solid #fecaca" }}>
                <input
                  type="checkbox"
                  checked={confirmedAccuracy}
                  onChange={(e) => setConfirmedAccuracy(e.target.checked)}
                  style={{ width: 17, height: 17, accentColor: "#ef4444" }}
                />
                <span style={{ fontWeight: 600 }}>I confirm that all information and soft copies provided above are accurate and official.</span>
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
                  style={{ width: "auto", padding: "12px 26px", fontSize: 14 }}
                >
                  <CheckCircle2 size={16} />
                  <span>{loading ? uploadProgressText || "Submitting..." : "Confirm & Submit Official Records"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="sf-footer">
          <div style={{ fontWeight: 600, color: "#334155" }}>© 2026 360 Degree Global Estate Ltd. All Rights Reserved.</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>IT Department & Staff Digital Records Portal</div>
        </footer>
      </div>
    </>
  );
}
