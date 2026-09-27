"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  UserPlus,
  Check,
  Loader2,
  Trash2,
  ChevronDown,
  Clock,
  ShieldCheck,
} from "lucide-react";
import type {
  Board,
  Collaborator,
  CollaboratorRole,
} from "@/lib/kali/store/schema";
import { useStore } from "@/lib/kali/store/useStore";
import Modal from "../shared/Modal";
import Avatar from "../shared/Avatar";

const ROLE_OPTIONS: CollaboratorRole[] = ["editor", "viewer"];

const ROLE_LABELS: Record<CollaboratorRole, string> = {
  editor: "Can edit",
  viewer: "Can view",
};

const ROLE_DESCRIPTIONS: Record<CollaboratorRole, string> = {
  editor: "Can add and change cards, lists, and board content.",
  viewer: "View only — cannot make changes.",
};

/** Deterministic chip colour from the person, so avatars stay stable. */
function colorFor(seed: string): string {
  const palette = [
    "#3971B8",
    "#0DABA3",
    "#8B7CF6",
    "#E1306C",
    "#33B27A",
    "#D98A2B",
  ];
  let total = 0;
  for (let i = 0; i < seed.length; i += 1) total += seed.charCodeAt(i);
  return palette[total % palette.length];
}

export default function ShareModal({
  board,
  onClose,
}: {
  board: Board;
  onClose: () => void;
}) {
  const {
    inviteCollaborator,
    setCollaboratorRole,
    removeCollaborator,
    loadCollaborators,
    getCollaborators,
    canManage,
    pendingBoardId,
    currentUserId,
  } = useStore();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CollaboratorRole>("viewer");
  const [openRoleId, setOpenRoleId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [inviteDone, setInviteDone] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const mayManage = canManage(board.id);
  const isSaving = pendingBoardId === board.id;

  const collaborators: Collaborator[] = getCollaborators(board.id);
  // An accepted row is a real grant; a pending one is only an unanswered
  // invitation and belongs in the other tab.
  const accepted = collaborators.filter((c) => c.status === "accepted");
  const pending = collaborators.filter((c) => c.status === "pending");

  // Read through the prop as well as the store, so a board whose rows have just
  // arrived still renders them without waiting for the parent to re-render.
  useEffect(() => {
    void loadCollaborators(board.id);
  }, [board.id, loadCollaborators]);

  useEffect(() => {
    if (!openRoleId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setOpenRoleId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openRoleId]);

  const invite = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setErrorMsg("Enter an email address.");
      return;
    }
    // Cheap guard only — the server is what actually rejects an unknown or
    // already-invited address.
    if (
      collaborators.some(
        (c) => c.status !== "declined" && c.email.toLowerCase() === trimmed,
      )
    ) {
      setErrorMsg("That person is already on this board.");
      return;
    }

    setErrorMsg("");
    try {
      await inviteCollaborator(board.id, trimmed, role);
      setEmail("");
      setInviteDone(true);
      window.setTimeout(() => setInviteDone(false), 2500);
    } catch {
      // The store has already surfaced the reason; leave the typed address in
      // place so it can be corrected rather than retyped.
      setErrorMsg("That invitation could not be sent.");
    }
  };

  const inputClass =
    "rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-text-primary outline-none transition-colors duration-150 placeholder:text-text-muted focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-55";

  return (
    <Modal open onClose={onClose} className="max-w-lg !h-auto !max-h-[85dvh]">
      <div className="flex max-h-[85dvh] flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-text-primary">
            Share board
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share board"
            className="rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="scroll-slim flex-1 overflow-y-auto">
          {/* ── Invite ── */}
          {mayManage ? (
            <div className="px-5 pt-4 pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                <div className="flex-1">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMsg) setErrorMsg("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && void invite()}
                    placeholder="Email address"
                    aria-label="Email address"
                    className={`w-full ${inputClass}`}
                  />
                  {errorMsg && (
                    <p className="mt-1.5 text-xs text-danger-text">
                      {errorMsg}
                    </p>
                  )}
                  {inviteDone && !errorMsg && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
                      <Check size={13} /> Invitation sent
                    </p>
                  )}
                </div>
                <div className="flex gap-2 sm:block">
                  <select
                    value={role}
                    onChange={(e) =>
                      setRole(e.target.value as CollaboratorRole)
                    }
                    aria-label="Access level"
                    className={`${inputClass} min-w-[110px]`}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void invite()}
                    disabled={!email.trim() || isSaving}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40 sm:h-[38px]"
                  >
                    {isSaving ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <UserPlus size={15} />
                    )}
                    Invite
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p className="mx-5 mt-4 flex items-start gap-2 rounded-lg bg-surface-alt px-3 py-2.5 text-xs leading-relaxed text-text-secondary">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" />
              <span>Only the owner of this board can invite people to it.</span>
            </p>
          )}

          {/* ── People ── */}
          <div className="px-5 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
              People with access ({accepted.length})
            </p>

            {/* The owner is not a collaborator row, but is very much someone with
                access, so they are listed from the board itself. */}
            <div className="mb-1 flex items-center gap-3 rounded-lg px-2 py-2">
              <Avatar
                member={{
                  id: "owner",
                  name: "You (owner)",
                  color: colorFor("owner"),
                }}
                size={34}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-text-primary">
                  You{" "}
                  <span className="ml-1 text-xs text-text-secondary">
                    (owner)
                  </span>
                </p>
                <p className="text-xs text-text-secondary">Full control</p>
              </div>
            </div>

            {accepted.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-secondary">
                {mayManage
                  ? "No one else has access yet."
                  : "No one else has been given access."}
              </p>
            ) : (
              <div className="space-y-1">
                {accepted.map((person) => {
                  const isYou = person.userId === currentUserId;
                  return (
                    <div
                      key={person.id}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-surface-alt"
                    >
                      <Avatar
                        member={{
                          id: person.id,
                          name: person.name,
                          color: colorFor(person.userId),
                        }}
                        size={34}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text-primary">
                          {person.name}
                          {isYou && (
                            <span className="ml-1 text-xs text-text-secondary">
                              (you)
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-text-secondary">
                          {person.email}
                        </p>
                      </div>

                      {mayManage ? (
                        <div
                          className="relative shrink-0"
                          ref={openRoleId === person.id ? menuRef : undefined}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setOpenRoleId(
                                openRoleId === person.id ? null : person.id,
                              )
                            }
                            aria-expanded={openRoleId === person.id}
                            aria-label={`Access level for ${person.name}`}
                            className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-150 hover:bg-surface-alt hover:text-text-primary"
                          >
                            {ROLE_LABELS[person.role]}
                            <ChevronDown size={13} />
                          </button>
                          {openRoleId === person.id && (
                            <div className="animate-in absolute right-0 top-full z-30 mt-1 w-40 rounded-lg border border-border-strong bg-surface-elevated p-1 shadow-subtle">
                              {ROLE_OPTIONS.map((r) => (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => {
                                    setOpenRoleId(null);
                                    void setCollaboratorRole(
                                      board.id,
                                      person.id,
                                      r,
                                    );
                                  }}
                                  className={`flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-colors duration-150 ${
                                    person.role === r
                                      ? "bg-primary-subtle font-semibold text-primary-hover"
                                      : "text-text-primary hover:bg-surface-alt"
                                  }`}
                                >
                                  {ROLE_LABELS[r]}
                                  <span className="text-[11px] font-normal text-text-secondary">
                                    {ROLE_DESCRIPTIONS[r]}
                                  </span>
                                </button>
                              ))}
                              <div className="my-1 border-t border-border" />
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenRoleId(null);
                                  void removeCollaborator(board.id, person.id);
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-danger-text transition-colors duration-150 hover:bg-danger-subtle"
                              >
                                <Trash2 size={13} />
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="shrink-0 text-xs text-text-secondary">
                          {ROLE_LABELS[person.role]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {pending.length > 0 && (
              <>
                <p className="mb-2 mt-5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-secondary">
                  <Clock size={12} /> Waiting on them ({pending.length})
                </p>
                <div className="space-y-1">
                  {pending.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center gap-3 rounded-lg px-2 py-2"
                    >
                      <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-surface-alt text-xs font-semibold text-text-secondary ring-1 ring-border">
                        {person.name.charAt(0).toUpperCase() || "?"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-text-primary">
                          {person.name}
                        </p>
                        <p className="truncate text-xs text-text-secondary">
                          Invited as {ROLE_LABELS[person.role].toLowerCase()}
                        </p>
                      </div>
                      {mayManage && (
                        <button
                          type="button"
                          onClick={() =>
                            void removeCollaborator(board.id, person.id)
                          }
                          aria-label={`Cancel invitation for ${person.name}`}
                          className="shrink-0 rounded-md p-1.5 text-text-secondary transition-colors duration-150 hover:bg-danger-subtle hover:text-danger-text"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="border-t border-border px-5 py-3">
          <p className="text-xs leading-relaxed text-text-secondary">
            {ROLE_DESCRIPTIONS[role]}
          </p>
        </div>
      </div>
    </Modal>
  );
}
