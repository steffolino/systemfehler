import { NavLink } from "react-router-dom";

export default function Sidebar() {
  const linkClass =
    "block px-3 py-2 rounded-md text-sm hover:bg-muted";

  const activeClass =
    "bg-muted font-medium";

  return (
    <aside className="w-64 border-r p-4">
      <nav className="space-y-1">

        <NavLink to="/admin" end
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ""}`
          }>
          Overview
        </NavLink>

        <NavLink to="/admin/moderation"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ""}`
          }>
          Moderation
        </NavLink>

        <NavLink to="/admin/quality"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ""}`
          }>
          Quality
        </NavLink>

        <NavLink to="/admin/raw"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ""}`
          }>
          Raw Entries
        </NavLink>

        <NavLink to="/admin/duplicates"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ""}`
          }>
          Duplicates
        </NavLink>

        <NavLink to="/admin/user-trust"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ""}`
          }>
          User Trust
        </NavLink>

        <NavLink to="/admin/audit-log"
          className={({ isActive }) =>
            `${linkClass} ${isActive ? activeClass : ""}`
          }>
          Audit Log
        </NavLink>

      </nav>
    </aside>
  );
}
