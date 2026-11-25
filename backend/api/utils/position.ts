/**
 * Fractional card ordering.
 *
 * A card's place in its list is a float. Moving a card is one row update --
 * `listId` plus the new value -- so two people moving different cards never
 * write the same document, which is what made the old "rewrite the whole
 * `cardOrder` array" move race: the last array write won and the earlier move
 * silently reverted.
 *
 * The value is the midpoint of the two cards it now sits between, so a list
 * only needs re-spacing when a gap is exhausted rather than on every drag.
 * Re-spacing (see `card.service`) is a separate, rare full-list write.
 */

/** Distance between two cards when a list is first laid out or re-spaced. */
export const POSITION_GAP = 1024;

/**
 * Smallest gap worth halving. Below this the neighbours are re-spaced instead,
 * because a float midpoint of two nearly-equal values is numerically noisy.
 */
export const MIN_POSITION_GAP = 1e-9;

/** Position for a card going to the very top of its list. */
export function positionBefore(after: number | null | undefined): number {
  return (after ?? 0) - POSITION_GAP;
}

/** Position for a card going to the very bottom of its list. */
export function positionAfter(before: number | null | undefined): number {
  return (before ?? -POSITION_GAP) + POSITION_GAP;
}

/**
 * Position for a card appended to the end of a list.
 *
 * `last` is the position of the card currently last in the list, or
 * null/undefined when the list is empty. An empty list starts at
 * `POSITION_GAP`, so the first card of a fresh list sits where the next
 * one would follow rather than below the implicit zero.
 */
export function positionAtEnd(last: number | null | undefined): number {
  return last === null || last === undefined ? POSITION_GAP : last + POSITION_GAP;
}

/** Position between two neighbours, or at either end of the list. */
export function positionBetween(
  before: number | null | undefined,
  after: number | null | undefined
): number {
  if (before === undefined || before === null) return positionBefore(after);
  if (after === undefined || after === null) return positionAfter(before);
  return (before + after) / 2;
}

/** True when two neighbours are too close to place a card between them. */
export function needsRespace(
  before: number | null | undefined,
  after: number | null | undefined
): boolean {
  if (before === undefined || before === null) return false;
  if (after === undefined || after === null) return false;
  return after - before < MIN_POSITION_GAP;
}
