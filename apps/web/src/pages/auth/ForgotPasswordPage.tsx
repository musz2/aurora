import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";

/**
 * Honest password-reset state. Aurora does not have an email delivery provider
 * configured, so self-service reset links cannot be sent. Rather than fake an
 * "email sent" confirmation, we tell the user exactly how to regain access. When
 * an email provider is added, this becomes a real token-based reset flow.
 */
export function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Here's how to get back into your workspace."
    >
      <div className="rounded-xl border border-black/[0.06] bg-black/[0.02] px-4 py-4 text-sm text-ink/80">
        <p className="flex items-center gap-2 font-medium text-ink">
          <Mail className="h-4 w-4 text-aurora-600" /> Self-service reset isn't available yet
        </p>
        <p className="mt-2">
          Automated password-reset emails require an email provider that isn't
          configured on this deployment. To avoid pretending a link was sent, we
          keep this honest:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink/70">
          <li>Ask your workspace owner or admin to reset your access, or</li>
          <li>Contact your Aurora administrator to set a new password.</li>
        </ul>
        <p className="mt-2 text-xs text-muted">
          Once an email provider is configured, secure one-time reset links will be
          delivered here automatically.
        </p>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        <Link to="/login" className="font-medium text-aurora-600">
          Back to login
        </Link>
      </p>
    </AuthShell>
  );
}
