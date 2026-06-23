import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input, Label, Spinner } from "@/components/ui/primitives";
import { api, apiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export function SignupPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    workspaceName: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/signup", {
        ...form,
        workspaceName: form.workspaceName || undefined,
      });
      setAuth(data);
      navigate("/app");
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
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" value={form.name} onChange={set("name")} required />
        </div>
        <div>
          <Label htmlFor="email">Work email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={set("email")}
            required
          />
        </div>
        <div>
          <Label htmlFor="workspace">Workspace name (optional)</Label>
          <Input
            id="workspace"
            value={form.workspaceName}
            onChange={set("workspaceName")}
            placeholder="Acme Inc."
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={set("password")}
            placeholder="At least 8 characters"
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <Spinner className="h-4 w-4 border-white/40 border-t-white" />
          ) : (
            "Create account"
          )}
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
