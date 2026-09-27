import { httpClient } from "./httpClient";

type RegisterRequest = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  password: string;
};

type RegisterResponse = {
  id: string;
  email: string;
};

/**
 * The account shape the auth endpoints return.
 *
 * firstName and lastName are required on the user model, so the app can greet
 * the signed-in person by name — the sidebar chip, the top bar pill and the
 * avatar initials all read from them. username is optional on the model and is
 * carried for callers that want a handle rather than a real name.
 */
export type AuthUser = {
  id: string;
  email: string;
  type: "admin" | "user";
  firstName: string;
  lastName: string;
  username?: string;
  /**
   * The person's primary workspace, as the backend reports it.
   *
   * Optional because an admin account never gets a workspace, and because a
   * response predating the field simply omits it — callers must treat `null` and
   * `undefined` the same way rather than assuming a workspace exists.
   */
  workspaceId?: string | null;
};

type LoginResponse = {
  user: AuthUser;
};
type LogoutResponse = { message: string };

type MeResponse = {
  user: AuthUser;
};

/**
 * The person's name as it should appear in the UI: "Aria Chen".
 *
 * Falls back through first name to the email local part so the chip is never
 * blank. A missing name is possible in practice — an account created before
 * the name fields were required, or a response from an older backend.
 */
export function getDisplayName(user: AuthUser | undefined): string {
  if (!user) return "";

  const full = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  if (full) return full;

  return user.firstName?.trim() || user.email?.split("@")[0] || "";
}

export async function registerCustomer(data: RegisterRequest) {
  const res = await httpClient.post<RegisterResponse>("/auth/register", data);
  return res.data;
}

export async function verifyCustomerEmail(params: {
  email: string;
  code: string;
}) {
  const res = await httpClient.post<{ message: string }>(
    "/auth/verify",
    params,
  );
  return res.data;
}

export async function resendVerificationCode(params: { email: string }) {
  const res = await httpClient.post<{ message: string }>(
    "/auth/resend-verification",
    params,
  );
  return res.data;
}

export async function login(params: { email: string; password: string }) {
  const res = await httpClient.post<LoginResponse>("/auth/login", params);
  return res.data;
}

export async function logout() {
  const res = await httpClient.post<LogoutResponse>("/auth/logout");
  return res.data;
}

export async function sendPasswordResetCode(params: { email: string }) {
  const res = await httpClient.post<{ message: string }>(
    "/auth/forgot-password",
    params,
  );
  return res.data;
}

export async function resendPasswordResetCode(params: { email: string }) {
  const res = await httpClient.post<{ message: string }>(
    "/auth/resend-reset-code",
    params,
  );
  return res.data;
}

export async function verifyPasswordResetCode(params: {
  email: string;
  code: string;
}) {
  const res = await httpClient.post<{ message: string }>(
    "/auth/verify-reset-code",
    params,
  );
  return res.data;
}

export async function resetPassword(params: {
  email: string;
  code: string;
  newPassword: string;
}) {
  const res = await httpClient.post<{ message: string }>(
    "/auth/reset-password",
    params,
  );
  return res.data;
}

export async function getMe() {
  const res = await httpClient.get<MeResponse>("/auth/me");
  return res.data;
}

export async function changePassword(params: {
  currentPassword: string;
  newPassword: string;
}) {
  const res = await httpClient.put<{ message: string }>(
    "/auth/password",
    params,
  );
  return res.data;
}
