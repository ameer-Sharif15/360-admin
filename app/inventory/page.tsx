"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getClients, ID, Query, type Models } from "../../lib/appwrite";
import { apiRequest } from "../../lib/api";
import { uploadToCloudinary } from "../../lib/cloudinary";
import { drawLetterhead, stampDocumentFooter } from "../../lib/pdfLetterhead";
import {
  Package,
  Camera,
  Sparkles,
  UploadCloud,
  FileText,
  Files,
  FilePlus,
  CheckSquare,
  Square,
  Key,
  HelpCircle,
  ClipboardPaste,
  SlidersHorizontal,
  Eye,
  Upload,
  DollarSign,
  AlertTriangle,
  XCircle,
  FileDown,
  Download,
  Plus,
  X,
  Search,
  Tag,
  Factory,
  MapPin,
  ArrowDownLeft,
  ArrowUpRight,
  Edit,
  Trash2,
  RefreshCw,
  CheckCircle2,
  ClipboardList,
  Calendar,
  CalendarDays,
  Folder,
  Filter,
  History,
  Check,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Info,
  FolderPlus,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type InventoryItem = {
  $id: string;
  $createdAt?: string;
  name: string;
  sku?: string;
  category: string;
  unit?: string;
  quantity: number;
  minQuantity?: number;
  unitPrice?: number;
  totalValue?: number;
  supplier?: string;
  location?: string;
  description?: string;
  imageUrl?: string;
  status?: "in_stock" | "low_stock" | "out_of_stock" | "discontinued";
  lastRestockedAt?: string;
};

type StockMovement = {
  type: "in" | "out" | "adjustment";
  quantity: number;
  reason: string;
  date: string;
  by?: string;
};

// Supply & Issuance Record (matching DATE.docx)
// Persistent Category from MongoDB
export type SupplyCategory = {
  _id: string;
  name: string;
  icon?: string;
  description?: string;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ItemSupply = {
  _id: string;
  $id?: string;
  itemSupply: string;
  category?: string;
  unit?: string;
  customField?: string;
  quantityAvailable?: number | null;
  quantityIssued?: number | null;
  balance?: number | null;
  dateIssued: string; // YYYY-MM-DD
  feedback: string;
  isSectionHeader?: boolean;
  sectionTitle?: string;
  issuedBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

const COLLECTION_KEY = "INVENTORY";
const COMPANY = {
  name: "360 DEGREE GLOBAL ESTATE LTD.",
  address: "NSUK 2nd Gate, Behind Princess Sarah Hotel, Keffi, Nasarawa State",
  phone: "08038923692, 08136661966",
  email: "info@360degreeglobal.org",
};

function Spinner({ size = 16, color = "#ff7f50" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth={2.5} strokeLinecap="round"
      style={{ animation: "invSpin 0.7s linear infinite", flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" strokeOpacity={0.2} />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

function LoaderBtn({ loading, onClick, style, children, type = "button", disabled }: any) {
  return (
    <button type={type} onClick={onClick} disabled={loading || disabled} style={{
      ...style, opacity: loading || disabled ? 0.68 : 1,
      display: "inline-flex", alignItems: "center", gap: 6,
      cursor: loading || disabled ? "not-allowed" : "pointer",
    }}>
      {loading && <Spinner size={13} color={(style?.color as string) || "#fff"} />}
      {children}
    </button>
  );
}

function StatusBadge({ status, qty, min }: { status?: string; qty: number; min?: number }) {
  let s = status;
  if (!s) {
    if (qty === 0) s = "out_of_stock";
    else if (min && qty <= min) s = "low_stock";
    else s = "in_stock";
  }
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    in_stock:     { bg: "#D1FAE5", color: "#065F46", label: "In Stock" },
    low_stock:    { bg: "#FEF3C7", color: "#92400E", label: "Low Stock" },
    out_of_stock: { bg: "#FEE2E2", color: "#991B1B", label: "Out of Stock" },
    discontinued: { bg: "#F3F4F6", color: "#6B7280", label: "Discontinued" },
  };
  const c = cfg[s] || cfg.in_stock;
  return (
    <span style={{ background: c.bg, color: c.color, padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
      {c.label}
    </span>
  );
}

export default function InventoryPage() {
  // Navigation Tabs: "supplies" (DATE.docx table) vs "catalog" (Items)
  const [activeTab, setActiveTab] = useState<"supplies" | "catalog">("supplies");

  // ─── Catalog State ──────────────────────────────────────────────────────────
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<InventoryItem>>({ quantity: 0, minQuantity: 5, unitPrice: 0 });
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [savingForm, setSavingForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  // Stock movement modal
  const [movItem, setMovItem] = useState<InventoryItem | null>(null);
  const [mov, setMov] = useState<Partial<StockMovement>>({ type: "in", quantity: 1, reason: "" });
  const [savingMov, setSavingMov] = useState(false);

  // ─── Supply Register State (DATE.docx Table CRUD) ───────────────────────────
  const [supplies, setSupplies] = useState<ItemSupply[]>([]);
  const [loadingSupplies, setLoadingSupplies] = useState(false);
  const [savingSupply, setSavingSupply] = useState(false);
  const [deletingSupplyId, setDeletingSupplyId] = useState<string | null>(null);
  const [supplySearch, setSupplySearch] = useState("");
  const [supplyDateFilter, setSupplyDateFilter] = useState("");

  // ─── Persistent MongoDB Categories State ─────────────────────────────
  const [categoriesList, setCategoriesList] = useState<SupplyCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState<boolean>(false);
  const [showCategoryManager, setShowCategoryManager] = useState<boolean>(false);
  const [categoryForm, setCategoryForm] = useState<{
    _id?: string;
    name: string;
    icon: string;
    description: string;
    color: string;
  }>({
    name: "",
    icon: "🏷️",
    description: "",
    color: "#B91C1C",
  });
  const [savingCategory, setSavingCategory] = useState<boolean>(false);
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null);

  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const res = await apiRequest<{ documents: SupplyCategory[] }>("/api/inventory/categories");
      const list = Array.isArray(res?.documents) ? res.documents : [];
      setCategoriesList(list);
    } catch (err: any) {
      console.error("Failed to load categories:", err);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      setError("Category name is required.");
      return;
    }
    setSavingCategory(true);
    try {
      if (categoryForm._id) {
        await apiRequest(`/api/inventory/categories/${categoryForm._id}`, {
          method: "PUT",
          body: JSON.stringify(categoryForm),
        });
        setSuccess(`Category "${categoryForm.name}" updated successfully!`);
      } else {
        await apiRequest("/api/inventory/categories", {
          method: "POST",
          body: JSON.stringify(categoryForm),
        });
        setSuccess(`Category "${categoryForm.name}" created and saved in MongoDB!`);
      }
      setCategoryForm({ name: "", icon: "🏷️", description: "", color: "#B91C1C" });
      await fetchCategories();
      await fetchSupplies();
    } catch (err: any) {
      setError(err.message || "Failed to save category");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete category "${name}"? Existing items will be reassigned to "General".`)) return;
    setDeletingCatId(id);
    try {
      await apiRequest(`/api/inventory/categories/${id}`, { method: "DELETE" });
      setSuccess(`Category "${name}" deleted from MongoDB.`);
      if (selectedSupplyCategory.toLowerCase() === name.toLowerCase()) {
        setSelectedSupplyCategory("all");
      }
      await fetchCategories();
      await fetchSupplies();
    } catch (err: any) {
      setError(err.message || "Failed to delete category");
    } finally {
      setDeletingCatId(null);
    }
  };

  // Category & Monthly Period Archive State
  const currentMonthStr = new Date().toISOString().substring(0, 7); // e.g. "2026-10"
  const [selectedSupplyCategory, setSelectedSupplyCategory] = useState<string>("all");
  const [selectedSupplyMonth, setSelectedSupplyMonth] = useState<string>(currentMonthStr);
  const [customCategoryInput, setCustomCategoryInput] = useState<string>("");
  const [showAddCategoryModal, setShowAddCategoryModal] = useState<boolean>(false);

  // Available 18 Months for Historical Record Access
  const availableSupplyMonths = useMemo(() => {
    const months: { value: string; label: string }[] = [{ value: "all", label: "All Historical Months" }];
    const now = new Date();
    for (let i = 0; i < 18; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = d.toISOString().substring(0, 7);
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      months.push({ value: val, label: i === 0 ? `${label} (Current Month)` : label });
    }
    return months;
  }, []);

  // Direct Table Input: New Row State
  const todayDateStr = new Date().toISOString().split("T")[0];
  const [newSupplyRow, setNewSupplyRow] = useState({
    itemSupply: "",
    category: "",
    unit: "",
    customField: "",
    quantityAvailable: "",
    quantityIssued: "",
    dateIssued: todayDateStr,
    feedback: "",
  });

  // Section Header & Spacer State
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState("");
  const [savingSection, setSavingSection] = useState(false);

  // Inline Row Editing State
  const [editingSupplyId, setEditingSupplyId] = useState<string | null>(null);
  const [editSupplyData, setEditSupplyData] = useState<Partial<ItemSupply>>({});
  const [savingInlineEdit, setSavingInlineEdit] = useState(false);

  // ─── AI Extraction & Bulk Import Modal State ─────────────────────────────
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiTab, setAiTab] = useState<"ai" | "paste">("ai");
  const [aiSelectedCategory, setAiSelectedCategory] = useState<string>("");

  type AiUploadFile = {
    id: string;
    file: File;
    previewUrl: string | null;
    mimeType: string;
    isHeic: boolean;
    isPdf: boolean;
    sizeKb: number;
  };

  const [aiFiles, setAiFiles] = useState<AiUploadFile[]>([]);
  const [isDraggingAi, setIsDraggingAi] = useState<boolean>(false);
  const [extractionProgress, setExtractionProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
    percent: number;
  } | null>(null);

  const [aiInstruction, setAiInstruction] = useState<string>(
    "Extract only content in supply items. Map item name to Item Supply, available quantity to Quantity Available, issued quantity to Quantity Issued, and remarks to Feedback."
  );
  const [geminiApiKey, setGeminiApiKey] = useState<string>(
    process.env.NEXT_PUBLIC_GEMINI_API_KEY || ""
  );
  const [showApiKeyInput, setShowApiKeyInput] = useState<boolean>(false);
  const [extracting, setExtracting] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractSummary, setExtractSummary] = useState<string | null>(null);
  const [pasteInput, setPasteInput] = useState<string>("");
  const [savingBulk, setSavingBulk] = useState<boolean>(false);

  type StagingRow = {
    id: string;
    itemSupply: string;
    category: string;
    unit?: string;
    quantityAvailable?: number | null;
    quantityIssued?: number | null;
    balance?: number | null;
    dateIssued: string;
    feedback: string;
    sourceFile?: string;
    selected: boolean;
  };
  const [stagingRows, setStagingRows] = useState<StagingRow[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const envKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim() || "";
      const savedKey = localStorage.getItem("gemini_api_key")?.trim() || "";
      const keyToUse = envKey || savedKey;
      if (keyToUse) {
        setGeminiApiKey(keyToUse);
        localStorage.setItem("gemini_api_key", keyToUse);
      }
    }
  }, []);

  const saveGeminiKey = (key: string) => {
    setGeminiApiKey(key);
    if (typeof window !== "undefined") {
      localStorage.setItem("gemini_api_key", key);
    }
  };

  const handleFilesSelect = (filesInput: FileList | File[]) => {
    const incoming = Array.from(filesInput);
    if (incoming.length === 0) return;

    setExtractError(null);
    setExtractSummary(null);

    incoming.forEach((file) => {
      const isHeic =
        file.name.toLowerCase().endsWith(".heic") ||
        file.name.toLowerCase().endsWith(".heif") ||
        (file.type && (file.type.toLowerCase().includes("heic") || file.type.toLowerCase().includes("heif")));
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

      const mimeType = isHeic
        ? "image/heic"
        : isPdf
        ? "application/pdf"
        : file.type || "application/octet-stream";

      const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).substring(2, 6)}`;
      const sizeKb = Math.round(file.size / 1024);

      if (isHeic) {
        setAiFiles((prev) => [
          ...prev.filter((p) => !(p.file.name === file.name && p.file.size === file.size)),
          { id, file, previewUrl: "heic", mimeType, isHeic: true, isPdf: false, sizeKb },
        ]);
      } else if (isPdf) {
        setAiFiles((prev) => [
          ...prev.filter((p) => !(p.file.name === file.name && p.file.size === file.size)),
          { id, file, previewUrl: "pdf", mimeType, isHeic: false, isPdf: true, sizeKb },
        ]);
      } else if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setAiFiles((prev) => [
            ...prev.filter((p) => !(p.file.name === file.name && p.file.size === file.size)),
            {
              id,
              file,
              previewUrl: e.target?.result as string,
              mimeType,
              isHeic: false,
              isPdf: false,
              sizeKb,
            },
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        setAiFiles((prev) => [
          ...prev.filter((p) => !(p.file.name === file.name && p.file.size === file.size)),
          { id, file, previewUrl: null, mimeType, isHeic: false, isPdf: false, sizeKb },
        ]);
      }
    });
  };

  const removeAiFile = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAiFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const clearAllAiFiles = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAiFiles([]);
    setExtractionProgress(null);
  };

  const handleRunAiExtraction = async () => {
    if (aiFiles.length === 0) {
      setExtractError("Please upload at least one image or PDF document first.");
      return;
    }

    setExtracting(true);
    setExtractError(null);
    setExtractSummary(null);
    setExtractionProgress({
      current: 1,
      total: aiFiles.length,
      fileName: `Preparing ${aiFiles.length} file${aiFiles.length > 1 ? "s" : ""}...`,
      percent: 10,
    });

    try {
      const filePayloads: Array<{ fileBase64: string; mimeType: string; fileName: string }> = [];

      for (let i = 0; i < aiFiles.length; i++) {
        const item = aiFiles[i];
        setExtractionProgress({
          current: i + 1,
          total: aiFiles.length,
          fileName: `Reading ${item.file.name}...`,
          percent: Math.round(10 + ((i + 1) / aiFiles.length) * 35),
        });

        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(item.file);
        });

        filePayloads.push({
          fileBase64: base64,
          mimeType: item.mimeType,
          fileName: item.file.name,
        });
      }

      setExtractionProgress({
        current: aiFiles.length,
        total: aiFiles.length,
        fileName: `Gemini AI extracting tables from ${aiFiles.length} file${aiFiles.length > 1 ? "s" : ""}...`,
        percent: 65,
      });

      const res = await apiRequest<{
        success: boolean;
        items: any[];
        totalExtracted: number;
        summary: string;
        message?: string;
      }>("/api/inventory/extract-table", {
        method: "POST",
        body: JSON.stringify({
          files: filePayloads,
          instruction: aiInstruction,
          category: aiSelectedCategory,
          apiKey: geminiApiKey || undefined,
        }),
      });

      if (!res.success || !Array.isArray(res.items)) {
        throw new Error(res.message || "Failed to extract items");
      }

      const newRows: StagingRow[] = res.items.map((it: any, idx: number) => {
        const hasAvail =
          it.quantityAvailable !== undefined &&
          it.quantityAvailable !== null &&
          String(it.quantityAvailable).trim() !== "" &&
          !isNaN(Number(it.quantityAvailable));
        const hasIssued =
          it.quantityIssued !== undefined &&
          it.quantityIssued !== null &&
          String(it.quantityIssued).trim() !== "" &&
          !isNaN(Number(it.quantityIssued));
        const qAvail = hasAvail ? Number(it.quantityAvailable) : null;
        const qIssued = hasIssued ? Number(it.quantityIssued) : null;
        let bal: number | null = null;
        if (
          it.balance !== undefined &&
          it.balance !== null &&
          String(it.balance).trim() !== "" &&
          !isNaN(Number(it.balance))
        ) {
          bal = Number(it.balance);
        } else if (qAvail !== null && qIssued !== null) {
          bal = qAvail - qIssued;
        } else if (qAvail !== null) {
          bal = qAvail;
        } else if (qIssued !== null) {
          bal = -qIssued;
        }

        return {
          id: `extracted-${Date.now()}-${idx}`,
          itemSupply: it.itemSupply || "",
          category: it.category || aiSelectedCategory || (dynamicSupplyCategories[0] || ""),
          unit: it.unit || "",
          quantityAvailable: qAvail,
          quantityIssued: qIssued,
          balance: bal,
          dateIssued: it.dateIssued || new Date().toISOString().split("T")[0],
          feedback: it.feedback || "",
          sourceFile: aiFiles.length > 1 ? `Batch (${aiFiles.length} files)` : aiFiles[0]?.file.name,
          selected: true,
        };
      });

      setExtractionProgress({
        current: aiFiles.length,
        total: aiFiles.length,
        fileName: "Complete!",
        percent: 100,
      });

      setStagingRows((prev) => [...prev, ...newRows]);
      const summaryMsg = res.summary || `Extracted ${newRows.length} items across ${aiFiles.length} file${aiFiles.length > 1 ? "s" : ""}.`;
      setExtractSummary(summaryMsg);
      setSuccess(`✨ AI extracted ${newRows.length} items across ${aiFiles.length} file${aiFiles.length > 1 ? "s" : ""}! Review below before saving.`);
    } catch (err: any) {
      setExtractError(err.message || "Error running AI extraction");
    } finally {
      setExtracting(false);
      setTimeout(() => setExtractionProgress(null), 1200);
    }
  };

  const handleParsePaste = () => {
    if (!pasteInput.trim()) {
      setExtractError("Please paste table text first.");
      return;
    }
    const lines = pasteInput
      .trim()
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0);
    const parsedRows: StagingRow[] = [];

    lines.forEach((line, idx) => {
      const cols = line.includes("\t")
        ? line.split("\t").map((c) => c.trim().replace(/^"|"$/g, ""))
        : line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));

      if (cols.length === 0) return;
      const firstCol = cols[0].toLowerCase();
      if (
        firstCol.includes("s/n") ||
        firstCol.includes("item") ||
        firstCol.includes("#") ||
        firstCol.includes("supply")
      ) {
        if (idx === 0) return;
      }

      let itName = "";
      let qAvail = 0;
      let qIssued = 0;
      let bal = 0;
      let dIssued = new Date().toISOString().split("T")[0];
      let fb = "";

      if (cols.length >= 6 && !isNaN(Number(cols[0])) && isNaN(Number(cols[1]))) {
        itName = cols[1];
        qAvail = Number(cols[2]) || 0;
        qIssued = Number(cols[3]) || 0;
        bal = cols[4] ? Number(cols[4]) || qAvail - qIssued : qAvail - qIssued;
        dIssued = cols[5] || dIssued;
        fb = cols[6] || "";
      } else {
        itName = cols[0];
        qAvail = Number(cols[1]) || 0;
        qIssued = Number(cols[2]) || 0;
        bal = cols[3] ? Number(cols[3]) || qAvail - qIssued : qAvail - qIssued;
        dIssued = cols[4] || dIssued;
        fb = cols[5] || "";
      }

      if (itName) {
        parsedRows.push({
          id: `paste-${Date.now()}-${idx}`,
          itemSupply: itName,
          category: selectedSupplyCategory !== "all" ? selectedSupplyCategory : (dynamicSupplyCategories[0] || ""),
          quantityAvailable: qAvail,
          quantityIssued: qIssued,
          balance: bal,
          dateIssued: dIssued,
          feedback: fb,
          selected: true,
        });
      }
    });

    if (parsedRows.length === 0) {
      setExtractError("Could not detect tabular rows. Format should be tab or comma separated.");
    } else {
      setStagingRows((prev) => [...prev, ...parsedRows]);
      setExtractSummary(`Parsed ${parsedRows.length} rows from text.`);
      setExtractError(null);
      setPasteInput("");
      setSuccess(`Added ${parsedRows.length} rows to review staging table.`);
    }
  };

  const handleSaveStagingToMongoDB = async () => {
    const selected = stagingRows.filter((r) => r.selected && r.itemSupply.trim().length > 0);
    if (selected.length === 0) {
      setExtractError("Please select at least one row with a valid item supply name.");
      return;
    }

    setSavingBulk(true);
    setExtractError(null);
    try {
      const payload = selected.map((r) => {
        const hasAvail = r.quantityAvailable !== undefined && r.quantityAvailable !== null && String(r.quantityAvailable).trim() !== "" && !isNaN(Number(r.quantityAvailable));
        const qAvail = hasAvail ? Number(r.quantityAvailable) : null;

        const hasIssued = r.quantityIssued !== undefined && r.quantityIssued !== null && String(r.quantityIssued).trim() !== "" && !isNaN(Number(r.quantityIssued));
        const qIssued = hasIssued ? Number(r.quantityIssued) : null;

        let computedBal: number | null = null;
        if (r.balance !== undefined && r.balance !== null && String(r.balance).trim() !== "" && !isNaN(Number(r.balance))) {
          computedBal = Number(r.balance);
        } else if (hasAvail && hasIssued) {
          computedBal = qAvail! - qIssued!;
        } else if (hasAvail) {
          computedBal = qAvail!;
        } else if (hasIssued) {
          computedBal = -qIssued!;
        }

        return {
          itemSupply: r.itemSupply.trim(),
          category: r.category ? r.category.trim() : (dynamicSupplyCategories[0] || ""),
          unit: r.unit ? r.unit.trim() : "",
          quantityAvailable: qAvail,
          quantityIssued: qIssued,
          balance: computedBal,
          dateIssued: r.dateIssued || new Date().toISOString().split("T")[0],
          feedback: r.feedback ? r.feedback.trim() : "",
        };
      });

      const res = await apiRequest<{ message: string; documents: any[] }>("/api/inventory/supplies/bulk", {
        method: "POST",
        body: JSON.stringify({ records: payload }),
      });

      const count = res.documents?.length || payload.length;
      setSuccess(`🎉 Successfully saved ${count} records directly to MongoDB!`);
      setShowAiModal(false);
      setStagingRows([]);
      setAiFiles([]);
      await fetchSupplies();
    } catch (err: any) {
      setExtractError(err.message || "Failed to save records in bulk to MongoDB");
    } finally {
      setSavingBulk(false);
    }
  };

  const updateStagingCell = (id: string, field: keyof StagingRow, val: any) => {
    setStagingRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: val };
        if (field === "quantityAvailable" || field === "quantityIssued") {
          const aRaw = field === "quantityAvailable" ? val : row.quantityAvailable;
          const iRaw = field === "quantityIssued" ? val : row.quantityIssued;
          const a = aRaw !== undefined && aRaw !== null && String(aRaw).trim() !== "" ? Number(aRaw) : null;
          const i = iRaw !== undefined && iRaw !== null && String(iRaw).trim() !== "" ? Number(iRaw) : null;
          if (a !== null && i !== null) updated.balance = a - i;
          else if (a !== null) updated.balance = a;
          else if (i !== null) updated.balance = -i;
          else updated.balance = null;
        }
        return updated;
      })
    );
  };

  const clientBundle = useMemo(() => {
    try { return getClients(); }
    catch (e: any) { setError(e.message); return null; }
  }, []);

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(null), 4000); return () => clearTimeout(t); }
  }, [success]);
  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(null), 6000); return () => clearTimeout(t); }
  }, [error]);

  // ─── Fetch Catalog Items ────────────────────────────────────────────────────
  const fetchItems = async () => {
    if (!clientBundle) return;
    setLoading(true);
    try {
      const res = await clientBundle.databases.listDocuments<InventoryItem & Models.Document>(
        clientBundle.databaseId, clientBundle.COLLECTIONS[COLLECTION_KEY],
        [Query.orderDesc("$createdAt")]
      );
      setItems(res.documents);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  // ─── Fetch Supply Records (MongoDB) ─────────────────────────────────────────
  const fetchSupplies = async () => {
    setLoadingSupplies(true);
    try {
      const queryParams = new URLSearchParams();
      if (supplySearch.trim()) queryParams.set("search", supplySearch.trim());
      if (selectedSupplyCategory && selectedSupplyCategory !== "all") queryParams.set("category", selectedSupplyCategory);
      if (selectedSupplyMonth && selectedSupplyMonth !== "all") queryParams.set("month", selectedSupplyMonth);
      if (supplyDateFilter) queryParams.set("date", supplyDateFilter);

      const url = `/api/inventory/supplies${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const res = await apiRequest(url);
      const list = Array.isArray(res?.documents) ? res.documents : Array.isArray(res) ? res : [];
      setSupplies(list);
    } catch (err: any) {
      console.error("Failed to fetch supplies:", err);
      setError("Failed to load supply records: " + err.message);
    } finally {
      setLoadingSupplies(false);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchSupplies();
    fetchCategories();
  }, [clientBundle]);

  // Refetch supplies when search or date filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSupplies();
    }, 300);
    return () => clearTimeout(timer);
  }, [supplySearch, supplyDateFilter, selectedSupplyCategory, selectedSupplyMonth]);

  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))];

  // Dynamic Supply Categories from MongoDB (Only categories created by user)
  const dynamicSupplyCategories = useMemo(() => {
    return Array.from(new Set(categoriesList.map((c) => c.name.trim()).filter(Boolean)));
  }, [categoriesList]);

  // Keep active category synced if new categories are added or selected
  useEffect(() => {
    if (dynamicSupplyCategories.length > 0) {
      if (!newSupplyRow.category || !dynamicSupplyCategories.includes(newSupplyRow.category)) {
        setNewSupplyRow((prev) => ({
          ...prev,
          category: selectedSupplyCategory !== "all" && dynamicSupplyCategories.includes(selectedSupplyCategory)
            ? selectedSupplyCategory
            : dynamicSupplyCategories[0],
        }));
      }
      if (!aiSelectedCategory || !dynamicSupplyCategories.includes(aiSelectedCategory)) {
        setAiSelectedCategory(
          selectedSupplyCategory !== "all" && dynamicSupplyCategories.includes(selectedSupplyCategory)
            ? selectedSupplyCategory
            : dynamicSupplyCategories[0]
        );
      }
    }
  }, [dynamicSupplyCategories, selectedSupplyCategory]);

  const getStatus = (item: InventoryItem): string => {
    if (item.status === "discontinued") return "discontinued";
    if (item.quantity === 0) return "out_of_stock";
    if (item.minQuantity && item.quantity <= item.minQuantity) return "low_stock";
    return "in_stock";
  };

  const filtered = items.filter((i) => {
    const matchCat = catFilter === "all" || i.category === catFilter;
    const matchStat = statusFilter === "all" || getStatus(i) === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || [i.name, i.sku, i.category, i.supplier, i.location, i.description].join(" ").toLowerCase().includes(q);
    return matchCat && matchStat && matchSearch;
  });

  const totalValue = items.reduce((s, i) => s + (i.totalValue || i.quantity * (i.unitPrice || 0)), 0);
  const lowStockCount = items.filter((i) => getStatus(i) === "low_stock").length;
  const outOfStockCount = items.filter((i) => getStatus(i) === "out_of_stock").length;

  // ─── Supply Register Calculations ───────────────────────────────────────────
  const totalQuantityAvailable = supplies.reduce((s, r) => s + (!r.isSectionHeader && r.quantityAvailable !== null && r.quantityAvailable !== undefined ? Number(r.quantityAvailable) : 0), 0);
  const totalQuantityIssued = supplies.reduce((s, r) => s + (!r.isSectionHeader && r.quantityIssued !== null && r.quantityIssued !== undefined ? Number(r.quantityIssued) : 0), 0);
  const totalBalance = supplies.reduce((s, r) => s + (!r.isSectionHeader && r.balance !== null && r.balance !== undefined ? Number(r.balance) : 0), 0);

  // Auto-calculated balance for new inline input row (never forces 0 when empty)
  const computedNewRowBalance = useMemo(() => {
    const aStr = String(newSupplyRow.quantityAvailable || "").trim();
    const iStr = String(newSupplyRow.quantityIssued || "").trim();
    if (aStr === "" && iStr === "") return "—";
    const a = aStr !== "" ? Number(aStr) : 0;
    const i = iStr !== "" ? Number(iStr) : 0;
    return a - i;
  }, [newSupplyRow.quantityAvailable, newSupplyRow.quantityIssued]);

  // ─── Supply CRUD Handlers (Connected to MongoDB) ───────────────────────────
  const handleAddNewSupplyRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplyRow.itemSupply.trim()) {
      setError("Please enter the Item Supply name.");
      return;
    }

    setSavingSupply(true);
    try {
      const aStr = String(newSupplyRow.quantityAvailable || "").trim();
      const iStr = String(newSupplyRow.quantityIssued || "").trim();
      const qAvail = aStr !== "" && !isNaN(Number(aStr)) ? Number(aStr) : null;
      const qIssued = iStr !== "" && !isNaN(Number(iStr)) ? Number(iStr) : null;

      let bal: number | null = null;
      if (qAvail !== null && qIssued !== null) bal = qAvail - qIssued;
      else if (qAvail !== null) bal = qAvail;
      else if (qIssued !== null) bal = -qIssued;

      const payload = {
        itemSupply: newSupplyRow.itemSupply.trim(),
        category: newSupplyRow.category || (selectedSupplyCategory !== "all" ? selectedSupplyCategory : (dynamicSupplyCategories[0] || "")),
        unit: (newSupplyRow.unit || "").trim(),
        customField: (newSupplyRow.customField || "").trim(),
        quantityAvailable: qAvail,
        quantityIssued: qIssued,
        balance: bal,
        dateIssued: newSupplyRow.dateIssued || todayDateStr,
        feedback: newSupplyRow.feedback.trim(),
      };

      await apiRequest("/api/inventory/supplies", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccess(`Supply entry "${payload.itemSupply}" saved to MongoDB successfully!`);
      setNewSupplyRow({
        itemSupply: "",
        category: selectedSupplyCategory !== "all" ? selectedSupplyCategory : (dynamicSupplyCategories[0] || ""),
        unit: "",
        customField: "",
        quantityAvailable: "",
        quantityIssued: "",
        dateIssued: todayDateStr,
        feedback: "",
      });

      await fetchSupplies();
    } catch (err: any) {
      setError("Failed to save supply entry: " + err.message);
    } finally {
      setSavingSupply(false);
    }
  };

  // Section Header & Spacer Divider Insert Handler
  const handleAddSectionDivider = async (titleParam?: string) => {
    const title = (titleParam !== undefined ? titleParam : newSectionTitle).trim();
    setSavingSection(true);
    try {
      const isBlank = !title;
      const payload = {
        itemSupply: isBlank ? "Spacer" : title,
        sectionTitle: title,
        isSectionHeader: true,
        category: selectedSupplyCategory !== "all" ? selectedSupplyCategory : (dynamicSupplyCategories[0] || ""),
        dateIssued: todayDateStr,
        feedback: isBlank ? "Section Spacer" : `Section: ${title}`,
      };

      await apiRequest("/api/inventory/supplies", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccess(isBlank ? "Section spacer inserted into table!" : `Section header "${title}" added to table!`);
      setNewSectionTitle("");
      setShowSectionModal(false);
      await fetchSupplies();
    } catch (err: any) {
      setError("Failed to insert section: " + err.message);
    } finally {
      setSavingSection(false);
    }
  };

  const handleStartEditSupply = (s: ItemSupply) => {
    setEditingSupplyId(s._id || s.$id || "");
    setEditSupplyData({
      itemSupply: s.itemSupply,
      quantityAvailable: s.quantityAvailable,
      quantityIssued: s.quantityIssued,
      balance: s.balance,
      dateIssued: s.dateIssued,
      category: s.category || "General",
      unit: s.unit || "",
      customField: s.customField || "",
      feedback: s.feedback || "",
      isSectionHeader: s.isSectionHeader,
      sectionTitle: s.sectionTitle,
    });
  };

  const handleSaveInlineEdit = async (id: string) => {
    setSavingInlineEdit(true);
    try {
      const isHeader = Boolean(editSupplyData.isSectionHeader);
      const aVal = editSupplyData.quantityAvailable;
      const iVal = editSupplyData.quantityIssued;
      const qAvail = aVal !== undefined && aVal !== null && String(aVal).trim() !== "" && !isNaN(Number(aVal)) ? Number(aVal) : null;
      const qIssued = iVal !== undefined && iVal !== null && String(iVal).trim() !== "" && !isNaN(Number(iVal)) ? Number(iVal) : null;

      let bal: number | null = null;
      if (qAvail !== null && qIssued !== null) bal = qAvail - qIssued;
      else if (qAvail !== null) bal = qAvail;
      else if (qIssued !== null) bal = -qIssued;

      const payload = {
        itemSupply: (editSupplyData.itemSupply || (editSupplyData.sectionTitle ? editSupplyData.sectionTitle : "Spacer")).trim(),
        category: editSupplyData.category || (dynamicSupplyCategories[0] || ""),
        unit: (editSupplyData.unit || "").trim(),
        customField: (editSupplyData.customField || "").trim(),
        quantityAvailable: isHeader ? null : qAvail,
        quantityIssued: isHeader ? null : qIssued,
        balance: isHeader ? null : bal,
        dateIssued: editSupplyData.dateIssued || todayDateStr,
        feedback: (editSupplyData.feedback || "").trim(),
        isSectionHeader: isHeader,
        sectionTitle: (editSupplyData.sectionTitle || editSupplyData.itemSupply || "").trim(),
      };

      await apiRequest(`/api/inventory/supplies/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      setSuccess("Record updated successfully in MongoDB!");
      setEditingSupplyId(null);
      setEditSupplyData({});
      await fetchSupplies();
    } catch (err: any) {
      setError("Update failed: " + err.message);
    } finally {
      setSavingInlineEdit(false);
    }
  };

  const handleDeleteSupply = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}" from supply records?`)) return;
    setDeletingSupplyId(id);
    try {
      await apiRequest(`/api/inventory/supplies/${id}`, {
        method: "DELETE",
      });
      setSuccess("Record removed from MongoDB.");
      await fetchSupplies();
    } catch (err: any) {
      setError("Delete failed: " + err.message);
    } finally {
      setDeletingSupplyId(null);
    }
  };

  // ─── PDF Export for Supply Register (Matching DATE.docx) ───────────────────
  const downloadSuppliesPDF = async () => {
    setDownloadingPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const docRef = `360-SUPP-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`;

      const catLabel = selectedSupplyCategory === "all" ? "All Categories" : selectedSupplyCategory;
      const monthObj = availableSupplyMonths.find(m => m.value === selectedSupplyMonth);
      const monthLabel = monthObj ? monthObj.label : selectedSupplyMonth;

      const startY = await drawLetterhead(doc, {
        title: `SUPPLY & ISSUANCE REGISTER — ${catLabel.toUpperCase()}`,
        subtitle: `Category: ${catLabel} • Period: ${monthLabel} • Stored in MongoDB (DATE.docx format)`,
        docRef,
        badge: `${catLabel.toUpperCase()} • ${selectedSupplyMonth.toUpperCase()}`,
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const cardY = startY;
      const cardHeight = 11;
      const cardSpacing = 4;
      const margin = 14;
      const availableWidth = pageWidth - margin * 2;
      const cardWidth = (availableWidth - cardSpacing * 3) / 4;

      const metrics = [
        { label: "TOTAL ENTRIES", val: `${supplies.filter(s => !s.isSectionHeader).length} Items`, color: [30, 41, 59] },
        { label: "QUANTITY AVAILABLE", val: `${totalQuantityAvailable.toLocaleString()} Units`, color: [59, 130, 246] },
        { label: "QUANTITY ISSUED", val: `${totalQuantityIssued.toLocaleString()} Units`, color: [245, 158, 11] },
        { label: "REMAINING BALANCE", val: `${totalBalance.toLocaleString()} Units`, color: [16, 185, 129] },
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
        doc.setFontSize(8);
        doc.setTextColor(m.color[0], m.color[1], m.color[2]);
        doc.text(m.val, cx + 3, cardY + 9);
      });

      // Exactly matches the Word Document table columns from image:
      // S/N | ITEM SUPPLY | CATEGORY | UNIT | QUANTITY AVAILABLE | QUANTITY ISSUED | BALANCE | DATE ISSUED | FEEDBACK
      (autoTable as any)(doc, {
        startY: cardY + cardHeight + 4,
        margin: { left: 14, right: 14 },
        head: [["S/N", "ITEM SUPPLY", "CATEGORY", "UNIT", "QUANTITY AVAILABLE", "QUANTITY ISSUED", "BALANCE", "DATE ISSUED", "FEEDBACK"]],
        body: supplies.map((s, i) => {
          if (s.isSectionHeader) {
            const title = s.sectionTitle || s.itemSupply || "SECTION SPACER";
            return [
              {
                content: `──  ${title.toUpperCase()}  ──`,
                colSpan: 9,
                styles: {
                  halign: "center",
                  fillColor: [254, 242, 242],
                  textColor: [185, 28, 28],
                  fontStyle: "bold",
                  fontSize: 8.5,
                },
              },
            ];
          }

          return [
            i + 1,
            s.itemSupply,
            s.category || "General",
            s.unit || "—",
            s.quantityAvailable !== null && s.quantityAvailable !== undefined ? s.quantityAvailable : "—",
            s.quantityIssued !== null && s.quantityIssued !== undefined ? s.quantityIssued : "—",
            s.balance !== null && s.balance !== undefined ? s.balance : "—",
            s.dateIssued || "—",
            s.feedback || "—",
          ];
        }),
        styles: { fontSize: 8, cellPadding: 2.5, valign: "middle" },
        headStyles: {
          fillColor: [185, 28, 28], // Red header matching photo
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { cellWidth: 10, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 50, fontStyle: "bold" },
          2: { cellWidth: 24, halign: "center" },
          3: { cellWidth: 18, halign: "center" },
          4: { cellWidth: 28, halign: "center" },
          5: { cellWidth: 28, halign: "center", textColor: [180, 83, 9] },
          6: { cellWidth: 24, halign: "center", fontStyle: "bold", textColor: [5, 150, 105] },
          7: { cellWidth: 26, halign: "center" },
          8: { halign: "left" },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: "grid",
        tableLineColor: [203, 213, 225],
        tableLineWidth: 0.2,
      });

      stampDocumentFooter(doc);
      const safeCat = (selectedSupplyCategory === "all" ? "All_Categories" : selectedSupplyCategory).replace(/\s+/g, "_");
      doc.save(`360_Supply_${safeCat}_${selectedSupplyMonth}_${new Date().toISOString().split("T")[0]}.pdf`);
      setSuccess("Official Supply Register PDF generated and downloaded!");
    } catch (err: any) {
      setError("PDF Export failed: " + err.message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  // CSV Export for Supply Register
  const downloadSuppliesCSV = () => {
    setDownloadingCsv(true);
    try {
      const headers = ["S/N", "ITEM SUPPLY", "CATEGORY", "UNIT", "QUANTITY AVAILABLE", "QUANTITY ISSUED", "BALANCE", "DATE ISSUED", "FEEDBACK"];
      const rows = supplies.map((s, i) => {
        if (s.isSectionHeader) {
          const title = s.sectionTitle || s.itemSupply || "SECTION SPACER";
          return [i + 1, `"[SECTION: ${title.replace(/"/g, '""')}]"`, `"${(s.category || "").replace(/"/g, '""')}"`, "", "", "", "", "", ""];
        }
        return [
          i + 1,
          `"${(s.itemSupply || "").replace(/"/g, '""')}"`,
          `"${(s.category || "General").replace(/"/g, '""')}"`,
          `"${(s.unit || "").replace(/"/g, '""')}"`,
          s.quantityAvailable !== null && s.quantityAvailable !== undefined ? s.quantityAvailable : "",
          s.quantityIssued !== null && s.quantityIssued !== undefined ? s.quantityIssued : "",
          s.balance !== null && s.balance !== undefined ? s.balance : "",
          `"${s.dateIssued || ""}"`,
          `"${(s.feedback || "").replace(/"/g, '""')}"`,
        ];
      });

      const csv = "data:text/csv;charset=utf-8," + encodeURIComponent([headers.join(","), ...rows.map(r => r.join(","))].join("\n"));
      const a = document.createElement("a");
      a.href = csv;
      const safeCat = (selectedSupplyCategory === "all" ? "All_Categories" : selectedSupplyCategory).replace(/\s+/g, "_");
      a.download = `360_Supply_${safeCat}_${selectedSupplyMonth}_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setSuccess("Supply CSV downloaded!");
    } finally {
      setDownloadingCsv(false);
    }
  };

  // ─── Standard Inventory Handlers ───────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientBundle) return;
    setSavingForm(true);
    try {
      let imageUrl = form.imageUrl || "";
      if (imgFile) imageUrl = await uploadToCloudinary(imgFile, "inventory");
      const data: any = {
        ...form,
        imageUrl,
        quantity: Number(form.quantity) || 0,
        minQuantity: Number(form.minQuantity) || 5,
        unitPrice: Number(form.unitPrice) || 0,
        totalValue: (Number(form.quantity) || 0) * (Number(form.unitPrice) || 0),
      };
      const { databases, databaseId, COLLECTIONS } = clientBundle;
      if (editingId) {
        await databases.updateDocument(databaseId, COLLECTIONS[COLLECTION_KEY], editingId, data);
        setSuccess("Item updated!");
      } else {
        await databases.createDocument(databaseId, COLLECTIONS[COLLECTION_KEY], ID.unique(), data);
        setSuccess("Item added to inventory!");
      }
      setShowForm(false); setEditingId(null);
      setForm({ quantity: 0, minQuantity: 5, unitPrice: 0 }); setImgFile(null);
      await fetchItems();
    } catch (err: any) { setError(err.message); }
    finally { setSavingForm(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this item from inventory?")) return;
    if (!clientBundle) return;
    setDeletingId(id);
    try {
      const { databases, databaseId, COLLECTIONS } = clientBundle;
      await databases.deleteDocument(databaseId, COLLECTIONS[COLLECTION_KEY], id);
      await fetchItems(); setSuccess("Item removed.");
    } catch (err: any) { setError(err.message); }
    finally { setDeletingId(null); }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingId(item.$id); setForm(item);
    setImgFile(null); setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleStockMovement = async () => {
    if (!movItem || !clientBundle) return;
    if (!mov.reason) { setError("Please provide a reason for the stock movement."); return; }
    setSavingMov(true);
    try {
      let newQty = movItem.quantity;
      if (mov.type === "in") newQty += Number(mov.quantity);
      else if (mov.type === "out") newQty = Math.max(0, newQty - Number(mov.quantity));
      else newQty = Number(mov.quantity);

      const { databases, databaseId, COLLECTIONS } = clientBundle;
      await databases.updateDocument(databaseId, COLLECTIONS[COLLECTION_KEY], movItem.$id, {
        quantity: newQty,
        totalValue: newQty * (movItem.unitPrice || 0),
        lastRestockedAt: mov.type === "in" ? new Date().toISOString() : movItem.lastRestockedAt,
      });
      setSuccess(`Stock ${mov.type === "in" ? "added" : mov.type === "out" ? "removed" : "adjusted"}: ${mov.quantity} ${movItem.unit || "units"}`);
      setMovItem(null); setMov({ type: "in", quantity: 1, reason: "" });
      await fetchItems();
    } catch (err: any) { setError(err.message); }
    finally { setSavingMov(false); }
  };

  const downloadInventoryPDF = async () => {
    setDownloadingPdf(true);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const docRef = `360-INV-${new Date().toISOString().slice(0, 7).replace("-", "")}`;
      const startY = await drawLetterhead(doc, {
        title: "Inventory Stock Level & Asset Valuation Report",
        subtitle: "Confidential Internal Audit · 360 Degree Global Estate Ltd.",
        docRef,
        badge: "INVENTORY AUDIT",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const cardY = startY;
      const cardHeight = 11;
      const cardSpacing = 4;
      const margin = 14;
      const availableWidth = pageWidth - margin * 2;
      const cardWidth = (availableWidth - cardSpacing * 3) / 4;

      const metrics = [
        { label: "TOTAL ITEMS", val: `${items.length} SKUs`, color: [30, 41, 59] },
        { label: "TOTAL ASSET VALUE", val: `₦${totalValue.toLocaleString()}`, color: [16, 185, 129] },
        { label: "LOW STOCK ITEMS", val: `${lowStockCount}`, color: [245, 158, 11] },
        { label: "OUT OF STOCK", val: `${outOfStockCount}`, color: [220, 38, 38] },
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
        doc.setFontSize(8);
        doc.setTextColor(m.color[0], m.color[1], m.color[2]);
        doc.text(m.val, cx + 3, cardY + 9);
      });

      (autoTable as any)(doc, {
        startY: cardY + cardHeight + 4,
        margin: { left: 14, right: 14 },
        head: [["#", "Item Name", "SKU", "Category", "Qty", "Unit", "Min Qty", "Unit Price (₦)", "Total Value (₦)", "Supplier", "Location", "Status"]],
        body: filtered.map((item, i) => [
          i + 1,
          item.name,
          item.sku || "—",
          item.category,
          item.quantity,
          item.unit || "unit",
          item.minQuantity || "—",
          (item.unitPrice || 0).toLocaleString(),
          (item.totalValue || item.quantity * (item.unitPrice || 0)).toLocaleString(),
          item.supplier || "—",
          item.location || "—",
          getStatus(item).replace("_", " ").toUpperCase(),
        ]),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [26, 54, 93], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: "grid",
      });

      stampDocumentFooter(doc);
      doc.save(`360_Inventory_Audit_${new Date().toISOString().split("T")[0]}.pdf`);
      setSuccess("Official PDF audit generated and downloaded!");
    } catch (err: any) {
      setError("PDF Export failed: " + err.message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const downloadInventoryCSV = () => {
    setDownloadingCsv(true);
    try {
      const itSign = `IT Department Verified · 360 Degree Global Estate Ltd. · Generated: ${new Date().toLocaleString("en-NG")}
`;
      const headers = [
        "Item Name", "SKU", "Category", "Quantity", "Unit", "Min Quantity",
        "Unit Price (NGN)", "Total Value (NGN)", "Supplier", "Location", "Status",
      ];
      const rows = filtered.map((item) => [
        `"${item.name.replace(/"/g, '""')}"`,
        `"${(item.sku || "").replace(/"/g, '""')}"`,
        `"${item.category.replace(/"/g, '""')}"`,
        item.quantity,
        `"${item.unit || "unit"}"`,
        item.minQuantity || "",
        item.unitPrice || 0,
        item.totalValue || (item.quantity * (item.unitPrice || 0)),
        `"${(item.supplier || "").replace(/"/g, '""')}"`,
        `"${(item.location || "").replace(/"/g, '""')}"`,
        `"${getStatus(item).toUpperCase()}"`,
      ]);
      const csv = "data:text/csv;charset=utf-8," + encodeURIComponent([itSign, headers.join(","), ...rows.map((r) => r.join(","))].join("\n"));
      const a = document.createElement("a");
      a.href = csv;
      a.download = `360_Inventory_Report_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setSuccess("Inventory CSV downloaded with IT Department signature.");
    } finally {
      setDownloadingCsv(false);
    }
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes invSpin { to { transform: rotate(360deg); } }
        @keyframes invSlide { from { opacity:0;transform:translateY(10px); } to { opacity:1;transform:translateY(0); } }
        .inv-card { animation: invSlide 0.2s ease; }
        .inv-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:18px; }
        .inv-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
        .inv-stat-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
        .inv-filters { display:flex; gap:12px; flex-wrap:wrap; align-items:center; }
        .table-input-cell { padding: 6px 8px; border-radius: 6px; border: 1px solid #CBD5E1; font-size: 13px; width: 100%; box-sizing: border-box; }
        .table-input-cell:focus { outline: none; border-color: #3B82F6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
        .supply-table { width: 100%; border-collapse: collapse; text-align: left; }
        .supply-table th { padding: 12px 10px; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #E2E8F0; }
        .supply-table td { padding: 10px 10px; border-bottom: 1px solid #F1F5F9; font-size: 13px; vertical-align: middle; }
        .supply-table tr:hover { background-color: #F8FAFC; }
        @media(max-width:768px){
          .inv-grid { grid-template-columns:1fr !important; }
          .inv-form-grid { grid-template-columns:1fr !important; }
          .inv-stat-grid { grid-template-columns:1fr 1fr !important; }
          .inv-filters { flex-direction:column; align-items:stretch; }
        }
        @media(max-width:480px){ .inv-stat-grid { grid-template-columns:1fr !important; } }
      `}</style>

      {/* Datalist for autocomplete suggestion from existing catalog */}
      <datalist id="inventory-catalog-suggestions">
        {items.map((it) => (
          <option key={it.$id} value={it.name} />
        ))}
      </datalist>

      <div style={{ display: "grid", gap: 20 }}>

        {/* ── Page Header & Primary Tabs ──────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14 }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 24, fontWeight: 900, color: "#0F172A" }}>
              Inventory & Material Supply Center
            </h2>
            <p style={{ margin: 0, color: "#64748B", fontSize: 13, fontWeight: 500 }}>
              Real-time stock ledger, material dispatches, and asset audit synchronized with MongoDB
            </p>
          </div>

          {/* Tab Selector */}
          <div style={{ display: "flex", background: "#E2E8F0", padding: 4, borderRadius: 12, gap: 4 }}>
            <button
              onClick={() => setActiveTab("supplies")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 16px",
                borderRadius: 9,
                border: "none",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.2s",
                background: activeTab === "supplies" ? "#FFFFFF" : "transparent",
                color: activeTab === "supplies" ? "#B91C1C" : "#475569",
                boxShadow: activeTab === "supplies" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
              }}
            >
              <FileSpreadsheet size={16} color={activeTab === "supplies" ? "#B91C1C" : "#64748B"} />
              Supply & Issuance Log
              <span style={{
                background: activeTab === "supplies" ? "#FEE2E2" : "#CBD5E1",
                color: activeTab === "supplies" ? "#991B1B" : "#475569",
                fontSize: 11,
                padding: "1px 6px",
                borderRadius: 99,
                fontWeight: 800,
              }}>
                {supplies.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("catalog")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 16px",
                borderRadius: 9,
                border: "none",
                fontWeight: 800,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.2s",
                background: activeTab === "catalog" ? "#FFFFFF" : "transparent",
                color: activeTab === "catalog" ? "#1E3A8A" : "#475569",
                boxShadow: activeTab === "catalog" ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
              }}
            >
              <Layers size={16} color={activeTab === "catalog" ? "#1E3A8A" : "#64748B"} />
              Stock Catalog
              <span style={{
                background: activeTab === "catalog" ? "#DBEAFE" : "#CBD5E1",
                color: activeTab === "catalog" ? "#1E40AF" : "#475569",
                fontSize: 11,
                padding: "1px 6px",
                borderRadius: 99,
                fontWeight: 800,
              }}>
                {items.length}
              </span>
            </button>
          </div>
        </div>

        {/* ── Alerts ─────────────────────────────────────────────────────── */}
        {error && (
          <div style={{ color: "#991B1B", background: "#FEF2F2", border: "1px solid #FECACA", padding: "12px 16px", borderRadius: 10, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}
        {success && (
          <div style={{ color: "#065F46", background: "#D1FAE5", border: "1px solid #6EE7B7", padding: "12px 16px", borderRadius: 10, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: SUPPLY & ISSUANCE REGISTER (DATE.docx TABLE CRUD)            */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeTab === "supplies" && (
          <div style={{ display: "grid", gap: 18 }}>

            {/* Top Action Bar & Stat Cards */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#1E293B", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#B91C1C", display: "inline-block" }} />
                  Supply & Issuance Log Table (DATE.docx)
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>
                  Record materials issued, compute balances in real-time, and store directly in MongoDB
                </p>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                                <button
                  type="button"
                  onClick={() => setShowAiModal(true)}
                  style={{
                    ...btn,
                    background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                    color: "#FFFFFF",
                    fontSize: 12,
                    padding: "8px 16px",
                    boxShadow: "0 4px 14px rgba(99, 102, 241, 0.35)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    fontWeight: 800,
                  }}
                >
                  <Sparkles size={15} color="#FDE047" /> ✨ AI Extract & Bulk Import
                </button>
                <LoaderBtn loading={downloadingPdf} onClick={downloadSuppliesPDF} style={{ ...btn, background: "#B91C1C", fontSize: 12, padding: "8px 14px" }}>
                  <FileDown size={14} /> Export PDF (Official Table)
                </LoaderBtn>
                <LoaderBtn loading={downloadingCsv} onClick={downloadSuppliesCSV} style={{ ...btn, background: "#059669", fontSize: 12, padding: "8px 14px" }}>
                  <Download size={14} /> Export CSV
                </LoaderBtn>
                <button
                  type="button"
                  onClick={fetchSupplies}
                  disabled={loadingSupplies}
                  style={{ ...smallBtn, display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 12px" }}
                >
                  <RefreshCw size={13} className={loadingSupplies ? "animate-spin" : ""} /> Refresh
                </button>
              </div>
            </div>

            {/* Metric KPI Summary */}
            <div className="inv-stat-grid">
              <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", borderLeft: "4px solid #B91C1C" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Total Log Entries</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#1E293B", marginTop: 4 }}>{supplies.length} <span style={{ fontSize: 13, color: "#94A3B8", fontWeight: 600 }}>Records</span></div>
              </div>

              <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", borderLeft: "4px solid #3B82F6" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Quantity Available</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#2563EB", marginTop: 4 }}>{totalQuantityAvailable.toLocaleString()} <span style={{ fontSize: 13, color: "#94A3B8", fontWeight: 600 }}>Units</span></div>
              </div>

              <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", borderLeft: "4px solid #D97706" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Quantity Issued</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#D97706", marginTop: 4 }}>{totalQuantityIssued.toLocaleString()} <span style={{ fontSize: 13, color: "#94A3B8", fontWeight: 600 }}>Units</span></div>
              </div>

              <div style={{ background: "#FFFFFF", borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", borderLeft: "4px solid #059669" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Current Balance</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: totalBalance >= 0 ? "#059669" : "#DC2626", marginTop: 4 }}>
                  {totalBalance.toLocaleString()} <span style={{ fontSize: 13, color: "#94A3B8", fontWeight: 600 }}>Units</span>
                </div>
              </div>
            </div>

                        {/* ── Dynamic Category Filter Tabs ──────────────────────────────── */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", background: "#FFFFFF", padding: "10px 16px", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginRight: 4 }}>
                <Folder size={15} color="#B91C1C" />
                <span style={{ fontSize: 13, fontWeight: 800, color: "#1E293B" }}>Categories:</span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSupplyCategory("all")}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "none",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: selectedSupplyCategory === "all" ? "#B91C1C" : "#F1F5F9",
                  color: selectedSupplyCategory === "all" ? "#FFFFFF" : "#475569",
                  boxShadow: selectedSupplyCategory === "all" ? "0 2px 8px rgba(185, 28, 28, 0.3)" : "none",
                  transition: "all 0.15s",
                }}
              >
                All Categories
                <span
                  style={{
                    background: selectedSupplyCategory === "all" ? "rgba(255,255,255,0.25)" : "#CBD5E1",
                    color: selectedSupplyCategory === "all" ? "#FFFFFF" : "#475569",
                    fontSize: 11,
                    padding: "1px 6px",
                    borderRadius: 99,
                  }}
                >
                  {supplies.length}
                </span>
              </button>

              {dynamicSupplyCategories.length === 0 ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#64748B", padding: "6px 12px", background: "#F8FAFC", borderRadius: 20, border: "1px dashed #CBD5E1" }}>
                  <span>No custom categories yet.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryForm({ name: "", icon: "🏷️", description: "", color: "#B91C1C" });
                      setShowCategoryManager(true);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#B91C1C",
                      fontWeight: 800,
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    + Add Category
                  </button>
                </div>
              ) : (
                dynamicSupplyCategories.map((catName) => {
                  const count = supplies.filter((s) => (s.category || "").toLowerCase() === catName.toLowerCase()).length;
                  const isSelected = selectedSupplyCategory.toLowerCase() === catName.toLowerCase();
                  const catObj = categoriesList.find((c) => c.name.toLowerCase() === catName.toLowerCase());
                  const icon = catObj?.icon || (
                    catName.toLowerCase().includes("drink") ? "🍹" :
                    catName.toLowerCase().includes("kitchen") ? "🍳" :
                    catName.toLowerCase().includes("office") ? "📝" :
                    catName.toLowerCase().includes("clean") ? "🧹" :
                    catName.toLowerCase().includes("maint") ? "🔧" : "🏷️"
                  );
                  return (
                    <button
                      key={catName}
                      type="button"
                      onClick={() => {
                        setSelectedSupplyCategory(catName);
                        setNewSupplyRow((prev) => ({ ...prev, category: catName }));
                      }}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 20,
                        border: "none",
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        background: isSelected ? "#B91C1C" : "#F1F5F9",
                        color: isSelected ? "#FFFFFF" : "#475569",
                        boxShadow: isSelected ? "0 2px 8px rgba(185, 28, 28, 0.3)" : "none",
                        transition: "all 0.15s",
                      }}
                    >
                      <span>{icon}</span> {catName}
                      <span
                        style={{
                          background: isSelected ? "rgba(255,255,255,0.25)" : "#CBD5E1",
                          color: isSelected ? "#FFFFFF" : "#475569",
                          fontSize: 11,
                          padding: "1px 6px",
                          borderRadius: 99,
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })
              )}

              <button
                type="button"
                onClick={() => {
                  setCategoryForm({ name: "", icon: "🏷️", description: "", color: "#B91C1C" });
                  setShowCategoryManager(true);
                }}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "1px solid #E2E8F0",
                  background: "#EFF6FF",
                  color: "#1D4ED8",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  marginLeft: "auto",
                }}
              >
                <SlidersHorizontal size={13} color="#2563EB" /> Manage Categories
              </button>
            </div>

            {/* Filter & Live Search Toolbar */}
            <div style={{ background: "#FFFFFF", padding: "12px 16px", borderRadius: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div style={{ flex: 1, minWidth: 220, position: "relative" }}>
                <Search size={15} color="#94A3B8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input
                  type="text"
                  placeholder="Search by Item Supply name, receiver, or feedback notes..."
                  value={supplySearch}
                  onChange={(e) => setSupplySearch(e.target.value)}
                  style={{ ...inp, paddingLeft: 34, fontSize: 13, padding: "8px 12px 8px 34px" }}
                />
              </div>

                            {/* Month / Historical Period Archive Selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "flex", alignItems: "center", gap: 5 }}>
                  <CalendarDays size={15} color="#2563EB" /> Period:
                </span>
                <select
                  value={selectedSupplyMonth}
                  onChange={(e) => setSelectedSupplyMonth(e.target.value)}
                  style={{
                    ...inp,
                    width: 210,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "6px 10px",
                    background: selectedSupplyMonth === currentMonthStr ? "#EFF6FF" : "#FFFFFF",
                    borderColor: selectedSupplyMonth === currentMonthStr ? "#93C5FD" : "#CBD5E1",
                    color: selectedSupplyMonth === currentMonthStr ? "#1D4ED8" : "#1E293B",
                  }}
                >
                  {availableSupplyMonths.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", display: "flex", alignItems: "center", gap: 4 }}>
                  <Calendar size={14} /> Filter Date:
                </span>
                <input
                  type="date"
                  value={supplyDateFilter}
                  onChange={(e) => setSupplyDateFilter(e.target.value)}
                  style={{ ...inp, width: 150, fontSize: 12, padding: "6px 10px" }}
                />
                {supplyDateFilter && (
                  <button
                    onClick={() => setSupplyDateFilter("")}
                    style={{ ...smallBtn, padding: "6px 10px", fontSize: 11 }}
                  >
                    Clear Date
                  </button>
                )}
              </div>

              {/* Table Section & Spacer Controls */}
              <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setShowSectionModal(true)}
                  style={{
                    padding: "6px 13px",
                    borderRadius: 8,
                    border: "1px solid #FED7AA",
                    background: "#FFF7ED",
                    color: "#C2410C",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  title="Insert a named category section divider into the table"
                >
                  <FolderPlus size={14} color="#EA580C" /> + Add Section Header
                </button>
                <button
                  type="button"
                  disabled={savingSection}
                  onClick={() => handleAddSectionDivider("")}
                  style={{
                    padding: "6px 13px",
                    borderRadius: 8,
                    border: "1px solid #E2E8F0",
                    background: "#F8FAFC",
                    color: "#475569",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                  title="Insert an empty spacer line to visually separate items"
                >
                  <Plus size={13} /> + Spacer Line
                </button>
              </div>
            </div>

            {/* Datalist for Unit Suggestions */}
            <datalist id="supply-unit-suggestions">
              <option value="Pcs" />
              <option value="Ctn" />
              <option value="Btl" />
              <option value="Kg" />
              <option value="Box" />
              <option value="Pack" />
              <option value="Rolls" />
              <option value="Tray" />
              <option value="Gallon" />
              <option value="Can" />
            </datalist>

            {/* ─── THE SPREADSHEET TABLE INPUT LIKE TO CRUD (DATE.docx) ───────── */}
            <div style={{ background: "#FFFFFF", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 10px rgba(0,0,0,0.06)", border: "1px solid #E2E8F0" }}>
              <div style={{ overflowX: "auto" }}>
                <table className="supply-table">
                  <thead>
                    <tr style={{ background: "#FFF5F5" }}>
                      <th style={{ color: "#B91C1C", width: 45, textAlign: "center" }}>S/N</th>
                      <th style={{ color: "#B91C1C", minWidth: 200 }}>ITEM SUPPLY</th>
                      <th style={{ color: "#B91C1C", width: 120, textAlign: "center" }}>CATEGORY</th>
                      <th style={{ color: "#B91C1C", width: 90, textAlign: "center" }}>UNIT</th>
                      <th style={{ color: "#B91C1C", width: 130, textAlign: "center" }}>QUANTITY AVAILABLE</th>
                      <th style={{ color: "#B91C1C", width: 130, textAlign: "center" }}>QUANTITY ISSUED</th>
                      <th style={{ color: "#B91C1C", width: 110, textAlign: "center" }}>BALANCE</th>
                      <th style={{ color: "#B91C1C", width: 130, textAlign: "center" }}>DATE ISSUED</th>
                      <th style={{ color: "#B91C1C", minWidth: 200 }}>FEEDBACK / REMARKS</th>
                      <th style={{ color: "#475569", width: 100, textAlign: "center" }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* ── 1. INLINE DIRECT TABLE INPUT ROW (QUICK ADD) ───────────── */}
                    <tr style={{ background: "#FEF2F2", borderBottom: "2px solid #FCA5A5" }}>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ fontSize: 10, fontWeight: 900, background: "#B91C1C", color: "#FFF", padding: "2px 6px", borderRadius: 6 }}>
                          #NEW
                        </span>
                      </td>

                      {/* ITEM SUPPLY INPUT - Strict fidelity: No auto-filling of quantity */}
                      <td>
                        <input
                          type="text"
                          required
                          list="inventory-catalog-suggestions"
                          placeholder="Type item supply name..."
                          value={newSupplyRow.itemSupply}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewSupplyRow((prev) => ({
                              ...prev,
                              itemSupply: val,
                            }));
                          }}
                          className="table-input-cell"
                          style={{ fontWeight: 600 }}
                        />
                      </td>

                      {/* CATEGORY SELECT */}
                      <td style={{ textAlign: "center" }}>
                        <select
                          value={newSupplyRow.category}
                          onChange={(e) => setNewSupplyRow({ ...newSupplyRow, category: e.target.value })}
                          className="table-input-cell"
                          style={{ fontSize: 11, fontWeight: 700, padding: "5px 6px" }}
                        >
                          {dynamicSupplyCategories.length === 0 ? (
                            <option value="">No categories (Add category first)</option>
                          ) : (
                            dynamicSupplyCategories.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))
                          )}
                        </select>
                      </td>

                      {/* FLEXIBLE UNIT INPUT */}
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="text"
                          list="supply-unit-suggestions"
                          placeholder="Unit"
                          value={newSupplyRow.unit}
                          onChange={(e) => setNewSupplyRow({ ...newSupplyRow, unit: e.target.value })}
                          className="table-input-cell"
                          style={{ textAlign: "center", fontSize: 12, fontWeight: 700 }}
                        />
                      </td>

                      {/* QUANTITY AVAILABLE - Only populated when user types */}
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="number"
                          min="0"
                          placeholder="—"
                          value={newSupplyRow.quantityAvailable}
                          onChange={(e) => setNewSupplyRow({ ...newSupplyRow, quantityAvailable: e.target.value })}
                          className="table-input-cell"
                          style={{ textAlign: "center", fontWeight: 700 }}
                        />
                      </td>

                      {/* QUANTITY ISSUED - Only populated when user types, NEVER auto-filled */}
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="number"
                          min="0"
                          placeholder="—"
                          value={newSupplyRow.quantityIssued}
                          onChange={(e) => setNewSupplyRow({ ...newSupplyRow, quantityIssued: e.target.value })}
                          className="table-input-cell"
                          style={{ textAlign: "center", fontWeight: 700, color: "#D97706" }}
                        />
                      </td>

                      {/* BALANCE (LIVE AUTO-COMPUTED) */}
                      <td style={{ textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: 900,
                            background: computedNewRowBalance === "—" ? "#F1F5F9" : (Number(computedNewRowBalance) >= 0 ? "#D1FAE5" : "#FEE2E2"),
                            color: computedNewRowBalance === "—" ? "#64748B" : (Number(computedNewRowBalance) >= 0 ? "#065F46" : "#991B1B"),
                          }}
                        >
                          {computedNewRowBalance}
                        </span>
                      </td>

                      {/* DATE ISSUED */}
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="date"
                          value={newSupplyRow.dateIssued}
                          onChange={(e) => setNewSupplyRow({ ...newSupplyRow, dateIssued: e.target.value })}
                          className="table-input-cell"
                          style={{ textAlign: "center", fontSize: 12 }}
                        />
                      </td>

                      {/* FEEDBACK / NOTES */}
                      <td>
                        <input
                          type="text"
                          placeholder="Receiver name / condition / remarks..."
                          value={newSupplyRow.feedback}
                          onChange={(e) => setNewSupplyRow({ ...newSupplyRow, feedback: e.target.value })}
                          className="table-input-cell"
                        />
                      </td>

                      {/* SAVE BUTTON */}
                      <td style={{ textAlign: "center" }}>
                        <LoaderBtn
                          loading={savingSupply}
                          onClick={handleAddNewSupplyRow}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 8,
                            border: "none",
                            background: "#B91C1C",
                            color: "#FFF",
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: "pointer",
                            width: "100%",
                            justifyContent: "center",
                          }}
                        >
                          <Plus size={13} /> Add
                        </LoaderBtn>
                      </td>
                    </tr>

                    {/* ── 2. DATA ROWS (FROM MONGODB) ───────────────────────────── */}
                    {loadingSupplies && supplies.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ textAlign: "center", padding: 40, color: "#64748B" }}>
                          <Spinner size={24} color="#B91C1C" />
                          <div style={{ marginTop: 8, fontWeight: 600 }}>Loading supply records from MongoDB...</div>
                        </td>
                      </tr>
                    ) : supplies.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ textAlign: "center", padding: 50, color: "#94A3B8" }}>
                          <ClipboardList size={40} style={{ margin: "0 auto 8px", opacity: 0.3 }} />
                          <div style={{ fontWeight: 700, fontSize: 15, color: "#475569" }}>No Supply Records Found</div>
                          <div style={{ fontSize: 12, marginTop: 4 }}>
                            Enter item name, quantity available and issued in the top row and click &quot;Add&quot; to save to MongoDB.
                          </div>
                        </td>
                      </tr>
                    ) : (
                      supplies.map((s, idx) => {
                        const isEditing = editingSupplyId === (s._id || s.$id);

                        // If this record is a Section Header or Blank Spacer row:
                        if (s.isSectionHeader) {
                          const title = s.sectionTitle || s.itemSupply || "";
                          const isBlank = !title || title.trim() === "" || title.toLowerCase() === "spacer";

                          return (
                            <tr
                              key={s._id || s.$id || idx}
                              style={{
                                background: isBlank ? "#F8FAFC" : "#FFF7ED",
                                borderTop: "2px solid #FED7AA",
                                borderBottom: "2px solid #FED7AA",
                              }}
                            >
                              <td colSpan={10} style={{ padding: isBlank ? "8px 16px" : "10px 18px" }}>
                                {isEditing ? (
                                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                    <span style={{ fontWeight: 800, fontSize: 12, color: "#C2410C" }}>Section Title:</span>
                                    <input
                                      type="text"
                                      value={editSupplyData.itemSupply || ""}
                                      placeholder="Enter section name or leave blank for empty spacer..."
                                      onChange={(e) => setEditSupplyData({ ...editSupplyData, itemSupply: e.target.value, sectionTitle: e.target.value })}
                                      className="table-input-cell"
                                      style={{ maxWidth: 360, fontWeight: 700 }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveInlineEdit(s._id || s.$id || "")}
                                      disabled={savingInlineEdit}
                                      style={{ padding: "4px 12px", background: "#059669", color: "#FFF", borderRadius: 6, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 12 }}
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setEditingSupplyId(null); setEditSupplyData({}); }}
                                      style={{ padding: "4px 10px", background: "#E2E8F0", color: "#334155", borderRadius: 6, border: "none", fontWeight: 700, cursor: "pointer", fontSize: 12 }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                      <div style={{ width: 4, height: 18, background: isBlank ? "#94A3B8" : "#EA580C", borderRadius: 2 }} />
                                      {isBlank ? (
                                        <span style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "1px", textTransform: "uppercase" }}>
                                          ── Table Section Spacer ──
                                        </span>
                                      ) : (
                                        <span style={{ fontSize: 13, fontWeight: 900, color: "#9A3412", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                                          📁 SECTION: {title}
                                        </span>
                                      )}
                                      {s.category && (
                                        <span style={{ fontSize: 10, fontWeight: 700, background: "#FFEDD5", color: "#C2410C", padding: "1px 8px", borderRadius: 4 }}>
                                          {s.category}
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ display: "flex", gap: 6 }}>
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditSupply(s)}
                                        style={{ background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700, color: "#475569", cursor: "pointer" }}
                                        title="Rename section"
                                      >
                                        Rename
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSupply(s._id || s.$id || "", s.itemSupply || "Section")}
                                        style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700, color: "#DC2626", cursor: "pointer" }}
                                        title="Delete section divider"
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        }

                        // Regular Item Row:
                        const availVal = isEditing ? editSupplyData.quantityAvailable : s.quantityAvailable;
                        const issuedVal = isEditing ? editSupplyData.quantityIssued : s.quantityIssued;
                        const hasAvail = availVal !== undefined && availVal !== null && String(availVal).trim() !== "" && !isNaN(Number(availVal));
                        const hasIssued = issuedVal !== undefined && issuedVal !== null && String(issuedVal).trim() !== "" && !isNaN(Number(issuedVal));
                        let rowBalDisplay: string | number = "—";
                        if (hasAvail && hasIssued) rowBalDisplay = Number(availVal) - Number(issuedVal);
                        else if (hasAvail) rowBalDisplay = Number(availVal);
                        else if (hasIssued) rowBalDisplay = -Number(issuedVal);
                        else if (s.balance !== undefined && s.balance !== null) rowBalDisplay = s.balance;

                        return (
                          <tr
                            key={s._id || s.$id || idx}
                            style={{
                              background: isEditing ? "#EFF6FF" : "transparent",
                              transition: "background 0.15s",
                            }}
                          >
                            {/* S/N */}
                            <td style={{ textAlign: "center", fontWeight: 700, color: "#64748B" }}>
                              {idx + 1}
                            </td>

                            {/* ITEM SUPPLY */}
                            <td>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editSupplyData.itemSupply || ""}
                                  onChange={(e) => setEditSupplyData({ ...editSupplyData, itemSupply: e.target.value })}
                                  className="table-input-cell"
                                  style={{ fontWeight: 700 }}
                                />
                              ) : (
                                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                  <Package size={14} color="#B91C1C" style={{ flexShrink: 0 }} />
                                  <span style={{ fontWeight: 800, color: "#0F172A" }}>{s.itemSupply}</span>
                                </div>
                              )}
                            </td>

                            {/* CATEGORY */}
                            <td style={{ textAlign: "center" }}>
                              {isEditing ? (
                                <select
                                  value={editSupplyData.category || dynamicSupplyCategories[0] || ""}
                                  onChange={(e) => setEditSupplyData({ ...editSupplyData, category: e.target.value })}
                                  className="table-input-cell"
                                  style={{ fontSize: 11, fontWeight: 700, padding: "4px" }}
                                >
                                  {dynamicSupplyCategories.length === 0 ? (
                                    <option value={editSupplyData.category || ""}>{editSupplyData.category || "No categories"}</option>
                                  ) : (
                                    dynamicSupplyCategories.map((c) => (
                                      <option key={c} value={c}>{c}</option>
                                    ))
                                  )}
                                </select>
                              ) : (
                                <span style={{ fontSize: 11, fontWeight: 700, background: "#F1F5F9", color: "#334155", padding: "2px 8px", borderRadius: 99 }}>
                                  {s.category || "—"}
                                </span>
                              )}
                            </td>

                            {/* UNIT */}
                            <td style={{ textAlign: "center" }}>
                              {isEditing ? (
                                <input
                                  type="text"
                                  list="supply-unit-suggestions"
                                  value={editSupplyData.unit || ""}
                                  placeholder="Unit"
                                  onChange={(e) => setEditSupplyData({ ...editSupplyData, unit: e.target.value })}
                                  className="table-input-cell"
                                  style={{ textAlign: "center", fontSize: 11, fontWeight: 700 }}
                                />
                              ) : (
                                <span style={{ fontSize: 12, fontWeight: 600, color: s.unit ? "#2563EB" : "#94A3B8" }}>
                                  {s.unit || "—"}
                                </span>
                              )}
                            </td>

                            {/* QUANTITY AVAILABLE - Null fidelity */}
                            <td style={{ textAlign: "center" }}>
                              {isEditing ? (
                                <input
                                  type="number"
                                  min="0"
                                  value={editSupplyData.quantityAvailable !== undefined && editSupplyData.quantityAvailable !== null ? editSupplyData.quantityAvailable : ""}
                                  placeholder="—"
                                  onChange={(e) => setEditSupplyData({
                                    ...editSupplyData,
                                    quantityAvailable: e.target.value === "" ? null : Number(e.target.value),
                                  })}
                                  className="table-input-cell"
                                  style={{ textAlign: "center", fontWeight: 700 }}
                                />
                              ) : (
                                <span style={{ fontWeight: 800, color: "#1E293B", fontSize: 14 }}>
                                  {s.quantityAvailable !== null && s.quantityAvailable !== undefined ? s.quantityAvailable : "—"}
                                </span>
                              )}
                            </td>

                            {/* QUANTITY ISSUED - Null fidelity: never forces 0 */}
                            <td style={{ textAlign: "center" }}>
                              {isEditing ? (
                                <input
                                  type="number"
                                  min="0"
                                  value={editSupplyData.quantityIssued !== undefined && editSupplyData.quantityIssued !== null ? editSupplyData.quantityIssued : ""}
                                  placeholder="—"
                                  onChange={(e) => setEditSupplyData({
                                    ...editSupplyData,
                                    quantityIssued: e.target.value === "" ? null : Number(e.target.value),
                                  })}
                                  className="table-input-cell"
                                  style={{ textAlign: "center", fontWeight: 700, color: "#D97706" }}
                                />
                              ) : (
                                <span style={{ fontWeight: 800, color: "#D97706", fontSize: 14 }}>
                                  {s.quantityIssued !== null && s.quantityIssued !== undefined ? s.quantityIssued : "—"}
                                </span>
                              )}
                            </td>

                            {/* BALANCE */}
                            <td style={{ textAlign: "center" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  fontSize: 13,
                                  fontWeight: 900,
                                  background: rowBalDisplay === "—" ? "#F1F5F9" : (Number(rowBalDisplay) > 0 ? "#D1FAE5" : Number(rowBalDisplay) === 0 ? "#FEF3C7" : "#FEE2E2"),
                                  color: rowBalDisplay === "—" ? "#64748B" : (Number(rowBalDisplay) > 0 ? "#065F46" : Number(rowBalDisplay) === 0 ? "#92400E" : "#991B1B"),
                                }}
                              >
                                {rowBalDisplay}
                              </span>
                            </td>

                            {/* DATE ISSUED */}
                            <td style={{ textAlign: "center", color: "#475569" }}>
                              {isEditing ? (
                                <input
                                  type="date"
                                  value={editSupplyData.dateIssued || ""}
                                  onChange={(e) => setEditSupplyData({ ...editSupplyData, dateIssued: e.target.value })}
                                  className="table-input-cell"
                                  style={{ fontSize: 12, textAlign: "center" }}
                                />
                              ) : (
                                <span style={{ fontSize: 12, fontWeight: 600 }}>
                                  {s.dateIssued || "—"}
                                </span>
                              )}
                            </td>

                            {/* FEEDBACK */}
                            <td>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={editSupplyData.feedback || ""}
                                  onChange={(e) => setEditSupplyData({ ...editSupplyData, feedback: e.target.value })}
                                  className="table-input-cell"
                                />
                              ) : (
                                <span style={{ color: s.feedback ? "#334155" : "#94A3B8", fontSize: 12 }}>
                                  {s.feedback || "—"}
                                </span>
                              )}
                            </td>

                            {/* ACTIONS (EDIT / DELETE / SAVE / CANCEL) */}
                            <td style={{ textAlign: "center" }}>
                              {isEditing ? (
                                <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                                  <button
                                    onClick={() => handleSaveInlineEdit(s._id || s.$id || "")}
                                    disabled={savingInlineEdit}
                                    style={{
                                      padding: "5px 8px",
                                      background: "#059669",
                                      color: "#FFF",
                                      border: "none",
                                      borderRadius: 6,
                                      cursor: "pointer",
                                    }}
                                    title="Save changes"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button
                                    onClick={() => setEditingSupplyId(null)}
                                    style={{
                                      padding: "5px 8px",
                                      background: "#94A3B8",
                                      color: "#FFF",
                                      border: "none",
                                      borderRadius: 6,
                                      cursor: "pointer",
                                    }}
                                    title="Cancel"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                                  <button
                                    onClick={() => handleStartEditSupply(s)}
                                    style={{
                                      padding: "5px 8px",
                                      background: "#EFF6FF",
                                      color: "#1D4ED8",
                                      border: "none",
                                      borderRadius: 6,
                                      cursor: "pointer",
                                    }}
                                    title="Edit Row"
                                  >
                                    <Edit size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSupply(s._id || s.$id || "", s.itemSupply)}
                                    disabled={deletingSupplyId === (s._id || s.$id)}
                                    style={{
                                      padding: "5px 8px",
                                      background: "#FEE2E2",
                                      color: "#DC2626",
                                      border: "none",
                                      borderRadius: 6,
                                      cursor: "pointer",
                                    }}
                                    title="Delete Row"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Note about DATE.docx Table */}
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <Info size={18} color="#64748B" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: "#64748B" }}>
                This table corresponds directly with the official <strong>DATE.docx</strong> document specification (Columns: S/N, Item Supply, Quantity Available, Quantity Issued, Balance, Date Issued, Feedback). All updates save live to MongoDB.
              </div>
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: STANDARD INVENTORY CATALOG                                    */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeTab === "catalog" && (
          <div style={{ display: "grid", gap: 20 }}>
            {/* Header Controls for Catalog */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h3 style={{ margin: "0 0 2px", fontSize: 18, fontWeight: 800, color: "#1E293B" }}>
                  General Stock Catalog
                </h3>
                <p style={{ margin: 0, color: "#64748B", fontSize: 12 }}>
                  SKU tracking, reorder alert levels, suppliers, and total valuation
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <LoaderBtn loading={downloadingPdf} onClick={downloadInventoryPDF} style={{ ...btn, background: "#1a365d", fontSize: 12, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <FileDown size={14} /> Export Audit PDF
                </LoaderBtn>
                <LoaderBtn loading={downloadingCsv} onClick={downloadInventoryCSV} style={{ ...btn, background: "#10B981", fontSize: 12, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Download size={14} /> Export CSV
                </LoaderBtn>
                <LoaderBtn onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ quantity: 0, minQuantity: 5, unitPrice: 0 }); setImgFile(null); }} style={{ ...btn, fontSize: 12, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Cancel" : "Add Catalog Item"}
                </LoaderBtn>
              </div>
            </div>

            {/* Catalog Stats */}
            <div className="inv-stat-grid">
              {[
                { label: "Total Items", value: items.length, color: "#3B82F6", icon: <Package size={20} color="#3B82F6" /> },
                { label: "Total Value", value: `₦${totalValue.toLocaleString()}`, color: "#10B981", icon: <DollarSign size={20} color="#10B981" /> },
                { label: "Low Stock Items", value: lowStockCount, color: "#F59E0B", icon: <AlertTriangle size={20} color="#F59E0B" /> },
                { label: "Out of Stock", value: outOfStockCount, color: "#EF4444", icon: <XCircle size={20} color="#EF4444" /> },
              ].map((s) => (
                <div key={s.label} style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", borderLeft: `4px solid ${s.color}` }}>
                  <div style={{ marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Catalog Add/Edit Form */}
            {showForm && (
              <form onSubmit={handleSubmit} style={{ background:"#fff",borderRadius:16,padding:24,boxShadow:"0 4px 20px rgba(0,0,0,0.09)",border:"2px solid #ff7f50" }}>
                <h3 style={{ margin:"0 0 16px",display:"flex",alignItems:"center",gap:8 }}>
                  <Package size={20} color="#ff7f50" />
                  {editingId ? "Edit Inventory Item" : "Add New Item"}
                </h3>
                <div className="inv-form-grid">
                  <label style={lbl}>Item Name *<input required value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Executive Bed Sheet Set" style={inp} /></label>
                  <label style={lbl}>SKU / Code<input value={form.sku||""} onChange={e=>setForm({...form,sku:e.target.value})} placeholder="e.g. LIN-001" style={inp} /></label>
                  <label style={lbl}>Category *
                    <input required list="cats" value={form.category||""} onChange={e=>setForm({...form,category:e.target.value})} placeholder="e.g. Linen, Toiletries, Kitchen, Electronics" style={inp} />
                    <datalist id="cats">{categories.map(c=><option key={c} value={c} />)}</datalist>
                  </label>
                  <label style={lbl}>Unit of Measure<input value={form.unit||""} onChange={e=>setForm({...form,unit:e.target.value})} placeholder="e.g. pcs, sets, kg, bottles, boxes" style={inp} /></label>
                  <label style={lbl}>Current Quantity *<input required type="number" min="0" value={form.quantity??""} onChange={e=>setForm({...form,quantity:Number(e.target.value)})} style={inp} /></label>
                  <label style={lbl}>Low Stock Alert Level<input type="number" min="0" value={form.minQuantity??""} onChange={e=>setForm({...form,minQuantity:Number(e.target.value)})} placeholder="5" style={inp} /></label>
                  <label style={lbl}>Unit Price (₦)<input type="number" min="0" value={form.unitPrice??""} onChange={e=>setForm({...form,unitPrice:Number(e.target.value)})} placeholder="0" style={inp} /></label>
                  <label style={lbl}>Supplier / Vendor<input value={form.supplier||""} onChange={e=>setForm({...form,supplier:e.target.value})} placeholder="e.g. Dangote Textiles Ltd." style={inp} /></label>
                  <label style={lbl}>Storage Location<input value={form.location||""} onChange={e=>setForm({...form,location:e.target.value})} placeholder="e.g. Main Store Shelf B-3" style={inp} /></label>
                  <label style={lbl}>Status
                    <select value={form.status||"in_stock"} onChange={e=>setForm({...form,status:e.target.value as any})} style={inp}>
                      <option value="in_stock">In Stock</option>
                      <option value="low_stock">Low Stock</option>
                      <option value="out_of_stock">Out of Stock</option>
                      <option value="discontinued">Discontinued</option>
                    </select>
                  </label>
                  <div style={{ gridColumn:"1 / -1" }}>
                    <label style={lbl}>Description / Notes<textarea rows={2} value={form.description||""} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Specifications, usage instructions, etc." style={{ ...inp,resize:"vertical" }} /></label>
                  </div>
                  <div style={{ gridColumn:"1 / -1" }}>
                    <label style={lbl}>Item Photo<input type="file" accept="image/*" onChange={e=>setImgFile(e.target.files?.[0]||null)} style={{ ...inp,padding:6 }} /></label>
                  </div>
                </div>
                {form.quantity !== undefined && form.unitPrice !== undefined && (
                  <div style={{ marginTop:14,padding:12,background:"#EFF6FF",borderRadius:8,display:"flex",justifyContent:"space-between" }}>
                    <span style={{ fontWeight:700,color:"#1E40AF" }}>Calculated Total Value:</span>
                    <span style={{ fontWeight:900,fontSize:17,color:"#1E3A8A" }}>₦{((form.quantity||0)*(form.unitPrice||0)).toLocaleString()}</span>
                  </div>
                )}
                <div style={{ display:"flex",gap:12,marginTop:20 }}>
                  <LoaderBtn type="submit" loading={savingForm} style={btn}>{editingId?"Save Changes":"Add to Inventory"}</LoaderBtn>
                  <LoaderBtn type="button" onClick={()=>setShowForm(false)} style={{ ...btn,background:"#9CA3AF" }}>Cancel</LoaderBtn>
                </div>
              </form>
            )}

            {/* Catalog Filters & Search */}
            <div style={{ background:"#fff",padding:"14px 18px",borderRadius:14,boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
              <div className="inv-filters">
                <div style={{ flex:1, minWidth:200, position:"relative" }}>
                  <Search size={16} color="#9CA3AF" style={{ position:"absolute",left:12,top:"50%",transform:"translateY(-50%)" }} />
                  <input type="text" placeholder="Search catalog items by name, SKU, category, supplier…" value={search} onChange={e=>setSearch(e.target.value)} style={{ ...inp,paddingLeft:36,width:"100%",boxSizing:"border-box" }} />
                </div>
                <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} style={{ ...inp, minWidth:140 }}>
                  <option value="all">All Categories</option>
                  {categories.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
                <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{ ...inp, minWidth:140 }}>
                  <option value="all">All Status</option>
                  <option value="in_stock">In Stock</option>
                  <option value="low_stock">Low Stock</option>
                  <option value="out_of_stock">Out of Stock</option>
                  <option value="discontinued">Discontinued</option>
                </select>
                {(search||catFilter!=="all"||statusFilter!=="all") && (
                  <button onClick={()=>{setSearch("");setCatFilter("all");setStatusFilter("all");}} style={{ ...btn,background:"#F3F4F6",color:"#374151",padding:"10px 14px",display:"inline-flex",alignItems:"center",gap:6 }}>
                    <X size={14} /> Clear
                  </button>
                )}
                <span style={{ fontSize:13,color:"#888",whiteSpace:"nowrap" }}>{filtered.length} item{filtered.length!==1?"s":""}</span>
              </div>
            </div>

            {/* Catalog Cards Grid */}
            {loading && items.length===0 ? (
              <div style={{ textAlign:"center",padding:60,display:"flex",flexDirection:"column",alignItems:"center",gap:14 }}>
                <Spinner size={32} /><div style={{ color:"#888" }}>Loading catalog items…</div>
              </div>
            ) : filtered.length===0 ? (
              <div style={{ textAlign:"center",padding:60,color:"#9CA3AF" }}>
                <Package size={48} style={{ margin:"0 auto 12px", opacity:0.4 }} />
                <div style={{ fontWeight:600 }}>No items found</div>
                <div style={{ fontSize:13,marginTop:4 }}>{items.length===0?"Add your first inventory item to get started.":"Try adjusting your search or filters."}</div>
              </div>
            ) : (
              <div className="inv-grid">
                {filtered.map((item) => {
                  const status = getStatus(item);
                  const totalVal = item.totalValue || item.quantity*(item.unitPrice||0);
                  return (
                    <div key={item.$id} className="inv-card" style={{
                      background:"#fff", borderRadius:14, overflow:"hidden",
                      boxShadow:"0 2px 10px rgba(0,0,0,0.07)",
                      border: status==="out_of_stock" ? "2px solid #FEE2E2" : status==="low_stock" ? "2px solid #FEF3C7" : "1px solid #F3F4F6",
                      transition:"all 0.2s",
                    }}>
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} style={{ width:"100%",height:110,objectFit:"cover" }} />
                      ) : (
                        <div style={{ height:80,background:"linear-gradient(135deg,#1a365d,#3B82F6)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                          <Package size={36} color="rgba(255,255,255,0.7)" />
                        </div>
                      )}

                      <div style={{ padding:"14px 16px" }}>
                        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8 }}>
                          <div style={{ flex:1,minWidth:0 }}>
                            <div style={{ fontWeight:800,fontSize:15,color:"#111",marginBottom:2 }}>{item.name}</div>
                            {item.sku && <div style={{ fontSize:11,color:"#9CA3AF",fontFamily:"monospace" }}>SKU: {item.sku}</div>}
                          </div>
                          <StatusBadge status={status} qty={item.quantity} min={item.minQuantity} />
                        </div>

                        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12 }}>
                          <div style={{ background:"#F9FAFB",borderRadius:8,padding:"8px 10px" }}>
                            <div style={{ fontSize:10,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase" }}>Quantity</div>
                            <div style={{ fontSize:18,fontWeight:900,color: status==="out_of_stock"?"#DC2626":status==="low_stock"?"#D97706":"#059669" }}>
                              {item.quantity} <span style={{ fontSize:11,fontWeight:500,color:"#888" }}>{item.unit||"units"}</span>
                            </div>
                          </div>
                          <div style={{ background:"#F9FAFB",borderRadius:8,padding:"8px 10px" }}>
                            <div style={{ fontSize:10,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase" }}>Total Value</div>
                            <div style={{ fontSize:14,fontWeight:800,color:"#1E3A8A" }}>₦{totalVal.toLocaleString()}</div>
                          </div>
                        </div>

                        <div style={{ fontSize:12,color:"#666",display:"flex",flexDirection:"column",gap:4,marginBottom:12 }}>
                          {item.category && <span style={{ display:"inline-flex",alignItems:"center",gap:5 }}><Tag size={12} color="#6B7280" /> {item.category}</span>}
                          {item.supplier && <span style={{ display:"inline-flex",alignItems:"center",gap:5 }}><Factory size={12} color="#6B7280" /> {item.supplier}</span>}
                          {item.location && <span style={{ display:"inline-flex",alignItems:"center",gap:5 }}><MapPin size={12} color="#6B7280" /> {item.location}</span>}
                          {item.unitPrice ? <span style={{ display:"inline-flex",alignItems:"center",gap:5 }}><DollarSign size={12} color="#6B7280" /> ₦{item.unitPrice.toLocaleString()} per {item.unit||"unit"}</span> : null}
                          {item.minQuantity !== undefined && <span style={{ display:"inline-flex",alignItems:"center",gap:5,color: item.quantity<=item.minQuantity?"#D97706":"#9CA3AF" }}><AlertTriangle size={12} color="#D97706" /> Alert below {item.minQuantity} {item.unit||"units"}</span>}
                        </div>

                        <div style={{ display:"flex",gap:8,flexWrap:"wrap",alignItems:"center" }}>
                          <button onClick={()=>{setMovItem(item);setMov({type:"in",quantity:1,reason:""}); }} style={{ ...smallBtn,background:"#D1FAE5",color:"#065F46",flex:1,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:4 }}>
                            <ArrowDownLeft size={13} /> Stock In
                          </button>
                          <button onClick={()=>{setMovItem(item);setMov({type:"out",quantity:1,reason:""}); }} style={{ ...smallBtn,background:"#FEE2E2",color:"#991B1B",flex:1,display:"inline-flex",alignItems:"center",justifyContent:"center",gap:4 }}>
                            <ArrowUpRight size={13} /> Stock Out
                          </button>
                          <button onClick={()=>handleEdit(item)} style={{ ...smallBtn,background:"#EFF6FF",color:"#1D4ED8",display:"inline-flex",alignItems:"center" }}><Edit size={13} /></button>
                          <LoaderBtn loading={deletingId===item.$id} onClick={()=>handleDelete(item.$id)} style={{ ...smallBtn,background:"#FEE2E2",color:"#DC2626",display:"inline-flex",alignItems:"center" }}><Trash2 size={13} /></LoaderBtn>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Stock Movement Modal ──────────────────────────────────────────── */}
      {movItem && (
        <div style={{ position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(4px)" }}>
          <div style={{ background:"#fff",borderRadius:18,padding:28,width:"92%",maxWidth:460,boxShadow:"0 24px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin:"0 0 6px",display:"flex",alignItems:"center",gap:8 }}>
              {mov.type==="in"?<ArrowDownLeft size={18} color="#059669" />:<ArrowUpRight size={18} color="#DC2626" />}
              {mov.type==="in"?"Stock In":"Stock Out"} — {movItem.name}
            </h3>
            <p style={{ margin:"0 0 18px",fontSize:13,color:"#666" }}>
              Current stock: <strong>{movItem.quantity} {movItem.unit||"units"}</strong>
            </p>
            <div style={{ display:"grid",gap:14 }}>
              <label style={lbl}>
                Movement Type
                <select value={mov.type} onChange={e=>setMov({...mov,type:e.target.value as any})} style={inp}>
                  <option value="in">Stock In (Restock / Received)</option>
                  <option value="out">Stock Out (Used / Sold / Damaged)</option>
                  <option value="adjustment">Manual Adjustment (Set exact qty)</option>
                </select>
              </label>
              <label style={lbl}>
                {mov.type==="adjustment"?"New Total Quantity":"Quantity to "+( mov.type==="in"?"Add":"Remove")}
                <input type="number" min="1" value={mov.quantity??""} onChange={e=>setMov({...mov,quantity:Number(e.target.value)})} style={inp} />
              </label>
              <label style={lbl}>
                Reason / Note *
                <input required placeholder={mov.type==="in"?"e.g. Monthly restock from supplier":"e.g. Used for Room 12 setup, Damaged in transit"} value={mov.reason||""} onChange={e=>setMov({...mov,reason:e.target.value})} style={inp} />
              </label>
              {mov.type!=="adjustment" && mov.quantity && (
                <div style={{ padding:10,background:mov.type==="in"?"#D1FAE5":"#FEE2E2",borderRadius:8,fontSize:13,fontWeight:600 }}>
                  After: <strong>{mov.type==="in"?movItem.quantity+(mov.quantity||0):Math.max(0,movItem.quantity-(mov.quantity||0))} {movItem.unit||"units"}</strong>
                </div>
              )}
            </div>
            <div style={{ display:"flex",gap:10,marginTop:20 }}>
              <LoaderBtn loading={savingMov} onClick={handleStockMovement} style={{ ...btn,flex:1,justifyContent:"center" }}>
                Confirm Movement
              </LoaderBtn>
              <button onClick={()=>setMovItem(null)} style={{ ...btn,background:"#9CA3AF",flex:1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* AI TABLE EXTRACTOR & BULK IMPORT MODAL                              */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {showAiModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(6px)",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 20,
              width: "100%",
              maxWidth: 1080,
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.4)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "20px 24px",
                background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)",
                color: "#FFFFFF",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 16,
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      background: "rgba(255, 255, 255, 0.15)",
                      padding: 8,
                      borderRadius: 10,
                      display: "flex",
                    }}
                  >
                    <Sparkles size={20} color="#FDE047" />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, letterSpacing: "-0.02em" }}>
                      AI Table Extractor & Bulk Importer
                    </h3>
                    <p style={{ margin: "3px 0 0", fontSize: 12, color: "#C7D2FE" }}>
                      Extract tables from phone photos, scanned documents, PDFs, or paste directly from Excel into MongoDB
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                  style={{
                    background: geminiApiKey ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)",
                    border: geminiApiKey ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(239, 68, 68, 0.4)",
                    color: geminiApiKey ? "#6EE7B7" : "#FCA5A5",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "6px 12px",
                    borderRadius: 8,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                  title="Configure Gemini API Key"
                >
                  <Key size={13} />
                  {geminiApiKey ? "Gemini Key Configured" : "Add Gemini Key"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  style={{
                    background: "rgba(255, 255, 255, 0.12)",
                    border: "none",
                    color: "#FFFFFF",
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Optional API Key Configuration Strip */}
            {showApiKeyInput && (
              <div
                style={{
                  background: "#F8FAFC",
                  padding: "14px 24px",
                  borderBottom: "1px solid #E2E8F0",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <Key size={16} color="#6366F1" />
                <div style={{ flex: 1, minWidth: 260 }}>
                  <input
                    type="password"
                    placeholder="Enter Google Gemini API Key (e.g. AIzaSy...)"
                    value={geminiApiKey}
                    onChange={(e) => saveGeminiKey(e.target.value)}
                    style={{
                      ...inp,
                      padding: "8px 12px",
                      background: "#FFFFFF",
                      fontSize: 12,
                      fontFamily: "monospace",
                    }}
                  />
                </div>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 11, color: "#4F46E5", fontWeight: 700, textDecoration: "underline" }}
                >
                  Get free API Key from Google AI Studio ↗
                </a>
              </div>
            )}

            {/* Scrollable Modal Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "grid", gap: 20 }}>

              {/* Source Mode Tabs */}
              <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #E2E8F0", paddingBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => setAiTab("ai")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 18px",
                    borderRadius: 10,
                    border: "none",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                    background: aiTab === "ai" ? "#4F46E5" : "#F1F5F9",
                    color: aiTab === "ai" ? "#FFFFFF" : "#475569",
                    transition: "all 0.2s",
                  }}
                >
                  <UploadCloud size={16} /> 📸 AI Image & PDF Extractor
                </button>
                <button
                  type="button"
                  onClick={() => setAiTab("paste")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "9px 18px",
                    borderRadius: 10,
                    border: "none",
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                    background: aiTab === "paste" ? "#4F46E5" : "#F1F5F9",
                    color: aiTab === "paste" ? "#FFFFFF" : "#475569",
                    transition: "all 0.2s",
                  }}
                >
                  <ClipboardPaste size={16} /> 📋 Excel / Word Paste & TSV
                </button>
              </div>

              {/* TAB 1: AI EXTRACTION */}
              {aiTab === "ai" && (
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20 }}>
                  {/* Left Column: Multi-File Dropzone & Gallery */}
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <label style={{ fontSize: 13, fontWeight: 800, color: "#1E293B" }}>
                        1. Upload Images & PDFs of Tables
                      </label>
                      {aiFiles.length > 0 && (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <button
                            type="button"
                            onClick={() => document.getElementById("ai-file-picker")?.click()}
                            style={{
                              background: "#EEF2FF",
                              border: "1px solid #C7D2FE",
                              color: "#4338CA",
                              borderRadius: 6,
                              padding: "3px 8px",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <Plus size={12} /> Add More
                          </button>
                          <button
                            type="button"
                            onClick={clearAllAiFiles}
                            style={{
                              background: "#FEF2F2",
                              border: "1px solid #FECACA",
                              color: "#DC2626",
                              borderRadius: 6,
                              padding: "3px 8px",
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Clear All
                          </button>
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        border: isDraggingAi ? "2px dashed #4F46E5" : "2px dashed #CBD5E1",
                        borderRadius: 14,
                        padding: aiFiles.length > 0 ? "14px 14px" : "24px 20px",
                        textAlign: "center",
                        background: isDraggingAi ? "#EEF2FF" : "#F8FAFC",
                        cursor: "pointer",
                        position: "relative",
                        transition: "all 0.2s",
                        minHeight: aiFiles.length > 0 ? 190 : 210,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                      }}
                      onClick={() => {
                        if (aiFiles.length === 0) document.getElementById("ai-file-picker")?.click();
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingAi(true);
                      }}
                      onDragLeave={() => setIsDraggingAi(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingAi(false);
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          handleFilesSelect(e.dataTransfer.files);
                        }
                      }}
                    >
                      <input
                        id="ai-file-picker"
                        type="file"
                        multiple
                        accept="image/*,.heic,.heif,application/pdf"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleFilesSelect(e.target.files);
                          }
                          e.target.value = "";
                        }}
                      />

                      {aiFiles.length === 0 ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                          <div
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: "50%",
                              background: "#EEF2FF",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <UploadCloud size={26} color="#4F46E5" />
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#1E293B" }}>
                              Drop multiple photos or PDFs here, or click to browse
                            </div>
                            <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>
                              Select multiple files: iPhone photos (.HEIC), PNG, JPG, or PDF documents
                            </div>
                            <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 8 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, background: "#EDE9FE", color: "#6D28D9", padding: "2px 8px", borderRadius: 99 }}>
                                📸 Multi-Photos (HEIC / JPG)
                              </span>
                              <span style={{ fontSize: 10, fontWeight: 700, background: "#EFF6FF", color: "#1D4ED8", padding: "2px 8px", borderRadius: 99 }}>
                                📄 Multi-PDFs
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #E2E8F0", paddingBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: "#334155" }}>
                              {aiFiles.length} file{aiFiles.length > 1 ? "s" : ""} selected (
                              {aiFiles.filter((f) => !f.isPdf).length} image{aiFiles.filter((f) => !f.isPdf).length !== 1 ? "s" : ""}, {" "}
                              {aiFiles.filter((f) => f.isPdf).length} PDF{aiFiles.filter((f) => f.isPdf).length !== 1 ? "s" : ""})
                            </span>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                document.getElementById("ai-file-picker")?.click();
                              }}
                              style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5", cursor: "pointer" }}
                            >
                              + Click to add more files
                            </span>
                          </div>

                          {/* Scrollable File Cards Grid */}
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                              gap: 10,
                              maxHeight: 180,
                              overflowY: "auto",
                              padding: "4px 2px",
                            }}
                          >
                            {aiFiles.map((item) => (
                              <div
                                key={item.id}
                                style={{
                                  background: "#FFFFFF",
                                  border: "1px solid #E2E8F0",
                                  borderRadius: 10,
                                  padding: "8px",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  gap: 6,
                                  position: "relative",
                                  boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                                }}
                              >
                                {/* Delete File Button */}
                                <button
                                  type="button"
                                  title="Remove file"
                                  onClick={(e) => removeAiFile(item.id, e)}
                                  style={{
                                    position: "absolute",
                                    top: 4,
                                    right: 4,
                                    width: 20,
                                    height: 20,
                                    borderRadius: "50%",
                                    background: "#FEE2E2",
                                    border: "none",
                                    color: "#DC2626",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    padding: 0,
                                    zIndex: 2,
                                  }}
                                >
                                  <X size={12} />
                                </button>

                                {/* Thumbnail */}
                                <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                  {item.isHeic ? (
                                    <div
                                      style={{
                                        padding: "6px 10px",
                                        background: "#F5F3FF",
                                        borderRadius: 8,
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        gap: 2,
                                      }}
                                    >
                                      <Camera size={20} color="#7C3AED" />
                                      <span style={{ fontSize: 9, fontWeight: 800, color: "#6D28D9" }}>iPhone HEIC</span>
                                    </div>
                                  ) : item.isPdf ? (
                                    <div
                                      style={{
                                        padding: "6px 10px",
                                        background: "#EFF6FF",
                                        borderRadius: 8,
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        gap: 2,
                                      }}
                                    >
                                      <FileText size={20} color="#2563EB" />
                                      <span style={{ fontSize: 9, fontWeight: 800, color: "#1E40AF" }}>PDF Doc</span>
                                    </div>
                                  ) : item.previewUrl ? (
                                    <img
                                      src={item.previewUrl}
                                      alt={item.file.name}
                                      style={{ maxHeight: 56, maxWidth: "100%", borderRadius: 6, objectFit: "contain" }}
                                    />
                                  ) : (
                                    <FileText size={22} color="#64748B" />
                                  )}
                                </div>

                                <div
                                  title={item.file.name}
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    color: "#1E293B",
                                    maxWidth: 110,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {item.file.name}
                                </div>
                                <div style={{ fontSize: 10, color: "#94A3B8" }}>
                                  {item.sizeKb} KB
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Custom Instruction & Trigger */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div>
                                          {/* Category Selector for AI Import */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#1E293B" }}>
                        Assign Category:
                      </span>
                      <select
                        value={aiSelectedCategory}
                        onChange={(e) => setAiSelectedCategory(e.target.value)}
                        style={{ ...inp, width: 170, padding: "5px 10px", fontSize: 12, fontWeight: 700 }}
                      >
                        {dynamicSupplyCategories.length === 0 ? (
                          <option value="">No categories (Add category first)</option>
                        ) : (
                          dynamicSupplyCategories.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))
                        )}
                      </select>
                    </div>
                      <label style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", display: "flex", justifyContent: "space-between" }}>
                        <span>2. What should AI extract? (Custom Instruction)</span>
                      </label>
                      <p style={{ margin: "2px 0 8px", fontSize: 11, color: "#64748B" }}>
                        Give specific rules (e.g. filter categories, ignore certain columns, or target specific supplies)
                      </p>
                      <textarea
                        rows={4}
                        value={aiInstruction}
                        onChange={(e) => setAiInstruction(e.target.value)}
                        placeholder="e.g. Extract only content in supply items. Ignore prices and total costs. Map available to Quantity Available..."
                        style={{
                          ...inp,
                          fontFamily: "inherit",
                          resize: "vertical",
                          fontSize: 12,
                          lineHeight: 1.5,
                        }}
                      />
                    </div>

                    {/* Quick Preset Chips */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748B", marginBottom: 6 }}>
                        Quick Instruction Presets:
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {[
                          "Extract only content in supply items",
                          "Ignore prices & financial columns",
                          "Office stationery & desk supplies only",
                          "Extract all rows without skipping",
                        ].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setAiInstruction(chip)}
                            style={{
                              background: "#F1F5F9",
                              border: "1px solid #E2E8F0",
                              borderRadius: 6,
                              padding: "4px 8px",
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#334155",
                              cursor: "pointer",
                            }}
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ marginTop: "auto" }}>
                      {/* Live Progress Bar when extracting */}
                      {extracting && extractionProgress && (
                        <div
                          style={{
                            background: "#EEF2FF",
                            border: "1px solid #C7D2FE",
                            borderRadius: 10,
                            padding: "10px 14px",
                            marginBottom: 8,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "#3730A3", marginBottom: 6 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <RefreshCw size={14} className="animate-spin" />
                              {extractionProgress.fileName}
                            </span>
                            <span>{extractionProgress.percent}%</span>
                          </div>
                          <div style={{ width: "100%", height: 6, background: "#C7D2FE", borderRadius: 99, overflow: "hidden" }}>
                            <div
                              style={{
                                width: `${extractionProgress.percent}%`,
                                height: "100%",
                                background: "linear-gradient(90deg, #4F46E5, #7C3AED)",
                                borderRadius: 99,
                                transition: "width 0.3s ease",
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleRunAiExtraction}
                        disabled={extracting || aiFiles.length === 0}
                        style={{
                          ...btn,
                          width: "100%",
                          background: extracting || aiFiles.length === 0
                            ? "#94A3B8"
                            : "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                          color: "#FFFFFF",
                          padding: "12px 18px",
                          fontSize: 14,
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 9,
                          cursor: extracting || aiFiles.length === 0 ? "not-allowed" : "pointer",
                          boxShadow: "0 6px 18px rgba(99, 102, 241, 0.35)",
                        }}
                      >
                        {extracting ? (
                          <>
                            <RefreshCw size={18} className="animate-spin" />
                            Extracting from {aiFiles.length} file{aiFiles.length > 1 ? "s" : ""} with Gemini AI...
                          </>
                        ) : (
                          <>
                            <Sparkles size={18} color="#FDE047" />
                            Extract Tables from {aiFiles.length > 0 ? `${aiFiles.length} File${aiFiles.length > 1 ? "s" : ""}` : "Files"} with Gemini AI
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: EXCEL / WORD PASTE */}
              {aiTab === "paste" && (
                <div style={{ display: "grid", gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 800, color: "#1E293B" }}>
                      Paste Tab-Separated Rows from Excel or Word
                    </label>
                    <p style={{ margin: "3px 0 8px", fontSize: 12, color: "#64748B" }}>
                      Copy rows directly from Excel, Word, or Google Sheets and paste them below.
                    </p>
                    <textarea
                      rows={6}
                      value={pasteInput}
                      onChange={(e) => setPasteInput(e.target.value)}
                      placeholder={`1	Executive Office Paper A4	100	25	75	2026-10-28	Delivered to Admin Desk
2	Thermal Receipt Rolls	250	50	200	2026-10-28	Front Office`}
                      style={{
                        ...inp,
                        fontFamily: "monospace",
                        fontSize: 12,
                        whiteSpace: "pre",
                        overflowX: "auto",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={handleParsePaste}
                      style={{
                        ...btn,
                        background: "#0F172A",
                        color: "#FFFFFF",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "10px 20px",
                      }}
                    >
                      <ClipboardPaste size={15} /> Parse & Add to Review Table
                    </button>
                  </div>
                </div>
              )}

              {/* Extraction Alert / Summary Banner */}
              {extractError && (
                <div
                  style={{
                    background: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#991B1B",
                    padding: "12px 16px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <AlertTriangle size={18} />
                  <div style={{ flex: 1 }}>{extractError}</div>
                  {!geminiApiKey && (
                    <button
                      type="button"
                      onClick={() => setShowApiKeyInput(true)}
                      style={{
                        background: "#B91C1C",
                        color: "#FFFFFF",
                        border: "none",
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Enter Key
                    </button>
                  )}
                </div>
              )}

              {extractSummary && (
                <div
                  style={{
                    background: "#ECFDF5",
                    border: "1px solid #A7F3D0",
                    color: "#065F46",
                    padding: "10px 16px",
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <CheckCircle2 size={16} /> {extractSummary}
                </div>
              )}

              {/* ── STAGING / REVIEW TABLE ──────────────────────────────────── */}
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "#0F172A" }}>
                      Extracted Staging Table ({stagingRows.length} rows)
                    </h4>
                    <span
                      style={{
                        background: "#E0E7FF",
                        color: "#3730A3",
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 99,
                      }}
                    >
                      {stagingRows.filter((r) => r.selected).length} selected to save
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() =>
                        setStagingRows((prev) =>
                          prev.map((r) => ({ ...r, selected: true }))
                        )
                      }
                      style={{ ...smallBtn, fontSize: 11, padding: "5px 10px" }}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setStagingRows((prev) =>
                          prev.map((r) => ({ ...r, selected: false }))
                        )
                      }
                      style={{ ...smallBtn, fontSize: 11, padding: "5px 10px" }}
                    >
                      Deselect All
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setStagingRows((prev) => [
                          ...prev,
                          {
                            id: `manual-${Date.now()}`,
                            itemSupply: "",
                            category: aiSelectedCategory || (selectedSupplyCategory !== "all" ? selectedSupplyCategory : (dynamicSupplyCategories[0] || "")),
                            quantityAvailable: null,
                            quantityIssued: null,
                            balance: null,
                            dateIssued: new Date().toISOString().split("T")[0],
                            feedback: "",
                            selected: true,
                          },
                        ])
                      }
                      style={{
                        ...smallBtn,
                        fontSize: 11,
                        padding: "5px 10px",
                        background: "#EFF6FF",
                        color: "#1D4ED8",
                        fontWeight: 700,
                      }}
                    >
                      + Add Row
                    </button>
                    {stagingRows.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Clear all staging rows?")) setStagingRows([]);
                        }}
                        style={{
                          ...smallBtn,
                          fontSize: 11,
                          padding: "5px 10px",
                          background: "#FEF2F2",
                          color: "#DC2626",
                        }}
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>

                {/* Staging Grid */}
                <div
                  style={{
                    border: "1px solid #E2E8F0",
                    borderRadius: 12,
                    overflow: "hidden",
                    maxHeight: 280,
                    overflowY: "auto",
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#991B1B", color: "#FFFFFF", textAlign: "left" }}>
                        <th style={{ padding: "8px 10px", width: 36, textAlign: "center" }}>✓</th>
                        <th style={{ padding: "8px 10px", width: 44 }}>S/N</th>
                        <th style={{ padding: "8px 10px", minWidth: 180 }}>ITEM SUPPLY *</th>
                        <th style={{ padding: "8px 10px", width: 130, textAlign: "center" }}>CATEGORY</th>
                        <th style={{ padding: "8px 10px", width: 100, textAlign: "center" }}>QTY AVAIL</th>
                        <th style={{ padding: "8px 10px", width: 100, textAlign: "center" }}>QTY ISSUED</th>
                        <th style={{ padding: "8px 10px", width: 85, textAlign: "center" }}>BALANCE</th>
                        <th style={{ padding: "8px 10px", width: 125 }}>DATE ISSUED</th>
                        <th style={{ padding: "8px 10px", minWidth: 150 }}>FEEDBACK</th>
                        <th style={{ padding: "8px 10px", width: 44, textAlign: "center" }}>DEL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stagingRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={10}
                            style={{
                              padding: "28px 16px",
                              textAlign: "center",
                              color: "#94A3B8",
                              fontWeight: 600,
                            }}
                          >
                            No extracted records yet. Upload an image/PDF above or paste rows to preview here.
                          </td>
                        </tr>
                      ) : (
                        stagingRows.map((row, idx) => (
                          <tr
                            key={row.id}
                            style={{
                              background: row.selected ? "#FFFFFF" : "#F8FAFC",
                              opacity: row.selected ? 1 : 0.6,
                              borderBottom: "1px solid #F1F5F9",
                            }}
                          >
                            <td style={{ padding: "6px 10px", textAlign: "center" }}>
                              <input
                                type="checkbox"
                                checked={row.selected}
                                onChange={(e) => updateStagingCell(row.id, "selected", e.target.checked)}
                                style={{ width: 15, height: 15, cursor: "pointer" }}
                              />
                            </td>
                            <td style={{ padding: "6px 10px", color: "#94A3B8", fontWeight: 700 }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: "6px 10px" }}>
                              <input
                                type="text"
                                value={row.itemSupply}
                                onChange={(e) => updateStagingCell(row.id, "itemSupply", e.target.value)}
                                placeholder="Item name"
                                style={{
                                  ...inp,
                                  padding: "5px 8px",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  borderColor: !row.itemSupply.trim() ? "#FCA5A5" : "#CBD5E1",
                                }}
                              />
                            </td>
                            <td style={{ padding: "6px 10px" }}>
                              <input
                                type="text"
                                value={row.category || ""}
                                onChange={(e) => updateStagingCell(row.id, "category", e.target.value)}
                                placeholder="Category"
                                style={{
                                  ...inp,
                                  padding: "5px 8px",
                                  fontSize: 11,
                                  textAlign: "center",
                                  fontWeight: 700,
                                }}
                              />
                            </td>
                            <td style={{ padding: "6px 10px" }}>
                              <input
                                type="number"
                                min="0"
                                value={row.quantityAvailable ?? ""}
                                onChange={(e) => updateStagingCell(row.id, "quantityAvailable", e.target.value)}
                                style={{
                                  ...inp,
                                  padding: "5px 8px",
                                  fontSize: 12,
                                  textAlign: "center",
                                  fontWeight: 700,
                                }}
                              />
                            </td>
                            <td style={{ padding: "6px 10px" }}>
                              <input
                                type="number"
                                min="0"
                                value={row.quantityIssued ?? ""}
                                onChange={(e) => updateStagingCell(row.id, "quantityIssued", e.target.value)}
                                style={{
                                  ...inp,
                                  padding: "5px 8px",
                                  fontSize: 12,
                                  textAlign: "center",
                                  fontWeight: 700,
                                  color: "#DC2626",
                                }}
                              />
                            </td>
                            <td style={{ padding: "6px 10px", textAlign: "center" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  fontWeight: 800,
                                  fontSize: 11,
                                  background:
                                    row.balance !== null && row.balance !== undefined
                                      ? row.balance <= 0
                                        ? "#FEE2E2"
                                        : "#DCFCE7"
                                      : "#F1F5F9",
                                  color:
                                    row.balance !== null && row.balance !== undefined
                                      ? row.balance <= 0
                                        ? "#991B1B"
                                        : "#166534"
                                      : "#64748B",
                                }}
                              >
                                {row.balance !== null && row.balance !== undefined ? row.balance : "—"}
                              </span>
                            </td>
                            <td style={{ padding: "6px 10px" }}>
                              <input
                                type="date"
                                value={row.dateIssued}
                                onChange={(e) => updateStagingCell(row.id, "dateIssued", e.target.value)}
                                style={{ ...inp, padding: "5px 8px", fontSize: 11 }}
                              />
                            </td>
                            <td style={{ padding: "6px 10px" }}>
                              <input
                                type="text"
                                value={row.feedback}
                                onChange={(e) => updateStagingCell(row.id, "feedback", e.target.value)}
                                placeholder="Remarks, receiver..."
                                style={{ ...inp, padding: "5px 8px", fontSize: 12 }}
                              />
                            </td>
                            <td style={{ padding: "6px 10px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() =>
                                  setStagingRows((prev) => prev.filter((r) => r.id !== row.id))
                                }
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "#94A3B8",
                                  cursor: "pointer",
                                  padding: 4,
                                }}
                              >
                                <Trash2 size={14} color="#EF4444" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #E2E8F0",
                background: "#F8FAFC",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 13, color: "#475569" }}>
                <strong>{stagingRows.filter((r) => r.selected).length}</strong> of{" "}
                <strong>{stagingRows.length}</strong> rows will be saved to MongoDB
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowAiModal(false)}
                  style={{ ...smallBtn, padding: "10px 18px", fontSize: 13 }}
                >
                  Cancel
                </button>
                <LoaderBtn
                  loading={savingBulk}
                  onClick={handleSaveStagingToMongoDB}
                  disabled={stagingRows.filter((r) => r.selected).length === 0}
                  style={{
                    ...btn,
                    background:
                      stagingRows.filter((r) => r.selected).length === 0
                        ? "#94A3B8"
                        : "#059669",
                    padding: "10px 24px",
                    fontSize: 13,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  <CheckCircle2 size={16} /> Save Selected ({stagingRows.filter((r) => r.selected).length}) to MongoDB
                </LoaderBtn>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ── Category Manager Modal (Persistent CRUD in MongoDB) ──────────────── */}
      {showCategoryManager && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1100,
            backdropFilter: "blur(6px)",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 20,
              width: "100%",
              maxWidth: 720,
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 25px 60px rgba(0,0,0,0.35)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 24px",
                background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
                color: "#FFFFFF",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ background: "rgba(255,255,255,0.15)", padding: 7, borderRadius: 9, display: "flex" }}>
                  <Folder size={18} color="#FDE047" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>
                    Manage Supply Categories (MongoDB)
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94A3B8" }}>
                    Create, edit, rename, and delete supply categories stored permanently in your database
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoryManager(false)}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  color: "#FFF",
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "grid", gap: 20 }}>

              {/* Add / Edit Category Form */}
              <form
                onSubmit={handleSaveCategory}
                style={{
                  background: categoryForm._id ? "#FEF2F2" : "#F8FAFC",
                  border: categoryForm._id ? "1.5px solid #FCA5A5" : "1px solid #E2E8F0",
                  borderRadius: 14,
                  padding: 18,
                  display: "grid",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", display: "flex", alignItems: "center", gap: 6 }}>
                    {categoryForm._id ? (
                      <>
                        <Edit size={14} color="#B91C1C" /> Editing Category:{" "}
                        <span style={{ color: "#B91C1C" }}>{categoryForm.name}</span>
                      </>
                    ) : (
                      <>
                        <Plus size={14} color="#059669" /> Add New Supply Category
                      </>
                    )}
                  </div>
                  {categoryForm._id && (
                    <button
                      type="button"
                      onClick={() =>
                        setCategoryForm({ name: "", icon: "🏷️", description: "", color: "#B91C1C" })
                      }
                      style={{
                        background: "none",
                        border: "none",
                        color: "#64748B",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 140px", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>
                      Icon
                    </label>
                    <select
                      value={categoryForm.icon}
                      onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                      style={{ ...inp, fontSize: 16, textAlign: "center", padding: "6px" }}
                    >
                      {["🏷️", "🍹", "🍳", "📝", "🧹", "🔧", "🥐", "🍞", "🥩", "🧼", "📦", "💊", "🎉", "🏋️"].map(
                        (emoji) => (
                          <option key={emoji} value={emoji}>
                            {emoji}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>
                      Category Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Pastries & Bakery, Raw Materials, Equipment..."
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      style={{ ...inp, padding: "7px 10px", fontSize: 12, fontWeight: 700 }}
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <button
                      type="submit"
                      disabled={savingCategory}
                      style={{
                        ...btn,
                        width: "100%",
                        background: categoryForm._id ? "#B91C1C" : "#059669",
                        padding: "8px 14px",
                        fontSize: 12,
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      {savingCategory ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : categoryForm._id ? (
                        <>
                          <Check size={14} /> Update
                        </>
                      ) : (
                        <>
                          <Plus size={14} /> Save
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", display: "block", marginBottom: 4 }}>
                    Description / Purpose (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Brief description of what items belong here..."
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    style={{ ...inp, padding: "6px 10px", fontSize: 12 }}
                  />
                </div>
              </form>

              {/* Saved Categories Table */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#1E293B", marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
                  <span>Existing Categories in MongoDB ({categoriesList.length})</span>
                  <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Click Edit to rename or Trash to delete</span>
                </div>

                <div style={{ border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#F1F5F9", textAlign: "left" }}>
                        <th style={{ padding: "8px 12px", width: 50, textAlign: "center" }}>Icon</th>
                        <th style={{ padding: "8px 12px", minWidth: 160 }}>Category Name</th>
                        <th style={{ padding: "8px 12px" }}>Description</th>
                        <th style={{ padding: "8px 12px", width: 80, textAlign: "center" }}>Items</th>
                        <th style={{ padding: "8px 12px", width: 90, textAlign: "center" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoriesList.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "#94A3B8" }}>
                            {loadingCategories ? "Loading categories from MongoDB..." : "No categories found."}
                          </td>
                        </tr>
                      ) : (
                        categoriesList.map((cat) => {
                          const itemCount = supplies.filter(
                            (s) => (s.category || "").toLowerCase() === cat.name.toLowerCase()
                          ).length;
                          return (
                            <tr key={cat._id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                              <td style={{ padding: "8px 12px", textAlign: "center", fontSize: 16 }}>
                                {cat.icon || "🏷️"}
                              </td>
                              <td style={{ padding: "8px 12px", fontWeight: 800, color: "#0F172A" }}>
                                {cat.name}
                              </td>
                              <td style={{ padding: "8px 12px", color: "#64748B", fontSize: 11 }}>
                                {cat.description || "—"}
                              </td>
                              <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                <span
                                  style={{
                                    background: "#EFF6FF",
                                    color: "#1D4ED8",
                                    fontWeight: 800,
                                    fontSize: 11,
                                    padding: "2px 8px",
                                    borderRadius: 99,
                                  }}
                                >
                                  {itemCount}
                                </span>
                              </td>
                              <td style={{ padding: "8px 12px", textAlign: "center" }}>
                                <div style={{ display: "inline-flex", gap: 6 }}>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setCategoryForm({
                                        _id: cat._id,
                                        name: cat.name,
                                        icon: cat.icon || "🏷️",
                                        description: cat.description || "",
                                        color: cat.color || "#B91C1C",
                                      })
                                    }
                                    style={{
                                      background: "#F8FAFC",
                                      border: "1px solid #CBD5E1",
                                      padding: "4px 8px",
                                      borderRadius: 6,
                                      cursor: "pointer",
                                    }}
                                    title="Edit / Rename Category"
                                  >
                                    <Edit size={13} color="#2563EB" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={deletingCatId === cat._id}
                                    onClick={() => handleDeleteCategory(cat._id, cat.name)}
                                    style={{
                                      background: "#FEF2F2",
                                      border: "1px solid #FECACA",
                                      padding: "4px 8px",
                                      borderRadius: 6,
                                      cursor: "pointer",
                                    }}
                                    title="Delete Category"
                                  >
                                    <Trash2 size={13} color="#DC2626" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid #E2E8F0",
                background: "#F8FAFC",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <button
                type="button"
                onClick={() => setShowCategoryManager(false)}
                style={{ ...smallBtn, padding: "8px 18px", fontSize: 13 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ADD SECTION HEADER / SPACER MODAL ─────────────────────────────── */}
      {showSectionModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 18,
              maxWidth: 480,
              width: "100%",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #FED7AA",
            }}
          >
            <div
              style={{
                padding: "16px 22px",
                borderBottom: "1px solid #FFEDD5",
                background: "linear-gradient(135deg, #FFF7ED 0%, #FFFFFF 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: "#FFEDD5",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#C2410C",
                  }}
                >
                  <FolderPlus size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#9A3412" }}>
                    Add Table Section / Divider
                  </h3>
                  <div style={{ fontSize: 12, color: "#78716C", marginTop: 2 }}>
                    Organize your table into subsections or insert visual dividers
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSectionModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddSectionDivider();
              }}
              style={{ padding: 22, display: "flex", flexDirection: "column", gap: 16 }}
            >
              <div>
                <label style={lbl}>
                  Section Title / Header Name:
                  <input
                    type="text"
                    placeholder="e.g. KITCHEN STORES, BEVERAGES, MORNING SHIFT..."
                    value={newSectionTitle}
                    onChange={(e) => setNewSectionTitle(e.target.value)}
                    style={inp}
                    autoFocus
                  />
                </label>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 5 }}>
                  💡 Tip: Leave empty if you only want to insert a blank visual space line between items.
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setShowSectionModal(false)}
                  style={{ ...smallBtn, padding: "9px 16px" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingSection}
                  onClick={() => handleAddSectionDivider("")}
                  style={{
                    ...smallBtn,
                    padding: "9px 16px",
                    background: "#F1F5F9",
                    color: "#475569",
                    fontWeight: 700,
                  }}
                >
                  Insert Blank Spacer
                </button>
                <LoaderBtn
                  type="submit"
                  loading={savingSection}
                  style={{
                    padding: "9px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "#EA580C",
                    color: "#FFF",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} /> Add Section Header
                </LoaderBtn>
              </div>
            </form>
          </div>
        </div>
      )}

</>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const btn: React.CSSProperties = { padding:"10px 18px",borderRadius:10,border:"none",background:"#ff7f50",color:"#fff",fontWeight:700,cursor:"pointer",fontSize:13 };
const smallBtn: React.CSSProperties = { padding:"7px 12px",borderRadius:7,border:"none",background:"#f3f4f6",color:"#1E1E1E",fontSize:12,fontWeight:600,cursor:"pointer" };
const inp: React.CSSProperties = { padding:"10px 12px",borderRadius:8,border:"1px solid #CBD5E1",fontSize:13,width:"100%",boxSizing:"border-box" };
const lbl: React.CSSProperties = { display:"flex",flexDirection:"column",gap:5,fontSize:12,fontWeight:700,color:"#374151" };
