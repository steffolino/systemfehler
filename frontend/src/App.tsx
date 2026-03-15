import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

import { Header } from "./components/layout/Header";
import AdminLayout from "./components/admin/AdminLayout";

import SearchPage from "./pages/SearchPage";
import EntryPage from "./pages/EntryPage";

import AdminApp from "./pages/AdminApp";
import AdminModeration from "./pages/AdminModeration";
import AdminQuality from "./pages/AdminQuality";
import AdminRawEntries from "./pages/AdminRawEntries";
import AdminDuplicates from "./pages/AdminDuplicates";
import AdminUserTrust from "./pages/AdminUserTrust";
import AdminAuditLog from "./pages/AdminAuditLog";
import type { JSX } from "react";

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, isLoading } = useAuth0();

  if (isLoading) return <div className="p-6">Loading…</div>;

  if (!isAuthenticated) return <Navigate to="/" replace />;

  return children;
}

export default function App() {
  return (
    <>
      <Header />

      <Routes>
        <Route path="/" element={<SearchPage />} />
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
  );
}
