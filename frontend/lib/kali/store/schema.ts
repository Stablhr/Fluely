export type Visibility = 'private' | 'workspace' | 'public'

export interface Member {
  id: string
  name: string
  color: string
}

export interface Label {
  id: string
  name: string
  color: string
}

/**
 * The board access ladder, mirroring the server's own resolver in
 * `backend/api/services/boardAccess.service.ts`.
 *
 * The client copy is a display and gating aid, not a permission: every route
 * re-checks on the server. It exists so the UI can grey out controls instead of
 * offering an action that is guaranteed to 403.
 */
export type BoardAccessLevel =
  | 'owner'
  | 'editor'
  | 'viewer'
  | 'workspace-view'
  | 'public-view'
  | 'none'

/** Access levels permitted to change board content. Mirrors the server's own set. */
const WRITE_ACCESS_LEVELS: ReadonlySet<BoardAccessLevel> = new Set([
  'owner',
  'editor',
])

/** Access levels permitted to change visibility, membership, or delete. */
const MANAGE_ACCESS_LEVELS: ReadonlySet<BoardAccessLevel> = new Set(['owner'])

export function canWriteBoard(access: BoardAccessLevel): boolean {
  return WRITE_ACCESS_LEVELS.has(access)
}

export function canManageBoard(access: BoardAccessLevel): boolean {
  return MANAGE_ACCESS_LEVELS.has(access)
}

/** Collaborator roles. `editor` can write, `viewer` is read-only. */
export type CollaboratorRole = 'editor' | 'viewer'

export type CollaboratorStatus = 'pending' | 'accepted' | 'declined'

/**
 * A person invited to a board.
 *
 * `id` is the collaborator row id — the one the role and remove routes take —
 * while `userId` identifies the account. They differ because one user can hold
 * exactly one row per board, and the row is what carries role and status.
 */
export interface Collaborator {
  id: string
  userId: string
  name: string
  email: string
  role: CollaboratorRole
  status: CollaboratorStatus
  invitedByName: string
  invitedAt: string
  respondedAt: string | null
}

export interface FileAttachment {
  id: string
  name: string
  type: 'file' | 'image'
  dataUrl: string
  size: number
  addedAt: string
}

export interface CommentItem {
  id: string
  authorId: string
  text: string
  reactions: Reactions
  createdAt: string
}

export interface ActivityItem {
  id: string
  text: string
  createdAt: string
}

export type Reactions = Record<string, number>

export type Cover = string | { type: 'image'; dataUrl: string } | null

export interface BoardSettings {
  commentPermission: 'members' | 'anyone'
  selfJoin: boolean
}

export interface ArchivedList {
  list: List
  cards: Card[]
}

export interface Board {
  id: string
  name: string
  description: string
  visibility: Visibility
  starred: boolean
  background: string
  createdAt: string
  updatedAt: string
  listOrder: string[]
  labels: Record<string, Label>
  collaborators: Collaborator[]
  /**
   * What the signed-in person may do with this board.
   *
   * `owner` is also the value given to a board that has never left this
   * browser, so local-only boards stay fully editable until they are imported.
   */
  access: BoardAccessLevel
  /** Null while the board is local-only. */
  ownerId: string | null
  /** Null while local-only, or for a personal board with no workspace. */
  workspaceId: string | null
  /** The addressable handle, present only while `visibility` is `public`. */
  publicSlug: string | null
  /** Server-side optimistic-concurrency counter; null while local-only. */
  revision: number | null
  settings: BoardSettings
  activity: ActivityItem[]
  archivedLists: ArchivedList[]
}

export interface List {
  id: string
  boardId: string
  name: string
  assignee: string
  collapsed: boolean
  order: number
  cardOrder: string[]
  backgroundColor: string
}

export interface Card {
  id: string
  boardId: string
  listId: string
  title: string
  desc: string
  cover: Cover
  coverSize: 'large' | 'small'
  labelIds: string[]
  memberIds: string[]
  dueDate: string | null
  startDate: string | null
  location: string
  watching: boolean
  archived: boolean
  done: boolean
  files: FileAttachment[]
  comments: CommentItem[]
  activity: ActivityItem[]
  createdAt: string
  updatedAt: string
}

export interface InboxItem {
  id: string
  text: string
  createdAt: string
}

/* ── Social Media Scheduler types ────────────────────────────── */

export type Platform = 'youtube' | 'facebook' | 'tiktok' | 'instagram'

/**
 * Planning stages come first (idea → draft → in_review) because the content
 * planner's board and table drive off them; the rest are publishing outcomes
 * that `POST_COLUMN_FOR_STATUS` folds back into the nearest stage.
 */
export type SocialPostStatus = 'idea' | 'draft' | 'in_review' | 'scheduled' | 'publishing' | 'posted' | 'partially_published' | 'failed' | 'cancelled'

export type PlatformStatus = 'pending' | 'scheduled' | 'publishing' | 'posted' | 'failed' | 'cancelled'

export type RepeatFrequency = 'none' | 'daily' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly'

export type MediaType = 'image' | 'video' | 'audio'

export interface SocialPostPlatform {
  platform: Platform
  enabled: boolean
  status: PlatformStatus
  caption: string
  hashtags: string[]
  mentions: string[]
  location?: string
  altText?: string
  visibility: 'public' | 'private' | 'friends' | 'unlisted'
  deepLink?: string
  publishedUrl?: string
  platformPostId?: string
  externalPostId?: string
  error?: string
  errorCode?: string
  publishedAt?: string
  retryCount?: number
  maxRetries?: number
  lastAttemptAt?: string
  nextRetryAt?: string
  idempotencyKey?: string
}

export interface SocialMediaAttachment {
  id: string
  type: MediaType
  name: string
  dataUrl: string
  storageUrl?: string
  size: number
  thumbnail?: string
  thumbnailUrl?: string
  mimeType?: string
  duration?: number
  width?: number
  height?: number
  platformCompat: Platform[]
  uploadedAt?: string
}

export interface SocialAnalytics {
  platform: Platform
  reach: number
  likes: number
  comments: number
  shares: number
  clicks: number
  impressions: number
  engagementRate: number
  fetchedAt: string
  isDemo: boolean
}

export interface AIGenerationMeta {
  model: string
  prompt: string
  tokensUsed: number
  generatedAt: string
  version: number
}

type PublishingJobStatus = 'queued' | 'locked' | 'publishing' | 'completed' | 'failed' | 'cancelled'

export interface PublishingJob {
  _id: string
  socialPostId: string
  platform: Platform
  status: PublishingJobStatus
  lockedAt?: string
  lockedBy?: string
  startedAt?: string
  completedAt?: string
  error?: string
  errorCode?: string
  retryCount: number
  maxRetries: number
  nextRetryAt?: string
  idempotencyKey: string
  publishResult?: {
    externalPostId?: string
    publishedUrl?: string
  }
  createdAt: string
  updatedAt: string
}

export interface SocialPost {
  id: string
  title: string
  caption: string
  platforms: SocialPostPlatform[]
  media: SocialMediaAttachment[]
  cardId?: string
  scheduledDate?: string
  scheduledTime?: string
  scheduledAt?: string
  timezone?: string
  status: SocialPostStatus
  repeat: RepeatFrequency
  repeatUntil?: string
  analytics?: SocialAnalytics[]
  aiGeneration?: AIGenerationMeta
  tags: string[]
  notes?: string
  createdAt: string
  updatedAt: string
}

export const PLATFORM_DEFAULTS: Record<Platform, Partial<SocialPostPlatform>> = {
  youtube: { caption: '', visibility: 'public', hashtags: [] },
  facebook: { caption: '', visibility: 'public', hashtags: [] },
  tiktok: { caption: '', visibility: 'public', hashtags: [] },
  instagram: { caption: '', visibility: 'public', hashtags: [] },
}

export const PLATFORM_LIMITS: Record<Platform, { maxCaption: number; maxHashtags: number; supportedMedia: MediaType[] }> = {
  youtube: { maxCaption: 5000, maxHashtags: 15, supportedMedia: ['image', 'video'] },
  facebook: { maxCaption: 63206, maxHashtags: 30, supportedMedia: ['image', 'video', 'audio'] },
  tiktok: { maxCaption: 2200, maxHashtags: 30, supportedMedia: ['video', 'image'] },
  instagram: { maxCaption: 2200, maxHashtags: 30, supportedMedia: ['image', 'video'] },
}

export const PLATFORM_COLORS: Record<Platform, string> = {
  youtube: '#FF0000',
  facebook: '#1877F2',
  tiktok: '#000000',
  instagram: '#E4405F',
}

export interface TaskNotification {
  _id: string
  type:
    | 'publish_success'
    | 'publish_failed'
    | 'retry_scheduled'
    | 'token_expired'
    | 'token_revoked'
    | 'partial_success'
    | 'all_failed'
    | 'info'
  message: string
  socialPostId?: string
  platform?: string
  accountId?: string
  read: boolean
  severity: 'success' | 'error' | 'warning' | 'info'
  createdAt: string
  updatedAt: string
}

export interface AppData {
  version: number
  boards: Record<string, Board>
  lists: Record<string, List>
  cards: Record<string, Card>
  inbox: InboxItem[]
  members: Record<string, Member>
  ui: {
    lastVisitedBoardId: string | null
  }
}

export const YOU_ID = 'member-you'

export const MEMBER_COLORS = ['#3971B8', '#4AA8FF', '#FF8B5E', '#8B7CF6', '#33B27A', '#F6C453', '#FF5E6C']

export const LABEL_SWATCHES = [
  { name: 'Marketing', color: '#8B7CF6' },
  { name: 'Design', color: '#FF8B5E' },
  { name: 'Engineering', color: '#4AA8FF' },
  { name: 'Urgent', color: '#FF5E6C' },
  { name: 'Low priority', color: '#33B27A' },
] as const

export interface BoardTemplate {
  id: string
  name: string
  description: string
  swatch: string
  lists: string[]
  labels: { name: string; color: string }[]
}

export const BOARD_TEMPLATES: BoardTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Board',
    description: 'A single empty list. Build whatever workflow you need.',
    swatch: '#0DABA3',
    lists: ['To Do'],
    labels: [],
  },
  {
    id: 'simple-project',
    name: 'Simple Project',
    description: 'Classic To Do → In Progress → Review → Done workflow.',
    swatch: '#4AA8FF',
    lists: ['To Do', 'In Progress', 'Review', 'Done'],
    labels: [...LABEL_SWATCHES],
  },
  {
    id: 'social-content',
    name: 'Social Media Content',
    description: 'Content approval pipeline from Pending to Done, with platform tags.',
    swatch: '#8B7CF6',
    lists: ['Pending', 'In Progress', 'Production Approval', 'Marketing Approval', 'For Posting', 'Scheduled', 'Done'],
    labels: [
      { name: 'Instagram', color: '#E1306C' },
      { name: 'Facebook', color: '#4AA8FF' },
      { name: 'Blog', color: '#8B7CF6' },
      { name: 'TikTok', color: '#7F7FD5' },
      { name: 'Story', color: '#33B27A' },
    ],
  },
]

export const BOARD_BACKGROUNDS = ['#0DABA3', '#0A8981', '#132A29', '#FF8B5E', '#33B27A', '#4AA8FF', '#8B7CF6', '#FF5E6C']

export function emptyData(): AppData {
  return {
    version: 1,
    boards: {},
    lists: {},
    cards: {},
    inbox: [],
    members: {
      // Fallback only. StoreProvider renames this member after the signed-in
      // person on every mount; "You" is what shows in the window before that, and
      // what stays if the account somehow arrives without a name.
      [YOU_ID]: { id: YOU_ID, name: 'You', color: MEMBER_COLORS[0] },
    },
    ui: {
      lastVisitedBoardId: null,
    },
  }
}
