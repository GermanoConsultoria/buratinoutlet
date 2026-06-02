import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { getMyProfile, type UserProfile } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

type AuthContextType = {
  profile: UserProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  profile: null,
  loading: true,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const p = await getMyProfile();
    setProfile(p);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      load();
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ profile, loading, refresh: load }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}