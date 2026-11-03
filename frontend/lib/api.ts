// Type-safe RefillCare API Client

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://refillcare.onrender.com').replace(/\/+$/, '');

export function buildApiUrl(path: string): string {
  if (path.startsWith('http')) return path;
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const finalPath = cleanPath.startsWith('api/') ? cleanPath : `api/${cleanPath}`;
  return API_BASE ? `${API_BASE}/${finalPath}` : `/${finalPath}`;
}

export function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('t') || '';
}

export function setToken(token: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('t', token);
  }
}

export function getUser(): any {
  if (typeof window === 'undefined') return null;
  const u = localStorage.getItem('u');
  return u ? JSON.parse(u) : null;
}

export function setUser(user: any) {
  if (typeof window !== 'undefined') {
    if (user) {
      localStorage.setItem('u', JSON.stringify(user));
    } else {
      localStorage.removeItem('u');
    }
  }
}

export async function fetchApi(path: string, options: RequestInit = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  
  const url = buildApiUrl(path);
  
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (!isFormData && options.body) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = token;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && token) {
    setToken('');
    setUser(null);
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  if (!response.ok) {
    throw new Error(data.detail?.message || data.detail || 'Something went wrong. Please try again.');
  }

  return data;
}

export const postApi = (path: string, body?: any) =>
  fetchApi(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
