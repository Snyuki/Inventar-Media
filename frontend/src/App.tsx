import { useState, useEffect } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { checkAuthRole, savePreferredInput } from "./lib/api";
import { PreferredInput, UserContext } from "./types";
import LoginScreen from "./components/LoginScreen";
import MediaView from "./components/MediaView";
import { setAuthToken } from "./lib/api";

export default function App() {
  const [session, setSession]           = useState<Session | null>(null);
  const [userCtx, setUserCtx]           = useState<UserContext | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [preferredInput, setPreferredInput] = useState<PreferredInput>("barcode_scanner");

  // ---- Auth -----------------------------------------------------------
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (_event, session) => {
      if (session) {
        setAuthToken(session.access_token);
        try {
          const { role, email } = await checkAuthRole(session.access_token);
          setUserCtx({ role: role as UserContext["role"], email });
        } catch {
          setUserCtx({ role: "guest", email: session.user.email ?? null });
        }
        setSession(session);
        applyUserPrefs(session);
      } else {
        setSession(null);
        setUserCtx(null);
      }
      setCheckingAuth(false);
    }
  );

  return () => subscription.unsubscribe();
}, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAuthToken(null);
    setSession(null);
    setUserCtx(null);
  };

  const handleReturnToLoginScreen = () => {
    setUserCtx(null);

    // These are not neccessarily needed but here just in case since they dont hurt
    setAuthToken(null);
    setSession(null);
  }

  const handleContinueAsGuest = () => {
    setAuthToken(null);
    setUserCtx({ role: "guest", email: null });
    setCheckingAuth(false);
  };

  // ---- Setting handlers -----------------------------------------------
  const handlePreferredInputChange = async (value: PreferredInput) => {
    setPreferredInput(value);
    try {
      await savePreferredInput(value);
    } catch (e) {
      console.error("Failed to save preference:", e);
    }
  };
  
  const applyUserPrefs = (session: Session) => {
    const savedPref = session.user.user_metadata?.preferred_input;
    if (savedPref === "barcode_scanner" || savedPref === "manual_input") {
      setPreferredInput(savedPref);
    }
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
      onBackToLogin={handleReturnToLoginScreen}
      preferredInput={preferredInput}
      onPreferredInputChange={setPreferredInput}
    />
  );
}