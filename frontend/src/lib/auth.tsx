import {
  Auth0Provider,
  useAuth0 as useAuth0Base,
  type AppState,
  type LogoutOptions,
  type RedirectLoginOptions,
  type User,
} from '@auth0/auth0-react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type AuthContextValue = {
  isConfigured: boolean;
  demoUser: User | undefined;
  loginWithDemoCredentials: (username: string, password: string) => Promise<boolean>;
  logoutDemo: () => void;
};

type SafeAuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | undefined;
  loginWithRedirect: (options?: RedirectLoginOptions<AppState>) => Promise<void>;
  logout: (options?: LogoutOptions) => void;
  isConfigured: boolean;
  isDemoReadOnly: boolean;
  loginWithDemoCredentials: (username: string, password: string) => Promise<boolean>;
};

const DEMO_SESSION_KEY = 'sf_demo_admin_session';
const DEMO_USERNAME = import.meta.env.VITE_DEMO_ADMIN_USER || 'demo';
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_ADMIN_PASSWORD || 'systemfehler-demo';
const DEMO_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const demoUser: User = {
  sub: 'demo-readonly',
  name: 'Demo Reviewer',
  nickname: 'demo',
  email: 'demo-readonly@systemfehler.local',
  'https://systemfehler/roles': ['demo_readonly'],
};

const noopDemoLogin = async () => false;

const AuthContext = createContext<AuthContextValue>({
  isConfigured: false,
  demoUser: undefined,
  loginWithDemoCredentials: noopDemoLogin,
  logoutDemo() {},
});

const authDisabledState: SafeAuthState = {
  isAuthenticated: false,
  isLoading: false,
  user: undefined,
  isConfigured: false,
  isDemoReadOnly: false,
  async loginWithRedirect() {},
  logout() {},
  loginWithDemoCredentials: noopDemoLogin,
};

function hasAuth0Config() {
  return Boolean(import.meta.env.VITE_AUTH0_DOMAIN && import.meta.env.VITE_AUTH0_CLIENT_ID);
}

export function AppAuthProvider({ children }: { children: ReactNode }) {
  const isConfigured = hasAuth0Config();
  const [activeDemoUser, setActiveDemoUser] = useState<User | undefined>();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DEMO_SESSION_KEY);
      const session = raw ? JSON.parse(raw) : null;
      if (session?.user === DEMO_USERNAME && typeof session?.expiresAt === 'number' && session.expiresAt > Date.now()) {
        setActiveDemoUser(demoUser);
      } else {
        window.localStorage.removeItem(DEMO_SESSION_KEY);
      }
    } catch {
      window.localStorage.removeItem(DEMO_SESSION_KEY);
    }
  }, []);

  async function loginWithDemoCredentials(username: string, password: string) {
    if (username.trim() !== DEMO_USERNAME || password !== DEMO_PASSWORD) {
      return false;
    }

    window.localStorage.setItem(
      DEMO_SESSION_KEY,
      JSON.stringify({ user: DEMO_USERNAME, expiresAt: Date.now() + DEMO_SESSION_TTL_MS })
    );
    setActiveDemoUser(demoUser);
    return true;
  }

  function logoutDemo() {
    window.localStorage.removeItem(DEMO_SESSION_KEY);
    setActiveDemoUser(undefined);
  }

  const contextValue = {
    isConfigured,
    demoUser: activeDemoUser,
    loginWithDemoCredentials,
    logoutDemo,
  };

  if (!isConfigured) {
    return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
  }

  return (
    <AuthContext.Provider value={contextValue}>
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
  const { isConfigured, demoUser: activeDemoUser, loginWithDemoCredentials, logoutDemo } = useContext(AuthContext);
  if (activeDemoUser) {
    return {
      isAuthenticated: true,
      isLoading: false,
      user: activeDemoUser,
      isConfigured: true,
      isDemoReadOnly: true,
      async loginWithRedirect() {},
      logout() {
        logoutDemo();
      },
      loginWithDemoCredentials,
    };
  }

  if (!isConfigured) {
    return {
      ...authDisabledState,
      isConfigured: true,
      loginWithDemoCredentials,
    };
  }

  const auth = useAuth0Base();
  return {
    ...auth,
    isConfigured: true,
    isDemoReadOnly: false,
    loginWithDemoCredentials,
  };
}
