import { useState } from "react";
import {
  NavLink,
  Outlet,
  useNavigate,
  Link,
} from "react-router-dom";
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

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/meetings", label: "Meetings", icon: Video },
  { to: "/app/live", label: "Live Meeting", icon: Radio },
  { to: "/app/copilot", label: "Private Copilot", icon: Sparkles },
  { to: "/app/chat", label: "AI Chat", icon: MessageSquare },
  { to: "/app/action-items", label: "Action Items", icon: ListChecks },
  { to: "/app/search", label: "Search", icon: Search },
  { to: "/app/upload", label: "Upload", icon: Upload },
  { to: "/app/calendar", label: "Calendar", icon: Calendar },
  { to: "/app/integrations", label: "Integrations", icon: Plug },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
  { to: "/app/settings/workspace", label: "Workspace", icon: Settings },
  { to: "/app/settings/profile", label: "Profile", icon: User },
];

export function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const doLogout = () => {
    logout();
    navigate("/login");
  };

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-aurora-50 text-aurora-700"
                  : "text-muted hover:bg-black/[0.04] hover:text-ink"
              )
            }
          >
            <item.icon className="h-[18px] w-[18px]" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-black/[0.06] p-3">
        <div className="rounded-xl bg-gradient-to-br from-aurora-50 to-white p-4">
          <p className="text-xs font-semibold text-aurora-700">
            {user?.plan ?? "BASIC"} plan
          </p>
          <p className="mt-1 text-xs text-muted">
            {user?.workspaceName}
          </p>
          <Link
            to="/app/billing"
            className="mt-2 inline-block text-xs font-medium text-aurora-600 hover:underline"
          >
            Manage plan →
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-black/[0.06] bg-white lg:block">
        {SidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white">
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-black/[0.06] bg-white/80 px-4 backdrop-blur sm:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>

          <button
            onClick={() => navigate("/app/search")}
            className="hidden items-center gap-2 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-muted transition hover:border-black/20 sm:flex sm:w-72"
          >
            <Search className="h-4 w-4" />
            Search meetings, decisions, tasks…
          </button>

          <div className="ml-auto flex items-center gap-2">
            <NavLink
              to="/app/upload"
              className="hidden items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-ink transition hover:border-black/30 sm:flex"
            >
              <Plus className="h-4 w-4" /> New meeting
            </NavLink>
            <NavLink
              to="/app/live"
              className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:scale-[1.03]"
            >
              <span className="h-2 w-2 animate-pulse-dot rounded-full bg-red-400" />
              Record
            </NavLink>

            <div className="relative">
              <button
                onClick={() => setMenu((m) => !m)}
                className="flex items-center gap-1.5 rounded-full p-0.5"
              >
                <Avatar name={user?.name ?? "User"} url={user?.avatarUrl} />
                <ChevronDown className="h-4 w-4 text-muted" />
              </button>
              {menu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenu(false)}
                  />
                  <div className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-black/[0.06] bg-white p-2 shadow-glass">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium text-ink">
                        {user?.name}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {user?.email}
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

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
