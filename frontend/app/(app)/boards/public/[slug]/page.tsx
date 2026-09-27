"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Eye, Loader2, TriangleAlert } from "lucide-react";
import { fetchPublicBoard, type BoardDto } from "@/lib/kali/api/boards";
import { getFriendlyErrorMessage } from "@/lib/api/getFriendlyErrorMessage";
import { getDisplayName } from "@/lib/api/authApi";
import { useMeQuery } from "@/lib/hooks/auth/useMeQuery";

/**
 * Read-only view of a board opened from a public link.
 *
 * Two rules the API enforces and this page has to respect: the viewer must be
 * signed in (an anonymous visitor is bounced to sign-in rather than shown the
 * board), and the board is read-only no matter what the viewer would otherwise
 * be allowed to do.
 *
 * Deliberately does not reuse `BoardView`. That component is built around the
 * full editor, and presenting every edit affordance in a view that rejects them
 * would be worse than a plainer read-only surface.
 */
export default function PublicBoardPage() {
  const { boardPublicSlug } = useParams<{ boardPublicSlug: string }>();
  const router = useRouter();
  const { data: me } = useMeQuery();

  const [board, setBoard] = useState<BoardDto | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!boardPublicSlug) return;
    let cancelled = false;

    // Every state update happens after an await, inside this function, rather
    // than in the effect body — a setState during the body itself forces a
    // second render pass for something the next one would overwrite anyway.
    async function load() {
      try {
        const dto = await fetchPublicBoard(boardPublicSlug);
        if (!cancelled) setBoard(dto);
      } catch (err) {
        if (!cancelled) {
          setError(
            getFriendlyErrorMessage(
              err,
              "This board is not available. It may be private, or the link may have expired.",
            ),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [boardPublicSlug]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-text-secondary">
        <Loader2 size={16} className="animate-spin" /> Loading board…
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <TriangleAlert size={22} className="text-warning-text" />
        <p className="text-sm text-text-secondary">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/boards")}
          className="mt-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover"
        >
          Go to your boards
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="border-b border-border bg-surface px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Eye size={18} className="shrink-0 text-text-secondary" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-semibold text-text-primary">
              {board.name}
            </h1>
            {board.description && (
              <p className="truncate text-sm text-text-secondary">
                {board.description}
              </p>
            )}
          </div>
          {/* Stating why nothing here is editable is better than letting someone
              discover it by trying. */}
          <span className="shrink-0 rounded-full bg-surface-alt px-2.5 py-1 text-xs font-medium text-text-secondary">
            View only
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-5">
        {board.labels && board.labels.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-1.5">
            {board.labels.map((label) => (
              <span
                key={label.id}
                className="rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ background: `${label.color}22`, color: label.color }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}

        {board.listOrder.length === 0 ? (
          <p className="py-10 text-center text-sm text-text-secondary">
            This board has no lists yet.
          </p>
        ) : (
          /* Lists and cards are not served by the API yet, so there is nothing
             to render between the header and the labels. This page becomes
             useful once the child resources land. */
          <p className="py-10 text-center text-sm text-text-secondary">
            Board contents are not available in this view yet.
          </p>
        )}

        <p className="mt-6 text-center text-xs text-text-secondary">
          Signed in as {getDisplayName(me?.user)}
        </p>
      </div>
    </div>
  );
}
