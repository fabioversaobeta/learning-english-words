export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const error = new Error(err.error ?? "Request failed") as Error & {
      status?: number;
      resetAt?: string;
    };
    error.status = res.status;
    error.resetAt = err.resetAt;
    throw error;
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
