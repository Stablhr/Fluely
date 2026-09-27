"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const boardAccess_service_1 = require("../api/services/boardAccess.service");
const mongoose_1 = require("mongoose");
const OWNER = new mongoose_1.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa1');
const EDITOR = new mongoose_1.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa2');
const VIEWER = new mongoose_1.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa3');
const PENDING = new mongoose_1.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa4');
const DECLINED = new mongoose_1.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa5');
const COLLEAGUE = new mongoose_1.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa6');
const OUTSIDER = new mongoose_1.Types.ObjectId('aaaaaaaaaaaaaaaaaaaaaaa7');
const WORKSPACE = new mongoose_1.Types.ObjectId('bbbbbbbbbbbbbbbbbbbbbbb1');
const OTHER_WORKSPACE = new mongoose_1.Types.ObjectId('bbbbbbbbbbbbbbbbbbbbbbb2');
function actor(id, actorType = 'user') {
    return { actorId: id, actorType };
}
function board(overrides = {}) {
    return {
        _id: new mongoose_1.Types.ObjectId('ccccccccccccccccccccccc1'),
        ownerId: OWNER,
        visibility: 'private',
        workspaceId: WORKSPACE,
        publicSlug: null,
        ...overrides
    };
}
const accepted = (role) => ({ role, status: 'accepted' });
const pending = (role) => ({ role, status: 'pending' });
const declined = (role) => ({ role, status: 'declined' });
describe('resolveAccessLevel', () => {
    describe('owner', () => {
        it.each(['private', 'workspace', 'public'])('is owner on a %s board and can write it', visibility => {
            const level = (0, boardAccess_service_1.resolveAccessLevel)(actor(OWNER), board({ visibility }), {
                sharesWorkspace: true
            });
            expect(level).toBe('owner');
            expect((0, boardAccess_service_1.canRead)(level)).toBe(true);
            expect((0, boardAccess_service_1.canWrite)(level)).toBe(true);
            expect((0, boardAccess_service_1.isOwnerLevel)(level)).toBe(true);
        });
    });
    describe('accepted collaborators', () => {
        it.each(['private', 'workspace', 'public'])('an accepted editor keeps write access on a %s board', visibility => {
            const level = (0, boardAccess_service_1.resolveAccessLevel)(actor(EDITOR), board({ visibility }), {
                collaboration: accepted('editor')
            });
            expect(level).toBe('editor');
            expect((0, boardAccess_service_1.canWrite)(level)).toBe(true);
        });
        it.each(['private', 'workspace', 'public'])('an accepted viewer is read-only on a %s board', visibility => {
            const level = (0, boardAccess_service_1.resolveAccessLevel)(actor(VIEWER), board({ visibility }), {
                collaboration: accepted('viewer')
            });
            expect(level).toBe('viewer');
            expect((0, boardAccess_service_1.canRead)(level)).toBe(true);
            expect((0, boardAccess_service_1.canWrite)(level)).toBe(false);
            expect((0, boardAccess_service_1.isOwnerLevel)(level)).toBe(false);
        });
    });
    describe('invitations that have not been accepted', () => {
        it('a pending editor gets no access at all', () => {
            const level = (0, boardAccess_service_1.resolveAccessLevel)(actor(PENDING), board(), {
                collaboration: pending('editor')
            });
            expect(level).toBe('none');
            expect((0, boardAccess_service_1.canRead)(level)).toBe(false);
        });
        it('a declined viewer keeps no access', () => {
            const level = (0, boardAccess_service_1.resolveAccessLevel)(actor(DECLINED), board(), {
                collaboration: declined('viewer')
            });
            expect(level).toBe('none');
        });
    });
    describe('workspace visibility', () => {
        it('lets a same-workspace non-collaborator read but not write', () => {
            const level = (0, boardAccess_service_1.resolveAccessLevel)(actor(COLLEAGUE), board({ visibility: 'workspace' }), {
                sharesWorkspace: true
            });
            expect(level).toBe('workspace-view');
            expect((0, boardAccess_service_1.canRead)(level)).toBe(true);
            expect((0, boardAccess_service_1.canWrite)(level)).toBe(false);
        });
        it('denies someone in a different workspace', () => {
            const level = (0, boardAccess_service_1.resolveAccessLevel)(actor(OUTSIDER), board({ visibility: 'workspace' }), {
                sharesWorkspace: false
            });
            expect(level).toBe('none');
        });
        it('does not leak workspace access when the board has no workspace', () => {
            const level = (0, boardAccess_service_1.resolveAccessLevel)(actor(COLLEAGUE), board({ visibility: 'workspace', workspaceId: null }), { sharesWorkspace: true });
            expect(level).toBe('none');
        });
    });
    describe('private visibility', () => {
        it.each([
            ['same workspace', true],
            ['different workspace', false]
        ])('is invisible to a non-collaborator from the %s', (_label, sharesWorkspace) => {
            const level = (0, boardAccess_service_1.resolveAccessLevel)(actor(COLLEAGUE), board({ visibility: 'private' }), {
                sharesWorkspace
            });
            expect(level).toBe('none');
        });
    });
    describe('public visibility', () => {
        it('grants read-only access to a signed-in outsider via the slug', () => {
            const level = (0, boardAccess_service_1.resolveAccessLevel)(actor(OUTSIDER), board({ visibility: 'public', publicSlug: 'abc123xyz789' }), { sharesWorkspace: false });
            expect(level).toBe('public-view');
            expect((0, boardAccess_service_1.canRead)(level)).toBe(true);
            expect((0, boardAccess_service_1.canWrite)(level)).toBe(false);
        });
        it('is not addressable without a slug', () => {
            const level = (0, boardAccess_service_1.resolveAccessLevel)(actor(OUTSIDER), board({ visibility: 'public', publicSlug: null }), {});
            expect(level).toBe('none');
        });
        it('stops granting public access the moment visibility changes', () => {
            const level = (0, boardAccess_service_1.resolveAccessLevel)(actor(OUTSIDER), board({ visibility: 'workspace', publicSlug: 'abc123xyz789' }), { sharesWorkspace: false });
            expect(level).toBe('none');
        });
    });
    describe('precedence', () => {
        it('reports the collaboration role rather than workspace-view', () => {
            const level = (0, boardAccess_service_1.resolveAccessLevel)(actor(EDITOR), board({ visibility: 'workspace' }), {
                collaboration: accepted('editor'),
                sharesWorkspace: true
            });
            expect(level).toBe('editor');
        });
        it('reports the owner even if a collaboration row somehow exists', () => {
            const level = (0, boardAccess_service_1.resolveAccessLevel)(actor(OWNER), board({ visibility: 'public' }), {
                collaboration: accepted('viewer'),
                sharesWorkspace: true
            });
            expect(level).toBe('owner');
        });
    });
});
describe('write access', () => {
    it('is limited to owner and editor', () => {
        expect((0, boardAccess_service_1.canWrite)('owner')).toBe(true);
        expect((0, boardAccess_service_1.canWrite)('editor')).toBe(true);
        expect((0, boardAccess_service_1.canWrite)('viewer')).toBe(false);
        expect((0, boardAccess_service_1.canWrite)('workspace-view')).toBe(false);
        expect((0, boardAccess_service_1.canWrite)('public-view')).toBe(false);
        expect((0, boardAccess_service_1.canWrite)('none')).toBe(false);
    });
});
describe('isPubliclyAddressable', () => {
    it('requires both public visibility and a slug', () => {
        expect((0, boardAccess_service_1.isPubliclyAddressable)({ visibility: 'public', publicSlug: 'abc' })).toBe(true);
        expect((0, boardAccess_service_1.isPubliclyAddressable)({ visibility: 'public', publicSlug: null })).toBe(false);
        expect((0, boardAccess_service_1.isPubliclyAddressable)({ visibility: 'private', publicSlug: 'abc' })).toBe(false);
        expect((0, boardAccess_service_1.isPubliclyAddressable)({ visibility: 'workspace', publicSlug: 'abc' })).toBe(false);
    });
});
