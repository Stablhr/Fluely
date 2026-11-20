'use client'

import { useEffect } from 'react'
import { REMINDER_DUE_EVENT, type ReminderDueEventDetail } from '@/lib/kali/api/social-posts'
import { useStore } from '@/lib/kali/store/useStore'
import { useToast } from '../shared/useToastState'
import { MANUAL_POST_URL, platformLabel, postTextFor } from '../content-planner/planner-model'

/**
 * "Your turn to post": when a post's time comes for a reminder account (e.g.
 * a personal Facebook profile, which apps cannot post to), say so wherever
 * you are in the app, and offer to copy the caption and open the platform.
 * Also shows a desktop notification when the browser allows it.
 *
 * Reminders surface while Fluely is open; otherwise the post waits with a
 * "Your turn to post" badge for the next visit.
 */
export default function SocialReminderListener() {
  const { toast } = useToast()
  const { socialPosts } = useStore()

  useEffect(() => {
    const onDue = (event: Event) => {
      const { postId, title, caption, platforms } = (event as CustomEvent<ReminderDueEventDetail>).detail
      const platform = platforms[0]
      if (!platform) return
      const where = platforms.map(platformLabel).join(' and ')
      const name = title?.trim() ? `“${title.trim()}”` : 'your post'
      const post = socialPosts.find((p) => p.id === postId)
      const text = post ? postTextFor(post, platform) : caption

      const copyAndOpen = () => {
        void navigator.clipboard?.writeText(text).catch(() => {})
        window.open(MANUAL_POST_URL[platform], '_blank', 'noopener')
      }

      toast(`Time to post ${name} on ${where}. Copy the caption, post it, then mark it as posted.`, 'info', {
        duration: 15000,
        action: { label: 'Copy caption & open', onClick: copyAndOpen },
      })

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const note = new Notification(`Time to post ${name}`, {
          body: `On ${where}. Your caption is ready to copy in Fluely.`,
          tag: `fluely-reminder-${postId}`,
        })
        note.onclick = () => {
          window.focus()
          note.close()
        }
      }
    }
    window.addEventListener(REMINDER_DUE_EVENT, onDue)
    return () => window.removeEventListener(REMINDER_DUE_EVENT, onDue)
  }, [toast, socialPosts])

  return null
}
