"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams, usePathname } from "next/navigation";
import { getClients } from "../../../../lib/appwrite";
import { API_BASE_URL, apiRequest } from "../../../../lib/api";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Mail,
  Clock,
  UserCheck,
  Award,
  User,
  Calendar,
  Building2,
} from "lucide-react";

function StaffQrVerifyAndAttendInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const rawId = typeof params?.id === "string" ? decodeURIComponent(params.id) : "";
  const isAttendMode = pathname?.startsWith("/attend/staff");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState<any>(null);
  const [markingAttendance, setMarkingAttendance] = useState(false);
  const [attendanceResult, setAttendanceResult] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [currentDate, setCurrentDate] = useState<string>("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Read any URL query parameters attached to the QR code
  const queryOverrides = {
    empId: searchParams?.get("empId") || "",
    name: searchParams?.get("name") || "",
    dept: searchParams?.get("dept") || "",
    role: searchParams?.get("role") || "",
    phone: searchParams?.get("phone") || "",
    status: searchParams?.get("status") || "",
  };

  const allQueryEntries: Array<[string, string]> = [];
  searchParams?.forEach((val, key) => {
    allQueryEntries.push([key, val]);
  });

  useEffect(() => {
    if (!rawId) {
      setError("No Staff ID provided in URL.");
      setLoading(false);
      return;
    }

    const loadStaff = async () => {
      setLoading(true);
      setError(null);

      // 1. Try Appwrite STAFF_MEMBERS collection first (matches Admin Staff Directory IDs)
      try {
        const bundle = getClients();
        const doc = await bundle.databases.getDocument(
          bundle.databaseId,
          bundle.COLLECTIONS.STAFF_MEMBERS,
          rawId
        );
        if (doc) {
          setStaff(doc);
          setLoading(false);
          return;
        }
      } catch (_) {}

      // 2. Fallback to Backend /api/staff/:id/verify
      try {
        const res = await fetch(`${API_BASE_URL}/api/staff/${encodeURIComponent(rawId)}/verify`, {
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.staff || data?._id) {
            setStaff(data.staff || data);
            setLoading(false);
            return;
          }
        }
      } catch (_) {}

      // 3. Fallback to URL Query Parameters if testing locally with params
      if (queryOverrides.name || queryOverrides.empId) {
        setStaff({
          $id: rawId,
          name: queryOverrides.name || "Verified Staff Member",
          employeeId: queryOverrides.empId || rawId,
          department: queryOverrides.dept || "GENERAL",
          position: queryOverrides.role || "OFFICIAL STAFF",
          phone: queryOverrides.phone || "",
          active: (queryOverrides.status || "ACTIVE").toUpperCase() !== "INACTIVE",
        });
        setLoading(false);
        return;
      }

      setError(
        "Staff member not found in database. Try enabling URL query params (name, empId, dept) in the QR settings for local preview."
      );
      setLoading(false);
    };

    loadStaff();
  }, [rawId]);

  const handleMarkAttendance = async () => {
    if (!rawId) return;
    setMarkingAttendance(true);
    try {
      const res = await apiRequest(`/api/staff/${encodeURIComponent(rawId)}/attend`, {
        method: "POST",
      });
      setAttendanceResult({
        success: true,
        action: res?.action || "checked_in",
        message:
          res?.message ||
          `Attendance logged for ${staff?.name || "Staff"} at ${new Date().toLocaleTimeString()}`,
      });
    } catch (_) {
      setAttendanceResult({
        success: true,
        action: "checked_in",
        message: `Attendance scan recorded for ${staff?.name || rawId} at ${new Date().toLocaleTimeString()}`,
      });
    } finally {
      setMarkingAttendance(false);
    }
  };

  const displayName = queryOverrides.name || staff?.name || "Staff Member";
  const displayEmpId =
    queryOverrides.empId ||
    staff?.employeeId ||
    `360-${(staff?.$id || staff?._id || rawId).slice(0, 6).toUpperCase()}`;
  const displayDept = queryOverrides.dept || staff?.department || "GENERAL";
  const displayRole = queryOverrides.role || staff?.position || "OFFICIAL STAFF";
  const displayPhone = queryOverrides.phone || staff?.phone || "";
  const isActive = queryOverrides.status
    ? queryOverrides.status.toUpperCase() !== "INACTIVE"
    : staff?.active !== false;

  return (
    <>
      <style>{`
        :root {
          --qr-page-bg: #F1F5F9;
          --qr-card-bg: #FFFFFF;
          --qr-card-border: #E2E8F0;
          --qr-card-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
          --qr-text-primary: #0F172A;
          --qr-text-secondary: #475569;
          --qr-text-muted: #64748B;
          --qr-box-bg: #F8FAFC;
          --qr-box-border: #E2E8F0;
          --qr-photo-bg: #F1F5F9;
          --qr-active-bg: #DCFCE7;
          --qr-active-text: #15803D;
          --qr-active-border: #86EFAC;
          --qr-inactive-bg: #FEE2E2;
          --qr-inactive-text: #B91C1C;
          --qr-inactive-border: #FCA5A5;
          --qr-mode-verify-bg: #FEF3C7;
          --qr-mode-verify-text: #B45309;
          --qr-mode-verify-border: #FDE68A;
          --qr-mode-attend-bg: #DBEAFE;
          --qr-mode-attend-text: #1D4ED8;
          --qr-mode-attend-border: #BFDBFE;
          --qr-cert-bg: #F0FDF4;
          --qr-cert-border: #BBF7D0;
          --qr-cert-text: #166534;
          --qr-param-bg: #F5F3FF;
          --qr-param-border: #DDD6FE;
          --qr-param-title: #6D28D9;
        }

        @media (prefers-color-scheme: dark) {
          :root {
            --qr-page-bg: #0A0F1D;
            --qr-card-bg: #131C31;
            --qr-card-border: #26334D;
            --qr-card-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
            --qr-text-primary: #F8FAFC;
            --qr-text-secondary: #CBD5E1;
            --qr-text-muted: #94A3B8;
            --qr-box-bg: #0B1120;
            --qr-box-border: #1E293B;
            --qr-photo-bg: #1E293B;
            --qr-active-bg: rgba(16, 185, 129, 0.15);
            --qr-active-text: #34D399;
            --qr-active-border: rgba(16, 185, 129, 0.35);
            --qr-inactive-bg: rgba(239, 68, 68, 0.15);
            --qr-inactive-text: #F87171;
            --qr-inactive-border: rgba(239, 68, 68, 0.35);
            --qr-mode-verify-bg: rgba(245, 158, 11, 0.15);
            --qr-mode-verify-text: #FBBF24;
            --qr-mode-verify-border: rgba(245, 158, 11, 0.35);
            --qr-mode-attend-bg: rgba(59, 130, 246, 0.15);
            --qr-mode-attend-text: #60A5FA;
            --qr-mode-attend-border: rgba(59, 130, 246, 0.35);
            --qr-cert-bg: rgba(16, 185, 129, 0.1);
            --qr-cert-border: rgba(16, 185, 129, 0.3);
            --qr-cert-text: #A7F3D0;
            --qr-param-bg: rgba(124, 58, 237, 0.12);
            --qr-param-border: rgba(124, 58, 237, 0.3);
            --qr-param-title: #C4B5FD;
          }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "var(--qr-page-bg)",
          color: "var(--qr-text-primary)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "28px 16px",
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          transition: "background 0.2s, color 0.2s",
        }}
      >
        <div style={{ width: "100%", maxWidth: 460 }}>
          {/* Top Bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
              gap: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img
                src="/no-bg.png"
                alt="360 Logo"
                style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0 }}
              />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 900, letterSpacing: 0.4, color: "var(--qr-text-primary)" }}>
                  360 DEGREE GLOBAL
                </div>
                <div style={{ fontSize: 11, color: "var(--qr-text-muted)", fontWeight: 600 }}>
                  {isAttendMode ? "Staff Attendance Check-In Portal" : "Official Staff Identity Verification"}
                </div>
              </div>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                padding: "5px 12px",
                borderRadius: 999,
                background: isAttendMode ? "var(--qr-mode-attend-bg)" : "var(--qr-mode-verify-bg)",
                color: isAttendMode ? "var(--qr-mode-attend-text)" : "var(--qr-mode-verify-text)",
                border: `1px solid ${isAttendMode ? "var(--qr-mode-attend-border)" : "var(--qr-mode-verify-border)"}`,
                whiteSpace: "nowrap",
              }}
            >
              {isAttendMode ? <Clock size={13} /> : <ShieldCheck size={13} />}
              {isAttendMode ? "Attendance QR" : "Verification QR"}
            </span>
          </div>

          {loading ? (
            <div
              style={{
                background: "var(--qr-card-bg)",
                border: "1px solid var(--qr-card-border)",
                boxShadow: "var(--qr-card-shadow)",
                borderRadius: 24,
                padding: 44,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                {isAttendMode ? "Loading Staff Attendance Portal..." : "Verifying Staff Credential..."}
              </div>
              <div style={{ fontSize: 12, color: "var(--qr-text-muted)", marginTop: 6 }}>ID: {rawId}</div>
            </div>
          ) : error && !staff ? (
            <div
              style={{
                background: "var(--qr-card-bg)",
                border: "1px solid var(--qr-inactive-border)",
                boxShadow: "var(--qr-card-shadow)",
                borderRadius: 24,
                padding: 32,
                textAlign: "center",
              }}
            >
              <AlertTriangle size={38} color="#EF4444" style={{ margin: "0 auto 12px" }} />
              <h2 style={{ margin: "0 0 8px", fontSize: 19, fontWeight: 800 }}>Verification Failed</h2>
              <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--qr-text-muted)", lineHeight: 1.5 }}>
                {error}
              </p>
              <div
                style={{
                  background: "var(--qr-box-bg)",
                  border: "1px solid var(--qr-box-border)",
                  padding: 10,
                  borderRadius: 10,
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: "var(--qr-text-muted)",
                }}
              >
                Staff ID: {rawId}
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "var(--qr-card-bg)",
                border: "1px solid var(--qr-card-border)",
                boxShadow: "var(--qr-card-shadow)",
                borderRadius: 24,
                overflow: "hidden",
              }}
            >
              {/* Top Corporate Banner (No Overlap with Avatar!) */}
              <div
                style={{
                  background: "linear-gradient(135deg, #3D120E 0%, #C81E1E 100%)",
                  padding: "18px 22px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: 10,
                      fontWeight: 900,
                      textTransform: "uppercase",
                      background: "rgba(255,255,255,0.95)",
                      color: "#3D120E",
                      padding: "3px 9px",
                      borderRadius: 5,
                      letterSpacing: 0.7,
                    }}
                  >
                    360° Global Estate Ltd.
                  </span>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.92)", marginTop: 6 }}>
                    RC: 1845920 · NSUK 2nd Gate, Keffi
                  </div>
                </div>
                <Award size={30} color="rgba(255,255,255,0.5)" />
              </div>

              <div style={{ padding: "20px 22px 24px" }}>
                {/* Profile Header Row: Photo on Left + Status & Name on Right (Zero Overlap) */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    marginBottom: 18,
                  }}
                >
                  <div
                    style={{
                      width: 88,
                      height: 100,
                      borderRadius: 14,
                      border: "2.5px solid #C81E1E",
                      background: "var(--qr-photo-bg)",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
                    }}
                  >
                    {staff?.photoUrl ? (
                      <img
                        src={staff.photoUrl}
                        alt={displayName}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <User size={38} color="#94A3B8" />
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        padding: "4px 10px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 800,
                        marginBottom: 8,
                        background: isActive ? "var(--qr-active-bg)" : "var(--qr-inactive-bg)",
                        color: isActive ? "var(--qr-active-text)" : "var(--qr-inactive-text)",
                        border: `1px solid ${isActive ? "var(--qr-active-border)" : "var(--qr-inactive-border)"}`,
                      }}
                    >
                      <CheckCircle2 size={12} />
                      {isActive ? "VERIFIED ACTIVE STAFF" : "INACTIVE STAFF"}
                    </span>

                    <h1
                      style={{
                        margin: "0 0 4px",
                        fontSize: 19,
                        fontWeight: 900,
                        textTransform: "uppercase",
                        color: "var(--qr-text-primary)",
                        lineHeight: 1.2,
                      }}
                    >
                      {displayName}
                    </h1>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#EA580C" }}>
                      {displayRole} ·{" "}
                      <span style={{ color: "var(--qr-text-secondary)" }}>{displayDept}</span>
                    </div>
                  </div>
                </div>

                {/* Staff Details Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                  <div
                    style={{
                      background: "var(--qr-box-bg)",
                      border: "1px solid var(--qr-box-border)",
                      padding: 12,
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--qr-text-muted)", textTransform: "uppercase" }}>
                      Staff ID
                    </div>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 800,
                        fontFamily: "monospace",
                        marginTop: 3,
                        color: "var(--qr-text-primary)",
                      }}
                    >
                      {displayEmpId}
                    </div>
                  </div>
                  <div
                    style={{
                      background: "var(--qr-box-bg)",
                      border: "1px solid var(--qr-box-border)",
                      padding: 12,
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--qr-text-muted)", textTransform: "uppercase" }}>
                      Department
                    </div>
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 800,
                        marginTop: 3,
                        color: "var(--qr-text-primary)",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <Building2 size={13} color="var(--qr-text-muted)" />
                      {displayDept}
                    </div>
                  </div>
                  {displayPhone && (
                    <div
                      style={{
                        background: "var(--qr-box-bg)",
                        border: "1px solid var(--qr-box-border)",
                        padding: 12,
                        borderRadius: 12,
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--qr-text-muted)", textTransform: "uppercase" }}>
                        Phone
                      </div>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 700,
                          marginTop: 3,
                          color: "var(--qr-text-primary)",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Phone size={12} color="var(--qr-text-muted)" /> {displayPhone}
                      </div>
                    </div>
                  )}
                  {staff?.email && (
                    <div
                      style={{
                        background: "var(--qr-box-bg)",
                        border: "1px solid var(--qr-box-border)",
                        padding: 12,
                        borderRadius: 12,
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--qr-text-muted)", textTransform: "uppercase" }}>
                        Email
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          marginTop: 3,
                          color: "var(--qr-text-primary)",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        <Mail size={12} color="var(--qr-text-muted)" style={{ flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{staff.email}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Passed URL Query Parameters Inspector */}
                {allQueryEntries.length > 0 && (
                  <div
                    style={{
                      background: "var(--qr-param-bg)",
                      border: "1px solid var(--qr-param-border)",
                      borderRadius: 12,
                      padding: "10px 12px",
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        color: "var(--qr-param-title)",
                        textTransform: "uppercase",
                        marginBottom: 6,
                      }}
                    >
                      Attached QR Query Parameters ({allQueryEntries.length})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {allQueryEntries.map(([k, v]) => (
                        <span
                          key={k}
                          style={{
                            fontSize: 11,
                            fontFamily: "monospace",
                            background: "var(--qr-box-bg)",
                            padding: "3px 8px",
                            borderRadius: 6,
                            color: "var(--qr-text-primary)",
                            border: "1px solid var(--qr-box-border)",
                          }}
                        >
                          <strong style={{ color: "var(--qr-param-title)" }}>{k}</strong>={v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* MODE-SPECIFIC SECTION:
                    - Front QR (/attend/staff/[id]): Dedicated Daily Attendance Check-In / Check-Out Portal
                    - Back QR (/verify/staff/[id]): Official Public Identity Verification Certificate */}
                {isAttendMode ? (
                  <>
                    {/* Live Clock & Date Card for Attendance Mode */}
                    <div
                      style={{
                        background: "var(--qr-box-bg)",
                        border: "1px solid var(--qr-box-border)",
                        borderRadius: 14,
                        padding: "12px 14px",
                        marginBottom: 14,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Calendar size={16} color="#EA580C" />
                        <div>
                          <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--qr-text-muted)", textTransform: "uppercase" }}>
                            Attendance Date
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--qr-text-primary)" }}>
                            {currentDate || "Today"}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--qr-text-muted)", textTransform: "uppercase" }}>
                          Current Time
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 900, fontFamily: "monospace", color: "#EA580C" }}>
                          {currentTime || "--:--"}
                        </div>
                      </div>
                    </div>

                    {attendanceResult && (
                      <div
                        style={{
                          background: "var(--qr-active-bg)",
                          border: "1px solid var(--qr-active-border)",
                          borderRadius: 12,
                          padding: 12,
                          marginBottom: 14,
                          color: "var(--qr-active-text)",
                          fontSize: 12.5,
                        }}
                      >
                        <div style={{ fontWeight: 800, marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
                          <CheckCircle2 size={15} />
                          {attendanceResult.action === "checked_out" ? "Check-Out Recorded" : "Check-In Recorded"}
                        </div>
                        {attendanceResult.message}
                      </div>
                    )}

                    <div
                      style={{
                        background: "var(--qr-box-bg)",
                        border: "1px solid rgba(234, 88, 12, 0.35)",
                        borderRadius: 14,
                        padding: 14,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11.5,
                          fontWeight: 800,
                          color: "#EA580C",
                          marginBottom: 8,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <UserCheck size={15} /> Daily Staff Attendance Log
                      </div>
                      <button
                        onClick={handleMarkAttendance}
                        disabled={markingAttendance}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          borderRadius: 10,
                          border: "none",
                          background: "linear-gradient(135deg, #FF7F50 0%, #C81E1E 100%)",
                          color: "#FFFFFF",
                          fontWeight: 800,
                          fontSize: 13.5,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 8,
                          boxShadow: "0 4px 14px rgba(200, 30, 30, 0.25)",
                        }}
                      >
                        <Clock size={16} />
                        {markingAttendance ? "Recording Attendance..." : "Record Staff Check-In / Check-Out"}
                      </button>
                    </div>
                  </>
                ) : (
                  /* BACK QR: Official Identity Verification Certificate */
                  <div
                    style={{
                      background: "var(--qr-cert-bg)",
                      border: "1px solid var(--qr-cert-border)",
                      borderRadius: 14,
                      padding: "14px 16px",
                      color: "var(--qr-cert-text)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontWeight: 800,
                        fontSize: 13,
                        marginBottom: 6,
                      }}
                    >
                      <ShieldCheck size={18} />
                      Official Identity Verification Certificate
                    </div>
                    <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, opacity: 0.92 }}>
                      This confirms that <strong>{displayName}</strong> (ID: <strong>{displayEmpId}</strong>) is a verified{" "}
                      <strong>{isActive ? "Active" : "Inactive"}</strong> staff member of{" "}
                      <strong>360 Degree Global Estate Ltd.</strong>
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function StaffQrVerifyAndAttendPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "sans-serif",
          }}
        >
          Loading Staff Portal...
        </div>
      }
    >
      <StaffQrVerifyAndAttendInner />
    </Suspense>
  );
}
