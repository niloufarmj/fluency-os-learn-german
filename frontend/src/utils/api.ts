import type { ApiErrorShape } from './types';

const DEFAULT_BASE = 'http://localhost:8000';

export function getApiBase() {
  return import.meta.env.VITE_API_BASE?.toString() || DEFAULT_BASE;
}

const API_KEY_STORAGE = 'fluency_api_key';

export function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || '';
}

export function setApiKey(key: string) {
  localStorage.setItem(API_KEY_STORAGE, key);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = getApiKey();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(getApiBase() + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    let err: ApiErrorShape | null = null;
    try {
      err = (await res.json()) as ApiErrorShape;
    } catch {
      err = null;
    }
    const detail = err?.detail || res.statusText || 'Request failed';
    throw new Error(detail);
  }

  return (await res.json()) as T;
}

export function apiGet<T>(path: string) {
  return request<T>('GET', path);
}

export function apiPost<T = unknown>(path: string, body?: unknown) {
  return request<T>('POST', path, body);
}

