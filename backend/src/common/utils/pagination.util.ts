// src/common/utils/pagination.util.ts

/**
 * Pagination 유틸리티
 * - page / limit 기본값 관리
 * - 문자열 쿼리도 안전하게 number로 변환
 * - skip/take 계산
 * - totalCount 기반 meta 반환
 */

export interface PaginationQuery {
  page?: number | string;
  limit?: number | string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

function toPositiveInt(v: unknown, fallback: number): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.trunc(n);
  return i > 0 ? i : fallback;
}

export function getPaginationParams(input?: PaginationQuery) {
  const page = toPositiveInt(input?.page, DEFAULT_PAGE);
  const limit = toPositiveInt(input?.limit, DEFAULT_LIMIT);
  const skip = (page - 1) * limit;
  const take = limit;
  return { page, limit, skip, take };
}

export function buildPaginationMeta(
  total: number,
  input?: PaginationQuery,
): PaginationMeta {
  const { page, limit } = getPaginationParams(input);
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / Math.max(limit, 1)),
  };
}
