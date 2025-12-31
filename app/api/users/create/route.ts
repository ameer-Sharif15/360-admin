import { Account, Client, Databases, ID } from 'appwrite';
import { NextRequest, NextResponse } from 'next/server';

const endpoint = process.env.APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1';
const projectId = process.env.APPWRITE_PROJECT_ID || '69336519000e10827583';
const databaseId = process.env.APPWRITE_DATABASE_ID || '6933653e00093009e393';
const apiKey =
  process.env.APPWRITE_API_KEY ||
  'standard_01c8ddf62537f29931af581794f1191d169548c4599c56d9b5458cad75c5477b152e18eeb87a84c130b1702fa564001be766610f7fc11a1b75b5a4e087c515ff2448a838a47c3e4e890a47a2753b33b35ef0a9c95abb78fb971b49bb5207f132200838a15cd74e8c1b00d7d8b5393f0f153a68558082140b4a2bd5b6cf9da958';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, displayName, email, password, role, supportType } = body;

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
