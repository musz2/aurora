import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/cn";

const links = [
  { label: "Product", to: "/product" },
  { label: "Solutions", to: "/solutions" },
  { label: "Integrations", to: "/integrations" },
  { label: "Pricing", to: "/pricing" },
  { label: "Security", to: "/security" },
  { label: "Join", to: "/join" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "glass border-b border-black/[0.06]" : "bg-transparent"
      )}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 sm:px-8">
        <Logo />

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "text-sm transition-colors hover:text-ink",
                pathname === l.to ? "text-ink" : "text-muted"
              )}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {token && user ? (
            <>
              <Link
                to="/app"
                className="text-sm text-muted transition-colors hover:text-ink"
              >
                Dashboard
              </Link>
              <Button to="/app/live" size="md">
                Start Session
              </Button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm text-muted transition-colors hover:text-ink"
              >
                Login
              </Link>
              <Button to="/signup" size="md">
                Start Free
              </Button>
            </>
          )}
        </div>

        <button
          className="md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X /> : <Menu />}
        </button>
      </nav>

      {open && (
        <div className="glass border-t border-black/[0.06] md:hidden">
          <div className="flex flex-col gap-1 px-6 py-4">
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-lg px-3 py-2.5 text-sm text-ink hover:bg-black/5"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2">
              {token ? (
                <Button to="/app" className="flex-1">
                  Dashboard
                </Button>
              ) : (
                <>
                  <Button to="/login" variant="outline" className="flex-1">
                    Login
                  </Button>
                  <Button to="/signup" className="flex-1">
                    Start Free
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
