import { Client, Databases, Account } from 'appwrite';

const endpoint = 'https://fra.cloud.appwrite.io/v1';
const projectId = '697c81a100017b683068';
const databaseId = '697c81e1000f2d677ad7';
const apiKey =
  'standard_5abeca61b9e9aea1f66989c7ee6ef201e95472f83450d4de47799ffae793929ff6af0279a92db4e3f25df63cba2aa3f51b0c4daefaa629a8fe7df2ab3539336f948b57c60efe1b1e6e7f35506b5d64920f134daab07316057614dec2ace3142ddababb908509cd874dcf6119b3e94a9040c448aaee8bafb9e66dbffaee165281';

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
  const databases = new Databases(client);
  const account = new Account(client);
  return { client, databases, account, databaseId, COLLECTIONS };
}
