import { LogOut, Moon, Sun } from "lucide-react";
import { UserContext } from "../types";
import TitlesView from "./TitlesView";
import { useDarkMode } from "../hooks/useDarkMode";

interface Props {
  userCtx: UserContext;
  onLogout?: () => void;
  onBackToLogin?: () => void;
}

export default function MediaView({ userCtx, onLogout, onBackToLogin }: Props) {
  const { isDark, toggle } = useDarkMode();

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
                <span className="text-xs text-muted bg-muted px-2 py-1 rounded-lg">
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
        <TitlesView userCtx={userCtx} />
      </div>

      {/* Footer */}
      <footer className="text-center py-3 text-xs text-muted border-t border-subtle bg-nav">
        <span>© {new Date().getFullYear()} Snyuki</span>
        <span className="mx-2">·</span>
        <span>v{__APP_VERSION__}</span>
      </footer>
    </div>
  );
}