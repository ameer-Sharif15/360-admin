"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { getClients, ID, Query, type Models } from "../../lib/appwrite";
import { uploadToCloudinary } from "../../lib/cloudinary";
import { API_BASE_URL, apiRequest } from "../../lib/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawLetterhead, stampDocumentFooter } from "../../lib/pdfLetterhead";
import {
  Search,
  IdCard,
  FileDown,
  Download,
  Plus,
  X,
  PenTool,
  Check,
  CheckCircle2,
  AlertTriangle,
  Users,
  DollarSign,
  FolderOpen,
  Edit,
  User,
  Trash2,
  Printer,
  Sliders,
  Eye,
  FileText,
  Calendar,
  Save,
  History,
  TrendingDown,
  RefreshCw,
  QrCode,
  ShieldCheck,
  Building,
  Phone,
  Layers,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
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
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  basicSalary?: number;
  allowances?: number;
  deductions?: number;
  deductionReason?: string;
  netSalary?: number;
  idCardLayout?: {
    photoX?: number;
    photoY?: number;
    photoScale?: number;
    signatureX?: number;
    signatureY?: number;
    signatureScale?: number;
  };
  documents?: StaffDocument[];
};

export type StaffSubmissionItem = {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  department?: string;
  position?: string;
  employeeId?: string;
  photoUrl?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  salary?: number;
  documents?: StaffDocument[];
  status: "pending" | "approved" | "rejected";
  reviewNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type MonthlyPayrollRecord = {
  _id?: string;
  staffId: string;
  month: string;
  staffName: string;
  department?: string;
  position?: string;
  employeeId?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  deductionReason?: string;
  netSalary: number;
  status: "pending" | "approved" | "paid";
  paidAt?: string;
  notes?: string;
};

const COLLECTION_KEY = "STAFF_MEMBERS";
const DIRECTOR_SIG_KEY = "360_director_signature_url";

const MONTHS_LIST = [
  { value: "01", name: "January" },
  { value: "02", name: "February" },
  { value: "03", name: "March" },
  { value: "04", name: "April" },
  { value: "05", name: "May" },
  { value: "06", name: "June" },
  { value: "07", name: "July" },
  { value: "08", name: "August" },
  { value: "09", name: "September" },
  { value: "10", name: "October" },
  { value: "11", name: "November" },
  { value: "12", name: "December" },
];

const YEARS_LIST = ["2024", "2025", "2026", "2027", "2028", "2029", "2030"];

// ─── Spinner ─────────────────────────────────────────────────────────────────
function Spinner({ size = 14, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2.5} strokeLinecap="round"
      style={{ animation: "spin360 0.7s linear infinite", flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="10" strokeOpacity={0.2} />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

// ─── LoaderButton ─────────────────────────────────────────────────────────────
function LoaderButton({
  loading, onClick, style, children, type = "button", disabled, title,
}: {
  loading?: boolean; onClick?: () => void; style?: React.CSSProperties;
  children: React.ReactNode; type?: "button" | "submit" | "reset";
  disabled?: boolean; title?: string;
}) {
  return (
    <button
      type={type} onClick={onClick} disabled={loading || disabled} title={title}
      style={{
        ...style,
        opacity: loading || disabled ? 0.68 : 1,
        display: "inline-flex", alignItems: "center", gap: 6,
        cursor: loading || disabled ? "not-allowed" : "pointer",
      }}
    >
      {loading && <Spinner size={13} color={(style?.color as string) || "#fff"} />}
      {children}
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StaffsPage() {
  const [activeTab, setActiveTab] = useState<"directory" | "salary" | "documents" | "submissions">("directory");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Staff Form Submissions State
  const [submissions, setSubmissions] = useState<StaffSubmissionItem[]>([]);
  const [pendingSubmissionsCount, setPendingSubmissionsCount] = useState<number>(0);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionFilter, setSubmissionFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [reviewingSubmission, setReviewingSubmission] = useState<StaffSubmissionItem | null>(null);
  const [reviewActionLoading, setReviewActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<StaffMember>>({
    active: true, basicSalary: 0, allowances: 0, deductions: 0, netSalary: 0,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Documents
  const [selectedStaffForDocs, setSelectedStaffForDocs] = useState<StaffMember | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Card modal
  const [showCardModal, setShowCardModal] = useState(false);
  const [previewMembers, setPreviewMembers] = useState<StaffMember[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Row-level loading
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Director signature
  const [directorSigUrl, setDirectorSigUrl] = useState("");
  const [directorSigFile, setDirectorSigFile] = useState<File | null>(null);
  const [uploadingDirectorSig, setUploadingDirectorSig] = useState(false);
  const [showDirectorSigPanel, setShowDirectorSigPanel] = useState(false);

  // PDF
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [downloadingCsv, setDownloadingCsv] = useState(false);
  const [downloadingPayrollPdf, setDownloadingPayrollPdf] = useState(false);

  // Monthly Salary System
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState<string>(String(today.getFullYear()));
  const [selectedMonth, setSelectedMonth] = useState<string>(String(today.getMonth() + 1).padStart(2, "0"));
  const [salarySubTab, setSalarySubTab] = useState<"schedule" | "history">("schedule");
  const [monthlyRecords, setMonthlyRecords] = useState<MonthlyPayrollRecord[]>([]);
  const [payrollHistory, setPayrollHistory] = useState<any[]>([]);
  const [loadingMonthlyPayroll, setLoadingMonthlyPayroll] = useState(false);
  const [savingMonthlyPayroll, setSavingMonthlyPayroll] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Monthly Record & Deduction Edit Modal
  const [editingMonthRecord, setEditingMonthRecord] = useState<MonthlyPayrollRecord | null>(null);
  const [editMonthBasic, setEditMonthBasic] = useState<number>(0);
  const [editMonthAllowances, setEditMonthAllowances] = useState<number>(0);
  const [editMonthDeduction, setEditMonthDeduction] = useState<number>(0);
  const [editMonthDeductionReason, setEditMonthDeductionReason] = useState<string>("");
  const [editMonthBankName, setEditMonthBankName] = useState<string>("");
  const [editMonthAccountNumber, setEditMonthAccountNumber] = useState<string>("");
  const [editMonthAccountName, setEditMonthAccountName] = useState<string>("");
  const [editMonthStatus, setEditMonthStatus] = useState<"pending" | "approved" | "paid">("pending");
  const [savingMonthRecord, setSavingMonthRecord] = useState(false);
  const [monthSearchFilter, setMonthSearchFilter] = useState<string>("");

  const cardRefs = useRef<{ [id: string]: { front: HTMLDivElement | null; back: HTMLDivElement | null } }>({});

  const [cardLayout, setCardLayout] = useState({
    photoX: 0, photoY: 0, photoScale: 100,
    signatureX: 0, signatureY: 0, signatureScale: 100,
  });

  // ─── QR Code Base URL & Params Configuration ──────────────────────────────
  const [qrEnvPreset, setQrEnvPreset] = useState<"domain" | "vercel" | "localhost_admin" | "localhost_webapp" | "custom">("domain");
  const [qrBaseUrl, setQrBaseUrl] = useState<string>("https://360degreeglobal.org");
  const [qrAttendPath, setQrAttendPath] = useState<string>("/attend/staff/{id}");
  const [qrVerifyPath, setQrVerifyPath] = useState<string>("/verify/staff/{id}");
  const [qrParamFlags, setQrParamFlags] = useState({
    empId: false,
    name: false,
    dept: false,
    role: false,
    phone: false,
    status: false,
  });
  const [qrCustomParams, setQrCustomParams] = useState<string>("");

  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem("360_qr_url_config");
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        if (parsed.qrEnvPreset) setQrEnvPreset(parsed.qrEnvPreset);
        if (parsed.qrBaseUrl) setQrBaseUrl(parsed.qrBaseUrl);
        if (parsed.qrAttendPath) setQrAttendPath(parsed.qrAttendPath);
        if (parsed.qrVerifyPath) setQrVerifyPath(parsed.qrVerifyPath);
        if (parsed.qrParamFlags) setQrParamFlags((prev) => ({ ...prev, ...parsed.qrParamFlags }));
        if (typeof parsed.qrCustomParams === "string") setQrCustomParams(parsed.qrCustomParams);
      }
    } catch (_) {}
  }, []);

  const saveQrConfig = (updates: Partial<{
    qrEnvPreset: "domain" | "vercel" | "localhost_admin" | "localhost_webapp" | "custom";
    qrBaseUrl: string;
    qrAttendPath: string;
    qrVerifyPath: string;
    qrParamFlags: typeof qrParamFlags;
    qrCustomParams: string;
  }>) => {
    try {
      const next = {
        qrEnvPreset: updates.qrEnvPreset ?? qrEnvPreset,
        qrBaseUrl: updates.qrBaseUrl ?? qrBaseUrl,
        qrAttendPath: updates.qrAttendPath ?? qrAttendPath,
        qrVerifyPath: updates.qrVerifyPath ?? qrVerifyPath,
        qrParamFlags: updates.qrParamFlags ?? qrParamFlags,
        qrCustomParams: updates.qrCustomParams ?? qrCustomParams,
      };
      localStorage.setItem("360_qr_url_config", JSON.stringify(next));
    } catch (_) {}
  };

  const handleSelectQrPreset = (preset: "domain" | "vercel" | "localhost_admin" | "localhost_webapp" | "custom") => {
    setQrEnvPreset(preset);
    let nextBase = qrBaseUrl;
    if (preset === "domain") {
      nextBase = "https://360degreeglobal.org";
    } else if (preset === "vercel") {
      nextBase = "https://360live-three.vercel.app";
    } else if (preset === "localhost_admin") {
      nextBase =
        typeof window !== "undefined" && window.location.hostname === "localhost"
          ? window.location.origin
          : "http://localhost:3000";
    } else if (preset === "localhost_webapp") {
      nextBase = "http://localhost:5173";
    }
    setQrBaseUrl(nextBase);
    saveQrConfig({ qrEnvPreset: preset, qrBaseUrl: nextBase });
  };

  const buildStaffQrUrls = (member: StaffMember) => {
    const empId = member.employeeId || `360-${member.$id.slice(0, 6).toUpperCase()}`;
    const cleanBase = (qrBaseUrl || "https://360degreeglobal.org").trim().replace(/\/+$/, "");

    const formatPath = (rawTemplate: string, fallbackPrefix: string) => {
      let p = (rawTemplate || fallbackPrefix).trim();
      if (!p.startsWith("/")) p = "/" + p;
      if (p.includes("{id}") || p.includes("{empId}")) {
        p = p
          .replace(/\{id\}/g, encodeURIComponent(member.$id))
          .replace(/\{empId\}/g, encodeURIComponent(empId));
      } else {
        p = p.replace(/\/+$/, "") + "/" + encodeURIComponent(member.$id);
      }
      return p;
    };

    const params = new URLSearchParams();
    if (qrParamFlags.empId) params.set("empId", empId);
    if (qrParamFlags.name && member.name) params.set("name", member.name);
    if (qrParamFlags.dept) params.set("dept", member.department || "GENERAL");
    if (qrParamFlags.role) params.set("role", member.position || "OFFICIAL STAFF");
    if (qrParamFlags.phone && member.phone) params.set("phone", member.phone);
    if (qrParamFlags.status) params.set("status", member.active ? "ACTIVE" : "INACTIVE");

    if (qrCustomParams.trim()) {
      const cleanedCustom = qrCustomParams.trim().replace(/^\?/, "");
      cleanedCustom.split("&").forEach((pair) => {
        const [k, ...rest] = pair.split("=");
        if (k && k.trim()) {
          params.set(k.trim(), rest.join("=").trim());
        }
      });
    }

    const qs = params.toString();
    const attendPathStr = formatPath(qrAttendPath, "/attend/staff/{id}");
    const verifyPathStr = formatPath(qrVerifyPath, "/verify/staff/{id}");

    const joinWithParams = (baseAndPath: string) => {
      if (!qs) return baseAndPath;
      return baseAndPath.includes("?") ? `${baseAndPath}&${qs}` : `${baseAndPath}?${qs}`;
    };

    return {
      empId,
      attendUrl: joinWithParams(`${cleanBase}${attendPathStr}`),
      verifyUrl: joinWithParams(`${cleanBase}${verifyPathStr}`),
    };
  };

  const clientBundle = useMemo(() => {
    try { return getClients(); }
    catch (e: any) { setError(e.message); return null; }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(DIRECTOR_SIG_KEY);
    setDirectorSigUrl(saved || "/signatures/official_signature_dark.png");
  }, []);

  // Auto-clear alerts
  useEffect(() => {
    if (successMsg) { const t = setTimeout(() => setSuccessMsg(null), 4000); return () => clearTimeout(t); }
  }, [successMsg]);
  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(null), 6000); return () => clearTimeout(t); }
  }, [error]);

  const fetchStaff = async () => {
    if (!clientBundle) return;
    setLoading(true);
    try {
      const res = await clientBundle.databases.listDocuments<StaffMember & Models.Document>(
        clientBundle.databaseId, clientBundle.COLLECTIONS[COLLECTION_KEY],
        [Query.orderDesc("$createdAt")]
      );
      setStaff(res.documents);
      fetchMonthlyPayroll(selectedYear, selectedMonth, res.documents);
      if (selectedStaffForDocs) {
        const updated = res.documents.find((s) => s.$id === selectedStaffForDocs.$id);
        if (updated) setSelectedStaffForDocs(updated);
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStaff(); }, [clientBundle]);

  // ─── Fetch Staff Form Submissions ─────────────────────────────────────────
  const fetchSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const res = await apiRequest(
        `/api/staff-submissions?status=${submissionFilter}&search=${encodeURIComponent(submissionSearch)}`
      );
      if (res && res.success) {
        setSubmissions(res.submissions || []);
        if (typeof res.pendingCount === "number") {
          setPendingSubmissionsCount(res.pendingCount);
        }
      }
    } catch (err: any) {
      console.warn("Could not fetch staff submissions:", err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [submissionFilter, submissionSearch]);

  const handleApproveSubmission = async (subId: string) => {
    try {
      setReviewActionLoading(true);
      const res = await apiRequest(`/api/staff-submissions/${subId}/approve`, {
        method: "POST",
      });
      if (res && res.success) {
        setSuccessMsg(res.message || "Staff member approved and saved to records!");
        setReviewingSubmission(null);
        await fetchSubmissions();
        await fetchStaff();
      } else {
        throw new Error(res?.message || "Failed to approve submission");
      }
    } catch (err: any) {
      setError("Approval failed: " + err.message);
    } finally {
      setReviewActionLoading(false);
    }
  };

  const handleRejectSubmission = async (subId: string) => {
    try {
      setReviewActionLoading(true);
      const res = await apiRequest(`/api/staff-submissions/${subId}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason || "Rejected by Admin" }),
      });
      if (res && res.success) {
        setSuccessMsg("Submission marked as rejected.");
        setReviewingSubmission(null);
        setShowRejectInput(false);
        setRejectReason("");
        await fetchSubmissions();
      } else {
        throw new Error(res?.message || "Failed to reject submission");
      }
    } catch (err: any) {
      setError("Rejection failed: " + err.message);
    } finally {
      setReviewActionLoading(false);
    }
  };

  const handleDeleteSubmission = async (subId: string) => {
    if (!confirm("Are you sure you want to permanently delete this submission?")) return;
    try {
      await apiRequest(`/api/staff-submissions/${subId}`, { method: "DELETE" });
      setSuccessMsg("Submission deleted.");
      if (reviewingSubmission?._id === subId) setReviewingSubmission(null);
      await fetchSubmissions();
    } catch (err: any) {
      setError("Delete failed: " + err.message);
    }
  };

  // ─── Fetch Monthly Payroll Records (Merged with Staff Roster) ─────────────
  const fetchMonthlyPayroll = async (year = selectedYear, month = selectedMonth, currentStaff = staff) => {
    const monthKey = `${year}-${month}`;
    setLoadingMonthlyPayroll(true);
    try {
      const res = await apiRequest(`/api/payroll?month=${monthKey}`);
      const savedList: MonthlyPayrollRecord[] = (res && Array.isArray(res.records)) ? res.records : [];
      const savedMap = new Map<string, MonthlyPayrollRecord>();
      savedList.forEach((r) => {
        if (r.staffId) savedMap.set(String(r.staffId), r);
      });

      // Target staff roster: currentStaff or state staff
      const roster = currentStaff.length > 0 ? currentStaff : staff;

      // Merge saved overrides with active staff roster
      const combined: MonthlyPayrollRecord[] = roster.map((s) => {
        const saved = savedMap.get(String(s.$id));
        if (saved) {
          return {
            ...saved,
            staffName: saved.staffName || s.name,
            department: saved.department || s.department,
            position: saved.position || s.position,
            employeeId: saved.employeeId || s.employeeId,
            bankName: saved.bankName || s.bankName,
            accountNumber: saved.accountNumber || s.accountNumber,
            accountName: saved.accountName || s.accountName || s.name,
          };
        }
        // Staff member hasn't been individually modified for this month: seed base pay & bank info
        const basic = Number(s.basicSalary) || 0;
        const allow = Number(s.allowances) || 0;
        const deduct = 0;
        return {
          staffId: s.$id,
          month: monthKey,
          staffName: s.name,
          department: s.department,
          position: s.position,
          employeeId: s.employeeId,
          bankName: s.bankName,
          accountNumber: s.accountNumber,
          accountName: s.accountName || s.name,
          basicSalary: basic,
          allowances: allow,
          deductions: deduct,
          deductionReason: "",
          netSalary: Math.max(0, basic + allow - deduct),
          status: "pending",
        };
      });

      // Append any historical saved records in MongoDB that might not currently be active in Appwrite
      savedList.forEach((r) => {
        if (!combined.some((c) => String(c.staffId) === String(r.staffId))) {
          combined.push(r);
        }
      });

      setMonthlyRecords(combined);
    } catch (err: any) {
      console.warn("Payroll fetch notice:", err.message);
      const roster = currentStaff.length > 0 ? currentStaff : staff;
      const defaultRecords: MonthlyPayrollRecord[] = roster.map((s) => ({
        staffId: s.$id,
        month: monthKey,
        staffName: s.name,
        department: s.department,
        position: s.position,
        employeeId: s.employeeId,
        bankName: s.bankName,
        accountNumber: s.accountNumber,
        accountName: s.accountName || s.name,
        basicSalary: Number(s.basicSalary) || 0,
        allowances: Number(s.allowances) || 0,
        deductions: 0,
        deductionReason: "",
        netSalary: Math.max(0, (Number(s.basicSalary) || 0) + (Number(s.allowances) || 0)),
        status: "pending",
      }));
      setMonthlyRecords(defaultRecords);
    } finally {
      setLoadingMonthlyPayroll(false);
    }
  };

  // Fetch history archive
  const fetchPayrollHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await apiRequest("/api/payroll/history");
      if (Array.isArray(res)) {
        setPayrollHistory(res);
      }
    } catch (err: any) {
      console.warn("Payroll history notice:", err.message);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Trigger monthly fetch when month/year changes or when activeTab switches to salary
  useEffect(() => {
    if (activeTab === "salary") {
      fetchMonthlyPayroll(selectedYear, selectedMonth);
      fetchPayrollHistory();
    }
  }, [activeTab, selectedYear, selectedMonth, staff.length]);

  const handleSalaryChange = (field: "basicSalary" | "allowances" | "deductions", val: number) => {
    const updated = { ...form, [field]: val };
    const basic = Number(field === "basicSalary" ? val : updated.basicSalary) || 0;
    const allow = Number(field === "allowances" ? val : updated.allowances) || 0;
    const deduct = Number(field === "deductions" ? val : updated.deductions) || 0;
    updated.netSalary = Math.max(0, basic + allow - deduct);
    setForm(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientBundle) return;
    setLoading(true); setError(null); setSuccessMsg(null);
    try {
      let finalPhotoUrl = form.photoUrl || "";
      let finalSignatureUrl = form.signatureUrl || "";
      if (imageFile) {
        setUploadingImage(true);
        try { finalPhotoUrl = await uploadToCloudinary(imageFile, "staff_photos"); }
        catch (err: any) { setError("Photo upload failed: " + err.message); return; }
        finally { setUploadingImage(false); }
      }
      if (signatureFile) {
        try { finalSignatureUrl = await uploadToCloudinary(signatureFile, "staff_signatures"); }
        catch (err: any) { setError("Signature upload failed: " + err.message); return; }
      }
      const { databases, databaseId, COLLECTIONS } = clientBundle;
      const dataToSave: any = {
        ...form, role: form.role || "staff",
        photoUrl: finalPhotoUrl, signatureUrl: finalSignatureUrl,
        basicSalary: Number(form.basicSalary) || 0,
        allowances: Number(form.allowances) || 0,
        deductions: Number(form.deductions) || 0,
        netSalary: Number(form.netSalary) || 0,
        idCardLayout: cardLayout,
      };
      if (editingId) {
        await databases.updateDocument(databaseId, COLLECTIONS[COLLECTION_KEY], editingId, dataToSave);
        setSuccessMsg("Staff member updated!");
      } else {
        await databases.createDocument(databaseId, COLLECTIONS[COLLECTION_KEY], ID.unique(), dataToSave);
        setSuccessMsg("Staff member created!");
      }
      setShowForm(false); setEditingId(null);
      setForm({ active: true, basicSalary: 0, allowances: 0, deductions: 0, netSalary: 0 });
      setImageFile(null); setSignatureFile(null);
      await fetchStaff();
      // Also refresh month schedule
      fetchMonthlyPayroll();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleEdit = (member: StaffMember) => {
    setEditingId(member.$id); setForm(member);
    if (member.idCardLayout) {
      setCardLayout({
        photoX: member.idCardLayout.photoX || 0, photoY: member.idCardLayout.photoY || 0,
        photoScale: member.idCardLayout.photoScale || 100,
        signatureX: member.idCardLayout.signatureX || 0, signatureY: member.idCardLayout.signatureY || 0,
        signatureScale: member.idCardLayout.signatureScale || 100,
      });
    }
    setImageFile(null); setSignatureFile(null);
    setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this staff member?")) return;
    if (!clientBundle) return;
    setDeletingId(id);
    try {
      const { databases, databaseId, COLLECTIONS } = clientBundle;
      await databases.deleteDocument(databaseId, COLLECTIONS[COLLECTION_KEY], id);
      await fetchStaff(); setSuccessMsg("Staff member deleted.");
    } catch (e: any) { setError(e.message); }
    finally { setDeletingId(null); }
  };

  const toggleSelection = (id: string) => {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  };

  const handleBulkGenerate = () => {
    setPreviewMembers(staff.filter((s) => selectedIds.has(s.$id)));
    setShowCardModal(true);
  };

  const handleSingleGenerate = (member: StaffMember) => {
    setPreviewMembers([member]);
    if (member.idCardLayout) {
      setCardLayout({
        photoX: member.idCardLayout.photoX || 0, photoY: member.idCardLayout.photoY || 0,
        photoScale: member.idCardLayout.photoScale || 100,
        signatureX: member.idCardLayout.signatureX || 0, signatureY: member.idCardLayout.signatureY || 0,
        signatureScale: member.idCardLayout.signatureScale || 100,
      });
    }
    setShowCardModal(true);
  };

  // Director signature
  const handleDirectorSigUpload = async () => {
    if (!directorSigFile) return;
    setUploadingDirectorSig(true);
    try {
      const url = await uploadToCloudinary(directorSigFile, "director_signatures");
      setDirectorSigUrl(url); localStorage.setItem(DIRECTOR_SIG_KEY, url);
      setDirectorSigFile(null);
      setSuccessMsg("Director signature saved! It will appear on all ID card backs.");
    } catch (err: any) { setError("Upload failed: " + err.message); }
    finally { setUploadingDirectorSig(false); }
  };

  const handleRemoveDirectorSig = () => {
    if (!confirm("Remove director signature from all ID cards?")) return;
    setDirectorSigUrl(""); localStorage.removeItem(DIRECTOR_SIG_KEY);
    setSuccessMsg("Director signature removed.");
  };

  // ─── PDF: Single Card (CR80 Portrait 54mm × 85.6mm) ────────────────────────
  const downloadCardAsPdf = async (member: StaffMember) => {
    const refs = cardRefs.current[member.$id];
    if (!refs?.front || !refs?.back) { alert("Card not rendered yet."); return; }
    setDownloadingIds((prev) => new Set(prev).add(member.$id));
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"), import("html2canvas"),
      ]);
      const [fc, bc] = await Promise.all([
        html2canvas(refs.front, { scale: 3, useCORS: true, allowTaint: true }),
        html2canvas(refs.back, { scale: 3, useCORS: true, allowTaint: true }),
      ]);
      // Standard CR80 badge dimensions in millimeters
      const W = 54;
      const H = 85.6;
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [W * 2 + 20, H + 26],
      });
      // Side-by-side: Front on left, Back on right
      pdf.addImage(fc.toDataURL("image/png"), "PNG", 7, 7, W, H);
      pdf.addImage(bc.toDataURL("image/png"), "PNG", W + 13, 7, W, H);

      pdf.setFontSize(6.5); pdf.setTextColor(100);
      pdf.text("FRONT (54 × 85.6 mm)", 7 + W / 2, H + 13, { align: "center" });
      pdf.text("BACK (54 × 85.6 mm)", W + 13 + W / 2, H + 13, { align: "center" });

      pdf.setFontSize(5.5); pdf.setTextColor(140);
      pdf.text(
        `Official CR80 Identity Card · Generated by IT Department · 360 Degree Global Estate Ltd. · ${new Date().toLocaleDateString("en-GB")}`,
        W * 2 + 13,
        H + 19,
        { align: "right" }
      );
      pdf.save(`ID_${member.name.replace(/\s+/g, "_")}_${member.employeeId || member.$id.slice(0, 6)}.pdf`);
    } catch (err: any) { setError("PDF failed: " + err.message); }
    finally { setDownloadingIds((prev) => { const n = new Set(prev); n.delete(member.$id); return n; }); }
  };

  // ─── PDF: All Cards (CR80 Portrait 54mm × 85.6mm per page) ───────────────────
  const downloadAllAsPdf = async () => {
    setDownloadingPdf(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"), import("html2canvas"),
      ]);
      const W = 54;
      const H = 85.6;
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [W * 2 + 20, H + 26],
      });
      for (let i = 0; i < previewMembers.length; i++) {
        const m = previewMembers[i];
        const refs = cardRefs.current[m.$id];
        if (!refs?.front || !refs?.back) continue;
        if (i > 0) pdf.addPage([W * 2 + 20, H + 26], "landscape");
        const [fc, bc] = await Promise.all([
          html2canvas(refs.front, { scale: 3, useCORS: true, allowTaint: true }),
          html2canvas(refs.back, { scale: 3, useCORS: true, allowTaint: true }),
        ]);
        pdf.addImage(fc.toDataURL("image/png"), "PNG", 7, 7, W, H);
        pdf.addImage(bc.toDataURL("image/png"), "PNG", W + 13, 7, W, H);

        pdf.setFontSize(6.5); pdf.setTextColor(100);
        pdf.text("FRONT (54 × 85.6 mm)", 7 + W / 2, H + 13, { align: "center" });
        pdf.text("BACK (54 × 85.6 mm)", W + 13 + W / 2, H + 13, { align: "center" });

        pdf.text(m.name, 7, H + 19, { align: "left" });
        pdf.setFontSize(5.5); pdf.setTextColor(140);
        pdf.text(
          `Official Document · Generated by IT Department · 360 Degree Global Estate Ltd. · ${new Date().toLocaleDateString("en-GB")}`,
          W * 2 + 13,
          H + 19,
          { align: "right" }
        );
      }
      pdf.save(`360_ID_Cards_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err: any) { setError("Batch PDF failed: " + err.message); }
    finally { setDownloadingPdf(false); }
  };

  // ─── Quick Month Selector Helper ───────────────────────────────────────────
  const selectedMonthName = MONTHS_LIST.find((m) => m.value === selectedMonth)?.name || "Month";

  // ─── Update Month Record Modal & Handlers ──────────────────────────────────
  const handleOpenEditMonthModal = (record: MonthlyPayrollRecord) => {
    setEditingMonthRecord(record);
    setEditMonthBasic(Number(record.basicSalary) || 0);
    setEditMonthAllowances(Number(record.allowances) || 0);
    setEditMonthDeduction(Number(record.deductions) || 0);
    setEditMonthDeductionReason(record.deductionReason || "");
    setEditMonthBankName(record.bankName || "");
    setEditMonthAccountNumber(record.accountNumber || "");
    setEditMonthAccountName(record.accountName || record.staffName || "");
    setEditMonthStatus(record.status || "pending");
  };

  const handleSaveMonthRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMonthRecord) return;
    setSavingMonthRecord(true);
    const monthKey = `${selectedYear}-${selectedMonth}`;
    const basic = Number(editMonthBasic) || 0;
    const allowances = Number(editMonthAllowances) || 0;
    const deductions = Number(editMonthDeduction) || 0;
    const netSalary = Math.max(0, basic + allowances - deductions);

    const payload = {
      staffId: editingMonthRecord.staffId,
      month: monthKey,
      staffName: editingMonthRecord.staffName,
      department: editingMonthRecord.department,
      position: editingMonthRecord.position,
      employeeId: editingMonthRecord.employeeId,
      bankName: editMonthBankName,
      accountNumber: editMonthAccountNumber,
      accountName: editMonthAccountName,
      basicSalary: basic,
      allowances: allowances,
      deductions: deductions,
      deductionReason: editMonthDeductionReason,
      netSalary: netSalary,
      status: editMonthStatus,
    };

    try {
      await apiRequest("/api/payroll/staff", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Update in-memory state
      setMonthlyRecords((prev) =>
        prev.map((r) =>
          String(r.staffId) === String(editingMonthRecord.staffId)
            ? { ...r, ...payload }
            : r
        )
      );

      setSuccessMsg(`Successfully updated ${selectedMonthName} ${selectedYear} record for ${editingMonthRecord.staffName}!`);
      setEditingMonthRecord(null);
      fetchPayrollHistory();
    } catch (err: any) {
      setError("Failed to save month record: " + err.message);
    } finally {
      setSavingMonthRecord(false);
    }
  };

  // ─── Bulk Save Current Month Schedule ──────────────────────────────────────
  const handleBulkSaveMonthlyPayroll = async () => {
    const monthKey = `${selectedYear}-${selectedMonth}`;
    setSavingMonthlyPayroll(true);
    try {
      await apiRequest("/api/payroll/bulk", {
        method: "POST",
        body: JSON.stringify({
          month: monthKey,
          records: monthlyRecords,
        }),
      });
      setSuccessMsg(`Monthly payroll schedule for ${selectedMonthName} ${selectedYear} saved & locked!`);
      fetchPayrollHistory();
    } catch (err: any) {
      setError("Failed to save month schedule: " + err.message);
    } finally {
      setSavingMonthlyPayroll(false);
    }
  };

  // ─── Bank Payroll PDF (Selected Month & Year) ──────────────────────────────
  const downloadPayrollPDF = async () => {
    setDownloadingPayrollPdf(true);
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const monthKey = `${selectedYear}-${selectedMonth}`;
      const docRef = `360-PAYROLL-${selectedYear}${selectedMonth}`;

      const startY = await drawLetterhead(doc, {
        title: `Staff Salary & Bank Payment Schedule - ${selectedMonthName} ${selectedYear}`,
        subtitle: `Confidential Bank Credit Advice · Payment Period: ${selectedMonthName} ${selectedYear} · 360 Degree Global Estate Ltd.`,
        docRef,
        badge: "BANK ADVICE",
      });

      const currentRecords = monthlyRecords.length > 0 ? monthlyRecords : staff.map((s) => ({
        staffId: s.$id,
        month: monthKey,
        staffName: s.name,
        department: s.department,
        position: s.position,
        employeeId: s.employeeId,
        bankName: s.bankName,
        accountNumber: s.accountNumber,
        accountName: s.accountName || s.name,
        basicSalary: Number(s.basicSalary) || 0,
        allowances: Number(s.allowances) || 0,
        deductions: Number(s.deductions) || 0,
        deductionReason: s.deductionReason || "",
        netSalary: Number(s.netSalary) || (Number(s.basicSalary || 0) + Number(s.allowances || 0) - Number(s.deductions || 0)),
        status: "pending" as const,
      }));

      // Compute aggregates for this month
      const totalBasic = currentRecords.reduce((acc, r) => acc + (Number(r.basicSalary) || 0), 0);
      const totalAllowances = currentRecords.reduce((acc, r) => acc + (Number(r.allowances) || 0), 0);
      const totalDeductions = currentRecords.reduce((acc, r) => acc + (Number(r.deductions) || 0), 0);
      const totalNet = currentRecords.reduce((acc, r) => acc + (Number(r.netSalary) || 0), 0);

      // Summary Metric Cards above table
      const pageWidth = doc.internal.pageSize.getWidth();
      const cardY = startY;
      const cardHeight = 12;
      const cardSpacing = 4;
      const margin = 14;
      const availableWidth = pageWidth - margin * 2;
      const cardWidth = (availableWidth - cardSpacing * 4) / 5;

      const metrics = [
        { label: "PERIOD & STAFF", val: `${selectedMonthName.toUpperCase()} · ${currentRecords.length} STAFF`, color: [30, 41, 59] },
        { label: "TOTAL BASIC", val: `₦${totalBasic.toLocaleString()}`, color: [30, 58, 138] },
        { label: "TOTAL ALLOWANCES", val: `₦${totalAllowances.toLocaleString()}`, color: [16, 185, 129] },
        { label: `${selectedMonthName.toUpperCase()} DEDUCTIONS`, val: `-₦${totalDeductions.toLocaleString()}`, color: [220, 38, 38] },
        { label: "NET BANK PAYOUT", val: `₦${totalNet.toLocaleString()}`, color: [255, 127, 80] },
      ];

      metrics.forEach((m, idx) => {
        const cx = margin + idx * (cardWidth + cardSpacing);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(cx, cardY, cardWidth, cardHeight, 1.5, 1.5, "F");
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.3);
        doc.roundedRect(cx, cardY, cardWidth, cardHeight, 1.5, 1.5, "S");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        doc.setTextColor(100, 116, 139);
        doc.text(m.label, cx + 3, cardY + 4);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(m.color[0], m.color[1], m.color[2]);
        doc.text(m.val, cx + 3, cardY + 9.5);
      });

      const tableColumn = [
        "#",
        "Staff Name",
        "Staff ID / Dept",
        "Bank Name",
        "Account Number",
        "Account Name",
        "Basic (₦)",
        "Allow. (₦)",
        `Ded. ${selectedMonthName.slice(0, 3)} (₦)`,
        "Deduction Reason",
        "Net Payout (₦)",
      ];

      const tableRows = currentRecords.map((r, idx) => [
        String(idx + 1),
        r.staffName || "N/A",
        `${r.employeeId || r.staffId.slice(0, 6)}\n${r.department || "General"}`,
        r.bankName || "—",
        r.accountNumber || "—",
        r.accountName || r.staffName || "—",
        (Number(r.basicSalary) || 0).toLocaleString(),
        (Number(r.allowances) || 0).toLocaleString(),
        (Number(r.deductions) || 0) > 0 ? `-${(Number(r.deductions) || 0).toLocaleString()}` : "0",
        r.deductionReason || "—",
        (Number(r.netSalary) || 0).toLocaleString(),
      ]);

      const footRow = [
        "",
        "TOTAL",
        "",
        "",
        "",
        "",
        totalBasic.toLocaleString(),
        totalAllowances.toLocaleString(),
        totalDeductions > 0 ? `-${totalDeductions.toLocaleString()}` : "0",
        "",
        totalNet.toLocaleString(),
      ];

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        foot: [footRow],
        startY: cardY + cardHeight + 4,
        margin: { left: 10, right: 10 },
        styles: {
          fontSize: 7,
          cellPadding: 2,
          overflow: "linebreak",
          valign: "middle",
        },
        headStyles: {
          fillColor: [26, 54, 93],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 7.5,
          halign: "left",
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [26, 54, 93],
          fontStyle: "bold",
          fontSize: 7.5,
        },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 38, fontStyle: "bold" },
          2: { cellWidth: 28 },
          3: { cellWidth: 26 },
          4: { cellWidth: 28, fontStyle: "bold" },
          5: { cellWidth: 35 },
          6: { cellWidth: 22, halign: "right" },
          7: { cellWidth: 20, halign: "right" },
          8: { cellWidth: 20, halign: "right", textColor: [220, 38, 38] },
          9: { cellWidth: 26, fontSize: 6.5 },
          10: { cellWidth: 26, halign: "right", fontStyle: "bold", textColor: [26, 54, 93] },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      // Signature & Authorization block
      const lastTable = (doc as any).lastAutoTable;
      let finalY = lastTable ? lastTable.finalY + 10 : 160;
      const pageHeight = doc.internal.pageSize.getHeight();

      if (finalY > pageHeight - 40) {
        doc.addPage();
        finalY = 25;
      }

      const sigWidth = (pageWidth - margin * 2 - 20) / 3;
      const sigData = [
        { role: "PREPARED BY", title: "Accounts / Payroll Officer", dept: "Finance Department" },
        { role: "VERIFIED & AUDITED BY", title: "Head of IT & Systems", dept: "IT Department (System Stamp)" },
        { role: "APPROVED FOR PAYMENT", title: "Managing Director / CEO", dept: "360 Degree Global Estate Ltd." },
      ];

      sigData.forEach((item, idx) => {
        const sx = margin + idx * (sigWidth + 10);
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.4);
        doc.line(sx, finalY + 14, sx + sigWidth, finalY + 14);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(255, 127, 80);
        doc.text(item.role, sx, finalY + 4);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(26, 54, 93);
        doc.text(item.title, sx, finalY + 18);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text(item.dept, sx, finalY + 22);
      });

      stampDocumentFooter(doc, `Confidential Bank Payroll Transfer Document · Month: ${selectedMonthName} ${selectedYear}`);

      doc.save(`360_Bank_Payroll_${selectedYear}_${selectedMonth}_${selectedMonthName}.pdf`);
      setSuccessMsg(`Bank payroll PDF for ${selectedMonthName} ${selectedYear} downloaded successfully!`);
    } catch (err: any) {
      setError("Payroll PDF failed: " + err.message);
    } finally {
      setDownloadingPayrollPdf(false);
    }
  };

  // ─── CSV Export (Selected Month & Year) ────────────────────────────────────
  const downloadPayrollCSV = async () => {
    setDownloadingCsv(true);
    try {
      const itSign = `"# Official Document: Generated by IT Department · Monthly Bank Credit Schedule · ${selectedMonthName} ${selectedYear} · 360 Degree Global Estate Ltd."`;
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
        `Deductions ${selectedMonthName} (NGN)`,
        "Deduction Reason",
        "Net Salary (NGN)",
        "Payment Status",
      ];
      const currentRecords = monthlyRecords.length > 0 ? monthlyRecords : staff.map((s) => ({
        staffId: s.$id,
        month: `${selectedYear}-${selectedMonth}`,
        staffName: s.name,
        department: s.department,
        position: s.position,
        employeeId: s.employeeId,
        bankName: s.bankName,
        accountNumber: s.accountNumber,
        accountName: s.accountName || s.name,
        basicSalary: Number(s.basicSalary) || 0,
        allowances: Number(s.allowances) || 0,
        deductions: Number(s.deductions) || 0,
        deductionReason: s.deductionReason || "",
        netSalary: Number(s.netSalary) || (Number(s.basicSalary || 0) + Number(s.allowances || 0) - Number(s.deductions || 0)),
        status: "pending" as const,
      }));

      const rows = currentRecords.map((r) => [
        `"${r.staffName || ""}"`,
        `"${r.employeeId || ""}"`,
        `"${r.department || ""}"`,
        `"${r.position || ""}"`,
        `"${r.bankName || ""}"`,
        `"${r.accountNumber ? `\t${r.accountNumber}` : ""}"`,
        `"${r.accountName || r.staffName || ""}"`,
        r.basicSalary || 0,
        r.allowances || 0,
        r.deductions || 0,
        `"${(r.deductionReason || "").replace(/"/g, '""')}"`,
        r.netSalary || 0,
        r.status || "pending",
      ]);
      const csv =
        "data:text/csv;charset=utf-8," +
        encodeURIComponent(
          [itSign, headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
        );
      const a = document.createElement("a");
      a.href = csv;
      a.download = `360_Staff_Payroll_${selectedYear}_${selectedMonth}_${selectedMonthName}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setSuccessMsg(`Payroll CSV for ${selectedMonthName} ${selectedYear} downloaded.`);
    } finally {
      setDownloadingCsv(false);
    }
  };

  // ─── Documents ─────────────────────────────────────────────────────────────
  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffForDocs || !docFile || !docTitle) { alert("Fill all fields"); return; }
    if (!clientBundle) return;
    setUploadingDoc(true);
    try {
      const fileUrl = await uploadToCloudinary(docFile, "staff_documents");
      const newDoc: StaffDocument = { title: docTitle, fileUrl, fileType: docFile.type, uploadedAt: new Date().toISOString() };
      const updatedDocs = [...(selectedStaffForDocs.documents || []), newDoc];
      const { databases, databaseId, COLLECTIONS } = clientBundle;
      await databases.updateDocument(databaseId, COLLECTIONS[COLLECTION_KEY], selectedStaffForDocs.$id, { documents: updatedDocs });
      setDocTitle(""); setDocFile(null);
      setSuccessMsg(`"${newDoc.title}" uploaded!`); await fetchStaff();
    } catch (err: any) { setError("Doc upload failed: " + err.message); }
    finally { setUploadingDoc(false); }
  };

  const handleDeleteDocument = async (idx: number) => {
    if (!selectedStaffForDocs || !clientBundle) return;
    if (!confirm("Delete this document?")) return;
    try {
      const docs = [...(selectedStaffForDocs.documents || [])];
      docs.splice(idx, 1);
      const { databases, databaseId, COLLECTIONS } = clientBundle;
      await databases.updateDocument(databaseId, COLLECTIONS[COLLECTION_KEY], selectedStaffForDocs.$id, { documents: docs });
      setSuccessMsg("Document removed."); await fetchStaff();
    } catch (err: any) { setError("Delete failed: " + err.message); }
  };

  // Aggregates for current month
  const currentMonthTotals = useMemo(() => {
    const list = monthlyRecords.length > 0 ? monthlyRecords : staff.map((s) => ({
      basicSalary: Number(s.basicSalary) || 0,
      allowances: Number(s.allowances) || 0,
      deductions: Number(s.deductions) || 0,
      netSalary: Number(s.netSalary) || (Number(s.basicSalary || 0) + Number(s.allowances || 0) - Number(s.deductions || 0)),
    }));
    const totalBasic = list.reduce((acc, r) => acc + (Number(r.basicSalary) || 0), 0);
    const totalAllowances = list.reduce((acc, r) => acc + (Number(r.allowances) || 0), 0);
    const totalDeductions = list.reduce((acc, r) => acc + (Number(r.deductions) || 0), 0);
    const totalNet = list.reduce((acc, r) => acc + (Number(r.netSalary) || 0), 0);
    return { count: list.length, totalBasic, totalAllowances, totalDeductions, totalNet };
  }, [monthlyRecords, staff]);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes spin360 { to { transform: rotate(360deg); } }
        @keyframes slideDown360 { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn360 { from { opacity:0; } to { opacity:1; } }
        .sig-panel-360 { animation: slideDown360 0.25s ease; }
        .payroll-table-scroll::-webkit-scrollbar { height: 8px; }
        .payroll-table-scroll::-webkit-scrollbar-track { background: #F1F5F9; border-radius: 4px; }
        .payroll-table-scroll::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
        .payroll-table-scroll::-webkit-scrollbar-thumb:hover { background: #94A3B8; }

        .card-wrapper-360 { animation: fadeIn360 0.4s ease; }

        /* ── Responsive ── */
        .staff-header-row { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; }
        .staff-tabs { display:flex; border-bottom:2px solid #E5E7EB; gap:8px; font-size:14px; font-weight:700; overflow-x:auto; }
        .staff-tab-btn { padding:12px 14px; background:none; border:none; border-bottom:3px solid transparent; cursor:pointer; font-weight:700; transition:all 0.2s; white-space:nowrap; }
        .staff-form-grid { display:grid; gap:16px; grid-template-columns:1fr 1fr; }
        .staff-sal-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }
        .staff-doc-layout { display:grid; grid-template-columns:1fr 2fr; gap:24px; }
        .staff-table-wrap { overflow-x:auto; }
        .staff-btn-row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
        .payroll-kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }
        @media (max-width:1024px) {
          .payroll-kpi-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width:768px) {
          .payroll-kpi-grid { grid-template-columns: 1fr 1fr; }
          .staff-form-grid { grid-template-columns:1fr !important; }
          .staff-sal-grid { grid-template-columns:1fr 1fr !important; }
          .staff-doc-layout { grid-template-columns:1fr !important; }
          .staff-header-row { flex-direction:column; align-items:stretch; }
          .staff-btn-row { justify-content:flex-start; }
          .sig-panel-360 { grid-template-columns:1fr !important; }
        }
        @media (max-width:480px) {
          .payroll-kpi-grid { grid-template-columns: 1fr; }
          .staff-sal-grid { grid-template-columns:1fr !important; }
          .staff-tab-btn { font-size:12px; padding:10px 8px; }
        }

        @media print {
          body * { visibility: hidden; }
          .no-print { display: none !important; }
          .print-area-360, .print-area-360 * {
            visibility: visible;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-area-360 {
            position: absolute; left: 0; top: 0; width: 100%;
            display: flex; flex-wrap: wrap; gap: 20px; justify-content: flex-start;
          }
        }
      `}</style>

      <div style={{ display: "grid", gap: 24 }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800 }}>Staff & Payroll Management</h2>
            <p style={{ margin: 0, color: "#666", fontSize: 14 }}>CR80 Identity Cards · Monthly Banking Schedule · Archive · Documents</p>
          </div>
          <div className="staff-btn-row">
            <a
              href="https://360live-three.vercel.app/staff-form"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...btn,
                background: "#0F172A",
                color: "#FF7F50",
                border: "1px solid #FF7F50",
                fontSize: 13,
                padding: "9px 14px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                textDecoration: "none",
              }}
            >
              <ExternalLink size={14} /> Open Public Form
            </a>
            <button
              onClick={() => {
                const url = "https://360live-three.vercel.app/staff-form";
                navigator.clipboard.writeText(url);
                setSuccessMsg("Official Staff Form link copied to clipboard! (https://360live-three.vercel.app/staff-form)");
              }}
              style={{
                ...btn,
                background: "#F8FAFC",
                color: "#334155",
                border: "1px solid #CBD5E1",
                fontSize: 13,
                padding: "9px 14px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <FileText size={14} /> Copy Form Link
            </button>
            <LoaderButton
              onClick={() => setShowDirectorSigPanel((v) => !v)}
              style={{ ...btn, background: showDirectorSigPanel ? "#1a365d" : "#6366F1", fontSize: 13, padding: "9px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <PenTool size={14} /> {directorSigUrl ? "Update" : "Set"} Director Signature
            </LoaderButton>
            {selectedIds.size > 0 && activeTab === "directory" && (
              <LoaderButton onClick={handleBulkGenerate} style={{ ...btn, background: "#3B82F6", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <IdCard size={14} /> Generate IDs ({selectedIds.size})
              </LoaderButton>
            )}
            {activeTab === "salary" && (
              <>
                <LoaderButton loading={downloadingPayrollPdf} onClick={downloadPayrollPDF} style={{ ...btn, background: "#1a365d", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <FileDown size={14} /> Bank Advice (PDF)
                </LoaderButton>
                <LoaderButton loading={downloadingCsv} onClick={downloadPayrollCSV} style={{ ...btn, background: "#10B981", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Download size={14} /> Bank CSV
                </LoaderButton>
              </>
            )}
            <LoaderButton
              onClick={() => {
                setShowForm(!showForm); setEditingId(null);
                setForm({ active: true, basicSalary: 0, allowances: 0, deductions: 0, netSalary: 0 });
                setImageFile(null); setSignatureFile(null);
              }}
              style={{ ...btn, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Cancel" : "Add Staff"}
            </LoaderButton>
          </div>
        </div>

        {/* ── Director Signature Panel ───────────────────────────────────── */}
        {showDirectorSigPanel && (
          <div className="sig-panel-360 no-print" style={{
            background: "linear-gradient(135deg, #1a365d 0%, #2d3748 100%)",
            borderRadius: 16, padding: 20, color: "#fff",
            display: "grid", gridTemplateColumns: "1fr auto", gap: 20, alignItems: "center",
          }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <PenTool size={16} color="#FF7F50" /> Director Official Signature
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 14 }}>
                Upload the Director&apos;s official signature. It is dynamically embedded onto the back of every CR80 vertical badge.
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                {directorSigUrl && (
                  <div style={{ background: "#fff", borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                    <img src={directorSigUrl} alt="Director Sig" style={{ height: 36, objectFit: "contain" }} />
                    <LoaderButton onClick={handleRemoveDirectorSig} style={{ ...smallBtn, background: "#FEE2E2", color: "#DC2626", fontSize: 11 }}>
                      Remove
                    </LoaderButton>
                  </div>
                )}
                <input
                  type="file" accept="image/*"
                  onChange={(e) => setDirectorSigFile(e.target.files?.[0] || null)}
                  style={{ ...inp, background: "rgba(255,255,255,0.12)", color: "#fff", borderColor: "rgba(255,255,255,0.25)", maxWidth: 280 }}
                />
                <LoaderButton
                  loading={uploadingDirectorSig} disabled={!directorSigFile}
                  onClick={handleDirectorSigUpload}
                  style={{ ...btn, background: "#ff7f50", padding: "10px 18px" }}
                >
                  {directorSigUrl ? "Update Signature" : "Upload & Save"}
                </LoaderButton>
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              {directorSigUrl ? (
                <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: "12px 18px" }}>
                  <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 6 }}>Active Signature</div>
                  <img src={directorSigUrl} alt="Active Sig" style={{ height: 44, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
                  <div style={{ fontSize: 11, marginTop: 6, color: "#6EE7B7", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    <Check size={12} /> Embedded on All Cards
                  </div>
                </div>
              ) : (
                <div style={{ opacity: 0.4, fontSize: 13 }}>No signature set</div>
              )}
            </div>
          </div>
        )}

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <div className="staff-tabs">
          {(["directory", "salary", "documents", "submissions"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className="staff-tab-btn" style={{
              borderBottom: activeTab === tab ? "3px solid #ff7f50" : "3px solid transparent",
              color: activeTab === tab ? "#ff7f50" : "#6B7280",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              {tab === "directory" ? (
                <><Users size={15} /> Staff Directory ({staff.length})</>
              ) : tab === "salary" ? (
                <><DollarSign size={15} /> Monthly Salary & Banking</>
              ) : tab === "documents" ? (
                <><FolderOpen size={15} /> Documents</>
              ) : (
                <>
                  <FileText size={15} /> Staff Form Submissions
                  {pendingSubmissionsCount > 0 ? (
                    <span style={{
                      background: "#EF4444",
                      color: "#FFFFFF",
                      borderRadius: "9999px",
                      padding: "1px 7px",
                      fontSize: 11,
                      fontWeight: 800,
                    }}>
                      {pendingSubmissionsCount}
                    </span>
                  ) : (
                    <span style={{
                      background: "#E2E8F0",
                      color: "#475569",
                      borderRadius: "9999px",
                      padding: "1px 7px",
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      {submissions.length}
                    </span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>

        {/* ── Alerts ─────────────────────────────────────────────────────── */}
        {error && (
          <div style={{ color: "#991B1B", background: "#FEF2F2", border: "1px solid #FECACA", padding: "12px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}
        {successMsg && (
          <div style={{ color: "#065F46", background: "#D1FAE5", border: "1px solid #6EE7B7", padding: "12px 16px", borderRadius: 10, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}

        {/* ── Create/Edit Form ──────────────────────────────────────────── */}
        {showForm && (
          <form onSubmit={handleSubmit} style={card}>
            <h3 style={{ margin: "0 0 20px", display: "flex", alignItems: "center", gap: 8 }}>
              {editingId ? <Edit size={18} color="#FF7F50" /> : <Plus size={18} color="#FF7F50" />}
              {editingId ? "Edit Staff Profile & Persistent Salary" : "Register New Staff Member"}
            </h3>
            <div className="staff-form-grid">
              <label style={lbl}>Full Name *<input placeholder="Ex: John Doe" required value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} /></label>
              <label style={lbl}>Employee ID<input placeholder="Ex: 360-STF-014" value={form.employeeId || ""} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} style={inp} /></label>
              <label style={lbl}>Email<input type="email" placeholder="john@360degreeglobal.org" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inp} /></label>
              <label style={lbl}>Phone<input placeholder="08012345678" value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inp} /></label>
              <label style={lbl}>Department<input placeholder="Security, Kitchen, Management…" value={form.department || ""} onChange={(e) => setForm({ ...form, department: e.target.value })} style={inp} /></label>
              <label style={lbl}>Position / Rank<input placeholder="Supervisor, Receptionist…" value={form.position || ""} onChange={(e) => setForm({ ...form, position: e.target.value })} style={inp} /></label>

              {/* Photo */}
              <div style={{ gridColumn: "span 2", background: "#F9FAFB", padding: 16, borderRadius: 12 }}>
                <label style={{ ...lbl, marginBottom: 8 }}>Staff Passport Photo (Vertical Portrait)</label>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  {form.photoUrl && !imageFile && (
                    <img src={form.photoUrl} alt="Photo" style={{ width: 60, height: 74, objectFit: "cover", borderRadius: 8, border: "2px solid #ff7f50" }} />
                  )}
                  <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} style={inp} />
                </div>
              </div>

              {/* Banking & Base Salary */}
              <div style={{ gridColumn: "span 2", background: "#EFF6FF", border: "1px solid #BFDBFE", padding: 16, borderRadius: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#1E3A8A", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <DollarSign size={16} color="#FF7F50" /> Persistent Banking Details & Base Salary Structure
                </div>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 14 }}>
                  Bank details and basic salary remain locked every month and carry forward automatically. Update here if staff receives a promotion or changes bank accounts.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <label style={lbl}>Bank Name<input placeholder="Ex: Access Bank" value={form.bankName || ""} onChange={(e) => setForm({ ...form, bankName: e.target.value })} style={inp} /></label>
                  <label style={lbl}>Account Number<input placeholder="0123456789" value={form.accountNumber || ""} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} style={inp} /></label>
                  <label style={lbl}>Account Name<input placeholder="Account Holder Name" value={form.accountName || ""} onChange={(e) => setForm({ ...form, accountName: e.target.value })} style={inp} /></label>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label style={lbl}>Basic Salary (₦)<input type="number" min="0" value={form.basicSalary || ""} onChange={(e) => handleSalaryChange("basicSalary", Number(e.target.value))} style={inp} /></label>
                  <label style={lbl}>Allowances (₦)<input type="number" min="0" value={form.allowances || ""} onChange={(e) => handleSalaryChange("allowances", Number(e.target.value))} style={inp} /></label>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} style={{ ...smallBtn, padding: "10px 18px" }}>Cancel</button>
              <LoaderButton type="submit" loading={loading || uploadingImage} style={{ ...btn, padding: "10px 24px" }}>
                {editingId ? "Save Profile Changes" : "Register Staff Member"}
              </LoaderButton>
            </div>
          </form>
        )}

        {/* ── VIEW 1: STAFF DIRECTORY ────────────────────────────────────── */}
        {activeTab === "directory" && (
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: "0 0 4px" }}>Active Staff Roster ({staff.length})</h3>
                <p style={{ margin: 0, fontSize: 13, color: "#666" }}>Select staff to preview or generate high-res CR80 vertical ID badges</p>
              </div>
              {staff.length > 0 && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setSelectedIds(new Set(staff.map((s) => s.$id)))} style={{ ...smallBtn, background: "#EFF6FF", color: "#1D4ED8" }}>Select All</button>
                  <button onClick={() => setSelectedIds(new Set())} style={{ ...smallBtn }}>Clear</button>
                </div>
              )}
            </div>

            {loading ? (
              <div style={{ textAlign: "center", padding: 40 }}><Spinner size={24} color="#ff7f50" /></div>
            ) : (
              <div className="staff-table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #F3F4F6", background: "#FAFAFA" }}>
                      <th style={{ padding: "12px 8px" }}></th>
                      <th style={{ padding: 12 }}>Photo</th>
                      <th style={{ padding: 12 }}>Staff Details</th>
                      <th style={{ padding: 12 }}>Dept & Rank</th>
                      <th style={{ padding: 12 }}>Status</th>
                      <th style={{ padding: 12, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((m) => (
                      <tr key={m.$id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                        <td style={{ padding: "10px 8px" }}>
                          <input type="checkbox" checked={selectedIds.has(m.$id)} onChange={() => toggleSelection(m.$id)} />
                        </td>
                        <td style={{ padding: 10 }}>
                          <div style={{ width: 44, height: 52, borderRadius: 6, background: "#eee", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #E5E7EB" }}>
                            {m.photoUrl ? <img src={m.photoUrl} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <User size={22} color="#9CA3AF" />}
                          </div>
                        </td>
                        <td style={{ padding: 10 }}>
                          <div style={{ fontWeight: 700, color: "#111" }}>{m.name}</div>
                          <div style={{ fontSize: 12, color: "#666" }}>ID: {m.employeeId || "N/A"}</div>
                          <div style={{ fontSize: 12, color: "#888" }}>{m.phone || m.email || "—"}</div>
                        </td>
                        <td style={{ padding: 10 }}>
                          <div style={{ fontWeight: 600 }}>{m.department || "General"}</div>
                          <div style={{ fontSize: 12, color: "#666" }}>{m.position || "Staff"}</div>
                        </td>
                        <td style={{ padding: 10 }}>
                          <span style={{
                            padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                            background: m.active ? "#DCFCE7" : "#FEE2E2",
                            color: m.active ? "#15803D" : "#B91C1C",
                          }}>
                            {m.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ padding: 10, textAlign: "right" }}>
                          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                            <LoaderButton onClick={() => handleSingleGenerate(m)} style={{ ...smallBtn, background: "#EFF6FF", color: "#1D4ED8", display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <IdCard size={12} /> ID Card
                            </LoaderButton>
                            <LoaderButton onClick={() => handleEdit(m)} style={{ ...smallBtn, display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Edit size={12} /> Edit
                            </LoaderButton>
                            <LoaderButton loading={deletingId === m.$id} onClick={() => handleDelete(m.$id)} style={{ ...smallBtn, background: "#FEE2E2", color: "#DC2626", display: "inline-flex", alignItems: "center" }}>
                              <Trash2 size={12} />
                            </LoaderButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {staff.length === 0 && !loading && (
                  <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>No staff registered yet. Click &quot;Add Staff&quot; above.</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── VIEW 2: MONTHLY SALARY & BANKING ────────────────────────────── */}
        {activeTab === "salary" && (
          <div style={{ display: "grid", gap: 20 }}>

            {/* Sub-Tab Navigation Bar & Month Selector */}
            <div style={{ ...card, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
                {/* Subtabs */}
                <div style={{ display: "flex", gap: 8, background: "#F1F5F9", padding: 4, borderRadius: 10 }}>
                  <button
                    onClick={() => setSalarySubTab("schedule")}
                    style={{
                      padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                      fontWeight: 700, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6,
                      background: salarySubTab === "schedule" ? "#fff" : "transparent",
                      color: salarySubTab === "schedule" ? "#0F172A" : "#64748B",
                      boxShadow: salarySubTab === "schedule" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    <Calendar size={14} color={salarySubTab === "schedule" ? "#FF7F50" : "#64748B"} />
                    Monthly Schedule ({selectedMonthName} {selectedYear})
                  </button>
                  <button
                    onClick={() => setSalarySubTab("history")}
                    style={{
                      padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                      fontWeight: 700, fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6,
                      background: salarySubTab === "history" ? "#fff" : "transparent",
                      color: salarySubTab === "history" ? "#0F172A" : "#64748B",
                      boxShadow: salarySubTab === "history" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    <History size={14} color={salarySubTab === "history" ? "#FF7F50" : "#64748B"} />
                    Past Months & Reports Archive
                  </button>
                </div>

                {/* Month & Year Selectors */}
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#F8FAFC", border: "1px solid #E2E8F0", padding: "6px 12px", borderRadius: 10 }}>
                    <Calendar size={15} color="#FF7F50" />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>Period:</span>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      style={{ border: "none", background: "transparent", fontWeight: 700, fontSize: 13, color: "#0F172A", cursor: "pointer" }}
                    >
                      {MONTHS_LIST.map((m) => (
                        <option key={m.value} value={m.value}>{m.name}</option>
                      ))}
                    </select>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(e.target.value)}
                      style={{ border: "none", background: "transparent", fontWeight: 700, fontSize: 13, color: "#0F172A", cursor: "pointer" }}
                    >
                      {YEARS_LIST.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => {
                      const cur = new Date();
                      setSelectedYear(String(cur.getFullYear()));
                      setSelectedMonth(String(cur.getMonth() + 1).padStart(2, "0"));
                    }}
                    style={{ ...smallBtn, background: "#EFF6FF", color: "#1D4ED8", padding: "8px 12px" }}
                  >
                    Current Month
                  </button>

                  <LoaderButton
                    loading={loadingMonthlyPayroll}
                    onClick={() => fetchMonthlyPayroll(selectedYear, selectedMonth)}
                    style={{ ...smallBtn, padding: "8px 12px", display: "inline-flex", alignItems: "center", gap: 4 }}
                    title="Refresh schedule"
                  >
                    <RefreshCw size={13} />
                  </LoaderButton>
                </div>
              </div>
            </div>

            {/* KPI Cards for Selected Month */}
            <div className="payroll-kpi-grid">
              <div style={{ ...card, padding: 16, borderLeft: "4px solid #1E293B" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>Staff on Schedule</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#0F172A", marginTop: 4 }}>{currentMonthTotals.count} Persons</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>For {selectedMonthName} {selectedYear}</div>
              </div>

              <div style={{ ...card, padding: 16, borderLeft: "4px solid #1E40AF" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#1E40AF", textTransform: "uppercase" }}>Total Basic Salary</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#1E3A8A", marginTop: 4 }}>₦{currentMonthTotals.totalBasic.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: "#60A5FA", marginTop: 2 }}>Persistent base pay</div>
              </div>

              <div style={{ ...card, padding: 16, borderLeft: "4px solid #059669" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#059669", textTransform: "uppercase" }}>Total Allowances</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#047857", marginTop: 4 }}>+₦{currentMonthTotals.totalAllowances.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: "#34D399", marginTop: 2 }}>Welfare & housing</div>
              </div>

              <div style={{ ...card, padding: 16, borderLeft: "4px solid #DC2626" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", textTransform: "uppercase" }}>{selectedMonthName.slice(0, 3)} Deductions</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#B91C1C", marginTop: 4 }}>-₦{currentMonthTotals.totalDeductions.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: "#F87171", marginTop: 2 }}>Month-specific adjustments</div>
              </div>

              <div style={{ ...card, padding: 16, borderLeft: "4px solid #FF7F50", background: "linear-gradient(135deg, #FFF7ED 0%, #FFFFFF 100%)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#EA580C", textTransform: "uppercase" }}>Net Bank Payout</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#C2410C", marginTop: 4 }}>₦{currentMonthTotals.totalNet.toLocaleString()}</div>
                <div style={{ fontSize: 11, color: "#FB923C", marginTop: 2 }}>Credit Advice Total</div>
              </div>
            </div>

            {/* Sub-tab 1: Monthly Schedule */}
            {salarySubTab === "schedule" && (
              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
                      <Calendar size={18} color="#FF7F50" />
                      Monthly Bank Payment Schedule · {selectedMonthName} {selectedYear}
                    </h3>
                    <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>
                      Bank details & base salary carry over every month. Deductions and deduction reasons are updated uniquely per month.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <LoaderButton
                      loading={savingMonthlyPayroll}
                      onClick={handleBulkSaveMonthlyPayroll}
                      style={{ ...btn, background: "#2563EB", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <Save size={14} /> Lock & Save {selectedMonthName} Schedule
                    </LoaderButton>
                    <LoaderButton
                      loading={downloadingPayrollPdf}
                      onClick={downloadPayrollPDF}
                      style={{ ...btn, background: "#1a365d", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <FileDown size={14} /> Export Bank Advice (PDF)
                    </LoaderButton>
                    <LoaderButton
                      loading={downloadingCsv}
                      onClick={downloadPayrollCSV}
                      style={{ ...btn, background: "#10B981", display: "inline-flex", alignItems: "center", gap: 6 }}
                    >
                      <Download size={14} /> Export Bank CSV
                    </LoaderButton>
                  </div>
                </div>

                {/* Search / Filter Staff in this Month */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                  <div style={{ position: "relative", flex: 1, minWidth: 260, maxWidth: 420 }}>
                    <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8" }} />
                    <input
                      type="text"
                      value={monthSearchFilter}
                      onChange={(e) => setMonthSearchFilter(e.target.value)}
                      placeholder="Search staff name, ID, department, or bank..."
                      style={{ ...inp, paddingLeft: 36, paddingRight: 32, fontSize: 13, background: "#F8FAFC" }}
                    />
                    {monthSearchFilter && (
                      <button
                        onClick={() => setMonthSearchFilter("")}
                        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748B", fontWeight: 600 }}>
                    Showing {monthlyRecords.filter((r) => {
                      if (!monthSearchFilter.trim()) return true;
                      const q = monthSearchFilter.toLowerCase();
                      return (
                        (r.staffName || "").toLowerCase().includes(q) ||
                        (r.employeeId || "").toLowerCase().includes(q) ||
                        (r.department || "").toLowerCase().includes(q) ||
                        (r.bankName || "").toLowerCase().includes(q) ||
                        (r.accountNumber || "").toLowerCase().includes(q)
                      );
                    }).length} of {monthlyRecords.length} staff records
                  </div>
                </div>

                {loadingMonthlyPayroll ? (
                  <div style={{ textAlign: "center", padding: 40 }}><Spinner size={24} color="#ff7f50" /></div>
                ) : (
                  <div
                    className="payroll-table-scroll"
                    style={{
                      overflowX: "auto",
                      width: "100%",
                      WebkitOverflowScrolling: "touch",
                      borderRadius: 10,
                      border: "1px solid #E2E8F0",
                      background: "#FFFFFF",
                    }}
                  >
                    <table style={{ minWidth: 1180, width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                          <th style={{ padding: "14px 12px", width: 40 }}>#</th>
                          <th style={{ padding: "14px 12px" }}>Staff Member</th>
                          <th style={{ padding: "14px 12px" }}>Bank & Account</th>
                          <th style={{ padding: "14px 12px", textAlign: "right" }}>Basic (₦)</th>
                          <th style={{ padding: "14px 12px", textAlign: "right" }}>Allowances (₦)</th>
                          <th style={{ padding: "14px 12px", textAlign: "right", color: "#DC2626" }}>Month Deduction</th>
                          <th style={{ padding: "14px 12px" }}>Deduction Reason</th>
                          <th style={{ padding: "14px 12px", textAlign: "right", color: "#1E3A8A" }}>Net Payout (₦)</th>
                          <th style={{ padding: "14px 12px", textAlign: "center" }}>Status</th>
                          <th style={{ padding: "14px 12px", textAlign: "center" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyRecords
                          .filter((r) => {
                            if (!monthSearchFilter.trim()) return true;
                            const q = monthSearchFilter.toLowerCase();
                            return (
                              (r.staffName || "").toLowerCase().includes(q) ||
                              (r.employeeId || "").toLowerCase().includes(q) ||
                              (r.department || "").toLowerCase().includes(q) ||
                              (r.bankName || "").toLowerCase().includes(q) ||
                              (r.accountNumber || "").toLowerCase().includes(q)
                            );
                          })
                          .map((r, idx) => {
                            const net = Math.max(0, (Number(r.basicSalary) || 0) + (Number(r.allowances) || 0) - (Number(r.deductions) || 0));
                            return (
                              <tr key={r.staffId || idx} style={{ borderBottom: "1px solid #F1F5F9", transition: "background 0.15s" }} onMouseEnter={(e) => e.currentTarget.style.background = "#F8FAFC"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                                <td style={{ padding: "12px", color: "#94A3B8", fontSize: 12, fontWeight: 600 }}>{idx + 1}</td>
                                <td style={{ padding: "12px" }}>
                                  <div style={{ fontWeight: 700, color: "#0F172A", fontSize: 13.5 }}>{r.staffName}</div>
                                  <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                                    <span style={{ fontWeight: 600, color: "#1E40AF" }}>{r.employeeId || "—"}</span> · {r.department || "General"} {r.position ? `· ${r.position}` : ""}
                                  </div>
                                </td>
                                <td style={{ padding: "12px" }}>
                                  <div style={{ fontWeight: 700, fontSize: 13, color: "#1E293B" }}>{r.bankName || <span style={{ color: "#aaa" }}>—</span>}</div>
                                  <div style={{ fontFamily: "monospace", fontSize: 12, color: "#0284C7", fontWeight: 600, marginTop: 1 }}>{r.accountNumber || "—"}</div>
                                  <div style={{ fontSize: 10.5, color: "#94A3B8" }}>{r.accountName || r.staffName}</div>
                                </td>
                                <td style={{ padding: "12px", textAlign: "right", fontWeight: 700, color: "#0F172A" }}>
                                  ₦{(Number(r.basicSalary) || 0).toLocaleString()}
                                </td>
                                <td style={{ padding: "12px", textAlign: "right", color: "#059669", fontWeight: 700 }}>
                                  +₦{(Number(r.allowances) || 0).toLocaleString()}
                                </td>
                                <td style={{ padding: "12px", textAlign: "right", color: (Number(r.deductions) || 0) > 0 ? "#DC2626" : "#94A3B8", fontWeight: 700 }}>
                                  {(Number(r.deductions) || 0) > 0 ? `-₦${(Number(r.deductions) || 0).toLocaleString()}` : "₦0"}
                                </td>
                                <td style={{ padding: "12px", maxWidth: 200 }}>
                                  {r.deductionReason ? (
                                    <span style={{ fontSize: 11.5, background: "#FEF2F2", color: "#991B1B", padding: "4px 8px", borderRadius: 6, display: "inline-block", fontWeight: 500, lineHeight: 1.3 }}>
                                      {r.deductionReason}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 12, color: "#94A3B8", fontStyle: "italic" }}>None</span>
                                  )}
                                </td>
                                <td style={{ padding: "12px", textAlign: "right", fontWeight: 900, color: "#1E3A8A", fontSize: 14 }}>
                                  ₦{net.toLocaleString()}
                                </td>
                                <td style={{ padding: "12px", textAlign: "center" }}>
                                  <span style={{
                                    padding: "4px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: "capitalize",
                                    background: r.status === "paid" ? "#DCFCE7" : r.status === "approved" ? "#DBEAFE" : "#FEF3C7",
                                    color: r.status === "paid" ? "#166534" : r.status === "approved" ? "#1E40AF" : "#92400E",
                                  }}>
                                    {r.status || "pending"}
                                  </span>
                                </td>
                                <td style={{ padding: "12px", textAlign: "center" }}>
                                  <button
                                    onClick={() => handleOpenEditMonthModal(r)}
                                    style={{
                                      ...smallBtn,
                                      background: "#EFF6FF",
                                      color: "#1D4ED8",
                                      border: "1px solid #BFDBFE",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 5,
                                      fontWeight: 700,
                                      padding: "7px 12px",
                                      borderRadius: 7,
                                    }}
                                    title="Update monthly salary, deductions, bank details or status"
                                  >
                                    <Edit size={13} /> Edit Month Record
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                    {monthlyRecords.length === 0 && !loadingMonthlyPayroll && (
                      <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>No staff records available for this month.</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Sub-tab 2: History & Report Archives */}
            {salarySubTab === "history" && (
              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: "0 0 4px", display: "flex", alignItems: "center", gap: 8 }}>
                      <History size={18} color="#FF7F50" />
                      Historical Payroll Records & Report Archive
                    </h3>
                    <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>
                      Track previous months&apos; payroll payouts, audits, and generate past bank advice reports instantly.
                    </p>
                  </div>
                  <LoaderButton
                    loading={loadingHistory}
                    onClick={fetchPayrollHistory}
                    style={{ ...smallBtn, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <RefreshCw size={13} /> Refresh Archives
                  </LoaderButton>
                </div>

                {loadingHistory ? (
                  <div style={{ textAlign: "center", padding: 40 }}><Spinner size={24} color="#ff7f50" /></div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                          <th style={{ padding: 12 }}>Payment Month</th>
                          <th style={{ padding: 12, textAlign: "center" }}>Staff Count</th>
                          <th style={{ padding: 12, textAlign: "right" }}>Total Basic (₦)</th>
                          <th style={{ padding: 12, textAlign: "right" }}>Total Allowances (₦)</th>
                          <th style={{ padding: 12, textAlign: "right" }}>Total Deductions (₦)</th>
                          <th style={{ padding: 12, textAlign: "right" }}>Net Bank Payout (₦)</th>
                          <th style={{ padding: 12, textAlign: "center" }}>Status</th>
                          <th style={{ padding: 12, textAlign: "center" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrollHistory.map((item) => {
                          const [yr, mo] = (item.month || "").split("-");
                          const mName = MONTHS_LIST.find((m) => m.value === mo)?.name || mo;
                          return (
                            <tr key={item.month} style={{ borderBottom: "1px solid #F1F5F9" }}>
                              <td style={{ padding: 12 }}>
                                <div style={{ fontWeight: 800, color: "#0F172A", fontSize: 14 }}>{mName} {yr}</div>
                                <div style={{ fontSize: 11, color: "#64748B" }}>Reference: 360-PAYROLL-{yr}{mo}</div>
                              </td>
                              <td style={{ padding: 12, textAlign: "center", fontWeight: 700 }}>
                                {item.count} Staff
                              </td>
                              <td style={{ padding: 12, textAlign: "right" }}>
                                {(Number(item.totalBasic) || 0).toLocaleString()}
                              </td>
                              <td style={{ padding: 12, textAlign: "right", color: "#059669" }}>
                                +{(Number(item.totalAllowances) || 0).toLocaleString()}
                              </td>
                              <td style={{ padding: 12, textAlign: "right", color: "#DC2626", fontWeight: 700 }}>
                                -{(Number(item.totalDeductions) || 0).toLocaleString()}
                              </td>
                              <td style={{ padding: 12, textAlign: "right", fontWeight: 800, color: "#1E3A8A", fontSize: 14 }}>
                                ₦{(Number(item.totalNet) || 0).toLocaleString()}
                              </td>
                              <td style={{ padding: 12, textAlign: "center" }}>
                                <span style={{
                                  padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: "capitalize",
                                  background: item.status === "paid" ? "#DCFCE7" : item.status === "approved" ? "#DBEAFE" : "#FEF3C7",
                                  color: item.status === "paid" ? "#166534" : item.status === "approved" ? "#1E40AF" : "#92400E",
                                }}>
                                  {item.status || "pending"}
                                </span>
                              </td>
                              <td style={{ padding: 12, textAlign: "center" }}>
                                <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                                  <button
                                    onClick={() => {
                                      setSelectedYear(yr);
                                      setSelectedMonth(mo);
                                      setSalarySubTab("schedule");
                                    }}
                                    style={{ ...smallBtn, background: "#EFF6FF", color: "#1D4ED8", display: "inline-flex", alignItems: "center", gap: 4 }}
                                  >
                                    <Eye size={12} /> View Schedule
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {payrollHistory.length === 0 && !loadingHistory && (
                      <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>
                        No saved monthly records yet. Open &quot;Monthly Schedule&quot; and click &quot;Lock & Save Schedule&quot; to archive a month.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── VIEW 3: DOCUMENTS ───────────────────────────────────────────── */}
        {activeTab === "documents" && (
          <div className="staff-doc-layout">
            <div style={card}>
              <h4 style={{ margin: "0 0 12px" }}>Select Staff Member</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "60vh", overflowY: "auto" }}>
                {staff.map((s) => (
                  <div key={s.$id} onClick={() => setSelectedStaffForDocs(s)} style={{
                    padding: 12, borderRadius: 8, cursor: "pointer",
                    background: selectedStaffForDocs?.$id === s.$id ? "#EFF6FF" : "#F9FAFB",
                    border: selectedStaffForDocs?.$id === s.$id ? "2px solid #3B82F6" : "1px solid #E5E7EB",
                    transition: "all 0.15s",
                  }}>
                    <div style={{ fontWeight: 700 }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{s.department || "General"} · {s.employeeId || "—"}</div>
                    <div style={{ fontSize: 11, color: "#3B82F6", marginTop: 3 }}>{(s.documents||[]).length} document(s)</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={card}>
              {selectedStaffForDocs ? (
                <div>
                  <h3 style={{ margin: "0 0 8px" }}>Documents — {selectedStaffForDocs.name}</h3>
                  <p style={{ margin: "0 0 18px", color: "#666", fontSize: 13 }}>Store employment letters, CVs, government IDs, guarantor forms, certificates.</p>
                  <form onSubmit={handleUploadDocument} style={{ background: "#F3F4F6", padding: 16, borderRadius: 12, marginBottom: 22, display: "grid", gap: 12 }}>
                    <h4 style={{ margin: 0, fontSize: 14 }}>+ Attach New Document</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <input placeholder="Document title…" required value={docTitle} onChange={(e) => setDocTitle(e.target.value)} style={inp} />
                      <input type="file" required onChange={(e) => setDocFile(e.target.files?.[0] || null)} style={inp} />
                    </div>
                    <LoaderButton type="submit" loading={uploadingDoc} style={{ ...btn, alignSelf: "flex-start", padding: "8px 16px" }}>
                      Upload Document
                    </LoaderButton>
                  </form>
                  <h4 style={{ margin: "0 0 12px", fontSize: 14 }}>Attached Files ({(selectedStaffForDocs.documents||[]).length})</h4>
                  {(selectedStaffForDocs.documents||[]).length === 0 ? (
                    <div style={{ color: "#aaa", fontSize: 13, fontStyle: "italic" }}>No documents attached yet.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(selectedStaffForDocs.documents||[]).map((doc, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{doc.title}</div>
                            <div style={{ fontSize: 11, color: "#888" }}>{doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ""}</div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => window.open(doc.fileUrl, "_blank")}
                              style={{ ...smallBtn, background: "#EFF6FF", color: "#1D4ED8", display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              <Eye size={12} /> View
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch(doc.fileUrl);
                                  const blob = await res.blob();
                                  const url = URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  const ext = doc.fileUrl.split(".").pop()?.split("?")[0] || "file";
                                  a.download = `${doc.title.replace(/\s+/g,"_")}.${ext}`;
                                  document.body.appendChild(a); a.click();
                                  document.body.removeChild(a);
                                  URL.revokeObjectURL(url);
                                } catch {
                                  window.open(doc.fileUrl, "_blank");
                                }
                              }}
                              style={{ ...smallBtn, background: "#D1FAE5", color: "#059669", display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              <Download size={12} /> Download
                            </button>
                            <LoaderButton onClick={() => handleDeleteDocument(idx)} style={{ ...smallBtn, background: "#FEE2E2", color: "#DC2626", display: "inline-flex", alignItems: "center" }}><Trash2 size={12} /></LoaderButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>Select a staff member to manage documents.</div>
              )}
            </div>
          </div>
        )}

        {/* ── VIEW 4: STAFF FORM SUBMISSIONS (PENDING REVIEW & APPROVAL) ── */}
        {activeTab === "submissions" && (
          <div style={card}>
            {/* Top Toolbar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14, marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}>
                  <FileText size={18} color="#FF7F50" />
                  Staff Profile & Document Submissions
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "#64748B" }}>
                  Review, verify, and approve incoming soft-copies, passport photos, and bank account updates from staff.
                </p>
              </div>

              {/* Status Filter Pills & Search */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", background: "#F1F5F9", padding: 3, borderRadius: 10, gap: 2 }}>
                  {(["pending", "all", "approved", "rejected"] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setSubmissionFilter(st)}
                      style={{
                        border: "none",
                        background: submissionFilter === st ? "#FFFFFF" : "transparent",
                        color: submissionFilter === st ? "#0F172A" : "#64748B",
                        fontWeight: submissionFilter === st ? 700 : 500,
                        padding: "6px 12px",
                        borderRadius: 8,
                        fontSize: 12,
                        cursor: "pointer",
                        boxShadow: submissionFilter === st ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                        textTransform: "capitalize",
                      }}
                    >
                      {st === "pending" ? `Pending (${pendingSubmissionsCount})` : st}
                    </button>
                  ))}
                </div>

                <div style={{ position: "relative" }}>
                  <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "#94A3B8" }} />
                  <input
                    type="text"
                    placeholder="Search name, phone, dept..."
                    value={submissionSearch}
                    onChange={(e) => setSubmissionSearch(e.target.value)}
                    style={{ ...inp, paddingLeft: 30, width: 200, fontSize: 12, height: 34 }}
                  />
                </div>

                <button
                  onClick={fetchSubmissions}
                  title="Refresh Submissions"
                  style={{ ...smallBtn, background: "#F1F5F9", color: "#334155", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <RefreshCw size={12} className={loadingSubmissions ? "animate-spin" : ""} /> Refresh
                </button>
              </div>
            </div>

            {/* Public Link Bar */}
            <div style={{
              background: "#FFFBEB",
              border: "1px solid #FDE68A",
              borderRadius: 12,
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 20,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <span style={{ background: "#FF7F50", color: "#fff", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                  PUBLIC WEB LINK
                </span>
                <span style={{ color: "#9A3412", fontWeight: 600 }}>Official staff portal link (hosted on main website):</span>
                <code style={{ background: "#FFEDD5", padding: "3px 8px", borderRadius: 6, color: "#C2410C", fontSize: 12, fontWeight: 700 }}>
                  https://360live-three.vercel.app/staff-form
                </code>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText("https://360live-three.vercel.app/staff-form");
                    setSuccessMsg("Public link copied to clipboard! (https://360live-three.vercel.app/staff-form)");
                  }}
                  style={{ ...smallBtn, background: "#EA580C", color: "#fff", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <FileText size={12} /> Copy Link
                </button>
                <a
                  href="https://360live-three.vercel.app/staff-form"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...smallBtn, background: "#9A3412", color: "#fff", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <ExternalLink size={12} /> Open Form
                </a>
              </div>
            </div>

            {/* Submissions Table */}
            <div className="staff-table-wrap">
              {loadingSubmissions ? (
                <div style={{ textAlign: "center", padding: "60px 0" }}>
                  <Spinner size={24} color="#ff7f50" />
                  <div style={{ marginTop: 12, color: "#64748B", fontSize: 13 }}>Loading submissions...</div>
                </div>
              ) : submissions.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#64748B" }}>
                  <FileText size={36} color="#CBD5E1" style={{ margin: "0 auto 10px" }} />
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#1E293B" }}>No Submissions Found</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    {submissionFilter === "pending"
                      ? "There are currently no pending staff submissions awaiting review."
                      : "No records found matching your current filter or search criteria."}
                  </div>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0", textAlign: "left", color: "#475569", fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      <th style={{ padding: "12px 14px" }}>Passport</th>
                      <th style={{ padding: "12px 14px" }}>Staff Member</th>
                      <th style={{ padding: "12px 14px" }}>Contact</th>
                      <th style={{ padding: "12px 14px" }}>Department & Position</th>
                      <th style={{ padding: "12px 14px" }}>Bank & Stated Salary</th>
                      <th style={{ padding: "12px 14px" }}>Documents</th>
                      <th style={{ padding: "12px 14px" }}>Status</th>
                      <th style={{ padding: "12px 14px", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.map((sub) => {
                      const statusColor =
                        sub.status === "approved"
                          ? { bg: "#DCFCE7", text: "#15803D" }
                          : sub.status === "rejected"
                          ? { bg: "#FEE2E2", text: "#B91C1C" }
                          : { bg: "#FEF3C7", text: "#B45309" };

                      return (
                        <tr key={sub._id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                          {/* Passport */}
                          <td style={{ padding: "12px 14px" }}>
                            {sub.photoUrl ? (
                              <img
                                src={sub.photoUrl}
                                alt={sub.name}
                                style={{ width: 44, height: 52, objectFit: "cover", borderRadius: 6, border: "1px solid #E2E8F0" }}
                              />
                            ) : (
                              <div style={{ width: 44, height: 52, background: "#F1F5F9", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8" }}>
                                <User size={18} />
                              </div>
                            )}
                          </td>

                          {/* Staff Name */}
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ fontWeight: 700, color: "#0F172A", fontSize: 14 }}>{sub.name}</div>
                            {sub.employeeId && (
                              <div style={{ fontSize: 11, color: "#64748B", fontFamily: "monospace" }}>ID: {sub.employeeId}</div>
                            )}
                            <div style={{ fontSize: 10.5, color: "#94A3B8" }}>
                              Submitted: {new Date(sub.createdAt).toLocaleDateString()}
                            </div>
                          </td>

                          {/* Contact */}
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ color: "#334155", fontWeight: 600 }}>{sub.phone}</div>
                            <div style={{ fontSize: 12, color: "#64748B" }}>{sub.email || "—"}</div>
                          </td>

                          {/* Department & Position */}
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ fontWeight: 600, color: "#0F172A" }}>{sub.department || "General"}</div>
                            <div style={{ fontSize: 12, color: "#64748B" }}>{sub.position || "Staff"}</div>
                          </td>

                          {/* Bank & Salary */}
                          <td style={{ padding: "12px 14px" }}>
                            <div style={{ fontWeight: 600, color: "#0F172A" }}>{sub.bankName || "—"}</div>
                            <div style={{ fontSize: 12, fontFamily: "monospace", color: "#475569" }}>
                              {sub.accountNumber || "—"}
                            </div>
                            <div style={{ fontSize: 11.5, color: "#059669", fontWeight: 700, marginTop: 2 }}>
                              ₦{Number(sub.salary || 0).toLocaleString()} /mo
                            </div>
                          </td>

                          {/* Documents */}
                          <td style={{ padding: "12px 14px" }}>
                            {sub.documents && sub.documents.length > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                <span style={{ background: "#EFF6FF", color: "#1D4ED8", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700, width: "fit-content" }}>
                                  {sub.documents.length} File{sub.documents.length > 1 ? "s" : ""}
                                </span>
                                <span style={{ fontSize: 10.5, color: "#64748B" }}>
                                  {sub.documents[0].title}
                                </span>
                              </div>
                            ) : (
                              <span style={{ color: "#94A3B8", fontSize: 12 }}>No files</span>
                            )}
                          </td>

                          {/* Status */}
                          <td style={{ padding: "12px 14px" }}>
                            <span style={{ background: statusColor.bg, color: statusColor.text, padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, textTransform: "capitalize" }}>
                              {sub.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: "12px 14px", textAlign: "right" }}>
                            <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                              <button
                                onClick={() => {
                                  setReviewingSubmission(sub);
                                  setShowRejectInput(false);
                                  setRejectReason("");
                                }}
                                style={{ ...smallBtn, background: "#1E293B", color: "#fff", display: "inline-flex", alignItems: "center", gap: 4 }}
                              >
                                <Eye size={12} /> Review & Verify
                              </button>

                              {sub.status === "pending" && (
                                <button
                                  onClick={() => handleApproveSubmission(sub._id)}
                                  title="Quick Approve & Add to Staff"
                                  style={{ ...smallBtn, background: "#DCFCE7", color: "#15803D", display: "inline-flex", alignItems: "center" }}
                                >
                                  <Check size={12} />
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteSubmission(sub._id)}
                                title="Delete Submission"
                                style={{ ...smallBtn, background: "#FEE2E2", color: "#DC2626", display: "inline-flex", alignItems: "center" }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ── MODAL: REVIEW STAFF SUBMISSION ──────────────────────────────── */}
        {reviewingSubmission && (
          <div style={overlayStyle}>
            <div style={{ ...modalStyle, maxWidth: 760, maxHeight: "90vh", overflowY: "auto" }}>
              {/* Modal Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, borderBottom: "1px solid #E2E8F0", paddingBottom: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0F172A" }}>
                      Review Staff Form Submission
                    </h3>
                    <span style={{
                      padding: "3px 10px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "capitalize",
                      background: reviewingSubmission.status === "approved" ? "#DCFCE7" : reviewingSubmission.status === "rejected" ? "#FEE2E2" : "#FEF3C7",
                      color: reviewingSubmission.status === "approved" ? "#15803D" : reviewingSubmission.status === "rejected" ? "#B91C1C" : "#B45309",
                    }}>
                      {reviewingSubmission.status}
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748B" }}>
                    Submitted on {new Date(reviewingSubmission.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setReviewingSubmission(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24, marginBottom: 24 }}>
                {/* Left: Passport photo */}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#475569", textTransform: "uppercase", marginBottom: 8 }}>
                    Passport Photograph
                  </div>
                  <div style={{
                    width: "100%",
                    height: 220,
                    borderRadius: 12,
                    border: "2px solid #E2E8F0",
                    background: "#F8FAFC",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                  }}>
                    {reviewingSubmission.photoUrl ? (
                      <img
                        src={reviewingSubmission.photoUrl}
                        alt={reviewingSubmission.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ textAlign: "center", color: "#94A3B8" }}>
                        <User size={40} style={{ margin: "0 auto 6px" }} />
                        <div style={{ fontSize: 12 }}>No photo provided</div>
                      </div>
                    )}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11.5, color: "#64748B", background: "#F1F5F9", padding: "8px 10px", borderRadius: 8 }}>
                    ✓ Check: Plain white background<br />
                    ✓ Check: Head & shoulders positioned properly
                  </div>
                </div>

                {/* Right: Personal & Payroll Details */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A", marginBottom: 8, borderBottom: "1px solid #E2E8F0", paddingBottom: 4 }}>
                      Personal Information
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12.5 }}>
                      <div><span style={{ color: "#64748B" }}>Full Name:</span> <strong style={{ color: "#0F172A" }}>{reviewingSubmission.name}</strong></div>
                      <div><span style={{ color: "#64748B" }}>Phone:</span> <strong style={{ color: "#0F172A" }}>{reviewingSubmission.phone}</strong></div>
                      <div><span style={{ color: "#64748B" }}>Email:</span> <span style={{ color: "#0F172A" }}>{reviewingSubmission.email || "—"}</span></div>
                      <div><span style={{ color: "#64748B" }}>Employee ID:</span> <span style={{ color: "#0F172A", fontFamily: "monospace" }}>{reviewingSubmission.employeeId || "Auto-assign on approval"}</span></div>
                      <div><span style={{ color: "#64748B" }}>Department:</span> <strong style={{ color: "#0F172A" }}>{reviewingSubmission.department || "General"}</strong></div>
                      <div><span style={{ color: "#64748B" }}>Position:</span> <strong style={{ color: "#0F172A" }}>{reviewingSubmission.position || "Staff"}</strong></div>
                    </div>
                  </div>

                  <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#0F172A", marginBottom: 8, borderBottom: "1px solid #E2E8F0", paddingBottom: 4 }}>
                      Bank Account & Payroll Details
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12.5 }}>
                      <div><span style={{ color: "#64748B" }}>Bank Name:</span> <strong style={{ color: "#0F172A" }}>{reviewingSubmission.bankName || "—"}</strong></div>
                      <div><span style={{ color: "#64748B" }}>Account No:</span> <strong style={{ color: "#0F172A", fontFamily: "monospace" }}>{reviewingSubmission.accountNumber || "—"}</strong></div>
                      <div style={{ gridColumn: "1 / -1" }}><span style={{ color: "#64748B" }}>Account Name:</span> <strong style={{ color: "#0F172A" }}>{reviewingSubmission.accountName || "—"}</strong></div>
                      <div style={{ gridColumn: "1 / -1", paddingTop: 4 }}>
                        <span style={{ color: "#64748B" }}>Stated Monthly Salary:</span>{" "}
                        <strong style={{ color: "#059669", fontSize: 15 }}>
                          ₦{Number(reviewingSubmission.salary || 0).toLocaleString()}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Supporting Documents Section */}
              <div style={{ marginBottom: 24, borderTop: "1px solid #E2E8F0", paddingTop: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#0F172A", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <FileText size={16} color="#FF7F50" />
                  Uploaded Staff Documents ({reviewingSubmission.documents?.length || 0})
                </div>

                {reviewingSubmission.documents && reviewingSubmission.documents.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {reviewingSubmission.documents.map((doc, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          borderRadius: 8,
                          padding: "10px 14px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div style={{ overflow: "hidden" }}>
                          <div style={{ fontWeight: 700, fontSize: 12.5, color: "#0F172A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {doc.title}
                          </div>
                          <div style={{ fontSize: 10.5, color: "#94A3B8" }}>
                            {doc.fileType || "Document"}
                          </div>
                        </div>

                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            ...smallBtn,
                            background: "#2563EB",
                            color: "#FFFFFF",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <ExternalLink size={12} /> View File
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "#94A3B8", fontSize: 13, background: "#F8FAFC", padding: 14, borderRadius: 8, textAlign: "center" }}>
                    No supporting documents attached to this submission.
                  </div>
                )}
              </div>

              {/* Rejection input area if toggled */}
              {showRejectInput && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: 14, marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#991B1B", marginBottom: 6 }}>
                    Reason for Rejection (Visible to audit):
                  </label>
                  <textarea
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Passport does not have white background, Bank details mismatch..."
                    style={{ ...inp, width: "100%", borderColor: "#FCA5A5" }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                    <button
                      onClick={() => setShowRejectInput(false)}
                      style={{ ...smallBtn, background: "#E2E8F0", color: "#334155" }}
                    >
                      Cancel
                    </button>
                    <LoaderButton
                      loading={reviewActionLoading}
                      onClick={() => handleRejectSubmission(reviewingSubmission._id)}
                      style={{ ...smallBtn, background: "#DC2626", color: "#fff" }}
                    >
                      Confirm Rejection
                    </LoaderButton>
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #E2E8F0", paddingTop: 16 }}>
                <div>
                  {!showRejectInput && reviewingSubmission.status !== "rejected" && (
                    <button
                      onClick={() => setShowRejectInput(true)}
                      style={{ ...btn, background: "#FEE2E2", color: "#DC2626", fontSize: 13, padding: "8px 16px" }}
                    >
                      Reject Submission
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setReviewingSubmission(null)}
                    style={{ ...btn, background: "#F1F5F9", color: "#475569", fontSize: 13, padding: "8px 16px" }}
                  >
                    Close
                  </button>

                  <LoaderButton
                    loading={reviewActionLoading}
                    onClick={() => handleApproveSubmission(reviewingSubmission._id)}
                    style={{ ...btn, background: "#15803D", color: "#FFFFFF", fontSize: 13, padding: "8px 20px", display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <CheckCircle2 size={15} />
                    {reviewingSubmission.status === "approved" ? "Re-Approve & Sync Profile" : "Approve & Add to Staff"}
                  </LoaderButton>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: EDIT MONTHLY SCHEDULE RECORD ───────────────────────────── */}
        {editingMonthRecord && (
          <div style={overlayStyle}>
            <div style={{ ...modalStyle, maxWidth: 640 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: "1px solid #E2E8F0", paddingBottom: 14 }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}>
                    <Calendar size={18} color="#FF7F50" />
                    Update {selectedMonthName} {selectedYear} Payroll Record
                  </h3>
                  <p style={{ margin: 0, fontSize: 12.5, color: "#64748B" }}>
                    Staff: <strong style={{ color: "#0F172A" }}>{editingMonthRecord.staffName}</strong> (ID: {editingMonthRecord.employeeId || "—"}) · Dept: {editingMonthRecord.department || "General"}
                  </p>
                </div>
                <button onClick={() => setEditingMonthRecord(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}>
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveMonthRecord} style={{ display: "grid", gap: 16 }}>
                {/* Salary Section */}
                <div style={{ background: "#F8FAFC", padding: 14, borderRadius: 10, border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: 10, letterSpacing: 0.5 }}>
                    Salary Breakdown for {selectedMonthName} {selectedYear}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <label style={lbl}>
                      Basic Salary (₦) *
                      <input
                        type="number"
                        min="0"
                        required
                        value={editMonthBasic}
                        onChange={(e) => setEditMonthBasic(Number(e.target.value))}
                        style={{ ...inp, fontWeight: 700 }}
                      />
                    </label>

                    <label style={lbl}>
                      Allowances (₦)
                      <input
                        type="number"
                        min="0"
                        value={editMonthAllowances}
                        onChange={(e) => setEditMonthAllowances(Number(e.target.value))}
                        style={{ ...inp, color: "#059669", fontWeight: 700 }}
                      />
                    </label>

                    <label style={lbl}>
                      Month Deduction (₦)
                      <input
                        type="number"
                        min="0"
                        value={editMonthDeduction}
                        onChange={(e) => setEditMonthDeduction(Number(e.target.value))}
                        style={{ ...inp, borderColor: "#FCA5A5", background: "#FEF2F2", color: "#DC2626", fontWeight: 700 }}
                      />
                    </label>
                  </div>

                  <div style={{ marginTop: 10 }}>
                    <label style={lbl}>
                      Deduction Reason / Audit Note
                      <input
                        type="text"
                        placeholder="Ex: 2 days unexcused absence, Staff loan installment, Late penalty"
                        value={editMonthDeductionReason}
                        onChange={(e) => setEditMonthDeductionReason(e.target.value)}
                        style={inp}
                      />
                    </label>
                  </div>
                </div>

                {/* Bank Details Section */}
                <div style={{ background: "#F8FAFC", padding: 14, borderRadius: 10, border: "1px solid #E2E8F0" }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#475569", textTransform: "uppercase", marginBottom: 10, letterSpacing: 0.5 }}>
                    Bank Account Information
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <label style={lbl}>
                      Bank Name
                      <input
                        type="text"
                        placeholder="Ex: GTBank, Zenith, Access"
                        value={editMonthBankName}
                        onChange={(e) => setEditMonthBankName(e.target.value)}
                        style={inp}
                      />
                    </label>

                    <label style={lbl}>
                      Account Number
                      <input
                        type="text"
                        maxLength={10}
                        placeholder="10 digits"
                        value={editMonthAccountNumber}
                        onChange={(e) => setEditMonthAccountNumber(e.target.value)}
                        style={{ ...inp, fontFamily: "monospace", letterSpacing: 1 }}
                      />
                    </label>

                    <label style={lbl}>
                      Account Name
                      <input
                        type="text"
                        placeholder="Name on bank account"
                        value={editMonthAccountName}
                        onChange={(e) => setEditMonthAccountName(e.target.value)}
                        style={inp}
                      />
                    </label>
                  </div>
                </div>

                {/* Payment Status & Net Payout */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "center" }}>
                  <label style={lbl}>
                    Monthly Schedule Status
                    <select
                      value={editMonthStatus}
                      onChange={(e) => setEditMonthStatus(e.target.value as any)}
                      style={{ ...inp, fontWeight: 600 }}
                    >
                      <option value="pending">Pending Audit</option>
                      <option value="approved">Approved for Payment</option>
                      <option value="paid">Paid & Transferred</option>
                    </select>
                  </label>

                  <div style={{ background: "linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)", padding: 12, borderRadius: 10, border: "1px solid #BFDBFE" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#1E40AF", textTransform: "uppercase" }}>Calculated Net Bank Payout</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#1E3A8A", marginTop: 2 }}>
                      ₦{Math.max(0, (Number(editMonthBasic) || 0) + (Number(editMonthAllowances) || 0) - (Number(editMonthDeduction) || 0)).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8, paddingTop: 10, borderTop: "1px solid #E2E8F0" }}>
                  <button type="button" onClick={() => setEditingMonthRecord(null)} style={{ ...smallBtn, padding: "10px 16px" }}>
                    Cancel
                  </button>
                  <LoaderButton
                    type="submit"
                    loading={savingMonthRecord}
                    style={{ ...btn, background: "#2563EB", padding: "10px 22px", display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <Save size={15} /> Save & Lock Month Record
                  </LoaderButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── ID CARD MODAL (CR80 Vertical Layout 54mm × 85.6mm) ──────────── */}
        {showCardModal && previewMembers.length > 0 && (
          <div style={overlayStyle}>
            <div style={modalStyle}>
              {/* Modal header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, borderBottom: "1px solid #E5E7EB", paddingBottom: 16 }}>
                <div>
                  <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800 }}>
                    Official CR80 Vertical Staff ID Badges ({previewMembers.length})
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: "#666" }}>
                    Standard CR80 Portrait Badge (54mm × 85.6mm) · Corporate Layout · High-Res Print & PDF
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <LoaderButton onClick={() => window.print()} style={{ ...btn, padding: "8px 16px", background: "#1F2937", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Printer size={14} /> Print Badges
                  </LoaderButton>
                  <LoaderButton loading={downloadingPdf} onClick={downloadAllAsPdf} style={{ ...btn, padding: "8px 16px", background: "#7C3AED", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <FileDown size={14} /> Download All (PDF)
                  </LoaderButton>
                  <LoaderButton onClick={() => { setShowCardModal(false); setPreviewMembers([]); }} style={{ ...btn, padding: "8px 14px", background: "#EF4444", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <X size={14} /> Close
                  </LoaderButton>
                </div>
              </div>

              {/* Position & QR Link controls */}
              <div className="no-print" style={{ background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 12, padding: 14, marginBottom: 22, display: "grid", gap: 14 }}>
                <div>
                  <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                    <Sliders size={15} color="#DC2626" /> Fine-Tune Element Positions
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div style={{ background: "#fff", padding: 10, borderRadius: 8, border: "1px solid #E2E8F0" }}>
                      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: "#DC2626" }}>Passport Photo Position</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 11 }}>
                        <label>X: {cardLayout.photoX}px<input type="range" min="-40" max="40" value={cardLayout.photoX} onChange={(e) => setCardLayout({ ...cardLayout, photoX: +e.target.value })} style={{ width: "100%" }} /></label>
                        <label>Y: {cardLayout.photoY}px<input type="range" min="-30" max="30" value={cardLayout.photoY} onChange={(e) => setCardLayout({ ...cardLayout, photoY: +e.target.value })} style={{ width: "100%" }} /></label>
                        <label>Scale: {cardLayout.photoScale}%<input type="range" min="70" max="180" value={cardLayout.photoScale} onChange={(e) => setCardLayout({ ...cardLayout, photoScale: +e.target.value })} style={{ width: "100%" }} /></label>
                      </div>
                    </div>
                    <div style={{ background: "#fff", padding: 10, borderRadius: 8, border: "1px solid #E2E8F0" }}>
                      <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: "#3D120E" }}>Director Signature Scale</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8, fontSize: 11 }}>
                        <label>Scale: {cardLayout.signatureScale}%<input type="range" min="60" max="150" value={cardLayout.signatureScale} onChange={(e) => setCardLayout({ ...cardLayout, signatureScale: +e.target.value })} style={{ width: "100%" }} /></label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* QR Code Environment, Base URL & Parameters Configuration */}
                <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                    <div style={{ fontWeight: 800, fontSize: 12.5, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                      <QrCode size={15} color="#7C3AED" />
                      QR Code Link Environment &amp; URL Parameters (Local Testing / Vercel / Production Domain)
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {([
                        { id: "domain", label: "🌐 Official Domain (360degreeglobal.org)" },
                        { id: "vercel", label: "▲ Vercel Link (360live-three.vercel.app)" },
                        { id: "localhost_admin", label: "💻 Localhost (:3000)" },
                        { id: "localhost_webapp", label: "💻 Localhost (:5173)" },
                        { id: "custom", label: "⚙️ Custom URL" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectQrPreset(opt.id)}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            border: qrEnvPreset === opt.id ? "1.5px solid #7C3AED" : "1px solid #CBD5E1",
                            background: qrEnvPreset === opt.id ? "#F3E8FF" : "#F8FAFC",
                            color: qrEnvPreset === opt.id ? "#6D28D9" : "#334155",
                          }}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Base URL & Route Paths */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", display: "flex", flexDirection: "column", gap: 4 }}>
                      Active Base URL (Domain / Vercel / Localhost / IP)
                      <input
                        type="text"
                        value={qrBaseUrl}
                        onChange={(e) => {
                          setQrBaseUrl(e.target.value);
                          setQrEnvPreset("custom");
                          saveQrConfig({ qrBaseUrl: e.target.value, qrEnvPreset: "custom" });
                        }}
                        placeholder="https://360degreeglobal.org or http://localhost:3000"
                        style={{ ...inp, padding: "6px 10px", fontSize: 12, fontFamily: "monospace" }}
                      />
                    </label>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", display: "flex", flexDirection: "column", gap: 4 }}>
                      Front Attendance QR Path (use {"{id}"} or {"{empId}"})
                      <input
                        type="text"
                        value={qrAttendPath}
                        onChange={(e) => {
                          setQrAttendPath(e.target.value);
                          saveQrConfig({ qrAttendPath: e.target.value });
                        }}
                        placeholder="/attend/staff/{id}"
                        style={{ ...inp, padding: "6px 10px", fontSize: 12, fontFamily: "monospace" }}
                      />
                    </label>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", display: "flex", flexDirection: "column", gap: 4 }}>
                      Back Verification QR Path (use {"{id}"} or {"{empId}"})
                      <input
                        type="text"
                        value={qrVerifyPath}
                        onChange={(e) => {
                          setQrVerifyPath(e.target.value);
                          saveQrConfig({ qrVerifyPath: e.target.value });
                        }}
                        placeholder="/verify/staff/{id}"
                        style={{ ...inp, padding: "6px 10px", fontSize: 12, fontFamily: "monospace" }}
                      />
                    </label>
                  </div>

                  {/* Query Parameters Toggles & Custom Params */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, alignItems: "center", background: "#F8FAFC", padding: "8px 10px", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                        Attach Staff Query Parameters to QR URL:
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {([
                          { key: "empId", label: "empId" },
                          { key: "name", label: "name" },
                          { key: "dept", label: "dept" },
                          { key: "role", label: "role" },
                          { key: "phone", label: "phone" },
                          { key: "status", label: "status" },
                        ] as const).map((param) => {
                          const active = qrParamFlags[param.key];
                          return (
                            <label
                              key={param.key}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                fontSize: 11,
                                fontWeight: 700,
                                padding: "3px 8px",
                                borderRadius: 6,
                                cursor: "pointer",
                                background: active ? "#DCFCE7" : "#FFFFFF",
                                color: active ? "#166534" : "#475569",
                                border: active ? "1px solid #86EFAC" : "1px solid #CBD5E1",
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={active}
                                onChange={(e) => {
                                  const nextFlags = { ...qrParamFlags, [param.key]: e.target.checked };
                                  setQrParamFlags(nextFlags);
                                  saveQrConfig({ qrParamFlags: nextFlags });
                                }}
                                style={{ margin: 0 }}
                              />
                              ?{param.label}=
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", display: "flex", flexDirection: "column", gap: 4 }}>
                      Extra Custom Query Params (e.g. mode=test&amp;branch=keffi)
                      <input
                        type="text"
                        value={qrCustomParams}
                        onChange={(e) => {
                          setQrCustomParams(e.target.value);
                          saveQrConfig({ qrCustomParams: e.target.value });
                        }}
                        placeholder="mode=test&branch=keffi"
                        style={{ ...inp, padding: "6px 10px", fontSize: 12, fontFamily: "monospace", background: "#FFFFFF" }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="print-area-360" style={{ display: "flex", gap: 36, flexWrap: "wrap", justifyContent: "center" }}>
                {previewMembers.map((member) => {
                  const { empId, verifyUrl, attendUrl } = buildStaffQrUrls(member);

                  return (
                    <div key={member.$id} className="card-wrapper-360" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 36 }}>

                      {/* Per-card PDF button & Live QR Test Links */}
                      <div className="no-print" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, width: "100%", maxWidth: 496 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                          <LoaderButton
                            loading={downloadingIds.has(member.$id)}
                            onClick={() => downloadCardAsPdf(member)}
                            style={{ ...smallBtn, background: "#7C3AED", color: "#fff", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 4 }}
                          >
                            <FileDown size={13} /> Download PDF
                          </LoaderButton>
                          <span style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>{member.name}</span>
                          <a
                            href={attendUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ ...smallBtn, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "4px 9px" }}
                            title={attendUrl}
                          >
                            <ExternalLink size={11} /> Test Front QR
                          </a>
                          <a
                            href={verifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ ...smallBtn, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "4px 9px" }}
                            title={verifyUrl}
                          >
                            <ExternalLink size={11} /> Test Back QR
                          </a>
                        </div>
                        <div style={{ width: "100%", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 8px", fontSize: 10.5, fontFamily: "monospace", color: "#475569", display: "grid", gap: 2 }}>
                          <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={attendUrl}>
                            <strong style={{ color: "#1D4ED8" }}>Front QR:</strong> {attendUrl}
                          </div>
                          <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={verifyUrl}>
                            <strong style={{ color: "#DC2626" }}>Back QR:</strong> {verifyUrl}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 16 }}>

                        {/* ───────── FRONT CARD (CR80 Portrait 240px × 384px) ───────── */}
                        <div
                          ref={(el) => {
                            if (!cardRefs.current[member.$id]) cardRefs.current[member.$id] = { front: null, back: null };
                            cardRefs.current[member.$id].front = el;
                          }}
                          style={frontCardStyle}
                        >
                          {/* Subtle 3D Glossy Diagonal Watermark Waves */}
                          <svg
                            viewBox="0 0 240 384"
                            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
                          >
                            <defs>
                              <linearGradient id={`fg1-${member.$id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="rgba(61,18,14,0.055)" />
                                <stop offset="100%" stopColor="rgba(61,18,14,0.0)" />
                              </linearGradient>
                              <linearGradient id={`fg2-${member.$id}`} x1="100%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="rgba(61,18,14,0.045)" />
                                <stop offset="100%" stopColor="rgba(61,18,14,0.0)" />
                              </linearGradient>
                            </defs>
                            <path d="M-15,175 Q75,130 255,75 L255,155 Q100,195 -15,255 Z" fill={`url(#fg1-${member.$id})`} />
                            <path d="M-15,280 Q110,235 255,175 L255,245 Q125,290 -15,340 Z" fill={`url(#fg2-${member.$id})`} />
                          </svg>

                          {/* Top Header + Curved Right Wave + Red Banner (Seamless Unit) */}
                          <div style={{
                            position: "relative",
                            height: 95,
                            flexShrink: 0,
                            zIndex: 1,
                          }}>
                            {/* Seamless SVG background for the right-side brown swoosh, white curve gap, and upward-curving red banner */}
                            <svg
                              viewBox="0 0 240 95"
                              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block", pointerEvents: "none" }}
                              preserveAspectRatio="none"
                            >
                              {/* Dark brown upper-right swoosh */}
                              <path d="M84,72 Q172,70 240,46 L240,60 Q186,71 116,72 Z" fill="#3D120E" />
                              {/* Red banner — flat on left under logo, curves up on right */}
                              <path d="M0,72 L112,72 Q186,72 240,61.5 L240,95 L0,95 Z" fill="#D11919" />
                            </svg>

                            {/* Header Row: Large Circular Logo + Divider + Company Name */}
                            <div style={{
                              position: "relative",
                              zIndex: 2,
                              height: 72,
                              padding: "7px 8px 4px 10px",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}>
                              {/* Round Logo */}
                              <div style={{ width: 57, height: 57, flexShrink: 0, borderRadius: "50%", overflow: "hidden" }}>
                                <img
                                  src="/no-bg.png"
                                  alt="360 Logo"
                                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                                  onError={(e: any) => { e.currentTarget.src = "/logo.png"; }}
                                />
                              </div>
                              {/* Maroon Vertical Divider */}
                              <div style={{ width: 1.6, height: 46, background: "#3D120E", flexShrink: 0 }} />
                              {/* Brand Text */}
                              <div style={{ flex: 1, paddingBottom: 3 }}>
                                <div style={{ fontSize: 13, fontWeight: 900, color: "#3A130E", letterSpacing: 0.2, lineHeight: 1.04 }}>
                                  360 DEGREE
                                </div>
                                <div style={{ fontSize: 11.8, fontWeight: 900, color: "#3A130E", letterSpacing: 0.1, lineHeight: 1.08, whiteSpace: "nowrap" }}>
                                  GLOBAL ESTATE LTD.
                                </div>
                                <div style={{ fontSize: 9.2, fontWeight: 800, color: "#3D120E", letterSpacing: 0.2, marginTop: 2.5, lineHeight: 1 }}>
                                  RC: 1845920
                                </div>
                              </div>
                            </div>

                            {/* STAFF IDENTITY CARD Banner Text */}
                            <div style={{
                              position: "absolute",
                              left: 0,
                              right: 0,
                              bottom: 0,
                              height: 23,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              zIndex: 2,
                            }}>
                              <div style={{ fontSize: 11.2, fontWeight: 800, color: "#FFFFFF", letterSpacing: 1.7 }}>
                                STAFF IDENTITY CARD
                              </div>
                            </div>
                          </div>

                          {/* Passport Photo — wide rounded frame matching reference */}
                          <div style={{
                            width: 112, height: 115,
                            border: "2.2px solid #C81E1E",
                            borderRadius: 9,
                            overflow: "hidden",
                            background: "#EFEFEF",
                            boxShadow: "0 3px 10px rgba(61,18,14,0.12)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            margin: "7px auto 5px",
                            flexShrink: 0,
                            position: "relative",
                            zIndex: 1,
                          }}>
                            {member.photoUrl ? (
                              <img
                                src={member.photoUrl} alt="Staff" crossOrigin="anonymous"
                                style={{
                                  width: "100%", height: "100%", objectFit: "cover",
                                  transform: `translate(${cardLayout.photoX}px,${cardLayout.photoY}px) scale(${cardLayout.photoScale/100})`,
                                  transformOrigin: "center center",
                                }}
                              />
                            ) : <User size={44} color="#CBD5E1" />}
                          </div>

                          {/* Staff Name */}
                          <div style={{
                            textAlign: "center", fontSize: 13.5, fontWeight: 900, color: "#3D120E",
                            letterSpacing: 0.35, textTransform: "uppercase", lineHeight: 1.12,
                            margin: "0 8px 3px", flexShrink: 0, position: "relative", zIndex: 1,
                          }}>
                            {member.name}
                          </div>

                          {/* Position Pill with Crisp Flanking Horizontal Lines */}
                          <div style={{
                            display: "flex", alignItems: "center", justifyContent: "center",
                            gap: 8, padding: "0 12px", marginBottom: 5, flexShrink: 0,
                            position: "relative", zIndex: 1,
                          }}>
                            <div style={{ flex: 1, height: 1.5, background: "#3D120E" }} />
                            <span style={{
                              display: "inline-block",
                              background: "#3D120E",
                              color: "#FFFFFF",
                              fontSize: 8.8, fontWeight: 800,
                              padding: "2.5px 17px", borderRadius: 999,
                              letterSpacing: 0.6, textTransform: "uppercase",
                              whiteSpace: "nowrap",
                            }}>
                              {(member.position || "OFFICIAL STAFF").toUpperCase()}
                            </span>
                            <div style={{ flex: 1, height: 1.5, background: "#3D120E" }} />
                          </div>

                          {/* 2-Column Info Grid Box */}
                          <div style={{
                            margin: "0 10px 3px",
                            border: "1.3px solid #4A1C17",
                            borderRadius: 9,
                            background: "#FAF2EE",
                            display: "flex",
                            alignItems: "stretch",
                            flexShrink: 0,
                            overflow: "hidden",
                            position: "relative",
                            zIndex: 1,
                          }}>
                            {/* Left column */}
                            <div style={{ flex: 1, padding: "5px 8px" }}>
                              <div style={{ fontSize: 6.2, fontWeight: 800, color: "#3D120E", letterSpacing: 0.2, textTransform: "uppercase" }}>STAFF ID</div>
                              <div style={{ fontSize: 8.8, fontWeight: 900, color: "#2E0D0A", letterSpacing: 0.15, marginBottom: 3, lineHeight: 1.15 }}>{empId}</div>
                              <div style={{ fontSize: 6.2, fontWeight: 800, color: "#3D120E", letterSpacing: 0.2, textTransform: "uppercase" }}>PHONE</div>
                              <div style={{ fontSize: 8.4, fontWeight: 900, color: "#2E0D0A", lineHeight: 1.15 }}>{member.phone || "—"}</div>
                            </div>
                            {/* Red centre divider (inset vertically like reference image) */}
                            <div style={{ width: 1.3, background: "#C81E1E", margin: "6px 0", flexShrink: 0 }} />
                            {/* Right column */}
                            <div style={{ flex: 1.15, padding: "5px 8px", overflow: "hidden" }}>
                              <div style={{ fontSize: 6.2, fontWeight: 800, color: "#3D120E", letterSpacing: 0.2, textTransform: "uppercase" }}>DEPARTMENT</div>
                              <div style={{ fontSize: 8.4, fontWeight: 900, color: "#2E0D0A", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3, lineHeight: 1.15 }}>
                                {(member.department || "GENERAL").toUpperCase()}
                              </div>
                              <div style={{ fontSize: 6.2, fontWeight: 800, color: "#3D120E", letterSpacing: 0.2, textTransform: "uppercase" }}>STATUS</div>
                              <div style={{ fontSize: 8.8, fontWeight: 900, color: member.active ? "#15803D" : "#C81E1E", letterSpacing: 0.25, lineHeight: 1.15 }}>
                                {member.active ? "ACTIVE" : "INACTIVE"}
                              </div>
                            </div>
                          </div>

                          {/* Bottom Row: Attendance QR (Left) + Signature & Line (Right) — NO text pills */}
                          <div style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "1px 18px 0 22px",
                            position: "relative",
                            zIndex: 1,
                          }}>
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(attendUrl)}`}
                              alt="QR" crossOrigin="anonymous"
                              style={{
                                width: 42, height: 42,
                                display: "block",
                              }}
                            />
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                              <img
                                src={directorSigUrl || "/signatures/official_signature_dark.png"}
                                alt="Signature"
                                crossOrigin="anonymous"
                                style={{
                                  maxHeight: (26 * cardLayout.signatureScale) / 100,
                                  maxWidth: 92,
                                  objectFit: "contain",
                                  display: "block",
                                  filter: "contrast(2.2) brightness(0.2)",
                                }}
                              />
                              <div style={{ width: 96, borderBottom: "1.5px solid #2E0D0A", marginTop: 2 }} />
                            </div>
                          </div>

                          {/* Bottom Curved Red + White Line + Dark Maroon Wave Footer */}
                          <div style={{ marginTop: "auto", flexShrink: 0, position: "relative", zIndex: 1 }}>
                            <svg viewBox="0 0 240 22" style={{ width: "100%", height: 22, display: "block" }} preserveAspectRatio="none">
                              {/* Red upper wave starting high on bottom-left */}
                              <path d="M0,0 Q28,16 85,15 Q160,12 240,8 L240,22 L0,22 Z" fill="#D11919" />
                              {/* Dark brown lower wave */}
                              <path d="M0,10 Q40,20 110,18 Q185,14 240,13 L240,22 L0,22 Z" fill="#3D120E" />
                              {/* Crisp white separating highlight curve */}
                              <path d="M55,18 Q135,15 240,12" fill="none" stroke="#FFFFFF" strokeWidth="1.2" />
                            </svg>
                          </div>
                        </div>

                        {/* ───────── BACK CARD (CR80 Portrait 240px × 384px) ───────── */}
                        <div
                          ref={(el) => {
                            if (!cardRefs.current[member.$id]) cardRefs.current[member.$id] = { front: null, back: null };
                            cardRefs.current[member.$id].back = el;
                          }}
                          style={backCardStyle}
                        >
                          {/* Subtle 3D Glossy Diagonal Watermark Waves */}
                          <svg
                            viewBox="0 0 240 384"
                            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }}
                          >
                            <defs>
                              <linearGradient id={`bg1-${member.$id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="rgba(61,18,14,0.055)" />
                                <stop offset="100%" stopColor="rgba(61,18,14,0.0)" />
                              </linearGradient>
                              <linearGradient id={`bg2-${member.$id}`} x1="100%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="rgba(61,18,14,0.045)" />
                                <stop offset="100%" stopColor="rgba(61,18,14,0.0)" />
                              </linearGradient>
                            </defs>
                            <path d="M-15,195 Q90,135 255,85 L255,165 Q110,210 -15,280 Z" fill={`url(#bg1-${member.$id})`} />
                            <path d="M-15,295 Q115,235 255,185 L255,250 Q125,295 -15,350 Z" fill={`url(#bg2-${member.$id})`} />
                          </svg>

                          {/* Top Dark Maroon Header with Asymmetric Curved White & Red Wave */}
                          <div style={{ flexShrink: 0, position: "relative", zIndex: 1 }}>
                            <div style={{
                              background: "#3D120E",
                              padding: "8px 6px 2px",
                              textAlign: "center",
                            }}>
                              <div style={{ fontSize: 10.4, fontWeight: 800, color: "#FFFFFF", letterSpacing: 0.35, lineHeight: 1.15 }}>
                                OFFICIAL IDENTIFICATION CARD
                              </div>
                              <div style={{ fontSize: 7.3, fontWeight: 700, color: "#F8E8E6", letterSpacing: 0.15, marginTop: 2, lineHeight: 1.15 }}>
                                PROPERTY OF 360 DEGREE GLOBAL ESTATE LTD.
                              </div>
                            </div>
                            <svg viewBox="0 0 240 20" style={{ width: "100%", height: 20, display: "block", marginTop: -1 }} preserveAspectRatio="none">
                              {/* Dark brown sweep extending lower on the left and arching up on the right */}
                              <path d="M0,0 L240,0 L240,6 Q170,0.5 95,4.5 Q32,8 0,15 Z" fill="#3D120E" />
                              {/* Red wave band underneath */}
                              <path d="M0,15.5 Q32,8.5 95,5 Q170,1 240,6.5 L240,15.5 Q170,11 95,12.5 Q32,14 0,20 Z" fill="#D11919" />
                              {/* Crisp white curve separating brown and red */}
                              <path d="M0,15.2 Q32,8.2 95,4.8 Q170,0.8 240,6.2" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
                            </svg>
                          </div>

                          {/* Terms of Authorization — soft pinkish-cream box, full-width 4-line text */}
                          <div style={{
                            margin: "2px 10px 6px",
                            fontSize: 6.8, color: "#1A0E0C", textAlign: "center", lineHeight: 1.36, fontWeight: 500,
                            background: "#F9E8E3", border: "1.1px solid #9A5B53", borderRadius: 10, padding: "6px 7px",
                            position: "relative", zIndex: 1, flexShrink: 0,
                          }}>
                            This card certifies that the bearer is an authorized staff member of <strong style={{ fontWeight: 800 }}>360 Degree Global Estate Ltd.</strong> and is entitled to all official privileges accorded to same. Must be surrendered upon termination of employment or request.
                          </div>

                          {/* Verification QR — large, red rounded square border, NO "SCAN TO VERIFY" text */}
                          <div style={{
                            display: "flex", justifyContent: "center", alignItems: "center",
                            margin: "2px 0 4px",
                            position: "relative", zIndex: 1, flexShrink: 0,
                          }}>
                            <div style={{
                              padding: 6,
                              border: "2.5px solid #C81E1E",
                              borderRadius: 10,
                              background: "#FFFFFF",
                              boxShadow: "0 3px 10px rgba(200,30,30,0.1)",
                              display: "inline-flex",
                            }}>
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(verifyUrl)}`}
                                alt="Verification QR" crossOrigin="anonymous"
                                style={{ width: 86, height: 86, display: "block" }}
                              />
                            </div>
                          </div>

                          {/* Back Signature — Crisp Dark Ink, ONLY "Director" below line */}
                          <div style={{ textAlign: "center", margin: "1px 0 4px", position: "relative", zIndex: 1, flexShrink: 0 }}>
                            <div style={{
                              width: 135, margin: "0 auto",
                              minHeight: 27, display: "flex", alignItems: "flex-end", justifyContent: "center",
                            }}>
                              <img
                                src={directorSigUrl || "/signatures/official_signature_dark.png"} alt="Director Signature" crossOrigin="anonymous"
                                style={{
                                  maxHeight: (30 * cardLayout.signatureScale) / 100,
                                  maxWidth: 122,
                                  objectFit: "contain", display: "block", margin: "0 auto",
                                  filter: "contrast(2.2) brightness(0.2)",
                                }}
                              />
                            </div>
                            <div style={{ width: 156, borderBottom: "1.5px solid #2E0D0A", margin: "1px auto 2.5px" }} />
                            <div style={{ fontSize: 9.5, fontWeight: 800, color: "#2E0D0A", letterSpacing: 0.2 }}>
                              Director
                            </div>
                          </div>

                          {/* Return Notice */}
                          <div style={{ width: "90%", height: 1.3, background: "#C81E1E", margin: "1px auto 3.5px", position: "relative", zIndex: 1, flexShrink: 0 }} />
                          <div style={{ fontSize: 6.2, color: "#23120F", textAlign: "center", lineHeight: 1.34, padding: "0 6px", fontWeight: 600, position: "relative", zIndex: 1, flexShrink: 0 }}>
                            <div>If found, please return to <strong style={{ fontWeight: 800 }}>360 Degree Global Estate Ltd.</strong>,</div>
                            <div>NSUK 2nd Gate, Keffi, Nasarawa State, or the nearest Police Station.</div>
                            <div style={{ fontWeight: 900, fontSize: 7.8, marginTop: 1.5, color: "#2E0D0A" }}>Tel: 08038923692</div>
                          </div>

                          {/* Barcode Stripe + Large Bold Staff ID text */}
                          <div style={{ width: "86%", margin: "3px auto 0", position: "relative", zIndex: 1, flexShrink: 0 }}>
                            <svg viewBox="0 0 200 24" style={{ width: "100%", height: 22, display: "block" }} preserveAspectRatio="none">
                              {[
                                [0,2],[4,1],[7,3.2],[12,1],[15,2.2],[19,1],[22,3.2],[27,1],[30,2],[34,2],[38,1],[41,3.2],[46,1],[49,2],[53,1],
                                [56,3.2],[61,2],[65,1],[68,2],[72,3.2],[77,1],[80,2],[84,1],[87,3.2],[92,2],[96,1],[99,2],[103,3.2],[108,1],
                                [111,2],[115,1],[118,3.2],[123,2],[127,1],[130,3.2],[135,1],[138,2],[142,2],[146,1],[149,3.2],[154,1],[157,2],
                                [161,3.2],[166,1],[169,2],[173,1],[176,3.2],[181,2],[185,1],[188,3.2],[193,1],[196,2],[199,1]
                              ].map(([x, w], i) => (
                                <rect key={i} x={x} y={0} width={w} height={24} fill="#111111" />
                              ))}
                            </svg>
                            <div style={{ fontSize: 10.2, letterSpacing: 1.4, color: "#2E0D0A", textAlign: "center", marginTop: 2, fontWeight: 900, lineHeight: 1.1 }}>
                              *{empId}*
                            </div>
                          </div>

                          {/* Bottom Curved Red + White Line + Dark Maroon Wave Footer */}
                          <div style={{ marginTop: "auto", flexShrink: 0, position: "relative", zIndex: 1 }}>
                            <svg viewBox="0 0 240 20" style={{ width: "100%", height: 20, display: "block" }} preserveAspectRatio="none">
                              <path d="M0,1.5 Q70,11 145,11.5 Q205,11.5 240,1 L240,20 L0,20 Z" fill="#D11919" />
                              <path d="M0,9.5 Q75,17.5 150,16.5 Q205,15.5 240,7.5 L240,20 L0,20 Z" fill="#3D120E" />
                              <path d="M0,9.2 Q75,17.2 150,16.2 Q205,15.2 240,7.2" fill="none" stroke="#FFFFFF" strokeWidth="1.3" />
                            </svg>
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Shared Styles ────────────────────────────────────────────────────────────
const overlayStyle: React.CSSProperties = {
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: "rgba(15, 23, 42, 0.75)", display: "flex",
  justifyContent: "center", alignItems: "flex-start",
  zIndex: 1000, backdropFilter: "blur(6px)",
  overflowY: "auto", padding: "20px 0",
};

const modalStyle: React.CSSProperties = {
  backgroundColor: "#fff", padding: 24, borderRadius: 20,
  width: "95%", maxWidth: 1060,
  boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
};

const frontCardStyle: React.CSSProperties = {
  width: 240, height: 384, backgroundColor: "#ffffff",
  borderRadius: 16, overflow: "hidden",
  boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
  display: "flex", flexDirection: "column",
  border: "1px solid rgba(0,0,0,0.08)",
  position: "relative",
};

const backCardStyle: React.CSSProperties = {
  width: 240, height: 384, backgroundColor: "#ffffff",
  borderRadius: 16, overflow: "hidden",
  boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
  display: "flex", flexDirection: "column",
  border: "1px solid rgba(0,0,0,0.08)",
  position: "relative",
};

const card: React.CSSProperties = {
  background: "#fff", padding: 24, borderRadius: 16,
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column",
};

const inp: React.CSSProperties = {
  padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e5e5",
  fontSize: 14, width: "100%", boxSizing: "border-box",
};

const btn: React.CSSProperties = {
  padding: "10px 20px", borderRadius: 10, border: "none",
  background: "#ff7f50", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14,
};

const smallBtn: React.CSSProperties = {
  padding: "6px 12px", borderRadius: 6, border: "none",
  background: "#f3f4f6", color: "#1E1E1E", fontSize: 12, fontWeight: 600, cursor: "pointer",
};

const lbl: React.CSSProperties = {
  display: "flex", flexDirection: "column", gap: 6,
  fontSize: 13, fontWeight: 600, color: "#374151",
};
