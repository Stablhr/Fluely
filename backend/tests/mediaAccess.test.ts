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
  getUploadedAsset: jest.fn(),
  folderForMedia: (scope: {boardId?: string; cardId?: string}) =>
    scope.cardId ? 'fluely/tasks' : scope.boardId ? 'fluely/boards' : 'fluely/content-planner'
}));

jest.mock('../api/repositories/card.repository', () => ({
  cardRepository: {
    findByIdForBoard: jest.fn()
  }
}));

import {mediaRepository} from '../api/repositories/media.repository';
import {boardRepository} from '../api/repositories/board.repository';
import {boardCollaboratorRepository} from '../api/repositories/boardCollaborator.repository';
import {mediaService} from '../api/services/media.service';
import {cardRepository} from '../api/repositories/card.repository';
import {getUploadedAsset, uploadToCloudinary} from '../api/services/cloudinary.service';
import {env} from '../api/config/env';

const OWNER = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa1');
const EDITOR = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa2');
const VIEWER = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa3');
const STRANGER = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa4');
const BOARD = new Types.ObjectId('ccccccccccccccccccccccc1');
const CARD = new Types.ObjectId('ddddddddddddddddddddddd1');

/** A delivery URL on this account's Cloudinary (what the Admin API returns). */
const OWN_URL = (path: string) =>
  `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME ?? 'demo'}/${path}`;

const mockedMedia = mediaRepository as jest.Mocked<typeof mediaRepository>;
const mockedBoards = boardRepository as jest.Mocked<typeof boardRepository>;
const mockedCollaborators = boardCollaboratorRepository as jest.Mocked<
  typeof boardCollaboratorRepository
>;
const mockedCards = cardRepository as jest.Mocked<typeof cardRepository>;
const mockedAsset = getUploadedAsset as jest.MockedFunction<typeof getUploadedAsset>;
const mockedUpload = uploadToCloudinary as jest.MockedFunction<typeof uploadToCloudinary>;

function asCollaborator(role: 'editor' | 'viewer') {
  mockedCollaborators.find.mockResolvedValue({role, status: 'accepted'} as never);
}

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
  mockedCards.findByIdForBoard.mockResolvedValue({_id: CARD, boardId: BOARD} as never);
  mockedAsset.mockImplementation(async (publicId: string) => ({
    secureUrl: OWN_URL('image/upload/v1/photo.png'),
    bytes: 100,
    resourceType: 'image',
    folder: publicId.slice(0, publicId.lastIndexOf('/'))
  }));
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
    asCollaborator('editor');
    mockedAsset.mockResolvedValue({
      secureUrl: OWN_URL('video/upload/v1/clip.mp4'),
      bytes: 2048,
      resourceType: 'video',
      folder: 'fluely/boards'
    });

    await mediaService.register(
      EDITOR,
      {
        name: 'clip.mp4',
        url: 'https://res.cloudinary.com/demo/video/upload/clip.mp4',
        publicId: 'fluely/boards/clip',
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
        publicId: 'fluely/content-planner/photo',
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

  it('stores the URL and size Cloudinary reports, not what the browser sent', async () => {
    await mediaService.register(
      OWNER,
      {
        name: 'photo.png',
        url: 'https://tracker.example.com/pixel.png',
        publicId: 'fluely/boards/photo',
        mimeType: 'image/png',
        sizeBytes: 1,
        resourceType: 'image'
      },
      {boardId: BOARD.toString()}
    );

    expect(mockedAsset).toHaveBeenCalledWith('fluely/boards/photo');
    expect(mockedMedia.create).toHaveBeenCalledWith(
      expect.objectContaining({url: OWN_URL('image/upload/v1/photo.png'), sizeBytes: 100})
    );
  });

  it('rejects an asset outside the folder its signature was issued for', async () => {
    await expect(
      mediaService.register(
        OWNER,
        {
          name: 'photo.png',
          url: OWN_URL('image/upload/photo.png'),
          publicId: 'someone-else/photo',
          mimeType: 'image/png',
          sizeBytes: 100,
          resourceType: 'image'
        },
        {boardId: BOARD.toString()}
      )
    ).rejects.toMatchObject({statusCode: 400, code: 'VALIDATION_ERROR'});
    expect(mockedMedia.create).not.toHaveBeenCalled();
  });

  it('accepts a dynamic-folder asset whose public id has no folder prefix', async () => {
    mockedAsset.mockResolvedValue({
      secureUrl: OWN_URL('image/upload/v1/photo_abc.png'),
      bytes: 100,
      resourceType: 'image',
      folder: 'fluely/boards'
    });
    await mediaService.register(
      OWNER,
      {
        name: 'photo.png',
        url: 'ignored',
        publicId: 'photo_abc',
        mimeType: 'image/png',
        sizeBytes: 100,
        resourceType: 'image'
      },
      {boardId: BOARD.toString()}
    );
    expect(mockedMedia.create).toHaveBeenCalledWith(expect.objectContaining({publicId: 'photo_abc'}));
  });

  it('rejects an asset Cloudinary does not have', async () => {
    mockedAsset.mockResolvedValue(null);
    await expect(
      mediaService.register(
        OWNER,
        {
          name: 'photo.png',
          url: OWN_URL('image/upload/photo.png'),
          publicId: 'fluely/content-planner/ghost',
          mimeType: 'image/png',
          sizeBytes: 100,
          resourceType: 'image'
        },
        {}
      )
    ).rejects.toMatchObject({statusCode: 400});
    expect(mockedMedia.create).not.toHaveBeenCalled();
  });

  it('rejects an asset whose delivery URL is not on our Cloudinary', async () => {
    mockedAsset.mockResolvedValue({
      secureUrl: 'https://res.cloudinary.com/some-other-cloud/image/upload/x.png',
      bytes: 100,
      resourceType: 'image',
      folder: 'fluely/content-planner'
    });
    await expect(
      mediaService.register(
        OWNER,
        {
          name: 'x.png',
          url: 'ignored',
          publicId: 'fluely/content-planner/x',
          mimeType: 'image/png',
          sizeBytes: 100,
          resourceType: 'image'
        },
        {}
      )
    ).rejects.toMatchObject({statusCode: 400});
  });

  it('enforces the size limit on the real size, not the reported one', async () => {
    mockedAsset.mockResolvedValue({
      secureUrl: OWN_URL('video/upload/huge.mp4'),
      bytes: 10 * 1024 * 1024 * 1024,
      resourceType: 'video',
      folder: 'fluely/content-planner'
    });
    await expect(
      mediaService.register(
        OWNER,
        {
          name: 'huge.mp4',
          url: 'ignored',
          publicId: 'fluely/content-planner/huge',
          mimeType: 'video/mp4',
          sizeBytes: 10,
          resourceType: 'video'
        },
        {}
      )
    ).rejects.toMatchObject({statusCode: 413});
  });
});

describe('upload scope (proxied upload, signature, register)', () => {
  const file = {
    buffer: Buffer.from('x'),
    size: 1,
    mimetype: 'image/png',
    originalname: 'a.png'
  } as Express.Multer.File;

  it('hides a board from someone with no access to it', async () => {
    await expect(
      mediaService.create(STRANGER, [file], {boardId: BOARD.toString()})
    ).rejects.toMatchObject({statusCode: 404, code: 'BOARD_NOT_FOUND'});
    await expect(
      mediaService.signature(STRANGER, {boardId: BOARD.toString()})
    ).rejects.toMatchObject({statusCode: 404, code: 'BOARD_NOT_FOUND'});
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('refuses a viewer on every path', async () => {
    asCollaborator('viewer');
    await expect(
      mediaService.create(VIEWER, [file], {boardId: BOARD.toString()})
    ).rejects.toMatchObject({statusCode: 403});
    await expect(
      mediaService.signature(VIEWER, {boardId: BOARD.toString()})
    ).rejects.toMatchObject({statusCode: 403});
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('reports a board that does not exist as not found', async () => {
    mockedBoards.findById.mockResolvedValue(null as never);
    await expect(
      mediaService.create(OWNER, [file], {boardId: BOARD.toString()})
    ).rejects.toMatchObject({statusCode: 404, code: 'BOARD_NOT_FOUND'});
  });

  it('lets an editor upload to the board', async () => {
    asCollaborator('editor');
    mockedUpload.mockResolvedValue({
      secure_url: OWN_URL('image/upload/a.png'),
      public_id: 'fluely/boards/a',
      resource_type: 'image'
    } as never);
    const items = await mediaService.create(EDITOR, [file], {boardId: BOARD.toString()});
    expect(items).toHaveLength(1);
    expect(mockedMedia.create).toHaveBeenCalledWith(expect.objectContaining({boardId: BOARD}));
  });

  it('needs a board for a card, and the card must be on that board', async () => {
    await expect(
      mediaService.create(OWNER, [file], {cardId: CARD.toString()})
    ).rejects.toMatchObject({statusCode: 400});

    mockedCards.findByIdForBoard.mockResolvedValue(null as never);
    await expect(
      mediaService.create(OWNER, [file], {boardId: BOARD.toString(), cardId: CARD.toString()})
    ).rejects.toMatchObject({statusCode: 404, code: 'CARD_NOT_FOUND'});
    expect(mockedUpload).not.toHaveBeenCalled();
  });

  it('keeps personal uploads (no board) open to any signed-in user', async () => {
    mockedUpload.mockResolvedValue({
      secure_url: OWN_URL('image/upload/a.png'),
      public_id: 'fluely/content-planner/a',
      resource_type: 'image'
    } as never);
    const items = await mediaService.create(STRANGER, [file], {});
    expect(items).toHaveLength(1);
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
