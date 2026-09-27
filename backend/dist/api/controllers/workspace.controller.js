"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceController = void 0;
const workspace_service_1 = require("../services/workspace.service");
const actor_1 = require("../utils/actor");
exports.workspaceController = {
    async create(req, res, next) {
        try {
            const actor = (0, actor_1.actorFromRequest)(req);
            res.status(201).json(await workspace_service_1.workspaceService.create(actor.actorId, req.body.name));
        }
        catch (error) {
            next(error);
        }
    },
    async list(req, res, next) {
        try {
            const actor = (0, actor_1.actorFromRequest)(req);
            res.status(200).json({ workspaces: await workspace_service_1.workspaceService.listForUser(actor.actorId) });
        }
        catch (error) {
            next(error);
        }
    },
    async detail(req, res, next) {
        try {
            const actor = (0, actor_1.actorFromRequest)(req);
            res.status(200).json(await workspace_service_1.workspaceService.detail(actor.actorId, req.params.workspaceId));
        }
        catch (error) {
            next(error);
        }
    },
    async rename(req, res, next) {
        try {
            const actor = (0, actor_1.actorFromRequest)(req);
            res.status(200).json(await workspace_service_1.workspaceService.rename(actor.actorId, req.params.workspaceId, req.body.name));
        }
        catch (error) {
            next(error);
        }
    },
    async listMembers(req, res, next) {
        try {
            const actor = (0, actor_1.actorFromRequest)(req);
            res.status(200).json({
                members: await workspace_service_1.workspaceService.listMembers(actor.actorId, req.params.workspaceId)
            });
        }
        catch (error) {
            next(error);
        }
    },
    async addMember(req, res, next) {
        try {
            const actor = (0, actor_1.actorFromRequest)(req);
            res.status(201).json(await workspace_service_1.workspaceService.addMember(actor.actorId, req.params.workspaceId, req.body.email));
        }
        catch (error) {
            next(error);
        }
    },
    async removeMember(req, res, next) {
        try {
            const actor = (0, actor_1.actorFromRequest)(req);
            res.status(200).json(await workspace_service_1.workspaceService.removeMember(actor.actorId, req.params.workspaceId, req.params.userId));
        }
        catch (error) {
            next(error);
        }
    },
    async join(req, res, next) {
        try {
            const actor = (0, actor_1.actorFromRequest)(req);
            res.status(200).json(await workspace_service_1.workspaceService.join(actor.actorId, req.body.code));
        }
        catch (error) {
            next(error);
        }
    }
};
