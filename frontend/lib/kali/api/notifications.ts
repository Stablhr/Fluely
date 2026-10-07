import { httpClient } from "@/lib/api/httpClient";

/**
 * Notification calls. Same reasoning as `boards.ts`: everything goes through
 * `httpClient` so CSRF, refresh-on-401, and error normalization keep working.
 */

/** Mirrors `notificationService.list` in the backend. */
export type AppNotificationType =
  | "board_invitation"
  | "board_invitation_accepted"
  | "board_invitation_declined";

export interface AppNotificationDto {
  id: string;
  type: AppNotificationType;
  boardId: string;
  /** The invitation row, present on `board_invitation` so the bell can wire Accept/Decline. */
  collaboratorId: string | null;
  boardName: string;
  actorName: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationList {
  unreadCount: number;
  notifications: AppNotificationDto[];
}

export async function fetchNotifications(): Promise<NotificationList> {
  const { data } = await httpClient.get<NotificationList>("/notifications");
  return {
    unreadCount: data.unreadCount,
    notifications: data.notifications,
  };
}

export async function markNotificationRead(id: string): Promise<void> {
  await httpClient.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await httpClient.post("/notifications/read-all");
}
