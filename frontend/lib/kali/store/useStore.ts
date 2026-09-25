import { createContext, useContext } from 'react'
import type { AppData, Board, Card, Label, List, Member, Share, SocialPost, SocialPostPlatform, SocialMediaAttachment, SocialAnalytics, PublishingJob, Platform, ThemeMode } from './schema'

export interface Store {
  data: AppData
  error: string | null
  dismissError: () => void
  boards: Board[]
  members: Member[]
  getBoard: (id: string) => Board | undefined
  getLists: (boardId: string) => List[]
  getCards: (listId: string) => Card[]
  getCard: (id: string) => Card | undefined
  createBoard: (templateId: string, name: string) => string
  deleteBoard: (id: string) => void
  renameBoard: (id: string, name: string) => void
  toggleStar: (id: string) => void
  addList: (boardId: string, name: string) => void
  renameList: (id: string, name: string) => void
  setListAssignee: (id: string, name: string) => void
  setListBackgroundColor: (id: string, color: string) => void
  toggleListCollapsed: (id: string) => void
  archiveList: (listId: string) => void
  restoreList: (boardId: string, archivedIndex: number) => void
  moveList: (boardId: string, startIndex: number, endIndex: number) => void
  addCard: (listId: string, title: string) => string
  deleteCard: (id: string) => void
  updateCard: (id: string, patch: Partial<Card>) => void
  moveCard: (cardId: string, destListId: string, destIndex: number) => void
  addActivity: (cardId: string, text: string) => void
  addBoardActivity: (boardId: string, text: string) => void
  setBoardSettings: (boardId: string, patch: Partial<Board['settings']>) => void
  makeTemplate: (boardId: string) => string
  addInboxItem: (text: string) => void
  dismissInboxItem: (id: string) => void
  moveInboxToBoard: (itemId: string, boardId: string, listId: string) => void
  scheduleInboxItem: (itemId: string, boardId: string, date: string) => void
  archiveCard: (id: string) => void
  restoreCard: (id: string) => void
  toggleDone: (id: string) => void
  setBoardVisibility: (id: string, visibility: Board['visibility']) => void
  setBoardBackground: (id: string, background: string) => void
  setBoardDescription: (id: string, description: string) => void
  addLabel: (boardId: string, name: string, color: string) => string
  updateLabel: (boardId: string, labelId: string, patch: Partial<Label>) => void
  deleteLabel: (boardId: string, labelId: string) => void
  addShare: (boardId: string, name: string, role: Share['role']) => void
  removeShare: (boardId: string, shareId: string) => void
  updateShareRole: (boardId: string, shareId: string, role: Share['role']) => void
  createShareLink: (boardId: string) => void
  setDarkMode: (mode: ThemeMode) => void
  resetAll: () => void
  // Social Posts
  socialPosts: SocialPost[]
  socialJobs: PublishingJob[]
  addSocialPost: (post: Omit<SocialPost, 'id' | 'createdAt' | 'updatedAt'>) => SocialPost
  updateSocialPost: (id: string, patch: Partial<SocialPost>) => void
  deleteSocialPost: (id: string) => void
  duplicateSocialPost: (id: string) => SocialPost | null
  moveSocialPost: (id: string, newDate: string, newTime?: string) => void
  scheduleSocialPost: (id: string, input: { scheduledDate: string; scheduledTime?: string; timezone?: string; repeat?: SocialPost['repeat']; repeatUntil?: string }) => Promise<{ ok: boolean; errors?: string[] }>
  cancelSocialPost: (id: string, platform?: Platform) => Promise<boolean>
  retrySocialPost: (id: string, platform?: Platform) => Promise<boolean>
  refreshSocialJobs: (postId?: string) => Promise<void>
  refreshSocialPost: (postId: string) => Promise<SocialPost | null>
  getSocialPostsByDate: (date: string) => SocialPost[]
  getSocialPostsByPlatform: (platform: Platform) => SocialPost[]
  getSocialPostsByStatus: (status: SocialPost['status']) => SocialPost[]
  getSocialPostsByCard: (cardId: string) => SocialPost[]
  getUnscheduledPosts: () => SocialPost[]
  addPlatformToPost: (postId: string, platform: Platform) => void
  removePlatformFromPost: (postId: string, platform: Platform) => void
  updatePostPlatform: (postId: string, platform: Platform, patch: Partial<SocialPostPlatform>) => void
  addMediaToPost: (postId: string, media: Omit<SocialMediaAttachment, 'id'>) => void
  removeMediaFromPost: (postId: string, mediaId: string) => void
  updatePostAnalytics: (postId: string, platform: Platform, analytics: SocialAnalytics) => void
}

export const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
