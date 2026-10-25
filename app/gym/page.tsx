"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL, apiRequest } from "../../lib/api";
import { uploadToCloudinary } from "../../lib/cloudinary";
import LoaderButton from "../../components/LoaderButton";
import { io, Socket } from "socket.io-client";
import {
  Dumbbell,
  Search,
  Filter,
  Plus,
  X,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  User,
  Phone,
  MapPin,
  Camera,
  Download,
  Printer,
  Eye,
  Edit,
  Trash2,
  ShieldCheck,
  RefreshCw,
  QrCode,
  Sparkles,
  CreditCard,
  Target,
  Activity,
  Heart,
  ChevronRight,
  Sliders,
  Award,
  AlertTriangle,
} from "lucide-react";

type GymMember = {
  _id: string;
  userId?: {
    _id?: string;
    displayName?: string;
    username?: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
  } | string;
  memberId?: string;
  membershipType: "registration" | "daily" | "monthly" | "quarterly" | "annual" | string;
  startDate: string;
  endDate: string;
  totalDays: number;
  daysRemaining: number;
  isActive: boolean;
  amount: number;
  status: "pending" | "approved" | "rejected" | "expired";
  notes?: string;
  branchId?: string;

  // Application & Profile fields
  fullName?: string;
  passportPhoto?: string;
  dob?: string;
  phone?: string;
  livingAddress?: string;
  height?: string;
  weight?: string;
  goal?: string;
  focus?: string;
  emergencyContact?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
  medicalNotes?: string;

  // Verification & Payment
  paymentConfirmed?: boolean;
  paymentConfirmedAt?: string;
  approvedAt?: string;
  cardIssued?: boolean;
  cardIssuedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

const GYM_PLANS: Record<string, { label: string; price: number; days: number; color: string; badge: string }> = {
  registration: { label: "One-Time Registration", price: 5000, days: 0, color: "#6366F1", badge: "Registered Member" },
  daily: { label: "Daily Gym Pass", price: 1500, days: 1, color: "#F59E0B", badge: "Daily Guest" },
  monthly: { label: "Monthly Unlimited", price: 35000, days: 30, color: "#10B981", badge: "Monthly VIP" },
  quarterly: { label: "Quarterly (3 Months)", price: 95000, days: 90, color: "#3B82F6", badge: "Quarterly Pro" },
  annual: { label: "Annual Platinum Pass", price: 350000, days: 365, color: "#8B5CF6", badge: "Annual Platinum" },
};

const FITNESS_GOALS = [
  "Weight Loss & Fat Burning",
  "Muscle Building & Hypertrophy",
  "Strength & Conditioning",
  "Cardiovascular Endurance",
  "Body Toning & Flexibility",
  "General Wellness & Fitness",
  "Athletic Sports Performance",
  "Physical Rehabilitation",
];

const FOCUS_AREAS = [
  "Full Body Conditioning",
  "Core, Abs & Waist",
  "Upper Body & Chest/Arms",
  "Lower Body, Glutes & Legs",
  "Cardio & HIIT Training",
  "Back, Spine & Posture",
  "Mobility & Joint Health",
];

export default function GymManagementPage() {
  const [members, setMembers] = useState<GymMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<{
    totalMembers: number;
    activeMembers: number;
    pendingApplications: number;
    expiredMembers: number;
    totalRevenue: number;
  }>({
    totalMembers: 0,
    activeMembers: 0,
    pendingApplications: 0,
    expiredMembers: 0,
    totalRevenue: 0,
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [selectedMemberDossier, setSelectedMemberDossier] = useState<GymMember | null>(null);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [editingMember, setEditingMember] = useState<GymMember | null>(null);
  const [cardModalMember, setCardModalMember] = useState<GymMember | null>(null);
  const [cardSide, setCardSide] = useState<"front" | "back">("front");

  // Registration Form State
  const [regFullName, setRegFullName] = useState("");
  const [regDob, setRegDob] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regAddress, setRegAddress] = useState("");
  const [regHeight, setRegHeight] = useState("");
  const [regWeight, setRegWeight] = useState("");
  const [regGoal, setRegGoal] = useState(FITNESS_GOALS[0]);
  const [regFocus, setRegFocus] = useState(FOCUS_AREAS[0]);
  const [regEmergencyName, setRegEmergencyName] = useState("");
  const [regEmergencyPhone, setRegEmergencyPhone] = useState("");
  const [regMedical, setRegMedical] = useState("");
  const [regPlan, setRegPlan] = useState<string>("monthly");
  const [regAmount, setRegAmount] = useState<number>(35000);
  const [regStartDate, setRegStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [regAutoApprove, setRegAutoApprove] = useState(true);
  const [regPassportFile, setRegPassportFile] = useState<File | null>(null);
  const [regPassportPreview, setRegPassportPreview] = useState<string>("");
  const [regSubmitting, setRegSubmitting] = useState(false);

  // Action loaders
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingCardPdf, setDownloadingCardPdf] = useState(false);

  const cardRefFront = useRef<HTMLDivElement | null>(null);
  const cardRefBack = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Auto-clear alerts
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 4000);
      return () => clearTimeout(t);
    }
  }, [successMsg]);

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(null), 6000);
      return () => clearTimeout(t);
    }
  }, [error]);

  // ─── Fetch Members & Stats ──────────────────────────────────────────────────
  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await apiRequest("/api/gym/memberships/admin/all");
      if (res && Array.isArray(res.documents)) {
        setMembers(res.documents);
      }
    } catch (err: any) {
      console.warn("Gym members fetch notice:", err.message);
      setError("Failed to load gym members: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await apiRequest("/api/gym/admin/stats");
      if (res) {
        setStats(res);
      }
    } catch (err: any) {
      console.warn("Gym stats notice:", err.message);
    }
  };

  useEffect(() => {
    fetchMembers();
    fetchStats();
  }, []);

  // ─── Socket.IO Live Listener ────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(API_BASE_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_channel", "admin_channel");
      socket.emit("join_channel", "support_services");
    });

    const handleLiveRefresh = () => {
      fetchMembers();
      fetchStats();
    };

    socket.on("new_gym_application", (app: any) => {
      setSuccessMsg(`New gym application received from ${app.fullName || "applicant"}!`);
      handleLiveRefresh();
    });

    socket.on("gym_membership_updated", handleLiveRefresh);
    socket.on("gym_membership_approved", handleLiveRefresh);

    return () => {
      socket.disconnect();
    };
  }, []);

  // Update plan price automatically when plan dropdown changes
  const handlePlanChange = (type: string) => {
    setRegPlan(type);
    const plan = GYM_PLANS[type];
    if (plan) {
      setRegAmount(plan.price);
    }
  };

  // Handle passport photo selection
  const handlePassportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRegPassportFile(file);
    const preview = URL.createObjectURL(file);
    setRegPassportPreview(preview);
  };

  // ─── Submit Walk-In Registration ───────────────────────────────────────────
  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegSubmitting(true);
    setError(null);

    try {
      let uploadedPassportUrl = "";
      if (regPassportFile) {
        try {
          uploadedPassportUrl = await uploadToCloudinary(regPassportFile, "gym_passports");
        } catch (err: any) {
          setError("Passport upload failed: " + err.message);
          setRegSubmitting(false);
          return;
        }
      }

      const payload = {
        fullName: regFullName,
        dob: regDob,
        phone: regPhone,
        livingAddress: regAddress,
        height: regHeight,
        weight: regWeight,
        goal: regGoal,
        focus: regFocus,
        emergencyContact: {
          name: regEmergencyName,
          phone: regEmergencyPhone,
        },
        medicalNotes: regMedical,
        membershipType: regPlan,
        amount: regAmount,
        startDate: regStartDate,
        autoApprove: regAutoApprove,
        paymentConfirmed: regAutoApprove,
        passportPhoto: uploadedPassportUrl || regPassportPreview,
      };

      await apiRequest("/api/gym/admin/create-member", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSuccessMsg(`Member ${regFullName} registered successfully!`);
      setShowRegisterModal(false);
      resetRegisterForm();
      fetchMembers();
      fetchStats();
    } catch (err: any) {
      setError("Registration failed: " + err.message);
    } finally {
      setRegSubmitting(false);
    }
  };

  const resetRegisterForm = () => {
    setRegFullName("");
    setRegDob("");
    setRegPhone("");
    setRegAddress("");
    setRegHeight("");
    setRegWeight("");
    setRegEmergencyName("");
    setRegEmergencyPhone("");
    setRegMedical("");
    setRegPlan("monthly");
    setRegAmount(35000);
    setRegStartDate(new Date().toISOString().split("T")[0]);
    setRegPassportFile(null);
    setRegPassportPreview("");
    setRegAutoApprove(true);
  };

  // ─── Confirm Payment & Approve ──────────────────────────────────────────────
  const handleApproveMembership = async (member: GymMember) => {
    if (!confirm(`Confirm payment and approve gym membership for ${member.fullName || "this applicant"}?`)) return;
    setApprovingId(member._id);
    try {
      const res = await apiRequest(`/api/gym/memberships/${member._id}/approve`, {
        method: "POST",
      });
      setSuccessMsg(`Membership approved! Member ID ${res.memberId || "generated"} is now ACTIVE.`);
      if (selectedMemberDossier?._id === member._id) {
        setSelectedMemberDossier(res);
      }
      fetchMembers();
      fetchStats();
    } catch (err: any) {
      setError("Approval failed: " + err.message);
    } finally {
      setApprovingId(null);
    }
  };

  // ─── Reject Application ────────────────────────────────────────────────────
  const handleRejectMembership = async (member: GymMember) => {
    const reason = prompt("Enter rejection reason or note for applicant:", "Incomplete documentation or unconfirmed payment");
    if (reason === null) return;
    setRejectingId(member._id);
    try {
      await apiRequest(`/api/gym/memberships/${member._id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setSuccessMsg(`Application for ${member.fullName || "applicant"} marked as rejected.`);
      if (selectedMemberDossier?._id === member._id) {
        setSelectedMemberDossier(null);
      }
      fetchMembers();
      fetchStats();
    } catch (err: any) {
      setError("Rejection failed: " + err.message);
    } finally {
      setRejectingId(null);
    }
  };

  // ─── Delete Membership Record ──────────────────────────────────────────────
  const handleDeleteMembership = async (id: string) => {
    if (!confirm("Delete this membership record permanently?")) return;
    setDeletingId(id);
    try {
      await apiRequest(`/api/gym/memberships/${id}`, {
        method: "DELETE",
      });
      setSuccessMsg("Membership record deleted.");
      if (selectedMemberDossier?._id === id) setSelectedMemberDossier(null);
      fetchMembers();
      fetchStats();
    } catch (err: any) {
      setError("Delete failed: " + err.message);
    } finally {
      setDeletingId(null);
    }
  };

  // ─── Generate & Download Printable CR80 Card PDF ───────────────────────────
  const downloadMembershipCardPdf = async (member: GymMember) => {
    const frontEl = cardRefFront.current;
    const backEl = cardRefBack.current;
    if (!frontEl || !backEl) {
      alert("Membership card is still rendering. Please wait a second.");
      return;
    }

    setDownloadingCardPdf(true);
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);

      const [fc, bc] = await Promise.all([
        html2canvas(frontEl, { scale: 3, useCORS: true, allowTaint: true }),
        html2canvas(backEl, { scale: 3, useCORS: true, allowTaint: true }),
      ]);

      // Standard CR80 landscape dimensions: 85.6mm x 54mm
      // Front and Back printed side-by-side
      const W = 85.6;
      const H = 54;
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [W * 2 + 25, H + 26],
      });

      // Add Front
      pdf.addImage(fc.toDataURL("image/png"), "PNG", 8, 8, W, H);
      // Add Back
      pdf.addImage(bc.toDataURL("image/png"), "PNG", W + 16, 8, W, H);

      pdf.setFontSize(7);
      pdf.setTextColor(100);
      pdf.text("FRONT SIDE (85.6 × 54 mm)", 8 + W / 2, H + 14, { align: "center" });
      pdf.text("BACK SIDE (85.6 × 54 mm)", W + 16 + W / 2, H + 14, { align: "center" });

      pdf.setFontSize(6);
      pdf.setTextColor(140);
      pdf.text(
        `360 Degree Global Gym & Fitness Club · Member Pass · Issued ${new Date().toLocaleDateString("en-GB")}`,
        W * 2 + 16,
        H + 20,
        { align: "right" }
      );

      const filename = `GYM_CARD_${(member.fullName || "Member").replace(/\s+/g, "_")}_${member.memberId || member._id.slice(0, 6)}.pdf`;
      pdf.save(filename);
      setSuccessMsg("Official Gym Membership Card PDF downloaded!");
    } catch (err: any) {
      setError("Card PDF generation failed: " + err.message);
    } finally {
      setDownloadingCardPdf(false);
    }
  };

  // ─── Filtered Members List ─────────────────────────────────────────────────
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Status filter
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      // Plan filter
      if (planFilter !== "all" && m.membershipType !== planFilter) return false;
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (m.fullName || "").toLowerCase();
        const memId = (m.memberId || "").toLowerCase();
        const phone = (m.phone || "").toLowerCase();
        const goal = (m.goal || "").toLowerCase();
        const addr = (m.livingAddress || "").toLowerCase();
        const type = (m.membershipType || "").toLowerCase();
        return (
          name.includes(q) ||
          memId.includes(q) ||
          phone.includes(q) ||
          goal.includes(q) ||
          addr.includes(q) ||
          type.includes(q)
        );
      }
      return true;
    });
  }, [members, statusFilter, planFilter, searchQuery]);

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .gym-panel { animation: fadeIn 0.25s ease-out; }
        .gym-table-scroll::-webkit-scrollbar { height: 8px; }
        .gym-table-scroll::-webkit-scrollbar-track { background: #F1F5F9; border-radius: 4px; }
        .gym-table-scroll::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 4px; }
        .gym-table-scroll::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
        .card-perspective { perspective: 1000px; }
      `}</style>

      <div className="gym-panel" style={{ padding: "24px 28px", maxWidth: 1440, margin: "0 auto" }}>
        {/* Alerts */}
        {successMsg && (
          <div style={{
            background: "#ECFDF5", border: "1px solid #10B981", color: "#065F46",
            padding: "12px 16px", borderRadius: 10, marginBottom: 16,
            display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 600,
          }}>
            <CheckCircle2 size={18} color="#10B981" />
            <span>{successMsg}</span>
          </div>
        )}

        {error && (
          <div style={{
            background: "#FEF2F2", border: "1px solid #EF4444", color: "#991B1B",
            padding: "12px 16px", borderRadius: 10, marginBottom: 16,
            display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, fontWeight: 600,
          }}>
            <AlertCircle size={18} color="#EF4444" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Header & Action Bar ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: "linear-gradient(135deg, #FF7F50 0%, #EA580C 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", boxShadow: "0 4px 12px rgba(255,127,80,0.35)",
              }}>
                <Dumbbell size={22} />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "#0F172A", letterSpacing: "-0.5px" }}>
                  Gym & Fitness Club Management
                </h1>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#64748B" }}>
                  Manage registrations, verify payments, approve applications, and issue official member cards.
                </p>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <LoaderButton
              onClick={() => { fetchMembers(); fetchStats(); }}
              loading={loading}
              style={{
                padding: "10px 14px", borderRadius: 10, border: "1px solid #CBD5E1",
                background: "#fff", color: "#475569", fontWeight: 700, fontSize: 13,
                display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
              }}
            >
              <RefreshCw size={14} /> Refresh
            </LoaderButton>

            <button
              onClick={() => { resetRegisterForm(); setShowRegisterModal(true); }}
              style={{
                padding: "10px 18px", borderRadius: 10, border: "none",
                background: "linear-gradient(135deg, #FF7F50 0%, #EA580C 100%)",
                color: "#fff", fontWeight: 800, fontSize: 13.5,
                display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer",
                boxShadow: "0 4px 14px rgba(255,127,80,0.35)",
              }}
            >
              <Plus size={16} /> + Register Walk-In Member
            </button>
          </div>
        </div>

        {/* ── KPI Overview Cards ── */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 16, marginBottom: 24,
        }}>
          {/* Active Members */}
          <div style={{
            background: "#fff", borderRadius: 14, padding: "18px 20px",
            border: "1px solid #E2E8F0", borderLeft: "4px solid #10B981",
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#059669", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Active Subscriptions
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#064E3B", marginTop: 4 }}>
              {stats.activeMembers} Members
            </div>
            <div style={{ fontSize: 11.5, color: "#6EE7B7", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
              <ShieldCheck size={13} /> Current active pass holders
            </div>
          </div>

          {/* Pending Applications */}
          <div style={{
            background: stats.pendingApplications > 0 ? "#FEF2F2" : "#fff",
            borderRadius: 14, padding: "18px 20px",
            border: stats.pendingApplications > 0 ? "1px solid #FECACA" : "1px solid #E2E8F0",
            borderLeft: "4px solid #EF4444",
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#DC2626", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Pending Applications
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#991B1B", marginTop: 4 }}>
              {stats.pendingApplications} Requests
            </div>
            <div style={{ fontSize: 11.5, color: "#F87171", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
              <Clock size={13} /> Awaiting payment approval
            </div>
          </div>

          {/* Total Enrolled */}
          <div style={{
            background: "#fff", borderRadius: 14, padding: "18px 20px",
            border: "1px solid #E2E8F0", borderLeft: "4px solid #3B82F6",
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#2563EB", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Total Registered
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#1E3A8A", marginTop: 4 }}>
              {stats.totalMembers} Enrolled
            </div>
            <div style={{ fontSize: 11.5, color: "#93C5FD", marginTop: 2 }}>
              Lifetime membership database
            </div>
          </div>

          {/* Expired / Due */}
          <div style={{
            background: "#fff", borderRadius: 14, padding: "18px 20px",
            border: "1px solid #E2E8F0", borderLeft: "4px solid #F59E0B",
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#D97706", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Expired Passes
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#92400E", marginTop: 4 }}>
              {stats.expiredMembers} Expired
            </div>
            <div style={{ fontSize: 11.5, color: "#FCD34D", marginTop: 2 }}>
              Due for monthly renewal
            </div>
          </div>

          {/* Revenue */}
          <div style={{
            background: "linear-gradient(135deg, #FFF7ED 0%, #FFFFFF 100%)",
            borderRadius: 14, padding: "18px 20px",
            border: "1px solid #FFEDD5", borderLeft: "4px solid #FF7F50",
            boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: "#EA580C", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Total Gym Revenue
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#C2410C", marginTop: 4 }}>
              ₦{stats.totalRevenue.toLocaleString()}
            </div>
            <div style={{ fontSize: 11.5, color: "#FB923C", marginTop: 2 }}>
              Verified member payments
            </div>
          </div>
        </div>

        {/* ── Main Data Card ── */}
        <div style={{
          background: "#fff", borderRadius: 16, border: "1px solid #E2E8F0",
          boxShadow: "0 4px 16px rgba(0,0,0,0.04)", overflow: "hidden",
        }}>
          {/* Status Tabs */}
          <div style={{
            display: "flex", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC",
            padding: "0 16px", overflowX: "auto",
          }}>
            {[
              { id: "all", label: "All Members", count: members.length },
              {
                id: "pending",
                label: "Pending Approval",
                count: members.filter((m) => m.status === "pending").length,
                badgeColor: "#EF4444",
              },
              {
                id: "approved",
                label: "Active Members",
                count: members.filter((m) => m.status === "approved").length,
                badgeColor: "#10B981",
              },
              {
                id: "expired",
                label: "Expired",
                count: members.filter((m) => m.status === "expired").length,
              },
              {
                id: "rejected",
                label: "Rejected",
                count: members.filter((m) => m.status === "rejected").length,
              },
            ].map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  style={{
                    background: "none", border: "none",
                    padding: "16px 18px", fontSize: 13.5, fontWeight: active ? 800 : 600,
                    color: active ? "#FF7F50" : "#64748B",
                    borderBottom: active ? "3px solid #FF7F50" : "3px solid transparent",
                    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
                    whiteSpace: "nowrap", transition: "all 0.15s",
                  }}
                >
                  <span>{tab.label}</span>
                  <span style={{
                    padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                    background: active ? "#FF7F50" : tab.badgeColor ? tab.badgeColor : "#E2E8F0",
                    color: active || tab.badgeColor ? "#fff" : "#475569",
                  }}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Filter Bar */}
          <div style={{
            padding: "16px 20px", borderBottom: "1px solid #E2E8F0",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexWrap: "wrap", gap: 14, background: "#FFFFFF",
          }}>
            {/* Search input */}
            <div style={{ position: "relative", flex: 1, minWidth: 260, maxWidth: 440 }}>
              <Search size={16} color="#94A3B8" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search member name, ID, phone, goal, or address..."
                style={{
                  width: "100%", padding: "9px 12px 9px 36px",
                  borderRadius: 10, border: "1px solid #CBD5E1", fontSize: 13,
                  outline: "none", background: "#F8FAFC", boxSizing: "border-box",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Plan filter */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Filter size={15} color="#64748B" />
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#64748B" }}>Plan:</span>
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                style={{
                  padding: "8px 12px", borderRadius: 8, border: "1px solid #CBD5E1",
                  fontSize: 12.5, fontWeight: 600, color: "#1E293B", outline: "none", background: "#F8FAFC",
                }}
              >
                <option value="all">All Plans</option>
                <option value="registration">Registration (₦5,000)</option>
                <option value="daily">Daily Pass (₦1,500)</option>
                <option value="monthly">Monthly Sub (₦35,000)</option>
                <option value="quarterly">Quarterly Sub (₦95,000)</option>
                <option value="annual">Annual Sub (₦350,000)</option>
              </select>
            </div>
          </div>

          {/* Members Table */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#94A3B8" }}>
              <div style={{
                width: 40, height: 40, border: "3px solid #E2E8F0",
                borderTop: "3px solid #FF7F50", borderRadius: "50%",
                animation: "spin 0.8s linear infinite", margin: "0 auto 12px",
              }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Loading gym membership records...</div>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <Dumbbell size={40} color="#CBD5E1" style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>No gym members found</div>
              <p style={{ margin: "4px 0 16px", fontSize: 13, color: "#64748B" }}>
                {searchQuery || statusFilter !== "all" || planFilter !== "all"
                  ? "Try clearing your filters or search terms."
                  : "Start registering members or approving applications."}
              </p>
              <button
                onClick={() => { resetRegisterForm(); setShowRegisterModal(true); }}
                style={{
                  padding: "9px 18px", borderRadius: 8, border: "none",
                  background: "#FF7F50", color: "#fff", fontWeight: 700, fontSize: 13,
                  cursor: "pointer",
                }}
              >
                + Register First Member
              </button>
            </div>
          ) : (
            <div className="gym-table-scroll" style={{ overflowX: "auto", width: "100%", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: 1200, borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                    <th style={{ padding: "14px 14px", width: 40 }}>#</th>
                    <th style={{ padding: "14px 14px" }}>Member Identity</th>
                    <th style={{ padding: "14px 14px" }}>Contact & Address</th>
                    <th style={{ padding: "14px 14px" }}>Fitness Profile</th>
                    <th style={{ padding: "14px 14px" }}>Plan & Fee</th>
                    <th style={{ padding: "14px 14px" }}>Pass Validity</th>
                    <th style={{ padding: "14px 14px", textAlign: "center" }}>Payment & Status</th>
                    <th style={{ padding: "14px 14px", textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((m, idx) => {
                    const planInfo = GYM_PLANS[m.membershipType] || {
                      label: m.membershipType,
                      color: "#64748B",
                      badge: "Member",
                      price: m.amount,
                    };
                    const isPending = m.status === "pending";
                    const isApproved = m.status === "approved";

                    return (
                      <tr
                        key={m._id}
                        style={{
                          borderBottom: "1px solid #F1F5F9",
                          transition: "background 0.15s",
                          background: isPending ? "#FFFDFD" : "transparent",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = isPending ? "#FFFDFD" : "transparent")}
                      >
                        <td style={{ padding: "14px", fontSize: 12, fontWeight: 700, color: "#94A3B8" }}>
                          {idx + 1}
                        </td>

                        {/* Member Identity (Passport + Name + ID) */}
                        <td style={{ padding: "14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            {/* Passport Photo Thumbnail */}
                            <div
                              onClick={() => setSelectedMemberDossier(m)}
                              style={{
                                width: 46, height: 52, borderRadius: 8,
                                overflow: "hidden", flexShrink: 0,
                                border: "1.5px solid #CBD5E1",
                                background: "#E2E8F0", cursor: "pointer",
                                position: "relative",
                              }}
                              title="Click to view full dossier"
                            >
                              {m.passportPhoto ? (
                                <img
                                  src={m.passportPhoto}
                                  alt={m.fullName || "Passport"}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              ) : (
                                <div style={{
                                  width: "100%", height: "100%",
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  color: "#94A3B8", background: "#F1F5F9",
                                }}>
                                  <User size={20} />
                                </div>
                              )}
                            </div>

                            <div>
                              <div
                                onClick={() => setSelectedMemberDossier(m)}
                                style={{
                                  fontWeight: 800, fontSize: 14, color: "#0F172A",
                                  cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
                                }}
                              >
                                {m.fullName || (typeof m.userId === "object" ? m.userId?.displayName || m.userId?.username : "Applicant")}
                              </div>
                              <div style={{ marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{
                                  fontFamily: "monospace", fontSize: 11, fontWeight: 700,
                                  color: "#FF7F50", background: "#FFF7ED",
                                  padding: "1px 6px", borderRadius: 4, border: "1px solid #FFEDD5",
                                }}>
                                  {m.memberId || "ID PENDING"}
                                </span>
                                {m.dob && (
                                  <span style={{ fontSize: 11, color: "#64748B" }}>
                                    DOB: {m.dob}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Contact & Address */}
                        <td style={{ padding: "14px", maxWidth: 220 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", display: "flex", alignItems: "center", gap: 5 }}>
                            <Phone size={12} color="#64748B" />
                            {m.phone || (typeof m.userId === "object" ? m.userId?.phone : "—") || "No phone"}
                          </div>
                          <div style={{
                            fontSize: 11.5, color: "#64748B", marginTop: 3,
                            display: "flex", alignItems: "center", gap: 4,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            <MapPin size={11} color="#94A3B8" style={{ flexShrink: 0 }} />
                            <span>{m.livingAddress || "Address not provided"}</span>
                          </div>
                        </td>

                        {/* Fitness Profile (Height, Weight, Goal, Focus) */}
                        <td style={{ padding: "14px" }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12 }}>
                            <span style={{ background: "#EFF6FF", color: "#1D4ED8", padding: "2px 7px", borderRadius: 5, fontWeight: 700 }}>
                              {m.height || "— cm"}
                            </span>
                            <span style={{ background: "#ECFDF5", color: "#047857", padding: "2px 7px", borderRadius: 5, fontWeight: 700 }}>
                              {m.weight || "— kg"}
                            </span>
                          </div>
                          <div style={{ fontSize: 11.5, color: "#0F172A", fontWeight: 700, marginTop: 4 }}>
                            {m.goal || "General Fitness"}
                          </div>
                          <div style={{ fontSize: 10.5, color: "#64748B" }}>
                            Focus: {m.focus || "Full Body"}
                          </div>
                        </td>

                        {/* Plan & Pricing */}
                        <td style={{ padding: "14px" }}>
                          <div style={{ fontWeight: 800, fontSize: 13, color: planInfo.color }}>
                            {planInfo.label}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 900, color: "#0F172A", marginTop: 2 }}>
                            ₦{(Number(m.amount) || 0).toLocaleString()}
                          </div>
                        </td>

                        {/* Dates & Validity */}
                        <td style={{ padding: "14px" }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#1E293B" }}>
                            {m.startDate} → {m.endDate}
                          </div>
                          <div style={{ fontSize: 11, color: isApproved ? "#059669" : "#64748B", marginTop: 2, fontWeight: 600 }}>
                            {isApproved ? `${m.daysRemaining} days left` : "Not activated"}
                          </div>
                        </td>

                        {/* Payment & Status */}
                        <td style={{ padding: "14px", textAlign: "center" }}>
                          <span style={{
                            padding: "4px 10px", borderRadius: 999, fontSize: 11, fontWeight: 800,
                            textTransform: "capitalize", display: "inline-block",
                            background: m.status === "approved" ? "#DCFCE7" : m.status === "pending" ? "#FEF3C7" : m.status === "expired" ? "#F1F5F9" : "#FEE2E2",
                            color: m.status === "approved" ? "#166534" : m.status === "pending" ? "#B45309" : m.status === "expired" ? "#475569" : "#991B1B",
                          }}>
                            {m.status === "approved" ? "Active / Paid" : m.status === "pending" ? "Pending Payment" : m.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "14px", textAlign: "center" }}>
                          <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                            {/* View Application Dossier */}
                            <button
                              onClick={() => setSelectedMemberDossier(m)}
                              style={{
                                padding: "6px 10px", borderRadius: 7, border: "1px solid #CBD5E1",
                                background: "#fff", color: "#1E293B", fontSize: 12, fontWeight: 700,
                                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
                              }}
                              title="View Application Dossier & Passport"
                            >
                              <Eye size={13} /> Dossier
                            </button>

                            {/* Approve if pending */}
                            {isPending && (
                              <LoaderButton
                                onClick={() => handleApproveMembership(m)}
                                loading={approvingId === m._id}
                                style={{
                                  padding: "6px 12px", borderRadius: 7, border: "none",
                                  background: "#10B981", color: "#fff", fontSize: 12, fontWeight: 800,
                                  cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
                                }}
                                title="Confirm payment & activate pass"
                              >
                                <Check size={13} /> Approve
                              </LoaderButton>
                            )}

                            {/* Generate / View Membership Card */}
                            {isApproved && (
                              <button
                                onClick={() => { setCardModalMember(m); setCardSide("front"); }}
                                style={{
                                  padding: "6px 11px", borderRadius: 7, border: "1px solid #FCD34D",
                                  background: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)",
                                  color: "#92400E", fontSize: 12, fontWeight: 800,
                                  cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
                                }}
                                title="View & Download official Gym Membership Card"
                              >
                                <CreditCard size={13} /> Card
                              </button>
                            )}

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteMembership(m._id)}
                              style={{
                                padding: "6px 8px", borderRadius: 7, border: "none",
                                background: "#FEE2E2", color: "#DC2626", fontSize: 12,
                                cursor: "pointer",
                              }}
                              title="Delete record"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ════ MODAL 1: APPLICATION DOSSIER VIEW ════ */}
        {selectedMemberDossier && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}>
            <div style={{
              background: "#fff", width: "100%", maxWidth: 680, borderRadius: 20,
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)", overflow: "hidden", maxHeight: "92vh",
              display: "flex", flexDirection: "column",
            }}>
              {/* Header */}
              <div style={{
                padding: "20px 24px", borderBottom: "1px solid #E2E8F0",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)",
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}>
                    <Dumbbell size={20} color="#FF7F50" />
                    Gym Application Dossier · {selectedMemberDossier.memberId || "Pending Verification"}
                  </h3>
                  <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#64748B" }}>
                    Official member profile & health questionnaire
                  </p>
                </div>
                <button
                  onClick={() => setSelectedMemberDossier(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Dossier Content */}
              <div style={{ padding: 24, overflowY: "auto", flex: 1, display: "grid", gap: 20 }}>
                {/* Top Member Card Banner */}
                <div style={{
                  background: "#F8FAFC", borderRadius: 14, padding: 18, border: "1px solid #E2E8F0",
                  display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap",
                }}>
                  {/* Large Passport Photo */}
                  <div style={{
                    width: 90, height: 110, borderRadius: 10,
                    overflow: "hidden", border: "2px solid #CBD5E1",
                    background: "#E2E8F0", flexShrink: 0,
                  }}>
                    {selectedMemberDossier.passportPhoto ? (
                      <img
                        src={selectedMemberDossier.passportPhoto}
                        alt="Passport"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8" }}>
                        <User size={36} />
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 19, fontWeight: 900, color: "#0F172A" }}>
                      {selectedMemberDossier.fullName}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
                      Member ID: <strong style={{ color: "#FF7F50" }}>{selectedMemberDossier.memberId || "Awaiting Approval"}</strong>
                    </div>

                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 800,
                        background: selectedMemberDossier.status === "approved" ? "#DCFCE7" : "#FEF3C7",
                        color: selectedMemberDossier.status === "approved" ? "#166534" : "#B45309",
                      }}>
                        ● {selectedMemberDossier.status === "approved" ? "Active Member" : "Application Pending"}
                      </span>
                      <span style={{
                        padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 800,
                        background: "#EFF6FF", color: "#1D4ED8",
                      }}>
                        {GYM_PLANS[selectedMemberDossier.membershipType]?.label || selectedMemberDossier.membershipType}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Personal & Contact Grid */}
                <div>
                  <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Personal Information
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: 11, color: "#64748B" }}>Date of Birth</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", marginTop: 2 }}>
                        {selectedMemberDossier.dob || "—"}
                      </div>
                    </div>
                    <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: 11, color: "#64748B" }}>Phone Number</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", marginTop: 2 }}>
                        {selectedMemberDossier.phone || "—"}
                      </div>
                    </div>
                  </div>
                  <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 8, border: "1px solid #E2E8F0", marginTop: 8 }}>
                    <div style={{ fontSize: 11, color: "#64748B" }}>Living Address</div>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#0F172A", marginTop: 2 }}>
                      {selectedMemberDossier.livingAddress || "Address not provided"}
                    </div>
                  </div>
                </div>

                {/* Health & Fitness Profile */}
                <div>
                  <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Physical Metrics & Fitness Goals
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div style={{ background: "#EFF6FF", padding: 12, borderRadius: 8, border: "1px solid #BFDBFE" }}>
                      <div style={{ fontSize: 11, color: "#1E40AF" }}>Height</div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#1E3A8A", marginTop: 2 }}>
                        {selectedMemberDossier.height ? `${selectedMemberDossier.height}` : "—"}
                      </div>
                    </div>
                    <div style={{ background: "#ECFDF5", padding: 12, borderRadius: 8, border: "1px solid #A7F3D0" }}>
                      <div style={{ fontSize: 11, color: "#065F46" }}>Weight</div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#064E3B", marginTop: 2 }}>
                        {selectedMemberDossier.weight ? `${selectedMemberDossier.weight}` : "—"}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                    <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: 11, color: "#64748B" }}>Fitness Goal</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginTop: 2 }}>
                        {selectedMemberDossier.goal || "General Fitness"}
                      </div>
                    </div>
                    <div style={{ background: "#F8FAFC", padding: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: 11, color: "#64748B" }}>Focus Area</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginTop: 2 }}>
                        {selectedMemberDossier.focus || "Full Body"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact & Medical Notes */}
                <div>
                  <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 800, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Emergency & Medical Details
                  </h4>
                  <div style={{ background: "#FFFBEB", padding: 12, borderRadius: 8, border: "1px solid #FDE68A" }}>
                    <div style={{ fontSize: 11, color: "#92400E", fontWeight: 700 }}>Emergency Contact</div>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: "#78350F", marginTop: 2 }}>
                      {selectedMemberDossier.emergencyContact?.name || "Not specified"}{" "}
                      {selectedMemberDossier.emergencyContact?.phone && `(${selectedMemberDossier.emergencyContact.phone})`}
                    </div>
                  </div>
                  {selectedMemberDossier.medicalNotes && (
                    <div style={{ background: "#FEF2F2", padding: 12, borderRadius: 8, border: "1px solid #FECACA", marginTop: 8 }}>
                      <div style={{ fontSize: 11, color: "#991B1B", fontWeight: 700 }}>Medical Notes / Allergies</div>
                      <div style={{ fontSize: 13, color: "#7F1D1D", marginTop: 2 }}>
                        {selectedMemberDossier.medicalNotes}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Dossier Footer Actions */}
              <div style={{
                padding: "16px 24px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC",
                display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10,
              }}>
                <button
                  onClick={() => setSelectedMemberDossier(null)}
                  style={{
                    padding: "9px 16px", borderRadius: 8, border: "1px solid #CBD5E1",
                    background: "#fff", color: "#475569", fontWeight: 700, fontSize: 13, cursor: "pointer",
                  }}
                >
                  Close Dossier
                </button>

                <div style={{ display: "flex", gap: 10 }}>
                  {selectedMemberDossier.status === "pending" && (
                    <>
                      <button
                        onClick={() => handleRejectMembership(selectedMemberDossier)}
                        style={{
                          padding: "9px 16px", borderRadius: 8, border: "1px solid #FCA5A5",
                          background: "#FEF2F2", color: "#B91C1C", fontWeight: 700, fontSize: 13, cursor: "pointer",
                        }}
                      >
                        Reject Application
                      </button>
                      <LoaderButton
                        onClick={() => handleApproveMembership(selectedMemberDossier)}
                        loading={approvingId === selectedMemberDossier._id}
                        style={{
                          padding: "9px 20px", borderRadius: 8, border: "none",
                          background: "#10B981", color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer",
                          display: "inline-flex", alignItems: "center", gap: 6,
                        }}
                      >
                        <Check size={16} /> Confirm Payment & Approve
                      </LoaderButton>
                    </>
                  )}

                  {selectedMemberDossier.status === "approved" && (
                    <button
                      onClick={() => {
                        setCardModalMember(selectedMemberDossier);
                        setSelectedMemberDossier(null);
                      }}
                      style={{
                        padding: "9px 18px", borderRadius: 8, border: "none",
                        background: "linear-gradient(135deg, #FF7F50 0%, #EA580C 100%)",
                        color: "#fff", fontWeight: 800, fontSize: 13, cursor: "pointer",
                        display: "inline-flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <CreditCard size={15} /> View Official Member Card
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ MODAL 2: WALK-IN / MANUAL REGISTRATION ════ */}
        {showRegisterModal && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(15, 23, 42, 0.7)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}>
            <div style={{
              background: "#fff", width: "100%", maxWidth: 660, borderRadius: 20,
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)", overflow: "hidden", maxHeight: "94vh",
              display: "flex", flexDirection: "column",
            }}>
              {/* Header */}
              <div style={{
                padding: "20px 24px", borderBottom: "1px solid #E2E8F0",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                background: "linear-gradient(180deg, #F8FAFC 0%, #FFFFFF 100%)",
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}>
                    <Plus size={20} color="#FF7F50" />
                    Register Walk-In Gym Member
                  </h3>
                  <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#64748B" }}>
                    Submit complete membership application with passport photograph and physical metrics
                  </p>
                </div>
                <button
                  onClick={() => setShowRegisterModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B" }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmitRegistration} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                <div style={{ padding: 24, overflowY: "auto", flex: 1, display: "grid", gap: 16 }}>
                  {/* Passport Photo Upload */}
                  <div style={{
                    background: "#F8FAFC", borderRadius: 12, padding: 16, border: "1px dashed #CBD5E1",
                    display: "flex", alignItems: "center", gap: 18,
                  }}>
                    <div style={{
                      width: 70, height: 85, borderRadius: 8,
                      overflow: "hidden", background: "#E2E8F0", border: "1.5px solid #CBD5E1",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      {regPassportPreview ? (
                        <img src={regPassportPreview} alt="Passport preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <Camera size={26} color="#94A3B8" />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
                        Passport Photograph *
                      </div>
                      <div style={{ fontSize: 11.5, color: "#64748B", margin: "2px 0 8px" }}>
                        Clear headshot photograph for the official membership card and check-in system
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        required={!regPassportPreview}
                        onChange={handlePassportChange}
                        style={{ fontSize: 12 }}
                      />
                    </div>
                  </div>

                  {/* Row 1: Full Name & DOB */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                        Full Legal Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: John Abubakar Doe"
                        value={regFullName}
                        onChange={(e) => setRegFullName(e.target.value)}
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1",
                          fontSize: 13, outline: "none", boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                        Date of Birth (DOB) *
                      </label>
                      <input
                        type="date"
                        required
                        value={regDob}
                        onChange={(e) => setRegDob(e.target.value)}
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1",
                          fontSize: 13, outline: "none", boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>

                  {/* Row 2: Phone & Address */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="Ex: +234 801 234 5678"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1",
                          fontSize: 13, outline: "none", boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                        Living Address *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="House no, Street, City"
                        value={regAddress}
                        onChange={(e) => setRegAddress(e.target.value)}
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1",
                          fontSize: 13, outline: "none", boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>

                  {/* Row 3: Height & Weight */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                        Height (e.g. 178 cm or 5ft 10in) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: 178 cm"
                        value={regHeight}
                        onChange={(e) => setRegHeight(e.target.value)}
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1",
                          fontSize: 13, outline: "none", boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                        Weight (e.g. 75 kg) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ex: 75 kg"
                        value={regWeight}
                        onChange={(e) => setRegWeight(e.target.value)}
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1",
                          fontSize: 13, outline: "none", boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>

                  {/* Row 4: Fitness Goal & Focus Area */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                        Fitness Goal *
                      </label>
                      <select
                        value={regGoal}
                        onChange={(e) => setRegGoal(e.target.value)}
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1",
                          fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box",
                        }}
                      >
                        {FITNESS_GOALS.map((g) => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                        Focus Area *
                      </label>
                      <select
                        value={regFocus}
                        onChange={(e) => setRegFocus(e.target.value)}
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1",
                          fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box",
                        }}
                      >
                        {FOCUS_AREAS.map((fa) => (
                          <option key={fa} value={fa}>{fa}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div style={{ background: "#F8FAFC", padding: 14, borderRadius: 10, border: "1px solid #E2E8F0" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>
                      Emergency Contact Person *
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <input
                        type="text"
                        required
                        placeholder="Contact Name (e.g. Spouse, Brother)"
                        value={regEmergencyName}
                        onChange={(e) => setRegEmergencyName(e.target.value)}
                        style={{
                          width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1",
                          fontSize: 12.5, outline: "none", boxSizing: "border-box",
                        }}
                      />
                      <input
                        type="tel"
                        required
                        placeholder="Contact Phone Number"
                        value={regEmergencyPhone}
                        onChange={(e) => setRegEmergencyPhone(e.target.value)}
                        style={{
                          width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1",
                          fontSize: 12.5, outline: "none", boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>

                  {/* Plan & Pricing */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 14 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                        Membership Plan *
                      </label>
                      <select
                        value={regPlan}
                        onChange={(e) => handlePlanChange(e.target.value)}
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1",
                          fontSize: 13, outline: "none", fontWeight: 700, color: "#0F172A", boxSizing: "border-box",
                        }}
                      >
                        {Object.entries(GYM_PLANS).map(([k, p]) => (
                          <option key={k} value={k}>
                            {p.label} (₦{p.price.toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                        Fee Charged (₦)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={regAmount}
                        onChange={(e) => setRegAmount(Number(e.target.value))}
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1",
                          fontSize: 13, fontWeight: 800, color: "#0F172A", outline: "none", boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                        Start Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={regStartDate}
                        onChange={(e) => setRegStartDate(e.target.value)}
                        style={{
                          width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1",
                          fontSize: 13, outline: "none", boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>

                  {/* Medical notes */}
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 5 }}>
                      Medical Condition, Allergies or Special Notes (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Asthmatic, high blood pressure, recovering from knee surgery"
                      value={regMedical}
                      onChange={(e) => setRegMedical(e.target.value)}
                      style={{
                        width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #CBD5E1",
                        fontSize: 12.5, outline: "none", boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* Auto-approve checkbox */}
                  <label style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", background: "#EFF6FF", borderRadius: 8,
                    cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#1E40AF",
                  }}>
                    <input
                      type="checkbox"
                      checked={regAutoApprove}
                      onChange={(e) => setRegAutoApprove(e.target.checked)}
                      style={{ width: 17, height: 17 }}
                    />
                    <span>Payment Received & Confirmed (Activate Membership & Issue Card Immediately)</span>
                  </label>
                </div>

                {/* Footer Buttons */}
                <div style={{
                  padding: "16px 24px", borderTop: "1px solid #E2E8F0", background: "#F8FAFC",
                  display: "flex", justifyContent: "flex-end", gap: 10,
                }}>
                  <button
                    type="button"
                    onClick={() => setShowRegisterModal(false)}
                    style={{
                      padding: "10px 16px", borderRadius: 8, border: "1px solid #CBD5E1",
                      background: "#fff", color: "#475569", fontWeight: 700, fontSize: 13, cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <LoaderButton
                    type="submit"
                    loading={regSubmitting}
                    style={{
                      padding: "10px 22px", borderRadius: 8, border: "none",
                      background: "linear-gradient(135deg, #FF7F50 0%, #EA580C 100%)",
                      color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <Check size={16} /> Complete Registration
                  </LoaderButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ════ MODAL 3: OFFICIAL CR80 MEMBERSHIP CARD ════ */}
        {cardModalMember && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(11, 15, 23, 0.85)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}>
            <div style={{
              background: "#0F172A", width: "100%", maxWidth: 840, borderRadius: 24,
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column",
            }}>
              {/* Header */}
              <div style={{
                padding: "20px 26px", borderBottom: "1px solid rgba(255,255,255,0.08)",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                  }}>
                    <Award size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#fff" }}>
                      Official Gym Membership Card · CR80
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94A3B8" }}>
                      Member: {cardModalMember.fullName} · {cardModalMember.memberId || "360-GYM"}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    onClick={() => setCardModalMember(null)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8" }}
                  >
                    <X size={22} />
                  </button>
                </div>
              </div>

              {/* Card Canvas & Controls */}
              <div style={{ padding: "26px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
                {/* Side-by-side Cards Container */}
                <div style={{
                  display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap",
                  alignItems: "center", maxWidth: "100%",
                }}>
                  {/* ── CARD FRONT (CR80: 85.6mm x 54mm, aspect ~1.585) ── */}
                  <div
                    ref={cardRefFront}
                    id="gym-card-front"
                    style={{
                      width: 360, height: 228, borderRadius: 16,
                      background: "linear-gradient(135deg, #0A0F1D 0%, #151D30 50%, #0B1120 100%)",
                      border: "2px solid rgba(245, 158, 11, 0.4)",
                      boxShadow: "0 12px 30px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.15)",
                      padding: 16, boxSizing: "border-box", position: "relative",
                      overflow: "hidden", color: "#fff", display: "flex", flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    {/* Golden accent bar top */}
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 4,
                      background: "linear-gradient(90deg, #F59E0B 0%, #FBBF24 50%, #D97706 100%)",
                    }} />

                    {/* Card Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <img
                          src="/logo.png"
                          alt="360 Logo"
                          style={{ width: 28, height: 28, objectFit: "contain" }}
                          onError={(e: any) => { e.currentTarget.style.display = "none"; }}
                        />
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 900, color: "#F59E0B", letterSpacing: 1.2, textTransform: "uppercase" }}>
                            360 GLOBAL FITNESS
                          </div>
                          <div style={{ fontSize: 8.5, color: "#94A3B8", letterSpacing: 0.5, textTransform: "uppercase" }}>
                            Health & Athletic Club
                          </div>
                        </div>
                      </div>

                      <div style={{
                        background: "rgba(245, 158, 11, 0.15)", border: "1px solid rgba(245, 158, 11, 0.4)",
                        color: "#FBBF24", fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 4,
                        textTransform: "uppercase", letterSpacing: 0.6,
                      }}>
                        {GYM_PLANS[cardModalMember.membershipType]?.badge || "MEMBER PASS"}
                      </div>
                    </div>

                    {/* Card Body: Photo & Info */}
                    <div style={{ display: "flex", gap: 14, alignItems: "center", margin: "4px 0" }}>
                      {/* Framed Passport */}
                      <div style={{
                        width: 72, height: 88, borderRadius: 8,
                        overflow: "hidden", border: "2px solid #F59E0B",
                        background: "#1E293B", flexShrink: 0,
                        boxShadow: "0 4px 10px rgba(0,0,0,0.4)",
                      }}>
                        {cardModalMember.passportPhoto ? (
                          <img
                            src={cardModalMember.passportPhoto}
                            alt="Member Photo"
                            style={{ width: "100%", height: "100%", objectFit: "cover" }}
                          />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B" }}>
                            <User size={30} />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <div style={{
                          fontSize: 14, fontWeight: 900, color: "#FFFFFF",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          letterSpacing: "-0.2px",
                        }}>
                          {cardModalMember.fullName}
                        </div>

                        <div style={{
                          fontSize: 11, fontFamily: "monospace", color: "#F59E0B",
                          fontWeight: 700, marginTop: 2, letterSpacing: 0.5,
                        }}>
                          ID: {cardModalMember.memberId || "360-GYM"}
                        </div>

                        <div style={{ fontSize: 9.5, color: "#94A3B8", marginTop: 4 }}>
                          Goal: <strong style={{ color: "#E2E8F0" }}>{cardModalMember.goal || "Fitness"}</strong>
                        </div>

                        <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 2 }}>
                          Valid: <span style={{ color: "#10B981", fontWeight: 700 }}>{cardModalMember.startDate}</span> → <span style={{ color: "#FBBF24", fontWeight: 700 }}>{cardModalMember.endDate}</span>
                        </div>
                      </div>

                      {/* QR Code */}
                      <div style={{
                        width: 58, height: 58, borderRadius: 6,
                        background: "#fff", padding: 3, flexShrink: 0,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                      }}>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
                            `https://360degreeglobal.org/gym?member=${cardModalMember.memberId || cardModalMember._id}`
                          )}`}
                          alt="QR Code"
                          style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        />
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6,
                    }}>
                      <div style={{ fontSize: 8.5, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Authorized Member Pass
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#10B981", fontWeight: 800 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
                        ACTIVE PASS
                      </div>
                    </div>
                  </div>

                  {/* ── CARD BACK ── */}
                  <div
                    ref={cardRefBack}
                    id="gym-card-back"
                    style={{
                      width: 360, height: 228, borderRadius: 16,
                      background: "linear-gradient(135deg, #0B1120 0%, #151D30 50%, #0A0F1D 100%)",
                      border: "2px solid rgba(255,255,255,0.15)",
                      boxShadow: "0 12px 30px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.15)",
                      padding: 16, boxSizing: "border-box", position: "relative",
                      overflow: "hidden", color: "#fff", display: "flex", flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    {/* Magnetic Stripe representation */}
                    <div style={{
                      position: "absolute", top: 12, left: 0, right: 0, height: 24,
                      background: "linear-gradient(180deg, #111827 0%, #030712 100%)",
                      borderTop: "1px solid rgba(255,255,255,0.05)",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                    }} />

                    {/* Spacer for magnetic stripe */}
                    <div style={{ height: 22 }} />

                    {/* Rules & Details */}
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 800, color: "#F59E0B", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
                        Gym Rules & Safety Guidelines
                      </div>
                      <ul style={{ margin: 0, paddingLeft: 14, fontSize: 8, color: "#94A3B8", lineHeight: 1.4 }}>
                        <li>Valid membership card or QR scan mandatory on entry.</li>
                        <li>Appropriate workout attire & gym towel required at all times.</li>
                        <li>Sanitize machines and return free weights after usage.</li>
                        <li>Card is non-transferable and remains property of 360 Global.</li>
                      </ul>
                    </div>

                    {/* Member Metrics & Emergency */}
                    <div style={{
                      background: "rgba(255,255,255,0.04)", borderRadius: 8,
                      padding: "6px 10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
                    }}>
                      <div style={{ fontSize: 8, color: "#94A3B8" }}>
                        Height: <strong style={{ color: "#E2E8F0" }}>{cardModalMember.height || "—"}</strong> · Weight: <strong style={{ color: "#E2E8F0" }}>{cardModalMember.weight || "—"}</strong>
                      </div>
                      <div style={{ fontSize: 8, color: "#F59E0B", textAlign: "right" }}>
                        Emergency: <strong>{cardModalMember.emergencyContact?.phone || "On File"}</strong>
                      </div>
                    </div>

                    {/* Bottom Signature / Stamp */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                      <div>
                        <div style={{ fontSize: 7.5, color: "#64748B" }}>Club Support: +234 800 360 LIVE</div>
                        <div style={{ fontSize: 7.5, color: "#64748B" }}>Keffi / Abuja, Nigeria</div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{
                          display: "inline-block", borderBottom: "1px solid #F59E0B",
                          fontFamily: "'Brush Script MT', cursive, sans-serif", fontSize: 13, color: "#F59E0B",
                          paddingBottom: 2,
                        }}>
                          Abbas Modibbo
                        </div>
                        <div style={{ fontSize: 7, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 1 }}>
                          Director of Athletics
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Export Actions */}
                <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 8 }}>
                  <LoaderButton
                    onClick={() => downloadMembershipCardPdf(cardModalMember)}
                    loading={downloadingCardPdf}
                    style={{
                      padding: "10px 22px", borderRadius: 10, border: "none",
                      background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
                      color: "#fff", fontWeight: 800, fontSize: 13.5, cursor: "pointer",
                      display: "inline-flex", alignItems: "center", gap: 7,
                      boxShadow: "0 4px 14px rgba(245,158,11,0.4)",
                    }}
                  >
                    <Download size={16} /> Download Printable CR80 PDF (Front & Back)
                  </LoaderButton>

                  <button
                    onClick={() => window.print()}
                    style={{
                      padding: "10px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.2)",
                      background: "rgba(255,255,255,0.06)", color: "#fff", fontWeight: 700, fontSize: 13,
                      cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
                    }}
                  >
                    <Printer size={15} /> Print Badge
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
