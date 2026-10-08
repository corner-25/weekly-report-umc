export const CRM_PAGE_SIZE = 20;
export function crmPage(params: URLSearchParams) {
  const raw = Number(params.get('page') ?? 1);
  return Number.isSafeInteger(raw) && raw > 0 ? raw : 1;
}
