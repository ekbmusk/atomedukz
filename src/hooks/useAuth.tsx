import { useState, useEffect, useRef, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "student" | "teacher";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  profile: { full_name: string; avatar_url: string } | null;
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
    const [{ data: roles }, profRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("full_name, avatar_url").eq("user_id", userId).maybeSingle(),
    ]);
    if (roles && roles.length > 0) {
      setRole(roles[0].role as AppRole);
    } else {
      // No role row — student is the safe default; matches the trigger.
      setRole("student");
    }

    if (profRes.data) {
      setProfile(profRes.data);
      return;
    }
    // No profile row. Two reasons we land here:
    //   1) handle_new_user trigger hasn't run yet (signup race), or
    //   2) someone deleted the row manually leaving auth.users behind.
    // Either way, create a blank profile so the rest of the app has a
    // record to read/write. RLS allows the user to insert their own row.
    const insertRes = await supabase
      .from("profiles")
      .insert({ user_id: userId, full_name: "", avatar_url: "" } as never)
      .select("full_name, avatar_url")
      .maybeSingle();
    if (insertRes.data) {
      setProfile(insertRes.data);
    } else {
      // Fall back to an empty in-memory profile so the onboarding gate
      // still fires and the UI doesn't sit on a spinner forever.
      setProfile({ full_name: "", avatar_url: "" });
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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

      // When the user lands here from a password-recovery email, Supabase
      // attaches a recovery session and fires PASSWORD_RECOVERY. Without
      // this redirect, the session looks like a normal login and the
      // auth flow would just drop the user on /topics with no chance to
      // pick a new password.
      //
      // Guard against false-positive fires: only redirect when the URL
      // actually carries a type=recovery marker. Without this, certain
      // SDK code paths can re-emit PASSWORD_RECOVERY on plain page loads
      // and silently kick the user out of their session into the reset
      // flow — which looks like "deploy logged me out".
      if (event === "PASSWORD_RECOVERY") {
        const url = window.location.hash + window.location.search;
        const looksLikeRecovery = /[?#&]type=recovery\b/i.test(url);
        if (
          looksLikeRecovery &&
          window.location.pathname !== "/auth/reset" &&
          window.location.pathname !== "/auth/callback"
        ) {
          window.location.replace("/auth/callback");
        }
      }
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
