import { Client, Databases } from 'appwrite';

const endpoint = 'https://fra.cloud.appwrite.io/v1';
const projectId = '69336519000e10827583';
const databaseId = '6933653e00093009e393';
const apiKey =
  '750b247b1e3aa367cf71b1e67ce2ef81c5836dd98ac0237c944bb682a2877c8ead9b64de7fcf95025b3b0d3297d4fe455506e8a606ea932dc85dfa1620c5e2b8bb83767b36d7c0dae900625aa0adc060078d895a6cb7e149c42a4c5182928fd94f22cb0730ecd6aa7f828f5eaef3bb22545e5c724f422c5f573021bda5edac3b';

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

export function getClients() {
  if (!endpoint || !projectId || !apiKey) {
    throw new Error('Missing Appwrite configuration for admin dashboard');
  }
  const client = new Client().setEndpoint(endpoint).setProject(projectId);
  // setKey is available in the Node client; typings in the web bundle omit it, so we cast.
  // (client as any).setKey(apiKey);
  const databases = new Databases(client);
  return { client, databases, databaseId, COLLECTIONS };
}
