import React from 'react';
import { supabase } from './lib/supabase.js';

const AuthCtx = React.createContext({
  session: null,
  user: null,
  loading: true,
});

export const useAuth = () => React.useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [session, setSession] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = { session, user: session?.user ?? null, loading };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
