"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaKinds = exports.RepeatFrequencies = exports.SocialJobStatuses = exports.SocialPostStatuses = exports.SocialPlatforms = exports.BoardTemplates = exports.WRITE_ACCESS_LEVELS = exports.BoardAccessLevels = exports.CollaboratorStatuses = exports.CollaboratorRoles = exports.BoardVisibilities = exports.BoardRoles = exports.ActorTypes = void 0;
exports.ActorTypes = ['user', 'admin'];
exports.BoardRoles = ['owner', 'editor', 'viewer'];
exports.BoardVisibilities = ['private', 'workspace', 'public'];
/**
 * Collaborator roles. Deliberately narrower than BoardRoles: 'owner' is implied
 * by Board.ownerId and can never be handed to a collaborator record.
 */
exports.CollaboratorRoles = ['editor', 'viewer'];
/** Lifecycle of a board invitation. Only 'accepted' grants any access. */
exports.CollaboratorStatuses = ['pending', 'accepted', 'declined'];
/**
 * The single vocabulary the permission matrix is written in. Every board route
 * resolves one of these, and the value is echoed to the client on each board so
 * the UI can gate controls without recomputing anything.
 *
 * Write access is exactly: 'owner' or 'editor'. Nothing else may mutate, and
 * visibility mode alone never confers write.
 */
exports.BoardAccessLevels = [
    'owner',
    'editor',
    'viewer',
    'workspace-view',
    'public-view',
    'none'
];
exports.WRITE_ACCESS_LEVELS = ['owner', 'editor'];
exports.BoardTemplates = ['blank', 'simple', 'social_content'];
exports.SocialPlatforms = ['instagram', 'facebook', 'x', 'linkedin', 'tiktok', 'youtube'];
exports.SocialPostStatuses = ['draft', 'scheduled', 'queued', 'published', 'failed', 'cancelled'];
exports.SocialJobStatuses = ['queued', 'running', 'succeeded', 'failed', 'cancelled'];
exports.RepeatFrequencies = ['daily', 'weekly', 'monthly'];
exports.MediaKinds = ['image', 'video', 'audio', 'document'];
