import { httpClient } from '@/lib/api/httpClient'
import type { Platform } from '@/lib/kali/store/schema'

/**
 * Connected social accounts, shared per workspace. Tokens never reach the
 * browser; connecting is a redirect through the platform's own sign-in.
 */

export interface SocialAccount {
  _id: string
  id: string
  platform: Platform
  platformAccountId: string
  accountType: string
  accountName: string
  accountUsername?: string
  profileImageUrl?: string
  status: 'active' | 'expired' | 'revoked' | 'error'
  scopes?: string[]
  /** Created without a real sign-in because the platform has no app keys yet. */
  demo: boolean
  lastError?: string
  tokenExpiresAt?: string
  connectedBy: string
  createdAt: string
  updatedAt: string
}

/** No sign-in, no API: at the post's time you're reminded to post it yourself. */
export const isReminderAccount = (account: Pick<SocialAccount, 'accountType'>) => account.accountType === 'reminder'

export interface PlatformSummary {
  platform: Platform
  label: string
  /** `dryrun` until the platform approves the app; `disabled` hides it. */
  mode: 'live' | 'dryrun' | 'disabled'
  /** Whether the app keys for this platform are set on the server. */
  configured: boolean
}

export type ConnectReturn = 'planner' | 'settings'

export type ConnectResult =
  | { demo: true; account: SocialAccount }
  | { demo: false; url: string }

export const socialAccountsApi = {
  platforms: async () => {
    const { data } = await httpClient.get<{ platforms: PlatformSummary[] }>('/social-accounts/platforms')
    return data.platforms
  },
  list: async () => {
    const { data } = await httpClient.get<{ accounts: SocialAccount[] }>('/social-accounts')
    return data.accounts
  },
  /** `returnTo` picks where the platform's sign-in sends the browser back to. */
  connect: async (platform: Platform, returnTo: ConnectReturn = 'planner', options: { demo?: boolean } = {}) => {
    const { data } = await httpClient.post<ConnectResult>(`/social-accounts/connect/${platform}`, {
      returnTo,
      demo: options.demo === true,
    })
    return data
  },
  /** A reminder account (e.g. "My personal profile"): you post by hand when it's time. */
  addReminder: async (platform: Platform, name: string) => {
    const { data } = await httpClient.post<{ account: SocialAccount }>(`/social-accounts/reminder/${platform}`, { name })
    return data.account
  },
  delete: async (id: string) => {
    await httpClient.delete(`/social-accounts/${id}`)
  },
}
