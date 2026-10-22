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

/** Ordered positions for a list of ids, used by the explicit reorder paths. */
export function spacedPositions(count: number): number[] {
  return Array.from({length: count}, (_, index) => index * POSITION_GAP);
}

type OrderableCard = {
  _id: {toString(): string};
  position?: number | null;
  createdAt?: Date;
};

/**
 * The order a list's cards should render in.
 *
 * Positioned cards sort by value; a card with no position (pre-migration) keeps
 * its place from the stored `cardOrder` array, which is still the authority for
 * lists that have never been written since. That fallback is what lets the
 * field land without a blocking migration.
 */
export function sortCardsByPosition<T extends OrderableCard>(
  cards: T[],
  fallbackOrder: {_id: {toString(): string}}[] = []
): T[] {
  if (cards.every(card => typeof card.position === 'number')) {
    return [...cards].sort((left, right) => {
      const gap = (left.position as number) - (right.position as number);
      if (gap !== 0) return gap;
      return compareCreatedAt(left.createdAt, right.createdAt);
    });
  }

  const index = new Map(fallbackOrder.map((card, position) => [card._id.toString(), position]));
  return [...cards].sort((left, right) => {
    const leftRank = index.get(left._id.toString());
    const rightRank = index.get(right._id.toString());
    if (leftRank !== undefined && rightRank !== undefined) return leftRank - rightRank;
    if (leftRank !== undefined) return -1;
    if (rightRank !== undefined) return 1;
    return compareCreatedAt(left.createdAt, right.createdAt);
  });
}

function compareCreatedAt(left?: Date, right?: Date): number {
  return new Date(left ?? 0).getTime() - new Date(right ?? 0).getTime();
}
