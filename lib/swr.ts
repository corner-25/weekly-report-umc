'use client';

import useSWR, { SWRConfiguration } from 'swr';

// Global fetcher
const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
});

// Default SWR config - stale data shown immediately, revalidate in background
export const swrConfig: SWRConfiguration = {
  fetcher,
  revalidateOnFocus: false,        // Don't refetch when tab regains focus
  revalidateOnReconnect: true,     // Refetch when network reconnects
  dedupingInterval: 30000,         // Dedupe requests within 30s
  errorRetryCount: 3,
};

// --- Dashboard Stats ---
export function useDashboardStats() {
  return useSWR('/api/dashboard-stats', fetcher, {
    ...swrConfig,
    revalidateIfStale: true,
    refreshInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
  });
}

// --- MOU Stats ---
export function useMOUStats() {
  return useSWR('/api/mous/stats', fetcher, {
    ...swrConfig,
    revalidateIfStale: true,
    refreshInterval: 5 * 60 * 1000,
  });
}

// --- MOU List ---
export function useMOUList(params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  // Remove empty values
  for (const [key, value] of searchParams.entries()) {
    if (!value) searchParams.delete(key);
  }
  const query = searchParams.toString();
  const url = query ? `/api/mous?${query}` : '/api/mous';

  return useSWR(url, fetcher, {
    ...swrConfig,
    revalidateIfStale: true,
  });
}

// --- MOU Detail ---
export function useMOUDetail(id: string | null) {
  return useSWR(id ? `/api/mous/${id}` : null, fetcher, {
    ...swrConfig,
  });
}

// --- Departments (rarely changes) ---
export function useDepartments() {
  return useSWR('/api/departments', fetcher, {
    ...swrConfig,
    revalidateIfStale: false,        // Departments rarely change
    refreshInterval: 0,              // No auto-refresh
    dedupingInterval: 60 * 60 * 1000, // Dedupe for 1 hour
  });
}

// --- Master Tasks with progress (for Tasks Overview / Timeline / Metrics pages) ---
export function useMasterTasksWithProgress() {
  return useSWR('/api/master-tasks?includeProgress=true', fetcher, {
    ...swrConfig,
    revalidateIfStale: true,
    refreshInterval: 5 * 60 * 1000,
  });
}

// --- Weeks List ---
export function useWeeksList(params: { year?: number; search?: string } = {}) {
  const sp = new URLSearchParams();
  if (params.year) sp.set('year', String(params.year));
  if (params.search) sp.set('search', params.search);
  const qs = sp.toString();
  return useSWR(qs ? `/api/weeks?${qs}` : '/api/weeks', fetcher, {
    ...swrConfig,
    revalidateIfStale: true,
    keepPreviousData: true,
  });
}
