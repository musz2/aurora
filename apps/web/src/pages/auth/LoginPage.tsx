import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Input, Label, Spinner } from "@/components/ui/primitives";
import { api, apiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("justin@aurora.ai");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setAuth(data);
      navigate(location.state?.from ?? "/app");
    } catch (err) {
      setError(apiError(err, "Invalid email or password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your Aurora workspace.">
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              to="/forgot-password"
              className="text-xs text-aurora-600 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : "Log in"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-black/10" />
        OR
        <span className="h-px flex-1 bg-black/10" />
      </div>
      <div className="space-y-2">
        <Button variant="outline" className="w-full" disabled>
          Continue with Google
        </Button>
        <Button variant="outline" className="w-full" disabled>
          Continue with Microsoft
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        New to Aurora?{" "}
        <Link to="/signup" className="font-medium text-aurora-600">
          Create an account
        </Link>
      </p>
      <p className="mt-4 rounded-lg bg-aurora-50 px-3 py-2 text-center text-xs text-aurora-700">
        Demo login is pre-filled — just click “Log in”.
      </p>
    </AuthShell>
  );
}
