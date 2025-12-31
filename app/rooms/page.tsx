'use client';

import { ID, type Models } from 'appwrite';
import { useEffect, useMemo, useState } from 'react';
import { getClients } from '../../lib/appwrite';
import { uploadToCloudinary } from '../../lib/cloudinary';

type Room = {
  $id: string;
  name: string;
  description?: string;
  price: number;
  capacity?: number;
  amenities?: string[];
  images?: string[];
  branchId: string;
  available?: boolean;
};

const COLLECTION = 'rooms';

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Room>>({
    branchId: '', // branchId kept for backward compatibility, set to empty string
    price: 0,
    capacity: 1,
    amenities: [],
  });
  const [files, setFiles] = useState<FileList | null>(null);

  const clientBundle = useMemo(() => {
    try {
      return getClients();
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, []);

  const fetchRooms = async () => {
    if (!clientBundle) return;
    setLoading(true);
    setError(null);
    try {
      const res = await clientBundle.databases.listDocuments<Room & Models.Document>(
        clientBundle.databaseId,
        COLLECTION,
        [] // No branchId filtering - single branch system
      );
      setRooms(res.documents);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    if (!clientBundle) return;
    if (!form.name || form.price === undefined) {
      setError('Name and Price are required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let imageUrls: string[] = [];
      if (files && files.length > 0) {
        const uploads = Array.from(files).map((f) => uploadToCloudinary(f, 'room_images'));
        imageUrls = await Promise.all(uploads);
      }

      await clientBundle.databases.createDocument(
        clientBundle.databaseId,
        COLLECTION,
        ID.unique(),
        {
          name: form.name,
          description: form.description || '',
          price: Number(form.price) || 0,
          capacity: Number(form.capacity) || 1,
          amenities: form.amenities || [],
          images: imageUrls,
          branchId: '', // Single branch system - empty string
          available: form.available ?? true,
        }
      );
      setForm({ branchId: '', price: 0, capacity: 1, amenities: [] });
      setFiles(null);
      await fetchRooms();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!clientBundle) return;
    setLoading(true);
    setError(null);
    try {
      await clientBundle.databases.deleteDocument(clientBundle.databaseId, COLLECTION, id);
      await fetchRooms();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div
        style={{
          background: '#fff',
          padding: 16,
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Create Room</h2>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <div style={{ display: 'grid', gap: 12 }}>
          <input
            placeholder='Name'
            value={form.name || ''}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            style={inputStyle}
          />
          <textarea
            placeholder='Description'
            value={form.description || ''}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            style={inputStyle}
          />
          <input
            type='number'
            placeholder='Price'
            value={form.price ?? 0}
            onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
            style={inputStyle}
          />
          <input
            type='number'
            placeholder='Capacity'
            value={form.capacity ?? 1}
            onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
            style={inputStyle}
          />
          <input
            placeholder='Amenities (comma separated)'
            value={(form.amenities || []).join(', ')}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                amenities: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              }))
            }
            style={inputStyle}
          />
          <input
            type='file'
            accept='image/*'
            multiple
            onChange={(e) => setFiles(e.target.files)}
            style={inputStyle}
          />
          <button onClick={handleSubmit} disabled={loading} style={buttonStyle}>
            {loading ? 'Saving...' : 'Save Room'}
          </button>
        </div>
      </div>

      <div
        style={{
          background: '#fff',
          padding: 16,
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
        }}
      >
        <h3 style={{ marginTop: 0 }}>Rooms</h3>
        {loading && <p>Loading...</p>}
        {!loading && rooms.length === 0 && <p>No rooms found.</p>}
        <div style={{ display: 'grid', gap: 12 }}>
          {rooms.map((room) => (
            <div
              key={room.$id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 12,
                borderRadius: 10,
                border: '1px solid #eee',
              }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {room.images?.[0] ? (
                  <img
                    src={room.images[0]}
                    alt={room.name}
                    style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 8 }}
                  />
                ) : (
                  <div style={{ width: 60, height: 40, background: '#f3f3f3', borderRadius: 8 }} />
                )}
                <div>
                  <strong>{room.name}</strong>
                  <div style={{ color: '#666', fontSize: 13 }}>
                    ${room.price}/night · Cap {room.capacity}
                  </div>
                </div>
              </div>
              <button onClick={() => handleDelete(room.$id)} style={dangerButtonStyle}>
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '12px',
  borderRadius: 8,
  border: '1px solid #e5e5e5',
  fontSize: 14,
};

const buttonStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: 10,
  border: 'none',
  background: '#ff7f50',
  color: '#fff',
  fontWeight: 700,
  cursor: 'pointer',
};

const dangerButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: '#f43f5e',
};
