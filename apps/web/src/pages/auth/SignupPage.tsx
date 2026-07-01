import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/primitives";
import { api, apiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export function SignupPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    workspaceName: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/auth/signup", {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        workspaceName: form.workspaceName.trim() || undefined,
      });
      setAuth(data);
      navigate("/app", { replace: true });
    } catch (err) {
      setError(apiError(err, "Could not create account"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your workspace"
      subtitle="Start free with 300 monthly transcription minutes."
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={form.name} onChange={set("name")} autoComplete="name" required />
        </div>
        <div>
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" value={form.email} onChange={set("email")} autoComplete="email" required />
        </div>
        <div>
          <Label htmlFor="workspace">Workspace name (optional)</Label>
          <Input id="workspace" value={form.workspaceName} onChange={set("workspaceName")} placeholder="Acme Inc." />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={set("password")}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              className="pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div>
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            value={form.confirmPassword}
            onChange={set("confirmPassword")}
            autoComplete="new-password"
            required
          />
        </div>
        <Button type="submit" className="w-full" loading={loading}>
          {loading ? "Creating your workspace…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-aurora-600">
          Log in
        </Link>
      </p>
      <p className="mt-4 text-center text-xs text-muted">
        By signing up you agree to Aurora's consent-first recording policy.
      </p>
    </AuthShell>
  );
}
