"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_LIMIT = exports.DEFAULT_LIMIT = exports.DEFAULT_PAGE = void 0;
exports.paginationFrom = paginationFrom;
exports.paginationMeta = paginationMeta;
exports.DEFAULT_PAGE = 1;
exports.DEFAULT_LIMIT = 20;
exports.MAX_LIMIT = 100;
function paginationFrom(input) {
    const page = Math.max(1, input.page ?? exports.DEFAULT_PAGE);
    const limit = Math.min(exports.MAX_LIMIT, Math.max(1, input.limit ?? exports.DEFAULT_LIMIT));
    return { page, limit, skip: (page - 1) * limit };
}
function paginationMeta(pagination, total) {
    return {
        page: pagination.page,
        limit: pagination.limit,
        total,
        pages: Math.ceil(total / pagination.limit),
        hasNextPage: pagination.skip + pagination.limit < total,
        hasPreviousPage: pagination.page > 1
    };
}
