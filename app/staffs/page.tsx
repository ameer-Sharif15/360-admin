"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { getClients, ID, Query, type Models } from "../../lib/appwrite";
import { uploadToCloudinary } from "../../lib/cloudinary";
import { API_BASE_URL } from "../../lib/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawLetterhead, stampDocumentFooter } from "../../lib/pdfLetterhead";
import {
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

const COLLECTION_KEY = "STAFF_MEMBERS";
const DIRECTOR_SIG_KEY = "360_director_signature_url";

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
    if (saved) setDirectorSigUrl(saved);
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
      if (selectedStaffForDocs) {
        const updated = res.documents.find((s) => s.$id === selectedStaffForDocs.$id);
        if (updated) setSelectedStaffForDocs(updated);
      }
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStaff(); }, [clientBundle]);

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

  // PDF - single card
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
      const W = 85.6; const H = 54;
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [W * 2 + 12, H + 20] });
      pdf.addImage(fc.toDataURL("image/png"), "PNG", 5, 5, W, H);
      pdf.addImage(bc.toDataURL("image/png"), "PNG", W + 12, 5, W, H);
      pdf.setFontSize(6); pdf.setTextColor(120);
      pdf.text("FRONT", 5 + W / 2, H + 12, { align: "center" });
      pdf.text("BACK", W + 12 + W / 2, H + 12, { align: "center" });
      pdf.setFontSize(5); pdf.setTextColor(140);
      pdf.text(`Official Document · Generated by IT Department · 360 Degree Global Estate Ltd. · ${new Date().toLocaleDateString("en-GB")}`, W * 2 + 7, H + 17, { align: "right" });
      pdf.save(`ID_${member.name.replace(/\s+/g, "_")}_${member.employeeId || member.$id.slice(0, 6)}.pdf`);
    } catch (err: any) { setError("PDF failed: " + err.message); }
    finally { setDownloadingIds((prev) => { const n = new Set(prev); n.delete(member.$id); return n; }); }
  };

  // PDF - all cards
  const downloadAllAsPdf = async () => {
    setDownloadingPdf(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"), import("html2canvas"),
      ]);
      const W = 85.6; const H = 54;
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [W * 2 + 12, H + 20] });
      for (let i = 0; i < previewMembers.length; i++) {
        const m = previewMembers[i];
        const refs = cardRefs.current[m.$id];
        if (!refs?.front || !refs?.back) continue;
        if (i > 0) pdf.addPage();
        const [fc, bc] = await Promise.all([
          html2canvas(refs.front, { scale: 3, useCORS: true, allowTaint: true }),
          html2canvas(refs.back, { scale: 3, useCORS: true, allowTaint: true }),
        ]);
        pdf.addImage(fc.toDataURL("image/png"), "PNG", 5, 5, W, H);
        pdf.addImage(bc.toDataURL("image/png"), "PNG", W + 12, 5, W, H);
        pdf.setFontSize(6); pdf.setTextColor(120);
        pdf.text("FRONT", 5 + W / 2, H + 12, { align: "center" });
        pdf.text("BACK", W + 12 + W / 2, H + 12, { align: "center" });
        pdf.text(m.name, 5, H + 17, { align: "left" });
        pdf.setFontSize(5); pdf.setTextColor(140);
        pdf.text(`Official Document · Generated by IT Department · 360 Degree Global Estate Ltd. · ${new Date().toLocaleDateString("en-GB")}`, W * 2 + 7, H + 17, { align: "right" });
      }
      pdf.save(`360_ID_Cards_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (err: any) { setError("Batch PDF failed: " + err.message); }
    finally { setDownloadingPdf(false); }
  };

  // Bank Payroll PDF (360 Degree Letterhead + IT Dept Sign + Complete Schedule)
  const downloadPayrollPDF = async () => {
    setDownloadingPayrollPdf(true);
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const docRef = `360-PAYROLL-${new Date().toISOString().slice(0, 7).replace("-", "")}`;
      const startY = await drawLetterhead(doc, {
        title: "Staff Salary & Bank Payment Schedule",
        subtitle: "Confidential Monthly Bank Credit Advice · 360 Degree Global Estate Ltd.",
        docRef,
        badge: "BANK ADVICE",
      });

      // Compute aggregates
      const totalBasic = staff.reduce((acc, s) => acc + (Number(s.basicSalary) || 0), 0);
      const totalAllowances = staff.reduce((acc, s) => acc + (Number(s.allowances) || 0), 0);
      const totalDeductions = staff.reduce((acc, s) => acc + (Number(s.deductions) || 0), 0);
      const totalNet = staff.reduce((acc, s) => {
        const net = s.netSalary !== undefined ? Number(s.netSalary) : (Number(s.basicSalary || 0) + Number(s.allowances || 0) - Number(s.deductions || 0));
        return acc + net;
      }, 0);

      // Summary Metric Cards above table
      const pageWidth = doc.internal.pageSize.getWidth();
      const cardY = startY;
      const cardHeight = 12;
      const cardSpacing = 4;
      const margin = 14;
      const availableWidth = pageWidth - margin * 2;
      const cardWidth = (availableWidth - cardSpacing * 4) / 5;

      const metrics = [
        { label: "STAFF COUNT", val: `${staff.length} Persons`, color: [30, 41, 59] },
        { label: "TOTAL BASIC", val: `₦${totalBasic.toLocaleString()}`, color: [30, 58, 138] },
        { label: "TOTAL ALLOWANCE", val: `₦${totalAllowances.toLocaleString()}`, color: [16, 185, 129] },
        { label: "TOTAL DEDUCTION", val: `-₦${totalDeductions.toLocaleString()}`, color: [220, 38, 38] },
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
        "Ded. (₦)",
        "Ded. Reason",
        "Net Salary (₦)",
      ];

      const tableRows = staff.map((s, idx) => {
        const net = s.netSalary !== undefined ? Number(s.netSalary) : (Number(s.basicSalary || 0) + Number(s.allowances || 0) - Number(s.deductions || 0));
        return [
          String(idx + 1),
          s.name || "N/A",
          `${s.employeeId || s.$id.slice(0, 6)}\n${s.department || "General"}`,
          s.bankName || "—",
          s.accountNumber || "—",
          s.accountName || s.name || "—",
          (Number(s.basicSalary) || 0).toLocaleString(),
          (Number(s.allowances) || 0).toLocaleString(),
          (Number(s.deductions) || 0) > 0 ? `-${(Number(s.deductions) || 0).toLocaleString()}` : "0",
          s.deductionReason || "—",
          net.toLocaleString(),
        ];
      });

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
        margin: { left: 14, right: 14 },
        styles: {
          fontSize: 7.5,
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
          fontSize: 8,
        },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 38, fontStyle: "bold" },
          2: { cellWidth: 28 },
          3: { cellWidth: 24 },
          4: { cellWidth: 26, fontStyle: "bold" },
          5: { cellWidth: 34 },
          6: { cellWidth: 20, halign: "right" },
          7: { cellWidth: 20, halign: "right" },
          8: { cellWidth: 20, halign: "right", textColor: [220, 38, 38] },
          9: { cellWidth: 24, fontSize: 6.5 },
          10: { cellWidth: 25, halign: "right", fontStyle: "bold", textColor: [26, 54, 93] },
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

      // Stamp IT department sign and page numbers on every page
      stampDocumentFooter(doc, "Confidential Bank Payroll Transfer Document");

      doc.save(`360_Bank_Payroll_Schedule_${new Date().toISOString().split("T")[0]}.pdf`);
      setSuccessMsg("Bank payroll PDF generated and downloaded successfully!");
    } catch (err: any) {
      setError("Payroll PDF failed: " + err.message);
    } finally {
      setDownloadingPayrollPdf(false);
    }
  };

  // CSV (With IT Department Sign + Deduction Reason)
  const downloadPayrollCSV = async () => {
    setDownloadingCsv(true);
    try {
      const itSign = `"# Official Document: Generated by IT Department · 360 Degree Global Estate Ltd. · ${new Date().toLocaleString("en-NG")}"`;
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
        "Deduction Reason",
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
        `"${(s.deductionReason || "").replace(/"/g, '""')}"`,
        s.netSalary || (Number(s.basicSalary || 0) + Number(s.allowances || 0) - Number(s.deductions || 0)),
      ]);
      const csv =
        "data:text/csv;charset=utf-8," +
        encodeURIComponent(
          [itSign, headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
        );
      const a = document.createElement("a");
      a.href = csv;
      a.download = `360_Staff_Payroll_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setSuccessMsg("Payroll CSV downloaded with IT Department verification signature.");
    } finally {
      setDownloadingCsv(false);
    }
  };

  // Docs upload/delete
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

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes spin360 { to { transform: rotate(360deg); } }
        @keyframes slideDown360 { from { opacity:0; transform:translateY(-10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn360 { from { opacity:0; } to { opacity:1; } }
        .sig-panel-360 { animation: slideDown360 0.25s ease; }
        .card-wrapper-360 { animation: fadeIn360 0.4s ease; }

        /* ── Responsive ── */
        .staff-header-row { display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; }
        .staff-tabs { display:flex; border-bottom:2px solid #E5E7EB; gap:8px; font-size:14px; font-weight:700; overflow-x:auto; }
        .staff-tab-btn { padding:12px 8px; background:none; border:none; border-bottom:3px solid transparent; cursor:pointer; font-weight:700; transition:all 0.2s; white-space:nowrap; }
        .staff-form-grid { display:grid; gap:16px; grid-template-columns:1fr 1fr; }
        .staff-sal-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; }
        .staff-doc-layout { display:grid; grid-template-columns:1fr 2fr; gap:24px; }
        .staff-table-wrap { overflow-x:auto; }
        .staff-btn-row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
        @media (max-width:768px) {
          .staff-form-grid { grid-template-columns:1fr !important; }
          .staff-sal-grid { grid-template-columns:1fr 1fr !important; }
          .staff-doc-layout { grid-template-columns:1fr !important; }
          .staff-header-row { flex-direction:column; align-items:stretch; }
          .staff-btn-row { justify-content:flex-start; }
          .sig-panel-360 { grid-template-columns:1fr !important; }
        }
        @media (max-width:480px) {
          .staff-sal-grid { grid-template-columns:1fr !important; }
          .staff-tab-btn { font-size:12px; padding:10px 4px; }
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
            <h2 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 800 }}>Staff Management</h2>
            <p style={{ margin: 0, color: "#666", fontSize: 14 }}>ID Cards · Payroll · Documents · Staff Directory</p>
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
                  <FileDown size={14} /> Bank Payroll (PDF)
                </LoaderButton>
                <LoaderButton loading={downloadingCsv} onClick={downloadPayrollCSV} style={{ ...btn, background: "#10B981", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Download size={14} /> Download CSV
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
                <PenTool size={16} color="#FF7F50" /> Director / CEO Signature
              </div>
              <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 14 }}>
                Upload the Managing Director's signature image. It will automatically appear on every generated ID card back.
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
                    <Check size={12} /> Enabled on All ID Cards
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
                <><DollarSign size={15} /> Salary & Banking</>
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
              {editingId ? "Edit Staff Profile" : "Register New Staff Member"}
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
                <label style={{ ...lbl, marginBottom: 8 }}>Staff Passport Photo</label>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  {form.photoUrl && !imageFile && (
                    <img src={form.photoUrl} alt="Photo" style={{ width: 56, height: 66, objectFit: "cover", borderRadius: 8, border: "2px solid #ff7f50" }} />
                  )}
                  <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} style={inp} />
                </div>
              </div>

              {/* Signature */}
              <div style={{ gridColumn: "span 2", background: "#F9FAFB", padding: 16, borderRadius: 12 }}>
                <label style={{ ...lbl, marginBottom: 8 }}>Cardholder Signature Image</label>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  {form.signatureUrl && !signatureFile && (
                    <img src={form.signatureUrl} alt="Sig" style={{ height: 36, objectFit: "contain", background: "#fff", padding: 4, borderRadius: 4, border: "1px solid #ccc" }} />
                  )}
                  <input type="file" accept="image/*" onChange={(e) => setSignatureFile(e.target.files?.[0] || null)} style={inp} />
                </div>
              </div>

              {/* Salary */}
              <div style={{ gridColumn: "span 2", borderTop: "1px solid #E5E7EB", paddingTop: 16, marginTop: 4 }}>
                <h4 style={{ margin: "0 0 14px", color: "#1F2937", display: "flex", alignItems: "center", gap: 6 }}>
                  <DollarSign size={16} color="#FF7F50" /> Banking & Salary
                </h4>
                <div className="staff-sal-grid">
                  <label style={lbl}>Bank Name<input placeholder="Zenith Bank" value={form.bankName || ""} onChange={(e) => setForm({ ...form, bankName: e.target.value })} style={inp} /></label>
                  <label style={lbl}>Account Number<input placeholder="0123456789" value={form.accountNumber || ""} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} style={inp} /></label>
                  <label style={lbl}>Account Name<input placeholder="John Doe" value={form.accountName || ""} onChange={(e) => setForm({ ...form, accountName: e.target.value })} style={inp} /></label>
                  <label style={lbl}>Basic Salary (₦)<input type="number" min="0" value={form.basicSalary || ""} onChange={(e) => handleSalaryChange("basicSalary", Number(e.target.value))} style={inp} /></label>
                  <label style={lbl}>Allowances (₦)<input type="number" min="0" value={form.allowances || ""} onChange={(e) => handleSalaryChange("allowances", Number(e.target.value))} style={inp} /></label>
                  <div style={{ display: "grid", gap: 6 }}>
                    <label style={lbl}>Deductions (₦)<input type="number" min="0" value={form.deductions || ""} onChange={(e) => handleSalaryChange("deductions", Number(e.target.value))} style={inp} /></label>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#DC2626", marginBottom: 4 }}>Deduction Reason <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(required if deducting)</span></div>
                      <input
                        placeholder="e.g. Loan repayment, Late attendance, Equipment damage…"
                        value={form.deductionReason || ""}
                        onChange={(e) => setForm({ ...form, deductionReason: e.target.value })}
                        style={{ ...inp, borderColor: form.deductions ? "#FCA5A5" : "#e5e5e5", background: form.deductions ? "#FFF5F5" : "#fff" }}
                      />
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 12, padding: 12, background: "#EFF6FF", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 700, color: "#1E40AF" }}>Net Salary:</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: "#1E3A8A" }}>₦{(form.netSalary || 0).toLocaleString()}</span>
                </div>
              </div>

              <label style={{ display: "flex", alignItems: "center", gap: 8, gridColumn: "span 2", marginTop: 4 }}>
                <input type="checkbox" checked={form.active ?? true} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Active Staff Member</span>
              </label>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
              <LoaderButton type="submit" loading={loading || uploadingImage} style={btn}>
                {editingId ? "Save Changes" : "Create Staff Profile"}
              </LoaderButton>
              <LoaderButton type="button" onClick={() => setShowForm(false)} style={{ ...btn, background: "#9CA3AF" }}>
                Cancel
              </LoaderButton>
            </div>
          </form>
        )}

        {/* ── VIEW 1: DIRECTORY ─────────────────────────────────────────── */}
        {activeTab === "directory" && (
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 14, color: "#666" }}>Total Staff: <strong>{staff.length}</strong></span>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                <input type="checkbox"
                  checked={staff.length > 0 && selectedIds.size === staff.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(new Set(staff.map((s) => s.$id)));
                    else setSelectedIds(new Set());
                  }}
                />
                Select All for ID Printing
              </label>
            </div>

            {loading && staff.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#999", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <Spinner size={28} color="#ff7f50" /><div>Loading staff…</div>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
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
                          <div style={{ width: 42, height: 48, borderRadius: 6, background: "#eee", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                  <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>No staff registered yet.</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── VIEW 2: SALARY ──────────────────────────────────────────────── */}
        {activeTab === "salary" && (
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: "0 0 4px" }}>Salary & Banking Store</h3>
                <p style={{ margin: 0, fontSize: 13, color: "#666" }}>Account numbers, bank details, payroll export</p>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <LoaderButton loading={downloadingPayrollPdf} onClick={downloadPayrollPDF} style={{ ...btn, background: "#1a365d", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <FileDown size={14} /> Download Bank Payroll (PDF)
                </LoaderButton>
                <LoaderButton loading={downloadingCsv} onClick={downloadPayrollCSV} style={{ ...btn, background: "#10B981", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Download size={14} /> Download Payroll (CSV)
                </LoaderButton>
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #E5E7EB", background: "#F9FAFB" }}>
                    <th style={{ padding: 12 }}>Staff Name</th>
                    <th style={{ padding: 12 }}>Bank</th>
                    <th style={{ padding: 12 }}>Account No.</th>
                    <th style={{ padding: 12 }}>Account Name</th>
                    <th style={{ padding: 12, textAlign: "right" }}>Basic (₦)</th>
                    <th style={{ padding: 12, textAlign: "right" }}>Allowances</th>
                    <th style={{ padding: 12, textAlign: "right" }}>Deductions</th>
                    <th style={{ padding: 12 }}>Deduction Reason</th>
                    <th style={{ padding: 12, textAlign: "right" }}>Net (₦)</th>
                    <th style={{ padding: 12, textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => {
                    const net = s.netSalary || (Number(s.basicSalary||0)+Number(s.allowances||0)-Number(s.deductions||0));
                    return (
                      <tr key={s.$id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                        <td style={{ padding: 12 }}><strong>{s.name}</strong><div style={{ fontSize: 12, color: "#666" }}>{s.employeeId || s.position}</div></td>
                        <td style={{ padding: 12 }}>{s.bankName || <span style={{ color: "#aaa" }}>—</span>}</td>
                        <td style={{ padding: 12, fontFamily: "monospace", fontWeight: 600 }}>{s.accountNumber || <span style={{ color: "#aaa" }}>—</span>}</td>
                        <td style={{ padding: 12 }}>{s.accountName || s.name}</td>
                        <td style={{ padding: 12, textAlign: "right" }}>{(s.basicSalary||0).toLocaleString()}</td>
                        <td style={{ padding: 12, textAlign: "right", color: "#059669" }}>+{(s.allowances||0).toLocaleString()}</td>
                        <td style={{ padding: 12, textAlign: "right", color: "#DC2626" }}>-{(s.deductions||0).toLocaleString()}</td>
                        <td style={{ padding: 12, fontSize: 12, color: s.deductionReason ? "#92400E" : "#aaa", fontStyle: s.deductionReason ? "normal" : "italic", maxWidth: 160 }}>
                          {s.deductionReason || "—"}
                        </td>
                        <td style={{ padding: 12, textAlign: "right", fontWeight: 800, color: "#1E3A8A" }}>₦{net.toLocaleString()}</td>
                        <td style={{ padding: 12, textAlign: "center" }}>
                          <LoaderButton onClick={() => handleEdit(s)} style={{ ...smallBtn, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Edit size={12} /> Update
                          </LoaderButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
                  <h4 style={{ margin: "0 0 10px" }}>Saved Records ({(selectedStaffForDocs.documents||[]).length})</h4>
                  {!(selectedStaffForDocs.documents?.length) ? (
                    <p style={{ color: "#9CA3AF", fontStyle: "italic" }}>No documents yet.</p>
                  ) : (
                    <div style={{ display: "grid", gap: 8 }}>
                      {selectedStaffForDocs.documents.map((doc, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                              <FileText size={15} color="#2563EB" /> {doc.title}
                            </div>
                            <div style={{ fontSize: 11, color: "#6B7280" }}>Uploaded: {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : "Recorded"}</div>
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                            <button
                              onClick={() => window.open(doc.fileUrl, "_blank", "noopener,noreferrer")}
                              style={{ ...smallBtn, background: "#EFF6FF", color: "#2563EB", display: "inline-flex", alignItems: "center", gap: 4 }}
                            >
                              <Eye size={12} /> View
                            </button>
                            <button
                              onClick={async () => {
                                try {
                                  // Force download: fetch blob then create object URL
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
                                  // fallback: open in new tab
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

        {/* ── ID CARD MODAL ──────────────────────────────────────────────── */}
        {showCardModal && previewMembers.length > 0 && (
          <div style={overlayStyle}>
            <div style={modalStyle}>
              {/* Modal header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, borderBottom: "1px solid #E5E7EB", paddingBottom: 16 }}>
                <div>
                  <h3 style={{ margin: "0 0 4px" }}>Staff ID Card Preview ({previewMembers.length})</h3>
                  <p style={{ margin: 0, fontSize: 13, color: "#666" }}>Premium modern design · Front & Back · Print or Download as PDF</p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <LoaderButton onClick={() => window.print()} style={{ ...btn, padding: "8px 16px", background: "#1F2937", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <Printer size={14} /> Print All
                  </LoaderButton>
                  <LoaderButton loading={downloadingPdf} onClick={downloadAllAsPdf} style={{ ...btn, padding: "8px 16px", background: "#7C3AED", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <FileDown size={14} /> Download All PDF
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
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: "#ff7f50" }}>Passport Photo</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 11 }}>
                      <label>X: {cardLayout.photoX}px<input type="range" min="-40" max="40" value={cardLayout.photoX} onChange={(e) => setCardLayout({ ...cardLayout, photoX: +e.target.value })} style={{ width: "100%" }} /></label>
                      <label>Y: {cardLayout.photoY}px<input type="range" min="-30" max="30" value={cardLayout.photoY} onChange={(e) => setCardLayout({ ...cardLayout, photoY: +e.target.value })} style={{ width: "100%" }} /></label>
                      <label>Size: {cardLayout.photoScale}%<input type="range" min="70" max="180" value={cardLayout.photoScale} onChange={(e) => setCardLayout({ ...cardLayout, photoScale: +e.target.value })} style={{ width: "100%" }} /></label>
                    </div>
                  </div>
                  <div style={{ background: "#fff", padding: 10, borderRadius: 8, border: "1px solid #E2E8F0" }}>
                    <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 8, color: "#1E3A8A" }}>Cardholder Signature</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, fontSize: 11 }}>
                      <label>X: {cardLayout.signatureX}px<input type="range" min="-50" max="50" value={cardLayout.signatureX} onChange={(e) => setCardLayout({ ...cardLayout, signatureX: +e.target.value })} style={{ width: "100%" }} /></label>
                      <label>Y: {cardLayout.signatureY}px<input type="range" min="-30" max="30" value={cardLayout.signatureY} onChange={(e) => setCardLayout({ ...cardLayout, signatureY: +e.target.value })} style={{ width: "100%" }} /></label>
                      <label>Size: {cardLayout.signatureScale}%<input type="range" min="70" max="140" value={cardLayout.signatureScale} onChange={(e) => setCardLayout({ ...cardLayout, signatureScale: +e.target.value })} style={{ width: "100%" }} /></label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cards */}
              <div className="print-area-360" style={{ display: "flex", gap: 36, flexWrap: "wrap", justifyContent: "center" }}>
                {previewMembers.map((member) => {
                  const verifyUrl = `${API_BASE_URL}/api/staff/${member.$id}/verify`;
                  const attendUrl = `${API_BASE_URL}/api/staff/${member.$id}/attend`;
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
                        <span style={{ fontSize: 12, color: "#666" }}>{member.name}</span>
                      </div>

                      <div style={{ display: "flex", gap: 14 }}>
                        {/* ───────── FRONT ───────── */}
                        <div
                          ref={(el) => {
                            if (!cardRefs.current[member.$id]) cardRefs.current[member.$id] = { front: null, back: null };
                            cardRefs.current[member.$id].front = el;
                          }}
                          style={frontCardStyle}
                        >
                          {/* Top holographic line */}
                          <div style={{ height: 5, background: "linear-gradient(90deg,#1a365d,#ff7f50,#1a365d,#ff7f50,#1a365d)" }} />

                          {/* Header */}
                          <div style={{
                            background: "linear-gradient(135deg,#1a365d 0%,#243b6e 60%,#1d4ed8 100%)",
                            padding: "9px 10px 7px",
                            display: "flex", alignItems: "center", gap: 9,
                          }}>
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#fff", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <img src="/logo.png" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }}
                                onError={(e: any) => { e.currentTarget.style.display = "none"; }} />
                            </div>
                            <div>
                              <div style={{ fontSize: 9.5, fontWeight: 900, color: "#fff", letterSpacing: 0.3, lineHeight: 1.1 }}>360 DEGREE GLOBAL</div>
                              <div style={{ fontSize: 8, fontWeight: 700, color: "#ff7f50" }}>ESTATE LTD.</div>
                              <div style={{ fontSize: 5.5, color: "rgba(255,255,255,0.65)" }}>NSUK 2nd Gate, Keffi · 08038923692</div>
                            </div>
                          </div>

                          {/* Body */}
                          <div style={{ display: "flex", flex: 1, padding: "10px 10px 8px" }}>
                            {/* Left column: photo + cardholder sig */}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 84 }}>
                              {/* Photo */}
                              <div style={{
                                width: 78, height: 90, borderRadius: 9,
                                overflow: "hidden", border: "3px solid #ff7f50",
                                boxShadow: "0 4px 12px rgba(255,127,80,0.35)",
                                background: "#f0f0f0",
                                display: "flex", alignItems: "center", justifyContent: "center",
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
                                ) : <User size={32} color="#CBD5E1" />}
                              </div>

                              {/* Cardholder signature */}
                              <div style={{
                                width: 80, borderTop: "1.5px solid #1a365d",
                                paddingTop: 3, textAlign: "center",
                                transform: `translate(${cardLayout.signatureX}px,${cardLayout.signatureY}px)`,
                              }}>
                                {member.signatureUrl ? (
                                  <img src={member.signatureUrl} alt="Sig" crossOrigin="anonymous"
                                    style={{ height: (18*cardLayout.signatureScale)/100, objectFit: "contain", display: "block", margin: "0 auto" }} />
                                ) : <div style={{ height: 14 }} />}
                                <div style={{ fontSize: 5.5, fontWeight: 700, color: "#1a365d" }}>CARDHOLDER SIGNATURE</div>
                              </div>
                            </div>

                            {/* Right column: info */}
                            <div style={{ flex: 1, paddingLeft: 8, display: "flex", flexDirection: "column", gap: 2 }}>
                              {/* ID badge */}
                              <div style={{
                                background: "linear-gradient(90deg,#ff7f50,#e85d25)",
                                borderRadius: 5, padding: "3px 6px", marginBottom: 5, textAlign: "center",
                              }}>
                                <div style={{ fontSize: 7.5, fontWeight: 900, color: "#fff", letterSpacing: 1.2 }}>STAFF IDENTITY CARD</div>
                              </div>

                              {[
                                { label: "NAME", value: member.name.toUpperCase(), large: true },
                                { label: "RANK", value: (member.position || "STAFF").toUpperCase() },
                                { label: "ID NO.", value: (member.employeeId || member.$id.substring(0,8)).toUpperCase() },
                                { label: "DEPT", value: (member.department || "GENERAL").toUpperCase() },
                                { label: "PHONE", value: member.phone || "N/A" },
                              ].map(({ label, value, large }) => (
                                <div key={label} style={{ marginBottom: 3 }}>
                                  <div style={{ fontSize: 6, fontWeight: 800, color: "#ff7f50", letterSpacing: 0.4 }}>{label}</div>
                                  <div style={{ fontSize: large ? 9 : 7.5, fontWeight: large ? 900 : 700, color: "#1a365d", lineHeight: 1.1 }}>{value}</div>
                                </div>
                              ))}

                              {/* Attendance QR */}
                              <div style={{ textAlign: "center", marginTop: "auto" }}>
                                <img
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(attendUrl)}`}
                                  alt="QR" crossOrigin="anonymous"
                                  style={{ width: 40, height: 40, borderRadius: 4, border: "1px solid #E5E7EB", padding: 1 }}
                                />
                                <div style={{ fontSize: 5, color: "#aaa" }}>SCAN TO ATTEND</div>
                              </div>
                            </div>
                          </div>

                          {/* Bottom stripe */}
                          <div style={{ height: 7, background: "linear-gradient(90deg,#1a365d 55%,#ff7f50 100%)" }} />
                        </div>

                        {/* ───────── BACK ───────── */}
                        <div
                          ref={(el) => {
                            if (!cardRefs.current[member.$id]) cardRefs.current[member.$id] = { front: null, back: null };
                            cardRefs.current[member.$id].back = el;
                          }}
                          style={backCardStyle}
                        >
                          {/* Top holographic */}
                          <div style={{ height: 5, background: "linear-gradient(90deg,#ff7f50,#1a365d,#ff7f50)" }} />

                          {/* Dark header */}
                          <div style={{ background: "#1a365d", padding: "7px 10px", textAlign: "center" }}>
                            <div style={{ fontSize: 7.5, fontWeight: 900, color: "#fff", letterSpacing: 0.4 }}>OFFICIAL IDENTIFICATION CARD</div>
                            <div style={{ fontSize: 6, color: "#ff7f50", fontWeight: 700 }}>360 DEGREE GLOBAL ESTATE LTD.</div>
                          </div>

                          {/* Body */}
                          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "10px 12px", alignItems: "center", justifyContent: "space-between" }}>
                            {/* Auth text */}
                            <div style={{ fontSize: 6.5, fontStyle: "italic", color: "#374151", textAlign: "center", lineHeight: 1.4 }}>
                              This certifies that the bearer is an authorised staff member of 360 Degree Global Estate Ltd. and is entitled to all privileges accorded to same.
                            </div>

                            {/* Verification QR */}
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                              <div style={{ fontSize: 6, fontWeight: 800, color: "#1a365d", letterSpacing: 0.5 }}>SCAN TO VERIFY STAFF</div>
                              <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}`}
                                alt="Verify QR" crossOrigin="anonymous"
                                style={{ width: 72, height: 72, border: "2.5px solid #ff7f50", borderRadius: 7, padding: 3, background: "#fff" }}
                              />
                            </div>

                            {/* Director signature */}
                            <div style={{ width: "100%", textAlign: "center" }}>
                              <div style={{ width: 100, margin: "0 auto 2px", borderBottom: "1.5px solid #1a365d", minHeight: 26, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                                {directorSigUrl && (
                                  <img src={directorSigUrl} alt="Director Sig" crossOrigin="anonymous"
                                    style={{ maxHeight: 24, objectFit: "contain" }} />
                                )}
                              </div>
                              <div style={{ fontSize: 6.5, fontWeight: 800, color: "#1a365d" }}>Managing Director / CEO</div>
                            </div>

                            {/* Lost notice */}
                            <div style={{ fontSize: 5.5, fontStyle: "italic", color: "#9CA3AF", textAlign: "center", lineHeight: 1.3 }}>
                              If found, please return to 360 Degree Global Estate Ltd. or nearest Police Station.
                            </div>

                            {/* Barcode */}
                            <div style={{ width: "100%", marginTop: 2 }}>
                              <div style={{ height: 14, background: "repeating-linear-gradient(90deg,#000 0,#000 1px,#fff 1px,#fff 2px)", width: "78%", margin: "0 auto" }} />
                              <div style={{ fontSize: 5.5, letterSpacing: 2, color: "#444", textAlign: "center", marginTop: 1 }}>*{member.$id.substring(0,10).toUpperCase()}*</div>
                            </div>
                          </div>

                          {/* Bottom stripe */}
                          <div style={{ height: 7, background: "linear-gradient(90deg,#ff7f50 0%,#1a365d 40%)" }} />
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
  backgroundColor: "rgba(0,0,0,0.65)", display: "flex",
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
  width: 222, height: 350, backgroundColor: "#fff",
  borderRadius: 13, overflow: "hidden",
  boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
  display: "flex", flexDirection: "column",
  border: "1px solid rgba(0,0,0,0.07)",
};

const backCardStyle: React.CSSProperties = {
  width: 222, height: 350, backgroundColor: "#fff",
  borderRadius: 13, overflow: "hidden",
  boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
  display: "flex", flexDirection: "column",
  border: "1px solid rgba(0,0,0,0.07)",
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