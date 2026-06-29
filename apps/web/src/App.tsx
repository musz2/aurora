import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";

import { PublicLayout } from "@/layouts/PublicLayout";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import { LandingPage } from "@/pages/public/LandingPage";
import { ProductPage } from "@/pages/public/ProductPage";
import { JoinPage } from "@/pages/public/JoinPage";
import { ViewerPage } from "@/pages/viewer/ViewerPage";
import { FeaturesPage } from "@/pages/public/FeaturesPage";
import { UseCasesPage } from "@/pages/public/UseCasesPage";
import { IntegrationsPage } from "@/pages/public/IntegrationsPage";
import { PricingPage } from "@/pages/public/PricingPage";
import { SecurityPage } from "@/pages/public/SecurityPage";
import { LoginPage } from "@/pages/auth/LoginPage";
import { SignupPage } from "@/pages/auth/SignupPage";
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage";

import { DashboardHome } from "@/pages/app/DashboardHome";
import { MeetingsPage } from "@/pages/app/MeetingsPage";
import { MeetingDetailPage } from "@/pages/app/MeetingDetailPage";
import { LiveMeetingPage } from "@/pages/app/LiveMeetingPage";
import { CopilotPage } from "@/pages/app/CopilotPage";
import { ChatPage } from "@/pages/app/ChatPage";
import { ActionItemsPage } from "@/pages/app/ActionItemsPage";
import { SearchPage } from "@/pages/app/SearchPage";
import { UploadPage } from "@/pages/app/UploadPage";
import { CalendarPage } from "@/pages/app/CalendarPage";
import { IntegrationsDashboard } from "@/pages/app/IntegrationsDashboard";
import { BillingPage } from "@/pages/app/BillingPage";
import { WorkspaceSettingsPage } from "@/pages/app/WorkspaceSettingsPage";
import { ProfilePage } from "@/pages/app/ProfilePage";

export function App() {
  const { accessToken, setUser, logout } = useAuthStore();

  useEffect(() => {
    if (!accessToken) return;
    api
      .get("/auth/me")
      .then(({ data }) => setUser(data.user))
      .catch(() => logout());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/product" element={<ProductPage />} />
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/solutions" element={<UseCasesPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/security" element={<SecurityPage />} />
      </Route>

      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/join" element={<JoinPage />} />
      <Route path="/s/:shareId" element={<ViewerPage />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardHome />} />
        <Route path="meetings" element={<MeetingsPage />} />
        <Route path="meetings/:id" element={<MeetingDetailPage />} />
        <Route path="live" element={<LiveMeetingPage />} />
        <Route path="copilot" element={<CopilotPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="action-items" element={<ActionItemsPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="upload" element={<UploadPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="integrations" element={<IntegrationsDashboard />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="settings/workspace" element={<WorkspaceSettingsPage />} />
        <Route path="settings/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
