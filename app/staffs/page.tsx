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
  const [activeTab, setActiveTab] = useState<"directory" | "salary" | "documents">("directory");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
                <PenTool size={16} color="#FF7F50" /> Managing Director / CEO Official Signature
              </div>
              <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 14 }}>
                Upload the Managing Director's official signature. It is dynamically embedded onto the back of every CR80 vertical badge.
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
          {(["directory", "salary", "documents"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className="staff-tab-btn" style={{
              borderBottom: activeTab === tab ? "3px solid #ff7f50" : "3px solid transparent",
              color: activeTab === tab ? "#ff7f50" : "#6B7280",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              {tab === "directory" ? (
                <><Users size={15} /> Staff Directory</>
              ) : tab === "salary" ? (
                <><DollarSign size={15} /> Monthly Salary & Banking</>
              ) : (
                <><FolderOpen size={15} /> Documents</>
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

              {/* Signature */}
              <div style={{ gridColumn: "span 2", background: "#F9FAFB", padding: 16, borderRadius: 12 }}>
                <label style={{ ...lbl, marginBottom: 8 }}>Staff Cardholder Signature</label>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  {form.signatureUrl && !signatureFile && (
                    <img src={form.signatureUrl} alt="Signature" style={{ height: 32, objectFit: "contain", background: "#fff", padding: 4, borderRadius: 6, border: "1px solid #ccc" }} />
                  )}
                  <input type="file" accept="image/*" onChange={(e) => setSignatureFile(e.target.files?.[0] || null)} style={inp} />
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

              {/* Position controls */}
              <div className="no-print" style={{ background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 12, padding: 14, marginBottom: 22 }}>
                <h4 style={{ margin: "0 0 10px", fontSize: 13, color: "#0F172A", display: "flex", alignItems: "center", gap: 6 }}>
                  <Sliders size={15} color="#FF7F50" /> Fine-Tune Element Positions
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div style={{ background: "#fff", padding: 10, borderRadius: 8, border: "1px solid #E2E8F0" }}>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: "#ff7f50" }}>Passport Photo Position</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 11 }}>
                      <label>X: {cardLayout.photoX}px<input type="range" min="-40" max="40" value={cardLayout.photoX} onChange={(e) => setCardLayout({ ...cardLayout, photoX: +e.target.value })} style={{ width: "100%" }} /></label>
                      <label>Y: {cardLayout.photoY}px<input type="range" min="-30" max="30" value={cardLayout.photoY} onChange={(e) => setCardLayout({ ...cardLayout, photoY: +e.target.value })} style={{ width: "100%" }} /></label>
                      <label>Scale: {cardLayout.photoScale}%<input type="range" min="70" max="180" value={cardLayout.photoScale} onChange={(e) => setCardLayout({ ...cardLayout, photoScale: +e.target.value })} style={{ width: "100%" }} /></label>
                    </div>
                  </div>
                  <div style={{ background: "#fff", padding: 10, borderRadius: 8, border: "1px solid #E2E8F0" }}>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: "#1E3A8A" }}>Cardholder Signature</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 11 }}>
                      <label>X: {cardLayout.signatureX}px<input type="range" min="-50" max="50" value={cardLayout.signatureX} onChange={(e) => setCardLayout({ ...cardLayout, signatureX: +e.target.value })} style={{ width: "100%" }} /></label>
                      <label>Y: {cardLayout.signatureY}px<input type="range" min="-30" max="30" value={cardLayout.signatureY} onChange={(e) => setCardLayout({ ...cardLayout, signatureY: +e.target.value })} style={{ width: "100%" }} /></label>
                      <label>Scale: {cardLayout.signatureScale}%<input type="range" min="70" max="140" value={cardLayout.signatureScale} onChange={(e) => setCardLayout({ ...cardLayout, signatureScale: +e.target.value })} style={{ width: "100%" }} /></label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="print-area-360" style={{ display: "flex", gap: 36, flexWrap: "wrap", justifyContent: "center" }}>
                {previewMembers.map((member) => {
                  const publicWebUrl = process.env.NEXT_PUBLIC_WEBAPP_URL || (typeof window !== "undefined" && window.location.origin.includes("localhost") ? "https://360degreeglobal.org" : "https://360degreeglobal.org");
                  const verifyUrl = `${publicWebUrl}/verify/staff/${member.$id}`;
                  const attendUrl = `${publicWebUrl}/attend/staff/${member.$id}`;
                  const empId = member.employeeId || `360-${member.$id.slice(0, 6).toUpperCase()}`;

                  return (
                    <div key={member.$id} className="card-wrapper-360" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 36 }}>

                      {/* Per-card PDF button */}
                      <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <LoaderButton
                          loading={downloadingIds.has(member.$id)}
                          onClick={() => downloadCardAsPdf(member)}
                          style={{ ...smallBtn, background: "#7C3AED", color: "#fff", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: 4 }}
                        >
                          <FileDown size={13} /> Download PDF
                        </LoaderButton>
                        <span style={{ fontSize: 12, color: "#666", fontWeight: 600 }}>{member.name}</span>
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
                          {/* Top Lanyard Slot Punch Cutout Marker */}
                          <div style={{ width: 32, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.12)", margin: "4px auto 2px" }} />

                          {/* Top Security Line */}
                          <div style={{ height: 4, background: "linear-gradient(90deg, #1a365d, #ff7f50, #1a365d, #ff7f50, #1a365d)" }} />

                          {/* Deep Navy Corporate Header */}
                          <div style={{
                            background: "linear-gradient(135deg, #0F172A 0%, #1E293B 70%, #1E3A8A 100%)",
                            padding: "8px 10px 6px",
                            display: "flex", alignItems: "center", gap: 8,
                            borderBottom: "1.5px solid #FF7F50",
                          }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#fff", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: 2 }}>
                              <img src="/logo.png" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }}
                                onError={(e: any) => { e.currentTarget.style.display = "none"; }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 9.5, fontWeight: 900, color: "#FFFFFF", letterSpacing: 0.5, lineHeight: 1.1 }}>
                                360 DEGREE GLOBAL
                              </div>
                              <div style={{ fontSize: 7.5, fontWeight: 800, color: "#FF7F50", letterSpacing: 0.4 }}>
                                ESTATE LTD.
                              </div>
                              <div style={{ fontSize: 5.5, color: "rgba(255,255,255,0.7)", letterSpacing: 0.2 }}>
                                RC: 1845920 · Real Estate & Infrastructure
                              </div>
                            </div>
                          </div>

                          {/* Badge Type Title */}
                          <div style={{
                            background: "linear-gradient(90deg, #FF6B4A 0%, #E04826 100%)",
                            padding: "2.5px 6px", textAlign: "center",
                          }}>
                            <div style={{ fontSize: 7, fontWeight: 900, color: "#fff", letterSpacing: 1.2 }}>
                              STAFF IDENTITY CARD
                            </div>
                          </div>

                          {/* Body Content */}
                          <div style={{ flex: 1, padding: "8px 12px 6px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between" }}>

                            {/* Centered Passport Photo Frame */}
                            <div style={{
                              width: 86, height: 104, borderRadius: 8,
                              overflow: "hidden",
                              border: "2.5px solid #FF7F50",
                              boxShadow: "0 4px 14px rgba(255,111,74,0.3)",
                              background: "#F1F5F9",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              position: "relative",
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
                              ) : <User size={34} color="#CBD5E1" />}
                            </div>

                            {/* Staff Name & Position Banner */}
                            <div style={{ textAlign: "center", marginTop: 4, width: "100%" }}>
                              <div style={{ fontSize: 10.5, fontWeight: 900, color: "#0F172A", letterSpacing: 0.3, lineHeight: 1.2, textTransform: "uppercase" }}>
                                {member.name}
                              </div>
                              <div style={{
                                display: "inline-block",
                                background: "#0F172A",
                                color: "#FF7F50",
                                fontSize: 6.5, fontWeight: 800,
                                padding: "2px 8px", borderRadius: 4,
                                marginTop: 3, letterSpacing: 0.5,
                              }}>
                                {(member.position || "OFFICIAL STAFF").toUpperCase()}
                              </div>
                            </div>

                            {/* Structured 2-Column Info Grid */}
                            <div style={{
                              width: "100%",
                              background: "#F8FAFC",
                              border: "1px solid #E2E8F0",
                              borderRadius: 6,
                              padding: "4px 8px",
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: "3px 8px",
                              marginTop: 4,
                            }}>
                              <div>
                                <div style={{ fontSize: 5, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>STAFF ID</div>
                                <div style={{ fontSize: 7.5, fontWeight: 800, color: "#0F172A", fontFamily: "monospace" }}>{empId}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 5, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>DEPARTMENT</div>
                                <div style={{ fontSize: 7, fontWeight: 700, color: "#0F172A" }}>{(member.department || "GENERAL").toUpperCase()}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 5, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>PHONE</div>
                                <div style={{ fontSize: 6.5, fontWeight: 700, color: "#0F172A" }}>{member.phone || "—"}</div>
                              </div>
                              <div>
                                <div style={{ fontSize: 5, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>STATUS</div>
                                <div style={{ fontSize: 6.5, fontWeight: 800, color: member.active ? "#059669" : "#DC2626" }}>
                                  {member.active ? "ACTIVE" : "INACTIVE"}
                                </div>
                              </div>
                            </div>

                            {/* Bottom Row: Attendance QR on left + Cardholder Signature on right */}
                            <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 4 }}>
                              {/* Left: Attendance QR */}
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                                <img
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(attendUrl)}`}
                                  alt="Attendance QR" crossOrigin="anonymous"
                                  style={{ width: 34, height: 34, borderRadius: 3, border: "1px solid #CBD5E1", padding: 1, background: "#fff" }}
                                />
                                <div style={{ fontSize: 4.5, color: "#64748B", fontWeight: 700 }}>ATTENDANCE QR</div>
                              </div>

                              {/* Right: Cardholder Signature */}
                              <div style={{
                                width: 90, textAlign: "center",
                                transform: `translate(${cardLayout.signatureX}px,${cardLayout.signatureY}px)`,
                              }}>
                                <div style={{ minHeight: 20, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                                  <img
                                    src={member.signatureUrl || "/signatures/official_signature_dark.png"} alt="Cardholder Signature" crossOrigin="anonymous"
                                    style={{ height: (18 * cardLayout.signatureScale) / 100, objectFit: "contain", display: "block", margin: "0 auto" }}
                                  />
                                </div>
                                <div style={{ borderTop: "1px solid #0F172A", paddingTop: 1 }}>
                                  <div style={{ fontSize: 5, fontWeight: 800, color: "#0F172A", letterSpacing: 0.3 }}>
                                    CARDHOLDER SIGNATURE
                                  </div>
                                </div>
                              </div>
                            </div>

                          </div>

                          {/* Bottom Holographic Stripe */}
                          <div style={{ height: 6, background: "linear-gradient(90deg, #0F172A 50%, #FF7F50 100%)" }} />
                        </div>

                        {/* ───────── BACK CARD (CR80 Portrait 240px × 384px) ───────── */}
                        <div
                          ref={(el) => {
                            if (!cardRefs.current[member.$id]) cardRefs.current[member.$id] = { front: null, back: null };
                            cardRefs.current[member.$id].back = el;
                          }}
                          style={backCardStyle}
                        >
                          {/* Top Lanyard Slot Marker */}
                          <div style={{ width: 32, height: 4, borderRadius: 2, background: "rgba(0,0,0,0.12)", margin: "4px auto 2px" }} />

                          {/* Top Security Stripe */}
                          <div style={{ height: 4, background: "linear-gradient(90deg, #FF7F50, #0F172A, #FF7F50)" }} />

                          {/* Header */}
                          <div style={{ background: "#0F172A", padding: "6px 8px", textAlign: "center", borderBottom: "1.5px solid #FF7F50" }}>
                            <div style={{ fontSize: 7, fontWeight: 900, color: "#FFFFFF", letterSpacing: 0.4 }}>OFFICIAL IDENTIFICATION CARD</div>
                            <div style={{ fontSize: 5.5, color: "#FF7F50", fontWeight: 700 }}>PROPERTY OF 360 DEGREE GLOBAL ESTATE LTD.</div>
                          </div>

                          {/* Body Content */}
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "8px 12px 6px", alignItems: "center", justifyContent: "space-between" }}>

                            {/* Terms of Authorization */}
                            <div style={{
                              fontSize: 5.5, color: "#334155", textAlign: "center", lineHeight: 1.35,
                              background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "5px 6px",
                            }}>
                              This card certifies that the bearer is an authorized staff member of <strong>360 Degree Global Estate Ltd.</strong> and is entitled to all official privileges accorded to same. Must be surrendered upon termination of employment or request.
                            </div>

                            {/* Centered High-Contrast Verification QR */}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                              <div style={{ fontSize: 5.5, fontWeight: 900, color: "#0F172A", letterSpacing: 0.5 }}>
                                SCAN TO VERIFY AUTHENTICITY
                              </div>
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(verifyUrl)}`}
                                alt="Verification QR" crossOrigin="anonymous"
                                style={{
                                  width: 62, height: 62,
                                  border: "2px solid #FF7F50",
                                  borderRadius: 6, padding: 2, background: "#fff",
                                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                }}
                              />
                            </div>

                            {/* CEO / Managing Director Signature */}
                            <div style={{ width: "100%", textAlign: "center" }}>
                              <div style={{
                                width: 110, margin: "0 auto 2px",
                                borderBottom: "1.5px solid #0F172A",
                                minHeight: 24, display: "flex", alignItems: "flex-end", justifyContent: "center",
                              }}>
                                <img
                                  src={directorSigUrl || "/signatures/official_signature_dark.png"} alt="Managing Director Signature" crossOrigin="anonymous"
                                  style={{ maxHeight: 24, objectFit: "contain" }}
                                />
                              </div>
                              <div style={{ fontSize: 6.5, fontWeight: 900, color: "#0F172A" }}>ENGR. ABBAS MODIBBO</div>
                              <div style={{ fontSize: 5.5, fontWeight: 700, color: "#64748B" }}>Managing Director / CEO</div>
                            </div>

                            {/* Return Notice & Police Station */}
                            <div style={{ fontSize: 5, fontStyle: "italic", color: "#64748B", textAlign: "center", lineHeight: 1.3 }}>
                              If found, please return to 360 Degree Global Estate Ltd., NSUK 2nd Gate, Keffi, Nasarawa State, or the nearest Police Station. Tel: 08038923692
                            </div>

                            {/* Barcode Stripe with Staff ID */}
                            <div style={{ width: "100%", marginTop: 2 }}>
                              <div style={{
                                height: 12,
                                background: "repeating-linear-gradient(90deg, #000 0, #000 1.5px, #fff 1.5px, #fff 3px)",
                                width: "82%", margin: "0 auto",
                              }} />
                              <div style={{ fontSize: 5, letterSpacing: 2, color: "#334155", textAlign: "center", marginTop: 1, fontFamily: "monospace", fontWeight: 700 }}>
                                *{empId}*
                              </div>
                            </div>

                          </div>

                          {/* Bottom Holographic Stripe */}
                          <div style={{ height: 6, background: "linear-gradient(90deg, #FF7F50 0%, #0F172A 60%)" }} />
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
  borderRadius: 14, overflow: "hidden",
  boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
  display: "flex", flexDirection: "column",
  border: "1px solid rgba(0,0,0,0.08)",
  position: "relative",
};

const backCardStyle: React.CSSProperties = {
  width: 240, height: 384, backgroundColor: "#ffffff",
  borderRadius: 14, overflow: "hidden",
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
