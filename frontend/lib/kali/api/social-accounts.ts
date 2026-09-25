import { api } from './client'

export interface SocialAccount {
  _id: string
  platform: string
  platformAccountId: string
  accountName: string
  accountUsername?: string
  profileImageUrl?: string
  status: string
  scopes?: string[]
  createdAt: string
  updatedAt: string
}

export const socialAccountsApi = {
  list: () => api.get<SocialAccount[]>('/social-accounts'),
  get: (id: string) => api.get<SocialAccount>(`/social-accounts/${id}`),
  create: (account: {
    platform: string
    platformAccountId: string
    accountName: string
    accountUsername?: string
    profileImageUrl?: string
    accessToken: string
    refreshToken?: string
    tokenExpiresAt?: string
    scopes?: string[]
  }) => api.post<SocialAccount>('/social-accounts', account),
  delete: (id: string) => api.delete(`/social-accounts/${id}`),
}
