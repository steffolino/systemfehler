import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import type { JSX } from "react";

import { Header } from "./components/layout/Header";
import AdminLayout from "./components/admin/AdminLayout";
import SearchPage from "./pages/SearchPage";
import EntryPage from "./pages/EntryPage";
import SourcesPage from "./pages/SourcesPage";
import AdminApp from "./pages/AdminApp";
import AdminModeration from "./pages/AdminModeration";
import AdminQuality from "./pages/AdminQuality";
import AdminRawEntries from "./pages/AdminRawEntries";
import AdminDuplicates from "./pages/AdminDuplicates";
import AdminUserTrust from "./pages/AdminUserTrust";
import AdminAuditLog from "./pages/AdminAuditLog";
import { I18nProvider, useI18n } from "./lib/i18n";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading } = useAuth0();
  const { t } = useI18n();

  if (isLoading) return <div className="p-6">{t("common.loading")}</div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;

  return children;
}

export default function App() {
  return (
    <I18nProvider>
      <>
        <Header />

        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/sources" element={<SourcesPage />} />
          <Route path="/entry/:id" element={<EntryPage />} />

          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminApp />} />
            <Route path="moderation" element={<AdminModeration />} />
            <Route path="quality" element={<AdminQuality />} />
            <Route path="raw" element={<AdminRawEntries />} />
            <Route path="duplicates" element={<AdminDuplicates />} />
            <Route path="user-trust" element={<AdminUserTrust />} />
            <Route path="audit-log" element={<AdminAuditLog />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </>
    </I18nProvider>
  );
}
