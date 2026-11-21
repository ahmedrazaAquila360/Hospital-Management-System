/** Rows-per-page choices offered on every listing page (`?perPage=` in the URL). */
export const PAGE_SIZE_OPTIONS = [10, 20, 30, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;

/** Reads `?perPage=`; anything that is not one of the offered sizes falls back to the default. */
export function parsePageSize(raw: string | undefined | null): number {
  const n = Number(raw);
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

/** Reads `?page=` as a whole number ≥ 1. */
export function parsePage(raw: string | undefined | null): number {
  return Math.max(1, Math.floor(Number(raw)) || 1);
}
