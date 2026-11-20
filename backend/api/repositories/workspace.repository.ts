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
    WorkspaceMemberModel.countDocuments({workspaceId}).exec(),

  listOwnedBy: (ownerId: Types.ObjectId, session?: Session) =>
    WorkspaceModel.find({ownerId}).session(session ?? null).exec(),

  /** Members other than `excludeUserId`, longest-standing first. */
  listOtherMembers: (workspaceId: Types.ObjectId, excludeUserId: Types.ObjectId, session?: Session) =>
    WorkspaceMemberModel.find({workspaceId, userId: {$ne: excludeUserId}})
      .sort({joinedAt: 1, _id: 1})
      .session(session ?? null)
      .exec(),

  /** Hands the workspace to an existing member, promoting their membership row. */
  transferOwnership: async (
    workspaceId: Types.ObjectId,
    newOwnerId: Types.ObjectId,
    session?: Session
  ) => {
    await WorkspaceModel.updateOne({_id: workspaceId}, {ownerId: newOwnerId}, {session}).exec();
    await WorkspaceMemberModel.updateOne(
      {workspaceId, userId: newOwnerId},
      {role: 'owner'},
      {session}
    ).exec();
  },

  deleteByIds: async (ids: Types.ObjectId[], session?: Session) => {
    await WorkspaceMemberModel.deleteMany({workspaceId: {$in: ids}}, {session}).exec();
    await WorkspaceModel.deleteMany({_id: {$in: ids}}, {session}).exec();
  },

  deleteMembershipsForUser: (userId: Types.ObjectId, session?: Session) =>
    WorkspaceMemberModel.deleteMany({userId}, {session}).exec()
};
