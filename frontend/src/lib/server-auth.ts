import { NextRequest } from 'next/server';

export type AppRole = 'USER' | 'DATA_MANAGER' | 'ADMIN';

export interface AccountResponse {
  id: number;
  username: string;
  email: string;
  role: AppRole;
  enabled: boolean;
  createdAt: string;
  updatedAt: string | null;
}

function getBackendUrl() {
  return process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8084/api';
}

function getBearerToken(request: NextRequest) {
  let header = request.headers.get('authorization');
  
  // Fallback cho luồng tải file native của trình duyệt (không gửi được header)
  if (!header) {
    const urlToken = request.nextUrl.searchParams.get('token');
    if (urlToken) {
      header = `Bearer ${urlToken}`;
    }
  }

  if (!header?.startsWith('Bearer ')) {
    return null;
  }

  return header.slice(7);
}

export async function getAccountFromRequest(request: NextRequest): Promise<AccountResponse | null> {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  const response = await fetch(`${getBackendUrl()}/account/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function requireRoleFromRequest(request: NextRequest, allowedRoles: AppRole[]) {
  const account = await getAccountFromRequest(request);

  if (!account || !allowedRoles.includes(account.role)) {
    throw new Error('Unauthorized');
  }

  return account;
}
