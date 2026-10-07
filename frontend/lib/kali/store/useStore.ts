import { createContext, useContext } from "react";
import type {
  AppData,
  Board,
  BoardAccessLevel,
  Card,
  Collaborator,
  CollaboratorRole,
  Label,
  List,
  Member,
  SocialPost,
  SocialPostPlatform,
  SocialMediaAttachment,
  SocialAnalytics,
  PublishingJob,
  Platform,
  Visibility,
} from "./schema";

/**
 * The signed-in identity the store needs.
 *
 * Passed in rather than fetched here so the store stays free of token and
 * session handling. Only the three fields below are used: the id to tell an
 * owned board from a shared one, the name for the "you" chip, and the workspace
 * to decide whether "share with workspace" is even offered.
 */
export interface StoreUser {
  id: string;
  name: string;
  workspaceId: string | null;
}

/** A board invitation addressed to the signed-in person. */
export interface PendingInvitation {
  id: string;
  boardId: string;
  boardName: string;
  role: CollaboratorRole;
  invitedAt: string;
  invitedByName: string;
}

export type {
  AppNotificationDto as AppNotification,
  AppNotificationType,
} from "@/lib/kali/api/notifications";
import type { AppNotificationDto } from "@/lib/kali/api/notifications";

export interface Store {
  data: AppData;
  error: string | null;
  dismissError: () => void;
  boards: Board[];
  members: Member[];
  getBoard: (id: string) => Board | undefined;
  getLists: (boardId: string) => List[];
  getCards: (listId: string) => Card[];
  getCard: (id: string) => Card | undefined;
  createBoard: (templateId: string, name: string) => Promise<string>;
  deleteBoard: (id: string) => void;
  renameBoard: (id: string, name: string) => void;
  toggleStar: (id: string) => void;
  addList: (boardId: string, name: string) => void;
  renameList: (id: string, name: string) => void;
  setListAssignee: (id: string, name: string) => void;
  setListBackgroundColor: (id: string, color: string) => void;
  toggleListCollapsed: (id: string) => void;
  archiveList: (listId: string) => void;
  restoreList: (boardId: string, archivedIndex: number) => void;
  moveList: (boardId: string, startIndex: number, endIndex: number) => void;
  addCard: (listId: string, title: string) => string;
  deleteCard: (id: string) => void;
  updateCard: (id: string, patch: Partial<Card>) => void;
  moveCard: (cardId: string, destListId: string, destIndex: number) => void;
  addActivity: (cardId: string, text: string) => void;
  addBoardActivity: (boardId: string, text: string) => void;
  setBoardSettings: (
    boardId: string,
    patch: Partial<Board["settings"]>,
  ) => void;
  makeTemplate: (boardId: string) => string;
  addInboxItem: (text: string) => void;
  dismissInboxItem: (id: string) => void;
  moveInboxToBoard: (itemId: string, boardId: string, listId: string) => void;
  scheduleInboxItem: (itemId: string, boardId: string, date: string) => void;
  archiveCard: (id: string) => void;
  restoreCard: (id: string) => void;
  toggleDone: (id: string) => void;
  setBoardVisibility: (id: string, visibility: Visibility) => Promise<void>;
  setBoardBackground: (id: string, background: string) => void;
  setBoardDescription: (id: string, description: string) => void;
  addLabel: (boardId: string, name: string, color: string) => string;
  updateLabel: (
    boardId: string,
    labelId: string,
    patch: Partial<Label>,
  ) => void;
  deleteLabel: (boardId: string, labelId: string) => void;
  resetAll: () => void;

  /* ── Collaboration ───────────────────────────────────────────
     Every one of these talks to the server. The store keeps the returned
     state so the board, share, and sidebar views read from a single place
     like the rest of the app data. */

  /** Re-pulls boards the signed-in person can reach, plus pending invitations. */
  syncBoards: () => Promise<void>;
  /**
   * Re-pulls one board's lists and cards, repairing a board damaged by the
   * old create-response bug on the way. Called when the board is opened.
   */
  syncBoardStructure: (boardId: string) => Promise<void>;
  /** The board id whose visibility or members are mid-request, if any. */
  pendingBoardId: string | null;
  /** The signed-in account id, for spotting "you" in a people list. */
  currentUserId: string | null;

  /** Can the signed-in person change this board's content? */
  canWrite: (boardId: string) => boolean;
  /** Can they change visibility, members, or delete the board? */
  canManage: (boardId: string) => boolean;
  /** The server's verdict for this board, for display. */
  boardAccess: (boardId: string) => BoardAccessLevel;

  getCollaborators: (boardId: string) => Collaborator[];
  loadCollaborators: (boardId: string) => Promise<void>;
  inviteCollaborator: (
    boardId: string,
    email: string,
    role: CollaboratorRole,
  ) => Promise<void>;
  setCollaboratorRole: (
    boardId: string,
    collaboratorId: string,
    role: CollaboratorRole,
  ) => Promise<void>;
  removeCollaborator: (
    boardId: string,
    collaboratorId: string,
  ) => Promise<void>;

  pendingInvitations: PendingInvitation[];
  respondToInvitation: (
    invitationId: string,
    decision: "accepted" | "declined",
  ) => Promise<void>;

  /* ── Notifications ─────────────────────────────────────────────
     The bell: in-app notifications polled from the server, with the
     unread count the badge shows. */
  notifications: AppNotificationDto[];
  unreadNotificationCount: number;
  /** Re-pulls notifications and pending invitations; called on a timer. */
  syncNotifications: () => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  // Social Posts
  socialPosts: SocialPost[];
  socialJobs: PublishingJob[];
  addSocialPost: (
    post: Omit<SocialPost, "id" | "createdAt" | "updatedAt">,
  ) => SocialPost;
  updateSocialPost: (id: string, patch: Partial<SocialPost>) => void;
  deleteSocialPost: (id: string) => void;
  duplicateSocialPost: (id: string) => SocialPost | null;
  moveSocialPost: (id: string, newDate: string, newTime?: string) => void;
  scheduleSocialPost: (
    id: string,
    input: {
      scheduledDate: string;
      scheduledTime?: string;
      timezone?: string;
      repeat?: SocialPost["repeat"];
      repeatUntil?: string;
    },
  ) => Promise<{ ok: boolean; errors?: string[] }>;
  cancelSocialPost: (id: string, platform?: Platform) => Promise<boolean>;
  retrySocialPost: (id: string, platform?: Platform) => Promise<boolean>;
  refreshSocialJobs: (postId?: string) => Promise<void>;
  refreshSocialPost: (postId: string) => Promise<SocialPost | null>;
  getSocialPostsByDate: (date: string) => SocialPost[];
  getSocialPostsByPlatform: (platform: Platform) => SocialPost[];
  getSocialPostsByStatus: (status: SocialPost["status"]) => SocialPost[];
  getSocialPostsByCard: (cardId: string) => SocialPost[];
  getUnscheduledPosts: () => SocialPost[];
  addPlatformToPost: (postId: string, platform: Platform) => void;
  removePlatformFromPost: (postId: string, platform: Platform) => void;
  updatePostPlatform: (
    postId: string,
    platform: Platform,
    patch: Partial<SocialPostPlatform>,
  ) => void;
  addMediaToPost: (
    postId: string,
    media: Omit<SocialMediaAttachment, "id">,
  ) => void;
  removeMediaFromPost: (postId: string, mediaId: string) => void;
  updatePostAnalytics: (
    postId: string,
    platform: Platform,
    analytics: SocialAnalytics,
  ) => void;
}

export const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
