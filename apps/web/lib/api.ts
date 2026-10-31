export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
export async function api<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...init, credentials: 'include', headers: { ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(init.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
  return data as T;
}
export function money(paise?: number) { return new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:0 }).format((paise || 0) / 100); }
export function dateTime(value: string) { return new Date(value).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' }); }
export function assetUrl(url?: string) { if (!url) return ''; if (url.startsWith('http://') || url.startsWith('https://')) return url; return `${API_URL.replace(/\/api\/?$/, '')}${url.startsWith('/') ? url : `/${url}`}`; }
