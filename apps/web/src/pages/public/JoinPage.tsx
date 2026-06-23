import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/primitives";

export function JoinPage() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const join = (e: React.FormEvent) => {
    e.preventDefault();
    let id = code.trim();
    // Accept a full URL or a raw share id.
    const match = id.match(/\/s\/([\w-]+)/);
    if (match) id = match[1];
    if (id) navigate(`/s/${id}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="px-6 py-5 sm:px-8">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="w-full max-w-md text-center">
          <span className="grid mx-auto h-14 w-14 place-items-center rounded-2xl bg-aurora-gradient text-white">
            <LogIn className="h-7 w-7" />
          </span>
          <h1 className="mt-6 font-display text-4xl text-ink">Join a session</h1>
          <p className="mt-3 text-muted">
            Enter a session link or code to view the live shared transcript and
            published notes. No account needed.
          </p>
          <form onSubmit={join} className="mt-8 flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste session link or code"
              className="text-center"
              autoFocus
            />
            <Button type="submit" disabled={!code.trim()}>
              Join <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-6 text-sm text-muted">
            Hosting instead?{" "}
            <button
              onClick={() => navigate("/app/live")}
              className="font-medium text-aurora-600"
            >
              Start a session
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
