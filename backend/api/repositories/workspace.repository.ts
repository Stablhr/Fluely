import {Types} from 'mongoose';
import {
  WorkspaceDocument,
  WorkspaceModel
} from '../models/Workspace.model';
import {
  WorkspaceMemberDocument,
  WorkspaceMemberModel
} from '../models/WorkspaceMember.model';
import {WorkspaceMemberRole} from '../models/Workspace.model';
import {ProductSession} from '../utils/transaction';

type Session = ProductSession;

export const workspaceRepository = {
  create: (data: {name: string; slug: string; ownerId: Types.ObjectId; joinCodeHash?: string | null}, session?: Session) =>
    WorkspaceModel.create([data], {session}).then(([created]) => created),

  findById: (id: string) => WorkspaceModel.findById(id).exec(),

  findBySlug: (slug: string) => WorkspaceModel.findOne({slug}).exec(),

  findByJoinCodeHash: (hash: string) =>
    WorkspaceModel.findOne({joinCodeHash: hash}).exec(),

  update: (id: string, data: Partial<Pick<WorkspaceDocument, 'name' | 'joinCodeHash'>>) =>
    WorkspaceModel.updateOne({_id: id}, data).exec(),

  listForUser: async (userId: Types.ObjectId) => {
    const memberships = await WorkspaceMemberModel.find({userId}).lean().exec();
    if (memberships.length === 0) return [];

    const ids = memberships.map(m => m.workspaceId);
    const workspaces = await WorkspaceModel.find({_id: {$in: ids}}).lean().exec();
    const roleByWorkspace = new Map<string, WorkspaceMemberRole>(
      memberships.map(m => [String(m.workspaceId), m.role as WorkspaceMemberRole])
    );

    return workspaces
      .flatMap(workspace => {
        const role = roleByWorkspace.get(String(workspace._id));
        return role ? [{...workspace, role}] : [];
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  addMember: (
    data: {workspaceId: Types.ObjectId; userId: Types.ObjectId; role?: WorkspaceMemberRole},
    session?: Session
  ) => WorkspaceMemberModel.create([{role: 'member', ...data}], {session}).then(([created]) => created),

  findMembership: (workspaceId: Types.ObjectId, userId: Types.ObjectId) =>
    WorkspaceMemberModel.findOne({workspaceId, userId}).exec(),

  findMemberById: (workspaceId: Types.ObjectId, userId: Types.ObjectId) =>
    WorkspaceMemberModel.findOne({workspaceId, userId}).exec(),

  listMembers: (workspaceId: Types.ObjectId) =>
    WorkspaceMemberModel.find({workspaceId}).lean().exec(),

  removeMember: (workspaceId: Types.ObjectId, userId: Types.ObjectId) =>
    WorkspaceMemberModel.deleteOne({workspaceId, userId}).exec(),

  countMembers: (workspaceId: Types.ObjectId) =>
    WorkspaceMemberModel.countDocuments({workspaceId}).exec()
};
