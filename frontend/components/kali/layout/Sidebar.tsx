'use client'

import type { CSSProperties, ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Inbox, Columns3, CalendarDays, Settings, LogOut, CalendarRange } from 'lucide-react'
import { useStore } from '@/lib/kali/store/useStore'
import { useAdaptiveTheme, adaptiveVars } from '@/lib/kali/hooks/useAdaptiveTheme'
import { useSignOut } from '@/lib/hooks/auth/useSignOut'
import CaptureBox from '../shared/CaptureBox'
import Avatar from '../shared/Avatar'
import StorageMeter from '../shared/StorageMeter'

interface NavLinkProps {
  to: string
  end?: boolean
  title?: string
  className?: string | ((state: { isActive: boolean }) => string)
  style?: CSSProperties | ((state: { isActive: boolean }) => CSSProperties | undefined)
  children: ReactNode | ((state: { isActive: boolean }) => ReactNode)
}

function NavLink({ to, end, title, className, style, children }: NavLinkProps) {
  const pathname = usePathname()
  const isActive = end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`)
  const state = { isActive }

  return (
    <Link
      href={to}
      title={title}
      className={typeof className === 'function' ? className(state) : className}
      style={typeof style === 'function' ? style(state) : style}
    >
      {typeof children === 'function' ? children(state) : children}
    </Link>
  )
}

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/boards', label: 'Boards', icon: Columns3 },
  { to: '/schedule', label: 'Schedule', icon: CalendarDays },
  { to: '/content-planner', label: 'Content Planner', icon: CalendarRange },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-4">
      <Image
        src="/assets/kali-logo.png"
        alt="Kali logo"
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-lg"
        aria-hidden="true"
      />
      {!collapsed && (
        <span className="font-heading text-[16px] font-bold tracking-tight" style={{ color: 'var(--color-brand-ivory)' }}>Fluely</span>
      )}
    </div>
  )
}

function LogoutButton({ collapsed }: { collapsed: boolean }) {
  const { signOut, isPending } = useSignOut()

  const handleLogout = () => {
    void signOut()
  }

  const label = isPending ? 'Signing out…' : 'Sign out'

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={isPending}
        title={label}
        aria-label={label}
        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--surface-text-muted)] transition-colors duration-150 outline-none hover:bg-white/[0.08] hover:text-[var(--surface-text)] focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50"
      >
        <LogOut size={15} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-[var(--surface-text-muted)] transition-colors duration-150 outline-none hover:bg-white/[0.08] hover:text-[var(--surface-text)] focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50"
    >
      <LogOut size={15} className="shrink-0" />
      <span className="flex-1 text-left">{label}</span>
    </button>
  )
}

interface SidebarProps {
  collapsed: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
}

export default function Sidebar({ collapsed, onMouseEnter, onMouseLeave }: SidebarProps) {
  const { data, members } = useStore()
  const inboxCount = data.inbox.length
  const you = members.find((m) => m.name === 'You') ?? members[0]

  const theme = useAdaptiveTheme('#3971b8')
  const sidebarVars = adaptiveVars(theme)

  const boards = Object.values(data.boards)
    .sort((a, b) => Number(b.starred) - Number(a.starred) || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5)

  const themeBg = 'var(--surface-bg-subtle)'

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`hidden shrink-0 flex-col border-r transition-[width] duration-200 md:flex bg-sidebar-bg ${
          collapsed ? 'w-[52px]' : 'w-[236px]'
        }`}
        style={{ ...sidebarVars, borderColor: theme.border }}
      >
        {/* Logo */}
        <div className={collapsed ? 'flex justify-center px-2 py-3' : 'px-2 py-2'}>
          <Logo collapsed={collapsed} />
        </div>

        {/* Navigation */}
        <nav className={`mt-1 flex-1 space-y-0.5 ${collapsed ? 'px-2' : 'px-3'}`}>
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  collapsed
                    ? `relative mx-auto flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary ${
                        isActive
                          ? 'bg-sidebar-active text-brand-ivory'
                          : 'text-[var(--surface-text-muted)] hover:bg-white/[0.06] hover:text-[var(--surface-text)]'
                      }`
                    : `relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary ${
                        isActive
                          ? 'bg-sidebar-active font-semibold text-brand-ivory'
                          : 'font-medium text-[var(--surface-text-muted)] hover:bg-white/[0.06] hover:text-[var(--surface-text)]'
                      }`
                }
                style={({ isActive }) => {
                  if (!collapsed || !isActive) return undefined
                  return {}
                }}
              >
                {({ isActive }) => (
                  <>
                    {/* Left accent bar */}
                    {isActive && !collapsed && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-brand-green" />
                    )}
                    {isActive && collapsed && (
                      <span className="absolute left-1 top-1 bottom-1 w-[3px] rounded-full bg-brand-green" />
                    )}
                    <Icon size={16} className="shrink-0" />
                    {!collapsed && <span className="flex-1">{item.label}</span>}
                    {item.to === '/inbox' && inboxCount > 0 && (
                      collapsed ? (
                        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-sidebar-bg bg-brand-vanilla px-1 font-mono text-[9px] font-semibold leading-none text-brand-ink">
                          {inboxCount}
                        </span>
                      ) : (
                        <span className="ml-2 rounded-pill bg-brand-vanilla px-1.5 py-0.5 font-mono text-[10px] font-medium text-brand-ink">
                          {inboxCount}
                        </span>
                      )
                    )}
                  </>
                )}
              </NavLink>
            )
          })}

          {/* Boards quick-access */}
          {!collapsed && boards.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--surface-text-faint)]">
                Your Boards
              </p>
              <div className="space-y-0.5">
                {boards.map((board) => {
                  const isBgUrl = board.background?.startsWith('data:') || board.background?.startsWith('http')
                  return (
                    <NavLink
                      key={board.id}
                      to={`/boards/${board.id}`}
                      className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-[var(--surface-text-muted)] transition-colors duration-150 hover:bg-white/[0.06] hover:text-[var(--surface-text)]"
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm ring-1 ring-black/10"
                        style={
                          isBgUrl
                            ? { background: `url(${board.background}) center/cover no-repeat` }
                            : { background: board.background || 'var(--color-surface-alt)' }
                        }
                      />
                      <span className="truncate">{board.name}</span>
                      {board.starred && (
                        <span className="ml-auto text-[10px] text-warning">&#9733;</span>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )}
        </nav>

        {/* Footer: CaptureBox → User → Sign out → Storage */}
        {collapsed ? (
          <div className="flex flex-col items-center gap-2 border-t px-2 py-3" style={{ borderColor: theme.border }}>
            <LogoutButton collapsed={collapsed} />
            <StorageMeter collapsed />
          </div>
        ) : (
          <div className="border-t p-3 space-y-2.5" style={{ borderColor: theme.border }}>
            <CaptureBox />
            {you && (
              <div className="flex items-center gap-2 rounded-md px-2.5 py-2" style={{ background: themeBg }}>
                <Avatar member={you} size={22} />
                <span className="text-[13px] font-semibold" style={{ color: 'var(--color-brand-ivory)' }}>{you.name}</span>
              </div>
            )}
            <LogoutButton collapsed={collapsed} />
            <StorageMeter />
          </div>
        )}
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t px-2 py-1.5 md:hidden bg-sidebar-bg"
        style={{ ...sidebarVars, borderColor: theme.border }}
      >
        {NAV.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="relative flex flex-col items-center gap-0.5 rounded-md px-3 py-1.5 transition-colors duration-150 hover:bg-white/[0.06]"
              style={({ isActive }) => ({
                color: isActive ? 'var(--surface-text)' : 'var(--surface-text-muted)',
                background: isActive ? 'var(--surface-bg-subtle)' : undefined,
              })}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {item.to === '/inbox' && inboxCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 rounded-pill bg-brand-vanilla px-1 py-0.5 font-mono text-[8px] font-medium text-brand-ink">
                  {inboxCount}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>
    </>
  )
}