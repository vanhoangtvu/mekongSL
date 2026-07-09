import { NextRequest } from 'next/server';
import { API_URL } from './api';

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
  return API_URL;
}

function getBearerToken(request: NextRequest) {
  const header = request.headers.get('authorization');
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
