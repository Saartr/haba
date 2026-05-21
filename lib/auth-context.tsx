import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { isAuthenticated } from '@/lib/auth';
import { getMe, UserProfile } from '@/lib/api';

type AuthContextType = {
  authed: boolean;
  checked: boolean;
  user: UserProfile | null;
  setAuthed: (value: boolean, profile?: UserProfile) => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  authed: false,
  checked: false,
  user: null,
  setAuthed: () => { },
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authed, setAuthedState] = useState(false);
  const [checked, setChecked] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await getMe();
      setUser(profile);
    } catch {
      setUser(null);
    }
  }, []);

  const setAuthed = useCallback((value: boolean, profile?: UserProfile) => {
    setAuthedState(value);
    if (value) {
      if (profile) {
        setUser(profile);
      } else {
        refreshUser();
      }
    } else {
      setUser(null);
    }
  }, [refreshUser]);

  useEffect(() => {
    isAuthenticated()
      .then(async (ok) => {
        setAuthedState(ok);
        if (ok) {
          await refreshUser();
        }
      })
      .catch(() => setAuthedState(false))
      .finally(() => setChecked(true));
  }, []);

  return (
    <AuthContext.Provider value={{ authed, checked, user, setAuthed, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
