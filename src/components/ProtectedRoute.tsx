import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "student" | "teacher";
  /** Pages that don't require an onboarded profile. The welcome page itself
   *  is the obvious one — users land there to fill the profile in. */
  skipOnboardingCheck?: boolean;
}

const ProtectedRoute = ({ children, requiredRole, skipOnboardingCheck }: ProtectedRouteProps) => {
  const { user, loading, role, profile } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Onboarding gate — fresh accounts are sent to /welcome until they fill
  // in at least the basic identity fields. Teachers skip this; their seed
  // user already has a name, and we don't ask them for a group.
  if (
    !skipOnboardingCheck &&
    role !== "teacher" &&
    profile !== null &&
    !profile?.full_name &&
    location.pathname !== "/welcome"
  ) {
    return <Navigate to="/welcome" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8 rounded-2xl bg-card border border-border">
          <h2 className="font-display text-xl font-bold text-foreground mb-2">Доступ запрещён</h2>
          <p className="text-muted-foreground">У вас нет прав для просмотра этой страницы.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
