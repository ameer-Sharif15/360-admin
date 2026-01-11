'use client';

import { ID, Query, type Models } from 'appwrite';
import { useEffect, useMemo, useState } from 'react';
import { getClients } from '../../lib/appwrite';

type Attendance = {
  $id: string;
  staffId: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'leave';
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
};

type StaffMember = {
  $id: string;
  name: string;
};

const ATTENDANCE_COLLECTION = 'STAFF_ATTENDANCE';
const STAFF_COLLECTION = 'STAFF_MEMBERS';

export default function AttendancePage() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [showMarkForm, setShowMarkForm] = useState(false);
  const [markForm, setMarkForm] = useState<Partial<Attendance>>({
    status: 'present',
    date: new Date().toISOString().split('T')[0]
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
          [Query.equal('date', filterDate), Query.orderDesc('$createdAt')]
        ),
        databases.listDocuments<StaffMember & Models.Document>(
          databaseId,
          COLLECTIONS[STAFF_COLLECTION],
          [Query.limit(100)]
        )
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
  }, [clientBundle, filterDate]);

  const handleMarkAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientBundle || !markForm.staffId) return;
    setLoading(true);
    try {
      const { databases, databaseId, COLLECTIONS } = clientBundle;
      
      // Check for existing record
      const existing = await databases.listDocuments(databaseId, COLLECTIONS[ATTENDANCE_COLLECTION], [
        Query.equal('staffId', markForm.staffId),
        Query.equal('date', markForm.date!)
      ]);

      if (existing.total > 0) {
        await databases.updateDocument(databaseId, COLLECTIONS[ATTENDANCE_COLLECTION], existing.documents[0].$id, {
          status: markForm.status,
          notes: markForm.notes
        });
      } else {
        await databases.createDocument(databaseId, COLLECTIONS[ATTENDANCE_COLLECTION], ID.unique(), markForm);
      }

      setShowMarkForm(false);
      await fetchData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const getStaffName = (id: string) => staff.find(s => s.$id === id)?.name || 'Unknown Staff';

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return '#10B981';
      case 'absent': return '#EF4444';
      case 'late': return '#F59E0B';
      case 'leave': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input 
            type="date" 
            value={filterDate} 
            onChange={e => setFilterDate(e.target.value)} 
            style={inputStyle}
          />
          <h2 style={{ margin: 0 }}>Attendance for {filterDate}</h2>
        </div>
        <button onClick={() => setShowMarkForm(!showMarkForm)} style={buttonStyle}>
          {showMarkForm ? 'Cancel' : 'Mark Attendance'}
        </button>
      </header>

      {error && <p style={{ color: 'red', background: '#fee2e2', padding: 12, borderRadius: 8 }}>{error}</p>}

      {showMarkForm && (
        <form onSubmit={handleMarkAttendance} style={cardStyle}>
          <h3>Manual Entry</h3>
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
            <select 
              required 
              value={markForm.staffId || ''} 
              onChange={e => setMarkForm({...markForm, staffId: e.target.value})}
              style={inputStyle}
            >
              <option value="">Select Staff Member</option>
              {staff.map(s => <option key={s.$id} value={s.$id}>{s.name}</option>)}
            </select>
            <select 
              value={markForm.status} 
              onChange={e => setMarkForm({...markForm, status: e.target.value as any})}
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
              onChange={e => setMarkForm({...markForm, date: e.target.value})}
              style={inputStyle}
            />
            <input 
              placeholder="Notes (optional)" 
              value={markForm.notes || ''} 
              onChange={e => setMarkForm({...markForm, notes: e.target.value})}
              style={inputStyle}
            />
          </div>
          <button type="submit" disabled={loading} style={{ ...buttonStyle, marginTop: 20 }}>
            {loading ? 'Saving...' : 'Save Record'}
          </button>
        </form>
      )}

      <div style={cardStyle}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f3f4f6', textAlign: 'left' }}>
              <th style={tableHeaderStyle}>Staff Name</th>
              <th style={tableHeaderStyle}>Status</th>
              <th style={tableHeaderStyle}>Check In</th>
              <th style={tableHeaderStyle}>Check Out</th>
              <th style={tableHeaderStyle}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {records.map(r => (
              <tr key={r.$id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={tableCellStyle}><strong>{getStaffName(r.staffId)}</strong></td>
                <td style={tableCellStyle}>
                  <span style={{ 
                    color: getStatusColor(r.status), 
                    background: getStatusColor(r.status) + '15',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: 'capitalize'
                  }}>
                    {r.status}
                  </span>
                </td>
                <td style={tableCellStyle}>{r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString() : '-'}</td>
                <td style={tableCellStyle}>{r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString() : '-'}</td>
                <td style={tableCellStyle}>{r.notes || '-'}</td>
              </tr>
            ))}
            {records.length === 0 && !loading && (
              <tr>
                <td colSpan={5} style={{ padding: 40, textAlign: 'center', color: '#999' }}>
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
  background: '#fff',
  padding: 24,
  borderRadius: 16,
  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
};

const inputStyle: React.CSSProperties = {
  padding: '12px',
  borderRadius: 8,
  border: '1px solid #e5e5e5',
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
};

const buttonStyle: React.CSSProperties = {
  padding: '12px 24px',
  borderRadius: 10,
  border: 'none',
  background: '#ff7f50',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};

const tableHeaderStyle: React.CSSProperties = {
  padding: '16px 12px',
  color: '#666',
  fontSize: 13,
  fontWeight: 600,
};

const tableCellStyle: React.CSSProperties = {
  padding: '16px 12px',
  fontSize: 14,
};
