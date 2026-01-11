'use client';

import { ID, Query, type Models } from 'appwrite';
import { useEffect, useMemo, useState } from 'react';
import { getClients } from '../../lib/appwrite';

type StaffMember = {
  $id: string;
  name: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  employeeId?: string;
  description?: string;
  photoUrl?: string;
  active: boolean;
};

const COLLECTION_KEY = 'STAFF_MEMBERS';

export default function StaffsPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<StaffMember>>({ active: true });

  const clientBundle = useMemo(() => {
    try {
      return getClients();
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, []);

  const fetchStaff = async () => {
    if (!clientBundle) return;
    setLoading(true);
    try {
      const res = await clientBundle.databases.listDocuments<StaffMember & Models.Document>(
        clientBundle.databaseId,
        clientBundle.COLLECTIONS[COLLECTION_KEY],
        [Query.orderDesc('$createdAt')]
      );
      setStaff(res.documents);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [clientBundle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientBundle) return;
    setLoading(true);
    try {
      const { databases, databaseId, COLLECTIONS } = clientBundle;
      if (editingId) {
        await databases.updateDocument(databaseId, COLLECTIONS[COLLECTION_KEY], editingId, form);
      } else {
        await databases.createDocument(databaseId, COLLECTIONS[COLLECTION_KEY], ID.unique(), form);
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ active: true });
      await fetchStaff();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (member: StaffMember) => {
    setEditingId(member.$id);
    setForm(member);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this staff member?')) return;
    if (!clientBundle) return;
    setLoading(true);
    try {
      const { databases, databaseId, COLLECTIONS } = clientBundle;
      await databases.deleteDocument(databaseId, COLLECTIONS[COLLECTION_KEY], id);
      await fetchStaff();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Staff Directory</h2>
        <button 
          onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ active: true }); }}
          style={buttonStyle}
        >
          {showForm ? 'Cancel' : '+ Add Staff'}
        </button>
      </div>

      {error && <p style={{ color: 'red', background: '#fee2e2', padding: 12, borderRadius: 8 }}>{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} style={cardStyle}>
          <h3>{editingId ? 'Edit Staff Member' : 'Add New Staff Member'}</h3>
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
            <input 
              placeholder="Full Name" 
              required 
              value={form.name || ''} 
              onChange={e => setForm({...form, name: e.target.value})} 
              style={inputStyle}
            />
            <input 
              placeholder="Email" 
              type="email" 
              value={form.email || ''} 
              onChange={e => setForm({...form, email: e.target.value})} 
              style={inputStyle}
            />
            <input 
              placeholder="Phone Number" 
              value={form.phone || ''} 
              onChange={e => setForm({...form, phone: e.target.value})} 
              style={inputStyle}
            />
            <input 
              placeholder="Employee ID" 
              value={form.employeeId || ''} 
              onChange={e => setForm({...form, employeeId: e.target.value})} 
              style={inputStyle}
            />
            <input 
              placeholder="Department" 
              value={form.department || ''} 
              onChange={e => setForm({...form, department: e.target.value})} 
              style={inputStyle}
            />
            <input 
              placeholder="Position" 
              value={form.position || ''} 
              onChange={e => setForm({...form, position: e.target.value})} 
              style={inputStyle}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              Active Member
              <input 
                type="checkbox" 
                checked={form.active} 
                onChange={e => setForm({...form, active: e.target.checked})} 
              />
            </label>
          </div>
          <textarea 
            placeholder="Staff Description" 
            value={form.description || ''} 
            onChange={e => setForm({...form, description: e.target.value})} 
            style={{ ...inputStyle, gridColumn: 'span 2', minHeight: 80, marginTop: 16 }}
          />
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button type="submit" disabled={loading} style={buttonStyle}>
              {loading ? 'Saving...' : editingId ? 'Update Staff' : 'Create Staff'}
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {staff.map(member => (
          <div key={member.$id} style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 18 }}>{member.name}</h4>
                <p style={{ margin: '4px 0', fontSize: 14, color: '#666' }}>{member.position} • {member.department}</p>
              </div>
              <span style={{ 
                background: member.active ? '#D1FAE5' : '#F3F4F6', 
                color: member.active ? '#10B981' : '#6B7280',
                padding: '2px 8px',
                borderRadius: 99,
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase'
              }}>
                {member.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            
            <div style={{ margin: '16px 0', fontSize: 13, color: '#444' }}>
              <div>📧 {member.email || 'No email'}</div>
              <div>📞 {member.phone || 'No phone'}</div>
              <div>🆔 {member.employeeId || 'No ID'}</div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
              <button onClick={() => handleEdit(member)} style={smallButtonStyle}>Edit</button>
              <button 
                onClick={() => handleDelete(member.$id)} 
                style={{ ...smallButtonStyle, background: '#fee2e2', color: '#EF4444' }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {staff.length === 0 && !loading && <p>No staff members found.</p>}
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  padding: 24,
  borderRadius: 16,
  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  display: 'flex',
  flexDirection: 'column',
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

const smallButtonStyle: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: 'none',
  background: '#f3f4f6',
  color: '#1E1E1E',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
