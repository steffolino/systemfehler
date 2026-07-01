import { lazy, Suspense, useState, type FormEvent, type JSX } from "react";
import { Link, Routes, Route, Navigate } from "react-router-dom";

import { Header } from "./components/layout/Header";
import { BrandIcon } from "./components/layout/BrandAssets";
import { BackgroundDecor } from "./components/layout/BackgroundDecor";
import AdminLayout from "./components/admin/AdminLayout";
import { GlossaryProvider } from "./components/glossary/GlossaryProvider";
import { I18nProvider, useI18n } from "./lib/i18n";
import { useAppAuth } from "./lib/auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const SearchPage = lazy(() => import("./pages/SearchPage"));
const ImpressumPage = lazy(() => import("./pages/ImpressumPage"));
const EntryPage = lazy(() => import("./pages/EntryPage"));
const SourcesPage = lazy(() => import("./pages/SourcesPage"));
const AdminApp = lazy(() => import("./pages/AdminApp"));
const AdminModeration = lazy(() => import("./pages/AdminModeration"));
const AdminQuality = lazy(() => import("./pages/AdminQuality"));
const AdminRawEntries = lazy(() => import("./pages/AdminRawEntries"));
const AdminPlainLanguage = lazy(() => import("./pages/AdminPlainLanguage"));
const AdminLifeEventReview = lazy(() => import("./pages/AdminLifeEventReview"));
const AdminDuplicates = lazy(() => import("./pages/AdminDuplicates"));
const AdminUserTrust = lazy(() => import("./pages/AdminUserTrust"));
const AdminAuditLog = lazy(() => import("./pages/AdminAuditLog"));

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading, isConfigured } = useAppAuth();
  const { t } = useI18n();

  if (isLoading) return <div className="p-6">{t("common.loading")}</div>;
  if (!isConfigured) return <Navigate to="/" replace />;
  if (!isAuthenticated) return <AdminLoginGate />;

  return children;
}

function AdminLoginGate() {
  const { loginWithRedirect, loginWithDemoCredentials } = useAppAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submitDemoLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const ok = await loginWithDemoCredentials(username, password);
    if (!ok) setError("Demo-Zugangsdaten stimmen nicht.");
  }

  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl items-center justify-center p-6">
      <Card className="w-full max-w-xl p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border text-lg font-semibold">
          A
        </div>
        <h1 className="text-center text-2xl font-semibold tracking-tight">Admin access</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Demo reviewers can sign in read-only. Editors can continue to use GitHub login.
        </p>

        <form className="mt-6 space-y-3" onSubmit={submitDemoLogin}>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Demo user
            </span>
            <input
              className="h-10 w-full rounded-md border bg-background px-3"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Demo password
            </span>
            <input
              className="h-10 w-full rounded-md border bg-background px-3"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
          <Button className="w-full" type="submit">
            Login read-only
          </Button>
        </form>

        <div className="mt-4">
          <Button variant="outline" className="w-full" onClick={() => loginWithRedirect()}>
            Login with GitHub
          </Button>
        </div>
      </Card>
    </div>
  );
}

function AppFooter() {
  const { t } = useI18n();

  return (
    <footer className="border-t bg-background/95">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-4 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
        <div className="flex items-center gap-3">
          <BrandIcon className="h-9 w-9" />
          <span>{t('app.search_validate')}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/sources" className="underline underline-offset-4">
            {t('nav.sources')}
          </Link>
          <Link to="/impressum" className="underline underline-offset-4">
            {t('nav.impressum')}
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default function App() {
  const LoadingRoute = () => {
    const { t } = useI18n();
    return <div className="p-6">{t("common.loading")}</div>;
  };

  return (
    <I18nProvider>
      <GlossaryProvider>
        <BackgroundDecor />
        <div className="relative z-10">
          <Header />

          <main className="relative">
            <Suspense fallback={<LoadingRoute />}>
              <Routes>
                <Route path="/" element={<SearchPage />} />
                <Route path="/sources" element={<SourcesPage />} />
                <Route path="/impressum" element={<ImpressumPage />} />
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
                  <Route path="life-events" element={<AdminLifeEventReview />} />
                  <Route path="duplicates" element={<AdminDuplicates />} />
                  <Route path="user-trust" element={<AdminUserTrust />} />
                  <Route path="audit-log" element={<AdminAuditLog />} />
                </Route>

                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </Suspense>
          </main>
          <AppFooter />
        </div>
      </GlossaryProvider>
    </I18nProvider>
  );
}
