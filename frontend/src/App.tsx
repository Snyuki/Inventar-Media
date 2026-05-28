import { useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { checkAuthRole } from "./lib/api";
import { UserContext } from "./types";
import LoginScreen from "./components/LoginScreen";
import MediaView from "./components/MediaView";
import { setAuthToken } from "./lib/api";

export default function App() {
  const [session, setSession]         = useState<Session | null>(null);
  const [userCtx, setUserCtx]         = useState<UserContext | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(false);

  // ---- Auth -----------------------------------------------------------
useEffect(() => {
  // First: check if there's already a session (including from hash fragment)
  supabase.auth.getSession().then(async ({ data: { session } }) => {
    console.log("1")
    if (session) {
      setAuthToken(session.access_token);
      try {
        const { role, email } = await checkAuthRole(session.access_token);
        setUserCtx({ role: role as UserContext["role"], email });
      } catch {
        setUserCtx({ role: "guest", email: session.user.email ?? null });
      }
      setSession(session);
    }
    setCheckingAuth(false);
  });

  // Then: listen for future changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (_event, session) => {
      if (session) {
        setAuthToken(session.access_token);
        try {
          console.log("2")
          const { role, email } = await checkAuthRole(session.access_token);
          setUserCtx({ role: role as UserContext["role"], email });
        } catch {
          setUserCtx({ role: "guest", email: session.user.email ?? null });
        }
        setSession(session);
      } else {
        setSession(null);
        setUserCtx(null);
      }
    }
  );

  return () => subscription.unsubscribe();
}, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserCtx(null);
  };

  const handleContinueAsGuest = () => {
    setUserCtx({ role: "guest", email: null });
    setCheckingAuth(false);
  };

  // ---- Guards ---------------------------------------------------------
  if (checkingAuth) return null;

  // Show login if no session and no guest context
  if (!session && !userCtx) {
    return (
      <LoginScreen onContinueAsGuest={handleContinueAsGuest} />
    );
  }

  // ---- Render ---------------------------------------------------------
  return (
    <MediaView
      userCtx={userCtx ?? { role: "guest", email: null }}
      onLogout={session ? handleLogout : undefined}
    />
  );
}