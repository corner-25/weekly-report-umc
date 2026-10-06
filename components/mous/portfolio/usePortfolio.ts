'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { toView, type MouRow, type MouView } from '@/lib/mou/portfolio';

export const PORTFOLIO_KEY = '/api/mous/portfolio';

interface PortfolioResponse {
  rows: MouRow[];
  departments: Array<{ id: string; name: string }>;
}

async function fetchPortfolio(url: string): Promise<PortfolioResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status === 401 ? 'Phiên đăng nhập đã hết' : 'Không tải được danh mục MOU');
  return res.json();
}

/** Toàn bộ MOU (dòng nhẹ) + danh mục phòng; tính vòng đời/mức triển khai theo hôm nay. */
export function usePortfolio(): {
  views: MouView[];
  departments: PortfolioResponse['departments'];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
} {
  const { data, error, isLoading, mutate } = useSWR(PORTFOLIO_KEY, fetchPortfolio, { revalidateOnFocus: false, keepPreviousData: true });
  const views = useMemo(() => {
    const now = new Date();
    return (data?.rows ?? []).map((r) => toView(r, now));
  }, [data]);
  return {
    views,
    departments: data?.departments ?? [],
    isLoading,
    error: error ? (error as Error).message : null,
    reload: () => void mutate(),
  };
}
