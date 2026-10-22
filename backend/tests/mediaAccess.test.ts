import {Types} from 'mongoose';

jest.mock('../api/repositories/media.repository', () => ({
  mediaRepository: {
    create: jest.fn(),
    findById: jest.fn(),
    findByIds: jest.fn(async () => []),
    findByIdForOwner: jest.fn(),
    listForOwner: jest.fn(async () => []),
    countForOwner: jest.fn(async () => 0),
    usedBytes: jest.fn(async () => []),
    deleteByIdForOwner: jest.fn(),
    deleteForBoard: jest.fn()
  }
}));

jest.mock('../api/repositories/board.repository', () => ({
  boardRepository: {
    findById: jest.fn()
  }
}));

jest.mock('../api/repositories/boardCollaborator.repository', () => ({
  boardCollaboratorRepository: {
    find: jest.fn(async () => null)
  }
}));

jest.mock('../api/repositories/workspace.repository', () => ({
  workspaceRepository: {
    findMembership: jest.fn(async () => null)
  }
}));

jest.mock('../api/services/cloudinary.service', () => ({
  uploadToCloudinary: jest.fn(),
  deleteFromCloudinary: jest.fn(async () => undefined),
  folderForMedia: (scope: {boardId?: string; cardId?: string}) =>
    scope.cardId ? 'fluely/tasks' : scope.boardId ? 'fluely/boards' : 'fluely/content-planner'
}));

import {mediaRepository} from '../api/repositories/media.repository';
import {boardRepository} from '../api/repositories/board.repository';
import {boardCollaboratorRepository} from '../api/repositories/boardCollaborator.repository';
import {mediaService} from '../api/services/media.service';

const OWNER = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa1');
const EDITOR = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa2');
const VIEWER = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa3');
const BOARD = new Types.ObjectId('ccccccccccccccccccccccc1');

const mockedMedia = mediaRepository as jest.Mocked<typeof mediaRepository>;
const mockedBoards = boardRepository as jest.Mocked<typeof boardRepository>;
const mockedCollaborators = boardCollaboratorRepository as jest.Mocked<
  typeof boardCollaboratorRepository
>;

function board() {
  return {
    _id: BOARD,
    ownerId: OWNER,
    visibility: 'private',
    workspaceId: null,
    publicSlug: null
  } as never;
}

/** A stored media row, as `findByIdForOwner` returns it. */
function mediaRow(overrides: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId('fffffffffffffffffffffff1'),
    ownerId: OWNER,
    boardId: BOARD,
    cardId: null,
    kind: 'video',
    resourceType: 'video',
    originalName: 'clip.mp4',
    url: 'https://res.cloudinary.com/demo/video/upload/clip.mp4',
    publicId: 'fluely/tasks/clip',
    mimeType: 'video/mp4',
    sizeBytes: 1024,
    createdAt: new Date(),
    ...overrides
  } as never;
}

beforeEach(() => {
  jest.resetAllMocks();
  mockedMedia.usedBytes.mockResolvedValue([] as never);
  mockedBoards.findById.mockResolvedValue(board());
  mockedCollaborators.find.mockResolvedValue(null as never);
  // `create` returns the stored row; fake a saved document so the serializer
  // has an id to report.
  mockedMedia.create.mockImplementation(async data => {
    const row = data as unknown as Record<string, unknown>;
    return {
      _id: new Types.ObjectId('fffffffffffffffffffffff1'),
      createdAt: new Date(),
      ...row
    } as never;
  });
});

describe('mediaService.register', () => {
  it('records a video as a video so the asset can be destroyed later', async () => {
    mockedCollaborators.find.mockResolvedValue({
      role: 'editor',
      status: 'accepted'
    } as never);

    await mediaService.register(
      EDITOR,
      {
        name: 'clip.mp4',
        url: 'https://res.cloudinary.com/demo/video/upload/clip.mp4',
        publicId: 'fluely/tasks/clip',
        mimeType: 'video/mp4',
        sizeBytes: 2048,
        resourceType: 'video'
      },
      {boardId: BOARD.toString()}
    );

    expect(mockedMedia.create).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'video', resourceType: 'video'})
    );
  });

  it('derives the kind from the mime type rather than trusting the client', async () => {
    await mediaService.register(
      OWNER,
      {
        name: 'photo.png',
        url: 'https://res.cloudinary.com/demo/image/upload/photo.png',
        publicId: 'fluely/tasks/photo',
        mimeType: 'image/png',
        sizeBytes: 100,
        resourceType: 'auto'
      },
      {}
    );

    expect(mockedMedia.create).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'image', resourceType: 'image'})
    );
  });

  it('rejects a mime type outside the allow-list', async () => {
    await expect(
      mediaService.register(
        OWNER,
        {
          name: 'payload.exe',
          url: 'https://res.cloudinary.com/demo/raw/upload/payload',
          publicId: 'fluely/tasks/payload',
          mimeType: 'application/x-msdownload',
          sizeBytes: 10,
          resourceType: 'raw'
        },
        {}
      )
    ).rejects.toMatchObject({statusCode: 415});
    expect(mockedMedia.create).not.toHaveBeenCalled();
  });

  it('rejects a viewer registering an attachment on the board', async () => {
    mockedCollaborators.find.mockResolvedValue({
      role: 'viewer',
      status: 'accepted'
    } as never);

    await expect(
      mediaService.register(
        VIEWER,
        {
          name: 'clip.mp4',
          url: 'https://res.cloudinary.com/demo/video/upload/clip.mp4',
          publicId: 'fluely/tasks/clip',
          mimeType: 'video/mp4',
          sizeBytes: 2048,
          resourceType: 'video'
        },
        {boardId: BOARD.toString()}
      )
    ).rejects.toMatchObject({statusCode: 403});
    expect(mockedMedia.create).not.toHaveBeenCalled();
  });
});

describe('mediaService.remove', () => {
  it('lets the board owner delete an attachment', async () => {
    mockedMedia.findByIdForOwner.mockResolvedValue(mediaRow());
    mockedCollaborators.find.mockResolvedValue(null as never);

    await expect(
      mediaService.remove(OWNER, 'fffffffffffffffffffffff1')
    ).resolves.toBeUndefined();
    expect(mockedMedia.deleteByIdForOwner).toHaveBeenCalled();
  });

  it('rejects a viewer deleting an attachment with 403', async () => {
    mockedMedia.findByIdForOwner.mockResolvedValue(mediaRow());
    mockedCollaborators.find.mockResolvedValue({
      role: 'viewer',
      status: 'accepted'
    } as never);

    await expect(
      mediaService.remove(VIEWER, 'fffffffffffffffffffffff1')
    ).rejects.toMatchObject({statusCode: 403});
    expect(mockedMedia.deleteByIdForOwner).not.toHaveBeenCalled();
  });

  it('reports a missing attachment as 404', async () => {
    mockedMedia.findByIdForOwner.mockResolvedValue(null as never);
    await expect(
      mediaService.remove(OWNER, 'fffffffffffffffffffffff1')
    ).rejects.toMatchObject({statusCode: 404});
  });
});
