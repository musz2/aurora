import { Link } from "react-router-dom";
import { Logo } from "@/components/ui/Logo";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", to: "/features" },
      { label: "Pricing", to: "/pricing" },
      { label: "Integrations", to: "/integrations" },
      { label: "Live Meeting", to: "/features" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Sales Teams", to: "/solutions" },
      { label: "Recruiters", to: "/solutions" },
      { label: "Enterprises", to: "/solutions" },
      { label: "Education", to: "/solutions" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", to: "/features" },
      { label: "API", to: "/features" },
      { label: "Changelog", to: "/features" },
      { label: "Support", to: "/security" },
    ],
  },
  {
    title: "Security",
    links: [
      { label: "Consent Controls", to: "/security" },
      { label: "SSO / SCIM", to: "/security" },
      { label: "Data Retention", to: "/security" },
      { label: "HIPAA", to: "/security" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/" },
      { label: "Careers", to: "/" },
      { label: "Blog", to: "/" },
      { label: "Contact", to: "/" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-aurora-wash px-4 pb-6 pt-10 sm:px-6">
      <div className="mx-auto max-w-7xl rounded-3xl bg-ink px-6 py-14 sm:px-12">
        <div className="grid gap-12 lg:grid-cols-6">
          <div className="lg:col-span-1">
            <Logo variant="light" />
            <p className="mt-4 max-w-xs text-sm text-white/50">
              AI meeting assistant that turns every conversation into searchable,
              actionable intelligence.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-white">{col.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      to={l.to}
                      className="text-sm text-white/50 transition-colors hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p className="text-sm text-white/50">
            © {new Date().getFullYear()} Aurora.ai — Consent-first meeting
            intelligence.
          </p>
          <div className="flex gap-6 text-sm text-white/50">
            <Link to="/security" className="transition-colors hover:text-white">
              Privacy
            </Link>
            <Link to="/security" className="transition-colors hover:text-white">
              Terms
            </Link>
            <Link to="/security" className="transition-colors hover:text-white">
              Consent Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
