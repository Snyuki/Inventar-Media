import { useState, useEffect } from "react";
import { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { checkAuthRole } from "./lib/api";
import { UserContext } from "./types";
import LoginScreen from "./components/LoginScreen";
import MediaView from "./components/MediaView";

export default function App() {
  const [session, setSession]         = useState<Session | null>(null);
  const [userCtx, setUserCtx]         = useState<UserContext | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // ---- Auth -----------------------------------------------------------
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        setSession(session);
        if (session) {
          try {
            const { role, email } = await checkAuthRole();
            setUserCtx({ role: role as UserContext["role"], email });
          } catch {
            setUserCtx({ role: "guest", email: session.user.email ?? null });
          }
        } else {
          setUserCtx(null);
        }
        setCheckingAuth(false);
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