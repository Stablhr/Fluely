'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DEFAULT_PREFERENCES,
  getMyProfile,
  updateMyProfile,
  type AccountPreferences,
  type AccountPreferencesPatch,
  type MyProfile,
} from '@/lib/api/profileApi'
import { getFriendlyErrorMessage } from '@/lib/api/getFriendlyErrorMessage'
import { useToast } from '@/components/kali/shared/useToastState'

function merge(base: AccountPreferences, patch: AccountPreferencesPatch): AccountPreferences {
  return {
    defaultBoardVisibility: patch.defaultBoardVisibility ?? base.defaultBoardVisibility,
    notifications: {
      inApp: { ...base.notifications.inApp, ...patch.notifications?.inApp },
      email: { ...base.notifications.email, ...patch.notifications?.email },
    },
  }
}

/**
 * Account-level preferences (saved on the server, so they follow the person
 * across devices). Each change saves immediately and is applied optimistically;
 * a failed save rolls back and says so.
 */
export function usePreferences() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: profile, isLoading } = useQuery({
    queryKey: ['myProfile'],
    queryFn: getMyProfile,
    staleTime: 30_000,
  })

  const preferences = profile?.preferences
    ? merge(DEFAULT_PREFERENCES, profile.preferences)
    : DEFAULT_PREFERENCES

  const mutation = useMutation({
    mutationFn: (patch: AccountPreferencesPatch) => updateMyProfile({ preferences: patch }),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: ['myProfile'] })
      const previous = queryClient.getQueryData<MyProfile>(['myProfile'])
      if (previous) {
        queryClient.setQueryData<MyProfile>(['myProfile'], {
          ...previous,
          preferences: merge(previous.preferences ?? DEFAULT_PREFERENCES, patch),
        })
      }
      return { previous }
    },
    onError: (err, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(['myProfile'], context.previous)
      toast(getFriendlyErrorMessage(err, 'Could not save that setting.'), 'error')
    },
    onSuccess: () => toast('Saved', 'success'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['myProfile'] }),
  })

  return {
    preferences,
    isLoading,
    isSaving: mutation.isPending,
    update: (patch: AccountPreferencesPatch) => mutation.mutate(patch),
  }
}
