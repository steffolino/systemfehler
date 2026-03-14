import { Outlet } from "react-router-dom";
import Sidebar from "../layout/Sidebar";

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 p-6 bg-muted/20">
        <Outlet />
      </main>
    </div>
  );
}
