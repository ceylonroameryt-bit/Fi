import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize: number = 50;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const MAX_PAGE_SIZE = 200;

/**
 * Clamps page inputs from query strings: non-numbers and values below 1 fall back to the
 * defaults, and page size is capped so a single request can't load an entire table.
 */
export function normalizePagination(
  page: unknown,
  pageSize: unknown,
  defaultPageSize = 50,
): { page: number; pageSize: number; skip: number } {
  const p = Math.floor(Number(page));
  const s = Math.floor(Number(pageSize));
  const safePage = Number.isFinite(p) && p >= 1 ? p : 1;
  const safeSize = Number.isFinite(s) && s >= 1 ? Math.min(s, MAX_PAGE_SIZE) : defaultPageSize;
  return { page: safePage, pageSize: safeSize, skip: (safePage - 1) * safeSize };
}
