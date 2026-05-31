import { authService } from './auth';
import { DEFAULT_DATA_SOURCE, type DataSourceKey } from './constants/data-sources';
import type { DataRecord } from './utils/record-utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://113.170.158.188:8084/api';

export type AdminRole = 'USER' | 'DATA_MANAGER' | 'ADMIN';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: AdminRole;
  enabled: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export interface AdminUserForm {
  username: string;
  email: string;
  password: string;
  role: AdminRole;
  enabled: boolean;
}

export interface S3FileItem {
  key: string;
  url?: string;
  exists?: boolean;
  size?: number;
  lastModified?: string;
  modifiedAt?: string;
}

function getHeaders(extraHeaders: HeadersInit = {}): HeadersInit {
  const token = authService.getToken();
  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function requestJson<T>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: getHeaders(init.headers),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || body?.message || 'Request failed');
  }

  return response.json();
}

function getBackendAdminUrl(path: string) {
  return `${API_URL}${path}`;
}

export async function loadCurrentAccount() {
  return requestJson<AdminUser>(getBackendAdminUrl('/account/me'));
}

export async function listAdminUsers() {
  return requestJson<AdminUser[]>(getBackendAdminUrl('/admin/users'));
}

export async function createAdminUser(user: AdminUserForm) {
  return requestJson<AdminUser>(getBackendAdminUrl('/admin/users'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(user),
  });
}

export async function updateAdminUser(id: number, user: AdminUserForm) {
  const payload = {
    ...user,
    ...(user.password.trim() ? { password: user.password } : {}),
  };

  return requestJson<AdminUser>(getBackendAdminUrl(`/admin/users/${id}`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminUser(id: number) {
  return requestJson<{ message: string }>(getBackendAdminUrl(`/admin/users/${id}`), {
    method: 'DELETE',
  });
}

export interface LayerFolderDto {
  id: number;
  layerId: number;
  parentId: number | null;
  name: string;
  logicalPath: string;
  createdAt: string;
  children?: LayerFolderDto[];
}

export async function listLayerFolderTree(layerId: number) {
  return requestJson<LayerFolderDto[]>(getBackendAdminUrl(`/gis/layers/${layerId}/folders/tree`));
}

export async function createLayerFolder(layerId: number, name: string, parentId?: number) {
  return requestJson<LayerFolderDto>(getBackendAdminUrl('/gis/folders'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ layerId, name, parentId }),
  });
}

export async function deleteLayerFolder(folderId: number) {
  return fetch(getBackendAdminUrl(`/gis/folders/${folderId}`), {
    method: 'DELETE',
    headers: getHeaders(),
  });
}

export async function uploadLayerFile(layerId: number, file: File, folderId?: number, category?: string) {
  const formData = new FormData();
  formData.set('file', file);
  if (folderId) formData.set('folderId', String(folderId));
  if (category) formData.set('category', category);

  return requestJson<Record<string, unknown>>(getBackendAdminUrl(`/gis/layers/${layerId}/upload-file`), {
    method: 'POST',
    body: formData,
  });
}

export interface GisLayer {
  id: number;
  layerName: string;
  layerType: string;
}

export async function listGisLayers() {
  const payload = await requestJson<{ content: GisLayer[] }>(getBackendAdminUrl('/gis/layers?size=100'));
  return payload.content || [];
}

export async function registerLayerObject(layerId: number, s3Key: string, sizeBytes: number = 0) {
  return requestJson<Record<string, unknown>>(getBackendAdminUrl(`/gis/layers/${layerId}/objects`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      s3Key,
      sizeBytes,
      contentType: s3Key.endsWith('.tif') || s3Key.endsWith('.tiff') ? 'image/tiff' : 'application/octet-stream',
      role: 'SOURCE'
    }),
  });
}

export async function listS3Files(prefix = '') {
  const url = new URL(getBackendAdminUrl('/s3/list'));
  if (prefix) {
    url.searchParams.set('prefix', prefix);
  }

  const payload = await requestJson<{ files: string[] | S3FileItem[]; count: number }>(url);
  return Array.isArray(payload.files)
    ? payload.files.map((file) => (typeof file === 'string' ? { key: file } : file))
    : [];
}

export async function uploadS3File(file: File, key?: string) {
  const formData = new FormData();
  formData.set('file', file);
  if (key?.trim()) {
    formData.set('key', key.trim());
  }

  return requestJson<{ key: string; url: string; message: string }>(getBackendAdminUrl('/s3/upload'), {
    method: 'POST',
    body: formData,
  });
}

export async function deleteS3File(key: string) {
  return requestJson<{ message: string }>(getBackendAdminUrl(`/s3/delete/${key}`), {
    method: 'DELETE',
  });
}

export async function checkS3FileExists(key: string) {
  const payload = await requestJson<{ exists: boolean }>(getBackendAdminUrl(`/s3/exists/${key}`));
  return payload.exists;
}

export interface S3FolderContent {
  folders: string[];
  files: S3FileItem[];
  prefix: string;
}

export async function listS3Folder(prefix = '') {
  const url = new URL(getBackendAdminUrl('/s3/folders'));
  if (prefix) {
    url.searchParams.set('prefix', prefix);
  }

  return requestJson<S3FolderContent>(url);
}

export async function createS3Folder(path: string) {
  return requestJson<{ message: string; path: string }>(getBackendAdminUrl('/s3/create-folder'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
}

export async function copyS3File(sourceKey: string, destinationKey: string) {
  return requestJson<{ message: string; sourceKey: string; destinationKey: string }>(getBackendAdminUrl('/s3/copy'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceKey, destinationKey }),
  });
}

export async function renameS3File(oldKey: string, newKey: string) {
  return requestJson<{ message: string; oldKey: string; newKey: string }>(getBackendAdminUrl('/s3/rename'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldKey, newKey }),
  });
}

export async function renameS3Folder(oldPrefix: string, newPrefix: string) {
  return requestJson<{ message: string; oldPrefix: string; newPrefix: string }>(getBackendAdminUrl('/s3/rename-folder'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPrefix, newPrefix }),
  });
}

export async function downloadS3File(key: string) {
  const token = authService.getToken();
  const response = await fetch(getBackendAdminUrl(`/s3/download/${key}`), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    throw new Error('Không tải được file');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = key.split('/').pop() || 'download';
  link.click();
  URL.revokeObjectURL(url);
}

export async function loadDataRows(source: DataSourceKey = DEFAULT_DATA_SOURCE, date?: string, runId?: string, deviceId?: string) {
  const url = new URL('/api/mysql', window.location.origin);
  url.searchParams.set('source', source);
  if (date) {
    url.searchParams.set('date', date);
  }
  if (runId) {
    url.searchParams.set('runId', runId);
  }
  if (deviceId) {
    url.searchParams.set('deviceId', deviceId);
  }

  const response = await fetch(url.toString(), {
    headers: getHeaders(),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || 'Không tải được dữ liệu');
  }

  const payload = await response.json();
  return (payload.data || []) as DataRecord[];
}

export async function loadDataDevices(source: DataSourceKey = DEFAULT_DATA_SOURCE) {
  const url = new URL('/api/mysql', window.location.origin);
  url.searchParams.set('source', source);
  url.searchParams.set('view', 'devices');

  const response = await fetch(url.toString(), {
    headers: getHeaders(),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || 'Không tải được danh sách thiết bị');
  }

  const payload = await response.json();
  return (payload.data || []) as Array<{ device_id: string }>;
}

export async function loadDataTimeframes(source: DataSourceKey = DEFAULT_DATA_SOURCE, date: string, deviceId?: string) {
  const url = new URL('/api/mysql', window.location.origin);
  url.searchParams.set('source', source);
  url.searchParams.set('date', date);
  url.searchParams.set('view', 'timeframes');
  if (deviceId) {
    url.searchParams.set('deviceId', deviceId);
  }

  const response = await fetch(url.toString(), {
    headers: getHeaders(),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || 'Không tải được danh sách khung giờ');
  }

  const payload = await response.json();
  return (payload.data || []) as Array<{ fetch_run_id: string; fetched_at: string; device_id?: string }>;
}

export async function triggerDataFetch(source: DataSourceKey = DEFAULT_DATA_SOURCE) {
  const response = await fetch(`/api/fetch?source=${source}`, {
    method: 'POST',
    headers: getHeaders(),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || 'Không lấy được dữ liệu');
  }

  return payload as { message: string; recordCount: number; insertedRows: number; timestamp: string };
}

export async function listSourceFiles(source: DataSourceKey = DEFAULT_DATA_SOURCE) {
  const response = await fetch(`/api/files?source=${source}`);
  if (!response.ok) {
    throw new Error('Không tải được danh sách file');
  }

  const payload = await response.json();
  return (payload.files || []) as Array<{ name: string; modifiedAt: string; size: number }>;
}

export async function loadSourceFile(source: DataSourceKey, filename: string) {
  const response = await fetch(`/api/data/${encodeURIComponent(filename)}?source=${source}`);
  if (!response.ok) {
    throw new Error('Không tải được file dữ liệu');
  }

  const payload = await response.json();
  return (payload.data || []) as DataRecord[];
}

export async function listMonthlyExportFiles() {
  const response = await fetch('/api/mekong-monthly/files', {
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error('Không tải được danh sách Excel tháng');
  }

  const payload = await response.json();
  return (payload.files || []) as Array<{ name: string; modifiedAt: string; size: number }>;
}

export async function refreshMonthlyExport() {
  const response = await fetch('/api/mekong-monthly/update', {
    method: 'POST',
    headers: getHeaders(),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.error || 'Không cập nhật được file Excel');
  }

  return payload as { message: string };
}

export async function exportMonthlyXlsx(year: number, month: number, metric: string) {
  const url = new URL('/api/mekong-monthly/export', window.location.origin);
  url.searchParams.set('year', String(year));
  url.searchParams.set('month', String(month));
  url.searchParams.set('metric', metric);

  const response = await fetch(url.toString(), {
    headers: getHeaders(),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || 'Không xuất được file Excel');
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `mekong-${metric}-${year}-${String(month).padStart(2, '0')}.xlsx`;
  link.click();
  URL.revokeObjectURL(objectUrl);
}
