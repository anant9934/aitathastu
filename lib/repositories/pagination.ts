/**
 * Optional paging for per-person list queries. The default cap keeps one
 * person's request bounded while staying far above what current UIs show,
 * so existing callers that expect "everything" are unaffected in practice.
 */
export type PageOptions = { limit?: number; offset?: number };

export const DEFAULT_PAGE_LIMIT = 500;
const MAX_PAGE_LIMIT = 2000;

export function pageBounds(options: PageOptions = {}): { limit: number; offset: number } {
  const limit = Math.min(Math.max(1, Math.floor(options.limit ?? DEFAULT_PAGE_LIMIT)), MAX_PAGE_LIMIT);
  const offset = Math.max(0, Math.floor(options.offset ?? 0));
  return { limit, offset };
}
