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

    // Basic Validation
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

  // Render Success Screen
  if (submitted) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-slate-900/90 border border-amber-500/30 rounded-2xl p-8 md:p-10 shadow-2xl backdrop-blur-sm text-center">
          <div className="w-20 h-20 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold tracking-wider uppercase mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> Submission Successfully Received
          </span>

          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-3">
            Thank You, {name}!
          </h1>

          <p className="text-slate-300 text-sm md:text-base leading-relaxed mb-6">
            Your staff profile update, passport photograph, bank details, and relevant documents have been
            securely received and routed to the <strong>IT Department & Office of the General Manager</strong>.
          </p>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 mb-6 text-left space-y-2">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Reference Number:</span>
              <span className="font-mono text-amber-400 font-bold">{submissionRef}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Status:</span>
              <span className="text-amber-400 font-medium">Pending IT Review & Approval</span>
            </div>
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Department:</span>
              <span className="text-slate-200">{department || "General Operations"}</span>
            </div>
          </div>

          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-xs leading-relaxed mb-8 text-left">
            📌 <strong>Next Step:</strong> The IT Department will verify your passport background and bank details
            against payroll records. Once approved, your digital staff ID and profile records will be updated automatically.
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
            className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold transition-all shadow-lg shadow-amber-500/20"
          >
            Submit Another Record
          </button>
        </div>
      </main>
    );
  }

  // Render Form Screen
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      {/* Top Brand Banner */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-amber-500/20">
              360
            </div>
            <div>
              <div className="text-sm font-bold tracking-wider text-white">360 DEGREE GLOBAL</div>
              <div className="text-xs text-amber-400 font-medium tracking-wide">STAFF PORTAL & DIGITAL RECORDS</div>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Secure Official Form</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl w-full mx-auto px-4 py-8 md:py-12">
        {/* Notice Card */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-900/80 border border-amber-500/30 rounded-2xl p-6 md:p-8 shadow-2xl mb-8">
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Info className="w-4 h-4" /> Official Staff Notice
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-3">
            Staff Profile & Document Update
          </h1>
          <p className="text-slate-300 text-sm md:text-base leading-relaxed mb-4">
            All staff members are kindly requested to provide their up-to-date digital profile information,
            passport photograph with a plain white background, and bank payment details for accurate payroll records.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-4 border-t border-slate-800 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Submission Deadline: <strong className="text-slate-200">Monday, 26th October 2026</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Office of the General Manager & IT Department</span>
            </div>
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-950/60 border border-red-500/50 text-red-200 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* SECTION 1: Personal Details */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-2.5 mb-6 text-amber-400 font-bold text-base md:text-lg border-b border-slate-800 pb-3">
              <User className="w-5 h-5" />
              <span>1. Staff Personal Information</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Full Name <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Emmanuel Adebayo"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Phone Number <span className="text-amber-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 0801 234 5678"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. staff@360degree.com"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Department <span className="text-amber-400">*</span>
                </label>
                <select
                  required
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                >
                  <option value="">Select your department...</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Rank / Position <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="e.g. Supervisor, Chef, Cashier, Receptionist"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Staff / Employee ID <span className="text-slate-500 font-normal">(Optional if not yet assigned)</span>
                </label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g. 360-EMP-1024"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Passport Photograph */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-2.5 mb-4 text-amber-400 font-bold text-base md:text-lg border-b border-slate-800 pb-3">
              <Upload className="w-5 h-5" />
              <span>2. Recent Passport Photograph</span>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 mb-5 text-xs text-amber-200 leading-relaxed">
              📌 <strong>Notice Requirement:</strong> Provide a clear, recent passport photograph with a{" "}
              <strong>plain white background</strong>, properly positioned with sufficient space above the head and
              below the shoulders. This image will be used for your official digital staff ID card and profile records.
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Preview Box */}
              <div className="w-36 h-44 rounded-xl border-2 border-dashed border-slate-700 bg-slate-950 flex flex-col items-center justify-center overflow-hidden shrink-0 relative group">
                {passportPreview ? (
                  <>
                    <img
                      src={passportPreview}
                      alt="Passport Preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPassportFile(null);
                        setPassportPreview(null);
                      }}
                      className="absolute inset-0 bg-slate-950/80 text-red-400 opacity-0 group-hover:opacity-100 flex items-center justify-center font-semibold text-xs transition"
                    >
                      <Trash2 className="w-4 h-4 mr-1" /> Change
                    </button>
                  </>
                ) : (
                  <div className="text-center p-3 text-slate-500">
                    <User className="w-10 h-10 mx-auto mb-1 text-slate-600" />
                    <span className="text-[11px] block">No Photo</span>
                    <span className="text-[9px] text-amber-400/80">White background</span>
                  </div>
                )}
              </div>

              {/* Upload Input */}
              <div className="w-full flex-1">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Select Passport Photo (JPG, PNG) <span className="text-amber-400">*</span>
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePassportChange}
                  className="block w-full text-xs text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-600 cursor-pointer bg-slate-950 border border-slate-700 rounded-xl p-2"
                />
                <p className="text-[11px] text-slate-400 mt-2">
                  Max file size: 10MB. Must have good lighting and a pure white background.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 3: Payment & Payroll Details */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-2.5 mb-4 text-amber-400 font-bold text-base md:text-lg border-b border-slate-800 pb-3">
              <CreditCard className="w-5 h-5" />
              <span>3. Bank Account & Payroll Details</span>
            </div>

            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 mb-5 text-xs text-slate-300 leading-relaxed">
              📌 <strong>Payroll Accuracy:</strong> Please ensure your bank account name matches your official staff
              name to prevent salary payment delays.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Bank Name <span className="text-amber-400">*</span>
                </label>
                <select
                  required
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                >
                  <option value="">Select your bank...</option>
                  {NIGERIAN_BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>

                {selectedBank === "Other / Microfinance Bank" && (
                  <input
                    type="text"
                    required
                    placeholder="Type Bank / MFB Name"
                    value={customBankName}
                    onChange={(e) => setCustomBankName(e.target.value)}
                    className="mt-3 w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Account Number (10 Digits) <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 0123456789"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-mono tracking-wider transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Account Holder Name <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. John Emmanuel Adebayo"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Current Monthly Salary (₦ NGN) <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={salary}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, "");
                    setSalary(raw ? Number(raw).toLocaleString() : "");
                  }}
                  placeholder="e.g. 150,000"
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-mono transition"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  How much was your agreed monthly salary? (For HR payroll verification)
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 4: Relevant Soft-Copy Documents Upload */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-2.5 mb-4 text-amber-400 font-bold text-base md:text-lg border-b border-slate-800 pb-3">
              <FileText className="w-5 h-5" />
              <span>4. Relevant Staff Documents (NIN, Certificates, CV, etc.)</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Please attach soft copies of all your relevant credentials (NIN Slip, Voter&apos;s Card, Degree/Diploma
              Certificates, Employment Letter, CV/Resume). You can add multiple documents.
            </p>

            {/* Document Add Form */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 mb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Document Title / Type
                  </label>
                  <input
                    type="text"
                    value={currentDocTitle}
                    onChange={(e) => setCurrentDocTitle(e.target.value)}
                    placeholder="e.g. National ID (NIN Slip), B.Sc Certificate"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Select File (PDF, Images, DOCX)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setCurrentDocFile(e.target.files[0]);
                      }
                    }}
                    className="block w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer bg-slate-900 border border-slate-700 rounded-lg p-1"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddDocument}
                disabled={!currentDocFile}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-semibold text-xs rounded-lg border border-amber-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" /> Add Document to List
              </button>
            </div>

            {/* List of Attached Documents */}
            {documents.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Attached Documents ({documents.length}):
                </div>
                {documents.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-200 truncate">{doc.title}</div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {doc.file.name} ({(doc.file.size / 1024).toFixed(1)} KB)
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDoc(idx)}
                      className="text-red-400 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10 transition shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-800 rounded-xl">
                No extra documents attached yet. Click &quot;Add Document to List&quot; above to include NIN, certificates, etc.
              </div>
            )}
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold text-base transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>{uploadProgressText || "Submitting Staff Profile..."}</span>
                </>
              ) : (
                <>
                  <span>Submit Profile & Documents</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            <p className="text-center text-xs text-slate-400 mt-3 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>
                Your data is stored securely and directly accessible by authorized IT & Admin personnel only.
              </span>
            </p>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-400">
        <div>© 2026 360 Degree Global. All Rights Reserved.</div>
        <div className="text-[11px] text-slate-400 mt-1">IT Department & Digital Staff Administration</div>
      </footer>
    </div>
  );
}

