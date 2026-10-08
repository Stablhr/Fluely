"use client";

import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  Columns3,
  CalendarDays,
  Settings,
  LogOut,
  CalendarRange,
} from "lucide-react";
import { useStore } from "@/lib/kali/store/useStore";
import { YOU_ID } from "@/lib/kali/store/schema";
import {
  useAdaptiveTheme,
  adaptiveVars,
} from "@/lib/kali/hooks/useAdaptiveTheme";
import { useSignOut } from "@/lib/hooks/auth/useSignOut";
import CaptureBox from "../shared/CaptureBox";
import Avatar from "../shared/Avatar";
import StorageMeter from "../shared/StorageMeter";

interface NavLinkProps {
  to: string;
  end?: boolean;
  title?: string;
  className?: string | ((state: { isActive: boolean }) => string);
  style?:
    | CSSProperties
    | ((state: { isActive: boolean }) => CSSProperties | undefined);
  children: ReactNode | ((state: { isActive: boolean }) => ReactNode);
}

function NavLink({ to, end, title, className, style, children }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = end
    ? pathname === to
    : pathname === to || pathname.startsWith(`${to}/`);
  const state = { isActive };

  return (
    <Link
      href={to}
      title={title}
      className={typeof className === "function" ? className(state) : className}
      style={typeof style === "function" ? style(state) : style}
    >
      {typeof children === "function" ? children(state) : children}
    </Link>
  );
}

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/boards", label: "Boards", icon: Columns3 },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/content-planner", label: "Social Posting", icon: CalendarRange },
  { to: "/settings", label: "Settings", icon: Settings },
];

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-4">
      {/* The source is 413x604, so object-contain in a square box letterboxes it
          to roughly two-thirds of the box width — a h-8 box drew it about 22px
          wide. h-16 gives the mark real presence next to the wordmark.

          Stays h-8 when collapsed: the rail is only 52px wide and 8px of that
          is padding either side, so a larger mark would overflow it. */}
      <Image
        src="/assets/fluely_favicon.png"
        alt="Fluely logo"
        width={64}
        height={64}
        className={`shrink-0 rounded-lg object-contain ${collapsed ? "h-8 w-8" : "h-16 w-16"}`}
        aria-hidden="true"
      />
      {!collapsed && (
        <span
          className="font-heading text-[22px] font-bold tracking-tight"
          style={{ color: "var(--color-brand-ivory)" }}
        >
          Fluely
        </span>
      )}
    </div>
  );
}

function LogoutButton({ collapsed }: { collapsed: boolean }) {
  const { signOut, isPending } = useSignOut();

  const handleLogout = () => {
    void signOut();
  };

  const label = isPending ? "Signing out…" : "Sign out";

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
    );
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
  );
}

interface SidebarProps {
  collapsed: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export default function Sidebar({
  collapsed,
  onMouseEnter,
  onMouseLeave,
}: SidebarProps) {
  const { data } = useStore();
  const inboxCount = data.inbox.length;
  const you = data.members[YOU_ID];

  const theme = useAdaptiveTheme("#3971b8");
  const sidebarVars = adaptiveVars(theme);

  /**
   * Boards are grouped by how the signed-in person reaches them, because the
   * three cases behave differently and lumping them together hid that: owned
   * boards are editable and shareable, shared boards may be read-only, and
   * workspace boards are readable but not necessarily editable.
   *
   * Derived from the server's own `access` verdict rather than from visibility,
   * so a board the person cannot see never appears here at all.
   */
  const allBoards = Object.values(data.boards);
  const owned = allBoards
    .filter((b) => b.access === "owner")
    .sort(
      (a, b) =>
        Number(b.starred) - Number(a.starred) ||
        b.updatedAt.localeCompare(a.updatedAt),
    );

  const shared = allBoards
    .filter((b) => b.access === "editor" || b.access === "viewer")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const workspaceBoards = allBoards
    .filter((b) => b.access === "workspace-view" || b.access === "public-view")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const sections: { title: string; boards: typeof owned }[] = [
    { title: "Your Boards", boards: owned },
    { title: "Shared with you", boards: shared },
    { title: "Workspace", boards: workspaceBoards },
  ].filter((s) => s.boards.length > 0);

  const themeBg = "var(--surface-bg-subtle)";

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={`hidden shrink-0 flex-col border-r transition-[width] duration-200 md:flex bg-sidebar-bg ${
          collapsed ? "w-[52px]" : "w-[236px]"
        }`}
        style={{ ...sidebarVars, borderColor: theme.border }}
      >
        {/* Logo */}
        <div
          className={collapsed ? "flex justify-center px-2 py-3" : "px-2 py-2"}
        >
          <Logo collapsed={collapsed} />
        </div>

        {/* Navigation */}
        <nav
          className={`mt-1 flex-1 space-y-0.5 ${collapsed ? "px-2" : "px-3"}`}
        >
          {NAV.map((item) => {
            const Icon = item.icon;
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
                          ? "bg-sidebar-active text-brand-ivory"
                          : "text-[var(--surface-text-muted)] hover:bg-white/[0.06] hover:text-[var(--surface-text)]"
                      }`
                    : `relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary ${
                        isActive
                          ? "bg-sidebar-active font-semibold text-brand-ivory"
                          : "font-medium text-[var(--surface-text-muted)] hover:bg-white/[0.06] hover:text-[var(--surface-text)]"
                      }`
                }
                style={({ isActive }) => {
                  if (!collapsed || !isActive) return undefined;
                  return {};
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
                    {item.to === "/inbox" &&
                      inboxCount > 0 &&
                      (collapsed ? (
                        <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-sidebar-bg bg-brand-vanilla px-1 font-mono text-[9px] font-semibold leading-none text-brand-ink">
                          {inboxCount}
                        </span>
                      ) : (
                        <span className="ml-2 rounded-pill bg-brand-vanilla px-1.5 py-0.5 font-mono text-[10px] font-medium text-brand-ink">
                          {inboxCount}
                        </span>
                      ))}
                  </>
                )}
              </NavLink>
            );
          })}

          {/* Boards, grouped by how the signed-in person reaches them. */}
          {!collapsed &&
            sections.map((section) => (
              <div key={section.title} className="mt-4">
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--surface-text-faint)]">
                  {section.title}
                </p>
                <div className="space-y-0.5">
                  {section.boards.map((board) => {
                    const isBgUrl =
                      board.background?.startsWith("data:") ||
                      board.background?.startsWith("http");
                    return (
                      <NavLink
                        key={board.id}
                        to={`/boards/${board.id}`}
                        title={board.name}
                        className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-[var(--surface-text-muted)] transition-colors duration-150 hover:bg-white/[0.06] hover:text-[var(--surface-text)]"
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-sm ring-1 ring-black/10"
                          style={
                            isBgUrl
                              ? {
                                  background: `url(${board.background}) center/cover no-repeat`,
                                }
                              : {
                                  background:
                                    board.background ||
                                    "var(--color-surface-alt)",
                                }
                          }
                        />
                        <span className="truncate">{board.name}</span>
                        {board.starred && (
                          <span className="ml-auto text-[10px] text-warning">
                            &#9733;
                          </span>
                        )}
                        {/* A read-only board is worth saying out loud, or the first
                            failed drag looks like a bug. */}
                        {board.access === "viewer" && (
                          <span className="ml-auto text-[10px] text-[var(--surface-text-faint)]">
                            view
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
        </nav>

        {/* Footer: CaptureBox → User → Sign out → Storage */}
        {collapsed ? (
          <div
            className="flex flex-col items-center gap-2 border-t px-2 py-3"
            style={{ borderColor: theme.border }}
          >
            <LogoutButton collapsed={collapsed} />
            <StorageMeter collapsed />
          </div>
        ) : (
          <div
            className="border-t p-3 space-y-2.5"
            style={{ borderColor: theme.border }}
          >
            <CaptureBox />
            {you && (
              <div
                className="flex items-center gap-2 rounded-md px-2.5 py-2"
                style={{ background: themeBg }}
                title={you.name}
              >
                <Avatar member={you} size={22} />
                <span
                  className="min-w-0 flex-1 truncate text-[13px] font-semibold"
                  style={{ color: "var(--color-brand-ivory)" }}
                >
                  {you.name}
                </span>
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
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="relative flex flex-col items-center gap-0.5 rounded-md px-3 py-1.5 transition-colors duration-150 hover:bg-white/[0.06]"
              style={({ isActive }) => ({
                color: isActive
                  ? "var(--surface-text)"
                  : "var(--surface-text-muted)",
                background: isActive ? "var(--surface-bg-subtle)" : undefined,
              })}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {item.to === "/inbox" && inboxCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 rounded-pill bg-brand-vanilla px-1 py-0.5 font-mono text-[8px] font-medium text-brand-ink">
                  {inboxCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
