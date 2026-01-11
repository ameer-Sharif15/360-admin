'use client';

import { ID, Query, type Models } from 'appwrite';
import { useEffect, useMemo, useState } from 'react';
import { getClients } from '../../lib/appwrite';

import { uploadToCloudinary } from '../../lib/cloudinary';

type MinimartItem = {
  $id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
  image?: string;
  description?: string;
};

const COLLECTION_KEY = 'MINI_MART_ITEMS';

export default function MinimartPage() {
  const [items, setItems] = useState<MinimartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<MinimartItem>>({ available: true, price: 0, image: '' });
  const [file, setFile] = useState<File | null>(null);

  const clientBundle = useMemo(() => {
    try {
      return getClients();
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, []);

  const fetchItems = async () => {
    if (!clientBundle) return;
    setLoading(true);
    try {
      const res = await clientBundle.databases.listDocuments<MinimartItem & Models.Document>(
        clientBundle.databaseId,
        clientBundle.COLLECTIONS[COLLECTION_KEY],
        [Query.orderAsc('name')]
      );
      setItems(res.documents);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [clientBundle]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientBundle) return;
    setLoading(true);
    try {
      const { databases, databaseId, COLLECTIONS } = clientBundle;
      
      let imageUrl = form.image || '';
      if (file) {
        imageUrl = await uploadToCloudinary(file, 'minimart');
      }

      const data = { 
        name: form.name,
        price: Number(form.price) || 0,
        category: form.category || '',
        available: form.available ?? true,
        image: imageUrl,
        description: form.description || '',
      };
      
      if (editingId) {
        await databases.updateDocument(databaseId, COLLECTIONS[COLLECTION_KEY], editingId, data);
      } else {
        await databases.createDocument(databaseId, COLLECTIONS[COLLECTION_KEY], ID.unique(), data);
      }
      
      resetForm();
      await fetchItems();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ available: true, price: 0, image: '' });
    setFile(null);
  };

  const handleEdit = (item: MinimartItem) => {
    setEditingId(item.$id);
    setForm(item);
    setShowForm(true);
  };

  const handleRemoveImage = () => {
    setForm(f => ({ ...f, image: '' }));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    if (!clientBundle) return;
    setLoading(true);
    try {
      const { databases, databaseId, COLLECTIONS } = clientBundle;
      await databases.deleteDocument(databaseId, COLLECTIONS[COLLECTION_KEY], id);
      await fetchItems();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Minimart Inventory</h2>
        <button onClick={() => { 
          if(showForm) resetForm(); 
          else setShowForm(true);
        }} style={buttonStyle}>
          {showForm ? 'Cancel' : '+ Add Item'}
        </button>
      </header>

      {error && <p style={{ color: 'red', background: '#fee2e2', padding: 12, borderRadius: 8 }}>{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} style={cardStyle}>
          <h3>{editingId ? 'Edit Item' : 'New Item'}</h3>
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
            <input 
              placeholder="Item Name" 
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
              placeholder="Category (e.g., Drinks, Snacks)" 
              required 
              value={form.category || ''} 
              onChange={e => setForm({...form, category: e.target.value})} 
              style={inputStyle}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                Available for Sale
                <input 
                  type="checkbox" 
                  checked={form.available} 
                  onChange={e => setForm({...form, available: e.target.checked})} 
                />
              </label>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: 13, color: '#666', display: 'block', marginBottom: 12 }}>Item Image</label>
              
              {form.image && (
                <div style={{ position: 'relative', width: 200, height: 120, marginBottom: 16 }}>
                  <img src={form.image} alt="Product" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} />
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
          </div>
          <button type="submit" disabled={loading} style={{ ...buttonStyle, marginTop: 24 }}>
            {loading ? 'Processing...' : editingId ? 'Update Item' : 'Add to Inventory'}
          </button>
        </form>
      )}

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {items.map(item => (
          <div key={item.$id} style={cardStyle}>
            {item.image && (
              <img 
                src={item.image} 
                alt={item.name} 
                style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8, marginBottom: 16 }} 
              />
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: 18 }}>{item.name}</h4>
                <p style={{ margin: '4px 0', fontSize: 13, color: '#666' }}>{item.category}</p>
              </div>
              <span style={{ fontWeight: 700, fontSize: 18, color: '#ff7f50' }}>₦{item.price.toLocaleString()}</span>
            </div>
            
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ 
                width: 10, height: 10, borderRadius: '50%', 
                background: item.available ? '#10B981' : '#EF4444' 
              }} />
              <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>
                {item.available ? 'In Stock' : 'Out of Stock'}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button onClick={() => handleEdit(item)} style={smallButtonStyle}>Edit</button>
              <button 
                onClick={() => handleDelete(item.$id)} 
                style={{ ...smallButtonStyle, background: '#fee2e2', color: '#EF4444' }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
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
