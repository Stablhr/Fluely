/**
 * App-wide "grabbing" cursor for the duration of a drag.
 *
 * The drag-and-drop library lifts the item with `pointer-events: none` and sets
 * `cursor: grabbing` on `<body>`, expecting the pointer to fall through to it.
 * That single-element rule loses to any utility underneath the pointer -- board
 * cards carry `cursor-pointer` and buttons `cursor: pointer` -- so dragging a
 * card over another showed a pointer instead of the grab hand. Toggling a body
 * class lets `app/kali.css` win with a scoped, higher-specificity rule.
 */
const DRAGGING_CLASS = "kali-dragging";

export function beginDragCursor(): void {
  if (typeof document === "undefined") return;
  document.body.classList.add(DRAGGING_CLASS);
}

export function endDragCursor(): void {
  if (typeof document === "undefined") return;
  document.body.classList.remove(DRAGGING_CLASS);
}
