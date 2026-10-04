const rawBase =
  process.env.NEXT_PUBLIC_API_URL?.trim() ||
  (typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1'
    ? 'https://fi-46xw.onrender.com/api/v1'
    : '/api/v1');
const API_BASE = rawBase.endsWith('/api/v1') ? rawBase : `${rawBase.replace(/\/$/, '')}/api/v1`;

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  orgId?: string | null;
}

export function resolveEndpoint(endpoint: string, activeOrgId?: string | null): string {
  let clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (activeOrgId && !clean.startsWith('/organizations') && !clean.startsWith('/auth') && !clean.startsWith('/health')) {
    if (clean.startsWith('/accounts')) {
      clean = `/organizations/${activeOrgId}${clean}`;
    } else if (clean.startsWith('/journals')) {
      clean = `/organizations/${activeOrgId}${clean}`;
    } else if (clean.startsWith('/financial-years')) {
      clean = `/organizations/${activeOrgId}${clean}`;
    } else if (clean.startsWith('/accounting-periods')) {
      clean = `/organizations/${activeOrgId}/periods${clean.replace('/accounting-periods', '')}`;
    } else if (clean.startsWith('/periods')) {
      clean = `/organizations/${activeOrgId}${clean}`;
    } else if (clean.startsWith('/organization-members')) {
      clean = `/organizations/${activeOrgId}/members${clean.replace('/organization-members', '')}`;
    } else if (clean.startsWith('/members')) {
      clean = `/organizations/${activeOrgId}${clean}`;
    } else if (clean.startsWith('/roles')) {
      clean = `/organizations/${activeOrgId}${clean}`;
    } else if (clean.startsWith('/audit-logs')) {
      clean = `/organizations/${activeOrgId}${clean}`;
    } else if (clean.startsWith('/general-ledger')) {
      clean = `/organizations/${activeOrgId}${clean}`;
    } else if (clean.startsWith('/reports')) {
      clean = `/organizations/${activeOrgId}${clean}`;
    } else if (clean.startsWith('/accounting-integrity')) {
      clean = `/organizations/${activeOrgId}${clean}`;
    } else if (clean.startsWith('/contacts')) {
      clean = `/organizations/${activeOrgId}${clean}`;
    } else if (clean.startsWith('/invoices')) {
      clean = `/organizations/${activeOrgId}${clean}`;
    }
  }

  return clean;
}

export async function apiRequest<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  const activeOrgId = options.orgId ?? (typeof window !== 'undefined' ? localStorage.getItem('active_org_id') : null);
  const resolvedPath = resolveEndpoint(endpoint, activeOrgId);
  const url = `${API_BASE}${resolvedPath}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (activeOrgId) {
    headers['x-organization-id'] = activeOrgId;
  }

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'omit',
  });

  const contentType = res.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    let message = 'An error occurred';
    let code = 'ERROR';
    let details: Record<string, unknown> | undefined;

    if (typeof data === 'object' && data !== null) {
      if (data.error && typeof data.error === 'object') {
        message = data.error.message || message;
        code = data.error.code || code;
        details = data.error.details;
      } else if (data.message) {
        message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
      }
    } else if (typeof data === 'string' && data.length > 0) {
      try {
        const parsed = JSON.parse(data);
        if (parsed.error?.message) {
          message = parsed.error.message;
          code = parsed.error.code || code;
          details = parsed.error.details;
        } else if (parsed.message) {
          message = Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message;
        }
      } catch {
        if (data.length < 200) {
          message = data;
        }
      }
    }

    if (message === 'An error occurred' && (res.status === 502 || res.status === 503 || res.status === 504)) {
      message = 'The backend server is starting up or temporarily unreachable. Please wait a moment and try again.';
    }

    throw new ApiError(code, message, res.status, details);
  }

  return data as T;
}
