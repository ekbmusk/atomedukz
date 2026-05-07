import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { ThemeProvider } from "@/hooks/useTheme";
import Index from "./pages/Index";
import ProtectedRoute from "./components/ProtectedRoute";

const AuthPage = lazy(() => import("./pages/AuthPage"));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const WelcomePage = lazy(() => import("./pages/WelcomePage"));
const TopicsListPage = lazy(() => import("./pages/TopicsListPage"));
const TopicPage = lazy(() => import("./pages/TopicPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));

const LoadingFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/auth/callback" element={<AuthCallbackPage />} />
                  <Route path="/auth/reset" element={<ResetPasswordPage />} />
                  <Route
                    path="/welcome"
                    element={
                      <ProtectedRoute skipOnboardingCheck>
                        <WelcomePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/topics"
                    element={
                      <ProtectedRoute>
                        <TopicsListPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/topics/:weekNumber"
                    element={
                      <ProtectedRoute>
                        <TopicPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <ProfilePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute requiredRole="teacher">
                        <TeacherDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
