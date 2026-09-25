export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export type Pagination = {
  page: number;
  limit: number;
  skip: number;
};

export function paginationFrom(input: {page?: number; limit?: number}): Pagination {
  const page = Math.max(1, input.page ?? DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, input.limit ?? DEFAULT_LIMIT));
  return {page, limit, skip: (page - 1) * limit};
}

export function paginationMeta(pagination: Pagination, total: number) {
  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    pages: Math.ceil(total / pagination.limit),
    hasNextPage: pagination.skip + pagination.limit < total,
    hasPreviousPage: pagination.page > 1
  };
}
