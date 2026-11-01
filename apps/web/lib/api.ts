export const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers: { ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(init.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
  return data as T;
}
export function money(paise?: number) { return new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format((paise || 0) / 100); }
export function dateTime(value: string) { return new Date(value).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' }); }
export function assetUrl(url?: string) { if (!url) return ''; if (url.startsWith('http://') || url.startsWith('https://')) return url; return `${API_URL.replace(/\/api\/?$/, '')}${url.startsWith('/') ? url : `/${url}`}`; }


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
