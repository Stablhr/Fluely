"use client";

import { useState } from "react";
import {
  X,
  Check,
  Link2,
  Copy,
  Loader2,
  Info,
  TriangleAlert,
} from "lucide-react";
import type { Board, Visibility } from "@/lib/kali/store/schema";
import { useStore } from "@/lib/kali/store/useStore";
import Modal from "../shared/Modal";

const OPTIONS: { value: Visibility; label: string; description: string }[] = [
  {
    value: "private",
    label: "Private",
    description: "Only you can view this board.",
  },
  {
    value: "workspace",
    label: "Workspace",
    description: "Visible to members of your local workspace.",
  },
  {
    value: "public",
    label: "Public",
    description: "Anyone with the link can view this board.",
  },
];

export default function VisibilityModal({
  board,
  onClose,
}: {
  board: Board;
  onClose: () => void;
}) {
  const { setBoardVisibility, canManage, pendingBoardId } = useStore();

  const [copied, setCopied] = useState(false);
  // Kept separate from the store's global error so the message sits with the
  // control that caused it and clears when the modal closes.
  const [localError, setLocalError] = useState("");

  const mayManage = canManage(board.id);
  const isSaving = pendingBoardId === board.id;
  const isPublic = board.visibility === "public";

  // The server mints the slug, so a link is only real once it is public.
  const shareUrl = board.publicSlug
    ? `${typeof window === "undefined" ? "" : window.location.origin}/boards/public/${board.publicSlug}`
    : null;

  const choose = async (visibility: Visibility) => {
    if (isSaving || visibility === board.visibility) return;
    setLocalError("");
    try {
      await setBoardVisibility(board.id, visibility);
    } catch {
      setLocalError("That change did not save. Please try again.");
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setLocalError(
        "Could not copy to your clipboard. Copy the link manually.",
      );
    }
  };

  return (
    <Modal open onClose={onClose} className="max-w-md">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[17px] font-semibold text-text-primary">
              Board visibility
            </h2>
            <p className="mt-0.5 text-sm text-text-secondary">{board.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close visibility"
            className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        {!mayManage && (
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-surface-alt px-3 py-2.5 text-xs leading-relaxed text-text-secondary">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>
              You can view this board, but only its owner can change who else
              can.
            </span>
          </p>
        )}

        <div className="mt-5 space-y-2">
          {OPTIONS.map((option) => {
            const active = board.visibility === option.value;
            // "Workspace" is meaningless for a board that is not in one, so it is
            // offered but disabled rather than failing on submit.
            const unavailable =
              option.value === "workspace" && !board.workspaceId;
            const disabled = !mayManage || isSaving || unavailable;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => void choose(option.value)}
                disabled={disabled}
                aria-pressed={active}
                className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-3 text-left ring-1 transition-colors duration-150 ${
                  active
                    ? "bg-primary-subtle ring-primary"
                    : "ring-border-strong hover:bg-surface-alt"
                } disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:bg-transparent`}
              >
                <span className="flex-1">
                  <span
                    className={`block text-sm font-semibold ${
                      active ? "text-primary-hover" : "text-text-primary"
                    }`}
                  >
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-text-secondary">
                    {unavailable
                      ? "This board is not in a workspace yet."
                      : option.description}
                  </span>
                </span>
                {isSaving && pendingBoardId === board.id ? (
                  <Loader2
                    size={16}
                    className="shrink-0 animate-spin text-primary-hover"
                  />
                ) : (
                  active && (
                    <Check size={16} className="shrink-0 text-primary-hover" />
                  )
                )}
              </button>
            );
          })}
        </div>

        {/* The link only exists while the board is public, so this block is the
            consequence of the choice above rather than a separate toggle. */}
        {isPublic && (
          <div className="mt-4 rounded-lg border border-border bg-surface-alt p-3">
            <p className="flex items-center gap-2 text-xs font-medium text-text-primary">
              <Link2 size={13} className="text-text-secondary" />
              Anyone signed in with this link can view
            </p>
            {shareUrl ? (
              <div className="mt-2 flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate rounded-md border border-border bg-surface px-2.5 py-1.5 font-mono text-xs text-text-secondary">
                  {shareUrl}
                </span>
                <button
                  type="button"
                  onClick={copyLink}
                  className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-text-primary transition-colors duration-150 hover:bg-surface-alt"
                >
                  {copied ? (
                    <>
                      <Check size={13} className="text-success" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      Copy
                    </>
                  )}
                </button>
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-text-secondary">
                Preparing your link…
              </p>
            )}
          </div>
        )}

        {localError && (
          <p className="mt-3 flex items-start gap-2 text-xs text-danger-text">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            <span>{localError}</span>
          </p>
        )}
      </div>
    </Modal>
  );
}
