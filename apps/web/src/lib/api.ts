export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envUrl) {
    return envUrl.endsWith('/api/v1') ? envUrl : `${envUrl.replace(/\/$/, '')}/api/v1`;
  }
  // In the browser, use same-origin relative proxy routed through Next.js rewrites
  if (typeof window !== 'undefined') {
    return '/api/v1';
  }
  return process.env.API_URL || 'http://localhost:4000/api/v1';
}

export const API_BASE = getApiBaseUrl();

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
  _isRetry?: boolean;
}

export function resolveEndpoint(endpoint: string, activeOrgId?: string | null): string {
  let clean = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  if (activeOrgId && !clean.startsWith('/organizations') && !clean.startsWith('/auth') && !clean.startsWith('/health') && !clean.startsWith('/admin')) {
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

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

// Track in-flight refresh requests to prevent multiple duplicate refresh calls
let isRefreshing = false;
let refreshSubscribers: ((success: boolean) => void)[] = [];

function notifyRefreshSubscribers(success: boolean) {
  refreshSubscribers.forEach((cb) => cb(success));
  refreshSubscribers = [];
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiRequest<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const activeOrgId = options.orgId ?? (typeof window !== 'undefined' ? localStorage.getItem('active_org_id') : null);
  const resolvedPath = resolveEndpoint(endpoint, activeOrgId);
  const url = `${getApiBaseUrl()}${resolvedPath}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (activeOrgId) {
    headers['x-organization-id'] = activeOrgId;
  }

  // Attach CSRF token on state-changing requests
  const method = (options.method || 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (isMutation) {
    const csrfToken = getCookie('csrf_token') || getCookie('XSRF-TOKEN');
    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken;
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Automatically send and receive HttpOnly cookies
    });
  } catch (networkError: any) {
    throw new ApiError(
      'NETWORK_ERROR',
      'Unable to connect to the backend server. If running in cloud production, please ensure API_URL is set in your Vercel Project Settings.',
      0,
    );
  }

  // Handle transparent access-token refresh on HTTP 401
  if (
    res.status === 401 &&
    !options._isRetry &&
    !endpoint.includes('/auth/login') &&
    !endpoint.includes('/auth/refresh') &&
    !endpoint.includes('/auth/register')
  ) {
    if (!isRefreshing) {
      isRefreshing = true;
      const success = await refreshAccessToken();
      isRefreshing = false;
      notifyRefreshSubscribers(success);

      if (success) {
        return apiRequest<T>(endpoint, { ...options, _isRetry: true });
      }
    } else {
      const waitPromise = new Promise<boolean>((resolve) => {
        refreshSubscribers.push(resolve);
      });
      const success = await waitPromise;
      if (success) {
        return apiRequest<T>(endpoint, { ...options, _isRetry: true });
      }
    }
  }

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
      if (data.includes('DNS_HOSTNAME_RESOLVED_PRIVATE')) {
        message = 'The backend API could not be reached by Vercel. In your Vercel Project Settings > Environment Variables, add API_URL pointing to your live backend (e.g. https://api.blynt.com) and redeploy.';
        code = 'CONFIG_ERROR';
      } else {
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
    }

    if (message === 'An error occurred' && (res.status === 502 || res.status === 503 || res.status === 504)) {
      message = 'The backend server is starting up (Render free tier cold start). Please wait 30-60 seconds and try again.';
    }

    throw new ApiError(code, message, res.status, details);
  }

  return data as T;
}
