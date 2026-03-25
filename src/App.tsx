import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import MainLayout from "@/components/MainLayout";
import Auth from "@/pages/Auth";
import Feed from "@/pages/Feed";
import Profile from "@/pages/Profile";
import Network from "@/pages/Network";
import Messaging from "@/pages/Messaging";
import Notifications from "@/pages/Notifications";
import Jobs from "@/pages/Jobs";
import AIAssistant from "@/pages/AIAssistant";
import Premium from "@/pages/Premium";
import Admin from "@/pages/Admin";
import AdminLogin from "@/pages/AdminLogin";
import Terms from "@/pages/Terms";
import Privacy from "@/pages/Privacy";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground animate-pulse">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const AuthRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground animate-pulse">Loading...</div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
              <Route path="/" element={<Feed />} />
              <Route path="/profile/:userId" element={<Profile />} />
              <Route path="/network" element={<Network />} />
              <Route path="/messaging" element={<Messaging />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/ai-assistant" element={<AIAssistant />} />
              <Route path="/premium" element={<Premium />} />
              <Route path="/admin" element={<Admin />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
