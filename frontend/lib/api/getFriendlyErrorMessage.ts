import type { NormalizedApiError } from "./types";

function isNormalizedApiError(error: unknown): error is NormalizedApiError {
  return (
    !!error &&
    typeof error === "object" &&
    "message" in error &&
    "code" in error &&
    typeof (error as Record<string, unknown>).message === "string" &&
    typeof (error as Record<string, unknown>).code === "string"
  );
}

function hasStringMessage(error: unknown): error is { message: string } {
  return (
    !!error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  );
}

function getDuplicateKeyFriendlyMessage(rawMessage: string): string | null {
  const msg = rawMessage.toLowerCase();

  if (!msg.includes("e11000") && !msg.includes("duplicate key")) return null;

  if (
    msg.includes("phonenumber") ||
    msg.includes("phoneNumber_1".toLowerCase())
  ) {
    return "Phone number already exists.";
  }

  if (msg.includes("email") || msg.includes("email_1")) {
    return "Email already exists.";
  }

  return "Account already exists.";
}

export function getFriendlyErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (!error) return fallback;

  if (isNormalizedApiError(error)) {
    switch (error.code) {
      case "EMAIL_EXISTS":
        return "Email already exists.";
      case "PHONE_EXISTS":
        return "Phone number already exists.";
      case "USERNAME_EXISTS":
        return "Username already taken.";
      case "ALREADY_VERIFIED":
        return "Your email is already verified. Please sign in.";
      case "INVALID_CREDENTIALS":
        return "Invalid email/phone number or password.";
      case "NOT_VERIFIED":
        return "Your email is not verified yet. Please verify your email to continue.";
      case "INVALID_CODE":
        return "Invalid verification code.";
      case "EXPIRED_CODE":
        return "Verification code expired or invalid. Please request a new code.";
      case "USER_NOT_FOUND":
        return "User not found.";
      case "ACCOUNT_EXISTS":
        return "An account already exists with this information.";
      case "RATE_LIMIT_EXCEEDED":
        return "Too many requests. Please wait a moment and try again.";
      case "NETWORK_ERROR":
        return "Network error. Please check your connection and try again.";

      /* Boards, collaboration, and workspaces. */
      case "BOARD_NOT_FOUND":
        return "That board no longer exists, or you no longer have access to it.";
      case "COLLABORATOR_NOT_FOUND":
        return "That person is no longer a collaborator on this board.";
      case "COLLABORATOR_EXISTS":
        return "That person is already a collaborator on this board.";
      case "CANNOT_INVITE_SELF":
        return "You cannot invite yourself to a board you already own.";
      case "CANNOT_MODIFY_OWNER":
        return "The board owner's access cannot be changed.";
      case "REVISION_CONFLICT":
        return "Someone else changed this board while you were editing. Reload to see their changes.";
      case "WORKSPACE_NOT_FOUND":
        return "That workspace no longer exists.";
      case "WORKSPACE_MEMBER_EXISTS":
        return "That person is already a member of this workspace.";
      case "QUOTA_EXCEEDED":
        return "Storage quota reached. Delete some files and try again.";
      case "UNSUPPORTED_MEDIA_TYPE":
        return "That file type is not supported.";
      case "FILE_TOO_LARGE":
        return "That file is too large to upload.";
      case "VALIDATION_ERROR":
        return "Please check the details you entered and try again.";
      default:
        break;
    }

    const duplicateKeyMessage = getDuplicateKeyFriendlyMessage(error.message);
    if (duplicateKeyMessage) return duplicateKeyMessage;

    if (error.message.includes("at least 8 character")) {
      return "Password must be at least 8 characters.";
    }

    if (error.message.includes("uppercase letter")) {
      return "Password must contain at least one uppercase letter.";
    }

    if (error.message.includes("lowercase letter")) {
      return "Password must contain at least one lowercase letter.";
    }

    if (error.message.includes("at least one digit")) {
      return "Password must contain at least one digit.";
    }

    if (error.message.includes("special character")) {
      return "Password must contain at least one special character.";
    }

    if (error.message.toLowerCase().includes("invalid email")) {
      return "Please enter a valid email address.";
    }

    return fallback;
  }

  if (hasStringMessage(error)) {
    const msg = error.message;

    const duplicateKeyMessage = getDuplicateKeyFriendlyMessage(msg);
    if (duplicateKeyMessage) return duplicateKeyMessage;

    if (msg.includes("at least 8 character")) {
      return "Password must be at least 8 characters.";
    }

    if (msg.includes("uppercase letter")) {
      return "Password must contain at least one uppercase letter.";
    }

    if (msg.includes("lowercase letter")) {
      return "Password must contain at least one lowercase letter.";
    }

    if (msg.includes("at least one digit")) {
      return "Password must contain at least one digit.";
    }

    if (msg.includes("special character")) {
      return "Password must contain at least one special character.";
    }

    return fallback;
  }

  return fallback;
}
