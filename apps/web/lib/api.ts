export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const DIRECT_UPLOAD_API_URL = (
  process.env.NEXT_PUBLIC_UPLOAD_API_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://roadnest-api.onrender.com/api' : '')
).replace(/\/+$/, '');

function getErrorMessage(data: any, status: number): string {
  if (Array.isArray(data?.message)) return data.message.join(', ');
  return data?.message || data?.error || `Request failed (${status})`;
}

async function getDirectUploadToken(): Promise<string> {
  const response = await fetch(`${API_URL}/auth/upload-token`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data?.token !== 'string' || !data.token) {
    throw new Error(getErrorMessage(data, response.status));
  }

  return data.token;
}

export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;

  if (isFormData && DIRECT_UPLOAD_API_URL) {
    // Send multipart uploads straight to Render. Vercel Functions have a 4.5 MB
    // request-body limit, so file uploads must not pass through the Next.js proxy.
    // The short-lived token is obtained through the same-origin proxy and avoids
    // depending on third-party cookies for the cross-origin upload request.
    const token = await getDirectUploadToken();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);
    headers.delete('Content-Type'); // Let the browser add the multipart boundary.

    const response = await fetch(
      `${DIRECT_UPLOAD_API_URL}${path.startsWith('/') ? path : `/${path}`}`,
      {
        ...init,
        method: init.method || 'POST',
        credentials: 'omit',
        headers,
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(getErrorMessage(data, response.status));
    return data as T;
  }

  const headers = new Headers(init.headers);
  if (isFormData) {
    headers.delete('Content-Type');
  } else if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(getErrorMessage(data, response.status));
  return data as T;
}

export function money(paise?: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format((paise || 0) / 100);
}

export function dateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function assetUrl(url?: string) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const apiBase = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : API_URL;
  return `${apiBase}${url.startsWith('/') ? url : `/${url}`}`;
}

// Stock reference imagery is used only when a vehicle has no working uploaded photo.
// These are generic vehicle-type illustrations, never a representation of the exact rental unit.
export function fallbackVehicleImage(type?: string, category?: string) {
  const normalizedType = (type || '').toUpperCase();
  const normalizedCategory = (category || '').toUpperCase();

  if (normalizedType === 'BIKE') {
    return 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=1200&q=85';
  }

  if (['SUV', 'MPV'].includes(normalizedCategory)) {
    return 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=85';
  }

  if (normalizedCategory === 'LUXURY') {
    return 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=85';
  }

  return 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=85';
}
