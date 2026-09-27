"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaController = void 0;
const media_service_1 = require("../services/media.service");
const actor_1 = require("../utils/actor");
exports.mediaController = {
    async upload(req, res, next) {
        try {
            const actor = (0, actor_1.actorFromRequest)(req);
            const files = req.files ?? [];
            const body = (req.body ?? {});
            const items = await media_service_1.mediaService.create(actor.actorId, files, {
                boardId: body.boardId,
                cardId: body.cardId
            });
            res.status(201).json({ items });
        }
        catch (error) {
            next(error);
        }
    },
    async list(req, res, next) {
        try {
            const actor = (0, actor_1.actorFromRequest)(req);
            res.status(200).json(await media_service_1.mediaService.list(actor.actorId, req.query));
        }
        catch (error) {
            next(error);
        }
    },
    async remove(req, res, next) {
        try {
            const actor = (0, actor_1.actorFromRequest)(req);
            await media_service_1.mediaService.remove(actor.actorId, req.params.mediaId);
            res.status(200).json({ message: 'Attachment removed' });
        }
        catch (error) {
            next(error);
        }
    }
};
