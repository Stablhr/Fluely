"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.boardController = void 0;
const board_service_1 = require("../services/board.service");
const actor_1 = require("../utils/actor");
const error_1 = require("../utils/error");
const errorCodes_1 = require("../constants/errorCodes");
function requireBoard(req) {
    if (!req.board || !req.boardAccess) {
        // The access middleware always populates both before a handler runs.
        throw new error_1.ApiError(404, errorCodes_1.ErrorCodes.BOARD_NOT_FOUND, 'Board not found');
    }
    return { board: req.board, level: req.boardAccess };
}
exports.boardController = {
    async create(req, res, next) {
        try {
            const actor = (0, actor_1.actorFromRequest)(req);
            res.status(201).json({ board: await board_service_1.boardService.create(actor, req.body) });
        }
        catch (error) {
            next(error);
        }
    },
    async list(req, res, next) {
        try {
            const actor = (0, actor_1.actorFromRequest)(req);
            const query = req.query;
            const boards = await board_service_1.boardService.list(actor, query.scope, {
                visibility: query.visibility,
                search: query.search
            });
            res.status(200).json({ boards });
        }
        catch (error) {
            next(error);
        }
    },
    async get(_req, res, next) {
        try {
            const { board, level } = requireBoard(_req);
            res.status(200).json({ board: await board_service_1.boardService.get(board, level) });
        }
        catch (error) {
            next(error);
        }
    },
    async update(req, res, next) {
        try {
            const { board, level } = requireBoard(req);
            res.status(200).json({ board: await board_service_1.boardService.update(board, req.body, level) });
        }
        catch (error) {
            next(error);
        }
    },
    /** Owner-only via `requireBoardAccess('owner')`. */
    async setVisibility(req, res, next) {
        try {
            const { board } = requireBoard(req);
            res.status(200).json({
                board: await board_service_1.boardService.setVisibility(board, req.body.visibility)
            });
        }
        catch (error) {
            next(error);
        }
    },
    async remove(req, res, next) {
        try {
            const { board } = requireBoard(req);
            res.status(200).json(await board_service_1.boardService.remove(board));
        }
        catch (error) {
            next(error);
        }
    },
    async getPublic(req, res, next) {
        try {
            const actor = (0, actor_1.actorFromRequest)(req);
            res.status(200).json({
                board: await board_service_1.boardService.getPublicBySlug(actor, req.params.boardPublicSlug)
            });
        }
        catch (error) {
            next(error);
        }
    }
};
