import { httpClient } from "@/lib/api/httpClient";

export interface InviteDetails {
  id: string;
  boardId: string;
  boardName: string;
  role: "editor" | "viewer";
  inviterName: string;
  inviteeEmail: string;
  expiresAt: string | null;
}

export async function fetchInviteDetails(token: string): Promise<InviteDetails> {
  const { data } = await httpClient.get<InviteDetails>(`/invitations/${encodeURIComponent(token)}`);
  return data;
}

export async function respondToInvite(token: string, decision: "accepted" | "declined"): Promise<void> {
  await httpClient.post(`/invitations/${encodeURIComponent(token)}/respond`, { decision });
}

export async function resendInvite(boardId: string, collaboratorId: string): Promise<void> {
  await httpClient.post(`/boards/${boardId}/collaborators/${collaboratorId}/resend`);
}
