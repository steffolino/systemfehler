import { lazy, Suspense, type JSX } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { Header } from "./components/layout/Header";
import AdminLayout from "./components/admin/AdminLayout";
import { I18nProvider, useI18n } from "./lib/i18n";
import { useAppAuth } from "./lib/auth";

const SearchPage = lazy(() => import("./pages/SearchPage"));
const EntryPage = lazy(() => import("./pages/EntryPage"));
const SourcesPage = lazy(() => import("./pages/SourcesPage"));
const AdminApp = lazy(() => import("./pages/AdminApp"));
const AdminModeration = lazy(() => import("./pages/AdminModeration"));
const AdminQuality = lazy(() => import("./pages/AdminQuality"));
const AdminRawEntries = lazy(() => import("./pages/AdminRawEntries"));
const AdminPlainLanguage = lazy(() => import("./pages/AdminPlainLanguage"));
const AdminDuplicates = lazy(() => import("./pages/AdminDuplicates"));
const AdminUserTrust = lazy(() => import("./pages/AdminUserTrust"));
const AdminAuditLog = lazy(() => import("./pages/AdminAuditLog"));

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading, isConfigured } = useAppAuth();
  const { t } = useI18n();

  if (isLoading) return <div className="p-6">{t("common.loading")}</div>;
  if (!isConfigured) return <Navigate to="/" replace />;
  if (!isAuthenticated) return <Navigate to="/" replace />;

  return children;
}

export default function App() {
  const LoadingRoute = () => {
    const { t } = useI18n();
    return <div className="p-6">{t("common.loading")}</div>;
  };

  return (
    <I18nProvider>
      <>
        <Header />

        <Suspense fallback={<LoadingRoute />}>
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
              <Route path="plain-language" element={<AdminPlainLanguage />} />
              <Route path="duplicates" element={<AdminDuplicates />} />
              <Route path="user-trust" element={<AdminUserTrust />} />
              <Route path="audit-log" element={<AdminAuditLog />} />
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </>
    </I18nProvider>
  );
}
