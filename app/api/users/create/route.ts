import { Account, Client, Databases, ID } from 'appwrite';
import { NextRequest, NextResponse } from 'next/server';

const endpoint =  'https://fra.cloud.appwrite.io/v1';
const projectId = '697c81a100017b683068';
const databaseId = '697c81e1000f2d677ad7';
const apiKey =
  'standard_5abeca61b9e9aea1f66989c7ee6ef201e95472f83450d4de47799ffae793929ff6af0279a92db4e3f25df63cba2aa3f51b0c4daefaa629a8fe7df2ab3539336f948b57c60efe1b1e6e7f35506b5d64920f134daab07316057614dec2ace3142ddababb908509cd874dcf6119b3e94a9040c448aaee8bafb9e66dbffaee165281';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, displayName, email, password, role, supportType, location } = body;

    if (!username || !displayName || !email || !password) {
      return NextResponse.json(
        { error: 'Username, Display Name, Email, and Password are required' },
        { status: 400 }
      );
    }

    if (role === 'support' && !supportType) {
      return NextResponse.json(
        { error: 'Support Type is required for support users' },
        { status: 400 }
      );
    }

    // Initialize Appwrite client with API key
    const client = new Client().setEndpoint(endpoint).setProject(projectId);
    // (client as any).setKey(apiKey);

    const account = new Account(client);
    const databases = new Databases(client);

    // Create Appwrite account
    const createdAccount = await account.create(ID.unique(), email, password, displayName);

    console.log('account', createdAccount);

    // Create user profile document
    const userDoc = await databases.createDocument(
      databaseId,
      'users',
      createdAccount.$id, // Use the account ID as the document ID
      {
        username,
        displayName,
        email,
        role: role || 'user',
        supportType: role === 'support' ? supportType : undefined,
        branchAssignedId: '',
        preferredBranchId: '',
        location: location || '',
      }
    );

    return NextResponse.json({
      success: true,
      user: userDoc,
      accountId: createdAccount.$id,
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 500 });
  }
}
