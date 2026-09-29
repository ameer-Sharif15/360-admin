import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';

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

    // Call Express register endpoint
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        name: displayName,
        displayName,
        email,
        password,
        role: role || 'user',
        supportType: role === 'support' ? supportType : undefined,
        location: location || '',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.message || 'Failed to create user' },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        ...data,
        $id: data._id,
      },
      accountId: data._id,
    });
  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 500 });
  }
}
