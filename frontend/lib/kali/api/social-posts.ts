import { api } from './client'
import type { SocialPost, Platform, PublishingJob } from '@/lib/kali/store/schema'

export interface SchedulingValidation {
  platform: Platform
  valid: boolean
  errors: string[]
}

export interface ScheduleResult {
  post: SocialPost
  scheduledAt: string
  timezone: string
  jobsCreated: string[]
  jobsSkipped: string[]
  validation: SchedulingValidation[]
}

export interface CancelResult {
  post: SocialPost
}

export interface RetryResult {
  post: SocialPost
  retried: Platform[]
  jobsCreated: string[]
  jobsSkipped: string[]
}

export const socialPostsApi = {
  list: (params?: { status?: string; platform?: string; date?: string }) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    return api.get<SocialPost[]>(`/social-posts${query}`)
  },
  get: (id: string) => api.get<SocialPost>(`/social-posts/${id}`),
  create: (post: Omit<SocialPost, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<SocialPost>('/social-posts', post),
  update: (id: string, patch: Partial<SocialPost>) =>
    api.put<SocialPost>(`/social-posts/${id}`, patch),
  delete: (id: string) => api.delete(`/social-posts/${id}`),
  schedule: (id: string, input: { scheduledDate: string; scheduledTime?: string; timezone?: string; repeat?: string; repeatUntil?: string }) =>
    api.post<ScheduleResult>(`/social-posts/${id}/schedule`, input),
  cancel: (id: string, input?: { platform?: Platform }) =>
    api.post<CancelResult>(`/social-posts/${id}/cancel`, input ?? {}),
  retry: (id: string, input?: { platform?: Platform }) =>
    api.post<RetryResult>(`/social-posts/${id}/retry`, input ?? {}),
}

export const publishingJobsApi = {
  list: (params?: { socialPostId?: string; status?: string }) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : ''
    return api.get<PublishingJob[]>(`/publishing-jobs${query}`)
  },
}

