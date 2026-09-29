import { apiRequest, API_BASE_URL } from './api';

export const API_URL = API_BASE_URL;

export namespace Models {
  export type Document = {
    $id: string;
    $createdAt?: string;
    $updatedAt?: string;
    [key: string]: any;
  };
  export type User<T = any> = {
    $id: string;
    name: string;
    email: string;
    prefs?: T;
    [key: string]: any;
  };
}

export const COLLECTIONS = {
  USERS: 'users',
  BRANCHES: 'branches',
  POSTS: 'posts',
  CHATS: 'chats',
  MESSAGES: 'messages',
  ORDERS: 'orders',
  ACTIVITIES: 'activities',
  ROOMS: 'rooms',
  MENU_ITEMS: 'menu_items',
  ACTIVITIES_HOTEL: 'activities_hotel',
  EVENTS: 'events',
  GALLERY: 'gallery',
  SERVICES: 'services',
  BOOKINGS: 'bookings',
  STAFF_ATTENDANCE: 'staff_attendance',
  STAFF_MEMBERS: 'staff_members',
  MINI_MART_ITEMS: 'mini_mart_items',
};

export const ID = {
  unique: () => Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
};

export const Query = {
  equal: (attr: string, val: any) => ({ type: 'equal', attr, val }),
  orderDesc: (attr: string) => ({ type: 'orderDesc', attr }),
  orderAsc: (attr: string) => ({ type: 'orderAsc', attr }),
  limit: (val: number) => ({ type: 'limit', val }),
  greaterThanEqual: (attr: string, val: any) => ({ type: 'gte', attr, val }),
  lessThanEqual: (attr: string, val: any) => ({ type: 'lte', attr, val }),
};

const normalize = (doc: any): any => {
  if (!doc || typeof doc !== 'object') return doc;
  const id = doc._id || doc.$id || doc.id;
  const createdAt = doc.createdAt || doc.$createdAt || new Date().toISOString();
  const updatedAt = doc.updatedAt || doc.$updatedAt || createdAt;
  return {
    ...doc,
    $id: id,
    _id: id,
    $createdAt: createdAt,
    $updatedAt: updatedAt,
  };
};

const mapCollectionToEndpoint = (col: string): string => {
  switch (col) {
    case 'users':
      return '/api/users';
    case 'orders':
      return '/api/orders';
    case 'rooms':
      return '/api/rooms';
    case 'services':
      return '/api/services';
    case 'staff_members':
      return '/api/staff';
    case 'staff_attendance':
      return '/api/staff/attendance';
    case 'mini_mart_items':
      return '/api/minimart';
    case 'events':
    case 'activities':
    case 'activities_hotel':
      return '/api/events';
    case 'gallery':
      return '/api/gallery';
    case 'menu_items':
      return '/api/menu';
    case 'bookings':
      return '/api/bookings';
    case 'branches':
      return '/api/branches';
    default:
      return `/api/${col}`;
  }
};

class ExpressDatabasesAdapter {
  async listDocuments<T = any>(_databaseId: string, collectionId: string, _queries?: any[]) {
    const endpoint = mapCollectionToEndpoint(collectionId);
    try {
      const data = await apiRequest(endpoint);
      const rawList = Array.isArray(data)
        ? data
        : Array.isArray(data?.documents)
        ? data.documents
        : [];
      const docs = rawList.map(normalize);
      return {
        documents: docs as T[],
        total: data?.total !== undefined ? data.total : docs.length,
      };
    } catch (err: any) {
      console.warn(`listDocuments error for ${collectionId}:`, err);
      return { documents: [] as T[], total: 0 };
    }
  }

  async getDocument<T = any>(_databaseId: string, collectionId: string, documentId: string): Promise<T> {
    const endpoint = mapCollectionToEndpoint(collectionId);
    const data = await apiRequest(`${endpoint}/${documentId}`);
    return normalize(data) as T;
  }

  async createDocument<T = any>(_databaseId: string, collectionId: string, documentId: string, data: any): Promise<T> {
    const endpoint = mapCollectionToEndpoint(collectionId);
    let payload = { ...data };
    if (collectionId === 'users') {
      const res = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          name: payload.displayName || payload.username || 'User',
        }),
      });
      return normalize(res) as T;
    }
    const res = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return normalize(res) as T;
  }

  async updateDocument<T = any>(_databaseId: string, collectionId: string, documentId: string, data: any): Promise<T> {
    const endpoint = mapCollectionToEndpoint(collectionId);
    let method = 'PUT';
    let url = `${endpoint}/${documentId}`;

    if (collectionId === 'users') {
      url = `/api/users/${documentId}/profile`;
    } else if (collectionId === 'orders' && data.status && Object.keys(data).length === 1) {
      url = `/api/orders/${documentId}/status`;
    }

    const res = await apiRequest(url, {
      method,
      body: JSON.stringify(data),
    });
    return normalize(res) as T;
  }

  async deleteDocument(_databaseId: string, collectionId: string, documentId: string) {
    const endpoint = mapCollectionToEndpoint(collectionId);
    return await apiRequest(`${endpoint}/${documentId}`, {
      method: 'DELETE',
    });
  }
}

class ExpressAccountAdapter {
  async get() {
    const user = await apiRequest('/api/auth/me');
    return {
      ...normalize(user),
      name: user.displayName || user.name || user.username || 'Admin',
      email: user.email,
    };
  }

  async createEmailSession(email: string, password: string) {
    const res = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token && typeof window !== 'undefined') {
      localStorage.setItem('admin_jwt', res.token);
      localStorage.setItem('admin_user', JSON.stringify(normalize(res)));
    }
    return res;
  }

  async deleteSession(_sessionId: string = 'current') {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('admin_jwt');
      localStorage.removeItem('admin_user');
    }
    return { status: true };
  }
}

export function getClients() {
  const databases = new ExpressDatabasesAdapter();
  const account = new ExpressAccountAdapter();
  const databaseId = 'mongodb_default';
  const client = {
    setEndpoint: () => client,
    setProject: () => client,
  };

  return { client, databases, account, databaseId, COLLECTIONS };
}
