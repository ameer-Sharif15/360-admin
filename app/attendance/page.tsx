"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getClients, ID, Query, type Models } from "../../lib/appwrite";
import { API_BASE_URL, apiRequest } from "../../lib/api";
import { io } from "socket.io-client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawLetterhead, stampDocumentFooter } from "../../lib/pdfLetterhead";
import { FileDown, QrCode, ScanLine, X, CheckCircle2, AlertCircle, RefreshCw, Clock } from "lucide-react";

type Attendance = {
  $id: string;
  _id?: string;
  staffId: any;
  date: string;
  status: "present" | "absent" | "late" | "leave" | string;
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
  location?: string;
};

type StaffMember = {
  $id: string;
  _id?: string;
  name: string;
  employeeId?: string;
  department?: string;
};

const ATTENDANCE_COLLECTION = "STAFF_ATTENDANCE";
const STAFF_COLLECTION = "STAFF_MEMBERS";

export default function AttendancePage() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [showMarkForm, setShowMarkForm] = useState(false);
  const [markForm, setMarkForm] = useState<Partial<Attendance>>({
    status: "present",
    date: new Date().toISOString().split("T")[0],
  });

  // Desk Scanner State
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scanInput, setScanInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<{
    success: boolean;
    message: string;
    staffName?: string;
    action?: string;
  } | null>(null);

  const clientBundle = useMemo(() => {
    try {
      return getClients();
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, []);

  const fetchData = async () => {
    if (!clientBundle) return;
    setLoading(true);
    try {
      const { databases, databaseId, COLLECTIONS } = clientBundle;

      const [attendanceRes, staffRes] = await Promise.all([
        databases.listDocuments<Attendance & Models.Document>(
          databaseId,
          COLLECTIONS[ATTENDANCE_COLLECTION],
          [
            Query.greaterThanEqual("date", startDate),
            Query.lessThanEqual("date", endDate),
            Query.orderDesc("date"),
            Query.orderDesc("$createdAt"),
          ],
        ),
        databases.listDocuments<StaffMember & Models.Document>(
          databaseId,
          COLLECTIONS[STAFF_COLLECTION],
          [Query.limit(100)],
        ),
      ]);

      setRecords(attendanceRes.documents);
      setStaff(staffRes.documents);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clientBundle, startDate, endDate]);

  // Real-time live attendance sync via Socket.IO
  useEffect(() => {
    let socket: any = null;
    try {
      socket = io(API_BASE_URL, { transports: ["websocket", "polling"] });
      socket.on("connect", () => {
        socket.emit("join_channel", "admin_channel");
      });
      socket.on("attendance_recorded", () => {
        fetchData();
      });
    } catch (_) {}

    return () => {
      if (socket) socket.disconnect();
    };
  }, [clientBundle, startDate, endDate]);

  // Safe time formatter handling ISO dates, "09:30 AM", or undefined
  const formatTimeSafe = (timeStr?: string) => {
    if (!timeStr) return "—";
    if (/AM|PM|\d{1,2}:\d{2}/i.test(timeStr) && !timeStr.includes("T")) {
      return timeStr;
    }
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return timeStr;
      return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true });
    } catch (_) {
      return timeStr;
    }
  };

  // Safe staff name resolver handling populated objects, string IDs, or employee IDs
  const getStaffName = (staffObj: any) => {
    if (!staffObj) return "Unknown Staff";
    if (typeof staffObj === "object") {
      if (staffObj.name) return staffObj.name;
      const id = staffObj._id || staffObj.$id;
      const found = staff.find((s) => s.$id === id || s._id === id || (staffObj.employeeId && s.employeeId === staffObj.employeeId));
      if (found) return found.name;
    }
    const found = staff.find((s) => s.$id === staffObj || s._id === staffObj || s.employeeId === staffObj);
    return found?.name || "Unknown Staff";
  };

  const getStatusColor = (status: string) => {
    switch ((status || "").toLowerCase()) {
      case "present":
        return "#10B981";
      case "absent":
        return "#EF4444";
      case "late":
        return "#F59E0B";
      case "leave":
        return "#3B82F6";
      default:
        return "#6B7280";
    }
  };

  const generatePDF = async () => {
    setExportingPdf(true);
    try {
      const doc = new jsPDF();
      const startY = await drawLetterhead(doc, {
        title: "Staff Attendance Audit & Report",
        subtitle: `Reporting Period: ${startDate} to ${endDate} · 360 Degree Global Estate Ltd.`,
        docRef: `360-ATT-${startDate.replace(/-/g, "")}`,
        badge: "ATTENDANCE",
      });

      // Quick Attendance Counts (case-insensitive)
      const presentCount = records.filter((r) => (r.status || "").toLowerCase() === "present").length;
      const absentCount = records.filter((r) => (r.status || "").toLowerCase() === "absent").length;
      const lateCount = records.filter((r) => (r.status || "").toLowerCase() === "late").length;
      const leaveCount = records.filter((r) => (r.status || "").toLowerCase() === "leave").length;

      // Summary Metric Cards
      const pageWidth = doc.internal.pageSize.getWidth();
      const cardY = startY;
      const cardHeight = 11;
      const cardSpacing = 4;
      const margin = 14;
      const availableWidth = pageWidth - margin * 2;
      const cardWidth = (availableWidth - cardSpacing * 4) / 5;

      const metrics = [
        { label: "TOTAL LOGS", val: `${records.length}`, color: [30, 41, 59] },
        { label: "PRESENT", val: `${presentCount}`, color: [16, 185, 129] },
        { label: "LATE", val: `${lateCount}`, color: [245, 158, 11] },
        { label: "ABSENT", val: `${absentCount}`, color: [239, 68, 68] },
        { label: "ON LEAVE", val: `${leaveCount}`, color: [99, 102, 241] },
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

      const tableColumn = [
        "#",
        "Staff Name",
        "Date",
        "Status",
        "Check In",
        "Check Out",
        "Notes / Location",
      ];
      const tableRows = records.map((record, idx) => [
        String(idx + 1),
        getStaffName(record.staffId),
        record.date,
        (record.status || "present").toUpperCase(),
        formatTimeSafe(record.checkInTime),
        formatTimeSafe(record.checkOutTime),
        record.notes || record.location || "—",
      ]);

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: cardY + cardHeight + 4,
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8, cellPadding: 2.5, valign: "middle" },
        headStyles: { fillColor: [26, 54, 93], textColor: 255, fontStyle: "bold", fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 42, fontStyle: "bold" },
          2: { cellWidth: 26 },
          3: { cellWidth: 24, fontStyle: "bold" },
          4: { cellWidth: 24 },
          5: { cellWidth: 24 },
          6: { cellWidth: "auto" },
        },
      });

      stampDocumentFooter(doc, "Staff Attendance Audit Log");
      doc.save(`360_Attendance_Report_${startDate}_${endDate}.pdf`);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientBundle || !markForm.staffId) return;
    setLoading(true);
    try {
      const { databases, databaseId, COLLECTIONS } = clientBundle;

      const existing = await databases.listDocuments(
        databaseId,
        COLLECTIONS[ATTENDANCE_COLLECTION],
        [
          Query.equal("staffId", markForm.staffId),
          Query.equal("date", markForm.date!),
        ],
      );

      if (existing.total > 0) {
        await databases.updateDocument(
          databaseId,
          COLLECTIONS[ATTENDANCE_COLLECTION],
          existing.documents[0].$id,
          {
            status: markForm.status,
            notes: markForm.notes,
          },
        );
      } else {
        await databases.createDocument(
          databaseId,
          COLLECTIONS[ATTENDANCE_COLLECTION],
          ID.unique(),
          markForm,
        );
      }

      setShowMarkForm(false);
      setSuccessMsg("Attendance record saved!");
      await fetchData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Desk Scanner: Attendant scans staff card to mark Check-In or Check-Out
  const handleDeskScan = async (scannedRaw: string) => {
    if (!scannedRaw || !scannedRaw.trim()) return;
    setScanning(true);
    setLastScanResult(null);

    let staffId = scannedRaw.trim();
    // Support URL parsing (e.g. https://360degreeglobal.org/attend/staff/65f123... or /verify/staff/65f...)
    if (staffId.includes("/staff/")) {
      const parts = staffId.split("/staff/")[1].split(/[/?#]/);
      staffId = parts[0];
    } else if (staffId.includes("staffId=")) {
      staffId = staffId.split("staffId=")[1].split("&")[0];
    } else if (staffId.startsWith("360ATTEND:")) {
      staffId = staffId.replace("360ATTEND:", "");
    }

    // Try matching by employee ID if not mongo ObjectId
    const matchedStaff = staff.find((s) => s.$id === staffId || s._id === staffId || s.employeeId === staffId);
    const targetId = matchedStaff?.$id || matchedStaff?._id || staffId;

    try {
      const res = await apiRequest(`/api/staff/${targetId}/attend`, {
        method: "POST",
      });

      setLastScanResult({
        success: true,
        message: res.message || "Attendance recorded successfully!",
        staffName: res.member?.name || matchedStaff?.name || "Staff",
        action: res.action === "checked_out" ? "Check-Out" : "Check-In",
      });
      setScanInput("");
      fetchData();
    } catch (err: any) {
      setLastScanResult({
        success: false,
        message: err.message || "Failed to record attendance. Staff not found or unauthorized.",
      });
    } finally {
      setScanning(false);
    }
  };

  // Quick summary counts
  const presentCount = records.filter((r) => (r.status || "").toLowerCase() === "present").length;
  const absentCount = records.filter((r) => (r.status || "").toLowerCase() === "absent").length;
  const lateCount = records.filter((r) => (r.status || "").toLowerCase() === "late").length;
  const leaveCount = records.filter((r) => (r.status || "").toLowerCase() === "leave").length;

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "#64748B", fontWeight: 600 }}>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <button
            onClick={fetchData}
            style={{ ...buttonStyle, background: "#334155", display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
          </button>
          <button
            onClick={generatePDF}
            disabled={exportingPdf}
            style={{
              ...buttonStyle,
              background: "#10B981",
              opacity: exportingPdf ? 0.7 : 1,
              cursor: exportingPdf ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <FileDown size={14} />
            {exportingPdf ? "Generating..." : "Export PDF"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {/* Official Desk Scanner Button */}
          <button
            onClick={() => {
              setShowScannerModal(true);
              setLastScanResult(null);
            }}
            style={{
              ...buttonStyle,
              background: "linear-gradient(135deg, #FF7F50 0%, #EA580C 100%)",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              boxShadow: "0 4px 12px rgba(255,127,80,0.3)",
            }}
          >
            <ScanLine size={16} /> Desk Attendance Scanner
          </button>

          <button
            onClick={() => setShowMarkForm(!showMarkForm)}
            style={{ ...buttonStyle, background: "#1E293B" }}
          >
            {showMarkForm ? "Close Form" : "Manual Entry"}
          </button>
        </div>
      </header>

      {/* Quick Attendance Stat Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        <div style={metricBoxStyle}>
          <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase" }}>Total Records</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#0F172A", marginTop: 4 }}>{records.length}</div>
        </div>
        <div style={{ ...metricBoxStyle, borderLeft: "4px solid #10B981" }}>
          <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, textTransform: "uppercase" }}>Present</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#10B981", marginTop: 4 }}>{presentCount}</div>
        </div>
        <div style={{ ...metricBoxStyle, borderLeft: "4px solid #F59E0B" }}>
          <div style={{ fontSize: 11, color: "#D97706", fontWeight: 700, textTransform: "uppercase" }}>Late</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#F59E0B", marginTop: 4 }}>{lateCount}</div>
        </div>
        <div style={{ ...metricBoxStyle, borderLeft: "4px solid #EF4444" }}>
          <div style={{ fontSize: 11, color: "#DC2626", fontWeight: 700, textTransform: "uppercase" }}>Absent</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#EF4444", marginTop: 4 }}>{absentCount}</div>
        </div>
        <div style={{ ...metricBoxStyle, borderLeft: "4px solid #3B82F6" }}>
          <div style={{ fontSize: 11, color: "#2563EB", fontWeight: 700, textTransform: "uppercase" }}>On Leave</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#3B82F6", marginTop: 4 }}>{leaveCount}</div>
        </div>
      </div>

      {error && (
        <p style={{ color: "#DC2626", background: "#FEE2E2", padding: 12, borderRadius: 8, margin: 0, fontWeight: 600 }}>
          {error}
        </p>
      )}

      {successMsg && (
        <p style={{ color: "#059669", background: "#D1FAE5", padding: 12, borderRadius: 8, margin: 0, fontWeight: 600 }}>
          {successMsg}
        </p>
      )}

      {/* Manual Entry Form */}
      {showMarkForm && (
        <form onSubmit={handleMarkAttendance} style={cardStyle}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Manual Attendance Entry</h3>
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <select
              required
              value={markForm.staffId || ""}
              onChange={(e) => setMarkForm({ ...markForm, staffId: e.target.value })}
              style={inputStyle}
            >
              <option value="">Select Staff Member</option>
              {staff.map((s) => (
                <option key={s.$id} value={s.$id}>
                  {s.name} {s.employeeId ? `(${s.employeeId})` : ""}
                </option>
              ))}
            </select>
            <select
              value={markForm.status}
              onChange={(e) => setMarkForm({ ...markForm, status: e.target.value as any })}
              style={inputStyle}
            >
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
              <option value="leave">On Leave</option>
            </select>
            <input
              type="date"
              value={markForm.date}
              onChange={(e) => setMarkForm({ ...markForm, date: e.target.value })}
              style={inputStyle}
            />
            <input
              placeholder="Notes / Location (optional)"
              value={markForm.notes || ""}
              onChange={(e) => setMarkForm({ ...markForm, notes: e.target.value })}
              style={inputStyle}
            />
          </div>
          <button type="submit" disabled={loading} style={{ ...buttonStyle, marginTop: 16 }}>
            {loading ? "Saving..." : "Save Record"}
          </button>
        </form>
      )}

      {/* Attendance Table */}
      <div style={cardStyle}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #F1F5F9", textAlign: "left" }}>
                <th style={tableHeaderStyle}>Staff Name</th>
                <th style={tableHeaderStyle}>Date</th>
                <th style={tableHeaderStyle}>Status</th>
                <th style={tableHeaderStyle}>Check In</th>
                <th style={tableHeaderStyle}>Check Out</th>
                <th style={tableHeaderStyle}>Notes / Location</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.$id || r._id} style={{ borderBottom: "1px solid #F8FAFC" }}>
                  <td style={tableCellStyle}>
                    <div style={{ fontWeight: 800, color: "#0F172A" }}>{getStaffName(r.staffId)}</div>
                    {typeof r.staffId === "object" && r.staffId?.department && (
                      <div style={{ fontSize: 11, color: "#64748B" }}>{r.staffId.department}</div>
                    )}
                  </td>
                  <td style={{ ...tableCellStyle, color: "#475569", fontWeight: 600 }}>{r.date}</td>
                  <td style={tableCellStyle}>
                    <span
                      style={{
                        color: getStatusColor(r.status),
                        background: getStatusColor(r.status) + "18",
                        border: `1px solid ${getStatusColor(r.status)}40`,
                        padding: "3px 10px",
                        borderRadius: 6,
                        fontSize: 11.5,
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      {r.status || "Present"}
                    </span>
                  </td>
                  <td style={{ ...tableCellStyle, color: "#0F172A", fontWeight: 600 }}>
                    {formatTimeSafe(r.checkInTime)}
                  </td>
                  <td style={{ ...tableCellStyle, color: "#0F172A", fontWeight: 600 }}>
                    {formatTimeSafe(r.checkOutTime)}
                  </td>
                  <td style={{ ...tableCellStyle, color: "#64748B", fontSize: 12 }}>
                    {r.notes || r.location || "—"}
                  </td>
                </tr>
              ))}
              {records.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} style={{ padding: 48, textAlign: "center", color: "#94A3B8" }}>
                    No attendance records found for this period. Use the Desk Scanner or Manual Entry to record attendance.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── DESK SCANNER MODAL ─── */}
      {showScannerModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: 20,
              maxWidth: 480,
              width: "100%",
              padding: 24,
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid #E2E8F0",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "#FFF2EA", color: "#FF7F50", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ScanLine size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0F172A" }}>
                    Attendance Desk Scanner
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#64748B" }}>
                    Official attendance checkpoint terminal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowScannerModal(false)}
                style={{ background: "#F1F5F9", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} color="#64748B" />
              </button>
            </div>

            <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.4, margin: "0 0 16px" }}>
              Scan the Staff ID card with your barcode scanner or enter the Staff ID / scan URL below. Attendance will be recorded under your authorized admin session.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleDeskScan(scanInput);
              }}
              style={{ display: "flex", gap: 8, marginBottom: 16 }}
            >
              <input
                autoFocus
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Scan or paste Staff QR data / Employee ID..."
                style={{ ...inputStyle, flex: 1, fontSize: 14 }}
              />
              <button
                type="submit"
                disabled={scanning || !scanInput.trim()}
                style={{
                  ...buttonStyle,
                  background: "#FF7F50",
                  whiteSpace: "nowrap",
                  opacity: scanning || !scanInput.trim() ? 0.6 : 1,
                }}
              >
                {scanning ? "Recording..." : "Check In/Out"}
              </button>
            </form>

            {lastScanResult && (
              <div
                style={{
                  padding: 16,
                  borderRadius: 12,
                  background: lastScanResult.success ? "#ECFDF5" : "#FEF2F2",
                  border: `1px solid ${lastScanResult.success ? "#A7F3D0" : "#FECACA"}`,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                {lastScanResult.success ? (
                  <CheckCircle2 size={24} color="#10B981" style={{ flexShrink: 0, marginTop: 2 }} />
                ) : (
                  <AlertCircle size={24} color="#EF4444" style={{ flexShrink: 0, marginTop: 2 }} />
                )}
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: lastScanResult.success ? "#065F46" : "#991B1B" }}>
                    {lastScanResult.success ? `${lastScanResult.action}: ${lastScanResult.staffName}` : "Scan Failed"}
                  </div>
                  <div style={{ fontSize: 12, color: lastScanResult.success ? "#047857" : "#B91C1C", marginTop: 2 }}>
                    {lastScanResult.message}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #CBD5E1",
  fontSize: 13,
  outline: "none",
  background: "#F8FAFC",
  color: "#0F172A",
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  background: "#FF7F50",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  transition: "all 0.15s ease",
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  padding: 20,
  borderRadius: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
  border: "1px solid #E2E8F0",
};

const metricBoxStyle: React.CSSProperties = {
  background: "#fff",
  padding: "16px 20px",
  borderRadius: 12,
  border: "1px solid #E2E8F0",
  boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
};

const tableHeaderStyle: React.CSSProperties = {
  padding: "12px 14px",
  color: "#64748B",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.8,
  textTransform: "uppercase",
};

const tableCellStyle: React.CSSProperties = {
  padding: "14px 14px",
  fontSize: 13,
};
