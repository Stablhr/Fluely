const STORAGE_KEY = 'kali_user_comment_reactions'

type ReactionMap = Record<string, Record<string, string[]>>

function load(): ReactionMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function save(map: ReactionMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    // quota exceeded — best effort
  }
}

export function hasUserCommentReaction(
  cardId: string,
  commentId: string,
  emoji: string,
): boolean {
  const map = load()
  return map[cardId]?.[commentId]?.includes(emoji) ?? false
}

export function toggleUserCommentReaction(
  cardId: string,
  commentId: string,
  emoji: string,
): boolean {
  const map = load()
  if (!map[cardId]) map[cardId] = {}
  if (!map[cardId][commentId]) map[cardId][commentId] = []

  const list = map[cardId][commentId]
  const idx = list.indexOf(emoji)
  let added: boolean

  if (idx === -1) {
    list.push(emoji)
    added = true
  } else {
    list.splice(idx, 1)
    added = false
  }

  save(map)
  return added
}
