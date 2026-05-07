import { useState, useEffect, useRef, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "student" | "teacher";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  profile: { full_name: string; avatar_url: string; group_name: string } | null;
  signOut: () => Promise<void>;
  /** Re-fetches profile + role from Supabase. Call this after updating the
   *  profile (avatar, name, group) so the rest of the UI sees the change
   *  without a full reload. */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  role: null,
  profile: null,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  // Last user id we fetched role+profile for — avoids re-firing on every
  // TOKEN_REFRESHED / INITIAL_SESSION event. Without this, an entry into the
  // app would fire ~3-4 duplicate /profiles + /user_roles requests.
  const fetchedUserIdRef = useRef<string | null>(null);

  const fetchUserData = async (userId: string, force = false) => {
    if (!force && fetchedUserIdRef.current === userId) return;
    fetchedUserIdRef.current = userId;
    const [{ data: roles }, { data: prof }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("full_name, avatar_url, group_name").eq("user_id", userId).single(),
    ]);
    if (roles && roles.length > 0) setRole(roles[0].role as AppRole);
    if (prof) setProfile(prof);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchUserData(session.user.id), 0);
      } else {
        fetchedUserIdRef.current = null;
        setRole(null);
        setProfile(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchUserData(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (!user) return;
    await fetchUserData(user.id, true);
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, role, profile, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
