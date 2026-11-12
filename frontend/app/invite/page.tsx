'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMeQuery } from '@/lib/hooks/auth/useMeQuery'
import { getDashboardPath } from '@/lib/auth/redirects'
import { httpClient } from '@/lib/api/httpClient'
import { getFriendlyErrorMessage } from '@/lib/api/getFriendlyErrorMessage'
import type { NormalizedApiError } from '@/lib/api/types'
import { Button } from '@/components/ui/button'

interface InviteDetails {
  id: string
  boardId: string
  boardName: string
  role: string
  inviterName: string
  inviteeEmail: string
  expiresAt: string | null
}

/**
 * `httpClient` rejects with an already-normalized error (`{status, code,
 * message}`), not a raw Axios error, so read those fields directly.
 */
function apiErrorOf(err: unknown): Partial<NormalizedApiError> {
  return err && typeof err === 'object' ? (err as Partial<NormalizedApiError>) : {}
}

export default function InvitePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const { data, isLoading, isSuccess } = useMeQuery()

  const [details, setDetails] = useState<InviteDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [answering, setAnswering] = useState(false)
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null)

  // Redirect logged-in users' dashboard path only if no token.
  useEffect(() => {
    if (isSuccess && data?.user?.type && data.user.type !== 'user') {
      router.replace(getDashboardPath(data.user.type))
    }
  }, [data, isSuccess, router])

  useEffect(() => {
    // A missing token is derived at render time (see `shownError`), not set here.
    if (!token) return
    if (isLoading) return
    if (!isSuccess) {
      // Not signed in: send to sign-in, preserving the token.
      router.replace(`/sign-in?redirect=${encodeURIComponent(`/invite?token=${token}`)}`)
      return
    }
    // `loading` starts true and `error` null, and this runs once per token, so
    // there is nothing to reset before the request.
    let cancelled = false
    httpClient
      .get<InviteDetails>(`/invitations/${encodeURIComponent(token)}`)
      .then((res) => {
        if (cancelled) return
        setDetails(res.data)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        const { code, status } = apiErrorOf(err)
        if (code === 'INVITATION_EXPIRED') {
          setError('This invitation has expired. Ask the board owner to send a new one.')
        } else if (code === 'INVITATION_NOT_FOUND') {
          setError('This invitation is invalid or has already been used.')
        } else if (status === 403) {
          setError(
            'This invitation was sent to a different account. Sign in with the invited email to accept it.',
          )
        } else {
          setError('Could not load this invitation. Please try again.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, isLoading, isSuccess, router])

  const respond = async (decision: 'accepted' | 'declined') => {
    if (!token || answering) return
    setAnswering(true)
    try {
      await httpClient.post(`/invitations/${encodeURIComponent(token)}/respond`, { decision })
      setDone(decision)
    } catch (err: unknown) {
      if (apiErrorOf(err).code === 'INVITATION_EXPIRED') {
        setError('This invitation has expired.')
      } else {
        setError(getFriendlyErrorMessage(err, 'Could not respond to this invitation.'))
      }
    } finally {
      setAnswering(false)
    }
  }

  const shownError = token ? error : 'This invitation link is missing a token.'

  if (token && (isLoading || loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-text-secondary">Loading invitation…</p>
      </div>
    )
  }

  if (shownError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-xl border border-border bg-surface-elevated p-6 text-center">
          <h1 className="text-lg font-semibold text-text-primary">Invitation unavailable</h1>
          <p className="mt-2 text-sm text-text-secondary">{shownError}</p>
          <Button className="mt-4" onClick={() => router.push('/boards')}>
            Go to boards
          </Button>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-xl border border-border bg-surface-elevated p-6 text-center">
          <h1 className="text-lg font-semibold text-text-primary">
            {done === 'accepted' ? 'Invitation accepted' : 'Invitation declined'}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {done === 'accepted'
              ? `You now have access to ${details?.boardName ?? 'the board'}.`
              : 'The invitation has been declined.'}
          </p>
          <Button className="mt-4" onClick={() => router.push(done === 'accepted' ? `/boards/${details?.boardId}` : '/boards')}>
            {done === 'accepted' ? 'Open board' : 'Go to boards'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface-elevated p-6">
        <h1 className="text-lg font-semibold text-text-primary">Board invitation</h1>
        <p className="mt-2 text-sm text-text-secondary">
          <strong>{details?.inviterName}</strong> invited you to join{' '}
          <strong>{details?.boardName}</strong> as an <strong>{details?.role}</strong>.
        </p>
        {details?.expiresAt && (
          <p className="mt-1 text-xs text-text-muted">
            Expires {new Date(details.expiresAt).toLocaleDateString()}.
          </p>
        )}
        <div className="mt-6 flex gap-3">
          <Button className="flex-1" disabled={answering} onClick={() => void respond('accepted')}>
            {answering ? 'Working…' : 'Accept'}
          </Button>
          <Button variant="outline" className="flex-1" disabled={answering} onClick={() => void respond('declined')}>
            Decline
          </Button>
        </div>
      </div>
    </div>
  )
}
