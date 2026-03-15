import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import SearchInput from "../SearchInput";
import { Button } from "@/components/ui/button";

const ROLES_CLAIM = "https://systemfehler/roles";

function getDisplayName(user: Record<string, unknown> | undefined) {
  if (!user) return null;

  return (
    (typeof user.name === "string" && user.name) ||
    (typeof user.nickname === "string" && user.nickname) ||
    (typeof user.email === "string" && user.email) ||
    null
  );
}

export function Header() {
  const [searchValue, setSearchValue] = useState("");

  const { isAuthenticated, loginWithRedirect, logout, user, isLoading } =
    useAuth0();

  const location = useLocation();
  const navigate = useNavigate();

  const isAdminRoute = location.pathname.startsWith("/admin");
  const isEntryRoute = location.pathname.startsWith("/entry/");
  const isSourcesRoute = location.pathname.startsWith("/sources");

  const roles = useMemo(() => {
    const rawRoles = user?.[ROLES_CLAIM as keyof typeof user];

    return Array.isArray(rawRoles)
      ? rawRoles.filter((role): role is string => typeof role === "string")
      : [];
  }, [user]);

  const isAdmin = roles.includes("admin");

  const displayName = getDisplayName(
    user as Record<string, unknown> | undefined
  );

  const handleAdminClick = () => {
    navigate("/admin");
  };

  const handleLogin = () => {
    loginWithRedirect({
      appState: { returnTo: "/admin" },
    });
  };

  const handleLogout = () => {
    logout({
      logoutParams: { returnTo: window.location.origin },
    });
  };

  const subtitle = isAdminRoute
    ? "Admin workspace"
    : isSourcesRoute
      ? "Source transparency"
    : "Search and validate entries";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto w-full max-w-7xl px-4 py-3 md:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center justify-between gap-4">
            <div className="min-w-0">
              <Link
                to="/"
                className="block truncate text-xl font-semibold tracking-tight text-foreground md:text-2xl"
              >
                Systemfehler
              </Link>

              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground md:text-sm">
                <span>{subtitle}</span>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:inline">v0.1.0</span>
              </div>
            </div>

            {displayName && (
              <div className="hidden shrink-0 rounded-lg border px-3 py-1.5 text-right lg:block">
                <div className="max-w-45 truncate text-sm font-medium">
                  {displayName}
                </div>

                <div className="text-xs text-muted-foreground">
                  {isAdmin ? "Admin access" : "Authenticated"}
                </div>
              </div>
            )}
          </div>

          {!isAdminRoute && (
            <div className="w-full lg:max-w-xl lg:flex-1">
              <SearchInput
                navbar
                value={searchValue}
                onChange={setSearchValue}
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={isSourcesRoute ? "default" : "outline"}
              size="sm"
              onClick={() => navigate("/sources")}
            >
              Sources
            </Button>

            {/* Admin button only when logged in */}
            {isAuthenticated && (
              <Button
                variant={isAdminRoute ? "default" : "outline"}
                size="sm"
                onClick={handleAdminClick}
              >
                Admin
              </Button>
            )}

            {/* When inside admin show quick link back to frontend */}
            {isAuthenticated && isAdminRoute && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/")}
              >
                Search
              </Button>
            )}

            {!isAuthenticated && !isLoading && (
              <Button variant="outline" size="sm" onClick={handleLogin}>
                Login
              </Button>
            )}

            {isAuthenticated && (
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            )}
          </div>
        </div>

        {displayName && (
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground lg:hidden">
            <span className="truncate">{displayName}</span>
            <span>{isAdmin ? "Admin access" : "Authenticated"}</span>
          </div>
        )}

        {isEntryRoute && (
          <div className="mt-3 text-xs text-muted-foreground">
            Viewing entry details
          </div>
        )}
      </div>
    </header>
  );
}
