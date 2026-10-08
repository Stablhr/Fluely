import type {Request, Response} from 'express';
import {pollService, type PollResult} from '../services/poll.service';
import {actorFromRequest} from '../utils/actor';
import {ApiError} from '../utils/error';

export const pollController = {
  async poll(req: Request, res: Response) {
    const board = req.board!;
    const actor = actorFromRequest(req);
    const since = req.query.since !== undefined
      ? parseInt(req.query.since as string, 10)
      : undefined;

    if (isNaN(since ?? 0)) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid since parameter');
    }

    const result = await pollService.poll(board, actor, since);

    res.json({
      success: true,
      data: result
    });
  }
};