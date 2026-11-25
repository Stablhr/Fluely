import mongoose from 'mongoose';
import {MongoMemoryReplSet} from 'mongodb-memory-server-core';

jest.mock('../api/services/cloudinary.service', () => ({
  uploadToCloudinary: jest.fn(),
  deleteFromCloudinary: jest.fn(async () => undefined),
  folderForMedia: () => 'fluely/boards',
  toResourceType: (value: string) => (value === 'video' || value === 'raw' ? value : 'image')
}));

import {BoardModel} from '../api/models/Board.model';
import {CardModel} from '../api/models/Card.model';
import {ListModel} from '../api/models/List.model';
import {UserModel} from '../api/models/User.model';
import {cleanupDoneCards} from '../api/services/cleanup.service';

/*
 * A replica set, unlike the standalone server the other suites use, runs real
 * transactions -- the same path production (Atlas) takes.
 */

jest.setTimeout(60_000);

let mongo: MongoMemoryReplSet;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({replSet: {count: 1}});
  await mongoose.connect(mongo.getUri());
}, 120_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

it('deletes every card that has been done past the retention window', async () => {
  const owner = await UserModel.create({
    firstName: 'Clean',
    lastName: 'Up',
    email: 'cleanup@example.test',
    passwordHash: 'x',
    isVerified: true
  });
  const board = await BoardModel.create({name: 'Board', ownerId: owner._id});
  const list = await ListModel.create({boardId: board._id, name: 'Done'});
  const longAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const old = await CardModel.create(
    ['a', 'b'].map(title => ({boardId: board._id, listId: list._id, title, done: true, doneAt: longAgo}))
  );
  const fresh = await CardModel.create({
    boardId: board._id,
    listId: list._id,
    title: 'recent',
    done: true,
    doneAt: new Date()
  });
  await ListModel.updateOne({_id: list._id}, {$set: {cardOrder: [...old.map(c => c._id), fresh._id]}});

  const result = await cleanupDoneCards(2);

  expect(result).toEqual({deleted: 2, boards: [board._id.toString()]});
  expect((await CardModel.find({boardId: board._id})).map(c => c.title)).toEqual(['recent']);
  expect((await ListModel.findById(list._id))?.cardOrder.map(String)).toEqual([fresh._id.toString()]);
});
