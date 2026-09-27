"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceRepository = void 0;
const Workspace_model_1 = require("../models/Workspace.model");
const WorkspaceMember_model_1 = require("../models/WorkspaceMember.model");
exports.workspaceRepository = {
    create: (data, session) => Workspace_model_1.WorkspaceModel.create([data], { session }).then(([created]) => created),
    findById: (id) => Workspace_model_1.WorkspaceModel.findById(id).exec(),
    findBySlug: (slug) => Workspace_model_1.WorkspaceModel.findOne({ slug }).exec(),
    findByJoinCodeHash: (hash) => Workspace_model_1.WorkspaceModel.findOne({ joinCodeHash: hash }).exec(),
    update: (id, data) => Workspace_model_1.WorkspaceModel.updateOne({ _id: id }, data).exec(),
    listForUser: async (userId) => {
        const memberships = await WorkspaceMember_model_1.WorkspaceMemberModel.find({ userId }).lean().exec();
        if (memberships.length === 0)
            return [];
        const ids = memberships.map(m => m.workspaceId);
        const workspaces = await Workspace_model_1.WorkspaceModel.find({ _id: { $in: ids } }).lean().exec();
        const roleByWorkspace = new Map(memberships.map(m => [String(m.workspaceId), m.role]));
        return workspaces
            .flatMap(workspace => {
            const role = roleByWorkspace.get(String(workspace._id));
            return role ? [{ ...workspace, role }] : [];
        })
            .sort((a, b) => a.name.localeCompare(b.name));
    },
    addMember: (data, session) => WorkspaceMember_model_1.WorkspaceMemberModel.create([{ role: 'member', ...data }], { session }).then(([created]) => created),
    findMembership: (workspaceId, userId) => WorkspaceMember_model_1.WorkspaceMemberModel.findOne({ workspaceId, userId }).exec(),
    findMemberById: (workspaceId, userId) => WorkspaceMember_model_1.WorkspaceMemberModel.findOne({ workspaceId, userId }).exec(),
    listMembers: (workspaceId) => WorkspaceMember_model_1.WorkspaceMemberModel.find({ workspaceId }).lean().exec(),
    removeMember: (workspaceId, userId) => WorkspaceMember_model_1.WorkspaceMemberModel.deleteOne({ workspaceId, userId }).exec(),
    countMembers: (workspaceId) => WorkspaceMember_model_1.WorkspaceMemberModel.countDocuments({ workspaceId }).exec()
};
