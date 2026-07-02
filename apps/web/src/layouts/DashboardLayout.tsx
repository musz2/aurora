import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Video,
  Radio,
  Sparkles,
  MessageSquare,
  ListChecks,
  Search,
  Upload,
  Calendar,
  Plug,
  CreditCard,
  Settings,
  User,
  Menu,
  X,
  Plus,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/primitives";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/cn";

const NAV_GROUPS: {
  label?: string;
  items: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; end?: boolean }[];
}[] = [
  {
    items: [
      { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/app/live", label: "Live Meeting", icon: Radio },
      { to: "/app/copilot", label: "Private Copilot", icon: Sparkles },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { to: "/app/meetings", label: "Meetings", icon: Video },
      { to: "/app/action-items", label: "Action Items", icon: ListChecks },
      { to: "/app/chat", label: "AI Chat", icon: MessageSquare },
      { to: "/app/search", label: "Search", icon: Search },
      { to: "/app/upload", label: "Upload", icon: Upload },
      { to: "/app/calendar", label: "Calendar", icon: Calendar },
    ],
  },
  {
    label: "Workspace",
    items: [
      { to: "/app/integrations", label: "Integrations", icon: Plug },
      { to: "/app/billing", label: "Billing", icon: CreditCard },
      { to: "/app/settings/workspace", label: "Workspace", icon: Settings },
      { to: "/app/settings/profile", label: "Profile", icon: User },
    ],
  },
];

export function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const doLogout = () => {
    logout();
    navigate("/login");
  };

  // "/" jumps to global search unless the user is typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
        return;
      e.preventDefault();
      navigate("/app/search");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5">
        <Logo />
        <button
          className="lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5 text-muted" />
        </button>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted/70">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                      isActive
                        ? "bg-aurora-50 text-aurora-700"
                        : "text-muted hover:bg-black/[0.04] hover:text-ink"
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-aurora-500 transition-opacity",
                          isActive ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <item.icon className="h-[18px] w-[18px]" />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-black/[0.06] p-3">
        <div className="rounded-xl border border-black/[0.07] bg-white p-4">
          {user?.developerBypass ? (
            <p className="text-xs font-semibold text-emerald-700">⭐ Developer — full access</p>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-aurora-100/80 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-aurora-700">
              {user?.plan ?? "BASIC"} plan
            </span>
          )}
          <p className="mt-1.5 truncate text-xs text-muted">{user?.workspaceName}</p>
          {!user?.developerBypass && (
            <Link
              to="/app/billing"
              className="mt-2 inline-block text-xs font-medium text-aurora-600 hover:underline"
            >
              Manage plan →
            </Link>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-black/[0.06] bg-white lg:block">
        {SidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-modal animate-slide-in-left">
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-black/[0.06] bg-white/80 px-4 backdrop-blur sm:px-6">
          <button
            className="grid h-10 w-10 place-items-center rounded-xl text-ink transition hover:bg-black/5 lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            onClick={() => navigate("/app/search")}
            className="hidden items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-muted transition hover:border-black/20 hover:text-ink sm:flex sm:w-72"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search meetings, decisions, tasks…</span>
            <kbd className="rounded-md border border-black/10 bg-black/[0.03] px-1.5 py-0.5 text-[10px] font-medium text-muted">
              /
            </kbd>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <NavLink
              to="/app/upload"
              className="hidden items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-black/30 hover:bg-black/[0.02] md:flex"
            >
              <Plus className="h-4 w-4" /> New meeting
            </NavLink>
            <NavLink
              to="/app/live"
              className="flex items-center gap-2 rounded-xl bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-black active:scale-[0.98]"
            >
              <span className="live-dot h-2 w-2 animate-pulse-dot rounded-full bg-red-400" />
              Start meeting
            </NavLink>

            <div className="relative">
              <button
                onClick={() => setMenu((m) => !m)}
                className="flex items-center gap-1.5 rounded-full p-0.5 transition hover:bg-black/5"
                aria-label="Account menu"
                aria-expanded={menu}
              >
                <Avatar name={user?.name ?? "User"} url={user?.avatarUrl} />
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted transition-transform duration-200",
                    menu && "rotate-180"
                  )}
                />
              </button>
              {menu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-60 rounded-2xl border border-black/[0.06] bg-white p-2 shadow-lift animate-scale-in origin-top-right">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium text-ink">{user?.name}</p>
                      <p className="truncate text-xs text-muted">{user?.email}</p>
                      <p className="mt-1 truncate text-[11px] text-muted/80">
                        {user?.workspaceName}
                      </p>
                    </div>
                    <div className="my-1 h-px bg-black/[0.06]" />
                    <Link
                      to="/app/settings/profile"
                      onClick={() => setMenu(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-black/[0.04]"
                    >
                      <User className="h-4 w-4" /> Profile
                    </Link>
                    <Link
                      to="/app/settings/workspace"
                      onClick={() => setMenu(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-black/[0.04]"
                    >
                      <Settings className="h-4 w-4" /> Workspace
                    </Link>
                    <Link
                      to="/app/billing"
                      onClick={() => setMenu(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-black/[0.04]"
                    >
                      <CreditCard className="h-4 w-4" /> Billing
                    </Link>
                    <div className="my-1 h-px bg-black/[0.06]" />
                    <button
                      onClick={doLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" /> Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main
          key={location.pathname}
          className="page-enter mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
