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
    console.log("2")
      setAuthToken(session.access_token);
    console.log("3")
      try {
    console.log("4")
        const { role, email } = await checkAuthRole(session.access_token);
    console.log("5")
        setUserCtx({ role: role as UserContext["role"], email });
    console.log("6")
      } catch {
    console.log("7")
        setUserCtx({ role: "guest", email: session.user.email ?? null });
    console.log("8")
      }
    console.log("9")
      setSession(session);
    console.log("10")
    }
    console.log("11")
    setCheckingAuth(false);
    console.log("12")
  });

  // Then: listen for future changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (_event, session) => {
      if (session) {
        setAuthToken(session.access_token);
        try {
          console.log("2.1")
          const { role, email } = await checkAuthRole(session.access_token);
          setUserCtx({ role: role as UserContext["role"], email });
        } catch {
          setUserCtx({ role: "guest", email: session.user.email ?? null });
        }
        setSession(session);
      } else {
        setSession(null);
        setUserCtx(null);
        setCheckingAuth(false);
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