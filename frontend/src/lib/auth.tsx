import {
  Auth0Provider,
  useAuth0 as useAuth0Base,
  type AppState,
  type LogoutOptions,
  type RedirectLoginOptions,
  type User,
} from '@auth0/auth0-react';
import { createContext, useContext, type ReactNode } from 'react';

type AuthContextValue = {
  isConfigured: boolean;
};

type SafeAuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | undefined;
  loginWithRedirect: (options?: RedirectLoginOptions<AppState>) => Promise<void>;
  logout: (options?: LogoutOptions) => void;
  isConfigured: boolean;
};

const AuthContext = createContext<AuthContextValue>({ isConfigured: false });

const authDisabledState: SafeAuthState = {
  isAuthenticated: false,
  isLoading: false,
  user: undefined,
  isConfigured: false,
  async loginWithRedirect() {},
  logout() {},
};

function hasAuth0Config() {
  return Boolean(import.meta.env.VITE_AUTH0_DOMAIN && import.meta.env.VITE_AUTH0_CLIENT_ID);
}

export function AppAuthProvider({ children }: { children: ReactNode }) {
  const isConfigured = hasAuth0Config();

  if (!isConfigured) {
    return <AuthContext.Provider value={{ isConfigured: false }}>{children}</AuthContext.Provider>;
  }

  return (
    <AuthContext.Provider value={{ isConfigured: true }}>
      <Auth0Provider
        domain={import.meta.env.VITE_AUTH0_DOMAIN}
        clientId={import.meta.env.VITE_AUTH0_CLIENT_ID}
        authorizationParams={{
          redirect_uri: window.location.origin,
          connection: 'github',
        }}
      >
        {children}
      </Auth0Provider>
    </AuthContext.Provider>
  );
}

export function useAppAuth(): SafeAuthState {
  const { isConfigured } = useContext(AuthContext);
  if (!isConfigured) {
    return authDisabledState;
  }

  const auth = useAuth0Base();
  return {
    ...auth,
    isConfigured: true,
  };
}
