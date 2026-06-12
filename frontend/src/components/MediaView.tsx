import { LogOut, Moon, Settings, Sun } from "lucide-react";
import { PreferredInput, UserContext } from "../types";
import TitlesView from "./TitlesView";
import { useDarkMode } from "../hooks/useDarkMode";
import { useEffect, useRef, useState } from "react";
import SettingsModal from "./SettingsModal";

interface Props {
  userCtx: UserContext;
  onLogout?: () => void;
  onBackToLogin?: () => void;
  preferredInput: PreferredInput;
  onPreferredInputChange: (value: PreferredInput) => void;
}

export default function MediaView({ userCtx, onLogout, onBackToLogin, preferredInput, onPreferredInputChange }: Props) {
  const { isDark, toggle } = useDarkMode();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  return (
    <div className="min-h-screen flex flex-col bg-surface">

      {/* Navbar */}
      <nav className="bg-nav shadow-sm border-b border-subtle">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h2 className="text-primary font-semibold">Inventar Media</h2>
            <div className="flex items-center gap-2">
              {userCtx.email && (
                <span className="hidden sm:block text-sm text-muted">
                  {userCtx.email}
                </span>
              )}
              {userCtx.role === "guest" && (
                <span className="text-xs text-secondary bg-fill border border-default px-2 py-1 rounded-lg">
                  Guest
                </span>
              )}

              {/* Dark mode toggle */}
              <button
                onClick={toggle}
                className="p-2 text-subtle hover:bg-hover hover:text-primary rounded-lg transition-colors"
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {/* Settings dropdown */}
              <div ref={dropdownRef} className="relative">
                <button
                  onClick={() => setDropdownOpen(v => !v)}
                  className="p-2 text-subtle hover:bg-hover hover:text-primary rounded-lg transition-colors"
                  title="Einstellungen"
                >
                  <Settings className="w-5 h-5" />
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 top-10 z-30 bg-card border border-subtle rounded-lg shadow-lg min-w-[160px] py-1">
                    <button
                      type="button"
                      onClick={() => { setDropdownOpen(false); setSettingsOpen(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-hover transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Einstellungen
                    </button>
                  </div>
                )}
              </div>

              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-2 text-subtle hover:bg-hover hover:text-primary rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              )}
              {!onLogout && onBackToLogin && (
                <button
                  onClick={onBackToLogin}
                  className="p-2 text-subtle hover:bg-hover hover:text-primary rounded-lg transition-colors"
                  title="Back to Login"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main */}
      <div className="flex-1 flex justify-center p-4 sm:p-8">
        <TitlesView
          userCtx={userCtx}
          preferredInput={preferredInput}
        />
      </div>

      {/* Footer */}
      <footer className="text-center py-3 text-xs text-muted border-t border-subtle bg-nav">
        <span>© {new Date().getFullYear()} Snyuki</span>
        <span className="mx-2">·</span>
        <span>v{__APP_VERSION__}</span>
      </footer>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        email={userCtx.email}
        preferredInput={preferredInput}
        onPreferredInputChange={onPreferredInputChange}
      />
    </div>
  );
}