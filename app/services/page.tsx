'use client';

import { ID, type Models } from 'appwrite';
import { useEffect, useMemo, useState } from 'react';
import { getClients } from '../../lib/appwrite';
import { uploadToCloudinary } from '../../lib/cloudinary';

type Service = {
  $id: string;
  name: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  branchId: string;
};

const COLLECTION = 'services';

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Service>>({ branchId: '', imageUrl: '' });
  const [file, setFile] = useState<File | null>(null);

  const clientBundle = useMemo(() => {
    try {
      return getClients();
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, []);

  const fetchServices = async () => {
    if (!clientBundle) return;
    setLoading(true);
    setError(null);
    try {
      const res = await clientBundle.databases.listDocuments<Service & Models.Document>(
        clientBundle.databaseId,
        COLLECTION,
        []
      );
      setServices(res.documents);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [clientBundle]);

  const handleSubmit = async () => {
    if (!clientBundle) return;
    if (!form.name) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let imageUrl = form.imageUrl || '';
      if (file) {
        imageUrl = await uploadToCloudinary(file, 'services');
      }

      const serviceData = {
        name: form.name,
        description: form.description || '',
        icon: form.icon || '',
        branchId: '',
      };

      if (editingId) {
        await clientBundle.databases.updateDocument(clientBundle.databaseId, COLLECTION, editingId, serviceData);
      } else {
        await clientBundle.databases.createDocument(clientBundle.databaseId, COLLECTION, ID.unique(), serviceData);
      }

      resetForm();
      await fetchServices();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({ branchId: '', imageUrl: '' });
    setFile(null);
    setEditingId(null);
  };

  const handleEdit = (svc: Service) => {
    setEditingId(svc.$id);
    setForm(svc);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRemoveImage = () => {
    setForm(f => ({ ...f, imageUrl: '' }));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    if (!clientBundle) return;
    setLoading(true);
    setError(null);
    try {
      await clientBundle.databases.deleteDocument(clientBundle.databaseId, COLLECTION, id);
      await fetchServices();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div style={{ background: '#fff', padding: 24, borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <h2 style={{ marginTop: 0 }}>{editingId ? 'Edit Service' : 'Create Service'}</h2>
        {error && <p style={{ color: 'red', background: '#fee2e2', padding: 12, borderRadius: 8 }}>{error}</p>}
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
          <input
            placeholder='Service Name'
            value={form.name || ''}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            style={inputStyle}
          />
          <input
            placeholder='Icon Name (Optional)'
            value={form.icon || ''}
            onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
            style={inputStyle}
          />
          <div style={{ gridColumn: 'span 2' }}>
            <textarea
              placeholder='Service Description'
              value={form.description || ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              style={{ ...inputStyle, minHeight: 80 }}
            />
          </div>
          
          <div style={{ gridColumn: 'span 2' }}>
            <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 12 }}>Service Image</label>
            
            {form.imageUrl && (
              <div style={{ position: 'relative', width: 200, height: 120, marginBottom: 16 }}>
                <img src={form.imageUrl} alt="Service" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
                <button 
                  onClick={handleRemoveImage}
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
              type='file'
              accept='image/*'
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={inputStyle}
            />
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button onClick={handleSubmit} disabled={loading} style={buttonStyle}>
            {loading ? 'Saving...' : editingId ? 'Update Service' : 'Save Service'}
          </button>
          {editingId && (
            <button onClick={resetForm} style={{ ...buttonStyle, background: '#6B7280' }}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))' }}>
        {services.map((svc) => (
          <div key={svc.$id} style={{ background: '#fff', padding: 20, borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', gap: 16 }}>
              {svc.imageUrl ? (
                <img src={svc.imageUrl} alt={svc.name} style={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 8 }} />
              ) : (
                <div style={{ width: 80, height: 60, background: '#f3f3f3', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                  No Image
                </div>
              )}
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0 }}>{svc.name}</h4>
                <p style={{ margin: '4px 0', fontSize: 12, color: '#666', lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {svc.description}
                </p>
                {svc.icon && <span style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>Icon: {svc.icon}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => handleEdit(svc)} style={smallButtonStyle}>Edit</button>
              <button onClick={() => handleDelete(svc.$id)} style={{ ...smallButtonStyle, background: '#fee2e2', color: '#EF4444' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
