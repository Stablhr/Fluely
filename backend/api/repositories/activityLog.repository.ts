import {FilterQuery, Types} from 'mongoose';
import {ActivityLogDocument, ActivityLogModel} from '../models/ActivityLog.model';
import {ActivityActionType, ActivityTargetType} from '../constants/product';
import {ProductSession} from '../utils/transaction';

type CreateActivityInput = {
  boardId: Types.ObjectId;
  userId: Types.ObjectId;
  actionType: ActivityActionType;
  targetType: ActivityTargetType;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
};

export const activityLogRepository = {
  /**
   * Takes the caller's transaction session so the entry lands or vanishes with
   * the change it describes.
   */
  create: (data: CreateActivityInput, session?: ProductSession) =>
    ActivityLogModel.create(
      [{...data, targetId: data.targetId ?? null, metadata: data.metadata ?? {}}],
      {session}
    ).then(([created]) => created),

  listByBoard: (
    boardId: Types.ObjectId,
    options: {skip: number; limit: number; actionType?: string}
  ) => {
    const filter: FilterQuery<ActivityLogDocument> = {boardId};
    if (options.actionType) {
      filter.actionType = options.actionType as ActivityActionType;
    }
    return ActivityLogModel.find(filter)
      .sort({createdAt: -1, _id: -1})
      .skip(options.skip)
      .limit(options.limit)
      .exec();
  }
};
