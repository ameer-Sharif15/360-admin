'use client';

import { ID, Query, type Models } from 'appwrite';
import { useEffect, useMemo, useState } from 'react';
import { getClients } from '../../lib/appwrite';
import { uploadToCloudinary } from '../../lib/cloudinary';

type Activity = {
  $id: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  available: boolean;
  imageUrl?: string;
};

const COLLECTION_KEY = 'ACTIVITIES_HOTEL';

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Activity>>({
    available: true,
    price: 0,
    category: 'General',
    imageUrl: '',
  });
  const [file, setFile] = useState<File | null>(null);

  const clientBundle = useMemo(() => {
    try {
      return getClients();
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, []);

  const fetchActivities = async () => {
    if (!clientBundle) return;
    setLoading(true);
    try {
      const { databases, databaseId, COLLECTIONS } = clientBundle;
      const res = await databases.listDocuments<Activity & Models.Document>(
        databaseId,
        COLLECTIONS[COLLECTION_KEY],
        [Query.orderAsc('name')]
      );
      setActivities(res.documents);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [clientBundle]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ available: true, price: 0, category: 'General', imageUrl: '' });
    setFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientBundle) return;
    setLoading(true);
    setError(null);
    try {
      const { databases, databaseId, COLLECTIONS } = clientBundle;
      
      let imageUrl = form.imageUrl || '';
      if (file) {
        imageUrl = await uploadToCloudinary(file, 'activities_hotel');
      }

      const activityData = {
        name: form.name,
        description: form.description || '',
        price: Number(form.price) || 0,
        available: form.available ?? true,
        category: form.category || 'General',
        imageUrl: imageUrl,
      };

      if (editingId) {
        await databases.updateDocument(databaseId, COLLECTIONS[COLLECTION_KEY], editingId, activityData);
      } else {
        await databases.createDocument(databaseId, COLLECTIONS[COLLECTION_KEY], ID.unique(), activityData);
      }

      resetForm();
      await fetchActivities();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (activity: Activity) => {
    setEditingId(activity.$id);
    setForm(activity);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRemoveImage = () => {
    setForm(f => ({ ...f, imageUrl: '' }));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this activity?')) return;
    if (!clientBundle) return;
    setLoading(true);
    try {
      const { databases, databaseId, COLLECTIONS } = clientBundle;
      await databases.deleteDocument(databaseId, COLLECTIONS[COLLECTION_KEY], id);
      await fetchActivities();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Activities & Experience Management</h2>
        <button onClick={() => (showForm ? resetForm() : setShowForm(true))} style={buttonStyle}>
          {showForm ? 'Cancel' : '+ Add Activity'}
        </button>
      </header>

      {error && <p style={{ color: 'red', background: '#fee2e2', padding: 12, borderRadius: 8 }}>{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} style={cardStyle}>
          <h3>{editingId ? 'Edit Activity' : 'New Activity'}</h3>
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
            <input 
              placeholder="Activity Name" 
              required 
              value={form.name || ''} 
              onChange={e => setForm({...form, name: e.target.value})} 
              style={inputStyle}
            />
            <input 
              placeholder="Price (₦)" 
              type="number" 
              required 
              value={form.price} 
              onChange={e => setForm({...form, price: Number(e.target.value)})} 
              style={inputStyle}
            />
            <input 
              placeholder="Activity Category (e.g., Tour, Spa, Dining)" 
              value={form.category || ''} 
              onChange={e => setForm({...form, category: e.target.value})} 
              style={inputStyle}
            />
            <div style={{ gridColumn: 'span 2' }}>
              <textarea 
                placeholder="Description" 
                value={form.description || ''} 
                onChange={e => setForm({...form, description: e.target.value})} 
                style={{ ...inputStyle, minHeight: 80 }}
              />
            </div>
            
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 12 }}>Activity Image</label>
              
              {form.imageUrl && (
                <div style={{ position: 'relative', width: 200, height: 120, marginBottom: 16 }}>
                  <img src={form.imageUrl} alt="Activity" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                  <button 
                    onClick={handleRemoveImage}
                    type="button"
                    style={{ 
                      position: 'absolute', top: -8, right: -8, background: '#EF4444', color: '#fff', 
                      border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 
                    }}
                  >
                    ×
                  </button>
                </div>
              )}

              <input 
                type="file" 
                accept="image/*" 
                onChange={e => setFile(e.target.files?.[0] || null)} 
                style={inputStyle}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              Activity Available
              <input 
                type="checkbox" 
                checked={form.available} 
                onChange={e => setForm({...form, available: e.target.checked})} 
              />
            </label>
          </div>
          <button type="submit" disabled={loading} style={{ ...buttonStyle, marginTop: 24 }}>
            {loading ? 'Processing...' : editingId ? 'Update Activity' : 'Create Activity'}
          </button>
        </form>
      )}

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {activities.map(activity => (
          <div key={activity.$id} style={cardStyle}>
            {activity.imageUrl ? (
              <img 
                src={activity.imageUrl} 
                alt={activity.name} 
                style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 8, marginBottom: 16 }} 
              />
            ) : (
              <div style={{ width: '100%', height: 180, background: '#f3f4f6', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                No Image Provided
              </div>
            )}
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 18 }}>{activity.name}</h4>
                <p style={{ margin: '4px 0', fontSize: 13, color: '#666' }}>{activity.category}</p>
              </div>
              <span style={{ fontWeight: 700, fontSize: 18, color: '#ff7f50' }}>₦{activity.price.toLocaleString()}</span>
            </div>
            
            <p style={{ margin: '12px 0', fontSize: 13, color: '#444', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {activity.description}
            </p>

            <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ 
                  width: 10, height: 10, borderRadius: '50%', 
                  background: activity.available ? '#10B981' : '#EF4444' 
                }} />
                <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>
                  {activity.available ? 'Available' : 'Unavailable'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleEdit(activity)} style={smallButtonStyle}>Edit</button>
                <button 
                  onClick={() => handleDelete(activity.$id)} 
                  style={{ ...smallButtonStyle, background: '#fee2e2', color: '#EF4444' }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
        {activities.length === 0 && !loading && (
          <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', background: '#fff', borderRadius: 16 }}>
            <p style={{ color: '#666', margin: 0 }}>No activities found in the `activities_hotel` collection.</p>
          </div>
        )}
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
  padding: '6px 14px',
  borderRadius: 8,
  border: 'none',
  background: '#f3f4f6',
  color: '#1E1E1E',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
