import {
  resolveAccessLevel,
  canRead,
  canWrite,
  isOwnerLevel,
  isPubliclyAddressable,
  AccessTarget
} from '../api/services/boardAccess.service';
import {Actor} from '../api/utils/actor';
import {ActorType, BoardVisibility} from '../api/constants/product';
import {Types} from 'mongoose';

const OWNER = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa1');
const EDITOR = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa2');
const VIEWER = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa3');
const PENDING = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa4');
const DECLINED = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa5');
const COLLEAGUE = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa6');
const OUTSIDER = new Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa7');
const WORKSPACE = new Types.ObjectId('bbbbbbbbbbbbbbbbbbbbbbb1');
const OTHER_WORKSPACE = new Types.ObjectId('bbbbbbbbbbbbbbbbbbbbbbb2');

function actor(id: Types.ObjectId, actorType: ActorType = 'user'): Actor {
  return {actorId: id, actorType};
}

function board(overrides: Partial<AccessTarget> = {}): AccessTarget {
  return {
    _id: new Types.ObjectId('ccccccccccccccccccccccc1'),
    ownerId: OWNER,
    visibility: 'private' as BoardVisibility,
    workspaceId: WORKSPACE,
    publicSlug: null,
    ...overrides
  } as AccessTarget;
}

const accepted = (role: 'editor' | 'viewer') => ({role, status: 'accepted' as const});
const pending = (role: 'editor' | 'viewer') => ({role, status: 'pending' as const});
const declined = (role: 'editor' | 'viewer') => ({role, status: 'declined' as const});

describe('resolveAccessLevel', () => {
  describe('owner', () => {
    it.each<BoardVisibility>(['private', 'workspace', 'public'])(
      'is owner on a %s board and can write it',
      visibility => {
        const level = resolveAccessLevel(actor(OWNER), board({visibility}), {
          sharesWorkspace: true
        });
        expect(level).toBe('owner');
        expect(canRead(level)).toBe(true);
        expect(canWrite(level)).toBe(true);
        expect(isOwnerLevel(level)).toBe(true);
      }
    );
  });

  describe('accepted collaborators', () => {
    it.each<BoardVisibility>(['private', 'workspace', 'public'])(
      'an accepted editor keeps write access on a %s board',
      visibility => {
        const level = resolveAccessLevel(actor(EDITOR), board({visibility}), {
          collaboration: accepted('editor')
        });
        expect(level).toBe('editor');
        expect(canWrite(level)).toBe(true);
      }
    );

    it.each<BoardVisibility>(['private', 'workspace', 'public'])(
      'an accepted viewer is read-only on a %s board',
      visibility => {
        const level = resolveAccessLevel(actor(VIEWER), board({visibility}), {
          collaboration: accepted('viewer')
        });
        expect(level).toBe('viewer');
        expect(canRead(level)).toBe(true);
        expect(canWrite(level)).toBe(false);
        expect(isOwnerLevel(level)).toBe(false);
      }
    );
  });

  describe('invitations that have not been accepted', () => {
    it('a pending editor gets no access at all', () => {
      const level = resolveAccessLevel(actor(PENDING), board(), {
        collaboration: pending('editor')
      });
      expect(level).toBe('none');
      expect(canRead(level)).toBe(false);
    });

    it('a declined viewer keeps no access', () => {
      const level = resolveAccessLevel(actor(DECLINED), board(), {
        collaboration: declined('viewer')
      });
      expect(level).toBe('none');
    });
  });

  describe('workspace visibility', () => {
    it('lets a same-workspace non-collaborator read but not write', () => {
      const level = resolveAccessLevel(actor(COLLEAGUE), board({visibility: 'workspace'}), {
        sharesWorkspace: true
      });
      expect(level).toBe('workspace-view');
      expect(canRead(level)).toBe(true);
      expect(canWrite(level)).toBe(false);
    });

    it('denies someone in a different workspace', () => {
      const level = resolveAccessLevel(actor(OUTSIDER), board({visibility: 'workspace'}), {
        sharesWorkspace: false
      });
      expect(level).toBe('none');
    });

    it('does not leak workspace access when the board has no workspace', () => {
      const level = resolveAccessLevel(
        actor(COLLEAGUE),
        board({visibility: 'workspace', workspaceId: null}),
        {sharesWorkspace: true}
      );
      expect(level).toBe('none');
    });
  });

  describe('private visibility', () => {
    it.each([
      ['same workspace', true],
      ['different workspace', false]
    ])('is invisible to a non-collaborator from the %s', (_label, sharesWorkspace) => {
      const level = resolveAccessLevel(actor(COLLEAGUE), board({visibility: 'private'}), {
        sharesWorkspace
      });
      expect(level).toBe('none');
    });
  });

  describe('public visibility', () => {
    it('grants read-only access to a signed-in outsider via the slug', () => {
      const level = resolveAccessLevel(
        actor(OUTSIDER),
        board({visibility: 'public', publicSlug: 'abc123xyz789'}),
        {sharesWorkspace: false}
      );
      expect(level).toBe('public-view');
      expect(canRead(level)).toBe(true);
      expect(canWrite(level)).toBe(false);
    });

    it('is not addressable without a slug', () => {
      const level = resolveAccessLevel(
        actor(OUTSIDER),
        board({visibility: 'public', publicSlug: null}),
        {}
      );
      expect(level).toBe('none');
    });

    it('stops granting public access the moment visibility changes', () => {
      const level = resolveAccessLevel(
        actor(OUTSIDER),
        board({visibility: 'workspace', publicSlug: 'abc123xyz789'}),
        {sharesWorkspace: false}
      );
      expect(level).toBe('none');
    });
  });

  describe('precedence', () => {
    it('reports the collaboration role rather than workspace-view', () => {
      const level = resolveAccessLevel(actor(EDITOR), board({visibility: 'workspace'}), {
        collaboration: accepted('editor'),
        sharesWorkspace: true
      });
      expect(level).toBe('editor');
    });

    it('reports the owner even if a collaboration row somehow exists', () => {
      const level = resolveAccessLevel(actor(OWNER), board({visibility: 'public'}), {
        collaboration: accepted('viewer'),
        sharesWorkspace: true
      });
      expect(level).toBe('owner');
    });
  });
});

describe('write access', () => {
  it('is limited to owner and editor', () => {
    expect(canWrite('owner')).toBe(true);
    expect(canWrite('editor')).toBe(true);
    expect(canWrite('viewer')).toBe(false);
    expect(canWrite('workspace-view')).toBe(false);
    expect(canWrite('public-view')).toBe(false);
    expect(canWrite('none')).toBe(false);
  });
});

describe('isPubliclyAddressable', () => {
  it('requires both public visibility and a slug', () => {
    expect(isPubliclyAddressable({visibility: 'public', publicSlug: 'abc'})).toBe(true);
    expect(isPubliclyAddressable({visibility: 'public', publicSlug: null})).toBe(false);
    expect(isPubliclyAddressable({visibility: 'private', publicSlug: 'abc'})).toBe(false);
    expect(isPubliclyAddressable({visibility: 'workspace', publicSlug: 'abc'})).toBe(false);
  });
});
