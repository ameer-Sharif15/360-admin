"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getClients, ID, Query, type Models } from "../../lib/appwrite";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { drawLetterhead, stampDocumentFooter } from "../../lib/pdfLetterhead";
import { FileDown } from "lucide-react";

type Attendance = {
  $id: string;
  staffId: string;
  date: string;
  status: "present" | "absent" | "late" | "leave";
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
  location?: string;
};

type StaffMember = {
  $id: string;
  name: string;
};

const ATTENDANCE_COLLECTION = "STAFF_ATTENDANCE";
const STAFF_COLLECTION = "STAFF_MEMBERS";

export default function AttendancePage() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

      // Quick Attendance Counts
      const presentCount = records.filter((r) => r.status === "present").length;
      const absentCount = records.filter((r) => r.status === "absent").length;
      const lateCount = records.filter((r) => r.status === "late").length;
      const leaveCount = records.filter((r) => r.status === "leave").length;

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
        record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString("en-GB") : "—",
        record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString("en-GB") : "—",
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

      // Stamp IT department signature and page numbers on every page
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

      // Check for existing record
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
      await fetchData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const getStaffName = (id: string) =>
    staff.find((s) => s.$id === id)?.name || "Unknown Staff";

  const getStatusColor = (status: string) => {
    switch (status) {
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

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, color: "#666" }}>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, color: "#666" }}>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={inputStyle}
            />
          </div>
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
            {exportingPdf ? "Generating PDF..." : "Export PDF"}
          </button>
        </div>
        <button
          onClick={() => setShowMarkForm(!showMarkForm)}
          style={buttonStyle}
        >
          {showMarkForm ? "Cancel" : "Mark Attendance"}
        </button>
      </header>

      {error && (
        <p
          style={{
            color: "red",
            background: "#fee2e2",
            padding: 12,
            borderRadius: 8,
          }}
        >
          {error}
        </p>
      )}

      {showMarkForm && (
        <form onSubmit={handleMarkAttendance} style={cardStyle}>
          <h3>Manual Entry</h3>
          <div
            style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr 1fr" }}
          >
            <select
              required
              value={markForm.staffId || ""}
              onChange={(e) =>
                setMarkForm({ ...markForm, staffId: e.target.value })
              }
              style={inputStyle}
            >
              <option value="">Select Staff Member</option>
              {staff.map((s) => (
                <option key={s.$id} value={s.$id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={markForm.status}
              onChange={(e) =>
                setMarkForm({ ...markForm, status: e.target.value as any })
              }
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
              onChange={(e) =>
                setMarkForm({ ...markForm, date: e.target.value })
              }
              style={inputStyle}
            />
            <input
              placeholder="Notes (optional)"
              value={markForm.notes || ""}
              onChange={(e) =>
                setMarkForm({ ...markForm, notes: e.target.value })
              }
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ ...buttonStyle, marginTop: 20 }}
          >
            {loading ? "Saving..." : "Save Record"}
          </button>
        </form>
      )}

      <div style={cardStyle}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{ borderBottom: "2px solid #f3f4f6", textAlign: "left" }}
            >
              <th style={tableHeaderStyle}>Staff Name</th>
              <th style={tableHeaderStyle}>Status</th>
              <th style={tableHeaderStyle}>Check In</th>
              <th style={tableHeaderStyle}>Check Out</th>
              <th style={tableHeaderStyle}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.$id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                <td style={tableCellStyle}>
                  <strong>{getStaffName(r.staffId)}</strong>
                </td>
                <td style={tableCellStyle}>
                  <span
                    style={{
                      color: getStatusColor(r.status),
                      background: getStatusColor(r.status) + "15",
                      padding: "4px 10px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: "capitalize",
                    }}
                  >
                    {r.status}
                  </span>
                </td>
                <td style={tableCellStyle}>
                  {r.checkInTime
                    ? new Date(r.checkInTime).toLocaleTimeString()
                    : "-"}
                </td>
                <td style={tableCellStyle}>
                  {r.checkOutTime
                    ? new Date(r.checkOutTime).toLocaleTimeString()
                    : "-"}
                </td>
                <td style={tableCellStyle}>{r.notes || "-"}</td>
              </tr>
            ))}
            {records.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: 40, textAlign: "center", color: "#999" }}
                >
                  No attendance records found for this date.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "#fff",
  padding: 24,
  borderRadius: 16,
  boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
};

const inputStyle: React.CSSProperties = {
  padding: "12px",
  borderRadius: 8,
  border: "1px solid #e5e5e5",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 24px",
  borderRadius: 10,
  border: "none",
  background: "#ff7f50",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const tableHeaderStyle: React.CSSProperties = {
  padding: "16px 12px",
  color: "#666",
  fontSize: 13,
  fontWeight: 600,
};

const tableCellStyle: React.CSSProperties = {
  padding: "16px 12px",
  fontSize: 14,
};
