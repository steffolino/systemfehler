import { Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/layout/Header';
// Removed unused imports: Sidebar, DataPreview, QualityMetrics, ModerationQueue, Navbar
import SearchPage from './pages/SearchPage';
import EntryPage from './pages/EntryPage';
import AdminLogin from './pages/AdminLogin';
import AdminApp from './pages/AdminApp';

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<SearchPage />} />
        <Route path="/entry/:id" element={<EntryPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}
