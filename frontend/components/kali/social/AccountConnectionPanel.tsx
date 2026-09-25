'use client'

import { useState, useEffect } from 'react'
import { Link2, Unlink, RefreshCw, Loader2 } from 'lucide-react'
import { socialAccountsApi, type SocialAccount } from '@/lib/kali/api/social-accounts'
import Button from '../shared/Button'
import PlatformIcon from './PlatformIcon'
import type { Platform } from '@/lib/kali/store/schema'

const PLATFORM_CONFIG = {
  youtube: {
    name: 'YouTube',
    color: '#FF0000',
    authUrl: '/api/auth/youtube/start',
  },
  facebook: {
    name: 'Facebook',
    color: '#1877F2',
    authUrl: '/api/auth/facebook/start',
  },
  instagram: {
    name: 'Instagram',
    color: '#E4405F',
    authUrl: '/api/auth/instagram/start',
  },
  tiktok: {
    name: 'TikTok',
    color: '#000000',
    authUrl: '/api/auth/tiktok/start',
  },
} as const

export default function AccountConnectionPanel() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState<string | null>(null)

  useEffect(() => {
    loadAccounts()
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const success = params.get('success')
    const error = params.get('error')
    if (success || error) {
      loadAccounts()
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  async function loadAccounts() {
    try {
      const data = await socialAccountsApi.list()
      setAccounts(data)
    } catch {
      // API might be offline
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh(accountId: string) {
    setRefreshing(accountId)
    try {
      await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })
      await loadAccounts()
    } finally {
      setRefreshing(null)
    }
  }

  async function handleDisconnect(accountId: string) {
    if (!confirm('Disconnect this account? Scheduled posts for this account will be cancelled.')) return
    try {
      await socialAccountsApi.delete(accountId)
      await loadAccounts()
    } catch {
      // ignore
    }
  }

  function getAccountsForPlatform(platform: string) {
    return accounts.filter((a) => a.platform === platform)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {(Object.entries(PLATFORM_CONFIG) as Array<[string, typeof PLATFORM_CONFIG[keyof typeof PLATFORM_CONFIG]]>).map(
        ([platform, config]) => {
          const platformAccounts = getAccountsForPlatform(platform)

          return (
            <div key={platform} className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlatformIcon platform={platform as Platform} size={16} style={{ color: config.color }} />
                  <span className="text-sm font-medium text-text">{config.name}</span>
                </div>
                <a href={config.authUrl}>
                  <Button size="sm" variant="secondary">
                    <Link2 className="mr-1 h-3 w-3" />
                    Connect
                  </Button>
                </a>
              </div>

              {platformAccounts.length > 0 && (
                <div className="mt-2 space-y-2">
                  {platformAccounts.map((account) => (
                    <div
                      key={account._id}
                      className="flex items-center justify-between rounded-md bg-background px-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text">{account.accountName}</span>
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            account.status === 'active'
                              ? 'bg-success-bg text-success-text'
                              : account.status === 'expired'
                                ? 'bg-warning-bg text-warning-text'
                                : 'bg-danger-bg text-danger-text'
                          }`}
                        >
                          {account.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleRefresh(account._id)}
                          disabled={refreshing === account._id}
                          className="rounded p-1 text-text-muted hover:bg-elevated hover:text-text"
                          title="Refresh token"
                        >
                          {refreshing === account._id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDisconnect(account._id)}
                          className="rounded p-1 text-text-muted hover:bg-danger-bg hover:text-danger-text"
                          title="Disconnect"
                        >
                          <Unlink className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        },
      )}
    </div>
  )
}
