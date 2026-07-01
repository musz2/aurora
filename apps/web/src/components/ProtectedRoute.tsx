import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { Spinner } from "@/components/ui/primitives";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const location = useLocation();

  // While the initial session check is running, show a loader instead of
  // flashing protected content or redirecting a valid-but-unvalidated session.
  if (accessToken && !bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAFAFB]">
        <Spinner />
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
