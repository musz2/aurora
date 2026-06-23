import { useState } from "react";
import { Link } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/primitives";

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll send you a link to get back into your workspace."
    >
      {sent ? (
        <div className="rounded-xl bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
          If an account exists for that email, a reset link is on its way.
          <p className="mt-2 text-emerald-600/80">
            (Placeholder — email delivery is configured in production.)
          </p>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required />
          </div>
          <Button type="submit" className="w-full">
            Send reset link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-muted">
        <Link to="/login" className="font-medium text-aurora-600">
          Back to login
        </Link>
      </p>
    </AuthShell>
  );
}
