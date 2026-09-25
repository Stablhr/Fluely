function getCaptions(): Record<string, string[]> {
  return {
    'product launch': [
      "Excited to announce our latest feature! Stay tuned for more details. #launch #newfeature",
      "It's here! We've been working hard on this and can't wait for you to try it. #launch #innovation",
      "Big news! Our newest update is live. Check it out and let us know what you think! #productlaunch",
    ],
    tutorial: [
      "Here's how to get started with our latest feature. Step by step guide inside! #tutorial #howto",
      "Quick tip: Here's everything you need to know about this topic. Save this for later! #tips #guide",
      "Pro tip thread: Master this skill in 5 easy steps. Follow along! #learning #protips",
    ],
    'behind-the-scenes': [
      "Behind the scenes of how we built this feature. The team worked tirelessly! #bts #teamwork",
      "A peek behind the curtain. Here's what goes into making magic happen. #bts #startup",
      "From idea to reality — the journey of our latest project. #bts #journey #building",
    ],
    engagement: [
      "What's your favorite feature? Drop a comment below! #community #feedback",
      "This or that? Tell us your preference in the comments! #poll #community",
      "Tag someone who needs to see this! #share #tagafriend",
    ],
    announcement: [
      "We have some exciting news to share with you all! #announcement #news",
      "Important update: Here's what's changing and why it matters to you. #update #announcement",
      "Mark your calendars! Something special is coming your way. #comingsoon #staytuned",
    ],
    default: [
      "Check out our latest update! We're always improving to serve you better. #update #improvement",
      "New post! Don't forget to like and share if you find this useful. #content #social",
      "Here's something we've been working on. Let us know your thoughts! #feedback #community",
      "Quality content alert! Save this post for later reference. #savethis #valuable",
    ],
  }
}

function detectCategory(prompt: string): string {
  const lower = prompt.toLowerCase()
  if (lower.includes('launch') || lower.includes('release') || lower.includes('product')) return 'product launch'
  if (lower.includes('tutorial') || lower.includes('how to') || lower.includes('guide') || lower.includes('tips')) return 'tutorial'
  if (lower.includes('behind') || lower.includes('bts') || lower.includes('team')) return 'behind-the-scenes'
  if (lower.includes('engage') || lower.includes('comment') || lower.includes('poll') || lower.includes('tag')) return 'engagement'
  if (lower.includes('announce') || lower.includes('news') || lower.includes('update')) return 'announcement'
  return 'default'
}

export interface AIGenerateResult {
  caption: string
  model: string
  tokensUsed: number
  generatedAt: string
}

export function generateMockCaption(prompt: string): AIGenerateResult {
  const captions = getCaptions()
  const category = detectCategory(prompt)
  const pool = captions[category] ?? captions.default
  const caption = pool[Math.floor(Math.random() * pool.length)]

  return {
    caption,
    model: 'mock-local',
    tokensUsed: 0,
    generatedAt: new Date().toISOString(),
  }
}

export const MOCK_MODELS = ['mock-local'] as const

const MOCK_TOKEN_USAGE_KEY = 'kali-ai-tokens'
export const MOCK_MONTHLY_TOKEN_LIMIT = 100000

export function getTokenUsage(): number {
  try {
    const raw = localStorage.getItem(MOCK_TOKEN_USAGE_KEY)
    return raw ? Number(raw) : 0
  } catch {
    return 0
  }
}
