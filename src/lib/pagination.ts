export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type ParsedPagination =
  | { ok: true; value: PaginationParams }
  | { ok: false; error: string };

/**
 * Parses & validates the `page` / `pageSize` query params shared by every
 * paginated endpoint. Never throws — bad input is reported back as an `ok: false`
 * result so route handlers can turn it into a clean 400 response.
 */
export function parsePagination(searchParams: URLSearchParams): ParsedPagination {
  const pageRaw = searchParams.get("page");
  let page = 1;
  if (pageRaw !== null) {
    page = Number(pageRaw);
    if (!Number.isInteger(page) || page < 1) {
      return { ok: false, error: `Invalid "page" value: "${pageRaw}". Must be a positive integer.` };
    }
  }

  const pageSizeRaw = searchParams.get("pageSize");
  let pageSize = DEFAULT_PAGE_SIZE;
  if (pageSizeRaw !== null) {
    pageSize = Number(pageSizeRaw);
    if (!Number.isInteger(pageSize) || pageSize < 1) {
      return { ok: false, error: `Invalid "pageSize" value: "${pageSizeRaw}". Must be a positive integer.` };
    }
    if (pageSize > MAX_PAGE_SIZE) {
      return { ok: false, error: `Invalid "pageSize" value: "${pageSizeRaw}". Cannot exceed ${MAX_PAGE_SIZE}.` };
    }
  }

  return {
    ok: true,
    value: { page, pageSize, skip: (page - 1) * pageSize, take: pageSize },
  };
}

export function buildPaginationMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}
