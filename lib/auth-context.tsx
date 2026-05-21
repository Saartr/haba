import { createContext, useContext, useState, useEffect } from 'react';
import { isAuthenticated } from '@/lib/auth';

type AuthContextType = {
  authed: boolean;
  setAuthed: (value: boolean) => void;
};

const AuthContext = createContext<AuthContextType>({
  authed: false,
  setAuthed: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    isAuthenticated()
      .then(setAuthed)
      .catch(() => setAuthed(false));
  }, []);

  return (
    <AuthContext.Provider value={{ authed, setAuthed }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
